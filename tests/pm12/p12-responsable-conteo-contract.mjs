import assert from "node:assert/strict";
import fs from "node:fs";

const runtime = fs.readFileSync("fuente.js", "utf8");
const recuperada = fs.readFileSync("source-recovery/fuente-recuperado.js", "utf8");

for (const [nombre, codigo] of [["runtime", runtime], ["fuente recuperada", recuperada]]) {
  assert.match(codigo, /select\("rol, nombre, empleado_id"\)/, `${nombre}: el perfil debe exponer el vínculo con empleado`);
  assert.match(codigo, /empleados = \[\]/, `${nombre}: la lógica debe recibir empleados reales`);
  assert.match(codigo, /responsableEmpleado = \(empleados \|\| \[\]\)\.find/, `${nombre}: el cierre debe validar el empleado responsable`);
  assert.match(codigo, /e2\.activo !== false/, `${nombre}: el responsable debe estar activo`);
  assert.match(codigo, /responsableEmpleado\.id, actorNombre: responsableEmpleado\.nombre, responsableId: responsableEmpleado\.id/, `${nombre}: la auditoría debe guardar la identidad trazable`);
  assert.match(codigo, /empleadoAutenticadoId = ""/, `${nombre}: la pantalla debe recibir el empleado autenticado`);
  assert.match(codigo, /empleadosValidos\.map\(\(e2\) => .*e2\.nombre/, `${nombre}: la pantalla debe ofrecer empleados reales del local`);
  assert.match(codigo, /empleadoAutenticado\.id/, `${nombre}: la pantalla debe preseleccionar el empleado autenticado válido`);
  assert.match(codigo, /empleadoAutenticadoId: miPerfil\?\.empleado_id/, `${nombre}: la pantalla debe recibir el vínculo del perfil`);
}

console.log("PM12_P12_RESPONSABLE_REAL=PASS");
console.log("PM12_P12_PRESELECCION_AUTENTICADA=PASS");
console.log("PM12_P12_AUDITORIA_IDENTIDAD=PASS");
