# N-01 — Producto con modificadores obligatorios no deja cobrar

Fecha de revalidación: 2026-11-10  
Producción: `flqercbgpgmmfaakrwkc` («L&A Suite»)  
QA: `qjqorixtkilwsndqayyx` («L&A Suite QA»)  
Rama de auditoría: `codex/fase3-a03-a04`

## Pregunta y criterio

El hallazgo original decía que «Café solo» con «Pequeño» seleccionado se detenía en el cliente con «La configuración de variantes o modificadores no es válida» antes de hacer una petición. El criterio para cerrarlo es demostrar la causa, comprobar si el catálogo de QA representa un caso válido y verificar que el cliente desplegado acepta los identificadores de catálogo que realmente usa la base.

No se inició un cobro, no se guardó un pedido, no se creó una cuenta y no se emitió ningún documento fiscal durante esta revalidación.

## Catálogo medido en QA y producción

Las consultas fueron de solo lectura sobre las tablas `catalogo_tpv_productos`, `catalogo_tpv_producto_grupos`, `catalogo_tpv_grupos_opciones` y `catalogo_tpv_opciones`.

| Medición | QA | Producción |
|---|---:|---:|
| Productos activos | 42 | 1 |
| Productos activos con grupo enlazado | 14 distintos | 0 |
| Filas activas de opciones | 26 | 0 |
| Opciones activas cuyo UUID no cumple RFC-4122 estricto | 16 | 0 |
| Opciones activas con formato textual UUID `8-4-4-4-12` | 26 | 0 |

En QA, `QA-CAT-A1-CAFE-SOLO` («Café solo (QA)») tiene dos grupos activos:

- `QA Tamaño`, tipo `VARIANTE`, `min_selecciones = 1`, `max_selecciones = 1`.
- `QA Extras de bebida`, tipo `MODIFICADOR`, `min_selecciones = 0`, `max_selecciones = 2`.

La opción «Pequeño» tiene un identificador con forma textual UUID, pero no satisface los bits RFC-4122 estrictos. La misma situación aparece en varias opciones de la fixture QA; no es una fila aislada creada durante esta auditoría.

Producción no contiene «Café solo», ni grupos activos enlazados a productos, ni opciones activas. El único producto activo observado es `CROIS. CURVO GOURMET 100 46 UD`, sin configuración de variantes. Por tanto, con los datos desplegados el 2026-11-10 no existe un producto equivalente en producción sobre el que se pueda afirmar impacto operativo.

Estas cifras y relaciones son **medidas sobre datos reales desplegados**. No se modificó ninguna fila.

## Causa raíz del fallo histórico

La versión que originó el fallo reutilizaba el validador RFC-4122 estricto (`uuidPersistidoA02`) para los identificadores externos del catálogo. Los UUID de la fixture QA se generan con una forma hexadecimal `8-4-4-4-12`, pero algunos no tienen los bits de versión/variante que exige RFC-4122. La selección de «Pequeño» podía rechazarse en el cliente antes de llamar a `abc_agregar_linea_pedido_configurada`.

La corrección separa ambas responsabilidades:

```js
function uuidPersistidoA02(valor) {
  return typeof valor === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(valor);
}

function uuidTextoCatalogoA02(valor) {
  return typeof valor === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(valor);
}
```

`normalizarConfiguracionLineaA04` usa `uuidTextoCatalogoA02` para `grupo_id` y `opcion_id`, mientras conserva `uuidPersistidoA02` para los identificadores operativos persistidos de cuenta y pedido. Así no se relaja la validación de UUID de identidad/cuenta por corregir la representación del catálogo.

La corrección está en `origin/release` (`01613624 fix(ventas): validar catalogo y mostrar errores de guardado`) y el bloque desplegado contiene la misma separación. La rama de auditoría también contiene la validación relajada en el `fuente.js` que se revisó.

## Código servido actualmente

El HTML de QA y producción carga el mismo `fuente.js` con la versión pública `pm10-venta-rapida-produccion-20261029`. En ambos bundles se midió la presencia de:

- `uuidTextoCatalogoA02`.
- uso de `uuidTextoCatalogoA02(grupoId)` y `uuidTextoCatalogoA02(opcionId)` al normalizar la configuración A04.
- el mensaje de error para configuraciones realmente inválidas.

La comprobación es **observada en el artefacto público** y **probada por código** en la definición desplegada. No se infiere el estado actual solo desde la fuente local.

## Reproducción y corrección de la evidencia

La interrupción UI descrita originalmente se clasifica como **observada históricamente**, no como una reproducción actual: la pestaña QA que se estaba usando para otras pruebas quedó sin sesión al terminar la prueba aislada de A-05 y no se reintrodujeron credenciales. No se va a pedir ni a copiar una contraseña en el chat.

La combinación de evidencia actual sí permite localizar la causa y comprobar la corrección de forma independiente:

1. La base QA contiene el caso obligatorio real y los IDs que disparaban el falso rechazo.
2. La definición desplegada actual ya no aplica el validador RFC estricto a esos IDs de catálogo.
3. La misma corrección existe en `origin/release` y en producción, según el bundle público medido.
4. No se produjo ninguna petición de cobro ni mutación fiscal en esta investigación.

No se presenta esta evidencia como una prueba E2E actual de «Café solo → Pequeño → cobrar». Esa prueba requeriría volver a iniciar sesión en QA y recorrer la UI con una cuenta autorizada; además, el criterio de N-01 no autoriza convertirla en un cobro fiscal real.

## Estado

N-01 queda **cerrado como falso rechazo de UUID de catálogo ya corregido**, con causa demostrada, corrección presente en `origin/release` y artefactos públicos de QA/producción, y sin evidencia de que producción tenga actualmente un producto configurado afectado.

Límite que permanece: no se certifica un recorrido E2E actual de cobro en QA porque no se volvió a iniciar sesión tras la prueba de A-05. El cierre se apoya en la comparación del catálogo desplegado, la definición de código servida y la corrección ya incorporada al tronco `release`; no en una operación fiscal.

No se crearon datos sintéticos nuevos. No se escribieron las bases de QA ni producción.
