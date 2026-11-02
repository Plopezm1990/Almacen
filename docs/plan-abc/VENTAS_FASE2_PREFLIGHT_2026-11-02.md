# L&A Suite — Fase 2 (rutas y estados de cocina): preflight

Fecha: 2026-11-02  
Rama: `codex/ventas-mejoras`  
Alcance: revisión de código, contratos estáticos, preparación de F2-01/F2-02 y validación controlada en QA.
Estado: **F2-01/F2-02 aplicados en QA y validados con fixture reversible; la fase 2 completa sigue pendiente de UI, casos mixtos, reintentos y recuperación**.

## 1. Resultado ejecutivo

El hallazgo original de VEN-002 sigue presente en el diseño actual:

- `public.abc_enviar_pedido` confirma y pasa el pedido a `ENVIADO` sin validar previamente que las líneas que necesitan preparación tengan una ruta activa.
- El trigger A10 crea después una comanda. Cuando no encuentra estación, la comanda queda con `route_key = 'SIN_RUTA'` y `estado = 'BLOQUEADA'`.
- La interfaz del TPV muestra un mensaje genérico de “Pedido enviado” y deja la incidencia para el panel de cocina. Por tanto, existe una ventana de falso éxito para el operador: el pedido parece enviado aunque una comanda haya quedado bloqueada.

Esto confirma el problema de consistencia de estados descrito en la auditoría. La corrección se ha aplicado en la autoridad de servidor de QA y se acompaña de una decisión explícita sobre qué productos requieren preparación. La fixture funcional se ejecutó dentro de una transacción revertida; no se modificó ningún pedido real ni el histórico auditado.

## 2. Evidencia revisada

### Código y modelo

1. `source-recovery/fuente-recuperado.js:7895` (`enviarPedidoA05`): la ruta de envío confirma líneas y llama a `abc_enviar_pedido`, pero no ejecuta una prevalidación de rutas por producto.
2. `source-recovery/fuente-recuperado.js:20422`: el modal posterior al envío comunica “Pedido enviado” y “A05 ha confirmado las líneas y enviado el pedido”; no distingue “pendiente de ruta” ni “recibido en estación”.
3. `supabase/migrations/20260924030000_abc_f3_a05_order_state_machine.sql:567`: `public.abc_enviar_pedido` valida autorización, sesión, versión y líneas confirmadas, pero no consulta `tpv_producto_estaciones` ni una clasificación de preparación.
4. `supabase/migrations/20260926110000_abc_f3_a10_kitchen_commands.sql:232`: `private.abc_a10_estacion_producto` devuelve la ruta activa o `NULL`.
5. `supabase/migrations/20260926110000_abc_f3_a10_kitchen_commands.sql:354`: el trigger `a10_pedido_linea_transiciones_comandas` genera la comanda después de la transición a `ENVIADA`; una ruta nula se convierte en `SIN_RUTA` y `BLOQUEADA`.
6. `supabase/migrations/20260924010000_abc_f3_a03_server_authority.sql:37`: `catalogo_tpv_productos` no contiene un campo de clasificación equivalente a `requiere_preparacion` o `entrega_directa`.

La propiedad existente `tipo` de producto usada en el frontend para distinguir productos elaborados no constituye, por sí sola, un contrato de cocina: no está definida en el catálogo remoto A03 como clasificación de preparación y no debe reutilizarse sin una decisión funcional.

### QA preview y esquema remoto

En el deploy preview de QA ya publicado para la rama aislada:

- se accedió con la cuenta QA autorizada;
- se comprobó el local A1;
- la vista `Cocina y comandas A10` cargó correctamente;
- no había estaciones activas ni rutas configuradas: “No hay estaciones configuradas todavía”;
- no había comandas para el filtro actual;
- los productos aparecían en el selector, pero la interfaz no mostraba una clasificación visible entre preparación y entrega directa.

No se pulsó “Crear estación”, “Guardar ruta”, “Cerrar sesión de caja” ni ningún botón que cree o cambie datos durante esa comprobación de UI. El pedido/comanda del informe y el intento de pago pendiente quedaron intactos.

