# Fase 4 — estado verificable de los 14 hallazgos

**Fecha de corte:** 10 de noviembre de 2026  
**Rama de auditoría:** `codex/fase4-remediacion-restante`  
**Commit verificado al cierre de esta actualización:** `146ca33b`
**QA:** `qjqorixtkilwsndqayyx`  
**Producción:** `flqercbgpgmmfaakrwkc`

Este documento no sustituye las fichas individuales. Sirve para impedir que una
remediación versionada o aplicada solo en QA se presente como un cierre efectivo
en producción.

## Estado resumido

| Hallazgo | Estado a esta fecha | Evidencia que lo sostiene | Límite de cierre |
|---|---|---|---|
| A-03 | Cerrado técnicamente en alcance | Migraciones, esquema, RLS, RPC y contratos; paridad normalizada de las cinco funciones APPCC | No se ejecuta una operación de negocio en producción por la regla de solo lectura |
| A-04 | Cerrado técnicamente en alcance | RPC común deriva el actor desde `auth.uid()`; contratos pasan; QA y producción tienen el cableado público equivalente medido | No se reconstruye el histórico sin actor; no se certifican operaciones fuera del registrador común ni una segunda sesión real de navegador |
| A-05 | Parcial, abierto | Guardia de inactividad y reidentificación del cliente; contratos pasan | `sessions_inactivity_timeout` y `sessions_timebox` siguen en 0 en ambos entornos; hay sesiones históricas |
| M-01 | Remediado en código y QA, abierto en alcance de entornos | PIN server-side, RLS y contratos pasan; tabla presente en QA | Producción sigue sin `private.pm11_empleado_pin`; requiere promoción autorizada |
| M-02 | Cerrado técnicamente en alcance | CSP de QA y producción medida por HTTP 200 con único origen Supabase correspondiente | No equivale a una certificación de seguridad general |
| M-03 | Remediado en código y aplicado en QA, abierto en alcance de entornos | Gate TOTP/AAL2 de cliente y guarda server-side en `private.la_usuario_activo()` para Propietario, Encargado y Cajero/a; contrato y definición QA pasan | Falta observar enrolamiento/desafío en QA, recuperación y promoción autorizada a producción |
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

Hasta que esas condiciones se cumplan, el estado honrado es **4 cerrados
técnicamente en alcance, 10 abiertos o parciales**, no 14 cerrados.

## Revalidación de seguimiento posterior — 2026-11-10

La rama de auditoría quedó en `4d17e19a`, con los contratos focalizados de N-02
y el validador del manifiesto ejecutados después de la documentación adicional.
El estado global no cambia: **4 hallazgos cerrados técnicamente en alcance y
10 abiertos o parciales**.

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

Estado global: **4 hallazgos cerrados técnicamente en alcance y 10 abiertos o
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

El corte sigue siendo **4 hallazgos cerrados técnicamente en alcance y 10
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

## Revalidación puntual N-02 — inventario legacy — 2026-11-10

La lectura nominal de funciones volvió a confirmar que producción contiene seis
funciones que no aparecen en QA:

- `private.abc_a10_reencolar_bloqueadas(text,text,text,uuid)`;
- `public.anular_venta_tpv(text,text)`;
- `public.descontar_stock(text,numeric,text,jsonb)`;
- `public.descontar_stock_carrito(jsonb,text)`;
- dos sobrecargas antiguas de `public.registrar_auditoria`.

Las seis funciones legacy devuelven `EXECUTE=false` para `anon`,
`authenticated` y `service_role` en la comprobación nominal actual. Esto reduce
la exposición pública, pero no elimina la divergencia de inventario ni prueba
que sus definiciones deban existir. Además, `public.obtener_contexto_operativo`
y la sobrecarga vigente de `public.registrar_auditoria` tienen MD5 distintos
entre QA y producción en esta lectura. Por tanto, N-02 continúa abierto: no se
copian, eliminan ni reactivan funciones durante esta auditoría.

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

## Revalidación nominal posterior — 2026-11-10

