# Referencia oficial del modo caja · «doble banda» · 26/11/2026

**Decisión (E1 del plan de corrección del TPV, hallazgo H-07, caso V-19).** La referencia oficial
del modo caja del TPV en Órbita es la **propuesta A «doble banda»**, que el usuario eligió el
25/11/2026 («Sí, la 1») y que está implantada desde `2d49edef` hasta `aa809c3a`. El 26/11/2026
el usuario pidió elegir la opción recomendada («Has lo más recomendado, actúa como experto») y
la recomendada era confirmarla. **Sustituye, para el modo caja, a la composición de la pantalla
`tpv-01` de la maqueta Órbita** (catálogo a la izquierda y ticket a la derecha).

Esta decisión **no cambia código**. Fija contra qué se mide el modo caja.

## Imágenes de referencia

En `referencias/modo-caja-doble-banda/`, renderizadas a escala 1 desde el `mockup.html` de la
propuesta A, con el área útil de la aplicación y sin barras del navegador:

| Tamaño | Archivo |
|---|---|
| Ordenador 1440 × 900 | `a-ordenador.png` |
| Tablet 1024 × 768 | `a-tablet.png` |
| Móvil 390 × 844 | `a-movil.png` |

Las propuestas B «ticket en cabecera» y C «ticket central» **quedan descartadas** y no son
referencia de nada.

## Organización

- **Doble banda:** catálogo arriba, ticket abajo, y cobro anclado al ticket.
- **La página no desplaza.** Catálogo y categorías paginados con flechas. **Solo las líneas del
  ticket desplazan.** El total y el cobro quedan fuera del contenedor desplazable.
- **Un único botón de acción naranja por vista.**
- **Acciones secundarias en capas** con «Volver al pedido» explícito. Ninguna barra de funciones
  desplegable sobre el catálogo.
- En móvil, cuatro productos por página.

## Dónde está cada función

| Acceso | Contenido |
|---|---|
| Venta rápida / Sala-restaurante | Modos de venta existentes, con su estado y confirmaciones. |
| Buscar producto, lector, F2 | Búsqueda y lector existentes. Categorías por grupos con flechas. |
| Productos y flechas de página | Añadir producto. Variantes y modificadores en diálogo con «Volver al pedido». Sin stock, inhabilitado. |
| Líneas del ticket | Menos, cantidad editable, más, quitar y subtotal. |
| Cuenta ··· | Vaciar; descuento/cortesía; cuentas aparcadas y recuperar; unir; repartir; modalidad; comensales; cambiar responsable; nota a cocina; abrir mesas. Conservan sus permisos. |
| Guardar F9 / Enviar a cocina | Guardado y envío según el flujo existente, sin duplicar efectos. |
| Sala / mesas | Capa con zonas, mesas libres y ocupadas, selección de cuenta y «Volver al pedido». |
| Cobrar F4 | Capa con Efectivo, Tarjeta, Mixto, Transferencia y Otro, importe entregado y cambio. Total fijo y una sola acción «Confirmar cobro». |
| Ventas del día | Otra vista con tickets, reimprimir y anular, y «Volver al modo caja». |
| Terminal A1 / Salir | Identificación del terminal y salida del modo caja. |

## Lo que hay que corregir en lo implantado para que coincida con esta referencia

La auditoría del 25-26/11 encontró desviaciones concretas. Al corregirlas, el modo caja cumple la
referencia. Ver `auditoria-tpv/HALLAZGOS_TPV_2026-11-25.md`:

| Hallazgo | Desviación respecto de la referencia |
|---|---|
| H-01 | «Cobrar» sin estilo de acción principal: la regla de la tarjeta lo anula |
| H-02 | El aviso de sincronización tapa el botón de cobro |
| H-03 | Las capas no son diálogos accesibles y el escaneo con una capa abierta añade productos |
| H-08 | Contraste insuficiente en la categoría activa |
| H-09 | Categorías con desplazamiento horizontal en lugar de paginación |
| H-10 | En móvil, «Terminal» y «Salir del modo caja» fuera de la vista |
| H-11 | A 320 × 640 solo caben 2 productos por página |
| H-12 | «Cobrar» destacado con el ticket vacío |
| H-13 | Botón de tema con emoji dentro del modo caja |

## Qué falta en la maqueta y en la documentación

- La maqueta Órbita (`LA-Suite-rediseno/dist`, pantalla `tpv-01`) **no se ha tocado**: es un paquete
  compilado fuera de este repositorio. Para que deje de contradecir esta decisión hay que
  **añadir una pantalla «modo caja» con la doble banda** (las tres imágenes de arriba son su
  punto de partida) o marcar `tpv-01` como «TPV normal, no modo caja».
- `EQUIVALENCIAS_PESTANAS_ORBITA_2026-11-25.md` **enlaza aquí** para el modo caja.
- Las capturas medidas del modo caja implantado están en
  `auditoria-tpv/evidencias/01…04-modo-caja-venta-rapida-*.jpg`.

## Alcance y límites

- Esta referencia vale **para el modo caja**. El TPV normal sigue la maqueta `tpv-01` y sus
  hallazgos (por ejemplo H-16 sobre los nombres de producto).
- **No se ha comparado píxel a píxel** el modo caja implantado con las imágenes de la
  propuesta A. La coincidencia de estructura se apoya en las mediciones visuales de la
  auditoría (`auditoria-tpv/evidencias/mediciones-visuales-aa809c3a.json`) y en el contrato
  `tests/rediseno/tpv-caja-orbita-contract.mjs`.
