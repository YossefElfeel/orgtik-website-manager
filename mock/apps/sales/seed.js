// Phase 1 seed: catalog (zones, durations, departments, categories, features, plans), people
// (sales staff, customers), coupons, loyalty programme, notification preferences.
// Phase 2 (seed-deals.js) builds projects/contracts/subscriptions/invoices through the real services.
const H = require("./lib");
const { DEPARTMENTS, CATEGORIES, FEATURES, PLANS } = require("./catalog-data");

const ZONES = [
  { key: "eg", name: "Egypt", currencyCode: "EGP", countryCodes: ["EG"], languageCodes: ["ar", "en"], defaultLanguageCode: "ar" },
  { key: "gcc", name: "GCC", currencyCode: "SAR", countryCodes: ["SA", "AE", "KW", "QA", "BH", "OM"], languageCodes: ["ar", "en"], defaultLanguageCode: "ar" },
  { key: "eu", name: "Europe", currencyCode: "EUR", countryCodes: ["DE", "FR", "IT", "CH", "AT", "NL", "BE", "ES"], languageCodes: ["en", "de", "fr", "it"], defaultLanguageCode: "en" },
  { key: "row", name: "Rest of World", currencyCode: "USD", countryCodes: ["US", "GB", "CA", "AU", "SG", "JO", "MA", "TR"], languageCodes: ["en"], defaultLanguageCode: "en", isFallback: true },
];

const DURATIONS = [
  ["plan", 1, 0, true], ["plan", 3, 5, true], ["plan", 6, 10, true], ["plan", 12, 15, true], ["plan", 24, 20, false],
  ["installment", 3, 0, true], ["installment", 6, 3, true], ["installment", 12, 5, true], ["installment", 18, 8, false], ["installment", 24, 10, true],
];

const round50 = (n) => Math.max(50, Math.round(n / 50) * 50);
const round5 = (n) => Math.max(5, Math.round(n / 5) * 5);

// Sales staff. authKey links to a seeded SOS person (identity.users); others exist only in the sales app.
const STAFF = [
  { key: "mona", authKey: "admin", role: "admin", status: "active", dept: null, zone: "eg", performance: null, phone: "+20 100 123 4567", address: "Villa 14, Fifth Settlement, New Cairo" },
  { key: "karim", authKey: "manager", role: "manager", status: "active", dept: "design", zone: "eg", performance: "on_track", phone: "+20 100 222 1010", address: "8 Mourad St, Giza" },
  { key: "sherif", authKey: "u15", role: "manager", status: "active", dept: "dev", zone: "eg", performance: "top_performance", phone: "+20 122 410 7788", address: "32 Abbas El Akkad, Nasr City, Cairo" },
  { key: "omar", authKey: "sales", role: "salesman", status: "active", dept: "dev", zone: "eg", performance: "top_performance", phone: "+20 101 555 8899", address: "17 Mohamed Mazhar, Zamalek, Cairo",
    bank: { accountName: "Omar Farouk", bankName: "Commercial International Bank (CIB)", swiftBic: "CIBEEGCX", iban: "EG380019000500000000263180002" } },
  { key: "tamer", authKey: "u13", role: "salesman", status: "active", dept: "mkt", zone: "gcc", performance: "on_track", phone: "+971 50 412 3344", address: "Al Barsha 1, Dubai",
    bank: { accountName: "Tamer Wagdy", bankName: "Emirates NBD", swiftBic: "EBILAEAD", iban: "AE070331234567890123456" } },
  { key: "yasmin", fullName: "Yasmin Adel", email: "yasmin.adel@orgtik.test", role: "salesman", status: "no_account", dept: "design", zone: "eg", performance: "under_performance", phone: "+20 111 876 5432", address: "45 Fouad St, Alexandria",
    bank: { accountName: "Yasmin Adel", bankName: "National Bank of Egypt", swiftBic: "NBEGEGCX", iban: "EG800002000156789012345180002" } },
  { key: "khaled", fullName: "Khaled Mansour", email: "khaled.mansour@orgtik.test", role: "salesman", status: "invited", dept: "dev", zone: "eu", performance: "on_track", phone: "+41 79 555 12 34", address: "Seefeldstrasse 120, Zürich",
    bank: { accountName: "Khaled Mansour", bankName: "UBS Switzerland AG", swiftBic: "UBSWCHZH80A", iban: "CH9300762011623852957" } },
  { key: "mostafa", fullName: "Mostafa Ali", email: "mostafa.ali@orgtik.test", role: "manager", status: "disabled", dept: "mkt", zone: "gcc", performance: "inactive", phone: "+966 55 123 9876", address: "Olaya St, Riyadh" },
];

