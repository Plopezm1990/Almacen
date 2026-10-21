import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../../..');
const storageSource = await readFile(resolve(root, 'index-storage-bootstrap.js'), 'utf8');
const appSource = await readFile(resolve(root, 'fuente.js'), 'utf8');

function extractFunction(source, name) {
  const match = source.match(new RegExp(`(?:async\\s+)?function ${name}\\b`));
  assert.ok(match, `${name} must exist`);
  const start = match.index;
  const open = source.indexOf('{', start);
  let depth = 0;
  let quote = null;
  let escaped = false;
  for (let i = open; i < source.length; i += 1) {
    const ch = source[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch;
      continue;
    }
    if (ch === '{') depth += 1;
    if (ch === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`Could not extract ${name}`);
}

const storageHelpersStart = storageSource.indexOf('var CAMPOS_SINCRONIZACION_SOLO_LOCAL');
const storageHelpersEnd = storageSource.indexOf('  // Sube a la nube lo que ha cambiado', storageHelpersStart);
assert.ok(storageHelpersStart >= 0 && storageHelpersEnd > storageHelpersStart, 'storage canonical helpers must be present');
const storageHelpers = new Function(`${storageSource.slice(storageHelpersStart, storageHelpersEnd)}; return { contenidoFilaIgual, datosFilaParaServidor };`)();

const syncFunction = extractFunction(storageSource, 'sincronizarColeccionPorFila');
const storageSyncFactory = new Function('window', 'leerFilasCompletas', 'borradosDe', 'guardarBorrados',
  `${storageSource.slice(storageHelpersStart, storageHelpersEnd)}; return ${syncFunction};`);
const upsertCalls = [];
const fakeWindow = {
  __nubeCliente: {
    from() {
      return {
        async upsert(rows) {
          upsertCalls.push(rows);
          return rows[0].id === 'm-fail' ? { error: new Error('simulated row failure') } : { error: null };
        },
        delete() { return { in: async () => ({ error: null }) }; }
      };
    }
  }
};
const syncRows = storageSyncFactory(
  fakeWindow,
  async () => [{ id: 'm-same', datos: { id: 'm-same', a: 1 } }],
  () => [],
  () => {}
);
await assert.rejects(syncRows('movimientos_registro', [
  { id: 'm-same', a: 1, _pm07Servidor: true },
  { id: 'm-ok', a: 2 },
  { id: 'm-fail', a: 3 }
], 'movimientos'), /simulated row failure/);
assert.deepEqual(upsertCalls.map((rows) => rows.map((row) => row.id)), [['m-ok'], ['m-fail']],
  'one failed row must not prevent later rows from being attempted');

assert.equal(storageHelpers.contenidoFilaIgual(
  { id: 'm-1', fecha: '2026-10-21', b: 2, a: 1, _pm07Servidor: true },
  { a: 1, b: 2, fecha: '2026-10-21', id: 'm-1' }
), true, 'server markers and object key order must not create a resend');
assert.equal(storageHelpers.datosFilaParaServidor({ id: 'pm07-1', _pm07Servidor: true }, 'movimientos'), null,
  'authoritative PM07 movements must not be mirrored into legacy movements_registro');
assert.deepEqual(storageHelpers.datosFilaParaServidor({ id: 'm-2', _pm07Servidor: false, z: 2, a: 1 }, 'movimientos'),
  { a: 1, id: 'm-2', z: 2 }, 'local movement payload must be canonicalized before upload');

assert.match(storageSource, /upsert\(\[filasParaGuardar\[j\]\]\)/, 'row collections must upload one row at a time');
assert.doesNotMatch(storageSource, /upsert\(filasParaGuardar\)/, 'row collections must not use a batch upsert');
assert.match(storageSource, /window\.reintentarSincronizacion/, 'a denied local-only save must have a recovery path');
process.stdout.write('PASS AUD-009 canonical comparison, row isolation and recovery\n');

const albaranIncluido = new Function(`${extractFunction(appSource, 'albaranIncluidoEnFacturaDirectaPM11')}; return albaranIncluidoEnFacturaDirectaPM11;`)();
const facturaActiva = { id: 'fd-1', estado: 'ACTIVA', albaranesVinculados: [{ albaranId: 'alb-1' }] };
assert.equal(albaranIncluido({ id: 'alb-1' }, [facturaActiva]), true, 'linked albaran must be excluded from direct invoice totals');
assert.equal(albaranIncluido({ id: 'alb-2', facturaDirectaId: 'fd-1' }, [facturaActiva]), true, 'legacy direct link must be excluded');
assert.equal(albaranIncluido({ id: 'alb-3', facturaDirectaId: 'fd-anulada' }, [{ id: 'fd-anulada', estado: 'ANULADA' }]), false, 'anulled direct invoice must not hide the albaran');

const compras = [
  { id: 'alb-1', base: 68.91 },
];
const facturas = [{ ...facturaActiva, base: 68.91 }];
const baseUnica = compras.filter((a) => !albaranIncluido(a, facturas)).reduce((sum, a) => sum + a.base, 0)
  + facturas.reduce((sum, f) => sum + f.base, 0);
assert.equal(Number(baseUnica.toFixed(2)), 68.91, 'the linked albaran must not be added to the invoice again');
assert.equal(Number((baseUnica * 0.1).toFixed(2)), 6.89, '3T 2026 fixture must keep the expected VAT amount');
assert.match(appSource, /!albaranIncluidoEnFacturaDirectaPM11\(a22, facturasDirectas\)/g);
process.stdout.write('PASS AUD-003 linked albaran exclusion for view and Excel\n');
