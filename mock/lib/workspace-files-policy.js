// A scalar projection of the canonical Files subscription, not an authority grant.
function filesPolicy(S, workspaceId, context) {
  const workspace = S.workspace(workspaceId);
  const line = workspace?.lines.find(row => row.tool === 'files' && !['ended', 'deleted'].includes(row.state));
  const plan = line && S.db.plans.find(row => row.id === line.planId);
  const gb = plan?.limits?.['files.storage_gb'];
  const bytes = Number.isFinite(gb) && gb >= 0 ? Math.floor(gb * 1024 ** 3) : null;
  const storageBytes = Number.isSafeInteger(bytes) ? bytes : null;
  const billingReadOnly = !workspace || !line || ['suspended', 'deleted', 'cancelled'].includes(workspace.state) || line.state === 'read_only';
  const inScope = context?.workspace?.id === workspaceId;
  const preview = Boolean(inScope && context.actor?.readOnly);
  return {
    planId: plan?.id || null,
    storageBytes,
    shareLinks: plan?.flags?.['files.share_links'] === true,
    billingReadOnly,
    readOnly: billingReadOnly || preview,
    canAcceptSamples: !billingReadOnly && !preview && storageBytes !== null,
    canWrite: Boolean(inScope && context.tools?.files?.canWrite && !billingReadOnly && !preview && storageBytes !== null),
  };
}
module.exports = { filesPolicy };
