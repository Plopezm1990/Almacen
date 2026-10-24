# Plan Maestro L&A Suite — Etapa 5, T6: Bizum operativo (modo simulador)

Fecha: 24/10/2026
Entorno: QA `qjqorixtkilwsndqayyx`.
Autorización: Hoja QA-8 (Pedro, 24/10/2026, chat).

## 1. Lo pedido

Cerrar el último punto abierto de T6: Bizum solo tenía un "handshake" de
comprobación desde el 23/10/2026
(`ETAPA5_T6_INICIO_QA_2026-10-23.md`), sin ningún cobro real. Decisión de
Pedro: tratarlo exactamente igual que la tarjeta simulada ya probada
(Hoja QA-3) — modo simulador en QA por ahora, sin conectar ningún
proveedor real.

## 2. Qué se construyó

Tres cambios puntuales (migración
`20261024150000_t6_bizum_operativo_simulador.sql`), sin tocar nada de
efectivo/tarjeta/vale regalo ya probado:

1. `public.pagos` admite `BIZUM` como medio (antes solo `EFECTIVO`,
   `TARJETA`, `TRANSFERENCIA`, `OTRO`).
2. `abc_iniciar_cobro` admite `BIZUM` explícitamente en su lista de
   medios válidos — nunca se mapea silenciosamente a
   `TRANSFERENCIA`/`OTRO`, tal como se advirtió al diseñar el
   handshake original.
3. `abc_qa_confirmar_pago_simulado` (el resolutor de QA que ya usaba
   tarjeta) admite también `BIZUM`, derivando el `provider_code` del
   medio real del pago (`QA_SIMULADO_TARJETA` / `QA_SIMULADO_BIZUM`) en
   vez de un valor fijo único para ambos.

### Pantalla (`fuente.js` y `source-recovery/fuente-recuperado.js`)

- Botón nuevo **"Iniciar Bizum (QA)"**, junto a "Iniciar tarjeta
  simulada": llama a `ejecutarCobroF4("BIZUM", ...)`, reutilizando
  `iniciarCobroCuentaF4` sin ningún cambio de lógica (solo se amplió la
  lista de medios que acepta).
- El botón **"Aprobar pago simulado (solo QA)"**, ya existente para
  tarjeta, se extiende para aparecer también cuando el intento
  pendiente es `BIZUM` — reutiliza el mismo `resolverPagoSimuladoQAF4`
  sin ningún cambio.
- **"Preparar Bizum QA"** (el handshake de T6, sin cobro real) se
  conserva sin cambios, junto al nuevo botón operativo.

## 3. Verificación

- `node --check` en ambos archivos: OK.
- Tres pruebas de contrato en verde: la nueva
  (`etapa5-t6-bizum-operativo-contract.mjs`) y las dos ya existentes
  actualizadas (`etapa5-t6-bizum-qa-contract.mjs`,
  `etapa5-t6-tarjeta-qa-resolver-contract.mjs`, cuyas aserciones sobre
  la condición exacta del botón y el código de error renombrado
  quedaron desactualizadas al ampliar a dos medios).
- Todos los contratos existentes de `tests/plan-maestro/`: sin cambios
  de resultado.
- Manifiesto de CI actualizado (314→315 archivos, 297→298 contratos
  activos, Node 267→268).
- Verificado en QA con datos reales: cuenta de 3× Porción de tarta (QA)
  con €6,40 pendientes tras un pago parcial con vale regalo. "Iniciar
  Bizum (QA)" → intento `BIZUM` en `PENDIENTE` → "Aprobar pago simulado
  (solo QA)" → intento `CONFIRMADO`, `provider_code=QA_SIMULADO_BIZUM`,
  `provider_reference=QA-SIM-<id del intento>`, importe exacto €6,40.
  La cuenta quedó `PAGADO`. Confirmado además, con una consulta
  agregada, que ningún pago de efectivo/tarjeta/vale regalo (`OTRO`)
  cambió de estado con esta migración.

## 4. Límites respetados

- No se ha tocado PROD.
- No se conecta ningún proveedor de Bizum real; sigue siendo un
  simulador exclusivo de QA (mismo candado de `abc_qa_confirmar_pago_simulado`: solo `QA-EMP-A`/`QA-A1`, solo rol
  Propietario).
- No se tocó ninguna lógica de efectivo, tarjeta, vale regalo ni
  factura/ticket ya probada.

## 5. Pendiente

- Conectar un proveedor real de Bizum (fuera de alcance de esta Hoja;
  Bizum se queda, por ahora, igual que tarjeta: en modo simulador).

**T6: no quedan puntos abiertos.**
