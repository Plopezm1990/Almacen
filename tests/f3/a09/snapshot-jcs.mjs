import {createHash} from 'node:crypto';

export const SNAPSHOT_SCHEMA_VERSION = 'la-fiscal-snapshot-v1';
export const SNAPSHOT_CANONICALIZATION = 'RFC8785-JCS';
export const SNAPSHOT_HASH_ALGORITHM = 'SHA-256';

const DECIMAL_8 = /^(?:0|[1-9][0-9]*)\.[0-9]{8}$|^-(?:0\.(?!00000000)[0-9]{8}|[1-9][0-9]*\.[0-9]{8})$/;
const CENT_INTEGER = /^(?:0|[1-9][0-9]*|-[1-9][0-9]*)$/;

export function assertSnapshotAmount(value, scale) {
  const pattern = scale === 'DECIMAL_8' ? DECIMAL_8
    : scale === 'CENT_INTEGER' ? CENT_INTEGER : null;
  if (typeof value !== 'string' || !pattern?.test(value)) {
    throw new TypeError(`invalid ${scale} snapshot amount`);
  }
  return value;
}

function canonical(value) {
  if (value === null) return 'null';
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') throw new TypeError('JCS snapshot forbids JSON numbers');
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (typeof value === 'object') {
    const keys = Object.keys(value);
    if (keys.some((key) => !/^[\x20-\x7e]*$/.test(key))) {
      throw new TypeError('snapshot schema keys must be printable ASCII');
    }
    return `{${keys.sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  }
  throw new TypeError('unsupported JCS snapshot value');
}

export function canonicalSnapshotBytes(value) {
  return Buffer.from(canonical(value), 'utf8');
}

export function hashSnapshot(value) {
  return createHash('sha256').update(canonicalSnapshotBytes(value)).digest('hex');
}
