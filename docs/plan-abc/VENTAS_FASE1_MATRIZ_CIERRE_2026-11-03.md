# L&A Suite — Fase 1: matriz de cierre de cobros y devoluciones

Fecha: 2026-11-03  
Plan de referencia: `1-1-Plan_mejoras_Ventas_Codex.docx`, sección 4  
Rama: `codex/ventas-release-integration`  
Proyecto QA: `qjqorixtkilwsndqayyx`  
Estado global: **parcial; no aprobada todavía**. El recorrido QA de pago parcial, saldo restante, cambio y cierre económico ya tiene evidencia integrada. La nueva prueba de tarjeta en una cuenta QA limpia registra correctamente un único pago/intento `PENDIENTE`, pero no acredita confirmación del proveedor; siguen abiertos la matriz completa de cobro incierto, devoluciones persistentes, concurrencia QA, segundo usuario/terminal, proveedor de tarjeta y el gate 6A fuera de alcance de esta rama.

## 1. Alcance de la Fase 1

La Fase 1 del plan original cubre:

1. incertidumbre y resolución de cobros;
2. pagos parciales, saldo, efectivo y cambio;
3. devoluciones y reembolsos;
4. aislamiento por empresa/local/rol y concurrencia.

La aceptación exige que los efectos económicos sean autoritativos del servidor, idempotentes, auditables y sin sobrecobros ni reembolsos superiores al dinero confirmado. Un contrato estático o un servidor falso no sustituye por sí solo la prueba económica en QA.

No se utilizará como fixture de escritura el intento histórico de 0,32 € ni se forzará su estado. Los nuevos casos deben usar cuentas y operaciones QA identificables y, cuando sea posible, rollback o una cuenta de ensayo.

## 2. Estado ejecutivo

| Bloque | Estado | Evidencia disponible | Falta para aprobar |
|---|---|---|---|
| 1A Cobro incierto/simulador | Parcial | Lectura de cobros 25/25, correcciones de lectura, contratos de reintento y una tarjeta QA limpia con un único intento `PENDIENTE` | Confirmación/rechazo/timeout controlados, replay, respuesta fuera de orden e integración con proveedor; no repetir el intento actual |
| 1B Pago parcial/cambio | Parcial avanzado | QA confirma 1,00 €, saldo 0,32 €, segundo pago 0,32 €, cambio 0,68 € y saldo cero; sobrepago sin mutación | Replay/concurrencia y segundo terminal; queda observación UX del rechazo de sobrepago |
| 1C Devoluciones/reembolsos | Parcial técnico | D13 50/50 y contratos B08 de separación económica/stock pasan | Prueba QA persistente de dinero confirmado, máximo, repetición, concurrencia y permisos con segundo usuario |
| 1D Aislamiento/concurrencia | Pendiente de cierre | Contratos de permisos, replay y ACL pasan; P07 mantiene gate integrado pendiente | Evidencia integrada por empresa, local, rol, sesión y dos terminales |
| Cierre Fase 1 | No aprobado | Hay piezas verificadas | Falta completar la batería y consolidar evidencias económicas |

## 3. Pruebas ejecutadas en esta preparación

Se ejecutaron en la rama actual:

```text
node tests/f4/b05/b05-ui-contract.mjs             PASS
node tests/f4/b05/b05-phase1-regression.mjs       PASS
node tests/cfg/cobro-lectura-static-contract.mjs  PASS
node tests/cfg/cobro-lectura-runtime.mjs          PASS (25/25)
node tests/cfg/d13-static-contract.mjs            PASS
node tests/cfg/d13-ui-contract.mjs                PASS
node tests/cfg/d13-ui-runtime.mjs                PASS (50/50)
```

Para los dos runtime se usaron únicamente dependencias temporales React/jsdom y se indicó explícitamente el archivo `source-recovery/fuente-recuperado.js`; no se modificó el repositorio ni se accedió a producción.

Estas pruebas demuestran que los adaptadores y contratos aislados funcionan, pero no cierran por sí solas la aceptación de cobros y devoluciones reales en QA.

## 4. Matriz detallada de aceptación

### 4.1 Cobro incierto y simulador — VEN-003

| Caso | Resultado esperado | Evidencia actual | Estado |
|---|---|---|---|
| Cobro confirmado | Cuenta pagada, saldo cero, un solo efecto económico | Contratos F4 y correcciones de lectura disponibles | Pendiente de consolidación QA |
| Cobro rechazado | Cobrado permanece sin aumentar y el saldo sigue pendiente | Contrato/servidor simulado | Pendiente de aceptación QA |
| Timeout | Consultar el mismo intento antes de decidir o reintentar | Reintento determinista implementado | Pendiente de prueba controlada |
| Confirmación tardía | Un único pago confirmado después de recargar | Diseño y adaptadores preparados | Pendiente |
| Respuesta repetida | Replay exacto devuelve el resultado inicial | Contratos de idempotencia | Pendiente de evidencia QA integrada |
| Respuesta fuera de orden | No se degrada un estado confirmado ni se duplica caja | Contratos parciales | Pendiente |
| Intento desconocido | No se convierte automáticamente en rechazo o cobro | Contrato previsto | Pendiente |
| Intento histórico de 0,32 € | Solo consultar y resolver por procedimiento oficial | Identificado en el plan | No usar como fixture de escritura |

La corrección de lectura de `pago_intentos` está documentada en `F6_COBRO_LECTURA_INTENTOS_RESULTADO_2026-10-03.md` y sus pruebas aisladas pasan. Eso demuestra que la pantalla ya no hace una lectura directa prohibida, pero no prueba todos los estados de proveedor del plan.

### 4.2 Pago parcial, saldo y cambio — VEN-011

| Caso | Resultado esperado | Estado |
|---|---|---|
| Cuenta 1,32 € sin cobro | Pendiente 1,32 € y no cobrado 1,32 € | Preparado; falta evidencia QA final |
| Aplicar 1,00 € | Cobrado 1,00 €, pendiente 0,32 € | PASS QA persistente en el fixture de ensayo |
| Siguiente pago | Proponer 0,32 €, no conservar un importe antiguo incorrecto | PASS QA; el panel y el servidor trabajaron con el saldo restante |
| Aplicar 1,00 € a saldo 0,32 € | Rechazo autoritativo sin mutación | PASS QA; queda observación de UX sobre mensaje/código visible |
| Entregar 1,00 € para aplicar 0,32 € | Cambio 0,68 € sin sobreaplicar | PASS QA final; el servidor aceptó el cambio normalizado a céntimos |
| Saldo cero | Deshabilitar acciones incompatibles | PASS contractual y PASS QA de estado económico |
| Dos terminales | Solo uno liquida el saldo | Contratos de versión/estado | Pendiente de prueba QA concurrencia |

No se debe confundir el efectivo entregado con el importe aplicado a la cuenta.

### 4.3 Devoluciones y reembolsos — VEN-010

| Caso | Resultado esperado | Evidencia actual | Estado |
|---|---|---|---|
| Sin cobro confirmado | No se genera salida económica | D13 estático/runtime 50/50 | PASS de contrato; QA persistente pendiente |
| Cobro parcial | Solo se puede reembolsar la parte confirmada | Contrato D13 | Pendiente de fixture QA |
| Pago incierto | No cuenta como importe disponible | Diseño F1 | Pendiente |
| Reembolso superior | Rechazo sin mutación | Contratos M03C/D13 | Pendiente QA |
| Repetición | Un solo reembolso y un solo efecto | Contratos M03C | Pendiente QA |
| Concurrencia | Dos solicitudes no superan el máximo | Contratos M03C | Pendiente QA |
| Reembolso efectivo | Un movimiento negativo de caja, una sola vez | Contratos y guía de preview | Pendiente de verificación QA |
| Reembolso tarjeta | No se confirma sin resultado de proveedor | Diseño y simulador | Fuera de aceptación real sin proveedor |
| Stock | Reembolso económico no repone stock automáticamente | Contrato técnico B08 | Debe verificarse en QA |
| Permisos | Propietario/Encargado según matriz; Cajero con aprobación | D13 runtime 50/50 | Falta prueba con segundo usuario real |

La guía existente de QA advierte que una devolución efectiva altera caja y queda auditada. Por ello no se ejecutará un caso persistente sin fixture y autorización delimitadas.

### 4.4 Aislamiento y concurrencia — 1D

