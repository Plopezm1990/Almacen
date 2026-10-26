# Puente L&A

Programa pequeño y aparte (no es parte de la web del TPV) que se instala en
el ordenador de la caja y hace de intermediario entre el TPV y tu impresora
de tickets/cajón monedero. Sirve para impresoras que no se pueden conectar
directamente desde el navegador.

**Estado: escrito y con pruebas automáticas de toda la parte que se puede
comprobar sin una impresora real. La parte final — enviar los bytes al
aparato de verdad — está escrita pero sin probar todavía.** No lo instales
en PROD hasta haberlo probado con tu impresora real en QA.

## Qué necesitas

- Node.js instalado en el ordenador de la caja (Windows).
- O bien: una impresora con conexión de red/WiFi (sabrás su IP), o bien:
  una impresora ya instalada en Windows (USB u otra) **compartida** desde
  el Panel de impresoras de Windows (clic derecho → Propiedades de
  impresora → pestaña "Compartir" → activar "Compartir esta impresora" →
  anota el nombre que le pongas).

## Instalación

1. Copia esta carpeta `puente-la` al ordenador de la caja.
2. Copia `config.ejemplo.json` a `config.json`.
3. Rellena `config.json`:
   - `puerto`: el puerto donde escuchará el puente en este mismo ordenador
     (por defecto 9123, normalmente no hace falta cambiarlo).
   - `token`: escribe tú mismo un texto propio, largo y difícil de adivinar
     (al menos 16 caracteres). **No lo compartas ni lo pongas en ningún
     sitio público** — es la contraseña que usará la web del TPV para
     hablar con este programa, y evita que otra página abierta en el mismo
     ordenador pueda imprimir o abrir el cajón sin permiso.
   - `modo`: `"red"` si tu impresora tiene IP propia, o `"windows"` si vas
     a usar una impresora ya instalada y compartida en Windows.
   - Rellena `red` (ip y puerto, normalmente 9100) o `windows`
     (nombreImpresora, el nombre que le pusiste al compartirla).
   - En `origenesPermitidos`, deja el origen exacto de la web que usará el
     TPV, sin una barra final. El puente responde a la comprobación CORS solo
     para esos orígenes; añade también el dominio productivo cuando se
     autorice el paso a producción.
4. Ejecuta `npm start` (o `node iniciar.js`) dentro de esta carpeta.
5. Debe aparecer: `Puente L&A escuchando en http://127.0.0.1:9123 (modo: ...)`.

## Qué hace

- `GET /estado` — para comprobar que está encendido y en qué modo está.
- `POST /imprimir` — recibe `{ "operationId": "...", "lineas": ["línea 1", "línea 2", ...], "qrFiscal": { "url": "https://...", "numero": "TPV-000001", "fecha": "2026-10-26", "importe": "1.00", "leyenda": "..." }, "cortar": true }`
  y lo manda a la impresora. Si llega `qrFiscal`, el puente añade el QR
  nativo ESC/POS y deja además la URL como texto de respaldo.
- `POST /abrir-cajon` — abre el cajón monedero (a través de la impresora,
  como es habitual).

Las dos últimas rutas exigen la cabecera `X-Puente-Token` con el mismo
token de `config.json`; sin él, o con uno equivocado, responde 401.
El `operationId` de impresión es estable para una misma venta: mientras el
puente siga encendido, repetir exactamente la misma operación devuelve éxito
idempotente sin volver a enviar bytes al transporte. Si el primer envío falla,
la operación se libera para poder reintentarse.

## Seguridad

Solo escucha en `127.0.0.1` (tu propio ordenador, nadie de fuera puede
llegar a él) y exige el token propio para imprimir o abrir el cajón. Aun
así, cualquier página abierta en el mismo navegador de ese ordenador podría
intentar llamarlo — por eso el token importa: sin él, no puede hacer nada.

## Límite conocido

El envío final de los bytes al aparato (por red o por la cola de impresión
de Windows) está escrito siguiendo la documentación pública del protocolo
ESC/POS, pero **no se ha podido ejecutar ni comprobar ni una sola vez**,
porque este programa se escribió sin tener una impresora real delante.
Cuando haya una impresora de prueba, lo primero será probar exactamente
esta parte — es posible que haga falta algún ajuste (la página de
caracteres para que las tildes y la "ñ" salgan bien, el ancho del papel, el
modelo concreto de corte).
