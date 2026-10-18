// Canonical account creation shared by the suite and Website Manager. Callers enforce authorization.
const { nowIso } = require("./util");
function createIdentityUser(identity, d) {
  const id =
    identity.users.reduce((m, u) => Math.max(m, Number(u.id) || 0), 0) + 1;
  const now = nowIso();
  for (const user of identity.users)
    if (user.deletedAt && user.email.toLowerCase() === d.email.toLowerCase())
      user.email = `deleted-${user.id}.${user.email}`;
  const u = {
    id,
    key: `${d.keyPrefix || "sos-u"}${id}`,
    email: String(d.email).toLowerCase(),
    username: d.username,
    firstName: d.firstName,
    lastName: d.lastName,
    avatar: null,
    isActive: d.isActive !== false,
    isEmailVerified: true,
    managerId: null,
    userType: d.userType ?? null,
    phone: d.phone || null,
    password: d.password,
    createdAt: now,
    updatedAt: now,
    profile: {
      id,
      jobTitle: d.jobTitle || null,
      department: d.department || null,
      about: d.bio || null,
      language: d.language || "en",
      timeZone: "Africa/Cairo",
      weekStartDay: "saturday",
      dateFormat: "DD/MM/YYYY",
      timeFormat: "24h",
      flyoutToastMessage: true,
      timezoneChangeNotification: true,
      createdAt: now,
      updatedAt: now,
    },
  };
  for (const k of ["address", "city", "country"])
    if (d[k]) u[k] = String(d[k]).trim();
  identity.setPassword(u, d.password);
  identity.users.push(u);
  return u;
}

module.exports = { createIdentityUser };