Debe cubrirse con consultas y operaciones autenticadas, no solo con RLS habilitada:

- empresa correcta frente a empresa ajena;
- local correcto frente a local ajeno;
- rol autorizado frente a rol insuficiente;
- sesión caducada;
- terminal no operativo;
- RPC directa con parámetros manipulados;
- dos terminales sobre el mismo saldo;
- dos solicitudes de devolución sobre el mismo pago;
- reintento con mismo `operation_id` y mismo cuerpo;
- mismo `operation_id` con cuerpo diferente;
- cuenta cerrada o pago ya resuelto.

Estado: **pendiente de consolidación de la batería Fase 1**.

## 5. Bloqueos y decisiones necesarias

### Bloqueo 1 — Proveedor de tarjeta

El plan no autoriza declarar un datáfono real como probado. La tarjeta simulada no sustituye a un proveedor ni a una certificación del dispositivo. La aceptación actual debe limitarse al simulador y declarar esa exclusión.

### Bloqueo 2 — Caso histórico de 0,32 €

El intento histórico se conserva para diagnóstico. No se debe confirmar mediante SQL, borrar, crear otro cobro para compensarlo ni ajustar caja para que cuadre. Si el simulador tiene una operación oficial de recuperación, se probará en una acción separada y con trazabilidad.

### Bloqueo 3 — Segundo usuario real

La aprobación por otro rol/usuario no se da por probada usando el mismo usuario Propietario. Hace falta un segundo usuario QA autorizado o se debe declarar el caso como bloqueado y conservar la cobertura automática como evidencia secundaria.

### Bloqueo 4 — Devolución persistente

Una devolución confirmada altera el histórico y la caja QA. Debe ejecutarse solo sobre un cobro de fixture creado expresamente, con importe y motivo documentados, y no sobre el pago histórico de la auditoría.

### Bloqueo 5 — Cierre de estados

La Fase 3 de métricas y documentos depende de que “cobrado”, “pendiente”, “pago incierto”, “reembolsado” y “documento” tengan estados aceptados. Sin ese contrato no se debe corregir la agregación de indicadores de forma definitiva.

## 6. Orden recomendado para cerrar Fase 1

1. Ejecutar primero pruebas no destructivas de lectura de estado y permisos.
2. Crear una cuenta QA de ensayo con un importe pequeño y claramente identificado.
3. Probar cobro parcial en efectivo y comprobar saldo/cambio.
4. Probar rechazo de sobrepago y replay del mismo intento.
5. Probar timeout/respuesta tardía del simulador con red controlada.
6. Probar devolución únicamente sobre el importe confirmado.
7. Comprobar que el reembolso no repone stock automáticamente.
8. Repetir con dos operaciones concurrentes en la medida permitida por QA.
9. Consultar después de cada caso pagos, caja, reembolsos, stock, eventos y operaciones.
10. Consolidar la evidencia y decidir si Fase 1 queda aprobada, aprobada con exclusiones o bloqueada.

No se debe iniciar la Fase 3 funcional hasta completar al menos los contratos de estados y límites económicos de los puntos 1A, 1B y 1C.

## 7. Criterio de cierre de Fase 1

La fase solo podrá marcarse como terminada cuando:

- no exista sobrecobro;
- un pago incierto no se trate como confirmado;
- el replay no duplique efectos;
- el saldo parcial sea correcto;
- el cambio sea correcto;
- el reembolso no supere el dinero confirmado;
- dos solicitudes concurrentes no excedan el límite;
- los permisos sean rechazados también en servidor;
- dinero, stock y mercancía sigan reglas separadas;
- la auditoría conserve actor, operación, motivo y resultado;
- el caso histórico quede resuelto por procedimiento soportado o documentado como pendiente;
- las exclusiones de proveedor real, fiscalidad o hardware estén expresamente aceptadas;
- las pruebas de UI, backend y QA no se contradigan.

## 8. Resultado y siguiente paso

Resultado de esta matriz: **Fase 1 permanece abierta, con contratos técnicos y una parte de la aceptación económica QA aprobados, pero sin cierre completo de la batería**.

Siguiente acción: completar sobrepago, cambio, replay/concurrencia y segundo terminal sobre fixtures QA separadas, sin tocar el intento histórico de 0,32 €. Después se decidirá si hace falta una prueba persistente de devolución o si el entorno debe quedar bloqueado por falta de segundo usuario/proveedor.

## 9. Ejecución QA del bloque 1B — 2026-11-03

Resultado de esta sesión: **bloqueada antes de iniciar cualquier cobro**.

Comprobaciones realizadas en la URL QA de la rama de integración:

- La sesión autenticada abrió el TPV de `QA Empresa A, S.L. · Local A1`.
- El modo `Venta rápida` no era válido para esta prueba: registra una venta directa y no ejercita el flujo B05 de cuenta abierta, saldo y pagos sucesivos.
- El flujo B05 se encontró en `Sala / restaurante`, con una cuenta operativa ya existente de 1,32 €.
- La consulta de soporte QA, que es solo lectura, devolvió: cuenta `ABIERTA`, estado `PARCIALMENTE_PAGADO`, saldo `0,32 €`; pago en efectivo `CONFIRMADO 1,00 €`; intento de tarjeta `CANCELADO 0,32 €`; incidencia `RESUELTA · CANCELADO`.
- Esa cuenta no se reutilizó y no se pulsó `Cobrar efectivo`, `Iniciar tarjeta simulada`, `Completar pago mixto` ni ningún control de confirmación financiera.
- Se comprobó la mesa `QA-A1-01`, que aparecía libre. El diálogo `Asignar esta cuenta` permaneció abierto y no produjo una nueva cuenta observable; se cerró sin registrar una operación económica.
- Se creó en QA el empleado `QA Cajero F1`, con puesto `Cajero QA Fase 1`, nivel `Cajero/a` y PIN QA configurado. La ficha apareció confirmada en `Personal`; no se creó una cuenta de acceso externa ni se tocó producción.
- Se verificó el acceso al modo empleado con `QA Cajero F1`. El TPV mostró el mismo contexto de cuenta `92e6c4b8-1e71-4b17-87e9-6c1fd6d25ce2`, la mesa `QA-A1-01` siguió libre y no apareció ninguna acción de cuenta nueva; se salió de nuevo a modo propietario sin realizar operaciones económicas.
- Se volvió a preparar la asignación de `QA-A1-01` con un comensal, pero el contexto activo seguía siendo la cuenta histórica `92e6c4b8-1e71-4b17-87e9-6c1fd6d25ce2`. El botón `Asignar esta cuenta` no produjo cambio visible. El código actual impide asignar una cuenta que ya tiene una mesa activa (`cuenta_ya_asignada_mesa`), por lo que no se forzó una reasignación ni se reutilizó esa cuenta.
- La revisión estática confirma que `abc_asignar_cuenta_mesa` solo asigna una cuenta ya abierta y no crea una cuenta nueva; la apertura de cuenta se realiza por `abc_abrir_cuenta`. En la fixture actual no hay una acción visible para iniciar esa apertura desde un contexto vacío.

Por tanto, en esta sesión quedan verificadas la accesibilidad del TPV, la lectura del estado servidor, la creación del usuario QA y el bloqueo preventivo del caso histórico, pero **no** quedan aprobados la creación de una cuenta limpia, el pago parcial, el saldo de 0,32 €, el cambio, el rechazo de sobrepago ni la concurrencia. No se generó un cobro nuevo y no se modificó el histórico financiero.

## 10. Desbloqueo imprescindible

Para ejecutar 1B sin contaminar datos existentes hace falta una de estas dos condiciones:

1. que QA deje disponible una cuenta nueva de Sala, identificada expresamente para la prueba, con total 1,32 € y sin pagos previos; o
2. que QA exponga en la fixture una acción autorizada para abrir una cuenta nueva (`abc_abrir_cuenta`) desde el TPV, o proporcione una cuenta de ensayo limpia y asignable. El usuario/rol de cajero ya está creado: `QA Cajero F1`.

Con ese fixture se ejecutará, en orden, `1,00 € efectivo → saldo 0,32 € → rechazo de sobrepago → cambio → consulta servidor → segundo terminal`. El clic que confirme el primer cobro requerirá confirmación inmediata de la operación financiera en QA; la autorización general de pruebas no se interpreta como confirmación de cada cobro.

