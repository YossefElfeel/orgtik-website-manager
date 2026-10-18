// /api/auth/* extras on top of the identity core (login, me, my-scopes, refresh, logout live in lib/identity.js).
const fs = require("fs");
const path = require("path");
const { nowIso, daysFromNow } = require("../../lib/util");
const { EMAIL_RE, MIN_PASSWORD, USER_TYPES } = require("./common");

const LOCAL_OTP = "123456"; // accepted for every existing account

// Pending invitations (only turned into identity users once accepted, so other apps never see half-made accounts).
const INVITES = [
  {
    token: "welcome-mariam-2026",
    invitedBy: "admin",
    invitee: { firstName: "Mariam", lastName: "Youssef", email: "mariam.youssef@orgtik.test", userType: "employee", jobTitle: "Junior Frontend Developer", department: "Engineering" },
    roles: [{ scope: "task_manager", name: "developer" }, { scope: "file_manager", name: "file_editor" }],
    scopes: ["task_manager", "file_manager"],
    createdDays: -2,
    expiresDays: 5,
  },
  {
    token: "welcome-khaled-2026",
    invitedBy: "sales",
    invitee: { firstName: "Khaled", lastName: "Mansour", email: "khaled.mansour@nilefoods.test", userType: "customer", jobTitle: "Procurement Manager", department: "Nile Foods" },
    roles: [{ scope: "sales", name: "customer" }],
    scopes: ["sales"],
    createdDays: -1,
    expiresDays: 2,
  },
  {
    token: "expired-invite-demo",
    invitedBy: "u10",
    invitee: { firstName: "Yara", lastName: "Samy", email: "yara.samy@orgtik.test", userType: "employee", jobTitle: "Recruiter", department: "Human Resources" },
    roles: [{ scope: "hr_system", name: "employee" }],
    scopes: ["hr_system"],
    createdDays: -10,
    expiresDays: -3,
  },
];

