import test from "node:test";
import assert from "node:assert/strict";
import { readClientSession, setClientSession, clearClientSession, staffTargetToken, handoffCode, refreshClientSession, signOutSession } from "../../dist/auth/index.js";

function browser() { const values = new Map(), events = new EventTarget(); return { sessionStorage: { getItem: k => values.get(k) || null, setItem: (k,v) => values.set(k,v), removeItem: k => values.delete(k) }, addEventListener: events.addEventListener.bind(events), removeEventListener: events.removeEventListener.bind(events), dispatchEvent: events.dispatchEvent.bind(events) }; }
const ctx = id => ({ version:1, realm:"test", workspace:{id,name:id,kind:"customer",state:"active",timeZone:"Africa/Cairo"}, actor:{userId:1,effectiveUserId:1,readOnly:false},member:{id:"m",role:"member",revision:1},tools:{},revision:1 });
const session = id => ({ user:{id:1,firstName:"Member"},tokens:{accessToken:`access-${id}`,refreshToken:`refresh-${id}`,expiresIn:2592000},scopes:[],workspaceContext:ctx(id),staffAccess:null });
const response = (data,status=200) => ({ok:status===200,status,json:async()=>({data,code:status===503?"session_unavailable":undefined})});

test("separate tabs retain their own tokens and workspace despite shared cookie hints",()=>{
  const original=global.window,a=browser(),b=browser();try{global.window=a;setClientSession(session("a"));global.window=b;setClientSession(session("b"));global.window=a;assert.equal(readClientSession().workspaceContext.workspace.id,"a");assert.equal(readClientSession().tokens.accessToken,"access-a");global.window=b;assert.equal(readClientSession().workspaceContext.workspace.id,"b");}finally{global.window=original;}
});
test("tab snapshots detach reducer proxies and caller mutations",()=>{
  const original=global.window;global.window=browser();
  try{const input=session('a'),draft=Proxy.revocable(input.workspaceContext,{});setClientSession({...input,workspaceContext:draft.proxy});draft.revoke();input.tokens.accessToken='mutated-after-reducer';assert.equal(readClientSession().workspaceContext.workspace.id,'a');assert.equal(readClientSession().tokens.accessToken,'access-a');}finally{clearClientSession();global.window=original;}
});
test("staff launch requests explicit mode/target and does not replace the customer tab",async()=>{
  const originalWindow=global.window,originalFetch=global.fetch;global.window=browser();setClientSession(session("a"));const calls=[];global.fetch=async(url,init)=>{calls.push({url,body:JSON.parse(init.body)});return response(url.endsWith('/workspace')?{tokens:{accessToken:'staff-admin'}}:{code:'opaque-once'});};
  try{const target=await staffTargetToken('http://identity/api','access-a','admin');assert.equal(await handoffCode('http://identity/api',target,'staff:admin'),'opaque-once');assert.deepEqual(calls[0].body,{mode:'staff',target:'admin'});assert.deepEqual(calls[1].body,{audience:'staff:admin'});assert.equal(readClientSession().tokens.accessToken,'access-a');}finally{clearClientSession();global.window=originalWindow;global.fetch=originalFetch;}
});
test("concurrent refresh calls redeem one rotating token only once",async()=>{
  const originalWindow=global.window,originalFetch=global.fetch;global.window=browser();setClientSession(session("a"));let calls=0;global.fetch=async()=>{calls++;await new Promise(r=>setTimeout(r,5));return response({accessToken:'next-access',refreshToken:'next-refresh',expiresIn:2592000,workspaceContext:ctx('a'),staffAccess:null,scopes:[]});};
  try{const [a,b]=await Promise.all([refreshClientSession('http://identity/api'),refreshClientSession('http://identity/api')]);assert.equal(calls,1);assert.equal(a.tokens.refreshToken,b.tokens.refreshToken);assert.equal(readClientSession().workspaceContext.workspace.id,'a');}finally{clearClientSession();global.window=originalWindow;global.fetch=originalFetch;}
});
test("503 sign-out and refresh preserve the existing valid credential state",async()=>{
  const originalWindow=global.window,originalFetch=global.fetch;global.window=browser();setClientSession(session("a"));global.fetch=async()=>response(null,503);
  try{await assert.rejects(signOutSession('http://identity/api','access-a'),{status:503});assert.equal(readClientSession().tokens.accessToken,'access-a');await assert.rejects(refreshClientSession('http://identity/api'),{status:503});assert.equal(readClientSession().tokens.refreshToken,'refresh-a');}finally{clearClientSession();global.window=originalWindow;global.fetch=originalFetch;}
});

for (const status of [200,401]) test(`late ${status} refresh cannot restore or clear a newly selected workspace`,async()=>{
  const originalWindow=global.window,originalFetch=global.fetch;global.window=browser();setClientSession(session("a"));let finish;
  global.fetch=()=>new Promise(resolve=>{finish=resolve;});
  try{
    const pending=refreshClientSession('http://identity/api');
    setClientSession(session("b"));
    finish(response({accessToken:'late-a',refreshToken:'late-refresh-a',expiresIn:2592000,workspaceContext:ctx('a'),staffAccess:null,scopes:[]},status));
    await assert.rejects(pending,{status:409,code:'session_changed'});
    assert.equal(readClientSession().tokens.accessToken,'access-b');
    assert.equal(readClientSession().workspaceContext.workspace.id,'b');
  }finally{clearClientSession();global.window=originalWindow;global.fetch=originalFetch;}
});
