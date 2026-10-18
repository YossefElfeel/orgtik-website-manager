// Seed data for the HR mock. Everything is deterministic (seeded PRNG) and anchored on "today" in Cairo.
const { createStore, seeded } = require("../../lib/util");
const L = require("./lib");
const TABLES = ["departments", "employees", "attachments", "notes", "timeOffs", "meetings", "runs", "items", "adjustments", "loanApps", "loans", "importBatches", "jobs", "applications", "stages", "appointments", "appNotes", "tickets", "messages", "notifications", "logs"];

const COMPANY = {
  name: "OrgTik Egypt",
  address: "Building B12, Smart Village, 6th of October, Giza",
};

// Egyptian public holidays 2026 (Islamic dates are the expected astronomical dates).
const HOLIDAYS_2026 = [
  ["2026-01-07", "Coptic Christmas"],
  ["2026-01-25", "January 25 Revolution & Police Day"],
  ["2026-03-20", "Eid al-Fitr"],
  ["2026-03-21", "Eid al-Fitr (Day 2)"],
  ["2026-03-22", "Eid al-Fitr (Day 3)"],
  ["2026-04-13", "Sham El-Nessim"],
  ["2026-04-25", "Sinai Liberation Day"],
  ["2026-05-01", "Labour Day"],
  ["2026-05-26", "Arafat Day"],
  ["2026-05-27", "Eid al-Adha"],
  ["2026-05-28", "Eid al-Adha (Day 2)"],
  ["2026-05-29", "Eid al-Adha (Day 3)"],
  ["2026-06-16", "Islamic New Year"],
  ["2026-06-30", "June 30 Revolution"],
  ["2026-07-23", "July 23 Revolution Day"],
  ["2026-08-25", "Prophet's Birthday"],
  ["2026-10-06", "Armed Forces Day"],
];

const DEPARTMENTS = [
  { id: 1, name: "Engineering", description: "Builds and runs the OrgTik platform: web apps, backend services and infrastructure.", managerKey: "u15", createdAt: "2023-01-15" },
  { id: 2, name: "Design", description: "Product and brand design, UX research and the OrgTik design system.", managerKey: "u8", createdAt: "2026-09-03" },
  { id: 3, name: "Sales", description: "Acquires and grows B2B accounts across Egypt and the Gulf.", managerKey: "u13", createdAt: "2023-02-01" },
  { id: 4, name: "Marketing", description: "Brand, content, performance marketing and events.", managerKey: "u12", createdAt: "2023-03-12" },
  { id: 5, name: "Finance", description: "Accounting, payroll disbursement, budgeting and financial reporting.", managerKey: "finance", createdAt: "2023-01-20" },
  { id: 6, name: "Human Resources", description: "Recruitment, onboarding, people operations and payroll preparation.", managerKey: "u10", createdAt: "2023-01-18" },
  { id: 7, name: "Operations", description: "Business operations, vendors, facilities and IT equipment.", managerKey: "manager", createdAt: "2023-01-10" },
  { id: 8, name: "Management", description: "Executive leadership team.", managerKey: "admin", createdAt: "2023-01-05" },
];

const BANKS = {
  CIB: { name: "Commercial International Bank (CIB)", code: "CIBEEGCX", iban: "0010" },
  NBE: { name: "National Bank of Egypt", code: "NBEGEGCX", iban: "0003" },
  BM: { name: "Banque Misr", code: "BMISEGCX", iban: "0002" },
  QNB: { name: "QNB Alahli", code: "QNBAEGCX", iban: "0037" },
  HSBC: { name: "HSBC Bank Egypt", code: "EBBKEGCX", iban: "0030" },
};

// HR record for every staff member in identity (the customer is not an employee).
// alw = [housing, transport, other], each [value, type]; ins/tax = [value, type].
const STAFF = {
  admin: { gender: "female", dob: "1982-04-14", dept: 8, mgr: null, type: "full_time", loc: "onsite", status: "active", exp: "principal", join: "2023-01-05", base: 180000, alw: [[15, "percentage"], [5000, "fixed"], [5, "percentage"]], tax: [22.5, "percentage"], pay: ["bank", "CIB"], cycle: "monthly", city: "New Cairo", street: "Villa 14, Street 90, 5th Settlement", post: "11835", skills: ["Leadership", "Strategy", "Fundraising"], annual: 30, contractAdds: 5, notice: "90_days" },
  manager: { gender: "male", dob: "1986-11-02", dept: 7, mgr: "admin", type: "full_time", loc: "onsite", status: "active", exp: "senior_level", join: "2023-01-10", base: 85000, alw: [[12, "percentage"], [3000, "fixed"], [0, "percentage"]], tax: [20, "percentage"], pay: ["bank", "NBE"], cycle: "monthly", city: "Dokki, Giza", street: "22 Mosadak St, Dokki", post: "12611", skills: ["Operations", "Vendor management", "hr_ops"], annual: 25, contractAdds: 2, notice: "60_days" },
  employee: { gender: "female", dob: "1996-07-21", dept: 1, mgr: "u15", type: "full_time", loc: "hybrid", status: "active", exp: "mid_level", join: "2024-03-03", base: 38000, alw: [[10, "percentage"], [1500, "fixed"], [0, "percentage"]], tax: [15, "percentage"], pay: ["instapay"], cycle: "monthly", city: "Nasr City, Cairo", street: "8 Makram Ebeid St, Nasr City", post: "11765", skills: ["frontend", "ui"], annual: 21, contractAdds: 0, notice: "30_days" },
  sales: { gender: "male", dob: "1998-02-11", dept: 3, mgr: "u13", type: "full_time", loc: "onsite", status: "active", exp: "junior", join: "2024-10-06", base: 22000, alw: [[10, "percentage"], [1200, "fixed"], [0, "percentage"]], tax: [10, "percentage"], pay: ["instapay"], cycle: "monthly", city: "Maadi, Cairo", street: "15 Road 9, Maadi", post: "11728", skills: ["Negotiation", "CRM", "Cold calling"], annual: 21, contractAdds: 0, notice: "30_days" },
  finance: { gender: "male", dob: "1984-09-30", dept: 5, mgr: "admin", type: "full_time", loc: "onsite", status: "active", exp: "senior_level", join: "2023-02-01", base: 72000, alw: [[12, "percentage"], [2500, "fixed"], [0, "percentage"]], tax: [20, "percentage"], pay: ["bank", "BM"], cycle: "monthly", city: "Heliopolis, Cairo", street: "31 El Merghany St, Heliopolis", post: "11757", skills: ["Financial reporting", "IFRS", "Payroll"], annual: 25, contractAdds: 2, notice: "60_days" },
  u7: { gender: "male", dob: "1993-12-05", dept: 1, mgr: "u15", type: "full_time", loc: "remote", status: "active", exp: "senior_level", join: "2023-06-11", base: 42000, alw: [[10, "percentage"], [1500, "fixed"], [0, "percentage"]], tax: [15, "percentage"], pay: ["bank", "CIB"], cycle: "monthly", city: "Smouha, Alexandria", street: "44 Victor Emmanuel St, Smouha", post: "21615", skills: ["backend", "frontend"], annual: 21, contractAdds: 0, notice: "30_days" },
  u8: { gender: "female", dob: "1997-03-27", dept: 2, mgr: "u15", type: "full_time", loc: "hybrid", status: "active", exp: "mid_level", join: "2024-05-19", base: 34000, alw: [[10, "percentage"], [1500, "fixed"], [0, "percentage"]], tax: [15, "percentage"], pay: ["instapay"], cycle: "monthly", city: "Sheikh Zayed, Giza", street: "Beverly Hills Compound, Bldg 7", post: "12588", skills: ["ui", "ux"], annual: 21, contractAdds: 0, notice: "30_days" },
  u9: { gender: "male", dob: "1995-08-15", dept: 1, mgr: "u15", type: "contract", loc: "onsite", status: "active", exp: "mid_level", join: "2025-02-02", base: 26000, alw: [[0, "percentage"], [1000, "fixed"], [0, "percentage"]], tax: [10, "percentage"], pay: ["wallet", "orange"], cycle: "biweekly", city: "Shubra, Cairo", street: "102 Shubra St", post: "11241", skills: ["backend"], annual: 15, contractAdds: 0, notice: "15_days", contractType: "fixed_term" },
  u10: { gender: "female", dob: "1994-01-19", dept: 6, mgr: "manager", type: "full_time", loc: "onsite", status: "active", exp: "mid_level", join: "2023-04-02", base: 32000, alw: [[10, "percentage"], [1500, "fixed"], [0, "percentage"]], tax: [15, "percentage"], pay: ["bank", "NBE"], cycle: "monthly", city: "Heliopolis, Cairo", street: "9 Baghdad St, Korba, Heliopolis", post: "11757", skills: ["hr_ops"], annual: 21, contractAdds: 0, notice: "30_days" },
  u11: { gender: "male", dob: "1991-06-09", dept: 1, mgr: "u15", type: "contract", loc: "remote", status: "active", exp: "senior_level", join: "2024-08-04", base: 45000, alw: [[0, "percentage"], [0, "fixed"], [0, "percentage"]], tax: [15, "percentage"], pay: ["bank", "QNB"], cycle: "biweekly", city: "Mansoura", street: "17 El Gomhoria St", post: "35511", skills: ["backend"], annual: 15, contractAdds: 0, notice: "15_days", contractType: "fixed_term" },
  u12: { gender: "female", dob: "1996-10-08", dept: 4, mgr: "manager", type: "full_time", loc: "hybrid", status: "active", exp: "mid_level", join: "2024-01-14", base: 28000, alw: [[10, "percentage"], [1200, "fixed"], [0, "percentage"]], tax: [12.5, "percentage"], pay: ["instapay"], cycle: "monthly", city: "Zamalek, Cairo", street: "5 Hassan Sabry St, Zamalek", post: "11211", skills: ["SEO", "Paid social", "Copywriting"], annual: 21, contractAdds: 0, notice: "30_days" },
  u13: { gender: "male", dob: "1990-05-23", dept: 3, mgr: "manager", type: "full_time", loc: "onsite", status: "active", exp: "senior_level", join: "2023-09-17", base: 36000, alw: [[10, "percentage"], [2000, "fixed"], [0, "percentage"]], tax: [15, "percentage"], pay: ["bank", "HSBC"], cycle: "monthly", city: "New Cairo", street: "Mivida Compound, Parcel 22", post: "11835", skills: ["Key accounts", "Negotiation", "CRM"], annual: 21, contractAdds: 0, notice: "30_days" },
  u14: { gender: "female", dob: "1999-06-30", dept: 4, mgr: "u12", type: "part_time", loc: "remote", status: "active", exp: "junior", join: "2025-06-01", base: 12000, alw: [[0, "percentage"], [0, "fixed"], [0, "percentage"]], tax: [5, "percentage"], pay: ["wallet", "vodafone"], cycle: "weekly", city: "Mansoura", street: "3 Ahmed Maher St", post: "35516", skills: ["Copywriting", "Arabic content", "SEO"], annual: 10, contractAdds: 0, notice: "15_days", contractType: "fixed_term" },
  u15: { gender: "male", dob: "1988-02-17", dept: 1, mgr: "admin", type: "full_time", loc: "onsite", status: "active", exp: "lead", join: "2023-03-05", base: 78000, alw: [[12, "percentage"], [3000, "fixed"], [0, "percentage"]], tax: [20, "percentage"], pay: ["bank", "QNB"], cycle: "monthly", city: "New Cairo", street: "Street 300, 5th Settlement", post: "11835", skills: ["frontend", "backend", "Scrum"], annual: 25, contractAdds: 2, notice: "60_days" },
  u16: { gender: "female", dob: "2000-11-12", dept: 5, mgr: "finance", type: "full_time", loc: "onsite", status: "probation", exp: "junior", join: "2026-08-02", base: 21000, alw: [[10, "percentage"], [1000, "fixed"], [0, "percentage"]], tax: [10, "percentage"], pay: ["bank", "BM"], cycle: "monthly", city: "Nasr City, Cairo", street: "27 Abbas El Akkad St, Nasr City", post: "11765", skills: ["Accounting", "Excel", "Payroll"], annual: 21, contractAdds: 0, notice: "30_days", training: "3_months", incomplete: ["attachments"] },
};

