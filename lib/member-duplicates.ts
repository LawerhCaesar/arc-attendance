export interface DuplicateMember {
  id: string;
  name: string;
  phone?: string;
  fellowship?: string;
  designation?: string;
  birthday?: string;
  location?: string;
  created_at?: string;
}

export interface MemberDuplicateCandidate {
  pairKey: string;
  memberA: DuplicateMember;
  memberB: DuplicateMember;
  confidence: 'high' | 'medium' | 'low';
  score: number;
  reasons: string[];
}

export interface MemberDuplicateGroup {
  groupKey: string;
  anchor: DuplicateMember;
  matches: DuplicateMember[];
  memberIds: string[];
  matchCount: number;
  confidence: 'high' | 'medium' | 'low';
  score: number;
  reasons: string[];
}

const normalizeText = (value?: string) => (value || '')
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim()
  .replace(/\s+/g, ' ');

const normalizePhone = (value?: string) => {
  const digits = (value || '').replace(/\D/g, '');
  return digits.length >= 9 ? digits.slice(-9) : digits;
};

function levenshtein(left: string, right: string): number {
  if (!left.length) return right.length;
  if (!right.length) return left.length;
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let row = 1; row <= left.length; row += 1) {
    const current = [row];
    for (let column = 1; column <= right.length; column += 1) {
      current[column] = Math.min(
        current[column - 1] + 1,
        previous[column] + 1,
        previous[column - 1] + (left[row - 1] === right[column - 1] ? 0 : 1),
      );
    }
    previous.splice(0, previous.length, ...current);
  }
  return previous[right.length];
}

function stringSimilarity(left: string, right: string): number {
  if (!left || !right) return 0;
  if (left === right) return 1;
  return 1 - levenshtein(left, right) / Math.max(left.length, right.length);
}

export function nameSimilarity(left?: string, right?: string): number {
  const a = normalizeText(left);
  const b = normalizeText(right);
  if (!a || !b) return 0;
  if (Math.min(a.length, b.length) < 5) return a === b ? 1 : 0;
  const ordered = stringSimilarity(a, b);
  const tokenSorted = stringSimilarity(
    a.split(' ').sort().join(' '),
    b.split(' ').sort().join(' '),
  );
  return Math.max(ordered, tokenSorted);
}

export function contactSimilarity(left?: string, right?: string): number {
  const a = normalizePhone(left);
  const b = normalizePhone(right);
  if (a.length < 7 || b.length < 7) return 0;
  return stringSimilarity(a, b);
}

export function duplicatePairKey(leftId: string, rightId: string): string {
  return [leftId, rightId].sort().join(':');
}

export function duplicateCandidateForPair(
  memberA: DuplicateMember,
  memberB: DuplicateMember,
): MemberDuplicateCandidate | null {
  const nameScore = nameSimilarity(memberA.name, memberB.name);
  const nameTokensA = new Set(normalizeText(memberA.name).split(' ').filter(Boolean));
  const nameTokensB = new Set(normalizeText(memberB.name).split(' ').filter(Boolean));
  const sharedNames = [...nameTokensA].filter(token => nameTokensB.has(token));

  const phoneScore = contactSimilarity(memberA.phone, memberB.phone);
  const fellowshipScore = stringSimilarity(normalizeText(memberA.fellowship), normalizeText(memberB.fellowship));
  const similarName = nameScore >= 0.82;
  const similarContact = phoneScore >= 0.88;
  const similarFellowship = fellowshipScore >= 0.9;
  const matchingDetails = (['designation', 'birthday', 'location'] as const).filter(field => {
    const value = normalizeText(memberA[field]);
    return Boolean(value && value === normalizeText(memberB[field]));
  });
  if (!similarName && !sharedNames.length && !similarContact && !similarFellowship && !matchingDetails.length) return null;

  const reasons: string[] = [];
  if (similarName) reasons.push(`Names are ${Math.round(nameScore * 100)}% similar`);
  if (sharedNames.length) reasons.push(`Shared name: ${sharedNames.join(', ')}`);
  if (similarContact) reasons.push(phoneScore === 1 ? 'Contact numbers match' : 'Contact numbers are similar');
  if (similarFellowship) reasons.push('Fellowships match');
  const detailReasons = { designation: 'Designations match', birthday: 'Birthdays match', location: 'Locations match' };
  matchingDetails.forEach(field => reasons.push(detailReasons[field]));

  // Keep corroborated matches at the top; a single overlapping detail only
  // suggests a review and must not look like a confirmed identity match.
  const corroborated = similarName && (similarContact || similarFellowship);
  const score = corroborated
    ? Math.round((nameScore * 0.6 + Math.max(phoneScore, fellowshipScore) * 0.4) * 100)
    : Math.round(Math.max(
      similarName ? nameScore * 0.6 : 0,
      sharedNames.length ? 0.5 : 0,
      similarContact ? phoneScore * 0.55 : 0,
      similarFellowship ? fellowshipScore * 0.35 : 0,
      matchingDetails.includes('birthday') ? 0.45 : 0,
      matchingDetails.includes('location') ? 0.3 : 0,
      matchingDetails.includes('designation') ? 0.2 : 0,
    ) * 100);
  const confidence = (nameScore >= 0.92 && (phoneScore === 1 || fellowshipScore === 1))
    ? 'high' : similarName || similarContact ? 'medium' : 'low';

  return {
    pairKey: duplicatePairKey(memberA.id, memberB.id),
    memberA,
    memberB,
    confidence,
    score,
    reasons,
  };
}

