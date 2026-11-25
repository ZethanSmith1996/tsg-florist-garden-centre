import {config} from './config.js';
// Auth health is a reachability probe, not a database or permission test.
export async function checkConnection(){
 const controller=new AbortController(); const timer=setTimeout(()=>controller.abort(),10000);
 try {
  const response=await fetch(`${config.url}/auth/v1/health`,{headers:{apikey:config.publishableKey},cache:'no-store',signal:controller.signal});
  return {ok:response.ok,message:response.ok?'Auth endpoint reachable. Database and staff access not yet tested.':`Endpoint returned HTTP ${response.status}. Connection not verified.`};
 } catch(e){return {ok:false,message:'Connection could not be verified. Check network, project availability or browser restrictions.'};} finally {clearTimeout(timer);}
}
