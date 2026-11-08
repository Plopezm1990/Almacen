# D01 — decisión 3: blindaje en servidor de la contraseña inicial obligatoria

Fecha: 16/10/2026
Estado: **diseño**. No se ha aplicado ninguna migración en QA ni en PROD. No se ha modificado ningún archivo de código de la aplicación (`fuente.js`, `plataforma-panel.js`, `supabase/functions/*`).

Decisión de origen: `D01_DECISIONES_Y_CIERRE_2026-10-11.md`, decisión 3, respondida por Pedro el 16/10/2026: «blindarla también en el servidor», con alcance **estricto** (bloquear toda operación que pase por los filtros de permisos comunes, no solo las que mueven dinero).

## 1. Diagnóstico (verificado hoy, solo lectura, sobre `release` y PROD)

- El indicador de «debe cambiar la contraseña» vive en `auth.users.user_metadata.debe_cambiar_contrasena` (lo escribe `supabase/functions/plataforma-crear-propietario/index.ts:100`, con privilegios de servicio, al crear la cuenta del dueño).
- La única comprobación existente es en `plataforma-panel.js` (`debeCambiarContrasena()`, línea 133), que lee ese dato de la sesión del navegador y muestra una pantalla bloqueante.
- **Ninguna función del servidor comprueba hoy este indicador.** No es que falten algunas rutas: faltan todas.
- `user_metadata` es un campo que el propio usuario autenticado puede escribir desde el cliente (`supabase.auth.updateUser({ data: {...} })`), **sin necesidad de contraseña**. Cualquier cuenta recién creada puede llamar a esa función y poner `debe_cambiar_contrasena: false` sin haber cambiado nunca la contraseña. El indicador actual no sirve como fuente de verdad, aunque se comprobara en el servidor tal cual está guardado hoy.
- `perfiles` (donde sí hay RLS real) no tiene ninguna columna relacionada; la membresía y el rol («Propietario») se guardan en `public.membresias_usuario`.
- No hay hoy ningún disparador (`trigger`) sobre `auth.users` en PROD (comprobado: cero filas en `pg_trigger` para esa tabla).
- `private.abc_tiene_capacidad` es la función de permisos del TPV/ABC; se llama **122 veces en 39 migraciones** — es el filtro común más usado de las operaciones de venta, caja, cocina, pedidos, etc.
- La familia `plataforma_kv_permitido` / `plataforma_mov_permitido` / `plataforma_push_*` (F4/F4e) cubre los permisos de `almacen_kv`, `movimientos_registro` y `suscripciones_push`.
- No existe un único punto de entrada para «toda operación»: hay más de 150 funciones RPC expuestas a `authenticated`, repartidas en varios subsistemas, y algunas tienen su propia comprobación de permisos sin pasar por las funciones anteriores.

## 2. Diseño

### 2.1 Indicador que el usuario no pueda tocar

```sql
create table private.plataforma_password_pendiente (
  user_id   uuid primary key references auth.users(id) on delete cascade,
  creado_en timestamptz not null default now(),
  motivo    text not null default 'alta_propietario'
);

alter table private.plataforma_password_pendiente enable row level security;
revoke all on table private.plataforma_password_pendiente from public, anon, authenticated;
-- Sin políticas: mismo patrón que private.plataforma_admins y el resto de private.*.
-- Solo accesible desde funciones SECURITY DEFINER.
```

### 2.2 Detección real del cambio de contraseña

Patrón documentado oficialmente por Supabase (el mismo que usan para crear perfiles automáticos al alta): un disparador sobre `auth.users` que reacciona cuando cambia de verdad `encrypted_password`, no cuando alguien lo dice desde el cliente.

```sql
create or replace function private.plataforma_password_cambiada_trg()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from private.plataforma_password_pendiente where user_id = new.id;
  return new;
end;
$$;

create trigger plataforma_password_cambiada_trg
after update of encrypted_password on auth.users
for each row
when (new.encrypted_password is distinct from old.encrypted_password)
execute function private.plataforma_password_cambiada_trg();
```