## 11. Pruebas de contrato ejecutadas en esta sesión

Comandos ejecutados sobre la rama `codex/ventas-release-integration-208`:

| Prueba | Resultado | Interpretación |
|---|---|---|
| `node tests/f3/a07/a07-1-ui-contract.mjs` | PASS | La asignación real de mesa y la separación A07.1/A07.2 siguen presentes. |
| `node tests/f3/a07/a07-2-ui-contract.mjs` | FAIL | El contrato exige no encontrar ningún `placeholder: "UUID..."`; el fallo lo provoca el campo de consulta de soporte QA, no el flujo de asignación. Queda pendiente decidir si el contrato debe excluir ese campo de solo lectura o si debe cambiar la UX. |
| `node tests/f4/b05/b05-ui-contract.mjs` | PASS | El contrato de UI B05 sigue presente. |
| `node tests/f4/b05/b05-phase1-regression.mjs` | PASS | La regresión técnica de Fase 1 pasa. |
| `node tests/f4/b04/b04-qa-support-readonly-contract.mjs` | PASS | La consulta de soporte QA mantiene carácter solo lectura. |
| `node tests/f4/b07/b07-simulated-fixture.mjs` | PASS | El fixture del simulador devuelve `CONFIRMADO` con importe EUR esperado. |

Estos PASS son evidencia estática/contractual; no sustituyen la prueba económica persistente que sigue bloqueada por falta de una cuenta limpia iniciable desde la fixture actual.

## 12. Implementación autorizada para desbloquear una cuenta QA limpia — 2026-11-03

Se implementó en esta rama QA, sin migraciones, despliegue, merge ni cambios en producción, una acción visible `Nueva cuenta` en el modo `Sala / restaurante` del TPV.

La implementación no cancela ni modifica la cuenta anterior. Antes de cambiar el contexto local comprueba:

- que no exista una operación A02 pendiente de reintento;
- que el estado de cobro pueda leerse desde el servidor;
- que no haya importe confirmado;
- que no haya intentos inciertos o activos;
- que no haya pagos activos;
- que no haya un checkout abierto.

Si alguna comprobación falla, la cuenta actual permanece seleccionada y se muestra un bloqueo. Si todas pasan, el contexto local anterior se archiva en una clave separada, se limpia únicamente la referencia de cuenta operativa activa del navegador y la próxima acción `Guardar pedido` podrá abrir una cuenta nueva mediante el flujo A02 existente. El servidor no recibe una orden de cancelación, cierre, reembolso ni cobro durante este cambio.

La cuenta archivada queda limitada a los últimos 20 contextos por empresa/local. Esto conserva la trazabilidad local de la cuenta anterior; la recuperación operativa detallada seguirá requiriendo una función explícita de selección/recuperación, que no se introduce en este cambio.

Pruebas nuevas y repetidas:

```text
node --check fuente.js                              PASS
node --check source-recovery/fuente-recuperado.js   PASS
node tests/f4/b05/b05-new-account-ui-contract.mjs   PASS
node tests/f4/b05/b05-ui-contract.mjs              PASS
node tests/f4/b05/b05-phase1-regression.mjs        PASS
node tests/f3/a07/a07-1-ui-contract.mjs             PASS
node tests/f4/b04/b04-qa-support-readonly-contract.mjs PASS
node tests/f4/b07/b07-simulated-fixture.mjs         PASS
git diff --check                                  PASS
```

El contrato A07.2 sigue fallando por el problema independiente ya documentado del `placeholder: "UUID..."` legítimo del panel de soporte QA; no está causado por `Nueva cuenta`.

Estado de aceptación en el momento de cerrar la implementación: **preparada en la rama QA y pendiente de verificación desplegada**. La verificación posterior queda registrada en la sección 13. La prueba económica 1B sigue sin estar aprobada: la acción `Nueva cuenta` no sustituye la prueba de cobro `1,00 € → 0,32 €` ni autoriza a forzar el intento histórico.

## 13. Verificación en preview QA — 2026-11-03

La rama se compiló y se publicó únicamente como preview QA, sin `--prod`, en el deploy `6aea3f4889154dd4b2da9644`:

```text
https://6aea3f4889154dd4b2da9644--chic-entremet-9107cf.netlify.app
```

Comprobaciones realizadas con la sesión QA autorizada:

- El login abrió correctamente el TPV y se pudo entrar en `Sala y restaurante`.
- Se creó una cuenta de ensayo limpia mediante el flujo existente, con total `1,32 €`, confirmado `0,00 €` y pendiente `1,32 €`. La cuenta de QA creada fue `8477e0b0-55c6-4333-abd2-9ab470dc2986` y el pedido `04c3389b-77c5-4347-97e2-368c1c9ff704`.
- No se pulsó ningún control de cobro, confirmación de pago, tarjeta simulada, pago mixto, envío adicional ni cierre/anulación.
- Apareció el botón `Nueva cuenta` con la cuenta abierta.
- El diálogo explicó que la cuenta anterior se conserva y que la acción no cancela ni inicia cobros. Tras confirmarlo, la UI mostró `Cuenta nueva preparada` y retiró el contexto activo del TPV.
- La cuenta anterior se conservó en el servidor y en el histórico local; no se modificó el intento histórico de `0,32 €`.

Resultado: **el desbloqueo técnico de B05/A02 queda verificado en QA**, pero la prueba económica 1B continúa abierta. No se ha aprobado ningún cobro real o simulado persistente. El siguiente paso requiere una confirmación inmediata justo antes de pulsar el primer control financiero en una cuenta de ensayo.

## 14. Corrección de contexto y primer cobro QA — 2026-11-03

Durante la preparación del primer cobro se detectó y corrigió un defecto adicional: `enviarPedidoA05` devolvía el pedido enviado sin `cuentaId`, por lo que la UI reemplazaba el contexto operativo y ocultaba el panel de cobro. Se añadieron al resultado los datos de cuenta, versión, divisa, responsable, ubicación, modalidad y referencia de venta en `fuente.js` y `source-recovery/fuente-recuperado.js`. Los contratos y la comprobación sintáctica volvieron a pasar, y la corrección se publicó solo en el preview QA:

```text
https://6aea429b723a4df4376f1842--chic-entremet-9107cf.netlify.app
Deploy: 6aea429b723a4df4376f1842
Estado Netlify: ready · context deploy-preview · published_at null
```

En el preview corregido se verificó que, después de enviar el pedido, el panel mostraba `Total 1,32 € · Confirmado 0,00 € · Pendiente 1,32 €` y habilitaba `Cobrar efectivo`.

Se pulsó el control de cobro con la confirmación inmediata recibida para iniciar el primer cobro QA. La interfaz confirmó:

- Total `1,32 €`.
- Confirmado `1,32 €`.
- Pendiente `0,00 €`.
- Último intento: `Confirmado`.
- Mensaje: `Efectivo confirmado`, con la cuenta aún abierta porque el pedido no está servido/cerrado.
- Fiscalización C07-D QA simulada, documento `TPV-26`, cola `PENDIENTE`, secuencia `22`; AEAT real desactivada.

Incidencia de ejecución: el importe del campo permaneció en el valor por defecto de `1,32 €`; por tanto, este resultado **no acredita el caso previsto de cobro parcial de `1,00 €` ni el saldo restante de `0,32 €`**. No se realizó reembolso, cancelación ni segundo cobro para corregirlo. El intento histórico de `0,32 €` no se consultó para modificarlo ni se alteró.

Estado de aceptación: **corrección técnica aprobada; prueba económica parcial no aprobada**. La cuenta de ensayo y el pedido usados fueron `1d17c878-402b-4e13-8db5-26f3069d796e` y `57ad6f14-6860-4846-a220-e183c76e6719`. Queda pendiente una nueva cuenta limpia y una nueva confirmación inmediata antes de pulsar el cobro configurado explícitamente a `1,00 €`.

## 15. Actualización de evidencia QA: pago parcial, saldo y cierre — 2026-11-03

Esta sección sustituye únicamente la conclusión operativa de las secciones 9, 13 y 14 para el recorrido ejecutado en el preview QA más reciente. Las secciones anteriores se conservan como histórico de decisiones y de incidencias, no como el estado final de esta ejecución.

Preview utilizado:

```text
https://6aea47911747d6dd0841340c--chic-entremet-9107cf.netlify.app/
Deploy: 6aea47911747d6dd0841340c
Contexto: deploy-preview · branch release · QA · SIMULADOR_C07D
```

Fixture económica nueva, separada del intento histórico:

- Cuenta: `a864fbdf-bba6-4808-8295-7ad62382888e`.
- Pedido: `0e1919ff-c0c8-4a62-b268-c21cd6b70be9`.
- Línea: Café con leche (QA), variante Pequeño.
- Total: `1,32 €`.
- Intento histórico de `0,32 €`: solo lectura; la consulta anterior lo mostró `CANCELADO` y la incidencia `RESUELTA · CANCELADO`; no se reutilizó ni se modificó.

Recorrido observado en servidor y UI:

1. Se abrió una cuenta limpia mediante `Nueva cuenta` y se guardó el pedido sin iniciar cobro.
2. Se envió el pedido a cocina y se verificó la continuidad del contexto de cuenta en el panel B05.
3. Se configuró expresamente el importe de `1,00 €` y el efectivo recibido de `1,00 €`.
4. Con confirmación inmediata se ejecutó un único cobro parcial. El servidor devolvió `Confirmado €1,00`, `Pendiente €0,32` y cambio `€0,00`.
5. Se consultó la cuenta nueva en el panel de soporte QA de solo lectura: `ABIERTA · PARCIALMENTE_PAGADO · saldo €0,32 · EFECTIVO CONFIRMADO €1,00 · Incidencias: ninguna`.
6. Se configuró el segundo cobro con importe y efectivo recibidos de `0,32 €`.
7. Con confirmación inmediata se ejecutó un único segundo cobro. El servidor devolvió `Confirmado €1,32` y `Pendiente €0,00`.
8. El pedido se llevó por las transiciones operativas `Enviado a cocina → En preparación → Lista para servir → Servido`.
9. Se ejecutó el cierre formal de cuenta pagada. El servidor devolvió `Cuenta comercial: Cerrada`.
10. La consulta final de soporte QA devolvió `CERRADA · PAGADO · saldo €0,00 · EFECTIVO CONFIRMADO €0,32 · EFECTIVO CONFIRMADO €1,00 · Incidencias: ninguna`.

Matriz de resultado de esta ejecución:

| Criterio | Evidencia | Estado |
|---|---|---|
| Cuenta nueva sin reutilizar el histórico | Cuenta `a864...` creada y consultada separadamente | PASS |
| Cobro parcial autoritativo | `1,00 €` confirmado; saldo servidor `0,32 €` | PASS |
| Importe siguiente recalculado desde servidor | Panel B05 propuso `A COBRAR €0,32` | PASS |
| Segundo pago exacto | `0,32 €` confirmado; saldo `0,00 €` | PASS |
| No sobrecobro en el recorrido exacto | Total confirmado `1,32 €`, igual al total | PASS en este caso |
| Cambio de `0,68 €` | No ejecutado en este recorrido | PENDIENTE |
| Rechazo de sobrepago | No ejecutado | PENDIENTE |
| Replay/idempotencia de cobro | No ejecutado en este recorrido | PENDIENTE |
| Dos terminales sobre el mismo saldo | No ejecutado | PENDIENTE |
| Pedido servido antes del cierre | Transiciones servidor verificadas | PASS |
| Cierre formal de cuenta pagada | `Cuenta comercial: Cerrada` y soporte `CERRADA · PAGADO` | PASS |
| Devolución/reembolso | No ejecutado para no alterar el histórico ni añadir otra mutación | PENDIENTE |

Conclusión actualizada: **el bloque 1B queda parcialmente validado en QA con evidencia persistente de pago parcial, saldo restante, segundo pago exacto y cierre formal; la Fase 1 completa sigue abierta**. Esta prueba no autoriza promoción a producción ni sustituye las pruebas de sobrepago, cambio, concurrencia, reintento, devolución, permisos con segundo usuario y aislamiento.

No se aplicaron migraciones, no se modificó producción, no se fusionó la rama y no se borró ningún histórico de pruebas.

## 16. Punto 1 de la Fase 1: intento de sobrepago sin mutación — 2026-11-03

Se ejecutó en el mismo preview QA, sobre una cuenta de ensayo independiente y sin tocar el intento histórico de `0,32 €`:

- Preview: `https://6aea47911747d6dd0841340c--chic-entremet-9107cf.netlify.app/`.
- Cuenta QA: `95f79d5d-33c0-40c8-b3d4-5e17ea7b8dbe`.
- Pedido QA: `056d834e-d7c5-47e9-b7c2-ebed9b0fff69`.
- Total: `1,32 €`.

Evidencia observada:

1. Se confirmó un primer cobro de `1,00 €`; la UI y el servidor mostraron `Confirmado €1,00` y `Pendiente €0,32`.
2. Se preparó un segundo cobro de `1,00 €` contra un saldo servidor de `0,32 €`, con efectivo recibido de `1,00 €`.
3. Con confirmación inmediata se pulsó una sola vez `Cobrar efectivo` en QA.
4. El procesamiento terminó sin añadir un segundo pago: el panel mantuvo `Confirmado €1,00 · Pendiente €0,32` y mostró la acción `Recuperar/reintentar mismo intento`.
5. La consulta de soporte QA, de solo lectura, devolvió `ABIERTA · PARCIALMENTE_PAGADO · saldo €0,32 · EFECTIVO CONFIRMADO €1,00 · Intentos CONFIRMADO €1,00 · Incidencias: ninguna`.
6. Tras actualizar de nuevo el panel de cobro, el saldo y el pago confirmado permanecieron iguales; no se registró movimiento adicional.

Resultado del punto:

| Criterio | Estado | Evidencia |
|---|---|---|
| Un importe superior al saldo no produce un segundo pago | PASS | Soporte QA conserva un único pago confirmado de `1,00 €` y saldo `0,32 €` |
| El saldo no se reduce ni se cierra la cuenta | PASS | Cuenta sigue `ABIERTA · PARCIALMENTE_PAGADO`, saldo `0,32 €` |
| No se altera el histórico de pruebas | PASS | No se consultó para mutar ni se canceló el intento histórico |
| Mensaje/código textual de rechazo visible al operador | PENDIENTE | La UI no expuso el código ni un mensaje explícito; solo mostró `Recuperar/reintentar mismo intento` |

Conclusión: **Punto 1 — rechazo de sobrepago sin mutación: terminado con PASS para la protección de saldo y pagos; queda una observación de UX pendiente sobre el mensaje textual del rechazo**. No se ejecutó ningún cobro posterior de `0,32 €`, ni se realizó reembolso, cancelación, migración, despliegue de producción o fusión.

## 17. Punto 2 de la Fase 1: cálculo y registro del cambio — intento no confirmado — 2026-11-03

Se intentó verificar el caso de cambio en la misma cuenta QA, sin crear otra operación ni repetir el cobro:

- Cuenta QA: `95f79d5d-33c0-40c8-b3d4-5e17ea7b8dbe`.
- Pedido QA: `056d834e-d7c5-47e9-b7c2-ebed9b0fff69`.
- Estado inicial observado: total `1,32 €`, confirmado `1,00 €`, pendiente `0,32 €`.
- Datos introducidos: aplicar `0,32 €`, efectivo recibido `1,00 €`, cambio calculado por la UI `0,68 €`.
- Con autorización inmediata se pulsó una sola vez `Cobrar efectivo`.

El botón pasó a `Procesando…` y después volvió a estar disponible. La actualización del panel y la consulta de soporte, ambas de solo lectura, mantuvieron:

`ABIERTA · PARCIALMENTE_PAGADO · saldo €0,32 · EFECTIVO CONFIRMADO €1,00 · Intentos CONFIRMADO €1,00 · Incidencias: ninguna`.

No se confirmó el segundo pago, no se registró cambio en servidor y no se ejecutó un reintento. La UI conservó la acción `Recuperar/reintentar mismo intento`, pero no mostró un código o mensaje explicativo del fallo; el flujo actual limpia el error al refrescar el estado.

