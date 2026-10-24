# Plan Maestro L&A Suite — Seguimiento T5 QA: artículo, sala y cortesía

Fecha: 23/10/2026  
Entorno: preview 175 · QA Empresa A, S.L. · Local A1  
Alcance: Etapa 5 del Plan Maestro L&A Suite. Solo QA; sin PROD ni SQL directo.

## 1. Fixture de artículo QA

Se preparó un fixture controlado mediante la interfaz visible de QA:

- Producto: `Artículo varios (QA)`.
- SKU: `QA-ET5-VARIOS-20261023`.
- Precio de venta con IVA: `2,00 €`; coste con IVA: `1,00 €`.
- Stock inicial: 10 unidades.
- Se traspasó 1 unidad al piso de venta mediante el flujo de Traspasos:
  quedaron 9 unidades en almacén y 1 en el piso.
- El producto apareció en el catálogo TPV y permitió añadir 1 unidad al
  borrador.
- El guardado devolvió `Pedido guardado`, modalidad `Barra`, estado `ABIERTO`,
  una línea y total `2,00 €`.
- Evidencia técnica del guardado: cuenta
  `0066780f-c04f-4d16-94ae-60735e44b861`; pedido
  `8175b6d3-cefe-4f33-9b2d-578c9e67b351`.
- No se cobró ni se envió la comanda.

### Repetición A05 con cuenta recuperada

Para separar el bloqueo de sala del estado `BORRADOR`, se repitió el flujo en
QA con cuentas recuperables y sin abrir ningún control de cobro:

- Primera repetición: `Pedido guardado` y después `Pedido enviado`, total
  `2,00 €`, 1 línea de `Agua 50 cl (QA)`, cuenta
  `e3724c02-bfd2-4a7d-aac3-70d97f8d00f4`, pedido
  `ecc2efc6-0fbb-4ba7-bc7d-b40b8a35fdd6`.
- Segunda repetición: `Pedido guardado` y después `Pedido enviado`, total
  `2,00 €`, 1 línea de `Agua 50 cl (QA)`, cuenta
  `b4a7c8ec-7213-4c88-8396-38faec9b4f9c`, pedido
  `5926d1f4-ca45-452a-a2b6-d194664a96d0`.
- En ambos casos el estado final visible fue `ENVIADO` y la línea quedó
  `ENVIADA`; el cobro permaneció en `0,00 €` confirmado, con el importe
  pendiente.
- No se inició preparación, no se canceló ninguna línea y no se cobró.

Resultado: **PASS parcial** para el caso de un producto catalogado usado como
fixture de artículo QA.

Esto no demuestra todavía un artículo libre con precio manual. El contrato
actual del servidor exige `producto_id` y recalcula precio/IVA desde catálogo.
La invitación debe pasar por el flujo de cortesía A09 y no por un producto de
precio cero.

## 2. Recuperación y resincronización

La cuenta nueva apareció finalmente en `Cuentas aparcadas / recuperables` como
`Cuenta …5e44b861`, con `1 línea(s) activa(s)` del día operativo. Se pulsó
`Recuperar cuenta` una sola vez.

- El servidor devolvió `Cuenta recuperada correctamente en este terminal`.
- El TPV reconstruyó la línea `Artículo varios (QA)` y mantuvo el total de
  `2,00 €` sin cobro.
- La línea quedó en estado `BORRADOR`; el pedido no se envió a Cocina.

Resultado: **PASS** para la recuperación y la resincronización del contexto.
La ausencia inicial de líneas en A09 era un problema de contexto local no
recuperado, no una ausencia de persistencia del pedido.

## 3. Sala y mesas

Con la cuenta recuperada se abrió `Mesa QA-A1-01`, se dejaron los dos
comensales por defecto y se intentó `Asignar esta cuenta` mediante el flujo
visible.

- La mesa siguió mostrando `LIBRE · 0/4 personas`.
- No apareció confirmación ni error visible.
- El formulario permaneció abierto después de varios intentos.

Resultado de la primera ronda: **BLOQUEADO / no concluyente**; no es PASS. El
pedido de esa cuenta seguía en `BORRADOR`.

### Repetición con pedido enviado

Después de enviar dos pedidos QA sin cobro, se recuperó de nuevo una cuenta
con una línea `ENVIADA`, se abrió `Mesa QA-A1-01`, se mantuvieron 2 comensales
y se pulsó `Asignar esta cuenta` una vez, con una repetición controlada para
confirmar el evento. El resultado fue idéntico en ambas comprobaciones:

- La mesa continuó en `LIBRE · 0/4 personas`.
- El formulario `Asignar Mesa QA-A1-01` permaneció abierto.
- No apareció `role=alert`, confirmación ni cambio de ubicación.
- La cuenta siguió mostrando el pedido `ENVIADO` y la línea `ENVIADA`.

