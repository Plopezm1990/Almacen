import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const loadSources = async () => Promise.all([
  readFile(new URL('../../../fuente.js', import.meta.url), 'utf8'),
  readFile(new URL('../../../source-recovery/fuente-recuperado.js', import.meta.url), 'utf8'),
]);

test('A10 UI expone Cocina, estaciones y comandas en ambas fuentes', async () => {
  const [runtime, recovery] = await loadSources();
  for (const source of [runtime, recovery]) {
    assert.match(source, /function CocinaA10\(/);
    assert.match(source, /tab === "cocina"/);
    assert.match(source, /id: "cocina", label: "Cocina A10"/);
    assert.match(source, /listarEstacionesA10/);
    assert.match(source, /abrirSesionCajaA10/);
    assert.match(source, /abc_abrir_sesion_caja/);
    assert.match(source, /listarComandasA10/);
    assert.match(source, /abc_listar_comandas_estacion/);
  }
});

test('A10 UI conserva autoridad de servidor para configuración y acciones', async () => {
  const [runtime, recovery] = await loadSources();
  const rpcs = [
    'abc_crear_estacion_preparacion',
    'abc_actualizar_estacion_preparacion',
    'abc_asignar_producto_estacion',
    'abc_enviar_cambio_comanda',
    'abc_reimprimir_comanda',
    'abc_resolver_merma_comanda_linea',
  ];
  for (const source of [runtime, recovery]) {
    for (const rpc of rpcs) assert.match(source, new RegExp(rpc));
    assert.match(source, /operating_day_context_required/);
    assert.match(source, /rpcA02ConRecuperacion\(contexto\.supabase/);
  }
});

test('A10 UI solo lee tablas de estaciones/rutas y no hace DML directo', async () => {
  const [runtime, recovery] = await loadSources();
  const tables = ['tpv_estaciones_preparacion', 'tpv_producto_estaciones', 'comandas_preparacion', 'comanda_lineas'];
  for (const source of [runtime, recovery]) {
    assert.match(source, /from\("tpv_estaciones_preparacion"\)[\s\S]*?\.select\(/);
    assert.match(source, /from\("tpv_producto_estaciones"\)[\s\S]*?\.select\(/);
    for (const table of tables) {
      assert.doesNotMatch(source, new RegExp(`from\\("${table}"\\)\\s*\\.(insert|update|upsert|delete)`));
    }
    assert.doesNotMatch(source, /abc_reclamar_efectos_cocina/);
    assert.doesNotMatch(source, /abc_confirmar_entrega_comanda/);
  }
});

test('el contrato y la implementación A10 siguen alineados', async () => {
  const [runtime, recovery, migration, contract] = await Promise.all([
    readFile(new URL('../../../fuente.js', import.meta.url), 'utf8'),
    readFile(new URL('../../../source-recovery/fuente-recuperado.js', import.meta.url), 'utf8'),
    readFile(new URL('../../../supabase/migrations/20260926110000_abc_f3_a10_kitchen_commands.sql', import.meta.url), 'utf8'),
    readFile(new URL('./a10-contract.sql', import.meta.url), 'utf8'),
  ]);
  for (const source of [runtime, recovery]) {
    assert.match(source, /Cocina y comandas A10/);
    assert.match(source, /No mueve stock, no cobra ni emite fiscalidad/);
    assert.match(source, /MERMA_CONFIRMADA/);
  }
  assert.match(migration, /create table public\.tpv_estaciones_preparacion/);
  assert.match(migration, /create table public\.comandas_preparacion/);
  assert.match(migration, /KITCHEN_COMANDA_REIMPRESION/);
  assert.match(contract, /ABC_F3_A10_CONTRACT=PASS/);
});
