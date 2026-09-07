# PM10 · Punto 2 · Inventario de validaciones actuales

Fecha: 2026-09-05
Estado: **DIAGNÓSTICO CERRADO / SIN CORRECCIÓN FUNCIONAL**

Rama: `pm10-validaciones-altas-datos-legados`
HEAD diagnosticado: `4dbdba8808938072d22244fc22ca9b90395428ff`
Workflow diagnóstico: `33966966348` — **success**
Bundle inspeccionado: `fuente.js` — 5.260.374 bytes — sintaxis OK.

## 1. Conclusión transversal

Los cinco dominios de PM10 — Productos, Pedidos, Recepción, Personal y Encargos — conservan hoy una arquitectura mayoritariamente basada en estado de frontend + persistencia genérica mediante `saveKey()` / `window.storage.set()`. El guard de `window.storage` aplica permisos/rol/contexto, pero no valida invariantes de dominio del objeto antes de delegar en `setOriginal`.

En L&A Suite QA no se observaron tablas ni RPC públicas dedicadas a `productos`, `pedidos`, `recepciones`, `empleados/personal` o `encargos` que impongan estos invariantes. Las tablas/RPC de stock sí protegen el stock autoritativo, pero no sustituyen la validación de los datos de negocio de estos cinco dominios.

Por tanto, actualmente una validación presente solo en un formulario no constituye una garantía de autoridad para PM10.

## 2. Productos — LA-011

### Frontend / lógica actual

`crearLogicaProductos.addProducto(data)` construye:

`{ id: uid(), stock: Number(data.stock) || 0, ...data, localId: ... }`

El `...data` posterior puede volver a sobrescribir el `stock` normalizado. No hay en `addProducto` una validación común de coste, PVP, stock mínimo ni unidades por caja antes de `setProductos`.

`updateProducto(id,data)` valida contexto de local, pero `restoDatos` se fusiona directamente en el producto. El stock del formulario se convierte con `Number(...) || 0`; la capa no rechaza por sí misma valores de dominio imposibles de los demás campos.

El alta rápida de producto desde Pedidos (`guardarProductoNuevo`) valida únicamente que el nombre no esté vacío y convierte el coste con `Number(...) || 0`, por lo que un valor no numérico puede convertirse silenciosamente en cero.

### Autoridad

No existe una RPC/tabla dedicada de producto para coste/PVP/mínimo/udsCaja. El stock físico autoritativo sí se sincroniza desde `stock_estado`, pero los metadatos del producto continúan dependiendo del objeto persistido.

### Gap PM10

Falta contrato común y autoritativo para números finitos, coste/PVP/mínimo >= 0 y unidades por caja > 0. LA-011 permanece estructuralmente abierta al inicio de PM10.

## 3. Pedidos — LA-012

### Frontend actual

El formulario `Pedidos.submit()` sí exige proveedor y al menos una línea. Después transforma las líneas con `Number(cantidad)` y `Number(costoUnitario)`, pero no comprueba que esos resultados sean finitos, que la cantidad sea > 0 ni que el coste respete la regla que definamos.

### Lógica actual

`crearPedido()` acepta proveedor, fecha e `items` y los persiste directamente añadiendo `cantidadRecibida: 0`.

`actualizarPedido()` comprueba solo el contexto local y sustituye las líneas mediante `items.map(... cantidadRecibida: 0)`. Esto además puede borrar el acumulado recibido al editar un pedido parcialmente recibido.

### Autoridad

No se observó tabla/RPC dedicada de pedidos con constraints de línea.

### Gap PM10

Una línea con cantidad 0/negativa/NaN puede superar la frontera del formulario/lógica si llega por una ruta no protegida. También debe resolverse el reseteo de `cantidadRecibida` al editar. LA-012 permanece abierta.

## 4. Recepción / sobre-recepción — LA-013

### Lógica actual

`recibirPedido()` descarta líneas cuya cantidad no sea > 0 y valida que el producto pertenezca al local activo, pero **no compara la cantidad a recibir con la cantidad pendiente de la línea de pedido antes de llamar a `procesarRecepcion()`**.

Después de mutar stock, suma `unidadesEntradas` a `cantidadRecibida` y considera completa una línea cuando `recibida >= pedida`. Esto permite que una sobre-recepción termine marcada como `Recibido` sin impedir el exceso.

`procesarRecepcion()` calcula unidades, coste y ejecuta la entrada de stock, pero tampoco conoce/comprueba el saldo pendiente de la línea de pedido. Su responsabilidad actual es recepción/stock/coste, no el límite contractual del pedido.

