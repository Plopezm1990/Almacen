# PM26 P06a — Diagnóstico de solo lectura de los avisos F, G y H

## Estado

**Solo lectura. No se aplicó ningún cambio.** Reverifica en vivo, solo
contra el proyecto QA (`L&A Suite QA`), los tres avisos que quedaron
pendientes en `tests/pm26/P01_INVENTARIO_DIAGNOSTICO.md` (sección 9), y
presenta propuestas técnicas para cada uno sin aplicar ninguna. Ningún
cambio de esquema, RLS, Auth ni configuración en QA. `main`, Netlify,
Supabase producción, TPV: intactos.

---

## 0. Confirmación de alcance

`list_projects` confirma los tres proyectos y sus roles ya establecidos:
`L&A Suite` (producción, **no tocado**), `TPV` (inactivo, **no
tocado**), `L&A Suite QA`. `get_advisors` se ejecutó **solo** contra el
proyecto QA, en modo `security` y `performance`.

## 1. Reverificación en vivo — sin cambios desde P01

Los mismos hallazgos, con los mismos recuentos exactos que en P01, sin
ningún cambio desde entonces:

- `rls_enabled_no_policy` (INFO, 3 tablas): `operaciones_procesadas`,
  `prefiltro_limites`, `prefiltros_candidatos`.
- `authenticated_security_definer_function_executable` (WARN, 39
  funciones): todas las RPC `registrar_*`/`revertir_*`/`pm11_*`/`pm13_*`
  ya documentadas como el motor autoritativo de escritura mandatado por
  diseño — **fuera de alcance de este paquete**, ya explicado en P01 y
  no calificado como defecto.
- `auth_leaked_password_protection` (WARN, 1): desactivado en Auth de QA.
- `unindexed_foreign_keys` (INFO, 4): `auditoria_registro`,
  `movimientos_stock`, `pagos_encargo`, `suscripciones_push`.
- `auth_rls_initplan` (WARN, 4 políticas): `perfiles` (×2),
  `suscripciones_push`, `membresias_usuario`.
- `unused_index` (INFO, 8): `arqueos_caja`, `arqueos_caja_anulaciones`,
  `devoluciones_venta`, `devoluciones_proveedor`, `auditoria_registro`,
  `albaranes_empresa`, `gastos_empresa`, `pagos_encargo`.

## 2. Hallazgo que eleva la severidad del aviso F para una de las tres tablas

P01 dejó el aviso F como *"por revisar si es intencional"*, sin
distinguir entre las tres tablas. Esta ronda sí las distingue,
verificando referencias reales en `fuente.js` (no solo el nombre de la
tabla, sino sus funciones envolventes y cuántas veces se referencian más
allá de su propia definición):

- **`operaciones_procesadas`** y **`prefiltro_limites`**: **cero**
  referencias en `fuente.js`. No hay ningún `supabase.from(...)` cliente
  que las toque. Su uso, si existe, es exclusivamente desde dentro de
  funciones `SECURITY DEFINER` (que se ejecutan con los privilegios del
  propietario y no están sujetas a RLS) — RLS activado sin políticas es
  aquí coherente con "solo accesible desde el motor autoritativo", no
  bloquea nada funcional hoy. Sin cambio propuesto salvo indicación
  contraria.

- **`prefiltros_candidatos`**: **sí** está referenciada — 3 funciones
  (`crearPrefiltro`, `listarPrefiltros`, `eliminarPrefiltro`, definidas
  en `crearLogicaPrefiltros`) que hacen `supabase.from("prefiltros_candidatos")`
  con `.insert()`, `.select()` y `.delete()` respectivamente, usando
  `window.getSupabaseClient()` → `window.__nubeCliente`, **el mismo
  cliente estándar sujeto a RLS que usa el resto de la aplicación** (no
  un cliente con `service_role`). Las tres funciones se re-exportan y se
  pasan como props hasta el componente `SeleccionPersonal` (pantalla de
  selección de personal, dentro de la gestión de personal de la app,
  detrás del login normal — no un formulario público sin autenticación),
  donde `crearPrefiltro` se invoca al pulsar el botón de crear un enlace
  de prefiltro para un candidato (`"No se ha podido crear el enlace..."`
  es el mensaje de error visible si falla).

  **Conclusión**: con RLS activado y cero políticas, estas tres
  operaciones deberían estar siendo **denegadas hoy para cualquier rol**
  en QA, incluido un usuario autenticado con permisos de gestión de
  personal — no es un hallazgo cosmético ni "a revisar sin urgencia": es
  candidato a **defecto funcional real** de la función de selección de
  personal en QA.

  **Límite de esta verificación**: no se ha reproducido en vivo (no se
  ejecutó `crearPrefiltro` contra QA en esta ronda, para no escribir
  ningún dato no autorizado ni simular una sesión de usuario real) — la
  conclusión se basa en análisis estático del código y en cómo Postgres
  aplica RLS (activado sin políticas deniega todo por defecto para todo
  rol excepto el propietario/`SECURITY DEFINER`), no en una reproducción
  end-to-end.

