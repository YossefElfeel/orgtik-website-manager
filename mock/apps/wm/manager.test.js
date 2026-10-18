const {test}=require('node:test');
const assert=require('node:assert/strict');
const {makeStore}=require('./content');
const {makeOps}=require('./ops');
const {config,sourceIds,savePageDraft,orderOf}=require('./manager');
const now=()=> '2026-10-11T09:00:00.000Z';
test('packaged manager configuration matches the editor schema',()=>{
 assert.deepEqual(config,require('../../../apps/wm/lib/manager-pages.json'));
});
test('manager runtime loads and saves drafts without the frontend checkout',()=>{
 const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'wm-manager-runtime-'));
 try {
  const folder=path.join(root,'wm');
  fs.cpSync(__dirname,folder,{recursive:true,filter:file=>!file.includes(path.sep+'uploads')&&!file.endsWith('.test.js')});
  const {makeStore: packagedStore}=require(path.join(folder,'content.js'));
  const manager=require(path.join(folder,'manager.js')),store=packagedStore(now),source=store.entries.get('st_about');
  const result=manager.savePageDraft(store,'pg_about',[{id:source.id,version:source.workflow.version,patches:[{locale:'en',fields:{b3:{...source.live.locales.en.b3,s5:'Packaged purpose'}}}]}],{key:'admin'},now);
  assert.ok(result.data);assert.equal(store.entries.get(source.id).draft.locales.en.b3.s5,'Packaged purpose');
 } finally {
  const relative=path.relative(os.tmpdir(),root);assert.ok(relative.startsWith('wm-manager-runtime-')&&!relative.includes(path.sep));
  fs.rmSync(root,{recursive:true,force:true});
 }
});
test('page hero sources map to existing canonical fields',()=>{
 const store=makeStore(now);
 for(const [id,page] of Object.entries(config))for(const section of Object.values(page.fields??{}))for(const field of section.fields){
  const entry=store.entries.get(field.record);assert.ok(entry,`${id}: ${field.record}`);
  const [block,slot]=field.path.split('.');assert.ok(entry.live.locales.en[block]?.[slot]!==undefined || field.initial,`${field.record}:${field.path}`);
 }
 assert.ok(!config.pg_software.editor.includes('demo'));assert.ok(!config.pg_services.editor.includes('stories'));assert.ok(!config.pg_about.editor.includes('capabilities'));
});
test('saving page and shared hero fields is atomic and draft-only',()=>{
 const store=makeStore(now),home=store.entries.get('pg_about'),source=store.entries.get('st_about'),before=JSON.stringify([...store.entries].map(([id,e])=>[id,e.live]));
 const result=savePageDraft(store,home.id,[{id:home.id,version:home.workflow.version,patches:[{locale:'en',fields:{hero:{...home.live.locales.en.hero,button1Href:'/contact'}}}]},{id:source.id,version:source.workflow.version,patches:[{locale:'en',fields:{b3:{...source.live.locales.en.b3,s5:'Our purpose'}}}]}],{key:'admin'},now);
 assert.ok(result.data);assert.equal(store.entries.get('st_about').draft.locales.en.b3.s5,'Our purpose');assert.equal(JSON.stringify([...store.entries].map(([id,e])=>[id,e.live])),before);
});
test('stale or unrelated source rejects the entire page save',()=>{
 for(const unrelated of [false,true]){const store=makeStore(now),home=store.entries.get('pg_about'),before=store.exportState();
 const result=savePageDraft(store,home.id,[{id:home.id,version:home.workflow.version,patches:[{locale:'en',fields:{hero:{button1Href:'/contact'}}}]},{id:unrelated?'pg_services':'st_about',version:0,patches:[{locale:'en',fields:{}}]}],{key:'admin'},now);
 assert.equal(result.status,unrelated?422:412);assert.deepEqual(store.exportState(),before);}
});
test('manager order survives persistence without changing published order or content',()=>{
 const store=makeStore(now),before=JSON.stringify([...store.entries].map(([id,e])=>[id,e.order,e.live]));
 const initial=orderOf(store,'service');store.managerOrders.service=[...initial.ids].reverse();assert.notEqual(orderOf(store,'service').version,initial.version);
 const restored=makeStore(now);restored.importState(store.exportState());assert.deepEqual(orderOf(restored,'service').ids,[...initial.ids].reverse());assert.equal(JSON.stringify([...store.entries].map(([id,e])=>[id,e.order,e.live])),before);
});
test('invalid persisted manager preferences are rejected before restoration',()=>{
 for(const preferences of [{managerOrders:{service:['sv_01','sv_01']}},{contentLocales:['en','xx']}]){
  const store=makeStore(now),before=store.exportState();
  assert.throws(()=>store.importState({...before,...preferences}));assert.deepEqual(store.exportState(),before);
 }
});
test('a new private language survives reload and can save translation drafts',()=>{
 const store=makeStore(now),ops=makeOps({store,now}),site=ops.site;
 const result=ops.updateSite({key:'admin'},{locales:[...site.locales,{code:'es',enabled:true,public:false}]},()=>true);
 assert.ok(result.site);assert.ok(store.LOCALES.includes('es'));
 const restored=makeStore(now);restored.importState(store.exportState());const nextOps=makeOps({store:restored,now});nextOps.importState(ops.exportState());assert.ok(restored.LOCALES.includes('es'));
 const source=restored.entries.get('st_about');assert.ok(!restored.save(source,{key:'admin'},{locale:'es',fields:source.live.locales.en},{can:()=>true}).errors);
});
