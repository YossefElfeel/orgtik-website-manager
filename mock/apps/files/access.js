// One ACL calculation for native Files routes and private cross-app record references.
// The identity facade supplies current workspace/tool roles; global identity grants do not.
function createFileAccess({ state, identity, boardAuthority }) {
  const folders = state.folders;
  const toolRoles = user => identity.userScopes(user).find(scope => scope.scope === 'file_manager')?.roles || [];
  const isAdmin = user => toolRoles(user).includes('super_admin');
  const isStaff = user => user.userType !== 'customer';
  const parentOf = folder => folder?.parentId ? folders.get(folder.parentId) || null : null;
  function chain(folder) {
    const result = [], seen = new Set();
    for (let current = folder; current && !seen.has(current.id); current = parentOf(current)) { seen.add(current.id); result.push(current); }
    return result;
  }
  const sharedWith = (folder, user) => folder.visibility === 'everyone' ? isStaff(user) : folder.visibility === 'specific_people' ? folder.allowedUserIds.includes(user.id) : false;
  function authorizeBoard(user, file, write = false) {
    if (!file.whiteboard) return;
    if (typeof boardAuthority?.authorize !== 'function') throw Object.assign(new Error('Whiteboard authority is unavailable.'), { status: 503, code: 'whiteboard_authority_unavailable' });
    const result = boardAuthority.authorize({ boardId: file.whiteboard.boardId, ...(file.id ? { fileId: file.id } : {}), actorId: user?.id, write });
    if (result?.then) throw Object.assign(new Error('Whiteboard authority must be checked before reading.'), { status: 503, code: 'whiteboard_authority_unavailable' });
  }
  function boardAccess(user, file, write = false) {
    try { authorizeBoard(user, file, write); return true; }
    catch (error) { if ([403, 404, 423].includes(error.status)) return false; throw error; }
  }
  function folderAccess(user, folder) {
    if (!folder) return null;
    if (isAdmin(user)) return { level: 'admin', sharedRootId: null };
    const ancestors = chain(folder);
    if (ancestors.some(row => row.ownerId === user.id)) return { level: 'owner', sharedRootId: null };
    if (!sharedWith(folder, user)) return null;
    let root = folder;
    for (const ancestor of ancestors.slice(1)) { if (!sharedWith(ancestor, user)) break; root = ancestor; }
    return { level: 'collab', sharedRootId: root.id };
  }
  function fileAccess(user, file) {
    if (!boardAccess(user, file)) return null;
    if (isAdmin(user)) return { level: 'admin', sharedRootId: null };
    const permission = file.ownerId !== user.id && file.accessOverride?.permissions?.find(row => row.userId === user.id)?.permission;
    if (permission) return { level: permission === 'edit' ? 'collab' : permission === 'comment' ? 'commenter' : 'reader', sharedRootId: null };
    const folder = file.folderId ? folders.get(file.folderId) : null, inherited = folder && folderAccess(user, folder);
    if (inherited) return inherited;
    if (file.ownerId === user.id) return { level: 'owner', sharedRootId: null };
    if (file.accessOverride && sharedWith(file.accessOverride, user)) return { level: 'reader', sharedRootId: null };
    return null;
  }
  function caps(access, ownsItem, user) {
    const admittedWriter = Boolean(user && (typeof identity.canWrite !== 'function' || identity.canWrite(user)) && toolRoles(user).some(role => ['super_admin', 'file_editor'].includes(role)));
    const canComment = Boolean(access && access.level !== 'reader' && admittedWriter);
    const disabled = !access || ['reader', 'commenter'].includes(access.level) || !admittedWriter;
    if (disabled) return { canComment, canWrite: false, canMove: false, canArchive: false, canManageAccess: false, canManageExternalShares: false, sharedRootId: !access || access.level === 'reader' ? null : access.sharedRootId ?? null };
    if (access.level !== 'collab') return { canComment, canWrite: true, canMove: true, canArchive: true, canManageAccess: true, canManageExternalShares: true, sharedRootId: null };
    return { canComment, canWrite: true, canMove: true, canArchive: ownsItem, canManageAccess: ownsItem, canManageExternalShares: ownsItem, sharedRootId: access.sharedRootId };
  }
  const folderCaps = (user, folder) => caps(chain(folder).some(row => row.custodyReadOnly) ? null : folderAccess(user, folder), folder.ownerId === user.id, user);
  const fileCaps = (user, file) => {
    const value = caps(file.custodyReadOnly || chain(folders.get(file.folderId)).some(row => row.custodyReadOnly) || !boardAccess(user, file, true) ? null : fileAccess(user, file), file.ownerId === user.id, user);
    return file.whiteboard ? { ...value, canManageExternalShares: false } : value;
  };
  const activeFile = file => Boolean(file && !file.deletedAt && !file.custodyReadOnly && !chain(folders.get(file.folderId)).some(row => row.deletedAt || row.custodyReadOnly));
  return { toolRoles, isAdmin, isStaff, parentOf, chain, folderAccess, fileAccess, caps, folderCaps, fileCaps, activeFile, authorizeBoard, boardAccess };
}
module.exports = { createFileAccess };