const ALL_STEPS = ["user_base_info", "employee_info", "payment_method", "salary", "contract", "days_off", "permissions", "attachments"];

function defaultContract(first, last, join, s) {
  return [
    { id: "clause-1", title: "Position & duties", content: `<p>1.1 This Employment Agreement is executed on ${join} between ${COMPANY.name}, a company incorporated under the laws of the Arab Republic of Egypt, and ${first} ${last}.</p><p>1.2 The Employee shall perform the duties of the position with diligence and in line with company policies.</p>`, order: 1 },
    { id: "clause-2", title: "Term and probation", content: `<p>2.1 Employment commences on ${join}.</p><p>2.2 The Employee is subject to a probation period of three (3) months in accordance with Egyptian Labour Law No. 14 of 2025.</p>`, order: 2 },
    { id: "clause-3", title: "Compensation", content: `<p>3.1 Monthly base salary: EGP ${L.money(s.base)}, paid on the last working day of each ${s.cycle === "monthly" ? "month" : s.cycle === "weekly" ? "week" : "two weeks"}.</p><p>3.2 Social insurance and income tax are deducted at source.</p>`, order: 3 },
    { id: "clause-4", title: "Signature", content: "<p>For The Company : ________________________</p><p>For The Employee : ________________________</p>", order: 4 },
  ];
}

function calcSalary(sal) {
  const base = Number(sal.baseSalary) || 0;
  const part = (v, t, of) => (t === "percentage" ? (of * (Number(v) || 0)) / 100 : Number(v) || 0);
  const total = base + part(sal.housingAllowanceValue, sal.housingAllowanceType, base) + part(sal.transportationAllowanceValue, sal.transportationAllowanceType, base) + part(sal.otherAllowancesValue, sal.otherAllowancesType, base);
  const net = total - part(sal.insuranceValue, sal.insuranceType, total) - part(sal.taxValue, sal.taxType, total);
  return { totalSalary: L.round2(total), netSalary: L.round2(net) };
}

