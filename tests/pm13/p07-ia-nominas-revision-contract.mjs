import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source = fs.readFileSync('fuente.js', 'utf8');
const ini = source.indexOf('function crearLogicaNominas({ nominas, setNominas, registrarAuditoria, empleados, localActivoId }) {');
const fin = source.indexOf('function crearLogicaEntrevistas', ini);
assert.ok(ini >= 0 && fin > ini, 'motor de nóminas no localizado');
const bloque = source.slice(ini, fin);

let seq = 0;
const ctx = {
  uid: () => `nom-${++seq}`,
  todayISO: () => '2026-09-08',
  console
};
vm.createContext(ctx);
vm.runInContext(`${bloque}\nthis.crearLogicaNominas = crearLogicaNominas;`, ctx);
const crear = ctx.crearLogicaNominas;

function motor(inicial = [], localActivoId = 'L1', empleados = [{ id: 'E1', localId: 'L1', nombre: 'Ana' }, { id: 'E2', localId: 'L2', nombre: 'Luis' }]) {
  let estado = inicial.map(x => ({ ...x }));
  const auditoria = [];
  const setNominas = updater => { estado = typeof updater === 'function' ? updater(estado) : updater; };
  const registrarAuditoria = (accion, detalle) => auditoria.push({ accion, detalle });
  const api = crear({ nominas: inicial, setNominas, registrarAuditoria, empleados, localActivoId });
  return { api, get estado() { return estado; }, auditoria };
}

// 1) Una propuesta de IA no puede persistirse sin revisión humana explícita.
{
  const t = motor();
  const r = t.api.addNomina({ empleadoId: 'E1', mes: '2026-08', brutoTotal: 1500, seguridadSocialEmpresa: 480, origen: 'IA' });
  assert.equal(r.ok, false);
  assert.match(r.error, /revisión humana/i);
  assert.equal(t.estado.length, 0);
  assert.equal(t.auditoria.length, 0);
}

// 2) Tras confirmación humana se registra con procedencia y estado inequívocos.
{
  const t = motor();
  const r = t.api.addNomina({ empleadoId: 'E1', mes: '2026-08', brutoTotal: '1500', seguridadSocialEmpresa: '480', origen: 'IA', revisionHumanaConfirmada: true, notas: 'Revisada contra original' });
  assert.equal(r.ok, true);
  assert.equal(t.estado.length, 1);
  const n = t.estado[0];
  assert.equal(n.origen, 'IA');
  assert.equal(n.estado, 'APROBADA_HUMANO');
  assert.equal(n.revisionHumanaConfirmada, true);
  assert.equal(n.fechaRevisionHumana, '2026-09-08');
  assert.equal(n.costeTotalEmpresa, 1980);
  assert.equal(t.auditoria.length, 1);
  assert.match(t.auditoria[0].accion, /IA/i);
  assert.match(t.auditoria[0].detalle, /revisión humana confirmada/i);
}

// 3) Entrada manual queda diferenciada y no se hace pasar por revisión IA.
{
  const t = motor();
  const r = t.api.addNomina({ empleadoId: 'E1', mes: '2026-07', brutoTotal: 1400, seguridadSocialEmpresa: 450 });
  assert.equal(r.ok, true);
  assert.equal(t.estado[0].origen, 'MANUAL');
  assert.equal(t.estado[0].estado, 'REGISTRADA_MANUAL');
  assert.equal(t.estado[0].revisionHumanaConfirmada, null);
}

// 4) No se sustituye silenciosamente una nómina existente del mismo empleado/mes.
{
  const existente = { id: 'N0', empleadoId: 'E1', mes: '2026-08', brutoTotal: 1000, seguridadSocialEmpresa: 300, costeTotalEmpresa: 1300, localId: 'L1', estado: 'REGISTRADA_MANUAL', origen: 'MANUAL' };
  const t = motor([existente]);
  const r = t.api.addNomina({ empleadoId: 'E1', mes: '2026-08', brutoTotal: 9999, seguridadSocialEmpresa: 1 });
  assert.equal(r.ok, false);
  assert.equal(t.estado.length, 1);
  assert.equal(t.estado[0].brutoTotal, 1000);
}

// 5) Doble clic/replay inmediato no crea dos registros ni dos auditorías.
{
  const t = motor();
  const datos = { empleadoId: 'E1', mes: '2026-06', brutoTotal: 1200, seguridadSocialEmpresa: 400 };
  const r1 = t.api.addNomina(datos);
  const r2 = t.api.addNomina(datos);
  assert.equal(r1.ok, true);
  assert.equal(r2.ok, true);
  assert.equal(r2.replayed, true);
  assert.equal(t.estado.length, 1);
  assert.equal(t.auditoria.length, 1);
}

