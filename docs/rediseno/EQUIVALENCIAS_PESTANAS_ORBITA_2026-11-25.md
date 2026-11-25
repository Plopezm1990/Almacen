# Equivalencias de pestañas por área — Órbita (propuesta 7)

Fecha: 25/11/2026 · Estado: **propuesta, pendiente de aprobación**. No se ha
cambiado código.

## Para qué sirve

La maqueta de Órbita usa navegación en dos niveles:

- **Lateral:** solo las 10 áreas (Inicio, Servicio, Caja y fiscalidad,
  Compras, Inventario, Equipo, Calidad, Informes, Organización, Sistema).
- **Pestañas sobre el contenido:** las pantallas del área activa
  (`moduleTabs()` en `LA-Suite-rediseno/dist/suite.js`).

Para replicarlo sin cambiar ninguna función hay que saber, área por área, a
qué pantalla real del programa corresponde cada pestaña de la maqueta.

## De dónde salen los datos (comprobado, no supuesto)

- **Maqueta:** `LA.menu` en `LA-Suite-rediseno/dist/data.js` (lista de
  pestañas de cada área) y el campo `entry` de cada pantalla en
  `dist/inventory.js`, que dice qué destino del programa representa.
- **Programa:** `gruposBase` e `itemsMeta` en `fuente.js` (≈ línea 107316),
  más la agrupación de Órbita en `agruparNavegacionRediseno()`
  (≈ línea 117640). Los permisos por rol los aplica `pick()`. Las pestañas
  usarían ese mismo filtro, así que nadie verá una pestaña que hoy no pueda
  abrir.

## Leyenda

| Marca | Significado |
|---|---|
| ✅ | Pantalla real del programa. La pestaña abre ese mismo destino (mismo id, misma función de navegación). |
| ⇄ | Pantalla real que la maqueta coloca en **otra área**. Solo cambia dónde aparece; el destino es el mismo. |
| ↪ | En el programa **no es una pantalla aparte**: es una parte interna de otra pantalla. Propuesta: no crear pestaña. |
| ➕ | Existe en el programa y la maqueta no la muestra. Se conserva: nunca se esconde una función. |

La columna «Nombre en la pestaña» usa el texto de la maqueta. El nombre
interno del programa (`itemsMeta`) **no se cambia**: el rótulo nuevo se
aplica solo en la fila de pestañas de Órbita, para no afectar a los demás
diseños ni a sus contratos.

---

## 1. Inicio — al pulsar el área: Panel general

| Nombre en la pestaña | Programa (id) | Marca | Nota |
|---|---|---|---|
| Panel general | `dashboard` | ✅ | En la maqueta, Panel general **no** lleva fila de pestañas (`moduleTabs` excluye `ini-01`). Se respeta. |
| Inicio del empleado | `dashboard` en modo empleado | ↪ | Es un modo, no una pantalla. Su contenido (fichaje) está en Registro horario. |
| Panel de dirección | `direccion` | ✅ | |
| Búsqueda global | `buscar` | ✅ | |

## 2. Servicio — al pulsar el área: Punto de venta

| Nombre en la pestaña | Programa (id) | Marca | Nota |
|---|---|---|---|
| Punto de venta | `venta` | ✅ | Hoy se llama «TPV». |
| Sala y mesas | dentro de `venta` | ↪ | Vista interna del TPV. |
| Recuperar cuenta y tickets aparcados | dentro de `venta` | ↪ | Vista interna del TPV. |
| Cocina y comandas | `cocina` | ✅ | Hoy se llama «Cocina». |
| Encargos | `encargos` | ✅ | |
| Clientes | `clientes` | ✅ | |
| *(sale del área)* Devoluciones | `devoluciones` | ⇄ | Pasa a Caja y fiscalidad, como en la maqueta. |
| *(sale del área)* Descuentos y cortesías | `descuentos` | ⇄ | Pasa a Organización, como en la maqueta. |

## 3. Caja y fiscalidad — al pulsar el área: Arqueo de caja

