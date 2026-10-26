# Documento 2 · Revisión final A03, A04 y A17 en QA

**Fecha:** 2026-10-26  
**Referencia:** `LA-Suite-TPV-puesto-unico-documento-2.pdf`, láminas A03, A04 y A17  
**Ámbito:** QA exclusivamente (`qjqorixtkilwsndqayyx`)  
**Estado:** TERMINADA — revisión visual, accesibilidad y recorrido de teclado completados

## 1. Alcance y criterio de seguridad

Se revisó el preview QA de la rama de recuperación del Documento 2. La prueba fue de lectura y navegación: no se añadieron artículos, no se guardó ningún ticket, no se cobró, no se abrió el cajón, no se imprimió, no se enviaron correos y no se alteró producción.

La comprobación se realizó sobre:

- escritorio: 1024×768;
- móvil: 390×844;
- vistas Venta, Opciones y Cobro;
- árbol de accesibilidad y foco real del navegador;
- consola del navegador;
- controles de hardware disponibles en el modo actual.

## 2. A03 · Puesto TPV y composición principal

### Resultado: TERMINADA

- En 1024×768, el catálogo y el ticket se mantienen en dos zonas: catálogo a la izquierda y ticket a la derecha.
- La medición del DOM confirmó `body.scrollWidth = 1024` y `document.documentElement.clientWidth = 1024`: no hay desbordamiento horizontal de la página.
- El catálogo conserva tres columnas de productos en escritorio y el ticket queda visible en paralelo.
- En 390×844, el catálogo pasa a dos columnas y el ticket se reubica debajo del catálogo, con `order: 60`.
- La medición móvil confirmó `body.scrollWidth = 390` y `document.documentElement.clientWidth = 390`: no hay desbordamiento horizontal de la página.
- La barra de secciones y la fila de categorías tienen desplazamiento horizontal interno intencionado; no se considera un desbordamiento de la página.
- El árbol de accesibilidad expone las acciones principales (`F2 Buscar`, `F4 Vaciar`, `F9 Guardar`, `Opciones`), las siete secciones operativas, las categorías, el catálogo y el ticket.

## 3. A04 · Opciones 3×3

### Resultado: TERMINADA

- La pantalla se abre con un botón independiente `Opciones`; no se ha creado una octava pestaña operativa.
- En escritorio se visualizan las nueve tarjetas en una cuadrícula 3×3.
- En móvil se visualizan en dos columnas, conservando lectura y tamaño táctil.
- El árbol de accesibilidad expone las nueve tarjetas con nombres descriptivos: Sala, pedido actual, cobro, cocina, caja, calculadora, documentos/correo, descuento/cortesía y vales regalo.
- El recorrido de teclado se comprobó con `Tab`: desde `Volver a Venta` el foco entra en `Mesas y cuentas`, que es la primera tarjeta accionable.
- Las tarjetas y el disparador tienen estilo `:focus-visible`; no se detectó un control visualmente accionable sin foco identificable en la pantalla revisada.
- `Volver a Venta` restaura la vista normal sin alterar el estado de negocio.

## 4. A17 · Móvil, cobro y hardware

### Resultado: TERMINADA CON LÍMITE DOCUMENTADO

- La vista `Cobro` se abre correctamente en móvil; el árbol de accesibilidad expone el estado server-side, `Actualizar`, factura, correo y el bloque de impresión.
- La medición de Cobro mantiene el ancho de página en 390 px. El desplazamiento horizontal observado pertenece únicamente a la navegación de secciones, que está diseñado como carrusel interno en móvil.
- El selector `Impresora` está disponible y muestra `Impresora barra` como opción QA.
- `Imprimir ticket (simulado)` permanece deshabilitado hasta seleccionar una impresora, evitando una falsa confirmación de impresión.
- En Venta se exponen `Puente L&A`, `Cajón monedero`, el selector de cajón, el motivo y `Abrir cajón (simulado)`.
- No se activó el puente, no se seleccionó cajón, no se abrió el cajón y no se imprimió. La evidencia actual confirma el contrato de simulación y la protección de controles, no una conexión física real.
- El propio producto mantiene el aviso de que la impresora real todavía no está verificada; por tanto, la verificación física queda correctamente pendiente y no se presenta como completada.

## 5. Calidad técnica

- Consola QA durante la navegación final: sin errores (`[]`).
- No se observaron respuestas de error ni pantallas rotas durante el recorrido visual.
- `fuente.js` y `source-recovery/fuente-recuperado.js` siguen sincronizados byte a byte en el contrato de revisión.
- Se añadió el contrato `tests/plan-maestro/documento2-revision-final-a03-a04-a17-contract.mjs`.
- La validación de sintaxis, contratos previos, build y frontera de publicación se conserva como condición de publicación.

## 6. Publicación y alcance

La revisión se ejecutó sobre el preview QA de PR #175. La documentación de cierre se publica también únicamente en QA. Producción no se ha tocado: siguen fuera de alcance el sitio Netlify de producción, el deploy productivo y el proyecto Supabase productivo.

## 7. Pendientes reales

1. Verificar con una impresora de tickets y un cajón físicos en una sesión QA controlada.
2. Si se desea certificar fiscalidad, hacer una revisión específica con la asesoría y el proveedor fiscal; el simulador no sustituye esa certificación.
3. Tras completar hardware y aceptación del propietario, decidir si se promueve el conjunto a producción.

**Etapa 7 / revisión final A03-A04-A17: TERMINADA.**
