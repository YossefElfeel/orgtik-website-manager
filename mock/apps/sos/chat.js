// 1:1 chat for the SOS dashboard: REST under /api/conversations/* and socket.io namespace "/chat".
// Message status: "sent" (recipient offline) -> "delivered" (recipient connected) -> "read" (recipient opened it).
const fs = require("fs");
const path = require("path");
const { nowIso } = require("../../lib/util");
const buildSeed = require("./chat-seed");

const MAX_FILES = 10;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const IMAGE_EXT = ["jpg", "jpeg", "png", "gif", "webp", "svg"];
const URL_RE = /\bhttps?:\/\/[^\s<>"'`]+/gi;

const extOf = (name) => (String(name).split(".").pop() || "").toLowerCase();
const humanSize = (b) => (b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1048576).toFixed(1)} MB`);
// busboy hands multer latin1-decoded filenames; browsers send UTF-8 (Arabic names etc.).
const fixName = (n) => {
  try {
    const d = Buffer.from(String(n), "latin1").toString("utf8");
    return d.includes("�") ? String(n) : d;
  } catch {
    return String(n);
  }
};

function periodLabel(iso) {
  const d = new Date(iso);
  const now = new Date();
  const days = Math.floor((new Date(now.getFullYear(), now.getMonth(), now.getDate()) - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 864e5);
  if (days <= 0) return "Today";
  if (days < 7) return "This week";
  if (days < 14) return "Last week";
  return d.toLocaleString("en-US", { month: "long", year: "numeric" });
}

function createChat(S, H) {
  const { identity, util, ctx, config } = S;
  const conversations = []; // { id, participants: [uid, uid], createdAt, lastActivityAt, hiddenFor: Set, clearedAt: { uid: iso } }
  const messages = []; // { id, conversationId, senderId, type, content, status, voiceFilePath, voiceDuration, attachments, links, createdAt, readAt, deletedAt }
  const lastSeen = new Map(); // uid -> ISO
  const online = new Map(); // uid -> Set(socket.id) of sockets that count as "online"
  let convSeq = 1;
  let msgSeq = 1;
  let attSeq = 1;
  let linkSeq = 1;

  // ---------- link "previews" without any network access ----------
  const APP_NAMES = { sos: "Orgtik SOS", tasks: "Orgtik Task Manager", files: "Orgtik File Manager", sales: "Orgtik Sales", hr: "Orgtik HR", marketing: "Orgtik Digital Marketing", content: "Orgtik Content Dashboard" };
  const LOCAL_HOSTS = {};
  for (const [key, name] of Object.entries(APP_NAMES)) if (config.apps[key]) LOCAL_HOSTS[`localhost:${config.apps[key].web}`] = name;
  LOCAL_HOSTS[`localhost:${config.apps.sos.api}`] = "Orgtik local services";

  function linkPreview(url) {
    let u;
    try {
      u = new URL(url);
    } catch {
      return null;
    }
    const app = LOCAL_HOSTS[u.host];
    const cms = u.pathname.startsWith("/local-cms/") ? u.pathname.split("/")[2] : null;
    const words = (s) => s.split(/[-_]/).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
    const section = u.pathname.split("/").filter((p) => p && !/^(en|ar|de|fr|it)$/i.test(p) && !/^\d+$/.test(p)).map(words).join(" · ");
    const title = cms ? `${words(cms)} · CMS dashboard` : app ? `${app}${section ? ` · ${section}` : ""}` : u.hostname.replace(/^www\./, "");
    const description = cms ? "Local CMS preview served by the Orgtik mock" : app ? `Open ${app} (local)` : `Link shared from ${u.hostname}`;
    return { id: linkSeq++, url, title, description, imageUrl: null, domain: u.host, isPreviewFetched: true };
  }
  const extractLinks = (text) =>
    [...new Set((String(text || "").match(URL_RE) || []).map((s) => s.replace(/[.,;:!?)\]]+$/, "")))].slice(0, 5).map(linkPreview).filter(Boolean);

  // ---------- presence ----------
  const isOnline = (uid) => (online.get(uid)?.size || 0) > 0;
  const lastSeenOf = (uid) => (isOnline(uid) ? nowIso() : lastSeen.get(uid) || identity.findUser(uid)?.updatedAt || nowIso());
  function isViewing(uid, convId) {
    const room = S.nsp?.adapter.rooms.get(`conversation:${convId}`);
    if (!room) return false;
    for (const sid of room) if (S.nsp.sockets.get(sid)?.data.userId === uid) return true;
    return false;
  }

  // ---------- views ----------
  const partnerId = (conv, uid) => conv.participants.find((p) => p !== uid) ?? uid;
  const visible = (conv, uid) => {
    const cut = conv.clearedAt[uid];
    return messages.filter((m) => m.conversationId === conv.id && (!cut || m.createdAt > cut));
  };
  const unreadFor = (conv, uid) => visible(conv, uid).filter((m) => m.senderId !== uid && m.status !== "read" && !m.deletedAt).length;

  const senderView = (id) => {
    const u = identity.findUser(id);
    return u ? { id: u.id, email: u.email, username: u.username, firstName: u.firstName, lastName: u.lastName, avatar: u.avatar } : { id, email: "", username: "unknown", firstName: "Unknown", lastName: "User", avatar: null };
  };

  // IMessage (types/chat.ts)
  function messageView(m) {
    const gone = !!m.deletedAt;
    return {
      id: m.id,
      conversationId: m.conversationId,
      senderId: m.senderId,
      sender: senderView(m.senderId),
      type: m.type,
      content: gone ? "" : m.content,
      status: m.status,
      voiceFilePath: gone ? null : m.voiceFilePath || null,
      voiceDuration: gone ? null : m.voiceDuration ?? null,
      attachments: gone ? [] : m.attachments.map((a) => ({ id: a.id, filename: a.filename, originalName: a.originalName, filePath: a.filePath, fileSize: a.fileSize, mimeType: a.mimeType })),
      links: gone ? [] : m.links.map((l) => ({ id: l.id, url: l.url, title: l.title, description: l.description, imageUrl: l.imageUrl, domain: l.domain })),
      createdAt: m.createdAt,
      updatedAt: m.updatedAt || m.createdAt,
      readAt: m.readAt || null,
      deletedAt: m.deletedAt || null,
    };
  }

  // Conversation list shows lastMessage.content, so give media-only messages a readable preview.
  function previewView(m) {
    const v = messageView(m);
    if (m.deletedAt) v.content = "🚫 This message was deleted";
    else if (m.type === "voice") v.content = "🎤 Voice message";
    else if (!m.content && m.attachments.length) {
      const imgs = m.attachments.filter((a) => IMAGE_EXT.includes(extOf(a.filename))).length;
      v.content = imgs === m.attachments.length ? (imgs > 1 ? `📷 ${imgs} photos` : "📷 Photo") : `📎 ${m.attachments[0].originalName}${m.attachments.length > 1 ? ` +${m.attachments.length - 1}` : ""}`;
    }
    return v;
  }

  // IConversations (types/chat.ts)
  function conversationView(conv, uid) {
    const pid = partnerId(conv, uid);
    const partner = identity.findUser(pid);
    const vis = visible(conv, uid);
    const last = vis[vis.length - 1] || null;
    return {
      id: conv.id,
      createdAt: conv.createdAt,
      updatedAt: conv.lastActivityAt,
      lastActivityAt: conv.lastActivityAt,
      unreadCount: unreadFor(conv, uid),
      participant: {
        lastSeenAt: lastSeenOf(pid),
        isOnline: isOnline(pid),
        unreadCount: unreadFor(conv, pid),
        user: partner ? identity.publicUser(partner) : null,
      },
      lastMessage: last ? previewView(last) : null,
    };
  }

  function listFor(uid, { page = 1, limit = 20, search = "" } = {}) {
    let list = conversations.filter((c) => c.participants.includes(uid) && !c.hiddenFor.has(uid));
    const q = String(search || "").trim().toLowerCase();
    if (q) {
      list = list.filter((c) => {
        const p = identity.findUser(partnerId(c, uid));
        return p && [`${p.firstName} ${p.lastName}`, p.email, p.username].some((v) => String(v || "").toLowerCase().includes(q));
      });
    }
    list.sort((a, b) => (a.lastActivityAt < b.lastActivityAt ? 1 : a.lastActivityAt > b.lastActivityAt ? -1 : b.id - a.id));
    const { items, meta } = util.paginate(list, { page, limit }, { defaultLimit: 20 });
    return { items: items.map((c) => conversationView(c, uid)), meta };
  }

  // ---------- socket fan-out ----------
  const room = (id) => `conversation:${id}`;
  const userRoom = (uid) => `user:${uid}`;
  function pushConversations(uid) {
    S.nsp?.to(userRoom(uid)).emit("conversations_updated", { success: true, message: "Conversations updated", data: listFor(uid, { page: 1, limit: 20 }) });
  }
  // Everyone viewing the conversation + both participants' other tabs; socket.io sends each socket one copy.
  const everyone = (conv) => S.nsp?.to(room(conv.id)).to(userRoom(conv.participants[0])).to(userRoom(conv.participants[1]));

  function markRead(conv, uid) {
    const now = nowIso();
    const ids = [];
    for (const m of visible(conv, uid)) {
      if (m.senderId !== uid && m.status !== "read" && !m.deletedAt) {
        m.status = "read";
        m.readAt = now;
        ids.push(m.id);
      }
    }
    if (ids.length) {
      everyone(conv)?.emit("messages_read", { conversationId: conv.id, userId: uid, messageIds: ids, readAt: now });
      pushConversations(uid);
      pushConversations(partnerId(conv, uid));
    }
    return ids.length;
  }

  function createMessage(conv, sender, { type, content, attachments = [], voiceFilePath = null, voiceDuration = null }) {
    const rid = partnerId(conv, sender.id);
    const viewing = isViewing(rid, conv.id);
    const now = nowIso();
    const m = {
      id: msgSeq++,
      conversationId: conv.id,
      senderId: sender.id,
      type,
      content: content || "",
      status: viewing ? "read" : isOnline(rid) ? "delivered" : "sent",
      voiceFilePath,
      voiceDuration,
      attachments,
      links: type === "voice" ? [] : extractLinks(content),
      createdAt: now,
      updatedAt: now,
      readAt: viewing ? now : null,
      deletedAt: null,
    };
    messages.push(m);
    conv.lastActivityAt = now;
    conv.hiddenFor.clear(); // a new message brings a deleted chat back for both people
    const view = messageView(m);
    everyone(conv)?.emit("new_message", { conversationId: conv.id, message: view });
    S.nsp?.to(userRoom(sender.id)).emit("message_sent", { success: true, conversationId: conv.id, message: view });
    pushConversations(sender.id);
    pushConversations(rid);
    return m;
  }

  // ---------- seed ----------
  function seed() {
    const rnd = util.seeded(20260929);
    const specs = buildSeed({ web: (k) => config.webUrl(k), api: config.apiUrl("sos") });
    for (const c of specs) {
      const a = identity.findByKey(c.between[0]);
      const b = identity.findByKey(c.between[1]);
      if (!a || !b) continue;
      const conv = { id: convSeq++, participants: [a.id, b.id], createdAt: null, lastActivityAt: null, hiddenFor: new Set(), clearedAt: {} };
      const timeline = [];
      for (const s of c.sessions) {
        const times = [];
        let t = s.end;
        for (let i = s.msgs.length - 1; i >= 0; i--) {
          times[i] = t;
          t += rnd.int(2, 6);
        }
        s.msgs.forEach((spec, i) => timeline.push({ spec, at: Date.now() - times[i] * 60000 }));
      }
      timeline.sort((x, y) => x.at - y.at);
      const byKey = { [c.between[0]]: a, [c.between[1]]: b };
      // Which messages are still unread: the last n sent to `reader`.
      const unreadIdx = new Set();
      for (const [readerKey, n] of Object.entries(c.unread || {})) {
        const reader = byKey[readerKey];
        let left = n;
        for (let i = timeline.length - 1; i >= 0 && left > 0; i--) {
          if (byKey[timeline[i].spec[0]] !== reader) {
            unreadIdx.add(i);
            left--;
          }
        }
      }
      timeline.forEach(({ spec, at }, i) => {
        const [fromKey, text, opts = {}] = spec;
        const from = byKey[fromKey];
        const iso = new Date(at).toISOString();
        const atts = (opts.files || []).map((k) => S.assets[k]).filter(Boolean).map((f) => ({ id: attSeq++, filename: f.filename, originalName: f.name, filePath: f.url, fileSize: f.size, mimeType: f.mime, createdAt: iso }));
        const voice = opts.voice ? S.assets[opts.voice] : null;
        const type = voice ? "voice" : atts.length ? (atts.every((x) => IMAGE_EXT.includes(extOf(x.filename))) ? "image" : "file") : "text";
        const unread = unreadIdx.has(i);
        messages.push({
          id: msgSeq++,
          conversationId: conv.id,
          senderId: from.id,
          type,
          content: text || "",
          status: unread ? c.unreadStatus || "delivered" : "read",
          voiceFilePath: voice ? voice.url : null,
          voiceDuration: voice ? voice.duration : null,
          attachments: atts,
          links: voice ? [] : extractLinks(text),
          createdAt: iso,
          updatedAt: iso,
          readAt: unread ? null : new Date(at + rnd.int(1, 20) * 60000).toISOString(),
          deletedAt: opts.deleted ? new Date(at + 60000).toISOString() : null,
        });
      });
      conv.createdAt = new Date(timeline[0].at - 3600000).toISOString();
      conv.lastActivityAt = new Date(timeline[timeline.length - 1].at).toISOString();
      conversations.push(conv);
    }
    for (const [key, minutes] of Object.entries(buildSeed.LAST_SEEN)) {
      const u = identity.findByKey(key);
      if (u) lastSeen.set(u.id, new Date(Date.now() - minutes * 60000).toISOString());
    }
  }
  seed();

  // ---------- REST ----------
  function register(app) {
    const findConv = (req, res, me) => {
      const conv = conversations.find((c) => String(c.id) === String(req.params.id));
      if (!conv || !conv.participants.includes(me.id)) {
        H.fail(req, res, 404, "Conversation not found");
        return null;
      }
      return conv;
    };
    const anyFiles = (req, res, next) => ctx.upload.any()(req, res, (err) => (err ? H.fail(req, res, 400, err.message) : next()));
    const cleanup = (files) => (files || []).forEach((f) => fs.unlink(f.path, () => {}));

    // Users you can start a chat with ("All" tab of New Chat). Customers only for admins and salesmen.
    app.get("/api/conversations/users/available", (req, res) => {
      const me = H.currentUser(req, res);
      if (!me) return;
      const seesCustomers = H.isSuperAdmin(me) || me.userType === "admin" || me.userType === "salesman";
      const list = H.liveUsers()
        .filter((u) => u.id !== me.id && u.isActive && (seesCustomers || u.userType !== "customer"))
        .sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`))
        .map((u) => ({ id: u.id, email: u.email, username: u.username, firstName: u.firstName, lastName: u.lastName, avatar: u.avatar, userType: u.userType, isOnline: isOnline(u.id) }));
      H.send(res, list, "Available users fetched successfully");
    });

    app.get("/api/conversations", (req, res) => {
      const me = H.currentUser(req, res);
      if (!me) return;
      H.send(res, listFor(me.id, { page: req.query.page, limit: req.query.limit, search: req.query.search }), "Conversations fetched successfully");
    });

    app.post("/api/conversations", (req, res) => {
      const me = H.currentUser(req, res);
      if (!me) return;
      const pid = Number(req.body?.participantId);
      const other = H.findLiveUser(pid);
      if (!other) return H.fail(req, res, 404, "User not found");
      if (other.id === me.id) return H.fail(req, res, 400, "You cannot start a conversation with yourself");
      if (!other.isActive) return H.fail(req, res, 400, "This user is deactivated");
      let conv = conversations.find((c) => c.participants.includes(me.id) && c.participants.includes(other.id));
      if (conv) {
        conv.hiddenFor.delete(me.id);
        pushConversations(me.id);
        return H.send(res, conversationView(conv, me.id), "Conversation already exists");
      }
      const now = nowIso();
      // Hidden from the other person until the first message arrives.
      conv = { id: convSeq++, participants: [me.id, other.id], createdAt: now, lastActivityAt: now, hiddenFor: new Set([other.id]), clearedAt: {} };
      conversations.push(conv);
      pushConversations(me.id);
      H.send(res, conversationView(conv, me.id), "Conversation created successfully", 201);
    });

    app.get("/api/conversations/:id", (req, res) => {
      const me = H.currentUser(req, res);
      if (!me) return;
      const conv = findConv(req, res, me);
      if (!conv) return;
      H.send(res, conversationView(conv, me.id), "Conversation fetched successfully");
    });

    // "Delete chat": hides it and clears the history for the requester only.
    app.delete("/api/conversations/:id", (req, res) => {
      const me = H.currentUser(req, res);
      if (!me) return;
      const conv = findConv(req, res, me);
      if (!conv) return;
      conv.hiddenFor.add(me.id);
      conv.clearedAt[me.id] = nowIso();
      pushConversations(me.id);
      H.send(res, null, "Conversation deleted successfully");
    });

    app.post("/api/conversations/:id/mark-read", (req, res) => {
      const me = H.currentUser(req, res);
      if (!me) return;
      const conv = findConv(req, res, me);
      if (!conv) return;
      const n = markRead(conv, me.id);
      H.send(res, { conversationId: conv.id, markedCount: n }, "Conversation marked as read");
    });

    // Contact info sheet: partner + media / links / documents grouped by period (newest first).
    app.get("/api/conversations/:id/contact-info", (req, res) => {
      const me = H.currentUser(req, res);
      if (!me) return;
      const conv = findConv(req, res, me);
      if (!conv) return;
      const target = ["media", "links", "documents"].includes(req.query.target) ? req.query.target : "media";
      const p = identity.findUser(partnerId(conv, me.id));
      const groups = new Map();
      const push = (iso, key, item) => {
        const label = periodLabel(iso);
        if (!groups.has(label)) groups.set(label, { date: label, count: "0", items: [], documents: [], links: [] });
        groups.get(label)[key].push(item);
      };
      const msgs = visible(conv, me.id).filter((m) => !m.deletedAt).slice().reverse();
      for (const m of msgs) {
        if (target === "links") {
          for (const l of m.links) push(m.createdAt, "links", { id: String(l.id), url: l.url, title: l.title, description: l.description, imageUrl: l.imageUrl, domain: l.domain, isPreviewFetched: l.isPreviewFetched, messageId: String(m.id), createdAt: m.createdAt });
          continue;
        }
        for (const a of m.attachments) {
          const ext = extOf(a.filename);
          const isImage = IMAGE_EXT.includes(ext) || /^image\//.test(a.mimeType || "");
          if (target === "media" && isImage) push(m.createdAt, "items", { id: String(a.id), filename: a.filename, originalName: a.originalName, filePath: a.filePath, fileSize: humanSize(a.fileSize), mimeType: a.mimeType, type: "image", messageId: String(m.id), createdAt: m.createdAt });
          if (target === "documents" && !isImage) push(m.createdAt, "documents", { id: String(a.id), filename: a.filename, originalName: a.originalName, filePath: a.filePath, fileSize: humanSize(a.fileSize), mimeType: a.mimeType, type: ext || "file", messageId: String(m.id), createdAt: m.createdAt });
        }
      }
      const key = target === "media" ? "items" : target;
      const mediaByPeriod = [...groups.values()].map((g) => ({ ...g, count: String(g[key].length) }));
      H.send(res, {
        partner: p ? { id: String(p.id), firstName: p.firstName, lastName: p.lastName, avatar: p.avatar, email: p.email, username: p.username, userType: p.userType, isOnline: isOnline(p.id), lastSeenAt: lastSeenOf(p.id) } : null,
        target,
        mediaByPeriod,
      }, "Contact info fetched successfully");
    });

    // Page 1 = newest messages; each page is returned oldest -> newest (the UI prepends older pages).
    app.get("/api/conversations/:id/messages", (req, res) => {
      const me = H.currentUser(req, res);
      if (!me) return;
      const conv = findConv(req, res, me);
      if (!conv) return;
      const newestFirst = visible(conv, me.id).slice().reverse();
      const { items, meta } = util.paginate(newestFirst, req.query, { defaultLimit: 10 });
      H.send(res, { items: items.reverse().map(messageView), meta }, "Messages fetched successfully");
    });

    app.post("/api/conversations/:id/messages", anyFiles, (req, res) => {
      const me = H.currentUser(req, res);
      if (!me) return cleanup(req.files);
      const conv = findConv(req, res, me);
      if (!conv) return cleanup(req.files);
      const files = (req.files || []).filter((f) => /^(attachments|attachments\[\]|files|file)$/.test(f.fieldname));
      cleanup((req.files || []).filter((f) => !files.includes(f)));
      const content = H.trimStr(req.body?.content);
      if (files.length > MAX_FILES) {
        cleanup(files);
        return H.fail(req, res, 400, `You can attach up to ${MAX_FILES} files per message`);
      }
      const big = files.find((f) => f.size > MAX_FILE_BYTES);
      if (big) {
        cleanup(files);
        return H.fail(req, res, 400, `"${fixName(big.originalname)}" is larger than 10 MB`);
      }
      if (!content && !files.length) return H.fail(req, res, 400, "Message content or at least one attachment is required");
      if (content.length > 5000) {
        cleanup(files);
        return H.fail(req, res, 400, "Message is too long (max 5000 characters)");
      }
      const now = nowIso();
      const attachments = files.map((f) => ({ id: attSeq++, filename: f.filename, originalName: fixName(f.originalname), filePath: ctx.fileUrl(f.filename), fileSize: f.size, mimeType: f.mimetype, createdAt: now }));
      const allImages = attachments.length > 0 && attachments.every((a) => IMAGE_EXT.includes(extOf(a.filename)) || /^image\//.test(a.mimeType));
      let type = String(req.body?.type || "");
      if (!["text", "image", "file"].includes(type) || (type === "text" && attachments.length)) type = attachments.length ? (allImages ? "image" : "file") : "text";
      const m = createMessage(conv, me, { type, content, attachments });
      H.send(res, messageView(m), "Message sent successfully", 201);
    });

    app.post("/api/conversations/:id/messages/voice", anyFiles, (req, res) => {
      const me = H.currentUser(req, res);
      if (!me) return cleanup(req.files);
      const conv = findConv(req, res, me);
      if (!conv) return cleanup(req.files);
      const file = (req.files || []).find((f) => /^(voice|audio|file)$/.test(f.fieldname)) || (req.files || [])[0];
      cleanup((req.files || []).filter((f) => f !== file));
      if (!file) return H.fail(req, res, 400, "A voice file is required (field name: voice)");
      if (file.size > MAX_FILE_BYTES) {
        cleanup([file]);
        return H.fail(req, res, 400, "Voice notes must be smaller than 10 MB");
      }
      // MediaRecorder output is labelled "voice-….wav" but is usually WebM/Ogg: fix the extension so
      // /uploads serves the right Content-Type, and read the duration from real WAV headers.
      let filename = file.filename;
      let duration = null;
      try {
        const head = Buffer.alloc(64);
        const fd = fs.openSync(file.path, "r");
        fs.readSync(fd, head, 0, 64, 0);
        fs.closeSync(fd);
        const kind = head.subarray(0, 4).toString("latin1") === "RIFF" ? "wav" : head.readUInt32BE(0) === 0x1a45dfa3 ? "webm" : head.subarray(0, 4).toString("latin1") === "OggS" ? "ogg" : head.subarray(4, 8).toString("latin1") === "ftyp" ? "m4a" : /^ID3/.test(head.toString("latin1", 0, 3)) || (head[0] === 0xff && (head[1] & 0xe0) === 0xe0) ? "mp3" : null;
        if (kind === "wav") {
          const byteRate = head.readUInt32LE(28);
          if (byteRate > 0) duration = Math.max(1, Math.round((file.size - 44) / byteRate));
        }
        if (kind && extOf(filename) !== kind) {
          const renamed = filename.replace(/\.[^.]*$/, "") + `.${kind}`;
          fs.renameSync(file.path, path.join(ctx.uploadsDir, renamed));
          filename = renamed;
        }
        if (duration === null) duration = Math.max(1, Math.round(file.size / 16000)); // ~128 kbps estimate for compressed audio
      } catch (e) {
        S.log(`voice note inspection failed: ${e.message}`);
      }
      const m = createMessage(conv, me, { type: "voice", content: "", voiceFilePath: ctx.fileUrl(filename), voiceDuration: duration });
      H.send(res, messageView(m), "Voice message sent successfully", 201);
    });

    app.delete("/api/conversations/:id/messages/:messageId", (req, res) => {
      const me = H.currentUser(req, res);
      if (!me) return;
      const conv = findConv(req, res, me);
      if (!conv) return;
      const m = messages.find((x) => x.conversationId === conv.id && String(x.id) === String(req.params.messageId));
      if (!m) return H.fail(req, res, 404, "Message not found");
      if (m.senderId !== me.id) return H.fail(req, res, 403, "You can only delete your own messages");
      if (!m.deletedAt) {
        m.deletedAt = nowIso();
        m.updatedAt = m.deletedAt;
        everyone(conv)?.emit("message_deleted", { conversationId: conv.id, message: messageView(m) });
        pushConversations(conv.participants[0]);
        pushConversations(conv.participants[1]);
      }
      H.send(res, null, "Message deleted successfully");
    });
  }

  // ---------- socket.io "/chat" ----------
  function goOnline(socket) {
    const uid = socket.data.userId;
    socket.data.offline = false;
    if (!online.has(uid)) online.set(uid, new Set());
    const set = online.get(uid);
    const was = set.size > 0;
    set.add(socket.id);
    if (!was) {
      lastSeen.set(uid, nowIso());
      // Everything waiting for this person is now delivered.
      for (const m of messages) {
        if (m.status !== "sent" || m.senderId === uid) continue;
        const conv = conversations.find((c) => c.id === m.conversationId);
        if (conv && conv.participants.includes(uid)) m.status = "delivered";
      }
      S.nsp.emit("user_online", { userId: uid });
    }
  }
  function goOffline(socket) {
    const uid = socket.data.userId;
    const set = online.get(uid);
    if (!set || !set.delete(socket.id)) return;
    if (set.size === 0) {
      const at = nowIso();
      lastSeen.set(uid, at);
      S.nsp.emit("user_offline", { userId: uid, lastSeenAt: at });
    }
  }
  const convFor = (socket, payload) => {
    const id = Number(payload?.conversationId ?? payload);
    const conv = conversations.find((c) => c.id === id);
    return conv && conv.participants.includes(socket.data.userId) ? conv : null;
  };

  function attach(io) {
    const nsp = io.of("/chat");
    S.nsp = nsp;
    nsp.use((socket, next) => {
      const h = socket.handshake || {};
      const raw = h.auth?.token || h.query?.token || h.headers?.authorization || "";
      const u = identity.userFromToken(identity.tokenFrom({ headers: { authorization: String(raw) }, query: {} }));
      if (!u || !u.isActive || H.isDeleted(u)) return next(new Error("Unauthorized"));
      socket.data.userId = u.id;
      next();
    });
    nsp.on("connection", (socket) => {
      const uid = socket.data.userId;
      socket.join(userRoom(uid));
      goOnline(socket);

      socket.on("set_user_online", () => goOnline(socket));
      socket.on("set_user_offline", () => {
        socket.data.offline = true;
        goOffline(socket);
      });

      socket.on("join_conversation", (payload) => {
        const conv = convFor(socket, payload);
        if (!conv) return socket.emit("message_error", { error: "Conversation not found" });
        socket.join(room(conv.id));
        const pid = partnerId(conv, uid);
        if (isOnline(pid)) socket.emit("user_online", { userId: pid });
        else socket.emit("user_offline", { userId: pid, lastSeenAt: lastSeenOf(pid) });
        markRead(conv, uid);
        socket.emit("joined_conversation", { conversationId: conv.id });
      });
      socket.on("leave_conversation", (payload) => {
        const id = Number(payload?.conversationId ?? payload);
        if (id) socket.leave(room(id));
      });
      socket.on("mark_conversation_read", (payload) => {
        const conv = convFor(socket, payload);
        if (conv) markRead(conv, uid);
      });
      const typing = (isTyping) => (payload) => {
        const conv = convFor(socket, payload);
        if (!conv) return;
        socket.to(room(conv.id)).emit("user_typing", { userId: uid, conversationId: conv.id, isTyping });
      };
      socket.on("typing_start", typing(true));
      socket.on("typing_stop", typing(false));

      // Text messages over the socket (the REST endpoint is what the SOS UI uses).
      socket.on("send_message", (payload, ack) => {
        const conv = convFor(socket, payload);
        const me = identity.findUser(uid);
        const content = String(payload?.content || "").trim();
        const reply = (event, data) => (typeof ack === "function" ? ack(data) : socket.emit(event, data));
        if (!conv) return reply("message_error", { error: "Conversation not found" });
        if (!content) return reply("message_error", { error: "Message content is required" });
        const m = createMessage(conv, me, { type: "text", content: content.slice(0, 5000) });
        if (typeof ack === "function") ack({ success: true, message: messageView(m) });
      });

      socket.on("disconnect", () => goOffline(socket));
    });
    // Accept default-namespace connections too, so stray clients do not retry forever.
    io.on("connection", () => {});
  }

  function disconnectUser(uid) {
    if (!S.nsp) return;
    for (const s of [...S.nsp.sockets.values()]) if (s.data.userId === uid) s.disconnect(true);
  }

  return { register, attach, disconnectUser, stats: () => ({ conversations: conversations.length, messages: messages.length }) };
}

module.exports = { createChat };
