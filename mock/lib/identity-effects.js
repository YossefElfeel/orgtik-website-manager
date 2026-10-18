// Account deltas belong to private identity storage, never to a replay entry or receipt.
const conflict = () => Object.assign(new Error("Account changed concurrently. Retry the operation."), { status: 409, code: "account_conflict" });
function applyChanges(accounts, changes) {
  if (!Array.isArray(changes)) throw new TypeError("Invalid identity deltas");
  const next = { ...accounts }, replacing = new Set(changes.map(change => String(change.id)));
  const emails = new Map(Object.entries(next).filter(([id]) => !replacing.has(id)).map(([id, raw]) => [String(JSON.parse(raw).user.email).trim().toLowerCase(), id]));
  for (const change of changes) {
    const id = String(change.id);
    if ((accounts[id] ?? null) !== change.expected || typeof change.value !== "string") throw conflict();
    const record = JSON.parse(change.value);
    if (String(record.user?.id) !== id || typeof record.user.email !== "string" || record.user.password !== undefined) throw new TypeError("Unsafe identity delta");
    const email = record.user.email.trim().toLowerCase(), prior = emails.get(email);
    if (prior && prior !== id) throw conflict();
    emails.set(email, id); next[id] = change.value;
  }
  return next;
}
module.exports = { applyChanges };