| Criterio | Estado | Evidencia |
|---|---|---|
| El cálculo local muestra `1,00 - 0,32 = 0,68 €` | PASS visual | La UI mostró `CAMBIO A DEVOLVER € 0,68` |
| Se registra el pago de `0,32 €` | BLOQUEADO | El saldo servidor siguió en `0,32 €`; no hay segundo pago confirmado |
| Se registra el cambio de `0,68 €` | BLOQUEADO | No existe un pago confirmado del segundo cobro que permita verificar `cambio_entregado` |
| No se generan cobros duplicados | PASS | Solo se pulsó una vez; soporte mantuvo un único pago confirmado de `1,00 €` |

Conclusión: **Punto 2 — cálculo y registro del cambio: no terminado**. El cálculo visual es correcto, pero el registro económico no pudo probarse porque el intento no fue confirmado. El siguiente paso seguro es diagnosticar la respuesta del servidor/log de la RPC o habilitar el reintento controlado del mismo `intentoId`; cualquier reintento que pueda confirmar dinero requiere una nueva confirmación inmediata antes del clic. No se modificó producción, no se aplicaron migraciones, no se fusionó la rama y no se borró histórico.

## 18. Punto 2: resultado del reintento controlado — bloqueo por día operativo — 2026-11-04

Tras confirmación inmediata se pulsó una sola vez `Recuperar/reintentar mismo intento` sobre el mismo intento pendiente de la cuenta QA. La operación terminó sin mutación económica y la interfaz mostró la causa concreta:

`La cuenta pertenece a otro día operativo y requiere resolución antes de continuar.`

El soporte QA y el panel de cobro siguen mostrando:

`ABIERTA · PARCIALMENTE_PAGADO · saldo €0,32 · EFECTIVO CONFIRMADO €1,00 · Intentos CONFIRMADO €1,00 · Incidencias: ninguna`.

No se añadió un segundo pago, no se registró cambio en servidor y no se modificó el histórico. El bloqueo es coherente con la regla de seguridad del día operativo: no se debe forzar el cobro de una cuenta perteneciente a otro día ni cambiar el día operativo para hacer pasar esta prueba.

| Criterio | Estado | Evidencia |
|---|---|---|
| El mismo intento se reintenta sin crear otro identificador | PASS observado | Se usó `Recuperar/reintentar mismo intento` una sola vez |
| El servidor confirma `0,32 €` y cambio `0,68 €` | BLOQUEADO | Rechazo visible por cuenta de otro día operativo |
| No se duplica el cobro ni se altera el saldo | PASS | Soporte conserva saldo `0,32 €` y un único pago confirmado de `1,00 €` |
| Resolver el día operativo | NO EJECUTADO | Requeriría modificar el contexto operativo y no forma parte de esta prueba; no se forzó |

Conclusión: **el reintento queda terminado como diagnóstico, pero Punto 2 no queda aprobado**. Para aprobarlo hace falta un fixture QA creado en el día operativo vigente o una resolución formal del día/cuenta por el procedimiento autorizado, sin forzar el histórico. No se han aplicado migraciones, no se ha tocado producción y no se ha generado ningún cobro adicional.

## 19. Punto 2: contraste adicional en QA y cálculo visual reproducible — 2026-11-04

Se abrió una sesión de navegador QA separada para no reutilizar el almacenamiento local de la sesión anterior. La cuenta que el TPV devolvió fue `92e6c4b8-1e71-4b17-87e9-6c1fd6d25ce2`; el contraste de soporte y de base de datos demostró que no era una cuenta limpia, sino el mismo fixture histórico de la prueba anterior:

- Cuenta abierta: `2026-11-01`.
- Día operativo actual informado por soporte: `2026-11-04`.
- Cuenta: `ABIERTA` / `PARCIALMENTE_PAGADO`.
- Saldo server: `0,32 €`.
- Pago confirmado: efectivo `1,00 €`.
- Intento/pago cancelado: tarjeta `0,32 €`, con incidencia `RESUELTA · CANCELADO`.
- Checkout: `EN_COBRO`, sin mutación durante esta comprobación.

La consulta SQL fue únicamente de lectura. No se invocó ninguna RPC de cobro, cancelación, resolución de incidencia, cambio de día, migración ni cierre. Tampoco se volvió a pulsar `Cobrar efectivo`.

Con el saldo visible del caso de cambio se introdujo en la interfaz `0,32 €` como importe objetivo y `1,00 €` como efectivo recibido. El TPV mostró `CAMBIO A DEVOLVER €0,68`, por lo que el cálculo local es reproducible. Después se usó solo `Actualizar`; soporte mantuvo el saldo real de `0,32 €`, mientras el resumen de cobro siguió mostrando `Confirmado €0,00 · Pendiente €1,32`. Esta divergencia entre soporte/servidor y el bloque visual de cobro se considera una observación de consistencia de estado, no una autorización para cobrar.

| Criterio | Estado | Evidencia |
|---|---|---|
| Cuenta realmente nueva y del día vigente | BLOQUEADO | El ID devuelto ya existía y está abierto en `2026-11-01`; el día vigente es `2026-11-04` |
| Cálculo `1,00 - 0,32 = 0,68 €` | PASS visual | La interfaz mostró `CAMBIO A DEVOLVER €0,68` |
| Refresco del estado visual desde servidor | BLOQUEADO / OBSERVACIÓN | Soporte informó saldo `0,32 €`; el bloque de cobro quedó en `Pendiente €1,32` |
| Confirmar segundo cobro y persistir `cambio_entregado = 0,68` | NO EJECUTADO | No se pulsó el botón por el bloqueo de día y la discrepancia de estado |
| No crear cobro adicional ni alterar histórico | PASS | Solo consultas de soporte/SQL y edición local de campos; no hubo nueva RPC económica |

Conclusión: **Punto 2 continúa sin terminar**. La parte matemática de interfaz queda probada; la parte económica y de coherencia servidor/UI sigue bloqueada. La aceptación requiere un fixture QA creado en `2026-11-04` (o el día operativo que devuelva el servidor en la siguiente ejecución), con importe real pendiente `0,32 €`, antes de una única confirmación inmediata del cobro de efectivo. No se debe cambiar el día operativo ni reutilizar esta cuenta histórica para cerrar el punto.

## 20. Punto 2: comprobación de fixture limpio y rehidratación de sesión — 2026-11-04

Se continuó la investigación en QA sin ejecutar ningún cobro, reintento, cancelación de pago, devolución, cierre de cuenta ni cambio de día operativo.

- En el proyecto Supabase QA `qjqorixtkilwsndqayyx` se consultó de forma únicamente lectora `cuentas_comerciales`: no existe ninguna cuenta creada con `opened_operating_day = 2026-11-04`; las cuentas recientes siguen perteneciendo al día `2026-11-03`.
- En el preview de integración se encontró un pedido operativo guardado de un fixture anterior. El flujo no mostraba `Nueva cuenta` porque no había una cuenta nueva disponible desde contexto vacío. Se completó únicamente la transición operativa visible `Enviar pedido a preparación`; el panel posterior mostró el pedido `ENVIADO` y las líneas `ENVIADA A COCINA`, sin confirmación económica.
- Se abrió un preview QA de origen separado, se cerró la sesión de propietario del dispositivo y se volvió a iniciar sesión con el usuario QA autorizado. Tras seleccionar `Local A1`, la aplicación volvió a cargar el mismo contexto de cuenta histórica y mostró `La cuenta pertenece a otro día operativo y requiere resolución antes de continuar.` Esto confirma que el bloqueo no procede solo del almacenamiento local del navegador.
- El panel F4 del preview siguió mostrando una cuenta de `1,32 €` sin cobros confirmados, pero su contexto operativo pertenecía al fixture histórico. No se consideró apto para ejecutar el cobro de prueba.

Resultado: **Punto 2 continúa bloqueado antes de la confirmación financiera**. El cálculo visual de `1,00 - 0,32 = 0,68 €` sigue siendo PASS; la persistencia de `cambio_entregado = 0,68` no se puede aprobar sin una cuenta nueva del día operativo vigente y una única confirmación inmediata del cobro. El pedido operativo de QA fue enviado a cocina durante la comprobación; no se modificó dinero, pagos ni histórico económico. No se aplicaron migraciones, no se tocó producción y no se fusionó la rama.

## 21. Punto 2: sesión limpia y disponibilidad de alta — 2026-11-04

Se repitió el acceso en una pestaña QA nueva para separar la sesión del navegador del estado almacenado en servidor:

- Se cerró sesión únicamente en el dispositivo QA.
- Se inició sesión de nuevo con el usuario QA autorizado.
- Se seleccionó `Local A1` y se abrió el TPV.
- El TPV volvió a seleccionar una cuenta abierta del `2026-11-03` y mostró una cuenta operativa de otro día; el síntoma no desaparece al limpiar la sesión.
- La interfaz de este despliegue no expone el selector de modo ni el botón `Nueva cuenta`, aunque el código de la rama contiene `renderSelectorModoTPV` y la acción `iniciarNuevaCuentaA02`. Por tanto, no se puede ejecutar el alta mediante el recorrido visible autorizado sin desplegar otra revisión, acción que no se realiza en esta comprobación.

La base de datos QA se volvió a consultar solo en lectura. Para `QA-A1` siguen identificadas las cuentas históricas `92e6c4b8-1e71-4b17-87e9-6c1fd6d25ce2` (`2026-11-01`) y `95f79d5d-33c0-40c8-b3d4-5e17ea7b8dbe` (`2026-11-03`); no aparece una cuenta con `opened_operating_day = 2026-11-04`. No se ejecutó ninguna RPC de alta, cobro, cancelación, devolución, cierre o cambio de día.

| Comprobación | Estado | Evidencia |
|---|---|---|
| El inicio de sesión limpio elimina por sí solo el bloqueo | NO | Tras volver a entrar, el TPV rehidrata/selecciona una cuenta histórica del servidor |
| Existe fixture QA nuevo del día vigente | BLOQUEADO | Consulta lectora sin cuenta `2026-11-04` |
| El despliegue probado permite abrir una cuenta nueva por UI | BLOQUEADO | No aparece `Nueva cuenta`; el flujo visible no ofrece alta segura |
| Cobro de `0,32 €` y cambio de `0,68 €` persistidos | NO EJECUTADO | Se detuvo antes de cualquier botón financiero |
| Histórico y pagos protegidos | PASS | Solo login, navegación y consultas de lectura; sin mutaciones económicas |

Conclusión: **Punto 2 sigue sin terminar y no debe marcarse aprobado**. El bloqueo está acotado a la preparación del fixture y a la revisión desplegada de QA, no al cálculo visual. Para continuar de forma segura se necesita una revisión QA que exponga el alta de cuenta nueva (o un procedimiento QA oficial de fixture), crear una cuenta del `operating_day` vigente, confirmar el primer parcial de `1,00 €` y, con una segunda confirmación inmediata, probar `0,32 €` aplicado con `1,00 €` recibido y cambio `0,68 €`. Cada resultado deberá verificarse en servidor y UI antes de cerrar el punto.

## 22. Punto 2: comprobación de compilación de la revisión aislada — 2026-11-04

Como comprobación independiente se generó el artefacto local de Netlify desde la rama aislada mediante el comando configurado en `netlify.toml`:

`node .github/scripts/build-netlify-publish.mjs`

El artefacto `.netlify-dist/fuente.js` se generó correctamente, contiene el texto y la ruta de `Nueva cuenta`, y supera `node --check`. Esto es coherente con los contratos locales `ABC_F4_B05_NEW_ACCOUNT_UI=PASS`, `ABC_F4_B05_UI=PASS` y `ABC_F4_PHASE1_REGRESSION=PASS`.

No se pudo hacer una validación de comportamiento desde el navegador contra el servidor local porque el navegador integrado no tiene acceso al `127.0.0.1` del equipo. Tampoco se publicó un alias manual: el proyecto Netlify conectado identifica `release` como rama publicada y no hay un token CLI disponible para crear un despliegue QA aislado. No se utilizó un despliegue anónimo ni se publicó sobre el sitio conectado.

Resultado: la presencia de `Nueva cuenta` está demostrada en el código y el artefacto local, pero su presencia en el QA accesible al usuario sigue sin verificarse. El punto 2 permanece **BLOQUEADO**, sin autorización para ejecutar cobros hasta disponer de esa revisión QA o de un fixture oficial del día operativo vigente.

## 23. Punto 2: reintento de efectivo con cambio y redondeo monetario — QA final — 2026-11-04

Se publicó una revisión aislada de QA desde la rama `codex/ventas-release-integration`, sin utilizar `--prod`, sin aplicar migraciones y sin modificar `main` o `release`. La prueba se ejecutó sobre el fixture QA ya autorizado para este ensayo:

- Cuenta: `b28569be-8aad-4d33-a828-cfa43afa8e0a`.
- Pedido: `d0e8a9b1-6a0c-4ddc-8083-335a2b086a0f`.
- Total: `1,32 €`.
- Primer pago confirmado: efectivo `1,00 €`.
- Segundo pago recuperado: efectivo `0,32 €`.
- Efectivo recibido en el segundo pago: `1,00 €`.
- Cambio: `0,68 €`.

El primer intento de recuperación había quedado bloqueado por la representación binaria de los decimales (`0.6799999999999999`) aunque la pantalla mostrase `0,68 €`. La revisión normaliza objetivo, efectivo recibido y cambio a dos decimales antes de enviar la confirmación y conserva el guard de idempotencia cuando el intento ya está registrado en el servidor. También se verificó que editar el efectivo recibido ya no produce el error general de React.

La confirmación final produjo la siguiente evidencia de solo lectura en soporte:

`Cuenta: ABIERTA · Estado: PAGADO · Saldo: €0,00 · Pagos: EFECTIVO CONFIRMADO €0,32 y EFECTIVO CONFIRMADO €1,00 · Intentos: CONFIRMADO €0,32 y CONFIRMADO €1,00 · Incidencias: ninguna`.

La cuenta permanece `ABIERTA` porque el pedido aún no está servido/cerrado. No se pulsó el cierre formal de la cuenta; ese estado operativo es independiente de la confirmación económica y no debe confundirse con un fallo del pago.

| Comprobación | Estado | Evidencia |
|---|---|---|
| Recuperar el mismo intento pendiente | PASS QA | El segundo pago se confirmó sobre el flujo de recuperación |
| Normalizar efectivo y cambio a céntimos | PASS QA | `1,00 - 0,32 = 0,68 €`; el servidor aceptó el cambio |
| No duplicar el cobro | PASS QA | Solo quedaron los dos pagos previstos, sin incidencia |
| Saldo posterior | PASS QA | Soporte informó saldo `0,00 €` y estado `PAGADO` |
| Documento fiscal simulado | PASS QA | Documento y QR de simulación preparados; AEAT real deshabilitada |
| Cierre formal de cuenta | NO EJECUTADO | El pedido no estaba servido/cerrado; no se forzó esta operación |

Comprobaciones locales ejecutadas:

```text
ABC_F4_B05_CASH_RETRY=PASS
ABC_F4_B05_UI=PASS
ABC_F4_PHASE1_REGRESSION=PASS
ABC_F4_B05_NEW_ACCOUNT_UI=PASS
node --check fuente.js=PASS
node --check source-recovery/fuente-recuperado.js=PASS
node --check .github/scripts/punto6-netlify-publicacion-recuperacion.mjs=PASS
git diff --check=PASS
```

El script `punto6-netlify-publicacion-recuperacion.mjs` fue corregido únicamente para eliminar las barras invertidas literales que impedían analizarlo. Su ejecución completa sobre esta rama se detiene después, de forma esperada, al detectar `.github/scripts/build-netlify-publish.mjs` fuera del alcance 6A. Eso no es un fallo que deba ocultarse ampliando `ALLOWED_DIFF`: esta rama contiene cambios F4/B05 y no es un candidato 6A puro. El gate 6A deberá ejecutarse sobre su rama/candidato correspondiente.

Resultado de esta prueba: **el cobro mixto con recuperación, segundo importe y cambio queda aprobado en QA**. La cuenta no queda formalmente cerrada y la Fase 1 completa no se marca como cerrada hasta consolidar sus restantes criterios y decidir expresamente el tratamiento del gate 6A fuera de alcance.

## 24. Revisión consolidada punto por punto de Fase 1 — 2026-11-04

La revisión consolidada distingue tres niveles de evidencia: **PASS QA** para un recorrido persistente verificado contra el servidor; **PASS técnico** para contratos, runtime falso o comprobaciones estáticas; y **PENDIENTE/BLOQUEADO** cuando todavía falta una prueba integrada o una autorización/fixture que no se debe inventar.

