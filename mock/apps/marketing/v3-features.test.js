const {test}=require('node:test');
const assert=require('node:assert/strict');
const {runtime,harness,plain,context}=require('../hr/runtime-harness');
function fixture(options={}) {
 const seed=runtime('marketing','ws_orgtik',{fixtureId:'orgtik-v1',...options});
 const contacts=[{id:'crm-current-uuid',name:'Canonical CRM person',email:'crm@example.test',currency:'EUR',consent:{state:'opted_in'}}];
 const crmDirectory={current:async()=>({workspaceId:'ws_orgtik',contacts,companies:[]}),resolve:async({contactIds})=>({workspaceId:'ws_orgtik',contacts:contacts.filter(c=>contactIds.includes(c.id)),companies:[]})};
 const input={...seed.input,snapshot:plain(seed.instance.exportSnapshot()),services:{...seed.input.services,ctx:{...seed.input.services.ctx,currentContext:()=>context(seed,'marketing'),crmDirectory}}};
 const instance=seed.graph.load().createWorkspaceRuntime(input);
 return {...seed,instance,contacts,close(){instance.close();seed.close();}};
}
test('Marketing sender/designer exports actual escaped RTL bytes and retries recover one self-test event',async()=>{
 const f=fixture(),http=await harness([f]);
 try{
  const sender=(await http.call(0,'POST','/v3/senders',{name:'Owned sender',from:'hello@example.test'})).json.data;
  assert.equal((await http.call(0,'POST',`/v3/senders/${sender.id}/verify`,{})).json.data.state,'verified_mock');
  const template=(await http.call(0,'POST','/v3/email-designs',{name:'Actual RTL email',senderId:sender.id})).json.data;
  const design={subject:'Arabic email',headline:'مرحبًا <script>bad()</script>',body:'أهلًا\nSecond & line',cta:'Read',ctaUrl:'https://example.test/info',direction:'rtl',format:{bold:true,italic:true,bullets:true},companyName:'Actual brand',postalAddress:'12 Example street'};
  assert.equal((await http.call(0,'PATCH',`/v3/email-designs/${template.id}`,design)).status,200);
  const download=await http.call(0,'GET',`/v3/email-designs/${template.id}/export`),html=download.raw.toString('utf8');
  assert.equal(download.status,200);assert(download.raw.length>250);assert(html.includes('dir="rtl"'));assert(html.includes('&lt;script&gt;'));assert(!html.includes('<script>'));assert(html.includes('<li>'));
  assert.equal((await http.call(0,'PATCH',`/v3/email-designs/${template.id}`,{...design,ctaUrl:'javascript:alert(1)'})).status,422);
  const body={templateId:template.id,operationId:'self-test'};
  const first=(await http.call(0,'POST',`/v3/senders/${sender.id}/test`,body)).json.data;
  assert.deepEqual((await http.call(0,'POST',`/v3/senders/${sender.id}/test`,body)).json.data,first);
  assert.equal(first.recipientUserId,f.identity.users[0].id);assert.equal(first.state,'simulated_not_sent');
  assert.equal((await http.call(0,'POST',`/v3/senders/${sender.id}/test`,{...body,templateId:'foreign'})).status,404);
  const db=f.instance.exportSnapshot().data;assert.equal(db.marketingV3.testSends.length,1);assert.equal(Object.values(db.marketingV3.operations)[0].receiptId,first.id);assert(!Object.values(db.marketingV3.operations)[0].receipt);
  assert.equal((await http.call(0,'GET',`/v3/email-designs/${template.id}/export`,undefined,{'x-user':String(f.identity.findByKey('finance').id)})).status,403);
 }finally{await http.close();}
});
test('Marketing mock send checks current consent, approval and template version without CRM master copies',async()=>{
 const f=fixture(),http=await harness([f]);
 try{
  const snapshot=plain(f.instance.exportSnapshot()),p=snapshot.data.projects[0],campaign=snapshot.data.campaigns.find(c=>c.projectId===p.id);
  snapshot.data.activeProject[f.identity.users[0].id]=p.id;Object.assign(campaign,{isComplete:true,status:'READY',approvalStatus:'NOT_REQUIRED'});f.instance.applyCommitted({snapshot});
  const sender=(await http.call(0,'POST','/v3/senders',{name:'Sender',from:'hello@example.test'})).json.data;
  await http.call(0,'POST',`/v3/senders/${sender.id}/verify`,{});
  const template=(await http.call(0,'POST','/v3/email-designs',{name:'Message',senderId:sender.id})).json.data;
  await http.call(0,'PATCH',`/v3/email-designs/${template.id}`,{headline:'Headline',body:'Actual text',direction:'ltr',format:{},companyName:'Company',postalAddress:'Address'});
  assert.equal((await http.call(0,'PATCH',`/v3/campaigns/${campaign.id}/message`,{senderId:sender.id,templateId:template.id})).status,200);
  assert.equal((await http.call(0,'PATCH',`/v3/campaigns/${campaign.id}/recipients`,{refs:[{workspaceId:'ws_orgtik',contactId:f.contacts[0].id}]})).status,200);
  f.contacts[0].consent.state='opted_out';
  const first=(await http.call(0,'POST',`/v3/campaigns/${campaign.id}/mock-delivery`,{operationId:'actual-mock'})).json.data;
  assert.equal(first.sent,0);assert.equal(first.suppressed[0].reason,'opted_out');assert(first.simulated);
  assert.deepEqual((await http.call(0,'POST',`/v3/campaigns/${campaign.id}/mock-delivery`,{operationId:'actual-mock'})).json.data,first);
  const saved=plain(f.instance.exportSnapshot());assert.equal(saved.data.campaigns.find(c=>c.id===campaign.id).crmDeliveries.length,1);assert.equal(saved.data.marketingV3.contacts,undefined);
  await http.call(0,'PATCH',`/v3/email-designs/${template.id}`,{headline:'New headline',body:'Changed message',direction:'ltr',format:{},companyName:'Company',postalAddress:'Address'});
  assert.equal((await http.call(0,'POST',`/v3/campaigns/${campaign.id}/mock-delivery`,{operationId:'stale-template'})).status,409);
  const denied=plain(f.instance.exportSnapshot());denied.data.campaigns.find(c=>c.id===campaign.id).approvalStatus='PENDING_APPROVAL';f.instance.applyCommitted({snapshot:denied});
  assert.equal((await http.call(0,'POST',`/v3/campaigns/${campaign.id}/mock-delivery`,{operationId:'pending-approval'})).status,409);
 }finally{await http.close();}
});
test('Marketing queue changes native target schedules/order and leaves locked or foreign records unchanged',async()=>{
 const f=fixture(),http=await harness([f]);
 try{
  const snapshot=plain(f.instance.exportSnapshot()),p=snapshot.data.projects[0];snapshot.data.activeProject[1]=p.id;
  const own=snapshot.data.posts.filter(r=>r.projectId===p.id).slice(0,2),foreign=snapshot.data.posts.find(r=>r.projectId!==p.id);
  own.forEach((r,i)=>Object.assign(r,{status:'DRAFT',approvalStatus:'NOT_REQUIRED',v3Order:i,scheduledAt:null}));f.instance.applyCommitted({snapshot});
  assert.equal((await http.call(0,'PATCH',`/v3/queue/${own[1].id}`,{status:'DRAFT',beforeId:own[0].id})).status,200);
  let saved=plain(f.instance.exportSnapshot());assert(saved.data.posts.find(r=>r.id===own[1].id).v3Order<saved.data.posts.find(r=>r.id===own[0].id).v3Order);
  assert.equal((await http.call(0,'PATCH',`/v3/queue/${own[1].id}`,{status:'SCHEDULED',scheduledAt:'2026-10-08T12:00:00Z'})).status,200);
  saved=plain(f.instance.exportSnapshot());const post=saved.data.posts.find(r=>r.id===own[1].id);assert.equal(post.scheduledAt,'2026-10-08T12:00:00.000Z');assert(post.targets.filter(t=>!t.publishedAt).every(t=>t.scheduledAt===post.scheduledAt));
  for(const [id,body]of [[foreign.id,{status:'DRAFT'}],[own[1].id,{status:'SCHEDULED',scheduledAt:'2026-01-01T00:00:00Z'}],[own[1].id,{status:'PUBLISHED'}]]){assert((await http.call(0,'PATCH',`/v3/queue/${id}`,body)).status>=400);assert.deepEqual(plain(f.instance.exportSnapshot()),saved);}
 }finally{await http.close();}
});
test('Marketing brand voice, writing, social reply and journey dry run persist actual actor events once',async()=>{
 const f=fixture(),http=await harness([f]);
 try{
  const brand={voice:'warm',audience:'Customers',proposition:'Actual service options',companyName:'Brand',postalAddress:'Address'};
  assert.equal((await http.call(0,'PATCH','/v3/brand',brand)).status,200);
  const warm=(await http.call(0,'POST','/v3/writing',{topic:'Service review',locale:'en'})).json.data;
  await http.call(0,'PATCH','/v3/brand',{...brand,voice:'formal'});
  const formal=(await http.call(0,'POST','/v3/writing',{topic:'Service review',locale:'en'})).json.data;
  assert.notEqual(warm.headline,formal.headline);assert.equal(formal.voice,'formal');assert.equal(formal.provider,'template_mock');
  const thread=(await http.call(0,'POST','/v3/social-inbox/sample',{})).json.data[0];
  const body={body:'Actual saved response',operationId:'social-reply'};
  const reply=(await http.call(0,'POST',`/v3/social-inbox/${thread.id}/replies`,body)).json.data;
  assert.deepEqual((await http.call(0,'POST',`/v3/social-inbox/${thread.id}/replies`,body)).json.data,reply);
  assert.equal((await http.call(0,'POST',`/v3/social-inbox/${thread.id}/replies`,{...body,body:'Changed response'})).status,409);
  const campaign=(await http.call(0,'GET','/v3/bootstrap')).json.data.campaigns[0];
  const journey=(await http.call(0,'POST','/v3/journeys',{name:'Actual journey',campaignId:campaign.id})).json.data;
  const steps=[...journey.steps,{id:'wait-owned',type:'wait',days:3},{id:'task-owned',type:'task',days:0}];
  assert.equal((await http.call(0,'PATCH',`/v3/journeys/${journey.id}`,{name:journey.name,steps})).status,200);
  const run=(await http.call(0,'POST',`/v3/journeys/${journey.id}/run`,{operationId:'dry-run'})).json.data;
  assert.equal(run.mode,'dry_run');assert.equal(run.logs[1].dueAt,'2026-10-10T09:00:00.000Z');assert.equal(run.logs[2].state,'simulated_not_executed');
  assert.deepEqual((await http.call(0,'POST',`/v3/journeys/${journey.id}/run`,{operationId:'dry-run'})).json.data,run);
  const saved=plain(f.instance.exportSnapshot());assert.equal(saved.data.marketingV3.socialThreads.find(r=>r.id===thread.id).replies.length,1);assert.equal(saved.data.marketingV3.journeys.find(r=>r.id===journey.id).runs.length,1);
  const fresh=fixture({snapshot:saved});try{assert.deepEqual(plain(fresh.instance.exportSnapshot()),saved);}finally{fresh.close();}
 }finally{await http.close();}
});
test('Marketing current feed visibility and extension custody preserve attribution while denying changes',async()=>{
 const f=fixture(),http=await harness([f]);
 try{
  await http.call(0,'PATCH','/v3/brand',{voice:'direct',audience:'Audience',proposition:'Service',companyName:'Brand',postalAddress:'Address'});
  await http.call(0,'POST','/v3/writing',{topic:'Actual topic',locale:'ar'});
  const before=plain(f.instance.exportSnapshot()),feed=f.instance.suiteFeed(context(f,'marketing'));
  assert(feed.campaigns.length>0&&feed.posts.length>0);assert.equal(f.instance.suiteFeed({...context(f,'marketing'),tools:{marketing:{access:'no_access',canWrite:false}}}).state,'no_access');
  const command={operationId:'owned-custody',fromUserId:f.identity.users[0].id,target:{kind:'archive'}};
  const result=f.instance.transferOwnership(command);assert(result.archived.some(id=>id.startsWith('marketingV3.drafts:')));assert.deepEqual(plain(f.instance.transferOwnership(command)),plain(result));
  const after=plain(f.instance.exportSnapshot());assert.equal(after.data.marketingV3.drafts[0].createdBy,before.data.marketingV3.drafts[0].createdBy);assert.equal(after.data.marketingV3.drafts[0].custodyReadOnly,true);
  assert.equal((await http.call(0,'POST','/v3/writing',{topic:'Denied topic',locale:'ar'})).status,403);assert.deepEqual(plain(f.instance.exportSnapshot()),after);
 }finally{await http.close();}
});
test('Marketing ordinary messaging constructor saves canonical CRM references and retires duplicate imports',async()=>{
 const f=fixture(),http=await harness([f]);
 try{
  const before=plain(f.instance.exportSnapshot());
  assert.equal((await http.call(0,'POST','/audiences/imports',{})).status,410);
  assert.equal((await http.call(0,'POST','/audiences/imports/legacy/commit',{})).status,410);
  assert.deepEqual(plain(f.instance.exportSnapshot()),before);
  const sender=(await http.call(0,'POST','/v3/senders',{name:'Canonical sender',from:'hello@example.test'})).json.data;
  const template=(await http.call(0,'POST','/v3/email-designs',{name:'Canonical template',senderId:sender.id})).json.data;
  const campaign=(await http.call(0,'POST','/campaigns',{name:'Actual canonical messaging campaign',type:'MESSAGING'})).json.data;
  const refs=[{workspaceId:'ws_orgtik',contactId:f.contacts[0].id}],body={step:'MESSAGE',adSets:[{name:'Canonical recipients',configuration:{channel:'EMAIL',senderConfigId:sender.id,templateId:template.id,crmRecipientRefs:refs}}]};
  assert.equal((await http.call(0,'PATCH',`/campaigns/${campaign.id}/onboarding`,body)).status,200);
  const saved=plain(f.instance.exportSnapshot()),actual=saved.data.campaigns.find(c=>c.id===campaign.id);
  assert.deepEqual(actual.crmRecipientRefs,refs);assert.deepEqual(actual.adSets[0].configuration.crmRecipientRefs,refs);assert.equal(actual.adSets[0].configuration.audienceId,undefined);assert.equal(actual.configuration.templateId,template.id);assert.equal(saved.data.audiences.length,before.data.audiences.length);
  const invalid={...body,adSets:[{...body.adSets[0],configuration:{...body.adSets[0].configuration,crmRecipientRefs:[{workspaceId:'ws_orgtik',contactId:'foreign'}]}}]};
  assert.equal((await http.call(0,'PATCH',`/campaigns/${campaign.id}/onboarding`,invalid)).status,422);assert.deepEqual(plain(f.instance.exportSnapshot()),saved);
 }finally{await http.close();}
});
