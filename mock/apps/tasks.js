// Mock backend for task-manager-front-main (app key "tasks", API on config.apps.tasks.api).
// Implements every endpoint the frontend calls (RTK Query slices in redux/features/**, the server-side
// project fetch in the project layout, socket.io namespaces /chat and /notifications) with in-memory CRUD.
const fs = require("fs");
const path = require("path");
const { buildSeed } = require("./tasks/seed");
const filesLib = require("./tasks/files");
const analyticsLib = require("./tasks/analytics");
const commands = require("./tasks/commands");
const fileReferences = require('../lib/workspace-file-references');
const crypto = require('node:crypto');

const SCOPE = "task_manager";
// The shared identity has avatar:null for everyone; generated initials avatars make the boards readable.
// Set to false to return avatar:null like the SOS profile does.
const USE_GENERATED_AVATARS = true;

const DAY = 864e5;
const FLAGS = { BACKLOG: "backlog", TODO: "todo", IN_PROGRESS: "in_progress", IN_REVIEW: "in_review", DONE: "done" };
const STATUS_FLAGS = Object.values(FLAGS);
const DEFAULT_SECTIONS = [
  { title: "BACKLOG", flag: "backlog", color: "#6B7280", order: 1 },
  { title: "TODO", flag: "todo", color: "#3B82F6", order: 2 },
  { title: "IN_PROGRESS", flag: "in_progress", color: "#F59E0B", order: 3 },
  { title: "IN_REVIEW", flag: "in_review", color: "#8B5CF6", order: 4 },
  { title: "DONE", flag: "done", color: "#10B981", order: 5 },
];
const STATUS_LABEL = { backlog: "Backlog", todo: "To Do", in_progress: "In Progress", in_review: "In Review", done: "Done" };
const PRIORITIES = ["low", "medium", "high", "urgent"];
const PRIORITY_WEIGHT = { urgent: 4, high: 3, medium: 2, low: 1 };
const PROJECT_STATUSES = ["todo", "in_progress", "done"];
const REACTIONS = ["like", "love", "laugh", "wow", "sad", "angry", "thumbs_down"];
const VIRTUAL_BASE = 90000; // "My Tasks" groups use section ids 90001..90005 (one per status flag)
const ROLE_DEFS = [
  { id: 1, name: "super_admin", description: "Full access to every project, team and setting." },
  { id: 2, name: "project_manager", description: "Creates projects, manages sections, members and deadlines." },
  { id: 3, name: "developer", description: "Works on assigned tasks, subtasks and comments." },
  { id: 4, name: "viewer", description: "Read-only access to projects, boards and teams." },
];

// Runtime state (filled in routes()).
let db = null;
let v3 = null;
let ctx = null;
let identity = null;
let util = null;
let files = null;
let analytics = null;
const io = { notifications: null, chat: null };
const online = new Map(); // userId -> number of open /chat sockets

// ---------------------------------------------------------------- helpers
const nowIso = () => new Date().toISOString();
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };
const clean = (v) => (v === undefined || v === null || v === "undefined" || v === "null" ? "" : String(v).trim());
const ymd = analyticsLib.ymd;
const startOfDay = analyticsLib.startOfDay;
const byOrder = (a, b) => a.order - b.order || a.id - b.id;
const ok = (res, data, message = "Success", status = 200) => util.ok(res, data, message, status);
const fail = (res, status, message) => util.fail(res, status, message, { error: message });

function toIds(v) {
  if (v === undefined || v === null || v === "") return [];
  if (Array.isArray(v)) return [...new Set(v.flatMap(toIds))];
  if (typeof v === "number") return Number.isFinite(v) ? [v] : [];
  if (typeof v === "object") return toIds(Object.values(v));
  const s = String(v).trim();
  if (s.startsWith("[")) { try { return toIds(JSON.parse(s)); } catch { /* fall through */ } }
  return [...new Set(s.split(",").map((x) => Number(x.trim())).filter((n) => Number.isFinite(n) && n > 0))];
}
const idsFrom = (body, key) => toIds(body?.[key] ?? body?.[`${key}[]`]);
function toIso(v) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
// multer (busboy) decodes filenames as latin1; recover UTF-8 names such as Arabic file names.
function fixName(name) {
  if (!name || !/[\u0080-ÿ]/.test(name)) return name;
  const decoded = Buffer.from(name, "latin1").toString("utf8");
  return decoded.includes("�") ? name : decoded;
}

// ---------------------------------------------------------------- lookups
const userById = (id) => identity.findUser(id);
const projectById = (id) => db.projects.find((p) => p.id === Number(id));
const sectionById = (id) => db.sections.find((s) => s.id === Number(id));
const taskById = (id) => db.tasks.find((t) => t.id === Number(id));
const teamById = (id) => db.teams.find((t) => t.id === Number(id));
const commentById = (id) => db.comments.find((c) => c.id === Number(id));
const subtasksOf = (taskId) => db.subtasks.filter((s) => s.taskId === taskId).sort(byOrder);
const commentsOf = (taskId) => db.comments.filter((c) => c.taskId === taskId);
const taskAttachments = (taskId) => db.attachments.filter((a) => a.taskId === taskId);
const sectionsOf = (projectId) => db.sections.filter((s) => s.projectId === projectId).sort(byOrder);
const boardSections = (projectId) => sectionsOf(projectId).filter((s) => s.flag !== "archive");
const archiveSection = (projectId) => db.sections.find((s) => s.projectId === projectId && s.flag === "archive");
const isArchived = (t) => sectionById(t.sectionId)?.flag === "archive";
const tasksInSection = (sectionId) => db.tasks.filter((t) => t.sectionId === sectionId).sort(byOrder);
const activeTasks = (projectId) => db.tasks.filter((t) => t.projectId === projectId && !isArchived(t));

function tmRoles(u) {
  if (!u) return [];
  if (identity.workspaceMode) return identity.userScopes(u).find(scope => scope.scope === SCOPE)?.roles || [];
  const r = new Set(identity.grants[SCOPE]?.[u.key]?.roles || []);
  return [...r];
}
const isAdmin = (u) => tmRoles(u).includes("super_admin");
const isPM = (u) => tmRoles(u).some((r) => r === "super_admin" || r === "project_manager");
const isViewerOnly = (u) => { const r = tmRoles(u); return r.length === 0 || r.every((x) => x === "viewer"); };
const hasAccess = (u) => tmRoles(u).length > 0;
const teamMemberIds = (teamId) => teamById(teamId)?.memberIds || [];
function isProjectMember(p, u) {
  if (!u) return false;
  return p.memberIds.includes(u.id) || p.teamIds.some((tid) => teamMemberIds(tid).includes(u.id));
}
function canSeeProject(p, u) {
  if (!p) return false;
  if (!u) return true; // server-side fetch from the Next.js project layout (sends no token)
  if (isAdmin(u) || isProjectMember(p, u)) return true;
  if (p.isPrivate || u.userType === "customer") return false;
  return hasAccess(u);
}
const visibleProjects = (u) => db.projects.filter((p) => canSeeProject(p, u));
// Client accounts (userType "customer") only see the teams and people on their own projects.
const isClient = (u) => u?.userType === "customer" && !isAdmin(u);
const visibleTeamIds = (u) => new Set(visibleProjects(u).flatMap((p) => p.teamIds));
const visiblePeopleIds = (u) => new Set(visibleProjects(u).flatMap((p) => [...p.memberIds, ...p.teamIds.flatMap(teamMemberIds)]));
function isAssignee(t, u) {
  return t.assignments.some((a) => (a.assigneeType === "user" && a.assigneeId === u.id) || (a.assigneeType === "team" && teamMemberIds(a.assigneeId).includes(u.id)));
}
const myTasks = (u) => db.tasks.filter((t) => !isArchived(t) && isAssignee(t, u) && canSeeProject(projectById(t.projectId), u));
const userTasks = (target, viewer) => db.tasks.filter((t) => !isArchived(t) && isAssignee(t, target) && canSeeProject(projectById(t.projectId), viewer));

// ---------------------------------------------------------------- serializers
const avatarOf = (u) => (u ? u.avatar || (USE_GENERATED_AVATARS ? ctx.fileUrl(files.avatarFile(u.id)) : null) : null);
const teamImageOf = (t) => (t.teamImage ? (/^https?:/.test(t.teamImage) ? t.teamImage : ctx.fileUrl(t.teamImage)) : null);
const fullName = (u) => (u ? `${u.firstName} ${u.lastName}` : "Unknown user");
const slimUser = (u) => u && { id: u.id, email: u.email, firstName: u.firstName, lastName: u.lastName, avatar: avatarOf(u) };
const byUser = (u) => u && { id: u.id, email: u.email, firstName: u.firstName, lastName: u.lastName };
const roleObjects = (u) => tmRoles(u).map((name) => ROLE_DEFS.find((r) => r.name === name)).filter(Boolean).map((r) => ({ ...r, isActive: true }));
function managerOf(u) {
  const m = u.managerId ? userById(u.managerId) : null;
  if (!m) return null;
  const { password, key, ...rest } = m;
  return { id: m.id, avatar: avatarOf(m), email: m.email, firstName: m.firstName, lastName: m.lastName, isActive: m.isActive, isEmailVerified: m.isEmailVerified, managerId: m.managerId, username: m.username, createdAt: m.createdAt, updatedAt: m.updatedAt, jobTitle: rest.profile?.jobTitle || null };
}
function fullUser(u) {
  if (!u) return null;
  const base = identity.publicUser(u);
  return {
    ...base, avatar: avatarOf(u), roles: roleObjects(u), manager: managerOf(u),
    subordinates: identity.users.filter((x) => x.managerId === u.id && hasAccess(x)).map(slimUser),
    scopes: identity.userScopes(u).map((s) => ({ scope: s.scope, roles: s.roles })),
    createdAtTimeAgo: util.timeAgo(u.createdAt), updatedAtTimeAgo: util.timeAgo(u.updatedAt),
  };
}
function teamMemberOut(u) {
  const m = u.managerId ? userById(u.managerId) : null;
  return {
    id: u.id, username: u.username, email: u.email, firstName: u.firstName, lastName: u.lastName, avatar: avatarOf(u),
    isActive: u.isActive, isEmailVerified: u.isEmailVerified, managerId: u.managerId,
    profile: { id: u.profile.id, jobTitle: u.profile.jobTitle, department: u.profile.department, about: u.profile.about, language: u.profile.language },
    manager: m ? { firstName: m.firstName, lastName: m.lastName, avatar: avatarOf(m) } : null,
    subordinates: [], roles: roleObjects(u), createdAt: u.createdAt, updatedAt: u.updatedAt,
  };
}
function assigneeOut(a) {
  if (a.assigneeType === "team") {
    const t = teamById(a.assigneeId);
    return { id: a.assigneeId, firstName: t?.name || "Team", lastName: "", name: t?.name || "Team", email: null, avatar: t ? teamImageOf(t) : null, type: "team" };
  }
  const u = userById(a.assigneeId);
  return { id: a.assigneeId, firstName: u?.firstName || "Unknown", lastName: u?.lastName || "", name: fullName(u), email: u?.email || null, avatar: avatarOf(u), type: "user" };
}
const assignmentOut = (a) => ({ id: a.id, assigneeType: a.assigneeType, assigneeId: a.assigneeId, assignee: assigneeOut(a), assignedBy: byUser(userById(a.assignedById)), assignedAt: a.assignedAt });
function attachmentOut(a) {
  if (a.reference) {
    if (!ctx.sharedFiles?.project) throw Object.assign(new Error('Files could not be loaded.'), { status: 503, code: 'files_unavailable' });
    const projection = ctx.sharedFiles.project(a.reference), available = projection.state === 'available', file = projection.file;
    return { id: a.id, reference: a.reference, state: projection.state, fileUrl: null, originalName: available ? file.name : '', mimetype: available ? file.mimetype : 'application/octet-stream', size: available ? file.size : 0, createdAt: a.createdAt, ...(available ? { version: file.version, contentPath: fileReferences.contentPath(a.reference, { type: 'task', id: a.taskId }, a.id) } : {}) };
  }
  return { id: a.id, fileUrl: /^https?:/.test(a.filename) ? a.filename : ctx.fileUrl(a.filename), filename: a.filename, originalName: a.originalName, mimetype: a.mimetype, size: a.size, createdAt: a.createdAt, uploadedBy: byUser(userById(a.uploadedById)) };
}
function authorizeSharedTarget({ actorId, type, id, write = false, referenceId, reference }) {
  const user = userById(actorId), task = type === 'task' && taskById(id);
  if (!user || user.isActive === false || !hasAccess(user) || !task || !canSeeProject(projectById(task.projectId), user)) throw Object.assign(new Error('This task was not found.'), { status: 404, code: 'task_not_found' });
  if (write && (isViewerOnly(user) || !identity.canWrite(user))) throw Object.assign(new Error('This task is read-only.'), { status: isViewerOnly(user) ? 403 : 423, code: 'task_read_only' });
  if (write && (task.custodyReadOnly || projectById(task.projectId)?.custodyReadOnly)) throw Object.assign(new Error('This task awaits ownership review.'), { status: 423, code: 'task_read_only' });
  if (reference && !taskAttachments(task.id).some(row => String(row.id) === String(referenceId) && fileReferences.sameReference(row.reference, reference))) throw Object.assign(new Error('This file reference was not found.'), { status: 404, code: 'reference_not_found' });
  return task;
}
function fileOperation(task, user, key, body, apply) {
  if (typeof key !== 'string' || !/^[\w.:-]{1,200}$/.test(key)) throw Object.assign(new Error('Supply the original file action reference.'), { status: 422, code: 'operation_id_required' });
  const fingerprint = crypto.createHash('sha256').update(JSON.stringify(body)).digest('hex'), receiptKey = `${user.id}:${key}`;
  task.fileReferenceOperations ??= {};
  const prior = task.fileReferenceOperations[receiptKey];
  if (prior) {
    if (prior.fingerprint !== fingerprint) throw Object.assign(new Error('This reference was used for another file change.'), { status: 409, code: 'operation_conflict' });
    return prior.ids.map(id => db.attachments.find(row => row.id === id)).filter(Boolean).map(attachmentOut);
  }
  if (Object.keys(task.fileReferenceOperations).length >= 1000) throw Object.assign(new Error('This task has reached its file action limit.'), { status: 422, code: 'file_action_limit' });
  const rows = apply(); task.fileReferenceOperations[receiptKey] = { fingerprint, ids: rows.map(row => row.id) };
  return rows.map(attachmentOut);
}
function taskProgress(t) {
  if (t.status === "done") return 100;
  const subs = subtasksOf(t.id);
  if (subs.length) return Math.round((subs.filter((s) => s.isCompleted).length / subs.length) * 100);
  if (t.baseProgress != null) return t.baseProgress;
  return { backlog: 0, todo: 0, in_progress: 40, in_review: 80 }[t.status] ?? 0;
}
const canComplete = (t) => t.dependsOn.every((id) => { const d = taskById(id); return !d || d.status === "done"; });
const depOut = (t) => ({ id: t.id, title: t.title, status: t.status, priority: t.priority, dueDate: t.dueDate, projectId: t.projectId });