En el preflight de Supabase QA se comprobó que el esquema remoto ya tenía `catalogo_tpv_productos.requiere_preparacion` como `NOT NULL DEFAULT true` y una columna adicional `precio_con_impuesto`, aunque esos elementos no aparecían en la misma forma en el árbol local de migraciones. Por seguridad, la migración se diseñó para ser idempotente y no reescribió la clasificación existente.

La migración `abc_f3_a10c_preparation_route_guard` se aplicó únicamente al proyecto QA `qjqorixtkilwsndqayyx` mediante la vía de migraciones de Supabase. Supabase la registró con la versión remota `20261102063724`. No se aplicó en producción.

## 3. Qué está confirmado, qué es indicio y qué queda por probar

### Confirmado

- El envío de A05 no hace guard de ruta antes de cambiar el estado del pedido.
- A10 representa una línea sin ruta como comanda bloqueada `SIN_RUTA` después del envío.
- La UI del TPV no expone al operador el resultado de ruta por línea en el momento de enviar.
- El esquema actual no aporta una clasificación explícita para decidir si una línea debe ir a cocina.
- El panel de cocina funciona en QA en modo lectura con el local A1, pero el local no tiene configuración de estaciones/rutas.

### Indicios que no se deben elevar a fallo confirmado todavía

- No se puede afirmar que todos los productos del catálogo necesiten estación.
- No se puede afirmar que todo producto “elaborado” deba ir a cocina: esa propiedad pertenece al dominio de producción/stock y no está formalizada como política de expedición.
- No se puede inferir desde el estado vacío de A1 que el comportamiento de todos los locales sea igual.

### Pruebas aún pendientes

- Pedido solo con producto de preparación y ruta activa: debe llegar a la estación con cantidad, extras y notas.
- Pedido solo con producto de entrega directa: debe poder completarse sin comanda artificial.
- Pedido mixto con una línea sin ruta: debe bloquear o separar únicamente lo que requiera preparación, con resultado visible y atómico.
- Cambio de configuración entre lectura de UI y envío: el servidor debe revalidar y no permitir falso éxito.
- Reenvío de un mismo pedido y adición de línea: no debe duplicar comanda ni perder identidad, autoría, motivo o trazabilidad.
- Recuperación del pedido histórico del informe: debe resolverse mediante una ruta soportada o quedar documentado como pendiente, sin mutar el registro durante este preflight.

## 4. Pruebas ejecutadas en este preflight

Todas las siguientes fueron pruebas estáticas/contractuales; no requieren aplicar migraciones ni escribir en QA:

```text
node tests/f3/a10/a10-ui.test.mjs                         PASS (5/5)
node tests/f3/a10/a10-route-recovery-regression.mjs       PASS (4/4)
node tests/f3/a05/a05-2-ui-contract.mjs                   PASS
node tests/f3/a06/a06-2-ui-contract.mjs                   PASS
```

Estas pruebas validan la autoridad remota existente, el tratamiento seguro de `SIN_RUTA` y la no reencolación automática de comandas históricas. Los contratos locales no sustituyen la prueba funcional remota; esa evidencia se recoge separadamente en la batería QA transaccional de las secciones siguientes.

En la continuación de esta revisión se amplió `tests/f3/a10/a10-preparation-route-guard.mjs` de 3/3 a 4/4: el nuevo caso ejecuta mediante mock el mapper de errores de ambas fuentes y comprueba los mensajes de `producto_preparacion_clasificacion_pendiente` y `producto_preparacion_sin_ruta`. También verifica estáticamente que la rama `ok === false` de `enviarPedidoGuardadoA05` muestra `role="alert"` y no actualiza la confirmación a `ENVIADO`. Esto confirma el contrato de respuesta y la protección contra falso éxito en el código, pero no sustituye un clic de envío en navegador.

Como prueba aislada adicional se creó `tests/f3/a05/a05-ui-adapter-smoke.mjs`. Ejecuta la acción real `enviarPedidoGuardadoA05` de cada fuente con adaptadores y setters simulados, sin DOM, red ni datos persistentes. Sus tres casos pasan: bloqueo de ruta conserva `ABIERTO` y el borrador; respuesta correcta actualiza a `ENVIADO` sólo con `ok: true`; y un segundo intento reutiliza el mismo identificador lógico en el mock sin duplicar el flujo. Esta prueba valida la máquina de estado del adaptador, pero la comprobación visual en un navegador continúa pendiente.