// [key, fullName, company, email, phone, address, country, lang, status, salesman, access, docs, createdDaysAgo, website, cr]
const CUSTOMERS = [
  ["nile", "Nour Khaled", "Nile Foods", "nour.khaled@nilefoods.test", "+20 100 555 0101", "12 Tahrir St, Garden City, Cairo", "EG", "en", "qualified", "omar", "active", "both", 380, "nilefoods.test", "CR-CAI-204511"],
  ["delta", "Ahmed El-Sayed", "Delta Pharma", "ahmed.elsayed@deltapharma.test", "+20 50 222 3344", "45 El Gomhoria St, Mansoura", "EG", "en", "qualified", "omar", "invited", "both", 260, "deltapharma.test", "CR-DKH-118273"],
  ["cairomart", "Mariam Fawzy", "Cairo Mart", "mariam.fawzy@cairomart.test", "+20 111 333 7788", "88 Makram Ebeid, Nasr City, Cairo", "EG", "en", "contacted", "omar", "no_account", "business", 95, "cairomart.test", "CR-CAI-330912"],
  ["alexlog", "Hesham Ragab", "Alex Logistics", "hesham.ragab@alexlogistics.test", "+20 3 424 5566", "22 Victor Emmanuel Sq, Smouha, Alexandria", "EG", "en", "scheduled", "yasmin", "no_account", "none", 60, "alexlogistics.test", "CR-ALX-092231"],
  ["redsea", "Rania Soliman", "Red Sea Resorts", "rania.soliman@redsearesorts.test", "+20 65 344 2211", "Sheraton Rd, Hurghada, Red Sea", "EG", "de", "qualified", "yasmin", "invited", "id", 300, "redsearesorts.test", "CR-HRG-004418"],
  ["gizatech", "Omar Zaki", "Giza Tech Solutions", "omar.zaki@gizatech.test", "+20 2 3539 1200", "Building B2, Smart Village, Giza", "EG", "en", "new", null, "no_account", "none", 6, "gizatech.test", ""],
  ["ainshams", "Dina Hafez", "Ain Shams Clinics", "dina.hafez@ainshamsclinics.test", "+20 2 2290 4455", "5 El Merghany St, Heliopolis, Cairo", "EG", "en", "unqualified", "omar", "no_account", "business", 210, "ainshamsclinics.test", "CR-CAI-771004"],
  ["pyramids", "Tarek Mansour", "Pyramids Real Estate", "tarek.mansour@pyramidsre.test", "+20 2 3857 6600", "Arkan Plaza, Sheikh Zayed, Giza", "EG", "en", "qualified", "omar", "no_account", "both", 240, "pyramidsre.test", "CR-GIZ-560120"],
  ["riyadhretail", "Faisal Al-Otaibi", "Riyadh Retail Co.", "faisal.alotaibi@riyadhretail.test", "+966 11 465 7788", "King Fahd Rd, Al Olaya, Riyadh", "SA", "en", "qualified", "tamer", "no_account", "both", 230, "riyadhretail.test", "CR-1010556677"],
  ["jeddahcoffee", "Lama Al-Harbi", "Jeddah Coffee Roasters", "lama.alharbi@jeddahcoffee.test", "+966 12 667 1122", "Tahlia St, Al Andalus, Jeddah", "SA", "en", "contacted", "tamer", "no_account", "none", 25, "jeddahcoffee.test", "CR-4030228811"],
  ["khobar", "Abdullah Al-Qahtani", "Al Khobar Industrial", "abdullah.alqahtani@khobarindustrial.test", "+966 13 882 3344", "Dammam Rd, Al Khobar", "SA", "en", "new", null, "no_account", "none", 3, "khobarindustrial.test", ""],
  ["marina", "Mohammed Al-Mansoori", "Dubai Marina Hospitality", "m.almansoori@marinahospitality.test", "+971 4 399 5566", "Marina Walk, Dubai Marina, Dubai", "AE", "en", "qualified", "tamer", "no_account", "both", 150, "marinahospitality.test", "CR-DXB-778812"],
  ["adenergy", "Fatima Al-Shamsi", "Abu Dhabi Energy Services", "fatima.alshamsi@adenergy.test", "+971 2 555 4433", "Corniche Rd, Al Markaziyah, Abu Dhabi", "AE", "en", "scheduled", "tamer", "no_account", "business", 120, "adenergy.test", "CR-AUH-331200"],
  ["sharjahtex", "Khalid Al-Nuaimi", "Sharjah Textiles", "khalid.alnuaimi@sharjahtextiles.test", "+971 6 533 2211", "Industrial Area 6, Sharjah", "AE", "en", "unqualified", "tamer", "no_account", "none", 180, "sharjahtextiles.test", "CR-SHJ-100423"],
  ["dohamotors", "Hamad Al-Kuwari", "Doha Luxury Motors", "hamad.alkuwari@dohamotors.test", "+974 4411 2233", "West Bay, Doha", "QA", "en", "qualified", "tamer", "no_account", "both", 200, "dohamotors.test", "CR-DOH-55120"],
  ["kuwaitgourmet", "Yousef Al-Mutairi", "Kuwait Gourmet Group", "yousef.almutairi@kuwaitgourmet.test", "+965 2245 6677", "Salem Al Mubarak St, Salmiya", "KW", "en", "contacted", "tamer", "no_account", "business", 40, "kuwaitgourmet.test", "CR-KW-339104"],
  ["muscatfish", "Salim Al-Harthy", "Muscat Fisheries", "salim.alharthy@muscatfisheries.test", "+968 2471 3344", "Muttrah Corniche, Muscat", "OM", "en", "new", "yasmin", "no_account", "none", 12, "muscatfisheries.test", ""],
  ["manama", "Noora Al-Mahmood", "Manama FinTech", "noora.almahmood@manamafintech.test", "+973 1753 8899", "Seef District, Manama", "BH", "en", "qualified", "tamer", "invited", "both", 170, "manamafintech.test", "CR-BH-120077"],
  ["zurich", "Lukas Meier", "Zurich Precision AG", "lukas.meier@zurichprecision.test", "+41 44 555 01 23", "Bahnhofstrasse 21, 8001 Zürich", "CH", "de", "qualified", "khaled", "no_account", "both", 110, "zurichprecision.test", "CHE-112.334.556"],
  ["lyon", "Camille Laurent", "Lyon Gastronomie SARL", "camille.laurent@lyongastronomie.test", "+33 4 78 55 12 34", "8 Rue de la République, 69002 Lyon", "FR", "fr", "contacted", "khaled", "no_account", "none", 30, "lyongastronomie.test", "RCS-LYON-812345"],
  ["milano", "Giulia Rossi", "Milano Moda SRL", "giulia.rossi@milanomoda.test", "+39 02 7600 1122", "Via Montenapoleone 5, 20121 Milano", "IT", "it", "new", "khaled", "no_account", "none", 8, "milanomoda.test", ""],
];

