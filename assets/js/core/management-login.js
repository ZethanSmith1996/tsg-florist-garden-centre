import { config } from './config.js';
const $ = id => document.getElementById(id);
const status = message => { $('status').textContent = message; };
let client;
async function inspect(session) {
  $('login').hidden = true;
  $('session').hidden = false;
  $('sessionTitle').textContent = 'Authentication session';
  $('sessionDetail').textContent = 'Checking management access…';
  try {
    const res = await fetch(`${config.url}/functions/v1/tsg-management`, {headers:{Authorization:`Bearer ${session.access_token}`,apikey:config.publishableKey},cache:'no-store'});
    const data = await res.json();
    if (res.ok && data.status === 'ok') {
      $('sessionTitle').textContent = `Welcome, ${data.staff.display_name}`;
      $('sessionDetail').textContent = 'Management identity verified. Operational features are not yet available.';
      status('Management access verified.');
    } else if (res.status === 403) {
      $('sessionDetail').textContent = 'Credentials accepted, but management access is not granted. MFA or management eligibility is required.';
      status('Access protected. MFA setup will be added in the next stage.');
    } else {
      $('sessionDetail').textContent = 'Management identity could not be verified.';
      status(`Access not granted (HTTP ${res.status}). Sign out and retry.`);
    }
  } catch { $('sessionDetail').textContent = 'Management access not verified.'; status('Unable to reach management service.'); }
}
try {
  const {createClient} = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.4/+esm');
  client = createClient(config.url,config.publishableKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
  $('login').hidden=false; status('Enter your existing management account credentials.');
  $('login').addEventListener('submit',async e=>{
    e.preventDefault(); const button=e.target.querySelector('button'); button.disabled=true; status('Signing in…');
    try {
      const {data,error}=await client.auth.signInWithPassword({email:$('email').value.trim(),password:$('password').value});
      if(error || !data.session){status('Sign-in unsuccessful. Check your credentials or try again later.');return;}
      await inspect(data.session);
    } catch {status('Sign-in unavailable. Please retry.');} finally {$('password').value='';button.disabled=false;}
  });
  $('logout').addEventListener('click',async()=>{
    $('logout').disabled=true;
    try {const {error}=await client.auth.signOut({scope:'local'}); if(error) throw error; status('Signed out.');}
    catch {status('Server sign-out could not be confirmed. Local session discarded.');}
    finally {client=createClient(config.url,config.publishableKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});$('session').hidden=true;$('login').hidden=false;$('sessionDetail').textContent='';$('sessionTitle').textContent='Session';$('logout').disabled=false;}
  });
} catch {status('Login library could not load. Check your internet connection and reload.');}
