// Uses only an isolated presentation namespace in the already configured store.
// Existing accounts, journals, invoices and the shared clock are never accessed.
function presentationStorage(env=process.env) {
  const url=env.KV_REST_API_URL||env.UPSTASH_REDIS_REST_URL,token=env.KV_REST_API_TOKEN||env.UPSTASH_REDIS_REST_TOKEN;
  if(!url||!token)return undefined;
  const key=workspace=>`orgtik:ui-presentation:v1:${env.MOCK_SANDBOX||'demo'}:${workspace}`;
  async function command(args){const response=await fetch(url,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(args)});const value=await response.json();if(!response.ok||value.error)throw Error('Presentation store unavailable.');return value.result;}
  return {load:async workspace=>{const value=await command(['GET',key(workspace)]);return value?JSON.parse(value):null},save:async(workspace,data)=>{await command(['SET',key(workspace),JSON.stringify(data)])}};
}
module.exports={presentationStorage};
