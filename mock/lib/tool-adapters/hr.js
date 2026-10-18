const express = require("express");
const seed = require("../../apps/hr/seed");
const L = require("../../apps/hr/lib");
const SCHEMA = "orgtik.workspace.hr";
const clone = value => JSON.parse(JSON.stringify(value));
const failure = message => Object.assign(new Error(message), { status: 503, code: "workspace_runtime_unavailable" });

function createWorkspaceRuntime(input, appModule) {
  const { realm, workspace, initialization, identity, clock, snapshot } = input;
  if (!realm || !workspace?.id || !identity?.workspaceMode || identity.workspaceId !== workspace.id || identity.realm !== realm || !clock || !["empty", "fixture"].includes(initialization?.kind)) throw failure("Invalid HR workspace input");
  if (initialization.kind === "fixture" && !((workspace.id === "ws_orgtik" && initialization.fixtureId === "orgtik-v1") || (workspace.id === "ws_nile" && initialization.fixtureId === "nile-v1"))) throw failure("Unknown HR workspace fixture");
  const ctx = { ...input.services.ctx, identity, workspaceId: workspace.id, realm, workspace, services: input.services, io: null };
  if (ctx.identity !== identity || !ctx.config || !ctx.util) throw failure("Missing HR workspace services");
  L.configureClock(clock);
  const db = initialization.kind === "fixture" && initialization.fixtureId === "orgtik-v1" && !snapshot ? seed.buildDb({ identity, config: ctx.config }) : seed.buildEmptyDb({ config: ctx.config, workspace });
  const checkSnapshot = value => {
    if (!value || value.schema !== SCHEMA || value.version !== 1 || value.realm !== realm || value.workspaceId !== workspace.id || value.appKey !== "hr" || value.fixtureId !== initialization.fixtureId) throw failure("HR snapshot belongs to another runtime");
  };
  if (snapshot) { checkSnapshot(snapshot); seed.importDb(db, snapshot); }
  const state = appModule.createState(ctx, db), router = express.Router();
  let closed = false;
  router.use((req, res, next) => closed ? res.status(503).json({ success: false, code: "workspace_runtime_closed" }) : next());
  router.use((req, res, next) => {
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
    const match = req.path.match(/^\/api\/(departments|meetings|tickets|recruitment\/(?:jobs|applications)|payroll\/(?:runs|items|adjustments))\/([^/]+)/);
    const tables = { departments: "departments", meetings: "meetings", tickets: "tickets", "recruitment/jobs": "jobs", "recruitment/applications": "applications", "payroll/runs": "runs", "payroll/items": "items", "payroll/adjustments": "adjustments" };
    const row = match && db[tables[match[1]]].find(match[2]);
    const owner = row && (row.jobId ? db.jobs.find(row.jobId) : row.runId ? db.runs.find(row.runId) : null);
    return row?.custodyReadOnly || owner?.custodyReadOnly ? res.status(403).json({ success: false, code: "custody_read_only", message: "Archived records require ownership review before changes." }) : next();
  });
  appModule.routes(router, ctx, state);
  const leave = appModule.helpers(ctx, state).leave;
  const open = () => { if (closed) throw failure("HR runtime is closed"); };
  const exportSnapshot = () => { open(); return { schema: SCHEMA, version: 1, realm, workspaceId: workspace.id, appKey: "hr", ...seed.exportDb(db), ...(initialization.fixtureId ? { fixtureId: initialization.fixtureId } : {}) }; };
  function bootstrap(context) {
    open();
    if (context.realm !== realm || context.workspace.id !== workspace.id) throw failure("HR bootstrap context mismatch");
    const user = identity.findUser(context.actor.effectiveUserId), access = context.tools?.hr?.access;
    if (!user || !state.V.rolesOf(user).length || !["free", "trial", "active", "read_only"].includes(access)) return { appKey: "hr", workspaceId: workspace.id, state: "no_access", employees: [], departments: [] };
    const visible = state.V.visibleEmpIds(user), employees = state.V.activeEmps().filter(row => visible === null || visible.has(row.id));
    const departmentIds = new Set(employees.map(row => row.departmentId));
    return { appKey: "hr", workspaceId: workspace.id, state: access === "read_only" ? "read_only" : employees.length ? "ready" : "empty", company: clone(db.settings.companyProfile), employees: employees.map(state.V.empListItem), departments: db.departments.rows.filter(row => !row.deletedAt && (visible === null || departmentIds.has(row.id))).map(row => ({ id: row.id, name: row.name })), capabilities: { canWrite: context.tools.hr.canWrite } };
  }
  function transferOwnership(command) {
    open();
    if (!command.operationId || !Number.isSafeInteger(command.fromUserId) || command.fromUserId < 1 || !["member", "archive"].includes(command.target?.kind)) throw failure("Invalid HR ownership command");
    const target = command.target.kind === "member" ? identity.findUser(command.target.userId) : null;
    if (command.target.kind === "member" && (!target || target.id === command.fromUserId)) throw failure("HR ownership target is not an admitted member");
    db.ownershipTransfers ||= {};
    const fingerprint = JSON.stringify(command), previous = db.ownershipTransfers[command.operationId];
    if (previous) { if (previous.fingerprint !== fingerprint) throw failure("HR ownership operation changed"); return clone(previous.result); }
    const result = { transferred: [], archived: [] }, at = clock.iso(clock.nowMs?.() ?? clock.now());
    const move = (kind, row, field) => {
      if (Number(row[field]) !== command.fromUserId) return;
      row[field] = target?.id ?? null;
      if (!target) { row.ownershipArchivedAt = at; row.custodyReadOnly = true; }
      (target ? result.transferred : result.archived).push(`${kind}:${row.id}`);
    };
    for (const row of db.departments.rows) move("department", row, "managerUserId");
    for (const row of db.employees.rows) move("employee-management", row, "managerId");
    // Creator/approver/payroll/attendance attribution remains historical; add operational ownership.
    for (const kind of ["jobs", "appointments", "meetings", "runs"]) for (const row of db[kind].rows) {
      if (!Object.hasOwn(row, "ownerUserId") && Number(row.createdByUserId ?? row.createdBy) === command.fromUserId) row.ownerUserId = command.fromUserId;
      move(kind, row, "ownerUserId");
    }
    for (const row of db.tickets.rows) if ((row.assignedUserIds || []).includes(command.fromUserId)) {
      row.assignedUserIds = [...new Set(row.assignedUserIds.filter(id => id !== command.fromUserId).concat(target ? [target.id] : []))];
      if (!target) { row.ownershipArchivedAt = at; row.custodyReadOnly = true; }
      (target ? result.transferred : result.archived).push(`ticket:${row.id}`);
    }
    db.ownershipTransfers[command.operationId] = { fingerprint, result: clone(result) };
    return result;
  }
  function applyCommitted(command) {
    open();
    if (command.snapshot) { checkSnapshot(command.snapshot); seed.importDb(db, command.snapshot); state.C.reindex(); return; }
    if (command.kind === "hr.employee.upsert") {
      const employee = clone(command.payload.employee);
      const personId = employee.authUserId ?? employee.id, person = command.payload.person;
      const safePendingPerson = person && Object.keys(person).every(key => ["id", "key", "firstName", "lastName", "email"].includes(key)) && Number.isSafeInteger(person.id) && person.id > 0 && person.id === personId && ["key", "firstName", "lastName", "email"].every(key => typeof person[key] === "string" && person[key].trim());
      // Only an already verified committed effect can name a pending invite recipient. The
      // person's private identity is not inserted into this runtime's active member directory.
      if (!Number.isSafeInteger(employee.id) || employee.id < 1 || employee.id !== personId || !identity.findUser(personId) && !safePendingPerson) throw failure("HR employment requires an admitted person or a safe committed pending-person effect");
      if (safePendingPerson && employee.userKey !== person.key) throw failure("HR employment person key mismatch");
      if (["password", "passwordHash", "accessToken", "refreshToken"].some(key => Object.hasOwn(employee, key))) throw failure("Credentials cannot enter HR employment snapshots");
      const rows = db.employees.rows.filter(row => row.id !== employee.id).concat(employee);
      db.employees.importSnapshot({ rows, nextId: Math.max(db.employees.nextId(), employee.id + 1), idKey: "id" });
      return;
    }
    if (command.kind === "hr.employee.offboard") {
      const employee = db.employees.find(command.payload.employeeId);
      if (!employee) throw failure("HR employee not found");
      employee.status = "offboarded"; employee.isActive = false; employee.offboardedAt = command.payload.effectiveAt;
      return;
    }
    throw failure("Unsupported HR committed command");
  }
  const publicEligibility = input => {open();if(input?.planEligible!==true||!db.settings.careers?.enabled)throw Object.assign(new Error('Careers is not published.'),{status:404,code:'careers_unavailable'});};
  const publicJobs = () => db.jobs.rows.filter(job=>!job.deletedAt&&!job.custodyReadOnly&&job.status==='opened'&&(job.untilClosed||!job.endDate||L.normDate(job.endDate)>=L.todayStr())).map(job=>({id:job.id,title:job.title,jobType:job.jobType,jobMode:job.jobMode,location:job.location,experienceLevel:job.experienceLevel,requiredExperience:job.requiredExperience,aboutCompanyDescription:job.aboutCompanyDescription||'',jobRequirements:job.jobRequirements||'',jobSkills:clone(job.jobSkills||[])}));
  return { router, exportSnapshot, bootstrap,
    publicCareers(eligibility) {publicEligibility(eligibility);return{workspaceId:workspace.id,companyName:db.company.name,acceptingApplications:eligibility.canApply===true,jobs:publicJobs()};},
    applyPublicCareer(input) {publicEligibility(input);if(input.canApply!==true)throw Object.assign(new Error('Applications are temporarily unavailable.'),{status:423,code:'careers_not_accepting'});if(!/^[\w.:-]{8,200}$/.test(input.operationId||''))throw Object.assign(new Error('An application reference is required.'),{status:422,code:'operation_id_required'});const fingerprint=JSON.stringify({jobId:Number(input.jobId),application:input.application}),previous=db.applications.rows.find(row=>row.publicOperationId===input.operationId);if(previous){if(previous.publicFingerprint!==fingerprint)throw Object.assign(new Error('This reference was used for different application data.'),{status:409,code:'operation_conflict'});return{applicationId:previous.id,jobId:previous.jobId,status:'received',submittedAt:previous.appliedAt};}const row=require('../../apps/hr/application').createApplication(appModule.helpers(ctx,state),input.jobId,input.application,{requireOpened:true,strictTextOnly:true});row.publicOperationId=input.operationId;row.publicFingerprint=fingerprint;return{applicationId:row.id,jobId:row.jobId,status:'received',submittedAt:row.appliedAt};},
    suiteExport(context) { const base=bootstrap(context);if(base.state==="no_access")throw Object.assign(new Error("HR access is required."),{status:403,code:"tool_access_required"});const user=identity.findUser(context.actor.effectiveUserId), visible=state.V.visibleEmpIds(user), employees=state.V.activeEmps().filter(row=>visible===null||visible.has(row.id)); return { ...base, employees:employees.map(row=>({...state.V.empDetail(row), workspaceFeatures:clone(row.workspaceFeatures||{})})), settings:state.V.has(user,"hr")?clone(db.settings):{companyProfile:clone(db.settings.companyProfile)}, at:clock.iso(clock.nowMs?.()??clock.now()) }; },
    authorizeLeave(action, payload, actorId) { open(); return leave.authorize(action, payload, actorId); },
    executeLeave(action, payload, actorId) { open(); return leave.execute(action, payload, actorId); },
    leaveDetail(requestId, actorId) { open(); const row = db.timeOffs.find(requestId); if (!row) throw Object.assign(new Error('This leave request was not found.'), { status: 404, code: 'leave_not_found' }); return leave.detail(row, actorId); },
    usage: () => { open(); return [{ key: "employees", used: db.employees.rows.filter(row => !row.deletedAt && row.isActive !== false).length }, { key: "departments", used: db.departments.rows.filter(row => !row.deletedAt).length }, { key: "payroll_runs", used: db.runs.rows.length }]; }, transferOwnership, applyCommitted, close() { closed = true; state.state.nsp = null; } };
}
module.exports = { createWorkspaceRuntime, SCHEMA };