Se completó además la comprobación manual en el preview QA `qa-fase2-20261102--chic-entremet-9107cf.netlify.app`: con la cuenta QA autorizada se seleccionó `Local A1`, se abrió el TPV y se añadió `Croissant (QA)` sin pulsar `Guardar pedido`. La interfaz mostró `Borrador local activo`, `1 línea(s)` y el total local de `1,32 €`. Tras recargar y volver a abrir el TPV del local, el mismo borrador reapareció. Después de la confirmación explícita del usuario se creó una fixture local equivalente y se pulsó `Vaciar carrito`; el estado final no mostró borrador, carrito ni `Guardar pedido`. La consola del preview terminó sin mensajes `warn` o `error`. Esta prueba confirma la persistencia y limpieza del borrador local, pero no crea evidencia de envío A05 ni de operación en Supabase.

Con autorización explícita adicional del usuario se completó una prueba E2E persistente en el mismo preview QA, sin cobro: `Local A1` → `Croissant (QA)` → `Guardar pedido` → `Enviar pedido`. La UI mostró primero `Pedido guardado`, cuenta `2a48ebbc-b5d6-4833-9206-25ac86ba80fc`, pedido `8f979658-3aac-4e99-95e0-ff37cb5fa2bf` y estado `ABIERTO`; después mostró `Pedido enviado`, estado `ENVIADO` y la línea en estado `ENVIADA`. La lectura posterior de QA confirmó: pedido `ENVIADO`, versión 4; línea `QA-CAT-A1-CROISSANT` cantidad 1, total 1,32 y versión 3; una transición `ABIERTO → ENVIADO` con `operation_id = a05.2.send.8f979658-3aac-4e99-95e0-ff37cb5fa2bf`; una única comanda `PENDIENTE` con ruta/estación `d861c045-bbe3-4464-926d-3d1e4c0fd333`; y una línea de comanda `CONFIRMADA → ENVIADA`. La consola del navegador terminó sin `warn` ni `error`. El pedido de prueba queda persistente en QA; no se canceló ni se borró, y no se tocó el histórico auditado ni el intento de pago pendiente.

## 5. Bloqueo funcional y decisión recomendada

Antes de implementar la corrección hay que fijar una política de producto. La recomendación es:

1. clasificar explícitamente cada producto/local como `requiere_preparacion = true` o `false`;
2. bloquear de forma accionable únicamente las líneas que requieran preparación y no tengan ruta activa;
3. permitir que los productos de entrega directa finalicen sin comanda de cocina;
4. en pedidos mixtos, devolver un resultado por línea y no presentar el pedido completo como enviado si queda una línea bloqueada;
5. mantener la revalidación en `abc_enviar_pedido`, aunque la UI haya hecho una comprobación previa;
6. tratar las comandas históricas sin ruta mediante una acción de recuperación explícita, nunca mediante un trigger automático.

No se debe implementar “todo producto necesita ruta” como solución provisional: con el esquema actual produciría bloqueos artificiales y no está respaldado por la auditoría.

## 6. Propuesta concreta de Fase 1 de implementación (siguiente bloque de trabajo)

El siguiente bloque corresponde a VEN-002 y queda ordenado así:

### F2-01 — Contrato de clasificación y lectura de configuración

Dependencia: decisión funcional anterior.  
Preparar (sin aplicar todavía) el contrato de datos para la clasificación por producto/local y una consulta de diagnóstico que informe producto, estado, estación, ruta y causa de bloqueo.

Pruebas: producto directo, producto de preparación con ruta, producto de preparación sin ruta, estación inactiva y múltiples locales.

### F2-02 — Guard atómico en servidor

Dependencia: F2-01.  
Diseñar el cambio de `abc_enviar_pedido` para que, bajo el mismo bloqueo del pedido y antes de insertar transiciones, valide todas las líneas de preparación. Si falta una ruta, debe devolver error tipado y no cambiar el pedido ni crear una comanda parcial.

Pruebas: carrera de configuración, pedido mixto, reintento idempotente y conflicto de versión.

### F2-03 — Resultado operativo por línea