Se repitió una consulta de solo lectura sobre las dos bases después de la
revalidación local de M-08. No se ejecutaron RPC de negocio ni sentencias de
escritura. El resultado fue:

| Comprobación | QA | Producción |
|---|---:|---:|
| Factores MFA (`auth.mfa_factors`) | `0` | `0` |
| Tabla `private.pm11_empleado_pin` | presente | ausente |
| Índice de fecha de `errores_sistema` | presente | ausente |
| Funciones `public`/`private` | `498` | `431` |
| Relaciones `public`/`private` | `151` | `131` |
| Triggers no internos `public`/`private` | `66` | `57` |
| MD5 bruto de `bootstrap_owner_instalacion` | `029b4839e9ae2260b4e2cfed3aeb995b` | `208f62fdfc336e2c109e0997ae9d05aa` |
| MD5 semántico de `bootstrap_owner_instalacion` | `88dde7f01bb445f2608f7e991838e1fa` | `88dde7f01bb445f2608f7e991838e1fa` |

Esta comprobación es **medida** y confirma que no hay cambio de estado desde el
corte anterior: M-01 y B-02 siguen sin promoción a producción, M-03 no tiene
factores enrolados, M-08 conserva equivalencia semántica pero no reproducción
autenticada, y N-02 mantiene divergencia estructural. Producción permaneció en
solo lectura.

## Estado del PR y de la verificación remota — 2026-11-10

