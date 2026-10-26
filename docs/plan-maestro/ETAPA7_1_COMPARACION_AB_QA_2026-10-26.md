# Plan Maestro L&A Suite — Etapa 7.1 — comparación A/B QA

Fecha: 26/10/2026  
Entorno: QA `qjqorixtkilwsndqayyx`, Deploy Preview del PR `#175`, commit
`2311191`  
Estado: **AISLAMIENTO A/B PASS; COMPARACIÓN DE DATASET NO CONCLUYENTE POR B VACÍA**

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
modificaron sus usuarios, roles, locales, productos ni operaciones.

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
- catálogo del TPV: `0 productos`;
- ticket: `0 líneas · €0,00`;
- ventas registradas: `0`.

La interfaz no conservó los indicadores de A en el contexto B. El TPV de B
abrió en `Local B1`, con `F9 Guardar` deshabilitado, sin catálogo y sin ticket.

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
`QA Empresa B` tiene un fixture operativo vacío (`0 productos`, `0 ventas`),
por lo que no se puede comparar catálogo, ticket, stock o ventas de A contra un
dataset equivalente de B. Esto no se presenta como fallo de producción ni como
mezcla de datos.

## 6. Qué sigue

1. Preparar, con autorización específica y solo en QA, un fixture operativo
   mínimo para B o restaurar una copia QA equivalente; no usar datos de
   producción ni borrar el aviso local de `productos` sin autorización.
2. Repetir la comparación de catálogo, indicadores y TPV A1/B1 con datasets
   equivalentes, manteniendo el ticket vacío y sin cobrar.
3. Ejecutar después la campaña T9 física con hardware autorizado.