// Board card (spec/spec-data-kanban-board-api-response.md): slim fields only.
function boardTask(t) {
  return {
    id: t.id, columnId: t.sectionId, order: t.order, title: t.title, description: t.description ?? null, priority: t.priority,
    dueDate: t.dueDate, attachmentsCount: taskAttachments(t.id).length, commentsCount: commentsOf(t.id).length,
    ...(v3 ? v3.metadata(t) : {}),
    assignments: t.assignments.map((a) => ({ assignee: assigneeOut(a) })),
  };
}
// Task inside nested project/section payloads (lists, calendars, my tasks).
function richTask(t) {
  const p = projectById(t.projectId);
  const out = {
    ...boardTask(t), status: t.status, progress: taskProgress(t), startDate: t.startDate,
    subtasksCount: subtasksOf(t.id).length, assignmentsCount: t.assignments.length, canComplete: canComplete(t),
    createdAt: t.createdAt, updatedAt: t.updatedAt, completedAt: t.completedAt,
    members: t.assignments.filter((a) => a.assigneeType === "user").map((a) => slimUser(userById(a.assigneeId))).filter(Boolean),
    assignments: t.assignments.map(assignmentOut),
    project: { id: p.id, name: p.title, title: p.title },
    projectId: p.id, sectionId: t.sectionId, createdBy: byUser(userById(t.createdById)),
  };
  if (t.startTime) out.startTime = t.startTime;
  if (t.endTime) out.endTime = t.endTime;
  return out;
}
const subtaskOut = (s) => ({ id: s.id, title: s.title, isCompleted: s.isCompleted, order: s.order, createdBy: byUser(userById(s.createdById)), createdAt: s.createdAt, updatedAt: s.updatedAt });
function fullTask(t) {
  const sec = sectionById(t.sectionId);
  const p = projectById(t.projectId);
  const deps = t.dependsOn.map(taskById).filter(Boolean);
  const blocks = db.tasks.filter((x) => x.dependsOn.includes(t.id));
  const out = {
    id: t.id, title: t.title, description: t.description ?? "", priority: t.priority, status: t.status, order: t.order,
    ...(v3 ? v3.metadata(t) : {}),
    progress: taskProgress(t), dueDate: t.dueDate, startDate: t.startDate, sectionId: t.sectionId, projectId: t.projectId,
    members: t.assignments.filter((a) => a.assigneeType === "user").map((a) => slimUser(userById(a.assigneeId))).filter(Boolean),
    createdBy: byUser(userById(t.createdById)),
    subtasksCount: subtasksOf(t.id).length, commentsCount: commentsOf(t.id).length, attachmentsCount: taskAttachments(t.id).length,
    assignmentsCount: t.assignments.length, canComplete: canComplete(t), createdAt: t.createdAt, updatedAt: t.updatedAt, completedAt: t.completedAt,
    subtasks: subtasksOf(t.id).map(subtaskOut),
    assignments: t.assignments.map(assignmentOut),
    dependencies: { dependsOn: deps.map(depOut), blocks: blocks.map(depOut), canComplete: canComplete(t) },
    attachments: taskAttachments(t.id).map(attachmentOut),
    section: { id: sec.id, title: sec.title, color: sec.color, flag: sec.flag },
    project: { id: p.id, title: p.title },
  };
  if (t.startTime) out.startTime = t.startTime;
  if (t.endTime) out.endTime = t.endTime;
  return out;
}
function activityTaskOut(t) {
  const p = projectById(t.projectId);
  return {
    id: t.id, title: t.title, description: t.description ?? "", priority: t.priority, status: t.status, progress: String(taskProgress(t)),
    dueDate: t.dueDate, startDate: t.startDate, createdBy: byUser(userById(t.createdById)),
    subtasksCount: subtasksOf(t.id).length, commentsCount: commentsOf(t.id).length, attachmentsCount: taskAttachments(t.id).length,
    assignmentsCount: t.assignments.length, canComplete: canComplete(t), createdAt: t.createdAt, updatedAt: t.updatedAt,
    project: { id: p.id, title: p.title, description: p.description },
  };
}
const teamMini = (t) => ({ id: t.id, name: t.name, description: t.description, teamImage: teamImageOf(t) });
function projectCard(p) {
  const tasks = activeTasks(p.id);
  const done = tasks.filter((t) => t.status === "done").length;
  const pct = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
  const taskIds = new Set(tasks.map((t) => t.id));
  const commentIds = new Set(db.comments.filter((c) => taskIds.has(c.taskId)).map((c) => c.id));
  return {
    id: p.id, title: p.title, description: p.description, priority: p.priority, status: p.status, isPrivate: p.isPrivate, archivedAt: p.archivedAt || null,
    teams: p.teamIds.map(teamById).filter(Boolean).map(teamMini),
    members: p.memberIds.map(userById).filter(Boolean).map(slimUser),
    // A number: the HR dashboard's Projects page renders project.progress directly (the task-manager UI uses completedTasksPercentage).
    progress: pct, progressText: `${done}/${tasks.length} tasks completed`,
    totalAttachmentsCount: db.attachments.filter((a) => taskIds.has(a.taskId) || commentIds.has(a.commentId)).length,
    totalCommentsCount: commentIds.size, completedTasksPercentage: pct, tasksCount: tasks.length, completedTasksCount: done,
    sectionsCount: boardSections(p.id).length, createdBy: byUser(userById(p.createdById)), createdAt: p.createdAt, updatedAt: p.updatedAt,
  };
}
const columnOut = (s) => ({ id: s.id, title: s.title, color: s.color, order: s.order, flag: s.flag });
function sectionDetails(s, tasks, p) {
  const done = tasks.filter((t) => t.status === "done").length;
  return {
    project: { id: p.id, title: p.title }, section: columnOut(s), tasks: tasks.map(richTask), tasksCount: tasks.length, completedTasksCount: done,
    progressPercentage: tasks.length ? Math.round(tasks.reduce((n, t) => n + taskProgress(t), 0) / tasks.length) : 0,
  };
}
const matches = (t, q) => !q || `${t.title} ${t.description || ""}`.toLowerCase().includes(q.toLowerCase());
function projectDetails(p, search) {
  return { ...projectCard(p), sections: boardSections(p.id).map((s) => sectionDetails(s, tasksInSection(s.id).filter((t) => matches(t, search)), p)) };
}
function teamOut(t) {
  return {
    id: t.id, name: t.name, description: t.description, alias: t.alias, teamImage: teamImageOf(t), isActive: t.isActive,
    createdAt: t.createdAt, createdAtTimeAgo: util.timeAgo(t.createdAt), updatedAt: t.updatedAt, updatedAtTimeAgo: util.timeAgo(t.updatedAt),
    members: t.memberIds.map(userById).filter(Boolean).map(slimUser), memberCount: t.memberIds.length,
    teamIds: [], projectIds: db.projects.filter((p) => p.teamIds.includes(t.id)).map((p) => p.id),
  };
}
const bookmarkOut = (b) => ({ id: b.id, title: b.title, description: b.description, link: b.link, attachmentCount: b.attachmentCount + b.attachments.length, attachments: b.attachments.map(attachmentOut), teamId: b.teamId, createdAt: b.createdAt, updatedAt: b.updatedAt });
function commentOut(c) {
  const a = userById(c.authorId);
  return {
    id: c.id, content: c.content, taskId: c.taskId, parentCommentId: c.parentCommentId,
    author: { id: c.authorId, firstName: a?.firstName || "Unknown", lastName: a?.lastName || "User", email: a?.email || "", avatar: avatarOf(a) },
    reactions: c.reactions.filter((r) => r.userIds.length).map((r) => ({ reaction: r.reaction, count: r.userIds.length, users: r.userIds.map(userById).filter(Boolean).map((u) => ({ id: u.id, firstName: u.firstName, lastName: u.lastName })) })),
    replies: db.comments.filter((x) => x.parentCommentId === c.id).sort((x, y) => new Date(x.createdAt) - new Date(y.createdAt)).map(commentOut),
    attachments: db.attachments.filter((x) => x.commentId === c.id).map(attachmentOut),
    createdAt: c.createdAt, updatedAt: c.updatedAt,
  };
}
function activityOut(a) {
  const u = userById(a.userId);
  return { id: a.id, action: a.action, details: a.details, oldValue: a.oldValue, newValue: a.newValue, user: u ? { ...identity.publicUser(u), avatar: avatarOf(u) } : null, createdAt: a.createdAt };
}
function notificationOut(n, forLatest = false) {
  const actor = n.actorId ? userById(n.actorId) : null;
  const status = n.clearedAt ? "cleared" : n.readAt ? "read" : "unread";
  return {
    id: n.id, type: n.type, group: n.group, priority: n.priority,
    // the header dropdown's "Mentions" tab filters on status === "mentions"
    status: forLatest && n.group === "mentions" && !n.clearedAt ? "mentions" : status,
    title: n.title, message: n.message, data: n.data || {}, actor: actor ? slimUser(actor) : null,
    readAt: n.readAt, clearedAt: n.clearedAt, createdAt: n.createdAt, updatedAt: n.updatedAt,
  };
}

// ---------------------------------------------------------------- mutations shared by routes
function logActivity(task, action, userId, details = {}, oldValue = null, newValue = null) {
  const row = { id: db.nextId("activity"), taskId: task.id, action, details: { taskTitle: task.title, ...details }, oldValue, newValue, userId, createdAt: nowIso() };
  db.activities.push(row);
  return row;
}
function touchTask(task) {
  task.updatedAt = nowIso();
  const p = projectById(task.projectId);
  if (p) p.updatedAt = task.updatedAt;
}
function pushNotification(userId, n) {
  if (!userId || !userById(userId)) return null;
  const row = { id: db.nextId("notification"), userId, priority: "normal", readAt: null, clearedAt: null, data: {}, createdAt: nowIso(), ...n };
  row.updatedAt = row.createdAt;
  db.notifications.push(row);
  if (io.notifications) {
    const payload = notificationOut(row, true);
    io.notifications.to(`user:${userId}`).emit("notification", payload);
    io.notifications.to(`user:${userId}`).emit("newNotification", payload);
  }
  return row;
}
const taskNotifData = (t) => { const p = projectById(t.projectId); return { taskId: t.id, projectId: p.id, taskTitle: t.title, projectTitle: p.title }; };
function notifyAssigned(task, userIds, actor) {
  for (const uid of userIds) {
    if (uid === actor.id) continue;
    pushNotification(uid, { type: "task_assigned", group: "assigned", priority: task.priority === "urgent" ? "high" : "normal", title: "New task assigned", message: `${fullName(actor)} assigned you to "${task.title}"`, actorId: actor.id, data: taskNotifData(task) });
  }
}
function notifyMentions(task, comment, actor) {
  const ids = [...new Set([...String(comment.content || "").matchAll(/@\[(\d+)\]/g)].map((m) => Number(m[1])))];
  for (const uid of ids) {
    if (uid === actor.id) continue;
    pushNotification(uid, { type: "comment_mention", group: "mentions", title: "You were mentioned", message: `${fullName(actor)} mentioned you in "${task.title}"`, actorId: actor.id, data: { ...taskNotifData(task), commentId: comment.id, messageContent: comment.content.replace(/@\[(\d+)\]/g, (m, id) => `@${fullName(userById(Number(id)))}`) } });
  }
  return ids;
}
function setStatus(task, status, actor) {
  if (!STATUS_FLAGS.includes(status) || task.status === status) return false;
  if (status === 'done' && !canComplete(task)) throw Object.assign(new Error('Complete this task’s dependencies first.'), { status: 409, code: 'dependency_blocked' });
  const old = task.status;
  task.status = status;
  if (status === "done") task.completedAt = nowIso();
  else if (old === "done") task.completedAt = null;
  logActivity(task, "status_changed", actor.id, {}, STATUS_LABEL[old] || old, STATUS_LABEL[status] || status);
  const watchers = new Set([task.createdById, ...(task.watcherIds || []), ...task.assignments.filter((a) => a.assigneeType === "user").map((a) => a.assigneeId)]);
  for (const uid of watchers) {
    if (uid === actor.id) continue;
    pushNotification(uid, { type: "task_status_changed", group: "all", title: "Task status updated", message: `${fullName(actor)} moved "${task.title}" to ${STATUS_LABEL[status]}`, actorId: actor.id, data: { ...taskNotifData(task), status } });
  }
  if (status === 'done') v3?.complete(task, actor);
  return true;
}
function renumber(sectionId) {
  tasksInSection(sectionId).forEach((t, i) => { t.order = i + 1; });
}
// Moves a task to a (real) section at a 1-based position; keeps status in sync with the section flag.
function placeTask(task, section, order, actor) {
  if (section.flag === 'done' && !canComplete(task)) throw Object.assign(new Error('Complete this task’s dependencies first.'), { status: 409, code: 'dependency_blocked' });
  const from = sectionById(task.sectionId);
  const others = tasksInSection(section.id).filter((t) => t.id !== task.id);
  const pos = Math.max(0, Math.min((num(order) || others.length + 1) - 1, others.length));
  others.splice(pos, 0, task);
  task.sectionId = section.id;
  others.forEach((t, i) => { t.order = i + 1; });
  if (from && from.id !== section.id) renumber(from.id);
  if (from && from.id !== section.id) {
    if (section.flag === "archive") logActivity(task, "archived", actor.id, {}, from.title, section.title);
    else if (STATUS_FLAGS.includes(section.flag) && section.flag !== task.status) setStatus(task, section.flag, actor);
    else logActivity(task, "moved", actor.id, {}, from.title, section.title);
  }
  touchTask(task);
}
function sectionForStatus(projectId, status) {
  return boardSections(projectId).find((s) => s.flag === status) || null;
}
function removeTask(task) {
  const ids = new Set([task.id]);
  const commentIds = new Set(db.comments.filter((c) => ids.has(c.taskId)).map((c) => c.id));
  db.tasks = db.tasks.filter((t) => !ids.has(t.id));
  db.subtasks = db.subtasks.filter((s) => !ids.has(s.taskId));
  db.comments = db.comments.filter((c) => !ids.has(c.taskId));
  db.attachments = db.attachments.filter((a) => !ids.has(a.taskId) && !commentIds.has(a.commentId));
  db.activities = db.activities.filter((a) => !ids.has(a.taskId));
  for (const t of db.tasks) t.dependsOn = t.dependsOn.filter((d) => !ids.has(d));
  db.notifications = db.notifications.filter((n) => !ids.has(Number(n.data?.taskId)));
  renumber(task.sectionId);
}
function saveFiles(req, owner, uploaderId, fields) {
  const list = (req.files || []).filter((f) => !fields || fields.includes(f.fieldname));
  return list.map((f) => {
    const row = { id: db.nextId("attachment"), taskId: owner.taskId || null, commentId: owner.commentId || null, bookmarkId: owner.bookmarkId || null, filename: f.filename, originalName: fixName(f.originalname), mimetype: f.mimetype || "application/octet-stream", size: f.size, uploadedById: uploaderId, createdAt: nowIso() };
    if (!owner.bookmarkId) db.attachments.push(row);
    return row;
  });
}

