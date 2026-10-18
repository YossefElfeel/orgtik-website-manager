const { buildSeed } = require("./seed");
const fileReferences = require('../../lib/workspace-file-references');

const TABLES = ["teams", "bookmarks", "projects", "sections", "tasks", "subtasks", "attachments", "comments", "activities", "notifications", "conversations", "messages"];
const COUNTERS = { teams: "team", bookmarks: "bookmark", projects: "project", sections: "section", tasks: "task", subtasks: "subtask", attachments: "attachment", comments: "comment", activities: "activity", notifications: "notification", conversations: "conversation", messages: "message" };
const clone = value => JSON.parse(JSON.stringify(value));
const invalid = message => { throw Object.assign(new Error(message), { status: 503, code: "invalid_tool_snapshot" }); };

function encode(db) {
  const known = new Set([...TABLES, "myOrder", "seq", "nextId"]);
  if (Object.keys(db).some(key => !known.has(key))) invalid("Tasks codec does not cover every store field.");
  const data = Object.fromEntries(TABLES.map(key => [key, clone(db[key])]));
  data.myOrder = clone(db.myOrder);
  return { data, sequences: clone(db.seq) };
}

function decode(data, sequences) {
  if (!data || Object.keys(data).some(key => ![...TABLES, "myOrder"].includes(key)) || TABLES.some(key => !Array.isArray(data[key])) || !data.myOrder || Array.isArray(data.myOrder) || typeof data.myOrder !== "object") invalid("Tasks snapshot has incomplete tables.");
  if (!sequences || typeof sequences !== "object" || Array.isArray(sequences) || Object.values(sequences).some(value => !Number.isSafeInteger(value) || value < 1)) invalid("Tasks snapshot counters are invalid.");
  for (const [table, counter] of Object.entries(COUNTERS)) {
    const maximum = data[table].reduce((max, row) => Math.max(max, Number(row.id) || 0), 0);
    if (maximum && !(sequences[counter] > maximum)) invalid(`Tasks ${counter} counter would reuse an ID.`);
  }
  const assignments = data.tasks.flatMap(task => task.assignments || []);
  const assignmentMaximum = assignments.reduce((max, row) => Math.max(max, Number(row.id) || 0), 0);
  if (assignmentMaximum && !(sequences.assignment > assignmentMaximum)) invalid("Tasks assignment counter would reuse an ID.");
  const db = buildSeed({ empty: true });
  for (const attachment of data.attachments) if (attachment.reference) {
    try { fileReferences.reference(attachment.reference, attachment.reference.workspaceId); }
    catch { invalid('Tasks file reference is invalid.'); }
    if (!data.tasks.some(task => task.id === attachment.taskId) || Object.keys(attachment).some(key => !['id', 'taskId', 'reference', 'uploadedById', 'createdAt'].includes(key))) invalid('Tasks file reference has an invalid target or unchecked metadata.');
  }
  for (const key of TABLES) db[key] = clone(data[key]);
  db.myOrder = clone(data.myOrder);
  db.seq = clone(sequences);
  return db;
}

function nileFixture(db, identity) {
  const admitted = new Set(identity.users.map(person => person.id));
  const owner = identity.users.find(person => identity.userScopes(person).some(scope => scope.scope === "task_manager" && scope.roles.includes("super_admin"))) || identity.users[0];
  if (!owner) invalid("Nile Tasks fixture needs an admitted owner.");
  const remap = id => admitted.has(id) ? id : owner.id;
  db.projects = db.projects.filter(project => project.id === 1);
  if (db.projects.length !== 1) invalid("Nile Tasks fixture project is missing.");
  const project = db.projects[0];
  project.memberIds = [...new Set([owner.id, ...project.memberIds.filter(id => admitted.has(id))])];
  project.teamIds = []; project.createdById = remap(project.createdById);
  db.sections = db.sections.filter(section => section.projectId === 1);
  db.tasks = db.tasks.filter(task => task.projectId === 1);
  const taskIds = new Set(db.tasks.map(task => task.id));
  for (const task of db.tasks) {
    task.createdById = remap(task.createdById);
    task.assignments = task.assignments.map(assignment => ({ ...assignment, assigneeType: "user", assigneeId: assignment.assigneeType === "user" ? remap(assignment.assigneeId) : owner.id, assignedById: remap(assignment.assignedById) })).filter((assignment, index, all) => all.findIndex(other => other.assigneeId === assignment.assigneeId) === index);
    task.dependsOn = task.dependsOn.filter(id => taskIds.has(id));
  }
  db.subtasks = db.subtasks.filter(row => taskIds.has(row.taskId)).map(row => ({ ...row, createdById: remap(row.createdById), ...(row.completedById != null ? { completedById: remap(row.completedById) } : {}) }));
  db.comments = db.comments.filter(row => taskIds.has(row.taskId)).map(row => ({ ...row, authorId: remap(row.authorId), reactions: row.reactions.map(reaction => ({ ...reaction, ...(reaction.userId != null ? { userId: remap(reaction.userId) } : {}) })) }));
  const commentIds = new Set(db.comments.map(row => row.id));
  db.attachments = db.attachments.filter(row => taskIds.has(row.taskId) || commentIds.has(row.commentId)).map(row => ({ ...row, uploadedById: remap(row.uploadedById) }));
  db.activities = db.activities.filter(row => taskIds.has(row.taskId)).map(row => ({ ...row, userId: remap(row.userId) }));
  db.teams = []; db.bookmarks = []; db.conversations = []; db.messages = []; db.notifications = []; db.myOrder = {};
  return db;
}

module.exports = { TABLES, encode, decode, nileFixture };
