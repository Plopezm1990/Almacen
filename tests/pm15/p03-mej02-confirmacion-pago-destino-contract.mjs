import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

// PM15 P03 (MEJ-02): "Pago confirmado con importe y destino; corrección mediante reverso
// trazable, no borrado silencioso."
//
// La parte de "reverso trazable, no borrado silencioso" ya está resuelta desde PM06/PM14:
// marcarPagada/marcarPagadaFacturaDirecta usan registrarPagoPM06/revertirUltimoPagoPM06
// (ledger real, nunca borrado físico) -- no se toca aquí.
//
// La parte de "importe y destino" tenía un hueco real: la confirmación de "marcar factura
// como pagada" usaba `window.prompt("Importe a pagar (máximo €X)", ...)` -- solo mostraba
// el importe, nunca el destino (a qué proveedor/factura se está pagando). Con varias
// facturas pendientes en pantalla, un clic en la fila equivocada confirmaría un pago sin
// que el propio diálogo dijera a quién.
//
// Arreglo: mensajeConfirmacionPagoPM15(factura, pendiente) construye el texto del prompt
// incluyendo el proveedor y el documento (factura/concepto), reutilizando exactamente los
// mismos campos que ya se muestran en la fila de la lista (f22.proveedor.nombre,
// f22.numeroFactura, f22.concepto, f22.origen) -- no se inventa ningún dato nuevo.

const src = fs.readFileSync('fuente.js', 'utf8');
const ini = src.indexOf('function mensajeConfirmacionPagoPM15(');
assert.ok(ini >= 0, 'mensajeConfirmacionPagoPM15 no encontrada');
const fin = src.indexOf('function CuentasPorPagar(', ini);
assert.ok(fin > ini, 'no se pudo acotar mensajeConfirmacionPagoPM15');

const ctx = {};
vm.createContext(ctx);
vm.runInContext(src.slice(ini, fin), ctx);
const mensajeConfirmacionPagoPM15 = ctx.mensajeConfirmacionPagoPM15;
assert.equal(typeof mensajeConfirmacionPagoPM15, 'function');

// ---- Positivo: factura de mercancía con proveedor y número -- destino inequívoco. ----
{
  const factura = { origen: 'mercancia', proveedor: { nombre: 'Harinas del Sur' }, numeroFactura: 'F-2026-004', concepto: 'Harina y azúcar' };
  const msg = mensajeConfirmacionPagoPM15(factura, 245.5);
  assert.match(msg, /Harinas del Sur/, 'debe nombrar al proveedor');
  assert.match(msg, /Factura F-2026-004/, 'debe nombrar el documento');
  assert.match(msg, /245\.50/, 'debe mostrar el importe máximo');
  console.log('P03_MEJ02_MERCANCIA_CON_PROVEEDOR_Y_NUMERO=PASS');
}

// ---- Positivo: factura directa (gasto) sin proveedor -- usa el concepto como documento. ----
{
  const factura = { origen: 'directa', proveedor: null, numeroFactura: '', concepto: 'Electricidad julio' };
  const msg = mensajeConfirmacionPagoPM15(factura, 89.9);
  assert.match(msg, /Sin proveedor/);
  assert.match(msg, /Electricidad julio/, 'sin número de factura, debe usar el concepto como destino');
  console.log('P03_MEJ02_DIRECTA_SIN_PROVEEDOR_USA_CONCEPTO=PASS');
}

// ---- Negativo/edge: mercancía con proveedor eliminado -- nunca debe fingir un nombre. ----
{
  const factura = { origen: 'mercancia', proveedor: null, numeroFactura: 'F-2026-009', concepto: 'Verdura' };
  const msg = mensajeConfirmacionPagoPM15(factura, 12);
  assert.match(msg, /Proveedor eliminado/, 'no debe decir "Sin proveedor" para mercancía con proveedor real pero borrado');
  console.log('P03_MEJ02_MERCANCIA_PROVEEDOR_ELIMINADO_NO_FINGE_NOMBRE=PASS');
}

// ---- Prueba de conexión real: la confirmación de pago usa esta función, no un texto
// genérico sin destino. ----
//
// El 16/11/2026 esa confirmación dejó de ser un window.prompt del navegador. El destino
// -que es lo que este contrato defiende- se sigue mostrando, con la misma función; lo que
// cambia es que ahora cabe dentro de una pantalla del programa. El motivo del cambio es
// otro hueco del prompt, que este contrato no podía cubrir: el aviso de importe inválido
// salía DESPUÉS de cerrarse el diálogo, cuando ya no se podía corregir y había que empezar
// de nuevo; y donde el navegador no permite prompt, devuelve null y el pago no se
// registraba sin decir por qué. Así que aquí se fija también que el error vive dentro.
{
  assert.doesNotMatch(src, /window\.prompt\(/, 'la confirmación de pago no puede volver a ser un prompt del navegador');

  const ini2 = src.indexOf('pagoPM15 ? h(Modal, { title: "Registrar pago"');
  assert.ok(ini2 >= 0, 'no se encontró el diálogo de registrar pago');
  const dialogo = src.slice(ini2, src.indexOf(') : null,', ini2));

  assert.match(dialogo, /mensajeConfirmacionPagoPM15\(pagoPM15\.factura, pagoPM15\.pendiente\)/,
    'el diálogo debe decir a quién se paga, con la misma función de siempre');
  assert.match(dialogo, /errorPagoPM15 \? h\("div", \{ className: "text-\[12px\] mb-2", role: "alert"/,
    'el aviso de importe inválido tiene que salir DENTRO del diálogo, no después de cerrarlo');
  assert.match(dialogo, /value: pagoPM15\.importe/, 'el importe se edita dentro del diálogo');

  // Y el saldo pendiente sigue siendo el valor de partida y el techo.
  assert.match(src, /setPagoPM15\(\{ factura: f22, pendiente: redondearDineroPM06\(f22\.pendiente \?\? f22\.total\), importe: redondearDineroPM06\(f22\.pendiente \?\? f22\.total\)\.toFixed\(2\) \}\)/,
    'el diálogo abre con el saldo pendiente puesto');
  assert.match(src, /if \(!\(importe > 0\) \|\| importe > pagoPM15\.pendiente \+ 1e-3\)/,
    'no se puede pagar cero, ni mas que el saldo pendiente');
  console.log('P03_MEJ02_CONFIRMACION_REAL_USA_MENSAJE_CON_DESTINO=PASS');
}

console.log('PM15 P03 (MEJ-02) — confirmación de pago con importe y destino: contrato OK');
