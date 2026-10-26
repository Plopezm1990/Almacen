# Documento 2 · Pase visual 1 del TPV en QA

**Fecha:** 2026-10-26  
**Documento de referencia:** `LA-Suite-TPV-puesto-unico-documento-2.pdf`  
**Ámbito:** QA exclusivamente (`qjqorixtkilwsndqayyx`)  
**Estado:** TERMINADA — primera pasada visual desplegada y comprobada

## 1. Qué se ha aclarado antes de implementar

El Documento 2 define el puesto TPV de un solo puesto y contiene láminas de referencia visual. Sus páginas de alcance y fases explican que esas láminas funcionan como dirección UX y objetivo de evolución; no significan que toda la maqueta deba aparecer automáticamente en la versión que ya estaba publicada.

Por eso se ha comenzado con una implementación controlada sobre QA. No se ha modificado la producción ni se ha mezclado el proyecto Supabase de producción.

## 2. Implementación realizada

Se ha aplicado una primera capa visual común en:

- `fuente.js`
- `source-recovery/fuente-recuperado.js`

La copia de recuperación mantiene el mismo contrato visual que la fuente activa.

### Cambios visibles

- Fondo y espaciado del puesto TPV con una composición más próxima a la lámina del documento.
- Cabecera y controles del TPV con mayor jerarquía y zonas táctiles más amplias.
- Barra de acciones rápidas con F9 como acción principal cuando corresponde.
- Navegación de secciones TPV fijada en la parte inferior, con estado seleccionado más claro.
- Separación en dos columnas para catálogo y ticket en escritorio.
- Catálogo con tarjetas más grandes, imagen, precio y cantidades rápidas más legibles.
- Panel de ticket convertido en una tarjeta visual estable y visible aunque esté vacío.
- Búsqueda y categorías con mayor altura para uso táctil.
- Repliegue responsive a una columna en pantallas estrechas.
- Ajustes de separación, safe area y tamaños para móvil.

Esta entrega es deliberadamente visual. No cambia el contrato server-side de guardado, cobro, inventario ni comandas.

## 3. Validaciones técnicas

Todas las comprobaciones siguientes han pasado:

- `node --check fuente.js`
- `node --check source-recovery/fuente-recuperado.js`
- `node tests/plan-maestro/documento2-fase1-puesto-completo-contract.mjs`
- `node tests/plan-maestro/documento2-fase2-rehome-blocks-contract.mjs`
- `node tests/plan-maestro/documento2-fase3-catalogo-ticket-contract.mjs`
- `node tests/plan-maestro/documento2-fase4-teclados-calculadora-contract.mjs`
- `node tests/plan-maestro/documento2-fase5-cobro-caja-contract.mjs`
- `node tests/pm12/p13-local-context-sync-contract.mjs`
- `git diff --check`
- `node .github/scripts/build-netlify-publish.mjs`
- `node tests/netlify-publish-boundary.mjs`

Resultado de los contratos Documento 2: `PASS`.  
Resultado de publicación de artefactos Netlify: `PASS`.

## 4. Despliegue de QA y comprobación funcional no destructiva

El commit de esta entrega es:

`bfbdbd89796fb36d9c625af2fc0dd9dc3bc41124` (`bfbdbd8`)

La preview asociada al PR #175 quedó en estado `READY`:

`https://deploy-preview-175--chic-entremet-9107cf.netlify.app/`

La comprobación visual se hizo dentro de la aplicación QA, entrando en:

- empresa QA Empresa A, S.L.;
- local Local A1;
- vista TPV;
- sección Venta.

Se verificó que la vista carga el marco del puesto, la barra de secciones, la tarjeta de catálogo y la tarjeta de ticket con el nuevo tratamiento visual. En esa sesión concreta el catálogo mostró cero productos porque el navegador informó que las colecciones locales no están disponibles en ese entorno; esto no impidió validar la composición vacía y el estado de ticket preparado.

No se hicieron estas acciones durante la comprobación:

- no se pulsó ningún producto;
- no se creó ninguna comanda;
- no se guardó ningún ticket;
- no se abrió cobro;
- no se abrió cajón;
- no se cambió inventario ni configuración de empresa.

## 5. Límites conocidos de esta entrega

Este primer pase no pretende cerrar toda la adaptación visual del Documento 2. Quedan para la siguiente pasada:

- revisar la coincidencia fina de paleta, tipografía, iconografía y proporciones con cada lámina;
- decidir qué bloques secundarios deben vivir únicamente en `Más` o en vistas dedicadas;
- ajustar las etiquetas de zona y el lenguaje exacto del puesto;
- comprobar el layout con datos de catálogo reales y una cuenta con productos disponibles;
- revisar tablet, móvil y diferentes alturas de pantalla;
- completar la revisión de hardware real del puente de impresión/cajón cuando proceda;
- repetir la validación final de la etapa correspondiente sin mezclarla con producción.

## 6. Estado y siguiente paso

**Pase visual 1 QA: TERMINADA.**

El siguiente paso recomendado es un **pase visual 2**, centrado en la fidelidad fina de las láminas del Documento 2 y en la reorganización de los bloques secundarios. Se hará sobre QA, con otra preview verificable, y se volverá a comprobar el TPV sin registrar operaciones reales.

Producción permanece sin cambios.