| Nombre en la pestaña | Programa (id) | Marca | Nota |
|---|---|---|---|
| Arqueo de caja | `caja` | ✅ | |
| Entradas y salidas de efectivo | dentro de `caja` | ↪ | Bloque interno del arqueo. |
| Historial de arqueos | dentro de `caja` | ↪ | Bloque interno del arqueo. |
| Devoluciones de clientes | `devoluciones` | ⇄ | Viene de Servicio. |
| Reembolsos económicos | dentro de `devoluciones` | ↪ | |
| Libro de IVA | `libroiva` | ✅ | |
| Documentos fiscales de venta | dentro de TPV/Caja | ↪ | Es el justificante de una venta, no una pantalla. |
| *(sale del área)* Cuentas por pagar | `pagos` | ⇄ | Pasa a Compras, como en la maqueta. |
| *(sale del área)* Tesorería | `tesoreria` | ⇄ | Pasa a Informes, como en la maqueta. |

## 4. Compras — al pulsar el área: Pedidos a proveedor

| Nombre en la pestaña | Programa (id) | Marca | Nota |
|---|---|---|---|
| Proveedores | `proveedores` | ✅ | |
| Pedidos a proveedor | `pedidos` | ✅ | Hoy se llama «Pedidos». **Es el destino del área en la maqueta; hoy el lateral abre Proveedores.** |
| Recepción de mercancía | `recepcion` | ✅ | Hoy se llama «Recepción». |
| Albaranes | `albaranes` | ✅ | |
| Facturas de compra | `facturas` | ✅ | Hoy se llama «Facturas». |
| Devoluciones a proveedor | `devoluciones`, mediante `irADevolucionProveedor()` | ✅ | El programa ya tiene esta forma de entrar. Solo aparece cuando hoy aparece el atajo (`mostrarEnlaceDevolucionProveedor`). |
| Cuentas por pagar | `pagos` | ⇄ | Viene de Caja y fiscalidad. |

## 5. Inventario — al pulsar el área: Resumen de almacén

| Nombre en la pestaña | Programa (id) | Marca | Nota |
|---|---|---|---|
| Resumen de almacén | `resumen_almacen` | ✅ | |
| Productos | `productos` | ✅ | |
| Historial de producto | `historial_producto` | ✅ | |
| Inventario ciego | `conteo` | ✅ | |
| Saldo de almacén | `saldo` | ✅ | |
| Mapa de almacén | `mapa` | ✅ | |
| Traspasos de stock | `traspasos` | ✅ | Hoy se llama «Traspasos». |
| Reconciliación de stock | `diagnostico` | ✅ | |
| Etiquetas de producto | `etiquetas` | ✅ | Hoy se llama «Etiquetas y catálogo». |
| Fichas de coste y recetas | `fichas` | ✅ | Hoy se llama «Fichas de costo». |
| Producción | `produccion` | ➕ | No está en la maqueta. Se mantiene después de Fichas. |
| Mermas | `mermas` | ✅ | |

Son 12 pestañas: en ordenador la fila tendrá que poder desplazarse en
horizontal (la maqueta usa `overflow-x` en `.module-nav`).

## 6. Equipo — al pulsar el área: Personal

| Nombre en la pestaña | Programa (id) | Marca | Nota |
|---|---|---|---|
| Personal | `personal` | ✅ | |
| Registro horario | `fichaje` | ✅ | |
| Fichar entrada o salida | dentro de `fichaje` | ↪ | |
| Cuadrante de turnos | `turnos` | ✅ | |
| Coste de personal | `nominas` | ✅ | |
| Selección de personal | dentro de `personal` | ↪ | |

## 7. Calidad — al pulsar el área: Control sanitario APPCC

| Nombre en la pestaña | Programa (id) | Marca | Nota |
|---|---|---|---|
| Control sanitario APPCC | `appcc` | ✅ | Hoy se llama «Control sanitario». |
| Freidoras y aceite | `aceite` | ✅ | Hoy se llama «Aceite de freidoras». |