function buildDb({ identity, config }) {
  const API = config.apiUrl("hr");
  const seedUrl = (file) => `${API}/uploads/seed/${file}`;
  const TODAY = L.todayStr();
  const NOW = new Date();
  const userByKey = (k) => identity.findByKey(k);
  const uid = (k) => userByKey(k).id;
  const rnd = seeded(20260929);

  const db = {
    company: { ...COMPANY },
    today: TODAY,
    seedUrl,
    calcSalary,
    departments: createStore([]),
    employees: createStore([]),
    attachments: createStore([]),
    notes: createStore([]),
    sessions: [],
    voiceLeaves: [],
    timeOffs: createStore([]),
    meetings: createStore([]),
    runs: createStore([]),
    items: createStore([{ id: 1000 }]),
    adjustments: createStore([{ id: 50000 }]),
    loanApps: createStore([{ id: 70000 }]),
    loans: createStore([]),
    importBatches: createStore([]),
    jobs: createStore([]),
    applications: createStore([]),
    stages: createStore([]),
    appointments: createStore([]),
    appNotes: createStore([]),
    tickets: createStore([{ id: 1000 }]),
    messages: createStore([]),
    notifications: createStore([]),
    logs: createStore([]),
    seedDocs: {}, // file name -> { kind, ...data } for /uploads/seed/*
    settings: null,
    projects: [],
    ownershipTransfers: {},
  };
  // stores seeded with a dummy row to push their id sequence; drop the dummy.
  for (const s of [db.items, db.adjustments, db.loanApps, db.tickets]) s.remove(s.rows[0].id);

  const log = (action, entityType, entityId, performedBy, metadata, createdAt) =>
    db.logs.insert({ action, entityType, entityId: String(entityId), performedBy, metadata: metadata || {}, createdAt, updatedAt: createdAt });

  // ---------------- settings ----------------
  db.settings = {
    companyProfile: { avatar: null, companyName: COMPANY.name, preferredLanguage: "en", phoneNumber: "+20 2 3537 1100", emailAddress: "hr@orgtik.test", location: COMPANY.address },
    attendance: {
      schedule: { effectiveFrom: "01-01-2026", workingDays: [7, 1, 2, 3, 4], dayStartTime: "09:00", dayEndTime: "17:00", gracePeriodMinutes: 15 },
      publicHolidays: HOLIDAYS_2026.map(([date, name]) => ({ name, date: L.toDmy(date) })),
    },
  };

  // ---------------- departments ----------------
  for (const d of DEPARTMENTS) {
    const created = L.cairoIso(d.createdAt, 10, 0);
    db.departments.rows.push({ id: d.id, name: d.name, description: d.description, managerUserId: uid(d.managerKey), budget: null, createdAt: created, updatedAt: created, deletedAt: null });
  }

  // ---------------- employees ----------------
  const staffUsers = identity.users.filter((u) => STAFF[u.key]);
  for (const u of staffUsers) {
    const s = STAFF[u.key];
    const id = u.id;
    const alw = s.alw;
    const salary = {
      baseSalary: s.base,
      housingAllowanceValue: alw[0][0], housingAllowanceType: alw[0][1],
      transportationAllowanceValue: alw[1][0], transportationAllowanceType: alw[1][1],
      otherAllowancesValue: alw[2][0], otherAllowancesType: alw[2][1],
      insuranceValue: 11, insuranceType: "percentage",
      taxValue: s.tax[0], taxType: s.tax[1],
      currency: "EGP",
    };
    const holder = `${u.firstName} ${u.lastName}`;
    const acct = `1000${String(3276540 + id * 7919).slice(0, 8)}`;
    const payment = { paymentMethod: s.pay[0], paymentCycle: s.cycle, bank: null, instapay: null, wallet: null };
    if (s.pay[0] === "bank") {
      const b = BANKS[s.pay[1]];
      payment.bank = { bankName: b.name, bankCode: b.code, accountNumber: acct, iban: `EG${String(10 + ((id * 37) % 89))}${b.iban}${String(1000 + id * 13).slice(0, 4)}${String(acct).padStart(17, "0")}`, accountHolder: holder, currency: "EGP", paymentCycle: s.cycle };
    } else if (s.pay[0] === "instapay") {
      payment.instapay = { registeredNumber: u.phone.replace("+20", "0"), accountName: holder, linkedAccount: `${u.firstName.toLowerCase()}.${u.lastName.toLowerCase()}@instapay`, paymentCycle: s.cycle };
    } else {
      const prefix = { vodafone: "010", orange: "012", etisalat: "011", we: "015" }[s.pay[1]];
      payment.wallet = { walletName: s.pay[1], phoneNumber: `${prefix}${String(20000000 + id * 104729).slice(0, 8)}`, accountName: holder, paymentCycle: s.cycle };
    }
    const joinIso = L.cairoIso(s.join, 9, 30);
    const { totalSalary, netSalary } = calcSalary(salary);
    const history = [];
    // A raise one year after joining (if applicable) gives the "salary upgrade history" table content.
    const firstYear = L.addDays(s.join, 365);
    if (firstYear < TODAY) {
      const old = { ...salary, baseSalary: Math.round((s.base / 1.15) / 500) * 500 };
      history.push({ id: id * 10 + 1, ...old, paymentMethod: s.pay[0], ...calcSalary(old), changedByUserId: uid("u10"), recordedAt: joinIso });
      history.push({ id: id * 10 + 2, ...salary, paymentMethod: s.pay[0], totalSalary, netSalary, changedByUserId: uid("u10"), recordedAt: L.cairoIso(firstYear, 11, 0) });
    } else {
      history.push({ id: id * 10 + 1, ...salary, paymentMethod: s.pay[0], totalSalary, netSalary, changedByUserId: uid("u10"), recordedAt: joinIso });
    }
    const initials = `${u.firstName[0]}${u.lastName[0]}`;
    db.seedDocs[`avatar-${id}.svg`] = { kind: "avatar", initials, seed: id };
    const completedSteps = ALL_STEPS.filter((st) => !(s.incomplete || []).includes(st));
    db.employees.rows.push({
      id, authUserId: id, userKey: u.key,
      employeeCode: `EMP-${1000 + id}`,
      firstName: u.firstName, lastName: u.lastName, email: u.email, phoneNumber: u.phone,
      birthday: s.dob, gender: s.gender, nationality: "EG", nationalIdOrPassport: `${s.dob[2] === "0" ? 3 : 2}${s.dob.slice(2, 4)}${s.dob.slice(5, 7)}${s.dob.slice(8, 10)}${s.city.includes("Giza") ? "21" : s.city.includes("Alex") ? "02" : s.city.includes("Mansoura") ? "12" : "01"}${String(1000 + id * 37).slice(-4)}${id % 10}`,
      personalTaxId: `${500 + id}-${String(100 + id * 7).slice(-3)}-${String(300 + id * 11).slice(-3)}`,
      accommodationType: "own_accommodation",
      address: { country: "EG", city: s.city, street: s.street, postCode: s.post },
      jobTitle: u.profile.jobTitle, departmentId: s.dept, managerId: s.mgr ? uid(s.mgr) : null,
      employeeType: s.type, workLocation: s.loc, status: s.status, experienceLevel: s.exp, joinDate: s.join, skills: s.skills,
      payment, salary, salaryHistory: history,
      daysOff: { annualLeave: s.annual, casualLeave: 6, sickLeave: 15, unpaidLeavePolicy: s.type === "full_time" ? "allowed" : "not_allowed", contractAdds: s.contractAdds },
      contract: { contractType: s.contractType || "permanent", startDate: s.join, endDate: s.contractType === "fixed_term" ? L.addDays(s.join, 729) : null, trainingPeriod: s.training || "3_months", noticePeriod: s.notice, sendForSignature: false, companyLogoFileId: null, contractSections: defaultContract(u.firstName, u.lastName, s.join, s) },
      permissions: { roleIds: [], scopeDepartmentIds: [], scopeEntityIds: [], customPermissions: [] },
      completedSteps, onboardingComplete: completedSteps.length === ALL_STEPS.length,
      avatarUrl: seedUrl(`avatar-${id}.svg`),
      isActive: true,
      discordUserId: `11892${String(4401557 + id * 104723).padStart(9, "0")}${String(id).padStart(4, "0")}`,
      discordUsername: `${u.firstName.toLowerCase()}.${u.lastName.toLowerCase()}`,
      lastMessaged: null, lastClockedIn: null,
      createdAt: joinIso, updatedAt: joinIso, deletedAt: null,
    });
  }
  const emp = (key) => db.employees.find(uid(key));
  const empName = (e) => `${e.firstName} ${e.lastName}`;

  // seeded attachments (national id, contract, degree)
  for (const e of db.employees.rows) {
    const docs = [
      ["National ID (front & back)", "national-id"],
      ["Signed employment contract", "contract"],
      ["University degree certificate", "degree"],
    ];
    if (e.completedSteps.includes("attachments")) {
      docs.forEach(([title, slug], i) => {
        const fileName = `${slug}-${e.firstName.toLowerCase()}-${e.lastName.toLowerCase()}.pdf`;
        const file = `att-${e.id}-${slug}.pdf`;
        db.seedDocs[file] = { kind: "doc", title, subtitle: `${empName(e)} - ${e.employeeCode}`, lines: [`Employee: ${empName(e)}`, `Document: ${title}`, `Uploaded during onboarding on ${e.joinDate}`] };
        db.attachments.insert({ employeeId: e.id, fileName, filePath: `uploads/seed/${file}`, url: seedUrl(file), mimeType: "application/pdf", fileSize: 180000 + e.id * 5231 + i * 77123, category: slug, uploadedAt: L.cairoIso(e.joinDate, 12, 10 + i) });
      });
    }
    log("created", "Employee", e.id, e.joinDate < "2023-04-02" ? uid("admin") : uid("u10"), { employeeCode: e.employeeCode }, e.createdAt);
  }

  // employee notes
  const note = (key, byKey, content, date) => db.notes.insert({ employeeId: uid(key), createdByUserId: uid(byKey), content, createdAt: L.cairoIso(date, 13, 5), updatedAt: L.cairoIso(date, 13, 5) });
  note("employee", "u15", "Salma led the migration of the attendance dashboard to the new design system. Strong ownership, ready for a senior track review in Q1.", "2026-08-30");
  note("employee", "u10", "Discussed flexible hours for Thursdays (university course). Approved until end of the semester.", "2026-09-10");
  note("u16", "u10", "Probation check-in (week 4): onboarding going well, needs access to the ERP accounts module.", "2026-08-30");
  note("u16", "finance", "Took over the petty cash reconciliation. Accurate and fast.", "2026-09-20");
  note("u7", "u15", "Covered on-call during the August 15 outage - consider for the on-call bonus pool.", "2026-08-17");
  note("sales", "u13", "Great month in September: 3 new SMB accounts. Needs coaching on discount approvals.", "2026-09-27");

  // ---------------- time off ----------------
  const workDaysIn = (from, to) => L.dateRange(from, to).filter((d) => [0, 1, 2, 3, 4].includes(L.weekday(d)) && !HOLIDAYS_2026.some(([h]) => h === d));
  const TO = [];
  const addTO = (o) => TO.push(o);
  // [key, type, durationType, start, end, status, mgrStatus, hrStatus, note, created, extra]
  addTO({ key: "employee", type: "annual_leave", dt: "full_day", s: "2026-08-09", e: "2026-08-13", mgr: "approved", hr: "approved", note: "Summer trip to Dahab with family.", created: "2026-07-26" });
  addTO({ key: "u7", type: "sick_leave", dt: "full_day", s: "2026-09-07", e: "2026-09-08", mgr: "approved", hr: "approved", note: "Flu - medical report attached.", created: "2026-09-07", files: ["medical-report-youssef.pdf"] });
  addTO({ key: "sales", type: "personal_leave", dt: "half_day", half: "morning", s: "2026-09-16", e: "2026-09-16", mgr: "approved", hr: "approved", note: "Renewing my national ID at the civil registry.", created: "2026-09-13" });
  addTO({ key: "u12", type: "vacation_day", dt: "full_day", s: "2026-09-10", e: "2026-09-10", mgr: "approved", hr: "approved", note: "Sister's engagement.", created: "2026-09-02" });
  addTO({ key: "u13", type: "annual_leave", dt: "full_day", s: "2026-08-23", e: "2026-08-27", mgr: "approved", hr: "approved", note: "Family vacation in the North Coast.", created: "2026-08-05" });
  addTO({ key: "u11", type: "medical_appointment", dt: "partial", s: "2026-09-22", e: "2026-09-22", ps: "11:00", pe: "13:00", mgr: "approved", hr: "approved", note: "Dentist appointment.", created: "2026-09-20" });
  addTO({ key: "u8", type: "annual_leave", dt: "full_day", s: "2026-10-11", e: "2026-10-15", mgr: "approved", hr: "approved", note: "Rescheduled trip after the design system launch.", created: "2026-09-24" });
  addTO({ key: "finance", type: "training_day", dt: "full_day", s: "2026-09-24", e: "2026-09-24", mgr: "approved", hr: "approved", note: "CFA Society Egypt workshop.", created: "2026-09-15" });
  addTO({ key: "u9", type: "annual_leave", dt: "full_day", s: "2026-10-04", e: "2026-10-08", mgr: "pending", hr: "pending", note: "Visiting family in Aswan.", created: "2026-09-27" });
  addTO({ key: "employee", type: "personal_leave", dt: "full_day", s: "2026-10-01", e: "2026-10-01", mgr: "pending", hr: "pending", note: "Moving to a new apartment.", created: "2026-09-28" });
  addTO({ key: "u14", type: "sick_leave", dt: "full_day", s: TODAY, e: TODAY, mgr: "pending", hr: "pending", note: "Fever since last night, will send the doctor's note.", created: TODAY, createdTime: [8, 10], files: ["doctor-note-hoda.pdf"] });
  addTO({ key: "u10", type: "annual_leave", dt: "full_day", s: "2026-10-18", e: "2026-10-20", mgr: "pending", hr: "pending", note: "Short break after the Q3 payroll close.", created: "2026-09-26" });
  addTO({ key: "u7", type: "annual_leave", dt: "full_day", s: "2026-10-25", e: "2026-10-29", mgr: "approved", hr: "pending", note: "Umrah trip.", created: "2026-09-21", mgrNote: "Approved - please hand over the payments service on-call." });
  addTO({ key: "sales", type: "unpaid_leave", dt: "full_day", s: "2026-10-05", e: "2026-10-06", mgr: "approved", hr: "pending", note: "Brother's wedding in Assiut.", created: "2026-09-23", mgrBy: "manager", mgrNote: "OK from my side." });
  addTO({ key: "u16", type: "personal_leave", dt: "half_day", half: "afternoon", s: "2026-10-01", e: "2026-10-01", mgr: "approved", hr: "pending", note: "Bank appointment for my payroll account.", created: "2026-09-25" });
  addTO({ key: "u13", type: "vacation_day", dt: "full_day", s: "2026-09-14", e: "2026-09-14", mgr: "rejected", hr: "pending", note: "Personal errands.", created: "2026-09-08", mgrBy: "manager", mgrNote: "Nile Foods QBR is scheduled that day - please pick another date." });
  addTO({ key: "u8", type: "annual_leave", dt: "full_day", s: "2026-09-20", e: "2026-09-24", mgr: "approved", hr: "rejected", note: "Trip to Sharm El Sheikh.", created: "2026-09-01", hrNote: "Overlaps with the design system launch week. Please pick dates after October 10." });
  addTO({ key: "u11", type: "unpaid_leave", dt: "full_day", s: "2026-08-30", e: "2026-09-03", mgr: "pending", hr: "rejected", note: "Personal matters.", created: "2026-08-27", hrNote: "Unpaid leave requires 30 days notice per the contractors policy." });
  addTO({ key: "u12", type: "annual_leave", dt: "full_day", s: "2026-09-27", e: "2026-09-28", mgr: "pending", hr: "pending", status: "cancelled", note: "Cancelled - campaign launch moved.", created: "2026-09-17" });
  addTO({ key: "finance", type: "personal_leave", dt: "full_day", s: "2026-08-18", e: "2026-08-18", mgr: "pending", hr: "pending", status: "cancelled", note: "No longer needed.", created: "2026-08-12" });
  addTO({ key: "manager", type: "annual_leave", dt: "full_day", s: "2026-07-26", e: "2026-07-30", mgr: "approved", hr: "approved", note: "Summer vacation.", created: "2026-07-06" });
  addTO({ key: "u15", type: "annual_leave", dt: "full_day", s: "2026-06-14", e: "2026-06-18", mgr: "approved", hr: "approved", note: "Eid holiday extension.", created: "2026-05-31" });
  addTO({ key: "u10", type: "sick_leave", dt: "full_day", s: "2026-05-11", e: "2026-05-12", mgr: "approved", hr: "approved", note: "Migraine.", created: "2026-05-11" });
  addTO({ key: "admin", type: "vacation_day", dt: "full_day", s: "2026-07-02", e: "2026-07-02", mgr: "approved", hr: "approved", note: "Board travel day.", created: "2026-06-25" });

  TO.forEach((t, i) => {
    const e = emp(t.key);
    const managerUser = t.mgrBy ? uid(t.mgrBy) : e.managerId;
    const created = L.cairoIso(t.created, ...(t.createdTime || [10, 20]));
    const mgrAt = t.mgr !== "pending" ? L.cairoIso(L.addDays(t.created, 1) > TODAY ? TODAY : L.addDays(t.created, 1), 11, 5) : null;
    const hrAt = t.hr !== "pending" ? L.cairoIso(L.addDays(t.created, 2) > TODAY ? TODAY : L.addDays(t.created, 2), 14, 30) : null;
    const overall = t.status || (t.mgr === "rejected" || t.hr === "rejected" ? "rejected" : t.hr === "approved" ? "approved" : "pending");
    const days = workDaysIn(t.s, t.e).length || 1;
    const minutes = t.dt === "half_day" ? 240 : t.dt === "partial" ? (Number(t.pe.slice(0, 2)) * 60 + Number(t.pe.slice(3))) - (Number(t.ps.slice(0, 2)) * 60 + Number(t.ps.slice(3))) : days * 1440;
    const attachments = (t.files || []).map((f) => {
      db.seedDocs[f] = { kind: "doc", title: "Medical note", subtitle: empName(e), lines: [`Patient: ${empName(e)}`, `Date: ${t.s}`, "Diagnosis: acute illness - rest recommended.", "Dr. Hesham Fawzy, Cleopatra Hospital"] };
      return { fileName: f, fileUrl: seedUrl(f), fileSizeBytes: 94211 + i * 1000, mimeType: "application/pdf" };
    });
    const hrUser = uid("u10");
    const row = {
      id: i + 1, requestCode: `TOR-2026-${String(i + 1).padStart(4, "0")}`, employeeId: e.id,
      timeOffType: t.type, durationType: t.dt, halfDayPeriod: t.half || null,
      startDate: t.s, endDate: t.e, partialStartTime: t.ps || null, partialEndTime: t.pe || null, totalDurationMinutes: minutes,
      employeeNote: t.note, attachments, status: overall,
      managerActionStatus: e.managerId ? t.mgr : "approved", managerDecisionNote: t.mgrNote || (t.mgr === "approved" ? "Approved." : null), managerDecidedByUserId: t.mgr !== "pending" ? managerUser || null : null, managerDecidedAt: mgrAt,
      hrActionStatus: t.hr, hrDecisionNote: t.hrNote || (t.hr === "approved" ? "Approved - enjoy your time off." : null), hrDecidedByUserId: t.hr !== "pending" ? hrUser : null, hrDecidedAt: hrAt,
      decidedByUserId: overall === "approved" || overall === "rejected" ? (t.hr !== "pending" ? hrUser : managerUser) : null,
      decidedAt: overall === "approved" || overall === "rejected" ? hrAt || mgrAt : null,
      createdByUserId: e.id,
      createdAt: created, updatedAt: hrAt || mgrAt || created,
    };
    db.timeOffs.rows.push(row);
    log("requested", "TimeOffRequest", row.id, e.id, { timeOffType: t.type }, created);
    if (row.hrDecidedAt) log(t.hr, "TimeOffRequest", row.id, hrUser, { decision: t.hr }, row.hrDecidedAt);
  });

  // ---------------- attendance (Discord voice sessions) ----------------
  const holidaySet = new Set(HOLIDAYS_2026.map(([d]) => d));
  const approvedLeaveMap = new Map(); // empId|date -> timeOff
  for (const t of db.timeOffs.rows.filter((x) => x.status === "approved")) {
    for (const d of L.dateRange(t.startDate, t.endDate)) approvedLeaveMap.set(`${t.employeeId}|${d}`, t);
  }
  db.approvedLeaveOn = (empId, date) => {
    for (const t of db.timeOffs.rows) if (t.employeeId === empId && t.status === "approved" && t.startDate <= date && t.endDate >= date) return t;
    return null;
  };
  const forcedAbsence = new Set(["u9|2026-09-09", "u15|2026-09-17", "u8|2026-07-09", "sales|2026-09-02", "u12|2026-08-19", "u14|2026-09-15", `u14|${TODAY}`, "admin|2026-09-13", "u10|2026-09-06", "manager|2026-09-21", "u16|2026-09-01", "u8|2026-09-08", "u12|2026-09-03", "finance|2026-09-14"].map((k) => { const [key, d] = k.split("|"); return `${uid(key)}|${d}`; }));
  const CHANNELS = {
    1: ["1189247710455320611", "engineering-voice"], 2: ["1189247710455320612", "design-room"], 3: ["1189247710455320613", "sales-floor"],
    4: ["1189247710455320614", "marketing-studio"], 5: ["1189247710455320615", "finance-office"], 6: ["1189247710455320616", "people-ops"],
    7: ["1189247710455320617", "operations"], 8: ["1189247710455320618", "leadership"],
  };
  const LEAVE_NOTES = ["Doctor appointment", "Bank errand", "Internet outage at home", "Picked up kids from school", "Power cut in the area", "Client visit (off Discord)", "Family emergency", ""];
  const nowMs = NOW.getTime();
  let sid = 1, lid = 1;
  const START = "2026-04-01";
  for (const e of db.employees.rows) {
    const r = seeded(1000 + e.id * 7);
    for (let k = 0; k < 8; k++) r.rnd(); // Park-Miller's first outputs are tiny for small seeds; warm up.
    const lateBias = { sales: 0.24, u9: 0.16, u8: 0.14, manager: 0.05, admin: 0.04 }[e.userKey] ?? 0.09;
    const [channelId] = CHANNELS[e.departmentId] || CHANNELS[7];
    const partTime = e.employeeType === "part_time";
    const from = e.joinDate > START ? e.joinDate : START;
    for (const d of L.dateRange(from, TODAY)) {
      if (![0, 1, 2, 3, 4].includes(L.weekday(d)) || holidaySet.has(d)) continue;
      const leave = approvedLeaveMap.get(`${e.id}|${d}`);
      if (leave && leave.durationType === "full_day") continue;
      if (forcedAbsence.has(`${e.id}|${d}`)) continue;
      if (d !== TODAY && r.rnd() < 0.022) continue; // random absence
      const late = r.rnd() < lateBias;
      let startMin = partTime ? 600 + r.int(-10, 20) : late ? 9 * 60 + r.int(17, 55) : 8 * 60 + r.int(38, 74);
      let endMin = partTime ? 870 + r.int(-15, 25) : 17 * 60 + r.int(-12, 58);
      if (leave && leave.durationType === "half_day") {
        if (leave.halfDayPeriod === "morning") startMin = 13 * 60 + r.int(0, 15);
        else endMin = 13 * 60 + r.int(0, 10);
      }
      const segments = [];
      if (!partTime && endMin - startMin > 6 * 60) {
        const lunch = 12 * 60 + 45 + r.int(0, 45);
        let gap = r.int(25, 55);
        const longLeave = (leave && leave.durationType === "partial") || r.rnd() < 0.05;
        let lStart = lunch, lEnd = lunch + gap;
        if (leave && leave.durationType === "partial") {
          lStart = Number(leave.partialStartTime.slice(0, 2)) * 60 + Number(leave.partialStartTime.slice(3)) - r.int(0, 8);
          lEnd = Number(leave.partialEndTime.slice(0, 2)) * 60 + Number(leave.partialEndTime.slice(3)) + r.int(0, 10);
        } else if (longLeave) {
          lStart = 13 * 60 + r.int(0, 40);
          lEnd = lStart + r.int(80, 150);
        }
        segments.push([startMin, lStart], [lEnd, endMin]);
        if (longLeave) {
          const recent = L.daysBetween(d, TODAY) <= 10;
          const status = leave ? "approved" : recent ? (r.rnd() < 0.6 ? "pending" : "approved") : r.rnd() < 0.8 ? "approved" : "rejected";
          db.voiceLeaves.push({ id: lid++, employeeId: e.id, leaveDate: d, startMin: lStart, endMin: lEnd, status, leaveType: "discord_voice_leave", note: leave ? `Approved time off (${L.labelize(leave.timeOffType)})` : LEAVE_NOTES[r.int(0, LEAVE_NOTES.length - 1)] });
        }
      } else segments.push([startMin, endMin]);
      const daySessions = [];
      segments.forEach(([a, b], idx) => {
        const inAt = L.cairoDate(d, Math.floor(a / 60), a % 60, r.int(0, 59));
        if (inAt.getTime() > nowMs) return;
        let outAt = L.cairoDate(d, Math.floor(b / 60), b % 60, r.int(0, 59));
        const open = outAt.getTime() > nowMs;
        if (open) outAt = null;
        const dur = Math.max(0, Math.round(((outAt ? outAt.getTime() : nowMs) - inAt.getTime()) / 1000));
        const prev = daySessions[idx - 1];
        const morningOff = leave && leave.durationType === "half_day" && leave.halfDayPeriod === "morning";
        const lateSec = idx === 0 && !partTime && !morningOff ? Math.max(0, Math.round((inAt.getTime() - L.cairoDate(d, 9, 0).getTime()) / 1000)) : 0;
        const isLate = idx === 0 && !partTime && !morningOff && lateSec > 15 * 60;
        daySessions.push({
          id: sid++, employeeId: e.id, discordUserId: e.discordUserId, channelId, date: d,
          checkInAt: inAt.toISOString(), checkOutAt: outAt ? outAt.toISOString() : null,
          durationSeconds: dur, breakBeforeSeconds: prev && prev.checkOutAt ? Math.round((inAt.getTime() - new Date(prev.checkOutAt).getTime()) / 1000) : 0,
          lateSeconds: isLate ? lateSec : 0, isLate, overtimeMinutes: 0,
          createdAt: inAt.toISOString(), updatedAt: (outAt || inAt).toISOString(),
        });
      });
      const total = daySessions.reduce((s, x) => s + x.durationSeconds, 0);
      if (daySessions.length && !partTime && total > 8 * 3600 && daySessions[daySessions.length - 1].checkOutAt) daySessions[daySessions.length - 1].overtimeMinutes = Math.round((total - 8 * 3600) / 60);
      db.sessions.push(...daySessions);
    }
    const last = db.sessions.filter((s) => s.employeeId === e.id).pop();
    e.lastClockedIn = last ? last.checkInAt : null;
  }
  db.nextSessionId = sid;
  db.nextLeaveId = lid;

  // ---------------- meetings ----------------
  const meeting = (m) => {
    const created = L.cairoIso(m.created || L.addDays(m.date, -5), 10, 0);
    db.meetings.rows.push({ id: db.meetings.rows.length + 1, title: m.title, date: m.date, time: m.time, durationMinutes: m.dur, link: m.link || null, description: m.desc || null, targetType: m.target, departmentIds: m.depts || [], employeeIds: (m.emps || []).map(uid), sendToAll: m.target === "company", createdBy: uid(m.by), updatedBy: null, createdAt: created, updatedAt: created, deletedAt: null });
  };
  meeting({ title: "Weekly Engineering Sync", date: L.addDays(TODAY, 1), time: "10:00", dur: 45, target: "department", depts: [1], by: "u15", link: "https://meet.google.com/eng-sync-wkly", desc: "Sprint status, blockers and release readiness for 4.2." });
  meeting({ title: "Q4 Kickoff Town Hall", date: L.addDays(TODAY, 2), time: "13:00", dur: 60, target: "company", by: "admin", link: "https://meet.google.com/q4-town-hall", desc: "Company goals for Q4 2026, new hires and Q3 wins." });
  meeting({ title: "Payroll Cut-off Review", date: L.addDays(TODAY, -1), time: "11:00", dur: 30, target: "employees", emps: ["u10", "finance", "u16"], by: "u10", link: "https://meet.google.com/payroll-cutoff", desc: "Review September adjustments before freezing the monthly run." });
  meeting({ title: "Design System Launch Review", date: "2026-10-05", time: "12:00", dur: 60, target: "department", depts: [2, 1], by: "u15", desc: "Final walkthrough of OrgTik UI 2.0 components." });
  meeting({ title: "Sales Pipeline Review", date: "2026-09-23", time: "10:30", dur: 60, target: "department", depts: [3], by: "manager", desc: "Q3 pipeline, Nile Foods renewal and Gulf expansion leads." });
  meeting({ title: "HR Policy Update: Remote Work", date: "2026-09-15", time: "14:00", dur: 45, target: "company", by: "u10", link: "https://meet.google.com/hr-remote-policy", desc: "New hybrid policy effective October 1." });
  meeting({ title: "Onboarding: Aya Hamed", date: "2026-08-03", time: "10:00", dur: 90, target: "employees", emps: ["u16", "finance", "u10"], by: "u10", desc: "Accounts, tools and payroll walkthrough." });
  meeting({ title: "Marketing Campaign Brainstorm", date: "2026-10-07", time: "11:00", dur: 60, target: "department", depts: [4], by: "manager", desc: "Ideas for the Ramadan 2027 campaign." });
  meeting({ title: "1:1 Salma & Sherif", date: TODAY, time: "15:00", dur: 30, target: "employees", emps: ["employee", "u15"], by: "u15", link: "https://meet.google.com/one-on-one-ss" });
  meeting({ title: "Monthly Finance Close", date: L.addDays(TODAY, 1), time: "14:00", dur: 60, target: "department", depts: [5], by: "finance", desc: "September close checklist and accruals." });

  // ---------------- payroll ----------------
  const runDefs = [
    { id: 1, frequency: "monthly", start: "2026-07-01", end: "2026-07-31", title: "July 2026", state: "paid", created: ["2026-07-01", 8], frozen: ["2026-07-24", 12], submitted: ["2026-07-24", 12, 30], approved: ["2026-07-26", 10, 15], queued: ["2026-07-27", 9], paid: ["2026-07-28", 11], note: "July payroll - includes Q2 sales commissions." },
    { id: 2, frequency: "monthly", start: "2026-08-01", end: "2026-08-31", title: "August 2026", state: "paid", created: ["2026-08-01", 8], frozen: ["2026-08-25", 13], submitted: ["2026-08-25", 13, 20], approved: ["2026-08-27", 9, 40], queued: ["2026-08-27", 10], paid: ["2026-08-28", 12], note: "August payroll - Aya Hamed prorated from Aug 2." },
    { id: 3, frequency: "monthly", start: "2026-09-01", end: "2026-09-30", title: "September 2026", state: "open", created: ["2026-09-01", 8], note: "Started monthly payroll run for September 2026" },
    { id: 4, frequency: "biweekly", start: "2026-08-16", end: "2026-08-31", title: "Aug 16 – 31, 2026", state: "paid", created: ["2026-08-16", 8], frozen: ["2026-08-31", 10], submitted: ["2026-08-31", 10, 30], approved: ["2026-09-01", 11], queued: ["2026-09-01", 12], paid: ["2026-09-02", 10], note: "Contractors - second half of August." },
    { id: 5, frequency: "biweekly", start: "2026-09-01", end: "2026-09-15", title: "Sep 1 – 15, 2026", state: "submitted", created: ["2026-09-01", 8], frozen: ["2026-09-16", 14], submitted: ["2026-09-16", 15], note: "Bi-weekly contractors - first half of September. Mahmoud's on-call bonus included." },
    { id: 6, frequency: "weekly", start: "2026-09-14", end: "2026-09-20", title: "Week 38 · Sep 14 – 20, 2026", state: "paid", created: ["2026-09-14", 8], frozen: ["2026-09-21", 9], submitted: ["2026-09-21", 9, 15], approved: ["2026-09-21", 13], queued: ["2026-09-22", 9], paid: ["2026-09-22", 12], note: "Weekly part-time payroll." },
    { id: 7, frequency: "weekly", start: "2026-09-21", end: "2026-09-27", title: "Week 39 · Sep 21 – 27, 2026", state: "queued", created: ["2026-09-21", 8], frozen: ["2026-09-28", 9], submitted: ["2026-09-28", 9, 10], approved: ["2026-09-28", 12], queued: ["2026-09-28", 14], note: "Weekly part-time payroll." },
  ];
  const at = (a) => (a ? L.cairoIso(a[0], a[1] || 0, a[2] || 0) : null);
  const hrId = uid("u10"), adminId = uid("admin"), finId = uid("finance");
  db.periodBase = (e, run) => {
    const base = Number(e.salary.baseSalary) || 0;
    const days = L.daysBetween(run.periodStart, run.periodEnd) + 1;
    const employedFrom = e.joinDate > run.periodStart ? e.joinDate : run.periodStart;
    const employedDays = Math.max(0, L.daysBetween(employedFrom, run.periodEnd) + 1);
    const ratio = Math.min(1, employedDays / days);
    if (run.frequency === "monthly") return L.round2(base * ratio);
    if (run.frequency === "biweekly") return L.round2((base / 2) * ratio);
    if (run.frequency === "weekly") return L.round2(((base * 12) / 52) * ratio);
    return L.round2(base / 176 * 8 * days);
  };
  db.itemMetrics = (e, run) => {
    const days = L.dateRange(run.periodStart, run.periodEnd).filter((d) => [0, 1, 2, 3, 4].includes(L.weekday(d)) && !holidaySet.has(d) && d >= e.joinDate);
    const sess = db.sessions.filter((s) => s.employeeId === e.id && s.date >= run.periodStart && s.date <= run.periodEnd);
    return { workingDaysCount: days.length, workedDaysCount: new Set(sess.map((s) => s.date)).size, workedHours: L.round2(sess.reduce((a, s) => a + s.durationSeconds, 0) / 3600) };
  };
  for (const def of runDefs) {
    const run = {
      id: def.id, frequency: def.frequency, periodStart: def.start, periodEnd: def.end, referenceDate: def.start, title: def.title,
      isOpen: def.state === "open", note: def.note, createdBy: hrId,
      frozenAt: at(def.frozen), submittedAt: at(def.submitted), approvedAt: at(def.approved), paidAt: at(def.paid), cancelledAt: null,
      createdAt: at(def.created), updatedAt: at(def.paid || def.queued || def.approved || def.submitted || def.frozen || def.created),
    };
    db.runs.rows.push(run);
    const members = db.employees.rows.filter((e) => e.payment.paymentCycle === def.frequency && e.joinDate <= def.end);
    for (const e of members) {
      const status = { paid: "paid", queued: "queued", submitted: "submitted", open: "draft" }[def.state];
      const { totalSalary, netSalary } = calcSalary(e.salary);
      db.items.insert({
        runId: run.id, employeeId: e.id, currency: "EGP", paymentMethod: e.payment.paymentMethod, paymentCycle: def.frequency,
        baseSalary: e.salary.baseSalary, periodBaseSalary: db.periodBase(e, run), grossSalarySnapshot: totalSalary, netSalarySnapshot: netSalary,
        dailyRate: L.round2(e.salary.baseSalary / 30), hourlyRate: L.round2(e.salary.baseSalary / 176),
        ...db.itemMetrics(e, run),
        status, changeRequestNote: null,
        submittedAt: run.submittedAt, approvedAt: ["paid", "queued"].includes(status) ? run.approvedAt : null,
        queuedAt: ["paid", "queued"].includes(status) ? at(def.queued) : null, paidAt: status === "paid" ? run.paidAt : null,
        payslipGeneratedAt: status === "paid" ? run.paidAt : null, payslipSentAt: status === "paid" && def.frequency === "monthly" ? L.cairoIso(def.paid[0], 15) : null,
        createdAt: run.createdAt, updatedAt: run.updatedAt,
      });
    }
    // payroll activity
    const P = (action, by, when, metadata) => when && log(action, "PayrollBatch", run.id, by, metadata, when);
    P("Payroll run started", hrId, run.createdAt, { note: def.state === "open" ? def.note : undefined });
    P("Run frozen", hrId, run.frozenAt);
    P(`Submitted ${members.length} employees for approval`, hrId, run.submittedAt, { note: def.note });
    if (def.id === 2) {
      P("Change requested for Laila Mostafa", adminId, L.cairoIso("2026-08-26", 16, 40), { note: "Late deduction should be half a day, not a full day." });
      P("Resubmitted Laila Mostafa", hrId, L.cairoIso("2026-08-27", 9, 5), { note: "Deduction corrected to 0.5 day." });
    }
    P("Approved all rows", adminId, run.approvedAt);
    P("Queued for payout", hrId, at(def.queued));
    P("Marked as paid", finId, run.paidAt);
  }
  const itemOf = (runId, key) => db.items.rows.find((i) => i.runId === runId && i.employeeId === uid(key));
  db.adjAmount = (item, mode, value) => {
    const base = Number(item.baseSalary) || 0;
    const v = Number(value) || 0;
    if (mode === "percent" || mode === "percentage") return L.round2((base * v) / 100);
    if (mode === "days") return L.round2((base / 30) * v);
    if (mode === "months") return L.round2(base * v);
    return L.round2(v);
  };
  const adj = (runId, key, type, mode, value, reason, date) => {
    const item = itemOf(runId, key);
    if (!item) return;
    const when = L.cairoIso(date, 12, 0);
    db.adjustments.insert({ runId, runItemId: item.id, employeeId: item.employeeId, type, mode, value, amount: db.adjAmount(item, mode, value), reason, createdBy: hrId, createdAt: when, updatedAt: when });
  };
  adj(1, "sales", "bonus", "fixed", 4500, "Sales commission - Q2 targets", "2026-07-20");
  adj(1, "u13", "bonus", "fixed", 6000, "Nile Foods renewal bonus", "2026-07-21");
  adj(1, "u12", "bonus", "fixed", 1500, "Summer campaign launch", "2026-07-22");
  adj(1, "u8", "deduction", "days", 1, "Unpaid leave (Jul 9)", "2026-07-22");
  adj(2, "sales", "bonus", "percent", 15, "Sales commission - August", "2026-08-24");
  adj(2, "employee", "bonus", "fixed", 2000, "Spot award - release 4.1", "2026-08-20");
  adj(2, "u7", "bonus", "fixed", 3000, "On-call support (Aug 14 - 16)", "2026-08-18");
  adj(2, "u8", "deduction", "days", 0.5, "Late arrivals (3 occurrences)", "2026-08-24");
  adj(3, "sales", "bonus", "percent", 15, "Sales commission - September", "2026-09-27");
  adj(3, "u13", "bonus", "fixed", 5000, "Q3 key account bonus", "2026-09-26");
  adj(3, "employee", "bonus", "fixed", 2000, "Release 4.2 delivered on time", "2026-09-24");
  adj(3, "u8", "deduction", "fixed", 1500, "Monitor damage (asset DS-114)", "2026-09-21");
  adj(3, "u15", "deduction", "days", 1, "Unpaid leave (Sep 17)", "2026-09-18");
  adj(4, "u11", "bonus", "fixed", 2000, "Weekend deployment (Aug 22)", "2026-08-30");
  adj(5, "u11", "bonus", "fixed", 2500, "On-call weekend (Sep 5 - 6)", "2026-09-15");
  adj(5, "u9", "deduction", "days", 1, "Unpaid absence (Sep 9)", "2026-09-15");
  adj(6, "u14", "bonus", "fixed", 600, "Extra article (Arabic SEO guide)", "2026-09-20");

  // loans + instalments
  const loanDefs = [
    { id: 1, key: "u7", title: "Car down payment", principal: 60000, inst: 5000, start: "2026-06-01", status: "active", reason: "Down payment for a new car (Hyundai Elantra).", paidMonths: [["2026-06-01", "2026-06-30"]], runs: [1, 2, 3] },
    { id: 2, key: "employee", title: "Wedding loan", principal: 36000, inst: 3000, start: "2026-08-01", status: "active", reason: "Wedding expenses.", runs: [2, 3] },
    { id: 3, key: "sales", title: "Medical emergency", principal: 12000, inst: 2000, start: "2026-07-01", status: "paused", reason: "Father's surgery. Paused on request from Sep 5.", runs: [1, 2] },
    { id: 4, key: "manager", title: "Emergency home repair", principal: 20000, inst: 4000, start: "2026-04-01", status: "closed", reason: "Water damage repairs.", paidMonths: [["2026-04-01", "2026-04-30"], ["2026-05-01", "2026-05-31"], ["2026-06-01", "2026-06-30"]], runs: [1, 2] },
    { id: 5, key: "u13", title: "Car maintenance", principal: 10000, inst: 2500, start: "2026-09-15", status: "cancelled", reason: "Cancelled by the employee before the first instalment.", runs: [] },
    { id: 6, key: "u11", title: "Laptop purchase", principal: 8000, inst: 1000, start: "2026-08-16", status: "active", reason: "MacBook Pro for on-call work.", runs: [4, 5] },
  ];
  for (const ld of loanDefs) {
    const e = emp(ld.key);
    const created = L.cairoIso(L.addDays(ld.start, -6), 11, 0);
    const loan = { id: ld.id, employeeId: e.id, title: ld.title, principalAmount: ld.principal, installmentAmount: ld.inst, durationMonths: Math.round(ld.principal / ld.inst), currency: "EGP", startDate: ld.start, status: ld.status, reason: ld.reason, createdBy: hrId, createdAt: created, updatedAt: created };
    db.loans.rows.push(loan);
    let remaining = ld.principal;
    for (const [ps, pe] of ld.paidMonths || []) {
      db.loanApps.insert({ loanId: loan.id, runId: null, runItemId: null, employeeId: e.id, periodStart: ps, periodEnd: pe, frequency: "monthly", suggestedAmount: ld.inst, appliedAmount: ld.inst, remainingBeforeAmount: remaining, isOverride: false, isPaid: true, paidAt: L.cairoIso(L.addDays(pe, -2), 12), notes: "Loan installment (auto)", createdAt: L.cairoIso(ps, 8), updatedAt: L.cairoIso(pe, 12) });
      remaining -= ld.inst;
    }
    for (const runId of ld.runs) {
      const item = db.items.rows.find((i) => i.runId === runId && i.employeeId === e.id);
      if (!item) continue;
      const run = db.runs.find(runId);
      const paid = item.status === "paid";
      db.loanApps.insert({ loanId: loan.id, runId, runItemId: item.id, employeeId: e.id, periodStart: run.periodStart, periodEnd: run.periodEnd, frequency: run.frequency, suggestedAmount: ld.inst, appliedAmount: Math.min(ld.inst, remaining), remainingBeforeAmount: remaining, isOverride: false, isPaid: paid, paidAt: paid ? run.paidAt : null, notes: "Loan installment (auto)", createdAt: run.createdAt, updatedAt: run.updatedAt });
      if (paid) remaining -= Math.min(ld.inst, remaining);
    }
  }

  // import batch history
  db.importBatches.insert({ runId: 2, filename: "august-2026-finance-adjustments.xlsx", format: "xlsx", rowCount: 4, createdCount: 3, errorCount: 1, importedByUserId: String(finId), errors: ["Row 5: employee EMP-1099 not found"], createdAt: L.cairoIso("2026-08-24", 15, 12), updatedAt: L.cairoIso("2026-08-24", 15, 12) });
  db.importBatches.insert({ runId: 1, filename: "july-2026-commissions.csv", format: "csv", rowCount: 2, createdCount: 2, errorCount: 0, importedByUserId: String(finId), errors: [], createdAt: L.cairoIso("2026-07-20", 16, 2), updatedAt: L.cairoIso("2026-07-20", 16, 2) });

  // ---------------- recruitment ----------------
  const JOBS = [
    { id: 1, title: "Senior Backend Engineer (Node.js)", jobType: "full_time", jobMode: "hybrid", status: "opened", dept: 1, location: "Smart Village, Giza", exp: "senior_level", req: "+5 years", post: "2026-09-01", start: "2026-09-01", end: "2026-10-31", min: 60000, max: 85000, bonus: true, health: true, pto: true, skills: ["Node.js", "NestJS", "PostgreSQL", "Docker", "System design"], reqs: "5+ years building production APIs with Node.js/NestJS, strong PostgreSQL and message queues experience, comfortable owning services end to end including on-call." },
    { id: 2, title: "Product Designer", jobType: "full_time", jobMode: "remote", status: "opened", dept: 2, location: "Cairo (Remote)", exp: "mid_level", req: "+3 years", post: "2026-09-08", start: "2026-09-08", end: null, until: true, min: 35000, max: 50000, bonus: true, health: true, pto: true, skills: ["Figma", "Design systems", "User research", "Prototyping"], reqs: "A portfolio of shipped B2B SaaS work, fluency in Figma and design systems, and the ability to run lightweight user research with Arabic- and English-speaking users." },
    { id: 3, title: "Sales Account Executive", jobType: "full_time", jobMode: "on_site", status: "opened", dept: 3, location: "Maadi, Cairo", exp: "entry_level", req: "+1 year", post: "2026-08-20", start: "2026-08-20", end: "2026-10-15", min: 18000, max: 26000, bonus: true, health: true, pto: true, skills: ["Communication", "Negotiation", "CRM", "Teamwork"], reqs: "1+ year in B2B sales or business development, excellent Arabic and English, driving licence preferred. Uncapped commission." },
    { id: 4, title: "Digital Marketing Specialist", jobType: "full_time", jobMode: "hybrid", status: "on_hold", dept: 4, location: "Zamalek, Cairo", exp: "mid_level", req: "+3 years", post: "2026-08-05", start: "2026-08-05", end: "2026-09-30", min: 22000, max: 32000, bonus: false, health: true, pto: true, skills: ["Creative", "Communication", "SEO", "Paid social"], reqs: "3+ years running paid social and search campaigns with measurable CAC/ROAS targets; Arabic copywriting is a plus." },
    { id: 5, title: "Financial Accountant", jobType: "full_time", jobMode: "on_site", status: "closed", dept: 5, location: "Heliopolis, Cairo", exp: "entry_level", req: "+1 year", post: "2026-06-15", start: "2026-06-15", end: "2026-07-31", min: 16000, max: 22000, bonus: false, health: true, pto: true, skills: ["Problem solving", "Excel", "Accounting"], reqs: "B.Com in accounting, knowledge of Egyptian tax and social insurance rules, advanced Excel." },
    { id: 6, title: "QA Automation Intern", jobType: "internship", jobMode: "on_site", status: "cancelled", dept: 1, location: "Alexandria", exp: "intern_level", req: "+1 year", post: "2026-09-20", start: "2026-10-01", end: "2026-12-31", min: 8000, max: 10000, bonus: false, health: false, pto: false, skills: ["Teamwork", "Problem solving", "Playwright"], reqs: "Final-year engineering or CS student, basic JavaScript, curiosity about test automation." },
  ];
  const ABOUT = `${COMPANY.name} builds the OrgTik suite - HR, sales, task and file management tools used by fast-growing companies across Egypt and the Gulf. We are a hybrid team of ~40 people based in Smart Village with a strong engineering culture, flexible hours and a generous learning budget.`;
  for (const j of JOBS) {
    const created = L.cairoIso(j.post, 10, 0);
    db.jobs.rows.push({ id: j.id, title: j.title, jobType: j.jobType, jobMode: j.jobMode, status: j.status, departmentId: j.dept, location: j.location, experienceLevel: j.exp, requiredExperience: j.req, jobPostDate: j.post, startDate: j.start, untilClosed: !!j.until, endDate: j.end, currencyType: "EGP", salaryMin: j.min.toFixed(2), salaryMax: j.max.toFixed(2), bonusAvailability: j.bonus, healthInsurance: j.health, paidTimeOff: j.pto, aboutCompanyDescription: ABOUT, jobRequirements: j.reqs, jobSkills: j.skills, createdBy: String(hrId), updatedBy: String(hrId), createdAt: created, updatedAt: created, deletedAt: null });
  }
  // [job, name, gender, stage, uni, qualification, gradYear, city, daysAgoApplied, interview?]
  const CANDS = [
    [1, "Mostafa El-Sayed", "male", "interview", "Cairo University", "B.Sc. Computer Engineering", 2016, "Giza", 16, [1, 10, 0, 60, "Sherif Magdy & Youssef Ibrahim"]],
    [1, "Nadine Wahba", "female", "screening", "The American University in Cairo", "B.Sc. Computer Science", 2017, "New Cairo", 6],
    [1, "Karim Zaki", "male", "applying", "Ain Shams University", "B.Sc. Computer Science", 2018, "Nasr City, Cairo", 2],
    [1, "Hossam Abdelrahman", "male", "hiring", "Alexandria University", "B.Sc. Computer & Communications Engineering", 2015, "Alexandria", 24, [-8, 10, 0, 60, "Sherif Magdy"]],
    [1, "Yara Soliman", "female", "rejected", "German University in Cairo", "B.Sc. Media Engineering & Technology", 2019, "Heliopolis, Cairo", 20],
    [1, "Islam Fawzy", "male", "applying", "Helwan University", "B.Sc. Computer Science", 2017, "Helwan, Cairo", 1],
    [1, "Omar Khairy", "male", "interview", "Mansoura University", "B.Sc. Computer Engineering", 2016, "Mansoura", 11, [2, 11, 0, 60, "Youssef Ibrahim"]],
    [2, "Farida Hegazy", "female", "interview", "German University in Cairo", "B.A. Graphic Design", 2019, "Sheikh Zayed, Giza", 12, [0, 10, 0, 45, "Laila Mostafa"]],
    [2, "Mariam Lotfy", "female", "screening", "Helwan University", "B.A. Applied Arts (Advertising)", 2020, "Dokki, Giza", 5],
    [2, "Ziad Mansour", "male", "offer", "The American University in Cairo", "B.A. Graphic Design", 2018, "Maadi, Cairo", 19, [-12, 9, 0, 60, "Laila Mostafa & Sherif Magdy"]],
    [2, "Habiba Samy", "female", "applying", "MSA University", "B.A. Mass Communication (Design)", 2021, "6th of October, Giza", 3],
    [2, "Nour El-Din Adel", "male", "rejected", "Cairo University", "B.F.A. Fine Arts", 2017, "Giza", 15],
    [3, "Ahmed Samir", "male", "accepted", "Ain Shams University", "B.Com Business Administration", 2021, "Abbassia, Cairo", 30, [-14, 11, 0, 45, "Tamer Wagdy"]],
    [3, "Menna Gaber", "female", "interview", "Cairo University", "B.Com Marketing", 2022, "Mohandessin, Giza", 9, [2, 9, 0, 45, "Tamer Wagdy"]],
    [3, "Seif Hamdy", "male", "screening", "Alexandria University", "B.Com Accounting", 2020, "Alexandria", 7],
    [3, "Rawan Ezzat", "female", "applying", "Misr International University", "B.A. Business Administration", 2023, "Obour City", 4],
    [3, "Khaled Nasser", "male", "rejected", "Tanta University", "B.Com", 2019, "Tanta", 26],
    [3, "Salma Reda", "female", "hiring", "Ain Shams University", "B.A. English Literature", 2021, "Heliopolis, Cairo", 22, [-7, 12, 0, 45, "Tamer Wagdy & Karim Hassan"]],
    [4, "Aly Hosny", "male", "screening", "The American University in Cairo", "B.A. Marketing", 2020, "Zamalek, Cairo", 25],
    [4, "Jana Fekry", "female", "applying", "The British University in Egypt", "B.A. Business (Marketing)", 2022, "El Shorouk", 21],
    [4, "Tarek Elbanna", "male", "interview", "Cairo University", "B.A. Mass Communication", 2018, "Agouza, Giza", 18, [5, 10, 0, 60, "Dina Fathy"]],
    [5, "Aya Hamed", "female", "hired", "Ain Shams University", "B.Com Accounting", 2022, "Nasr City, Cairo", 95, [-80, 11, 0, 45, "Hany Samir"]],
    [5, "Sherine Mahmoud", "female", "rejected", "Zagazig University", "B.Com Accounting", 2019, "Zagazig", 98],
    [5, "Bassem Fouad", "male", "rejected", "Cairo University", "B.Com Accounting", 2020, "Giza", 90],
    [6, "Lina Abdallah", "female", "applying", "Alexandria University", "B.Sc. Computer Science (expected)", 2027, "Alexandria", 5],
    [6, "Youssef Magdy", "male", "applying", "Arab Academy for Science & Technology", "B.Sc. Computer Engineering (expected)", 2027, "Alexandria", 4],
  ];
  const STAGE_FLOW = ["applying", "screening", "interview", "hiring", "offer", "accepted", "hired"];
  CANDS.forEach((c, i) => {
    const [jobId, fullName, gender, stage, uni, qual, grad, city, ago, iv] = c;
    const id = i + 1;
    const appliedDate = L.addDays(TODAY, -ago);
    const appliedAt = L.cairoIso(appliedDate, 9 + (i % 8), (i * 7) % 60);
    const first = fullName.split(" ")[0].toLowerCase();
    const last = fullName.split(" ").slice(-1)[0].toLowerCase().replace(/[^a-z]/g, "");
    const cv = `cv-${id}.pdf`;
    db.seedDocs[cv] = { kind: "cv", candidateId: id };
    db.applications.rows.push({
      id, jobId, fullName, gender, email: `${first}.${last}${(i * 37) % 90 + 10}@gmail.test`, nationality: "EG",
      phoneNumber: `+2010${String(55501234 + i * 7919).slice(0, 8)}`, dateOfBirth: `${grad - 22}-${String((i % 12) + 1).padStart(2, "0")}-${String((i * 3) % 27 + 1).padStart(2, "0")}`,
      address: `${city}, Egypt`, university: uni, qualification: qual, graduationDate: `${grad}-06-30`,
      resumeFileName: `${fullName.replace(/\s+/g, "_")}_CV.pdf`, resumeFilePath: `uploads/seed/${cv}`, resumeMimeType: "application/pdf", resumeFileSize: String(120000 + i * 3533),
      currentStage: stage, stageUpdatedAt: appliedAt, appliedAt, createdAt: appliedAt, updatedAt: appliedAt, deletedAt: null,
    });
    // stage history
    const path = stage === "rejected" ? ["applying", "screening", ...(i % 2 ? ["interview"] : []), "rejected"] : STAGE_FLOW.slice(0, STAGE_FLOW.indexOf(stage) + 1);
    const span = Math.max(1, ago);
    path.forEach((st, k) => {
      const dayOffset = k === 0 ? 0 : Math.round((span * k) / (path.length)) ;
      const when = k === 0 ? appliedAt : L.cairoIso(L.addDays(appliedDate, Math.min(dayOffset, ago)), 14, (k * 11) % 60);
      db.stages.insert({ applicationId: id, stage: st, stageAt: when, note: k === 0 ? "Applied via careers page" : st === "rejected" ? "Profile does not match the seniority we need right now." : "", updatedBy: k === 0 ? null : String(hrId), createdAt: when, updatedAt: when });
      if (k === path.length - 1) db.applications.rows[i].stageUpdatedAt = when;
    });
    if (iv) {
      const [dOff, h, m, dur, withWho] = iv;
      const day = L.addDays(TODAY, dOff);
      const startAt = L.cairoDate(day, h, m);
      const endAt = new Date(startAt.getTime() + dur * 60000);
      const created = L.cairoIso(L.addDays(day, -3 > -ago ? -3 : 0), 16, 0);
      db.appointments.insert({ applicationId: id, startAt: startAt.toISOString(), endAt: endAt.toISOString(), interviewWith: withWho, interviewLink: `https://meet.google.com/int-${String(id).padStart(3, "0")}-orgtik`, note: `${stage === "interview" ? "Technical" : "Final"} interview for ${JOBS.find((j) => j.id === jobId).title}`, createdBy: String(hrId), createdAt: created, updatedAt: created, deletedAt: null });
    }
  });
  const appNote = (appId, byKey, note, date) => { const u = userByKey(byKey); db.appNotes.insert({ applicationId: appId, authorUserId: String(u.id), authorName: `${u.firstName} ${u.lastName}`, note, createdAt: L.cairoIso(date, 15, 20), updatedAt: L.cairoIso(date, 15, 20), deletedAt: null }); };
  appNote(1, "u10", "Strong NestJS background, currently at a fintech. Notice period 1 month.", L.addDays(TODAY, -10));
  appNote(1, "u15", "Take-home review: clean architecture, good tests. Proceed to technical interview.", L.addDays(TODAY, -5));
  appNote(4, "u15", "Excellent system design round. Recommend moving to offer discussion.", L.addDays(TODAY, -6));
  appNote(10, "u8", "Portfolio is outstanding (fintech onboarding case study). Offer sent: EGP 46k.", L.addDays(TODAY, -4));
  appNote(13, "u13", "Accepted verbally, start date Oct 11.", L.addDays(TODAY, -2));
  appNote(22, "finance", "Hired - joined Aug 2 on a 3-month probation.", "2026-07-20");

  // ---------------- tickets ----------------
  const T = [
    { id: 1001, by: "employee", dept: 5, to: ["finance", "u10"], status: "in-progress", subject: "Payslip shows wrong transport allowance", days: 9, body: "<p>Hi, my August payslip shows a transport allowance of <strong>EGP 1,200</strong> but my contract says <strong>EGP 1,500</strong>. Can you please check?</p>", replies: [["finance", 8, "<p>Thanks Salma, checking with payroll now. It looks like the allowance was prorated because of your annual leave.</p>"], ["u10", 7, "<p>Confirmed - proration should not apply to transport allowance. We will add the difference to the September run.</p>"], ["employee", 7, "<p>Great, thank you both!</p>"]] },
    { id: 1002, by: "u7", dept: 7, to: ["manager"], status: "open", subject: "Laptop battery swelling - need a replacement", days: 2, body: "<p>My MacBook's battery is swelling and the trackpad no longer clicks. I work remotely from Alexandria - can we arrange a courier?</p>", files: ["battery-photo.pdf"] },
    { id: 1003, by: "u8", dept: 6, to: ["u10"], status: "closed", subject: "Salary certificate (HR letter) for Schengen visa", days: 19, body: "<p>Please issue a salary certificate in English addressed to the Embassy of Italy.</p>", replies: [["u10", 18, "<p>Here you go - signed and stamped.</p>", ["salary-certificate-laila.pdf"]], ["u8", 18, "<p>Received, thanks Rana!</p>"]] },
    { id: 1004, by: "u12", dept: 1, to: ["u11"], status: "closed", subject: "VPN not connecting from home", days: 26, body: "<p>WireGuard shows <em>handshake timeout</em> since this morning.</p>", replies: [["u11", 26, "<p>Rotated the server key yesterday - please import the new config I just sent on Discord.</p>"], ["u12", 25, "<p>Works now 🙏</p>"]] },
    { id: 1005, by: "sales", dept: 6, to: ["u10"], status: "open", subject: "Annual leave balance looks incorrect", days: 1, body: "<p>My balance shows 12 days but I only used 7 of my 21 days this year.</p>" },
    { id: 1006, by: "u9", dept: 6, to: ["u10", "u11"], status: "in-progress", subject: "Discord attendance didn't record my Sunday session", days: 7, body: "<p>I was in the engineering voice channel from 9:02 to 17:40 on Sunday but attendance shows me absent.</p>", replies: [["u11", 6, "<p>The bot was restarted at 8:55 and missed some joins. Re-syncing from the audit log.</p>"]] },
    { id: 1007, by: "u16", dept: 6, to: ["u10"], status: "open", subject: "Medical insurance card not received", days: 4, body: "<p>I joined on Aug 2 and still haven't received my AXA medical card.</p>" },
    { id: 1008, by: "u13", dept: 7, to: ["manager"], status: "closed", subject: "Smart Village access card not working", days: 30, body: "<p>Gate 3 rejects my card since Sunday.</p>", replies: [["manager", 29, "<p>Re-activated with building security. Please try again.</p>"]] },
    { id: 1009, by: "u15", dept: 5, to: ["finance", "u16"], status: "in-progress", subject: "Update bank account details (new IBAN)", days: 11, body: "<p>I moved my salary account to QNB. New IBAN attached.</p>", files: ["new-iban-letter.pdf"], replies: [["u16", 10, "<p>Updated in our records, will be effective from the September run.</p>"]] },
    { id: 1010, by: "u11", dept: 5, to: ["finance"], status: "open", subject: "Overtime not reflected in the August 16-31 payroll", days: 0, body: "<p>I did 6 hours of weekend deployment on Aug 22 which should be paid as overtime.</p>" },
  ];
  for (const t of T) {
    const createdDate = L.addDays(TODAY, -t.days);
    const created = L.cairoIso(createdDate, 10, 15 + (t.id % 40));
    const creator = userByKey(t.by);
    const attachments = (t.files || []).map((f, k) => {
      db.seedDocs[f] = { kind: "doc", title: L.labelize(f.replace(/\.pdf$/, "")), subtitle: `Ticket #${t.id}`, lines: [`Attached by ${creator.firstName} ${creator.lastName}`, `Ticket: ${t.subject}`] };
      return { id: t.id * 10 + k, fileName: f, filePath: `uploads/seed/${f}`, mimeType: "application/pdf", fileSize: 64000 + k * 1111, uploadedAt: created, url: seedUrl(f) };
    });
    const ticket = { id: t.id, subject: t.subject, description: t.body, departmentId: t.dept, status: t.status, createdByUserId: creator.id, assignedUserIds: t.to.map(uid), attachments, createdAt: created, updatedAt: created };
    db.tickets.rows.push(ticket);
    db.messages.insert({ ticketId: t.id, senderUserId: creator.id, content: t.body, attachments, createdAt: created, updatedAt: created });
    log("TICKET_CREATED", "Ticket", t.id, creator.id, { departmentId: t.dept, status: "open" }, created);
    log("TICKET_USERS_ASSIGNED", "Ticket", t.id, creator.id, { assignedUserIds: ticket.assignedUserIds }, created);
    let lastAt = created;
    for (const [key, ago, content, files] of t.replies || []) {
      const when = L.cairoIso(L.addDays(TODAY, -ago), 13, 30 + (ago % 25));
      const sender = userByKey(key);
      const atts = (files || []).map((f, k) => {
        db.seedDocs[f] = { kind: "doc", title: "Salary Certificate", subtitle: `${COMPANY.name} - Human Resources`, lines: ["To whom it may concern,", `This is to certify that ${creator.firstName} ${creator.lastName} is employed by ${COMPANY.name}.`, "Issued upon the employee's request."] };
        return { id: t.id * 100 + k, fileName: f, filePath: `uploads/seed/${f}`, mimeType: "application/pdf", fileSize: 88000, uploadedAt: when, url: seedUrl(f) };
      });
      const msg = db.messages.insert({ ticketId: t.id, senderUserId: sender.id, content, attachments: atts, createdAt: when, updatedAt: when });
      log("TICKET_MESSAGE_ADDED", "Ticket", t.id, sender.id, { messageId: msg.id, attachmentCount: atts.length }, when);
      lastAt = when;
    }
    if (t.status !== "open") {
      log("TICKET_STATUS_UPDATED", "Ticket", t.id, t.to.map(uid)[0], { previousStatus: "open", newStatus: t.status }, lastAt);
    }
    ticket.updatedAt = lastAt;
    // "last messaged" for the employee header
    const e = db.employees.find(creator.id);
    if (e && (!e.lastMessaged || e.lastMessaged < lastAt)) e.lastMessaged = lastAt;
  }

  // ---------------- notifications ----------------
  const N = (key, n) => {
    const created = n.at || L.cairoIso(L.addDays(TODAY, -(n.ago || 0)), n.h ?? 10, n.m ?? 0);
    db.notifications.insert({ recipientUserId: uid(key), actorUserId: n.actor ? uid(n.actor) : null, action: n.action, title: n.title, body: n.body, priority: n.priority || "normal", channels: ["websocket"], deliveredChannels: ["websocket"], failedChannels: [], entityType: n.type || null, entityId: n.id != null ? String(n.id) : null, data: n.data || null, readAt: n.read ? created : null, createdAt: created, updatedAt: created });
  };
  N("u10", { action: "time_off.requested", title: "New time-off request", body: "Hoda Ashraf requested sick leave for today.", priority: "high", type: "AttendanceTimeOff", id: 11, actor: "u14", ago: 0, h: 8, m: 12 });
  N("u10", { action: "ticket.assigned", title: "Ticket assigned to you", body: "#1005 Annual leave balance looks incorrect", type: "Ticket", id: 1005, actor: "sales", ago: 1, h: 10, m: 40 });
  N("u10", { action: "ticket.assigned", title: "Ticket assigned to you", body: "#1007 Medical insurance card not received", type: "Ticket", id: 1007, actor: "u16", ago: 4, h: 10, m: 30 });
  N("u10", { action: "time_off.manager_approved", title: "Awaiting HR decision", body: "Sherif Magdy approved Youssef Ibrahim's annual leave (Oct 25 - 29).", type: "AttendanceTimeOff", id: 13, actor: "u15", ago: 7 });
  N("u10", { action: "payroll.change_requested", title: "Payroll change requested", body: "Mona Adel requested a change for Laila Mostafa (August 2026).", priority: "high", type: "PayrollBatch", id: 2, actor: "admin", at: L.cairoIso("2026-08-26", 16, 41), read: true });
  N("manager", { action: "time_off.requested", title: "Time-off request awaiting your approval", body: "Rana Saad requested annual leave (Oct 18 - 20).", type: "AttendanceTimeOff", id: 12, actor: "u10", ago: 3 });
  N("manager", { action: "ticket.assigned", title: "Ticket assigned to you", body: "#1002 Laptop battery swelling - need a replacement", type: "Ticket", id: 1002, actor: "u7", ago: 2 });
  N("u15", { action: "time_off.requested", title: "Time-off request awaiting your approval", body: "Ahmed Tarek requested annual leave (Oct 4 - 8).", type: "AttendanceTimeOff", id: 9, actor: "u9", ago: 2, h: 11 });
  N("u15", { action: "time_off.requested", title: "Time-off request awaiting your approval", body: "Salma Nabil requested personal leave (Oct 1).", type: "AttendanceTimeOff", id: 10, actor: "employee", ago: 1, h: 9, m: 20 });
  N("u15", { action: "meeting.created", title: "Meeting scheduled", body: "1:1 Salma & Sherif - today at 15:00", type: "Meeting", id: 9, actor: "u15", ago: 1, read: true });
  N("employee", { action: "meeting.created", title: "New meeting: 1:1 Salma & Sherif", body: "Today at 15:00 (30 min)", type: "Meeting", id: 9, actor: "u15", ago: 1, h: 16 });
  N("employee", { action: "ticket.replied", title: "Ticket #1001 updated", body: "Rana Saad: proration should not apply to transport allowance.", type: "Ticket", id: 1001, actor: "u10", ago: 7, h: 13, m: 45 });
  N("employee", { action: "payroll.paid", title: "Salary paid - August 2026", body: "Your payslip for August 2026 is ready.", type: "Payslip", id: null, actor: "finance", at: L.cairoIso("2026-08-28", 12, 5), read: true });
  N("employee", { action: "time_off.decided", title: "Time-off request approved", body: "Your annual leave (Aug 9 - 13) was approved by HR.", type: "AttendanceTimeOff", id: 1, actor: "u10", at: L.cairoIso("2026-07-28", 14, 31), read: true });
  N("admin", { action: "payroll.submitted", title: "Payroll submitted for approval", body: "Sep 1 – 15, 2026 (bi-weekly): 2 employees waiting for your review.", priority: "high", type: "PayrollBatch", id: 5, actor: "u10", at: L.cairoIso("2026-09-16", 15, 1) });
  N("admin", { action: "meeting.created", title: "Meeting scheduled", body: "Q4 Kickoff Town Hall", type: "Meeting", id: 2, actor: "admin", ago: 3, read: true });
  N("finance", { action: "payroll.queued", title: "Payroll ready for payout", body: "Week 39 · Sep 21 – 27, 2026: 1 payment queued.", priority: "high", type: "PayrollBatch", id: 7, actor: "u10", at: L.cairoIso("2026-09-28", 14, 2) });
  N("finance", { action: "ticket.assigned", title: "Ticket assigned to you", body: "#1010 Overtime not reflected in the August 16-31 payroll", type: "Ticket", id: 1010, actor: "u11", ago: 0, h: 9, m: 50 });
  N("finance", { action: "ticket.assigned", title: "Ticket assigned to you", body: "#1001 Payslip shows wrong transport allowance", type: "Ticket", id: 1001, actor: "employee", ago: 9, read: true });
  N("u16", { action: "meeting.created", title: "New meeting: Monthly Finance Close", body: "Tomorrow at 14:00", type: "Meeting", id: 10, actor: "finance", ago: 2 });
  N("u16", { action: "time_off.manager_approved", title: "Manager approved your request", body: "Hany Samir approved your half day (Oct 1). Waiting for HR.", type: "AttendanceTimeOff", id: 15, actor: "finance", ago: 3 });
  N("sales", { action: "loan.paused", title: "Loan instalments paused", body: "Your 'Medical emergency' loan is paused from September.", type: "EmployeeLoan", id: 3, actor: "u10", at: L.cairoIso("2026-09-05", 11, 0), read: true });
  N("u7", { action: "time_off.manager_approved", title: "Manager approved your request", body: "Annual leave (Oct 25 - 29) is waiting for HR approval.", type: "AttendanceTimeOff", id: 13, actor: "u15", ago: 7 });
  N("u8", { action: "time_off.decided", title: "Time-off request rejected", body: "Annual leave (Sep 20 - 24): overlaps with the design system launch week.", priority: "high", type: "AttendanceTimeOff", id: 17, actor: "u10", ago: 26, read: true });
  N("u13", { action: "time_off.decided", title: "Time-off request rejected", body: "Vacation day (Sep 14): Nile Foods QBR is scheduled that day.", type: "AttendanceTimeOff", id: 16, actor: "manager", ago: 20 });
  N("u14", { action: "payroll.paid", title: "Salary paid - Week 38", body: "Your payslip for Sep 14 – 20, 2026 is ready.", type: "Payslip", actor: "finance", at: L.cairoIso("2026-09-22", 12, 5) });
  N("u9", { action: "payroll.submitted", title: "Payroll submitted", body: "Your Sep 1 – 15 payroll was sent for approval.", type: "Payslip", actor: "u10", at: L.cairoIso("2026-09-16", 15, 2), read: true });
  N("u11", { action: "ticket.created", title: "Ticket created", body: "#1010 Overtime not reflected in the August 16-31 payroll", type: "Ticket", id: 1010, actor: "u11", ago: 0, h: 9, m: 45, read: true });
  N("u12", { action: "meeting.created", title: "New meeting: Marketing Campaign Brainstorm", body: "Oct 7 at 11:00", type: "Meeting", id: 8, actor: "manager", ago: 2 });

  // ---------------- projects (task manager fallback for the HR projects page) ----------------
  const member = (k) => { const u = userByKey(k); return { id: u.id, email: u.email, firstName: u.firstName, lastName: u.lastName, avatar: null }; };
  const team = (id, name, desc) => ({ id, name, description: desc, teamImage: "" });
  db.projects = [
    { id: 1, title: "OrgTik HR 2.0", description: "Rebuild of the HR dashboard: payroll runs, attendance from Discord and the new hiring pipeline.", teams: [team(1, "Frontend Squad", "Web apps"), team(2, "Platform", "Backend & infra")], progress: 68, completedTasksPercentage: 68, members: ["employee", "u7", "u8", "u9", "u15"].map(member), isPrivate: false, priority: "high", totalAttachmentsCount: 14, totalCommentsCount: 57, status: "in_progress" },
    { id: 2, title: "Payroll bank integration (CIB & NBE)", description: "Direct salary disbursement files and InstaPay bulk transfers.", teams: [team(2, "Platform", "Backend & infra"), team(5, "Finance Ops", "Finance")], progress: 35, completedTasksPercentage: 35, members: ["u7", "u11", "finance", "u16"].map(member), isPrivate: true, priority: "urgent", totalAttachmentsCount: 6, totalCommentsCount: 21, status: "in_progress" },
    { id: 3, title: "Design System - OrgTik UI 2.0", description: "Tokens, components and Figma library shared by all OrgTik apps.", teams: [team(3, "Design", "Product design")], progress: 90, completedTasksPercentage: 90, members: ["u8", "employee", "u15"].map(member), isPrivate: false, priority: "medium", totalAttachmentsCount: 32, totalCommentsCount: 88, status: "in_progress" },
    { id: 4, title: "Q4 Recruitment Drive", description: "Hire a senior backend engineer, a product designer and two sales AEs.", teams: [team(4, "People Ops", "HR")], progress: 40, completedTasksPercentage: 40, members: ["u10", "u15", "u13"].map(member), isPrivate: false, priority: "high", totalAttachmentsCount: 9, totalCommentsCount: 17, status: "in_progress" },
    { id: 5, title: "Smart Village office move", description: "Move from Building B7 to B12 including network, access control and furniture.", teams: [team(6, "Operations", "Facilities")], progress: 100, completedTasksPercentage: 100, members: ["manager", "u11", "u10"].map(member), isPrivate: false, priority: "low", totalAttachmentsCount: 11, totalCommentsCount: 34, status: "done" },
    { id: 6, title: "Ramadan 2027 campaign", description: "Content calendar, influencer shortlist and paid social plan.", teams: [team(7, "Marketing", "Brand & content")], progress: 5, completedTasksPercentage: 5, members: ["u12", "u14", "sales"].map(member), isPrivate: false, priority: "medium", totalAttachmentsCount: 2, totalCommentsCount: 4, status: "todo" },
    { id: 7, title: "Sales CRM clean-up", description: "Deduplicate leads and move the Gulf pipeline to the new stages.", teams: [team(8, "Sales", "B2B sales")], progress: 55, completedTasksPercentage: 55, members: ["u13", "sales"].map(member), isPrivate: false, priority: "medium", totalAttachmentsCount: 3, totalCommentsCount: 12, status: "in_progress" },
  ];

  db.holidays = (employee) => (db.settings.attendance.publicHolidays || []).filter(h => !employee || !h.country || h.country === "ALL" || h.country === employee.address?.country).map((h) => ({ name: h.name, date: L.normDate(h.date), country: h.country || "ALL" })).filter((h) => h.date);

  // Rows above were pushed with explicit ids; rebuild each store so its id counter continues after the max id.
  for (const k of TABLES) {
    db[k] = createStore(db[k].rows);
  }
  return db;
}