### Autoridad

La entrada física de stock se apoya en el motor/ledger de stock, pero el límite **pedido vs ya recibido vs pendiente** no está protegido por una autoridad dedicada.

### Gap PM10

Falta bloquear una recepción que exceda el pendiente antes de cualquier mutación. Las recepciones parciales acumuladas necesitan semántica explícita. LA-013 permanece abierta.

## 5. Personal — LA-017

### Frontend actual

`Personal.submit()` valida nombre, formato del PIN y PIN duplicado. Para los datos laborales hace conversiones:

- `horasSemanales: Number(...) || 0`
- `pagas: Number(...) || 14`
- `salarioBrutoMensual: Number(...) || 0`
- `costeEmpresaMensual: "" o Number(...)`
- `diasVacacionesAnuales: Number(...) || 0`

No existen comprobaciones de no-negatividad/finitez en ese submit. Un negativo es truthy y pasa; `pagas=0` se transforma silenciosamente en 14; un valor no numérico de coste empresa puede producir `NaN`.

La lógica `addEmpleado/updateEmpleado` protege contexto, pero no añade validación numérica de dominio.

### Autoridad

No se observó tabla/RPC dedicada para la ficha laboral con constraints de estas magnitudes.

### Gap PM10

LA-017 permanece abierta: horas, salario, coste empresa, vacaciones y pagas deben tener reglas explícitas y no normalizar errores silenciosamente.

## 6. Encargos — LA-018

### Lógica actual

`addEncargo(data)` comprueba que las líneas no pertenezcan a otro local, deriva local y cobro de señal, y persiste el resto de `data` directamente. No exige en esta frontera cliente válido, fecha de entrega válida, líneas efectivas, cantidades/precios válidos ni coherencia entre señal y total.

`updateEncargo()` fusiona `data` sobre el encargo después de comprobar contexto local. `sincronizarCobroSeñal()` convierte una señal no numérica a 0 y elimina la señal si el importe resultante no es > 0.

La interfaz de lectura contiene fallback `Sin cliente`, evidencia de que la capa de presentación tolera encargos sin cliente resoluble en vez de impedir necesariamente su persistencia.

### Autoridad

No se observó tabla/RPC dedicada de encargos que imponga estos invariantes.

### Gap PM10

LA-018 permanece abierta. Debe validarse el encargo como unidad antes de persistir y evitar degradaciones silenciosas de cliente, fecha, cantidades, precios y anticipo.

## 7. Persistencia / autoridad actual

`loadKey()` usa `window.storage.get()` y `saveKey()` usa `window.storage.set(key, JSON.stringify(value), false)`.

El wrapper de `window.storage.set` aplica autorización por rol y claves controladas; si el rol puede escribir, delega en `setOriginal(key,value,shared)`. No inspecciona la estructura de Productos/Pedidos/Personal/Encargos ni aplica sus reglas económicas o numéricas.

En QA, la inspección de `information_schema` mostró que no existen tablas públicas dedicadas a esos cinco dominios; tampoco aparecieron funciones públicas específicas de alta/edición/validación de esos objetos. `almacen_kv` es genérico (`key`, `value jsonb`, contexto), por lo que su esquema no expresa las restricciones de negocio de PM10.

## 8. Resultado del inventario

| Dominio | Validación UI actual | Validación lógica | Autoridad específica | Estado al inicio PM10 |
|---|---|---|---|---|
| Productos | Parcial / heterogénea | Insuficiente | No para metadatos | LA-011 abierta |
| Pedidos | Proveedor + >=1 línea | Insuficiente; resetea recibidas al editar | No | LA-012 abierta |
| Recepción | Cantidad positiva en ruta | Sin límite contra pendiente | Stock sí; límite pedido no | LA-013 abierta |
| Personal | Nombre/PIN | Sin reglas numéricas laborales | No | LA-017 abierta |
| Encargos | No garantiza contrato completo | Contexto, pero no dominio completo | No | LA-018 abierta |

## 9. Decisión para el punto 3

El punto 3 debe fijar un contrato común antes de corregir módulos: parseo explícito, `Number.isFinite`, cero/negativos según dominio, campos obligatorios, validación antes de mutar, errores no convertidos silenciosamente a 0/default, y una segunda barrera en la autoridad de datos cuando el dominio se sincroniza.

No se ha modificado lógica funcional en este punto 2. Solo se añadieron herramientas/evidencia de diagnóstico en la rama PM10.
