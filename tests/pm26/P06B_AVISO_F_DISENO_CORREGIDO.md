# PM26 P06b — Aviso F: diseño corregido (aprobado el patrón híbrido; SQL anterior no aprobado)

## Estado

**Diseño presentado, no aplicado.** El usuario aprobó la arquitectura
híbrida (RLS en lectura + RPC en escritura) como dirección, pero
rechazó el SQL concreto presentado en
`tests/pm26/P06B_AVISO_F_INVESTIGACION.md` por 6 razones. Este
documento sustituye únicamente esa sección de SQL propuesto — el resto
de la investigación (puntos 1–4 y 7) sigue vigente y no se repite
aquí. Nada de lo siguiente se ha aplicado en QA ni en ningún otro
proyecto.

---

## Corrección 1 — `GRANT SELECT` explícito a `authenticated`, además de la política RLS

El diseño anterior asumía que la política RLS bastaba. Es falso, y ya
se documentó en el punto 1 de la investigación: `authenticated` no
tiene ningún `GRANT` sobre `prefiltros_candidatos` — ni siquiera con
una política RLS perfecta, Postgres deniega antes de llegar a
evaluarla. La tabla `empleados` (mismo dominio) ya resuelve esto así,
confirmado en vivo:

```
grantee=authenticated, privilege_type=SELECT   -- únicamente esto
grantee=postgres,      privilege_type=(todos)
grantee=service_role,  privilege_type=(todos)
```

Diseño corregido — mismo patrón exacto:

```sql
grant select on public.prefiltros_candidatos to authenticated;
```

## Corrección 2 — mutaciones directas revocadas explícitamente

No basta con "no conceder" `INSERT`/`UPDATE`/`DELETE` — se revoca de
forma explícita y verificable, igual que en `empleados` (que no tiene
ninguna fila de `INSERT`/`UPDATE`/`DELETE` para `authenticated` en
`information_schema.role_table_grants`):

```sql
revoke insert, update, delete on public.prefiltros_candidatos from authenticated, anon, public;
```

## Corrección 3 — RPC de escritura con `private.pm11_puede_mutar_personal`, no el helper de lectura

Error del diseño anterior: reutilizaba `pm11_puede_ver_personal` (el
helper de **lectura**) también para las mutaciones. Existe un helper
específico para mutar, ya en uso por todo el motor de escritura de
`empleados` (`pm11_alta_empleado`, `pm11_editar_empleado`,
`pm11_baja_empleado`, etc.) — verificado en vivo:

```sql
CREATE OR REPLACE FUNCTION private.pm11_puede_mutar_personal(p_empresa_id text, p_local_id text)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'private', 'pg_temp'
AS $function$
  select private.la_usuario_activo()
     and private.pm11_local_activo(p_empresa_id, p_local_id)
     and exists (
       select 1 from public.membresias_usuario m
        where m.user_id = auth.uid() and m.empresa_id = p_empresa_id and m.activo = true
          and ((m.rol = 'Propietario' and (m.todos_locales = true or m.local_id = p_local_id))
            or (m.rol = 'Encargado' and m.todos_locales = false and m.local_id = p_local_id))
     );
$function$
```

Exige, además de todo lo que exige `pm11_puede_ver_personal`, que
`private.pm11_local_activo(p_empresa_id, p_local_id)` sea verdadero —
el local debe existir y estar activo en `almacen_kv`, no solo que el
usuario tenga membresía sobre su identificador. **El diseño corregido
usa `pm11_puede_mutar_personal` en las dos RPC de escritura**, no
`pm11_puede_ver_personal`.

## Corrección 4 — `SECURITY DEFINER`, `search_path` y `EXECUTE` endurecidos

Verificado en vivo cuál es el patrón **más reciente** dentro de este
mismo dominio (no el de los helpers SQL más antiguos): la propia
`pm11_editar_empleado` usa `SET search_path TO ''` (vacío) con **todas**
las referencias completamente cualificadas por esquema
(`public.empleados`, `private.pm11_puede_mutar_personal(...)`, etc.),
no la lista `'public', 'auth', 'private', 'pg_temp'` que usé antes. El
diseño corregido sigue ese patrón, el más endurecido de los dos que
coexisten en el proyecto:

