// Dashboard (/analytics/dashboard) and "My Tasks → Overview" (/analytics/user-dashboard) numbers,
// computed from the live in-memory data so they change as tasks are moved/completed.
const DAY = 864e5;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const PRIORITIES = ["high", "medium", "low", "urgent"];

const round1 = (n) => Math.round(n * 10) / 10;
const ts = (iso) => (iso ? new Date(iso).getTime() : null);
function pct(cur, prev) {
  if (!prev) return cur > 0 ? 100 : 0;
  return Math.max(-100, Math.min(300, round1(((cur - prev) / prev) * 100)));
}
const startOfDay = (t) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
const ymd = (t) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
// Deterministic small "noise" so historic series look natural without random jumps between reloads.
const noise = (i, salt = 0) => ((Math.sin((i + 1) * 12.9898 + salt * 78.233) * 43758.5453) % 1 + 1) % 1;

function create(h) {
  const { taskProgress } = h;

  function dashboard(user) {
    const now = Date.now();
    const D30 = 30 * DAY;
    const tasks = h.visibleProjects(user).flatMap((p) => h.activeTasks(p.id));
    const open = tasks.filter((t) => t.status !== "done");
    const done = tasks.filter((t) => t.status === "done");
    const completed = (t) => ts(t.completedAt);
    // Open/total/overdue: compared with a snapshot one week ago; completed: last 30 days vs the 30 before.
    const W7 = now - 7 * DAY;
    const existed = (t, at) => ts(t.createdAt) <= at;
    const openAt = (at) => tasks.filter((t) => existed(t, at) && (!completed(t) || completed(t) > at)).length;
    const overdueAt = (at) => tasks.filter((t) => existed(t, at) && ts(t.dueDate) < at && (!completed(t) || completed(t) > at)).length;
    const openPrev = openAt(W7);
    const doneCur = tasks.filter((t) => completed(t) && completed(t) > now - D30).length;
    const donePrev = tasks.filter((t) => completed(t) && completed(t) <= now - D30 && completed(t) > now - 2 * D30).length;
    const totalPrev = tasks.filter((t) => existed(t, W7)).length;
    const overdue = open.filter((t) => ts(t.dueDate) < now).length;
    const overduePrev = overdueAt(W7);

    const topCards = [
      { key: "open", title: "Open Tasks", value: open.length, percentage: pct(open.length, openPrev) },
      { key: "completed", title: "Completed Tasks", value: done.length, percentage: pct(doneCur, donePrev) },
      { key: "total", title: "Total Tasks", value: tasks.length, percentage: pct(tasks.length, totalPrev) },
      { key: "overdue", title: "Overdue Tasks", value: overdue, percentage: pct(overdue, overduePrev) },
    ];

    const count = (s) => tasks.filter((t) => t.status === s).length;
    const share = (n) => (tasks.length ? round1((n / tasks.length) * 100) : 0);
    const workloadByStatus = [
      { status: "todo", count: count("todo"), title: "To Do", percentage: share(count("todo")) },
      { status: "in_progress", count: count("in_progress"), title: "In Progress", percentage: share(count("in_progress")) },
      { status: "in_review", count: count("in_review"), title: "In Review", percentage: share(count("in_review")) },
      { status: "done", count: count("done"), title: "Completed", percentage: share(count("done")) },
      { status: "backlog", count: count("backlog"), title: "Backlog", percentage: share(count("backlog")) },
    ];
    const goalsByStatus = [
      { flag: "To Do", percentage: share(count("todo")) },
      { flag: "In Progress", percentage: share(count("in_progress")) },
      { flag: "In Review", percentage: share(count("in_review")) },
      { flag: "Done", percentage: share(count("done")) },
      { flag: "Backlog", percentage: share(count("backlog")) },
    ];

    // Task assignments per day: last 30 days vs the 30 days before (Fri/Sat = Egyptian weekend, quieter).
    const assignedAt = tasks.flatMap((t) => t.assignments.map((a) => ts(a.assignedAt)));
    const on = (day) => assignedAt.filter((x) => x >= day && x < day + DAY).length;
    const today0 = startOfDay(now);
    const taskAssigneeData = [];
    for (let i = 29; i >= 0; i--) {
      const day = today0 - i * DAY;
      const weekend = [5, 6].includes(new Date(day).getDay());
      const base = (d, salt) => Math.round((weekend ? 1 : 3) + noise(d / DAY, salt) * (weekend ? 2 : 5));
      taskAssigneeData.push({ date: ymd(day), thisMonth: on(day) + base(day, 1), lastMonth: on(day - 30 * DAY) + base(day - 30 * DAY, 2) });
    }

    // Tasks created per month by priority (last 6 months) with a light baseline so the area chart reads well.
    const priorityBreakdown = [];
    const cur = new Date(now);
    for (let i = 5; i >= 0; i--) {
      const m = new Date(cur.getFullYear(), cur.getMonth() - i, 1);
      const next = new Date(m.getFullYear(), m.getMonth() + 1, 1).getTime();
      const inMonth = tasks.filter((t) => ts(t.createdAt) >= m.getTime() && ts(t.createdAt) < next);
      const row = { month: MONTHS[m.getMonth()], monthKey: `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}` };
      // The seed only covers the last ~3 months, so older months get a typical monthly volume.
      const typical = { high: 9, medium: 14, low: 6, urgent: 4 };
      PRIORITIES.forEach((p, k) => {
        const real = inMonth.filter((t) => t.priority === p).length;
        row[p] = Math.max(real, Math.round(typical[p] * (0.65 + 0.7 * noise(i, k + 3))));
      });
      priorityBreakdown.push(row);
    }

    const incompleteTasksByProject = h.visibleProjects(user)
      .map((p) => ({ projectId: p.id, projectName: p.title, totalIncompleteTasks: h.activeTasks(p.id).filter((t) => t.status !== "done").length }))
      .sort((a, b) => b.totalIncompleteTasks - a.totalIncompleteTasks);

    return { topCards, workloadByStatus, taskAssigneeData, goalsByStatus, priorityBreakdown, incompleteTasksByProject };
  }

  const PHRASE = {
    created: () => "created",
    assigned: () => "assigned",
    unassigned: () => "unassigned someone from",
    status_changed: (a) => `moved to ${a.newValue || "a new status"}`,
    subtask_added: () => "added a subtask to",
    subtask_completed: () => "completed a subtask in",
    subtask_uncompleted: () => "reopened a subtask in",
    subtask_deleted: () => "deleted a subtask from",
    attachment_added: () => "attached a file to",
    attachment_deleted: () => "removed a file from",
    commented: () => "commented on",
    due_date_changed: () => "changed the due date of",
    priority_changed: (a) => `set priority to ${a.newValue} on`,
    updated: () => "updated",
    moved: () => "moved",
    archived: () => "archived",
  };

  function userDashboard(user, period) {
    const now = Date.now();
    const days = { "7d": 7, "1m": 30, "1y": 365 }[period] || 7;
    const W = days * DAY;
    const mine = h.myTasks(user);
    const inWin = (x, from, to) => x != null && x > from && x <= to;
    const metric = (fn) => {
      const c = mine.filter((t) => fn(t, now - W, now)).length;
      const p = mine.filter((t) => fn(t, now - 2 * W, now - W)).length;
      return { count: c, percentage: pct(c, p) };
    };
    // "Updated" = tasks with any activity in the window (updatedAt only keeps the latest change).
    const actTimes = new Map();
    for (const a of h.db.activities) { if (!actTimes.has(a.taskId)) actTimes.set(a.taskId, []); actTimes.get(a.taskId).push(ts(a.createdAt)); }
    const touched = (t, a, b) => (actTimes.get(t.id) || []).some((x) => x > a && x <= b);
    const dueSoon = mine.filter((t) => t.status !== "done" && ts(t.dueDate) >= now && ts(t.dueDate) <= now + 7 * DAY).length;
    const dueSoonPrev = mine.filter((t) => ts(t.dueDate) >= now - W && ts(t.dueDate) <= now - W + 7 * DAY).length;
    const overdue = mine.filter((t) => t.status !== "done" && ts(t.dueDate) < now).length;
    const overduePrev = mine.filter((t) => ts(t.dueDate) < now - W && (!t.completedAt || ts(t.completedAt) > now - W)).length;
    const metrics = {
      completed: metric((t, a, b) => inWin(ts(t.completedAt), a, b)),
      updated: metric(touched),
      created: metric((t, a, b) => inWin(ts(t.createdAt), a, b)),
      dueSoon: { count: dueSoon, percentage: pct(dueSoon, dueSoonPrev) },
      overdue: { count: overdue, percentage: pct(overdue, overduePrev) },
      period,
    };

    const total = mine.length;
    const statusOverview = [["todo", "To Do", "todo"], ["in_progress", "In Progress", "in_progress"], ["in_review", "In Review", "in_review"], ["completed", "Done", "done"], ["backlog", "Backlog", "backlog"]]
      .map(([status, label, s]) => {
        const c = mine.filter((t) => t.status === s).length;
        return { status, label, count: c, percentage: total ? round1((c / total) * 100) : 0 };
      });

    const myIds = new Set(mine.map((t) => t.id));
    const recentActivity = h.db.activities
      .filter((a) => myIds.has(a.taskId) || a.userId === user.id)
      .filter((a) => h.taskById(a.taskId))
      .sort((a, b) => ts(b.createdAt) - ts(a.createdAt))
      .slice(0, 12)
      .map((a) => {
        const actor = h.userById(a.userId);
        const task = h.taskById(a.taskId);
        return {
          // code + value + ids: the app words it in the reader's language (the phrase stays for old clients).
          code: a.action, value: a.newValue ?? null, taskId: task.id, projectId: task.projectId,
          userName: actor ? `${actor.firstName} ${actor.lastName}` : "Someone",
          userAvatar: actor ? h.avatarOf(actor) : null,
          action: (PHRASE[a.action] || ((x) => x.action.replace(/_/g, " ")))(a),
          taskTitle: task.title,
          timeAgo: h.util.timeAgo(a.createdAt),
          timestamp: a.createdAt,
        };
      });

    const open = mine.filter((t) => t.status !== "done");
    const upcoming = open.filter((t) => ts(t.dueDate) >= startOfDay(now)).sort((a, b) => ts(a.dueDate) - ts(b.dueDate));
    const next = upcoming[0] || open.sort((a, b) => ts(b.dueDate) - ts(a.dueDate))[0] || null;
    let upNext = null;
    if (next) {
      const project = h.projectById(next.projectId);
      upNext = {
        id: next.id, title: next.title, description: next.description || "", dueDate: next.dueDate, priority: next.priority, status: next.status,
        project: { id: project.id, name: project.title },
        tags: [h.sectionById(next.sectionId)?.title, next.priority].filter(Boolean),
        commentsCount: h.commentsOf(next.id).length,
        activitiesCount: h.db.activities.filter((a) => a.taskId === next.id).length,
        interactionsCount: h.commentsOf(next.id).reduce((n, c) => n + c.reactions.reduce((m, r) => m + r.userIds.length, 0), 0) + h.commentsOf(next.id).length,
        assignees: next.assignments.filter((a) => a.assigneeType === "user").map((a) => h.userById(a.assigneeId)).filter(Boolean)
          .map((u) => ({ id: u.id, name: `${u.firstName} ${u.lastName}`, avatar: h.avatarOf(u), email: u.email })),
      };
    }

    // Workload per priority: a task counts on every day between its start and due date.
    const active = (t, from, to) => ts(t.startDate) <= to && ts(t.dueDate) >= from;
    const priorityBreakdown = {};
    const keyOf = { high: "highPriority", medium: "mediumPriority", low: "lowPriority", urgent: "urgentPriority" };
    const today0 = startOfDay(now);
    for (const p of PRIORITIES) {
      const list = mine.filter((t) => t.priority === p);
      const trendData = {};
      if (days === 7) {
        const weekStart = today0 - new Date(today0).getDay() * DAY; // Sunday of this week
        WEEKDAYS.forEach((d, i) => { const day = weekStart + i * DAY; trendData[d] = list.filter((t) => active(t, day, day + DAY - 1)).length; });
      } else if (days === 30) {
        for (let i = 1; i <= 30; i++) { const day = today0 - (30 - i) * DAY; trendData[String(i)] = list.filter((t) => active(t, day, day + DAY - 1)).length; }
      } else {
        const y = new Date(now).getFullYear();
        MONTHS.forEach((m, i) => { const a = new Date(y, i, 1).getTime(); const b = new Date(y, i + 1, 1).getTime() - 1; trendData[m] = list.filter((t) => active(t, a, b)).length; });
      }
      // trend: the same numbers keyed by day ("YYYY-MM-DD") or month ("YYYY-MM"), in order, so the
      // app can word them in any language (trendData's English day names broke the German chart).
      const trend = [];
      if (days === 7) { const weekStart = today0 - new Date(today0).getDay() * DAY; WEEKDAYS.forEach((d, i) => trend.push({ key: ymd(weekStart + i * DAY), value: trendData[d] })); }
      else if (days === 30) { for (let i = 1; i <= 30; i++) trend.push({ key: ymd(today0 - (30 - i) * DAY), value: trendData[String(i)] }); }
      else { const y = new Date(now).getFullYear(); MONTHS.forEach((m, i) => trend.push({ key: `${y}-${String(i + 1).padStart(2, "0")}`, value: trendData[m] })); }
      priorityBreakdown[keyOf[p]] = { count: list.filter((t) => t.status !== "done").length, trendData, trend };
    }

    // Completed work in the user's projects during the period, by assignee.
    const scopeTasks = h.visibleProjects(user).filter((p) => h.isProjectMember(p, user)).flatMap((p) => h.activeTasks(p.id));
    const completedIn = scopeTasks.filter((t) => inWin(ts(t.completedAt), now - W, now));
    const counts = new Map();
    for (const t of completedIn) for (const a of t.assignments.filter((x) => x.assigneeType === "user")) counts.set(a.assigneeId, (counts.get(a.assigneeId) || 0) + 1);
    const totalCounted = [...counts.values()].reduce((a, b) => a + b, 0);
    const assignees = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([id, c]) => {
      const u = h.userById(id);
      return { id, name: u ? `${u.firstName} ${u.lastName}` : `User ${id}`, avatar: u ? h.avatarOf(u) : null, count: c, percentage: totalCounted ? round1((c / totalCounted) * 100) : 0 };
    });
    const openScope = scopeTasks.filter((t) => t.status !== "done").length;
    const completedByAssignee = {
      totalCompleted: completedIn.length,
      assignees,
      workDoneByAssigneePercentage: String(completedIn.length + openScope ? round1((completedIn.length / (completedIn.length + openScope)) * 100) : 0),
    };

    return { metrics, statusOverview, recentActivity, upNext, priorityBreakdown, completedByAssignee, progressAverage: mine.length ? Math.round(mine.reduce((n, t) => n + taskProgress(t), 0) / mine.length) : 0 };
  }

  return { dashboard, userDashboard };
}

module.exports = { create, ymd, startOfDay };
