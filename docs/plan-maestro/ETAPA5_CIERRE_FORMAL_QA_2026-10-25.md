# L&A Suite — cierre formal de la Etapa 5 en QA

**Fecha del acta:** 25/10/2026  
**Ámbito:** preview QA del PR #175, sin fusión a `release`, sin migraciones nuevas en producción y sin despliegue productivo asociado a este cierre.  
**Resultado:** **Etapa 5 cerrada formalmente en QA**, con las limitaciones y acciones posteriores que se detallan en este documento.

## 1. Decisión de cierre

La Etapa 5 se considera terminada en el entorno QA porque los recorridos de TPV, caja, recuperación de cuentas, cobros simulados, documentación de venta, ticket por correo, vale regalo, impresión simulada y puente local tienen implementación server-side/UI y evidencia de contrato suficiente para cerrar la etapa como producto QA.

Este cierre no es una autorización de producción. En particular:

- El PR #175 sigue siendo un candidato QA; no se fusiona automáticamente.
- Las migraciones de T6/T7 que se han usado para esta validación no se consideran promovidas a producción por este acta.
- La fotografía y el preflight F7 se mantienen como controles de promoción separados.
- Un proveedor real de tarjeta, Bizum real, Resend/entrega real de correo, impresora real y cajón real no quedan certificados por los simuladores.

## 2. Alcance aceptado

### T5 — operación del TPV y continuidad de la cuenta

| Capacidad | Resultado QA | Evidencia |
|---|---|---|
| Historial de ventas y apertura del ticket | Aceptada | Contrato de Etapa 5 y flujo visible de historial/reimpresión |
| Reimpresión o vista imprimible del ticket | Aceptada en software | `ETAPA5_T7_IMPRESION_CAJON_SIMULADOR_2026-10-24.md` y contrato de UI |
| Cuenta con día operativo server-side | Aceptada | Recuperación A06 y resolución de día operativo del servidor |
| Aparcar y recuperar una cuenta | Aceptada | `ETAPA5_T5_QA_FIXTURE_ARTICULO_SALA_2026-10-23.md` y RPC de recuperación |
| Recuperación cruzada empresa/local | Aceptada con guarda de ámbito | Pruebas de recuperación, pertenencia y contexto |
| Sala, mesa, responsable y traslado | Aceptada en el simulador QA | Fixtures y contratos A07 |
| Reparto de líneas/cantidades entre cuentas | Aceptada en QA | RPC server-side y contrato de UI A08 |
| Caja, entradas/retiradas y día operativo | Aceptada en QA | `ETAPA5_T5_QA_FIXTURE_ARTICULO_SALA_2026-10-23.md` y contrato CFG6 |
| Borrador local con TTL | Aceptada como contingencia local | Contrato A06; no sustituye la autoridad del servidor |

La aplicación no trata el cliente como autoridad para la recuperación: el servidor vuelve a validar empresa, local, día operativo, estado de cuenta, versiones y pertenencia antes de permitir la operación.

### T6 — cobros y documentos de venta

| Capacidad | Resultado QA | Evidencia y límite |
|---|---|---|
| Efectivo y cambio | Aceptada | Flujo server-side existente, contrato de cobro y pruebas de caja |
| Propina derivada del cambio | Aceptada en QA | `ETAPA5_T6_PROPINA_2026-10-24.md`; solo efectivo y con política fiscal/contable pendiente de asesoría |
| Tarjeta | Aceptada como simulador QA | `ETAPA5_T6_CIERRE_TARJETA_2026-10-23.md`; no es integración con adquirente |
| Bizum | Aceptada como simulador QA | `ETAPA5_T6_BIZUM_OPERATIVO_2026-10-24.md`; no conecta proveedor real |
| Estado pendiente/desconocido e incidencia B04 | Aceptada | El cobro no se marca pagado sin resolución y conserva la incidencia |
| Factura a empresa con NIF | Aceptada en modo simulador | `ETAPA5_T6_FACTURA_EMPRESA_2026-10-24.md`; no activa modalidad fiscal real |
| Ticket por correo | Aceptada en QA | `ETAPA5_T6_TICKET_CORREO_2026-10-24.md`; el envío real requiere credencial/servicio de correo y verificación de entrega |
| Vale regalo: emitir, consultar y canjear | Aceptada en QA | `ETAPA5_T6_VALE_REGALO_2026-10-24.md`; el vale se mantiene separado del cobro real ya probado |
| No doble cobro e idempotencia | Aceptada | Operaciones server-side con `operation_id`, resolución explícita y estados conservadores |

La regla de seguridad de T6 queda cerrada así: un intento de tarjeta o Bizum no pasa a pagado solo porque el navegador lo declare; necesita resolución server-side del adaptador autorizado. Los estados ambiguos permanecen bloqueados para evitar cobrar dos veces.

### T7 — impresión, cajón y puente local

| Capacidad | Resultado QA | Límite |
|---|---|---|
| Registro de impresión de ticket | Aceptada en simulador | No prueba una impresora física |
| Registro de apertura de cajón | Aceptada en simulador | El cajón se considera conectado a través de una impresora; no se ha probado hardware |
| Puente L&A pieza 1 | Aceptada como integración preparada | Requiere proceso local, token y equipo real para validación física |
| Puente L&A pieza 2 | Aceptada como intento opcional y degradable | Si el puente no responde, el registro server-side conserva la trazabilidad |

