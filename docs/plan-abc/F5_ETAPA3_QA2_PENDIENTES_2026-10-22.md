# Etapa 3 · QA-2: estado y pendientes

Fecha: 2026-10-22  
Entorno: `deploy-preview-172` · `QA Empresa A, S.L.` · `QA Local A1`  
Estado: `ETAPA_1_CERRADA; QA2_EN_CURSO; SIN_PROD`

## Resultado ya validado

- El TPV acepta la cantidad rápida `+2` para `Bocadillo de tortilla (QA)`.
- El configurador acepta `Sin cebolla` y `Extra de queso`.
- El pedido de prueba `6be0c6e0-0740-46cb-a64b-942c57d0b705` se guardó y se
  envió sin cobro.
- Cocina recibe la comanda en `Cocina QA-A1` con estado `PENDIENTE`.
- El pedido generó exactamente un movimiento de stock de venta, sin duplicado.
- El contrato local de Etapa 3 pasa: `node tests/f5/f5-etapa3-ui-contract.mjs`.
- El contrato T1-T4 de Etapa 4 pasa: `node tests/f5/f5-etapa4-t1-t4-ui-contract.mjs`.

## Pendientes de QA-2

| Punto | Estado | Condición de cierre |
| --- | --- | --- |
| F4 «Vaciar» | PENDIENTE SEGURO | Probar únicamente con carrito vacío y sin pedido pendiente para evitar activar cobro o borrar una comanda operativa. |
| Fotos de catálogo | PENDIENTE | Preparar un producto QA con imagen válida y comprobar que la tarjeta la muestra. |
| Distintivo «Más vendido» | PENDIENTE | Preparar un caso QA marcado como más vendido y comprobar la etiqueta visible. |
| Indicador «sin stock» | PASS VISUAL | El producto `QA AUD002 3DEC 20261022` aparece con `sin stock` y sus botones desactivados. Falta conservar captura si se exige evidencia gráfica. |
| Notas de línea | PENDIENTE | Confirmar que existe un control visible, guardar una nota QA y verificar que llega a la comanda sin cobrar. |
| Alérgenos | PENDIENTE | Confirmar dónde se muestran y comprobar un producto QA con alérgenos configurados. |
| Preparación en Cocina | PENDIENTE | Pulsar «Iniciar preparación» solo con autorización específica, porque cambia el estado operativo de la comanda. |

## Límites de la siguiente pasada

- Solo QA; no PROD, migraciones ni cambios remotos en Supabase.
- No pulsar «Cobro», no registrar pagos y no emitir documentos fiscales.
- No borrar el pedido `6be0c6e0-0740-46cb-a64b-942c57d0b705`; queda como evidencia.
- Antes de probar F4, notas, alérgenos o preparación, crear un contexto de
  prueba independiente o confirmar que no se altera la comanda de evidencia.

## Orden recomendado

1. Preparar o localizar los fixtures QA de foto, «Más vendido» y alérgenos.
2. Probar esos tres casos desde TPV sin guardar ningún pedido.
3. Vaciar un carrito de prueba realmente vacío y registrar el resultado.
4. Documentar la presencia de notas y su persistencia en una comanda nueva,
   sin cobrarla.
5. Si sigue siendo necesario validar Cocina, pedir autorización separada para
   «Iniciar preparación» y verificar después el estado sin realizar cobro.

La Etapa 1 de AUD-009/AUD-003 está cerrada en su adenda de QA. Este documento
mantiene separados los pendientes de interfaz y operación de QA-2 para no
reabrir ese cierre ni mezclarlo con PROD.

## Adenda de inspección de datos y formulario · 2026-10-22

- En `public.catalogo_tpv_productos`, la proyección QA consultada no contiene
  campos de imagen, `masVendido`, `destacadoTPV` ni alérgenos. Los productos
  publicados para QA solo exponen nombre, precio, stock y `snapshot_origen`.
- En el TPV, el caso `QA AUD002 3DEC 20261022` confirma visualmente `sin stock`
  y deja desactivados `+2` y `+3`.
- En Productos > Editar producto, el formulario sí dispone del selector de los
  14 alérgenos obligatorios, pero el formulario no ofrece campos para imagen,
  «Más vendido» o `destacadoTPV`. Por tanto, no se puede cerrar esos tres
  casos desde la UI actual sin un fixture o una fuente de datos adicional.
- Se abrió el editor de `Bocadillo de tortilla (QA)` solo para inspección y se
  cerró sin pulsar «Guardar cambios»; no se modificó ningún producto ni el
  pedido operativo.

Conclusión de esta pasada: el bloqueo de fotos y «Más vendido» es de datos/UI
de QA, no una prueba pendiente que pueda resolverse pulsando más controles en
el navegador. El caso de alérgenos tiene soporte de edición, pero necesita un
producto ficticio QA configurado y una verificación visual en TPV; no se creó
porque requiere autorización explícita para modificar datos QA.

## Adenda de fixture QA autorizado · 2026-10-22

- Se creó en `QA Empresa A, S.L. · QA Local A1` el producto ficticio
  `QA Fixture E3 Foto MasVendido Alergenos`, código
  `QA-E3-FOTO-MASV-ALERG`, id local `mvjkrdts6dwfmm`.
- Se guardó el alérgeno `gluten`; la comprobación visual del editor mostró el
  botón «Cereales con gluten» seleccionado.
- Se configuraron precio de venta `1,50 €`, coste unitario sin IVA `0,50 €` y
  stock inicial `10` unidades. El stock quedó en almacén, con `0` unidades en
  piso de venta, por lo que no se añadió al TPV ni al pedido operativo.
- El producto se encontró en la clave QA `productos` del servidor. La consulta
  confirmó `foto`, `imagen`, `fotoUrl`, `masVendido`, `destacadoTPV` y
  `destacado` sin valor. La UI de Productos no ofrece controles para esos
  campos y el catálogo TPV autoritativo tampoco los proyecta.
- Tras guardar, la aplicación mostró el aviso visible de que el movimiento
  inicial no pudo sincronizarse («Un cambio no se ha podido guardar
  (movimientos)»). No se pulsó «Reintentar» y el aviso queda documentado como
  pendiente de autoridad QA.

Estado: el caso de alérgeno ya tiene fixture QA guardado; fotos y «Más
vendido» siguen BLOQUEADOS por falta de campos y proyección autoritativa. No
se debe marcar QA-2 completo con este fixture hasta resolver esa fuente y
disponer de stock en piso mediante una operación QA autorizada.

## Adenda de implementación preparada · 2026-10-22

- `fuente.js` y `source-recovery/fuente-recuperado.js` ahora exponen en alta y
  edición de Productos una URL de foto opcional y la marca «Más vendido».
- La URL se acepta únicamente con esquema `https://`; la marca se conserva
  como booleano en el objeto de producto. El TPV ya consume ambos campos y
  mostrará la foto y la etiqueta cuando el catálogo autoritativo los proyecte.
- Los contratos locales pasan: `f5-etapa3-ui-contract.mjs`,
  `f5-etapa4-t1-t4-ui-contract.mjs`; ambos bundles pasan además `node --check`
  y `git diff --check` no detecta errores.
- No se ha desplegado ni modificado PROD. QA-2 sigue pendiente de reconstruir
  el preview, cargar un producto con stock de piso y repetir la comprobación
  visual de foto, «Más vendido» y alérgenos.
