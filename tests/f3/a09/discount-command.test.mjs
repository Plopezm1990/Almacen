import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { DiscountCommandReference } from './discount-command.mjs';

const state = (overrides = {}) => ({
  accountVersion: 1,
  members: { owner: 'Propietario', manager: 'Encargado', cashier: 'Cajero/a' },
  repartos: [{
    id: 'r-a', accountId: 'account-a', sourceLineId: 'line-1',
    base: '10', discount: '0', tax: '1', total: '11', taxPct: '10',
  }],
  fiscalizedSourceLineIds: [],
  ...overrides,
});

const request = (overrides = {}) => ({
  operationId: 'a09-test-0001', accountId: 'account-a', expectedVersion: 1,
  kind: 'AMOUNT', value: '2', reason: 'Atención al cliente', ...overrides,
});

test('límite de Encargado: 20 % acumulado, incluso en una segunda operación', async () => {
  const engine = new DiscountCommandReference(state());
  await engine.execute(request(), 'manager');
  await assert.rejects(engine.execute(request({
    operationId: 'a09-test-0002', expectedVersion: 2, value: '0.00000001',
  }), 'manager'), /cumulative_discount_limit_exceeded/);
  assert.equal(engine.state.accountVersion, 2);
  assert.equal(engine.audit.length, 1);
});

test('A09.2.2 apila porcentaje e importe sobre la base restante', async () => {
  const engine = new DiscountCommandReference(state());
  const first = await engine.execute(request({
    operationId: 'a09-stack-01', kind: 'PERCENT', value: '10', expectedVersion: 1,
  }), 'owner');
  const second = await engine.execute(request({
    operationId: 'a09-stack-02', kind: 'AMOUNT', value: '2', expectedVersion: 2,
  }), 'owner');

  assert.equal(first.discount, '1');
  assert.equal(second.discount, '2');
  assert.equal(engine.state.repartos[0].discount, '3');
  assert.equal(engine.state.repartos[0].base, '7');
  assert.deepEqual(engine.audit.map((entry) => entry.kind), ['PERCENT', 'AMOUNT']);
});

test('Propietario puede dar cortesía; Encargado, Caja y ajenos no', async () => {
  const owner = new DiscountCommandReference(state());
  const result = await owner.execute(request({ kind: 'COURTESY', value: undefined }), 'owner');
  assert.equal(result.total, '0');
  assert.equal(owner.audit[0].authorizerId, 'owner');
  for (const actor of ['manager', 'cashier', 'outside']) {
    const engine = new DiscountCommandReference(state());
    await assert.rejects(engine.execute(request({ kind: 'COURTESY', value: undefined }), actor),
      /courtesy_capability_denied|discount_capability_denied|local_membership_required/);
  }
});

test('política específica de usuario puede ampliar capacidad, pero deja rastro', async () => {
  const engine = new DiscountCommandReference(state({ userLimits: { cashier: '10' } }));
  const result = await engine.execute(request({ value: '1' }), 'cashier');
  assert.equal(result.discount, '1');
  assert.equal(engine.audit[0].requesterId, 'cashier');
  assert.equal(engine.audit[0].reason, 'Atención al cliente');
});

test('100 % por importe o porcentaje no elude la capacidad de cortesía', async () => {
  const engine = new DiscountCommandReference(state({ userLimits: { cashier: '100' } }));
  await assert.rejects(engine.execute(request({ value: '10' }), 'cashier'), /courtesy_required/);
  await assert.rejects(engine.execute(request({ kind: 'PERCENT', value: '100' }), 'cashier'), /courtesy_required/);
  assert.equal(engine.audit.length, 0);
});

test('el modelo de una llamada valida el motivo y falla cerrado para doble autorización', async () => {
  const engine = new DiscountCommandReference(state());
  await assert.rejects(engine.execute(request({ reason: '  ' }), 'owner'), /reason_required/);
  assert.equal(engine.audit.length, 0);
  const guarded = new DiscountCommandReference(state({ requireDualApproval: true }));
  await assert.rejects(guarded.execute(request(), 'owner'), /dual_approval_requires_postgres_contract/);
  assert.equal(guarded.state.accountVersion, 1);
});

test('reintento idéntico devuelve el resultado original sin segundo asiento', async () => {
  const engine = new DiscountCommandReference(state());
  const first = await engine.execute(request(), 'manager');
  const second = await engine.execute(request(), 'manager');
  assert.equal(first.replayed, false);
  assert.deepEqual(second, { ...first, replayed: true });
  assert.equal(engine.state.accountVersion, 2);
  assert.equal(engine.audit.length, 1);
  await assert.rejects(engine.execute(request({ value: '1' }), 'manager'), /operation_id_conflict/);
  delete engine.state.members.manager;
  await assert.rejects(engine.execute(request(), 'manager'), /local_membership_required/);
});