Dependencia: F2-02.  
Actualizar la respuesta y el modal del TPV para diferenciar `guardado`, `enviado`, `pendiente_de_ruta` y `recibido_en_estacion`, mostrando producto/local/causa y acción siguiente.

Pruebas: accesibilidad del mensaje, fallo de red, doble clic, respuesta parcial y rehidratación del pedido.

### F2-04 — Trazabilidad y recuperación soportada

Dependencia: F2-02.  
Definir la operación de reencaminado o resolución del caso histórico sin cambiar retroactivamente la ruta de pedidos futuros ni reencolar automáticamente comandas antiguas.

Pruebas: identidad de pedido/comanda/línea, actor, motivo, fecha, idempotencia y auditoría.

### F2-05 — QA controlado

Dependencia: F2-01 a F2-04, build de preview y fixture QA autorizada.  
Ejecutar primero contratos locales y después una prueba en QA con datos de prueba controlados. No se usarán el pedido ni el intento de pago del informe como fixture de escritura.

## 7. Criterios de aceptación para cerrar Fase 2

- Toda línea marcada como preparación llega a una estación activa con cantidad, extras y notas.
- Una línea de preparación sin ruta produce un error visible y accionable antes de declarar el pedido enviado.
- El servidor revalida la ruta y no permite falso éxito si la configuración cambia entre lectura y envío.
- Una línea de entrega directa no genera una comanda artificial.
- Un pedido mixto no pierde líneas ni oculta errores parciales.
- El reenvío no duplica comandas y la adición de líneas conserva trazabilidad.
- El caso histórico queda resuelto por operación soportada o documentado con bloqueo explícito.
- Las pruebas de no regresión de A05/A06/A10 y las pruebas nuevas de VEN-002 pasan en la rama aislada.

## 8. Estado de seguridad y alcance

- Rama aislada: sí.
- `main`/`release`: no modificadas.
- Merge/PR: no realizado.
- Deploy de producción: no realizado.
- Migraciones: `abc_f3_a10c_preparation_route_guard` aplicada únicamente en QA, versión remota `20261102063724`; no aplicada en producción.
- Cobros, confirmación/cancelación del intento pendiente y operaciones reales: no realizadas.
- Histórico de pruebas: conservado.

Tras la aplicación se volvieron a consultar los asesores de Supabase. Los avisos obtenidos son generales del proyecto y previos al alcance de A10: seguridad informa 61 tablas con RLS sin políticas, 230 funciones `SECURITY DEFINER` ejecutables por `authenticated` y la protección de contraseñas filtradas desactivada; rendimiento informa 176 claves foráneas sin índice cobertor, una tabla sin clave primaria y 19 índices no usados. No se observó un aviso específico nuevo atribuible a los dos helpers privados o al índice añadido en esta migración. Estos avisos quedan abiertos y no se consideran resueltos por esta fase.

## 9. Implementación preparada y validada en la rama

Se ha añadido la migración, aplicada de forma controlada únicamente en QA:

`supabase/migrations/20261102100000_abc_f3_a10c_preparation_route_guard.sql`

Incluye:

- creación idempotente de `catalogo_tpv_productos.requiere_preparacion` si no existe, respetando la clasificación remota ya existente;
- bloqueo fail-closed de productos sin clasificación;
- error específico para productos de preparación sin ruta activa;
- validación dentro de `abc_enviar_pedido`, después de bloquear pedido/líneas y antes de insertar transiciones;
- filtro del trigger A10 para que los productos directos no generen comandas artificiales;
- mensajes accionables en ambas fuentes del TPV;
- contratos de prueba para preparación con ruta, preparación sin ruta y entrega directa.

En QA la columna ya estaba definida como `NOT NULL DEFAULT true`, con 36 productos clasificados como preparación y 1 como entrega directa; la migración no cambió esos valores. El contrato sigue contemplando `producto_preparacion_clasificacion_pendiente` para entornos o datos donde la clasificación pueda ser nula.

Pruebas ejecutadas después de preparar el cambio:

```text
node tests/f3/a10/a10-preparation-route-guard.mjs  PASS (3/3)
node tests/f3/a10/a10-ui.test.mjs                  PASS (5/5)
node tests/f3/a10/a10-route-recovery-regression.mjs PASS (4/4)
node tests/f3/a05/a05-2-ui-contract.mjs            PASS
node tests/f3/a06/a06-2-ui-contract.mjs            PASS
node tests/pm07/frontend-contract.mjs              PASS
node .github/scripts/build-netlify-publish.mjs     PASS
node tests/netlify-publish-boundary.mjs             PASS
```