function register(app, S, H, R) {
  const viewAsLog = []; // D-017: who viewed as whom (in memory, reset with the mock)
  const { identity, ctx } = S;
  const invites = INVITES.map((i) => ({ ...i, createdAt: daysFromNow(i.createdDays), expiresAt: daysFromNow(i.expiresDays), acceptedAt: null, userId: null }));
  S.invites = invites;
  const otps = new Map(); // email -> { otp, expiresAt }

  const uploadAvatar = (req, res, next) => ctx.upload.single("avatar")(req, res, (err) => (err ? H.fail(req, res, 400, err.message) : next()));
  const removeFile = (url) => {
    if (!url || !String(url).includes("/uploads/")) return;
    const name = decodeURIComponent(String(url).split("/uploads/").pop() || "");
    if (!name || name.startsWith("seed-") || name.includes("/") || name.includes("\\")) return;
    fs.unlink(path.join(ctx.uploadsDir, name), () => {});
  };

  // ---------- profile ----------
  app.get("/api/auth/profile", (req, res) => {
    const u = H.currentUser(req, res);
    if (!u) return;
    // Fields also at the top level: the Sales profile page reads them there (the SOS app reads data).
    const view = H.profileView(u);
    H.send(res, view, "Profile fetched successfully", 200, view);
  });

  // SOS sends { profile: { jobTitle, department, about, language, flyoutToastMessage } }; other dashboards send flat fields.
  function updateProfile(req, res) {
    const u = H.currentUser(req, res);
    if (!u) return;
    const b = req.body || {};
    const p = { ...(b.profile && typeof b.profile === "object" ? b.profile : {}) };
    for (const k of ["jobTitle", "department", "language", "timeZone", "weekStartDay", "dateFormat", "timeFormat", "flyoutToastMessage", "timezoneChangeNotification", "about"])
      if (b[k] !== undefined && p[k] === undefined) p[k] = b[k];
    if (b.bio !== undefined && p.about === undefined) p.about = b.bio;
    for (const k of ["firstName", "lastName"]) {
      if (b[k] === undefined) continue;
      const v = H.trimStr(b[k]);
      if (!v) return H.fail(req, res, 400, `${k} should not be empty`, [`${k} should not be empty`]);
      u[k] = v;
    }
    if (b.username !== undefined) {
      const v = H.trimStr(b.username);
      if (!v) return H.fail(req, res, 400, "username should not be empty");
      if (identity.users.some((o) => o !== u && o.username.toLowerCase() === v.toLowerCase())) return H.fail(req, res, 409, "This username is already taken");
      u.username = v;
    }
    if (b.phone !== undefined) u.phone = H.trimStr(b.phone) || null;
    u.profile = u.profile || { id: u.id, createdAt: u.createdAt };
    const allowed = ["jobTitle", "department", "about", "language", "timeZone", "weekStartDay", "dateFormat", "timeFormat", "flyoutToastMessage", "timezoneChangeNotification"];
    for (const k of allowed) {
      if (p[k] === undefined) continue;
      u.profile[k] = typeof p[k] === "string" ? p[k].trim() || null : p[k];
    }
    if (!u.profile.language) u.profile.language = "en";
    u.profile.updatedAt = nowIso();
    u.updatedAt = nowIso();
    const view = H.profileView(u);
    H.send(res, view, "Profile updated successfully", 200, view);
  }
  app.put("/api/auth/profile", updateProfile);
  app.patch("/api/auth/profile", updateProfile);

  app.post("/api/auth/change-password", (req, res) => {
    const u = H.currentUser(req, res);
    if (!u) return;
    const b = req.body || {};
    const current = b.oldPassword ?? b.currentPassword ?? b.password;
    const next = String(b.newPassword || "");
    if (current !== undefined && !identity.passwordMatches(u, current)) return H.fail(req, res, 400, "Current password is incorrect");
    if (next.length < MIN_PASSWORD) return H.fail(req, res, 400, `Password must be at least ${MIN_PASSWORD} characters long`);
    identity.setPassword(u, next);
    u.updatedAt = nowIso();
    H.send(res, null, "Password changed successfully");
  });

  // ---------- avatar ----------
  app.post("/api/auth/avatar", uploadAvatar, (req, res) => {
    const u = H.currentUser(req, res);
    if (!u) {
      if (req.file) fs.unlink(req.file.path, () => {});
      return;
    }
    if (!req.file) return H.fail(req, res, 400, "Please choose an image file (field name: avatar)");
    if (!/^image\//.test(req.file.mimetype)) {
      fs.unlink(req.file.path, () => {});
      return H.fail(req, res, 400, "Invalid file type. Allowed: JPG, PNG, WEBP, GIF, SVG");
    }
    if (req.file.size > 5 * 1024 * 1024) {
      fs.unlink(req.file.path, () => {});
      return H.fail(req, res, 400, "File too large (max 5 MB)");
    }
    removeFile(u.avatar);
    u.avatar = ctx.fileUrl(req.file.filename);
    u.updatedAt = nowIso();
    // SOS reads { message, avatar }; other dashboards read (data.data || data).avatar.
    H.send(res, H.profileView(u), "Avatar uploaded successfully", 200, { avatar: u.avatar });
  });

  app.delete("/api/auth/avatar", (req, res) => {
    const u = H.currentUser(req, res);
    if (!u) return;
    removeFile(u.avatar);
    u.avatar = null;
    u.updatedAt = nowIso();
    H.send(res, H.profileView(u), "Avatar removed successfully", 200, { avatar: null });
  });

  // ---------- forgot / reset password (OTP 123456) ----------
  app.post("/api/auth/forgot-password", (req, res) => {
    const email = H.trimStr(req.body?.email).toLowerCase();
    if (!EMAIL_RE.test(email)) return H.fail(req, res, 400, "Please enter a valid email", ["email must be an email"]);
    const u = identity.findByEmail(email);
    if (u && !H.isDeleted(u)) {
      otps.set(email, { otp: LOCAL_OTP, expiresAt: Date.now() + 15 * 60 * 1000 });
      S.log(`password reset OTP for ${email}: ${LOCAL_OTP} (local mock, valid 15 minutes)`);
    }
    // Same answer for unknown emails (no account enumeration).
    const message = "If an account exists for this email, a verification code has been sent.";
    H.send(res, { message }, message);
  });

  // 123456 is valid for every existing account, whether or not /forgot-password was called first.
  function checkOtp(email, otp) {
    const u = identity.findByEmail(email);
    if (!u || H.isDeleted(u) || String(otp || "").trim() !== LOCAL_OTP) return { error: "Invalid or expired verification code" };
    return { user: u };
  }

  app.post("/api/auth/verify-otp", (req, res) => {
    const email = H.trimStr(req.body?.email).toLowerCase();
    const r = checkOtp(email, req.body?.otp);
    if (r.error) return H.fail(req, res, 400, r.error);
    H.send(res, { valid: true }, "Verification code is valid");
  });

  app.post("/api/auth/reset-password", (req, res) => {
    const b = req.body || {};
    const email = H.trimStr(b.email).toLowerCase();
    const password = String(b.newPassword ?? b.password ?? "");
    if (!EMAIL_RE.test(email)) return H.fail(req, res, 400, "Missing or invalid email. Please request a new code.");
    const r = checkOtp(email, b.otp);
    if (r.error) return H.fail(req, res, 400, r.error);
    if (password.length < MIN_PASSWORD) return H.fail(req, res, 400, `Password must be at least ${MIN_PASSWORD} characters long`);
    identity.setPassword(r.user, password);
    r.user.updatedAt = nowIso();
    otps.delete(email);
    const message = "Your password has been reset. You can now sign in.";
    H.send(res, { message }, message);
  });

  // ---------- invitations ----------
  const inviteMetadata = (inv) => {
    const by = identity.findByKey(inv.invitedBy);
    return {
      invitedBy: by ? { name: H.fullName(by), email: by.email } : null,
      invitee: {
        firstName: inv.invitee.firstName,
        lastName: inv.invitee.lastName,
        email: inv.invitee.email,
        userType: inv.invitee.userType,
        scopes: [...inv.scopes],
        roles: inv.roles.map((r) => ({ name: r.name, scope: r.scope })),
      },
      expiresAt: inv.expiresAt,
    };
  };
  const findInvite = (token) => invites.find((i) => i.token === String(token || "").trim());

  app.post("/api/auth/invite-metadata", (req, res) => {
    const inv = findInvite(req.body?.token);
    if (!inv) return H.fail(req, res, 404, "This invitation link is invalid, expired, or has already been used.");
    if (inv.acceptedAt) return H.fail(req, res, 410, "This invitation has already been accepted. Please sign in.");
    H.send(res, inviteMetadata(inv), "Invitation found");
  });

  app.post("/api/auth/accept-invite", (req, res) => {
    const inv = findInvite(req.body?.token);
    const password = String(req.body?.password || "");
    if (!inv) return H.fail(req, res, 404, "This invitation link is invalid, expired, or has already been used.");
    if (inv.acceptedAt) return H.fail(req, res, 410, "This invitation has already been accepted. Please sign in.");
    if (new Date(inv.expiresAt).getTime() < Date.now()) return H.fail(req, res, 400, "This invitation has expired. Please ask your administrator for a new one.");
    if (password.length < MIN_PASSWORD) return H.fail(req, res, 400, `Password must be at least ${MIN_PASSWORD} characters long`);
    if (identity.users.some((u) => !H.isDeleted(u) && u.email.toLowerCase() === inv.invitee.email.toLowerCase()))
      return H.fail(req, res, 409, "An account with this email already exists. Please sign in.");
    const u = S.people.createIdentityUser({
      ...inv.invitee,
      userType: USER_TYPES.includes(inv.invitee.userType) ? inv.invitee.userType : "employee",
      username: inv.invitee.email.split("@")[0].replace(/[^\w.]+/g, "."),
      password,
      keyPrefix: "sos-inv",
      isActive: true,
    });
    R.addScope(u, "global");
    for (const s of inv.scopes) R.addScope(u, s);
    for (const r of inv.roles) R.addRole(u, R.ensureRole(r.scope, r.name));
    inv.acceptedAt = nowIso();
    inv.userId = u.id;
    H.send(res, H.personView(u), "Invitation accepted successfully. You can now sign in.");
  });

  // ---------- impersonation ("Login as" on the People page) ----------
  app.post("/api/auth/login-as/:userId", (req, res) => {
    const admin = H.adminUser(req, res);
    if (!admin) return;
    const target = H.findLiveUser(req.params.userId);
    if (!target) return H.fail(req, res, 404, "User not found");
    if (target.id === admin.id) return H.fail(req, res, 400, "You are already signed in as this user");
    if (!target.isActive) return H.fail(req, res, 400, "This user is deactivated and cannot be impersonated");
    // An admin already impersonating keeps the original admin as the impersonator.
    const claims = identity.decode(identity.tokenFrom(req)) || {};
    const original = claims.impersonatedBy || { id: admin.id, email: admin.email, firstName: admin.firstName, lastName: admin.lastName, username: admin.username };
    // D-017: "View as" replaces "Login as": the session is read-only, and every start is recorded.
    const payload = identity.authPayload(target, { impersonatedBy: original, readOnly: true });
    viewAsLog.unshift({ at: new Date().toISOString(), by: original.email, viewed: target.email });
    S.log(`${original.email} is viewing as ${target.email} (read-only)`);
    H.send(res, payload, `You are viewing as ${H.fullName(target)}`);
  });

  // Who viewed as whom, newest first (admins only).
  app.get("/api/auth/view-as/log", (req, res) => {
    const admin = H.adminUser(req, res);
    if (!admin) return;
    H.send(res, viewAsLog.slice(0, 200), "View-as log");
  });

  // Leaving "view as": the admin's own session comes back from the server (nothing is kept in the browser).
  app.post("/api/auth/exit-impersonation", (req, res) => {
    const claims = identity.decode(identity.tokenFrom(req));
    if (!claims) return H.fail(req, res, 401, "Unauthorized");
    if (!claims.impersonatedBy) return H.fail(req, res, 400, "This session is not an impersonation session");
    const admin = H.findLiveUser(claims.impersonatedBy.id);
    if (!admin || !admin.isActive) return H.fail(req, res, 404, "The original admin account is no longer available");
    H.send(res, identity.authPayload(admin), "Returned to your account");
  });
}

module.exports = { register, LOCAL_OTP, INVITES };