const CUSTOMER_NOTES = {
  nile: ["Prefers WhatsApp for quick approvals; CFO signs off anything above EGP 200k.", "Q4 budget approved for the rebrand and the e-shop phase 2.", "Asked for Arabic-first copy on all social content."],
  delta: ["Regulatory review needed before the patient app goes live.", "Wants monthly progress calls every first Monday."],
  redsea: ["German-speaking marketing lead; send decks in German."],
  riyadhretail: ["Omnichannel launch aligned with the Riyadh Season calendar."],
  marina: ["Guest app must support Arabic, English and Russian."],
  zurich: ["Procurement requires Swiss VAT invoices and a signed NDA."],
  ainshams: ["Budget on hold until the new branch opens in 2027."],
  sharjahtex: ["Declined: prefers an in-house team for now."],
};

function seedCatalog(db, identity, docs) {
  const t0 = H.daysAgo(420);
  db.zones = ZONES.map((z, i) => ({ id: H.uid("zone", z.key), isFallback: !!z.isFallback, ...z, createdAt: H.daysAgo(420 - i), updatedAt: H.daysAgo(60 - i) }));
  const zoneId = (k) => H.uid("zone", k);

  db.durations = DURATIONS.map(([type, months, percentage, isActive]) => ({
    id: H.uid("duration", `${type}-${months}`), type, months, percentage: H.money(percentage, "USD"), isActive, archivedAt: null, createdAt: t0, updatedAt: t0,
  }));
  db.durations.push({ id: H.uid("duration", "plan-2"), type: "plan", months: 2, percentage: "3.00", isActive: false, archivedAt: H.daysAgo(30), createdAt: t0, updatedAt: H.daysAgo(30) });
  const durId = (type, m) => H.uid("duration", `${type}-${m}`);

  db.departments = DEPARTMENTS.map((d, i) => ({ id: H.uid("dept", d.key), key: d.key, name: d.name, managerId: identity.findByKey(d.managerKey)?.id ?? null, createdAt: H.daysAgo(410 - i), updatedAt: H.daysAgo(90 - i) }));
  db.categories = CATEGORIES.map((c, i) => ({ id: H.uid("cat", c.key), key: c.key, departmentId: H.uid("dept", c.dept), name: c.name, description: c.description, archivedAt: null, createdAt: H.daysAgo(400 - i), updatedAt: H.daysAgo(80 - i) }));
  // One archived category so the archive page has content.
  db.categories.push({
    id: H.uid("cat", "print-ads"), key: "print-ads", departmentId: H.uid("dept", "mkt"),
    name: H.L("Print Advertising", "الإعلانات المطبوعة", "Printwerbung", "Publicité imprimée", "Pubblicità a stampa"),
    description: H.L("Newspaper and billboard campaigns (discontinued).", "حملات الصحف واللوحات الإعلانية (متوقفة).", "Zeitungs- und Plakatkampagnen (eingestellt).", "Campagnes presse et affichage (arrêtées).", "Campagne su giornali e cartelloni (sospese)."),
    archivedAt: H.daysAgo(55), createdAt: H.daysAgo(390), updatedAt: H.daysAgo(55),
  });

  db.features = FEATURES.map(([key, cat, usd, paymentType, visibility, name, description, extra], i) => {
    const translations = {};
    for (const lang of H.LANGS) if (name[lang]) translations[lang] = { name: name[lang], description: description[lang] || description.en };
    const sar = round5(usd * 3.75);
    const eur = round5(usd * 0.95);
    return {
      id: H.uid("feature", key), key, categoryId: H.uid("cat", cat), defaultLanguageCode: "en", translations,
      priceUsd: H.money(usd, "USD"), paymentType, visibility, isActive: true,
      zonePrices: [
        { zoneId: zoneId("eg"), basePrice: H.money(round50(usd * 30), "EGP"), countryOverrides: [] },
        { zoneId: zoneId("gcc"), basePrice: H.money(sar, "SAR"), countryOverrides: extra.ae ? [{ countryCode: "AE", price: H.money(round5(sar * extra.ae), "SAR") }] : [] },
        { zoneId: zoneId("eu"), basePrice: H.money(eur, "EUR"), countryOverrides: extra.ch ? [{ countryCode: "CH", price: H.money(round5(eur * extra.ch), "EUR") }] : [] },
        { zoneId: zoneId("row"), basePrice: extra.row === false ? null : H.money(usd, "USD"), countryOverrides: [] },
      ],
      archivedAt: null, createdAt: H.daysAgo(395 - i * 3), updatedAt: H.daysAgo(40 + (i % 20)),
    };
  });
  // An archived feature.
  db.features.push({
    id: H.uid("feature", "fax-campaign"), key: "fax-campaign", categoryId: H.uid("cat", "ads"), defaultLanguageCode: "en",
    translations: { en: { name: "Fax Broadcast Campaign", description: "Legacy B2B fax outreach (retired)." }, ar: { name: "حملة الفاكس", description: "حملة تواصل قديمة عبر الفاكس (متوقفة)." } },
    priceUsd: "150.00", paymentType: "full_payment", visibility: "internal", isActive: false,
    zonePrices: [{ zoneId: zoneId("eg"), basePrice: "4500.00", countryOverrides: [] }],
    archivedAt: H.daysAgo(20), createdAt: H.daysAgo(500), updatedAt: H.daysAgo(20),
  });

  db.plans = PLANS.map((p) => {
    const featureIds = p.features.map((k) => H.uid("feature", k));
    return {
      id: H.uid("plan", p.key), key: p.key, name: p.name, description: p.description,
      departmentId: H.uid("dept", p.dept), categoryIds: p.cats.map((k) => H.uid("cat", k)), featureIds,
      planDurationIds: p.durations.map((m) => durId("plan", m)),
      installmentsEnabled: p.installments.length > 0,
      installmentDurationIds: p.installments.map((m) => durId("installment", m)),
      zonePrices: p.zones.map((zk) => ({ zoneId: zoneId(zk), basePrice: H.money(p.basePrice?.[zk] || 0, "USD"), countryOverrides: [], _overrideFactors: p.countryOverrides?.[zk] || null })),
      commission: p.commission,
      isActive: p.status === "active",
      isPrivate: !!p.isPrivate,
      activationRequested: p.status === "review",
      archivedAt: p.archivedDaysAgo ? H.daysAgo(p.archivedDaysAgo) : null,
      createdAt: H.daysAgo(p.createdDaysAgo),
      updatedAt: H.daysAgo(Math.max(2, Math.floor(p.createdDaysAgo / 6))),
    };
  });
}

