import fs from 'node:fs';
import assert from 'node:assert/strict';

const source = fs.readFileSync('fuente.js', 'utf8');
const recovered = fs.readFileSync('source-recovery/fuente-recuperado.js', 'utf8');
const acta = fs.readFileSync('docs/rediseno/ACTA_CIERRE_OBJETIVO_4_ORBITA_2026-11-21.md', 'utf8');
const alcance = fs.readFileSync('docs/rediseno/CIERRE-ALCANCE-PENDIENTES-2026-11-18.md', 'utf8');
const matrizDecisiones = fs.readFileSync('docs/rediseno/MATRIZ-CIERRE-VISUAL-ORBITA-2026-11-22.csv', 'utf8');
const estado = fs.readFileSync('docs/rediseno/ESTADO-OBJETIVO-4-ORBITA-2026-11-21.md', 'utf8');
const traspaso = fs.readFileSync('docs/rediseno/TRASPASO_QA_CLAUDE_2026-11-17.md', 'utf8');
const recovery = fs.readFileSync('restablecer-contrasena.html', 'utf8');

function scope(text, start, end) {
  const a = text.indexOf(start);
  assert.notEqual(a, -1, `scope start not found: ${start}`);
  const b = end ? text.indexOf(end, a) : text.length;
  assert.notEqual(b, -1, `scope end not found: ${end}`);
  return text.slice(a, b);
}

for (const text of [source, recovered]) {
  assert.doesNotMatch(scope(text, 'function Encargos(', 'function enmascararNifClienteSuite'), /window\.confirm/,
    'Encargos no debe usar confirmación nativa para reembolsos');
  assert.doesNotMatch(scope(text, 'function ClientesPunto3(', 'function paginarClientesSuite'), /window\.confirm/,
    'Clientes activo no debe usar confirmación nativa para borrar/anonimizar');
  assert.match(scope(text, 'function Encargos(', 'function enmascararNifClienteSuite'), /reembolsoPendiente/,
    'Encargos debe exponer la confirmación Órbita de reembolso');
}

for (const modulo of ['Inicio y panel general', 'TPV y sala', 'Pase', 'Cocina', 'Caja', 'Clientes', 'Compras', 'Inventario', 'Personal', 'Configuración', 'Plataforma', 'Acceso']) {
  assert.match(acta, new RegExp(`\\| ${modulo.replace(/[.*+?^${}()|[\\]\\]/g, '\\\\$&')} \\| Cerrado \\|`), `módulo no cerrado en acta: ${modulo}`);
}

assert.match(recovery, /la-apariencia\.css/);
assert.match(recovery, /data-la-diseno="orbita"/);
assert.match(alcance, /restablecer-contrasena\.html|reencuadrar|fuera del alcance/i);
assert.match(acta, /confirmaciones nativas.*formulario sin guardar|revisión humana de nóminas/s);
assert.match(acta, /Clientes.*no se monta en ninguna ruta/s);
assert.match(estado, /8c5d195c17fd094d4c23662e1ec78867dc810ee/);
assert.match(traspaso, /MATRIZ-CIERRE-VISUAL-ORBITA-2026-11-22\.csv/);
for (const id of ['sis-14', 'sis-15', 'sis-16', 'enc-05', 'org-25', 'inv-36']) {
  assert.match(matrizDecisiones, new RegExp(`^${id};`, 'm'), `falta decisión de alcance para ${id}`);
}
for (const estadoCierre of ['FUTURA_PRODUCTO', 'FUTURA_BACKEND', 'REENCUADRADA', 'CUBIERTA_POR_OTRA', 'FUERA_PRODUCTO', 'BLOQUEADA_']) {
  assert.match(matrizDecisiones, new RegExp(`;${estadoCierre}`), `falta clasificación ${estadoCierre}`);
}

console.log('CIERRE_LIMPIO_PLAN=PASS');
