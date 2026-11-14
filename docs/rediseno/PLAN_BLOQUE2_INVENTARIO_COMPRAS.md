# Bloque 2 · Inventario y Compras · preparación sin sesión

14 de noviembre de 2026. 49 vistas pendientes: **26 de Inventario** y **23 de
Compras**. Esto es el trabajo previo, hecho sin gastar ventana de sesión, para
que cuando haya sesión se mida en vez de buscar.

Es la lección del bloque 1: allí perdí la primera tanda buscando disparadores a
ciegas y encontrando «no existe» en falso, porque la mitad de las vistas son
**secciones** de una pestaña y no modales. Aquí el mapa va antes.

## Lo que ya se sabe sin abrir el navegador

### Los 18 componentes de la matriz existen, todos

`Proveedores`, `Pedidos`, `Recepcion`, `Albaranes`, `Facturas`,
`FacturasLegacy`, `Devoluciones`, `CuentasPorPagar`, `Productos`,
`EscanerCodigoBarras`, `InventarioCiego`, `BloqueAplicarAjustes`,
`SaldoAlmacen`, `Traspasos`, `DiagnosticoStock`, `EtiquetasCatalogo`,
`FichasCosto`, `Mermas`: cada uno definido una vez en la fuente. Ninguna
sorpresa por ese lado.

### Dos vistas no están construidas

| | |
|---|---|
| `inv-35` Biblioteca de opciones | sin rastro |
| `inv-36` Editor de opciones reutilizables | sin rastro |

Y el matiz importa, porque es el mismo patrón que «unir mesas» en el bloque 1:
**el servidor sí sabe de variantes y modificadores**. El cliente solo los lee
—«El TPV necesita conexión con el servidor para comprobar variantes y
modificadores»— y traduce sus errores: `grupo_min_selecciones_incumplido`,
`grupo_max_selecciones_excedido`, `opcion_max_cantidad_excedida`,
`seleccion_duplicada`. Las opciones de producto funcionan en el TPV, medidas en
el bloque 1. Lo que no existe es **la pantalla para administrar la biblioteca**.

El servidor va por delante de la interfaz, otra vez.

### Las pestañas reales, sacadas del enrutador

No de adivinar nombres —que es como me equivoqué en el bloque 1— sino leyendo
las ramas `tab === "…"` que montan cada componente:

| Componente | Pestaña |
|---|---|
| `Productos` | `productos` |
| `Proveedores` | `proveedores` |
| `Pedidos` | `pedidos` |
| `Recepcion` | `recepcion` |
| `Albaranes` | `albaranes` |
| `Facturas` | `facturas` |
| `Devoluciones` | `devoluciones` |
| `Traspasos` | `traspasos` |
| `Mermas` | `mermas` |
| `FichasCosto` | `fichas` |
| `CuentasPorPagar` | **`pagos`** |
| `InventarioCiego` | **`conteo`** |
| `SaldoAlmacen` | **`saldo`** |
| `DiagnosticoStock` | **`diagnostico`** |
| `EtiquetasCatalogo` | **`etiquetas`** |

Las cinco en negrita son ids que **no había probado nunca**: en el bloque 1
tanteé una lista inventada donde puse `inventario`, `kardex`, `tickets` y
`ventas`, que no existen, y me faltaron estas cinco que sí. Conviene no repetirlo.

Tres componentes no salen del enrutador y se dibujan dentro de otros, así que su
vista se alcanza desde dentro: `FacturasLegacy`, `EscanerCodigoBarras` y
`BloqueAplicarAjustes`.

## Cómo medir, y en qué orden

1. **Primero las pestañas enteras**, una medición por pestaña, que es donde
   viven las vistas de tipo lista y detalle. Quince pestañas.
2. **Después los disparadores** de las de tipo `form`, `confirmar` y
   `asistente`, que sí abren superficie propia.
3. Y lo que necesite **dato previo** se agrupa aparte, para crearlo una vez y
   deshacerlo al final, como se hizo con la receta y el cierre de caja.

### Lo que va a necesitar dato de ensayo, previsto

- Un **pedido a proveedor** abre `com-06` a `com-11`, y recibido abre `com-13` a
  `com-15`.
- Un **albarán** abre `com-17` a `com-20`.
- Una **factura** abre `com-22` a `com-24`, y una directa `com-28` a `com-30`.
- Un **conteo** abre `inv-11` a `inv-18`, que son ocho vistas de una sola vez:
  es el grupo con mejor relación entre un dato y las vistas que desbloquea.
- `inv-06`, el cambio de envase, ya se sabe exactamente qué pide: contenido
  positivo antes y después y distinto, **y** una ficha de costo que use el
  producto. Está medido en el bloque 2 de salvedades.

### Lo que probablemente dependa de permiso o integración

`com-14` y `com-22` leen albarán o factura con IA. Cuidado: las funciones de
borde están **codificadas a producción** en la fuente —`importar-albaran`,
`importar-nomina`, `prefiltro-candidato`, `entrevista-personal`,
`enviar-notificacion`— y la CSP de QA solo permite el proyecto de QA en
`connect-src`. Así que en el preview esas llamadas **no salen del navegador**:
la vista se abrirá, pero la lectura con IA no se puede ejercitar aquí. Es
aislamiento funcionando, no un fallo, pero conviene anotarlo antes de medir y no
confundirlo con un defecto.

No lo he comprobado lanzando una petición a producción, y no voy a hacerlo: la
evidencia es la CSP generada por `netlify-csp.mjs`, que para cualquier contexto
distinto de `production` pone solo el host de QA.

## Lo que falta para empezar

Sesión de propietario. El Cajero/a con el que terminé el punto anterior tiene
denegadas justo las pestañas de este bloque: productos, proveedores, pedidos y
traspasos.
