# PM13 · Punto 4.1 — Inventario de pantallas

Fecha: 2026-10-17  
Rama: `codex/fix-product-bootstrap-context-20261015`  
Alcance: inventario de lectura del panel privado y de sus entradas especiales.

## Fuente y modelo de navegación

- El catálogo visible se define en `fuente.js`, en `itemsMeta`, y contiene **45 pantallas privadas**.
- Cada pantalla se renderiza desde `GestionAlmacen` mediante el estado `tab`; la clave de `tab` es el identificador técnico actualmente usado por la aplicación.
- `GRUPOS` define la agrupación del menú de escritorio y `TAB_PRIORITIES_MOVIL` define las pestañas prioritarias del móvil.
- Los enlaces internos cambian `tab` mediante `setTab`/`cambiarTabPM15`; no existe una ruta URL privada independiente por pantalla.
- La única ruta hash interpretada al arrancar fuera del panel es `#/prefiltro/<token>`, que carga `PrefiltroPublico`. Cualquier otro hash no selecciona una pantalla privada.
- `restablecer-contrasena.html` es una página estática separada de recuperación de acceso, no una pantalla del panel.

## Pantallas privadas inventariadas

| Grupo | Identificador técnico (`tab`) | Etiqueta visible |
|---|---|---|
| Inicio | `dashboard` | Panel general |
| Inicio | `direccion` | Panel de dirección |
| Inicio | `buscar` | Buscar |
| Compras | `proveedores` | Proveedores |
| Compras | `pedidos` | Pedidos |
| Compras | `recepcion` | Recepción |
| Compras | `albaranes` | Albaranes |
| Compras | `facturas` | Facturas |
| Almacén | `resumen_almacen` | Resumen de almacén |
| Almacén | `productos` | Productos |
| Almacén | `historial_producto` | Historial de producto |
| Almacén | `conteo` | Inventario ciego |
| Almacén | `saldo` | Saldo de almacén |
| Almacén | `mapa` | Mapa de almacén |
| Almacén | `traspasos` | Traspasos |
| Almacén | `diagnostico` | Reconciliación de stock |
| Almacén | `etiquetas` | Etiquetas y catálogo |
| Ventas | `venta` | TPV |
| Ventas | `cocina` | Cocina A10 |
| Ventas | `encargos` | Encargos |
| Ventas | `clientes` | Clientes |
| Ventas | `devoluciones` | Devoluciones |
| Ventas | `descuentos` | Descuentos y cortesías |
| Costes y producción | `fichas` | Fichas de costo |
| Costes y producción | `produccion` | Producción |
| Costes y producción | `mermas` | Mermas |
| Finanzas y análisis | `pagos` | Cuentas por pagar |
| Finanzas y análisis | `resultados` | Resultados |
| Finanzas y análisis | `reportes` | Reportes y rotación |
| Finanzas y análisis | `libroiva` | Libro de IVA |
| Finanzas y análisis | `caja` | Arqueo de caja |
| Finanzas y análisis | `tesoreria` | Tesorería |
| Finanzas y análisis | `estacionalidad` | Estacionalidad |
| Personal | `personal` | Personal |
| Personal | `fichaje` | Registro horario |
| Personal | `turnos` | Cuadrante de turnos |
| Personal | `nominas` | Coste de personal |
| Calidad | `appcc` | Control sanitario |
| Calidad | `aceite` | Aceite de freidoras |
| Sistema | `auditoria` | Auditoría |
| Sistema | `respaldos` | Respaldos |
| Sistema | `notificaciones` | Notificaciones |
| Sistema | `locales` | Locales |
| Sistema | `configuracion` | Configuración |
| Sistema | `errores_sistema` | Errores del sistema |

## Entradas no incluidas como pantallas privadas

- **Inicio de sesión**: fase `login` de `AppConSesion`.
- **Trabajo local sin nube**: alternativa de la misma pantalla de acceso; no es una pantalla de negocio.
- **Prefiltro público**: `#/prefiltro/<token>` → `PrefiltroPublico`; debe permanecer fuera del panel privado.
- **Restablecimiento de contraseña**: `restablecer-contrasena.html` y su script asociado.

## Hallazgos y límites del inventario

1. Las 45 claves son el catálogo real que se puede abrir desde el panel; no se ha inferido ningún módulo a partir de nombres externos.
2. El menú móvil muestra solo prioridades por rol, mientras que el menú completo se filtra con `itemsPermitidosEmpleado` en modo empleado.
3. Ese filtrado de interfaz no constituye autorización de servidor. La comprobación de RPC, RLS y entrada directa queda para los puntos 4.4–4.8 y 7.
4. No existe todavía un catálogo de capacidades de consulta separado de las claves de presentación; definirlo es el subpunto 4.2.

