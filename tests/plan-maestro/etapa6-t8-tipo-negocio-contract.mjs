import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const fuente = fs.readFileSync(path.join(root, "fuente.js"), "utf8");
const espejo = fs.readFileSync(path.join(root, "source-recovery", "fuente-recuperado.js"), "utf8");
const migracion = fs.readFileSync(
  path.join(root, "supabase", "migrations", "20261025100000_t8_tipo_negocio_plantillas.sql"),
  "utf8"
);
const migracionFix = fs.readFileSync(
  path.join(root, "supabase", "migrations", "20261025110000_t8_tipo_negocio_fix_omitidos.sql"),
  "utf8"
);

// T8, pieza 4 (Etapa 6): tipo de negocio + biblioteca de opciones de ejemplo. Alcance elegido
// por Pedro (24-25/10/2026, chat): guardar el tipo y, si se pide, sembrar unos grupos de
// ejemplo típicos de ese tipo en la biblioteca de opciones (T8 pieza 1) de este local.
for (const [nombre, contenido] of [["fuente", fuente], ["espejo de recuperación", espejo]]) {
  assert.match(contenido, /function ConfigTipoNegocio\(\{ empresaId, localId \}\)/, `${nombre}: falta el componente ConfigTipoNegocio`);
  assert.match(contenido, /var CONFIG_TIPOS_NEGOCIO = \[/, `${nombre}: falta el catálogo de tipos de negocio`);
  for (const tipo of ["BAR", "RESTAURANTE", "CAFETERIA", "PASTELERIA", "TIENDA", "OTRO"]) {
    assert.match(contenido, new RegExp(`\\{ id: "${tipo}",`), `${nombre}: falta el tipo de negocio ${tipo}`);
  }

  // Las 2 llamadas al servidor.
  assert.match(contenido, /configRpc\("abc_obtener_tipo_negocio", \{/, `${nombre}: falta la llamada a abc_obtener_tipo_negocio`);
  assert.match(contenido, /configRpc\("abc_guardar_tipo_negocio", \{/, `${nombre}: falta la llamada a abc_guardar_tipo_negocio`);
  assert.match(contenido, /p_crear_opciones_ejemplo: crearEjemplo === true/, `${nombre}: falta el parámetro p_crear_opciones_ejemplo`);

  // "Otro" no ofrece biblioteca de ejemplo (casilla deshabilitada en pantalla).
  assert.match(
    contenido,
    /disabled: ocupado \|\| tipoElegido === "OTRO" \}\), "Crear también una biblioteca de opciones de ejemplo para este local", tipoElegido === "OTRO" \? " \(Otro no tiene ejemplos\)" : ""\)/,
    `${nombre}: "Otro" debe deshabilitar la casilla de biblioteca de ejemplo`
  );

  // Deja claro que no es un dato fiscal/operativo.
  assert.match(contenido, /no cambia ningún cálculo fiscal ni operativo/, `${nombre}: falta aclarar que el tipo de negocio no es un dato fiscal`);

  // Hallazgo Cowork (prueba en vivo, 25/10/2026): el mensaje de confirmación debe explicar
  // qué grupos de la plantilla se omitieron por nombre duplicado, no solo cuántos se crearon.
  assert.match(
    contenido,
    /const omitidos = Array\.isArray\(r2\?\.grupos_ejemplo_omitidos\) \? r2\.grupos_ejemplo_omitidos : \[\];/,
    `${nombre}: falta leer grupos_ejemplo_omitidos del resultado`
  );
  assert.match(
    contenido,
    /No se tocó \$\{omitidos\.length === 1 \? "el grupo" : "los grupos"\} "\$\{omitidos\.join\('", "'\)\}" porque ya/,
    `${nombre}: falta explicar en el mensaje qué grupos se omitieron y por qué`
  );

  // Hallazgo Cowork: al elegir "Otro" la casilla de ejemplo debe desmarcarse de verdad, no
  // solo deshabilitarse visualmente.
  assert.match(
    contenido,
    /setTipoElegido\(v2\);\s*\n\s*if \(v2 === "OTRO"\) setCrearEjemplo\(false\);/,
    `${nombre}: elegir "Otro" debe desmarcar la casilla de biblioteca de ejemplo`
  );

  // Traducciones de error.
  for (const codigo of ["tipo_negocio_no_autorizado", "tipo_negocio_invalido", "tipo_negocio_motivo_requerido"]) {
    assert.match(contenido, new RegExp(`${codigo}: "`), `${nombre}: falta la traducción del error ${codigo}`);
  }

  // Pestaña registrada en el panel de Configuración.
  assert.match(contenido, /\["tiponegocio", "Tipo de negocio"\]/, `${nombre}: falta la pestaña "Tipo de negocio"`);
  assert.match(contenido, /seccion === "tiponegocio" \? h\(ConfigTipoNegocio, \{ empresaId, localId \}\) : null/, `${nombre}: falta montar ConfigTipoNegocio en su pestaña`);
}

// Dual-file parity: el componente completo debe ser idéntico carácter a carácter.
{
  const inicioFuente = fuente.indexOf("function ConfigTipoNegocio(");
  const finFuente = fuente.indexOf("\nfunction ConfigPermisos(", inicioFuente);
  const inicioEspejo = espejo.indexOf("function ConfigTipoNegocio(");
  const finEspejo = espejo.indexOf("\nfunction ConfigPermisos(", inicioEspejo);
  assert.ok(inicioFuente > 0 && finFuente > inicioFuente, "fuente: no se pudo delimitar ConfigTipoNegocio");
  assert.ok(inicioEspejo > 0 && finEspejo > inicioEspejo, "espejo: no se pudo delimitar ConfigTipoNegocio");
  assert.equal(
    fuente.slice(inicioFuente, finFuente),
    espejo.slice(inicioEspejo, finEspejo),
    "ConfigTipoNegocio debe ser idéntico entre fuente.js y el espejo de recuperación"
  );
}

// Migración: no crea ninguna tabla nueva, columna aditiva, mismo permiso que gestiona cargos.
assert.doesNotMatch(migracion, /create table/, "No debe crearse ninguna tabla nueva");
assert.match(migracion, /alter table public\.empresas add column tipo_negocio text;/, "Falta la columna empresas.tipo_negocio");
assert.match(
  migracion,
  /tipo_negocio is null or tipo_negocio in \('BAR','RESTAURANTE','CAFETERIA','PASTELERIA','TIENDA','OTRO'\)/,
  "Falta la restricción de valores válidos de tipo_negocio"
);
assert.match(migracion, /create function public\.abc_obtener_tipo_negocio/, "Falta abc_obtener_tipo_negocio");
assert.match(migracion, /create function public\.abc_guardar_tipo_negocio/, "Falta abc_guardar_tipo_negocio");
assert.match(
  migracion,
  /not private\.abc_config_puede_configurar_empresa\(p_empresa_id,p_local_id\)/,
  "abc_guardar_tipo_negocio debe exigir Propietario de toda la empresa, igual que la gestión de cargos"
);
assert.match(
  migracion,
  /not coalesce\(private\.la_tiene_local\(p_empresa_id,p_local_id\),false\)/,
  "abc_obtener_tipo_negocio debe permitir verlo a cualquier miembro del local"
);

// No duplica grupos si ya existen (de cualquier origen) al sembrar la biblioteca de ejemplo.
assert.match(
  migracion,
  /if not exists\(\s*\n\s*select 1 from public\.catalogo_tpv_grupos_opciones g\s*\n\s*where g\.empresa_id=p_empresa_id and g\.local_id=p_local_id\s*\n\s*and lower\(btrim\(g\.nombre\)\)=lower\(v_grupo->>'nombre'\)\s*\n\s*\) then/,
  "La siembra de ejemplo debe comprobar que el grupo no exista ya antes de crearlo"
);
assert.match(
  migracion,
  /if not exists\(\s*\n\s*select 1 from public\.catalogo_tpv_opciones o\s*\n\s*where o\.empresa_id=p_empresa_id and o\.local_id=p_local_id and o\.grupo_id=v_grupo_id\s*\n\s*and lower\(btrim\(o\.nombre\)\)=lower\(v_opcion->>'nombre'\)\s*\n\s*\) then/,
  "La siembra de ejemplo debe comprobar que la opción no exista ya antes de crearla"
);

// "Otro" no siembra ningún grupo de ejemplo.
assert.match(migracion, /else '\[\]'::jsonb\s*\n\s*end;/, "El tipo OTRO (rama else) no debe sembrar ningún grupo de ejemplo");

// Las 6 plantillas declaradas (una por tipo, salvo OTRO).
for (const tipo of ["BAR", "RESTAURANTE", "CAFETERIA", "PASTELERIA", "TIENDA"]) {
  assert.match(migracion, new RegExp(`when '${tipo}' then '\\[`), `Falta la plantilla de ejemplo para ${tipo}`);
}

// Idempotencia y limpieza en caso de fallo, igual que el resto del proyecto.
const guardarInicio = migracion.indexOf("create function public.abc_guardar_tipo_negocio(");
assert.ok(guardarInicio > 0, "no se encontró abc_guardar_tipo_negocio en la migración");
const guardarCuerpo = migracion.slice(guardarInicio);
assert.match(guardarCuerpo, /private\.abc_operacion_iniciar\(/, "abc_guardar_tipo_negocio: falta abc_operacion_iniciar");
assert.match(guardarCuerpo, /private\.abc_operacion_completar\(/, "abc_guardar_tipo_negocio: falta abc_operacion_completar");
assert.match(guardarCuerpo, /exception when others then/, "abc_guardar_tipo_negocio: falta la limpieza con abc_operacion_fallar");

assert.match(
  migracion,
  /grant execute on function public\.abc_obtener_tipo_negocio\([^)]*\) to authenticated;/,
  "abc_obtener_tipo_negocio debe limitarse a usuarios autenticados"
);
assert.match(
  migracion,
  /grant execute on function public\.abc_guardar_tipo_negocio\([^)]*\) to authenticated;/,
  "abc_guardar_tipo_negocio debe limitarse a usuarios autenticados"
);

// Corrección de transparencia (migración aparte, no se edita la ya aplicada): la siembra
// debe registrar y devolver qué grupos se omitieron por nombre duplicado.
assert.match(
  migracionFix,
  /create or replace function public\.abc_guardar_tipo_negocio/,
  "Falta el create or replace de abc_guardar_tipo_negocio con la corrección"
);
assert.match(migracionFix, /v_omitidos text\[\]:=array\[\]::text\[\];/, "Falta el acumulador de grupos omitidos");
assert.match(
  migracionFix,
  /else\s*\n\s*v_omitidos:=array_append\(v_omitidos,v_grupo->>'nombre'\);\s*\n\s*end if;/,
  "Debe registrar el nombre del grupo cuando ya existe y se omite"
);
assert.match(
  migracionFix,
  /'grupos_ejemplo_omitidos',to_jsonb\(v_omitidos\)/,
  "El resultado debe incluir grupos_ejemplo_omitidos"
);
assert.match(migracionFix, /private\.abc_operacion_iniciar\(/, "La corrección debe seguir siendo idempotente");
assert.match(migracionFix, /exception when others then/, "La corrección debe seguir limpiando con abc_operacion_fallar");

console.log("PLAN_MAESTRO_ETAPA6_T8_TIPO_NEGOCIO_FIX_OMITIDOS=PASS");

console.log("PLAN_MAESTRO_ETAPA6_T8_TIPO_NEGOCIO_UI=PASS");
console.log("PLAN_MAESTRO_ETAPA6_T8_TIPO_NEGOCIO_PARIDAD_DUAL=PASS");
console.log("PLAN_MAESTRO_ETAPA6_T8_TIPO_NEGOCIO_MIGRACION=PASS");