test('dos descuentos concurrentes con la misma versión: uno se aplica y otro falla', async () => {
  const engine = new DiscountCommandReference(state());
  const outcomes = await Promise.allSettled([
    engine.execute(request({ operationId: 'a09-test-0001', value: '1' }), 'owner'),
    engine.execute(request({ operationId: 'a09-test-0002', value: '1' }), 'owner'),
  ]);
  assert.deepEqual(outcomes.map((outcome) => outcome.status), ['fulfilled', 'rejected']);
  assert.match(outcomes[1].reason.message, /account_version_conflict/);
  assert.equal(engine.state.repartos[0].discount, '1');
  assert.equal(engine.audit.length, 1);
});

test('dos reintentos concurrentes del mismo operation_id producen un único efecto', async () => {
  const engine = new DiscountCommandReference(state());
  const outcomes = await Promise.all([
    engine.execute(request(), 'manager'),
    engine.execute(request(), 'manager'),
  ]);
  assert.deepEqual(outcomes.map((outcome) => outcome.replayed), [false, true]);
  assert.equal(engine.audit.length, 1);
});


test('UI A09 configura roles operativos y deja de depender de dos roles fijos', async () => {
  const source = await readFile(new URL('../../../source-recovery/fuente-recuperado.js', import.meta.url), 'utf8');
  assert.match(source, /"Cajero\/a": crearPoliticaVacia\("Cajero\/a"\)/);
  assert.match(source, /"Camarero\/a": crearPoliticaVacia\("Camarero\/a"\)/);
  assert.match(source, /"Churrero\/a": crearPoliticaVacia\("Churrero\/a"\)/);
  assert.match(source, /"Básico": crearPoliticaVacia\("Básico"\)/);
  assert.match(source, /const rolesConfigurados = Object\.keys\(form\)/);
  assert.match(source, /const anadirRol = \(\) =>/);
  assert.match(source, /no crea ni amplía permisos generales de acceso/);
  assert.doesNotMatch(source, /for \(const rol of \["Propietario", "Encargado"\]\)/);
});


