# Plan Maestro L&A Suite — Etapa 6, T8 (pieza 3): tarifa de horario ("hora feliz")

Fecha: 24-25/10/2026
Entorno: QA `qjqorixtkilwsndqayyx`.
Autorización: Pedro (chat, 24/10/2026), alcance elegido entre tres opciones:
"solo horario (hora feliz)" — sin zonas.

## 1. Lo pedido

Seguir con T8 (Etapa 6) por su tercera pieza: "zonas y tarifas libres con horario, como una
hora feliz". Antes de construir nada, se planteó el alcance a Pedro en tres niveles (solo
horario / zonas + horario / parar aquí) y eligió el más acotado: una tarifa que se active sola
según el horario, sin zonas todavía.

## 2. Aviso honesto (investigación previa)

El plan (página 6) dice: *"T8. [...] zonas y tarifas libres (con horario, como una hora
feliz) [...]. La parte de servidor ya va en la Hoja QA-3."* Se revisaron todas las migraciones
y **no existía nada de esto en el servidor**: ninguna tabla, ninguna función, ningún precio
distinto por horario. Es una afirmación del plan que no se cumplió — el mismo patrón que ya se
vio con AUD-009. Se ha construido desde cero.

## 3. Qué se construyó

Migración `20261024190000_t8_tarifa_horario_hora_feliz.sql`:

- `catalogo_tpv_tarifas_horario`: una tarifa con nombre, los días de la semana en que se
  aplica (lunes a domingo) y un rango de horas (sin cruzar medianoche). Dos tarifas activas no
  pueden solaparse en día y hora.
- `catalogo_tpv_tarifa_precios`: el precio especial de un producto concreto dentro de una
  tarifa.
- `private.abc_tarifa_horario_vigente`: qué tarifa está activa ahora mismo, según la hora
  local del local (reutiliza el huso horario ya configurado para el día operativo). Si algo
  falla al calcularlo, devuelve nulo — **nunca rompe un cobro** por un fallo aquí.
- `abc_guardar_tarifa_horario` / `abc_guardar_tarifa_precio`: crear o editar, mismo permiso
  que ya gestiona el catálogo (Propietario o Encargado).
- `private.abc_calcular_linea_tpv` (la función real que fija el precio de cada línea,
  modificada con `create or replace`, misma firma): si hay una tarifa vigente y el producto
  tiene un precio especial activo en ella, se usa ese precio en vez del normal. Si no hay
  ninguna tarifa vigente, el cálculo es exactamente el de antes.

### Pantalla (`fuente.js` y `source-recovery/fuente-recuperado.js`)

Pestaña nueva **"Tarifas (hora feliz)"** en Configuración: crear/editar una tarifa (nombre,
días, hora de inicio/fin, activa), con una ficha por tarifa que muestra sus precios especiales
y deja añadir uno más ahí mismo (reutilizando el patrón de ficha de la pieza 2).

## 4. Límite deliberado (alcance elegido por Pedro)

- Solo productos **sin variantes ni modificadores** (la línea simple de T3-A03). Las líneas
  configuradas con opciones (T3-A04) no llevan hora feliz todavía: siguen cobrando siempre el
  precio normal.
- Sin zonas: la tarifa se aplica igual en todo el local, no por Barra/Mesa/Terraza.
- El precio especial siempre es precio base + el impuesto normal del producto; no admite el
  modo "precio con impuesto incluido" (D31) — al aplicarse, la línea pasa a calcularse como
  base + impuesto.

## 5. Verificación

- `node --check` en ambos archivos: OK.
- Prueba de contrato (`tests/plan-maestro/etapa6-t8-tarifa-horario-contract.mjs`): comprueba
  las tablas, las 2 RPCs (mismo permiso, idempotencia, limpieza ante fallo), el solape de
  tarifas, que `abc_tarifa_horario_vigente` nunca lance una excepción, el parche de
  `abc_calcular_linea_tpv`, la pantalla y la paridad carácter a carácter entre `fuente.js` y
  el espejo. Todo en verde.
- Verificado en QA con datos reales: se creó una tarifa de prueba temporal ("VERIF Hora feliz
  temporal", sábados 21:00-23:59) con un precio especial en un café (1,00 € → 0,50 €), se
  comprobó que `abc_calcular_linea_tpv` la aplicaba exactamente (base 1,00 €, impuestos 0,10
  €, total 1,10 € para 2 unidades), y que sin ninguna tarifa vigente el resultado es idéntico
  al de antes del cambio. La tarifa de prueba se desactivó después (con autorización de Pedro)
  para no dejarla operativa; no se borró, siguiendo la norma del proyecto de no borrar nunca,
  solo desactivar.
- Todos los contratos de `tests/plan-maestro/`: sin cambios de resultado.
- Manifiesto de CI actualizado (317→318 archivos, 300→301 contratos activos, Node 270→271).

## 6. Hallazgo aparte, no de esta pieza

Al ejecutar la suite más amplia (no solo `tests/plan-maestro/`) para comprobar que el cambio
en `abc_calcular_linea_tpv` no rompía nada, se encontró que `tests/f3/a02/a02-1-contract.mjs`
falla en su primera comprobación (paridad de todo el archivo `fuente.js` contra el espejo,
carácter a carácter). Se confirmó que **no es un efecto de este trabajo**: el mismo fallo ya
existía en el commit de la Hoja QA-9 (T7), de ayer, antes de empezar la Etapa 6. Se ha dejado
anotado como tarea aparte para investigarlo y corregirlo, sin bloquear esta pieza.

## 7. Límites respetados

- No se ha tocado PROD.
- No se ha creado ninguna tabla de las ya existentes, ni se ha tocado ningún dato.
- La única función existente que se modifica (`abc_calcular_linea_tpv`) solo cambia de
  comportamiento cuando hay una tarifa de horario vigente con un precio especial para ese
  producto; en cualquier otro caso, el resultado es idéntico al de antes (verificado).

**T8, pieza 3: construida, probada en QA. Pieza 4 (plantillas por tipo de negocio) y pieza 5
(teclas y permisos por cargo) siguen pendientes.**
