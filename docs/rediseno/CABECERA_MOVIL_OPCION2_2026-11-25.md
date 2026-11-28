# Cabecera móvil · opción 2 · 25/11/2026

Petición: aplicar la propuesta móvil con búsqueda visible y quitar la tarjeta de local duplicada del panel.

La cabecera móvil tiene tres filas: logo dorado SVG, avisos y perfil; selector de local, QA y Apariencia; búsqueda global a todo el ancho. Se reemplazan los símbolos de búsqueda, avisos y apariencia por iconos SVG reconocibles. Los mismos handlers operativos siguen conectados.

La tarjeta original de local se oculta visualmente cuando el shell está montado y solo contiene el selector de local. Su select permanece en el DOM porque el menú superior usa sus opciones y despacha su evento React de cambio. Si la tarjeta incluye además un selector de Empresa, no se oculta: el menú superior actual solo reproduce locales y ocultarla eliminaría una capacidad existente. No se modifican datos ni permisos.

Marcas: shell v33, CSS v85. La revisión visual se realiza en el preview de QA; el modo local permite verificar composición y handlers sin escribir operaciones en el servidor.