test('A09.1.7 integra descuento/cortesía y doble autorización en el TPV sin DML directo', async () => {
  const source = await readFile(new URL('../../../source-recovery/fuente-recuperado.js', import.meta.url), 'utf8');

  assert.match(source, /async function aplicarDescuentoCuentaA09\(/);
  assert.match(source, /async function listarAutorizacionesDescuentoA09\(/);
  assert.match(source, /async function resolverAutorizacionDescuentoA09\(/);
  assert.match(source, /supabase\.rpc\("abc_aplicar_descuento_cuenta"/);
  assert.match(source, /supabase\.rpc\("abc_aprobar_descuento_cuenta"/);
  assert.match(source, /\.from\("abc_descuento_autorizaciones"\)[\s\S]*?\.select\(/);
  assert.match(source, /"a09\.1\.7\.descuento:" \+ await hashHexA09\(seed\)/);
  assert.match(source, /PENDIENTE_AUTORIZACION/);
  assert.match(source, /solicitudDesdeAutorizacionA09\(row\)/);
  assert.match(source, /row\.estado === "APROBADA"/);
  assert.match(source, /La misma persona que solicitó el descuento no puede aprobarlo/);
  assert.match(source, /function renderDescuentoCuentaA09\(\)/);
  assert.match(source, /value: "PERCENT"/);
  assert.match(source, /value: "AMOUNT"/);
  assert.match(source, /value: "COURTESY"/);

  assert.doesNotMatch(source, /\.from\("abc_descuento_autorizaciones"\)\s*\.insert/);
  assert.doesNotMatch(source, /\.from\("abc_descuento_autorizaciones"\)\s*\.update/);
  assert.doesNotMatch(source, /\.from\("abc_descuentos_aplicados"\)\s*\.insert/);
  assert.doesNotMatch(source, /\.from\("abc_descuentos_aplicados"\)\s*\.update/);
});

test('A09.2.1 traduce la denegación autoritativa de cortesía', async () => {
  const source = await readFile(new URL('../../../source-recovery/fuente-recuperado.js', import.meta.url), 'utf8');

  assert.match(source, /msg\.includes\("cortesia_no_autorizada"\).*La política de descuentos de este local no permite aplicar cortesías/);
  assert.doesNotMatch(source, /msg\.includes\("cortesia_no_autorizada"\).*No tienes permiso para operar este TPV/);
});

test('A09.2.2 muestra el stack aplicado separado de las autorizaciones', async () => {
  const source = await readFile(new URL('../../../source-recovery/fuente-recuperado.js', import.meta.url), 'utf8');
  const runtime = await readFile(new URL('../../../fuente.js', import.meta.url), 'utf8');

  assert.match(source, /async function listarDescuentosAplicadosA09\(/);
  assert.match(source, /\.from\("abc_descuentos_aplicados"\)[\s\S]*?\.select\(/);
  assert.match(source, /function agruparDescuentosAplicadosA09\(/);
  assert.match(source, /Stack aplicado/);
  assert.match(source, /Cada operación se aplica sobre la base restante/);
  assert.doesNotMatch(source, /\.from\("abc_descuentos_aplicados"\)\s*\.insert/);
  assert.doesNotMatch(source, /\.from\("abc_descuentos_aplicados"\)\s*\.update/);
  assert.match(runtime, /async function listarDescuentosAplicadosA09\(/);
  assert.match(runtime, /\.from\("abc_descuentos_aplicados"\)[\s\S]*?\.select\(/);
  assert.match(runtime, /Stack aplicado/);
  assert.match(runtime, /Cada operación se aplica sobre la base restante/);
  assert.doesNotMatch(runtime, /\.from\("abc_descuentos_aplicados"\)\s*\.insert/);
  assert.doesNotMatch(runtime, /\.from\("abc_descuentos_aplicados"\)\s*\.update/);
});

test('A09.2.4 identifica la doble autorización exigida por la política', async () => {
  const source = await readFile(new URL('../../../source-recovery/fuente-recuperado.js', import.meta.url), 'utf8');
  const runtime = await readFile(new URL('../../../fuente.js', import.meta.url), 'utf8');

  for (const candidate of [source, runtime]) {
    assert.match(candidate, /requiereDobleAprobacion/);
    assert.match(candidate, /Solicitud de doble autorización pendiente/);
    assert.match(candidate, /las políticas de doble autorización requieren segunda firma y los excesos de rol se escalan/);
    assert.match(candidate, /DOBLE AUTORIZACIÓN/);
    assert.match(candidate, /La política exige una segunda autorización de otra persona; la aprobación no aplica el descuento por sí sola/);
  }
});

test('A09.2.5 muestra la auditoría completa de descuentos sin DML desde el TPV', async () => {
  const source = await readFile(new URL('../../../source-recovery/fuente-recuperado.js', import.meta.url), 'utf8');
  const runtime = await readFile(new URL('../../../fuente.js', import.meta.url), 'utf8');

  for (const candidate of [source, runtime]) {
    assert.match(candidate, /async function listarAuditoriaDescuentosA09\(/);
    assert.match(candidate, /.from\("abc_descuento_aprobacion_intentos"\)[\s\S]*?\.select\(/);
    assert.match(candidate, /operationIds = new Set\(solicitudes\.map/);
    assert.match(candidate, /intentos\.data.*filter\(\(row\) => operationIds\.has/);
    assert.match(candidate, /.from\("abc_eventos"\)[\s\S]*?CUENTA_DESCUENTO_APLICADO/);
    assert.match(candidate, /Auditoría A09 · historial/);
    assert.match(candidate, /Solicitudes y estado final/);
    assert.match(candidate, /Intentos de aprobación/);
    assert.match(candidate, /Aplicaciones registradas/);
    assert.match(candidate, /Los reversos económicos siguen el flujo transaccional correspondiente/);
    assert.doesNotMatch(candidate, /\.from\("abc_descuento_aprobacion_intentos"\)\s*\.insert/);
    assert.doesNotMatch(candidate, /\.from\("abc_eventos"\)\s*\.update/);
  }
});

test('A09.2.3 identifica el escalado por encima del límite del rol', async () => {
  const source = await readFile(new URL('../../../source-recovery/fuente-recuperado.js', import.meta.url), 'utf8');
  const runtime = await readFile(new URL('../../../fuente.js', import.meta.url), 'utf8');

  for (const candidate of [source, runtime]) {
    assert.match(candidate, /requiereEscalado/);
    assert.match(candidate, /requiere_escalado/);
    assert.match(candidate, /Solicitud de escalado pendiente/);
    assert.match(candidate, /Supera el límite de tu rol/);
    assert.match(candidate, /ESCALADO/);
    assert.match(candidate, /Supera el límite del rol solicitante; debe autorizarla alguien con capacidad suficiente/);
  }
});
