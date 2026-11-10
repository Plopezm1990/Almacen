# Fase 4 — estado verificable de los 14 hallazgos

**Fecha de corte:** 10 de noviembre de 2026  
**Rama de auditoría:** `codex/fase4-remediacion-restante`  
**Commit verificado al cierre de esta actualización:** `cc55b0b2`
**QA:** `qjqorixtkilwsndqayyx`  
**Producción:** `flqercbgpgmmfaakrwkc`

Este documento no sustituye las fichas individuales. Sirve para impedir que una
remediación versionada o aplicada solo en QA se presente como un cierre efectivo
en producción.

## Estado resumido

| Hallazgo | Estado a esta fecha | Evidencia que lo sostiene | Límite de cierre |
|---|---|---|---|
| A-03 | Cerrado técnicamente en alcance | Migraciones, esquema, RLS, RPC y contratos; paridad normalizada de las cinco funciones APPCC | No se ejecuta una operación de negocio en producción por la regla de solo lectura |
| A-04 | Parcial, abierto | Cobertura servidor de actor y contratos pasan; no cubre todavía toda operación de negocio | Falta completar inventario/cableado de todos los flujos y medir cobertura efectiva |
| A-05 | Parcial, abierto | Guardia de inactividad y reidentificación del cliente; contratos pasan | `sessions_inactivity_timeout` y `sessions_timebox` siguen en 0 en ambos entornos; hay sesiones históricas |
| M-01 | Remediado en código y QA, abierto en alcance de entornos | PIN server-side, RLS y contratos pasan; tabla presente en QA | Producción sigue sin `private.pm11_empleado_pin`; requiere promoción autorizada |
| M-02 | Cerrado técnicamente en alcance | CSP de QA y producción medida por HTTP 200 con único origen Supabase correspondiente | No equivale a una certificación de seguridad general |
| M-03 | Corrección candidata versionada, abierto en alcance de entornos | Gate TOTP/AAL2 para Propietario, Encargado y Cajero/a; contrato estático pasa; factores medidos en cero | Falta observar enrolamiento/desafío en QA, recuperación y promoción autorizada |
| M-04 | Remediado en código, abierto en alcance de entornos | Contrato de contraseña mínima pasa y preview listo | Falta verificación autenticada y promoción; rate-limit/captcha del proveedor no queda demostrado |
| M-05 | Remediado en código, abierto en alcance de entornos | Contrato de paginación pasa y preview listo | Falta verificación autenticada y promoción |
| M-06 | Abierto | Ausencia de tarea programada medida; contrato de retención existente | No se inventa plazo: falta decisión legal/negocio y ejecución programada |
| M-07 | Remediado en código, abierto en alcance de entornos | Contrato de paginación de consultas relacionadas pasa y preview listo | Falta verificación autenticada y promoción; el caso de volumen real no se ejecuta en producción |
| M-08 | Abierto, con causa acotada | `bootstrap_owner_instalacion` tiene distinta representación textual, pero la huella semántica sin comentarios/espacios coincide en ambos entornos | Falta reproducir el flujo autenticado de instalación en QA y decidir si se exige identidad textual/procedencia; producción solo se lee |
| B-01 | Cerrado técnicamente en alcance | Fuente/hash de `importar-factura` coincidente en QA y producción; contrato server/client pasa | La tolerancia de 0,12 € no se interpreta como regla fiscal universal |
| B-02 | Remediado en código y QA, abierto en alcance de entornos | Migración y contrato pasan; índice de fecha presente en QA | Producción no tiene el índice y no se ejecuta DDL allí sin ventana autorizada |
| N-02 | Abierto, con una divergencia ACL concreta reconciliada | Inventario global sigue divergente; el ACL efectivo de `obtener_contexto_operativo` ya coincide en QA y producción (`service_role=false`, `authenticated=true`, `anon=false`) y el contrato pasa | Requiere reconciliación exhaustiva e historial/promoción controlados; no se altera producción durante la auditoría |

## Comprobaciones ejecutadas

Pasaron el 10 de noviembre de 2026:

- validador del manifiesto CI: `338` contratos activos, `355` entradas totales;
- contratos M-01 de servidor y RLS;
- contratos M-04, M-05, M-07 y B-01;
- contratos APPCC/atribución de A-03/A-04;
- contratos estáticos y de UI de A-05;
- contrato CSP de M-02;
- contrato de índice de B-02;
- contrato de reconciliación de N-02.

