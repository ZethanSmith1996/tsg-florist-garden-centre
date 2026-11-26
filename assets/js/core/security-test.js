import { config } from './config.js?v=044';
const $ = id => document.getElementById(id);
const status = message => { $('status').textContent = message; };
let client, createClient, factorId, busy=false;
let deviceId, deviceToken, staffId;
const sessions=[];
function clearSessions(){sessions.length=0;$('savedSession').replaceChildren();}
function freshClient(){return createClient(config.url,config.publishableKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});}
function clearMfa(){factorId=null;$('mfa').hidden=true;$('verify').hidden=true;$('setup').hidden=true;$('qr').hidden=true;$('qr').removeAttribute('src');$('manual').hidden=true;$('secret').textContent='';$('otp').value='';}
async function locked(fn){if(busy)return;busy=true;document.querySelectorAll('button').forEach(b=>b.disabled=true);try{await fn();}catch{status('Request unsuccessful. Please retry or sign out and sign in again.');}finally{busy=false;document.querySelectorAll('button').forEach(b=>b.disabled=false);}}
async function inspect(session){
 clearMfa();$('testing').hidden=true;$('login').hidden=true;$('session').hidden=false;$('sessionTitle').textContent='Authentication session';$('sessionDetail').textContent='Checking management access…';
 try{const res=await fetch(`${config.url}/functions/v1/tsg-management`,{headers:{Authorization:`Bearer ${session.access_token}`,apikey:config.publishableKey},cache:'no-store'});const data=await res.json();
 if(res.ok&&data.status==='ok'){$('sessionTitle').textContent=`Welcome, ${data.staff.display_name}`;$('sessionDetail').textContent='Management identity verified. Operational features are not yet available.';staffId=session.user?.id ?? (await client.auth.getUser()).data.user?.id; if(staffId) $('testing').hidden=false; status('Management access verified.');return;}
 if(res.status!==403){$('sessionDetail').textContent='Management identity could not be verified.';status(`Access not granted (HTTP ${res.status}).`);return;}
 const {data:aal,error}=await client.auth.mfa.getAuthenticatorAssuranceLevel();if(error||!aal)throw Error('MFA check failed');
 if(aal.currentLevel==='aal2'){$('sessionDetail').textContent='Management access denied. Contact the owner.';status('Access protected.');return;}
 const {data:factors,error:factorError}=await client.auth.mfa.listFactors();if(factorError)throw Error('Factor check failed');
 const verified=factors.totp.find(f=>f.status==='verified');
 $('sessionDetail').textContent='Credentials accepted. Management access requires additional verification.';$('mfa').hidden=false;
 if(verified){factorId=verified.id;$('mfaHelp').textContent='Enter the current code from your authenticator app.';$('verify').hidden=false;status('Two-factor verification required.');}
 else if(aal.nextLevel==='aal2'){$('mfaHelp').textContent='An existing authentication factor requires verification. Contact the owner for assistance.';status('Access protected.');}
 else{$('mfaHelp').textContent='Set up an authenticator to protect your account. Keep the setup key private.';$('setup').hidden=false;status('Two-factor setup required.');}
 }catch{$('sessionDetail').textContent='Management access not verified.';status('Unable to verify management access. Sign out and retry.');}
}
try{
 ({createClient}=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.4/+esm'));client=freshClient();$('login').hidden=false;status('Enter your existing management account credentials.');
 $('login').addEventListener('submit',e=>{e.preventDefault();locked(async()=>{status('Signing in…');try{const {data,error}=await client.auth.signInWithPassword({email:$('email').value.trim(),password:$('password').value});if(error||!data.session){status('Sign-in unsuccessful. Check your credentials or try again later.');return;}await inspect(data.session);}finally{$('password').value='';}});});
 $('setup').addEventListener('click',()=>locked(async()=>{status('Creating authenticator…');const {data,error}=await client.auth.mfa.enroll({factorType:'totp',friendlyName:'TSG Management',issuer:'TSG Florist Garden Centre'});if(error||!data?.totp){status('Authenticator setup unsuccessful. If setup was previously abandoned, contact the owner before retrying.');return;}factorId=data.id;const qr=data.totp.qr_code;if(typeof qr==='string'&&qr.startsWith('data:image/svg+xml')){$('qr').src=qr;$('qr').hidden=false;}$('secret').textContent=data.totp.secret;$('manual').hidden=false;$('setup').hidden=true;$('verify').hidden=false;$('mfaHelp').textContent='Scan the QR code or enter the setup key manually, then enter the six-digit code.';status('Waiting for authenticator code.');}));
 $('verify').addEventListener('submit',e=>{e.preventDefault();locked(async()=>{if(!factorId)return;const code=$('otp').value;$('otp').value='';if(!/^\d{6}$/.test(code))return;status('Verifying code…');const {data,error}=await client.auth.mfa.challengeAndVerify({factorId,code});if(error){status('Code not verified. Enter a fresh code and retry.');return;}if(!data?.access_token){status('Verification session unavailable. Sign out and retry.');return;}await inspect(data);});});
 $('logout').addEventListener('click',()=>locked(async()=>{if(deviceId){status('Revoke the test device before signing out.');return;} $('testing').hidden=true;staffId=null;clearSessions();$('pin').value='';clearMfa();try{const {error}=await client.auth.signOut({scope:'local'});if(error)throw error;status('Signed out.');}catch{status('Server sign-out could not be confirmed. Local session discarded.');}finally{client=freshClient();$('session').hidden=true;$('login').hidden=false;$('sessionDetail').textContent='';$('sessionTitle').textContent='Session';}}));
}catch{status('Login library could not load. Check your internet connection and reload.');}

const report = msg => { $('results').textContent=msg; };
const hex = bytes => Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
const hash = async value => hex(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))));
async function endpoint(name,body,management=false){
 const headers={'Content-Type':'application/json',apikey:config.publishableKey};
 if(management){const {data,error}=await client.auth.getSession();if(error||!data.session)throw Error('No session');headers.Authorization=`Bearer ${data.session.access_token}`;}
 const res=await fetch(`${config.url}/functions/v1/${name}`,{method:'POST',headers,body:JSON.stringify(body),cache:'no-store'});
 const data=await res.json();return {http:res.status,status:data.status,ok:res.ok&&data.status==='ok',sessionId:data.session_id,sessionToken:data.session_token};
}
function testAction(id,fn){$(id).addEventListener('click',()=>locked(async()=>{try{await fn();}catch{report('Request failed. Check connection and diagnostics.');}}));}
testAction('device',async()=>{if(!staffId||deviceId){report('Revoke existing test device first.');return;}const token=hex(crypto.getRandomValues(new Uint8Array(32)));const {data,error}=await client.rpc('tsg_authorise_device',{p_device_name:'TSG Development Test Device',p_device_type:'desktop',p_device_token_hash:await hash(token)});if(error||typeof data!=='string'){report('Device authorisation failed.');return;}deviceId=data;deviceToken=token;report('Device authorised. ID: '+deviceId);});
testAction('configure',async()=>{const pin=$('pin').value;$('pin').value='';if(!staffId||!/^\d{4}$/.test(pin)){report('Enter exactly four digits.');return;}if(!confirm('Set or replace the PIN on your own staff account? Existing staff sessions will end.'))return;const r=await endpoint('tsg-staff-pin-config',{staff_id:staffId,pin},true);report(`PIN configuration: HTTP ${r.http} — ${r.status}`);});
testAction('authenticate',async()=>{const pin=$('pin').value;$('pin').value='';if(!deviceId||!staffId||!/^\d{4}$/.test(pin)){report('Authorise a device and enter four digits.');return;}const start=performance.now();const r=await endpoint('tsg-staff-pin-auth',{staff_id:staffId,device_id:deviceId,device_token:deviceToken,pin});if(r.ok){if(typeof r.sessionToken!=='string'||!/^[0-9a-f]{64}$/.test(r.sessionToken)||typeof r.sessionId!=='string'){report('Authentication succeeded but session credentials were missing.');return;}const index=sessions.push({id:r.sessionId,token:r.sessionToken})-1;const option=new Option(`Session ${index+1} — ${r.sessionId}`,String(index));$('savedSession').add(option);$('savedSession').value=String(index);}report(`Authentication: HTTP ${r.http} — ${r.status} (${Math.round(performance.now()-start)} ms)`+(r.ok?' | Session ID: '+r.sessionId:''));});
testAction('revoke',async()=>{if(!deviceId){report('No test device in memory.');return;}const {error}=await client.rpc('tsg_revoke_device',{p_device_id:deviceId});if(error){report('Revocation failed. Retry.');return;}deviceId=null;deviceToken=null;clearSessions();report('Test device revoked.');});

