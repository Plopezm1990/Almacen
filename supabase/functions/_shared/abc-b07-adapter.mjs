const MAX_TEXT_LENGTH = 512;
const SENSITIVE_KEY = /(^|_|-)(pan|cvv|cvc|cid|card(?:number|_number)?|numero(?:_|-)tarjeta|security(?:_|-)code|payment(?:_|-)method(?:_|-)details)(_|-|$)/i;

function cleanText(value, maxLength = MAX_TEXT_LENGTH) {
  if (typeof value !== 'string') return null;
  const result = value.trim();
  if (!result || result.length > maxLength) return null;
  return result;
}

function pathFromSpec(spec) {
  if (typeof spec === 'string') return spec;
  if (spec && typeof spec === 'object' && typeof spec.path === 'string') return spec.path;
  return null;
}

export function readPath(payload, spec) {
  const path = pathFromSpec(spec);
  if (!path) return undefined;
  return path.split('.').reduce((value, key) => {
    if (value === null || value === undefined || typeof value !== 'object') return undefined;
    return value[key];
  }, payload);
}

export function assertNoCardData(value, path = '$') {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoCardData(item, `${path}[${index}]`));
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (SENSITIVE_KEY.test(key)) {
      throw new Error(`B07_PAYLOAD_SENSIBLE:${path}.${key}`);
    }
    assertNoCardData(child, `${path}.${key}`);
  }
}

function requiredText(payload, spec, field) {
  const result = cleanText(readPath(payload, spec));
  if (!result) throw new Error(`B07_CAMPO_REQUERIDO:${field}`);
  return result;
}

export function normalizeProviderEvent({
  providerCode,
  providerAccountId,
  payload,
  normalizationConfig,
}) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('B07_PAYLOAD_JSON_INVALIDO');
  }
  assertNoCardData(payload);

  const safeProviderCode = cleanText(providerCode, 64)?.toUpperCase();
  const safeAccountId = cleanText(providerAccountId, 240);
  if (!safeProviderCode || !safeAccountId) throw new Error('B07_CUENTA_SERVIDOR_INVALIDA');

  const config = normalizationConfig && typeof normalizationConfig === 'object'
    ? normalizationConfig
    : {};
  const accountFromPayload = config.account_id ? requiredText(payload, config.account_id, 'account_id') : null;
  if (accountFromPayload && accountFromPayload !== safeAccountId) {
    throw new Error('B07_CUENTA_NO_COINCIDE');
  }

  const amountRaw = readPath(payload, config.amount);
  const amount = typeof amountRaw === 'number' ? amountRaw : Number(amountRaw);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1000000000000) {
    throw new Error('B07_IMPORTE_INVALIDO');
  }

  const currency = requiredText(payload, config.currency, 'currency').toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error('B07_MONEDA_INVALIDA');

  const eventType = cleanText(readPath(payload, config.event_type), 96)?.toUpperCase()
    || 'PAYMENT_STATUS_CHANGED';
  const occurredAt = cleanText(readPath(payload, config.occurred_at), 80);

  return {
    provider_code: safeProviderCode,
    provider_account_id: safeAccountId,
    provider_event_id: requiredText(payload, config.event_id, 'event_id'),
    provider_reference: requiredText(payload, config.reference, 'reference'),
    event_type: eventType,
    status: requiredText(payload, config.status, 'status').toUpperCase(),
    amount,
    currency,
    occurred_at: occurredAt,
    payload,
  };
}

export function signatureHeaderName(signatureConfig = {}) {
  const name = cleanText(signatureConfig.name || signatureConfig.header_name, 96);
  return name || 'x-signature';
}

export function constantTimeEqualText(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string') return false;
  const a = new TextEncoder().encode(left);
  const b = new TextEncoder().encode(right);
  let difference = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    difference |= (a[index] || 0) ^ (b[index] || 0);
  }
  return difference === 0;
}

export function encodeSignature(bytes, encoding = 'HEX') {
  const normalized = encoding.toUpperCase();
  if (normalized === 'HEX') {
    return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  }
  let base64 = btoa(String.fromCharCode(...bytes));
  if (normalized === 'BASE64URL') base64 = base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  return base64;
}
