export interface EntryDraft {
  id: string;
  name: string;
  phone: string;
  location: string;
  birthday: string;
  fellowship: string;
  designation: string;
  firstTimer: boolean;
  rosterMemberId?: string;
  dirty?: boolean;
}

const legacyRosterId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Browser storage holds drafts, never the authoritative member roster. */
export function reconcileEntryRoster<T extends EntryDraft>(roster: T[], cached: T[], selected: Set<string>) {
  const activeIds = new Set(roster.map(member => member.id));
  const previous = new Map(cached.map(entry => [entry.id, entry]));
  const isRoster = (entry: T) => Boolean(entry.rosterMemberId || legacyRosterId.test(entry.id));
  const removed = cached.filter(entry => isRoster(entry) && !activeIds.has(entry.id));
  const drafts = cached.filter(entry => !isRoster(entry) && !activeIds.has(entry.id) &&
    [entry.name, entry.phone, entry.location, entry.birthday, entry.fellowship].some(value => value?.trim()));
  const entries = [
    ...drafts,
    ...roster.map(member => {
      const old = previous.get(member.id);
      return { ...member, ...(old?.dirty ? old : {}), rosterMemberId: member.id };
    }),
  ];
  const marked = new Set(entries.filter(entry => entry.name.trim() && selected.has(entry.id)).map(entry => entry.id));
  return { entries, marked, removed };
}

export function entryMetrics(entries: EntryDraft[], selected: Set<string>) {
  const named = entries.filter(entry => entry.name.trim());
  return {
    people: named.length,
    blankRows: entries.length - named.length,
    selected: named.filter(entry => selected.has(entry.id)).length,
  };
}
