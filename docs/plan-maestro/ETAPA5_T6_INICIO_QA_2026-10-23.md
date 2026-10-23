# Plan Maestro L&A Suite — Inicio T6 QA: cobro completo

Fecha: 23/10/2026  
Entorno objetivo: preview 175 · QA Empresa A, S.L. · Local A1  
Alcance: exclusivamente Plan Maestro L&A Suite. No se mezcla con Plan ABC.

## 1. Punto de partida

T5 está cerrada en `ETAPA5_T5_QA_FIXTURE_ARTICULO_SALA_2026-10-23.md`.
La pantalla de cobro ya tiene la base de efectivo, tarjeta simulada, pago
parcial/mixto, estado calculado por servidor y recuperación del mismo intento.
El contrato de UI se ejecutó con estos resultados:

- `PLAN_MAESTRO_ETAPA5_T6_COBRO_BASE=PASS`.
- Pendientes iniciales: Bizum, propina, vale regalo, billetes rápidos, factura
  a empresa con NIF, envío por email, artículo varios y unir mesas.

## 2. Primer subpunto T6 implementado

Se añadieron **billetes rápidos** al bloque `Cobro · F4` en `fuente.js` y en
`source-recovery/fuente-recuperado.js`, manteniendo la paridad entre el fuente
publicado y el espejo de recuperación.

La ayuda muestra las denominaciones QA de 5, 10, 20, 50 y 100 euros. Cada
botón solo rellena «Efectivo recibido» y recalcula el cambio en pantalla; no
llama a `abc_iniciar_cobro`, no confirma efectivo y no registra movimiento de
caja. El cobro sigue necesitando la acción explícita «Cobrar efectivo».

## 3. Límites de esta ronda

- No se ejecutó ningún cobro ni se modificó el pedido operativo existente.
- No se creó ningún pago real, no se conectó un proveedor de Bizum y no se
  enviaron emails.
- Propinas y vales regalo necesitan contrato de servidor, política y fixture
  QA antes de exponer una escritura.
- Factura a empresa y envío por email necesitan numeración, datos fiscales y
  destinatario/proveedor definidos; no se inventaron esos datos.
- No se tocó PROD ni se hicieron escrituras SQL directas.

## 4. Verificación QA del primer subpunto

En el preview 175 se abrió `Cobro · F4` sobre el pedido QA existente de 2,00
euros y se pulsó `€10`. El resultado visible fue:

- `Efectivo recibido: 10,00`.
- `Cambio a devolver: €8,00`.
- El botón `Cobrar efectivo` permaneció sin pulsar.
- Confirmado: `€0,00`; pendiente: `€2,00`.

Resultado: **PASS QA** para la preparación de billetes rápidos. El pedido no
se cobró ni se cambió; no se abrió un intento de pago nuevo.

Después se repetirá el contrato T6 y se decidirá el diseño seguro de Bizum
antes de cualquier intento de cobro.

**Estado:** T6 iniciada; billetes rápidos **PASS QA**; T6 no cerrada.

### Lo siguiente

Verificar en QA los billetes rápidos sin pulsar «Cobrar efectivo». Después,
preparar el contrato de Bizum como método pendiente/simulado, sin proveedor ni
cobro real, y documentar los bloqueos de propina, vale, factura y email.
