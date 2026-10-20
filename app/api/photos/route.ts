import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { MemberInputError } from '@/lib/member-scope';
import { photoSubject } from '@/lib/profile-photos';
import { driveSettings } from '@/lib/integration-settings';
import { driveAccess, MAX_PHOTO_BYTES, photoMime, uploadDrivePhoto } from '@/lib/drive-photos';
export const dynamic='force-dynamic';
function failure(error: unknown) {
  return NextResponse.json({error:error instanceof MemberInputError?error.message:error instanceof Error?error.message:'Photo service is unavailable.'},
    {status:error instanceof MemberInputError?error.status:503});
}
export async function GET(request: NextRequest) {
  const context=await getAuthContext();
  if (!context) return NextResponse.json({error:'Sign in to view profile pictures.'},{status:401});
  try {
    const subject=await photoSubject(context,request.nextUrl.searchParams.get('memberId'));
    const admin=getSupabaseAdmin(); if (!admin) throw new Error('Photo service is unavailable.');
    const {data,error}=await admin.from('profile_photos').select('drive_file_id,mime_type,updated_at').eq('subject',subject).maybeSingle();
    if (error) throw new Error('Photos could not be loaded. Apply the profile-photo migration.');
    if (!request.nextUrl.searchParams.has('image')) {
      const config=await driveSettings();
      return NextResponse.json({hasPhoto:Boolean(data),ready:Boolean(config.clientId&&config.clientSecret&&config.refreshToken&&config.folderId),version:data?.updated_at||null}, {headers:{'Cache-Control':'private, no-store'}});
    }
    if (!data) return new NextResponse(null,{status:404});
    const {token}=await driveAccess();
    const response=await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(data.drive_file_id)}?alt=media`,{cache:'no-store',signal:AbortSignal.timeout(10000),headers:{Authorization:`Bearer ${token}`}});
    if (!response.ok || !response.body || Number(response.headers.get('content-length'))>MAX_PHOTO_BYTES) throw new Error('The Google Drive photo is unavailable.');
    const reader=response.body.getReader();const chunks:Uint8Array[]=[];let size=0;
    while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>MAX_PHOTO_BYTES){await reader.cancel();throw new Error('The photo exceeds the size limit.');}chunks.push(value);}
    const bytes=Buffer.concat(chunks);const mime=photoMime(bytes);
    if (!mime || mime!==data.mime_type) throw new Error('The stored file is not a supported photo.');
    return new NextResponse(bytes,{headers:{'Content-Type':mime,'X-Content-Type-Options':'nosniff','Cache-Control':'private, no-store','Content-Disposition':'inline'}});
  } catch(error){return failure(error);}
}
export async function POST(request: NextRequest) {
  const context=await getAuthContext();
  if (!context) return NextResponse.json({error:'Sign in to upload a profile picture.'},{status:401});
  if (request.headers.get('origin') && request.headers.get('origin')!==request.nextUrl.origin) return NextResponse.json({error:'Cross-site uploads are not allowed.'},{status:403});
  try {
    if (Number(request.headers.get('content-length'))>MAX_PHOTO_BYTES+65536) throw new MemberInputError('Choose a photo no larger than 2 MB.',413);
    const memberId=request.nextUrl.searchParams.get('memberId');
    const subject=await photoSubject(context,memberId);
    const form=await request.formData();const file=form.get('photo');
    if (!(file instanceof File) || file.size===0 || file.size>MAX_PHOTO_BYTES) throw new MemberInputError('Choose a JPG, PNG or WebP photo no larger than 2 MB.');
    const bytes=new Uint8Array(await file.arrayBuffer());const mime=photoMime(bytes);
    if (!mime || mime!==file.type) throw new MemberInputError('Choose a valid JPG, PNG or WebP photo.');
    const fileId=await uploadDrivePhoto(bytes,mime,subject);
    // Scope is checked again after the upload in case membership moved meanwhile.
    const current=await getAuthContext();
    if (!current || await photoSubject(current,memberId)!==subject) throw new MemberInputError('Your access changed. Refresh before uploading again.',403);
    const admin=getSupabaseAdmin();if(!admin)throw new Error('Photo service is unavailable.');
    const updatedAt=new Date().toISOString();
    const {error}=await admin.from('profile_photos').upsert({subject,drive_file_id:fileId,mime_type:mime,updated_by:current.username,updated_at:updatedAt},{onConflict:'subject'});
    if(error)throw new Error('The photo uploaded to Drive but could not be linked. Please retry or contact the administrator.');
    return NextResponse.json({message:'Profile picture uploaded to Google Drive.',version:updatedAt},{status:201});
  } catch(error){return failure(error);}
}
