const {test} = require('node:test');
const assert = require('node:assert/strict');
const {makeStore}=require('./content');
const {DEPARTMENTS,blankContent}=require('./defaults');
const who={key:'editor'}, approver={key:'approver'}, all={can:()=>true};
const make=()=>makeStore(()=> '2026-10-05T10:00:00.000Z');
test('translations preserve approved figures and the enabled narrative',()=>{
 const s=make(),e=s.entries.get('cs_01');s.approveFigures(e,approver);
 s.save(e,approver,{neutral:{narrativePublished:true}},all);
 const fields=structuredClone(e.draft.locales.en);fields.highlight.label='Übersetztes Ergebnis';
 assert.ok(s.save(e,who,{locale:'de',fields},all).entry);
 assert.equal(e.draft.provenance.figures,'approved');assert.equal(e.draft.narrativePublished,true);
 fields.highlight.label='Bearbeitet';assert.ok(s.save(e,who,{locale:'de',fields},all).entry);
 assert.equal(e.draft.provenance.figures,'approved');assert.equal(e.draft.narrativePublished,true);
});
test('blank dates follow the supplied mock clock',()=>{
 const s=makeStore(()=> '2031-02-03T10:00:00.000Z');
 assert.equal(s.create('article',who,{name:'Dated article',slug:'dated-article'}).entry.draft.publishedOn,'2031-02-03');
 assert.equal(s.create('roadmapItem',who,{name:'Dated roadmap'}).entry.draft.year,'2031');
});
test('merged ideas retain their comment counts and sample threads',()=>{
 const s=make();const source=[...s.ideas.values()].find(x=>['pending','open'].includes(x.status));
 const target=[...s.ideas.values()].find(x=>x.id!==source.id&&s.VISIBLE.includes(x.status));
 source.comments=2;source.commentPreview=[{id:'merge-comment',author:'Sample',body:'Discussion'}];
 const count=target.comments;assert.ok(s.moderate(source,approver,'merge',{into:target.id}).idea);
 assert.equal(target.comments,count+2);assert.ok(target.commentPreview.some(x=>x.id==='merge-comment'));
});
test('publication and scheduling require a lead image for articles and cases',()=>{
 const s=make();for(const type of ['article','caseStudy']){
 const e=s.create(type,who,{name:'No image',slug:`no-image-${type.toLowerCase()}`,department:'design'}).entry;
 e.workflow.state='approved';assert.equal(s.transition(e,approver,'publish',all).fieldErrors['image.src'],'required');
 assert.equal(s.transition(e,approver,'schedule',{...all,publishAt:'2026-10-06T10:00:00Z'}).fieldErrors['image.src'],'required');
 }
});
for(const department of DEPARTMENTS)test(`blank ${department} case can be created without a template`,()=>{
 const store=make();for(const [id,e] of store.entries)if(e.type==='caseStudy')store.entries.delete(id);
 const {entry,errors}=store.create('caseStudy',who,{name:'Blank case',slug:`blank-${department}`,department});
 assert.equal(errors,undefined);assert.equal(entry.department,department);assert.equal(entry.format,store.entries.get('gl_caseFormats').live.locales.en.formats[department]);
 assert.deepEqual(entry.draft.locales.en, {...blankContent('caseStudy',department).locales.en,name:'Blank case'});
 assert.equal(entry.draft.narrativePublished,false);assert.equal(entry.live,null);
});
test('blank articles and roadmap items need no template; case department is required',()=>{
 const s=make();for(const [id,e] of s.entries)if(['article','roadmapItem','caseStudy'].includes(e.type))s.entries.delete(id);
 assert.ok(s.create('article',who,{name:'Article',slug:'blank-article'}).entry);
 assert.ok(s.create('roadmapItem',who,{name:'Milestone'}).entry);
 assert.equal(s.create('caseStudy',who,{name:'Case',slug:'case'}).errors.department,'required');
});
test('explicit copy retains department and resets narrative and approval',()=>{
 const s=make(), template=s.entries.get('cs_01');template.live.provenance.figures='approved';template.live.narrativePublished=true;
 const e=s.create('caseStudy',who,{name:'Copy',slug:'copy',from:'cs_01',department:'hosting'}).entry;
 assert.equal(e.department,template.department);assert.equal(e.draft.provenance.figures,'sample');assert.equal(e.draft.narrativePublished,false);
});
test('narrative edits require an approver and approved figures',()=>{
 const s=make(),e=s.entries.get('cs_01');
 assert.equal(s.save(e,who,{neutral:{narrativePublished:true}},{can:()=>false}).required,'content:approve');
 assert.equal(s.save(e,approver,{neutral:{narrativePublished:true}},all).errors.narrativePublished,'narrative_needs_approved_figures');
 s.approveFigures(e,approver);assert.ok(s.save(e,approver,{neutral:{narrativePublished:true}},all).entry);
});
test('changing approved figures revokes approval before validation and preserves live content',()=>{
 const s=make(),e=s.entries.get('cs_01');e.live.provenance.figures='approved';e.live.narrativePublished=true;e.live.sampleNarrativePublished=false;
 const live=JSON.stringify(e.live);
 assert.ok(s.save(e,who,{locale:'en',fields:{highlight:{value:'12',label:'Edited'}}},all).entry);
 assert.equal(e.draft.provenance.figures,'sample');assert.equal(e.draft.narrativePublished,false);assert.equal(JSON.stringify(e.live),live);
 assert.equal(e.draft.provenance.approvedBy,undefined);
});
test('invalid restored, published and scheduled sample narratives are rejected',()=>{
 const s=make(),e=s.entries.get('cs_01');const bad=structuredClone(e.live);bad.narrativePublished=true;
 e.versions.push({version:42,content:bad});assert.equal(s.restore(e,approver,42,all).fieldErrors.narrativePublished,'narrative_needs_approved_figures');
 e.draft=bad;e.workflow.state='approved';assert.equal(s.transition(e,approver,'publish',all).status,422);
 assert.equal(s.transition(e,approver,'schedule',{...all,publishAt:'2026-10-06T10:00:00Z'}).status,422);
 e.workflow.state='scheduled';e.workflow.publishAt='2026-10-05T09:00:00Z';const live=JSON.stringify(e.live);s.tick();assert.equal(JSON.stringify(e.live),live);assert.equal(e.workflow.state,'approved');assert.equal(e.workflow.publishAt,null);assert.equal(s.audit[0].action,'schedule_failed');
});
test('restore cannot change narrative permission through history',()=>{
 const s=make(),e=s.entries.get('cs_01');const approved=structuredClone(e.live);approved.provenance.figures='approved';approved.narrativePublished=true;e.versions.push({version:42,content:approved});
 assert.equal(s.restore(e,who,42,{can:()=>false}).required,'content:approve');
});
test('test-card placeholders cannot be removed or replaced by editable figures',()=>{
 const s=make(),e=s.entries.get('gl_commerce');const fields=structuredClone(e.live.locales.en);const key='paymentDetails-intro';
 assert.ok(fields[key].p.includes('{0}'));fields[key].p=fields[key].p.replace('{0}','9999');
 assert.equal(s.save(e,who,{locale:'en',fields},all).errors['locales.en.paymentDetails-intro.p'],'marks_changed');
});