function attachCalculations(db) {
  db.calcSalary = calcSalary;
  db.holidays = (employee) => (db.settings.attendance.publicHolidays || []).filter(h => !employee || !h.country || h.country === "ALL" || h.country === employee.address?.country).map(h => ({ name: h.name, date: L.normDate(h.date), country: h.country || "ALL" })).filter(h => h.date);
  db.approvedLeaveOn = (employeeId, date) => db.timeOffs.rows.find(row => row.employeeId === employeeId && row.status === "approved" && row.startDate <= date && row.endDate >= date) || null;
  db.periodBase = (employee, run) => {
    const base = Number(employee.salary.baseSalary) || 0, days = L.daysBetween(run.periodStart, run.periodEnd) + 1;
    const start = employee.joinDate > run.periodStart ? employee.joinDate : run.periodStart;
    const ratio = Math.min(1, Math.max(0, L.daysBetween(start, run.periodEnd) + 1) / days);
    return L.round2(run.frequency === "monthly" ? base * ratio : run.frequency === "biweekly" ? base / 2 * ratio : run.frequency === "weekly" ? base * 12 / 52 * ratio : base / 176 * 8 * days);
  };
  db.itemMetrics = (employee, run) => {
    const holidays = new Set(db.holidays(employee).map(row => row.date));
    const working = (db.settings.attendance.schedule.workingDays || []).map(Number);
    const days = L.dateRange(run.periodStart, run.periodEnd).filter(date => working.includes(L.isoWeekday(date)) && !holidays.has(date) && date >= employee.joinDate);
    const sessions = db.sessions.filter(row => !row.supersededBy && row.employeeId === employee.id && row.date >= run.periodStart && row.date <= run.periodEnd);
    return { workingDaysCount: days.length, workedDaysCount: new Set(sessions.map(row => row.date)).size, workedHours: L.round2(sessions.reduce((sum, row) => sum + row.durationSeconds, 0) / 3600) };
  };
  db.adjAmount = (item, mode, value) => {
    const base = Number(item.baseSalary) || 0, amount = Number(value) || 0;
    return L.round2(mode === "percent" || mode === "percentage" ? base * amount / 100 : mode === "days" ? base / 30 * amount : mode === "months" ? base * amount : amount);
  };
  return db;
}

