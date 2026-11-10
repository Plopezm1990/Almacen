# Fase 4 — estado verificable de los 14 hallazgos

**Fecha de corte:** 10 de noviembre de 2026  
**Rama de auditoría:** `codex/fase4-remediacion-restante`  
**Commit verificado al cierre de esta actualización:** `adb6eee2`
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
| M-03 | Abierto | MFA medido sin factores; decisión de política y flujo de enrolamiento documentados | Falta decisión de negocio/seguridad e implementación, enrolamiento y exigencia por rol |
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

- validador del manifiesto CI: `334` contratos activos, `351` entradas totales;
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
