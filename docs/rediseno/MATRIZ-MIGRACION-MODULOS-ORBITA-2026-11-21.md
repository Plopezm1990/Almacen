# Matriz de migración visual por módulos · Órbita

Fecha: 21/11/2026  
Rama: `rediseno/f0-base-qa` · PR #225 en borrador

Esta matriz evita confundir “usa el shell” con “está migrado visualmente”. Un
módulo solo pasa a `CERRADO` cuando tiene el marco común, sus componentes
visuales normalizados, revisión de escritorio y móvil, estados de carga/error/
vacío y contratos sin regresión.

| Orden | Módulo | Superficie identificable | Estado actual | Cierre pendiente |
|---:|---|---|---|---|
| 1 | Inicio y panel general | `inicio`, `.la-panel-diseno` | PARCIAL: panel Órbita ya visible y detalle antiguo separado; el panel tiene prioridad cuando Pase está incrustado | Revisar todas las variantes de indicadores y estados en 5 viewports |
| 2 | TPV y sala | `tpv`, `.tpv-layout` | PARCIAL: superficie Órbita aplicada a catálogo, filtros, mesas, ticket/caja, paginación y dock móvil; recorridos de datos intactos | Verificar venta rápida, sala, cuentas, mesas, tickets y estados en las rutas reales de escritorio y móvil |
| 3 | Pase | `pase`, `.la-pase` (`#la-pase` legado) | PARCIAL: panel real y cola ya integrados; la raíz semántica ya queda marcada aunque el recorrido histórico use otro selector | Igualar tarjetas, filtros, destinos y revisión móvil |
| 4 | Cocina | `cocina`, `.la-operacion-cocina` | PARCIAL: cabecera, tarjetas, estados, filtros, estaciones/rutas y cola ya tienen capa Órbita; recorrido de estados reales aún pendiente | Verificar rutas reales, vacío/carga/error, estados de comanda y densidad en escritorio y móvil |
| 5 | Caja | `caja`, `.la-operacion-caja` | PARCIAL: apertura, arqueo, movimientos, historial y traspasos ya tienen capa Órbita; recorrido de cobro/cierre real aún pendiente | Verificar cobros, arqueos, cierres, reembolsos, documentos y estados en rutas reales |
| 6 | Clientes | `clientes` | MARCO: shell y escala global | Migrar listado, filtros, ficha, actividad y NIF |
| 7 | Compras | `compras` | MARCO: shell y escala global | Migrar proveedores, pedidos, recepción, albaranes y facturas |
| 8 | Inventario | `inventario` | MARCO: shell y escala global | Migrar productos, movimientos, mermas, caducidad y ajustes |
| 9 | Personal | `personal` | MARCO: shell y escala global | Migrar empleados, cargos, permisos, turnos y fichajes |
| 10 | Configuración | `configuracion` | MARCO: shell y escala global | Migrar empresa, locales, terminales, equipos, fiscalidad y apariencia |
| 11 | Plataforma | `plataforma` | MARCO: shell y escala global | Verificar acceso administrador y sus paneles exclusivos |
| 12 | Acceso | `.la-acceso` y `acceso` | BASE: contrato visual Órbita añadido | Revisar login, recuperación, MFA y selección de empresa/local |

## Cambio de esta tanda

`la-orbita-shell.js` etiqueta ahora cada ruta autenticada con
`data-la-orbita-module` y `data-la-orbita-surface`. Esto permite que cada
bloque se migre y se mida sin duplicar navegación ni handlers. El contrato
visual aplica además a la superficie independiente `.la-acceso`, que no usa
el shell autenticado.

### Corrección de esta tanda · raíz semántica de Pase

En la comprobación del preview, Inicio montó el panel real con la clase
`.la-pase`, no con el id histórico `#la-pase`. El shell quedaba en `pantalla`
y las reglas específicas de Órbita no alcanzaban la cabecera, plano y cola.
La detección y los selectores visuales aceptan ahora ambas raíces. Es un cambio
solo de presentación: no modifica estados de mesa, cola, permisos ni navegación.
La marca de caché de la capa pasó a `qa-orbita-modules-v16-20261121`.

