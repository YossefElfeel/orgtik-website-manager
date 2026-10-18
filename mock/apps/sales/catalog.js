// Catalog: zones, durations, departments, categories, features, plans, packages (+ archive).
// Pricing follows spec/pricing-currency-frontend-handoff.md (installment markup included, priceUsd vs price).
const { COUNTRIES, countryByCode, LANGUAGES, languageByCode, CURRENCIES } = require("./reference");
const H = require("./lib");

module.exports = function catalog(S) {
  const { db, util, identity } = S;
  const { ok, fail } = util;

  // ------------------------------------------------------------------ lookups
  const zoneById = (id) => db.zones.find((z) => z.id === id);
  const durationById = (id) => db.durations.find((d) => d.id === id);
  const deptById = (id) => db.departments.find((d) => d.id === id);
  const catById = (id) => db.categories.find((c) => c.id === id);
  const featureById = (id) => db.features.find((f) => f.id === id);
  const planById = (id) => db.plans.find((p) => p.id === id);
  const pkgById = (id) => db.packages.find((p) => p.id === id);
  const active = (list) => list.filter((x) => !x.archivedAt);
  const fallbackZone = () => db.zones.find((z) => z.isFallback) || db.zones[0];
  function zoneForCountry(code) {
    const c = String(code || "").toUpperCase();
    if (!c) return null;
    return db.zones.find((z) => z.countryCodes.includes(c)) || fallbackZone();
  }
  const sortedDurations = (ids, type) =>
    ids.map(durationById).filter((d) => d && !d.archivedAt && (!type || d.type === type)).sort((a, b) => a.months - b.months);

  // Localized field for the viewer: admins/managers get the stored map, everyone else a resolved string.
  const loc = (req, value) => (req.sc.catAdmin ? { ...(value || {}) } : H.text(value, req.sc.lang));
  const locStr = (req, value) => H.text(value, req.sc.lang);

  function currencyFields(code) {
    const c = H.cur(code);
    return { currencyCode: code, currencyName: c.name, currencySymbol: c.symbol };
  }
  function userDisplay(id) {
    const u = identity.findUser(id);
    return u ? identity.fullName(u) : null;
  }

  // ------------------------------------------------------------------ zones
  function countryOut(code) {
    const c = countryByCode(code);
    return { code, name: c?.name || code, nativeName: c?.nativeName || c?.name || code };
  }
  function zoneOut(z) {
    return {
      id: z.id,
      name: z.name,
      defaultCurrency: { code: z.currencyCode, name: H.cur(z.currencyCode).name, symbol: H.cur(z.currencyCode).symbol },
      countries: z.countryCodes.map(countryOut),
      languages: z.languageCodes.map((code) => {
        const l = languageByCode(code) || { code, name: code, nativeName: code, direction: "ltr" };
        return { code: l.code, name: l.name, nativeName: l.nativeName, direction: l.direction, isDefault: code === z.defaultLanguageCode };
      }),
      defaultLanguageCode: z.defaultLanguageCode,
      createdAt: z.createdAt,
      updatedAt: z.updatedAt,
    };
  }

  // ------------------------------------------------------------------ durations
  const durationOut = (d) => ({ id: d.id, type: d.type, months: d.months, percentage: d.percentage, isActive: d.isActive, createdAt: d.createdAt, updatedAt: d.updatedAt, ...(d.archivedAt ? { archivedAt: d.archivedAt } : {}) });
  const durationLabel = (d) => `${d.months} ${d.months === 1 ? "month" : "months"}${H.num(d.percentage) ? ` (${d.type === "plan" ? "-" : "+"}${H.num(d.percentage)}%)` : ""}`;

  // ------------------------------------------------------------------ features
  function featureText(f, lang) {
    const tr = f.translations;
    const order = [lang, f.defaultLanguageCode || "en", "en", ...Object.keys(tr)];
    const code = order.find((c) => tr[c] && (tr[c].name || tr[c].description));
    return { name: tr[code]?.name || "", description: tr[code]?.description || "", resolvedLanguageCode: code || "en", usedFallback: code !== lang };
  }
  const featureZone = (f, zoneId) => f.zonePrices.find((zp) => zp.zoneId === zoneId);
  // Monthly feature price in a zone (optionally for a country). null = not priced there.
  function featurePrice(f, zoneId, countryCode) {
    const zp = featureZone(f, zoneId);
    if (!zp) return null;
    if (countryCode) {
      const o = zp.countryOverrides.find((x) => x.countryCode === countryCode);
      if (o) return H.num(o.price);
    }
    return zp.basePrice == null || zp.basePrice === "" ? null : H.num(zp.basePrice);
  }
  function featureZonePricesOut(f) {
    return f.zonePrices
      .map((zp) => ({ zp, z: zoneById(zp.zoneId) }))
      .filter(({ z }) => z)
      .sort((a, b) => db.zones.indexOf(a.z) - db.zones.indexOf(b.z))
      .map(({ zp, z }) => ({
        zoneId: z.id,
        zoneName: z.name,
        currencyCode: z.currencyCode,
        basePrice: zp.basePrice == null ? null : H.money(zp.basePrice, z.currencyCode),
        countryOverrides: zp.countryOverrides.map((o) => ({ countryCode: o.countryCode, countryName: countryByCode(o.countryCode)?.name || o.countryCode, price: H.money(o.price, z.currencyCode) })),
      }));
  }
  function featureResolved(f, zone, countryCode) {
    if (!zone) return null;
    const zp = featureZone(f, zone.id);
    if (!zp) return null;
    const override = countryCode && zp.countryOverrides.find((o) => o.countryCode === countryCode);
    const amount = override ? H.num(override.price) : zp.basePrice == null ? null : H.num(zp.basePrice);
    if (amount == null) return null;
    return {
      zoneId: zone.id, zoneName: zone.name, ...currencyFields(zone.currencyCode),
      priceSource: override ? "country_override" : "zone_override", countryCode: override ? countryCode : countryCode || null,
      price: H.money(amount, zone.currencyCode),
    };
  }
  // Viewer zone for "resolvedPrice": explicit countryCode, else customer/salesman zone, else none (staff).
  function viewerZone(req, countryCode) {
    if (countryCode) return { zone: zoneForCountry(countryCode), countryCode: String(countryCode).toUpperCase() };
    if (req.sc.role === "customer" && req.sc.customer) return { zone: zoneForCountry(req.sc.customer.countryCode), countryCode: req.sc.customer.countryCode };
    if (req.sc.role === "salesman" && req.sc.staff?.zoneId) return { zone: zoneById(req.sc.staff.zoneId), countryCode: null };
    return { zone: null, countryCode: null };
  }
  const displayPrice = (req, usd) => H.money(req.sc.displayCurrency ? H.convert(usd, "USD", req.sc.displayCurrency) : usd, req.sc.displayCurrency || "USD");
  const planCountFor = (f) => active(db.plans).filter((p) => p.featureIds.includes(f.id)).length;

  function featureListItem(req, f, countryCode) {
    const t = featureText(f, req.sc.lang);
    const cat = catById(f.categoryId);
    const vz = viewerZone(req, countryCode);
    return {
      id: f.id,
      name: t.name,
      description: t.description,
      categoryId: f.categoryId,
      categoryName: cat ? locStr(req, cat.name) : "",
      paymentType: f.paymentType,
      visibility: f.visibility,
      isActive: f.isActive,
      priceUsd: H.money(f.priceUsd, "USD"),
      price: displayPrice(req, f.priceUsd),
      zonePrices: featureZonePricesOut(f),
      resolvedPrice: featureResolved(f, vz.zone, vz.countryCode),
      planCount: planCountFor(f),
      createdAt: f.createdAt,
      updatedAt: f.updatedAt,
      ...(f.archivedAt ? { archivedAt: f.archivedAt } : {}),
    };
  }
  function featureDetail(req, f, countryCode) {
    const t = featureText(f, req.sc.lang);
    const cat = catById(f.categoryId);
    const dept = cat && deptById(cat.departmentId);
    const vz = viewerZone(req, countryCode);
    return {
      id: f.id,
      defaultLanguageCode: f.defaultLanguageCode,
      translations: Object.entries(f.translations).map(([languageCode, v]) => ({ languageCode, name: v.name, description: v.description })),
      name: t.name,
      description: t.description,
      resolvedLanguageCode: t.resolvedLanguageCode,
      usedFallback: t.usedFallback,
      category: { id: cat?.id || "", name: cat ? locStr(req, cat.name) : "", departmentId: dept?.id || "", departmentName: dept ? locStr(req, dept.name) : "" },
      paymentType: f.paymentType,
      visibility: f.visibility,
      isActive: f.isActive,
      planCount: planCountFor(f),
      priceUsd: H.money(f.priceUsd, "USD"),
      price: displayPrice(req, f.priceUsd),
      zonePrices: featureZonePricesOut(f),
      resolvedPrice: featureResolved(f, vz.zone, vz.countryCode),
      createdAt: f.createdAt,
      updatedAt: f.updatedAt,
    };
  }
  function featureSummary(req, f) {
    const t = featureText(f, req.sc.lang);
    return { id: f.id, name: t.name, description: t.description, paymentType: f.paymentType, visibility: f.visibility, isActive: f.isActive, resolvedLanguageCode: t.resolvedLanguageCode, usedFallback: t.usedFallback, priceUsd: H.money(f.priceUsd, "USD"), price: displayPrice(req, f.priceUsd) };
  }

  // ------------------------------------------------------------------ plan pricing engine
  const planZone = (p, zoneId) => p.zonePrices.find((zp) => zp.zoneId === zoneId);
  // Base monthly price of a plan in a zone: manual override, or derived from its features.
  function planZoneBase(p, zoneId, countryCode) {
    const zp = planZone(p, zoneId);
    if (!zp) return null;
    const manual = H.num(zp.basePrice) > 0;
    if (countryCode) {
      const o = zp.countryOverrides.find((x) => x.countryCode === countryCode);
      if (o && H.num(o.price) > 0) return { amount: H.num(o.price), source: "country_override", manual: true };
    }
    if (manual) return { amount: H.num(zp.basePrice), source: "zone_override", manual: true };
    let sum = 0;
    let unpriced = 0;
    for (const fid of p.featureIds) {
      const f = featureById(fid);
      if (!f) continue;
      const price = featurePrice(f, zoneId, countryCode);
      if (price == null) unpriced++;
      else sum += price;
    }
    if (unpriced > 0 || p.featureIds.length === 0) return { amount: null, source: "derived", manual: false, unpriced };
    return { amount: sum, source: "derived", manual: false };
  }
  function installmentTerms(p) {
    if (!p.installmentsEnabled) return [];
    return sortedDurations(p.installmentDurationIds, "installment").filter((d) => d.isActive);
  }
  function installmentPrices(discountedTotal, code, terms) {
    return terms.map((d) => {
      const markup = H.num(d.percentage);
      const payable = discountedTotal + (discountedTotal * markup) / 100;
      return { durationId: d.id, months: d.months, markupPercentage: H.money(markup, "USD"), isMarkupApplied: markup > 0, monthlyPayment: H.money(payable / d.months, code) };
    });
  }
  function durationPricing(base, d, code, terms) {
    const undiscounted = base * d.months;
    const pctv = H.num(d.percentage);
    const discountAmount = (undiscounted * pctv) / 100;
    const discounted = undiscounted - discountAmount;
    return {
      baseMonthlyPrice: H.money(base, code),
      undiscountedTotal: H.money(undiscounted, code),
      discountPercentage: H.money(pctv, "USD"),
      discountAmount: H.money(discountAmount, code),
      discountedTotal: H.money(discounted, code),
      effectiveMonthlyPrice: H.money(discounted / d.months, code),
      duration: { durationId: d.id, months: d.months, discountPercentage: H.money(pctv, "USD") },
      installments: installmentPrices(H.round(discounted, code), code, terms),
    };
  }
  function planMatrixFor(p, zone, countryCode) {
    const base = planZoneBase(p, zone.id, countryCode);
    if (!base || base.amount == null) return [];
    const terms = installmentTerms(p);
    return sortedDurations(p.planDurationIds, "plan")
      .filter((d) => d.isActive)
      .map((d) => ({
        zoneId: zone.id, zoneName: zone.name, ...currencyFields(zone.currencyCode),
        priceSource: base.source === "country_override" ? "country_override" : "zone_override",
        countryCode: countryCode || null,
        ...durationPricing(base.amount, d, zone.currencyCode, terms),
      }));
  }
  const planZones = (p) => p.zonePrices.map((zp) => zoneById(zp.zoneId)).filter(Boolean).sort((a, b) => db.zones.indexOf(a) - db.zones.indexOf(b));
  function planMatrix(p) {
    return planZones(p).flatMap((z) => planMatrixFor(p, z, null));
  }
  function planCompletion(p) {
    const missing = [];
    if (!p.featureIds.length) missing.push("features");
    if (!sortedDurations(p.planDurationIds, "plan").length) missing.push("durations");
    if (!planZones(p).some((z) => planZoneBase(p, z.id)?.amount != null)) missing.push("zonePricing");
    if (!p.commission) missing.push("commission");
    return { isComplete: missing.length === 0, missingSections: missing };
  }
  const planPaymentMode = (p) => (installmentTerms(p).length ? "installment" : "cash_only");
  function planResolved(req, p, countryCode) {
    const vz = viewerZone(req, countryCode);
    if (!vz.zone) return undefined;
    if (!planZone(p, vz.zone.id)) return countryCode ? [] : undefined;
    return planMatrixFor(p, vz.zone, vz.countryCode);
  }
  function planListItem(req, p, countryCode) {
    const dept = deptById(p.departmentId);
    const cats = p.categoryIds.map(catById).filter(Boolean);
    const feats = p.featureIds.map(featureById).filter(Boolean);
    const durs = sortedDurations(p.planDurationIds, "plan");
    const zones = planZones(p);
    const out = {
      id: p.id,
      name: loc(req, p.name),
      department: { id: dept?.id || "", name: dept ? loc(req, dept.name) : "" },
      category: cats[0] ? { id: cats[0].id, name: loc(req, cats[0].name) } : { id: "", name: "" },
      categories: cats.map((c) => ({ id: c.id, name: loc(req, c.name) })),
      activationRequested: !!p.activationRequested,
      isActive: !!p.isActive,
      isPrivate: !!p.isPrivate,
      completion: planCompletion(p),
      features: feats.map((f) => featureSummary(req, f)),
      featureCount: feats.length,
      publicFeatureCount: feats.filter((f) => f.visibility === "public").length,
      installmentFeatureCount: feats.filter((f) => f.paymentType === "installment").length,
      zoneCount: zones.length,
      countryOverrideCount: p.zonePrices.reduce((s, zp) => s + zp.countryOverrides.length, 0),
      durationCount: durs.length,
      minimumDurationMonths: durs[0]?.months ?? null,
      maximumDurationMonths: durs[durs.length - 1]?.months ?? null,
      paymentMode: planPaymentMode(p),
      zones: zones.map((z) => ({ id: z.id, name: z.name })),
      pricingMatrix: planMatrix(p),
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      ...(p.archivedAt ? { archivedAt: p.archivedAt } : {}),
    };
    const resolved = planResolved(req, p, countryCode);
    if (resolved !== undefined) out.resolvedPrice = resolved;
    return out;
  }
  function managerSummary(userId) {
    const u = userId && identity.findUser(userId);
    if (!u) return null;
    return { id: u.id, displayName: identity.fullName(u), avatar: u.avatar, isActive: u.isActive, isAvailable: true };
  }
  function planDetail(req, p, countryCode) {
    const base = planListItem(req, p, countryCode);
    const dept = deptById(p.departmentId);
    const feats = p.featureIds.map(featureById).filter(Boolean);
    const zones = planZones(p);
    return {
      ...base,
      description: loc(req, p.description),
      manager: managerSummary(dept?.managerId),
      allFeatures: feats.map((f) => featureSummary(req, f)),
      planDurations: sortedDurations(p.planDurationIds, "plan").map((d) => ({ durationId: d.id, months: d.months, discountPercentage: H.money(d.percentage, "USD") })),
      installmentsEnabled: !!p.installmentsEnabled,
      installmentDurations: (p.installmentsEnabled ? sortedDurations(p.installmentDurationIds, "installment") : []).map((d) => ({ durationId: d.id, months: d.months, markupPercentage: H.money(d.percentage, "USD"), isMarkupApplied: H.num(d.percentage) > 0 })),
      zoneDetails: zones.map((z) => {
        const zp = planZone(p, z.id);
        const zb = planZoneBase(p, z.id);
        return {
          id: z.id, name: z.name, ...currencyFields(z.currencyCode),
          priceSource: zb?.manual ? "zone_override" : "derived",
          basePrice: zb?.amount == null ? null : H.money(zb.amount, z.currencyCode),
          countryOverrideCount: zp.countryOverrides.length,
          countries: z.countryCodes.map((cc) => {
            const o = zp.countryOverrides.find((x) => x.countryCode === cc);
            return {
              countryCode: cc,
              countryName: countryByCode(cc)?.name || cc,
              priceSource: o ? "country_override" : "inherit",
              overridePrice: o ? H.money(o.price, z.currencyCode) : null,
              pricingMatrix: planMatrixFor(p, z, cc),
            };
          }),
        };
      }),
      availableZoneCount: db.zones.length,
      allZonesEnabled: zones.length === db.zones.length,
      // Fixed plan commissions are stored in USD and converted into each contract's currency.
      commission: p.commission ? { type: p.commission.type, amount: H.money(p.commission.amount, "USD"), currencyCode: "USD" } : null,
    };
  }

  // Preflight: suggested prices for a draft plan (features + durations), per zone.
  function preflight(body) {
    const featureIds = H.listParam(body.featureIds);
    const feats = featureIds.map(featureById).filter(Boolean);
    const zoneIds = H.listParam(body.zoneIds);
    const zones = (zoneIds.length ? zoneIds.map(zoneById).filter(Boolean) : db.zones);
    const durs = sortedDurations(H.listParam(body.planDurationIds), "plan");
    const terms = sortedDurations(H.listParam(body.installmentDurationIds), "installment");
    return {
      featureTotalUsd: H.money(feats.reduce((s, f) => s + H.num(f.priceUsd), 0), "USD"),
      ratesAsOf: require("./reference").RATES_AS_OF,
      zones: zones.map((z) => {
        let sum = 0;
        let unpriced = 0;
        for (const f of feats) {
          const price = featurePrice(f, z.id);
          if (price == null) unpriced++;
          else sum += price;
        }
        const priced = feats.length > 0 && unpriced === 0;
        return {
          zoneId: z.id, zoneName: z.name, ...currencyFields(z.currencyCode), minorUnits: H.minor(z.currencyCode),
          suggestedBasePrice: priced ? H.money(sum, z.currencyCode) : null,
          unpricedFeatureCount: unpriced,
          countries: z.countryCodes.map((cc) => {
            let csum = 0;
            let cun = 0;
            for (const f of feats) {
              const price = featurePrice(f, z.id, cc);
              if (price == null) cun++;
              else csum += price;
            }
            return { countryCode: cc, countryName: countryByCode(cc)?.name || cc, suggestedPrice: feats.length && !cun ? H.money(csum, z.currencyCode) : null };
          }),
          durations: priced
            ? durs.map((d) => {
                const dp = durationPricing(sum, d, z.currencyCode, terms);
                return { duration: dp.duration, undiscountedTotal: dp.undiscountedTotal, discountAmount: dp.discountAmount, discountedTotal: dp.discountedTotal, effectiveMonthlyPrice: dp.effectiveMonthlyPrice, installments: dp.installments };
              })
            : [],
        };
      }),
    };
  }

  // ------------------------------------------------------------------ packages
  function planMonthly(p, zoneId, countryCode) {
    const b = planZoneBase(p, zoneId, countryCode);
    return b?.amount ?? null;
  }
  function packageZonesOut(pkg) {
    const plans = pkg.planIds.map(planById).filter(Boolean);
    return pkg.zones
      .map((pz) => ({ pz, z: zoneById(pz.zoneId) }))
      .filter(({ z }) => z)
      .sort((a, b) => db.zones.indexOf(a.z) - db.zones.indexOf(b.z))
      .map(({ pz, z }) => {
        const derived = plans.reduce((s, p) => s + (planMonthly(p, z.id) || 0), 0);
        return {
          zoneId: z.id, zoneName: z.name, currencyCode: z.currencyCode,
          amount: H.money(pz.price, z.currencyCode),
          countryOverrideCount: (pz.countryOverrides || []).length,
          basePrice: H.money(pz.price, z.currencyCode),
          priceSource: "manual",
          derivedPlansTotal: H.money(derived, z.currencyCode),
          countryOverrides: (pz.countryOverrides || []).map((o) => ({ countryCode: o.countryCode, price: H.money(o.price, z.currencyCode), effectivePrice: H.money(o.price, z.currencyCode) })),
        };
      });
  }
  function packageListItem(req, pkg) {
    const plans = pkg.planIds.map(planById).filter(Boolean);
    return {
      id: pkg.id,
      name: loc(req, pkg.name),
      description: loc(req, pkg.description),
      planNames: plans.map((p) => loc(req, p.name)),
      prices: packageZonesOut(pkg).map((z) => ({ zoneId: z.zoneId, zoneName: z.zoneName, currencyCode: z.currencyCode, amount: z.amount, countryOverrideCount: z.countryOverrideCount })),
      status: pkg.status,
      createdAt: pkg.createdAt,
      updatedAt: pkg.updatedAt,
      ...(pkg.archivedAt ? { archivedAt: pkg.archivedAt } : {}),
    };
  }
  function packageDetail(req, pkg) {
    const plans = pkg.planIds.map(planById).filter(Boolean);
    const zones = packageZonesOut(pkg);
    const allDurs = new Set(plans.flatMap((p) => sortedDurations(p.planDurationIds, "plan").map((d) => d.months)));
    const months = [...allDurs].sort((a, b) => a - b);
    const firstCat = plans[0] && catById(plans[0].categoryIds[0]);
    const firstDept = plans[0] && deptById(plans[0].departmentId);
    return {
      id: pkg.id,
      name: loc(req, pkg.name),
      description: loc(req, pkg.description),
      status: pkg.status,
      category: firstCat ? loc(req, firstCat.name) : "",
      department: firstDept ? loc(req, firstDept.name) : "",
      planCount: plans.length,
      publicPlanCount: plans.filter((p) => !p.isPrivate).length,
      installmentPlanCount: plans.filter((p) => planPaymentMode(p) === "installment").length,
      planDurationCount: months.length,
      minimumDurationMonths: months[0] ?? 0,
      maximumDurationMonths: months[months.length - 1] ?? 0,
      installmentsEnabled: plans.some((p) => planPaymentMode(p) === "installment"),
      pricingSummary: zones.map((z) => {
        const original = H.num(z.derivedPlansTotal);
        const bundle = H.num(z.amount);
        const saving = original - bundle;
        return { zoneId: z.zoneId, zoneName: z.zoneName, plansBoughtSeparately: plans.length, currencyCode: z.currencyCode, originalAmount: H.money(original, z.currencyCode), bundlePrice: H.money(bundle, z.currencyCode), savingsAmount: H.money(saving, z.currencyCode), savingsPercentage: H.money(original ? (saving / original) * 100 : 0, "USD") };
      }),
      plans: plans.map((p) => {
        const cat = catById(p.categoryIds[0]);
        const dept = deptById(p.departmentId);
        const vz = viewerZone(req);
        return {
          id: p.id,
          name: loc(req, p.name),
          isActive: !!p.isActive,
          description: loc(req, p.description),
          category: cat ? { id: cat.id, name: loc(req, cat.name) } : undefined,
          department: dept ? { id: dept.id, name: loc(req, dept.name) } : undefined,
          allFeatures: p.featureIds.map(featureById).filter(Boolean).map((f) => {
            const t = featureText(f, req.sc.lang);
            const zps = featureZonePricesOut(f);
            const resolved = featureResolved(f, vz.zone, vz.countryCode);
            return {
              id: f.id, name: t.name, description: t.description,
              zonePrices: zps.map((x) => ({ zoneId: x.zoneId, zoneName: x.zoneName, currencyCode: x.currencyCode, basePrice: x.basePrice })),
              resolvedPrice: resolved ? [{ zoneId: resolved.zoneId, zoneName: resolved.zoneName, currencyCode: resolved.currencyCode, price: resolved.price }] : [],
              paymentType: f.paymentType, visibility: f.visibility, isActive: f.isActive,
              priceUsd: H.money(f.priceUsd, "USD"), price: displayPrice(req, f.priceUsd),
            };
          }),
          pricingMatrix: planMatrix(p).map((m) => ({ zoneId: m.zoneId, zoneName: m.zoneName, currencyCode: m.currencyCode, baseMonthlyPrice: m.baseMonthlyPrice, undiscountedTotal: m.undiscountedTotal, discountedTotal: m.discountedTotal, discountPercentage: m.discountPercentage, discountAmount: m.discountAmount, effectiveMonthlyPrice: m.effectiveMonthlyPrice, duration: m.duration })),
        };
      }),
      planSummaries: plans.map((p) => ({ id: p.id, name: loc(req, p.name) })),
      zones,
      createdAt: pkg.createdAt,
      updatedAt: pkg.updatedAt,
    };
  }

  // ------------------------------------------------------------------ departments & categories
  function managerObj(userId) {
    const u = userId && identity.findUser(userId);
    if (!u) return null;
    return { id: u.id, name: identity.fullName(u), firstName: u.firstName, lastName: u.lastName, email: u.email };
  }
  const catPlans = (c) => active(db.plans).filter((p) => p.categoryIds.includes(c.id));
  const catFeatures = (c) => active(db.features).filter((f) => f.categoryId === c.id);
  const deptCategories = (d) => active(db.categories).filter((c) => c.departmentId === d.id);
  function departmentOut(req, d, asString = false) {
    const L = (v) => (asString ? locStr(req, v) : loc(req, v));
    const cats = deptCategories(d);
    return {
      id: d.id,
      name: L(d.name),
      manager: managerObj(d.managerId),
      managerName: userDisplay(d.managerId) || "Unassigned",
      categoryCount: cats.length,
      categories: cats.map((c) => ({
        id: c.id, name: L(c.name), description: locStr(req, c.description),
        department: { id: d.id, name: L(d.name) },
        planCount: catPlans(c).length, featureCount: catFeatures(c).length,
        createdAt: c.createdAt, updatedAt: c.updatedAt,
      })),
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    };
  }
  function groupedCategoryItem(req, c) {
    return { id: c.id, name: loc(req, c.name), description: loc(req, c.description), planCount: catPlans(c).length };
  }
  function categoryZonesOut(c) {
    const plans = catPlans(c);
    return db.zones
      .map((z) => {
        const served = plans.filter((p) => planZone(p, z.id));
        if (!served.length) return null;
        const prices = served.map((p) => planMonthly(p, z.id)).filter((x) => x != null);
        const min = prices.length ? Math.min(...prices) : 0;
        return {
          id: z.id, name: z.name, ...currencyFields(z.currencyCode),
          countryCodes: z.countryCodes, countryNames: z.countryCodes.map((cc) => countryByCode(cc)?.name || cc),
          planCount: served.length, price: H.money(min, z.currencyCode), priceSource: "zone_override",
        };
      })
      .filter(Boolean);
  }
  function categoryDetail(req, c) {
    const d = deptById(c.departmentId);
    const plans = catPlans(c);
    const feats = catFeatures(c);
    const vz = viewerZone(req);
    const zones = categoryZonesOut(c);
    return {
      id: c.id,
      name: loc(req, c.name),
      description: loc(req, c.description),
      departmentId: c.departmentId,
      departmentName: d ? loc(req, d.name) : "",
      departmentManagerName: d ? userDisplay(d.managerId) || "Unassigned" : "Unassigned",
      activePlanCount: plans.filter((p) => p.isActive).length,
      planCount: plans.length,
      featureCount: feats.length,
      zoneCount: zones.length,
      zones,
      plans: plans.map((p) => ({ id: p.id, name: loc(req, p.name), description: loc(req, p.description), featureCount: p.featureIds.length, isActive: !!p.isActive, createdAt: p.createdAt, updatedAt: p.updatedAt })),
      features: feats.map((f) => {
        const t = featureText(f, req.sc.lang);
        const resolved = featureResolved(f, vz.zone, vz.countryCode);
        return {
          id: f.id, name: t.name, description: t.description,
          zonePrices: featureZonePricesOut(f).map((x) => ({ zoneId: x.zoneId, zoneName: x.zoneName, currencyCode: x.currencyCode, basePrice: x.basePrice })),
          resolvedPrice: resolved ? [{ zoneId: resolved.zoneId, zoneName: resolved.zoneName, currencyCode: resolved.currencyCode, price: resolved.price }] : [],
          paymentType: f.paymentType, visibility: f.visibility, isActive: f.isActive, planCount: planCountFor(f),
          priceUsd: H.money(f.priceUsd, "USD"), price: displayPrice(req, f.priceUsd),
          createdAt: f.createdAt, updatedAt: f.updatedAt,
        };
      }),
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    };
  }

  // ------------------------------------------------------------------ write helpers
  function parseZonePrices(input, { requireAny = false } = {}) {
    const list = Array.isArray(input) ? input : [];
    const out = [];
    for (const zp of list) {
      if (!zoneById(zp.zoneId)) return { error: `Unknown zone ${zp.zoneId}` };
      out.push({
        zoneId: zp.zoneId,
        basePrice: zp.basePrice == null || zp.basePrice === "" ? null : H.money(H.num(zp.basePrice), "USD"),
        countryOverrides: (zp.countryOverrides || []).filter((o) => o && o.countryCode).map((o) => ({ countryCode: String(o.countryCode).toUpperCase(), price: H.money(H.num(o.price), "USD") })),
      });
    }
    if (requireAny && !out.length) return { error: "At least one zone price is required" };
    return { value: out };
  }
  const touch = (row, patch) => Object.assign(row, patch, { updatedAt: new Date().toISOString() });
  const requireCatalogWrite = (req, res) => {
    if (!["admin", "manager"].includes(req.sc.role)) {
      fail(res, 403, "Only admins and managers can change the catalog");
      return false;
    }
    return true;
  };
  const notFound = (res, what) => fail(res, 404, `${what} not found`);
  const page = (list, q, defaultLimit = 10) => util.paginate(list, q, { defaultLimit });

  // ------------------------------------------------------------------ routes
  function routes(app) {
    // ---------------- zones
    app.get("/api/zones", (req, res) => {
      let list = util.search(db.zones, req.query.search || req.query.q, ["name", "currencyCode", "countryCodes"]);
      const { items, meta } = page(list, req.query, 20);
      ok(res, { items: items.map(zoneOut), meta }, "Zones retrieved");
    });
    app.get("/api/zones/list", (req, res) => {
      const list = util.search(db.zones, req.query.search || req.query.q, ["name"]);
      const { items, meta } = page(list, req.query, 50);
      ok(res, { items: items.map((z) => ({ id: z.id, name: z.name })), meta }, "Zones retrieved");
    });
    app.get("/api/zones/catalog/countries", (req, res) => {
      const list = util.search(COUNTRIES, req.query.search || req.query.q, ["code", "name", "nativeName"]);
      const { items, meta } = page(list, req.query, 50);
      ok(res, { items, meta }, "Countries retrieved");
    });
    app.get("/api/zones/catalog/languages", (req, res) => {
      const list = util.search(LANGUAGES, req.query.search || req.query.q, ["code", "name", "nativeName"]);
      const { items, meta } = page(list, req.query, 50);
      ok(res, { items, meta }, "Languages retrieved");
    });
    app.get("/api/zones/:id", (req, res) => {
      const z = zoneById(req.params.id);
      if (!z) return notFound(res, "Zone");
      ok(res, zoneOut(z), "Zone retrieved");
    });
    function zoneBody(b, existing) {
      const name = b.name != null ? String(b.name).trim() : existing?.name;
      if (!name) return { error: "Zone name is required" };
      const countryCodes = b.countryCodes ? H.listParam(b.countryCodes).map((c) => c.toUpperCase()) : existing?.countryCodes || [];
      if (!countryCodes.length) return { error: "Select at least one country" };
      const clash = db.zones.find((z) => z !== existing && z.countryCodes.some((c) => countryCodes.includes(c)));
      if (clash) return { error: `Country already belongs to zone ${clash.name}`, status: 409 };
      const currencyCode = String(b.defaultCurrencyCode || existing?.currencyCode || "").toUpperCase();
      if (!CURRENCIES[currencyCode]) return { error: "Unsupported currency" };
      const languageCodes = b.languageCodes ? H.listParam(b.languageCodes) : existing?.languageCodes || ["en"];
      const defaultLanguageCode = b.defaultLanguageCode || existing?.defaultLanguageCode || languageCodes[0];
      return { value: { name, countryCodes, currencyCode, languageCodes: languageCodes.includes(defaultLanguageCode) ? languageCodes : [defaultLanguageCode, ...languageCodes], defaultLanguageCode } };
    }
    app.post("/api/zones", (req, res) => {
      if (!requireCatalogWrite(req, res)) return;
      const r = zoneBody(req.body || {});
      if (r.error) return fail(res, r.status || 422, r.error);
      const z = { id: H.newId(), key: null, isFallback: false, ...r.value, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      db.zones.push(z);
      ok(res, zoneOut(z), "Zone created successfully", 201);
    });
    app.patch("/api/zones/:id", (req, res) => {
      if (!requireCatalogWrite(req, res)) return;
      const z = zoneById(req.params.id);
      if (!z) return notFound(res, "Zone");
      const r = zoneBody(req.body || {}, z);
      if (r.error) return fail(res, r.status || 422, r.error);
      touch(z, r.value);
      ok(res, zoneOut(z), "Zone updated successfully");
    });
    app.delete("/api/zones/:id", (req, res) => {
      if (!requireCatalogWrite(req, res)) return;
      const z = zoneById(req.params.id);
      if (!z) return notFound(res, "Zone");
      const used = active(db.plans).filter((p) => planZone(p, z.id)).length;
      if (used) return fail(res, 409, `Zone is used by ${used} plan(s); remove it from those plans first`);
      db.zones.splice(db.zones.indexOf(z), 1);
      for (const f of db.features) f.zonePrices = f.zonePrices.filter((zp) => zp.zoneId !== z.id);
      for (const p of db.packages) p.zones = p.zones.filter((pz) => pz.zoneId !== z.id);
      ok(res, null, "Zone deleted successfully");
    });

    // ---------------- durations
    function durationsPage(req, archived) {
      const type = req.query.type;
      let list = db.durations.filter((d) => (archived ? d.archivedAt : !d.archivedAt));
      const totals = { plan: list.filter((d) => d.type === "plan").length, installment: list.filter((d) => d.type === "installment").length };
      if (type) list = list.filter((d) => d.type === type);
      const s = String(req.query.search || req.query.q || "").trim();
      if (s) list = list.filter((d) => String(d.months).includes(s) || durationLabel(d).toLowerCase().includes(s.toLowerCase()));
      list = [...list].sort((a, b) => (a.type === b.type ? a.months - b.months : a.type === "plan" ? -1 : 1));
      const { items, meta } = page(list, req.query, 50);
      return { items: items.map(durationOut), meta, totals };
    }
    app.get("/api/durations", (req, res) => ok(res, durationsPage(req, false), "Durations retrieved"));
    app.get("/api/durations/archived", (req, res) => ok(res, durationsPage(req, true), "Archived durations retrieved"));
    app.get("/api/durations/list", (req, res) => {
      let list = active(db.durations).filter((d) => d.isActive && (!req.query.type || d.type === req.query.type)).sort((a, b) => a.months - b.months);
      const { items, meta } = page(list, req.query, 50);
      ok(res, { items: items.map((d) => ({ id: d.id, name: durationLabel(d) })), meta }, "Durations retrieved");
    });
    function durationBody(b, existing) {
      const type = existing ? existing.type : b.type;
      if (!["plan", "installment"].includes(type)) return { error: "Duration type must be plan or installment" };
      const months = b.months != null ? parseInt(b.months, 10) : existing?.months;
      if (!Number.isInteger(months) || months < 1 || months > 60) return { error: "Months must be between 1 and 60" };
      const percentage = b.percentage != null ? H.num(b.percentage) : H.num(existing?.percentage);
      if (percentage < 0 || percentage > 100) return { error: "Percentage must be between 0 and 100" };
      const dup = active(db.durations).find((d) => d !== existing && d.type === type && d.months === months);
      if (dup) return { error: `A ${type} duration of ${months} months already exists`, status: 409 };
      return { value: { type, months, percentage: H.money(percentage, "USD"), isActive: b.isActive != null ? !!b.isActive : existing ? existing.isActive : true } };
    }
    app.post("/api/durations", (req, res) => {
      if (!requireCatalogWrite(req, res)) return;
      const r = durationBody(req.body || {});
      if (r.error) return fail(res, r.status || 422, r.error);
      const d = { id: H.newId(), ...r.value, archivedAt: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      db.durations.push(d);
      ok(res, durationOut(d), "Duration created successfully", 201);
    });
    app.patch("/api/durations/:id", (req, res) => {
      if (!requireCatalogWrite(req, res)) return;
      const d = durationById(req.params.id);
      if (!d) return notFound(res, "Duration");
      const r = durationBody(req.body || {}, d);
      if (r.error) return fail(res, r.status || 422, r.error);
      touch(d, r.value);
      ok(res, durationOut(d), "Duration updated successfully");
    });
    app.delete("/api/durations/:id", (req, res) => {
      if (!requireCatalogWrite(req, res)) return;
      const d = durationById(req.params.id);
      if (!d || d.archivedAt) return notFound(res, "Duration");
      touch(d, { archivedAt: new Date().toISOString() });
      ok(res, null, "Duration archived successfully");
    });

    // ---------------- departments
    app.get("/api/departments", (req, res) => {
      // The coupons page reads department/category names as plain strings (it requests without `page`).
      const asString = req.query.page == null;
      let list = active(db.departments);
      const s = String(req.query.search || req.query.q || "").toLowerCase().trim();
      if (s) list = list.filter((d) => Object.values(d.name).some((v) => v.toLowerCase().includes(s)) || deptCategories(d).some((c) => Object.values(c.name).some((v) => v.toLowerCase().includes(s))));
      const { items, meta } = page(list, req.query, 10);
      ok(res, { items: items.map((d) => departmentOut(req, d, asString)), meta }, "Departments retrieved");
    });
    app.get("/api/departments/list", (req, res) => {
      const list = active(db.departments).filter((d) => !req.query.search || H.text(d.name, req.sc.lang).toLowerCase().includes(String(req.query.search).toLowerCase()));
      const { items, meta } = page(list, req.query, 50);
      ok(res, { items: items.map((d) => ({ id: d.id, name: loc(req, d.name) })), meta }, "Departments retrieved");
    });
    app.get("/api/departments/catalog/managers", (req, res) => {
      const taken = new Set(db.departments.map((d) => d.managerId).filter(Boolean));
      const people = identity.users.filter((u) => ["admin", "manager"].includes(K.appRole(u)));
      const list = util.search(people.map((u) => ({ id: u.id, displayName: identity.fullName(u), avatar: u.avatar, isActive: u.isActive, isAvailable: !taken.has(u.id) })), req.query.search, ["displayName"]);
      const { items, meta } = page(list, req.query, 50);
      ok(res, { items, meta }, "Managers retrieved");
    });
    app.get("/api/departments/:id", (req, res) => {
      const d = deptById(req.params.id);
      if (!d) return notFound(res, "Department");
      ok(res, departmentOut(req, d), "Department retrieved");
    });
    app.post("/api/departments", (req, res) => {
      if (!requireCatalogWrite(req, res)) return;
      const n = H.cleanLocalized(req.body?.name, { required: true, field: "name" });
      if (n.error) return fail(res, 422, n.error);
      const dup = db.departments.find((d) => d.name.en && n.value.en && d.name.en.toLowerCase() === n.value.en.toLowerCase());
      if (dup) return fail(res, 422, "A department with this name already exists");
      const d = { id: H.newId(), key: null, name: n.value, managerId: req.body.managerId ? Number(req.body.managerId) : null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      db.departments.push(d);
      ok(res, departmentOut(req, d), "Department created successfully", 201);
    });
    app.patch("/api/departments/:id", (req, res) => {
      if (!requireCatalogWrite(req, res)) return;
      const d = deptById(req.params.id);
      if (!d) return notFound(res, "Department");
      const patch = {};
      if (req.body?.name !== undefined) {
        const n = H.cleanLocalized(req.body.name, { required: false, field: "name" });
        if (n.error) return fail(res, 422, n.error);
        patch.name = H.mergeLocalized(d.name, n.value);
      }
      if (req.body?.managerId !== undefined) patch.managerId = req.body.managerId ? Number(req.body.managerId) : null;
      touch(d, patch);
      ok(res, departmentOut(req, d), "Department updated successfully");
    });
    app.delete("/api/departments/:id", (req, res) => {
      if (!requireCatalogWrite(req, res)) return;
      const d = deptById(req.params.id);
      if (!d) return notFound(res, "Department");
      if (deptCategories(d).length) return fail(res, 409, "Move or delete the department's categories first");
      db.departments.splice(db.departments.indexOf(d), 1);
      ok(res, null, "Department deleted successfully");
    });

    // ---------------- categories
    app.get("/api/categories/list", (req, res) => {
      let list = active(db.categories);
      if (req.query.departmentId) list = list.filter((c) => c.departmentId === req.query.departmentId);
      const s = String(req.query.search || "").toLowerCase();
      if (s) list = list.filter((c) => Object.values(c.name).some((v) => v.toLowerCase().includes(s)));
      const { items, meta } = page(list, req.query, 50);
      ok(res, { items: items.map((c) => ({ id: c.id, name: loc(req, c.name) })), meta }, "Categories retrieved");
    });
    app.get("/api/categories/grouped", (req, res) => {
      const s = String(req.query.search || req.query.q || "").toLowerCase();
      const match = (c) => !s || Object.values(c.name).some((v) => v.toLowerCase().includes(s)) || Object.values(c.description || {}).some((v) => v.toLowerCase().includes(s));
      const group = (d, cats) => ({ departmentId: d.id, departmentName: loc(req, d.name), managerName: userDisplay(d.managerId) || "Unassigned", categoryCount: deptCategories(d).length, categories: cats.map((c) => groupedCategoryItem(req, c)) });
      if (req.query.departmentId) {
        const d = deptById(req.query.departmentId);
        if (!d) return notFound(res, "Department");
        const { items, meta } = page(deptCategories(d).filter(match), req.query, 10);
        return ok(res, { items: [group(d, items)], meta }, "Categories retrieved");
      }
      const groups = active(db.departments).map((d) => ({ d, cats: deptCategories(d).filter(match) })).filter((g) => g.cats.length || !s);
      const { items, meta } = page(groups, req.query, 10);
      ok(res, { items: items.map((g) => group(g.d, g.cats)), meta }, "Categories retrieved");
    });
    app.get("/api/categories/archived", (req, res) => {
      const list = util.search(db.categories.filter((c) => c.archivedAt), req.query.search, ["name.en", "name.ar", "name.de"]);
      const { items, meta } = page(list, req.query, 10);
      ok(res, { items: items.map((c) => ({ ...groupedCategoryItem(req, c), departmentName: deptById(c.departmentId) ? loc(req, deptById(c.departmentId).name) : "", archivedAt: c.archivedAt })), meta }, "Archived categories retrieved");
    });
    app.get("/api/categories", (req, res) => {
      let list = active(db.categories);
      if (req.query.departmentId) list = list.filter((c) => c.departmentId === req.query.departmentId);
      const s = String(req.query.search || "").toLowerCase();
      if (s) list = list.filter((c) => Object.values(c.name).some((v) => v.toLowerCase().includes(s)));
      const { items, meta } = page(list, req.query, 10);
      ok(res, {
        items: items.map((c) => {
          const d = deptById(c.departmentId);
          return { id: c.id, name: loc(req, c.name), description: locStr(req, c.description), department: { id: d?.id, name: d ? loc(req, d.name) : "" }, planCount: catPlans(c).length, featureCount: catFeatures(c).length, createdAt: c.createdAt, updatedAt: c.updatedAt };
        }),
        meta,
      }, "Categories retrieved");
    });
    app.get("/api/categories/:id", (req, res) => {
      const c = catById(req.params.id);
      if (!c || c.archivedAt) return notFound(res, "Category");
      ok(res, categoryDetail(req, c), "Category retrieved");
    });
    app.post("/api/categories", (req, res) => {
      if (!requireCatalogWrite(req, res)) return;
      const b = req.body || {};
      if (!deptById(b.departmentId)) return fail(res, 422, "Department is required");
      const n = H.cleanLocalized(b.name, { required: true, field: "name" });
      if (n.error) return fail(res, 422, n.error);
      const d = H.cleanLocalized(b.description, { required: false, field: "description" });
      if (d.error) return fail(res, 422, d.error);
      const c = { id: H.newId(), key: null, departmentId: b.departmentId, name: n.value, description: d.value || {}, archivedAt: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      db.categories.push(c);
      ok(res, { ...groupedCategoryItem(req, c), departmentId: c.departmentId }, "Category created successfully", 201);
    });
    app.patch("/api/categories/:id", (req, res) => {
      if (!requireCatalogWrite(req, res)) return;
      const c = catById(req.params.id);
      if (!c) return notFound(res, "Category");
      const b = req.body || {};
      const patch = {};
      if (b.departmentId !== undefined) {
        if (!deptById(b.departmentId)) return fail(res, 422, "Unknown department");
        patch.departmentId = b.departmentId;
      }
      if (b.name !== undefined) {
        const n = H.cleanLocalized(b.name, { field: "name" });
        if (n.error) return fail(res, 422, n.error);
        patch.name = H.mergeLocalized(c.name, n.value);
      }
      if (b.description !== undefined) {
        const d = H.cleanLocalized(b.description, { field: "description" });
        if (d.error) return fail(res, 422, d.error);
        patch.description = H.mergeLocalized(c.description, d.value);
      }
      touch(c, patch);
      ok(res, { ...groupedCategoryItem(req, c), departmentId: c.departmentId }, "Category updated successfully");
    });
    app.delete("/api/categories/:id", (req, res) => {
      if (!requireCatalogWrite(req, res)) return;
      const c = catById(req.params.id);
      if (!c || c.archivedAt) return notFound(res, "Category");
      touch(c, { archivedAt: new Date().toISOString() });
      ok(res, null, "Category archived successfully");
    });

    // ---------------- features
    function filterFeatures(req, list) {
      const q = req.query;
      const s = String(q.search || q.q || "").toLowerCase().trim();
      if (s) list = list.filter((f) => Object.values(f.translations).some((t) => (t.name + " " + t.description).toLowerCase().includes(s)));
      const catIds = [...H.listParam(q.categoryIds), ...H.listParam(q.categoryId)];
      if (catIds.length) list = list.filter((f) => catIds.includes(f.categoryId));
      if (q.departmentId) list = list.filter((f) => catById(f.categoryId)?.departmentId === q.departmentId);
      if (q.paymentType) list = list.filter((f) => f.paymentType === q.paymentType);
      if (q.visibility) list = list.filter((f) => f.visibility === q.visibility);
      const isActive = H.boolParam(q.isActive);
      if (isActive !== undefined) list = list.filter((f) => f.isActive === isActive);
      if (req.sc.role === "customer") list = list.filter((f) => f.visibility === "public" && f.isActive);
      return list;
    }
    app.get("/api/features", (req, res) => {
      const list = filterFeatures(req, active(db.features));
      const { items, meta } = page(list, req.query, 10);
      ok(res, { items: items.map((f) => featureListItem(req, f, req.query.countryCode)), meta }, "Features retrieved");
    });
    app.get("/api/features/grouped", (req, res) => {
      const feats = filterFeatures(req, active(db.features));
      const catIds = [...H.listParam(req.query.categoryIds), ...H.listParam(req.query.categoryId)];
      const cats = active(db.categories).filter((c) => (catIds.length ? catIds.includes(c.id) : true)).filter((c) => feats.some((f) => f.categoryId === c.id));
      const { items, meta } = page(cats, req.query, 10);
      ok(res, {
        items: items.map((c) => ({ categoryId: c.id, categoryName: loc(req, c.name), features: feats.filter((f) => f.categoryId === c.id).map((f) => featureListItem(req, f, req.query.countryCode)) })),
        meta,
      }, "Features retrieved");
    });
    app.get("/api/features/archived", (req, res) => {
      const list = filterFeatures(req, db.features.filter((f) => f.archivedAt));
      const { items, meta } = page(list, req.query, 10);
      ok(res, { items: items.map((f) => featureListItem(req, f)), meta }, "Archived features retrieved");
    });
    app.get("/api/features/catalog/languages", (req, res) => {
      const codes = [...new Set(["en", "ar", "de", "fr", "it", ...db.zones.flatMap((z) => z.languageCodes)])];
      const list = codes.map((code) => {
        const l = languageByCode(code) || { code, name: code, nativeName: code, direction: "ltr" };
        return { ...l, zones: db.zones.filter((z) => z.languageCodes.includes(code)).map((z) => ({ id: z.id, name: z.name, isDefault: z.defaultLanguageCode === code })) };
      });
      const { items, meta } = page(list, req.query, 50);
      ok(res, { items, meta }, "Languages retrieved");
    });
    app.get("/api/features/:id", (req, res) => {
      const f = featureById(req.params.id);
      if (!f || f.archivedAt) return notFound(res, "Feature");
      ok(res, featureDetail(req, f, req.query.countryCode), "Feature retrieved");
    });
    function featureBody(b, existing) {
      const out = {};
      if (!existing || b.categoryId !== undefined) {
        if (!catById(b.categoryId)) return { error: "Category is required" };
        out.categoryId = b.categoryId;
      }
      if (!existing || b.translations !== undefined) {
        const tr = existing ? { ...existing.translations } : {};
        for (const t of Array.isArray(b.translations) ? b.translations : []) {
          const code = String(t.languageCode || "").slice(0, 2);
          if (!H.LANGS.includes(code)) return { error: `Unsupported language "${t.languageCode}"` };
          const name = String(t.name || "").trim();
          const description = String(t.description || "").trim();
          if (!name && !description) continue;
          tr[code] = { name: name || tr[code]?.name || "", description: description || tr[code]?.description || "" };
        }
        if (!Object.keys(tr).length) return { error: "Feature name is required in at least one language" };
        out.translations = tr;
      }
      if (b.defaultLanguageCode) out.defaultLanguageCode = b.defaultLanguageCode;
      if (!existing || b.priceUsd !== undefined) {
        const p = H.num(b.priceUsd);
        // The edit form always sends 0 (priceUsd is write-only in the UI), so keep a stored price instead of zeroing it.
        if (!(existing && p === 0 && H.num(existing.priceUsd) > 0)) out.priceUsd = H.money(p, "USD");
      }
      if (b.paymentType !== undefined || !existing) {
        if (!["full_payment", "installment"].includes(b.paymentType)) return { error: "Payment type is required" };
        out.paymentType = b.paymentType;
      }
      if (b.visibility !== undefined || !existing) {
        if (!["public", "internal"].includes(b.visibility)) return { error: "Visibility is required" };
        out.visibility = b.visibility;
      }
      if (b.isActive !== undefined) out.isActive = !!b.isActive;
      else if (!existing) out.isActive = true;
      if (b.zonePrices !== undefined) {
        const zp = parseZonePrices(b.zonePrices);
        if (zp.error) return { error: zp.error };
        // "0" leaves the feature explicitly unpriced in that zone.
        out.zonePrices = zp.value.map((z) => ({ ...z, basePrice: H.num(z.basePrice) > 0 ? z.basePrice : null }));
      } else if (!existing) out.zonePrices = [];
      return { value: out };
    }
    app.post("/api/features", (req, res) => {
      if (!requireCatalogWrite(req, res)) return;
      const r = featureBody(req.body || {});
      if (r.error) return fail(res, 422, r.error);
      const f = { id: H.newId(), key: null, defaultLanguageCode: "en", archivedAt: null, ...r.value, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      db.features.push(f);
      ok(res, featureDetail(req, f), "Feature created successfully", 201);
    });
    app.patch("/api/features/:id", (req, res) => {
      if (!requireCatalogWrite(req, res)) return;
      const f = featureById(req.params.id);
      if (!f) return notFound(res, "Feature");
      const r = featureBody(req.body || {}, f);
      if (r.error) return fail(res, 422, r.error);
      touch(f, r.value);
      ok(res, featureDetail(req, f), "Feature updated successfully");
    });
    app.delete("/api/features/:id", (req, res) => {
      if (!requireCatalogWrite(req, res)) return;
      const f = featureById(req.params.id);
      if (!f || f.archivedAt) return notFound(res, "Feature");
      touch(f, { archivedAt: new Date().toISOString() });
      ok(res, null, "Feature archived successfully");
    });

    // ---------------- plans
    function filterPlans(req, list) {
      const q = req.query;
      const s = String(q.search || q.q || "").toLowerCase().trim();
      if (s) list = list.filter((p) => Object.values(p.name).some((v) => v.toLowerCase().includes(s)));
      const catIds = [...H.listParam(q.categoryIds), ...H.listParam(q.categoryId)];
      if (catIds.length) list = list.filter((p) => p.categoryIds.some((c) => catIds.includes(c)));
      const deptIds = [...H.listParam(q.departmentIds), ...H.listParam(q.departmentId)];
      if (deptIds.length) list = list.filter((p) => deptIds.includes(p.departmentId));
      const zoneIds = H.listParam(q.zoneIds);
      if (zoneIds.length) list = list.filter((p) => p.zonePrices.some((zp) => zoneIds.includes(zp.zoneId)));
      if (q.paymentMode) list = list.filter((p) => planPaymentMode(p) === q.paymentMode);
      const isActive = H.boolParam(q.isActive);
      if (isActive !== undefined) list = list.filter((p) => !!p.isActive === isActive);
      if (req.sc.role === "customer") {
        const z = zoneForCountry(req.sc.customer?.countryCode);
        list = list.filter((p) => p.isActive && !p.isPrivate && (!z || planZone(p, z.id)));
      }
      if (q.countryCode) {
        const z = zoneForCountry(q.countryCode);
        list = list.filter((p) => z && planZone(p, z.id));
      }
      return list;
    }
    app.get("/api/plans", (req, res) => {
      const list = filterPlans(req, active(db.plans));
      const { items, meta } = page(list, req.query, 10);
      ok(res, { items: items.map((p) => planListItem(req, p, req.query.countryCode)), meta }, "Plans retrieved");
    });
    app.get("/api/plans/grouped", (req, res) => {
      const plans = filterPlans(req, active(db.plans));
      const groups = active(db.categories).map((c) => ({ c, plans: plans.filter((p) => p.categoryIds[0] === c.id) })).filter((g) => g.plans.length);
      const { items, meta } = page(groups, req.query, 10);
      ok(res, { items: items.map((g) => ({ categoryId: g.c.id, name: loc(req, g.c.name), plans: g.plans.map((p) => ({ id: p.id, name: loc(req, p.name), isActive: !!p.isActive, pricingMatrix: planMatrix(p) })) })), meta }, "Plans retrieved");
    });
    app.get("/api/plans/archived", (req, res) => {
      const list = util.search(db.plans.filter((p) => p.archivedAt), req.query.search, ["name.en", "name.de", "name.ar"]);
      const { items, meta } = page(list, req.query, 10);
      ok(res, { items: items.map((p) => planListItem(req, p)), meta }, "Archived plans retrieved");
    });
    app.post("/api/plans/pricing/preflight", (req, res) => ok(res, preflight(req.body || {}), "Pricing preflight calculated"));
    app.get("/api/plans/:id", (req, res) => {
      const p = planById(req.params.id);
      if (!p || p.archivedAt) return notFound(res, "Plan");
      if (req.sc.role === "customer" && (!p.isActive || p.isPrivate)) return notFound(res, "Plan");
      ok(res, planDetail(req, p, req.query.countryCode), "Plan retrieved");
    });
    function planBody(b, existing) {
      const out = {};
      if (!existing || b.name !== undefined) {
        const n = H.cleanLocalized(b.name, { required: !existing, field: "name" });
        if (n.error) return { error: n.error };
        out.name = existing ? H.mergeLocalized(existing.name, n.value) : n.value;
      }
      if (!existing || b.description !== undefined) {
        const d = H.cleanLocalized(b.description, { required: !existing, field: "description" });
        if (d.error) return { error: d.error };
        out.description = existing ? H.mergeLocalized(existing.description, d.value) : d.value;
      }
      if (!existing || b.departmentId !== undefined) {
        if (!deptById(b.departmentId)) return { error: "Department is required" };
        out.departmentId = b.departmentId;
      }
      if (!existing || b.categoryIds !== undefined || b.categoryId !== undefined) {
        const ids = H.listParam(b.categoryIds).length ? H.listParam(b.categoryIds) : H.listParam(b.categoryId);
        if (!ids.length || ids.some((id) => !catById(id))) return { error: "Select at least one valid category" };
        out.categoryIds = ids;
      }
      if (b.featureIds !== undefined) {
        const ids = H.listParam(b.featureIds);
        if (ids.some((id) => !featureById(id))) return { error: "Unknown feature in featureIds" };
        out.featureIds = ids;
      } else if (!existing) out.featureIds = [];
      if (b.planDurationIds !== undefined) out.planDurationIds = H.listParam(b.planDurationIds).filter((id) => durationById(id)?.type === "plan");
      else if (!existing) out.planDurationIds = [];
      if (b.installmentsEnabled !== undefined) out.installmentsEnabled = !!b.installmentsEnabled;
      else if (!existing) out.installmentsEnabled = false;
      if (b.installmentDurationIds !== undefined) out.installmentDurationIds = H.listParam(b.installmentDurationIds).filter((id) => durationById(id)?.type === "installment");
      else if (!existing) out.installmentDurationIds = [];
      if (b.zonePrices !== undefined) {
        const zp = parseZonePrices(b.zonePrices);
        if (zp.error) return { error: zp.error };
        out.zonePrices = zp.value.map((z) => ({ ...z, basePrice: H.num(z.basePrice) > 0 ? z.basePrice : "0.00" }));
      } else if (!existing) out.zonePrices = [];
      if (b.commission !== undefined) out.commission = b.commission ? { type: b.commission.type === "fixed" ? "fixed" : "percentage", amount: H.num(b.commission.amount) } : null;
      if (b.isActive !== undefined) out.isActive = !!b.isActive;
      else if (!existing) out.isActive = false;
      if (b.isPrivate !== undefined) out.isPrivate = !!b.isPrivate;
      return { value: out };
    }
    app.post("/api/plans", (req, res) => {
      if (!requireCatalogWrite(req, res)) return;
      const r = planBody(req.body || {});
      if (r.error) return fail(res, 422, r.error);
      const p = { id: H.newId(), key: null, isPrivate: false, commission: null, archivedAt: null, ...r.value, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      // Managers cannot publish directly: an inactive-but-complete plan created by a manager requests activation.
      p.activationRequested = !p.isActive && req.sc.role === "manager";
      db.plans.push(p);
      ok(res, planDetail(req, p), "Plan created successfully", 201);
    });
    app.patch("/api/plans/:id", (req, res) => {
      if (!requireCatalogWrite(req, res)) return;
      const p = planById(req.params.id);
      if (!p) return notFound(res, "Plan");
      const r = planBody(req.body || {}, p);
      if (r.error) return fail(res, 422, r.error);
      touch(p, r.value);
      if (p.isActive) p.activationRequested = false;
      ok(res, planDetail(req, p), "Plan updated successfully");
    });
    app.patch("/api/plans/:id/toggle-private", (req, res) => {
      if (!requireCatalogWrite(req, res)) return;
      const p = planById(req.params.id);
      if (!p) return notFound(res, "Plan");
      touch(p, { isPrivate: !p.isPrivate });
      ok(res, planDetail(req, p), p.isPrivate ? "Plan is now private" : "Plan is now public");
    });
    app.delete("/api/plans/:id", (req, res) => {
      if (!requireCatalogWrite(req, res)) return;
      const p = planById(req.params.id);
      if (!p || p.archivedAt) return notFound(res, "Plan");
      touch(p, { archivedAt: new Date().toISOString(), isActive: false });
      ok(res, null, "Plan archived successfully");
    });

    // ---------------- packages
    app.get("/api/packages", (req, res) => {
      let list = active(db.packages);
      const s = String(req.query.q || req.query.search || "").toLowerCase().trim();
      if (s) list = list.filter((p) => Object.values(p.name).some((v) => v.toLowerCase().includes(s)));
      const { items, meta } = page(list, req.query, 10);
      ok(res, { items: items.map((p) => packageListItem(req, p)), meta }, "Packages retrieved");
    });
    app.get("/api/packages/archived", (req, res) => {
      const list = util.search(db.packages.filter((p) => p.archivedAt), req.query.search, ["name.en", "name.de"]);
      const { items, meta } = page(list, req.query, 10);
      ok(res, { items: items.map((p) => packageListItem(req, p)), meta }, "Archived packages retrieved");
    });
    app.get("/api/packages/:id", (req, res) => {
      const p = pkgById(req.params.id);
      if (!p || p.archivedAt) return notFound(res, "Package");
      ok(res, packageDetail(req, p), "Package retrieved");
    });
    function packageBody(b, existing) {
      const out = {};
      if (!existing || b.name !== undefined) {
        const n = H.cleanLocalized(b.name, { required: !existing, field: "name" });
        if (n.error) return { error: n.error };
        out.name = existing ? H.mergeLocalized(existing.name, n.value) : n.value;
      }
      if (!existing || b.description !== undefined) {
        const d = H.cleanLocalized(b.description, { required: !existing, field: "description" });
        if (d.error) return { error: d.error };
        out.description = existing ? H.mergeLocalized(existing.description, d.value) : d.value;
      }
      if (!existing || b.planIds !== undefined) {
        const ids = H.listParam(b.planIds);
        if (!ids.length || ids.some((id) => !planById(id))) return { error: "Select at least one plan" };
        out.planIds = ids;
      }
      if (!existing || b.zones !== undefined) {
        const zones = [];
        for (const z of Array.isArray(b.zones) ? b.zones : []) {
          if (!zoneById(z.zoneId)) return { error: `Unknown zone ${z.zoneId}` };
          zones.push({ zoneId: z.zoneId, price: H.num(z.price), countryOverrides: (z.countryOverrides || []).map((o) => ({ countryCode: String(o.countryCode).toUpperCase(), price: H.num(o.price) })) });
        }
        out.zones = zones;
      }
      return { value: out };
    }
    app.post("/api/packages", (req, res) => {
      if (!requireCatalogWrite(req, res)) return;
      const r = packageBody(req.body || {});
      if (r.error) return fail(res, 422, r.error);
      const p = { id: H.newId(), key: null, status: "active", archivedAt: null, ...r.value, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      db.packages.push(p);
      ok(res, packageDetail(req, p), "Package created successfully", 201);
    });
    app.patch("/api/packages/:id", (req, res) => {
      if (!requireCatalogWrite(req, res)) return;
      const p = pkgById(req.params.id);
      if (!p) return notFound(res, "Package");
      const r = packageBody(req.body || {}, p);
      if (r.error) return fail(res, 422, r.error);
      touch(p, r.value);
      ok(res, packageDetail(req, p), "Package updated successfully");
    });
    app.delete("/api/packages/:id", (req, res) => {
      if (!requireCatalogWrite(req, res)) return;
      const p = pkgById(req.params.id);
      if (!p || p.archivedAt) return notFound(res, "Package");
      touch(p, { archivedAt: new Date().toISOString(), status: "archived" });
      ok(res, null, "Package archived successfully");
    });

    // ---------------- archive restore
    const restoreMap = { durations: db.durations, features: db.features, categories: db.categories, plans: db.plans, packages: db.packages };
    app.post("/api/:resource(durations|features|categories|plans|packages)/:id/restore", (req, res) => {
      if (!requireCatalogWrite(req, res)) return;
      const list = restoreMap[req.params.resource];
      const row = list.find((x) => x.id === req.params.id);
      if (!row || !row.archivedAt) return notFound(res, "Archived item");
      if (req.params.resource === "durations" && active(db.durations).some((d) => d.type === row.type && d.months === row.months)) {
        return fail(res, 409, `An active ${row.type} duration of ${row.months} months already exists`);
      }
      touch(row, { archivedAt: null, ...(req.params.resource === "packages" ? { status: "active" } : {}) });
      ok(res, { id: row.id, restored: true }, "Item restored successfully");
    });
  }

  return {
    routes,
    zoneById, durationById, deptById, catById, featureById, planById, pkgById, zoneForCountry, fallbackZone,
    featureText, featurePrice, planZoneBase, planMatrixFor, installmentTerms, durationPricing, sortedDurations,
    planListItem, loc, locStr, currencyFields, planPaymentMode,
  };
};