// 6) Aislamiento por local y validación numérica/temporal.
{
  let t = motor();
  assert.equal(t.api.addNomina({ empleadoId: 'E2', mes: '2026-08', brutoTotal: 1000, seguridadSocialEmpresa: 300 }).ok, false);
  t = motor();
  assert.equal(t.api.addNomina({ empleadoId: 'E1', mes: '2026-13', brutoTotal: 1000, seguridadSocialEmpresa: 300 }).ok, false);
  t = motor();
  assert.equal(t.api.addNomina({ empleadoId: 'E1', mes: '2026-08', brutoTotal: 0, seguridadSocialEmpresa: 300 }).ok, false);
  t = motor();
  assert.equal(t.api.addNomina({ empleadoId: 'E1', mes: '2026-08', brutoTotal: 1000, seguridadSocialEmpresa: -1 }).ok, false);
}

// 7) Una nómina IA ya aprobada es inmutable.
{
  const ia = { id: 'IA1', empleadoId: 'E1', mes: '2026-05', brutoTotal: 1500, seguridadSocialEmpresa: 480, costeTotalEmpresa: 1980, localId: 'L1', origen: 'IA', estado: 'APROBADA_HUMANO', revisionHumanaConfirmada: true };
  const t = motor([ia]);
  const r = t.api.updateNomina('IA1', { empleadoId: 'E1', mes: '2026-05', brutoTotal: 1600, seguridadSocialEmpresa: 480 });
  assert.equal(r.ok, false);
  assert.match(r.error, /inmutable/i);
  assert.equal(t.estado[0].brutoTotal, 1500);
}

// 8) Edición manual es trazable y replay sin cambios no vuelve a auditar.
{
  const manual = { id: 'M1', empleadoId: 'E1', mes: '2026-04', brutoTotal: 1200, seguridadSocialEmpresa: 400, costeTotalEmpresa: 1600, localId: 'L1', origen: 'MANUAL', estado: 'REGISTRADA_MANUAL', notas: '' };
  let t = motor([manual]);
  let r = t.api.updateNomina('M1', { empleadoId: 'E1', mes: '2026-04', brutoTotal: 1250, seguridadSocialEmpresa: 410, notas: 'corregida' });
  assert.equal(r.ok, true);
  assert.equal(t.estado[0].costeTotalEmpresa, 1660);
  assert.equal(t.auditoria.length, 1);

  const actualizado = t.estado[0];
  t = motor([actualizado]);
  r = t.api.updateNomina('M1', { empleadoId: 'E1', mes: '2026-04', brutoTotal: 1250, seguridadSocialEmpresa: 410, notas: 'corregida' });
  assert.equal(r.ok, true);
  assert.equal(r.yaSinCambios, true);
  assert.equal(t.auditoria.length, 0);
}

// 9) Anular preserva el registro y es idempotente; nunca borra físicamente.
{
  const n = { id: 'N1', empleadoId: 'E1', mes: '2026-03', brutoTotal: 1000, seguridadSocialEmpresa: 320, costeTotalEmpresa: 1320, localId: 'L1', origen: 'MANUAL', estado: 'REGISTRADA_MANUAL' };
  const t = motor([n]);
  const r1 = t.api.deleteNomina('N1');
  const r2 = t.api.deleteNomina('N1');
  assert.equal(r1.ok, true);
  assert.equal(r2.replayed, true);
  assert.equal(t.estado.length, 1);
  assert.equal(t.estado[0].estado, 'ANULADA');
  assert.equal(t.estado[0].fechaAnulacion, '2026-09-08');
  assert.equal(t.auditoria.length, 1);
  assert.ok(!/\.filter\(\(x3\) => x3\.id !== id\)/.test(bloque));
}

// 10) Barreras UI: IA es propuesta, confirmación explícita, fail-closed, costes sin anuladas.
assert.ok(source.includes('PM13 P07: propuesta IA. Revisa empleado, mes, bruto y Seguridad Social.'));
assert.ok(source.includes('origen: "IA",\n        revisionHumanaConfirmada: false'));
assert.ok(source.includes('window.confirm("Revisión humana obligatoria:'));
assert.ok(source.includes('datosGuardarPM13 = { ...form, revisionHumanaConfirmada: true }'));
assert.ok(source.includes('resultadoNominaPM13.ok === false'));
assert.ok(source.includes('const nominasValidasDelMesPM13 = nominasDelMes.filter((n2) => n2.estado !== "ANULADA")'));
assert.ok(source.includes('disabled: n2.origen === "IA" || n2.estado === "ANULADA"'));
assert.ok(source.includes('n2.estado === "ANULADA" ? " Anulada" : " Anular"'));
assert.ok(!bloque.includes('const sinEsteMes ='));

console.log('PM13_P07_IA_NOMINAS_REVISION=PASS');
console.log('IA_NO_PERSISTE_SIN_REVISION=1');
console.log('ORIGEN_Y_ESTADO_EXPLICITOS=1');
console.log('DUPLICADO_NO_SUSTITUYE=1');
console.log('IA_APROBADA_INMUTABLE=1');
console.log('ANULACION_SIN_BORRADO=1');
console.log('DOBLE_CLIC_IDEMPOTENTE=1');
console.log('COSTES_EXCLUYEN_ANULADAS=1');