La comparación posterior de `bootstrap_owner_instalacion` eliminó comentarios de
línea y espacios antes de calcular la huella: QA y producción coinciden en
`88dde7f01bb445f2608f7e991838e1fa`. Esto corrige una medición anterior que
llamaba normalizada a una huella que conservaba comentarios.

Durante la revalidación del preview se reprodujo además un fallo de arranque
real: Netlify devolvía `Identifier 'activarModoEmpleado' has already been
declared`. El merge había dejado dos destructuraciones idénticas en `fuente.js`
y `source-recovery/fuente-recuperado.js`. Se eliminó la duplicación, se añadió
una aserción al contrato M-01 y el deploy posterior quedó `ready`; el navegador
ya muestra el login en lugar de la pantalla de error. Esto queda clasificado
como **reproducido y corregido** en QA/preview, no como cierre de ningún
hallazgo de producción.

La batería completa `tests/ci/ejecutar_bateria_no_db.sh` no pudo arrancar en
Windows: tanto el alias `bash.exe` de Windows como Git Bash fallan antes de
ejecutar el script por `NtCreateDirectoryObject ... 0xC0000022`. No se cuenta
como fallo de un contrato; queda como incidencia de herramienta local. Los
contratos focalizados anteriores sí se ejecutaron y pasaron.

## Medición puntual de QA y producción

La consulta de solo lectura del 10 de noviembre devolvió:

| Comprobación | QA | Producción |
|---|---:|---:|
| `private.pm11_empleado_pin` | presente | ausente |
| índice de `errores_sistema` que incluye `fecha` | presente | ausente |
| usuarios Auth | 25 | 5 |
| MD5 bruto de `bootstrap_owner_instalacion` | `029b4839e9ae2260b4e2cfed3aeb995b` | `208f62fdfc336e2c109e0997ae9d05aa` |

Los datos sintéticos de QA creados en trabajos anteriores siguen vivos y no se
borran en esta fase. No se creó ni modificó ningún dato u objeto de producción.

## Qué falta para poder decir «terminados todos»

El cierre integral exige tres cosas externas al trabajo local:

1. Una decisión de política para MFA (M-03) y de conservación de datos (M-06).
2. Una ventana de promoción controlada a producción para M-01, M-04, M-05,
   M-07 y B-02, seguida de lectura de verificación. Esta auditoría no puede
   ejecutar esa promoción porque producción es solo lectura.
3. Reconciliar las definiciones y el inventario de N-02/M-08 sin aplicar cambios
   manuales fuera del repositorio, y después medir de nuevo ambos entornos.

Hasta que esas condiciones se cumplan, el estado honrado es **3 cerrados
técnicamente en alcance, 11 abiertos o parciales**, no 14 cerrados.

## Revalidación de seguimiento posterior — 2026-11-10

La rama de auditoría quedó en `4d17e19a`, con los contratos focalizados de N-02
y el validador del manifiesto ejecutados después de la documentación adicional.
El estado global no cambia: **3 hallazgos cerrados técnicamente en alcance y
11 abiertos o parciales**.

### N-02: medición vigente

La comparación exacta de nombres en solo lectura devolvió:

| Categoría | QA | Producción | Solo QA | Solo producción |
|---|---:|---:|---:|---:|
| Relaciones públicas/privadas | 151 | 131 | 21 | 1 |
| Funciones | 493 | 431 | 73 | 11 |
| Políticas RLS | 110 | 103 | 14 | 7 |
| Triggers no internos | 62 | 57 | 9 | 4 |

El historial registra 271 versiones en QA y 175 en producción, frente a 203
prefijos de migración presentes en el clon. La ACL efectiva de
`obtener_contexto_operativo(text)` ya coincide (`service_role=false`,
`authenticated=true`, `anon=false`); la divergencia restante es global de
inventario/procedencia/historial y no se presenta como resuelta.

La migración `20261110210000_n02_legacy_infrastructure_parity.sql` también se
aplicó en QA. QA ya contiene las tres funciones de infraestructura, los dos
triggers de `updated_at` y el event trigger `ensure_rls`; las definiciones de
las dos funciones de fila y de ambos triggers coinciden literalmente con
producción, y `rls_auto_enable()` coincide semánticamente tras normalizar la
capitalización y los espacios. Producción sigue sin registrar esta migración,
por lo que el paso no se presenta como promoción ni como cierre integral de
N-02.