// "My Tasks" groups: one virtual section per status flag across all of the user's projects.
function mySections(u) {
  const tasks = myTasks(u);
  const order = db.myOrder[u.id] || {};
  return DEFAULT_SECTIONS.map((d, i) => {
    const id = VIRTUAL_BASE + i + 1;
    const list = tasks.filter((t) => t.status === d.flag).sort((a, b) => (order[a.id] ?? 1e9) - (order[b.id] ?? 1e9) || new Date(a.dueDate) - new Date(b.dueDate));
    const done = list.filter((t) => t.status === "done").length;
    return {
      project: { id: 0, title: "My Tasks" }, section: { id, title: d.title, color: d.color, flag: d.flag, order: d.order },
      tasks: list.map((t) => ({ ...richTask(t), columnId: id })), tasksCount: list.length, completedTasksCount: done,
      progressPercentage: list.length ? Math.round(list.reduce((n, t) => n + taskProgress(t), 0) / list.length) : 0,
    };
  });
}
const virtualFlag = (sectionId) => { const i = Number(sectionId) - VIRTUAL_BASE - 1; return i >= 0 && i < DEFAULT_SECTIONS.length ? DEFAULT_SECTIONS[i].flag : null; };

function groupByDay(tasks, dateKey = "updatedAt") {
  const out = {};
  for (const t of tasks) (out[ymd(new Date(t[dateKey]).getTime())] = out[ymd(new Date(t[dateKey]).getTime())] || []).push(activityTaskOut(t));
  return out;
}
function durationFilter(duration) {
  const now = Date.now();
  const since = { "1d": startOfDay(now), "7d": now - 7 * DAY, "1m": now - 30 * DAY, "1y": now - 365 * DAY }[clean(duration)];
  return (t) => !since || new Date(t.updatedAt).getTime() >= since;
}

// ---------------------------------------------------------------- guards
function me(req, res) { return identity.requireUser(req, res); }
function guard(res, allowed, message = "You don't have permission to perform this action") {
  if (!allowed) fail(res, 403, message);
  return allowed;
}
function loadProject(req, res, u, id = req.params.id) {
  const p = projectById(id);
  if (!p) { fail(res, 404, "Project not found"); return null; }
  if (!canSeeProject(p, u)) { fail(res, 403, "You don't have access to this project"); return null; }
  if (!['GET', 'HEAD'].includes(req.method) && p.custodyReadOnly) { fail(res, 423, "This project awaits ownership review."); return null; }
  return p;
}
function loadTask(req, res, u, id = req.params.id) {
  const t = taskById(id);
  if (!t) { fail(res, 404, "Task not found"); return null; }
  if (!canSeeProject(projectById(t.projectId), u)) { fail(res, 403, "You don't have access to this task"); return null; }
  if (!['GET', 'HEAD'].includes(req.method) && (t.custodyReadOnly || projectById(t.projectId)?.custodyReadOnly)) { fail(res, 423, "This task awaits ownership review."); return null; }
  return t;
}