export function findMemberDuplicateCandidates(
  members: DuplicateMember[],
  ignoredPairKeys: ReadonlySet<string> = new Set(),
): MemberDuplicateCandidate[] {
  const candidates: MemberDuplicateCandidate[] = [];
  const exactGroups = new Map<string, DuplicateMember[]>();

  members.forEach(member => {
    const signature = [
      normalizeText(member.name),
      normalizePhone(member.phone),
      normalizeText(member.fellowship),
      normalizeText(member.designation),
      normalizeText(member.birthday),
      normalizeText(member.location),
    ].join('|');
    const group = exactGroups.get(signature) || [];
    group.push(member);
    exactGroups.set(signature, group);
  });

  const representatives: DuplicateMember[] = [];
  exactGroups.forEach(group => {
    const representative = group[0];
    representatives.push(representative);

    // Large repeated imports are reviewed against one canonical record. This
    // preserves every merge decision while avoiding n² identical pairings.
    group.slice(1).forEach(duplicate => {
      const pairKey = duplicatePairKey(representative.id, duplicate.id);
      if (ignoredPairKeys.has(pairKey)) return;
      const candidate = duplicateCandidateForPair(representative, duplicate);
      if (candidate) candidates.push(candidate);
    });
  });

  for (let left = 0; left < representatives.length; left += 1) {
    for (let right = left + 1; right < representatives.length; right += 1) {
      const memberA = representatives[left];
      const memberB = representatives[right];
      const pairKey = duplicatePairKey(memberA.id, memberB.id);
      if (ignoredPairKeys.has(pairKey)) continue;
      const candidate = duplicateCandidateForPair(memberA, memberB);
      if (candidate) candidates.push(candidate);
    }
  }
  return candidates.sort((a, b) => b.score - a.score || a.memberA.name.localeCompare(b.memberA.name));
}

/** Groups pair evidence into one anchor record with all of its possible matches. */
export function groupMemberDuplicateCandidates(
  candidates: MemberDuplicateCandidate[],
): MemberDuplicateGroup[] {
  const groups = new Map<string, {
    anchor: DuplicateMember;
    matches: Map<string, DuplicateMember>;
    confidence: MemberDuplicateCandidate['confidence'];
    score: number;
    reasons: Set<string>;
  }>();

  candidates.forEach(candidate => {
    const key = candidate.memberA.id;
    const group = groups.get(key) || {
      anchor: candidate.memberA,
      matches: new Map<string, DuplicateMember>(),
      confidence: 'low' as const,
      score: 0,
      reasons: new Set<string>(),
    };
    group.matches.set(candidate.memberB.id, candidate.memberB);
    if (candidate.confidence === 'high' || (candidate.confidence === 'medium' && group.confidence === 'low')) {
      group.confidence = candidate.confidence;
    }
    group.score = Math.max(group.score, candidate.score);
    candidate.reasons.forEach(reason => group.reasons.add(reason));
    groups.set(key, group);
  });

  return Array.from(groups.entries())
    .map(([groupKey, group]) => {
      const matches = Array.from(group.matches.values());
      return {
        groupKey,
        anchor: group.anchor,
        matches,
        memberIds: [group.anchor.id, ...matches.map(member => member.id)],
        matchCount: matches.length,
        confidence: group.confidence,
        score: group.score,
        reasons: Array.from(group.reasons),
      };
    })
    .sort((a, b) => b.matchCount - a.matchCount || b.score - a.score || a.anchor.name.localeCompare(b.anchor.name));
}
