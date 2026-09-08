import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

// PM14 P08: historial de encargos cancelados/devueltos. Hasta este punto, un encargo
// cancelado o devuelto desaparecía por completo de la UI (encargosPendientes los excluye
// desde antes de PM14; "entregados" solo muestra estado === "Entregado"): quedaba en el
// documento y en encargos_empresa, pero nadie podía volver a verlo. historialEncargosPM14
// es la función pura (sin JSX, extraíble y testeable igual que el resto de PM14) que
// alimenta la nueva sección "Ver historial" del componente Encargos.

const src = fs.readFileSync('fuente.js', 'utf8');
const ini = src.indexOf('function historialEncargosPM14(');
assert.ok(ini >= 0, 'historialEncargosPM14 no encontrada en fuente.js');
const fin = src.indexOf('function crearLogicaEncargos(', ini);
assert.ok(fin > ini, 'no se pudo acotar historialEncargosPM14');

const ctx = { console };
vm.createContext(ctx);
vm.runInContext(src.slice(ini, fin), ctx);
const historialEncargosPM14 = ctx.historialEncargosPM14;
assert.equal(typeof historialEncargosPM14, 'function');

const base = {
  id: 'enc-1', clienteId: 'c1', numero: 'E-001', estado: 'Pendiente',
  lineas: [{ productoId: 'p1', descripcion: 'Tarta', cantidad: 2, precioUnitario: 10 }]
};

// ---- Positivo: cancelados y devueltos aparecen, con fecha/motivo mapeados desde los
// campos reales que escriben cancelarEncargo/devolverEncargo (fechaCancelacion/
// motivoCancelacion, fechaDevolucion/motivoDevolucion). ----
{
  const encargos = [
    { ...base, id: 'enc-pendiente', estado: 'Pendiente' },
    { ...base, id: 'enc-entregado', estado: 'Entregado', fechaEntregaReal: '2026-09-05' },
    { ...base, id: 'enc-cancelado', estado: 'Cancelado', fechaCancelacion: '2026-09-03', motivoCancelacion: 'Cliente cambió de opinión' },
    { ...base, id: 'enc-devuelto', estado: 'Devuelto', fechaDevolucion: '2026-09-06', motivoDevolucion: 'Producto defectuoso' }
  ];
  const historial = historialEncargosPM14(encargos);
  const ids = historial.map((e) => e.id).sort();
  assert.deepEqual(ids, ['enc-cancelado', 'enc-devuelto'], 'solo cancelados y devueltos entran en el historial');

  const cancelado = historial.find((e) => e.id === 'enc-cancelado');
  assert.equal(cancelado.fechaHistorial, '2026-09-03');
  assert.equal(cancelado.motivoHistorial, 'Cliente cambió de opinión');
  assert.equal(cancelado.total, 20, 'el total se recalcula desde las líneas cuando no hay total propio');

  const devuelto = historial.find((e) => e.id === 'enc-devuelto');
  assert.equal(devuelto.fechaHistorial, '2026-09-06');
  assert.equal(devuelto.motivoHistorial, 'Producto defectuoso');
  console.log('P08_HISTORIAL_POSITIVO=PASS');
}

// ---- Negativo: Pendiente y Entregado nunca aparecen, y un registro legado sin
// fecha/motivo (datos de antes de P04/P05) no revienta ni inventa datos. ----
{
  const encargos = [
    { ...base, id: 'a', estado: 'Pendiente' },
    { ...base, id: 'b', estado: 'Entregado' },
    { ...base, id: 'c', estado: 'Cancelado' }
  ];
  const historial = historialEncargosPM14(encargos);
  assert.equal(historial.length, 1);
  assert.equal(historial[0].id, 'c');
  assert.equal(historial[0].fechaHistorial, null, 'sin fecha propia, no se inventa una');
  assert.equal(historial[0].motivoHistorial, '', 'sin motivo propio, no se inventa uno');
  console.log('P08_HISTORIAL_NEGATIVO_LEGADO=PASS');
}

// ---- Orden determinista: más reciente primero, sin importar el orden de entrada. ----
{
  const encargos = [
    { ...base, id: 'viejo', estado: 'Cancelado', fechaCancelacion: '2026-01-01' },
    { ...base, id: 'nuevo', estado: 'Devuelto', fechaDevolucion: '2026-09-06' },
    { ...base, id: 'medio', estado: 'Cancelado', fechaCancelacion: '2026-05-01' }
  ];
  const historial = historialEncargosPM14(encargos);
  assert.deepEqual(historial.map((e) => e.id), ['nuevo', 'medio', 'viejo']);
  console.log('P08_HISTORIAL_ORDEN=PASS');
}

// ---- "Replay" (equivalente para una función pura de lectura): llamar dos veces con el
// mismo array de entrada da el mismo resultado y nunca muta el array/objetos originales
// -- una función de UI que mutara el estado de React por su cuenta sería un bug real. ----
{
  const encargos = [
    { ...base, id: 'enc-cancelado', estado: 'Cancelado', fechaCancelacion: '2026-09-03', motivoCancelacion: 'x' }
  ];
  const original = structuredClone(encargos);
  const r1 = historialEncargosPM14(encargos);
  const r2 = historialEncargosPM14(encargos);
  assert.deepEqual(r1.map((e) => e.id), r2.map((e) => e.id));
  assert.deepEqual(encargos, original, 'historialEncargosPM14 nunca debe mutar el array/objetos de entrada');
  console.log('P08_HISTORIAL_PURO_SIN_MUTACION=PASS');
}

console.log('PM14 P08 Encargos — historial de cancelados/devueltos: contrato OK');
