import assert from 'node:assert/strict';
import fs from 'node:fs';

const decision = fs.readFileSync('docs/plan-maestro/PM03_CONTRATOS_MINIMOS_PROPUESTA.md', 'utf8');
const source = fs.readFileSync('fuente.js', 'utf8');
const recoveredSource = fs.readFileSync('source-recovery/fuente-recuperado.js', 'utf8');
const contract = fs.readFileSync('docs/plan-abc/F4_B11_CONTRATO_TECNICO_2026-10-01.md', 'utf8');
const contingency = fs.readFileSync('docs/plan-abc/F4_B11_CONTINGENCIA_TERMINAL_OFFLINE_2026-10-01.md', 'utf8');

function functionBlock(text, name) {
  const matches = [...text.matchAll(new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\(`, 'g'))];
  assert.equal(matches.length, 1, `${name} debe existir exactamente una vez`);
  const start = matches[0].index;
  const parametersStart = text.indexOf('(', start);
  let parametersDepth = 0;
  let parametersEnd = -1;
  for (let i = parametersStart; i < text.length; i += 1) {
    if (text[i] === '(') parametersDepth += 1;
    if (text[i] === ')' && --parametersDepth === 0) {
      parametersEnd = i;
      break;
    }
  }
  assert.notEqual(parametersEnd, -1, `${name} no tiene cierre de parámetros`);
  const open = text.indexOf('{', parametersEnd);
  let depth = 0;
  let quote = null;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;
  for (let i = open; i < text.length; i += 1) {
    const current = text[i];
    const next = text[i + 1] || '';
    if (lineComment) {
      if (current === '\n') lineComment = false;
      continue;
    }
    if (blockComment) {
      if (current === '*' && next === '/') {
        blockComment = false;
        i += 1;
      }
      continue;
    }
    if (quote) {
      if (escaped) escaped = false;
      else if (current === '\\') escaped = true;
      else if (current === quote) quote = null;
      continue;
    }
    if (current === '/' && next === '/') {
      lineComment = true;
      i += 1;
      continue;
    }
    if (current === '/' && next === '*') {
      blockComment = true;
      i += 1;
      continue;
    }
    if (current === '"' || current === "'" || current === '`') {
      quote = current;
      continue;
    }
    if (current === '{') depth += 1;
    if (current === '}' && --depth === 0) return text.slice(start, i + 1);
  }
  assert.fail(`${name} no tiene cierre`);
}

const primarySale = functionBlock(source, 'venderCarritoA02');
const legacySale = functionBlock(source, 'venderCarrito');
const localSale = functionBlock(source, 'venderLineas');

assert.match(decision, /Sin conexión confirmable se pueden consultar datos locales y preparar borradores, pero no se confirman mutaciones críticas/i);
assert.match(decision, /Se bloquean en modo sincronizado las mutaciones críticas.*venta\/stock, recepción, pago, devolución\/reembolso, traspaso y cierre\/arqueo/i);
assert.match(source, /function claveBorradorTpvA06\(/);
assert.match(source, /estado: "BORRADOR_LOCAL"/);
assert.match(source, /Borrador local activo/);
assert.match(source, /No se puede acceder al borrador local del TPV/);
assert.match(recoveredSource, /estado: "BORRADOR_LOCAL"/);
assert.match(source, /VentaRapida, \{ productos: productosDelLocalActivo, venderCarrito: venderCarritoA02,/);
assert.match(primarySale, /const hayConexion = typeof window !== "undefined" && window\.__nubeActiva && typeof window\.getSupabaseClient === "function"/);
assert.match(primarySale, /requiere conexi(?:ó|\\xF3)n con el servidor/);
assert.match(primarySale, /No se ha registrado nada localmente/);
assert.doesNotMatch(primarySale, /venderLocal\(/);
assert.match(legacySale, /No se ha descontado stock localmente/);
assert.match(localSale, /permitirDeficit: false/);
assert.match(contract, /no activa pagos offline/i);
assert.match(contract, /no se finge\s+una confirmación bancaria/i);
for (const required of [
  'OFFLINE_DECLARADO',
  'PENDIENTE_CONCILIACION',
  'CONFIRMADO',
  'RECHAZADO',
  'INCIDENCIA',
  'límite máximo por operación',
  'contracargo',
]) assert.match(contingency, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
assert.match(contingency, /No se activa ningún\s+camino offline/i);

console.log('ABC_F4_B11_OFFLINE_BOUNDARY=PASS');
