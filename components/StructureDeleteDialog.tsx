'use client';
import { useEffect, useRef } from 'react';

export interface StructureDeletion { kind: 'cell' | 'bsct'; id: string; label: string; brethren: number; groups: number }
export default function StructureDeleteDialog({ target, busy, error, onClose, onConfirm }: {
  target: StructureDeletion; busy: boolean; error: string; onClose: () => void; onConfirm: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { dialog.current?.showModal(); }, []);
  return <dialog ref={dialog} aria-labelledby="delete-structure-title" onCancel={event => { event.preventDefault(); if (!busy) onClose(); }} className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-2xl bg-white p-6 text-gray-950 shadow-xl backdrop:bg-black/40">
    <h3 id="delete-structure-title" className="text-xl font-bold">Delete {target.label}?</h3>
    <p className="mt-3 text-sm text-gray-700">{target.kind === 'cell' ? `This removes the cell and its ${target.groups} BSCT group${target.groups === 1 ? '' : 's'}. Its ${target.brethren} brethren will have no cell or BSCT assignment.` : `Its ${target.brethren} brethren will stay in their cell with no BSCT assignment.`} Affected group leader assignments will be cleared.</p>
    <p className="mt-3 text-sm font-semibold text-gray-900">Brethren, their details, and attendance records are kept. The deleted group cannot be restored.</p>
    {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    <div className="mt-5 flex justify-end gap-3"><button type="button" disabled={busy} onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold disabled:opacity-50">Cancel</button><button type="button" disabled={busy} onClick={onConfirm} className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50">{busy ? 'Deleting…' : `Delete ${target.kind === 'cell' ? 'cell' : 'BSCT group'}`}</button></div>
  </dialog>;
}