No depende de que el cliente avise «ya la cambié»: lo confirma el propio motor de autenticación de Supabase. Elimina también el problema del JWT desactualizado (no se guarda nada en el token de sesión; la comprobación siempre lee la tabla en el momento de la llamada).

### 2.3 Función de comprobación

```sql
create or replace function private.plataforma_debe_cambiar_password(p_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from private.plataforma_password_pendiente where user_id = p_user
  )
$$;
```

### 2.4 Dónde se crea la fila pendiente

Preferido: dentro de `plataforma_asignar_propietario` (función SQL ya existente, misma transacción donde se crea la membresía y el perfil), en vez de modificar la función de borde en TypeScript. Evita tocar y volver a desplegar `plataforma-crear-propietario`, y mantiene el cambio dentro de una sola migración SQL:

```sql
insert into private.plataforma_password_pendiente(user_id)
values (p_user_id)
on conflict (user_id) do nothing;
```

`user_metadata.debe_cambiar_contrasena` se deja de usar como fuente de verdad. Se recomienda, en la misma migración, dejar de escribirlo en la función de borde (es un cambio de una línea en `plataforma-crear-propietario/index.ts`) para no mantener dos indicadores que puedan desincronizarse; es de baja prioridad y no bloquea nada si se pospone.

### 2.5 Dónde se aplica el bloqueo (alcance estricto, elegido por Pedro)

Se añade la comprobación al principio de las funciones compartidas, antes de cualquier otra lógica:

**`private.abc_tiene_capacidad`** — justo después de `if auth.uid() is null then return false; end if;`:

```sql
if private.plataforma_debe_cambiar_password() then return false; end if;
```

**`private.plataforma_kv_permitido`, `plataforma_mov_permitido`, `plataforma_push_*`** — mismo patrón, devolviendo `false`/denegando al principio.

Esto no cambia la firma ni el contrato de ninguna de las funciones (siguen devolviendo `boolean`), así que los 122+ puntos que ya las llaman seguirán funcionando igual; simplemente empezarán a denegar cuando la contraseña inicial esté pendiente.

**Lo que queda fuera de esta primera entrega:** las funciones que no pasan por estos filtros comunes y tienen su propia comprobación (parte de personal, algunas de plataforma/configuración). Se recomienda una auditoría aparte, por orden de riesgo, como subpunto siguiente — no se incluye aquí para no mezclar un cambio pequeño y revisable con una revisión de 150 funciones.

**Sin riesgo de bloqueo sin salida:** iniciar sesión, cerrar sesión, leer el perfil propio (`perfiles`, política ya existente `auth.uid() = user_id`) y cambiar la contraseña (llamada nativa de Supabase Auth, no pasa por estas funciones) siguen disponibles aunque el indicador esté activo.

### 2.6 Aviso claro para quien SÍ ha iniciado sesión legítimamente

```sql
create or replace function public.plataforma_mi_estado_password()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'ok', true,
    'pendiente', private.plataforma_debe_cambiar_password()
  )
$$;

revoke all on function public.plataforma_mi_estado_password() from public, anon;
grant execute on function public.plataforma_mi_estado_password() to authenticated;
```

La pantalla pasaría a consultar esta función tras iniciar sesión, en vez de fiarse de `user_metadata` como hace hoy. Es un cambio de pantalla (`plataforma-panel.js`), que se dejaría para un subpunto de código distinto del de la migración, con su propio contrato de interfaz y su propia prueba en QA.

## 3. Errores previsibles, concurrencia y recuperación