Además se ejecutó una prueba funcional de backend en QA con tres pedidos de fixture, todos dentro de `BEGIN ... ROLLBACK`:

| Caso | Resultado observado | Estado |
|---|---|---|
| Producto de preparación sin ruta (`QA-CAT-A1-CANA`) | Rechazo tipado `producto_preparacion_sin_ruta`; el pedido permaneció `ABIERTO` y no se creó transición ni comanda | PASS |
| Producto de preparación con ruta (`QA-CAT-A1-CROISSANT`) | El pedido pasó a `ENVIADO` y se creó una comanda `PENDIENTE` con estación y ruta válidas | PASS |
| Producto de entrega directa (`QA-CAT-A1-AGUA`) | El pedido pasó a `ENVIADO` sin crear comanda, aunque el producto tuviera una ruta disponible | PASS |

La comprobación posterior al `ROLLBACK` devolvió cero filas residuales en pedidos, comandas, eventos y transiciones para la operación de prueba. Por tanto, la validación funcional demuestra el guard y el filtrado A10 sin dejar datos de fixture en QA.

Después se ejecutó una segunda batería QA, también dentro de `BEGIN ... ROLLBACK`:

| Caso adicional | Resultado observado | Estado |
|---|---|---|
| Pedido mixto: Croissant + Agua | Se enviaron las dos líneas, se creó una sola comanda para Croissant y no se creó comanda para Agua | PASS |
| Reenvío con el mismo `operation_id` | La repetición no duplicó pedido, transiciones, comanda ni línea de comanda | PASS |
| Ruta activada antes del envío | Se añadió temporalmente la ruta de `QA-CAT-A1-CANA`, el servidor la releyó y el envío creó una comanda con ruta válida | PASS |

La comprobación posterior de esta segunda batería devolvió cero pedidos, comandas, eventos y transiciones residuales; la ruta temporal tampoco quedó creada. La UI del preview nuevo se probó hasta abrir sesión, seleccionar `Local A1` y abrir el TPV, sin enviar pedidos desde el navegador.

Se verificaron también los permisos: las funciones auxiliares privadas no son ejecutables por `anon`, `authenticated` ni `service_role`; `public.abc_enviar_pedido` sólo quedó ejecutable por `authenticated` entre esas tres identidades comprobadas.

## 10. Próximo paso autorizado

Se generó el build de esta rama y se publicó sólo como preview manual de QA, sin tocar producción:

`https://qa-fase2-20261102--chic-entremet-9107cf.netlify.app`

La primera publicación del alias no activaba el aislamiento QA porque `reset-pruebas-preview.js` sólo reconocía hosts `deploy-preview-*` y hashes de deploy. El alias manual `qa-fase2-20261102` quedaba fuera y apuntaba al host productivo compilado. Se corrigió la detección para ese formato, se regeneró el build y se actualizó el mismo alias.

Tras la corrección, la cuenta QA inició sesión correctamente, mostró `Local A1` y abrió el TPV del build nuevo. El TPV cargó categorías, productos QA e historial sin errores de consola. No se envió ningún pedido desde la UI para no crear operaciones persistentes; los tres comportamientos de envío siguen validados mediante las fixtures transaccionales revertidas del backend.

La siguiente acción recomendada es completar, con una estrategia reversible, la comprobación visual del error de ruta, la adición de línea posterior al guardado y la trazabilidad/recuperación del caso histórico. La adición y recuperación del borrador local y el camino feliz `Guardar pedido → Enviar pedido` ya quedaron comprobados en el preview; los casos mixto, cambio de ruta y reintento idempotente ya están aprobados a nivel backend QA; el adaptador ya tiene prueba aislada de reintento, pero esos casos todavía no se han pulsado desde la UI para no crear más operaciones persistentes.

