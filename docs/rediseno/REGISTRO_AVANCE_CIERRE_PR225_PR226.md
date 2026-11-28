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

## Registro de avance — 2026-11-28 12:58

- Responsable: Claude (cierre de #226 / #225), por decisión del usuario
- Sesión/agente: Claude Code · Sonnet 5.5
- PR: #226 / #225 (solo documentación)
- Rama: `correccion/ola0-tpv-2026-11-26`
- Commit: el de este registro (documentación)
- Objetivo: dejar escrita la decisión sobre la verificación por cargo
- Estado anterior: pendiente de que el usuario restableciera las contraseñas iniciales de las cuentas de QA de Encargado, Cajero/a y Camarero/a (H-36)
- Cambio realizado: **el usuario decide seguir sin restablecer esas contraseñas** (28/11/2026). Se cierra #226 **sin** la verificación en vivo de los caminos negativos por cargo.
  Queda registrado como **riesgo aceptado**, con lo que sí cubre y lo que no:
  - Cubierto: los contratos (PGlite y estáticos) comprueban que el servidor rechaza lo que cada cargo no puede (H-34, H-41, H-04/H-18, H-47 en la función de servidor), y la auditoría del 26/11 ya verificó en vivo la matriz por cargo anterior (Encargado, Cajero/a y Camarero/a entran sin segundo factor y el servidor rechaza lo que su cargo no puede).
  - **No** verificado en vivo con sesión: el camino negativo en pantalla de H-34 (anular venta sin permiso) y H-41 (caja no autorizada), H-32 (mensaje sin red) y H-46, y «Deshacer reparto» con un cargo sin permiso; ni el efecto de la contraseña inicial obligatoria (H-36) en un alta real.
  Si más adelante se restablecen las contraseñas, se hace la verificación y se anota aquí.
- Archivos modificados: este registro y `DESCRIPCION_PR225_PR226_PARA_PEGAR.md` (apartado «Lo que NO incluye»)
- Migraciones creadas, renombradas o eliminadas: ninguna
- Entorno afectado:
  - [x] Local
  - [ ] QA
  - [ ] Producción
- Migraciones aplicadas: ninguna
- Pruebas ejecutadas: ninguna nueva (documentación)
- Resultado: decisión registrada
- Riesgos o incidencias: un fallo de presentación en el camino negativo por cargo no se vería hasta el uso real; mitigado porque la barrera real está en el servidor y tiene contrato.
- Decisiones pendientes: D2, D3, D5, D6 y D8; reconciliar el historial de migraciones.
- Siguiente acción: humo con sesión de Propietario (PM07) en la vista previa sobre los flujos críticos (cobro, cierre de caja, historial, encargos, cuentas), si el usuario la autoriza e inicia sesión.
- Responsable de la siguiente acción: el usuario (autorizar e iniciar sesión); Claude (medir y registrar).

## Registro de avance — 2026-11-28 13:08

- Responsable: Claude (cierre de #226 / #225), con la sesión del usuario (Propietario PM07) y su autorización
- Sesión/agente: Claude Code · Sonnet 5.5
- PR: #226 / #227 (vista previa `deploy-preview-227`, mismo código que #226)
- Rama: `correccion/ola0-tpv-2026-11-26`
- Commit: el de este registro (documentación); código bajo prueba `5e4d0972`
- Objetivo: humo con sesión de Propietario sobre los flujos críticos (criterio C6 del plan)
- Estado anterior: sin humo con las correcciones de la revisión de código desplegadas
- Cambio realizado: ninguno de código. Pruebas en QA con datos de prueba mínimos. Se reactivaron y se volvieron a apagar `QA-EMP-A`, `QA-A1` y la membresía 22; sesión cerrada al terminar.
- Archivos modificados: este registro
- Migraciones creadas, renombradas o eliminadas: ninguna
- Entorno afectado:
  - [x] Local
  - [x] QA (operaciones de prueba: 2 ventas de 1,00 €, cierre de 2 cuentas de prueba; filas reactivadas y apagadas)
  - [ ] Producción
- Migraciones aplicadas: ninguna
- Pruebas ejecutadas y resultado (todas medidas también en la base de datos):
  1. «Cerrar cuentas sin actividad» (autorización por capacidad y local + corrección de H-50): cerró **2 cuentas** (las de prueba de H-31 y H-47, con reparto sobre línea cancelada), motivo `DIA_OPERATIVO_CERRADO`, con su evento; quedaron 82 abiertas; el aviso nuevo («…las de hoy se pueden cerrar cuando acabe el día operativo») sale correcto.
  2. Venta rápida en **efectivo** (1,00 €): checkout COMPLETADO, pago CONFIRMADO EFECTIVO, venta fiscal CERRADA, documento EMITIDO, cuenta CERRADA. Avisa de que el piso de venta está a 0 y la venta sale del almacén (H-15).
  3. Venta rápida con **tarjeta simulada** (1,00 €): el pago queda PENDIENTE; «Aprobar tarjeta simulada» lo confirma; «Cerrar cuenta pagada» deja cuenta CERRADA y documento EMITIDO (TPV-56).
  4. **Caja**: «Efectivo esperado €16,87» calculado por el servidor (H-24); «Otras ventas €1,00» (la de tarjeta); «Ir al cierre de la sesión de caja» lleva al cierre (H-25).
  5. **Ensayo de cierre** (como PM07, transacción deshecha): BLOQUEADO por EFECTOS_PENDIENTES (cola fiscal pendiente, normal en QA) y CONTEO_FALTANTE; **sin** VENTAS_SIN_DOCUMENTO (la sesión no tiene ventas sin documento): el bloqueo condicionado funciona sin error.
  6. **Historial**: tras recargar muestra las dos ventas nuevas (Efectivo y Tarjeta).
- Resultado: correcto en los seis puntos. Datos que quedan: 2 ventas de 1,00 € cerradas y con documento; stock del agua del almacén −2 (la venta saldría del piso, a 0); 82 cuentas abiertas (81 con pedido sin cobrar de días anteriores y 1 de reparto, a resolver por una persona).
- Riesgos o incidencias — **observaciones nuevas** (no son regresión de este cierre; ver el punto 1):
  1. **H-51 (P3) · venta rápida con tarjeta pendiente dice «El cobro está confirmado».** Con tarjeta, el pago queda PENDIENTE hasta que se resuelve, pero la pantalla muestra «El cobro está confirmado, pero la cuenta no se ha cerrado formalmente» y el aviso se queda aunque luego se apruebe y se cierre. **Existe igual en `release`** (el texto es anterior a esta rama): no lo introduce #226. Corrección propuesta: mensaje según el estado real del pago y limpiar el aviso al completarse.
  2. **H-52 (P3, sin diagnosticar) · el historial no refresca tras vender hasta recargar:** justo después de las dos ventas mostraba una sola con medio «—», 133 ventas y 356,29 € de total vigente; tras recargar mostró las dos con su medio, 122 ventas y 352,14 €.
  3. Un aviso transitorio «Este dispositivo todavía no tiene un terminal TPV asignado de forma inequívoca» apareció al elegir el terminal y no impidió operar.
- Decisiones pendientes: si H-51 y H-52 entran en este cierre o se anotan para después; D2, D3, D5, D6 y D8.
- Siguiente acción: decidir H-51 y H-52; ensayo en copia; comentario de fusión cuando se fusione #226.
- Responsable de la siguiente acción: el usuario (decidir); Claude (corregir si se decide).

## Registro de avance — 2026-11-28 13:29

- Responsable: Claude (cierre de #226 / #225), por decisión del usuario («Corrige H-51 ahora»)
- Sesión/agente: Claude Code · Sonnet 5.5
- PR: #226
- Rama: `correccion/ola0-tpv-2026-11-26`
- Commit: `3b13b7d0` (código y contrato); este registro va en el commit siguiente
- Objetivo: corregir H-51 (venta rápida con tarjeta pendiente decía «El cobro está confirmado»), hallado en el humo del 28/11
- Estado anterior: con tarjeta, el pago queda PENDIENTE hasta que se resuelve, pero la pantalla mostraba «El cobro está confirmado, pero la cuenta no se ha cerrado formalmente» y el aviso seguía aunque luego se aprobara y se cerrara la cuenta. El texto existe también en `release`.
- Cambio realizado: ayudante nuevo `avisoVentaRapidaSinCierreTpv(medio, cobro)` (solo la tarjeta con `cobroIncierto` o saldo pendiente cuenta como pendiente); la venta rápida lo usa para el error y para `paid`; el aviso y el estado «Venta rápida en curso» se limpian al aprobar o rechazar la tarjeta simulada y al cerrar la cuenta pagada desde el cobro.
- Archivos modificados: `fuente.js`, `source-recovery/fuente-recuperado.js`, `tests/rediseno/h51-venta-rapida-tarjeta-pendiente-contract.mjs` (nuevo), `tests/ci/manifiesto_clasificacion.json`, `.github/scripts/validar-manifiesto-ci.mjs`, `.github/workflows/puerta-ci-release.yml` (inventario 421 entradas, 404 activas, 353 en node)
- Migraciones creadas, renombradas o eliminadas: ninguna
- Entorno afectado:
  - [x] Local
  - [ ] QA
  - [ ] Producción
- Migraciones aplicadas: ninguna
- Pruebas ejecutadas: contrato H-51 (falla con el código anterior con 7 comprobaciones y pasa con el nuevo); `node --check fuente.js` y `node --check source-recovery/fuente-recuperado.js`; paridad (`PARIDAD_CUERPO_EXACTA=1`, `SOURCE_RECOVERY_CHECK=PASS`); `git diff --check`; batería sin base de datos 353/353 con el árbol limpio.
- Resultado: correcto en local. **No verificado todavía en pantalla** (hay que repetir una venta rápida con tarjeta en la vista previa cuando se despliegue este commit).
- Riesgos o incidencias: el cambio toca `fuente.js`; el criterio de pendiente depende de que el estado del cobro traiga `cobroIncierto` o `saldo` (lo trae: lo calcula `leerEstadoCobroF4`).
- Decisiones pendientes: H-52 (el historial no refresca tras vender hasta recargar; pista: el efectivo llama a `sincronizarStockPm07` tras cobrar y la tarjeta no); D2, D3, D5, D6 y D8.
- Siguiente acción: verificar H-51 en la vista previa con sesión; diagnosticar H-52 si se decide.
- Responsable de la siguiente acción: el usuario (iniciar sesión); Claude (medir).