```sql
create or replace function public.pm11_crear_prefiltro_candidato(
  p_empresa_id text, p_local_id text, p_candidato_nombre text
) returns text
language plpgsql security definer
set search_path to ''
as $$
declare v_token text;
begin
  if auth.uid() is null or not private.pm11_puede_mutar_personal(p_empresa_id, p_local_id) then
    raise exception 'personal_contexto_no_autorizado';
  end if;
  if nullif(btrim(p_candidato_nombre), '') is null then
    raise exception 'prefiltro_candidato_nombre_requerido';
  end if;
  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.prefiltros_candidatos (token, candidato_nombre, estado, empresa_id, local_id)
  values (v_token, btrim(p_candidato_nombre), 'pendiente', p_empresa_id, p_local_id);
  return v_token;
end;
$$;
revoke all on function public.pm11_crear_prefiltro_candidato(text, text, text) from public;
grant execute on function public.pm11_crear_prefiltro_candidato(text, text, text) to authenticated;

create or replace function public.pm11_eliminar_prefiltro_candidato(
  p_empresa_id text, p_local_id text, p_token text
) returns boolean
language plpgsql security definer
set search_path to ''
as $$
declare v_empresa text; v_local text;
begin
  if auth.uid() is null or not private.pm11_puede_mutar_personal(p_empresa_id, p_local_id) then
    raise exception 'personal_contexto_no_autorizado';
  end if;
  select empresa_id, local_id into v_empresa, v_local
    from public.prefiltros_candidatos where token = p_token;
  if not found then
    return false;
  end if;
  if v_empresa is distinct from p_empresa_id or v_local is distinct from p_local_id then
    raise exception 'prefiltro_candidato_contexto_no_coincide';
  end if;
  delete from public.prefiltros_candidatos where token = p_token;
  return true;
end;
$$;
revoke all on function public.pm11_eliminar_prefiltro_candidato(text, text, text) from public;
grant execute on function public.pm11_eliminar_prefiltro_candidato(text, text, text) to authenticated;
```

Notas de endurecimiento, explícitas:
- `search_path TO ''` + cualificación completa (`public.prefiltros_candidatos`,
  `private.pm11_puede_mutar_personal`, `extensions.gen_random_bytes`) —
  sin depender del `search_path` de quien llama.
- `auth.uid() IS NULL` comprobado explícitamente antes de llamar al
  helper (igual que `pm11_editar_empleado`), no solo implícito dentro
  de `la_usuario_activo()`.
- `REVOKE ALL ... FROM PUBLIC` seguido de `GRANT EXECUTE ... TO authenticated`
  únicamente — ni `anon` ni `service_role` necesitan invocarla por RPC.
- `pm11_eliminar_prefiltro_candidato` **recibe `empresa_id`/`local_id`
  del llamante y los compara contra los reales de la fila** tras
  leerla — igual que `pm11_editar_empleado` compara
  `v_empleado.empresa_id <> p_empresa_id`. Esto evita que alguien con
  autorización sobre una empresa/local intente borrar un token de otra
  simplemente adivinándolo — la RPC exige declarar el contexto y lo
  verifica contra la fila real, no solo contra la membresía.

## Corrección 5 — filas existentes, backfill, nulabilidad, aislamiento

**En QA**: la tabla tiene 0 filas (verificado en la investigación
original) — no hay backfill que resolver ahí.

**En producción**: no se ha comprobado. Esta sesión no ha tocado el
proyecto de producción para el aviso F en ningún momento, y no lo hará
sin autorización específica y explícita para esa consulta concreta —
sería una lectura de solo conteo (`select count(*) from
prefiltros_candidatos`), pero sigue siendo tocar producción y no se
asume permiso implícito. **Se necesita esa autorización, o una
decisión explícita de diseñar a ciegas para ambos casos.**

Diseño que funciona en ambos casos sin necesitar la respuesta ahora
mismo:

```sql
alter table public.prefiltros_candidatos
  add column empresa_id text,
  add column local_id text;
-- Nullable deliberadamente. Si producción tiene 0 filas (como QA),
-- se puede añadir NOT NULL en una migración posterior sin backfill.
-- Si tiene filas existentes, esas filas quedan con empresa_id/local_id
-- NULL -- la política de lectura (pm11_puede_ver_personal) exige
-- ambos no vacíos, así que esas filas antiguas simplemente dejarían
-- de ser visibles por RLS para el personal hasta que se decida un
-- backfill real (no se puede inventar a qué empresa pertenecían sin
-- inspeccionar los datos). Eso es preferible a asumir un valor
-- incorrecto.
```

