# Plan Maestro L&A Suite — Etapa 7.1 — fixture mínimo QA para Empresa B

Fecha: 26/10/2026  
Entorno: exclusivamente QA `qjqorixtkilwsndqayyx`  
Aplicación: Deploy Preview del PR `#175`, commit `e0a897e`  
Contexto: `QA Empresa B` / `Local B1`  
Autorización: el usuario autorizó preparar el fixture mínimo en QA para poder
continuar la comparación A/B.  
Producción: no consultada ni modificada.

## 1. Objetivo

Preparar un dato de negocio claramente identificable en `QA Empresa B` para
comprobar tres fronteras de la Etapa 7.1:

1. que el producto queda asociado al contexto B y no aparece al volver a A;
2. que el catálogo del TPV B puede hidratarse con ese producto;
3. que el stock puede pasar de almacén a piso de venta sin crear ventas,
   cobros ni movimientos de Caja.

El alcance fue deliberadamente mínimo. No se creó una venta, no se cobró un
ticket, no se abrió ni cerró Caja y no se utilizó ningún dato de producción.

## 2. Fixture creado en QA

En `QA Empresa B`, desde `Productos`, se creó mediante la interfaz el
siguiente producto de prueba:

| Campo | Valor |
|---|---|
| Nombre | `QA B A-B Producto 1 elaborado` |
| SKU | `QA-B-AB-01` |
| Categoría | `Bebidas y licores` |
| Departamento | `Tienda` |
| Tipo | Elaborado, vendido al cliente |
| Precio de venta con IVA | `€1,21` |
| Coste unitario sin IVA | `€0,50` |
| Stock inicial | `10` unidades en almacén |
| Stock mínimo | `2` unidades |
| Zona | `Mostrador / vitrina` |

La lista de productos confirmó el registro con `10` unidades en almacén,
`0,00` en piso, coste `€0,50`, precio con IVA `€1,21` y margen mostrado de
`54,55%`. El registro se dejó identificado con prefijo `QA B A-B` para no
confundirlo con datos de negocio reales.

## 3. Comprobación en TPV B

Tras seleccionar explícitamente `Local B1`, el TPV mostró:

- `CATÁLOGO 1 producto(s) disponible(s)`;
- el botón `QA B A-B Producto 1` con precio `€1,21`;
- ticket `0 líneas · €0,00`;
- `F9 Guardar` deshabilitado;
- historial de ventas: `0 registrada(s)`.

El botón del producto quedó deshabilitado porque el stock de piso era cero.
Esto confirma la visibilidad del catálogo, pero no una venta ni una
disponibilidad operativa completa en TPV.

## 4. Intento controlado de traspaso

En `Más → Traspasos`, con dirección `Almacén → Piso de venta` y cantidad `1`,
se pulsó `Confirmar movimiento`.

Resultado del servidor:

> No se pudo confirmar el traspaso con el servidor. No se modificó el stock
> local.

La pantalla conservó `10,00` unidades en almacén y `0,00` en piso; no apareció
un nuevo elemento en el historial de traspasos. La aplicación no generó una
cola de reintento para este fallo.

La inspección de solo lectura del navegador confirmó:

- `almacen__pendientes = []`;
- `almacen__pendientes_contexto = []`;
- no hubo una mutación local de stock;
- la colección `productos` continúa marcada en QA como no subible/local.

No se reintentó de forma ciega para evitar duplicar una operación cuyo
contrato de servidor todavía no está resuelto.

## 5. Decisión técnica

El resultado es **válido como smoke test de interfaz e hidratación de catálogo
en la sesión actual**, pero **no es un fixture A/B persistente ni suficiente
para cerrar la comparación de negocio**.

La razón es doble:

1. QA marca `productos` como colección local/no subible para este contexto;
2. el traspaso servidor de almacén a piso falla y deja el stock sin modificar.

Por ello, la comparación queda así:

- aislamiento entre A y B: **PASS**;
- retorno B → A: **PASS**, según la comprobación anterior;
- producto visible en TPV B durante la sesión: **PASS parcial**;
- stock de piso utilizable en TPV B: **BLOQUEADO**;
- dataset persistente equivalente A/B: **NO CONCLUYENTE**;
- ventas, cobros y Caja: **no ejecutados**.

## 6. Riesgo y límites

El producto creado es un dato de prueba QA y permanece dentro del alcance de
QA. No se debe interpretar como evidencia sobre producción. Tampoco se debe
presentar el catálogo local como confirmación de que la persistencia por
empresa/local funciona para nuevos contextos.

La autorización utilizada cubría la preparación de este fixture en QA; no
cubría borrar la colección `productos`, modificar Supabase directamente,
crear ventas, hacer cobros ni tocar producción. Por esa razón no se ejecutó
ninguna de esas acciones.

## 7. Qué sigue

El siguiente paso técnico es preparar o ejecutar un mecanismo **autorizado y
exclusivo de QA** para sembrar de forma persistente un producto con alcance de
empresa/local y stock de piso, o corregir el contrato de persistencia/traspaso
que QA está rechazando. Después se debe repetir:

1. cambio A1 → B1 y B1 → A1;
2. catálogo e indicadores de B;
3. traspaso controlado a piso;
4. hidratación del TPV con botón habilitado, manteniendo ticket sin guardar;
5. verificación de que A no ve el producto de B.

Hasta completar ese mecanismo, la Etapa 7.1 sigue abierta y la campaña T9
física no debe darse por iniciada.
