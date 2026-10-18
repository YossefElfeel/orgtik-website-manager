const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const H = require('./lib');
const fail = (status,code,message) => Object.assign(new Error(message),{status,code});
module.exports = function crmDocuments(S) {
  const {db,core:K}=S;
  function ownedPath(filename) {
    if(typeof filename!=='string'||!filename||filename!==path.basename(filename)||!/^[\w.-]+\.pdf$/i.test(filename))throw fail(404,'document_not_found','This recorded PDF was not found.');
    const base=fs.realpathSync(S.ctx.uploadsDir),full=path.resolve(base,filename);
    if(!full.startsWith(base+path.sep))throw fail(404,'document_not_found','This recorded PDF was not found.');
    if(fs.existsSync(full)&&!fs.realpathSync(full).startsWith(base+path.sep))throw fail(404,'document_not_found','This recorded PDF was not found.');
    return full;
  }
  function bytes(filename,recordedSize) {
    const full=ownedPath(filename);
    if(!fs.existsSync(full))throw fail(404,'document_not_found','This recorded PDF was not found.');
    const stat=fs.statSync(full);
    if(!stat.isFile()||stat.size<100||stat.size>10*1024*1024||recordedSize!==undefined&&Number(recordedSize)!==stat.size)throw fail(409,'document_version_unavailable','Review the recorded document version.');
    const content=fs.readFileSync(full);
    if(content.subarray(0,5).toString()!=='%PDF-'||!content.subarray(-64).toString().includes('%%EOF'))throw fail(409,'document_mime_mismatch','The recorded document is not a valid PDF.');
    return content;
  }
  const version=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0,24);
  function offer(req,id) {
    const row=db.offers.find(item=>item.id===id);
    if(!row||!S.deals.canSeeOffer(req,row))throw fail(404,'offer_not_found','This visible offer was not found.');
    const contact=K.customerById(row.customerId),cur=row.currencyCode,filename=`offer-${row.id}-${version({row,customer:contact?.fullName,company:contact?.companyName})}.pdf`,full=ownedPath(filename);
    if(!fs.existsSync(full))fs.writeFileSync(full,H.makePdf(row.name,[`Customer: ${contact?.fullName||'-'}`,`Company: ${contact?.companyName||'-'}`,`Status: ${row.status}`,`Valid until: ${row.crmValidUntil||'-'}`,'---',...row.lines.map(line=>({text:`${line.planName} · ${line.durationMonths} months`,right:H.fmtMoney(line.price,cur)})),{text:'Subtotal',right:H.fmtMoney(row.totals.subtotal,cur)},{text:'Installment markup',right:H.fmtMoney(row.totals.installmentMarkupTotal,cur)},{text:'Discount',right:H.fmtMoney(row.totals.discountAmount,cur)},{text:'VAT',right:H.fmtMoney(row.totals.vatAmount,cur)},{text:'Quoted total',right:H.fmtMoney(row.totals.total,cur)},{text:'Agreed total',bold:true,right:H.fmtMoney(row.status==='accepted'?row.counterTotal??row.totals.total:row.totals.total,cur)},...(row.crmSimulatedSignature?[`Simulated signature: ${row.crmSimulatedSignature.name} · ${row.crmSimulatedSignature.at}`]:[])],{subtitle:'OrgTik CRM · local prototype'}));
    return {bytes:bytes(filename),name:`Offer-${row.id}.pdf`};
  }
  function contract(req,id) {
    const row=S.deals.contractById(id),project=row&&S.deals.projectById(row.projectId);
    if(!row||!project||!S.deals.canSeeProject(req,project))throw fail(404,'contract_not_found','This visible contract was not found.');
    if(row.signedPdfPath||row.isSigntuerd) {
      const recorded=row.signedPdfPath;
      if(!recorded?.url||recorded.mimetype&&recorded.mimetype!=='application/pdf')throw fail(409,'signed_document_unavailable','Review the actual recorded signed document.');
      let filename;try{const location=new URL(recorded.url,'http://owned.invalid');filename=decodeURIComponent(location.pathname.split('/').at(-1));}catch{throw fail(404,'document_not_found','This recorded PDF was not found.');}
      return {bytes:bytes(filename,recorded.size),name:recorded.name||`Contract-${row.id}-signed.pdf`};
    }
    const filename=`contract-${row.id}-${version({row,customer:K.customerById(project.customerId)})}.pdf`,full=ownedPath(filename);
    if(!fs.existsSync(full))S.deals.contractPdf(row,filename);
    return {bytes:bytes(filename),name:row.unsignedPdfPath?.name||`Contract-${row.id}.pdf`};
  }
  function stream(getter) { return (req,res)=>{try{const document=getter(req,req.params.id);res.set({'Content-Type':'application/pdf','Content-Disposition':`attachment; filename*=UTF-8''${encodeURIComponent(document.name)}`,'Cache-Control':'private, no-store'}).send(document.bytes);}catch(error){res.status(error.status||503).json({success:false,code:error.code||'document_unavailable',message:error.status?error.message:'This recorded document is unavailable.'});}}; }
  return {routes(app){app.get('/api/crm/v3/offers/:id/pdf',stream(offer));app.get('/api/crm/v3/contracts/:id/pdf',stream(contract));},offer,contract};
};
