import assert from "node:assert/strict";
import { construirBytesQrFiscal, construirBytesTicket } from "../../puente-la/formato-ticket.js";
import { crearServidor } from "../../puente-la/servidor.js";
import fs from "node:fs";

const qrFiscal = {
  url: "https://prewww2.aeat.es/wlpl/TIKE-CONT/ValidarQR?nif=QA-A2-TEST&numserie=TPV-000001&fecha=26-10-2026&importe=1.00",
  numero: "TPV-000001",
  fecha: "2026-10-26",
  importe: "1.00",
  leyenda: "QR fiscal · simulador QA · no presentado a AEAT",
};

// El puente debe convertir la URL fiscal en un QR nativo ESC/POS, además de
// conservar un respaldo textual para impresoras que no implementen GS ( k.
{
  const qr = construirBytesQrFiscal(qrFiscal);
  assert.ok(qr.length > 100, "el comando QR no puede ser un marcador vacío");
  assert.ok(qr.includes(Buffer.from(qrFiscal.url, "utf8")), "el payload QR debe contener la URL fiscal exacta");
  assert.ok(qr.includes(Buffer.from([0x1d, 0x28, 0x6b])), "debe usar comandos GS ( k de ESC/POS");

  const ticket = construirBytesTicket({ lineas: ["Agua 50 cl       1,00 EUR"], qrFiscal, cortar: true });
  assert.ok(ticket.includes(Buffer.from("QR FISCAL", "latin1")));
  assert.ok(ticket.includes(Buffer.from("Documento: TPV-000001", "utf8")));
  assert.ok(ticket.includes(Buffer.from("Verificación: " + qrFiscal.url, "utf8")), "debe dejar URL de respaldo");
  assert.ok(ticket.slice(-3).equals(Buffer.from([0x1d, 0x56, 0x00])));
  assert.throws(() => construirBytesQrFiscal({ url: "javascript:alert(1)" }), /URL http/);
}

async function conServidor(config, fn) {
  const llamadas = [];
  const servidor = crearServidor({
    config,
    transportes: {
      red: async (args) => {
        await new Promise((resolve) => setTimeout(resolve, 20));
        llamadas.push(args);
      },
      windows: async (args) => { llamadas.push(args); },
    },
  });
  await new Promise((resolve) => servidor.listen(0, "127.0.0.1", resolve));
  const { port } = servidor.address();
  try {
    await fn({ base: `http://127.0.0.1:${port}`, llamadas });
  } finally {
    await new Promise((resolve) => servidor.close(resolve));
  }
}

await conServidor({
  puerto: 0,
  token: "token-de-prueba-bien-largo",
  modo: "red",
  red: { ip: "10.0.0.5", puerto: 9100 },
  origenesPermitidos: ["https://deploy-preview-175--chic-entremet-9107cf.netlify.app"],
}, async ({ base, llamadas }) => {
  const preflight = await fetch(base + "/imprimir", {
    method: "OPTIONS",
    headers: {
      Origin: "https://deploy-preview-175--chic-entremet-9107cf.netlify.app",
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "content-type,x-puente-token",
    },
  });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get("access-control-allow-origin"), "https://deploy-preview-175--chic-entremet-9107cf.netlify.app");

  const estado = await fetch(base + "/estado", {
    headers: { Origin: "https://deploy-preview-175--chic-entremet-9107cf.netlify.app" },
  });
  assert.equal(estado.status, 200);
  assert.equal((await estado.json()).capacidades.qrFiscalEscPos, true);

  const cuerpo = {
    operationId: "t7.ticket.print.checkout-1.qr-1.terminal-1",
    lineas: ["Agua 50 cl       1,00 EUR"],
    qrFiscal,
    cortar: true,
  };
  const respuestas = await Promise.all([
    fetch(base + "/imprimir", {
      method: "POST",
      headers: { Origin: "https://deploy-preview-175--chic-entremet-9107cf.netlify.app", "X-Puente-Token": "token-de-prueba-bien-largo", "Content-Type": "application/json" },
      body: JSON.stringify(cuerpo),
    }),
    fetch(base + "/imprimir", {
      method: "POST",
      headers: { Origin: "https://deploy-preview-175--chic-entremet-9107cf.netlify.app", "X-Puente-Token": "token-de-prueba-bien-largo", "Content-Type": "application/json" },
      body: JSON.stringify(cuerpo),
    }),
  ]);
  assert.deepEqual(respuestas.map((respuesta) => respuesta.status), [200, 200]);
  const cuerposRespuesta = await Promise.all(respuestas.map((respuesta) => respuesta.json()));
  assert.equal(cuerposRespuesta.filter((respuesta) => respuesta.duplicate === false).length, 1);
  assert.equal(cuerposRespuesta.filter((respuesta) => respuesta.duplicate === true).length, 1);
  assert.equal(llamadas.length, 1, "un reintento simultáneo con la misma operación no debe volver a enviar bytes");
  assert.ok(llamadas[0].bytes.includes(Buffer.from(qrFiscal.url, "utf8")));

  const origenMalo = await fetch(base + "/estado", { headers: { Origin: "https://sitio-no-autorizado.example" } });
  assert.equal(origenMalo.status, 403);
});

// El bundle desplegado debe conservar el vínculo entre la venta, el QR y la
// clave estable que utiliza el puente al reintentar la impresión.
const fuente = fs.readFileSync("fuente.js", "utf8");
assert.match(fuente, /const printOperationId = checkoutId/);
assert.match(fuente, /operationId: printOperationId/);
assert.match(fuente, /qrFiscal: qrFiscalActual/);

console.log("PLAN_MAESTRO_ETAPA4_QR_FISCAL_PUENTE=PASS");
