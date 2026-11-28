# Vuelta atrás por migración · cierre de #225 / #226

Ninguna de las 20 migraciones tiene migración inversa. Este documento dice, para cada una, qué se haría si el lanzamiento hubiera que deshacerlo, con **sql listo cuando es simple** y
**la fuente de la verdad cuando no**. Regla general: el front se revierte al instante en Netlify (publicar el despliegue anterior); la base de datos se corrige **hacia delante** con
estos pasos o se **restaura la copia de seguridad** de antes de la ventana si el daño es de datos.

Antes de migrar hay que haber guardado: (1) la copia de seguridad de producción, (2) el volcado `05_volcar_definiciones_previas_solo_lectura.sql`.

| Clase | Migraciones | Vuelta atrás |
|---|---|---|
| A · Aditivas (funciones o tablas nuevas) | 1, 2, 3, 5, 6, 8, 10, 12 (función nueva), 18, 20 | No hace falta deshacerlas: no cambian nada si el cliente que las llama no está. Si estorbaran: `revoke execute on function <firma> from authenticated;` (sin borrar nada). |
| B · Parchean funciones vivas | 7, 9, 11, 12 (parche de la transición), 13, 15, 17, 19 | Ejecutar la `definicion` anterior guardada con el volcado 05 (es un `CREATE OR REPLACE FUNCTION` completo). |
| C · Seguridad o datos | 4, 14, 15, 16 | Ver abajo. |

## Clase C en detalle

### 4 · `20261115120000_mfa_politica_opcional` (segundo factor)
- Efecto de migrar: la exigencia de segundo factor deja de estar escrita en `private.la_usuario_activo()` y pasa a `private.mfa_politica` («sin fila = no se exige»).
- Para volver al comportamiento anterior (Propietario, Encargado y Cajero/a con `aal2`): ejecutar la `definicion` anterior de `private.la_usuario_activo()` guardada con el volcado 05
  (equivale a la de `supabase/migrations/20261110230000_m03_server_aal2_gate.sql`). La tabla `private.mfa_politica` puede quedarse.
- **Mitigación preventiva:** el script `02b_segundo_factor_alta_ESCRIBE_requiere_autorizacion.sql` en el paso 5 de la ventana evita el efecto no deseado (sin política = nadie obligado).

### 14 · `20261128100000_abc_f6_encargos_solo_funciones_y_privilegios` (privilegios)
- Efecto de migrar: quita INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER a `anon`/`authenticated` sobre `encargos_empresa` y `pagos_encargo`, borra las políticas `pm14_encargos_insert` y `pm14_encargos_update`
  y quita `TRUNCATE/REFERENCES/TRIGGER` a `anon`/`authenticated` en todo `public`.
- **Solo si el cliente antiguo tuviera que volver** (es una regresión de seguridad; el cliente nuevo no la necesita), restaurar lo que el cliente antiguo usaba:

```sql
grant insert, update, delete on public.encargos_empresa to authenticated;
grant insert, update, delete on public.pagos_encargo   to authenticated;
create policy pm14_encargos_insert on public.encargos_empresa
  for insert with check (private.la_tiene_empresa(empresa_id) and private.la_tiene_local(empresa_id, local_id));
create policy pm14_encargos_update on public.encargos_empresa
  for update using      (private.la_tiene_empresa(empresa_id) and private.la_tiene_local(empresa_id, local_id))
  with check            (private.la_tiene_empresa(empresa_id) and private.la_tiene_local(empresa_id, local_id));
```
(`TRUNCATE/REFERENCES/TRIGGER` no se restauran: ninguna pantalla los usa. Las políticas originales están en `supabase/migrations/20260908071757_pm14_p02_encargos_pagos_encargo.sql`.)

### 15 · `20261128110000_abc_f6_cuenta_empleado_password_inicial_pendiente`
- Efecto de migrar: las cuentas de empleado NUEVAS nacen con la contraseña inicial pendiente de cambio. No marca cuentas existentes.
- Para liberar a alguien bloqueado por la pantalla «Elige tu contraseña»: `delete from private.plataforma_password_pendiente where user_id = '<uuid>' and motivo = 'alta_empleado';`
  (todas las marcadas por esta migración: quitar el filtro de `user_id`, conservando `motivo = 'alta_empleado'`). Para dejar de marcar cuentas nuevas: restaurar la `definicion` anterior de `public.pm11_finalizar_creacion_cuenta_empleado` (volcado 05).

### 16 · `20261128120000_abc_f6_empresa_nueva_con_politica_mfa_propietario`
- Efecto de migrar: un disparador siembra la política de segundo factor del Propietario en las empresas NUEVAS.
- Para quitarlo: `drop trigger if exists mfa_politica_empresa_nueva_trg on public.empresas;` y `drop function if exists private.mfa_sembrar_politica_empresa_nueva();`. No borra políticas ya sembradas.

## Qué NO se puede deshacer con SQL simple
- Los datos que cambie la operación normal tras el lanzamiento (ventas, cierres de caja, cuentas cerradas con «Cerrar cuentas sin actividad»). Si el problema es de datos, la salida es la **restauración de la copia** anterior a la ventana
  (con la pérdida de lo operado desde entonces, que hay que valorar antes de decidir).
- Las cuentas que «Cerrar cuentas sin actividad» haya cerrado: cada una deja su evento `CUENTA_CERRADA_SIN_ACTIVIDAD` en `abc_eventos`, pero no hay reabrir.

## Condiciones de parada del lanzamiento (resumen)
Se vuelve atrás (front inmediato; base de datos según este documento) si, durante la ventana: una migración falla o su comprobación posterior no cuadra; no se puede entrar con segundo factor a una cuenta de Propietario real;
no se puede abrir el TPV o cobrar; o no se puede cerrar la caja sin motivo claro.
