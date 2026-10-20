'use client';
import { useCallback,useEffect,useId,useState } from 'react';
import Image from 'next/image';
export default function ProfilePhotoUpload({name,memberId}:{name:string;memberId?:string}){
  const id=useId();const endpoint=`/api/photos${memberId?`?memberId=${encodeURIComponent(memberId)}`:''}`;
  const [photo,setPhoto]=useState<{hasPhoto:boolean;ready:boolean;version:string|null}|null>(null);
  const [file,setFile]=useState<File|null>(null);const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [notice,setNotice]=useState('');const [imageFailed,setImageFailed]=useState(false);
  const load=useCallback(async(signal?:AbortSignal)=>{try{const response=await fetch(endpoint,{cache:'no-store',signal});const result=await response.json();if(!response.ok)throw new Error(result.error);setPhoto(result);}catch(error){if(!signal?.aborted)setError(error instanceof Error?error.message:'Photo could not be loaded.');}},[endpoint]);
  useEffect(()=>{const controller=new AbortController();void load(controller.signal);return()=>controller.abort();},[load]);
  const upload=async()=>{if(!file||busy)return;setBusy(true);setError('');setNotice('');try{const body=new FormData();body.set('photo',file);const response=await fetch(endpoint,{method:'POST',body});const result=await response.json();if(!response.ok)throw new Error(result.error);setPhoto({hasPhoto:true,ready:true,version:result.version});setImageFailed(false);setFile(null);setNotice(result.message);window.dispatchEvent(new Event('profile-photo-updated'));}catch(error){setError(error instanceof Error?error.message:'Photo could not be uploaded.');}finally{setBusy(false);}};
  return <section aria-labelledby={id} className="rounded-xl border border-gray-200 bg-white p-4 text-gray-900">
    <h3 id={id} className="font-semibold">Profile picture</h3><p className="mt-1 text-xs text-gray-600">Upload a JPG, PNG or WebP up to 2 MB. Pictures are stored privately in Google Drive.</p>
    <div className="mt-4 flex flex-wrap items-center gap-4">
      {photo?.hasPhoto&&!imageFailed?<Image unoptimized width={80} height={80} src={`${endpoint}${memberId?'&':'?'}image=1&v=${encodeURIComponent(photo.version||'')}`} alt={`${name}'s profile picture`} onError={()=>setImageFailed(true)} className="h-20 w-20 rounded-full object-cover" />:<span aria-label="No profile picture" className="flex h-20 w-20 items-center justify-center rounded-full bg-blue-100 text-2xl font-bold text-blue-800">{name.slice(0,1).toUpperCase()||'?'}</span>}
      <div className="min-w-0 flex-1 space-y-3"><label className="block text-sm font-medium">Choose picture<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy||!photo?.ready} onChange={event=>{setFile(event.target.files?.[0]||null);setNotice('');}} className="mt-1 block w-full text-sm text-gray-700 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:text-blue-800 disabled:opacity-50" /></label><button type="button" onClick={upload} disabled={!file||busy||!photo?.ready} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy?'Uploading…':photo?.hasPhoto?'Replace picture':'Upload picture'}</button></div>
    </div>
    {photo&&!photo.ready&&<p className="mt-3 text-sm text-amber-900">Google Drive setup is pending. The base administrator can connect it in Users &amp; Roles.</p>}
    {imageFailed&&<p className="mt-3 text-sm text-amber-900">The saved picture could not be displayed. Try replacing it, or ask the administrator to reconnect Google Drive.</p>}
    {error&&<p role="alert" className="mt-3 text-sm text-red-800">{error}</p>}{notice&&<p role="status" className="mt-3 text-sm text-green-800">{notice}</p>}
  </section>;
}