// ================================================================= routes
function routes(app, context, options = {}) {
  ctx = context;
  identity = ctx.identity;
  util = ctx.util;
  files = filesLib.prepare(ctx.uploadsDir, identity.users, { samples: !options.empty });
  db = options.state || buildSeed({ files, identity, empty: Boolean(options.empty), seedAt: options.seedAt });
  if (options.fixtureId === "nile-v1") db = require("./tasks/runtime-state").nileFixture(db, identity);
  if (!options.empty) files.writeTeamLogos(db.teams);
  analytics = analyticsLib.create({ db, util, visibleProjects, activeTasks, myTasks, isProjectMember, taskById, projectById, sectionById, userById, commentsOf, avatarOf, taskProgress });
  const upload = ctx.upload.any();
  ctx.log(`seeded ${db.projects.length} projects, ${db.tasks.length} tasks, ${db.comments.length} comments, ${db.notifications.length} notifications`);
  if (identity.workspaceMode) app.use((req, res, next) => {
    const ownProfile = req.method === 'PUT' && req.path === '/api/auth/profile' || req.method === 'DELETE' && req.path === '/api/auth/avatar';
    if (!['GET', 'HEAD'].includes(req.method)) {
      const user = me(req, res); if (!user) return;
      if (!ownProfile && isViewerOnly(user)) return fail(res, 403, "This Tasks role is read-only.");
      if (!ownProfile && typeof identity.canWrite === 'function' && !identity.canWrite(user)) return fail(res, 423, "This Tasks workspace is read-only.");
    }
    if (req.method === 'POST' && req.path === '/api/auth/avatar') return fail(res, 501, 'sample_assets_only');
    if (!['GET', 'HEAD'].includes(req.method) && /^\/api\/auth\//.test(req.path) && !ownProfile) return fail(res, 501, 'workspace_command_required');
    if (!['GET', 'HEAD'].includes(req.method)) {
      const match = /^\/api\/(bookmarks|teams|projects|tasks)\/(\d+)(?:\/|$)/.exec(req.path);
      const record = match && db[match[1]].find(row => row.id === Number(match[2]));
      if (record?.custodyReadOnly) return fail(res, 423, "This record awaits ownership review.");
      const project = record && (match[1] === 'projects' ? record : match[1] === 'tasks' ? projectById(record.projectId) : null);
      const section = /^\/api\/tasks\/sections\/(\d+)/.exec(req.path);
      const sectionProject = section && projectById(sectionById(section[1])?.projectId);
      if ((project?.archivedAt || sectionProject?.archivedAt) && !/^\/api\/projects\/\d+\/restore$/.test(req.path)) return fail(res, 423, 'Restore this project before making changes.');
    }
    return next();
  });

  v3 = require('./tasks/v3').create({ getDb: () => db, identity, nowIso, canSeeProject, isPM, isViewerOnly, sectionForStatus, richTask, fullTask, projectCard, placeTask, setStatus, canComplete, logActivity, pushNotification, taskNotifData, me, ok, DEFAULT_SECTIONS });
  v3.routes(app);
  // ------------------------------------------------ projects
  app.get("/api/projects", (req, res) => {
    const u = me(req, res); if (!u) return;
    // Users outside the task_manager scope (e.g. HR/finance calling from the HR dashboard's Projects page)
    // get a read-only list of the non-private projects; every detail endpoint stays restricted.
    let list = (hasAccess(u) ? visibleProjects(u) : db.projects.filter((p) => !p.isPrivate)).filter(project => req.query.archived === 'true' ? Boolean(project.archivedAt) : !project.archivedAt);
    const status = clean(req.query.status);
    if (status) list = list.filter((p) => p.status === status);
    list = util.search(list, clean(req.query.search), ["title", "description"]);
    list = [...list].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    const { items, meta } = util.paginate(list, req.query, { defaultLimit: 9 });
    return ok(res, { items: items.map(projectCard), meta }, "Projects fetched successfully");
  });

  app.get("/api/projects/list/important", (req, res) => {
    const u = me(req, res); if (!u) return;
    const list = visibleProjects(u).filter((p) => p.status !== "done")
      .sort((a, b) => PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority] || new Date(b.updatedAt) - new Date(a.updatedAt))
      .slice(0, 5).map((p) => ({ id: p.id, title: p.title, priority: p.priority }));
    return ok(res, list, "Important projects fetched successfully");
  });

  app.get("/api/projects/section-flags", (req, res) => {
    const u = me(req, res); if (!u) return;
    return ok(res, { flags: { ...FLAGS }, defaultSections: DEFAULT_SECTIONS.map((s) => ({ ...s })) }, "Section flags fetched successfully");
  });

  app.post("/api/projects", (req, res) => {
    const u = me(req, res); if (!u) return;
    if (!guard(res, isPM(u), "Only project managers can create projects")) return;
    const b = req.body || {};
    const title = clean(b.title);
    if (title.length < 2) return fail(res, 400, "Project title is required");
    const id = db.nextId("project");
    const created = nowIso();
    const memberIds = [...new Set([u.id, ...toIds(b.memberIds)])].filter((x) => userById(x));
    const teamIds = toIds(b.teamIds).filter((x) => teamById(x));
    const project = {
      id, title, description: clean(b.description), priority: PRIORITIES.includes(b.priority) ? b.priority : "medium",
      status: PROJECT_STATUSES.includes(b.status) ? b.status : "todo", isPrivate: b.isPrivate === true || b.isPrivate === "true",
      memberIds, teamIds, createdById: u.id, createdAt: created, updatedAt: created,
    };
    db.projects.push(project);
    const custom = Array.isArray(b.customSections) && b.customSections.length ? b.customSections : DEFAULT_SECTIONS;
    custom.map((s, i) => ({ s, i })).sort((a, c) => (num(a.s.order) ?? a.i) - (num(c.s.order) ?? c.i)).forEach(({ s }, i) => {
      db.sections.push({ id: db.nextId("section"), projectId: id, title: clean(s.title) || `SECTION_${i + 1}`, color: clean(s.color) || "#9CA3AF", flag: clean(s.flag) || "todo", order: i + 1, createdAt: created, updatedAt: created });
    });
    db.sections.push({ id: db.nextId("section"), projectId: id, title: "ARCHIVE", color: "#9CA3AF", flag: "archive", order: 99, createdAt: created, updatedAt: created });
    for (const uid of memberIds) if (uid !== u.id) pushNotification(uid, { type: "project_member_added", group: "all", title: "Added to project", message: `${fullName(u)} added you to "${title}"`, actorId: u.id, data: { projectId: id, projectTitle: title } });
    return ok(res, projectCard(project), "Project created successfully", 201);
  });

  // Project details. Also called server-side by the Next.js project layout without a token.
  app.get("/api/projects/:id", (req, res) => {
    if (identity.workspaceMode) {
      const u = me(req, res); if (!u) return;
      const p = loadProject(req, res, u); if (!p) return;
      return ok(res, projectDetails(p, clean(req.query.search)), "Project fetched successfully");
    }
    const token = identity.tokenFrom(req);
    const u = token ? identity.userFromToken(token) : null;
    if (token && !u) return fail(res, 401, "Unauthorized");
    const p = loadProject(req, res, u); if (!p) return;
    return ok(res, projectDetails(p, clean(req.query.search)), "Project fetched successfully");
  });

  app.put("/api/projects/:id", (req, res) => {
    const u = me(req, res); if (!u) return;
    const p = loadProject(req, res, u); if (!p) return;
    if (!guard(res, isPM(u), "Only project managers can edit projects")) return;
    const b = req.body || {};
    if (b.title !== undefined) { const t = clean(b.title); if (t.length < 2) return fail(res, 400, "Project title is required"); p.title = t; }
    if (b.description !== undefined) p.description = clean(b.description);
    if (PRIORITIES.includes(b.priority)) p.priority = b.priority;
    if (PROJECT_STATUSES.includes(b.status)) p.status = b.status;
    if (b.isPrivate !== undefined) p.isPrivate = b.isPrivate === true || b.isPrivate === "true";
    p.updatedAt = nowIso();
    for (const uid of p.memberIds) if (uid !== u.id) pushNotification(uid, { type: "project_updated", group: "all", title: "Project updated", message: `${fullName(u)} updated "${p.title}"`, actorId: u.id, data: { projectId: p.id, projectTitle: p.title } });
    return ok(res, projectCard(p), "Project updated successfully");
  });

  app.delete("/api/projects/:id", (req, res) => {
    const u = me(req, res); if (!u) return;
    const p = loadProject(req, res, u); if (!p) return;
    if (!guard(res, isPM(u), "Only project managers can delete projects")) return;
    for (const t of db.tasks.filter((x) => x.projectId === p.id)) removeTask(t);
    db.sections = db.sections.filter((s) => s.projectId !== p.id);
    db.projects = db.projects.filter((x) => x.id !== p.id);
    db.notifications = db.notifications.filter((n) => Number(n.data?.projectId) !== p.id);
    return ok(res, null, "Project deleted successfully");
  });

  app.get("/api/projects/:id/board", (req, res) => {
    const u = me(req, res); if (!u) return;
    const p = loadProject(req, res, u); if (!p) return;
    const search = clean(req.query.search);
    const cols = boardSections(p.id);
    const tasks = cols.flatMap((s) => tasksInSection(s.id)).filter((t) => matches(t, search));
    return ok(res, {
      id: p.id, title: p.title,
      members: p.memberIds.map(userById).filter(Boolean).map(slimUser),
      teams: p.teamIds.map(teamById).filter(Boolean).map((t) => ({ id: t.id, name: t.name, teamImage: teamImageOf(t), description: t.description })),
      columns: cols.map(columnOut), tasks: tasks.map(boardTask),
    }, "Board fetched successfully");
  });

  app.get("/api/projects/:id/archive-tasks", (req, res) => {
    const u = me(req, res); if (!u) return;
    const p = loadProject(req, res, u); if (!p) return;
    let arch = archiveSection(p.id);
    if (!arch) { arch = { id: db.nextId("section"), projectId: p.id, title: "ARCHIVE", color: "#9CA3AF", flag: "archive", order: 99, createdAt: nowIso(), updatedAt: nowIso() }; db.sections.push(arch); }
    return ok(res, { column: columnOut(arch), tasks: tasksInSection(arch.id).map(boardTask) }, "Archived tasks fetched successfully");
  });

  app.post("/api/projects/:id/sections", (req, res) => {
    const u = me(req, res); if (!u) return;
    const p = loadProject(req, res, u); if (!p) return;
    if (!guard(res, isPM(u), "Only project managers can add sections")) return;
    const b = req.body || {};
    const title = clean(b.title);
    if (!title) return fail(res, 400, "Section title is required");
    const flag = STATUS_FLAGS.includes(clean(b.flag)) ? clean(b.flag) : "todo";
    const list = boardSections(p.id);
    const pos = Math.max(0, Math.min((num(b.order) || list.length + 1) - 1, list.length));
    const sec = { id: db.nextId("section"), projectId: p.id, title, color: clean(b.color) || "#8B5CF6", flag, order: 0, createdAt: nowIso(), updatedAt: nowIso() };
    db.sections.push(sec);
    list.splice(pos, 0, sec);
    list.forEach((s, i) => { s.order = i + 1; });
    p.updatedAt = nowIso();
    return ok(res, columnOut(sec), "Section created successfully", 201);
  });

  app.put("/api/projects/:id/sections/:sectionId", (req, res) => {
    const u = me(req, res); if (!u) return;
    const p = loadProject(req, res, u); if (!p) return;
    if (!guard(res, isPM(u), "Only project managers can edit sections")) return;
    const sec = sectionById(req.params.sectionId);
    if (!sec || sec.projectId !== p.id) return fail(res, 404, "Section not found");
    const b = req.body || {};
    if (b.title !== undefined) { const t = clean(b.title); if (!t) return fail(res, 400, "Section title is required"); sec.title = t; }
    if (b.color !== undefined && clean(b.color)) sec.color = clean(b.color);
    if (b.flag !== undefined && STATUS_FLAGS.includes(clean(b.flag)) && sec.flag !== "archive") sec.flag = clean(b.flag);
    if (b.order !== undefined && num(b.order) != null && sec.flag !== "archive") {
      const list = boardSections(p.id).filter((s) => s.id !== sec.id);
      const pos = Math.max(0, Math.min(num(b.order) - 1, list.length));
      list.splice(pos, 0, sec);
      list.forEach((s, i) => { s.order = i + 1; });
    }
    sec.updatedAt = nowIso();
    p.updatedAt = sec.updatedAt;
    return ok(res, columnOut(sec), "Section updated successfully");
  });

  app.delete("/api/projects/:id/sections/:sectionId", (req, res) => {
    const u = me(req, res); if (!u) return;
    const p = loadProject(req, res, u); if (!p) return;
    if (!guard(res, isPM(u), "Only project managers can delete sections")) return;
    const sec = sectionById(req.params.sectionId);
    if (!sec || sec.projectId !== p.id) return fail(res, 404, "Section not found");
    if (sec.flag === "archive") return fail(res, 400, "The archive section cannot be deleted");
    const arch = archiveSection(p.id);
    const moved = tasksInSection(sec.id);
    for (const t of moved) { t.sectionId = arch.id; t.order = 1e6 + t.order; logActivity(t, "archived", u.id, {}, sec.title, arch.title); }
    renumber(arch.id);
    db.sections = db.sections.filter((s) => s.id !== sec.id);
    boardSections(p.id).forEach((s, i) => { s.order = i + 1; });
    p.updatedAt = nowIso();
    return ok(res, { id: sec.id, archivedTasks: moved.length }, moved.length ? `Section deleted — ${moved.length} task(s) moved to the archive` : "Section deleted successfully");
  });

  const memberRoute = (adding) => (req, res) => {
    const u = me(req, res); if (!u) return;
    const p = loadProject(req, res, u); if (!p) return;
    if (!guard(res, isPM(u), "Only project managers can manage members")) return;
    const ids = idsFrom(req.body, "memberIds").filter((x) => userById(x));
    if (!ids.length) return fail(res, 400, "memberIds is required");
    if (adding) {
      const fresh = ids.filter((x) => !p.memberIds.includes(x));
      p.memberIds.push(...fresh);
      for (const uid of fresh) pushNotification(uid, { type: "project_member_added", group: "all", title: "Added to project", message: `${fullName(u)} added you to "${p.title}"`, actorId: u.id, data: { projectId: p.id, projectTitle: p.title } });
    } else {
      p.memberIds = p.memberIds.filter((x) => !ids.includes(x));
    }
    p.updatedAt = nowIso();
    return ok(res, { members: p.memberIds.map(userById).filter(Boolean).map(slimUser) }, adding ? "Members added successfully" : "Member removed successfully");
  };
  app.post("/api/projects/:id/members/add", memberRoute(true));
  app.post("/api/projects/:id/members/remove", memberRoute(false));

  const teamRoute = (adding) => (req, res) => {
    const u = me(req, res); if (!u) return;
    const p = loadProject(req, res, u); if (!p) return;
    if (!guard(res, isPM(u), "Only project managers can manage teams")) return;
    const ids = idsFrom(req.body, "teamIds").filter((x) => teamById(x));
    if (!ids.length) return fail(res, 400, "teamIds is required");
    if (adding) {
      const fresh = ids.filter((x) => !p.teamIds.includes(x));
      p.teamIds.push(...fresh);
      for (const tid of fresh) {
        const team = teamById(tid);
        for (const uid of team.memberIds) if (uid !== u.id) pushNotification(uid, { type: "project_team_added", group: "all", title: "Team added to project", message: `${fullName(u)} added the ${team.name} team to "${p.title}"`, actorId: u.id, data: { projectId: p.id, projectTitle: p.title, teamId: tid } });
      }
    } else {
      p.teamIds = p.teamIds.filter((x) => !ids.includes(x));
    }
    p.updatedAt = nowIso();
    return ok(res, { teams: p.teamIds.map(teamById).filter(Boolean).map(teamMini) }, adding ? "Teams added successfully" : "Team removed successfully");
  };
  app.post("/api/projects/:id/teams/add", teamRoute(true));
  app.post("/api/projects/:id/teams/remove", teamRoute(false));

  // ------------------------------------------------ tasks
  app.get("/api/tasks/assigned", (req, res) => {
    const u = me(req, res); if (!u) return;
    const sections = mySections(u);
    const all = sections.flatMap((s) => s.tasks);
    return ok(res, {
      id: 0, title: "My Tasks", description: "Tasks assigned to you across all projects", priority: "medium", isPrivate: true, teams: [], members: [slimUser(u)],
      sectionsCount: sections.length, totalAttachmentsCount: all.reduce((n, t) => n + t.attachmentsCount, 0), totalCommentsCount: all.reduce((n, t) => n + t.commentsCount, 0),
      completedTasksPercentage: all.length ? Math.round((all.filter((t) => t.status === "done").length / all.length) * 100) : 0,
      createdAt: u.createdAt, updatedAt: nowIso(), sections,
    }, "Assigned tasks fetched successfully");
  });

  app.post("/api/tasks/sections/:sectionId", upload, (req, res) => {
    const u = me(req, res); if (!u) return;
    if (!guard(res, !isViewerOnly(u), "Viewers cannot create tasks")) return;
    const b = req.body || {};
    const title = clean(b.title);
    if (title.length < 2) return fail(res, 400, "Task title is required");
    let section = sectionById(req.params.sectionId);
    const status = STATUS_FLAGS.includes(clean(b.status)) ? clean(b.status) : null;
    if (!section) {
      const flag = virtualFlag(req.params.sectionId);
      if (!flag) return fail(res, 404, "Section not found");
      const candidates = visibleProjects(u).filter((p) => isProjectMember(p, u) && p.status !== "done").sort((a, c) => new Date(c.updatedAt) - new Date(a.updatedAt));
      const project = candidates.find((p) => sectionForStatus(p.id, status || flag));
      if (!project) return fail(res, 400, "You are not a member of any project yet");
      section = sectionForStatus(project.id, status || flag);
    }
    const project = projectById(section.projectId);
    if (!canSeeProject(project, u)) return fail(res, 403, "You don't have access to this project");
    if (project.archivedAt) return fail(res, 423, 'Restore this project before creating tasks.');
    if (status && section.flag !== status && section.flag !== "archive") section = sectionForStatus(project.id, status) || section;
    const created = nowIso();
    const userIds = idsFrom(b, "assignedUserIds").filter((x) => userById(x));
    if (!userIds.length && virtualFlag(req.params.sectionId)) userIds.push(u.id);
    const teamIds = idsFrom(b, "assignedTeamIds").filter((x) => teamById(x));
    const task = {
      id: db.nextId("task"), projectId: project.id, sectionId: section.id, order: tasksInSection(section.id).length + 1,
      title, description: clean(b.description), priority: PRIORITIES.includes(b.priority) ? b.priority : "medium",
      status: STATUS_FLAGS.includes(section.flag) ? section.flag : status || "todo", baseProgress: null,
      // No due date unless one is picked (the app used to send "now" silently, TASKS-040).
      startDate: toIso(b.startDate) || created, dueDate: toIso(b.dueDate) || null,
      createdById: u.id, createdAt: created, updatedAt: created, completedAt: null, assignments: [], movedAt: null,
      dependsOn: idsFrom(b, "dependsOnTaskIds").filter((x) => taskById(x)?.projectId === project.id),
    };
    v3.patch(task, b);
    if (task.status === 'done' && !canComplete(task)) return fail(res, 409, 'Complete this task’s dependencies first.');
    if (task.status === "done") task.completedAt = created;
    for (const uid of userIds) task.assignments.push({ id: db.nextId("assignment"), assigneeType: "user", assigneeId: uid, assignedById: u.id, assignedAt: created });
    for (const tid of teamIds) task.assignments.push({ id: db.nextId("assignment"), assigneeType: "team", assigneeId: tid, assignedById: u.id, assignedAt: created });
    db.tasks.push(task);
    if (task.status === 'done') v3.complete(task, u);
    logActivity(task, "created", u.id);
    for (const a of task.assignments) logActivity(task, "assigned", u.id, { assigneeName: assigneeOut(a).name }, null, assigneeOut(a).name);
    for (const f of saveFiles(req, { taskId: task.id }, u.id)) logActivity(task, "attachment_added", u.id, { filename: f.originalName, filesize: f.size });
    touchTask(task);
    notifyAssigned(task, [...userIds, ...teamIds.flatMap(teamMemberIds)], u);
    return ok(res, fullTask(task), "Task created successfully", 201);
  });

  app.put("/api/tasks/sections/:sectionId/reorder", (req, res) => {
    const u = me(req, res); if (!u) return;
    const items = Array.isArray(req.body?.tasks) ? req.body.tasks : [];
    if (!items.length) return fail(res, 400, "tasks is required");
    const flag = virtualFlag(req.params.sectionId);
    if (flag) {
      const order = (db.myOrder[u.id] = db.myOrder[u.id] || {});
      for (const it of items) if (num(it.id) != null) order[Number(it.id)] = num(it.order) ?? 0;
      return ok(res, null, "Tasks reordered successfully");
    }
    if (!guard(res, !isViewerOnly(u), "Viewers cannot reorder tasks")) return;
    const sec = sectionById(req.params.sectionId);
    if (!sec) return fail(res, 404, "Section not found");
    if (!canSeeProject(projectById(sec.projectId), u)) return fail(res, 403, "You don't have access to this project");
    for (const it of items) {
      const t = taskById(it.id);
      if (!t || t.projectId !== sec.projectId) continue;
      if (t.sectionId !== sec.id) placeTask(t, sec, num(it.order), u);
      t.order = num(it.order) ?? t.order;
    }
    const pinned = new Set(items.map((it) => Number(it.id)));
    tasksInSection(sec.id).sort((a, b) => a.order - b.order || (pinned.has(b.id) ? 1 : 0) - (pinned.has(a.id) ? 1 : 0)).forEach((t, i) => { t.order = i + 1; });
    sec.updatedAt = nowIso();
    return ok(res, null, "Tasks reordered successfully");
  });

  app.get("/api/tasks/:id", (req, res) => {
    const u = me(req, res); if (!u) return;
    const t = loadTask(req, res, u); if (!t) return;
    return ok(res, fullTask(t), "Task fetched successfully");
  });

  app.put("/api/tasks/:id", (req, res) => {
    const u = me(req, res); if (!u) return;
    const t = loadTask(req, res, u); if (!t) return;
    if (!guard(res, !isViewerOnly(u), "Viewers cannot edit tasks")) return;
    const b = req.body || {};
    if (b.title !== undefined) { const v = clean(b.title); if (v.length < 2) return fail(res, 400, "Task title is required"); if (v !== t.title) { logActivity(t, "updated", u.id, { field: "title" }, t.title, v); t.title = v; } }
    v3.patch(t, b);
    if (b.description !== undefined && clean(b.description) !== (t.description || "")) { t.description = clean(b.description); logActivity(t, "updated", u.id, { field: "description" }); }
    if (PRIORITIES.includes(b.priority) && b.priority !== t.priority) { logActivity(t, "priority_changed", u.id, {}, t.priority, b.priority); t.priority = b.priority; }
    if (b.dueDate !== undefined && toIso(b.dueDate) && toIso(b.dueDate) !== t.dueDate) {
      const old = t.dueDate;
      t.dueDate = toIso(b.dueDate);
      logActivity(t, "due_date_changed", u.id, {}, old, t.dueDate);
      for (const a of t.assignments) if (a.assigneeType === "user" && a.assigneeId !== u.id) pushNotification(a.assigneeId, { type: "task_due_date_changed", group: "assigned", title: "Due date changed", message: `${fullName(u)} changed the due date of "${t.title}"`, actorId: u.id, data: { ...taskNotifData(t), dueDate: t.dueDate } });
    }
    if (b.startDate !== undefined && toIso(b.startDate)) t.startDate = toIso(b.startDate);
    if (b.progress !== undefined && num(b.progress) != null) t.baseProgress = Math.max(0, Math.min(100, num(b.progress)));
    if (b.assignedUserIds !== undefined) {
      const next = toIds(b.assignedUserIds).filter((x) => userById(x));
      const cur = t.assignments.filter((a) => a.assigneeType === "user").map((a) => a.assigneeId);
      const added = next.filter((x) => !cur.includes(x));
      const removed = cur.filter((x) => !next.includes(x));
      t.assignments = t.assignments.filter((a) => a.assigneeType !== "user" || next.includes(a.assigneeId));
      for (const uid of added) { t.assignments.push({ id: db.nextId("assignment"), assigneeType: "user", assigneeId: uid, assignedById: u.id, assignedAt: nowIso() }); logActivity(t, "assigned", u.id, { assigneeName: fullName(userById(uid)) }, null, fullName(userById(uid))); }
      for (const uid of removed) logActivity(t, "unassigned", u.id, { assigneeName: fullName(userById(uid)) }, fullName(userById(uid)), null);
      notifyAssigned(t, added, u);
    }
    if (b.assignedTeamIds !== undefined) {
      const next = toIds(b.assignedTeamIds).filter((x) => teamById(x));
      const cur = t.assignments.filter((a) => a.assigneeType === "team").map((a) => a.assigneeId);
      t.assignments = t.assignments.filter((a) => a.assigneeType !== "team" || next.includes(a.assigneeId));
      for (const tid of next.filter((x) => !cur.includes(x))) t.assignments.push({ id: db.nextId("assignment"), assigneeType: "team", assigneeId: tid, assignedById: u.id, assignedAt: nowIso() });
    }
    if (b.dependsOnTaskIds !== undefined) t.dependsOn = toIds(b.dependsOnTaskIds).filter((x) => x !== t.id && taskById(x)?.projectId === t.projectId);
    const status = clean(b.status);
    if (STATUS_FLAGS.includes(status)) {
      const sec = sectionById(t.sectionId);
      // The update sheet always sends status; an archived task stays archived unless the status really changes.
      if (sec.flag !== status && !(sec.flag === "archive" && status === t.status)) {
        const target = sectionForStatus(t.projectId, status);
        if (target) placeTask(t, target, null, u);
        else setStatus(t, status, u);
      }
    }
    touchTask(t);
    return ok(res, fullTask(t), "Task updated successfully");
  });

  app.delete("/api/tasks/:id", (req, res) => {
    const u = me(req, res); if (!u) return;
    const t = loadTask(req, res, u); if (!t) return;
    if (!guard(res, !isViewerOnly(u), "Viewers cannot delete tasks")) return;
    removeTask(t);
    return ok(res, null, "Task deleted successfully");
  });

  app.post("/api/tasks/:id/move", (req, res) => {
    const u = me(req, res); if (!u) return;
    const t = loadTask(req, res, u); if (!t) return;
    if (!guard(res, !isViewerOnly(u), "Viewers cannot move tasks")) return;
    const sid = req.body?.sectionId;
    let target = sectionById(sid);
    const flag = virtualFlag(sid);
    if (!target && flag) target = sectionForStatus(t.projectId, flag);
    if (!target) return fail(res, 404, "Section not found");
    if (target.projectId !== t.projectId) return fail(res, 400, "A task can only be moved within its project");
    placeTask(t, target, flag ? null : req.body?.order, u);
    if (flag && req.body?.order != null) { const order = (db.myOrder[u.id] = db.myOrder[u.id] || {}); order[t.id] = num(req.body.order) ?? 0; }
    return ok(res, richTask(t), "Task moved successfully");
  });

  // attachments
  app.post("/api/tasks/:id/attachments", upload, (req, res) => {
    const u = me(req, res); if (!u) return;
    const t = loadTask(req, res, u); if (!t) return;
    if (!guard(res, !isViewerOnly(u), "Viewers cannot upload attachments")) return;
    if (identity.workspaceMode) {
      try {
        authorizeSharedTarget({ actorId: u.id, type: 'task', id: t.id, write: true });
        const body = req.body;
        if (!body || Object.keys(body).sort().join() !== 'references' || !Array.isArray(body.references) || !body.references.length || body.references.length > 10) throw Object.assign(new Error('Choose up to ten Files records.'), { status: 422, code: 'invalid_file_references' });
        const refs = body.references.map(value => fileReferences.reference(value, identity.workspaceId));
        // Recheck current Files access before recovering an old receipt.
        if (!ctx.sharedFiles?.resolve) throw Object.assign(new Error('Files could not be loaded.'), { status: 503, code: 'files_unavailable' });
        refs.forEach(ref => ctx.sharedFiles.resolve(ref));
        const saved = fileOperation(t, u, req.get('Idempotency-Key'), { kind: 'add', references: refs }, () => {
          const unique = refs.filter((ref, index) => refs.findIndex(other => fileReferences.sameReference(ref, other)) === index);
          const missing = unique.filter(ref => !taskAttachments(t.id).some(row => fileReferences.sameReference(row.reference, ref)));
          if (taskAttachments(t.id).length + missing.length > 10) throw Object.assign(new Error('A task can reference up to ten files.'), { status: 422, code: 'file_reference_limit' });
          for (const ref of missing) {
            const row = { id: db.nextId('attachment'), taskId: t.id, reference: ref, uploadedById: u.id, createdAt: nowIso() };
            db.attachments.push(row); logActivity(t, 'attachment_added', u.id, { referenceId: row.id });
          }
          if (missing.length) touchTask(t);
          return unique.map(ref => taskAttachments(t.id).find(row => fileReferences.sameReference(row.reference, ref)));
        });
        return ok(res, saved, 'Files attached successfully', 201);
      } catch (error) { return commands.failure(res, error); }
    }
    const saved = saveFiles(req, { taskId: t.id }, u.id);
    if (!saved.length) return fail(res, 400, "No files were uploaded");
    for (const f of saved) logActivity(t, "attachment_added", u.id, { filename: f.originalName, filesize: f.size });
    touchTask(t);
    return ok(res, saved.map(attachmentOut), saved.length > 1 ? `${saved.length} attachments uploaded` : "Attachment uploaded successfully", 201);
  });

  app.delete("/api/tasks/attachments/:attachmentId", (req, res) => {
    const u = me(req, res); if (!u) return;
    const a = db.attachments.find((x) => x.id === Number(req.params.attachmentId));
    if (!a && identity.workspaceMode) {
      const key = req.get('Idempotency-Key'), receiptKey = `${u.id}:${key}`;
      const previousTask = db.tasks.find(row => row.fileReferenceOperations?.[receiptKey]?.fingerprint === crypto.createHash('sha256').update(JSON.stringify({ kind: 'remove', attachmentId: Number(req.params.attachmentId) })).digest('hex'));
      if (previousTask) { try { authorizeSharedTarget({ actorId: u.id, type: 'task', id: previousTask.id, write: true }); return ok(res, null, 'File reference removed'); } catch (error) { return commands.failure(res, error); } }
    }
    if (!a) return fail(res, 404, "Attachment not found");
    const t = taskById(a.taskId || commentById(a.commentId)?.taskId);
    if (!t || !canSeeProject(projectById(t.projectId), u)) return fail(res, 403, "You don't have access to this attachment");
    if (!guard(res, !isViewerOnly(u), "Viewers cannot delete attachments")) return;
    if (a.reference) {
      try {
        authorizeSharedTarget({ actorId: u.id, type: 'task', id: t.id, write: true });
        fileOperation(t, u, req.get('Idempotency-Key'), { kind: 'remove', attachmentId: a.id }, () => {
          db.attachments = db.attachments.filter(row => row.id !== a.id); logActivity(t, 'attachment_deleted', u.id, { referenceId: a.id }); touchTask(t); return [];
        });
        return ok(res, null, 'File reference removed');
      } catch (error) { return commands.failure(res, error); }
    }
    db.attachments = db.attachments.filter((x) => x.id !== a.id);
    if (!a.filename.startsWith("seed-")) fs.promises.unlink(path.join(ctx.uploadsDir, a.filename)).catch(() => {});
    logActivity(t, "attachment_deleted", u.id, { filename: a.originalName, filesize: a.size });
    touchTask(t);
    return ok(res, null, "Attachment deleted successfully");
  });

  // subtasks
  app.get("/api/tasks/:id/subtasks", (req, res) => {
    const u = me(req, res); if (!u) return;
    const t = loadTask(req, res, u); if (!t) return;
    return ok(res, subtasksOf(t.id).map(subtaskOut), "Subtasks fetched successfully");
  });

  app.post("/api/tasks/:id/subtasks", (req, res) => {
    const u = me(req, res); if (!u) return;
    const t = loadTask(req, res, u); if (!t) return;
    if (!guard(res, !isViewerOnly(u), "Viewers cannot add subtasks")) return;
    const title = clean(req.body?.title);
    if (!title) return fail(res, 400, "Subtask title is required");
    const s = { id: db.nextId("subtask"), taskId: t.id, title, isCompleted: false, order: subtasksOf(t.id).length + 1, createdById: u.id, createdAt: nowIso(), updatedAt: nowIso(), completedAt: null, completedById: null };
    db.subtasks.push(s);
    logActivity(t, "subtask_added", u.id, { subtaskTitle: title });
    touchTask(t);
    return ok(res, subtaskOut(s), "Subtask created successfully", 201);
  });

  app.put("/api/tasks/:id/subtasks/reorder", (req, res) => {
    const u = me(req, res); if (!u) return;
    const t = loadTask(req, res, u); if (!t) return;
    if (!guard(res, !isViewerOnly(u), "Viewers cannot reorder subtasks")) return;
    const items = Array.isArray(req.body?.subtasks) ? req.body.subtasks : [];
    for (const it of items) { const s = db.subtasks.find((x) => x.id === Number(it.id) && x.taskId === t.id); if (s && num(it.order) != null) s.order = num(it.order); }
    subtasksOf(t.id).forEach((s, i) => { s.order = i + 1; });
    touchTask(t);
    return ok(res, subtasksOf(t.id).map(subtaskOut), "Subtasks reordered successfully");
  });

  app.put("/api/tasks/subtasks/:subTaskId", (req, res) => {
    const u = me(req, res); if (!u) return;
    const s = db.subtasks.find((x) => x.id === Number(req.params.subTaskId));
    if (!s) return fail(res, 404, "Subtask not found");
    const t = loadTask(req, res, u, s.taskId); if (!t) return;
    if (!guard(res, !isViewerOnly(u), "Viewers cannot edit subtasks")) return;
    const b = req.body || {};
    if (b.title !== undefined && clean(b.title) && clean(b.title) !== s.title) { logActivity(t, "subtask_updated", u.id, { subtaskTitle: clean(b.title) }, s.title, clean(b.title)); s.title = clean(b.title); }
    if (b.isCompleted !== undefined) {
      const v = b.isCompleted === true || b.isCompleted === "true";
      if (v !== s.isCompleted) {
        s.isCompleted = v; s.completedAt = v ? nowIso() : null; s.completedById = v ? u.id : null;
        logActivity(t, v ? "subtask_completed" : "subtask_uncompleted", u.id, { subtaskTitle: s.title });
      }
    }
    s.updatedAt = nowIso();
    touchTask(t);
    return ok(res, subtaskOut(s), "Subtask updated successfully");
  });

  app.delete("/api/tasks/subtasks/:subTaskId", (req, res) => {
    const u = me(req, res); if (!u) return;
    const s = db.subtasks.find((x) => x.id === Number(req.params.subTaskId));
    if (!s) return fail(res, 404, "Subtask not found");
    const t = loadTask(req, res, u, s.taskId); if (!t) return;
    if (!guard(res, !isViewerOnly(u), "Viewers cannot delete subtasks")) return;
    db.subtasks = db.subtasks.filter((x) => x.id !== s.id);
    subtasksOf(t.id).forEach((x, i) => { x.order = i + 1; });
    logActivity(t, "subtask_deleted", u.id, { subtaskTitle: s.title });
    touchTask(t);
    return ok(res, null, "Subtask deleted successfully");
  });

  app.get("/api/tasks/:id/activities", (req, res) => {
    const u = me(req, res); if (!u) return;
    const t = loadTask(req, res, u); if (!t) return;
    const list = db.activities.filter((a) => a.taskId === t.id).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt) || b.id - a.id);
    return ok(res, list.map(activityOut), "Activities fetched successfully");
  });

  // comments
  app.get("/api/tasks/:id/comments", (req, res) => {
    const u = me(req, res); if (!u) return;
    const t = loadTask(req, res, u); if (!t) return;
    const top = commentsOf(t.id).filter((c) => !c.parentCommentId).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return ok(res, top.map(commentOut), "Comments fetched successfully");
  });

  app.post("/api/tasks/:id/comments", upload, (req, res) => {
    const u = me(req, res); if (!u) return;
    const t = loadTask(req, res, u); if (!t) return;
    const b = req.body || {};
    const content = String(b.content ?? "").trim();
    const parentId = num(clean(b.parentCommentId)) || null;
    const hasFiles = (req.files || []).length > 0;
    if (!content && !hasFiles) return fail(res, 400, "Comment content is required");
    if (parentId) { const parent = commentById(parentId); if (!parent || parent.taskId !== t.id) return fail(res, 404, "Parent comment not found"); }
    const c = { id: db.nextId("comment"), taskId: t.id, parentCommentId: parentId, content, authorId: u.id, createdAt: nowIso(), updatedAt: nowIso(), reactions: [] };
    db.comments.push(c);
    saveFiles(req, { commentId: c.id }, u.id);
    logActivity(t, "commented", u.id, { commentId: c.id });
    const mentioned = notifyMentions(t, c, u);
    if (parentId) {
      const parent = commentById(parentId);
      if (parent.authorId !== u.id && !mentioned.includes(parent.authorId)) pushNotification(parent.authorId, { type: "comment_reply", group: "all", title: "New reply", message: `${fullName(u)} replied to your comment on "${t.title}"`, actorId: u.id, data: { ...taskNotifData(t), commentId: c.id } });
    }
    touchTask(t);
    return ok(res, { id: c.id, content: c.content, parentCommentId: c.parentCommentId, createdAt: c.createdAt, updatedAt: c.updatedAt }, parentId ? "Reply added successfully" : "Comment added successfully", 201);
  });

  app.post("/api/tasks/comments/:commentId/reactions", (req, res) => {
    const u = me(req, res); if (!u) return;
    const c = commentById(req.params.commentId);
    if (!c) return fail(res, 404, "Comment not found");
    if (!loadTask(req, res, u, c.taskId)) return;
    const reaction = clean(req.body?.reaction);
    if (!REACTIONS.includes(reaction)) return fail(res, 400, `Invalid reaction. Allowed: ${REACTIONS.join(", ")}`);
    let r = c.reactions.find((x) => x.reaction === reaction);
    if (!r) { r = { reaction, userIds: [] }; c.reactions.push(r); }
    if (!r.userIds.includes(u.id)) r.userIds.push(u.id);
    return ok(res, { id: c.id * 100 + REACTIONS.indexOf(reaction), reaction, commentId: c.id, userId: u.id, createdAt: nowIso() }, "Reaction added", 201);
  });

  app.delete("/api/tasks/comments/:commentId/reactions/:reaction", (req, res) => {
    const u = me(req, res); if (!u) return;
    const c = commentById(req.params.commentId);
    if (!c) return fail(res, 404, "Comment not found");
    if (!loadTask(req, res, u, c.taskId)) return;
    const r = c.reactions.find((x) => x.reaction === req.params.reaction);
    if (r) r.userIds = r.userIds.filter((x) => x !== u.id);
    c.reactions = c.reactions.filter((x) => x.userIds.length);
    return ok(res, { id: c.id * 100 + Math.max(0, REACTIONS.indexOf(req.params.reaction)), reaction: req.params.reaction, commentId: c.id, userId: u.id, createdAt: nowIso() }, "Reaction removed");
  });

  app.put("/api/tasks/comments/:commentId", (req, res) => {
    const u = me(req, res); if (!u) return;
    const c = commentById(req.params.commentId);
    if (!c) return fail(res, 404, "Comment not found");
    const t = loadTask(req, res, u, c.taskId); if (!t) return;
    if (!guard(res, c.authorId === u.id || isAdmin(u), "You can only edit your own comments")) return;
    const content = String(req.body?.content ?? "").trim();
    if (!content) return fail(res, 400, "Comment content is required");
    c.content = content;
    c.updatedAt = nowIso();
    notifyMentions(t, c, u);
    return ok(res, { id: c.id, content: c.content, parentCommentId: c.parentCommentId, createdAt: c.createdAt, updatedAt: c.updatedAt }, "Comment updated successfully");
  });

  app.delete("/api/tasks/comments/:commentId", (req, res) => {
    const u = me(req, res); if (!u) return;
    const c = commentById(req.params.commentId);
    if (!c) return fail(res, 404, "Comment not found");
    const t = loadTask(req, res, u, c.taskId); if (!t) return;
    if (!guard(res, c.authorId === u.id || isPM(u), "You can only delete your own comments")) return;
    const ids = new Set([c.id]);
    let grew = true;
    while (grew) { grew = false; for (const x of db.comments) if (x.parentCommentId && ids.has(x.parentCommentId) && !ids.has(x.id)) { ids.add(x.id); grew = true; } }
    db.comments = db.comments.filter((x) => !ids.has(x.id));
    db.attachments = db.attachments.filter((a) => !ids.has(a.commentId));
    touchTask(t);
    return ok(res, null, "Comment deleted successfully");
  });

  // ------------------------------------------------ analytics
  app.get("/api/analytics/dashboard", (req, res) => {
    const u = me(req, res); if (!u) return;
    return ok(res, analytics.dashboard(u), "Dashboard analytics fetched successfully");
  });
  app.get("/api/analytics/user-dashboard", (req, res) => {
    const u = me(req, res); if (!u) return;
    const period = ["7d", "1m", "1y"].includes(clean(req.query.period)) ? clean(req.query.period) : "7d";
    return ok(res, analytics.userDashboard(u, period), "User dashboard fetched successfully");
  });

  // ------------------------------------------------ users
  const tmUsers = () => identity.users.filter((x) => hasAccess(x) && x.isActive !== false);
  const peopleItem = (x) => ({ ...fullUser(x), scopes: undefined });

  app.get("/api/users/profile/sections", (req, res) => {
    const u = me(req, res); if (!u) return;
    return ok(res, { sections: mySections(u) }, "Sections fetched successfully");
  });

  app.get("/api/users", (req, res) => {
    const u = me(req, res); if (!u) return;
    let list = tmUsers().sort((a, b) => a.firstName.localeCompare(b.firstName));
    if (isClient(u)) { const ids = visiblePeopleIds(u); list = list.filter((x) => ids.has(x.id)); }
    list = util.search(list, clean(req.query.search), ["firstName", "lastName", "email", "username", "profile.jobTitle", "profile.department"]);
    if (clean(req.query.isActive)) list = list.filter((x) => String(x.isActive) === clean(req.query.isActive));
    const roleIds = toIds(req.query.roleIds ?? req.query["roleIds[]"]);
    if (roleIds.length) list = list.filter((x) => roleObjects(x).some((r) => roleIds.includes(r.id)));
    const paged = req.query.page !== undefined || req.query.limit !== undefined;
    if (!paged) return ok(res, list.map(peopleItem), "Users fetched successfully");
    const { items, meta } = util.paginate(list, req.query, { defaultLimit: 10 });
    return ok(res, { items: items.map(peopleItem), meta }, "Users fetched successfully");
  });

  const loadUser = (req, res) => {
    const x = userById(req.params.id);
    if (!x || !hasAccess(x)) { fail(res, 404, "User not found"); return null; }
    return x;
  };

  app.get("/api/users/:id", (req, res) => {
    const u = me(req, res); if (!u) return;
    const x = loadUser(req, res); if (!x) return;
    return ok(res, { ...fullUser(x), teams: db.teams.filter((t) => t.memberIds.includes(x.id)).map(teamMini) }, "User fetched successfully");
  });

  app.delete("/api/users/:id", async (req, res) => {
    const u = me(req, res); if (!u) return;
    if (!guard(res, isAdmin(u), "Only super admins can remove users")) return;
    const x = identity.workspaceMode ? userById(req.params.id) : loadUser(req, res); if (!x) return identity.workspaceMode ? fail(res, 404, 'User not found in this workspace') : undefined;
    if (x.id === u.id) return fail(res, 400, "You cannot remove yourself");
    if (identity.workspaceMode) {
      try { const result = await commands.execute(ctx, identity, req, u, 'workspace.member.remove', { userId: x.id, tool: 'tasks', mode: 'tool_access' }); return ok(res, result, 'User removed successfully'); }
      catch (error) { return commands.failure(res, error); }
    }
    delete identity.grants[SCOPE][x.key];
    return ok(res, { message: `${fullName(x)} no longer has access to the Task Manager` }, "User removed successfully");
  });

  app.get("/api/users/:id/tasks-activities", (req, res) => {
    const u = me(req, res); if (!u) return;
    const x = loadUser(req, res); if (!x) return;
    const list = userTasks(x, u).filter(durationFilter(req.query.duration)).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    const { items, meta } = util.paginate(list, req.query, { defaultLimit: 10 });
    return ok(res, { tasks: groupByDay(items), meta }, "Task activities fetched successfully");
  });

  app.get("/api/users/:id/work", (req, res) => {
    const u = me(req, res); if (!u) return;
    const x = loadUser(req, res); if (!x) return;
    const flags = clean(req.query.sectionFlags).split(",").map((s) => s.trim()).filter(Boolean);
    const list = userTasks(x, u).filter((t) => !flags.length || flags.includes(t.status));
    const now = Date.now();
    const t0 = startOfDay(now);
    const workTask = (t) => ({ id: t.id, title: t.title, description: t.description || "", progress: taskProgress(t), dueDate: t.dueDate, startDate: t.startDate, projectName: projectById(t.projectId).title, projectId: t.projectId, priority: t.priority, status: t.status });
    const due = (t) => (t.dueDate ? new Date(t.dueDate).getTime() : null);
    const open = list.filter((t) => t.status !== "done").sort((a, b) => (due(a) ?? Infinity) - (due(b) ?? Infinity));
    const groups = [
      { key: "overdue", groupName: "Overdue", tasks: open.filter((t) => due(t) != null && due(t) < t0) },
      { key: "today", groupName: "Today", tasks: open.filter((t) => due(t) >= t0 && due(t) < t0 + DAY) },
      { key: "next7", groupName: "Next 7 days", tasks: open.filter((t) => due(t) >= t0 + DAY && due(t) < t0 + 8 * DAY) },
      { key: "later", groupName: "Later", tasks: open.filter((t) => due(t) >= t0 + 8 * DAY) },
      { key: "unscheduled", groupName: "No due date", tasks: open.filter((t) => due(t) == null) },
      { key: "completed", groupName: "Completed", tasks: list.filter((t) => t.status === "done").sort((a, b) => new Date(b.completedAt || b.updatedAt) - new Date(a.completedAt || a.updatedAt)) },
    ].map((g) => ({ key: g.key, groupName: g.groupName, tasks: g.tasks.map(workTask) }));
    return ok(res, { groups }, "User work fetched successfully");
  });

  app.get("/api/users/:id/comments", (req, res) => {
    const u = me(req, res); if (!u) return;
    const x = loadUser(req, res); if (!x) return;
    const list = db.comments.filter((c) => c.authorId === x.id).filter((c) => { const t = taskById(c.taskId); return t && canSeeProject(projectById(t.projectId), u); })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const { items, meta } = util.paginate(list, req.query, { defaultLimit: 10 });
    return ok(res, {
      items: items.map((c) => {
        const t = taskById(c.taskId); const s = sectionById(t.sectionId); const p = projectById(t.projectId);
        return {
          id: c.id, content: c.content, author: slimUser(x),
          task: { id: t.id, title: t.title, description: t.description || "", priority: t.priority, status: t.status },
          section: { id: s.id, title: s.title, color: s.color, flag: s.flag }, project: { id: p.id, title: p.title, description: p.description },
          attachments: db.attachments.filter((a) => a.commentId === c.id).map(attachmentOut), createdAt: c.createdAt, updatedAt: c.updatedAt,
        };
      }), meta,
    }, "User comments fetched successfully");
  });

  // ------------------------------------------------ rbac
  app.get("/api/rbac/roles", (req, res) => {
    const u = me(req, res); if (!u) return;
    const created = identity.scopeByName(SCOPE)?.createdAt || nowIso();
    return ok(res, ROLE_DEFS.map((r) => ({ ...r, isActive: true, createdAt: created, updatedAt: created, permissions: [] })), "Roles fetched successfully");
  });
  app.post("/api/rbac/users/:userId/roles", async (req, res) => {
    const u = me(req, res); if (!u) return;
    if (!guard(res, isAdmin(u), "Only super admins can change roles")) return;
    const x = userById(req.params.userId);
    if (!x) return fail(res, 404, "User not found");
    const names = toIds(req.body?.roleIds).map((id) => ROLE_DEFS.find((r) => r.id === id)?.name).filter(Boolean);
    if (!names.length) return fail(res, 400, "Please select at least one valid role");
    if (identity.workspaceMode) {
      try { await commands.execute(ctx, identity, req, u, 'workspace.tool.roles', { userId: x.id, tool: 'tasks', roles: [...new Set(names)] }); return ok(res, fullUser(userById(x.id)), 'User roles updated successfully'); }
      catch (error) { return commands.failure(res, error); }
    }
    identity.grants[SCOPE] = identity.grants[SCOPE] || {};
    identity.grants[SCOPE][x.key] = { roles: names, permissions: [] };
    pushNotification(x.id, { type: "user_role_changed", group: "all", title: "Role updated", message: `${fullName(u)} changed your Task Manager role to ${names.join(", ").replace(/_/g, " ")}`, actorId: u.id, data: { roles: names, assignedRoles: names } });
    return ok(res, fullUser(x), "User roles updated successfully");
  });

  // ------------------------------------------------ profile (this API's /auth/* — login itself lives on the SOS API)
  app.get("/api/auth/profile", (req, res) => {
    const u = me(req, res); if (!u) return;
    return ok(res, fullUser(u), "Profile fetched successfully");
  });
  app.put("/api/auth/profile", async (req, res) => {
    const u = me(req, res); if (!u) return;
    const b = req.body || {};
    if (identity.workspaceMode) {
      try { await commands.execute(ctx, identity, req, u, 'profile.self_update', { patch: commands.profilePatch(b) }); return ok(res, fullUser(userById(u.id)), 'Profile updated successfully'); }
      catch (error) { return commands.failure(res, error); }
    }
    for (const k of ["firstName", "lastName", "username"]) if (clean(b[k])) u[k] = clean(b[k]);
    if (b.avatar !== undefined) u.avatar = clean(b.avatar) || null;
    for (const k of ["jobTitle", "department", "about", "language", "timeZone", "weekStartDay", "dateFormat", "timeFormat"]) if (b[k] !== undefined) u.profile[k] = b[k] === null ? null : String(b[k]);
    for (const k of ["flyoutToastMessage", "timezoneChangeNotification"]) if (b[k] !== undefined) u.profile[k] = b[k] === true || b[k] === "true";
    u.updatedAt = nowIso(); u.profile.updatedAt = u.updatedAt;
    return ok(res, fullUser(u), "Profile updated successfully");
  });
  app.post("/api/auth/avatar", upload, (req, res) => {
    const u = me(req, res); if (!u) return;
    const f = (req.files || [])[0];
    if (!f) return fail(res, 400, "Please choose an image");
    u.avatar = ctx.fileUrl(f.filename);
    u.updatedAt = nowIso();
    return res.json({ success: true, statusCode: 200, message: "Avatar updated successfully", avatar: u.avatar, data: { avatar: u.avatar } });
  });
  app.delete("/api/auth/avatar", async (req, res) => {
    const u = me(req, res); if (!u) return;
    if (identity.workspaceMode) {
      try { await commands.execute(ctx, identity, req, u, 'profile.self_update', { patch: { avatar: null } }); return ok(res, { message: 'Avatar removed' }, 'Avatar removed successfully'); }
      catch (error) { return commands.failure(res, error); }
    }
    u.avatar = null;
    return ok(res, { message: "Avatar removed" }, "Avatar removed successfully");
  });
  app.post("/api/auth/forgot-password", (req, res) => {
    if (!clean(req.body?.email)) return fail(res, 400, "Email is required");
    return ok(res, { message: "If this email exists, an OTP has been sent (local mock OTP: 123456)" }, "OTP sent to your email");
  });
  app.post("/api/auth/reset-password", (req, res) => {
    const b = req.body || {};
    if (!clean(b.email) || !clean(b.otp) || !clean(b.newPassword)) return fail(res, 400, "email, otp and newPassword are required");
    if (clean(b.otp) !== "123456") return fail(res, 400, "Invalid or expired OTP");
    return ok(res, { message: "Password reset (local mock — the shared local password is unchanged)" }, "Password reset successfully");
  });

  // ------------------------------------------------ teams
  app.get("/api/teams", (req, res) => {
    const u = me(req, res); if (!u) return;
    let list = [...db.teams].sort((a, b) => a.id - b.id);
    if (isClient(u)) { const ids = visibleTeamIds(u); list = list.filter((t) => ids.has(t.id)); }
    // isActive=true: active teams; isActive=false: inactive ones; left out: all (the Tasks wave's
    // teams page sends it only when a filter is chosen, TASKS-025).
    const active = clean(req.query.isActive);
    if (active === "true") list = list.filter((t) => t.isActive);
    else if (active === "false") list = list.filter((t) => !t.isActive);
    list = util.search(list, clean(req.query.search), ["name", "alias", "description"]);
    const { items, meta } = util.paginate(list, req.query, { defaultLimit: 10 });
    return ok(res, { items: items.map(teamOut), meta }, "Teams fetched successfully");
  });

  app.get("/api/teams/all/list", (req, res) => {
    const u = me(req, res); if (!u) return;
    const ids = isClient(u) ? visibleTeamIds(u) : null;
    return ok(res, db.teams.filter((t) => t.isActive && (!ids || ids.has(t.id))).sort((a, b) => a.name.localeCompare(b.name)).map(teamOut), "Teams fetched successfully");
  });

  const uniqueAlias = (name) => {
    let base = name.split(/\s+/).filter(Boolean).map((w) => w[0]).join("").replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 4) || "TEAM";
    if (base.length < 2) base = name.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 3) || "TEAM";
    let alias = base; let i = 2;
    while (db.teams.some((t) => t.alias === alias)) alias = `${base}${i++}`;
    return alias;
  };

  app.post("/api/teams", upload, (req, res) => {
    const u = me(req, res); if (!u) return;
    if (!guard(res, !isViewerOnly(u), "Viewers cannot create teams")) return;
    const b = req.body || {};
    const name = clean(b.name);
    if (name.length < 2) return fail(res, 400, "Team name must be at least 2 characters");
    if (db.teams.some((t) => t.name.toLowerCase() === name.toLowerCase())) return fail(res, 409, "A team with this name already exists");
    const img = (req.files || []).find((f) => f.fieldname === "teamImage") || (req.files || [])[0];
    const memberIds = [...new Set([u.id, ...idsFrom(b, "memberIds")])].filter((x) => userById(x));
    const team = { id: db.nextId("team"), name, alias: clean(b.alias) || uniqueAlias(name), description: clean(b.description), teamImage: img ? img.filename : null, isActive: b.isActive === undefined ? true : String(b.isActive) !== "false", memberIds, createdById: u.id, createdAt: nowIso(), updatedAt: nowIso() };
    db.teams.push(team);
    return ok(res, teamOut(team), "Team created successfully", 201);
  });

  const loadTeam = (req, res, u) => {
    const t = teamById(req.params.id);
    if (!t || (u && isClient(u) && !visibleTeamIds(u).has(t.id))) { fail(res, 404, "Team not found"); return null; }
    return t;
  };

  app.get("/api/teams/:id", (req, res) => {
    const u = me(req, res); if (!u) return;
    const t = loadTeam(req, res, u); if (!t) return;
    return ok(res, { ...teamOut(t), bookmarks: db.bookmarks.filter((b) => b.teamId === t.id).map(bookmarkOut) }, "Team fetched successfully");
  });

  app.put("/api/teams/:id", upload, (req, res) => {
    const u = me(req, res); if (!u) return;
    const t = loadTeam(req, res, u); if (!t) return;
    if (!guard(res, !isViewerOnly(u), "Viewers cannot edit teams")) return;
    const b = req.body || {};
    if (b.name !== undefined) { const n = clean(b.name); if (n.length < 2) return fail(res, 400, "Team name must be at least 2 characters"); t.name = n; }
    if (b.description !== undefined) t.description = clean(b.description);
    if (b.alias !== undefined && clean(b.alias)) t.alias = clean(b.alias);
    if (b.isActive !== undefined) t.isActive = String(b.isActive) !== "false";
    const img = (req.files || []).find((f) => f.fieldname === "teamImage") || (req.files || [])[0];
    if (img) t.teamImage = img.filename;
    if (b.memberIds !== undefined) t.memberIds = idsFrom(b, "memberIds").filter((x) => userById(x));
    t.updatedAt = nowIso();
    return ok(res, teamOut(t), "Team updated successfully");
  });

  app.delete("/api/teams/:id", (req, res) => {
    const u = me(req, res); if (!u) return;
    const t = loadTeam(req, res, u); if (!t) return;
    if (!guard(res, !isViewerOnly(u), "Viewers cannot delete teams")) return;
    db.teams = db.teams.filter((x) => x.id !== t.id);
    db.bookmarks = db.bookmarks.filter((b) => b.teamId !== t.id);
    for (const p of db.projects) p.teamIds = p.teamIds.filter((x) => x !== t.id);
    for (const task of db.tasks) task.assignments = task.assignments.filter((a) => !(a.assigneeType === "team" && a.assigneeId === t.id));
    return ok(res, teamOut(t), "Team deleted successfully");
  });

  app.get("/api/teams/:id/members", (req, res) => {
    const u = me(req, res); if (!u) return;
    const t = loadTeam(req, res, u); if (!t) return;
    let list = t.memberIds.map(userById).filter(Boolean);
    list = util.search(list, clean(req.query.search), ["firstName", "lastName", "email", "profile.jobTitle"]);
    const { items, meta } = util.paginate(list, req.query, { defaultLimit: 10 });
    return ok(res, { items: items.map(teamMemberOut), meta }, "Team members fetched successfully");
  });

  app.post("/api/teams/:id/members", (req, res) => {
    const u = me(req, res); if (!u) return;
    const t = loadTeam(req, res, u); if (!t) return;
    if (!guard(res, !isViewerOnly(u), "Viewers cannot manage team members")) return;
    const ids = idsFrom(req.body, "memberIds").filter((x) => userById(x) && !t.memberIds.includes(x));
    if (!toIds(req.body?.memberIds).length) return fail(res, 400, "memberIds is required");
    t.memberIds.push(...ids);
    t.updatedAt = nowIso();
    for (const uid of ids) if (uid !== u.id) pushNotification(uid, { type: "team_member_added", group: "all", title: "Added to team", message: `${fullName(u)} added you to the ${t.name} team`, actorId: u.id, data: { teamId: t.id, teamName: t.name } });
    return ok(res, teamOut(t), ids.length ? `${ids.length} member(s) added to ${t.name}` : "Selected members are already in this team");
  });

  app.delete("/api/teams/:id/members", (req, res) => {
    const u = me(req, res); if (!u) return;
    const t = loadTeam(req, res, u); if (!t) return;
    if (!guard(res, !isViewerOnly(u), "Viewers cannot manage team members")) return;
    const ids = idsFrom(req.body, "memberIds").length ? idsFrom(req.body, "memberIds") : toIds(req.query.memberIds);
    if (!ids.length) return fail(res, 400, "memberIds is required");
    t.memberIds = t.memberIds.filter((x) => !ids.includes(x));
    t.updatedAt = nowIso();
    return ok(res, teamOut(t), "Members removed from team");
  });

  const teamTasks = (t, viewer) => db.tasks.filter((task) => !isArchived(task) && canSeeProject(projectById(task.projectId), viewer)
    && task.assignments.some((a) => (a.assigneeType === "team" && a.assigneeId === t.id) || (a.assigneeType === "user" && t.memberIds.includes(a.assigneeId))));

  app.get("/api/teams/:id/tasks-activities", (req, res) => {
    const u = me(req, res); if (!u) return;
    const t = loadTeam(req, res, u); if (!t) return;
    const list = teamTasks(t, u).filter(durationFilter(req.query.duration)).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    const { items, meta } = util.paginate(list, req.query, { defaultLimit: 10 });
    return ok(res, { tasks: groupByDay(items), meta }, "Team task activities fetched successfully");
  });

  app.get("/api/teams/:id/team-tasks", (req, res) => {
    const u = me(req, res); if (!u) return;
    const t = loadTeam(req, res, u); if (!t) return;
    const list = teamTasks(t, u).filter((x) => x.status !== "done")
      .sort((a, b) => PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority] || new Date(a.dueDate) - new Date(b.dueDate));
    const { items, meta } = util.paginate(list, req.query, { defaultLimit: 10 });
    return ok(res, {
      items: items.map((x) => ({ id: x.id, name: x.title, priority: x.priority, dueDate: x.dueDate, status: x.status, progress: taskProgress(x), project: { id: x.projectId, title: projectById(x.projectId).title }, assignees: x.assignments.filter((a) => a.assigneeType === "user").map((a) => slimUser(userById(a.assigneeId))).filter(Boolean) })),
      meta,
    }, "Team tasks fetched successfully");
  });

  // ------------------------------------------------ bookmarks
  app.post("/api/bookmarks", upload, (req, res) => {
    const u = me(req, res); if (!u) return;
    if (!guard(res, !isViewerOnly(u), "Viewers cannot add bookmarks")) return;
    const b = req.body || {};
    const team = teamById(b.teamId);
    if (!team) return fail(res, 404, "Team not found");
    if (!clean(b.title)) return fail(res, 400, "Title is required");
    if (!/^https?:\/\//i.test(clean(b.link))) return fail(res, 400, "Please enter a valid URL");
    const row = { id: db.nextId("bookmark"), teamId: team.id, title: clean(b.title), description: clean(b.description), link: clean(b.link), attachmentCount: 0, attachments: [], createdById: u.id, createdAt: nowIso(), updatedAt: nowIso() };
    row.attachments = saveFiles(req, { bookmarkId: row.id }, u.id);
    db.bookmarks.push(row);
    return ok(res, bookmarkOut(row), "Bookmark added successfully", 201);
  });
  app.get("/api/bookmarks", (req, res) => {
    const u = me(req, res); if (!u) return;
    const teamId = num(req.query.teamId);
    return ok(res, db.bookmarks.filter((b) => !teamId || b.teamId === teamId).map(bookmarkOut), "Bookmarks fetched successfully");
  });
  app.delete("/api/bookmarks/:id", (req, res) => {
    const u = me(req, res); if (!u) return;
    if (!guard(res, !isViewerOnly(u), "Viewers cannot delete bookmarks")) return;
    const row = db.bookmarks.find((b) => b.id === Number(req.params.id));
    if (!row) return fail(res, 404, "Bookmark not found");
    db.bookmarks = db.bookmarks.filter((b) => b.id !== row.id);
    return ok(res, null, "Bookmark deleted successfully");
  });

  // ------------------------------------------------ notifications
  const myNotifications = (u) => db.notifications.filter((n) => n.userId === u.id).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt) || b.id - a.id);

  app.get("/api/notifications/latest", (req, res) => {
    const u = me(req, res); if (!u) return;
    const list = myNotifications(u).filter((n) => !n.clearedAt);
    const { items, meta } = util.paginate(list, req.query, { defaultLimit: 20 });
    return ok(res, { notifications: items.map((n) => notificationOut(n, true)), pagination: { page: meta.page, limit: meta.limit, total: meta.total, totalPages: meta.totalPages }, unreadCount: list.filter((n) => !n.readAt).length }, "Notifications fetched successfully");
  });

  app.get("/api/notifications", (req, res) => {
    const u = me(req, res); if (!u) return;
    let list = myNotifications(u);
    const status = clean(req.query.status);
    const group = clean(req.query.group);
    if (status === "unread") list = list.filter((n) => !n.readAt && !n.clearedAt);
    else if (status === "read") list = list.filter((n) => n.readAt && !n.clearedAt);
    else if (status === "cleared") list = list.filter((n) => n.clearedAt);
    else list = list.filter((n) => !n.clearedAt);
    if (group && group !== "all") list = list.filter((n) => n.group === group);
    const from = clean(req.query.startDate); const to = clean(req.query.endDate);
    if (from) list = list.filter((n) => ymd(new Date(n.createdAt).getTime()) >= from);
    if (to) list = list.filter((n) => ymd(new Date(n.createdAt).getTime()) <= to);
    const groups = new Map();
    for (const n of list) { const d = ymd(new Date(n.createdAt).getTime()); if (!groups.has(d)) groups.set(d, []); groups.get(d).push(notificationOut(n)); }
    const groupedNotifications = [...groups.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1)).map(([date, notifications]) => ({ count: notifications.length, date, notifications }));
    return ok(res, { groupedNotifications, total: list.length }, "Notifications fetched successfully");
  });

  app.post("/api/notifications/mark-read", (req, res) => {
    const u = me(req, res); if (!u) return;
    const ids = idsFrom(req.body, "notificationIds");
    let updatedCount = 0;
    for (const n of myNotifications(u)) if ((!ids.length || ids.includes(n.id)) && !n.readAt) { n.readAt = nowIso(); n.updatedAt = n.readAt; updatedCount++; }
    return ok(res, { updatedCount }, updatedCount === 1 ? "Notification marked as read" : `${updatedCount} notifications marked as read`);
  });

  app.post("/api/notifications/clear", (req, res) => {
    const u = me(req, res); if (!u) return;
    const ids = idsFrom(req.body, "notificationIds");
    let clearedCount = 0;
    for (const n of myNotifications(u)) if ((!ids.length || ids.includes(n.id)) && !n.clearedAt) { n.clearedAt = nowIso(); n.readAt = n.readAt || n.clearedAt; n.updatedAt = n.clearedAt; clearedCount++; }
    return ok(res, { clearedCount }, clearedCount === 1 ? "Notification cleared" : `${clearedCount} notifications cleared`);
  });

  // ------------------------------------------------ chat (conversations & messages)
  const convOf = (u) => db.conversations.filter((c) => c.participantIds.includes(u.id) && !c.deletedFor.includes(u.id));
  const messagesOf = (convId) => db.messages.filter((m) => m.conversationId === convId && !m.deletedAt).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  const sender = (x) => x && { id: x.id, email: x.email, username: x.username, firstName: x.firstName, lastName: x.lastName, avatar: avatarOf(x) };
  const chatAtt = (a) => ({ id: a.id, filename: a.filename, originalName: a.originalName, filePath: ctx.fileUrl(a.filename), fileSize: a.size, mimeType: a.mimetype });
  const messageOut = (m) => ({ id: m.id, type: m.type, content: m.content, status: m.status, voiceFilePath: m.voiceFilePath ? ctx.fileUrl(m.voiceFilePath) : null, voiceDuration: m.voiceDuration, sender: sender(userById(m.senderId)), senderId: m.senderId, conversationId: m.conversationId, createdAt: m.createdAt, deletedAt: m.deletedAt, attachments: m.attachments.map(chatAtt), links: m.links });
  const unreadFor = (c, u) => messagesOf(c.id).filter((m) => m.senderId !== u.id && new Date(m.createdAt) > new Date(c.lastReadAt[u.id] || 0)).length;
  function conversationOut(c, u) {
    const other = userById(c.participantIds.find((x) => x !== u.id) ?? u.id);
    const msgs = messagesOf(c.id);
    const unread = unreadFor(c, u);
    return {
      id: c.id, lastActivityAt: c.lastActivityAt, unreadCount: unread,
      participant: { lastSeenAt: online.get(other.id) ? nowIso() : c.lastReadAt[other.id] || c.lastActivityAt, unreadCount: unread, isOnline: !!online.get(other.id), user: { ...fullUser(other), scopes: undefined } },
      lastMessage: msgs.length ? messageOut(msgs[msgs.length - 1]) : null,
    };
  }
  const loadConv = (req, res, u) => { const c = db.conversations.find((x) => x.id === Number(req.params.id)); if (!c || !c.participantIds.includes(u.id)) { fail(res, 404, "Conversation not found"); return null; } return c; };

  app.get("/api/conversations", (req, res) => {
    const u = me(req, res); if (!u) return;
    let list = convOf(u).sort((a, b) => new Date(b.lastActivityAt) - new Date(a.lastActivityAt)).map((c) => conversationOut(c, u));
    list = util.search(list, clean(req.query.search), ["participant.user.firstName", "participant.user.lastName", "participant.user.email"]);
    const { items, meta } = util.paginate(list, req.query, { defaultLimit: 10 });
    return ok(res, { items, meta }, "Conversations fetched successfully");
  });

  app.get("/api/conversations/users/available", (req, res) => {
    const u = me(req, res); if (!u) return;
    const taken = new Set(convOf(u).flatMap((c) => c.participantIds));
    return ok(res, tmUsers().filter((x) => x.id !== u.id && !taken.has(x.id)).map(sender), "Available users fetched successfully");
  });

  app.post("/api/conversations", (req, res) => {
    const u = me(req, res); if (!u) return;
    const pid = num(req.body?.participantId);
    if (!pid || !userById(pid) || pid === u.id) return fail(res, 400, "Please choose a valid participant");
    let c = db.conversations.find((x) => x.participantIds.includes(u.id) && x.participantIds.includes(pid));
    if (c) c.deletedFor = c.deletedFor.filter((x) => x !== u.id);
    else { c = { id: db.nextId("conversation"), participantIds: [u.id, pid], createdAt: nowIso(), lastActivityAt: nowIso(), lastReadAt: { [u.id]: nowIso() }, deletedFor: [] }; db.conversations.push(c); }
    return ok(res, conversationOut(c, u), "Conversation created successfully", 201);
  });

  app.delete("/api/conversations/:id", (req, res) => {
    const u = me(req, res); if (!u) return;
    const c = loadConv(req, res, u); if (!c) return;
    c.deletedFor.push(u.id);
    return ok(res, null, "Conversation deleted successfully");
  });

  app.post("/api/conversations/:id/mark-read", (req, res) => {
    const u = me(req, res); if (!u) return;
    const c = loadConv(req, res, u); if (!c) return;
    c.lastReadAt[u.id] = nowIso();
    for (const m of messagesOf(c.id)) if (m.senderId !== u.id) m.status = "read";
    if (io.chat) io.chat.to(`conversation:${c.id}`).emit("messages_read", { conversationId: c.id, userId: u.id });
    return ok(res, null, "Conversation marked as read");
  });

  app.get("/api/conversations/:id/contact-info", (req, res) => {
    const u = me(req, res); if (!u) return;
    const c = loadConv(req, res, u); if (!c) return;
    const other = userById(c.participantIds.find((x) => x !== u.id) ?? u.id);
    const msgs = messagesOf(c.id);
    const byMonth = new Map();
    for (const m of msgs) {
      const key = m.createdAt.slice(0, 7);
      if (!byMonth.has(key)) byMonth.set(key, { date: key, items: [], documents: [], links: [] });
      const g = byMonth.get(key);
      for (const a of m.attachments) (a.mimetype?.startsWith("image/") || a.mimetype?.startsWith("video/") ? g.items : g.documents).push({ ...chatAtt(a), id: String(a.id), fileSize: String(a.size), type: a.mimetype?.split("/")[0] || "file", messageId: String(m.id), createdAt: m.createdAt });
      for (const l of m.links) g.links.push({ id: String(l.id), url: l.url, title: l.title, description: "", imageUrl: "", domain: (() => { try { return new URL(l.url).hostname; } catch { return ""; } })(), isPreviewFetched: false, messageId: String(m.id), createdAt: m.createdAt });
    }
    const target = clean(req.query.target) || "media";
    const mediaByPeriod = [...byMonth.values()].map((g) => ({ ...g, count: String(target === "links" ? g.links.length : target === "documents" ? g.documents.length : g.items.length) }));
    return ok(res, { partner: { id: String(other.id), firstName: other.firstName, lastName: other.lastName, avatar: avatarOf(other), email: other.email }, mediaByPeriod }, "Contact info fetched successfully");
  });

  app.get("/api/conversations/:id/messages", (req, res) => {
    const u = me(req, res); if (!u) return;
    const c = loadConv(req, res, u); if (!c) return;
    const list = [...messagesOf(c.id)].reverse(); // newest first, page 1 = latest
    const { items, meta } = util.paginate(list, req.query, { defaultLimit: 10 });
    return ok(res, { items: items.map(messageOut), meta }, "Messages fetched successfully");
  });

  const createMessage = (voice) => (req, res) => {
    const u = me(req, res); if (!u) return;
    const c = loadConv(req, res, u); if (!c) return;
    const content = String(req.body?.content ?? "").trim();
    const uploaded = (req.files || []).map((f) => ({ id: db.nextId("attachment"), filename: f.filename, originalName: fixName(f.originalname), mimetype: f.mimetype, size: f.size }));
    if (!content && !uploaded.length) return fail(res, 400, "Message content is required");
    const links = [...content.matchAll(/https?:\/\/[^\s]+/g)].map((m, i) => ({ id: Date.now() + i, url: m[0], title: null }));
    const voiceFile = voice ? uploaded.shift() : null;
    const m = { id: db.nextId("message"), conversationId: c.id, senderId: u.id, type: voice ? "voice" : uploaded.length ? (uploaded[0].mimetype?.startsWith("image/") ? "image" : "file") : "text", content, status: "sent", voiceFilePath: voiceFile ? voiceFile.filename : null, voiceDuration: voice ? num(req.body?.duration) || null : null, attachments: uploaded, links, createdAt: nowIso(), deletedAt: null };
    db.messages.push(m);
    c.lastActivityAt = m.createdAt; c.lastReadAt[u.id] = m.createdAt; c.deletedFor = [];
    const payload = messageOut(m);
    if (io.chat) {
      io.chat.to(`conversation:${c.id}`).emit("new_message", payload);
      for (const pid of c.participantIds) { io.chat.to(`user:${pid}`).emit("new_message", payload); io.chat.to(`user:${pid}`).emit("conversation_updated", { conversationId: c.id }); }
    }
    const other = c.participantIds.find((x) => x !== u.id);
    pushNotification(other, { type: "chat_message_received", group: "all", title: "New message", message: `${fullName(u)}: ${content ? content.slice(0, 80) : voice ? "Voice message" : "Sent an attachment"}`, actorId: u.id, data: { conversationId: c.id, senderName: fullName(u), messageContent: content, conversationType: "direct" } });
    return ok(res, payload, "Message sent", 201);
  };
  app.post("/api/conversations/:id/messages", upload, createMessage(false));
  app.post("/api/conversations/:id/messages/voice", upload, createMessage(true));

  app.delete("/api/conversations/:id/messages/:messageId", (req, res) => {
    const u = me(req, res); if (!u) return;
    const c = loadConv(req, res, u); if (!c) return;
    const m = db.messages.find((x) => x.id === Number(req.params.messageId) && x.conversationId === c.id);
    if (!m) return fail(res, 404, "Message not found");
    if (!guard(res, m.senderId === u.id, "You can only delete your own messages")) return;
    m.deletedAt = nowIso();
    if (io.chat) io.chat.to(`conversation:${c.id}`).emit("message_deleted", { conversationId: c.id, messageId: m.id });
    return ok(res, null, "Message deleted");
  });
  return {
    exportState: () => require("./tasks/runtime-state").encode(db),
    authorizeSharedTarget,
    bootstrap: user => ({ projects: visibleProjects(user).map(projectCard), teams: db.teams.filter(team => !isClient(user) || visibleTeamIds(user).has(team.id)).map(teamMini) }),
    suiteFeed: user => {
      const projects = visibleProjects(user), ids = new Set(projects.map(project => project.id));
      const visible = db.tasks.filter(task => ids.has(task.projectId) && !task.deletedAt), tasks = new Map(visible.map(task => [task.id, task]));
      return { projects: projects.map(projectCard), tasks: visible.map(task => ({ id: task.id, projectId: task.projectId, title: task.title, status: task.status, source: task.source || null })), activities: db.activities.filter(row => tasks.has(row.taskId)).map(row => { const task = tasks.get(row.taskId), actor = userById(row.userId); return { id: row.id, title: row.details?.taskTitle || task.title, action: row.action, actor: actor ? identity.fullName(actor) : undefined, at: row.createdAt, path: `/projects/${task.projectId}/lists?task-id=${task.id}` }; }), notifications: myNotifications(user).filter(row => !row.clearedAt).map(row => ({ id: row.id, title: row.title || row.message || row.type, category: row.group === 'mentions' ? 'mentions' : 'tasks', createdAt: row.createdAt, readAt: row.readAt, path: row.data?.taskId ? `/projects/${row.data.projectId}/lists?task-id=${row.data.taskId}` : '/my-tasks/lists' })) };
    },
    connectedProjects: user => visibleProjects(user).filter(project => !project.archivedAt).map(project => ({ ...projectCard(project), sections: boardSections(project.id).filter(section => section.flag !== 'done').map(section => ({ id: section.id, title: section.title, flag: section.flag })) })),
    projectAudience: (user, projectId) => { const project = projectById(projectId); if (!user || !hasAccess(user) || !project || !canSeeProject(project, user)) throw Object.assign(new Error('This visible project was not found.'), { status: 404, code: 'project_not_found' }); return { isPrivate: Boolean(project.isPrivate), userIds: identity.users.filter(person => person.isActive !== false && hasAccess(person) && canSeeProject(project, person)).map(person => person.id) }; },
    createConnectedTask: (user, payload) => {
      const project = projectById(payload.projectId), section = sectionById(payload.sectionId);
      const task = v3.createTask(project, section, { ...payload, assignedUserIds: payload.assignedUserIds || [user.id] }, user);
      task.source = payload.source;
      for (const assignment of task.assignments) pushNotification(assignment.assigneeId, { type: 'task_created', group: 'assigned', title: task.title, message: 'A connected task was created.', data: taskNotifData(task) });
      return fullTask(task);
    },
    suiteExport: user => {
      const projects = visibleProjects(user), ids = new Set(projects.map(project => project.id)), tasks = db.tasks.filter(task => ids.has(task.projectId)), taskIds = new Set(tasks.map(task => task.id));
      return { projects: projects.map(project => ({ ...projectDetails(project), config: project.v3Config || null, templates: project.v3Templates || [] })), tasks: tasks.map(fullTask), comments: db.comments.filter(comment => taskIds.has(comment.taskId)).map(comment => ({ id: comment.id, taskId: comment.taskId, content: comment.content, createdAt: comment.createdAt })), at: nowIso() };
    },
    usage: () => [{ key: "tasks.projects", used: db.projects.filter(project => !project.archivedAt).length }, { key: "tasks.guests", used: identity.users.filter(user => tmRoles(user).includes("viewer")).length }],
    transferOwnership: command => {
      const { fromUserId, target, operationId } = command;
      if (!Number.isSafeInteger(fromUserId) || !operationId || !target || !['member', 'archive'].includes(target.kind)) throw Object.assign(new Error("Invalid Tasks custody command."), { status: 422 });
      const recipient = target.kind === 'member' && userById(target.userId);
      if (target.kind === 'member' && (!recipient || recipient.id === fromUserId || recipient.isActive === false || !hasAccess(recipient) || isViewerOnly(recipient))) throw Object.assign(new Error("The Tasks custody recipient is not eligible."), { status: 409 });
      const result = { transferred: [], archived: [] };
      const own = row => Object.hasOwn(row, 'ownerId') ? row.ownerId : row.createdById;
      for (const [kind, records] of [['project', db.projects], ['team', db.teams], ['bookmark', db.bookmarks], ['task', db.tasks]]) for (const row of records) {
        const assigned = kind === 'task' && row.assignments.some(assignment => assignment.assigneeType === 'user' && assignment.assigneeId === fromUserId);
        if (own(row) !== fromUserId && !assigned) continue;
        row.ownerId = recipient ? recipient.id : null;
        row.custodyOperationId = operationId; row.updatedAt = nowIso();
        if (kind === 'task') {
          row.assignments = row.assignments.filter(assignment => !(!recipient && assignment.assigneeType === 'user' && assignment.assigneeId === fromUserId)).map(assignment => assignment.assigneeType === 'user' && assignment.assigneeId === fromUserId ? { ...assignment, assigneeId: recipient.id } : assignment).filter((assignment, index, all) => all.findIndex(other => other.assigneeType === assignment.assigneeType && other.assigneeId === assignment.assigneeId) === index);
          if (!recipient) row.sectionId = archiveSection(row.projectId)?.id ?? row.sectionId;
        }
        if (recipient) {
          if (kind === 'project' || kind === 'team') row.memberIds = [...new Set([...row.memberIds, recipient.id])];
          if (kind === 'task') { const project = projectById(row.projectId); project.memberIds = [...new Set([...project.memberIds, recipient.id])]; }
          result.transferred.push(`${kind}:${row.id}`);
        }
        else { row.custodyReadOnly = true; row.archivedAt = nowIso(); if (kind === 'team') row.isActive = false; result.archived.push(`${kind}:${row.id}`); }
      }
      for (const project of db.projects) project.memberIds = project.memberIds.filter(id => id !== fromUserId);
      for (const team of db.teams) team.memberIds = team.memberIds.filter(id => id !== fromUserId);
      return result;
    },
    close: () => { online.clear(); io.notifications = null; io.chat = null; },
  };
}

