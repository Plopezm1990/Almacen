import assert from "node:assert/strict";
import fs from "node:fs";

const fuente = fs.readFileSync(new URL("../../fuente.js", import.meta.url), "utf8");
const recuperada = fs.readFileSync(new URL("../../source-recovery/fuente-recuperado.js", import.meta.url), "utf8");

for (const [nombre, src] of [["fuente.js", fuente], ["fuente-recuperado.js", recuperada]]) {
  assert.match(src, /function EstadoCargaDatosPM12\(\{ estado/);
  for (const estado of ["cargando", "cargado_con_datos", "vacio_confirmado", "error", "pendiente_sincronizar"]) {
    assert.match(src, new RegExp(`${estado}:`), `${nombre}: falta estado ${estado}`);
  }
  assert.match(src, /const estadoCargaDatosPM12 = .*useMemo/);
  assert.match(src, /if \(!ready\) return "cargando"/);
  assert.match(src, /return Array\.isArray\(datos\) && datos\.length > 0 \? "cargado_con_datos" : "vacio_confirmado"/);
  assert.match(src, /if \(fallo\(key\)\) return "error"/);
  assert.match(src, /pendienteEmpleados: pendiente\("empleados"\)/);
  assert.match(src, /estadoCargaDatos: estadoCargaDatosPM12\.empleados/);
  assert.match(src, /estadoCargaDatos === "vacio_confirmado"/);
  assert.match(src, /function RegistroHorario\([\s\S]*estadoCargaEmpleados/);
  assert.match(src, /function Turnos\([\s\S]*estadoCargaEmpleados/);
  assert.match(src, /etiqueta: "Fichajes"/);
  assert.match(src, /etiqueta: "Turnos"/);
  assert.match(src, /puedeMostrarFichajes/);
  assert.match(src, /includes\(estadoCargaDatos\).*includes\(estadoCargaEmpleados\)/);
}

assert.match(fuente, /id: "estado_datos_personal"/);
assert.match(fuente, /estadoCargaDatosPM12 &&/);
assert.equal(
  fuente.replace(/\r\n/g, "\n").match(/function EstadoCargaDatosPM12[\s\S]*?function Pill2/)?.[0],
  recuperada.replace(/\r\n/g, "\n").match(/function EstadoCargaDatosPM12[\s\S]*?function Pill2/)?.[0],
  "la fuente recuperada debe conservar la máquina de estados"
);

console.log("PM12 P03 estados explícitos de carga/sincronización: contrato OK");
