# PM26 P06b — Aviso F: investigación del flujo real de `prefiltros_candidatos`

## Estado

**Investigación de solo lectura + propuesta de SQL. No se aplicó ningún
cambio de esquema ni de aplicación.** Responde a los 7 puntos exigidos
antes de proponer SQL. Descartada explícitamente la política amplia
para cualquier usuario autenticado (`authenticated` demuestra
autenticación, no autorización ni aislamiento multiempresa).

---

## 1. Inventario de `prefiltros_candidatos`

Verificado en vivo contra QA (`list_tables` verbose, `information_schema`,
`pg_policies`, `pg_class`):

| Aspecto | Valor |
|---|---|
| Columnas | `token` (PK, text), `creado_en` (timestamptz, default `now()`), `candidato_nombre` (text), `estado` (text, default `'pendiente'`), `respuestas` (jsonb, nullable), `resumen` (jsonb, nullable), `completado_en` (timestamptz, nullable), `expira_en` (timestamptz, default `now() + 7 days`) |
| Clave primaria | `token` |
| Claves foráneas | Ninguna |
| **`empresa_id`/`local_id`** | **No existen.** No hay ninguna columna que asocie una fila con una empresa o un local. |
| Índices | Solo el de la PK (`token`) |
| Propietario | `postgres` |
| RLS | Activado (`relrowsecurity = true`), `relforcerowsecurity = false` |
| Políticas | **Ninguna** (`pg_policies` devuelve 0 filas) |
| Grants (`information_schema.role_table_grants`) | **Solo `postgres` y `service_role`** tienen `SELECT`/`INSERT`/`UPDATE`/`DELETE`/etc. **`authenticated` y `anon` no tienen ningún privilegio sobre esta tabla** — ni uno. |

**Consecuencia práctica de lo anterior**: no es solo que falte una
política RLS. Con `authenticated` sin ningún `GRANT`, cualquier intento
de `SELECT`/`INSERT`/`UPDATE`/`DELETE` desde el cliente estándar
fallaría **antes** de llegar siquiera a evaluar RLS (Postgres comprueba
los privilegios de la tabla antes que las políticas de fila). Esto
descarta la hipótesis de "RLS deny-all intencional" para esta tabla en
concreto: con cero grants, ni siquiera un `authenticated` con la
política más permisiva podría acceder sin además conceder el `GRANT`.

## 2. Consumidores reales — REST directo, RPC, o ambos

Localizados exhaustivamente en `fuente.js` y en el proyecto QA
(`list_edge_functions`, `get_edge_function`):

### 2.1 Lado personal (autenticado, dentro de la app)

`crearLogicaPrefiltros({ registrarAuditoria })`, definida en `fuente.js`,
expone `crearPrefiltro`/`listarPrefiltros`/`eliminarPrefiltro`. Las
tres usan `window.getSupabaseClient()` → `window.__nubeCliente` (el
cliente estándar, sujeto a `RLS` y a los grants normales de
`authenticated` — no `service_role`), con `.insert()`/`.select()`/`.delete()`
**directos sobre la tabla**, sin ninguna RPC intermedia:

```js
await supabase.from("prefiltros_candidatos").insert({ token, candidato_nombre, estado: "pendiente" });
await supabase.from("prefiltros_candidatos").select("*").order("creado_en", { ascending: false });
await supabase.from("prefiltros_candidatos").delete().eq("token", token);
```

Estas tres funciones se pasan como props hasta el componente
`SeleccionPersonal` (dentro de la gestión de personal de la app,
detrás del login normal), donde `crearPrefiltro` se dispara al crear
un enlace de prefiltro para un candidato.

### 2.2 Lado candidato (público, sin sesión)

El router de la propia aplicación resuelve la ruta **antes** de
comprobar sesión:

```js
var matchPrefiltro = /^#\/prefiltro\/(.+)$/.exec(rutaHash);
... matchPrefiltro ? PrefiltroPublico({ token }) : AppConSesion()
```

`PrefiltroPublico` **no usa el cliente Supabase en absoluto.** Hace dos
`fetch()` directos a la Edge Function `prefiltro-candidato`
(`verify_jwt: false`, confirmado en QA), con acciones `"comprobar"` (al
cargar la página) y `"enviar"` (al enviar el formulario):

```js
fetch("<host>/functions/v1/prefiltro-candidato", {
  method: "POST",
  body: JSON.stringify({ accion: "comprobar", token })
});
fetch("<host>/functions/v1/prefiltro-candidato", {
  method: "POST",
  body: JSON.stringify({ accion: "enviar", token, respuestas: form })
});
```

