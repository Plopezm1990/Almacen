# L&A Suite — Fase 2 (rutas y estados de cocina): preflight

Fecha: 2026-11-02  
Rama: `codex/ventas-mejoras`  
Alcance: revisión de código, contratos estáticos, preparación de F2-01/F2-02 y comprobación QA de solo lectura.
Estado: **F2-01/F2-02 preparados en la rama; migración no aplicada y validación QA funcional pendiente**.

## 1. Resultado ejecutivo

El hallazgo original de VEN-002 sigue presente en el diseño actual:

- `public.abc_enviar_pedido` confirma y pasa el pedido a `ENVIADO` sin validar previamente que las líneas que necesitan preparación tengan una ruta activa.
- El trigger A10 crea después una comanda. Cuando no encuentra estación, la comanda queda con `route_key = 'SIN_RUTA'` y `estado = 'BLOQUEADA'`.
- La interfaz del TPV muestra un mensaje genérico de “Pedido enviado” y deja la incidencia para el panel de cocina. Por tanto, existe una ventana de falso éxito para el operador: el pedido parece enviado aunque una comanda haya quedado bloqueada.

Esto confirma el problema de consistencia de estados descrito en la auditoría. La corrección debe hacerse en la autoridad de servidor y acompañarse de una decisión explícita sobre qué productos requieren preparación. No se ha aplicado ninguna migración ni se ha modificado ningún pedido.

## 2. Evidencia revisada

### Código y modelo

1. `source-recovery/fuente-recuperado.js:7895` (`enviarPedidoA05`): la ruta de envío confirma líneas y llama a `abc_enviar_pedido`, pero no ejecuta una prevalidación de rutas por producto.
2. `source-recovery/fuente-recuperado.js:20422`: el modal posterior al envío comunica “Pedido enviado” y “A05 ha confirmado las líneas y enviado el pedido”; no distingue “pendiente de ruta” ni “recibido en estación”.
3. `supabase/migrations/20260924030000_abc_f3_a05_order_state_machine.sql:567`: `public.abc_enviar_pedido` valida autorización, sesión, versión y líneas confirmadas, pero no consulta `tpv_producto_estaciones` ni una clasificación de preparación.
4. `supabase/migrations/20260926110000_abc_f3_a10_kitchen_commands.sql:232`: `private.abc_a10_estacion_producto` devuelve la ruta activa o `NULL`.
5. `supabase/migrations/20260926110000_abc_f3_a10_kitchen_commands.sql:354`: el trigger `a10_pedido_linea_transiciones_comandas` genera la comanda después de la transición a `ENVIADA`; una ruta nula se convierte en `SIN_RUTA` y `BLOQUEADA`.
6. `supabase/migrations/20260924010000_abc_f3_a03_server_authority.sql:37`: `catalogo_tpv_productos` no contiene un campo de clasificación equivalente a `requiere_preparacion` o `entrega_directa`.

La propiedad existente `tipo` de producto usada en el frontend para distinguir productos elaborados no constituye, por sí sola, un contrato de cocina: no está definida en el catálogo remoto A03 como clasificación de preparación y no debe reutilizarse sin una decisión funcional.

### QA preview

En el deploy preview de QA ya publicado para la rama aislada:

- se accedió con la cuenta QA autorizada;
- se comprobó el local A1;
- la vista `Cocina y comandas A10` cargó correctamente;
- no había estaciones activas ni rutas configuradas: “No hay estaciones configuradas todavía”;
- no había comandas para el filtro actual;
- los productos aparecían en el selector, pero la interfaz no mostraba una clasificación visible entre preparación y entrega directa.

No se pulsó “Crear estación”, “Guardar ruta”, “Cerrar sesión de caja” ni ningún botón que cree o cambie datos. El pedido/comanda del informe y el intento de pago pendiente quedaron intactos.

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

Estas pruebas validan la autoridad remota existente, el tratamiento seguro de `SIN_RUTA` y la no reencolación automática de comandas históricas. No prueban todavía el guard previo al envío; por eso no se marca VEN-002 como corregido.

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
- Migraciones: no aplicadas.
- Cobros, confirmación/cancelación del intento pendiente y operaciones reales: no realizadas.
- Histórico de pruebas: conservado.

## 9. Implementación preparada en la rama

Se ha añadido, sin aplicar en ningún entorno, la migración:

`supabase/migrations/20261102100000_abc_f3_a10c_preparation_route_guard.sql`

Incluye:

- columna nullable `catalogo_tpv_productos.requiere_preparacion`;
- bloqueo fail-closed de productos sin clasificación;
- error específico para productos de preparación sin ruta activa;
- validación dentro de `abc_enviar_pedido`, después de bloquear pedido/líneas y antes de insertar transiciones;
- filtro del trigger A10 para que los productos directos no generen comandas artificiales;
- mensajes accionables en ambas fuentes del TPV;
- contratos de prueba para preparación con ruta, preparación sin ruta y entrega directa.

La columna permanece nullable deliberadamente: los productos existentes no se clasifican automáticamente. Si se aplica la migración sin clasificar el catálogo, el servidor bloqueará el envío con `producto_preparacion_clasificacion_pendiente`; esto evita convertir una suposición en una venta falsa.

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

Estos resultados son de rama/build y no prueban la ejecución real de la nueva migración contra QA.

## 10. Próximo paso autorizado

Para activar esta corrección en QA falta un paso separado y controlado: clasificar una fixture segura de QA, aplicar la migración en QA con autorización explícita y ejecutar las pruebas funcionales de envío. No se debe usar el pedido histórico ni el intento de pago de la auditoría como fixture.
