const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), multer = require('multer');
const { createLegacyToolReplay } = require('./legacy-tool-replay');
const identity = require('./identity'), util = require('./util'), config = require('../config');
const at = Date.parse('2026-10-07T09:00:00Z');
const oldToken = id => `e30.${Buffer.from(JSON.stringify({ sub: id, exp: 1, type: 'access' })).toString('base64url')}.local-dev-signature`;
const entry = (app, url, body, token = oldToken(1)) => ({ epoch: 'historical-epoch', app, method: 'POST', url, body: Buffer.from(JSON.stringify(body)).toString('base64'), at, seed: `accepted:${app}:${url}`, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) } });
function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'orgtik-tool-history-'));
  const makeCtx = (key, auth, helpers) => {
    const uploadsDir = path.join(dir, key); fs.mkdirSync(uploadsDir, { recursive: true });
    return { key, config, identity: auth, util: helpers, uploadsDir, upload: multer({ storage: multer.diskStorage({ destination: uploadsDir, filename: (req,file,done)=>done(null,file.originalname) }) }), apiUrl: config.apiUrl, webUrl: config.webUrl, fileUrl: filename => `${config.apiUrl(key)}/uploads/${filename}`, log() {}, io: null };
  };
  return { migration: createLegacyToolReplay({ identity, config, util, makeCtx, realm: 'migration-test', seedAt: at }), close() { fs.rmSync(dir, { recursive: true, force: true }); } };
}

test('private accepted history preserves five tool records, sequence counters and deterministic cold starts', async () => {
  const a = fixture(), b = fixture();
  const entries = [entry('tasks','/api/projects',{title:'Accepted legacy task project'}),entry('files','/api/v1/folders',{name:'Accepted legacy files folder'}),entry('hr','/api/departments',{name:'Accepted legacy HR department'}),entry('sales','/api/customers',{fullName:'Accepted legacy CRM customer',email:'accepted.legacy@orgtik.test',companyName:'Legacy company'}),entry('marketing','/projects',{name:'Accepted legacy marketing brand'})];
  try {
    for (const e of entries) { assert.equal((await a.migration.replayAccepted(e)).statusCode,201); assert.equal((await b.migration.replayAccepted(e)).statusCode,201); }
    const state = a.migration.exportWorkspaceState();
    assert.deepEqual(state,b.migration.exportWorkspaceState());
    assert.deepEqual(Object.keys(state.snapshots).sort(),['files','hr','marketing','sales','tasks'].map(app=>`ws_orgtik:${app}`).sort());
    assert(state.snapshots['ws_orgtik:tasks'].data.projects.some(row=>row.title==='Accepted legacy task project'));
    assert(state.snapshots['ws_orgtik:files'].data.folders.some(([,row])=>row.name==='Accepted legacy files folder'));
    assert(state.snapshots['ws_orgtik:hr'].data.departments.some(row=>row.name==='Accepted legacy HR department'));
    assert(state.snapshots['ws_orgtik:sales'].data.db.customers.some(row=>row.email==='accepted.legacy@orgtik.test'));
    assert(state.snapshots['ws_orgtik:marketing'].data.projects.some(row=>row.name==='Accepted legacy marketing brand'));
    assert.equal(JSON.stringify(state).includes('local-dev-signature'),false);
    state.snapshots['ws_orgtik:tasks'].data.projects.length=0;
    assert(a.migration.exportWorkspaceState().snapshots['ws_orgtik:tasks'].data.projects.length>0);
  } finally { a.migration.close();b.migration.close();a.close();b.close(); }
});

test('refused, missing-actor and modern-checkpoint histories cannot produce partial migration snapshots', async () => {
  for (const e of [entry('tasks','/api/projects',{title:'Cannot silently apply'},oldToken(999999)),entry('tasks','/api/projects',{title:''})]) {
    const f=fixture();try{await assert.rejects(f.migration.replayAccepted(e),{status:503});assert.throws(()=>f.migration.exportWorkspaceState(),{status:503});}finally{f.migration.close();f.close();}
  }
  const f=fixture();try{f.migration.adoptWorkspaceCheckpoint();await assert.rejects(f.migration.replayAccepted(entry('tasks','/api/projects',{title:'Late old writer'})),{status:503});}finally{f.migration.close();f.close();}
});