Resultado de la repetición: **FAIL / BLOQUEADO reproducible**. El bloqueo no
venía de la RPC ni de las versiones de cuenta/mesa: la función sí estaba
implementada, pero `crearLogicaVenta` no la incluía en el objeto que devuelve.
Por eso `VentaRapida` recibía `asignarMesaCuentaA07` como `undefined` y el
guard del formulario salía silenciosamente antes de iniciar la RPC. Se corrigió
la exportación en `fuente.js` y en `source-recovery/fuente-recuperado.js` para
mantener ambos artefactos alineados. En el preview reconstruido se repitió la
prueba una sola vez sobre la cuenta QA recuperada:

- `Mesa QA-A1-01` pasó a `OCUPADA · 2/4 personas · 1 cuenta(s) activa(s)`.
- La cuenta mantuvo su pedido `ENVIADO` y la línea `Agua 50 cl (QA)` en
  `ENVIADA`.
- El cobro no se activó: `Confirmado €0,00` y `Pendiente €2,00`.

Resultado de asignación: **PASS**. La modificación fue exclusivamente de
ubicación/comensales en QA.

## 4. Descuento/cortesía A09

Se abrió el panel `Descuento / cortesía` después de recuperar la cuenta y sin
aplicar cambios.

- El panel cargó correctamente.
- Ahora sí mostró la línea comercial del servidor:
  `Producto mvl860eb81drfo · cantidad 1,00 unidad · línea 297-2b6c00699117`.
- No había descuentos aplicados, autorizaciones pendientes ni líneas fiscales
  activas.
- `Aplicar / solicitar` permaneció deshabilitado porque no se rellenó el
  motivo; no se aplicó descuento ni cortesía y no se modificó el importe.

Resultado: **PASS** para lectura de líneas y controles de seguridad A09;
queda pendiente probar una solicitud de cortesía autorizada en un caso de QA
aislado, si el plan lo exige.

### Prueba A09 de cortesía

Se seleccionó `Cortesía`, se indicó el motivo `Prueba QA Etapa 5: cortesía sin
cobro` y se usó `Aplicar / solicitar` sobre la cuenta QA. El servidor confirmó
la operación y recargó la cuenta:

- `COURTESY · €1,82 · 1 reparto`;
- evento `CUENTA_DESCUENTO_APLICADO`;
- `Aplicaciones registradas · 1`;
- sin autorizaciones pendientes;
- sin movimientos de caja asociados.

El panel de cobro quedó en `Total €0,00`, `Confirmado €0,00` y `Pendiente
€0,00`. Resultado: **PASS** para la cortesía QA sin cobro.

## 5. Catálogo visible

En este preview ya están visibles los fixtures siguientes:

- `QA AUD002 3DEC 20261022`: `sin stock`, con botones deshabilitados.
- `QA Fixture E3 Foto MasVendido Alergenos`: marca `Más vendido` y
  `Alérgenos: gluten`.
- El catálogo muestra además `Artículo varios (QA)` con precio y botones de
  cantidad.

Estos puntos dejan de estar bloqueados por ausencia de datos. Falta repetir la
validación completa dentro de una venta enviada a Cocina si el caso lo exige.

## 6. Cocina y ruta del fixture

La primera comanda del fixture se envió correctamente a pesar de no tener ruta
de producto y quedó visible como `NUEVA · Sin estación · BLOQUEADA`.

Se guardó en QA la ruta `Artículo varios (QA)` → `COCINA-QA · Cocina QA-A1`
con el flujo visible de Estaciones y rutas. El servidor confirmó:
`Ruta de producto actualizada correctamente` y la estación pasó a mostrar
`4 ruta(s)`.

Se añadió y envió una segunda línea del mismo fixture, sin iniciar preparación
ni cobrar. La nueva comanda apareció en Cocina como:

- `Artículo varios (QA) · 1`;
- `NUEVA · Cocina QA-A1`;
- `PENDIENTE`.

Resultado: **PASS** para el envío y enrutamiento de una nueva comanda del
fixture. El evento antiguo bloqueado no se reescribe retroactivamente, que es
el comportamiento esperado al guardar una ruta después de haber creado la
comanda.

## 7. Estado de Etapa 5

La ronda se mantuvo en QA, no accedió a PROD, no ejecutó SQL directo y no
registró cobros.

En ese punto intermedio, la asignación de mesa, el enrutamiento de la nueva
comanda y la cortesía QA sin cobro quedaban PASS; el cambio de mesa aún estaba
pendiente de la fixture de segunda mesa. La revalidación final y el cierre se
documentan en la revalidación final y en el cierre T5.

### Revalidación de cambio y unión de mesas

Se revisó el flujo soportado en el preview autenticado y en el código de la
aplicación antes de intentar crear datos adicionales:

- `Locales` solo permite editar la ficha del local; no ofrece configuración de
  zonas ni mesas.
- `Configuración` muestra permisos, y el Propietario conserva todos los
  permisos; aparece `ABC_SALA_CONFIGURAR`, pero no hay formulario visible para
  ejecutar la creación de una mesa.
- La lectura de QA confirma una única zona activa (`SALA-QA`) y una única mesa
  activa: `Mesa QA-A1-01`. No existe una segunda mesa de destino en `QA-A1`.
- El proyecto contiene la RPC autorizada `abc_crear_mesa`, pero una llamada
  desde el conector sin la sesión autenticada del propietario fue rechazada por
  `mesa_configurar_no_autorizada`. No se insertó ninguna fila ni se alteró QA.
