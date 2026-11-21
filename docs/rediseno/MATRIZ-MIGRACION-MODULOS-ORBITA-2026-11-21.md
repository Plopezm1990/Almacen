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
| 4 | Cocina | `cocina`, `.la-operacion-cocina` | PARCIAL: superficie operativa existente | Migrar cabecera, tarjetas, estados, filtros y densidad |
| 5 | Caja | `caja`, `.la-operacion-caja` | PARCIAL: superficie operativa existente | Migrar cobros, arqueos, cierres, reembolsos y documentos sin tocar permisos |
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
