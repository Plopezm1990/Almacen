import assert from 'node:assert/strict';
import {
  filterRecipientSubscriptions,
  membershipCoversLocal,
  userHasTenantScope,
} from '../../../supabase/functions/_shared/tenant-scope.js';

const memberships = [
  { user_id: 'owner-a', empresa_id: 'empresa-a', local_id: null, todos_locales: true, rol: 'Propietario', activo: true },
  { user_id: 'manager-a1', empresa_id: 'empresa-a', local_id: 'local-a1', todos_locales: false, rol: 'Encargado', activo: true },
  { user_id: 'cash-a1', empresa_id: 'empresa-a', local_id: 'local-a1', todos_locales: false, rol: 'Cajero/a', activo: true },
  { user_id: 'owner-b', empresa_id: 'empresa-b', local_id: null, todos_locales: true, rol: 'Propietario', activo: true },
  { user_id: 'inactive-a', empresa_id: 'empresa-a', local_id: null, todos_locales: true, rol: 'Propietario', activo: false },
];

assert.equal(userHasTenantScope({
  memberships, userId: 'owner-a', empresaId: 'empresa-a', localId: 'local-a2', roles: ['Propietario'],
}), true, 'todos_locales must cover same-company locals');

assert.equal(userHasTenantScope({
  memberships, userId: 'owner-b', empresaId: 'empresa-a', localId: 'local-a1', roles: ['Propietario'],
}), false, 'owner of another company must be denied');

assert.equal(userHasTenantScope({
  memberships, userId: 'missing', empresaId: 'empresa-a', localId: 'local-a1',
}), false, 'user without membership must be denied');

assert.equal(userHasTenantScope({
  memberships, userId: 'manager-a1', empresaId: 'empresa-a', localId: 'local-a2', roles: ['Encargado'],
}), false, 'membership for another local must be denied');

assert.equal(userHasTenantScope({
  memberships, userId: 'cash-a1', empresaId: 'empresa-a', localId: 'local-a1', roles: ['Propietario', 'Encargado'],
}), false, 'role boundary must be enforced');

assert.equal(membershipCoversLocal(memberships[1], 'empresa-b', 'local-a1'), false);

const subscriptions = [
  { endpoint: 'owner-a-device', user_id: 'owner-a' },
  { endpoint: 'manager-a1-device', user_id: 'manager-a1' },
  { endpoint: 'cash-a1-device', user_id: 'cash-a1' },
  { endpoint: 'owner-b-device', user_id: 'owner-b' },
  { endpoint: 'legacy-anonymous-device', user_id: null },
];
const profiles = [
  { user_id: 'owner-a', activo: true },
  { user_id: 'manager-a1', activo: true },
  { user_id: 'cash-a1', activo: true },
  { user_id: 'owner-b', activo: true },
];

const recipients = filterRecipientSubscriptions({
  subscriptions,
  profiles,
  memberships,
  empresaId: 'empresa-a',
  localId: 'local-a1',
  allowedRoles: ['Propietario', 'Encargado'],
});
assert.deepEqual(recipients.map((x) => x.endpoint).sort(), ['manager-a1-device', 'owner-a-device']);
assert.equal(recipients.some((x) => x.user_id === null), false, 'legacy userless subscriptions must fail closed');
assert.equal(recipients.some((x) => x.user_id === 'owner-b'), false, 'cross-tenant recipients must be denied');

console.log('P2_EDGE_SECURITY_BEHAVIOR_OK=1');
