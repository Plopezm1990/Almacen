# Matriz de migración visual por módulos · Órbita

Fecha: 21/11/2026  
Rama: `rediseno/f0-base-qa` · PR #225 en borrador

Esta matriz evita confundir “usa el shell” con “está migrado visualmente”. Un
módulo solo pasa a `CERRADO` cuando tiene el marco común, sus componentes
visuales normalizados, revisión de escritorio y móvil, estados de carga/error/
vacío y contratos sin regresión.

| Orden | Módulo | Superficie identificable | Estado actual | Cierre pendiente |
|---:|---|---|---|---|
| 1 | Inicio y panel general | `inicio`, `.la-panel-diseno` | PARCIAL: panel Órbita ya visible y detalle antiguo separado | Revisar todas las variantes de indicadores y estados en 5 viewports |
| 2 | TPV y sala | `tpv`, `.tpv-layout` | PARCIAL: layout operativo y shell existentes | Unificar venta rápida, sala, cuentas, mesas, tickets y estados móviles |
| 3 | Pase | `pase`, `#la-pase` | PARCIAL: panel real y cola ya integrados | Igualar tarjetas, filtros, destinos y revisión móvil |
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