- El backend expone `abc_unir_cuentas` y el permiso `ABC_CUENTA_UNIR`. En la
  rama de esta PR se ha conectado esa operación al TPV: el panel de reparto
  muestra un control separado de “Unir cuentas”, exige destino y motivo, envía
  versiones esperadas y usa una operación idempotente; el servidor mantiene los
  bloqueos de cobro incierto, fiscalización, pedido editable, moneda/día y
  mesas incompatibles. La acción no registra cobros.

En el deploy exacto de la rama (`Deploy Preview #175`, commit `8bf6fca`), se
inició sesión en el preview de QA, se recuperó una cuenta autorizada y se
abrió `Repartir productos`. El TPV mostró el selector de cuenta destino, el
campo de motivo obligatorio y el botón `Unir cuenta origen con destino`.

La primera tentativa quedó correctamente bloqueada porque el pedido origen
seguía editable. Sin modificar datos por fuera de la aplicación, se avanzó la
línea QA por el flujo operativo visible: `EN_PREPARACION` → `PREPARADO` →
`SERVIDO`, sin cobro. La segunda tentativa fue aceptada por el servidor y
mostró: `Cuentas unidas correctamente. La cuenta origen se ha cerrado; no se
ha creado ningún cobro.` La comprobación inmediata mantuvo el pedido servido,
`Confirmado €0,00` y `Pendiente €2,00`.

Resultado: **PASS funcional** para “unir cuentas” sin cobro, con guardas de
pedido editable y estado terminal verificadas. No se debe confundir esta
operación con “cambiar mesa”.

### Preparación del flujo autenticado de fixture

Para no depender de una escritura externa ni de un conector sin sesión de
usuario, la rama añade en `Configuración` la pestaña `Sala y mesas`. La nueva
pantalla:

- solo se monta para el Propietario y el local activo;
- carga la zona y las mesas con `abc_listar_mapa_sala`;
- resuelve el terminal, la sesión de caja abierta y el día operativo del
  servidor;
- valida código, nombre, capacidad, orden y motivo antes de llamar a
  `abc_crear_mesa`;
- no expone inserciones, actualizaciones ni borrados directos de tablas.

En el preview autenticado se ejecutó la pantalla con la sesión del Propietario
en QA. Se creó mediante `abc_crear_mesa` la fixture:

- código: `M-QA-02`;
- nombre: `Mesa QA-A1-02`;
- capacidad: `4`;
- orden: `1`;
- zona: `SALA-QA` / sala `Sala QA-A1`.

La confirmación visible fue `Mesa Mesa QA-A1-02 creada mediante la RPC
autorizada`. El motivo se indicó en pantalla para el caso de QA; la RPC no
recibe ese texto como columna de auditoría. No se ejecutó escritura SQL directa.

La creación dejó dos mesas activas en el mapa: `Mesa QA-A1-01` y
`Mesa QA-A1-02`.

### Revalidación final del cambio de mesa

La primera repetición descubrió un defecto adicional: el `operation_id` del
traslado incorporaba el motivo con espacios, y el servidor devolvía
`operation_id_invalido`. Se corrigió la normalización del identificador en
`fuente.js` y `source-recovery/fuente-recuperado.js`, se ejecutaron las pruebas
locales de sintaxis y contratos y se publicó el commit `3b93e51` en el Deploy
Preview #175.

Con el arreglo publicado se recuperó una cuenta QA del mismo día con una línea
`Agua 50 cl (QA)`, se abrió el traslado a `Mesa QA-A1-02` y se confirmó con el
motivo `Prueba T5 de traslado de mesa en QA, sin cobro`. El servidor aceptó la
operación. La comprobación visible posterior mostró:

- `Mesa QA-A1-01 LIBRE · 0/4 personas`;
- `Mesa QA-A1-02 OCUPADA · 2/4 personas · 1 cuenta(s) activa(s)`;
- la misma cuenta, con el pedido `ENVIADO` y la línea `Agua 50 cl (QA)` en
  `ENVIADA`;
- cobro intacto: `Total €2,00`, `Confirmado €0,00`, `Pendiente €2,00`.

Se abrió también `Cocina` después del traslado. La estación
`COCINA-QA · Cocina QA-A1` continuó configurada y la lista de comandas siguió
mostrando las líneas existentes sin crear ningún cobro ni mover datos a PROD.

Resultado: **PASS** para el cambio de mesa con conservación de cuenta,
comensales, línea enviada y saldo pendiente.

## 8. Cierre T5

T5 queda **CERRADA** en QA para el alcance probado: fixture de artículo,
recuperación, asignación y cambio de mesa, unión de cuentas, cortesía sin
cobro, enrutamiento de cocina y conservación del pendiente de pago. No se
registró ningún cobro, no se accedió a PROD y no se usó SQL directo.

### Siguiente etapa

La siguiente etapa del Plan Maestro L&A Suite es **T6**: completar la matriz de
cobros y documentos pendientes —Bizum, propina, vale regalo, factura y email—
en QA, manteniendo T7 (impresora, puente y cajón) como etapa posterior.