### M-03: medición MFA vigente

La lectura directa de `auth.mfa_factors` devuelve cero factores en QA y cero en
producción. Los proyectos tienen respectivamente 25 y 5 usuarios de Auth.
M-03 sigue abierto porque falta aprobar la política de roles, recuperación y
exigencia de `aal2`, además de implementar y reproducir el flujo TOTP.

Estas revalidaciones son **medidas**; no sustituyen una promoción a producción,
una decisión de negocio ni una prueba funcional autenticada desde navegador.

### Revalidación de promoción QA frente a producción — 2026-11-10

Una consulta de solo lectura repetida sobre ambos proyectos devuelve:

| Comprobación | QA | Producción |
|---|---:|---:|
| `private.pm11_empleado_pin` presente | sí | no |
| índice de `errores_sistema` que incluye `fecha` | sí | no |
| filas en `auth.mfa_factors` | 0 | 0 |

Los contratos de M-01, B-02, M-02 y A-03/A-04 pasan en la rama de auditoría,
pero la medición de esquema demuestra que M-01 y B-02 todavía no están
promovidos a producción. Esta evidencia es **medida** y **probada por código**;
no se presenta como cierre efectivo de producción.

## Actualización posterior — segunda paridad QA de N-02 — 2026-11-10

Se aplicó exclusivamente en QA la migración versionada
`20261110220000_n02_remaining_infrastructure_parity.sql` (resultado remoto
`success: true`). No se escribieron datos de negocio ni se tocó producción.

La migración deja en QA los cinco helpers y los cuatro triggers que ya estaban
medidos en producción. Los cuatro `md5(pg_get_triggerdef(...))` coinciden y las
cinco funciones coinciden por hash normalizado de `prosrc` tras eliminar
comentarios de línea, finales de línea y espacios. La ACL efectiva también
coincide: `es_propietario_activo()` es ejecutable por `authenticated` y
`postgres`; los otros cuatro helpers quedan restringidos a `postgres`.

Esto reduce el conjunto de funciones solo en producción de 11 a 6 y elimina
la exclusividad de los cuatro triggers tratados. Las seis funciones legacy que
siguen solo en producción (`abc_a10_reencolar_bloqueadas`,
`anular_venta_tpv`, `descontar_stock`, `descontar_stock_carrito` y las dos
sobrecargas de `registrar_auditoria`) quedan expresamente fuera por su relación
con operaciones sensibles y porque falta una decisión de alcance que permita
reconstruir firmas, permisos y contratos sin adivinar.

Estado global: **3 hallazgos cerrados técnicamente en alcance y 11 abiertos o
parciales**. N-02 mejora en un subconjunto medido, pero continúa abierto por la
divergencia global de inventario/historial, las seis funciones legacy y la falta
de promoción controlada a producción. Esta actualización no convierte una
prueba QA en acreditación de producción.

### Estado de seguimiento posterior — clasificación legacy N-02

El commit `adb6eee2` añade la clasificación read-only de las seis funciones que
siguen solo en producción. No tienen triggers ni dependencias directas en el
catálogo de producción; sus permisos efectivos son solo para `postgres`. Cuatro
contienen escrituras sobre ventas/stock y las dos sobrecargas antiguas de
auditoría insertan histórico. La rama actual contiene migraciones que revocan o
retiran esas rutas legacy, por lo que no se copian a QA sin una decisión de
procedencia y contrato de uso. N-02 sigue abierto, pero el motivo de esa
diferencia ya está medido y documentado; no queda tratado como una ausencia
desconocida.

## Corte de seguimiento de M-06 y M-08 — 2026-11-10

### M-06: retención

La medición actual confirma que QA y producción no tienen mecanismo programado
de purga (`pg_cron`, `pg_net`, `pgmq`, `cron.job` y
`cron.job_run_details` ausentes). QA tiene 1.016 filas de auditoría, 830 de
errores, 10 fichajes y 904 movimientos; producción tiene 19, 1, 0 y 5,
respectivamente. Esto es **medido** y dimensiona el alcance; no fija un plazo
legal. M-06 continúa abierto hasta que exista una decisión aprobada de
retención, excepciones, anonimización/borrado y autoridad de ejecución.