## 8. Informes — al pulsar el área: Resultados por periodo

| Nombre en la pestaña | Programa (id) | Marca | Nota |
|---|---|---|---|
| Resultados por periodo | `resultados` | ✅ | Hoy se llama «Resultados». |
| Reportes y rotación | `reportes` | ✅ | |
| Tesorería | `tesoreria` | ⇄ | Viene de Caja y fiscalidad. |
| Estacionalidad | `estacionalidad` | ✅ | |

## 9. Organización — al pulsar el área: Configuración del local

| Nombre en la pestaña | Programa (id) | Marca | Nota |
|---|---|---|---|
| Configuración del local | `configuracion` | ✅ | **Es el destino del área en la maqueta; hoy el lateral abre Locales.** |
| Apariencia de la empresa | — | ↪ | En la maqueta es una personalización local; en el programa no es un destino del menú. |
| Locales de la empresa | `locales` | ✅ | Hoy se llama «Locales». |
| Empresas desde la aplicación | dentro de `locales` | ↪ | |
| Cargos, Equipos e impresoras, Terminales y cajas, Fiscalidad y AEAT | dentro de `configuracion` | ↪ | La pantalla Configuración ya tiene sus propias secciones internas con estos nombres. Se ven al entrar. |
| Descuentos y cortesías | `descuentos` | ⇄ | Viene de Servicio. |
| Panel de Plataforma | `plataforma-panel.js` | ↪ | Solo para el rol Plataforma, fuera de esta navegación. |

## 10. Sistema — al pulsar el área: Auditoría

| Nombre en la pestaña | Programa (id) | Marca | Nota |
|---|---|---|---|
| Auditoría | `auditoria` | ✅ | |
| Respaldos y puntos guardados | `respaldos` | ✅ | Hoy se llama «Respaldos». |
| Notificaciones | `notificaciones` | ✅ | |
| Errores del sistema | `errores_sistema` | ✅ | |

---

## Recuento

- La maqueta tiene **61 pestañas** en total.
  - **45** corresponden a una pantalla real del programa (✅ y ⇄).
  - **16** son partes internas de otras pantallas (↪). Propuesta: no
    crearlas como pestañas en esta fase.
- El programa tiene **45 destinos** en su menú (`itemsMeta`). **Los 45
  quedan como pestaña**: ninguno se pierde ni se esconde. La fila tendría
  **46 pestañas** en total: Devoluciones aparece dos veces (clientes en
  Caja, proveedor en Compras) y Producción (➕) se añade aunque la maqueta
  no la tenga.
- **4 pantallas cambian de área** (⇄): Cuentas por pagar → Compras,
  Tesorería → Informes, Devoluciones → Caja y fiscalidad, Descuentos →
  Organización.

## Móvil (corrección a lo dicho en el chat)

En la maqueta móvil **no hay fila de pestañas**. Las pantallas del área se
abren desde el botón **«Más»** de la barra inferior, en una sección
«En Servicio» (o el área que toque), seguida de «Módulos» y «Herramientas»
(`openPhoneMenu()` en `dist/movil.js`). El móvil se haría así, con la misma
lista de esta tabla.

## Decisiones que necesito

1. **Partes internas (↪):** no son pestañas en esta fase (recomendado).
   La alternativa obliga a cambiar cómo abre cada pantalla, que ya es tocar
   funcionalidad.
2. **Los 4 cambios de área (⇄):** hacerlos como en la maqueta
   (recomendado).
3. **Producción:** mantenerla en Inventario (recomendado).
4. **Destino al pulsar cada área:** el de la maqueta. Cambian Compras
   (abre Pedidos a proveedor) y Organización (abre Configuración del
   local). Si el rol no tiene permiso para esa pantalla, se abre la primera
   que sí pueda ver, igual que en la maqueta.
5. **Devoluciones** aparece en dos áreas (clientes en Caja, proveedor en
   Compras). El área marcada sería Caja, salvo que se haya entrado por
   «Devoluciones a proveedor».
