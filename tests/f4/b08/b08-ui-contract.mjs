#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../../../fuente.js', import.meta.url), 'utf8');

assert.match(source, /function ReembolsosEconomicosB08\b/);
assert.match(source, /Reembolso econ[oó]mico B08/);
assert.match(source, /SIMULADOR_B08/);
assert.match(source, /abc_solicitar_reembolso/);
assert.match(source, /abc_cancelar_reembolso/);
assert.match(source, /abc_confirmar_reembolso_efectivo/);
assert.match(source, /p_operating_day: operatingDay/);
assert.match(source, /p_motivo: String\(motivo\)\.trim\(\)/);
assert.match(source, /no conecta con ning[uú]n proveedor real/);
assert.match(source, /vista === "reembolso"/);
assert.match(source, /registrarDevolucionCliente/);

const componentStart = source.indexOf('function ReembolsosEconomicosB08');
const componentEnd = source.indexOf('function Devoluciones', componentStart);
assert.ok(componentStart >= 0 && componentEnd > componentStart, 'No se delimitó el componente B08.4.');
const component = source.slice(componentStart, componentEnd);
assert.doesNotMatch(component, /registrarDevolucionCliente|registrarDevolucionProveedor/);
assert.doesNotMatch(component, /abc_resolver_reembolso/);
assert.match(component, /El simulador no env[ií]a dinero a un proveedor real/);

console.log('ABC_F4_B08_UI=PASS');