La revisión de recuperación deja el caso histórico en estado **pendiente de operación soportada**: A06 puede recuperar la misma cuenta/pedido sin crear identidades nuevas, pero la UI de A10 informa expresamente de que asignar una ruta sólo se aplicará a nuevas comandas y no reenvía la comanda bloqueada existente. Las pruebas locales tampoco encuentran una RPC canónica de reencolado histórico. No se ejecutó ninguna llamada de recuperación, reimpresión, asignación ni transición sobre el pedido/comanda del informe.

No se debe usar el pedido histórico ni el intento de pago de la auditoría como fixture de escritura. La promoción a producción sólo podrá proponerse cuando la UI y esos casos restantes estén probados y documentados, con una revisión separada de la migración y un plan de rollback.

## 11. Comprobación no destructiva posterior del caso sin ruta

Se contrastó el catálogo QA mediante una consulta de solo lectura para `QA-EMP-A` / `QA-A1`. Se localizaron productos activos que requieren preparación (`requiere_preparacion = true`) pero no tienen ninguna ruta activa en `tpv_producto_estaciones`, entre ellos `Café con leche (QA)`, `Caña de cerveza (QA)`, `Capuchino (QA)`, `Napolitana de chocolate (QA)`, `Porción de tarta (QA)`, `Refresco en lata (QA)`, `Tostada con tomate (QA)`, `Zumo de naranja (QA)`, `Queso al corte, por kg (QA)`, `QUESO TIERNO PRUEBA 500G` y `QA Fixture E3 Foto MasVendido Alergenos`.

En el preview QA se buscó y seleccionó `Café con leche (QA)`. El producto requiere una variante, por lo que se eligió localmente `Pequeño` y se añadió al carrito como borrador local. Se confirmó que antes de guardar sólo aparece `Guardar pedido` y no existe un envío operativo todavía. El carrito se vació inmediatamente después. No se creó pedido, comanda, transición, checkout ni intento de pago adicional.

La comprobación no destructiva confirma que existe una fixture UI adecuada para probar el rechazo `producto_preparacion_sin_ruta`, pero no permite aprobar el mensaje visual completo sin pulsar `Guardar pedido` y después `Enviar pedido`, operaciones persistentes que requieren una autorización específica adicional. El pedido E2E ya enviado correctamente no se reutilizó.

Regresiones de código ejecutadas tras esta comprobación:

```text
node tests/f3/a10/a10-preparation-route-guard.mjs    PASS (4/4)
node tests/f3/a10/a10-route-recovery-regression.mjs   PASS (4/4)
node tests/f3/a10/a10-ui.test.mjs                    PASS (5/5)
```

## 12. Intento autorizado de prueba visual sin ruta y bloqueo de guardado

Con autorización explícita adicional se repitió en el navegador el caso UI con `Café con leche (QA)`, seleccionando la variante `Pequeño`, después de seleccionar correctamente `Local A1` (el TPV rechaza expresamente la apertura con `Todos los locales`). La sesión quedó confirmada en el proyecto Supabase QA: el contexto real de la página devolvió `window.__nubeActiva = true`, cliente Supabase disponible y URL `https://qjqorixtkilwsndqayyx.supabase.co`. También se observaron respuestas `200` de RPC y lecturas del proyecto QA.

El carrito se preparó correctamente y mostró `Guardar pedido €1,32`, pero pulsar el botón no produjo una transición visible, no abrió cuenta/pedido ni generó una petición de creación. El botón permanece habilitado y el carrito conserva la línea. La consulta posterior, de solo lectura, devolvió cero filas nuevas en `pedidos_tpv` de `QA-EMP-A` / `QA-A1`; no se creó tampoco una comanda, transición, checkout ni intento de pago. El histórico auditado y el pedido E2E correcto no se tocaron.

La inspección del código fuente mostró que `crearLogicaVenta()` ya devuelve `venderCarritoA02()` y que el componente `VentaRapida` la recibe mediante su prop `venderCarrito`. La primera corrección intentó llamar a `venderCarritoA02()` directamente desde `confirmarCobro()`, pero esa función no existe en el alcance local del componente; la prueba del preview detectó correctamente `ReferenceError: venderCarritoA02 is not defined`. Por tanto, el punto correcto de integración es conservar la llamada al prop `venderCarrito`, que en la vista TPV ya está enlazado al flujo A02/A04.

