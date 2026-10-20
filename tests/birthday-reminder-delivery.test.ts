import assert from 'node:assert/strict';
import test, {before,afterEach} from 'node:test';
import {NextRequest} from 'next/server';
import {dateInAccra} from '../lib/birthdays';
process.env.NEXT_PUBLIC_SUPABASE_URL='https://reminder-tests.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY='test-anon';
process.env.SUPABASE_SERVICE_ROLE_KEY='test-service';
process.env.CRON_SECRET='fixture-cron';
process.env.SMSONLINEGH_API_KEY='fixture-sms-key';
process.env.SMSONLINEGH_SENDER='ARC';
let cron:typeof import('../app/api/cron/birthday-reminders/route');
const originalFetch=globalThis.fetch;
before(async()=>{cron=await import('../app/api/cron/birthday-reminders/route');});
afterEach(()=>{globalThis.fetch=originalFetch;});
const request=()=>new NextRequest('http://localhost/api/cron/birthday-reminders',{headers:{authorization:'Bearer fixture-cron'}});
function fixture(options:{providerFailure?:boolean;uncertain?:boolean;claimFailure?:boolean;rosterFailure?:boolean;finalSaveFailure?:boolean;celebrants?:boolean;noStaff?:boolean}={}){
 const sent:{recipient:string;body:Record<string,unknown>}[]=[];const history=new Map<string,Record<string,unknown>>();
 const nextWeek=new Date(`${dateInAccra()}T00:00:00Z`);nextWeek.setUTCDate(nextWeek.getUTCDate()+7);
 globalThis.fetch=async(input,init)=>{
  const url=new URL(String(input));let rows:unknown[]=[];
  if(url.hostname==='api.smsonlinegh.com'){
   assert.equal(new Headers(init?.headers).get('Authorization'),'key fixture-sms-key');
   const body=JSON.parse(String(init?.body));assert.equal(body.type,0);assert.equal(body.destinations.length,1);sent.push({recipient:body.destinations[0],body});
   if(options.uncertain)throw new Error('Connection interrupted after request');
   return new Response(JSON.stringify(options.providerFailure?{handshake:{id:1,label:'HSHK_AUTH_FAILED'}}:{handshake:{id:0,label:'HSHK_OK'},data:{destinations:[{id:`sms-${sent.length}`,to:body.destinations[0],status:{id:2105,label:'DS_SUBMIT_ENROUTE'}}]}}),{status:200});
  }
  if(url.pathname.endsWith('/app_integrations'))rows=[];
  else if(url.pathname.endsWith('/members')){assert.equal(url.searchParams.get('is_active'),'eq.true');assert.equal(url.searchParams.get('merged_into_id'),'is.null');assert.ok(url.searchParams.get('select')?.includes('phone'));if(options.rosterFailure)return new Response('{}',{status:500});rows=[{id:'member-one',name:'Ama',fellowship:'Shalach',birthday:nextWeek.toISOString().slice(0,10)},...(options.celebrants?[
   {id:'birthday-today',name:'Kojo',fellowship:'Shalach',birthday:dateInAccra(),phone:'0551234567'},
   {id:'duplicate-phone',name:'Kojo duplicate',fellowship:'Shalach',birthday:dateInAccra(),phone:'+233551234567'},
   {id:'no-phone',name:'No phone',fellowship:'Shalach',birthday:dateInAccra(),phone:''},
   {id:'invalid-phone',name:'Invalid phone',fellowship:'Shalach',birthday:dateInAccra(),phone:'not-a-number'},
   {id:'bad-birthday',name:'Bad birthday',fellowship:'Shalach',birthday:'invalid',phone:'0591234567'},
  ]:[])];}
  else if(url.pathname.endsWith('/staff_accounts'))rows=options.noStaff?[]:[
   {phone:'0201234567',fellowship:'Shalach',role_id:'leader-role',is_active:true,birthday_sms_enabled:true},
   {phone:'+233201234567',fellowship:'Shalach',role_id:'leader-role',is_active:true,birthday_sms_enabled:true},
   {phone:'0551234567',fellowship:'Pleroma',role_id:'leader-role',is_active:true,birthday_sms_enabled:true},
   {phone:'0271234567',fellowship:null,role_id:'admin-role',is_active:true,birthday_sms_enabled:true},
   {phone:'0241234567',fellowship:'Shalach',role_id:'leader-role',is_active:true,birthday_sms_enabled:false}];
  else if(url.pathname.endsWith('/staff_roles'))rows=[{id:'leader-role',key:'fellowship_leader'},{id:'admin-role',key:'admin'}];
  else if(url.pathname.endsWith('/birthday_sms_deliveries')){
   if(init?.method==='POST'){
    if(options.claimFailure)return new Response('{}',{status:500});
    const body=JSON.parse(String(init.body));if(history.has(body.idempotency_key))return new Response(JSON.stringify({code:'23505'}),{status:409});history.set(body.idempotency_key,body);return new Response(null,{status:201});
   }
   const key=url.searchParams.get('idempotency_key')!.slice(3);const current=history.get(key);
   if(init?.method==='PATCH'){
    const body=JSON.parse(String(init.body));if(options.finalSaveFailure&&body.status==='accepted')return new Response('{}',{status:500});
    if(current&&(!url.searchParams.has('status')||url.searchParams.get('status')===`eq.${current.status}`)){Object.assign(current,body);rows=[current];}
   }else rows=current?[current]:[];
  }else throw new Error(`Unexpected external request ${url.hostname}${url.pathname}`);
  const singular=new Headers(init?.headers).get('Accept')?.includes('vnd.pgrst.object');return new Response(JSON.stringify(singular?rows[0]:rows),{headers:{'Content-Type':'application/json'}});
 };
 return {sent,history};
}
test('birthday cron sends only scoped leader/admin SMS, deduplicates normalized phones and skips accepted sends',async()=>{
 const {sent}=fixture();const response=await cron.GET(request());assert.equal(response.status,200);assert.equal((await response.json()).accepted,2);
 assert.deepEqual(sent.map(item=>item.recipient).sort(),['233201234567','233271234567']);
 assert.equal((await (await cron.GET(request())).json()).skipped,2);assert.equal(sent.length,2);
});
test('concurrent cron runs persist one claim per SMS instead of sending twice',async()=>{
 const {sent}=fixture();await Promise.all([cron.GET(request()),cron.GET(request())]);assert.equal(sent.length,2);
});
test('birthday greetings go to the roster phone from CEYC ARC and remain separate from leader reminders',async()=>{
 const {sent,history}=fixture({celebrants:true});const result=await (await cron.GET(request())).json();assert.equal(result.accepted,3);
 const greetings=sent.filter(item=>String(item.body.text).startsWith('Happy birthday'));
 assert.equal(greetings.length,1);assert.equal(greetings[0].recipient,'233551234567');assert.equal(greetings[0].body.sender,'CEYC ARC');assert.match(String(greetings[0].body.text),/Happy birthday, Kojo!/);
 assert.ok(sent.filter(item=>!String(item.body.text).startsWith('Happy birthday')).every(item=>item.body.sender==='ARC'));
 assert.equal([...history.values()].filter(item=>item.notification_type==='birthday_sms_greeting').length,1);
 await cron.GET(request());assert.equal(sent.length,3);
});
test('greetings do not require staff recipients and concurrent runs send just one greeting',async()=>{
 const {sent}=fixture({celebrants:true,noStaff:true});await Promise.all([cron.GET(request()),cron.GET(request())]);assert.equal(sent.length,1);assert.equal(sent[0].body.sender,'CEYC ARC');
});
test('an uncertain birthday greeting is retained for review and never resent automatically',async()=>{
 const {sent,history}=fixture({celebrants:true,noStaff:true,uncertain:true});assert.equal((await cron.GET(request())).status,502);
 assert.equal([...history.values()][0].status,'uncertain');await cron.GET(request());assert.equal(sent.length,1);
});
test('provider rejection records failure, while network uncertainty is retained without an automatic resend',async()=>{
 let calls=fixture({providerFailure:true});assert.equal((await cron.GET(request())).status,502);assert.ok([...calls.history.values()].every(item=>item.status==='failed'));
 calls=fixture({uncertain:true});assert.equal((await cron.GET(request())).status,502);assert.ok([...calls.history.values()].every(item=>item.status==='uncertain'));await cron.GET(request());assert.equal(calls.sent.length,2);
});
test('claim, roster and confirmation storage failures never cause unsafe duplicate SMS retries',async()=>{
 let calls=fixture({claimFailure:true});assert.equal((await cron.GET(request())).status,502);assert.equal(calls.sent.length,0);
 calls=fixture({rosterFailure:true});assert.equal((await cron.GET(request())).status,503);assert.equal(calls.sent.length,0);
 calls=fixture({finalSaveFailure:true});assert.equal((await cron.GET(request())).status,502);await cron.GET(request());assert.equal(calls.sent.length,2);
});
test('unauthorized birthday cron cannot load contacts or send SMS',async()=>{
 globalThis.fetch=async()=>{throw new Error('Unauthorized external access');};assert.equal((await cron.GET(new NextRequest('http://localhost/api/cron/birthday-reminders'))).status,401);
});
