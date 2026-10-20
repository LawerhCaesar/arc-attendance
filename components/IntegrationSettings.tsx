'use client';
import { useCallback,useEffect,useState } from 'react';
interface Settings { smsConfigured:boolean; smsSender:string; googleClientId:string; googleClientSecretSaved:boolean; driveConnected:boolean; googleRedirectUri:string }
const input='mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-950';
export default function IntegrationSettings(){
  const [settings,setSettings]=useState<Settings|null>(null);const [sender,setSender]=useState('');const [apiKey,setApiKey]=useState('');const [clientId,setClientId]=useState('');const [clientSecret,setClientSecret]=useState('');const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [notice,setNotice]=useState('');
  const load=useCallback(async()=>{const response=await fetch('/api/admin/integrations',{cache:'no-store'});const result=await response.json();if(!response.ok)throw new Error(result.error);setSettings(result);setSender(result.smsSender);setClientId(result.googleClientId);},[]);
  useEffect(()=>{void load().catch(error=>setError(error.message));const notice=new URL(window.location.href).searchParams.get('integrationNotice');if(notice)setNotice(notice);},[load]);
  const save=async(event:React.FormEvent,provider:'sms_online_gh'|'google_drive')=>{event.preventDefault();setBusy(true);setError('');setNotice('');try{const response=await fetch('/api/admin/integrations',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(provider==='sms_online_gh'?{provider,apiKey,sender}:{provider,clientId,clientSecret})});const result=await response.json();if(!response.ok)throw new Error(result.error);setApiKey('');setClientSecret('');setNotice(result.message);await load();}catch(error){setError(error instanceof Error?error.message:'Settings could not be saved.');}finally{setBusy(false);}};
  return <section aria-label="Messaging and photo integrations" className="space-y-4 rounded-2xl border border-blue-200 bg-white p-5 shadow-sm">
    <div><h3 className="text-lg font-bold text-gray-950">SMS &amp; Google Drive setup</h3><p className="mt-1 text-sm text-gray-600">Only the base administrator can change these settings. Saved secrets are encrypted and never shown again.</p></div>
    {error&&<p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}{notice&&<p role="status" className="rounded-lg bg-blue-50 p-3 text-sm text-blue-900">{notice}</p>}
    <div className="grid gap-5 lg:grid-cols-2">
      <form onSubmit={event=>void save(event,'sms_online_gh')} className="space-y-3 rounded-xl border border-gray-200 p-4"><h4 className="font-bold text-gray-950">SMSOnlineGH</h4><p className="text-sm text-gray-600">{settings?.smsConfigured?'Configured. Birthday SMS reminders use leaders’ and administrators’ saved phone numbers.':'Setup pending. Enter the API key and approved sender from your SMSOnlineGH account.'}</p>
        <label className="block text-sm font-medium text-gray-800">API key<input type="password" autoComplete="off" maxLength={512} value={apiKey} onChange={event=>setApiKey(event.target.value)} placeholder={settings?.smsConfigured?'Saved — leave blank to keep':'SMSOnlineGH API key'} className={input} /></label>
        <label className="block text-sm font-medium text-gray-800">Approved sender name<input required maxLength={11} value={sender} onChange={event=>setSender(event.target.value)} className={input} /></label>
        <button disabled={busy||!settings} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Save SMS settings</button>
      </form>
      <form onSubmit={event=>void save(event,'google_drive')} className="space-y-3 rounded-xl border border-gray-200 p-4"><h4 className="font-bold text-gray-950">Google Drive photo uploads</h4><p className="text-sm text-gray-600">{settings?.driveConnected?'Connected. Staff and member photos upload privately to the ARC Attendance Photos folder.':'Save a Google web OAuth client, then connect the Google account that will own the private photo folder.'}</p>
        <label className="block text-sm font-medium text-gray-800">Google OAuth client ID<input required maxLength={250} value={clientId} onChange={event=>setClientId(event.target.value)} className={input} /></label>
        <label className="block text-sm font-medium text-gray-800">Google OAuth client secret<input type="password" autoComplete="off" maxLength={512} value={clientSecret} onChange={event=>setClientSecret(event.target.value)} placeholder={settings?.googleClientSecretSaved?'Saved — leave blank to keep':'Client secret'} className={input} /></label>
        {settings&&<p className="break-all text-xs text-gray-600">Enable the Google Drive API and add this authorized redirect URI to your Google web OAuth client: <span className="font-mono">{settings.googleRedirectUri}</span></p>}
        <div className="flex flex-wrap gap-3"><button disabled={busy||!settings} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Save Google settings</button>{settings?.googleClientSecretSaved&&<a href="/api/admin/integrations/google/start" className="rounded-lg border border-blue-300 px-4 py-2 text-sm font-semibold text-blue-800">{settings.driveConnected?'Reconnect Google Drive':'Connect Google Drive'}</a>}</div>
      </form>
    </div>
  </section>;
}
