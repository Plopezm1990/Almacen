/**
 * Contrato de H-35: el historial de ventas refleja los reembolsos económicos (B08).
 *
 *   node tests/rediseno/h35-historial-refleja-reembolsos-contract.mjs
 *   H35_FUENTE=/ruta/otra/fuente.js node tests/rediseno/h35-...   (para comprobar que el código anterior falla)
 *
 * Lo reembolsado por venta fiscal lo suma el servidor (`abc_reembolsos_por_venta`, con su propio contrato PGlite) porque el navegador no puede leer
 * `reembolso_aplicaciones`. Se ejecuta el código REAL de los dos ayudantes (lectura de la respuesta y etiqueta) y se fija el cableado en el historial, el ticket y el total vigente.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';

const raiz = path.resolve(fileURLToPath(new URL('../../', import.meta.url)));
const src = await readFile(process.env.H35_FUENTE || path.join(raiz, 'fuente.js'), 'utf8');
const espejo = await readFile(path.join(raiz, 'source-recovery/fuente-recuperado.js'), 'utf8');

let fallos = 0;
function check(nombre, ok, detalle = '') {
  if (!ok) fallos++;
  console.log(`${ok ? '[OK]  ' : '[FAIL]'} ${nombre}${detalle ? ' — ' + detalle : ''}`);
}

// ---------- A: los ayudantes ----------
const ini = src.indexOf('function reembolsoPorVentaDeRespuestaTpv(respuesta) {');
const fin = ini >= 0 ? src.indexOf('\nvar FILAS_REJILLA_TPV = 4;', ini) : -1;
check('A0 existen los ayudantes de reembolsos por venta', ini > 0 && fin > ini);
if (ini > 0 && fin > ini) {
  const fmt = (n) => (Number(n) || 0).toFixed(2).replace('.', ',');
  const { mapa, etiqueta } = new Function('fmt', `${src.slice(ini, fin)}\nreturn { mapa: reembolsoPorVentaDeRespuestaTpv, etiqueta: etiquetaReembolsoVentaTpv };`)(fmt);
  const m = mapa({ ok: true, ventas: { V1: 1.5, V2: '2.25', V3: 0, V4: -1, V5: 'x', '': 4 } });
  check('A1 toma de la respuesta del servidor lo devuelto por venta fiscal (acepta números y texto numérico)', m.V1 === 1.5 && m.V2 === 2.25, JSON.stringify(m));
  check('A2 descarta importes 0, negativos o no numéricos y claves vacías', !('V3' in m) && !('V4' in m) && !('V5' in m) && !('' in m) && Object.keys(m).length === 2);
  check('A3 una respuesta no válida (sin ok, con ok falso, nula o sin mapa) da un mapa vacío sin fallar', JSON.stringify(mapa(null)) === '{}' && JSON.stringify(mapa({ ok: false, ventas: { V1: 1 } })) === '{}' && JSON.stringify(mapa({ ok: true })) === '{}' && JSON.stringify(mapa(undefined)) === '{}');
  check('A4 la etiqueta dice «Reembolsada» si es total y «Reembolso parcial» si no, con el importe', etiqueta({ reembolsadoEconomico: 1, reembolsadaTotal: true }) === 'Reembolsada 1,00 \u20AC' && etiqueta({ reembolsadoEconomico: 0.5, reembolsadaTotal: false }) === 'Reembolso parcial 0,50 \u20AC');
  check('A5 sin reembolso no hay etiqueta', etiqueta({ reembolsadoEconomico: 0 }) === '' && etiqueta(null) === '' && etiqueta({}) === '');
}

// ---------- B: cableado (fuente.js y su espejo) ----------
for (const [nombre, t] of [['fuente.js', src], ['source-recovery/fuente-recuperado.js', espejo]]) {
  const tiene = (id, x) => check(`${id} [${nombre}]`, t.includes(x));
  tiene('B1 lee lo reembolsado por venta de la función de servidor, con su empresa y su local', 'supabase.rpc("abc_reembolsos_por_venta", { p_empresa_id: empresaId, p_local_id: localId })');
  check(`B2 no lee directamente reembolso_aplicaciones (el navegador no tiene permiso sobre esa tabla) [${nombre}]`, !/\.from\("reembolso_aplicaciones"\)/.test(t));
  tiene('B3 solo con la nube activa; no hace nada en modo local', 'if (!empresaId || !localId || typeof window === "undefined" || !window.__nubeActiva || typeof window.getSupabaseClient !== "function") return;');
  tiene('B4 no actualiza el estado si nada cambió (evita bucles de render, como en H-15)', 'if (vigente && firma !== reembolsosFirmaRef.current) {');
  tiene('B5 el historial toma lo reembolsado de la venta fiscal (o de la venta si es la misma)', 'const ventaFiscalRefReembolso = lineas.find((l22) => l22.ventaFiscalId)?.ventaFiscalId || ventaId;');
  tiene('B6 el historial se recalcula cuando llegan los reembolsos', '}, [movimientos, productos, reembolsosPorVentaTpv]);');
  tiene('B7 lo devuelto se descuenta del neto sin contar dos veces una devolución con el mismo dinero', 'importeOriginal - Math.max(importeAsociadoDevuelto, reembolsadoEconomico)');
  tiene('B8 el «Total vigente» sigue saliendo del neto (el contrato de PM09 lo fija) y las ventas reembolsadas del todo no cuentan en el ticket medio', '&& !v22.reembolsadaTotal);');
  tiene('B9 la lista de ventas marca la venta reembolsada', 'etiquetaReembolsoVentaTpv(v23) ? h3(Pill2, { color: C2.amber || C2.inkSoft }, etiquetaReembolsoVentaTpv(v23)) : null');
  tiene('B10 el detalle enseña el dinero devuelto y el neto aunque la venta siga ACTIVA', 'v22.reembolsadoEconomico > 0 ? h3("div", { className: "flex justify-between mt-1 text-[12px]", "data-venta-reembolso-economico": "1" }');
  tiene('B11 el neto de gestión también se muestra si hay reembolso', '(v22.estado !== "ACTIVA" || v22.reembolsadoEconomico > 0) ? h3("div", { className: "flex justify-between mt-1 text-[12px]" }, h3("span", null, "Neto de gesti');
  tiene('B12 el ticket lo dice', 'v22.reembolsadoEconomico > 0 ? h3("div", { className: "text-center text-[11px] font-bold rounded-lg py-2 mb-3", "data-ticket-reembolsada": "1"');
  tiene('B13 el memo usa el mapa con guarda (los harness que lo extraen no dependen de él)', 'typeof reembolsosPorVentaTpv !== "undefined" && reembolsosPorVentaTpv ?');
}

console.log(fallos === 0 ? 'H35_HISTORIAL_REEMBOLSOS_CONTRACT=PASS' : `H35_HISTORIAL_REEMBOLSOS_CONTRACT=FAIL (${fallos})`);
process.exitCode = fallos === 0 ? 0 : 1;
