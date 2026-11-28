# Registro de avance · cierre de los PR #225 y #226

Protocolo obligatorio de documentación y coordinación entre sesiones (recibido el 28/11/2026). Aplica a #226 (`correccion/ola0-tpv-2026-11-26` → `rediseno/f0-base-qa`),
#225 (`rediseno/f0-base-qa` → `release`) y #228 (cargos y permisos personalizados, otra sesión). Cada entrada se publica también como comentario del PR correspondiente.

Reglas que esta sesión (Claude, cierre de #226/#225) adopta, tal como se pidieron:

1. Sin cambios silenciosos: fusiones, rebases, cambios de base, renumeración o aplicación de migraciones, cambios en `fuente.js` / `fuente-recuperado.js`, manifiestos o workflows de CI,
   reglas de seguridad o CSP, y cualquier cambio en QA o producción quedan registrados aquí.
2. Antes de aplicar una migración se documentan nombre, versión, proyecto, motivo, estado esperado, riesgo y quién la autorizó; después, resultado, registro generado, pruebas y diferencias.
   **No se aplica nada en QA (`qjqorixtkilwsndqayyx`) ni en producción sin coordinación previa.**
3. Esta sesión **no toca** la rama `codex/qa-suite-fixes-20261127`, el contenido del PR #228 ni sus tres migraciones renumeradas
   (`20261129100000_abc_f6_cargos_propietario_permisos_libres`, `20261129110000_abc_f6_cargos_nombres_navegacion_excepciones`, `20261129120000_abc_f6_cargos_estado_eliminacion`).
   La sesión de #228 no toca las migraciones de la franja `20261128xxxxxx` (de esta sesión).
4. **No se cambia la base de #228 ni se rebasa hasta que exista el comentario «#226 fusionado en rediseno/f0-base-qa»** con el formato acordado (commit resultante, fecha y hora, CI de #226,
   conflictos resueltos, estado de #225). Esta sesión no hará ese rebase.
5. Cuando se toque una fuente se ejecutan y se documentan: `node --check fuente.js`, `node --check source-recovery/fuente-recuperado.js`,
   `python -I source-recovery/recuperar_candidato.py --check` y `git diff --check`.
6. Esta sesión no recalcula ni edita los conteos de CI para incorporar los tests de cargos (P24, P25…): esa integración es de la sesión de #228 tras el rebase.

---

## Registro de avance — 2026-11-28 12:10

- Responsable: Claude (cierre de #226 / #225), por encargo del usuario (Plopezm1990)
- Sesión/agente: Claude Code · Sonnet 5.5
- PR: #226
- Rama: `correccion/ola0-tpv-2026-11-26`
- Commit: `5e4d0972` (subido a origen)
- Objetivo: corregir los hallazgos 1 a 5 de la revisión de código independiente de #226 (nivel alto), según el plan `PLAN_CIERRE_PR225_PR226_2026-11-28.md`
- Estado anterior: `a2ae8953` más los commits del plan; 7 hallazgos abiertos (4 importantes)
- Cambio realizado:
  1. `abc_cerrar_cuentas_sin_actividad` autoriza con `abc_tiene_capacidad(empresa, local, 'ABC_PEDIDO_CANCELAR')` (cargo de la membresía de ese local) en vez de un rol global.
  2. El bloqueo de cierre `VENTAS_SIN_DOCUMENTO` solo rige si la emisión fiscal del local está en `VALIDADA` o `ACTIVA` (`private.abc_c07d_emision_config`); ruta de actualización para QA; falla explícita si falta la tabla.
  3. `20261126120000`: la marca de idempotencia es el texto exacto insertado, no cualquier mención de `ABC_COBRO_INICIAR`.
  4. H-15: la consulta de `movimientos_stock` se pagina por `id` hasta agotar (antes `limit(2e3)` sin orden).
  5. El aviso tras «Cerrar cuentas sin actividad» ya no atribuye a todas las omitidas un pedido sin cobrar.
- Archivos modificados: `fuente.js`, `source-recovery/fuente-recuperado.js`, `supabase/migrations/20261126120000_…`, `20261126140000_…`, `20261128140000_…`, contratos `c04-…`, `c07d-…`,
  `h15-…`, `h28-h29-…` (UI y PGlite) y `h50-…`, el doc de H-28/H-29 y el plan de cierre.
- Migraciones creadas, renombradas o eliminadas: ninguna creada ni renombrada. Se **modificaron** tres migraciones que aún no han salido a producción (`20261126120000`, `20261126140000`, `20261128140000`).
- Entorno afectado:
  - [x] Local
  - [x] QA
  - [ ] Producción
- Migraciones aplicadas (en QA `qjqorixtkilwsndqayyx`, con la autorización del usuario: «Sí, corrígelo» y «Si» del 28/11; **registradas a posteriori**, antes de que existiera este protocolo):
  - `abc_f6_cerrar_cuentas_capacidad_por_local` → versión de historial `20261128100255`. Motivo: hallazgo 1. Estado esperado: la función sin `pm06_puede_gestionar_finanzas`, con `ABC_PEDIDO_CANCELAR`. Riesgo: bajo (misma firma y permisos).
  - `abc_f5_c04_bloqueo_ventas_solo_con_emision_configurada` → `20261128100311`. Motivo: hallazgo 2. Estado esperado: `private.abc_c04_bloqueos_cierre` con la condición de emisión configurada. Riesgo: bajo.
  - Producción: nada aplicado.
- Pruebas ejecutadas: PGlite 17/17; batería sin base de datos 352/352 y árbol limpio; `node --check` de las dos fuentes; paridad (`PARIDAD_CUERPO_EXACTA=1`, `SOURCE_RECOVERY_CHECK=PASS`); `git diff --check`. En QA: las dos funciones tienen la corrección, `anon` sin ejecución, `authenticated` con ejecución; la función de limpieza, llamada como PM07 en una transacción deshecha, cierra y no deja cambios.
- Resultado: correcto. CI de #226 en `5e4d0972`: 40 comprobaciones correctas, 2 omitidas (Netlify), 0 fallos.
- Riesgos o incidencias: se aplicaron las dos migraciones a QA antes de este protocolo (queda registrado aquí). Quedan los hallazgos 6 y 7 (menores): permiso propio de «Deshacer reparto» y neto con reembolso económico independiente.
- Decisiones pendientes: D2 (copia con el esquema de producción), D3 (política de segundo factor por empresa), D5 (contraseña inicial), D6 (QR fiscal) y D8 (revisor), del plan.
- Siguiente acción: descripción de #226, guiones de producción y verificación por cargo con sesiones.
- Responsable de la siguiente acción: Claude (descripción y guiones); el usuario (restablecer contraseñas de QA para la verificación por cargo).

## Registro de avance — 2026-11-28 12:30

- Responsable: Claude (cierre de #226 / #225)
- Sesión/agente: Claude Code · Sonnet 5.5
- PR: #226 (y consulta de #228, solo lectura)
- Rama: `correccion/ola0-tpv-2026-11-26`
- Commit: el de este registro (documentación)
- Objetivo: adoptar el protocolo de coordinación y verificar el estado de #228 antes de seguir
- Estado anterior: #228 sin borrador, con tres migraciones en `20261128140000/150000/160000` que colisionaban con las de #226
- Cambio realizado: solo documentación (este archivo y el plan). Verificado en GitHub y en las ramas, **sin modificar nada de #228**:
  - #228 es borrador, `headRefOid` `2e7daf2a`, base `correccion/ola0-tpv-2026-11-26`, estado de fusión «DIRTY» (esperable: nuestra rama avanzó).
  - Sus migraciones de cargos están renumeradas a `20261129100000`, `20261129110000` y `20261129120000`; al sumar las dos ramas, la única versión duplicada es `20261029200000`, que ya estaba duplicada en `release`.
  - Su preflight F7 las marca como excluidas y registra `pm13_listar_pantallas_efectivas`.
- Archivos modificados: `docs/rediseno/REGISTRO_AVANCE_CIERRE_PR225_PR226.md`, `docs/rediseno/PLAN_CIERRE_PR225_PR226_2026-11-28.md`
- Migraciones creadas, renombradas o eliminadas: ninguna
- Entorno afectado:
  - [x] Local
  - [ ] QA
  - [ ] Producción
- Migraciones aplicadas: ninguna
- Pruebas ejecutadas: `node --check` de las dos fuentes, paridad y `git diff --check` (sin cambios de código en este registro); lectura de #228 con `gh` y `git`
- Resultado: correcto; el acuerdo de coordinación coincide con el estado real de #228
- Riesgos o incidencias:
  - la regla de QA ampliada en #228 (`reset-pruebas-preview.js`, hosts `algo--chic-entremet-9107cf.netlify.app`) debe revisarse al integrar #228; no entra en el lanzamiento de #225 según el acuerdo;
  - el cambio de cargos se mantiene fuera del cierre de #225.
- Decisiones pendientes: las de la entrada anterior.
- Siguiente acción: seguir con la descripción de #226; avisar con el comentario acordado cuando #226 se fusione en `rediseno/f0-base-qa`.
- Responsable de la siguiente acción: Claude (descripción); el usuario fusiona #226 y yo dejo el comentario de fusión.

## Registro de avance — 2026-11-28 12:47

- Responsable: Claude (cierre de #226 / #225), por encargo del usuario («has lo más recomendado, actúa como experto»)
- Sesión/agente: Claude Code · Sonnet 5.5
- PR: #226 / #225 (solo documentación; no se tocó ningún PR)
- Rama: `correccion/ola0-tpv-2026-11-26`
- Commit: el de este registro (documentación)
- Objetivo: preparar los guiones de producción, la vuelta atrás y las descripciones de #225 y #226 (pasos 1.5 y 5 del plan)
- Estado anterior: sin guiones de lanzamiento; el token de GitHub no permite editar PR ni comentar
- Cambio realizado: solo documentación y guiones SQL (en `docs/`, no en `supabase/migrations`: ningún despliegue los aplica).
  `docs/rediseno/lanzamiento-produccion/` (README, informes 01, 02, 03, 04 y 05 de solo lectura, 02b que ESCRIBE y exige autorización, y VUELTA_ATRAS_POR_MIGRACION) y `docs/rediseno/DESCRIPCION_PR225_PR226_PARA_PEGAR.md`.
- Archivos modificados: los anteriores y este registro
- Migraciones creadas, renombradas o eliminadas: ninguna
- Entorno afectado:
  - [x] Local
  - [x] QA (solo lectura: se validaron los guiones con consultas SELECT; no se cambió nada)
  - [ ] Producción
- Migraciones aplicadas: ninguna
- Pruebas ejecutadas: los informes 01, 03 y 04 y las consultas de 02 y 05 se ejecutaron contra QA (solo lectura); el 01 además contra funciones sin parchear en PGlite (clasifica `LISTA_PARA_MIGRAR`, `DERIVA` y `FALTA_FUNCION`, y no da por aplicada una función que solo menciona la capacidad en un comentario). Sin cambios de código: no se tocaron las fuentes.
- Resultado: correcto. Hallazgos de la validación: 17 de las 20 migraciones constan en el historial de QA con su objeto; 3 (`rediseno_apariencia_empresa`, `rediseno_apariencia_delegaciones`, `rediseno_org33_tarifas_horario`) existen como objeto pero no en el historial; en QA-A1 hay 4 ventas cobradas en 30 días sin documento emitido; `m03_server_aal2_gate` está aplicada en QA.
- Riesgos o incidencias: el token de GitHub no permite publicar las descripciones ni los comentarios; hay que pegarlos a mano.
- Decisiones pendientes: reconciliar el historial de migraciones antes de `db push` (las 3 anteriores); D2, D3, D5, D6 y D8 del plan.
- Siguiente acción: el usuario pega las descripciones y los comentarios; verificación por cargo con sesiones; ensayo en la copia.
- Responsable de la siguiente acción: el usuario (pegar, restablecer contraseñas de QA, copia con el esquema de producción); Claude (verificación por cargo y ensayo cuando haya copia).