function seedPeople(db, identity, files) {
  db.staff = STAFF.map((s, i) => {
    const u = s.authKey ? identity.findByKey(s.authKey) : null;
    const createdAt = H.daysAgo(400 - i * 23);
    return {
      id: H.uid("staff", s.key), key: s.key, authUserId: u ? u.id : null,
      fullName: u ? identity.fullName(u) : s.fullName, email: u ? u.email : s.email,
      phoneNumber: s.phone, role: s.role, status: s.status, performance: s.performance,
      departmentId: s.dept ? H.uid("dept", s.dept) : null, zoneId: s.zone ? H.uid("zone", s.zone) : null,
      avatar: null, address: s.address, bankDetails: s.bank || null,
      invite: s.status === "invited" ? { inviteUrl: `${files.sosWeb}/auth/invite?token=${H.token(18)}`, expiresAt: H.daysAhead(5) } : null,
      createdAt, updatedAt: H.daysAgo(10 + i),
    };
  });
  const staffId = (k) => H.uid("staff", k);

  db.customers = CUSTOMERS.map(([key, fullName, company, email, phone, address, country, lang, status, salesman, access, docs, createdDaysAgo, website, cr], i) => {
    const u = key === "nile" ? identity.findByKey("customer") : null;
    const createdAt = H.daysAgo(createdDaysAgo, i % 7);
    const c = {
      id: H.uid("customer", key), key, authUserId: u ? u.id : null,
      fullName, email, phoneNumber: phone, address, countryCode: country, preferredLanguage: lang,
      commercialRegistrationNumber: cr || null, status: status === "scheduled" ? "contacted" : status, companyName: company, website: website || null,
      source: "manual", sourceContext: null, lostReason: null,
      assignedSalesmanId: salesman ? staffId(salesman) : null, access,
      idDocument: null, businessDocument: null,
      notes: (CUSTOMER_NOTES[key] || []).map((note, n) => ({ id: H.uid("cnote", `${key}-${n}`), note, createdAt: H.daysAgo(Math.max(1, createdDaysAgo - 10 - n * 17)) })),
      invite: access === "invited" ? { inviteUrl: `${files.sosWeb}/auth/invite?token=${H.token(18)}`, expiresAt: H.daysAhead(4 + i % 3) } : null,
      meetingAppointment: status === "scheduled" ? { createdAt: H.daysAgo(3), createdBy: salesman === "yasmin" ? "Yasmin Adel" : "Tamer Wagdy", scheduledAt: H.daysAhead(2 + (i % 4), 3), notes: "Discovery call with the marketing team." } : null,
      lastActivityAt: H.daysAgo(i % 5 === 0 ? 45 : 2 + (i % 9)),
      createdBy: salesman ? staffId(salesman) : staffId("mona"),
      createdAt, updatedAt: H.daysAgo(Math.max(1, Math.floor(createdDaysAgo / 5))),
    };
    if (docs === "id" || docs === "both") c.idDocument = files.writeSeed(`cust-${key}-national-id.png`, "png", { title: `${fullName} – National ID`, displayName: `national-id-${fullName.toLowerCase().replace(/[^a-z]+/g, "-")}.png` });
    if (docs === "business" || docs === "both") c.businessDocument = files.writeSeed(`cust-${key}-commercial-register.pdf`, "pdf", { title: `${company} – Commercial Register`, lines: [`Registration no.: ${cr || "pending"}`, `Company: ${company}`, `Address: ${address}`, `Country: ${country}`, `Authorised signatory: ${fullName}`, "", "This is a locally generated placeholder document."], displayName: `commercial-register-${key}.pdf` });
    return c;
  });

  db.salesmanNotes = [
    { id: H.uid("snote", 1), salesmanId: staffId("omar"), content: "Closed Delta Pharma app deal – great negotiation on the installment terms.", createdBy: "Mona Adel", createdByType: "admin", createdAt: H.daysAgo(9), updatedAt: H.daysAgo(9) },
    { id: H.uid("snote", 2), salesmanId: staffId("omar"), content: "Needs help with the Ain Shams Clinics follow-up; budget frozen.", createdBy: "Sherif Magdy", createdByType: "manager", createdAt: H.daysAgo(22), updatedAt: H.daysAgo(22) },
    { id: H.uid("snote", 3), salesmanId: staffId("tamer"), content: "Strong GCC pipeline; push Kuwait Gourmet to sign before month end.", createdBy: "Mona Adel", createdByType: "admin", createdAt: H.daysAgo(4), updatedAt: H.daysAgo(4) },
    { id: H.uid("snote", 4), salesmanId: staffId("yasmin"), content: "Below target for Q3 – pair with Omar on two discovery calls.", createdBy: "Karim Hassan", createdByType: "manager", createdAt: H.daysAgo(15), updatedAt: H.daysAgo(15) },
    { id: H.uid("snote", 5), salesmanId: staffId("khaled"), content: "Onboarding: send the Europe pricing deck and Swiss VAT notes.", createdBy: "Mona Adel", createdByType: "admin", createdAt: H.daysAgo(6), updatedAt: H.daysAgo(6) },
  ];
}

