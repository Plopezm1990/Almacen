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

**La asignación de mesa, el enrutamiento de la nueva comanda y la cortesía QA
sin cobro quedan PASS. T5 continúa PARCIAL y la Etapa 5 permanece ABIERTA.**

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
- El backend también expone `abc_unir_cuentas` y el permiso
  `ABC_CUENTA_UNIR`, pero el TPV visible no recibe esa operación ni renderiza un
  control de unión. El componente actual expone traslado de mesa y reparto de
  líneas, no una acción de unión de cuentas/mesas.

Por tanto, no es válido marcar como PASS “cambiar mesa” ni “unir mesas”. El
cambio de mesa está **BLOQUEADO por falta de fixture/configuración accesible**;
la unión está además **BLOQUEADA por falta de integración de UI**, aunque su
RPC exista en el backend. El próximo trabajo debe habilitar la segunda mesa
mediante un flujo autenticado del propietario o un fixture QA autorizado y
conectar la unión al TPV antes de repetir la prueba. No se debe usar una
escritura SQL directa ni cambiar de local para simular una segunda mesa.

### Siguiente paso

1. Conectar al TPV el flujo de unión de cuentas respaldado por
   `abc_unir_cuentas`, con motivo, control de versiones y sin cobro.
2. Habilitar en QA una segunda mesa en `SALA-QA` mediante el flujo autenticado
   soportado y crear una segunda cuenta operativa sin cobro.
3. Repetir “cambiar mesa” y “unir mesas” y verificar que las líneas, cocina,
   cortesías y cobros pendientes se conservan.
4. Mantener pendientes T6 (Bizum, propina, vale regalo, factura y email) y T7
   (impresora, puente y cajón) hasta disponer de sus entornos/equipos de QA.
