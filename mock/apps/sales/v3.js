// Ordinary CRM extensions own actual customer/project records and preserve the existing billing constructor.
const H = require("./lib");
const { COUNTRIES, CURRENCIES } = require("./reference");
const clone = (value) => JSON.parse(JSON.stringify(value));
const fail = (status, code, message) =>
  Object.assign(new Error(message), { status, code });
const STATES = [
  "new",
  "contacted",
  "qualified",
  "quoted",
  "won",
  "lost",
  "unqualified",
  "spam",
  "duplicate",
];
const LABELS = {
  new: ["New", "جديد", "Neu", "Nouveau", "Nuovo"],
  contacted: [
    "Contacted",
    "تم التواصل",
    "Kontaktiert",
    "Contacté",
    "Contattato",
  ],
  qualified: ["Qualified", "مؤهل", "Qualifiziert", "Qualifié", "Qualificato"],
  quoted: [
    "Quoted",
    "تم تقديم العرض",
    "Angebot erstellt",
    "Devis envoyé",
    "Preventivo inviato",
  ],
  won: ["Won", "تم الفوز", "Gewonnen", "Gagné", "Vinto"],
  lost: ["Lost", "مفقود", "Verloren", "Perdu", "Perso"],
  unqualified: [
    "Unqualified",
    "غير مؤهل",
    "Nicht qualifiziert",
    "Non qualifié",
    "Non qualificato",
  ],
  spam: ["Spam", "غير مرغوب", "Spam", "Indésirable", "Spam"],
  duplicate: ["Duplicate", "مكرر", "Duplikat", "Doublon", "Duplicato"],
};
const defaultPipeline = () => ({
  id: "main",
  name: {
    en: "Main pipeline",
    ar: "المسار الرئيسي",
    de: "Hauptpipeline",
    fr: "Pipeline principal",
    it: "Pipeline principale",
  },
  stages: STATES.map((id, index) => ({
    id,
    name: Object.fromEntries(
      H.LANGS.map((locale, i) => [locale, LABELS[id][i]]),
    ),
    probability: [10, 25, 50, 75, 100, 0, 0, 0, 0][index],
    status: id,
  })),
});
module.exports = function crmV3(S) {
  const { db, core: K, util } = S;
  const state = (db.crmV3 ??= {
    pipelines: [defaultPipeline()],
    fields: [],
    routing: [],
    companies: [],
    activities: [],
    targets: [],
    runs: [],
    operations: {},
    samplesLoaded: false,
  });
  const now = () => H.iso(Date.now());
  const visible = (req) =>
    db.customers.filter(
      (row) =>
        !row.crmMergedInto &&
        (req.sc.role === "customer"
          ? row.authUserId === req.sc.user.id
          : req.sc.role === "salesman"
            ? row.ownerUserId === req.sc.user.id ||
              Boolean(
                req.sc.staff && row.assignedSalesmanId === req.sc.staff.id,
              )
            : true),
    );
  const customer = (req, id, write = false) => {
    const row = visible(req).find((item) => item.id === id);
    if (!row)
      throw fail(404, "contact_not_found", "This contact was not found.");
    if (write && row.custodyReadOnly)
      throw fail(
        403,
        "custody_read_only",
        "Review this contact ownership before editing.",
      );
    return row;
  };
  const staff = (req, configure = false) => {
    if (
      !["admin", "manager", ...(configure ? [] : ["salesman"])].includes(
        req.sc.role,
      )
    )
      throw fail(
        403,
        "crm_role_required",
        "Your current CRM role cannot change this resource.",
      );
  };
  const text = (value, length = 2000) => {
    if (typeof value !== "string" || !value.trim() || value.length > length)
      throw fail(422, "invalid_text", "Complete the required text.");
    return value.trim();
  };
  const label = (value) =>
    typeof value === "string" ? value : value?.en || "";
  function companies() {
    for (const row of db.customers)
      if (row.companyName && !row.crmCompanyId) {
        let company = state.companies.find(
          (item) =>
            item.name.toLocaleLowerCase() ===
            row.companyName.toLocaleLowerCase(),
        );
        if (!company) {
          company = {
            id: H.uid("crm-company", row.companyName.toLocaleLowerCase()),
            name: row.companyName,
            sector: "",
            website: row.website || "",
            notes: "",
            tags: [],
            fields: {},
            createdAt: row.createdAt,
          };
          state.companies.push(company);
        }
        row.crmCompanyId = company.id;
      }
  }
  companies();
  const pipelineFor = (row) =>
    state.pipelines.find((item) => item.id === row.crmPipelineId) ||
    state.pipelines[0];
  const stageFor = (row) =>
    pipelineFor(row).stages.find(
      (stage) => stage.id === row.crmStageId && stage.status === row.status,
    ) ||
    pipelineFor(row).stages.find((stage) => stage.status === row.status) ||
    pipelineFor(row).stages[0];
  const currencyFor = (row) => {
    try {
      return S.deals.resolveZone({ customer: row }).zone.currencyCode;
    } catch {
      return "USD";
    }
  };
  function valueFor(row, currency) {
    return (
      row.crmValue ??
      db.projects
        .filter((project) => project.customerId === row.id)
        .reduce((sum, project) => {
          const contract = S.deals.latestContract(project.id);
          return (
            sum +
            (contract?.currency === currency ? H.num(contract.grandTotal) : 0)
          );
        }, 0)
    );
  }
  function event(req, row, kind, content, metadata = {}) {
    const record = {
      id: H.newId(),
      contactId: row.id,
      kind,
      text: content,
      actorId: req.sc.user.id,
      actorName: K.userName(req.sc.user),
      at: now(),
      ...metadata,
    };
    state.activities.unshift(record);
    state.activities = state.activities.slice(0, 3000);
    row.lastActivityAt = record.at;
    row.updatedAt = record.at;
    return record;
  }
  function contactOut(req, row) {
    const stage = stageFor(row),
      currency = currencyFor(row);
    return {
      ...S.crm.customerOut(row),
      pipelineId: pipelineFor(row).id,
      stageId: stage.id,
      probability:
        row.crmStageId === stage.id
          ? (row.crmProbability ?? stage.probability)
          : stage.probability,
      value: valueFor(row, currency),
      currency,
      tags: row.crmTags || [],
      fields: row.crmFields || {},
      companyId: row.crmCompanyId || null,
      currency: currencyFor(row),
      company:
        state.companies.find((company) => company.id === row.crmCompanyId) ||
        null,
      taskIds: row.crmTaskIds || [],
      canEdit: req.sc.role !== "customer" && !row.custodyReadOnly,
      attribution: clone(row.sourceContext || {}),
      activities: state.activities.filter(
        (activity) => activity.contactId === row.id,
      ),
      marketingConsent: row.crmMarketingConsent || {
        state: "unknown",
        source: null,
        recordedBy: null,
        recordedAt: null,
      },
      simulatedSignature: row.crmSimulatedSignature || null,
    };
  }
  function projectOut(req, row) {
    const contract = S.deals.latestContract(row.id),
      pipeline = pipelineFor(row),
      won =
        [
          "confirmed",
          "approved",
          "in_progress",
          "testing",
          "completed",
        ].includes(row.status) &&
        Boolean(
          contract && ["confirmed", "approved"].includes(contract.status),
        ),
      stage =
        pipeline.stages.find((item) => item.id === row.crmStageId) ||
        pipeline.stages.find(
          (item) => item.status === (won ? "won" : "quoted"),
        ) ||
        pipeline.stages[0];
    return {
      ...S.deals.projectOut(req, row),
      pipelineId: pipeline.id,
      stageId: stage.id,
      probability: row.crmProbability ?? stage.probability,
      value: H.num(contract?.grandTotal),
      estimatedValue: row.crmEstimatedValue ?? 0,
      currency:
        contract?.currency || currencyFor(K.customerById(row.customerId) || {}),
      won,
      provisioning: row.crmProvisioning || null,
      canEdit: req.sc.role !== "customer" && !row.custodyReadOnly,
      contactId: row.customerId,
    };
  }
  function bootstrap(req) {
    companies();
    const contacts = visible(req),
      ids = new Set(contacts.map((row) => row.id));
    return {
      now: now(),
      contacts: contacts.map((row) => contactOut(req, row)),
      projects: S.deals.visibleProjects(req).map((row) => projectOut(req, row)),
      companies: state.companies.filter(
        (company) =>
          req.sc.role === "admin" ||
          req.sc.role === "manager" ||
          contacts.some((row) => row.crmCompanyId === company.id),
      ),
      pipelines: clone(state.pipelines),
      fields: clone(state.fields),
      routing:
        req.sc.role === "admin" || req.sc.role === "manager"
          ? clone(state.routing)
          : [],
      targets: clone(state.targets),
      activities: state.activities.filter((row) => ids.has(row.contactId)),
      runs:
        req.sc.role === "admin" || req.sc.role === "manager"
          ? clone(state.runs)
          : [],
      owners: K.salesmen()
        .filter((row) => row.status !== "disabled")
        .map((row) => ({
          id: row.id,
          userId: row.authUserId,
          name: row.fullName,
        })),
      capabilities: {
        canWrite: req.sc.role !== "customer",
        canConfigure: ["admin", "manager"].includes(req.sc.role),
        canMerge: ["admin", "manager"].includes(req.sc.role),
      },
      sample: {
        loaded: state.samplesLoaded,
        canLoad: contacts.length === 0 && ["admin", "manager"].includes(req.sc.role),
      },
    };
  }
  function routing(req, rows = visible(req)) {
    staff(req, true);
    const results = [];
    for (const rule of state.routing.filter((row) => row.enabled))
      for (const row of rows)
        if (row.source === rule.source && !row.custodyReadOnly) {
          const owner = K.resolveSalesman(rule.ownerId);
          if (!owner) continue;
          if (row.assignedSalesmanId !== owner.id) {
            row.assignedSalesmanId = owner.id;
            row.ownerUserId = owner.authUserId;
            event(req, row, "routing", "Lead routing applied", {
              ruleId: rule.id,
            });
            results.push({ contactId: row.id, ownerId: owner.id });
          }
        }
    const run = {
      id: H.newId(),
      at: now(),
      actor: K.userName(req.sc.user),
      results,
    };
    state.runs.unshift(run);
    state.runs = state.runs.slice(0, 100);
    return run;
  }
  function create(req, body, source = "manual") {
    if (
      body.countryCode &&
      !COUNTRIES.some((row) => row.code === body.countryCode)
    )
      throw fail(422, "invalid_country", "Choose a supported country.");
    if (
      body.value !== undefined &&
      (typeof body.value !== "number" ||
        !Number.isFinite(body.value) ||
        body.value < 0 ||
        body.value > 1e9)
    )
      throw fail(
        422,
        "invalid_value",
        "Use a valid nonnegative forecast value.",
      );
    const email = text(body.email, 200).toLocaleLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
      throw fail(422, "invalid_email", "Enter a valid email.");
    if (db.customers.some((row) => row.email.toLocaleLowerCase() === email))
      throw fail(
        409,
        "duplicate_email",
        "A contact with this email already exists.",
      );
    const row = {
      id: H.newId(),
      key: null,
      authUserId: null,
      fullName: text(body.fullName, 200),
      email,
      phoneNumber: String(body.phoneNumber || "").slice(0, 100),
      address: "",
      countryCode: body.countryCode || "EG",
      preferredLanguage: H.LANGS.includes(body.preferredLanguage)
        ? body.preferredLanguage
        : "en",
      commercialRegistrationNumber: null,
      status: "new",
      source,
      sourceContext: {
        receivedAt: now(),
        ...(body.campaign
          ? { utm: { campaign: String(body.campaign).slice(0, 200) } }
          : {}),
      },
      companyName: String(body.companyName || "").slice(0, 200) || null,
      website: null,
      assignedSalesmanId:
        req.sc.role === "salesman" ? req.sc.staff?.id || null : null,
      ownerUserId: req.sc.user.id,
      access: "no_account",
      idDocument: null,
      businessDocument: null,
      notes: [],
      invite: null,
      meetingAppointment: null,
      createdAt: now(),
      updatedAt: now(),
      createdBy: K.userName(req.sc.user),
      crmValue:
        Number.isFinite(body.value) && body.value >= 0 && body.value <= 1e9
          ? body.value
          : 0,
      crmTags: [],
      crmFields: {},
    };
    db.customers.push(row);
    companies();
    event(req, row, "created", "Contact created", { source });
    if (["admin", "manager"].includes(req.sc.role)) routing(req, [row]);
    return row;
  }
  function configure(req, body) {
    staff(req, true);
    if (body.pipelines !== undefined) {
      if (
        !Array.isArray(body.pipelines) ||
        !body.pipelines.length ||
        body.pipelines.length > 5 ||
        new Set(body.pipelines.map((row) => row.id)).size !==
          body.pipelines.length
      )
        throw fail(
          422,
          "invalid_pipelines",
          "Choose one to five distinct pipelines.",
        );
      for (const pipeline of body.pipelines) {
        text(pipeline.id, 100);
        text(label(pipeline.name), 200);
        if (
          !Array.isArray(pipeline.stages) ||
          pipeline.stages.length < 2 ||
          pipeline.stages.length > 15 ||
          new Set(pipeline.stages.map((row) => row.id)).size !==
            pipeline.stages.length ||
          !["won", "lost"].every((status) =>
            pipeline.stages.some((stage) => stage.status === status),
          )
        )
          throw fail(
            422,
            "invalid_stages",
            "Keep distinct stages including won and lost.",
          );
        for (const stage of pipeline.stages) {
          text(stage.id, 100);
          text(label(stage.name), 200);
          if (
            !Number.isFinite(stage.probability) ||
            stage.probability < 0 ||
            stage.probability > 100 ||
            !STATES.includes(stage.status) ||
            (stage.status === "won" && stage.probability !== 100) ||
            (stage.status === "lost" && stage.probability !== 0)
          )
            throw fail(
              422,
              "invalid_probability",
              "Use valid stage probabilities and statuses.",
            );
        }
      }
      for (const row of db.customers)
        if (
          row.crmPipelineId &&
          !body.pipelines.some(
            (pipeline) =>
              pipeline.id === row.crmPipelineId &&
              pipeline.stages.some(
                (stage) => stage.id === (row.crmStageId || row.status),
              ),
          )
        )
          throw fail(
            409,
            "stage_in_use",
            "Move contacts before removing their stage or pipeline.",
          );
      state.pipelines = clone(body.pipelines);
    }
    if (body.fields !== undefined) {
      if (
        !Array.isArray(body.fields) ||
        body.fields.length > 20 ||
        new Set(body.fields.map((row) => row.id)).size !== body.fields.length ||
        body.fields.some(
          (row) =>
            !row.id ||
            !label(row.name) ||
            !["text", "number", "checkbox"].includes(row.type),
        )
      )
        throw fail(
          422,
          "invalid_fields",
          "Use distinct text, number or checkbox fields.",
        );
      state.fields = clone(body.fields);
    }
    if (body.routing !== undefined) {
      if (
        !Array.isArray(body.routing) ||
        body.routing.length > 20 ||
        body.routing.some(
          (row) =>
            !row.id ||
            !row.source ||
            typeof row.enabled !== "boolean" ||
            !K.resolveSalesman(row.ownerId),
        )
      )
        throw fail(
          422,
          "invalid_routing",
          "Choose an eligible lead owner for each rule.",
        );
      state.routing = clone(body.routing);
    }
    if (body.targets !== undefined) {
      if (
        !Array.isArray(body.targets) ||
        body.targets.length > 12 ||
        body.targets.some(
          (row) =>
            !CURRENCIES[row.currency] ||
            !Number.isFinite(row.amount) ||
            row.amount < 0 ||
            row.amount > 1e9 ||
            !/^\d{4}-\d{2}$/.test(row.period),
        )
      )
        throw fail(
          422,
          "invalid_targets",
          "Set valid currency targets for a month.",
        );
      state.targets = clone(body.targets);
    }
    return bootstrap(req);
  }
  function updateFields(req, id, body) {
    staff(req);
    const row = customer(req, id, true),
      allowed = [
        "pipelineId",
        "stageId",
        "probability",
        "value",
        "tags",
        "fields",
        "companyId",
        "ownerId",
        "taskIds",
        "lostReason",
        "marketingConsent",
      ];
    if (Object.keys(body).some((key) => !allowed.includes(key)))
      throw fail(
        422,
        "invalid_contact_patch",
        "Choose supported contact fields.",
      );
    if (body.pipelineId !== undefined || body.stageId !== undefined) {
      const pipeline = state.pipelines.find(
          (item) => item.id === (body.pipelineId || pipelineFor(row).id),
        ),
        stage = pipeline?.stages.find(
          (item) => item.id === (body.stageId || pipeline.stages[0].id),
        );
      if (!stage)
        throw fail(422, "stage_not_found", "Choose a current pipeline stage.");
      if (
        stage.status === "lost" &&
        !String(body.lostReason || row.lostReason || "").trim()
      )
        throw fail(
          422,
          "lost_reason_required",
          "Describe why the lead was lost.",
        );
      row.crmPipelineId = pipeline.id;
      row.crmStageId = stage.id;
      row.status = stage.status;
      row.crmProbability = stage.probability;
      row.lostReason =
        stage.status === "lost"
          ? String(body.lostReason || row.lostReason).slice(0, 2000)
          : null;
      event(req, row, "stage", "Pipeline stage changed", {
        pipelineId: pipeline.id,
        stageId: stage.id,
      });
    }
    if (body.probability !== undefined) {
      if (
        !Number.isFinite(body.probability) ||
        body.probability < 0 ||
        body.probability > 100
      )
        throw fail(
          422,
          "invalid_probability",
          "Use a probability from zero to100.",
        );
      row.crmProbability = ["won", "lost"].includes(row.status)
        ? row.status === "won"
          ? 100
          : 0
        : body.probability;
    }
    if (body.value !== undefined) {
      if (!Number.isFinite(body.value) || body.value < 0 || body.value > 1e9)
        throw fail(422, "invalid_value", "Use a valid forecast value.");
      row.crmValue = body.value;
    }
    if (body.tags !== undefined) {
      if (
        !Array.isArray(body.tags) ||
        body.tags.length > 20 ||
        body.tags.some(
          (tag) => typeof tag !== "string" || !tag.trim() || tag.length > 80,
        )
      )
        throw fail(422, "invalid_tags", "Choose short contact tags.");
      row.crmTags = [...new Set(body.tags.map((tag) => tag.trim()))];
    }
    if (body.fields !== undefined) {
      if (
        !body.fields ||
        typeof body.fields !== "object" ||
        Array.isArray(body.fields) ||
        Object.entries(body.fields).some(([key, value]) => {
          const field = state.fields.find((item) => item.id === key);
          return (
            !field ||
            (field.type === "number" && !Number.isFinite(value)) ||
            (field.type === "checkbox" && typeof value !== "boolean") ||
            (field.type === "text" &&
              (typeof value !== "string" || value.length > 2000))
          );
        })
      )
        throw fail(
          422,
          "invalid_field_values",
          "Use the configured field types.",
        );
      row.crmFields = { ...(row.crmFields || {}), ...clone(body.fields) };
    }
    if (body.companyId !== undefined) {
      const company = state.companies.find(
        (item) => item.id === body.companyId,
      );
      if (!company)
        throw fail(422, "company_not_found", "Choose a current company.");
      row.crmCompanyId = company.id;
      row.companyName = company.name;
      row.website = company.website || row.website;
    }
    if (body.ownerId !== undefined) {
      staff(req, true);
      const owner = K.resolveSalesman(body.ownerId);
      if (!owner)
        throw fail(422, "owner_not_found", "Choose an eligible lead owner.");
      row.assignedSalesmanId = owner.id;
      row.ownerUserId = owner.authUserId;
    }
    if (body.taskIds !== undefined) {
      if (
        !Array.isArray(body.taskIds) ||
        body.taskIds.length > 100 ||
        body.taskIds.some((value) => !Number.isSafeInteger(value) || value < 1)
      )
        throw fail(422, "invalid_tasks", "Choose current task references.");
      row.crmTaskIds = [...new Set(body.taskIds)];
    }
    if (body.marketingConsent !== undefined) {
      if (!["opted_in", "opted_out", "unknown"].includes(body.marketingConsent))
        throw fail(
          422,
          "invalid_marketing_consent",
          "Record an explicit marketing consent state.",
        );
      row.crmMarketingConsent = {
        state: body.marketingConsent,
        source: "manual_mock",
        recordedBy: req.sc.user.id,
        recordedAt: now(),
      };
      event(req, row, "consent", "Marketing consent recorded", {
        state: body.marketingConsent,
        source: "manual_mock",
      });
    }
    row.updatedAt = now();
    return contactOut(req, row);
  }
  function update(req, id, body) {
    const row = customer(req, id, true),
      before = clone(row),
      activities = clone(state.activities);
    try {
      return updateFields(req, id, body);
    } catch (error) {
      for (const key of Object.keys(row)) delete row[key];
      Object.assign(row, before);
      state.activities = activities;
      throw error;
    }
  }
  function routes(app) {
    const handle = (fn) => (req, res) => {
      try {
        const data = fn(req);
        util.ok(res, data, "CRM changes saved");
      } catch (error) {
        res.status(error.status || 500).json({
          success: false,
          statusCode: error.status || 500,
          code: error.code || "crm_unavailable",
          message: error.status
            ? error.message
            : "The CRM request could not be completed.",
        });
      }
    };
    app.get("/api/crm/v3", handle(bootstrap));
    app.post(
      "/api/crm/v3/contacts",
      handle((req) => {
        staff(req);
        return contactOut(req, create(req, req.body));
      }),
    );
    app.patch(
      "/api/crm/v3/contacts/:id",
      handle((req) => update(req, req.params.id, req.body)),
    );
    app.patch(
      "/api/crm/v3/projects/:id",
      handle((req) => {
        staff(req);
        const row = S.deals
          .visibleProjects(req)
          .find((item) => item.id === req.params.id);
        if (!row || row.custodyReadOnly)
          throw fail(
            404,
            "project_not_found",
            "This writable project was not found.",
          );
        const pipeline = state.pipelines.find(
            (item) => item.id === (req.body.pipelineId || pipelineFor(row).id),
          ),
          stage = pipeline?.stages.find((item) => item.id === req.body.stageId);
        if (!stage)
          throw fail(422, "stage_not_found", "Choose a current stage.");
        const current = projectOut(req, row);
        if (stage.status === "won" && !current.won)
          throw fail(
            409,
            "confirm_contract_first",
            "Confirm the actual contract before marking this deal won.",
          );
        row.crmPipelineId = pipeline.id;
        row.crmStageId = stage.id;
        row.crmProbability = stage.probability;
        return projectOut(req, row);
      }),
    );
    require("./documents")(S).routes(app);
    app.get(
      "/api/crm/v3/offers/:id",
      handle((req) => {
        const row = db.offers.find((item) => item.id === req.params.id);
        if (!row)
          throw fail(404, "offer_not_found", "This offer was not found.");
        customer(req, row.customerId);
        return {
          id: row.id,
          validUntil: row.crmValidUntil || null,
          signature: row.crmSimulatedSignature || null,
          canEdit: req.sc.role !== "customer",
          now: now(),
        };
      }),
    );
    app.patch(
      "/api/crm/v3/config",
      handle((req) => configure(req, req.body)),
    );
    app.post(
      "/api/crm/v3/routing/run",
      handle((req) => routing(req)),
    );
    app.post(
      "/api/crm/v3/contacts/:id/activities",
      handle((req) => {
        staff(req);
        const row = customer(req, req.params.id, true),
          kind = req.body.kind;
        if (
          ![
            "note",
            "call",
            "email",
            "meeting",
            "whatsapp",
            "click_to_call",
          ].includes(kind)
        )
          throw fail(422, "invalid_activity", "Choose a supported activity.");
        return event(req, row, kind, text(req.body.text, 5000), {
          simulated: ["whatsapp", "click_to_call"].includes(kind),
          ...(req.body.scheduledAt
            ? { scheduledAt: H.iso(req.body.scheduledAt) }
            : {}),
        });
      }),
    );
    app.post(
      "/api/crm/v3/import",
      handle((req) => {
        staff(req);
        if (
          !Array.isArray(req.body.rows) ||
          !req.body.rows.length ||
          req.body.rows.length > 200 ||
          JSON.stringify(req.body.rows).length > 100000
        )
          throw fail(
            422,
            "import_limit",
            "Import one to200 bounded text rows.",
          );
        return req.body.rows.map((body, index) => {
          try {
            return {
              index,
              state: "created",
              id: create(req, body, "import").id,
            };
          } catch (error) {
            return {
              index,
              state: "failed",
              code: error.code || "invalid_row",
            };
          }
        });
      }),
    );
    app.post(
      "/api/crm/v3/bulk",
      handle((req) => {
        staff(req);
        if (
          !Array.isArray(req.body.ids) ||
          !req.body.ids.length ||
          req.body.ids.length > 200
        )
          throw fail(422, "bulk_limit", "Choose a bounded set of contacts.");
        return req.body.ids.map((id) => {
          try {
            return {
              id,
              state: "saved",
              contact: update(req, id, req.body.patch),
            };
          } catch (error) {
            return { id, state: "failed", code: error.code || "invalid_row" };
          }
        });
      }),
    );
    app.post(
      "/api/crm/v3/companies",
      handle((req) => {
        staff(req, true);
        const name = text(req.body.name, 200);
        if (
          state.companies.some(
            (row) => row.name.toLocaleLowerCase() === name.toLocaleLowerCase(),
          )
        )
          throw fail(409, "company_duplicate", "This company already exists.");
        const row = {
          id: H.newId(),
          name,
          sector: String(req.body.sector || "").slice(0, 200),
          website: String(req.body.website || "").slice(0, 500),
          notes: String(req.body.notes || "").slice(0, 5000),
          tags: [],
          fields: {},
          createdAt: now(),
        };
        state.companies.push(row);
        return row;
      }),
    );
    app.patch(
      "/api/crm/v3/companies/:id",
      handle((req) => {
        staff(req, true);
        const row = state.companies.find((item) => item.id === req.params.id);
        if (!row)
          throw fail(404, "company_not_found", "This company was not found.");
        if (
          db.customers.some(
            (contact) =>
              contact.crmCompanyId === row.id && contact.custodyReadOnly,
          )
        )
          throw fail(
            403,
            "custody_read_only",
            "Review linked contact ownership before editing this company.",
          );
        if (req.body.website && !/^https?:\/\//.test(req.body.website))
          throw fail(422, "invalid_website", "Use an HTTP or HTTPS website.");
        for (const key of ["name", "sector", "website", "notes"])
          if (req.body[key] !== undefined)
            row[key] =
              key === "name"
                ? text(req.body[key], 200)
                : String(req.body[key]).slice(0, key === "notes" ? 5000 : 500);
        if (req.body.tags) {
          if (
            !Array.isArray(req.body.tags) ||
            req.body.tags.length > 20 ||
            req.body.tags.some(
              (tag) => typeof tag !== "string" || tag.length > 80,
            )
          )
            throw fail(422, "invalid_tags", "Choose short company tags.");
          row.tags = [...new Set(req.body.tags)];
        }
        for (const contact of db.customers)
          if (contact.crmCompanyId === row.id) {
            contact.companyName = row.name;
            contact.website = row.website;
          }
        return row;
      }),
    );
    app.post(
      "/api/crm/v3/merge",
      handle((req) => {
        staff(req, true);
        const source = customer(req, req.body.sourceId, true),
          target = customer(req, req.body.targetId, true);
        if (
          source.id === target.id ||
          source.authUserId ||
          db.projects.some((row) => row.customerId === source.id) ||
          db.offers.some((row) => row.customerId === source.id)
        )
          throw fail(
            409,
            "merge_linked_customer",
            "Only unlinked prospect duplicates can be merged; preserve customer billing and identity.",
          );
        target.notes = [...(target.notes || []), ...(source.notes || [])];
        target.crmTags = [
          ...new Set([...(target.crmTags || []), ...(source.crmTags || [])]),
        ];
        for (const activity of state.activities)
          if (activity.contactId === source.id) activity.contactId = target.id;
        source.crmMergedInto = target.id;
        source.status = "duplicate";
        event(req, target, "merge", "Duplicate prospect merged", {
          sourceId: source.id,
        });
        return contactOut(req, target);
      }),
    );
    app.post(
      "/api/crm/v3/sample",
      handle((req) => {
        staff(req, true);
        if (state.samplesLoaded) return bootstrap(req);
        if (db.customers.length)
          throw fail(
            409,
            "sample_requires_empty",
            "Add sample prospects only in an empty CRM.",
          );
        for (const [index, fullName] of [
          "Sample prospect · design",
          "Sample prospect · growth",
          "Sample prospect · support",
        ].entries())
          create(
            req,
            {
              fullName,
              email: `sample-${index + 1}@example.test`,
              companyName: "Sample company",
              value: (index + 1) * 1000,
            },
            "sample",
          );
        state.samplesLoaded = true;
        return bootstrap(req);
      }),
    );
    app.patch(
      "/api/crm/v3/offers/:id",
      handle((req) => {
        staff(req);
        const offer = db.offers.find((row) => row.id === req.params.id),
          contact = offer && customer(req, offer.customerId, true);
        if (!offer || !contact)
          throw fail(404, "offer_not_found", "This offer was not found.");
        if (req.body.validUntil) {
          const at = Date.parse(req.body.validUntil);
          if (
            !Number.isFinite(at) ||
            at <= Date.now() ||
            at > Date.now() + 90 * 864e5
          )
            throw fail(
              422,
              "invalid_validity",
              "Choose future validity within90 days.",
            );
          offer.crmValidUntil = H.iso(at);
        }
        if (req.body.signature) {
          if (req.body.signature.consent !== true)
            throw fail(
              422,
              "signature_consent",
              "Confirm the simulated signature.",
            );
          offer.crmSimulatedSignature = {
            name: text(req.body.signature.name, 200),
            at: now(),
            actorId: req.sc.user.id,
            simulated: true,
          };
        }
        return {
          id: offer.id,
          validUntil: offer.crmValidUntil || null,
          signature: offer.crmSimulatedSignature || null,
        };
      }),
    );
  }
  function provisioningCandidate(context, projectId) {
    if (
      context.realm !== S.ctx.realm ||
      context.workspace.id !== S.ctx.workspaceId
    )
      throw fail(403, "crm_context_mismatch", "Use the current CRM workspace.");
    const user = S.identity.findUser(context.actor.effectiveUserId),
      role = user && K.appRole(user),
      req = {
        sc: {
          user,
          role,
          staff: user && K.staffByAuth(user.id),
          customer: user && K.customerByAuth(user.id),
          lang: "en",
          displayCurrency: null,
        },
      };
    if (
      !user ||
      !role ||
      !["free", "trial", "active", "read_only"].includes(
        context.tools.crm?.access,
      )
    )
      throw fail(
        403,
        "crm_access_required",
        "Use your currently assigned CRM access.",
      );
    const project = db.projects.find(
      (row) => String(row.id) === String(projectId),
    );
    if (
      !project ||
      !S.deals.canSeeProject(req, project) ||
      project.custodyReadOnly
    )
      throw fail(
        404,
        "project_not_found",
        "This visible project was not found.",
      );
    const contract = S.deals.latestContract(project.id),
      contact = K.customerById(project.customerId),
      won =
        [
          "confirmed",
          "approved",
          "in_progress",
          "testing",
          "completed",
        ].includes(project.status) &&
        Boolean(
          contract && ["confirmed", "approved"].includes(contract.status),
        );
    return {
      projectId: project.id,
      projectName: project.projectName,
      won,
      status: project.status,
      contractId: contract?.id || null,
      customer: contact
        ? {
            id: contact.id,
            authUserId: contact.authUserId || null,
            name: contact.fullName,
            email: contact.email,
            companyId: contact.crmCompanyId || null,
            companyName: contact.companyName || null,
            source: contact.source || null,
            sourceContext: clone(contact.sourceContext || {}),
          }
        : null,
      receipt: project.crmProvisioning ? clone(project.crmProvisioning) : null,
    };
  }
  function recordProvisioning(context, projectId, receipt) {
    const candidate = provisioningCandidate(context, projectId);
    if (
      !candidate.won ||
      context.actor.readOnly ||
      !context.tools.crm?.canWrite
    )
      throw fail(
        403,
        "won_project_required",
        "Use a writable confirmed CRM project.",
      );
    const project = db.projects.find((row) => row.id === candidate.projectId);
    project.crmProvisioning = clone(receipt);
    return clone(project.crmProvisioning);
  }
  function marketingActor(context) {
    const user = S.identity.findUser(context?.actor?.effectiveUserId), role = user && K.appRole(user);
    if (!user || !context.tools?.crm?.canWrite || context.actor.readOnly) throw fail(403, 'crm_write_required', 'Current writable CRM access is required.');
    const req = { sc: { user, role, staff: K.staffByAuth(user.id), customer: K.customerByAuth(user.id), lang: 'en', displayCurrency: null } };
    staff(req); return req;
  }
  function setMarketingConsent(context, contactId, value) {
    const req = marketingActor(context), row = customer(req, contactId, true);
    if (!['unknown', 'opted_in', 'opted_out'].includes(value)) throw fail(422, 'invalid_marketing_consent', 'Record an explicit marketing consent state.');
    row.crmMarketingConsent = { state: value, source: 'marketing_mock', recordedBy: req.sc.user.id, recordedAt: now() };
    row.updatedAt = now(); event(req, row, 'consent', 'Marketing consent recorded', { state: value, source: 'marketing_mock' });
    return contactOut(req, row);
  }
  function marketingContact(context, contactId) {
    const req = marketingActor(context);
    return contactOut(req, customer(req, contactId, true));
  }
  function createCampaignLead(context, candidate, contactId, body) {
    const req = marketingActor(context), row = customer(req, contactId, true);
    const title = text(body.title, 200);
    if (body.estimate !== undefined && (!Number.isFinite(body.estimate) || body.estimate < 0 || body.estimate > 1e12)) throw fail(422, 'invalid_estimate', 'Use a non-negative pipeline estimate.');
    const created = S.deals.createProject(req, { customerId: row.id, projectName: title, projectDescription: `Follow-up from ${candidate.title}`, projectType: 'client_project' }, { actorUser: req.sc.user });
    if (created.error) throw fail(422, 'crm_deal_invalid', created.error);
    const project = created.value;
    project.source = { kind: 'marketing_campaign', campaignId: candidate.id, marketingProjectId: candidate.projectId };
    project.crmEstimatedValue = body.estimate ?? 0;
    row.sourceContext ??= {}; row.sourceContext.marketing = { campaignId: candidate.id, projectId: candidate.projectId, crmProjectId: project.id, by: req.sc.user.id, at: now() };
    event(req, row, 'attribution', 'Campaign lead received', { campaignId: candidate.id, projectId: project.id, estimatedValue: project.crmEstimatedValue });
    return { leadId: row.id, projectId: project.id, estimatedValue: project.crmEstimatedValue, currency: currencyFor(row) };
  }
  return {
    routes,
    bootstrap,
    contactOut,
    event,
    provisioningCandidate,
    recordProvisioning,
    setMarketingConsent,
    marketingContact,
    createCampaignLead,
  };
};
