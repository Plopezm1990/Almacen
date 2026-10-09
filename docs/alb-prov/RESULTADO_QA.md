# Resultado de la QA — alta automática de proveedores desde la foto del albarán

Fecha: 2026-10-08 · Dónde: vista previa de QA `deploy-preview-118--chic-entremet-9107cf.netlify.app` (empresa «QA Empresa A, S.L.», local «Local A1», usuario Propietario), con el simulador de la función de IA desplegado en QA (versión 2 de `importar-albaran`). Quién: Cowork, siguiendo el prompt de `GUIA_PRUEBAS_QA.md` §5. Producción: sin ningún contacto.

## Veredicto: 8 de 8 escenarios OK, sin diferencias respecto al guion

| Escenario | Resultado |
|---|---|
| A · 1 foto, proveedor nuevo, dar entrada | «Proveedor nuevo detectado: Queseria Prueba Alb S.L. · B12345617»; al dar entrada, aviso verde «Se ha dado de alta el proveedor «Queseria Prueba Alb S.L.»…»; «Entendido» lo cierra. El selector de proveedor decía «Detectar por la foto (recomendado)». |
| B · Proveedores | Aviso de pendientes, tarjeta con «Creado por IA · revisar» y «NIF/CIF: B12345617»; «Marcar como revisado» quita marca y aviso. |
| C · 1 foto, segunda vez | «✓ Proveedor reconocido: Queseria Prueba Alb S.L. (por su NIF/CIF)»; guardado como borrador; sigue habiendo **un solo** proveedor. |
| D · 2 fotos, parecido | Aparecen «Sí, es Queseria Prueba Alb S.L. (B12345617)» y «No, es un proveedor nuevo»; «Dar entrada» sin decidir se niega («Confirma si el proveedor de la foto es uno de los que ya tienes o es nuevo…»); tras «Sí, es …» y guardar, no se crea ningún proveedor. |
| E · 3 fotos, sin datos | «No he podido identificar al proveedor en la foto»; «Dar entrada» se niega («Selecciona el proveedor.»). |
| F · 4 fotos, NIF mal | «Proveedor nuevo detectado: Distribuciones Prueba Dos S.L.» con el aviso del NIF B12345618; al guardar se crea **sin NIF**. |
| G · 5 fotos, mismo nombre otro NIF | «Tiene el mismo nombre pero otro NIF/CIF»; cancelado sin dar entrada. |
| H · Proveedores, NIF | Con B12345618: «El NIF/CIF no es válido. Revisa la letra o el dígito de control.»; con B12345617: «Ya tienes un proveedor con ese NIF/CIF: Queseria Prueba Alb S.L.»; no queda creado «Proveedor Test H». |

## Observaciones de Cowork (no son fallos)

1. Aviso de «albarán duplicado SIM-0001» en la 2.ª prueba: es del simulador (siempre devuelve el mismo número); en producción el número lo lee la IA.
2. El texto de la tarjeta decía «Queseria Prueba **Alva**» (la variante del simulador para el escenario 2, a propósito).
3. **Cobertura:** las fotos se subieron inyectando el archivo en el campo oculto con JavaScript (Cowork no puede abrir el selector de cámara/galería del móvil). El código que lee los archivos no ha cambiado, pero **el selector real de cámara/galería del móvil no se ha ejercitado en esta QA**.
4. Un clic desviado de Cowork abrió «Pedidos de compra» (no guardó nada) y un menú «Más» se reabrió solo varias veces durante la prueba (comportamiento de la interfaz de QA, ajeno a este paquete); Cowork lo cerró sin pulsar nada más.

## Datos que ha dejado la prueba en QA (es QA; se pueden dejar o borrar)

- Proveedores: «Queseria Prueba Alb S.L.» (revisado) y «Distribuciones Prueba Dos S.L.» (creado por IA, pendiente de revisar, sin NIF).
- Albaranes: uno **dado de entrada** (A, con movimientos de stock de QP-001/QP-002) y borradores de las pruebas C y D.

## Qué queda sin cubrir (y por eso la primera foto real conviene hacerla con atención)

- La lectura **real** por la IA de producción (la función v16 devuelve `proveedorNombre` y `proveedorCif`, pero su instrucción no explica qué es cada uno: puede devolver null o, raramente, el cliente; la aplicación solo detecta el caso de la propia empresa).
- El selector real de cámara/galería en el móvil.
