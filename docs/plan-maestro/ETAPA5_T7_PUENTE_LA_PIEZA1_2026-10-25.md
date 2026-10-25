# Plan Maestro L&A Suite — Etapa 5, T7 (continuación): Puente L&A, pieza 1

Fecha: 25/10/2026
Entorno: solo código y pruebas automáticas (sin QA ni PROD; no hay impresora real).
Autorización: Pedro (chat, 25/10/2026) — "si yo autorizo a empezar con [esto] y dejar las
pruebas que tengan que ver con el hardware para después, no importa que después tengamos que
arreglar algo". Alcance elegido entre las opciones planteadas: construir primero el Puente
L&A (el programa intermedio), no la conexión directa en el navegador.

## 1. De dónde viene esto

La Hoja QA-9 (`ETAPA5_T7_IMPRESION_CAJON_SIMULADOR_2026-10-24.md`) dejó T7 (impresoras y
cajón) con todo el software que no necesita hardware ya construido y probado en QA, y
anotó dos cosas pendientes de verdad bloqueadas por hardware: la conexión directa desde el
navegador (Epson/Star) y un "Puente L&A" (programa intermedio) para el resto de impresoras.
Esta pieza construye ese segundo camino.

## 2. Qué es el Puente L&A

Un programa aparte (`puente-la/`), que no es parte de la web del TPV — se instala y se
ejecuta en el propio ordenador de la caja (Windows, confirmado por Pedro). Escucha en
`127.0.0.1` y expone:

- `GET /estado` — para comprobar que está encendido y en qué modo.
- `POST /imprimir` — recibe las líneas del ticket y las envía a la impresora.
- `POST /abrir-cajon` — envía el pulso de apertura del cajón (a través de la impresora,
  como es habitual).

Las dos últimas rutas exigen un token propio (`X-Puente-Token`), generado por quien instale
el puente — nunca pedido ni manejado por chat —, para que ninguna otra página abierta en
ese mismo ordenador pueda imprimir o abrir el cajón sin permiso.

Dos modos de conexión con la impresora, los dos genéricos (no ligados a una marca):

- **Red**: manda los bytes por un socket TCP al IP:puerto de una impresora de red (el
  puerto 9100 es el estándar que usan casi todas las impresoras térmicas con red/WiFi).
- **Windows**: manda los bytes a una impresora ya instalada y compartida en Windows
  (USB o la que sea), copiándolos en crudo a su ruta de red local — así no hace falta
  ningún driver propio del puente.

## 3. Qué se ha probado y qué no

**Probado (automático, sin hardware):**

- La construcción de los bytes ESC/POS del ticket y del pulso del cajón
  (`puente-la/formato-ticket.js`): inicialización, líneas, corte de papel, comando de
  apertura de cajón — valores exactos comprobados byte a byte.
- La carga y validación de `config.json` (`puente-la/config.js`): rechaza token corto,
  modo desconocido, o datos de red/Windows incompletos, con mensajes claros.
- Todas las rutas del servidor HTTP (`puente-la/servidor.js`), con los transportes de
  red/Windows sustituidos por versiones falsas en la prueba: token ausente o incorrecto
  rechaza con 401, `/estado` no filtra el token, `/imprimir` y `/abrir-cajon` llaman al
  transporte correcto según el modo configurado, con los bytes correctos.
- Prueba de contrato: `tests/plan-maestro/etapa5-t7-puente-la-pieza1-contract.mjs`. Todo
  en verde.

**Sin probar todavía (necesita una impresora real):**

- El envío final de los bytes al aparato de verdad, tanto por red
  (`puente-la/transporte-red.js`) como por la cola de Windows
  (`puente-la/transporte-windows.js`). Están escritos siguiendo la documentación pública
  del protocolo ESC/POS y el método conocido de impresión en crudo por impresora
  compartida de Windows, pero no se ha podido ejecutar ni comprobar ni una sola vez —
  este entorno de desarrollo es Linux, sin impresora conectada.
- Cosas que solo se pueden ajustar con el aparato delante: la página de caracteres para
  que las tildes y la "ñ" salgan bien, el ancho de papel, el comportamiento exacto del
  corte y del pulso del cajón en el modelo concreto que llegue a comprarse.

Pedro ha aceptado explícitamente este riesgo: construir ahora la parte que se puede
probar de verdad, dejando la última conexión con el aparato para ajustarla cuando llegue
la impresora real.

## 4. Qué no se ha tocado

- No se ha tocado el simulador de T7 (pantalla "Imprimir ticket" / "Cajón monedero" en
  `fuente.js`) — sigue como estaba, probado y funcionando. Esta pieza 1 no lo conecta
  todavía con el Puente L&A; eso sería la pieza 2.
- No hay ninguna migración ni cambio en QA/Supabase — el Puente L&A es un programa
  aparte, fuera de la web y de la base de datos.
- No se ha tocado PROD.

## 5. Verificación

- `node --check` en los 6 archivos de `puente-la/`: OK.
- `node tests/plan-maestro/etapa5-t7-puente-la-pieza1-contract.mjs`: PASS.
- Todos los contratos existentes de `tests/plan-maestro/`: sin cambios de resultado.
- Manifiesto de CI actualizado (320→321 archivos, 303→304 contratos activos, Node
  273→274).

## 6. Siguiente paso de esta pieza

Cuando Pedro tenga una impresora de prueba: instalar `puente-la/` en el ordenador de la
caja (ver `puente-la/README.md`) y probar por primera vez el envío real de bytes. Antes
de eso, la pieza 2 (pendiente, sin construir todavía) conectaría la pantalla del
simulador de T7 con este puente, como una opción más junto al modo simulador — sin
quitar el simulador, que sigue siendo la única vía probada de verdad hasta que haya
hardware.
