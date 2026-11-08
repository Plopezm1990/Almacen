# PM13 · Punto 4.2 — Identificadores estables de consulta

Fecha: 2026-10-17  
Rama: `codex/fix-product-bootstrap-context-20261015`

## Decisión

Cada entrada de `itemsMeta` conserva tres conceptos separados:

- `id`: clave de navegación interna (`tab`), compatible con la aplicación actual.
- `label`: texto visible, traducible o renombrable sin cambiar permisos.
- `capacidadConsulta`: clave estable de capacidad de consulta, con el formato `ABC_PANTALLA_<IDENTIFICADOR>_CONSULTAR`.

El mapa `CAPACIDADES_CONSULTA_PANTALLA` es explícito y está congelado. No se genera a partir de la etiqueta visible y no depende de los nombres libres de cargos.

## Mapa estable

| Navegación (`id`) | Capacidad de consulta |
|---|---|
| `dashboard` | `ABC_PANTALLA_DASHBOARD_CONSULTAR` |
| `direccion` | `ABC_PANTALLA_DIRECCION_CONSULTAR` |
| `proveedores` | `ABC_PANTALLA_PROVEEDORES_CONSULTAR` |
| `resumen_almacen` | `ABC_PANTALLA_RESUMEN_ALMACEN_CONSULTAR` |
| `productos` | `ABC_PANTALLA_PRODUCTOS_CONSULTAR` |
| `buscar` | `ABC_PANTALLA_BUSCAR_CONSULTAR` |
| `historial_producto` | `ABC_PANTALLA_HISTORIAL_PRODUCTO_CONSULTAR` |
| `pedidos` | `ABC_PANTALLA_PEDIDOS_CONSULTAR` |
| `recepcion` | `ABC_PANTALLA_RECEPCION_CONSULTAR` |
| `albaranes` | `ABC_PANTALLA_ALBARANES_CONSULTAR` |
| `facturas` | `ABC_PANTALLA_FACTURAS_CONSULTAR` |
| `pagos` | `ABC_PANTALLA_PAGOS_CONSULTAR` |
| `conteo` | `ABC_PANTALLA_CONTEO_CONSULTAR` |
| `saldo` | `ABC_PANTALLA_SALDO_CONSULTAR` |
| `mapa` | `ABC_PANTALLA_MAPA_CONSULTAR` |
| `traspasos` | `ABC_PANTALLA_TRASPASOS_CONSULTAR` |
| `fichas` | `ABC_PANTALLA_FICHAS_CONSULTAR` |
| `produccion` | `ABC_PANTALLA_PRODUCCION_CONSULTAR` |
| `mermas` | `ABC_PANTALLA_MERMAS_CONSULTAR` |
| `etiquetas` | `ABC_PANTALLA_ETIQUETAS_CONSULTAR` |
| `reportes` | `ABC_PANTALLA_REPORTES_CONSULTAR` |
| `resultados` | `ABC_PANTALLA_RESULTADOS_CONSULTAR` |
| `personal` | `ABC_PANTALLA_PERSONAL_CONSULTAR` |
| `fichaje` | `ABC_PANTALLA_FICHAJE_CONSULTAR` |
| `nominas` | `ABC_PANTALLA_NOMINAS_CONSULTAR` |
| `turnos` | `ABC_PANTALLA_TURNOS_CONSULTAR` |
| `appcc` | `ABC_PANTALLA_APPCC_CONSULTAR` |
| `aceite` | `ABC_PANTALLA_ACEITE_CONSULTAR` |
| `venta` | `ABC_PANTALLA_VENTA_CONSULTAR` |
| `cocina` | `ABC_PANTALLA_COCINA_CONSULTAR` |
| `encargos` | `ABC_PANTALLA_ENCARGOS_CONSULTAR` |
| `clientes` | `ABC_PANTALLA_CLIENTES_CONSULTAR` |
| `libroiva` | `ABC_PANTALLA_LIBROIVA_CONSULTAR` |
| `caja` | `ABC_PANTALLA_CAJA_CONSULTAR` |
| `devoluciones` | `ABC_PANTALLA_DEVOLUCIONES_CONSULTAR` |
| `tesoreria` | `ABC_PANTALLA_TESORERIA_CONSULTAR` |
| `estacionalidad` | `ABC_PANTALLA_ESTACIONALIDAD_CONSULTAR` |
| `auditoria` | `ABC_PANTALLA_AUDITORIA_CONSULTAR` |
| `diagnostico` | `ABC_PANTALLA_DIAGNOSTICO_CONSULTAR` |
| `respaldos` | `ABC_PANTALLA_RESPALDOS_CONSULTAR` |
| `notificaciones` | `ABC_PANTALLA_NOTIFICACIONES_CONSULTAR` |
| `descuentos` | `ABC_PANTALLA_DESCUENTOS_CONSULTAR` |
| `locales` | `ABC_PANTALLA_LOCALES_CONSULTAR` |
| `configuracion` | `ABC_PANTALLA_CONFIGURACION_CONSULTAR` |
| `errores_sistema` | `ABC_PANTALLA_ERRORES_SISTEMA_CONSULTAR` |

## Alcance y límites

Este subpunto solo establece el catálogo de claves. Todavía no persiste selecciones, no decide qué cargo puede consultar una pantalla y no sustituye las comprobaciones de servidor. Esas decisiones pertenecen a los subpuntos siguientes y a los puntos 5 y 7.

