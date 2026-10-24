# Plan Maestro L&A Suite — Etapa 5, T6: tecla de propina

Fecha: 24/10/2026
Entorno: QA `qjqorixtkilwsndqayyx`, aplicable a cualquier empresa/local (no es
una pieza QA-only como el resolvedor de tarjeta: es la función real).
Autorización: Hoja QA-4 (Pedro, 24/10/2026, chat).

## 1. Lo pedido

«La propina: que el TPV, a la hora de cobrar, tenga una tecla de propina
donde el cambio es propina.»

## 2. Qué se construyó

### 2.1 Base de datos (migración nueva)

`supabase/migrations/20261024070000_t6_propina_efectivo.sql`:

- `public.abc_registrar_propina_efectivo(p_operation_id, p_empresa_id,
  p_local_id, p_pago_id, p_caja_id, p_session_id, p_terminal_id,
  p_operating_day, p_importe)`.
- No toca `abc_iniciar_cobro` ni `abc_confirmar_efectivo`: son una pieza
  aparte, llamada después de que el pago en efectivo ya esté `CONFIRMADO`.
- Exige el mismo permiso que ya exige cobrar en efectivo
  (`ABC_COBRO_INICIAR`) — ningún cargo nuevo que aprender.
- Exige que el pago sea `EFECTIVO`, esté `CONFIRMADO` y que el importe de la
  propina coincida **exactamente** con `pagos.cambio_entregado` de ese pago
  (no se inventa ni se escribe un importe distinto al que el propio cobro ya
  registró).
- Impide registrar dos veces la propina del mismo pago.
- Inserta una fila en `abc_cobros_no_venta` (concepto `PROPINA`, tabla B06
  que ya existía desde hace semanas, sin ninguna función de alta hasta hoy).
- Inserta una fila en `caja_operaciones` (`efecto_efectivo` = importe de la
  propina, `origen_tipo='ABC_COBRO_NO_VENTA'`, `categoria='PROPINA'`), para
  que el dinero de más que queda en caja no salga como una diferencia sin
  explicar en el arqueo del día.
- `SECURITY DEFINER`, idempotente (mismo patrón `abc_operacion_iniciar` /
  `abc_operacion_completar` que el resto de RPC de cobro), `grant execute`
  limitado a `authenticated`.
- **No decide tratamiento fiscal, documental ni contable.** Esos tres campos
  siguen `PENDIENTE_ASESORIA` en `abc_b06_politica_conceptos`, sin tocar.
  Solo lleva la cuenta interna del dinero.

Aplicada en QA y verificada: `SECURITY DEFINER`, grants
`postgres:EXECUTE, authenticated:EXECUTE`, advisor de seguridad sin
hallazgos nuevos aparte del aviso genérico esperado para cualquier función
`SECURITY DEFINER` ejecutable por `authenticated`.

### 2.2 Cómo se cobra en efectivo (sin cambios)

`abc_iniciar_cobro` y `abc_confirmar_efectivo` reciben exactamente el mismo
`cambioEntregado` real que hoy (el que se devolvería al cliente). La casilla
**no fuerza ese valor a cero** — lo probé y descubrí que forzarlo rompía la
validación ya existente del cliente (`efectivo_recibido_cambio_inconsistente`),
así que en vez de tocar esa validación, dejé el cobro intacto y la propina
como un segundo paso, por el mismo importe.

### 2.3 Pantalla (`fuente.js` y `source-recovery/fuente-recuperado.js`)

- Casilla **"El cambio es propina"**, visible solo cuando hay cambio a
  devolver (`cambioVisible > 0`).
- Marcada, la línea de "Cambio a devolver" pasa a mostrar **"Propina: €X,XX
  (no se devuelve cambio)"**.
- Al pulsar "Cobrar efectivo": el cobro en efectivo se confirma igual que
  siempre; si la casilla estaba marcada, se llama después a
  `abc_registrar_propina_efectivo` con el mismo importe del cambio. Si esa
  segunda llamada fallara, el cobro ya confirmado no se deshace — se avisa
  en pantalla de que la propina no se pudo registrar y que el cambio sigue
  pendiente de devolver.
- La casilla se desmarca sola después de cada cobro en efectivo.

## 3. Verificación

- `node --check` en ambos archivos: OK.
- `node .github/scripts/build-netlify-publish.mjs` + `node --check` del
  resultado: OK.
- Prueba de contrato nueva
  (`tests/plan-maestro/etapa5-t6-propina-efectivo-contract.mjs`): PASS.
- Contratos existentes de las Etapas 3, 4 y 5 (T5/T6): todos en verde, sin
  cambios de resultado.
- Manifiesto de CI actualizado (310→311 archivos, 293→294 contratos
  activos).

## 4. Límites respetados

- No se ha tocado PROD.
- No se mueve dinero real fuera de lo que el propio cliente entrega en el
  mostrador.
- No se decide tratamiento fiscal, documental ni contable de la propina.
- No se ha tocado `abc_iniciar_cobro` ni `abc_confirmar_efectivo`.

## 5. Cierre confirmado (24/10/2026)

Pedro (vía Cowork, su propia sesión) hizo la prueba completa: pedido de
8,00 €, pagó con 20,00 € marcando "El cambio es propina". Resultado en
pantalla: "Efectivo confirmado y cuenta pagada. Propina de €12.00
registrada; no se devuelve cambio." Cuenta: Total €8,00 / Confirmado €8,00 /
Pendiente €0,00 / PAGADO.

Comprobado en QA, solo lectura, el 24/10/2026:

- `abc_cobros_no_venta`: fila `3bb51de1-7928-406a-b784-453f3111953a`,
  concepto `PROPINA`, importe `12.00000000`, medio `EFECTIVO`,
  `datos.origen='cambio_no_devuelto'`, enlazada al `pago_id` real.
- `caja_operaciones`: `efecto_efectivo=12.00`, `origen_tipo=ABC_COBRO_NO_VENTA`,
  `categoria=PROPINA` — el dinero de más en caja queda explicado.

**T6, punto 2 (tecla de propina): cerrado.**

## 6. Pendiente

- Antes de usar esto con dinero real en un negocio de verdad: confirmar con
  la asesoría de Pedro el tratamiento fiscal/contable de las propinas.
- Dos hallazgos de la prueba en vivo, fuera del alcance de esta pieza — ver
  `docs/plan-maestro/ETAPA5_HALLAZGOS_PRUEBA_PROPINA_2026-10-24.md`.