La Edge Function, ejecutándose con su propia clave de servicio en el
backend, es quien realmente lee/escribe `prefiltros_candidatos` para
el candidato — nunca lo hace el navegador del candidato directamente
contra la tabla. Su propio mecanismo de autorización es la posesión
del token (64 caracteres hexadecimales, generado con
`crypto.randomUUID()` encadenado), no Supabase Auth. **En QA, esta
función está simulada** (`{qa:true, simulated:true}`, HTTP 503) —
comportamiento esperado, coherente con el resto de funciones QA que
evitan efectos externos reales; no se puede reproducir su lógica real
desde aquí, solo constatar su existencia, su `verify_jwt: false` y que
el candidato nunca toca la tabla directamente.

### 2.3 Hallazgo relacionado, fuera de alcance de este punto

La URL que usa `PrefiltroPublico` para llamar a la Edge Function está
**codificada al proyecto de producción**, no es la URL activa según el
entorno (a diferencia del resto de la app, que resuelve su conexión de
forma dinámica). Esto significa que el flujo público de prefiltro de
candidato **siempre habla con producción**, se ejecute desde donde se
ejecute el bundle — un posible hueco en el aislamiento QA/producción
para esta función concreta. Se deja registrado como hallazgo
incidental; no se investiga ni se corrige aquí (no forma parte del
aviso F ni de una política RLS) — análogo a otros hallazgos fuera de
alcance ya registrados en P04a/P01.

### Resumen

| Consumidor | Mecanismo | Rol/cliente | Sujeto a RLS/grants de tabla |
|---|---|---|---|
| Personal (`crearPrefiltro`/`listarPrefiltros`/`eliminarPrefiltro`) | REST directo | `authenticated` (cliente estándar) | **Sí** — y hoy bloqueado (§1) |
| Candidato (`PrefiltroPublico`) | Edge Function `prefiltro-candidato` | Clave de servicio, dentro de la función | No (la función corre con sus propios privilegios) |

## 3. ¿Empresa, local, o ambos? ¿Existe una clave fiable?

**No existe hoy ninguna clave fiable.** La tabla no tiene `empresa_id`
ni `local_id`. Pero el contexto **sí está disponible** en el mismo
componente que instancia la lógica: justo donde se llama a
`crearLogicaPrefiltros({ registrarAuditoria })`, la misma función
envolvente ya usa `empresaDelLocalActivo?.id` y `localActivoId` para
otro propósito (la propia auditoría, en la línea inmediatamente
anterior) — y no se pasan a `crearLogicaPrefiltros`.

Esto **no es un diseño deliberado de "bolsa de candidatos única, sin
distinción de empresa"**: es una laguna. El contexto existe, está a un
parámetro de distancia, y no se usó. Además, `listarPrefiltros()` hace
`.select("*")` sin ningún filtro — si esta instalación llegara a tener
más de una empresa activa, cualquier miembro de personal autorizado
vería los candidatos de **todas** las empresas, no solo la suya. Dado
que el resto de la aplicación trata el aislamiento multiempresa como
una garantía de seguridad central (es el tema recurrente de gran parte
del Plan Maestro), esta ausencia debe tratarse como una laguna a
cerrar, no como algo a documentar y dejar así.

**Conclusión**: la corrección de F requiere, como paso previo e
inseparable, añadir `empresa_id`/`local_id` a la tabla.

## 4. Roles autorizados — reutilizar el modelo de Personal ya existente

La tabla `empleados` (mismo dominio: gestión de personal) ya resuelve
exactamente este problema con el helper `private.pm11_puede_ver_personal`,
usado en su política `pm11_empleados_select_gestion`:

```sql
CREATE OR REPLACE FUNCTION private.pm11_puede_ver_personal(p_empresa_id text, p_local_id text)
 RETURNS boolean
 LANGUAGE sql STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'private', 'pg_temp'
AS $function$
  select private.la_usuario_activo()
     and nullif(btrim(p_empresa_id), '') is not null
     and nullif(btrim(p_local_id), '') is not null
     and upper(btrim(p_local_id)) not in ('TODOS', 'TODOS LOS LOCALES')
     and exists (
       select 1 from public.membresias_usuario m
        where m.user_id = auth.uid()
          and m.empresa_id = p_empresa_id
          and m.activo = true
          and (
            (m.rol = 'Propietario' and (m.todos_locales = true or m.local_id = p_local_id))
            or
            (m.rol = 'Encargado' and m.todos_locales = false and m.local_id = p_local_id)
          )
     );
$function$
```

Exige: usuario activo (`la_usuario_activo()`), `empresa_id`/`local_id`
no vacíos ni "TODOS", y una membresía activa con rol `Propietario`
(cualquier local de la empresa, o el local si no tiene `todos_locales`)
o `Encargado` (solo su local concreto). Esto **ya excluye**
explícitamente a roles operativos como `Básico`/`Camarero/a`/`Cajero/a`/`Churrero/a`
(el enum más amplio de `perfiles.rol`, que no es el que gobierna esta
decisión — la que gobierna es `membresias_usuario.rol`, restringido
aquí a `Propietario`/`Encargado`).

