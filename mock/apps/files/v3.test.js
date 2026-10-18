const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { runtime, harness, plain } = require("../tasks/runtime-harness");
const manifest = require("./assets/manifest.json");
const base = "/api/v1/files-v3";
const args = (body, key) => [body, { "idempotency-key": key }];
const policy = () => ({
  planId: "files_pro",
  storageBytes: 500 * 1024 ** 3,
  shareLinks: true,
  billingReadOnly: false,
  readOnly: false,
  canAcceptSamples: true,
  canWrite: true,
});
test("ordinary versions pin old bytes, check current head, retain storage and hydrate complete visible export", async () => {
  const f = runtime("files", "ws_versions"),
    http = await harness([f]);
  try {
    const created = await http.call(
      0,
      "POST",
      `${base}/samples`,
      ...args(
        { sampleId: "pdf_company_profile", name: "Pinned.pdf" },
        "create",
      ),
    );
    assert.equal(created.status, 200);
    const file = created.json.data;
    const one = await http.call(
      0,
      "GET",
      `/api/v1/files/${file.id}/versions/v1/download`,
    );
    const second = await http.call(
      0,
      "POST",
      `${base}/files/${file.id}/version`,
      ...args({ sampleId: "pdf_sla_gulf", baseVersionId: "v1" }, "version"),
    );
    assert.equal(second.status, 200);
    assert.equal(second.json.data.versionId, "v2");
    const two = await http.call(
      0,
      "GET",
      `/api/v1/files/${file.id}/versions/v2/download`,
    );
    assert.notDeepEqual(one.raw, two.raw);
    assert.deepEqual(
      (
        await http.call(
          0,
          "GET",
          `/api/v1/files/${file.id}/versions/v1/download`,
        )
      ).raw,
      one.raw,
    );
    const snapshot = plain(f.instance.exportSnapshot());
    assert.equal(
      (
        await http.call(
          0,
          "POST",
          `${base}/files/${file.id}/version`,
          ...args({ sampleId: "pdf_sla_gulf", baseVersionId: "v1" }, "version"),
        )
      ).status,
      200,
    );
    assert.deepEqual(plain(f.instance.exportSnapshot()), snapshot);
    assert.equal(
      (
        await http.call(
          0,
          "POST",
          `${base}/files/${file.id}/version`,
          ...args({ sampleId: "pdf_lease", baseVersionId: "v1" }, "stale"),
        )
      ).status,
      409,
    );
    assert.equal(
      (
        await http.call(
          0,
          "POST",
          `${base}/files/${file.id}/version`,
          ...args({ sampleId: "xlsx_pricing", baseVersionId: "v2" }, "type"),
        )
      ).status,
      422,
    );
    assert.equal(
      f.instance.usage()[0].used * 1024 ** 3,
      manifest.pdf_company_profile.size + manifest.pdf_sla_gulf.size,
    );
    const context = {
      realm: "isolated",
      workspace: { id: "ws_versions" },
      actor: { effectiveUserId: 1 },
      tools: { files: { roles: ["super_admin"], access: "active" } },
    };
    assert.equal(f.instance.suiteExport(context).files[0].versions.length, 2);
    assert.equal(
      JSON.stringify(f.instance.suiteExport(context)).includes("secretHash"),
      false,
    );
    const restored = runtime("files", "ws_versions", { snapshot });
    try {
      assert.deepEqual(plain(restored.instance.exportSnapshot()), snapshot);
      assert.equal(
        restored.instance.suiteExport(context).files[0].versions.length,
        2,
      );
    } finally {
      restored.close();
    }
  } finally {
    await http.close();
  }
});
test("view/comment/edit grants respect guest role ceilings, attribution, notifications and current removal", async () => {
  const f = runtime("files", "ws_acl", {
      roles: {
        one: ["file_editor"],
        two: ["file_editor"],
        guest: ["file_guest"],
      },
      users: [
        {
          id: 1,
          key: "one",
          firstName: "One",
          lastName: "Owner",
          email: "one@test",
          isActive: true,
          userType: "employee",
        },
        {
          id: 2,
          key: "two",
          firstName: "Two",
          lastName: "Editor",
          email: "two@test",
          isActive: true,
          userType: "employee",
        },
        {
          id: 3,
          key: "guest",
          firstName: "Three",
          lastName: "Guest",
          email: "guest@test",
          isActive: true,
          userType: "customer",
        },
      ],
    }),
    http = await harness([f]);
  try {
    const file = (
      await http.call(
        0,
        "POST",
        `${base}/samples`,
        ...args({ sampleId: "pdf_company_profile" }, "sample"),
      )
    ).json.data;
    const grant = (permission) =>
      http.call(
        0,
        "POST",
        `${base}/files/${file.id}/access`,
        ...args(
          {
            permissions: [
              { userId: 2, permission },
              { userId: 3, permission: "edit" },
            ],
            notify: true,
          },
          `grant-${permission}`,
        ),
      );
    const view = await grant("view");
    assert.equal(view.status, 200);
    assert.equal(view.json.data.notificationIds.length, 2);
    const context = (id) => ({
      realm: "isolated",
      workspace: { id: "ws_acl" },
      actor: { effectiveUserId: id },
      tools: {
        files: {
          roles: [id === 3 ? "file_guest" : "file_editor"],
          access: "active",
        },
      },
    });
    assert.equal(f.instance.suiteFeed(context(2)).notifications.length, 1);
    assert.equal(
      (
        await http.call(
          0,
          "POST",
          `${base}/files/${file.id}/comment`,
          { text: "Forbidden" },
          { "x-user": "2", "idempotency-key": "view-comment" },
        )
      ).status,
      403,
    );
    assert.equal(
      (
        await http.call(
          0,
          "POST",
          `${base}/files/${file.id}/comment`,
          { text: "Guest forbidden" },
          { "x-user": "3", "idempotency-key": "guest-comment" },
        )
      ).status,
      403,
    );
    assert.equal(
      (
        await http.call(
          0,
          "POST",
          `${base}/files/${file.id}/rename`,
          { name: "Guest.pdf" },
          { "x-user": "3", "idempotency-key": "guest-rename" },
        )
      ).status,
      403,
    );
    await grant("comment");
    const comment = await http.call(
      0,
      "POST",
      `${base}/files/${file.id}/comment`,
      { text: "Actual comment" },
      { "x-user": "2", "idempotency-key": "comment" },
    );
    assert.equal(comment.status, 200);
    assert.equal(comment.json.data.author, "Two Editor");
    assert.equal(
      (
        await http.call(
          0,
          "POST",
          `${base}/files/${file.id}/rename`,
          { name: "No.pdf" },
          { "x-user": "2", "idempotency-key": "comment-rename" },
        )
      ).status,
      403,
    );
    await grant("edit");
    assert.equal(
      (
        await http.call(
          0,
          "POST",
          `${base}/files/${file.id}/rename`,
          { name: "Edited.pdf" },
          { "x-user": "2", "idempotency-key": "edit-rename" },
        )
      ).status,
      200,
    );
    f.instance.transferOwnership({
      fromUserId: 2,
      target: { kind: "archive" },
      operationId: "offboard-editor",
    });
    assert.equal(
      (
        await http.call(0, "GET", `${base}/files/${file.id}`, undefined, {
          "x-user": "2",
        })
      ).status,
      404,
    );
    assert.equal(
      f.instance
        .exportSnapshot()
        .data.files[0][1].accessOverride.permissions.some(
          (row) => row.userId === 2,
        ),
      false,
    );
    await http.call(
      0,
      "POST",
      `${base}/files/${file.id}/access`,
      ...args({ permissions: [], notify: false }, "remove"),
    );
    assert.equal(
      (
        await http.call(0, "GET", `${base}/files/${file.id}`, undefined, {
          "x-user": "2",
        })
      ).status,
      404,
    );
    assert.equal(f.instance.suiteFeed(context(2)).notifications.length, 0);
    assert.equal(f.instance.suiteFeed(context(2)).files.length, 0);
  } finally {
    await http.close();
  }
});
test("quota applies to versions, duplicate, legacy samples, public requests and ordinary partial bulk collisions", async () => {
  let allowance = policy();
  const f = runtime("files", "ws_quota", { filesPolicy: () => allowance }),
    http = await harness([f]);
  try {
    const folder = (
      await http.call(0, "POST", "/api/v1/folders", { name: "Destination" })
    ).json.data;
    const one = (
      await http.call(
        0,
        "POST",
        `${base}/samples`,
        ...args({ sampleId: "pdf_company_profile", name: "Same.pdf" }, "one"),
      )
    ).json.data;
    const clash = (
      await http.call(
        0,
        "POST",
        `${base}/samples`,
        ...args(
          {
            sampleId: "pdf_company_profile",
            name: "Same.pdf",
            folderId: folder.id,
          },
          "clash",
        ),
      )
    ).json.data;
    const two = (
      await http.call(
        0,
        "POST",
        `${base}/samples`,
        ...args({ sampleId: "txt_release_notes", name: "Notes.txt" }, "two"),
      )
    ).json.data;
    const result = await http.call(
      0,
      "POST",
      `${base}/bulk`,
      ...args(
        {
          ids: [one.id, two.id, "missing"],
          action: "move",
          folderId: folder.id,
        },
        "bulk",
      ),
    );
    assert.deepEqual(plain(result.json.data.succeeded), [two.id]);
    assert.equal(result.json.data.failed.length, 2);
    assert.equal(result.json.data.failed[0].code, "name_collision");
    const kept = await http.call(
      0,
      "POST",
      `${base}/bulk`,
      ...args(
        { ids: [one.id], action: "move", folderId: folder.id, keepBoth: true },
        "keep",
      ),
    );
    assert.equal(kept.json.data.succeeded.length, 1);
    assert.equal(
      (await http.call(0, "GET", `${base}/files/${one.id}`)).json.data.file
        .name,
      "Same (2).pdf",
    );
    allowance = {
      ...allowance,
      storageBytes: f.instance.usage()[0].used * 1024 ** 3,
    };
    assert.equal(
      (
        await http.call(
          0,
          "POST",
          `${base}/files/${one.id}/version`,
          ...args(
            { sampleId: "pdf_sla_gulf", baseVersionId: "v1" },
            "full-version",
          ),
        )
      ).json.code,
      "storage_quota_exceeded",
    );
    assert.equal(
      (
        await http.call(
          0,
          "POST",
          `${base}/files/${one.id}/duplicate`,
          ...args({}, "full-copy"),
        )
      ).status,
      409,
    );
    assert.equal(
      (
        await http.call(
          0,
          "POST",
          "/api/v1/files/samples",
          ...args({ sampleId: "pdf_company_profile" }, "legacy-full"),
        )
      ).status,
      409,
    );
    allowance = {
      ...allowance,
      storageBytes: null,
      canAcceptSamples: false,
      canWrite: false,
    };
    assert.equal(
      (
        await http.call(
          0,
          "POST",
          `${base}/samples`,
          ...args({ sampleId: "pdf_company_profile" }, "unavailable"),
        )
      ).status,
      403,
    );
    assert.equal(
      (
        await http.call(
          0,
          "GET",
          `/api/v1/files/${clash.id}/versions/v1/download`,
        )
      ).status,
      200,
    );
  } finally {
    await http.close();
  }
});
test("public requests require the existing session, hide folder contents, recover one receipt and close on rotation/revocation", async () => {
  const f = runtime("files", "ws_requests"),
    http = await harness([f]);
  try {
    const folder = (
      await http.call(0, "POST", "/api/v1/folders", { name: "Incoming" })
    ).json.data;
    const result = await http.call(
      0,
      "POST",
      `${base}/requests`,
      ...args(
        {
          folderId: folder.id,
          label: "Send sample",
          password: "demo-pass",
          maxSubmissions: 2,
        },
        "request",
      ),
    );
    assert.equal(result.status, 200);
    const share = result.json.data,
      secret = new URL(share.shareUrl).searchParams.get("secret"),
      url = `/api/v1/public/shares/${share.id}`;
    assert.equal((await http.call(0, "GET", url)).status, 401);
    assert.equal(
      (
        await http.call(0, "POST", `${url}/session`, {
          secret,
          password: "wrong",
        })
      ).status,
      401,
    );
    const session = await http.call(0, "POST", `${url}/session`, {
      secret,
      password: "demo-pass",
    });
    assert.equal(session.status, 204);
    const cookie = session.headers["set-cookie"][0].split(";")[0];
    const metadata = (await http.call(0, "GET", url, undefined, { cookie }))
      .json.data;
    assert.equal(metadata.purpose, "upload_request");
    assert.equal(metadata.capabilities.canDownload, false);
    assert.equal(metadata.request.samples.length > 7, true);
    assert.equal(
      (await http.call(0, "GET", `${url}/items`, undefined, { cookie })).status,
      403,
    );
    const body = { sampleId: "xlsx_pricing", name: "Incoming.xlsx" },
      headers = { cookie, "idempotency-key": "visitor-one" };
    const submit = await http.call(0, "POST", `${url}/request`, body, headers);
    assert.equal(submit.status, 200);
    const snapshot = plain(f.instance.exportSnapshot());
    assert.equal(snapshot.data.files.length, 1);
    assert.equal(JSON.stringify(snapshot).includes(secret), false);
    assert.deepEqual(
      (await http.call(0, "POST", `${url}/request`, body, headers)).json.data,
      submit.json.data,
    );
    assert.deepEqual(plain(f.instance.exportSnapshot()), snapshot);
    assert.equal(
      (
        await http.call(
          0,
          "POST",
          `${url}/request`,
          { ...body, name: "Changed.xlsx" },
          headers,
        )
      ).status,
      409,
    );
    assert.equal(
      (
        await http.call(
          0,
          "GET",
          `${base}/files/${submit.json.data.receiptId}/versions/v1/preview`,
        )
      ).json.data.assets.length > 0,
      true,
    );
    assert.equal(
      (
        await http.call(
          0,
          "GET",
          `${base}/files/${submit.json.data.receiptId}/versions/v1/preview/0`,
        )
      ).headers["content-type"].startsWith("image/png"),
      true,
    );
    await http.call(0, "POST", `/api/v1/shares/${share.id}/rotate`, {});
    assert.equal(
      (await http.call(0, "GET", url, undefined, { cookie })).status,
      401,
    );
    await http.call(
      0,
      "POST",
      `${base}/shares/${share.id}/revoke`,
      ...args({}, "revoke"),
    );
    assert.equal(
      (await http.call(0, "GET", url, undefined, { cookie })).status,
      410,
    );
  } finally {
    await http.close();
  }
});
test("collections persist per person and purge uses real retention without destroying custody", async () => {
  const f = runtime("files", "ws_nile", { fixtureId: "nile-v1" }),
    http = await harness([f]);
  try {
    const original = f.instance.exportSnapshot().data.files[0][1],
      fileId = original.id;
    await http.call(
      0,
      "POST",
      `${base}/files/${fileId}/star`,
      ...args({ starred: true }, "star"),
    );
    await http.call(
      0,
      "POST",
      `${base}/files/${fileId}/open`,
      ...args({}, "open"),
    );
    assert.equal(
      (await http.call(0, "GET", `${base}/library?view=starred`)).json.data
        .files.length,
      1,
    );
    assert.equal(
      (await http.call(0, "GET", `${base}/library?view=recent`)).json.data.files
        .length,
      1,
    );
    await http.call(
      0,
      "POST",
      `${base}/bulk`,
      ...args({ ids: [fileId], action: "archive" }, "trash"),
    );
    assert.equal(
      (
        await http.call(
          0,
          "POST",
          `${base}/trash/purge`,
          ...args({}, "purge-too-early"),
        )
      ).json.data.purged.length,
      0,
    );
    f.instance.transferOwnership({
      fromUserId: 1,
      target: { kind: "archive" },
      operationId: "custody",
    });
    const result = await http.call(
      0,
      "POST",
      `${base}/trash/purge`,
      ...args({}, "purge-custody"),
    );
    assert.equal(result.json.data.purged.length, 0);
    assert.equal(f.instance.exportSnapshot().data.files.length, 1);
  } finally {
    await http.close();
  }
});
test("due trash uses retained timestamps and releases storage without changing the clock", async () => {
  const initial = runtime("files", "ws_nile", { fixtureId: "nile-v1" });
  const snapshot = plain(initial.instance.exportSnapshot()),
    id = snapshot.data.files[0][0];
  initial.close();
  snapshot.data.files[0][1].deletedAt = "2026-08-25T09:00:00.000Z";
  const f = runtime("files", "ws_nile", { fixtureId: "nile-v1", snapshot }),
    http = await harness([f]);
  try {
    assert.equal(
      (await http.call(0, "GET", `${base}/library?view=trash`)).json.data.policy
        .purgeDueCount,
      1,
    );
    const purged = await http.call(
      0,
      "POST",
      `${base}/trash/purge`,
      ...args({}, "due-job"),
    );
    assert.deepEqual(plain(purged.json.data.purged), [id]);
    assert.equal(purged.json.data.usedBytes, 0);
    assert.equal(
      (await http.call(0, "GET", `/api/v1/files/${id}/versions/v1/download`))
        .status,
      404,
    );
    assert.equal(
      (await http.call(0, "GET", `${base}/library?view=trash`)).json.data.policy
        .purgeDueCount,
      0,
    );
  } finally {
    await http.close();
  }
});