async function verifySaved(mode){const selected=sessions[Number($('savedSession').value)];if(!deviceId||!selected){report('Authorise a device and create a session first.');return;}const invalid=hex(crypto.getRandomValues(new Uint8Array(32)));const r=await endpoint('tsg-staff-session',{device_id:deviceId,device_token:mode==='device'?invalid:deviceToken,session_token:mode==='session'?invalid:selected.token});report(`Session ${Number($('savedSession').value)+1} (${mode}): HTTP ${r.http} — ${r.status}`);}
testAction('verifySession',()=>verifySaved('valid'));
testAction('wrongSession',()=>verifySaved('session'));
testAction('wrongDevice',()=>verifySaved('device'));

// Bounded development-only parallel requests. No automatic retries.
testAction('parallelRun',async()=>{
 const a=$('parallelA').value,b=$('parallelB').value,count=Number($('parallelCount').value);
 $('parallelA').value='';$('parallelB').value='';
 const output=$('parallelResults');
 if(!deviceId||!staffId||!/^\d{4}$/.test(a)||!/^\d{4}$/.test(b)||![2,3,4].includes(count)){output.textContent='Authorise a device and enter two four-digit temporary PINs.';return;}
 if(!confirm(`Submit ${count} concurrent authentication requests? Failure counters and sessions may change.`))return;
 output.textContent='Running parallel requests…';
 const results=await Promise.all(Array.from({length:count},async(_,i)=>{
  const start=performance.now();
  try{
   const r=await endpoint('tsg-staff-pin-auth',{staff_id:staffId,device_id:deviceId,device_token:deviceToken,pin:i===0?a:b});
   let label='';
   if(r.ok){
    if(typeof r.sessionToken!=='string'||!/^[0-9a-f]{64}$/.test(r.sessionToken)||typeof r.sessionId!=='string')label=' | Missing session credentials';
    else {const index=sessions.push({id:r.sessionId,token:r.sessionToken})-1;$('savedSession').add(new Option(`Session ${index+1} — ${r.sessionId}`,String(index)));$('savedSession').value=String(index);label=` | Session ${index+1} — ${r.sessionId}`;}
   }
   return `Request ${String.fromCharCode(65+i)}: HTTP ${r.http} — ${r.status} (${Math.round(performance.now()-start)} ms)${label}`;
  }catch{return `Request ${String.fromCharCode(65+i)}: transport or response error (${Math.round(performance.now()-start)} ms); outcome unknown. Check database before retrying.`;}
 }));
 output.textContent=results.join('\n');
});