| Punto | Estado consolidado | Qué está probado | Qué falta |
|---|---|---|---|
| 1A — Cobro incierto y simulador | PARCIAL | Lectura autoritativa de intentos 25/25; creación y recuperación del mismo intento; rechazo simulado y replay idempotente verificados en QA; contratos de reintento e idempotencia; no lectura directa prohibida de `pago_intentos` | Timeout determinista, confirmación tardía, respuesta fuera de orden, intento desconocido, concurrencia y terminal/adquirente real o sandbox autorizado |
| 1B — Pago parcial, saldo y cambio | PASS QA del recorrido ejecutado; bloque aún no cerrado | Cuenta de 1,32 €, pago de 1,00 €, saldo de 0,32 €, segundo pago de 0,32 €, efectivo recibido de 1,00 €, cambio confirmado de 0,68 €, saldo 0,00 € y ausencia de duplicados | Concurrencia con dos terminales; observación UX del rechazo de sobrepago; formalizar si el cierre de cuenta operativa es requisito separado |
| 1C — Devoluciones y reembolsos | PASS técnico; QA pendiente | D13 estático/runtime 50/50; B08 separa devolución económica de reposición de stock; contratos de máximo, permisos y caja presentes | Fixture persistente de devolución sobre dinero confirmado, reembolso superior, repetición, concurrencia, caja y stock |
| 1D — Aislamiento y concurrencia | PASS técnico; integración pendiente | Contratos de permisos, ACL, replay y serialización pasan; P07 identifica las protecciones y mantiene el gate de evidencia integrada pendiente | Dos empresas/locales, roles reales, sesión/terminal no operativos, dos terminales sobre saldo y dos devoluciones concurrentes en QA |
| Gate 6A de publicación | Sintaxis PASS; ejecución no aplicable a esta rama | El script ya analiza correctamente y mantiene el control de alcance | Ejecutarlo sobre un candidato 6A puro; esta rama contiene cambios F4/B05 y el gate la rechaza correctamente |

### 24.1 Batería local ejecutada

Los resultados reproducibles de esta revisión fueron:

```text
cobro-lectura-static-contract.mjs       PASS
cobro-lectura-runtime.mjs               PASS (25/25)
d13-static-contract.mjs                  PASS
d13-ui-contract.mjs                      PASS
d13-ui-runtime.mjs                       PASS (50/50)
b08-refund-adapter-contract.mjs          PASS
b08-physical-refund-separation-contract.mjs PASS
p07-concurrencia-replay-contract.mjs     PASS técnico; gate integrado pendiente
p08-fallos-replay-concurrencia-contract.mjs PASS
p23-empleados-rls-permission-contract.mjs PASS
p22-read-permission-contract.mjs         PASS
```

También pasan `node --check` sobre las dos fuentes materializadas, los contratos específicos de B05 y la generación del artefacto `.netlify-dist`. La batería local no se presenta como sustituto de los recorridos QA persistentes que faltan.

### 24.2 Decisión de cierre

Con esta evidencia, la recomendación experta es **no declarar Fase 1 completamente terminada todavía**. El bloque 1B que se estaba investigando queda aprobado en QA para el recorrido de pagos parciales y cambio; el cierre global permanece abierto por 1A, 1C, 1D y la falta de un candidato 6A separado.

No se recomienda tocar el intento histórico de `0,32 €`, forzar cambios de día operativo, crear cobros compensatorios, ejecutar una devolución sobre el histórico ni promover esta rama a producción. Las pruebas económicas que falten deben usar fixtures QA nuevos, identificables y con lectura posterior de pagos, caja, stock, eventos e incidencias.

Siguiente orden seguro:

1. Preparar un fixture QA independiente para la matriz 1A y probar timeout/replay sin dinero real.
2. Preparar un fixture económico separado para 1C y validar devolución máxima, repetición y caja/stock.
3. Ejecutar una prueba integrada de 1D con segundo usuario/terminal, si QA dispone de esas credenciales.
4. Ejecutar el gate 6A únicamente en su rama candidata, no sobre `codex/ventas-release-integration`.
5. Recalcular la decisión de cierre global y solo después preparar, sin ejecutar todavía, el plan de promoción.

## 25. Punto 1A: tarjeta simulada en cuenta QA limpia — resultado integrado — 2026-11-04

Para no reutilizar la cuenta histórica pagada, se hizo una copia local reversible del contexto guardado en el navegador y se retiró únicamente ese identificador de almacenamiento local. No se borró ningún registro del servidor, no se cerró la cuenta histórica y no se canceló ningún pago. Tras recargar el preview QA, el TPV quedó sin cuenta operativa local y permitió ejecutar la venta rápida.

Se seleccionó `Tarjeta` y, con autorización inmediata, se pulsó una sola vez `Cobrar ahora · 1,32 €`:

- Cuenta creada por el flujo QA: `c1de2cdb-53a9-4d8d-afdc-f8c58d10c90c`.
- Pedido: `d9157a67-d59c-4d96-8a2c-61fd9805334c`.
- Checkout: `b0af396a-d2ca-45df-b8a9-dd91140f1662`.
- Pago: `67e76f80-3a05-4eab-84db-11fa6e80af53`.
- Intento: `b66aa89c-a538-4013-8dbf-b27a75d5011a`.
- Importe solicitado: `1,32 €`.

La comprobación de servidor, realizada solo mediante consultas de lectura, devuelve:

`cuentas_comerciales: ABIERTA · checkout: EN_COBRO · pago: PENDIENTE · intento: PENDIENTE · authorization/capture/settlement: PENDIENTE`.

La interfaz mostró el aviso `Pago confirmado, pero la cuenta sigue abierta. No repitas el cobro; continúa en Sala para cerrar formalmente.` Este texto no debe interpretarse como confirmación económica del proveedor: el estado autoritativo observado en servidor sigue siendo `PENDIENTE`. Se dejó el intento intacto y no se pulsó de nuevo el cobro ni se ejecutó recuperación/cancelación.

| Criterio | Estado | Evidencia |
|---|---|---|
| La cuenta QA nueva se crea sin reutilizar la histórica | PASS | Cuenta `c1de2cdb…` creada el `2026-11-04`; la histórica `b28569be…` no se modificó |
| Se registra un único checkout/pago/intento | PASS | Una fila `EN_COBRO`, una fila `PENDIENTE` en `pagos` y una fila `PENDIENTE` en `pago_intentos` |
| No se duplica el cobro al completar la prueba inicial | PASS | Solo se hizo un clic; la UI ordenó no repetir y no se ejecutó un segundo intento |
| Confirmación económica de tarjeta | BLOQUEADO / NO APROBADO | El servidor no confirma; autorización, captura y liquidación siguen `PENDIENTE` |
| Mensaje de UI coherente con el estado autoritativo | OBSERVACIÓN | El aviso local usa “Pago confirmado”, aunque el servidor informa `PENDIENTE`; requiere revisión UX/semántica |
| Cerrar la cuenta o cancelar/resolver el intento | NO EJECUTADO | No se fuerza ninguna operación posterior ni se toca el histórico |

Resultado: **la preparación de cuenta limpia y el registro idempotente inicial quedan probados; el caso 1A de tarjeta no queda aprobado**. El intento actual debe conservarse para una prueba posterior de consulta/reintento del mismo `intentoId`, con confirmación inmediata antes de cualquier acción financiera adicional. No se generó un segundo cobro, no se aplicaron migraciones, no se publicó en producción y no se modificó `main` o `release`.

## 26. Corrección de semántica en venta rápida tras la prueba 1A — 2026-11-04

El contraste anterior localizó un defecto de presentación: `confirmarVentaRapida` trataba cualquier cuenta no cerrada como `paid: true`, aunque el estado autoritativo tuviera `confirmado = 0`, `saldo > 0` y `cobroIncierto = true`. Por eso una tarjeta recién iniciada podía mostrarse como “Pago confirmado” aunque el intento siguiera pendiente.

Se ajustó `fuente.js` y su espejo `source-recovery/fuente-recuperado.js` para separar expresamente:

- **Pago confirmado pero pendiente de cierre formal**: solo cuando el servidor informa importe confirmado, saldo cero y ningún cobro incierto.
- **Intento pendiente**: cuando el servidor conserva el intento en `PENDIENTE`, `AUTORIZADO` o `DESCONOCIDO`; la venta rápida muestra que no se debe repetir el cobro y conserva el mismo intento para consulta/recuperación.