Por tanto, el bloqueo ya no se clasifica como falta de conexión del preview; se clasifica como **flujo UI de guardado no conectado al camino A02/A04 esperado / respuesta visual no observable**. No se ha forzado una escritura directa en Supabase ni se ha utilizado el pedido histórico para sustituir la prueba de UI.

Como observación independiente durante la navegación se registró también en consola un `ReferenceError: respuestaErrorA06 is not defined` al abrir el panel de descuentos/cortesías, además de un aviso de claves React duplicadas en `Dashboard`. No se utilizó ese panel para la prueba de ruta y no se modifica ni se clasifica aquí como resuelto.

## 13. Corrección de integración preparada para QA

Se corrigió en la rama aislada `codex/ventas-mejoras` el punto de entrada de `confirmarCobro()` para que invoque el prop `venderCarrito`, que es el adaptador que la pantalla recibe como `venderCarritoA02` desde `crearLogicaVenta()`. La llamada directa a `venderCarritoA02()` se retiró porque generaba un `ReferenceError` en el alcance de `VentaRapida`. El cambio funcional queda preparado para publicarse en el siguiente commit de la rama; no se modificaron los cambios locales no relacionados.

La corrección pasa las regresiones A10 (4/4, 4/4 y 5/5) y el contrato frontend PM07. La generación local posterior del artefacto quedó impedida por el directorio `.netlify-dist` como punto de reparseo de OneDrive (`EPERM` al intentar limpiarlo); el artefacto anterior sí había superado `tests/netlify-publish-boundary.mjs`, pero no se marca como nueva ejecución para este commit. Netlify sí construyó correctamente el preview limpio del commit `14b9985`.

La publicación automática/manual del artefacto ya no es el bloqueo inmediato: el PR 208 generó el preview `https://deploy-preview-208--chic-entremet-9107cf.netlify.app` y Netlify marcó como correcto el despliegue del commit `14b9985`. No se ha tocado producción.

## 14. Resultado de la prueba del preview 208

En el preview `deploy-preview-208` se inició sesión con la cuenta QA autorizada, se seleccionó `Local A1`, se abrió el TPV, se añadió `Café con leche (QA)` con variante `Pequeño` y se pulsó `Guardar pedido`. La interfaz quedó en `Guardando pedido…` y la consola mostró `ReferenceError: venderCarritoA02 is not defined` en `confirmarCobro()`. No se observó cobro ni se confirmó ningún pago; la prueba no se aprueba y debe repetirse después de publicar el commit de corrección de alcance.

Tras publicar `14b9985`, se abrió una sesión nueva del mismo preview. La fuente cargada contiene `confirmarCobro()` llamando al prop `venderCarrito`, y la inspección del árbol React confirmó que ese prop es la función `venderCarritoA02` con `local=QA-A1` y `empresa=QA-EMP-A`; el `ReferenceError` ya no se reproduce. Se limpió el borrador local del carrito, se volvió a añadir `Café con leche (QA)` con `Pequeño` y se pulsó `Guardar pedido` por accesibilidad, coordenadas y teclado. El botón permaneció habilitado, sin pasar a `Guardando pedido…`, sin mensaje de cuenta/pedido y sin petición RPC/REST de creación. La lectura de solo lectura posterior en `pedidos_tpv` para `QA-EMP-A`/`QA-A1` desde `2026-11-02T17:10:00Z` devolvió `[]`. Resultado: la corrección de alcance queda verificada; la prueba E2E de guardado queda **pendiente/no aprobada** por clic sin efecto observable en el entorno QA, sin cobro ni mutación de histórico.

## 15. Diagnóstico adicional del evento del botón

Se comprobó que otros eventos de la misma interfaz sí funcionan: el selector de apariencia cambió temporalmente a modo oscuro y se restauró a modo claro. El botón `Guardar pedido` está habilitado y su prop React `onClick` es `confirmarCobro`; el componente montado recibe `venderCarritoA02` como función. Se ejecutó también el manejador React de forma diagnóstica dentro de la pestaña QA, sin observar cambios visuales ni peticiones de red. La lectura posterior de `pedidos_tpv` siguió devolviendo `[]`. No se aplicó ningún bypass ni escritura manual; el flujo queda no aprobado hasta reproducirlo con una interacción normal que produzca una respuesta visible y trazable.
