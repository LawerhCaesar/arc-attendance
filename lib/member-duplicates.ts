export interface DuplicateMember {
  id: string;
  name: string;
  phone?: string;
  fellowship?: string;
  designation?: string;
  birthday?: string;
  location?: string;
  created_at?: string;
  is_active?: boolean;
  merged_into_id?: string | null;
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
  const otherPhone = normalizeDuplicatePhone(memberB.phone);
  if (memberA.id === memberB.id || memberA.merged_into_id || memberB.merged_into_id) return null;
  const samePhone = Boolean(phone && phone === otherPhone);
  if (!samePhone) {
    // Different valid numbers remain different identities. Missing numbers need
    // a full-name match plus fellowship and corroborating member details.
    if (phone && otherPhone) return null;
    const name = nameKey(memberA.name);
    if (!name.includes(' ') || name !== nameKey(memberB.name) || !sameDetail(memberA.fellowship, memberB.fellowship) ||
      !(sameDetail(memberA.birthday, memberB.birthday) || sameDetail(memberA.location, memberB.location))) return null;
  }

  return {
    pairKey: duplicatePairKey(memberA.id, memberB.id),
    memberA,
    memberB,
    confidence: samePhone ? 'high' : 'medium',
    score: samePhone ? 100 : 70,
    reasons: samePhone ? ['Phone numbers match'] : ['Full names match', 'Fellowships match',
      ...(sameDetail(memberA.birthday, memberB.birthday) ? ['Birthdays match'] : []),
      ...(sameDetail(memberA.location, memberB.location) ? ['Locations match'] : []), 'Phone missing or invalid; review required'],
  };
}

const detailKey = (value?: string) => (value || '').normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ');
const sameDetail = (left?: string, right?: string) => Boolean(detailKey(left) && !['-', 'n/a', 'unknown', 'unassigned'].includes(detailKey(left)) && detailKey(left) === detailKey(right));
const nameKey = (value: string) => detailKey(value).split(' ').filter(Boolean).sort().join(' ');

export function findMemberDuplicateCandidates(
  members: DuplicateMember[],
  ignoredPairKeys: ReadonlySet<string> = new Set(),
): MemberDuplicateCandidate[] {
  const candidates: MemberDuplicateCandidate[] = [];
  const phoneGroups = new Map<string, DuplicateMember[]>();
  const seenIds = new Set<string>();

  members.forEach(member => {
    const phone = normalizeDuplicatePhone(member.phone);
    if (seenIds.has(member.id) || member.merged_into_id) return;
    seenIds.add(member.id);
    const keys = [phone ? `phone:${phone}` : '', `name:${nameKey(member.name)}`].filter(Boolean);
    for (const key of keys) {
      const group = phoneGroups.get(key) || [];
      group.push(member);
      phoneGroups.set(key, group);
    }
  });

  const emitted = new Set<string>();
  phoneGroups.forEach(group => {
    group.sort((a, b) => Number(b.is_active !== false) - Number(a.is_active !== false) || (a.created_at || '').localeCompare(b.created_at || '') || a.id.localeCompare(b.id));
    const covered = new Set<string>();
    // One anchor covers a repeated phone number without quadratic pairings.
    // An excluded record may need another anchor to retain unreviewed matches.
    for (const anchor of group) {
      if (covered.has(anchor.id)) continue;
      for (const member of group) {
        if (anchor.id === member.id || ignoredPairKeys.has(duplicatePairKey(anchor.id, member.id))) continue;
        const candidate = duplicateCandidateForPair(anchor, member);
        if (!candidate) continue;
        if (!emitted.has(candidate.pairKey)) candidates.push(candidate);
        emitted.add(candidate.pairKey);
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
