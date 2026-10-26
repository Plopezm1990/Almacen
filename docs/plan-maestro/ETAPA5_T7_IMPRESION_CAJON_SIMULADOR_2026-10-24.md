# Plan Maestro L&A Suite — Etapa 5, T7: impresoras y cajón (modo simulador)

Fecha: 24/10/2026
Entorno: QA `qjqorixtkilwsndqayyx`.
Autorización: Hoja QA-9 (Pedro, 24/10/2026, chat).

## 1. Lo pedido

T7 («impresoras y cajón») estaba bloqueada desde el 23/10/2026
(`ETAPA5_PREVUELO_QA3_2026-10-23.md`) por falta de una impresora de
prueba. Pedro confirmó (24/10/2026) que todavía no tiene ninguna
impresora y que el cajón monedero se abre a través de la impresora de
tickets (lo habitual). Decisión: construir y probar en QA toda la parte
de software que no necesita hardware real — igual que ya se hizo con
tarjeta y Bizum — dejando la conexión física real para cuando haya una
impresora.

## 2. Qué se construyó

No se creó ninguna tabla nueva: se reutiliza `abc_eventos` y el
catálogo de equipos ya existente (`abc_local_equipos`, "Equipos del
local" — un simple registro desde antes del proyecto, que "no los
conecta ni los configura").

Dos funciones nuevas (migración
`20261024160000_t7_impresion_cajon_simulador.sql`):

- `abc_simular_impresion_ticket`: exige el mismo permiso que iniciar un
  cobro (`ABC_COBRO_INICIAR`); la cuenta debe estar completada y el
  equipo debe ser una impresora de tickets activa.
- `abc_simular_apertura_cajon`: exige el mismo permiso que operar la
  caja (`ABC_CAJA_OPERAR`); exige una sesión de caja abierta y un
  equipo cajón activo. Si se abre sin una venta asociada, exige un
  motivo — igual que ya exigen las entradas/salidas de caja.

### Pantalla (`fuente.js` y `source-recovery/fuente-recuperado.js`)

- Sección **"Imprimir ticket"** en Cobro·F4, visible solo con la cuenta
  pagada por completo (junto a "Factura a empresa" y "Ticket por
  correo"): desplegable con las impresoras registradas y botón
  "Imprimir ticket (simulado)".
- Sección nueva, **siempre visible** (junto a "Vale regalo"):
  **"Cajón monedero"**, con desplegable del cajón, campo de motivo y
  botón "Abrir cajón (simulado)".
- Todos los mensajes del simulador dejan explícito: *"modo simulador:
  no hay conexión real con el aparato"*.

## 3. Un fallo encontrado y corregido en la prueba en vivo (Cowork)

**"Imprimir ticket" comparaba contra la palabra equivocada.**
`abc_simular_impresion_ticket` comprobaba
`v_checkout.estado <> 'PAGADO'`. Pero `checkouts.estado` solo admite
`ABIERTO`, `EN_COBRO`, `COMPLETADO` o `CANCELADO` — "PAGADO" es el
estado *agregado* que calcula `abc_estado_cobro_cuenta` para la
pantalla, no el valor real de esa columna. La comprobación rechazaba
siempre, con cualquier cuenta, el mensaje "Solo se puede imprimir el
ticket cuando la cuenta está pagada por completo" — confirmado al
probarlo con una cuenta genuinamente pagada por completo (vale regalo +
Bizum). Corregido (migración
`20261024170000_t7_fix_impresion_checkout_completado.sql`) comparando
contra el valor real, `'COMPLETADO'`. Verificado en QA: el checkout de
la cuenta de prueba tenía exactamente ese estado.

Tras la corrección, Cowork repitió la prueba sobre la misma cuenta y
funcionó a la primera; sugirió que el primer fallo pudiera ser una
condición de carrera intermitente. No lo es: el histórico de eventos en
QA muestra únicamente dos intentos de impresión, los dos *después* de
aplicar la corrección (el intento fallido, al rechazar antes de llegar
a guardar nada, nunca llegó a dejar ningún registro). Era, simplemente,
antes y después del arreglo.

## 4. Verificación

- `node --check` en ambos archivos: OK.
- Prueba de contrato
  (`tests/plan-maestro/etapa5-t7-impresion-cajon-simulador-contract.mjs`):
  comprueba las dos secciones de pantalla (impresión solo con cuenta
  pagada, cajón siempre visible), los 4 puntos de conexión de las 3
  funciones nuevas, la paridad carácter a carácter entre `fuente.js` y
  el espejo, que no se crea ninguna tabla nueva, los permisos exigidos,
  y la corrección del estado de checkout. Todo en verde.
- Todos los contratos existentes de `tests/plan-maestro/`: sin cambios
  de resultado.
- Manifiesto de CI actualizado (315→316 archivos, 298→299 contratos
  activos, Node 268→269).
- Verificado en QA con datos reales: equipos "Impresora barra"
  (Impresora de tickets) y "Cajón principal" (Cajón monedero) creados;
  evento `CAJON_ABIERTO_SIMULADO` con motivo "Poner cambio"; dos
  eventos `TRABAJO_IMPRESION_SIMULADO` sobre la cuenta pagada con vale
  regalo + Bizum, confirmando que el estado real del checkout
  (`COMPLETADO`) ya no bloquea la impresión.

## 5. Límites respetados

- No se ha tocado PROD.
- Nunca se conecta con ningún aparato real — todos los mensajes lo
  dejan explícito.
- No se ha creado ninguna tabla nueva: todo el histórico vive en
  `abc_eventos`, igual que el resto del proyecto.
- No se ha tocado ninguna lógica de efectivo/tarjeta/Bizum/vale regalo
  ya probada.

## 6. Pendiente (bloqueado por hardware)

- Conexión real Epson/Star desde el navegador.
- "Puente L&A" (programa intermedio) para el resto de impresoras.

Cuando Pedro tenga una impresora de prueba, solo haría falta conectar
esa pieza física — el software (registro de equipos, reglas del cajón,
constancia de lo impreso) ya está construido y probado.

**T7: software completo en modo simulador. Pendiente solo de hardware real.**