function seedCoupons(db) {
  const cat = (k) => H.uid("cat", k);
  const rows = [
    ["WELCOME10", "uiux", "percentage", 10, true, 200, 37, false, null, -60, 120],
    ["BRAND500", "brand", "fixed", 500, true, 50, 12, true, 1, -30, 90],
    ["APPDEV20", "mobile", "percentage", 20, true, 30, 6, true, 1, -20, 70],
    ["GCC-LAUNCH", "ecom", "percentage", 15, true, 100, 18, true, 2, -45, 45],
    ["SEO15", "seo", "percentage", 15, true, 20, 20, false, null, -90, 30],
    ["RAMADAN25", "social", "percentage", 25, true, 500, 214, false, null, -220, -160],
    ["LASTCALL5", "web", "percentage", 5, true, null, 9, false, null, -25, 4],
    ["BLACKFRIDAY30", "ads", "percentage", 30, true, 300, 0, true, 1, 52, 60],
    ["VIPONCE", "motion", "fixed", 250, false, 1, 0, false, null, -5, 25],
  ];
  db.coupons = rows.map(([code, catKey, discountType, value, isMultipleUse, usageLimit, usageCount, hasPerUserLimit, perUserLimit, startOffset, endOffset], i) => ({
    id: H.uid("coupon", code), code, categoryId: cat(catKey), discountType, discountValue: H.money(value, "USD"),
    isMultipleUse, usageLimit, usageCount, hasPerUserLimit, perUserLimit,
    startDate: startOffset >= 0 ? H.daysAhead(startOffset) : H.daysAgo(-startOffset), endDate: endOffset >= 0 ? H.daysAhead(endOffset) : H.daysAgo(-endOffset),
    createdAt: H.daysAgo(Math.max(1, -startOffset + 5)), updatedAt: H.daysAgo(Math.max(1, -startOffset)),
  }));
  db.couponUses = [];
}