La ausencia de impresora y cajón físicos fue una limitación declarada en el prevuelo, no un fallo oculto. El software queda preparado, pero la certificación física sigue abierta.

## 3. Evidencia técnica ejecutada para el cierre

### Contratos y runtime locales

En el worktree QA se ejecutaron con resultado satisfactorio:

- `tests/plan-maestro/etapa5-t5-t6-ui-contract.mjs`
- `tests/cfg/a09-eventos-static-contract.mjs`
- `tests/cfg/a09-eventos-ui-runtime.mjs`: 22/22
- `tests/cfg/a09-panel-ui-runtime.mjs`: 22/22
- `tests/cfg/cfg6-ui-contract.mjs`
- `tests/cfg/cfg6-ui-runtime.mjs`: 68/68
- `tests/cfg/cfg6e-ui-contract.mjs`
- `tests/cfg/cfg6e-ui-runtime.mjs`: 77/77
- `.github/scripts/p2-p06/stack.mjs`
- `tests/hotfix-barrera-reset-local.mjs`
- `tests/pm12/p04-cierre-honesto-ux-contract.mjs`
- `tests/pm12/p15-kv-write-priority-contract.mjs`
- `tests/pm20/p07-revalidacion-acumulada-contract.mjs`
- `tests/cfg/f7-preflight-static-contract.mjs`: 85 migraciones, 165 objetos, 13 huellas, 92 funciones reemplazadas y 28 tablas
- Validador de manifiesto CI y sus pruebas negativas: OK

El runner Bash agregado no se pudo ejecutar en este Windows porque el `bash.exe` disponible es el alias de Microsoft Store y no pudo iniciar. La batería completa debe cerrarse con el workflow Linux de GitHub Actions; este hecho no se interpreta como un PASS de CI remoto.

### Correcciones de contratos realizadas para cerrar los bloqueos

- El perímetro P2-SEC reconoce explícitamente el hotfix aislado de `enviar-notificacion` sin ampliar el perímetro de migraciones.
- El contrato P2/P06 conserva simultáneamente la restricción por rol, la capacidad `PM13_FICHAJE_CONSULTAR` y el filtro de fichajes propios.
- El materializador F4-B02/B03 queda alineado con la etiqueta de cobro visible.
- Los contratos de A09, CFG6, CFG6e, PM12 y PM20 se actualizaron para reflejar el código actual y sus rutas/roles reales; no se eliminaron comprobaciones de seguridad.
- El preflight F7 incorpora el inventario real de las migraciones posteriores: no se excluyeron objetos T6/T8 para hacer pasar la prueba.

## 4. Pendientes que no bloquean el cierre QA

Estos puntos permanecen abiertos y deben conservarse visibles:

1. Validación física con impresora de tickets y cajón.
2. Validación del proceso Puente L&A en el mismo ordenador con hardware real.
3. Conexión con adquirente real de tarjeta y prueba de su ciclo de autorización, rechazo, timeout y webhook.
4. Conexión con proveedor real de Bizum y prueba de su reconciliación.
5. Verificación de entrega real de correo, rebotes y reintentos con la credencial de correo definitiva.
6. Decisión de asesoría sobre tratamiento fiscal/contable de propinas y activación fiscal real de facturas.
7. Matriz definitiva de permisos en la que se documente la diferencia entre `ABC_CAJA_OPERAR` y `ABC_CUENTA_OPERAR`.
8. Validación final de claves por rol y de cualquier configuración real que dependa de la Etapa 9.
9. Revisión de promoción F7, copia manual, ventana operativa, backup y autorización expresa antes de tocar producción.

## 5. Criterio de promoción posterior

La Etapa 5 solo podrá pasar de QA a una ventana de promoción cuando exista, como mínimo:

- PR congelado desde la base `release` correcta y con todos los checks obligatorios verdes.
- Preflight F7 actualizado y ejecutado en modo solo lectura contra la producción objetivo.
- Copia manual verificable de la base y del esquema antes de aplicar migraciones.
- Decisión explícita sobre qué piezas T6/T7 entran y cuáles permanecen solo en QA.
- Validación de proveedores y hardware que no puede proporcionar un simulador.
- Autorización separada para migraciones, fusión y despliegue productivo.

## 6. Siguiente paso

El siguiente paso inmediato, antes de dar por cerrado también el expediente de integración, es esperar la ejecución Linux del PR #175 y confirmar que `node-y-postgres`, `edge-security`, `f4-b02-b03`, `p2-p06` y `gate-final` quedan verdes sobre el commit final. Si algún check vuelve a fallar, se corrige la causa concreta y se repite la validación; no se fusiona ni se modifica producción mientras exista un check bloqueado.

Una vez verde el PR, la siguiente acción de planificación será abrir el expediente formal de la Etapa 6/T8 con el mismo criterio: aceptación QA, límites de simulador, permisos, evidencia y autorización independiente de producción.
