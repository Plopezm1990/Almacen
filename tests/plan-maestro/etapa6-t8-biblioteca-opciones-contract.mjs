import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const fuente = fs.readFileSync(path.join(root, "fuente.js"), "utf8");
const espejo = fs.readFileSync(path.join(root, "source-recovery", "fuente-recuperado.js"), "utf8");
const migracion = fs.readFileSync(
  path.join(root, "supabase", "migrations", "20261024180000_t8_biblioteca_opciones_reutilizables.sql"),
  "utf8"
);

// Hoja QA-10 (Etapa 6, T8, pieza 1): biblioteca de opciones reutilizables. El
// esquema de T3-A04 (catalogo_tpv_grupos_opciones / catalogo_tpv_opciones /
// catalogo_tpv_producto_grupos) ya estaba pensado para reutilizar un grupo de
// opciones entre varios productos; esta pieza añade las 3 funciones que
// faltaban para crear y editar esas filas desde pantalla, y la pantalla
// misma ("Opciones y variantes").
for (const [nombre, contenido] of [["fuente", fuente], ["espejo de recuperación", espejo]]) {
  assert.match(contenido, /function ConfigOpciones\(\{ empresaId, localId \}\)/, `${nombre}: falta el componente ConfigOpciones`);
  assert.match(contenido, /var CONFIG_TIPOS_GRUPO_OPCIONES = \[/, `${nombre}: falta el catálogo de tipos de grupo`);
  assert.match(contenido, /var CONFIG_TIPOS_OPCION = \[/, `${nombre}: falta el catálogo de tipos de opción`);

  // Las 3 llamadas al servidor.
  assert.match(contenido, /configRpc\("abc_guardar_grupo_opciones", \{/, `${nombre}: falta la llamada a abc_guardar_grupo_opciones`);
  assert.match(contenido, /configRpc\("abc_guardar_opcion", \{/, `${nombre}: falta la llamada a abc_guardar_opcion`);
  assert.match(contenido, /configRpc\("abc_vincular_grupo_producto", \{/, `${nombre}: falta la llamada a abc_vincular_grupo_producto`);

  // La lectura reutiliza las tablas ya abiertas por SELECT (F3-A04), sin RPC nueva de lectura.
  assert.match(
    contenido,
    /supabase\.from\("catalogo_tpv_grupos_opciones"\)\.select\(/,
    `${nombre}: debe leer la biblioteca directamente de catalogo_tpv_grupos_opciones`
  );
  assert.match(
    contenido,
    /supabase\.from\("catalogo_tpv_producto_grupos"\)\.select\(/,
    `${nombre}: debe leer los enlaces directamente de catalogo_tpv_producto_grupos`
  );

  // Coherencia tipo_grupo / tipo_opcion explicada en pantalla (misma regla que la compra).
  assert.match(
    contenido,
    /Un grupo «Variante» solo admite opciones de tipo Variante/,
    `${nombre}: falta la explicación de coherencia variante/modificador`
  );

  // Inmutabilidad reflejada en el formulario: tipo de grupo y grupo/moneda de una opción no
  // se pueden tocar una vez creados.
  assert.match(
    contenido,
    /campoSelect\(formGrupo\.tipoGrupo, \(v2\) => setFormGrupo\(\{ \.\.\.formGrupo, tipoGrupo: v2 \}\), CONFIG_TIPOS_GRUPO_OPCIONES\.map\(\(x3\) => \[x3\.id, x3\.etiqueta\]\), ocupado \|\| !!formGrupo\.id\)/,
    `${nombre}: el tipo de grupo debe quedar bloqueado al editar`
  );

  // Traducciones de error nuevas.
  for (const codigo of [
    "abc_catalogo_no_autorizado",
    "grupo_nombre_duplicado",
    "grupo_tipo_inmutable",
    "opcion_tipo_incoherente_variante",
    "opcion_tipo_incoherente_modificador",
    "opcion_grupo_inmutable",
    "vinculo_grupo_sin_opciones",
  ]) {
    assert.match(
      contenido,
      new RegExp(`${codigo}: "`),
      `${nombre}: falta la traducción del error ${codigo}`
    );
  }

  // Pestaña registrada en el panel de Configuración.
  assert.match(contenido, /\["opciones", "Opciones y variantes"\]/, `${nombre}: falta la pestaña "Opciones y variantes"`);
  assert.match(contenido, /seccion === "opciones" \? h\(ConfigOpciones, \{ empresaId, localId \}\) : null/, `${nombre}: falta montar ConfigOpciones en su pestaña`);
}

// Dual-file parity: el componente completo debe ser idéntico carácter a carácter.
{
  const inicioFuente = fuente.indexOf("function ConfigOpciones(");
  const finFuente = fuente.indexOf("\nfunction ConfigPermisos(", inicioFuente);
  const inicioEspejo = espejo.indexOf("function ConfigOpciones(");
  const finEspejo = espejo.indexOf("\nfunction ConfigPermisos(", inicioEspejo);
  assert.ok(inicioFuente > 0 && finFuente > inicioFuente, "fuente: no se pudo delimitar ConfigOpciones");
  assert.ok(inicioEspejo > 0 && finEspejo > inicioEspejo, "espejo: no se pudo delimitar ConfigOpciones");
  assert.equal(
    fuente.slice(inicioFuente, finFuente),
    espejo.slice(inicioEspejo, finEspejo),
    "ConfigOpciones debe ser idéntico entre fuente.js y el espejo de recuperación"
  );
}

// Migración: las 3 funciones nuevas, mismo permiso que el catálogo, sin tocar nada existente.
assert.doesNotMatch(migracion, /create table/, "No debe crearse ninguna tabla nueva: se reutiliza el esquema de T3-A04");
assert.match(migracion, /create function public\.abc_guardar_grupo_opciones/, "Falta abc_guardar_grupo_opciones");
assert.match(migracion, /create function public\.abc_guardar_opcion/, "Falta abc_guardar_opcion");
assert.match(migracion, /create function public\.abc_vincular_grupo_producto/, "Falta abc_vincular_grupo_producto");

for (const match of [...migracion.matchAll(/not private\.abc_catalogo_puede_gestionar\(p_empresa_id,p_local_id\)/g)]) {
  assert.ok(match, "debe reutilizar el permiso de catálogo ya existente");
}
assert.equal(
  (migracion.match(/not private\.abc_catalogo_puede_gestionar\(p_empresa_id,p_local_id\)/g) || []).length,
  3,
  "las 3 funciones nuevas deben exigir el mismo permiso que ya gestiona el catálogo"
);

// Coherencia tipo_grupo/tipo_opcion, igual que la compra (abc_calcular_linea_tpv_configurada).
assert.match(
  migracion,
  /if v_grupo\.tipo_grupo='VARIANTE' and v_tipo<>'VARIANTE' then raise exception 'opcion_tipo_incoherente_variante'; end if;/,
  "Un grupo VARIANTE solo debe admitir opciones VARIANTE"
);
assert.match(
  migracion,
  /if v_grupo\.tipo_grupo='MODIFICADOR' and v_tipo='VARIANTE' then raise exception 'opcion_tipo_incoherente_modificador'; end if;/,
  "Un grupo MODIFICADOR no debe admitir ninguna opción VARIANTE"
);

// Inmutabilidad: tipo de grupo, y grupo/moneda de una opción, no cambian una vez creados.
assert.match(migracion, /if v_prev\.tipo_grupo<>v_tipo then raise exception 'grupo_tipo_inmutable'; end if;/, "El tipo de grupo debe ser inmutable");
assert.match(migracion, /if v_prev\.grupo_id<>p_grupo_id then raise exception 'opcion_grupo_inmutable'; end if;/, "El grupo de una opción debe ser inmutable");
assert.match(migracion, /if v_prev\.currency_code<>v_currency then raise exception 'opcion_moneda_inmutable'; end if;/, "La moneda de una opción debe ser inmutable");

// Vincular un grupo exige que el producto y el grupo estén activos, y que haya al menos una
// opción activa cuando la selección mínima es mayor que cero.
assert.match(migracion, /raise exception 'vinculo_producto_no_disponible';/, "Debe exigir que el producto esté disponible al enlazar");
assert.match(migracion, /raise exception 'vinculo_grupo_no_disponible';/, "Debe exigir que el grupo esté activo al enlazar");
assert.match(migracion, /raise exception 'vinculo_grupo_sin_opciones';/, "Debe exigir al menos una opción activa cuando el mínimo es mayor que cero");

// Nombres únicos nuevos (no existían en T3-A04).
assert.match(migracion, /create unique index abc_grupo_opciones_nombre_uq/, "Falta el índice de nombre único de grupo");
assert.match(migracion, /create unique index abc_opcion_nombre_uq/, "Falta el índice de nombre único de opción dentro de su grupo");

// Idempotencia y limpieza en caso de fallo, igual que el resto del proyecto.
for (const fn of ["abc_guardar_grupo_opciones", "abc_guardar_opcion", "abc_vincular_grupo_producto"]) {
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
  /grant execute on function public\.abc_guardar_grupo_opciones\([^)]*\) to authenticated;/,
  "abc_guardar_grupo_opciones debe limitarse a usuarios autenticados"
);
assert.match(
  migracion,
  /grant execute on function public\.abc_guardar_opcion\([^)]*\) to authenticated;/,
  "abc_guardar_opcion debe limitarse a usuarios autenticados"
);
assert.match(
  migracion,
  /grant execute on function public\.abc_vincular_grupo_producto\([^)]*\) to authenticated;/,
  "abc_vincular_grupo_producto debe limitarse a usuarios autenticados"
);

console.log("PLAN_MAESTRO_ETAPA6_T8_BIBLIOTECA_UI=PASS");
console.log("PLAN_MAESTRO_ETAPA6_T8_BIBLIOTECA_PARIDAD_DUAL=PASS");
console.log("PLAN_MAESTRO_ETAPA6_T8_BIBLIOTECA_MIGRACION=PASS");