// ================================================================= sockets
function socketUser(socket) {
  const hs = socket.handshake || {};
  let token = hs.auth?.token || hs.query?.token || hs.headers?.authorization || "";
  if (typeof token === "object") token = token.accessToken || "";
  token = String(token).replace(/^Bearer\s+/i, "").replace(/^"|"$/g, "");
  if (token.startsWith("{")) { try { token = JSON.parse(token).accessToken || ""; } catch { /* ignore */ } }
  return token ? identity.userFromToken(token) : null;
}

function sockets(ioServer) {
  const auth = (socket, next) => {
    const u = socketUser(socket);
    if (!u) return next(new Error("Unauthorized"));
    socket.data.user = u;
    next();
  };

  const notif = ioServer.of("/notifications");
  notif.use(auth);
  notif.on("connection", (socket) => {
    const u = socket.data.user;
    socket.join(`user:${u.id}`);
    socket.emit("connected", { userId: u.id, unreadCount: db ? db.notifications.filter((n) => n.userId === u.id && !n.readAt && !n.clearedAt).length : 0 });
  });
  io.notifications = notif;

  const chat = ioServer.of("/chat");
  chat.use(auth);
  chat.on("connection", (socket) => {
    const u = socket.data.user;
    socket.join(`user:${u.id}`);
    let marked = false;
    const setOnline = () => {
      if (marked) return;
      marked = true;
      online.set(u.id, (online.get(u.id) || 0) + 1);
      chat.emit("user_online", { userId: u.id });
    };
    const setOffline = () => {
      if (!marked) return;
      marked = false;
      const n = (online.get(u.id) || 1) - 1;
      if (n <= 0) { online.delete(u.id); chat.emit("user_offline", { userId: u.id, lastSeenAt: new Date().toISOString() }); } else online.set(u.id, n);
    };
    socket.on("set_user_online", setOnline);
    socket.on("set_user_offline", setOffline);
    socket.on("disconnect", setOffline);
    socket.on("join_conversation", (data) => { const id = Number(data?.conversationId ?? data); if (id) socket.join(`conversation:${id}`); });
    socket.on("leave_conversation", (data) => { const id = Number(data?.conversationId ?? data); if (id) socket.leave(`conversation:${id}`); });
    socket.on("typing", (data) => { const id = Number(data?.conversationId); if (id) socket.to(`conversation:${id}`).emit("typing", { conversationId: id, userId: u.id, isTyping: data?.isTyping !== false }); });
    socket.on("get_online_users", (cb) => { if (typeof cb === "function") cb([...online.keys()]); });
  });
  io.chat = chat;

  // Default namespace: accept (authenticated or not) so stray clients don't retry forever.
  ioServer.on("connection", () => {});
}

module.exports = {
  scopes: [
    {
      name: SCOPE,
      displayName: "Task Manager",
      description: "Plan projects, track tasks on Kanban boards and collaborate with your teams.",
      metadata: { icon: "solar:checklist-minimalistic-bold", color: "#8135cd" },
    },
  ],
  grants: {
    [SCOPE]: {
      admin: ["super_admin"],
      manager: ["project_manager"],
      u15: ["project_manager"],
      employee: ["developer"],
      u7: ["developer"],
      u8: ["developer"],
      u9: ["developer"],
      u11: ["developer"],
      u12: ["developer"],
      u14: ["developer"],
      u13: ["developer"],
      sales: ["viewer"],
      customer: ["viewer"],
    },
  },
  routes,
  sockets,
  createWorkspaceRuntime: input => require("../lib/tool-adapters/tasks").createWorkspaceRuntime(input, module.exports),
};
