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
  confidence: 'high' | 'medium';
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
  if (nameScore < 0.82) return null;

  const phoneScore = contactSimilarity(memberA.phone, memberB.phone);
  const fellowshipScore = stringSimilarity(normalizeText(memberA.fellowship), normalizeText(memberB.fellowship));
  const similarContact = Boolean(memberA.phone && memberB.phone && phoneScore >= 0.88);
  const similarFellowship = Boolean(memberA.fellowship && memberB.fellowship && fellowshipScore >= 0.9);
  if (!similarContact && !similarFellowship) return null;

  const reasons = [`Names are ${Math.round(nameScore * 100)}% similar`];
  if (similarContact) reasons.push(phoneScore === 1 ? 'Contact numbers match' : 'Contact numbers are similar');
  if (similarFellowship) reasons.push('Fellowships match');
  const evidenceScore = Math.max(phoneScore, fellowshipScore);
  const score = Math.round((nameScore * 0.6 + evidenceScore * 0.4) * 100);
  const confidence = (nameScore >= 0.92 && (phoneScore === 1 || fellowshipScore === 1)) ? 'high' : 'medium';

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