function seedLoyalty(db) {
  const rates = [["USD", "US Dollar", "1", true], ["EGP", "Egyptian Pound", "48.50", false], ["SAR", "Saudi Riyal", "3.75", false], ["AED", "UAE Dirham", "3.6725", false], ["EUR", "Euro", "0.92", false], ["KWD", "Kuwaiti Dinar", "0.307", false], ["QAR", "Qatari Riyal", "3.64", false]];
  db.loyalty = {
    settings: {
      isActive: true, pointsPerUnit: "1.00", baseCurrency: "USD", baseCurrencyName: "US Dollar", pointsExpireAfterMonths: 12,
      rates: rates.map(([currencyCode, currencyName, rate, isBase]) => ({ currencyCode, currencyName, rate, isBase, updatedAt: H.daysAgo(14) })),
      updatedAt: H.daysAgo(14),
    },
    rewards: [
      ["r-10off", "10% off your next design plan", 500, 30, "percentage", "10.00", "uiux", "UX10", true, 14],
      ["r-500", "EGP-equivalent USD 50 voucher", 1200, 45, "fixed", "50.00", null, "LOYAL50", true, 6],
      ["r-seo", "15% off SEO & Content", 800, 30, "percentage", "15.00", "seo", "SEO15L", true, 9],
      ["r-app", "20% off a mobile app plan", 2500, 60, "percentage", "20.00", "mobile", "APP20L", true, 2],
      ["r-social", "Free month of community management", 1500, 30, "fixed", "380.00", "social", "CMFREE", false, 4],
    ].map(([key, name, pointCost, validForDays, discountType, discountValue, catKey, prefix, isActive, redemptionCount], i) => ({
      id: H.uid("reward", key), name, pointCost, validForDays, discountType, discountValue, categoryId: catKey ? H.uid("cat", catKey) : null,
      couponCodePrefix: prefix, isActive, redemptionCount, createdAt: H.daysAgo(200 - i * 20), updatedAt: H.daysAgo(30 - i * 3),
    })),
    transactions: [],
    coupons: [],
  };
}