- **Reintento del cambio de contraseña:** si `updateUser` se llama dos veces con la misma contraseña nueva, el disparador compara `encrypted_password`; si ya coincide con la anterior, no hay cambio real que detectar la segunda vez, pero tampoco hace falta: la fila ya se borró en el primer intento.
- **Falla el disparador:** si por cualquier motivo el `trigger` no se ejecuta, la fila pendiente no se borra y el dueño queda bloqueado aunque haya cambiado la contraseña. Mitigación: función de desbloqueo manual para el administrador de la plataforma (`plataforma_liberar_password_pendiente(p_user_id)`, solo Propietario/administrador de plataforma), para no depender de SQL manual si algo falla.
- **Cuenta de administrador de la plataforma:** no se crea con `plataforma_asignar_propietario`, así que nunca tiene fila pendiente; no se ve afectada.
- **Migraciones futuras que reemplacen `abc_tiene_capacidad` o `plataforma_kv_permitido`:** como ya ocurre con otras comprobaciones de huella (el patrón de este repositorio), hay que recordar conservar esta línea al sustituir esas funciones. Se documenta en el comentario de la migración, igual que se hizo con otras piezas (F4d añadiendo el filtro de empresas vigentes a tres funciones a la vez).

## 4. Pruebas previstas (contrato SQL con `ROLLBACK`, antes de aplicar nada)

| # | Caso | Esperado |
|---|---|---|
| T1 | Fila pendiente creada; se llama `abc_tiene_capacidad` con un rol y capacidad válidos | `false` |
| T2 | Se simula `update auth.users set encrypted_password = ...` para el mismo usuario | La fila pendiente desaparece |
| T3 | Tras T2, se repite la misma llamada de T1 | Devuelve según el rol real (ya no bloquea) |
| T4 | Con fila pendiente: iniciar sesión, leer `perfiles` propio, llamar `plataforma_mi_estado_password()` | Todo accesible; `pendiente: true` |
| T5 | Con fila pendiente: `plataforma_kv_permitido` para una clave que el rol sí podría tocar | Deniega |
| T6 | Un usuario `authenticated` intenta leer o escribir `private.plataforma_password_pendiente` directamente | Rechazado (sin política) |
| T7 | `plataforma_debe_cambiar_password()` llamado para un `user_id` que no es el propio, desde una sesión normal | A decidir: restringir a uso interno o exigir que el llamador sea administrador de plataforma |
| T8 | Administrador de plataforma: nunca tiene fila pendiente | `abc_tiene_capacidad` no se ve afectada por este cambio para esa cuenta |
| T9 | Regresión: los contratos existentes de `abc_tiene_capacidad`, pieza 5, F4/F4e siguen en verde sin fila pendiente | Sin cambios de comportamiento previo |

## 5. Plan de aplicación (subpuntos, con pausa y evidencia en cada uno)

1. **Diseño** (este documento) — hecho.
2. **Contrato SQL local** con los 9 casos de la tabla anterior, en una transacción con `ROLLBACK`, sin tocar QA ni PROD.
3. **Migración** (tabla + disparador + función de comprobación + inserción en `plataforma_asignar_propietario` + modificación de `abc_tiene_capacidad` y la familia `plataforma_kv_*`), con comprobación previa de huella de las funciones que se sustituyen (mismo patrón que F4d/F4e).
4. **Aplicar en QA** — requiere autorización.
5. **Prueba en QA**: crear un dueño de prueba, confirmar que queda bloqueado, cambiar su contraseña, confirmar que se desbloquea, y repetir los contratos de regresión de ABC/pieza 5/F4e.
6. **Cambio de pantalla** (`plataforma_mi_estado_password` en vez de `user_metadata`) — subpunto de código aparte, con su propio contrato de interfaz.
7. **Aplicar en PROD** — requiere autorización escrita específica, con foto previa de solo lectura.
8. **Auditoría de las funciones que no pasan por los filtros comunes** — subpunto posterior, fuera de esta entrega.

## 6. Decisión pendiente antes de escribir la migración

T7 de la tabla de pruebas deja una pregunta abierta: ¿quién puede consultar si **otra** persona tiene la contraseña pendiente? Por defecto se propone que solo el administrador de la plataforma pueda hacerlo (para un panel de soporte, por ejemplo), y que cualquier otra persona solo pueda consultar la suya propia. Se decide en el subpunto 2 (contrato SQL), no bloquea el resto del diseño.
