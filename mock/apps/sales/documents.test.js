const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const H=require('./lib');
const documents=require('./documents');
test('CRM current offer revisions use real nonempty PDFs and preserve negotiated amounts',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'crm-documents-'));
 try{
  const offer={id:'offer-a',name:'Actual negotiated offer',customerId:'customer-a',currencyCode:'CHF',status:'pending',lines:[{planName:'Service',durationMonths:3,price:300}],totals:{subtotal:300,installmentMarkupTotal:0,discountAmount:0,vatAmount:0,total:300}};
  const S={ctx:{uploadsDir:dir},db:{offers:[offer]},core:{customerById:()=>({fullName:'Actual customer',companyName:'Actual company'})},deals:{canSeeOffer:req=>req.actor==='staff'}};
  const docs=documents(S),first=docs.offer({actor:'staff'},offer.id);
  assert.equal(first.bytes.subarray(0,5).toString(),'%PDF-');assert.ok(first.bytes.length>100);
  assert.deepEqual(docs.offer({actor:'staff'},offer.id).bytes,first.bytes);
  Object.assign(offer,{status:'accepted',counterTotal:240});
  const revised=docs.offer({actor:'staff'},offer.id);
  assert.notDeepEqual(revised.bytes,first.bytes);assert.ok(revised.bytes.toString().includes(H.fmtMoney(240,'CHF')));assert.equal(offer.totals.total,300);assert.equal(offer.counterTotal,240);
  assert.throws(()=>docs.offer({actor:'foreign'},offer.id),{status:404});assert.equal(fs.readdirSync(dir).length,2);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('CRM signed contracts return their exact recorded version and never regenerate unsigned bytes',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'crm-signed-'));
 try{
  const signed=H.makePdf('Actual signed contract',['Recorded signature version: signed-7']);fs.writeFileSync(path.join(dir,'signed-contract-7.pdf'),signed);
  const contract={id:'contract-a',projectId:'project-a',isSigntuerd:true,signedPdfPath:{url:'http://localhost/uploads/signed-contract-7.pdf',name:'Actual-Signed.pdf',size:signed.length,mimetype:'application/pdf'}};
  let generated=0;const S={ctx:{uploadsDir:dir},db:{offers:[]},core:{},deals:{contractById:id=>id===contract.id?contract:null,projectById:id=>id===contract.projectId?{id}:null,canSeeProject:req=>req.actor==='owner',contractPdf:()=>{generated++;}}},docs=documents(S);
  assert.deepEqual(docs.contract({actor:'owner'},contract.id).bytes,signed);assert.equal(generated,0);assert.throws(()=>docs.contract({actor:'foreign'},contract.id),{status:404});
  contract.signedPdfPath.size++;assert.throws(()=>docs.contract({actor:'owner'},contract.id),{status:409});contract.signedPdfPath=null;assert.throws(()=>docs.contract({actor:'owner'},contract.id),{status:409});assert.equal(generated,0);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('CRM recorded document paths and MIME are contained in owned output',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'crm-path-'));
 try{
  const contract={id:'contract-a',projectId:'project-a',isSigntuerd:true,signedPdfPath:{url:'http://localhost/uploads/..%2Fforeign.pdf',size:200}};
  const docs=documents({ctx:{uploadsDir:dir},db:{offers:[]},core:{},deals:{contractById:()=>contract,projectById:()=>({}),canSeeProject:()=>true}});
  assert.throws(()=>docs.contract({},contract.id),{status:404});
  fs.writeFileSync(path.join(dir,'bad.pdf'),'not a PDF'.repeat(30));contract.signedPdfPath={url:'/uploads/bad.pdf',size:270};assert.throws(()=>docs.contract({},contract.id),{status:409});
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