El trabajo versionado de esta fase continúa en el [PR #220](https://github.com/Plopezm1990/Almacen/pull/220), dirigido a `release`. El PR permanece abierto y mergeable; no se ha fusionado desde esta auditoría.

Para el commit `7b6549c2298c34e8ab859cbe37dd87deb09b0536`, la consulta de GitHub devolvió **23 ejecuciones de CI terminadas con `success`**. Netlify publicó el preview `https://deploy-preview-220--chic-entremet-9107cf.netlify.app/` en estado listo. Esta evidencia es **observada** en CI y en el servicio de despliegue; no equivale a promoción a producción ni a una observación autenticada del flujo de la aplicación.

## Advisors de Supabase — lectura adicional — 2026-11-10

Se consultaron los advisors de seguridad y salud de ambos proyectos en modo
solo lectura. Salud no devuelve lints activos en ninguno de los dos proyectos.
Seguridad devuelve:

| Aviso | QA | Producción |
|---|---:|---:|
| RLS habilitado sin política | 62 | 48 |
| `SECURITY DEFINER` ejecutable por `authenticated` | 237 | 199 |
| Protección contra contraseñas filtradas desactivada | 1 | 1 |

Esta lectura es **observada** en el servicio Supabase, no una autorización para
modificar ACL, políticas, funciones o configuración de Auth. Los avisos incluyen
objetos privados y RPC históricas cuyo acceso puede ser deliberado; por ello no
se revocan en bloque ni se incorporan artificialmente a A-05, M-03, M-04 o
N-02. La protección contra contraseñas filtradas queda registrada como riesgo
separado de Auth: no se habilitó porque requiere un cambio de configuración y
una decisión de alcance independiente.

## Corte posterior de M-08 y CI — 2026-11-10

Se volvió a ejecutar el contrato local aislado con PGlite fuera del árbol del
repositorio:

```text
M08_BOOTSTRAP_LOCAL_FUNCTIONAL=PASS
```

La consulta nominal de `public.bootstrap_owner_instalacion(text,text)` se repitió
en QA y producción. El MD5 textual sigue siendo distinto (`029b4839...` frente a
`208f62fd...`), pero la huella semántica calculada eliminando comentarios y
espacios coincide en ambos proyectos: `88dde7f01bb445f2608f7e991838e1fa`.
La equivalencia semántica es **medida**; la ejecución autenticada de instalación
en QA sigue sin estar **reproducida** ni **observada**.

El commit documental `e88ecceb525eca2ee4dc4f47ede07ab8194e3046` terminó con
`23/23` workflows de CI en `success`. Es evidencia **observada** de la batería
remota y no certifica por sí sola la promoción de bases ni el flujo autenticado.

## Corte posterior de M-04 — recuperación de contraseña — 2026-11-10

El contrato existente de M-04 se amplió para cubrir también
`restablecer-contrasena.js`, además de las dos Edge Functions y los dos bundles
que ya comprobaba. Verifica que la página de recuperación exige ocho caracteres,
no conserva el mínimo antiguo de seis y envía únicamente la contraseña validada
al endpoint de actualización. El resultado local fue:

```text
M04_PASSWORD_POLICY_CONTRACT=PASS
```

El commit `4de414ba619417ed8ff676fe2ae5307ee7b45fc8` terminó con `23/23`
workflows de CI en `success`. Esto mejora la evidencia **probada por código** y
**reproducida** de M-04; sigue sin demostrar el rate-limit/captcha efectivo del
proveedor ni sustituye la observación autenticada en QA y la promoción controlada.

## Corte posterior de M-03 — guarda `aal2` en QA — 2026-11-10

La migración versionada `20261110230000_m03_server_aal2_gate.sql` redefine la
guarda común `private.la_usuario_activo()` para exigir
`auth.jwt()->>'aal' = 'aal2'` cuando la membresía activa tenga rol
`Propietario`, `Encargado` o `Cajero/a`. El contrato M-03 y el preflight F7 pasan
en local.

La migración se aplicó únicamente en QA mediante el mecanismo de migraciones de
Supabase y quedó registrada allí como `m03_server_aal2_gate` con versión interna
`20261110223815`. La lectura posterior de la definición desplegada devolvió:

- QA: MD5 `aa3487ad081176ffab9b563420a23b1e`, guarda `aal2` presente y roles
  sensibles presentes;
- producción: MD5 `ea0763ad577c9cf11cd813768a4b8651`, sin guarda `aal2` y sin ese
  bloque de roles.

El commit `fbaf26af19cd4b3a2a84c9ba50c5bd4aa1eaf7d3` terminó con `23/23`
workflows de CI en `success`. Esto es evidencia **probada por código** y
**observada** en el esquema QA; no demuestra todavía el enrolamiento/desafío de
una cuenta, la recuperación ni la promoción a producción. Producción siguió en
solo lectura.

## Revalidación puntual M-06 — programación de retención — 2026-11-10

Una consulta de solo lectura basada en catálogos devolvió el siguiente corte:

| Comprobación | QA | Producción |
|---|---:|---:|
| Extensión `pg_cron` instalada | no | no |
| Relación de tareas `cron.job` presente | no | no |
| Funciones cuyo nombre sugiere purga/retención/anonimización | 2 | 1 |
| Columnas de fecha candidatas en `public`/`private` | 146 | 127 |

Las funciones detectadas fueron `private.plataforma_plan_purga` en ambos
entornos y `public.pm11_anonimizar_empleado` solo en QA. La presencia de una
función no prueba que se ejecute; no hay programador observado. M-06 continúa
abierto hasta que exista una política aprobada de conservación, una estrategia
de ejecución y una verificación de que la purga/anonimización respeta las
excepciones legales y operativas.

## Revisión adicional M-03 — defensa server-side — 2026-11-10

Se consultaron las definiciones de funciones propias y las políticas RLS de QA
y producción buscando una comprobación del claim de nivel de autenticación
(`aal`/`aal2`). El resultado nominal actual fue:

| Comprobación | QA | Producción |
|---|---:|---:|
| Funciones `public`/`private` que comprueban el claim `aal` | 0 | 0 |
| Políticas RLS que comprueban el claim `aal` | 0 | 0 |

La barrera M-03 versionada en `edge-auth-patch.js` sigue siendo una defensa de
cliente: consulta el perfil server-side y bloquea la interfaz hasta `aal2`, pero
no sustituye una condición server-side en las RPC o políticas que protegen las
operaciones sensibles. Esta medición **probada por código desplegado** rebaja la
confianza del cierre candidato: un cliente modificado no debe poder obtener
acceso sensible solo porque el overlay no se muestre. M-03 permanece abierto
hasta decidir el perímetro exacto de operaciones/roles y versionar una defensa
server-side compatible con ese perímetro, además del enrolamiento observado en
QA.
