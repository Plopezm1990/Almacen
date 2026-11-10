# Fase 4 — estado verificable de los 14 hallazgos

**Fecha de corte:** 10 de noviembre de 2026  
**Rama de auditoría:** `codex/fase4-remediacion-restante`  
**Commit verificado:** `10808a18`  
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
| M-08 | Abierto | `bootstrap_owner_instalacion` existe en ambos entornos, pero su definición desplegada difiere | Falta reconciliar la definición y demostrar el flujo de instalación en QA; producción solo se lee |
| B-01 | Cerrado técnicamente en alcance | Fuente/hash de `importar-factura` coincidente en QA y producción; contrato server/client pasa | La tolerancia de 0,12 € no se interpreta como regla fiscal universal |
| B-02 | Remediado en código y QA, abierto en alcance de entornos | Migración y contrato pasan; índice de fecha presente en QA | Producción no tiene el índice y no se ejecuta DDL allí sin ventana autorizada |
| N-02 | Abierto | Inventario de relaciones, funciones, políticas, triggers y migraciones con divergencia; contrato de reconciliación pasa | Requiere reconciliación completa y promoción controlada; no se altera producción durante la auditoría |

## Comprobaciones ejecutadas

Pasaron el 10 de noviembre de 2026:

- validador del manifiesto CI: `333` contratos activos, `350` entradas totales;
- contratos M-01 de servidor y RLS;
- contratos M-04, M-05, M-07 y B-01;
- contratos APPCC/atribución de A-03/A-04;
- contratos estáticos y de UI de A-05;
- contrato CSP de M-02;
- contrato de índice de B-02;
- contrato de reconciliación de N-02.

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
