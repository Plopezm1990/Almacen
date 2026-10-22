export function activeMembershipsForUser(memberships, userId, empresaId) {
  return (Array.isArray(memberships) ? memberships : []).filter((m) =>
    m &&
    m.activo === true &&
    m.user_id === userId &&
    m.empresa_id === empresaId
  );
}

export function membershipCoversLocal(membership, empresaId, localId = "") {
  if (!membership || membership.activo !== true || membership.empresa_id !== empresaId) return false;
  if (!localId) return true;
  return membership.todos_locales === true ||
    (membership.todos_locales === false && membership.local_id === localId);
}

export function userHasTenantScope({
  memberships,
  userId,
  empresaId,
  localId = "",
  roles = null,
}) {
  if (!userId || !empresaId) return false;
  const allowedRoles = Array.isArray(roles) && roles.length > 0 ? new Set(roles) : null;
  return activeMembershipsForUser(memberships, userId, empresaId).some((m) =>
    (!allowedRoles || allowedRoles.has(m.rol)) &&
    membershipCoversLocal(m, empresaId, localId)
  );
}

export function filterRecipientSubscriptions({
  subscriptions,
  profiles,
  memberships,
  empresaId,
  localId = "",
  allowedRoles,
}) {
  const activeProfiles = new Set(
    (Array.isArray(profiles) ? profiles : [])
      .filter((p) => p && p.activo === true && p.user_id)
      .map((p) => p.user_id),
  );
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [];

  return (Array.isArray(subscriptions) ? subscriptions : []).filter((s) => {
    if (!s || !s.user_id || !activeProfiles.has(s.user_id)) return false;
    return userHasTenantScope({
      memberships,
      userId: s.user_id,
      empresaId,
      localId,
      roles,
    });
  });
}
