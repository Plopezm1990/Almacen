# PM33 P01 — `obtener_contexto_operativo()`: aislamiento multiempresa

Estado: **preparado en rama aislada, NO aplicado a Supabase ni a producción.**
Rama: `claude/pm33-fix-obtener-contexto-operativo` (base: `f313bc0`, HEAD de
`release` en el momento de esta preparación).

## Causa raíz

`public.obtener_contexto_operativo()` exige `auth.uid()` y resuelve el rol del
llamante contra `public.perfiles`, pero las cuatro lecturas de
`public.almacen_kv` (claves `empleados`, `proveedores`, `fichasCosto`,
`encargos`) no filtraban por `empresa_id`/`local_id` pese a que la tabla los
tiene como columnas propias. Cualquier `authenticated` con perfil activo y rol
`Encargado`, `Cajero/a` o `Churrero/a` en **cualquier** empresa recibía datos
de **todas** las empresas/locales con esa misma clave. Confirmado por lectura
directa del código en producción (auditoría R10 del Proyecto A) y reproducido
en Postgres real (ver "Pruebas" más abajo).

## SQL actual (producción, resumen — ver R10 para el texto completo)

```sql
create or replace function public.obtener_contexto_operativo()
returns jsonb language plpgsql security definer
set search_path to 'public'
as $$
...
  from public.almacen_kv k, lateral jsonb_array_elements(...) e
  where k.key = 'empleados'
    and coalesce((e->>'activo')::boolean, true) = true;   -- sin filtro de empresa/local
...
$$;
```

## SQL propuesto

Ver `supabase/migrations/20260919120000_pm33_obtener_contexto_operativo_aislamiento.sql`.
Resumen de los cambios:

1. **`drop function if exists public.obtener_contexto_operativo();` antes de
   recrearla.** Sin este paso, `create or replace` con una lista de
   parámetros distinta no sustituye la función: crea una segunda sobrecarga.
   Verificado en Postgres real durante esta preparación — sin el `drop`, la
   versión de 0 argumentos (la defectuosa) sigue existiendo y Postgres la
   prefiere sobre la de 1 argumento con valor por defecto cuando el llamante
   invoca sin argumentos, que es exactamente el único caso de uso real. Sin
   este `drop`, el parche sería un no-op en el escenario real.
2. **Firma pública conservada + un parámetro opcional.** `p_local_id text
   default null`. El único call site real (`fuente.js`, función
   `obtenerContexto`) invoca `supabase.rpc("obtener_contexto_operativo")` sin
   argumentos y sigue funcionando idéntico. El parámetro es imprescindible
   para el caso "empleado con más de un local, pide uno concreto": una
   función sin argumentos no puede distinguir cuál.
3. **Determinación inequívoca del contexto**, solo para los tres roles que
   leen `almacen_kv` (`Encargado`, `Cajero/a`, `Churrero/a`) — el resto de
   roles conserva el comportamiento exacto de antes, sin exigirles un
   contexto que nunca necesitaron:
   - Fuente (a): membresía relacional propia y no-todos-locales
     (`membresias_usuario`, modelo PM29+).
   - Fuente (b): el propio registro de empleado dentro de `almacen_kv`,
     localizado por `perfiles.empleado_id` (modelo heredado, el que usan hoy
     `Cajero/a` y `Churrero/a` en producción — verificado que en los datos
     reales actuales solo `Propietario` tiene filas en
     `membresias_usuario`).
   - Sin `p_local_id`: exige exactamente un candidato entre (a) y (b). Cero
     candidatos o más de uno → rechazo explícito, nunca "el primero" ni una
     mezcla.
   - Con `p_local_id`: debe resolverse por (a) o (b); si no, rechazo.
4. **Verificación de local/empresa activos** antes de servir cualquier dato:
   `locales.activo = true` y `empresas.activo = true` para el contexto
   resuelto.
5. **Todas las lecturas de `almacen_kv` quedan acotadas** a
   `(v_empresa_id, v_local_id)`.
6. **Sin SQL dinámico, `search_path` explícito** (`public, auth, private,
   pg_temp`), sin cambios en la cadena de RLS (no se depende de ella: la
   función sigue siendo `SECURITY DEFINER` y la autorización vive
   íntegramente en su propio cuerpo).
7. `revoke all ... from public, anon; grant execute ... to authenticated;`
   — mismo perfil de grants que tiene hoy la función en producción
   (confirmado por consulta a `pg_proc`/`has_function_privilege` durante la
   auditoría R10).

## Pruebas

`tests/pm33/db/p01-aislamiento-multiempresa-contract.mjs` + fixture
`tests/pm33/db/fixtures.sql` (esquema mínimo — perfiles, empresas, locales,
membresias_usuario, almacen_kv — reproducido por introspección de producción,
**no** un volcado completo del esquema real). Requiere Postgres real vía
`PM33_TEST_DATABASE_URL`.

