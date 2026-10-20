import { normalizeDuplicatePhone } from '@/lib/member-duplicates';

export default function CallMemberButton({ name, phone }: { name: string; phone?: string | null }) {
  const number = normalizeDuplicatePhone(phone);
  if (!number) return <span title={`No valid phone number saved for ${name}`} className="inline-flex min-h-10 shrink-0 items-center rounded-lg bg-gray-100 px-3 text-xs font-medium text-gray-600">No phone</span>;
  return <a href={`tel:+${number}`} aria-label={`Call ${name}`} title={`Call ${name} (${phone})`}
    className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg bg-blue-700 px-3 text-xs font-semibold text-white hover:bg-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700">
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4"><path strokeLinecap="round" strokeLinejoin="round" d="M22 16.9v3a2 2 0 0 1-2.2 2A19.8 19.8 0 0 1 3.1 5.2 2 2 0 0 1 5.1 3h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L9 10.9a16 16 0 0 0 4.1 4.1l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z" /></svg>
    Call
  </a>;
}