test('imported sample stories retain sample provenance and need separate approval permission',()=>{
 const s=make(),e=s.entries.get('cs_01');assert.equal(e.live.sampleNarrativePublished,true);assert.equal(e.live.narrativePublished,false);assert.equal(e.live.provenance.figures,'sample');
 assert.equal(s.save(e,who,{neutral:{sampleNarrativePublished:false}},{can:()=>false}).required,'content:approve');
 assert.ok(s.save(e,approver,{neutral:{sampleNarrativePublished:false}},all).entry);
 assert.ok(s.save(e,approver,{neutral:{sampleNarrativePublished:true}},all).entry);
 assert.equal(s.save(e,approver,{neutral:{narrativePublished:true}},all).errors.narrativePublished,'narrative_needs_approved_figures');
 const copied=s.create('caseStudy',who,{name:'Sample copy',slug:'sample-copy',from:e.id}).entry;assert.equal(copied.draft.sampleNarrativePublished,false);
});

test('figure approval disables the sample story until an approved narrative is enabled',()=>{
 const s=make(),e=s.entries.get('cs_01');s.approveFigures(e,approver);assert.equal(e.draft.sampleNarrativePublished,false);assert.equal(e.live.sampleNarrativePublished,true);
 assert.equal(s.save(e,approver,{neutral:{sampleNarrativePublished:true}},all).errors.sampleNarrativePublished,'sample_narrative_needs_sample_figures');
 assert.ok(s.save(e,approver,{neutral:{narrativePublished:true}},all).entry);
});

test('sample-story restore, publish and schedule enforce permission and provenance',()=>{
 const s=make(),e=s.entries.get('cs_01');const bad=structuredClone(e.live);bad.provenance.figures='approved';e.versions.push({version:42,content:bad});
 assert.equal(s.restore(e,approver,42,all).fieldErrors.sampleNarrativePublished,'sample_narrative_needs_sample_figures');
 e.draft=bad;e.workflow.state='approved';assert.equal(s.transition(e,approver,'publish',all).status,422);assert.equal(s.transition(e,approver,'schedule',{...all,publishAt:'2026-10-07T10:00:00Z'}).status,422);
 e.workflow.state='scheduled';e.workflow.publishAt='2026-10-05T09:00:00Z';const live=JSON.stringify(e.live);s.tick();assert.equal(JSON.stringify(e.live),live);
 e.draft=structuredClone(e.live);e.draft.sampleNarrativePublished=false;const restored=structuredClone(e.live);e.versions.push({version:43,content:restored});assert.equal(s.restore(e,who,43,{can:()=>false}).required,'content:approve');
});