## Corrección 6 — pruebas positivas y negativas de roles, empresas, locales y tokens

Matriz mínima exigida antes de considerar esto listo para preparar
como migración real (a validar en aislamiento, igual que el aviso H,
antes de aplicar en QA):

| # | Caso | Esperado |
|---|---|---|
| 1 | `Propietario` de EMPRESA_A (`todos_locales=true`), crea prefiltro en LOCAL_A1 | Permitido |
| 2 | `Propietario` de EMPRESA_A, crea prefiltro en LOCAL_A2 (mismo `todos_locales=true`) | Permitido |
| 3 | `Encargado` de EMPRESA_A/LOCAL_A1, crea prefiltro en LOCAL_A1 | Permitido |
| 4 | `Encargado` de EMPRESA_A/LOCAL_A1, crea prefiltro en LOCAL_A2 (otro local, mismo `Encargado`) | **Denegado** |
| 5 | `Propietario`/`Encargado` de EMPRESA_A, crea prefiltro en EMPRESA_B | **Denegado** |
| 6 | Rol `Básico`/`Camarero/a`/etc. con membresía activa, intenta crear o eliminar | **Denegado** (no es `Propietario`/`Encargado`) |
| 7 | Usuario sin `auth.uid()` (anon) intenta `select`/`insert`/`delete` directo sobre la tabla | **Denegado** en los tres (grants revocados) |
| 8 | Usuario autenticado sin ninguna membresía activa | **Denegado** |
| 9 | `local_id` vacío o `'TODOS'` | **Denegado** por `pm11_local_activo` |
| 10 | `Encargado` intenta eliminar un token que existe pero pertenece a otra empresa/local (contexto declarado no coincide con la fila real) | **Denegado**, `prefiltro_candidato_contexto_no_coincide` |
| 11 | `Encargado` intenta eliminar un token inexistente | Devuelve `false`, sin excepción |
| 12 | `listarPrefiltros` (lectura, vía RLS) para `Propietario` de EMPRESA_A ve solo filas de EMPRESA_A, no de EMPRESA_B | Confirma aislamiento en lectura |
| 13 | Reaplicación de la migración (idempotencia) | Sin error |

Cuando se autorice preparar esto como migración real, se validará en
un Postgres aislado con esta misma disciplina que el aviso H
(`tests/pm26/p06b-h-aislado/`): batería de permisos antes/después,
reversión exacta, sin tocar QA hasta autorización específica.

## Qué NO se hizo

- No se aplicó ningún `GRANT`/`REVOKE`/función/columna en QA ni en
  ningún otro proyecto.
- No se consultó producción (ni siquiera un conteo de filas) sin
  autorización específica.
- No se preparó ninguna migración real todavía para el aviso F.
- No se ejecutó ninguna prueba viva de `prefiltros_candidatos` contra
  QA.

```
PM26_P06B_AVISO_F_DISENO_CORREGIDO=SI
PM26_P06B_AVISO_F_GRANT_SELECT_EXPLICITO=SI
PM26_P06B_AVISO_F_MUTACIONES_REVOCADAS_EXPLICITAMENTE=SI
PM26_P06B_AVISO_F_RPC_USA_PM11_PUEDE_MUTAR_PERSONAL=SI
PM26_P06B_AVISO_F_SEARCH_PATH_VACIO_CUALIFICADO=SI
PM26_P06B_AVISO_F_PRODUCCION_CONSULTADA=NO
PM26_P06B_AVISO_F_MATRIZ_PRUEBAS_PRESENTE=SI
PM26_P06B_AVISO_F_MIGRACION_REAL_PREPARADA=NO
PM26_P06B_AVISO_F_APLICADO_EN_QA=NO
```

Pendiente: (a) autorización para consultar el conteo de filas en
producción, o decisión de diseñar a ciegas; (b) aprobación de este
diseño corregido antes de preparar la migración real y su validación
aislada.