### M-08: bootstrap

En QA se midieron 14 propietarios activos y ninguna instalación determinista
completa (`0` idempotentes, `14` no idempotentes o parciales). Invocar el
bootstrap en el proyecto compartido no habría sido una reproducción limpia y
podría haber creado datos; por eso no se invocó. Esta evidencia es **medida** y
deja como requisito una base QA vacía o una rama aislada para reproducir el
camino de instalación completo. M-08 continúa abierto.

### M-04, M-05 y M-07

Los contratos estáticos de contraseña, paginación de auditoría y paginación de
consultas relacionadas pasan. La sesión QA necesaria para observar los flujos
funcionales no quedó autenticada; por tanto, esos puntos permanecen como
corrección **probada por código** y regresión **reproducida** localmente, pero
no como flujo QA **observado** en esta actualización.

El corte sigue siendo **3 hallazgos cerrados técnicamente en alcance y 11
abiertos o parciales**. Producción permanece solo lectura.

## Revalidación puntual de M-08 y N-02 — 2026-11-10

La lectura de `public.bootstrap_owner_instalacion(text,text)` devuelve el mismo
hash semántico sin comentarios ni espacios en QA y producción,
`88dde7f01bb445f2608f7e991838e1fa`, pero mantiene hashes textuales distintos:
`029b4839e9ae2260b4e2cfed3aeb995b` en QA y
`208f62fdfc336e2c109e0997ae9d05aa` en producción. La equivalencia semántica no
sustituye la reproducción de una instalación limpia ni resuelve la procedencia
de la definición.

La consulta nominal de solo lectura confirma que las seis funciones legacy
clasificadas en N-02 están presentes en producción y ninguna de ellas está
presente en QA. Se mantienen fuera de la segunda migración de paridad porque
cuatro ejecutan escrituras relacionadas con ventas/stock y dos registran
histórico; no existe todavía una decisión de procedencia, permisos y contrato
que autorice su copia.

## Seguimiento CI de M-04 — 2026-11-10

El workflow `P2-SEC — Edge tenant security candidate` falló inicialmente en el
commit `38d947bc` porque los dos handlers de creación de empleado modificados
por M-04 pertenecen también al perímetro histórico P2-SEC y la puerta no tenía
una clasificación para ese cambio acotado. El fallo ocurrió antes de ejecutar
los contratos, con el mensaje de perímetro no reconocido; no fue un fallo de
la política de contraseña ni de un contrato de tenant.

Se añadió la clasificación explícita `M04_PASSWORD_HARDENING` para el conjunto
exacto de tres archivos que forman el cambio verificable (los dos handlers y
el propio workflow). La puerta conserva la ejecución completa de los contratos
P2-SEC. La comprobación local del conjunto de rutas pasó y el workflow remoto
del commit `10e19e90` terminó con `success` (run `42904190198`, job
`edge-security`).

Esta secuencia queda clasificada como **reproducida y corregida en CI**. No
modifica el estado de producción ni sustituye la observación autenticada del
flujo de alta/cambio de contraseña en QA.

### Estado externo del commit de seguimiento

La consulta de workflows asociada al commit `9ff99b4b` devolvió 23 ejecuciones
terminadas y todas con conclusión `success`, incluida la puerta P2-SEC. Netlify
publicó el deploy preview correspondiente (`6af38b27d46f47d362ff0976`) en
estado `ready`; su escaneo de secretos no encontró coincidencias. Esto es
**observado** en los servicios CI/deploy y **reproducido** en la rama, pero no
convierte en observada la navegación autenticada que aún falta en QA.

La misma batería se repitió para el commit `6ada94f1`: 23 workflows quedaron
terminados y todos concluyeron `success`. Esta comprobación es **observada** en
CI para la nueva documentación y deja reproducida la validación del inventario
N-02 junto con la puerta completa; no cambia la clasificación de los entornos
ni acredita una promoción a producción.

## Instantánea comparativa de seguimiento — 2026-11-10

Se repitió una lectura nominal, sin escritura, contra QA y producción para
evitar que el estado dependiera de una medición antigua. El resultado fue:

