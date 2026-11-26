import { config } from './config.js?v=044';
const $ = id => document.getElementById(id);
const status = message => { $('status').textContent = message; };
let client, createClient, factorId, busy=false;
function freshClient(){return createClient(config.url,config.publishableKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});}
function clearMfa(){factorId=null;$('mfa').hidden=true;$('verify').hidden=true;$('setup').hidden=true;$('qr').hidden=true;$('qr').removeAttribute('src');$('manual').hidden=true;$('secret').textContent='';$('otp').value='';}
async function locked(fn){if(busy)return;busy=true;document.querySelectorAll('button').forEach(b=>b.disabled=true);try{await fn();}catch{status('Request unsuccessful. Please retry or sign out and sign in again.');}finally{busy=false;document.querySelectorAll('button').forEach(b=>b.disabled=false);}}
async function inspect(session){
 clearMfa();$('login').hidden=true;$('session').hidden=false;$('sessionTitle').textContent='Authentication session';$('sessionDetail').textContent='Checking management access…';
 try{const res=await fetch(`${config.url}/functions/v1/tsg-management`,{headers:{Authorization:`Bearer ${session.access_token}`,apikey:config.publishableKey},cache:'no-store'});const data=await res.json();
 if(res.ok&&data.status==='ok'){$('sessionTitle').textContent=`Welcome, ${data.staff.display_name}`;$('sessionDetail').textContent='Management identity verified. Operational features are not yet available.';status('Management access verified.');return;}
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
 $('logout').addEventListener('click',()=>locked(async()=>{clearMfa();try{const {error}=await client.auth.signOut({scope:'local'});if(error)throw error;status('Signed out.');}catch{status('Server sign-out could not be confirmed. Local session discarded.');}finally{client=freshClient();$('session').hidden=true;$('login').hidden=false;$('sessionDetail').textContent='';$('sessionTitle').textContent='Session';}}));
}catch{status('Login library could not load. Check your internet connection and reload.');}
