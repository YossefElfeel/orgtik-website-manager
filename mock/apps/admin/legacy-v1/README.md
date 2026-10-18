# Frozen legacy platform replay

These complete sources are copied byte for byte from commit `33bd33e`, before the R0 pricing, tax, seat and publishing changes. They are historical reducers, not live application routes. `mock/lib/platform-replay.js` loads them privately; no public HTTP replay endpoint is provided.

| Local source | Original source | Git blob |
| --- | --- | --- |
| `platform.js` | `mock/apps/admin.js` | `c000da714b3945a515f9712d4579a84497c30a37` |
| `admin-api.js` | `mock/apps/admin/admin-api.js` | `2fc72e09f2a8b66fc534a8aa5f53ece560b5e249` |
| `app-api.js` | `mock/apps/admin/app-api.js` | `71d0dc756085f47fc037eb7f5ae3f976b0daa3a5` |
| `lifecycle.js` | `mock/apps/admin/lifecycle.js` | `35ef30a7878297249ab1d9a11535747433cb12ce` |
| `permissions.js` | `mock/apps/admin/permissions.js` | `6ff62b36a009259b98a3f884f23bc6f698da1d3e` |
| `pricing.js` | `mock/apps/admin/pricing.js` | `f4fac8f435cf8f89196296cda86957ab2851c34d` |
| `seed-catalog.js` | `mock/apps/admin/seed-catalog.js` | `8ad8a70067af2b39ca91187ca4192408ea1e05b9` |
| `seed-pricing.js` | `mock/apps/admin/seed-pricing.js` | `11390b6ea77a43235197b6101a4f842a0623a093` |
| `store.js` | `mock/apps/admin/store.js` | `74de4aa3930091241f566a8592209463f2da9681` |
| `identity.js` | `mock/lib/identity.js` | `9fa8eaf73588e93d405c5c5c2fe18fca54fbc1e0` |

The adapter redirects relative imports to this frozen module set. Runtime configuration and non-financial identity date/password helpers are supplied explicitly. The source files themselves remain unchanged. Runtime-only instrumentation exposes the store's private allocation sequence and the platform singleton; it does not change pricing, tax, proration, quantities, notices or publishing behavior.

The original sixteen people populate the original seed. Later signup workspaces are reconstructed from account registration metadata in creation order at recorded instants. Current account deactivation or token expiry does not rewrite an already accepted historical command. Missing actor/registration data fails closed; the adapter cannot recover an absent journal or an unexported historical financial state.

Only the process-internal accepted-entry method activates replay authority. Saved authorization supplies actor attribution inside that method; a client `x-mock-replay` header grants nothing. A newer committed platform snapshot is a one-way boundary: adoption preserves its amounts and sequence verbatim, and subsequent unversioned writes require an explicit migration review rather than silent repricing.