La corrección no cambia RPC, importes, idempotencia ni estados del servidor. Se verificó con:

```text
A02_QUICK_SALE_TICKET_CONTRACT=PASS
ABC_F4_B05_CASH_RETRY=PASS
ABC_F4_B05_NEW_ACCOUNT_UI=PASS
ABC_F4_PHASE1_REGRESSION=PASS
node --check fuente.js=PASS
node --check source-recovery/fuente-recuperado.js=PASS
node --check .netlify-dist/fuente.js=PASS
git diff --check=PASS
```

El artefacto `.netlify-dist` se regeneró correctamente en local. La corrección se publicó en el branch deploy QA `codex/ventas-release-integration` mediante el despliegue Netlify `6aeb9268b18ea49faff03fd2`, que terminó `ready` y superó el escaneo de secretos sin coincidencias. El preview utilizado fue [codex-ventas-release-integration--chic-entremet-9107cf.netlify.app](https://codex-ventas-release-integration--chic-entremet-9107cf.netlify.app/?qa=f2-mixto-fix-20261104).

En la comprobación visual de solo lectura, el TPV mostró `Confirmado €0,00 · Pendiente €1,32` y la acción independiente `Iniciar tarjeta simulada`. No se pulsó la acción financiera en este segundo preview, por lo que no se generó otro pago ni otro intento. La corrección queda **verificada en el branch deploy a nivel de código, contrato, artefacto y estado QA visible**; la confirmación final del texto posterior a un nuevo clic no se repite por protección contra duplicados.

## 27. Recuperación del mismo intento de tarjeta — resultado integrado — 2026-11-04

Con autorización expresa, se recuperó **una sola vez el mismo `intentoId`** de la cuenta QA limpia del punto 25. La operación se ejecutó desde el branch deploy QA y no creó otro pago, otro intento ni un cobro compensatorio. La preparación local del navegador solo restauró el contexto de la cuenta objetivo; se conservaron copias reversibles del almacenamiento local y no se borró ningún registro del servidor.

La evidencia final visible en el TPV fue:

`Total €1,32 · Confirmado €1,32 · Pendiente €0,00 · Cuenta: Pagado · Cuenta comercial: Cerrada · Último intento: Confirmado · QR fiscal QA preparado`.

El documento quedó identificado como `Fiscalización C07-D · QA`, con transporte simulado y AEAT real desactivada. La pantalla confirmó además: `Tarjeta simulada confirmada, cuenta cerrada y saldo restante cero.`

La consulta posterior, realizada únicamente con `SELECT`, confirmó en Supabase QA:

| Objeto | Estado final | Evidencia adicional |
|---|---|---|
| Cuenta comercial `c1de2cdb…` | `CERRADA` | `closed_at` informado; versión 3 |
| Checkout `b0af396a…` | `COMPLETADO` | `completed_at` informado; `cancelled_at` nulo |
| Pago `67e76f80…` | `CONFIRMADO` | Tarjeta; objetivo `1,32 €`; resuelto |
| Intento `b66aa89c…` | `CONFIRMADO` | `SIMULATOR`; autorizado, capturado y liquidado por `1,32 €` |
| Duplicados | No existen | `1` pago para el checkout y `1` intento para el pago |

Resultado del criterio 1A para este recorrido: **PASS QA controlado** para creación idempotente, conservación del mismo intento, recuperación, confirmación, liquidación simulada, cierre de cuenta y ausencia de duplicados. Esto no aprueba todavía el proveedor físico ni un adquirente real: siguen pendientes los escenarios de timeout, rechazo, confirmación tardía, respuesta fuera de orden, intento desconocido, concurrencia y prueba con terminal real/sandbox autorizado.

La corrección semántica documentada en el punto 26 queda también validada en el recorrido completo: mientras el servidor estuvo pendiente, la interfaz mostró saldo pendiente y recomendó no repetir el cobro; después de recuperar el mismo intento, mostró confirmado, saldo cero y cuenta cerrada. No se aplicaron migraciones, no se tocó `main` o `release`, no se desplegó producción y no se modificó el histórico anterior de `0,32 €`.

## 28. Punto 1A: rechazo de tarjeta y replay del mismo intento — resultado integrado — 2026-11-04

Se creó un fixture QA nuevo desde el branch deploy, sin reutilizar la cuenta histórica ni el intento pendiente de `0,32 €`. Se inició una única venta rápida de tarjeta de `1,32 €` y se dejó el intento en `PENDIENTE` antes de resolverlo mediante el simulador QA autorizado. No se pulsó de nuevo el cobro desde la interfaz y no se generó un segundo pago.

Identificadores del fixture:

- Cuenta: `ce399682-fcec-4496-b942-f47bb981a3de`.
- Pedido: `a3dd7a90-8096-41b4-bfdf-db0dc2565487`.
- Checkout: `f495678f-8fd7-4b33-af25-5a7958e96e75`.
- Pago: `1209d8a4-fa59-403c-adf0-71baffb65c15`.
- Intento: `7f0cdea4-ac63-401b-8cf6-39e682d54f91`.
- Importe: `1,32 €`.

La primera resolución del intento usó el estado QA `RECHAZADO`, con una operación de simulador identificada. Se repitió exactamente la misma solicitud con el mismo `operation_id` y el mismo `intentoId` para probar replay/idempotencia. Las dos respuestas fueron coherentes: `ok=true`, `estado=RECHAZADO`, `aplicado=0` y `liberado=1,32 €`.

La consulta posterior, solo lectora, confirmó:

`Cuenta ABIERTA · checkout EN_COBRO · pago TARJETA RECHAZADO · intento RECHAZADO · autorizada/capturada/liquidada nulas · 1 pago · 1 intento · 1 operación de replay`.

La cuenta permanece abierta y con saldo pendiente porque el rechazo no es un cobro confirmado. La consulta de soporte del propio TPV mostró `Estado: PENDIENTE` para el saldo comercial, `Pagos: TARJETA RECHAZADO €1,32`, `Intentos: RECHAZADO €1,32` e `Incidencias: ninguna`; el panel F4 mostró `Último intento: Rechazado`, `Confirmado €0,00` y `Pendiente €1,32`. Después de recargar el TPV no quedó la clave local de “pago pendiente” asociada a este fixture. No se inició un nuevo intento tras el rechazo.

| Criterio | Estado | Evidencia |
|---|---|---|
| Rechazo de tarjeta sin confirmación económica | PASS QA controlado | Pago e intento `RECHAZADO`; autorizado, capturado y liquidado nulos |
| Liberación del importe tras el rechazo | PASS QA controlado | Respuesta del simulador `liberado=1,32 €`; saldo comercial sigue pendiente |
| Replay exacto del mismo intento | PASS QA controlado | Misma operación y mismo `intentoId`; segunda respuesta idempotente, sin aplicar importe |
| Ausencia de duplicados | PASS QA controlado | 1 checkout, 1 pago, 1 intento y 1 operación registrada para el replay |
| Mensaje y estado visible en TPV | PASS QA controlado | Soporte y F4 reflejan rechazo, confirmado `0,00 €` y pendiente `1,32 €` |
| Timeout real o determinista de red | NO EJECUTADO | El flujo pendiente inicial queda registrado; falta un harness de timeout reproducible |

Pruebas locales ejecutadas en esta revisión:

```text
F4_B12_QA_CARD_WORKER_CONTRACT=PASS
ABC_F4_B12_PAYMENT_TRIAL_MATRIX=PASS
A02_QUICK_SALE_TICKET_CONTRACT=PASS
ABC_F4_B05_CASH_RETRY=PASS
ABC_F4_B05_UI=PASS
ABC_F4_B05_NEW_ACCOUNT_UI=PASS
ABC_F4_PHASE1_REGRESSION=PASS
node --check fuente.js=PASS
node --check source-recovery/fuente-recuperado.js=PASS
git diff --check=PASS
```

Resultado: **el rechazo de tarjeta y el replay del mismo intento quedan aprobados en QA controlado, sin duplicar cobros**. El escenario de timeout todavía no queda aprobado: para cerrarlo hace falta una simulación de red/worker reproducible que demuestre que el primer clic deja un único intento, que la consulta posterior conserva el mismo identificador y que una confirmación tardía no crea otro pago. La Fase 1 completa sigue abierta por los escenarios restantes de 1A, por 1C/1D y por el gate 6A separado.

