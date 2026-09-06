# PM10 · Punto 3 · Contrato común de validación

Fecha: 2026-09-05
Estado: **CONTRATO CONGELADO / SIN CORRECCIÓN FUNCIONAL**

Rama: `pm10-validaciones-altas-datos-legados`
Base verificada antes de este punto: `91ce03f847683c9a640c76eb59e6a67ea568fb95`

Este documento fija el contrato que deberán respetar las correcciones de PM10 para Productos, Pedidos, Recepción, Personal y Encargos. No modifica todavía la lógica funcional de esos módulos.

---

## 1. Regla general de autoridad

Una validación presente solo en la pantalla no es suficiente.

Para PM10 una operación se considera protegida únicamente si, antes de mutar datos:

1. la interfaz puede prevenir errores de usuario;
2. la lógica de dominio vuelve a validar el payload completo;
3. ninguna mutación se ejecuta si el payload falla;
4. la persistencia no puede convertir silenciosamente un dato inválido en otro aparentemente válido;
5. cuando exista autoridad sincronizada/backend para ese dominio, la misma invariante deberá existir también allí.

El orden obligatorio es: **parsear → validar → resolver contexto/referencias → mutar → persistir**.

Nunca se validará después de haber alterado parcialmente stock, pedidos, empleados, encargos u otro estado relacionado.

---

## 2. Contrato numérico común

Queda prohibido usar `Number(valor) || 0`, `Number(valor) || 14` o cualquier patrón equivalente como mecanismo de validación de entrada de negocio.

### 2.1 Valor obligatorio

Un número obligatorio es válido solo si:

- el valor no es `null`, `undefined` ni cadena vacía tras `trim`;
- al convertirlo de forma explícita, `Number.isFinite(numero) === true`;
- satisface el rango propio del campo.

`NaN`, `Infinity`, `-Infinity`, cadenas no numéricas y valores vacíos deben producir error explícito, no cero ni un valor por defecto.

### 2.2 Valor opcional

Un campo numérico opcional puede permanecer vacío y conservarse como vacío/nulo según el modelo. Si contiene un valor, ese valor debe ser finito y cumplir su rango.

Vacío no equivale automáticamente a cero.

### 2.3 Cero y negativos

El cero solo se acepta cuando la semántica concreta lo permite. Los negativos se rechazan salvo que el dominio defina expresamente una magnitud con signo, cosa que no aplica a las altas/ediciones cubiertas por LA-011, LA-012, LA-013, LA-017 y LA-018.

---

## 3. Contrato de texto, identificadores y fechas

### 3.1 Texto obligatorio

Debe aplicarse `trim`. Una cadena vacía después de recortar espacios se considera ausente.

### 3.2 Identificadores

Un `productoId`, `proveedorId`, `clienteId`, `empleadoId`, `localId` u otra referencia de dominio requerida debe:

- existir;
- pertenecer al contexto autorizado;
- respetar la regla empresa/local ya congelada en PM anteriores;
- no resolverse mediante un fallback visual tipo `Sin cliente` cuando el dato es obligatorio para guardar.

### 3.3 Fechas

Las fechas obligatorias deben:

- estar presentes;
- representar una fecha real válida;
- conservar formato de calendario consistente con el modelo usado por la aplicación (`YYYY-MM-DD` cuando corresponda);
- cumplir las relaciones temporales propias del dominio cuando se definan abajo.

No se debe sustituir una fecha inválida por `todayISO()` sin informar del error.

---

## 4. Atomicidad y efecto cero ante error

Toda operación cubierta por PM10 debe validar el objeto completo antes de la primera mutación.

Si una sola línea o campo invalida el conjunto:

- no se cambia estado frontend;
- no se cambia stock;
- no se añade movimiento;
- no se cambia cantidad recibida;
- no se crea/modifica empleado;
- no se crea/modifica encargo;
- no se escribe un valor degradado en almacenamiento;
- se devuelve un error determinista.

Para operaciones multilínea se adopta regla **todo o nada** en la validación previa. No se permite aceptar las líneas válidas y descartar silenciosamente las inválidas.

---

## 5. Contrato de errores

Las nuevas barreras de validación deberán poder devolver, como mínimo, una respuesta equivalente a:

`{ ok: false, codigo, campo, error }`

No es obligatorio cambiar toda la aplicación a esta forma de una vez, pero la lógica nueva de PM10 debe distinguir:

- campo obligatorio ausente;
- número no finito;
- valor fuera de rango;
- referencia inexistente;
- referencia de otro local/empresa;
- conflicto con estado previo;
- exceso sobre cantidad pendiente.

La interfaz podrá traducir estos códigos a mensajes legibles, pero no deberá depender de analizar texto libre para saber qué falló.

---

# CONTRATOS POR DOMINIO

## 6. Productos — contrato para LA-011

### 6.1 Alta/edición

Antes de `addProducto` o de aplicar cambios de `updateProducto`:

- `nombre`: obligatorio y no vacío;
- `costo`: finito y `>= 0`;
- `precioVenta`: si existe/aplica, finito y `>= 0`;
- `stockMinimo`: finito y `>= 0`;
- `udsPorCaja`: si existe/aplica, finito y `> 0`;
- `ivaCompra` e `ivaVenta`: si se editan, finitos y entre `0` y `100`;
- `stock` inicial, cuando la ruta de alta lo admita: finito y `>= 0`.

El stock no se considerará un metadato libre: una vez creado el producto, los cambios de stock deberán continuar pasando por el motor/ledger de stock ya definido en PM07, no por una simple sobrescritura del objeto.

### 6.2 Alta rápida desde Pedidos

La creación rápida de producto debe usar exactamente las mismas reglas numéricas que el alta normal. Un coste no numérico no puede convertirse en `0` silenciosamente.

---

## 7. Pedidos — contrato para LA-012

### 7.1 Alta

Para crear un pedido:

- `proveedorId`: obligatorio y resoluble en contexto autorizado;
- al menos una línea válida;
- cada línea debe tener `productoId` válido del local correspondiente;
- `cantidad`: finita y `> 0`;
- `costoUnitario`: finito y `>= 0`;
- `fechaEsperada`: si se informa, debe ser una fecha válida.

### 7.2 Edición

Editar un pedido no puede borrar el histórico de recepción.

Reglas congeladas:

- una línea existente conserva su `cantidadRecibida`;
- una línea nueva empieza en `cantidadRecibida = 0`;
- no se puede reducir `cantidad` por debajo de `cantidadRecibida`;
- no se puede eliminar una línea que ya tenga `cantidadRecibida > 0` mediante una edición ordinaria;
- ningún payload de edición puede escribir manualmente un `cantidadRecibida` menor que el ya acumulado.

La edición debe validar primero todas las líneas y solo después sustituir el pedido.

---

## 8. Recepción — contrato para LA-013

La recepción debe proteger el saldo pendiente antes de llamar a cualquier rutina que cambie stock.

Para cada línea:

`pendiente = cantidadPedida - cantidadRecibidaAcumulada`

Reglas:

- cantidad a recibir: finita y `> 0`;
- `pendiente` nunca puede ser negativo;
- cantidad a recibir `<= pendiente`;
- una recepción parcial es válida;
- varias recepciones parciales pueden acumularse mientras el total no supere lo pedido;
- una sobre-recepción se rechaza completa antes de `procesarRecepcion()`;
- si una línea del lote excede el pendiente, no se muta ninguna línea del lote;
- después de éxito, `cantidadRecibida` aumenta exactamente por la cantidad realmente aceptada.

No se aceptará el criterio actual de “si recibida >= pedida, marcar Recibido” como sustituto del bloqueo previo del exceso.

---

## 9. Personal — contrato para LA-017

Se conservan las reglas actuales de nombre y PIN y se añaden reglas laborales explícitas.

Antes de alta/edición:

- `nombre`: obligatorio;
- `horasSemanales`: finitas y `>= 0`;
- `salarioBrutoMensual`: finito y `>= 0`;
- `costeEmpresaMensual`: vacío permitido; si tiene valor, finito y `>= 0`;
- `diasVacacionesAnuales`: finito y `>= 0`;
- `pagas`: número entero y `> 0`;
- PIN, si se informa: mantiene formato de 4 a 6 dígitos y unicidad ya existente.

Reglas de no degradación:

- `pagas = 0` debe fallar; no convertirse en `14`;
- texto no numérico en salario/horas/vacaciones/coste debe fallar; no convertirse en cero;
- un negativo debe fallar aunque JavaScript lo considere truthy.

---

## 10. Encargos — contrato para LA-018

Un encargo nuevo debe ser una unidad coherente antes de persistirse.

### 10.1 Cabecera

- `clienteId`: obligatorio y resoluble;
- `fechaEntrega`: obligatoria y válida;
- para un encargo nuevo pendiente, la fecha de entrega no puede ser anterior a la fecha de creación;
- `localId`: debe resolverse de forma única y autorizada.