| Comprobación | QA (`qjqorixtkilwsndqayyx`) | Producción (`flqercbgpgmmfaakrwkc`) |
|---|---:|---:|
| Factores MFA en `auth.mfa_factors` | 0 | 0 |
| `private.pm11_empleado_pin` | presente | ausente |
| Índice de fecha de `errores_sistema` | presente | ausente |
| `abc_cerrar_cuenta_pagada` contiene `locked_at` | sí | no |
| Huella semántica de `bootstrap_owner_instalacion` | `88dde7f01bb445f2608f7e991838e1fa` | `88dde7f01bb445f2608f7e991838e1fa` |

Esta tabla es evidencia **medida** de solo lectura en la fecha indicada. No
representa promoción entre entornos ni cierre de A-02: la función de cierre
continúa distinta precisamente en el punto `locked_at`. Tampoco convierte la
paridad semántica de M-08 en una reproducción limpia del bootstrap. La
ausencia de factores MFA mantiene M-03 abierto, y la ausencia en producción de
la tabla PIN y del índice mantiene M-01 y B-02 abiertos en alcance de
entornos.

### Recuento estructural adicional de N-02 — 2026-11-10

Se volvió a medir el inventario de los esquemas `public` y `private` sin
ejecutar funciones de negocio. QA presenta 498 funciones, 66 triggers no
internos y 151 relaciones; producción presenta 431 funciones, 57 triggers no
internos y 131 relaciones. Las extensiones instaladas coinciden en ambos
proyectos (`pg_stat_statements`, `pgcrypto`, `plpgsql`, `supabase_vault` y
`uuid-ossp`), por lo que la diferencia no se explica por ese inventario.

La consulta por firma confirma que las seis funciones legacy que siguen solo
en producción son exactamente: `private.abc_a10_reencolar_bloqueadas`,
`public.anular_venta_tpv`, `public.descontar_stock`,
`public.descontar_stock_carrito` y las dos sobrecargas antiguas de
`public.registrar_auditoria`. Todas pertenecen a `postgres` y no tienen
dependientes directos de catálogo. La sobrecarga de `registrar_auditoria` de
ocho argumentos sí existe en ambos entornos y no se cuenta como divergencia
legacy. Esta comprobación es **medida**; no justifica copiar funciones de
escritura sensibles ni permite cerrar N-02 sin reconciliar el inventario
restante y la historia de migraciones.

La historia de migraciones también sigue divergente: QA contiene 272 filas,
desde `20260904091829` hasta `20261110204740`; producción contiene 175,
desde `20260904135838` hasta `20261109201101`. En producción aparecen las
cuatro versiones reparadas manualmente del 9 de noviembre; en QA la segunda
paridad quedó registrada con la versión interna `20261110204740`. Estas
versiones no se interpretan como prueba de que las definiciones aplicadas en
ambos entornos sean iguales: esa equivalencia se comprueba por catálogo y por
contrato, no por el mero número de migración.

El commit documental posterior `96b8a600` también terminó con 23 workflows
`success` y cero fallos. La repetición confirma que el registro de la
divergencia de migraciones no rompe la batería de CI; sigue siendo una
validación de repositorio, no una promoción de base de datos.

El commit de corrección M-03 `4a61dfa9` terminó igualmente con 23 workflows
`success` y cero fallos. La barrera MFA y el contrato nuevo quedan integrados
en la puerta CI; la medición remota no equivale a haber enrolado factores ni a
haber probado una cuenta autenticada en QA.

## Actualización de seguimiento — contrato local M-08 — 2026-11-10

El commit `cc55b0b2` añadió `tests/m08/m08-bootstrap-functional-contract.mjs`.
La reproducción local aislada ejecutó el fixture post-reset y la migración del
bootstrap en PGlite, y pasó las comprobaciones de primer arranque, reintento
idempotente y rollback ante fallo de la tercera escritura:
`M08_BOOTSTRAP_LOCAL_FUNCTIONAL=PASS`.

La puerta CI asociada al commit quedó con **23 workflows `success`**, incluido
el recuento actualizado de `338/338` contratos activos (`302` Node, `31`
Postgres 16, `2` PGlite y `3` full-stack). Esta evidencia es **reproducida**
localmente y **observada** en CI; no acredita una ejecución autenticada en QA
ni permite cerrar M-08 frente a producción.
