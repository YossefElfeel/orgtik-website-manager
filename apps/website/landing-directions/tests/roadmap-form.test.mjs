import assert from 'node:assert/strict';
import test from 'node:test';
import {sendIdea} from '../src/content/forms.js';

test('roadmap submission reaches the configured CMS and includes the privacy version',async()=>{
  const previous=globalThis.fetch; let request;
  try {
    globalThis.fetch=async (url,options)=>{request={url,options};return {ok:true,json:async()=>({data:{id:'idea-test',status:'pending'}})};};
    const result=await sendIdea({name:'Test',email:'test@example.test',title:'Clear idea title',message:'An idea',topic:'A product idea',consent:true});
    assert(request.url.endsWith('/v2/public/ideas')); assert.equal(request.options.method,'POST');
    assert.deepEqual(JSON.parse(request.options.body),{name:'Test',email:'test@example.test',title:'Clear idea title',message:'An idea',topic:'A product idea',consent:true,privacyVersion:'0.2'});
    assert.equal(result.data.status,'pending'); assert(!result.preview);
  } finally {globalThis.fetch=previous;}
});
for(const status of [409,503])test(`a ${status} CMS response rejects instead of pretending the idea was saved`,async()=>{
  const previous=globalThis.fetch;
  try {globalThis.fetch=async()=>({ok:false,status});await assert.rejects(sendIdea({name:'Test',email:'test@example.test',message:'An idea',topic:'A product idea'}),new RegExp('ideas '+status));}
  finally {globalThis.fetch=previous;}
});