14 escenarios, 38 aserciones, con datos señuelo inequívocos por empresa/local
(p. ej. `SEÑUELO-PROVEEDOR-A` / `SEÑUELO-PROVEEDOR-B`) para detectar
contaminación cruzada por contenido, no solo por conteo de filas:

| # | Escenario | Resultado esperado |
|---|---|---|
| T01 | Cajero de A | Solo proveedores/cobros de A; señuelo de B ausente |
| T02 | Cajero de B | Solo proveedores/cobros de B; señuelo de A ausente |
| T03 | Encargado de A (sin membresía, resuelve por KV) | Solo empleados de A; ni B ni el empleado dado de baja de A |
| T04 | Encargado de B | Solo empleados de B |
| T05 | Churrero de A | Solo fichas de costo de A |
| T06 | Empleado con 2 locales (A y A2), pide cada uno explícitamente | Recibe exclusivamente el local pedido, nunca el otro |
| T07 | Mismo empleado, sin especificar local | Rechazado: "ambiguo" |
| T08 | Cajero de A pide `loc-B` (ajeno) | Rechazado: "Contexto no autorizado" |
| T09 | Empleado cuyo único local está dado de baja | Rechazado: "Local inactivo o inexistente" |
| T10 | Sin sesión (`auth.uid()` null) | Rechazado: "No autenticado" |
| T11 | Perfil inactivo | Rechazado: "Perfil no activo" |
| T12 | `empleado_id` que no resuelve en ningún local | Rechazado: "no determinable" (sin fallback global) |
| T13 | Sin `empleado_id` y sin membresía | Rechazado: "no determinable" |
| T14 | Rol no gestionado por esta RPC (`Camarero/a`) | Sigue funcionando exactamente igual que antes del parche |

### Evidencia de ejecución real

**Fase roja** (función original, con el defecto, misma base de datos y
mismos datos señuelo): 7 de las aserciones de contaminación cruzada fallan
tal como se predice — T01d, T01f, T02d, T02f, T03c, T04c, T05b — demostrando
que la batería detecta el defecto real y no es un ritual vacío.

**Fase verde** (función parcheada, mismos datos): **38/38 PASS.**

Ambas fases se ejecutaron en un Postgres 16 real instalado para esta
preparación (no un mock), contra el fixture y el archivo de migración tal
como quedan committeados en esta rama.

## Riesgo de regresión

- **Bajo para los call sites existentes**: un único call site real
  (`fuente.js`), verificado por búsqueda exhaustiva del nombre de la RPC en
  todo el bundle; invoca sin argumentos y solo lee `.rol`, `.empleado`,
  `.empleadosFichaje`, `.proveedores`, `.fichasProduccion`,
  `.cobrosEncargos` — todas conservadas con la misma forma. Los dos campos
  nuevos (`empresaId`, `localId`) son aditivos; JavaScript ignora
  silenciosamente claves adicionales en un objeto.
- **Riesgo medio, ya cubierto por T14**: cualquier rol fuera de
  `Encargado`/`Cajero/a`/`Churrero/a` que llame a esta RPC. Cubierto y en
  verde.
- **Riesgo a vigilar en producción real** (no reproducible en este sandbox):
  empleados reales cuyo `perfiles.empleado_id` apunte a **más de un**
  registro activo en `almacen_kv` (p. ej. si el mismo empleado quedó
  duplicado en dos locales por un error de migración histórico). El parche
  trata ese caso como "ambiguo" y **rechaza** en vez de servir datos — es el
  comportamiento más seguro, pero podría dejar a un empleado real sin
  contexto operativo si existe esa duplicidad hoy. **Recomendación: antes de
  aplicar, ejecutar en producción (o en una copia) la consulta de
  `v_candidatos` de forma aislada, de solo lectura, para confirmar que
  ningún empleado real tiene hoy más de un candidato.** No lo he ejecutado
  yo mismo contra producción — export fuera de alcance de esta preparación.

## Rollback

Revertir es un solo `create or replace function
public.obtener_contexto_operativo()` (0 argumentos) con el cuerpo original,
más `drop function public.obtener_contexto_operativo(text);` para retirar la
sobrecarga nueva. No hay migración de datos que deshacer: el parche no
modifica ninguna fila, solo la función. El rollback reintroduce el defecto
original — debe tratarse como una medida de emergencia, no una opción neutra.

## Pendiente antes de poder aplicar (no incluido en esta preparación)

1. Confirmar en producción (fuera de este sandbox) que ningún `empleado_id`
   real resuelve en más de un local — ver "Riesgo de regresión".
2. Decisión de autorización explícita del propietario del proyecto.
3. Aplicar la migración vía el proceso que se decida en R2/R5 (todavía sin
   diseñar en detalle — ver P4/P5), no por edición manual en el panel de
   Supabase.
