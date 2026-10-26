# Etapa 7.1 — Cierre de rehidratación contextual del catálogo TPV en QA

**Fecha:** 26/10/2026  
**Entorno:** QA exclusivamente (`qjqorixtkilwsndqayyx`)  
**Deploy probado:** Deploy Preview del PR `#175`, rama `codex/etapa5-recuperacion-qa`  
**Commit probado:** `371468b3e9f5439339774ae9873c5c4f042edca9`  
**Producción:** no modificada

## 1. Alcance

Este documento cierra la corrección del caso en el que el TPV conservaba o
mostraba el catálogo de una empresa anterior después de cambiar de empresa o
local. La prueba se limitó a navegación, carga de contexto y lectura del
catálogo en QA.

No se pulsó ningún producto, no se añadió ninguna línea al ticket y no se
ejecutaron ventas, cobros, devoluciones, movimientos de caja ni operaciones de
stock.

## 2. Causa identificada

La rehidratación de productos tenía tres problemas combinados:

1. El efecto de contexto solo ejecutaba la sincronización una vez mediante una
   referencia de inicialización. Al cambiar de empresa, el TPV no recibía una
   nueva lectura contextual fiable.
2. La lectura de `almacen_kv` no fijaba explícitamente la empresa activa. En un
   navegador con caché de varias empresas eso podía devolver una colección que
   no correspondía al contexto seleccionado.
3. Una colección vacía no se publicaba siempre en el estado de productos. Por
   tanto, un catálogo anterior podía sobrevivir visualmente cuando el nuevo
   contexto no tenía productos.

El resultado era especialmente peligroso en una prueba A/B: la interfaz podía
parecer estable, pero el contenido del TPV no demostraba que el cambio de
empresa hubiera aislado realmente el catálogo.

## 3. Corrección implementada

El commit `371468b` aplica la corrección en las dos copias de la fuente:

- `fuente.js`;
- `source-recovery/fuente-recuperado.js`.

La función `sincronizarContextoPm07` ahora:

- recibe la empresa activa de forma explícita;
- falla cerrado si no existe contexto de empresa;
- consulta `almacen_kv` con `empresa_id` y `key = productos` explícitos;
- publica también una lista vacía, evitando reutilizar el catálogo anterior;
- conserva el contexto de local para la recarga operativa.

El efecto de contexto publica la empresa y el local activos antes de llamar a
`__recargarContextoOperativo()`, y se ejecuta en cada cambio de contexto. Se
eliminó la inicialización de una sola vez y se pasa `empresaId` a la
sincronización. El cambio se mantuvo reflejado en la fuente recuperada para no
romper la paridad del espejo.

También se actualizó el contrato estático:

- `tests/pm12/p13-local-context-sync-contract.mjs`.

## 4. Evidencia server-side de QA

La lectura de QA confirmó que las colecciones pertenecen a empresas distintas
y no dependen del estado visual del navegador:

| Empresa QA | Elementos en `almacen_kv` para `productos` | Catálogo activo con precio |
|---|---:|---:|
| `QA-EMP-A` | 34 | 33 |
| `QA-EMP-B` | 1 | 1 |

El artículo delimitador de B fue:

- nombre: `QA B Scoped Producto 4`;
- SKU: `QA-B-SCOPE-04`;
- `producto_id`: `mvp5p6r2a9v4uz`;
- empresa/local: `QA-EMP-B` / `QA-B1`;
- precio mostrado en catálogo fiscal QA B: `€1,21`.

La consulta de aislamiento no encontró el mismo producto en el catálogo de
`QA-EMP-A`.

## 5. Prueba funcional A → B → A

### 5.1 Estado inicial en A1

Con `QA Empresa A, S.L.` y `Local A1`, el Deploy Preview mostró:

- encabezado: `Local A1 · QA Empresa A, S.L.`;
- catálogo TPV: `18 producto(s) disponible(s)`;
- ticket: `0 líneas · €0,00`;
- `F9 Guardar`: deshabilitado.

### 5.2 Cambio a B1

Se cambió el selector a `QA Empresa B`, se seleccionó `Local B1` y se abrió el
TPV. El resultado fue:

- encabezado: `Local B1 · QA Empresa B`;
- catálogo TPV: `1 producto(s) disponible(s)`;
- artículo visible: `QA B Scoped Producto 4 €1,21`;
- ticket: `0 líneas · €0,00`;
- `F9 Guardar`: deshabilitado;
- historial del local: `0` ventas registradas.

El producto del catálogo A no permaneció visible en B.

### 5.3 Retorno a A1

Se salió del TPV sin guardar, se volvió a `QA Empresa A, S.L.`, se seleccionó
`Local A1` y se abrió de nuevo el TPV. El resultado fue:

- encabezado: `Local A1 · QA Empresa A, S.L.`;
- catálogo TPV: `18 producto(s) disponible(s)`;
- ticket: `0 líneas · €0,00`;
- `F9 Guardar`: deshabilitado.

El catálogo B no permaneció visible al regresar a A. La secuencia completa
queda, por tanto, **PASS** para rehidratación y aislamiento contextual del
catálogo TPV.

## 6. Pruebas técnicas ejecutadas

Todas las comprobaciones siguientes superaron el resultado esperado:

- `node tests/pm12/p13-local-context-sync-contract.mjs`;
- `node tests/p3/p3c-client-contract.mjs`;
- `node tests/p3/p3-catalogo-static-contract.mjs`;
- `node tests/p3/p3b-espejo-static-contract.mjs`;
- `node tests/f4/b11/b11-offline-boundary-contract.mjs`;
- `node --check fuente.js`;
- `node --check source-recovery/fuente-recuperado.js`;
- `git diff --check`;
- `node .github/scripts/build-netlify-publish.mjs`;
- `node tests/netlify-publish-boundary.mjs`.

El script heredado
`node .github/scripts/punto6-netlify-publicacion-recuperacion.mjs` sigue
teniendo un error sintáctico independiente en su propia línea 40. No se
modificó porque no pertenece a esta corrección y el build más el contrato de
publicación sí pasaron.

## 7. Observaciones de la prueba

El pie de la aplicación mantiene el indicador QA de `2 colecciones solo en
este equipo`. Es una política local de QA ya conocida para colecciones no
subibles y no se interpretó como una cola de venta, cobro ni efecto pendiente.
No se borró ni se alteró ese estado durante esta validación.

Para obtener el bundle nuevo en el navegador que ya tenía el preview abierto
fue necesario evitar la caché antigua del service worker durante la prueba.
Esto es una condición de la sesión de verificación, no un cambio de datos ni
una modificación de producción.

## 8. Estado y siguiente paso

**CERRADA en QA:** rehidratación contextual del catálogo TPV al cambiar
`A1 → B1 → A1`, aislamiento del artículo delimitador de B, ticket vacío y
ausencia de operaciones comerciales nuevas.

**Producción:** sin cambios; el deploy productivo continúa fuera de esta
validación.

**Sigue:** ejecutar la aceptación física T9 con hardware autorizado (impresora,
cajón y, si procede, puente local), y después consolidar el acta global de la
Etapa 7 con los subbloques que sigan abiertos. La Etapa 7 completa todavía no
se declara cerrada únicamente por esta prueba de catálogo.
