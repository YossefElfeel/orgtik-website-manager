const { test } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
test(
  "ordinary CRM v3 extends actual records with scoped pipeline/company/activity/import/merge persistence",
  { timeout: 90000 },
  async () => {
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), "orgtik-crm-v3-"));
    Object.assign(process.env, {
      MOCK_AUTH_FILE: path.join(folder, "accounts.json"),
      MOCK_AUTH_STORE: "file",
      MOCK_JOURNAL: "memory",
      MOCK_SANDBOX: "crm-v3-" + process.pid,
      MOCK_CLOCK: "frozen",
      MOCK_NOW: "2026-10-07T09:00:00Z",
      VERCEL: "",
      KV_REST_API_URL: "",
      KV_REST_API_TOKEN: "",
      UPSTASH_REDIS_REST_URL: "",
      UPSTASH_REDIS_REST_TOKEN: "",
    });
    process.argv.push("--only=sos,admin,sales");
    const server = http.createServer(require("../../api/index"));
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const base = "http://127.0.0.1:" + server.address().port;
    async function call(app, url, token, method = "GET", body) {
      const response = await fetch(base + "/" + app + url, {
        method,
        headers: {
          connection: "close",
          ...(token ? { authorization: "Bearer " + token } : {}),
          ...(body ? { "content-type": "application/json" } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      const isPdf = response.headers.get("content-type")?.includes("application/pdf");
      const data = isPdf ? {data:Buffer.from(await response.arrayBuffer())} : await response.json();
      return { status: response.status, data: data.data, raw: data };
    }
    const good = (result) => {
      assert.ok(result.status < 300, JSON.stringify(result.raw));
      return result.data;
    };
    try {
      const login = good(
          await call("sos", "/api/auth/login", null, "POST", {
            email: "mona.adel@orgtik.test",
            password: "Local@2026",
            mode: "workspace",
            workspaceId: "ws_orgtik",
            target: "sales",
          }),
        ),
        token = login.tokens.accessToken;
      const before = good(await call("sales", "/api/crm/v3", token));
      assert.ok(before.contacts.length);
      assert.equal(before.pipelines[0].stages.length, 9);
      const contact = good(
        await call("sales", "/api/crm/v3/contacts", token, "POST", {
          fullName: "V3 Prospect",
          email: "v3-prospect@crm.test",
          companyName: "V3 Company",
          value: 2300,
        }),
      );
      assert.ok(
        good(await call("sales", "/api/customers?limit=200", token)).items.some(
          (row) => row.id === contact.id,
        ),
      );
      const pipeline = before.pipelines[0];
      pipeline.stages.splice(4, 0, {
        id: "negotiation",
        name: "Negotiation",
        probability: 60,
        status: "qualified",
      });
      good(
        await call("sales", "/api/crm/v3/config", token, "PATCH", {
          pipelines: [pipeline],
          fields: [{ id: "size", name: "Company size", type: "number" }],
        }),
      );
      const moved = good(
        await call(
          "sales",
          "/api/crm/v3/contacts/" + contact.id,
          token,
          "PATCH",
          { stageId: "negotiation", tags: ["priority"], fields: { size: 12 } },
        ),
      );
      assert.equal(moved.status, "qualified");
      assert.equal(moved.stageId, "negotiation");
      assert.equal(moved.probability, 60);
      assert.equal(moved.fields.size, 12);
      const activity = good(
        await call(
          "sales",
          "/api/crm/v3/contacts/" + contact.id + "/activities",
          token,
          "POST",
          { kind: "whatsapp", text: "Simulated follow-up" },
        ),
      );
      assert.equal(activity.simulated, true);
      assert.equal(activity.actorId, login.user.id);
      const imported = good(
        await call("sales", "/api/crm/v3/import", token, "POST", {
          rows: [
            {
              fullName: "Imported prospect",
              email: "imported@crm.test",
              companyName: "V3 Company",
            },
            { fullName: "Duplicate", email: "v3-prospect@crm.test" },
          ],
        }),
      );
      assert.equal(imported[0].state, "created");
      assert.equal(imported[1].state, "failed");
      const merged = good(
        await call("sales", "/api/crm/v3/merge", token, "POST", {
          sourceId: imported[0].id,
          targetId: contact.id,
        }),
      );
      assert.equal(merged.id, contact.id);
      assert.ok(
        !good(await call("sales", "/api/crm/v3", token)).contacts.some(
          (row) => row.id === imported[0].id,
        ),
      );
      const restored = good(
        await call("sales", "/api/crm/v3", token),
      ).contacts.find((row) => row.id === contact.id);
      assert.equal(restored.fields.size, 12);
      assert.ok(restored.activities.some((row) => row.kind === "whatsapp"));
      const invalid = await call(
        "sales",
        "/api/crm/v3/contacts/" + contact.id,
        token,
        "PATCH",
        { probability: 150 },
      );
      assert.equal(invalid.status, 422);
      const atomicBefore = good(
        await call("sales", "/api/crm/v3", token),
      ).contacts.find((row) => row.id === contact.id);
      const atomic = good(
        await call("sales", "/api/crm/v3/bulk", token, "POST", {
          ids: [contact.id],
          patch: { stageId: "contacted", probability: 150 },
        }),
      );
      assert.equal(atomic[0].state, "failed");
      const atomicAfter = good(
        await call("sales", "/api/crm/v3", token),
      ).contacts.find((row) => row.id === contact.id);
      assert.equal(atomicAfter.stageId, atomicBefore.stageId);
      assert.deepEqual(atomicAfter.activities, atomicBefore.activities);
      const consent = good(
        await call(
          "sales",
          "/api/crm/v3/contacts/" + contact.id,
          token,
          "PATCH",
          { marketingConsent: "opted_in" },
        ),
      );
      assert.equal(consent.marketingConsent.state, "opted_in");
      assert.equal(consent.marketingConsent.source, "manual_mock");
      assert.equal(consent.marketingConsent.recordedBy, login.user.id);
      const blank = good(
        await call("sales", "/api/crm/v3/contacts", token, "POST", {
          fullName: "Unknown consent",
          email: "unknown-consent@crm.test",
        }),
      );
      assert.equal(blank.marketingConsent.state, "unknown");
      assert.equal(blank.marketingConsent.recordedAt, null);
      assert.equal(
        (
          await call(
            "sales",
            "/api/crm/v3/contacts/" + blank.id,
            token,
            "PATCH",
            { marketingConsent: "yes" },
          )
        ).status,
        422,
      );
      const offers = good(
        await call("sales", "/api/offers?limit=100", token),
      ).items;
      if (offers.length) {
        const offer = offers[0],
          original = good(
            await call("sales", "/api/offers/" + offer.id, token),
          );
        const terms = good(
          await call(
            "sales",
            "/api/crm/v3/offers/" + offer.id,
            token,
            "PATCH",
            {
              validUntil: "2026-10-14T09:00:00Z",
              signature: { name: "Review simulation", consent: true },
            },
          ),
        );
        assert.equal(terms.signature.simulated, true);
        assert.equal(
          good(await call("sales", "/api/offers/" + offer.id, token)).summary
            .total,
          original.summary.total,
        );
        const document = good(
          await call("sales", "/api/crm/v3/offers/" + offer.id + "/pdf", token),
        );
        assert.ok(Buffer.isBuffer(document));
        assert.equal(document.subarray(0, 5).toString(), "%PDF-");
        assert.ok(document.length > 100);
      }
      assert.equal(
        (
          await call("sales", "/api/crm/v3/contacts", token, "POST", {
            fullName: "Invalid country",
            email: "invalid-country@crm.test",
            countryCode: "ZZ",
          })
        ).status,
        422,
      );
      const invalidValueImport = good(await call("sales","/api/crm/v3/import",token,"POST",{rows:[{fullName:"Invalid numeric CSV",email:"invalid-number@crm.test",value:null}]}));
    assert.equal(invalidValueImport[0].state,"failed");
    assert.ok(!good(await call("sales","/api/crm/v3",token)).contacts.some(row=>row.email==="invalid-number@crm.test"));
    const owner = good(
        await call("sos", "/api/auth/register", null, "POST", {
          email: "owner-empty-crm@crm.test",
          name: "Empty CRM",
          password: "StrongFixture!",
        }),
      );
      good(
        await call(
          "sos",
          "/api/suite/tools/crm/trial",
          owner.tokens.accessToken,
          "POST",
          { planId: "crm_pro" },
        ),
      );
      const empty = good(
        await call(
          "sos",
          "/api/auth/workspace",
          owner.tokens.accessToken,
          "POST",
          { workspaceId: owner.workspaceContext.workspace.id, target: "sales" },
        ),
      );
      assert.equal(
        good(await call("sales", "/api/crm/v3", empty.tokens.accessToken))
          .contacts.length,
        0,
      );
      assert.equal(
        (
          await call(
            "sales",
            "/api/crm/v3/contacts/" + contact.id,
            empty.tokens.accessToken,
            "PATCH",
            { value: 1 },
          )
        ).status,
        404,
      );
      for (const offer of offers) assert.equal((await call("sales", "/api/crm/v3/offers/" + offer.id + "/pdf", empty.tokens.accessToken)).status, 404);
      const projects = good(await call("sales", "/api/projects?limit=100", token)).items;
      for (const project of projects.filter(row => row.latestContract).slice(0, 4)) {
        const id = project.latestContract.id;
        const pdf = good(await call("sales", "/api/crm/v3/contracts/" + id + "/pdf", token));
        assert.equal(pdf.subarray(0, 5).toString(), "%PDF-");
        assert.ok(pdf.length > 100);
        assert.equal((await call("sales", "/api/crm/v3/contracts/" + id + "/pdf", empty.tokens.accessToken)).status, 404);
      }
      assert.equal((await call("sales", "/api/crm/v3/offers/" + offers[0].id + "/pdf", null)).status, 401);
      const sample = good(
        await call(
          "sales",
          "/api/crm/v3/sample",
          empty.tokens.accessToken,
          "POST",
          {},
        ),
      );
      assert.equal(sample.contacts.length, 3);
      assert.equal(
        good(
          await call(
            "sales",
            "/api/crm/v3/sample",
            empty.tokens.accessToken,
            "POST",
            {},
          ),
        ).contacts.length,
        3,
      );
    } finally {
      await new Promise((resolve) => server.close(resolve));
      fs.rmSync(folder, { recursive: true, force: true });
    }
  },
);
