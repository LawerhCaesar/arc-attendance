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

/** Ghana local/country-code formats share a key; other country codes stay intact. */
export function normalizeDuplicatePhone(value?: string | null): string | null {
  const compact = (value || '').trim().replace(/^'/, '').replace(/[\s().-]/g, '');
  if (!/^(?:\+|00)?\d+$/.test(compact)) return null;
  const digits = compact.startsWith('+') ? compact.slice(1) : compact.startsWith('00') ? compact.slice(2) : compact;
  // A leading + or 00 explicitly identifies an international number.
  const international = compact.startsWith('+') || compact.startsWith('00');
  if (!international) {
    if (/^0[1-9]\d{8}$/.test(digits)) return `233${digits.slice(1)}`;
    if (/^[1-9]\d{8}$/.test(digits)) return `233${digits}`;
  }
  if (digits.startsWith('233')) return /^2330?[1-9]\d{8}$/.test(digits) ? `233${digits.slice(-9)}` : null;
  return (international ? /^[1-9]\d{7,14}$/ : /^[1-9]\d{9,14}$/).test(digits) ? digits : null;
}

export function duplicatePairKey(leftId: string, rightId: string): string {
  return [leftId, rightId].sort().join(':');
}

export function duplicateCandidateForPair(
  memberA: DuplicateMember,
  memberB: DuplicateMember,
): MemberDuplicateCandidate | null {
  const phone = normalizeDuplicatePhone(memberA.phone);
  if (memberA.id === memberB.id || !phone || phone !== normalizeDuplicatePhone(memberB.phone)) return null;

  return {
    pairKey: duplicatePairKey(memberA.id, memberB.id),
    memberA,
    memberB,
    confidence: 'high',
    score: 100,
    reasons: ['Phone numbers match'],
  };
}

export function findMemberDuplicateCandidates(
  members: DuplicateMember[],
  ignoredPairKeys: ReadonlySet<string> = new Set(),
): MemberDuplicateCandidate[] {
  const candidates: MemberDuplicateCandidate[] = [];
  const phoneGroups = new Map<string, DuplicateMember[]>();
  const seenIds = new Set<string>();

  members.forEach(member => {
    const phone = normalizeDuplicatePhone(member.phone);
    if (!phone || seenIds.has(member.id)) return;
    seenIds.add(member.id);
    const group = phoneGroups.get(phone) || [];
    group.push(member);
    phoneGroups.set(phone, group);
  });

  phoneGroups.forEach(group => {
    const covered = new Set<string>();
    // One anchor covers a repeated phone number without quadratic pairings.
    // An excluded record may need another anchor to retain unreviewed matches.
    for (const anchor of group) {
      if (covered.has(anchor.id)) continue;
      for (const member of group) {
        if (anchor.id === member.id || ignoredPairKeys.has(duplicatePairKey(anchor.id, member.id))) continue;
        const candidate = duplicateCandidateForPair(anchor, member)!;
        candidates.push(candidate);
        covered.add(anchor.id);
        covered.add(member.id);
      }
    }
  });
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