**Recomendación**: reutilizar `private.pm11_puede_ver_personal` tal
cual, sin duplicar su lógica, una vez la tabla tenga `empresa_id`/`local_id`.
No se propone ningún helper nuevo.

## 5. Comparación: RLS directo / RPC autoritativa / híbrida

| | RLS directo en la tabla | RPC autoritativa (`SECURITY DEFINER`) | Híbrida |
|---|---|---|---|
| Lectura (`listarPrefiltros`) | Simple, consistente con cómo Postgres ya expone `SELECT` en el resto del dominio | Más código para lo mismo que ya resuelve una política | — |
| Escritura (`crearPrefiltro`/`eliminarPrefiltro`) | Posible, pero una política de `INSERT` no puede fijar `empresa_id`/`local_id` de forma fiable si el cliente los envía — habría que confiar en el valor que manda el navegador | Controla el valor de `empresa_id`/`local_id` en el servidor (no en lo que el cliente afirma), igual que `pm11_alta_empleado`, etc. | — |
| Coherencia con el resto del dominio | — | — | **Es exactamente el patrón que ya usa `empleados`**: lectura por RLS directo con `pm11_puede_ver_personal`, mutaciones (`pm11_alta_empleado`, `pm11_baja_empleado`, `pm11_editar_empleado`, ...) por RPC `SECURITY DEFINER` |

**Recomendación: híbrida**, por ser la que ya está en uso y validada
para este mismo dominio (personal), no una alternativa nueva:

- **Lectura**: política `SELECT` directa sobre `prefiltros_candidatos`
  usando `private.pm11_puede_ver_personal(empresa_id, local_id)`.
- **Escritura** (`crear`/`eliminar`): dos RPC `SECURITY DEFINER` nuevas,
  que fijan `empresa_id`/`local_id` a partir de un local elegido por el
  llamante pero **validado contra su membresía real**, no simplemente
  aceptado del cliente — igual que el resto de RPC de este dominio.

El flujo del candidato (Edge Function + `service_role`) **no cambia**:
sigue fuera de RLS por diseño, su autorización es la posesión del
token, no un rol de personal.

## 6. Por qué no usar `SECURITY DEFINER` para esquivar RLS

No se propone esto. Las dos RPC de escritura sí son `SECURITY DEFINER`
(como el resto del motor autoritativo del proyecto), pero cumplen
exactamente lo que exige el punto 6 de la autorización:

- **Identidad**: `private.la_usuario_activo()` (dentro de
  `pm11_puede_ver_personal`) exige `auth.uid()` no nulo y un perfil
  activo.
- **Empresa y rol**: `pm11_puede_ver_personal(p_empresa_id, p_local_id)`
  exige una membresía activa con rol `Propietario`/`Encargado` sobre
  esa empresa/local exactos — no se acepta ciegamente lo que mande el
  cliente.
- **`search_path` seguro**: `SET search_path TO 'public', 'auth', 'private', 'pg_temp'`,
  igual que todas las funciones `SECURITY DEFINER` ya existentes en el
  proyecto.
- **Grants mínimos**: `REVOKE ALL ... FROM PUBLIC` seguido de `GRANT
  EXECUTE ... TO authenticated` únicamente — ni `anon` ni `service_role`
  necesitan invocarla vía RPC (el candidato pasa por la Edge Function,
  no por aquí).
- **Pruebas negativas**: la propuesta de la sección 7 incluye,
  cuando se autorice su validación, casos que deben fallar (usuario sin
  membresía, `Encargado` de otro local, `empresa_id`/`local_id` vacíos).

## 7. Por qué `operaciones_procesadas` y `prefiltro_limites` deben seguir sin políticas

Confirmado, para ambas: cero referencias en `fuente.js` (ningún
`supabase.from(...)` las toca), y sus únicos grants son `postgres` y
`service_role` — igual que `prefiltros_candidatos`, pero a diferencia
de esta, **nada del lado cliente intenta usarlas**. Su diseño
consistente es: tablas de soporte interno (idempotencia de
operaciones, límites de intentos por clave hash) pensadas para ser
leídas/escritas únicamente por funciones `SECURITY DEFINER` o por
`service_role` — nunca por REST desde el navegador. RLS activado sin
políticas es aquí la postura correcta: deniega el único camino
(`authenticated`/`anon` vía REST) que no debería existir, y no afecta
al camino real (`SECURITY DEFINER`/`service_role`, que no pasa por
RLS). No se propone ningún cambio para estas dos tablas.

---

## Propuesta de SQL (presentada, no aplicada)

