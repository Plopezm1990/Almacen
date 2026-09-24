// Executable single-call reference protocol. It models OCC and idempotency;
// staged dual approval is implemented and tested by the PostgreSQL contract.
import { applyRepartoDiscount } from './discount-math.mjs';

const DEFAULT_LIMITS = Object.freeze({ Propietario: '100', Encargado: '20' });

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  return value;
}

export class DiscountCommandReference {
  constructor(state) {
    this.state = structuredClone(state);
    this.operations = new Map();
    this.audit = [];
    this.tail = Promise.resolve();
  }

  async execute(request, authUserId) {
    let release;
    const previous = this.tail;
    this.tail = new Promise((resolve) => { release = resolve; });
    await previous;
    try {
      const role = this.state.members[authUserId];
      if (!role) throw new Error('local_membership_required');
      const limit = this.state.userLimits?.[authUserId] ??
        this.state.roleLimits?.[role] ?? DEFAULT_LIMITS[role];
      if (limit === undefined || limit === '0') throw new Error('discount_capability_denied');
      if (request.kind === 'COURTESY' &&
        !(role === 'Propietario' || this.state.courtesyUsers?.includes(authUserId))) {
        throw new Error('courtesy_capability_denied');
      }
      // This reduced model does not represent the approval table/RPC flow.
      if (this.state.requireDualApproval) throw new Error('dual_approval_requires_postgres_contract');
      if (typeof request.reason !== 'string' || request.reason.trim() === '') {
        throw new Error('reason_required');
      }
      if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{7,199}$/.test(request.operationId ?? '')) {
        throw new Error('operation_id_invalid');
      }
      const fingerprint = JSON.stringify(canonical({ request, authUserId }));
      const prior = this.operations.get(request.operationId);
      if (prior) {
        if (prior.fingerprint !== fingerprint) throw new Error('operation_id_conflict');
        return { ...structuredClone(prior.result), replayed: true };
      }
      if (request.expectedVersion !== this.state.accountVersion) {
        throw new Error('account_version_conflict');
      }
      const projection = applyRepartoDiscount({
        repartos: this.state.repartos,
        accountId: request.accountId,
        kind: request.kind,
        value: request.value,
        fiscalizedSourceLineIds: this.state.fiscalizedSourceLineIds,
        activeQuotaAccountIds: this.state.activeQuotaAccountIds,
        chargedAccountIds: this.state.chargedAccountIds,
        maxPercent: limit,
      });
      this.state.repartos = projection.repartos;
      this.state.accountVersion += 1;
      const result = {
        operationId: request.operationId,
        accountVersion: this.state.accountVersion,
        discount: projection.discount,
        total: projection.total,
        requesterId: authUserId,
        authorizerId: authUserId,
        replayed: false,
      };
      this.audit.push({ ...result, reason: request.reason.trim(), kind: request.kind });
      this.operations.set(request.operationId, { fingerprint, result });
      return structuredClone(result);
    } finally {
      release();
    }
  }
}