## 3. Propuesta para el aviso F (sin aplicar)

- `operaciones_procesadas`, `prefiltro_limites`: sin cambio propuesto —
  documentar como intencional (acceso exclusivo vía RPC autoritativa).
- `prefiltros_candidatos`: **antes de escribir cualquier política SQL
  hace falta una decisión de diseño**, no basta con "permitir todo a
  `authenticated`" sin conocer el flujo real previsto. Alternativas
  posibles, sin elegir ninguna:
  1. Política `authenticated` amplia: cualquier usuario con sesión
     puede insertar/leer/borrar (más simple, coherente con que hoy no
     hay ninguna restricción de rol visible en el propio código
     cliente).
  2. Política acotada por rol (p. ej. solo `Propietario`/`Encargado`,
     igual que otras pantallas de gestión de personal) — requeriría
     confirmar contra qué relación de roles (`perfiles`/`membresias_usuario`).
  3. Política acotada a través de la propia RPC autoritativa en vez de
     política directa sobre la tabla — convertir estas tres operaciones
     en RPC `SECURITY DEFINER` como el resto del motor de escritura del
     proyecto, en vez de exponer la tabla directamente vía REST.

## 4. Aviso G — protección de contraseñas filtradas (bloqueado por herramienta)

Ninguna herramienta de escritura de Supabase disponible en esta sesión
expone la configuración del servicio Auth (`apply_migration` y
`execute_sql` operan sobre el esquema SQL de la base de datos, no sobre
la configuración de Auth; no existe ningún `update_auth_config` ni
equivalente entre las herramientas disponibles). Igual que el defecto E
con Netlify, este ajuste requiere una acción del usuario directamente en
el panel de Supabase: proyecto **L&A Suite QA** → Authentication → Sign
In / Providers → Password Security → activar "Leaked password
protection". **Nunca en el proyecto de producción sin autorización
aparte.**

## 5. Propuesta técnica para el aviso H — rendimiento (sin aplicar)

- **`unindexed_foreign_keys` (4)**: añadir un índice de cobertura por
  cada FK señalada (`auditoria_registro.actor_user_id`,
  `movimientos_stock.operation_id`, `pagos_encargo.revierte_pago_id`,
  `suscripciones_push.user_id`) — cambio de esquema, requeriría una
  migración con autorización específica.
- **`auth_rls_initplan` (4 políticas)**: reescribir cada política para
  envolver `auth.<función>()` en `(select auth.<función>())`
  (`perfiles.qa_perfil_propio_select`, `perfiles.qa_perfil_propio_update`,
  `suscripciones_push.qa_push_propio`,
  `membresias_usuario.membresia_propia_select`) — mismo comportamiento,
  mejor plan de ejecución; también requeriría migración con autorización
  específica.
- **`unused_index` (8)**: **no se propone eliminar ninguno.** Los ocho
  tienen 0 filas o muy pocas en QA (volumen de pruebas, no de
  producción) y varios llevan el prefijo `pm08_...`, consistente con
  creación deliberada y reciente en ese paquete — "sin uso" a este
  volumen es lo esperado, no evidencia de que sobren.

## 6. Qué NO se hizo

- No se aplicó ninguna migración, política RLS, ni cambio de Auth.
- No se ejecutó `crearPrefiltro`/`listarPrefiltros`/`eliminarPrefiltro`
  ni ninguna otra escritura contra QA.
- No se tocó producción, TPV, ni `main`.
- No se decidió ninguna de las alternativas de diseño para
  `prefiltros_candidatos`.
- No se eliminó ningún índice.

```
PM26_P06A_ESTADO=DIAGNOSTICO_SOLO_LECTURA_COMPLETO
PM26_P06A_CAMBIOS_APLICADOS=NO
PM26_P06A_AVISO_F_ELEVADO_A_POSIBLE_DEFECTO_FUNCIONAL=PREFILTROS_CANDIDATOS
PM26_P06A_AVISO_G_BLOQUEADO_POR_HERRAMIENTA=SI
PM26_P06A_AVISO_H_PROPUESTA_PRESENTADA_SIN_APLICAR=SI
PM26_P06A_QA_ESCRITURA=NO
PM26_P06A_PRODUCCION_TOCADA=NO
PM26_P06A_TPV_TOCADO=NO
PM26_P06A_MAIN_TOCADO=NO
```

PM25 P02 continúa PARCIAL/BLOQUEADO. Defecto E continúa PARCIAL/BLOQUEADO
(rama `release` lista, cambio de contexto en Netlify pendiente del
usuario). Pendiente de que el usuario decida: (a) qué alternativa de
diseño aplicar para `prefiltros_candidatos`, o si prefiere que se
investigue más antes de proponer SQL concreto; (b) si autoriza P06b con
las migraciones de rendimiento para H; (c) confirmación de que hará el
cambio de Auth en el panel para G.