test('historical facade has no ambient HTTP authority or account mutations outside its private request capability', async () => {
  const original = JSON.stringify(identity.users), facade=identity.createCommittedReplayFacade();
  const token=oldToken(1), req={method:'POST',url:'/api/projects',headers:{authorization:`Bearer ${token}`}};
  assert.equal(facade.userFromReq(req),null);assert.equal(facade.decode(token),null);assert.throws(()=>facade.bindAcceptedRequest(req),{status:503});
  await facade.runAccepted(entry('tasks','/api/projects',{title:'Past effect'}),async()=>{facade.bindAcceptedRequest(req);assert.equal(facade.userFromReq(req).id,1);assert.throws(()=>facade.issueTokens(facade.users[0]),{status:503});facade.users[0].firstName='Private reducer only';});
  assert.equal(facade.userFromReq(req),null);assert.equal(facade.decode(token),null);assert.equal(JSON.stringify(identity.users),original);
});

test('WM staff history preserves anonymous accepted ideas/leads separately without network redelivery', async () => {
  const f=fixture(), originalFetch=global.fetch;let deliveries=0;global.fetch=async()=>{deliveries++;throw new Error('Historical reducers must not deliver HTTP');};
  try{
    assert.equal((await f.migration.replayAccepted(entry('wm','/v2/__mock/without-suggestions',{},null))).statusCode,200);
    const enabled=await f.migration.replayAccepted(entry('wm','/v2/__mock/forms-live',{},null));assert.equal(enabled.statusCode,200);
    const body={name:'Historical Website Visitor',email:'accepted.visitor@orgtik.test',topic:'Workspace reporting',message:'Accepted website idea and lead',consent:true,privacyVersion:enabled.body.data.forms.privacyVersion};
    assert.equal((await f.migration.replayAccepted(entry('wm','/v2/public/ideas',body,null))).statusCode,201);
    assert.equal((await f.migration.replayAccepted(entry('wm','/v2/public/leads',body,null))).statusCode,201);
    const staff=f.migration.exportStaffState();
    assert.equal(staff.wm.schema,'orgtik.staff.wm');assert.equal(staff.wm.realm,'migration-test');
    assert(staff.wm.data.content.ideas.some(([,row])=>row.submitter?.email===body.email));
    assert(staff.wm.data.ops.leads.some(([,row])=>row.email===body.email));
    assert.equal(Object.keys(f.migration.exportWorkspaceState().snapshots).some(key=>key.endsWith(':wm')),false);
    assert.equal(deliveries,0);
    assert.equal(JSON.stringify(staff).includes('local-dev-signature'),false);
  }finally{global.fetch=originalFetch;f.migration.close();f.close();}
});

test('anonymous historical authority cannot widen beyond exact recorded public intake and two old WM fixture controls',()=>{
  const facade=identity.createCommittedReplayFacade();
  for(const url of ['/v2/admin/settings/site','/v2/__mock/reset','/v2/__mock/forms-live/extra','/v2/__mock/without-suggestions/extra'])assert.throws(()=>facade.runAccepted(entry('wm',url,{},null),()=>{}, {allowAnonymous:true}),{status:503});
  assert.throws(()=>facade.runAccepted({...entry('wm','/v2/public/ideas',{},null),method:'PATCH'},()=>{}, {allowAnonymous:true}),{status:503});
  assert.throws(()=>facade.runAccepted(entry('wm','/v2/public/ideas',{},null),()=>{}),{status:503});
  for(const url of ['/v2/__mock/forms-live','/v2/__mock/without-suggestions'])assert.throws(()=>facade.runAccepted({...entry('wm',url,{},null),method:'PATCH'},()=>{}, {allowAnonymous:true}),{status:503});
});
