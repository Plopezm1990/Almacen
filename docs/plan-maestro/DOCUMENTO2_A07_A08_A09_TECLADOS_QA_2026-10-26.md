# Documento 2 — secciones 7–9: teclados y calculadora

Fecha: 2026-10-26  
Entorno: QA del puesto TPV  
Estado: TERMINADA

## Alcance leído del PDF

Este bloque corresponde literalmente a las secciones 7, 8 y 9 del documento de referencia:

- **Sección 7 — Teclado numérico contextual:** edición de cantidad/importe en el campo activo, sustitución del primer dígito, coma decimal controlada, borrado limitado al borrador, aceptar/cancelar local y mensajes de validación sin guardar ni cobrar.
- **Sección 8 — Teclado de texto:** búsqueda por nombre o código con `inputmode=search`, compatibilidad con lector de código/teclado físico, notas de cocina con alérgenos declarados y límite visible de 500 caracteres. El Enter de búsqueda sigue siendo del flujo de búsqueda y no del cobro global.
- **Sección 9 — Calculadora de apoyo:** acceso desde la barra del TPV, expresión y visor, operaciones controladas sin `eval`, división por cero visible y aislamiento total respecto a cantidades, precios, descuentos y pagos.

## Trabajo realizado

La lógica funcional de cantidades y calculadora ya estaba implementada y se conserva. Este pase completa su fidelidad visual y su trazabilidad frente al PDF en ambas fuentes espejo:

- El teclado de cantidades queda identificado como sección PDF A07 y mantiene teclas de 3 columnas, separación de 8 px, objetivo mínimo de 56 px, visor con borde de 2 px y edición exclusivamente local.
- La búsqueda queda identificada como sección PDF A08, con nombre accesible explícito, objetivo táctil de 48–52 px y texto de 16 px. Se retira el `autofocus` forzado para no ocultar el catálogo en tablet; el botón **F2 Buscar** continúa enfocando el campo cuando el operador lo solicita.
- La nota de cocina mantiene el máximo de 500 caracteres, incorpora un área legible de 16 px y un contador visible `0/500` que se actualiza con el borrador. Se conservan los alérgenos declarados y las acciones existentes del configurador.
- La calculadora queda identificada como sección PDF A09, limitada visualmente a 480 px, con visor de 32–40 px y teclas de 56 px. No se añade ninguna acción de aplicar precio o descuento.
- El contrato `documento2-a07-a09-teclados-contract.mjs` exige que el CSS y los marcadores de ambas fuentes sean idénticos.

## Límites de seguridad

La validación se realiza en QA. En este bloque no se crea una comanda, no se añade producto al carrito, no se modifica stock, no se cobra y no se llama a operaciones de negocio. Producción permanece fuera de alcance.

## Verificación prevista

1. Ejecutar sintaxis, contrato nuevo y contratos previos de teclados, TPV visual, recuperación y publicación.
2. Construir el artefacto publicable y pasar el límite de publicación antes de subirlo.
3. Publicar únicamente en la rama/preview de QA.
4. Revisar a 1024×768 y 390×844: búsqueda, calculadora, foco, objetivos táctiles y ausencia de overflow/errores de consola.

## Resultado — TERMINADA

- Contrato nuevo A07/A08/A09: PASS.
- Sintaxis de ambas fuentes: PASS.
- Contratos existentes A04, A05/A06, fase 4 de teclados/calculadora, pase visual 3 y revisión de salida/recovery: PASS.
- Build determinista y límite de publicación: PASS (`NETLIFY_PUBLISH_BOUNDARY_PASS`, 68 entradas; CSS generado 17.764 bytes).
- Deploy QA: READY — `6adf58137f3a27a942781037`.
- Commit validado: `ada82ed3b0fbebb1aed6b267dc875c8dd695de63`.
- Check Netlify del commit: SUCCESS.
- Escaneo de secretos del deploy: 0 coincidencias.
- Prueba viva a 1024×768: búsqueda de 48 px de alto, 16 px, nombre accesible correcto, sin autofocus forzado; calculadora de 408 px, visor de 79,2 px, teclas de 56 px y sin overflow.
- Prueba viva a 390×844: calculadora adaptada a 318,4 px, teclas de 56 px y sin overflow; búsqueda de 355,2 × 48 px y sin overflow.
- Consola del navegador: 0 errores durante la navegación y las comprobaciones.
- No se añadió producto, no se creó una comanda, no se guardó un pedido, no se modificó stock y no se ejecutó ningún cobro.

Producción no se ha modificado: el deploy productivo `6ade31231b74245b4d359d98` queda fuera de este bloque.