function buildEmptyDb({ config, workspace }) {
  const company = { name: workspace.name, address: "" };
  const db = { company, today: L.todayStr(), seedUrl: file => `${config.apiUrl("hr")}/uploads/seed/${file}`, sessions: [], voiceLeaves: [], nextSessionId: 1, nextLeaveId: 1, projects: [], seedDocs: {}, ownershipTransfers: {}, settings: { companyProfile: { avatar: null, companyName: company.name, preferredLanguage: "en", phoneNumber: "", emailAddress: "", location: "" }, attendance: { schedule: { effectiveFrom: L.toDmy(L.todayStr()), workingDays: [1, 2, 3, 4, 5], dayStartTime: "09:00", dayEndTime: "17:00", gracePeriodMinutes: 15 }, publicHolidays: [] } } };
  for (const key of TABLES) db[key] = createStore([]);
  // These offsets are schema ID conventions, not seeded business records.
  for (const [key, nextId] of Object.entries({ items: 1001, adjustments: 50001, loanApps: 70001, tickets: 1001 })) db[key].importSnapshot({ rows: [], nextId, idKey: "id" });
  return attachCalculations(db);
}

function exportDb(db) {
  const data = {}, sequences = {};
  for (const key of TABLES) {
    const table = db[key].exportSnapshot();
    data[key] = table.rows; sequences[key] = table.nextId;
  }
  for (const [key, value] of Object.entries(db)) if (!TABLES.includes(key) && typeof value !== "function") data[key] = JSON.parse(JSON.stringify(value));
  for (const key of ["nextSessionId", "nextLeaveId"]) sequences[key] = db[key];
  return { data, sequences };
}

function importDb(db, snapshot) {
  const { data, sequences } = snapshot;
  if (!data || !sequences || !Array.isArray(data.sessions) || !Array.isArray(data.voiceLeaves) || !Array.isArray(data.projects) || !data.settings?.attendance?.schedule || !data.settings.companyProfile || !data.company) throw new TypeError("Invalid HR snapshot");
  for (const key of TABLES) db[key].importSnapshot({ rows: data[key], nextId: sequences[key], idKey: "id" });
  for (const [key, value] of Object.entries(data)) if (!TABLES.includes(key)) db[key] = JSON.parse(JSON.stringify(value));
  for (const key of ["nextSessionId", "nextLeaveId"]) {
    const rows = key === "nextSessionId" ? data.sessions : data.voiceLeaves;
    if (!Number.isSafeInteger(sequences[key]) || sequences[key] <= Math.max(0, ...rows.map(row => Number(row.id) || 0)) || sequences[key] !== data[key]) throw new TypeError("Invalid HR sequence");
  }
  return attachCalculations(db);
}

module.exports = { buildDb, buildEmptyDb, exportDb, importDb, attachCalculations, TABLES, calcSalary, ALL_STEPS, COMPANY };