El mismo detector da prioridad a `.la-panel-diseno` cuando Inicio incluye el
panel Pase operativo. Así `Inicio` conserva su identidad de módulo y el Pase
independiente sigue etiquetándose como `pase`.

### TPV y sala · primera migración de superficie

El commit `3ff74403` añade la capa visual scoped a
`main[data-la-orbita-module="tpv"]`: búsqueda, categorías, tarjetas de
producto, paginación, mesas, columna de ticket/caja y dock táctil. La rejilla
se mantiene en dos columnas en móvil y el lateral baja sin overflow; no se
modificaron handlers, fiscalidad, permisos ni persistencia. El módulo sigue en
`PARCIAL` hasta recorrer todos los estados reales (venta rápida, sala, cuenta
abierta, tickets, vacío, carga y error) en escritorio y móvil.

Evidencia live actual: tarjeta de producto de `104 px`, búsqueda de `47 px`,
rejilla de dos columnas en el ancho táctil del banco, lateral estable,
`scrollWidth === innerWidth` y control mínimo de `44 px`.

### Cocina · primera migración de superficie

El commit `6aace0b1` aplica la capa visual Órbita scoped a
`main[data-la-orbita-module="cocina"] .la-operacion-cocina`. La cabecera de
«Cocina y comandas», las tarjetas operativas, avisos de estado, estaciones y
rutas, y la cola de comandas comparten ahora borde, radio, sombra, fondo y
jerarquía tipográfica del sistema. Las tarjetas anidadas de cada comanda
conservan sus estados y acciones; selects, inputs y botones mantienen un área
mínima de `44 px`. En móvil la cabecera envuelve y la cola no fuerza
desbordamiento horizontal. No se cambiaron handlers, RPC, permisos, estados
de cocina ni persistencia.

La caché CSS quedó en `qa-orbita-modules-v18-20261121`. Pasan los contratos
P01, marco (21/21), componentes, rutas (20/20) y autoridad de persistencia.
El bloque sigue en `PARCIAL`: falta recorrer en QA la ruta real de Cocina con
datos, los estados vacío/carga/error y las transiciones de comanda en
escritorio y móvil. El fallo histórico de `pm11-compra/p10` («parche móvil
P10 carga antes del dashboard») continúa aislado y no procede de esta capa.

## Evidencia de base

- `REDISENO_COMPONENTES_ORBITA_CONTRACT=PASS`.
- `MARCO_ORBITA_CONTRACT=PASS (21/21)`.
- `MARCO_ORBITA_RUTAS_CONTRACT=PASS (20 rutas)`.
- `REDISENO_P01_CAPAS_Y_MIGRACIONES_OK=1`.
- `REDISENO_P03_BOTONES_SOLO_ICONO_OK=1`.
- `REDISENO_P05_PROPUESTAS_OK=1`.
- `REDISENO_ORG33_SALA_CONTRACT=PASS`.
- `SOURCE_RECOVERY_CHECK=PASS`.
- `git diff --check` limpio.

Esta matriz es de seguimiento, no un cierre prematuro. El objetivo 4 sigue
activo hasta que los doce módulos pasen individualmente a `CERRADO`.

### Caja · primera migración de superficie

El commit `92785c52` aplica la capa visual Órbita a
`main[data-la-orbita-module="caja"]`. La apertura de sesión, el arqueo diario,
los movimientos y ajustes de caja, el historial, los traspasos y sus avisos
comparten tarjetas, bordes, radios, sombras y jerarquía tipográfica. Los
campos, selectores y botones respetan `44 px`; en móvil los bloques de
denominaciones y formularios pasan a una columna para evitar desbordamientos.
La capa también cubre la raíz histórica `.la-operacion-caja`. No se tocaron
handlers, cobros, reembolsos, permisos, fiscalidad ni persistencia.

La marca de caché CSS es `qa-orbita-modules-v19-20261121` y la huella fijada
por P01 es `ce277db80f8e2cf4`. Pasan P01, marco `21/21`, componentes, rutas
`20/20`, autoridad de persistencia y `git diff --check`. Caja permanece en
`PARCIAL` hasta recorrer en QA cobro, cierre, reembolso, documento y estados
vacío/carga/error en escritorio y móvil; no se ejecutaron nuevas operaciones
de negocio en esta tanda.