const NOTIFICATION_TYPES = [
  ["project.created", ["in_app", "websocket"]], ["project.status_changed", ["in_app", "websocket"]], ["project.priority_changed", ["in_app"]],
  ["contract.created", ["in_app", "websocket", "email"]], ["contract.awaiting_confirmation", ["in_app", "email"]], ["contract.confirmed", ["in_app", "websocket", "email"]],
  ["contract.approved", ["in_app", "websocket", "email"]], ["contract.rejected", ["in_app", "websocket", "email"]],
  ["invoice.created", ["in_app", "websocket", "email"]], ["invoice.due_soon", ["in_app", "email"]], ["invoice.overdue", ["in_app", "websocket", "email"]], ["invoice.paid", ["in_app", "websocket", "email"]],
  ["custom_invoice.created", ["in_app", "websocket", "email"]], ["custom_invoice.paid", ["in_app", "websocket", "email"]], ["payment.received", ["in_app", "websocket", "email"]],
  ["wallet.commission_added", ["in_app", "websocket"]], ["wallet.commission_paid", ["in_app", "websocket", "email"]],
  ["customer.document_uploaded", ["in_app", "websocket"]], ["customer.meeting_scheduled", ["in_app", "websocket", "email"]], ["lead.created", ["in_app", "websocket"]],
];

module.exports = { seedCatalog, seedPeople, seedCoupons, seedLoyalty, NOTIFICATION_TYPES, ZONES };
