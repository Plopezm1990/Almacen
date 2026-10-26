# Plan Maestro L&A Suite — Etapa 5, T7 (continuación): Puente L&A, pieza 2

Fecha: 25/10/2026
Entorno: solo código y pruebas automáticas (sin QA ni PROD; no hay impresora real).
Autorización: Pedro (chat, 25/10/2026) — continuación directa de la pieza 1, mismo riesgo
aceptado (construir y probar sin hardware, ajustar después).

## 1. Qué se construyó

Conecta la pantalla del simulador de T7 (Hoja QA-9, en `fuente.js`) con el Puente L&A
(pieza 1, `puente-la/`), como una opción más — **sin quitar el simulador**, que sigue
siendo el único camino probado de verdad hasta que haya una impresora real.

- Nueva tarjeta **"Puente L&A (opcional, en este ordenador)"**, siempre visible junto a
  "Vale regalo" y "Cajón monedero": una casilla para activarlo, campos de dirección y
  token, y un botón "Probar conexión" que llama a `GET /estado` del puente.
- La configuración (activado/dirección/token) se guarda solo en `localStorage` de ese
  navegador — es un ajuste del ordenador de caja, no un ajuste de negocio, así que nunca
  se sube al servidor.
- "Imprimir ticket" y "Abrir cajón" siguen haciendo **siempre** lo mismo que hacían
  (llamar a `abc_simular_impresion_ticket` / `abc_simular_apertura_cajon`, que dejan
  constancia en `abc_eventos`). Si el Puente L&A está activado, **además**, intentan de
  verdad la impresión/apertura llamando al puente (`/imprimir`, `/abrir-cajon`) con las
  líneas del ticket construidas a partir del pedido abierto. Si el puente no responde, se
  avisa en el mismo mensaje sin deshacer el registro ya guardado.
- Los textos y los botones cambian según el modo, para no decir "simulado" cuando en
  realidad se está intentando una impresión de verdad (aunque todavía sin verificar).

## 2. Qué se ha probado y qué no

**Probado (automático):** que las dos funciones de guardado comprueban primero el
resultado de la RPC (el registro de siempre) y solo después, si el puente está activado,
llaman a la ruta correcta del puente; que el panel se registra en el lugar correcto del
render; que los textos/botones reflejan el modo; paridad carácter a carácter de todo lo
añadido entre `fuente.js` y el espejo. Prueba:
`tests/plan-maestro/etapa5-t7-puente-la-pieza2-contract.mjs`.

**Sin probar todavía:** la impresión/apertura real en sí (eso es la pieza 1, sin
verificar contra hardware, ver `ETAPA5_T7_PUENTE_LA_PIEZA1_2026-10-25.md`) y, por tanto,
tampoco esta conexión punta a punta completa. Cuando Pedro tenga una impresora, la prueba
real sería: encender el puente en el ordenador de caja, activarlo en esta pantalla, y
comprobar que "Imprimir ticket" y "Abrir cajón" funcionan de verdad.

## 3. Qué no se ha tocado

- El simulador (sin el puente activado) se comporta exactamente igual que antes —
  comprobado con toda la batería de pruebas de `tests/plan-maestro/`.
- No hay ninguna migración ni cambio en QA/Supabase.
- No se ha tocado PROD.

## 4. Verificación

- `node --check` en `fuente.js` y el espejo: OK.
- `node tests/plan-maestro/etapa5-t7-puente-la-pieza2-contract.mjs`: PASS.
- Toda la batería de `tests/plan-maestro/`: sin cambios de resultado (se ajustó un patrón
  de `etapa5-t6-vale-regalo-contract.mjs` que comprobaba el orden exacto de las llamadas
  de render, para incluir la nueva tarjeta en la secuencia esperada — el propio contrato
  seguía cumpliéndose, solo cambió el texto literal a comprobar).
- Manifiesto de CI actualizado (321→322 archivos, 304→305 contratos activos, Node
  274→275).
- **Hallazgo aparte, no corregido aquí** (confirmado con `git stash` que ya existía antes
  de esta pieza): `tests/f3/a08/a08-1-ui-contract.mjs` falla buscando una cadena
  (`"movimientos: movimientosDelLocalActivo, listarCuentasRepartoA08, ..."`) que no
  aparece igual en `fuente.js`. No tiene relación con esta pieza ni con T7; parece de la
  misma familia que el hallazgo ya reportado y aparcado de `tests/f3/a02/a02-1-contract.mjs`
  (paridad de texto, tarea `task_3a6015c0`). Se deja anotado, sin tocar, para no mezclar
  causas distintas en un mismo cambio.

**T7, piezas 1 y 2 construidas y probadas sin hardware real.** Falta solo conectar un
aparato de verdad para cerrar T7 del todo.
