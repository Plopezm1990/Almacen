import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const fuente = fs.readFileSync(path.join(root, "fuente.js"), "utf8");
const espejo = fs.readFileSync(path.join(root, "source-recovery", "fuente-recuperado.js"), "utf8");
const migracion = fs.readFileSync(
  path.join(root, "supabase", "migrations", "20261024190000_t8_tarifa_horario_hora_feliz.sql"),
  "utf8"
);

// T8, pieza 3 (Etapa 6): tarifa de horario ("hora feliz"). Alcance elegido por Pedro
// (24/10/2026, chat): solo horario, sin zonas. El plan decía "la parte de servidor ya va en
// la Hoja QA-3", pero no existía nada de esto en el servidor — se construyó desde cero.
for (const [nombre, contenido] of [["fuente", fuente], ["espejo de recuperación", espejo]]) {
  assert.match(contenido, /function ConfigTarifas\(\{ empresaId, localId \}\)/, `${nombre}: falta el componente ConfigTarifas`);
  assert.match(contenido, /var CONFIG_DIAS_SEMANA = \[/, `${nombre}: falta el catálogo de días de la semana`);

  // Las 2 llamadas al servidor.
  assert.match(contenido, /configRpc\("abc_guardar_tarifa_horario", \{/, `${nombre}: falta la llamada a abc_guardar_tarifa_horario`);
  assert.match(contenido, /configRpc\("abc_guardar_tarifa_precio", \{/, `${nombre}: falta la llamada a abc_guardar_tarifa_precio`);

  // La lectura reutiliza las tablas ya abiertas por SELECT, sin RPC nueva de lectura.
  assert.match(
    contenido,
    /supabase\.from\("catalogo_tpv_tarifas_horario"\)\.select\(/,
    `${nombre}: debe leer las tarifas directamente de catalogo_tpv_tarifas_horario`
  );
  assert.match(
    contenido,
    /supabase\.from\("catalogo_tpv_tarifa_precios"\)\.select\(/,
    `${nombre}: debe leer los precios especiales directamente de catalogo_tpv_tarifa_precios`
  );

  // El tipo de grupo (día/hora) está explicado; sin zonas todavía.
  assert.match(contenido, /Todavía no hay zonas: se aplica igual en todo el local/, `${nombre}: falta explicar que todavía no hay zonas`);

  // Validación cliente del rango de horas y de los días elegidos, antes de llamar al servidor.
  assert.match(contenido, /datos\.horaFin <= datos\.horaInicio/, `${nombre}: debe validar que la hora de fin sea posterior a la de inicio`);
  assert.match(contenido, /!Array\.isArray\(datos\.dias\) \|\| datos\.dias\.length === 0/, `${nombre}: debe exigir al menos un día de la semana`);

  // El tipo de tarifa recién creada no permite añadir precios especiales si está desactivada.
  assert.match(
    contenido,
    /disabled: ocupado \|\| productos\.length === 0 \|\| !t2\.activo \}, !t2\.activo \? "Activa la tarifa para añadir precios" : "Añadir un precio especial"\)/,
    `${nombre}: no debe permitir añadir un precio especial a una tarifa desactivada`
  );

  // Traducciones de error nuevas.
  for (const codigo of [
    "tarifa_horario_solapada",
    "tarifa_horario_rango_invalido",
    "tarifa_horario_dias_invalidos",
    "tarifa_horario_nombre_duplicado",
    "tarifa_precio_tarifa_no_disponible",
    "tarifa_precio_producto_no_disponible",
  ]) {
    assert.match(
      contenido,
      new RegExp(`${codigo}: "`),
      `${nombre}: falta la traducción del error ${codigo}`
    );
  }

  // Pestaña registrada en el panel de Configuración.
  assert.match(contenido, /\["tarifas", "Tarifas \(hora feliz\)"\]/, `${nombre}: falta la pestaña "Tarifas (hora feliz)"`);
  assert.match(contenido, /seccion === "tarifas" \? h\(ConfigTarifas, \{ empresaId, localId \}\) : null/, `${nombre}: falta montar ConfigTarifas en su pestaña`);
}

// Dual-file parity: el componente completo debe ser idéntico carácter a carácter.
{
  const inicioFuente = fuente.indexOf("function ConfigTarifas(");
  const finFuente = fuente.indexOf("\nfunction ConfigPermisos(", inicioFuente);
  const inicioEspejo = espejo.indexOf("function ConfigTarifas(");
  const finEspejo = espejo.indexOf("\nfunction ConfigPermisos(", inicioEspejo);
  assert.ok(inicioFuente > 0 && finFuente > inicioFuente, "fuente: no se pudo delimitar ConfigTarifas");
  assert.ok(inicioEspejo > 0 && finEspejo > inicioEspejo, "espejo: no se pudo delimitar ConfigTarifas");
  assert.equal(
    fuente.slice(inicioFuente, finFuente),
    espejo.slice(inicioEspejo, finEspejo),
    "ConfigTarifas debe ser idéntico entre fuente.js y el espejo de recuperación"
  );
}

// Migración: no crea ninguna tabla de las ya existentes, mismo permiso que el catálogo.
assert.doesNotMatch(migracion, /create table public\.catalogo_tpv_productos/, "No debe recrear catalogo_tpv_productos");
assert.match(migracion, /create table public\.catalogo_tpv_tarifas_horario/, "Falta la tabla catalogo_tpv_tarifas_horario");
assert.match(migracion, /create table public\.catalogo_tpv_tarifa_precios/, "Falta la tabla catalogo_tpv_tarifa_precios");
assert.match(migracion, /create function private\.abc_tarifa_horario_vigente/, "Falta private.abc_tarifa_horario_vigente");
assert.match(migracion, /create function public\.abc_guardar_tarifa_horario/, "Falta abc_guardar_tarifa_horario");
assert.match(migracion, /create function public\.abc_guardar_tarifa_precio/, "Falta abc_guardar_tarifa_precio");
assert.match(migracion, /create or replace function private\.abc_calcular_linea_tpv/, "Falta el create or replace de abc_calcular_linea_tpv");

assert.equal(
  (migracion.match(/not private\.abc_catalogo_puede_gestionar\(p_empresa_id,p_local_id\)/g) || []).length,
  2,
  "las 2 funciones de alta/edición deben exigir el mismo permiso que ya gestiona el catálogo"
);

// La tarifa vigente nunca debe romper un cobro, pase lo que pase.
assert.match(
  migracion,
  /exception when others then\s*\n\s*return null;\s*\n\s*end \$\$;/,
  "abc_tarifa_horario_vigente debe devolver NULL ante cualquier fallo, nunca lanzar una excepción"
);

// No se solapan dos tarifas activas en día y hora.
assert.match(
  migracion,
  /raise exception 'tarifa_horario_solapada';/,
  "Debe rechazar activar una tarifa que se solape con otra ya activa"
);
assert.match(migracion, /t\.dias_semana && v_dias/, "La comprobación de solape debe usar el operador de solape de arrays (&&)");

// Nombre único de tarifa dentro de un local.
assert.match(migracion, /create unique index abc_tarifa_horario_nombre_uq/, "Falta el índice de nombre único de tarifa");

// El precio especial exige producto y tarifa activos al crear/activar, pero no al desactivar.
assert.match(migracion, /raise exception 'tarifa_precio_producto_no_disponible';/, "Debe exigir que el producto esté disponible al activar un precio especial");
assert.match(migracion, /raise exception 'tarifa_precio_tarifa_no_disponible';/, "Debe exigir que la tarifa esté activa al activar un precio especial");

// El parche de precio en abc_calcular_linea_tpv: sustituye precio_unitario y fuerza
// precio_con_impuesto a NULL cuando hay un precio especial activo; nunca al contrario.
assert.match(
  migracion,
  /v_catalog\.precio_unitario:=v_tarifa_precio\.precio_unitario;\s*\n\s*v_catalog\.precio_con_impuesto:=null;/,
  "El precio especial debe sustituir precio_unitario y forzar precio_con_impuesto a NULL"
);
assert.match(migracion, /'tarifa_horario_aplicada',v_tarifa_id/, "El resultado debe dejar constancia de qué tarifa se aplicó (o ninguna)");

// Idempotencia y limpieza en caso de fallo, igual que el resto del proyecto.
for (const fn of ["abc_guardar_tarifa_horario", "abc_guardar_tarifa_precio"]) {
  const inicio = migracion.indexOf(`create function public.${fn}(`);
  assert.ok(inicio > 0, `no se encontró ${fn} en la migración`);
  const fin = migracion.indexOf("\n\n-- ", inicio + 1) > inicio ? migracion.indexOf("\n\n-- ", inicio + 1) : migracion.indexOf("\nrevoke all on function", inicio);
  const cuerpo = migracion.slice(inicio, fin > inicio ? fin : undefined);
  assert.match(cuerpo, /private\.abc_operacion_iniciar\(/, `${fn}: falta abc_operacion_iniciar`);
  assert.match(cuerpo, /private\.abc_operacion_completar\(/, `${fn}: falta abc_operacion_completar`);
  assert.match(cuerpo, /exception when others then/, `${fn}: falta la limpieza con abc_operacion_fallar`);
}

assert.match(
  migracion,
  /grant execute on function public\.abc_guardar_tarifa_horario\([^)]*\) to authenticated;/,
  "abc_guardar_tarifa_horario debe limitarse a usuarios autenticados"
);
assert.match(
  migracion,
  /grant execute on function public\.abc_guardar_tarifa_precio\([^)]*\) to authenticated;/,
  "abc_guardar_tarifa_precio debe limitarse a usuarios autenticados"
);

console.log("PLAN_MAESTRO_ETAPA6_T8_TARIFA_HORARIO_UI=PASS");
console.log("PLAN_MAESTRO_ETAPA6_T8_TARIFA_HORARIO_PARIDAD_DUAL=PASS");
console.log("PLAN_MAESTRO_ETAPA6_T8_TARIFA_HORARIO_MIGRACION=PASS");