Ningún archivo de migración se ha creado para esto — a diferencia del
aviso H, aquí no hay autorización todavía ni para preparar la
migración. El siguiente SQL es una propuesta de trabajo, pendiente de
decisión:

```sql
-- 1. Aislamiento multiempresa -- columnas que hoy no existen
alter table public.prefiltros_candidatos
  add column empresa_id text,
  add column local_id text;
-- Nota: nullable por ahora; si producción tiene filas existentes,
-- backfill/NOT NULL es una decisión aparte que esta propuesta no
-- resuelve por sí sola (no se ha inspeccionado producción).

-- 2. Lectura: RLS directo, reutilizando el helper ya existente
create policy prefiltros_candidatos_select_gestion
  on public.prefiltros_candidatos
  for select to authenticated
  using (private.pm11_puede_ver_personal(empresa_id, local_id));

-- 3. Escritura: RPC autoritativa, empresa_id/local_id fijados en servidor
create or replace function public.pm11_crear_prefiltro_candidato(
  p_empresa_id text, p_local_id text, p_candidato_nombre text
) returns text
language plpgsql security definer
set search_path to 'public', 'auth', 'private', 'pg_temp'
as $$
declare v_token text;
begin
  if not private.pm11_puede_ver_personal(p_empresa_id, p_local_id) then
    raise exception 'No autorizado para crear prefiltros en este local';
  end if;
  v_token := encode(gen_random_bytes(32), 'hex');
  insert into public.prefiltros_candidatos (token, candidato_nombre, estado, empresa_id, local_id)
  values (v_token, trim(p_candidato_nombre), 'pendiente', p_empresa_id, p_local_id);
  return v_token;
end;
$$;
revoke all on function public.pm11_crear_prefiltro_candidato(text, text, text) from public;
grant execute on function public.pm11_crear_prefiltro_candidato(text, text, text) to authenticated;

create or replace function public.pm11_eliminar_prefiltro_candidato(p_token text)
returns boolean
language plpgsql security definer
set search_path to 'public', 'auth', 'private', 'pg_temp'
as $$
declare v_empresa text; v_local text;
begin
  select empresa_id, local_id into v_empresa, v_local
    from public.prefiltros_candidatos where token = p_token;
  if v_empresa is null or not private.pm11_puede_ver_personal(v_empresa, v_local) then
    return false;
  end if;
  delete from public.prefiltros_candidatos where token = p_token;
  return true;
end;
$$;
revoke all on function public.pm11_eliminar_prefiltro_candidato(text) from public;
grant execute on function public.pm11_eliminar_prefiltro_candidato(text) to authenticated;
```

Cambios de aplicación necesarios en paralelo (no incluidos aquí, fuera
de alcance de este punto): `crearLogicaPrefiltros` tendría que recibir
`empresaId`/`localId` (ya disponibles en el componente que la
instancia) y llamar a `supabase.rpc('pm11_crear_prefiltro_candidato', ...)`/
`supabase.rpc('pm11_eliminar_prefiltro_candidato', ...)` en vez de
`.insert()`/`.delete()` directos; `listarPrefiltros` seguiría usando
`.select()` directo (ahora protegido por la política del punto 2).

## Qué NO se hizo

- No se aplicó ningún `ALTER TABLE`, política, ni función en QA ni en
  ningún otro proyecto.
- No se modificó `crearLogicaPrefiltros` ni ningún otro código de
  `fuente.js`.
- No se investigó producción (solo se advierte que backfill/NOT NULL
  es una decisión pendiente si allí existen filas).
- No se tocó el aviso G ni el aviso H en este documento.
- No se decidió cuál de las tres alternativas aplicar sin esta
  investigación -- ahora sí hay una recomendación (híbrida), pendiente
  de aprobación.

```
PM26_P06B_AVISO_F_INVESTIGACION_COMPLETA=SI
PM26_P06B_AVISO_F_CAMBIOS_APLICADOS=NO
PM26_P06B_AVISO_F_GRANTS_FALTANTES_CONFIRMADOS=SI
PM26_P06B_AVISO_F_EMPRESA_LOCAL_AUSENTES_CONFIRMADO=SI
PM26_P06B_AVISO_F_CONSUMIDOR_CANDIDATO_VIA_EDGE_FUNCTION_CONFIRMADO=SI
PM26_P06B_AVISO_F_RECOMENDACION=HIBRIDA_RLS_LECTURA_RPC_ESCRITURA
PM26_P06B_AVISO_F_OPCION_AMPLIA_AUTHENTICATED_DESCARTADA=SI
PM26_P06B_AVISO_F_OTRAS_DOS_TABLAS_JUSTIFICADAS_SIN_CAMBIO=SI
```

Pendiente de que el usuario apruebe la recomendación (o pida ajustarla)
antes de preparar cualquier migración real para el aviso F.
