// One application constructor for signed HR forms and the bounded public careers entry.
function createApplication(h,jobId,fields,{file=null,requireOpened=false,strictTextOnly=false}={}) {
  const {db,V,L}=h,job=db.jobs.find(Number(jobId));
  const fail=(message,status=422,code='invalid_application')=>Object.assign(new Error(message),{status,code});
  if(!job||job.deletedAt||job.custodyReadOnly||requireOpened&&(job.status!=='opened'||!job.untilClosed&&job.endDate&&L.normDate(job.endDate)<L.todayStr()))throw fail('This opening is unavailable.',404,'job_not_found');
  if(!fields||typeof fields!=='object'||Array.isArray(fields))throw fail('Review the application.');
  if(strictTextOnly){const allowed=['fullName','email','phoneNumber','coverLetter'];if(Object.keys(fields).some(key=>!allowed.includes(key))||Object.values(fields).some(value=>typeof value!=='string')||file)throw fail('Only text application fields are accepted.');}
  const fullName=String(fields.fullName||'').trim(),email=String(fields.email||'').trim().toLowerCase();
  if(!fullName||fullName.length>150||!email||email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||String(fields.phoneNumber||'').length>60||String(fields.coverLetter||'').length>4000)throw fail('Review name, email, phone and cover letter.');
  const now=L.nowIso(),a=db.applications.insert({jobId:job.id,fullName,gender:fields.gender||'',email,nationality:fields.nationality||'EG',phoneNumber:fields.phoneNumber||'',dateOfBirth:L.normDate(fields.dateOfBirth)||'',address:fields.address||'',university:fields.university||'',qualification:fields.qualification||'',graduationDate:L.normDate(fields.graduationDate)||'',coverLetter:String(fields.coverLetter||''),resumeFileName:file?file.originalname:'',resumeFilePath:file?'uploads/'+file.filename:'',resumeMimeType:file?file.mimetype:'',resumeFileSize:file?String(file.size):'0',currentStage:'applying',stageUpdatedAt:now,appliedAt:now,deletedAt:null});
  db.stages.insert({applicationId:a.id,stage:'applying',stageAt:now,note:'Applied via careers page',updatedBy:null});
  h.notify({to:h.usersWithRole('hr'),actor:null,action:'application.created',title:'New job application',body:a.fullName+' applied for '+job.title+'.',entityType:'JobApplication',entityId:a.id});return a;
}
module.exports={createApplication};
