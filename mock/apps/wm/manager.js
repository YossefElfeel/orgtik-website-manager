// Manager-only presentation and edits. Public content is never changed by ordering.
const crypto = require("node:crypto");
// Packaged copy of apps/wm/lib/manager-pages.json; parity is checked before deployment.
const config = require("./seed/manager-pages.json");
const { makeStore } = require("./content");
function sourceIds(id) {
  return [...new Set(Object.values(config[id]?.fields ?? {}).flatMap(section => section.fields.map(field => field.record)))].filter(key=>key!==id);
}
function orderOf(store, type) {
  const rows = [...store.entries.values()].filter(entry=>entry.type===type).sort((a,b)=>a.order-b.order);
  const known = new Set(rows.map(entry=>entry.id));
  const ids = [...new Set([...(store.managerOrders[type] ?? []).filter(id=>known.has(id)),...known])];
  const version = crypto.createHash("sha256").update(JSON.stringify([ids, rows.map(entry=>[entry.id,entry.workflow.version])])).digest("hex");
  return { ids, version };
}
function savePageDraft(store, id, commands, who, now) {
  const allowed = new Set([id,...sourceIds(id)]);
  if (!config[id] || !Array.isArray(commands) || !commands.length || commands.length>allowed.size || new Set(commands.map(command=>command.id)).size!==commands.length) return {status:422,code:"invalid_fields"};
  const shadow = makeStore(now); shadow.importState(store.exportState());
  for (const command of commands) {
    const entry = shadow.entries.get(command.id);
    if (!allowed.has(command.id) || !entry || entry.live?.managedIn || !Array.isArray(command.patches) || !command.patches.length || command.patches.length>6) return {status:422,code:"invalid_fields"};
    if (entry.workflow.version!==command.version) return {status:412,code:"stale"};
    for (const patch of command.patches) {
      if (command.id !== id && Object.keys(patch).some(key=>!["locale","fields","note"].includes(key))) return {status:422,code:"invalid_fields"};
      if (!patch || Object.keys(patch).some(key=>!["locale","fields","seo","slug","neutral","image","note","presentation"].includes(key)) || patch.locale!==undefined && !store.LOCALES.includes(patch.locale)) return {status:422,code:"invalid_fields"};
      const result = shadow.save(entry,who,patch,{can:permission=>permission==="content:edit"});
      if(result.status || result.errors) return {status:result.status||422,code:result.code||"invalid",fieldErrors:result.errors};
    }
  }
  store.importState(shadow.exportState());
  return {data:store.detail(store.entries.get(id))};
}
module.exports={sourceIds,orderOf,savePageDraft,config};
