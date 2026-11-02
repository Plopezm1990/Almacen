import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const migrationPath = new URL('../../../supabase/migrations/20261102100000_abc_f3_a10c_preparation_route_guard.sql', import.meta.url);

test('A10C clasifica productos y valida rutas antes de cambiar el pedido', async () => {
  const migration = await readFile(migrationPath, 'utf8');
  assert.match(migration, /add column if not exists requiere_preparacion boolean/i);
  assert.match(migration, /private\.abc_a10_validar_rutas_envio\(/i);
  assert.match(migration, /producto_preparacion_clasificacion_pendiente/i);
  assert.match(migration, /producto_preparacion_sin_ruta/i);
  assert.match(
    migration,
    /perform private\.abc_a10_validar_rutas_envio\([\s\S]*?insert into public\.pedido_linea_transiciones/i,
  );
});

test('A10C evita comandas artificiales para entrega directa', async () => {
  const migration = await readFile(migrationPath, 'utf8');
  assert.match(migration, /abc_a10_producto_requiere_preparacion/i);
  assert.match(
    migration,
    /abc_a10_producto_requiere_preparacion\([\s\S]*?\) is true/i,
  );
  assert.match(migration, /directas completan A05 sin crear una comanda artificial/i);
});

test('A10C expone mensajes accionables en las dos fuentes del TPV', async () => {
  const [runtime, recovery] = await Promise.all([
    readFile(new URL('../../../fuente.js', import.meta.url), 'utf8'),
    readFile(new URL('../../../source-recovery/fuente-recuperado.js', import.meta.url), 'utf8'),
  ]);
  for (const source of [runtime, recovery]) {
    assert.match(source, /producto_preparacion_clasificacion_pendiente/);
    assert.match(source, /productos sin clasificar como preparación o entrega directa/);
    assert.match(source, /producto_preparacion_sin_ruta/);
    assert.match(source, /requiere preparación pero no tiene una ruta activa/);
  }
});

test('A10C mapea el bloqueo de ruta y evita falso éxito en la UI', async () => {
  const [runtime, recovery] = await Promise.all([
    readFile(new URL('../../../fuente.js', import.meta.url), 'utf8'),
    readFile(new URL('../../../source-recovery/fuente-recuperado.js', import.meta.url), 'utf8'),
  ]);

  const casos = [
    [
      'producto_preparacion_clasificacion_pendiente',
      'Hay productos sin clasificar como preparación o entrega directa. Completa su clasificación antes de enviarlos.',
    ],
    [
      'producto_preparacion_sin_ruta',
      'Hay un producto que requiere preparación pero no tiene una ruta activa a cocina. Configura la ruta y vuelve a intentarlo.',
    ],
  ];

  for (const source of [runtime, recovery]) {
    const mapperStart = source.indexOf('function errorRpcA02(error) {');
    const mapperEnd = source.indexOf('\n  async function rpcA02ConRecuperacion', mapperStart);
    assert.ok(mapperStart >= 0 && mapperEnd > mapperStart, 'A10C: mapper de errores no localizable');

    const context = { String };
    vm.createContext(context);
    vm.runInContext(`${source.slice(mapperStart, mapperEnd)}\nthis.__map = errorRpcA02;`, context);
    for (const [code, expected] of casos) {
      assert.equal(context.__map(new Error(code)), expected, `A10C: mapeo incorrecto para ${code}`);
    }

    const sendStart = source.indexOf('async function enviarPedidoGuardadoA05()');
    const sendEnd = source.indexOf('\n  async function ejecutarAccionA05(', sendStart);
    assert.ok(sendStart >= 0 && sendEnd > sendStart, 'A10C: acción visual de envío no localizable');
    const sendBlock = source.slice(sendStart, sendEnd);
    const failureBranch = sendBlock.indexOf('if (!resultado || resultado.ok === false)');
    const errorState = sendBlock.indexOf('setErrorA05(resultado?.error || "No se pudo enviar el pedido.")');
    const successState = sendBlock.indexOf('setConfirmacion((actual) => actual ? {');
    assert.ok(failureBranch >= 0 && errorState > failureBranch, 'A10C: el error no queda visible en la rama de fallo');
    assert.ok(successState > failureBranch, 'A10C: falta la actualización de confirmación tras el resultado');

    assert.match(source, /errorA05 &&[\s\S]*?role: "alert"/);
    assert.match(source, /title: confirmacion\.pedidoEstado === "ENVIADO" \? "Pedido enviado" : "Pedido guardado"/);
    assert.match(source, /confirmacion\.pedidoEstado !== "ENVIADO" \? [\s\S]*?Enviar pedido/);
  }
});

console.log('ABC_F3_A10C_PREPARATION_ROUTE_GUARD=PASS');