### 10.2 Líneas

- al menos una línea válida;
- cada `productoId` debe existir y pertenecer al local autorizado;
- `cantidad`: finita y `> 0`;
- `precioUnitario`: finito y `>= 0`.

### 10.3 Señal / anticipo

- señal: vacía se interpreta como ausencia de señal, no como error;
- si se informa, debe ser finita y `>= 0`;
- señal `<= total` del encargo;
- si señal `> 0`, el medio de pago de la señal debe estar informado y ser válido;
- un valor no numérico no puede degradarse a `0` y borrar silenciosamente la señal.

El fallback visual `Sin cliente` puede seguir existiendo para datos históricos/legados, pero no habilita nuevas altas inválidas.

---

## 11. Contexto empresa/local

Este PM no reabre las reglas multilocal cerradas anteriormente.

Todo validador nuevo debe respetar:

- nada de datos de otra empresa;
- mutaciones con local explícito cuando el dominio es local;
- “Todos los locales” es consolidación de lectura, no contexto de escritura;
- local inactivo conserva histórico pero no admite nuevas operaciones ordinarias;
- referencias empresariales compartidas solo cuando el contrato previo lo permite.

Un dato numéricamente válido pero de otro contexto se considera inválido para la operación.

---

## 12. Reglas para datos legados

PM10 debe impedir crear nuevos datos inválidos sin destruir el histórico existente.

Por tanto:

- leer un objeto legado inválido no obliga a borrarlo ni a reescribirlo automáticamente;
- editar un registro legado exige que el estado resultante cumpla el contrato del dominio, salvo una excepción explícitamente documentada;
- no se normalizarán masivamente datos históricos en silencio;
- las correcciones de datos, si fueran necesarias, deberán quedar separadas de las altas/ediciones ordinarias y con evidencia.

---

## 13. Criterio de autoridad durante las próximas correcciones

Para cerrar cada LA de PM10 se exigirá prueba de que:

1. la ruta normal de UI rechaza el caso inválido;
2. la función/lógica de dominio también lo rechaza sin depender de la UI;
3. el rechazo sucede antes de la primera mutación;
4. no queda persistencia parcial;
5. la ruta válida equivalente sigue funcionando;
6. contexto empresa/local permanece aislado;
7. si hay una autoridad backend aplicable, también rechaza el payload inválido.

Si el dominio sigue almacenándose únicamente en `almacen_kv`, el cierre no podrá basarse solo en atributos HTML como `min`, `required` o `type=number`; debe existir una barrera programática reutilizable antes de guardar.

---

## 14. Casos límite mínimos que deberán entrar en tests

Cada módulo deberá cubrir, según aplique:

- cadena vacía;
- espacios solamente;
- `0`;
- negativo;
- decimal válido;
- texto no numérico;
- `NaN` producido por conversión;
- valor extremadamente grande pero finito;
- identificador inexistente;
- identificador de otro local;
- doble envío/reentrada cuando exista riesgo de duplicado;
- payload válido inmediatamente después del inválido, para demostrar que el fallo no dejó estado parcial.

Pedidos/Recepción añadirán además:

- parcial dentro del pendiente;
- exacto al pendiente;
- un céntimo/unidad por encima del pendiente cuando la unidad permita fracción;
- edición de pedido ya parcialmente recibido.

Encargos añadirán:

- sin cliente;
- sin fecha;
- fecha inválida;
- sin líneas;
- señal mayor que total;
- señal no numérica.

---

## 15. Estado de las incidencias tras este punto

Este punto **no cierra** LA-011, LA-012, LA-013, LA-017 ni LA-018. Solo congela el criterio con el que podrán cerrarse.

| Hallazgo | Estado tras P03 | Próxima acción |
|---|---|---|
| LA-011 Productos | ABIERTA · contrato fijado | corregir Productos |
| LA-012 Pedidos | ABIERTA · contrato fijado | corregir Pedidos |
| LA-013 Recepción | ABIERTA · contrato fijado | corregir Recepción |
| LA-017 Personal | ABIERTA · contrato fijado | corregir Personal |
| LA-018 Encargos | ABIERTA · contrato fijado | corregir Encargos |

---

## 16. Decisión de continuidad

Con este contrato congelado, el siguiente punto puede corregir **LA-011 Productos** sin improvisar reglas durante la implementación.

No se ha tocado `main`, producción, Netlify ni Supabase de producción en este punto.
