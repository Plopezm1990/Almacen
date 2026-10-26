# Plan Maestro L&A Suite — Etapa 7.1 — comparación A/B QA

Fecha: 26/10/2026  
Entorno: QA `qjqorixtkilwsndqayyx`, Deploy Preview del PR `#175`, commit
`e0a897e`
Estado: **AISLAMIENTO A/B PASS; FIXTURE B LOCAL VISIBLE; PERSISTENCIA Y STOCK BLOQUEADOS**

## 1. Objetivo y alcance

Comprobar que una sesión de propietario puede cambiar entre dos empresas QA sin
mezclar el contexto activo, los indicadores, los locales ni el TPV. La prueba
es exclusivamente de QA y no usa Supabase de producción. No se crean ventas,
cobros, movimientos de Caja ni líneas de ticket.

La aceptación se divide en dos partes:

1. aislamiento de contexto A/B;
2. comparación de datos operativos equivalentes.

## 2. Preparación del segundo contexto

El segundo contexto ya existía como `QA Empresa B`, pero estaba desactivado.
No se creó una empresa duplicada. Se reactivó desde la Plataforma QA con la
acción explícita de reactivación del contexto existente. La aplicación confirmó:

- `QA Empresa B` reactivada;
- `10 empresas activas · 1 desactivada`;
- `1` local activo de `2` en B;
- `2` usuarios activos de `2` en B;
- locales disponibles: `Local B1` activo y el segundo local inactivo.

El contexto B se dejó activo para poder continuar la campaña A/B. No se
modificaron sus usuarios, roles ni locales. En una comprobación posterior se
preparó un único producto QA claramente identificado; el resultado completo
queda en [`ETAPA7_1_FIXTURE_B_QA_2026-10-26.md`](ETAPA7_1_FIXTURE_B_QA_2026-10-26.md).

## 3. Recorrido A/B ejecutado

### 3.1 Empresa A

La aplicación abrió inicialmente en `QA Empresa A, S.L.`, `Local A1`. Se
observaron, entre otros, estos datos de referencia del contexto A1:

- saldo de almacén: `€12,27`;
- margen promedio: `92,58%`;
- pedidos pendientes: `0`;
- facturas por pagar: `€100.075,80` pendiente en total;
- encargos urgentes: `2`;
- conteos atrasados: `2`;
- TPV medido previamente: `18` productos, `0 líneas · €0,00` y `31` ventas
  visibles con total vigente `€0,00`.

### 3.2 Cambio A → B

El selector mostró ambas empresas. Al elegir `QA Empresa B`, el encabezado
cambió a `Local B1 · QA Empresa B`. Los indicadores mostraron el dataset de B:

- saldo de almacén: `€0,00`;
- margen promedio: `0,00%`;
- pedidos pendientes: `0`;
- facturas por pagar: `0`;
- encargos urgentes: `0`;
- catálogo del TPV: inicialmente `0 productos`; después del fixture local,
  `1 producto` visible;
- ticket: `0 líneas · €0,00`;
- ventas registradas: `0`.

La interfaz no conservó los indicadores de A en el contexto B. El TPV de B
abrió en `Local B1`, con `F9 Guardar` deshabilitado y sin ticket. Tras crear el
fixture local `QA B A-B Producto 1 elaborado` (SKU `QA-B-AB-01`), el catálogo
mostró `1 producto`, pero el botón permaneció deshabilitado porque el producto
tenía `10` unidades en almacén y `0` en piso.

### 3.3 Cambio B → A

Al volver a `QA Empresa A, S.L.` y seleccionar `Local A1`, el encabezado y los
indicadores de A reaparecieron. Volvieron a observarse el saldo `€12,27`, las
facturas pendientes de `€100.075,80`, los `2` encargos urgentes y los `2`
conteos atrasados. El contexto terminó en `Local A1` sin ticket abierto.

Resultado del recorrido: **PASS de aislamiento A/B y de retorno de contexto**.

## 4. Condición local QA observada

Durante la apertura de la aplicación apareció el aviso:

`Guardado solo en este equipo (productos). En QA no se sube esta copia y los
datos operativos siguen disponibles.`

La interfaz llegó a mostrar `Guardado: cambios sin confirmar 1` y `2
colecciones solo en este equipo`, pero la inspección de solo lectura confirmó
que `almacen__pendientes` y `almacen__pendientes_contexto` permanecían en `[]`.
La clave `productos` está marcada por QA como colección no subible; no se
confunde con una cola de efectos pendientes.

La autorización de limpieza recibida cubría únicamente `conteos`; por eso no
se borró ni se modificó la copia local de `productos`.

## 5. Decisión

La parte de **aislamiento A/B** queda **PASS**: los contextos, locales,
indicadores y TPV se separan correctamente al cambiar de empresa y vuelven a
su estado correspondiente al regresar.

La parte de **comparación equivalente de datos** queda **NO CONCLUYENTE**:
`QA Empresa B` tiene ahora un producto de prueba visible durante la sesión,
pero la colección `productos` está marcada como local/no subible y el traspaso
de `1` unidad de almacén a piso fue rechazado por el servidor. Por tanto no se
puede comparar catálogo, ticket, stock o ventas de A contra un dataset
persistentemente equivalente de B. Esto no se presenta como fallo de
producción ni como mezcla de datos.

La comprobación detallada queda en
[`ETAPA7_1_FIXTURE_B_QA_2026-10-26.md`](ETAPA7_1_FIXTURE_B_QA_2026-10-26.md).

## 6. Qué sigue

1. Resolver, con autorización específica y solo en QA, una vía de fixture
   persistente para `productos` y stock por empresa/local, o corregir el
   contrato de traspaso rechazado; no usar datos de producción ni borrar el
   aviso local de `productos` sin autorización.
2. Repetir la comparación de catálogo, indicadores, stock y TPV A1/B1 con
   datasets equivalentes, manteniendo el ticket vacío y sin cobrar.
3. Ejecutar después la campaña T9 física con hardware autorizado.

