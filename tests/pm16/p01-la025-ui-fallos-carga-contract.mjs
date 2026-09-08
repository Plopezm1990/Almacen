import fs from 'node:fs';
import assert from 'node:assert/strict';

// PM16 P01 (LA-025): el evento `fallo-carga` que dispara loadKey() no sirve de nada si
// nadie lo escucha y lo muestra -- "fallo real visible" es el propio requisito del punto.
// Este contrato comprueba, por inspección estática del código real, que el evento está
// conectado de punta a punta: se escucha, se guarda en estado, se muestra en un banner
// sticky (mismo patrón ya usado y probado para fallo-guardado) y aparece en el resumen del
// Dashboard -- nunca se queda solo en un console.error invisible para el usuario real.

const src = fs.readFileSync('fuente.js', 'utf8');

// ---- El listener existe y guarda motivo, key y mensaje reales del evento (no valores
// inventados). ----
{
  const ini = src.indexOf('const [fallosCarga, setFallosCarga] = (0, import_react4.useState)([]);');
  assert.ok(ini >= 0, 'estado fallosCarga no encontrado');
  const fin = src.indexOf('}, []);', ini) + '}, []);'.length;
  const bloque = src.slice(ini, fin);
  assert.match(bloque, /window\.addEventListener\("fallo-carga", onFalloCarga\)/);
  assert.match(bloque, /e2\.detail\.key/);
  assert.match(bloque, /e2\.detail\.motivo \|\| "acceso"/);
  assert.match(bloque, /e2\.detail\.mensaje \|\| ""/);
  console.log('P01_LA025_LISTENER_FALLO_CARGA_CONECTADO=PASS');
}

// ---- El banner sticky se muestra cuando hay fallos de carga, con el motivo real (no un
// texto genérico que oculte si fue corrupción, cuota o acceso). ----
{
  const ini = src.indexOf('fallosCarga.length > 0 && /* @__PURE__ */ import_react4.default.createElement(');
  assert.ok(ini >= 0, 'banner de fallosCarga no encontrado');
  const fin = src.indexOf('), /* @__PURE__ */ import_react4.default.createElement("style"', ini);
  const bloque = src.slice(ini, fin);
  assert.match(bloque, /No se ha sobrescrito nada/, 'debe tranquilizar: no se pisan datos por un fallo de carga');
  assert.match(bloque, /corrupcion/, 'debe distinguir el motivo corrupción en el texto');
  assert.match(bloque, /cuota/, 'debe distinguir el motivo cuota en el texto');
  assert.match(bloque, /setFallosCarga\(\[\]\)/, 'debe poder descartarse, igual que el banner de guardado');
  console.log('P01_LA025_BANNER_MUESTRA_MOTIVO_REAL=PASS');
}

// ---- El Dashboard recibe fallosCarga real desde la composición (no un valor fijo) y lo
// muestra en un tile de resumen propio, separado del de fallos de guardado. ----
{
  assert.match(src, /^\s*fallosGuardado,\s*\n\s*fallosCarga,/m, 'la composición debe pasar fallosCarga junto a fallosGuardado, no solo uno de los dos');
  assert.match(src, /fallosGuardado = \[\], fallosCarga = \[\], diagnosticoStock/, 'Dashboard debe declarar la prop fallosCarga');
  const ini = src.indexOf('id: "fallos_carga"');
  assert.ok(ini >= 0, 'tile fallos_carga no encontrado en el Dashboard');
  const fin = src.indexOf('},\n    {', ini);
  const tile = src.slice(ini, fin);
  assert.match(tile, /valor: fallosCarga\.length/);
  assert.match(tile, /tab: "respaldos"/, 'debe enlazar a Respaldos, coherente con el mensaje del banner');
  console.log('P01_LA025_DASHBOARD_TILE_PROPIO_Y_CONECTADO=PASS');
}

console.log('PM16 P01 (LA-025) — fallo real de carga visible de punta a punta: contrato OK');
