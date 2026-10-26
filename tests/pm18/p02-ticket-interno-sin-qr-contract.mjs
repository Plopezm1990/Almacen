import fs from 'node:fs';
import assert from 'node:assert/strict';

// PM18 P02: una venta ordinaria siempre produce un ticket interno. El ticket no
// puede transportar ni mostrar un QR fiscal, aunque un origen legado lo incluya
// accidentalmente en el objeto de venta.

const fuentes = [
  'fuente.js',
  'source-recovery/fuente-recuperado.js'
];

for (const ruta of fuentes) {
  const src = fs.readFileSync(ruta, 'utf8');
  const ini = src.indexOf('function renderTicketVenta() {');
  assert.ok(ini >= 0, `${ruta}: renderTicketVenta no encontrada`);
  const fin = src.indexOf('function ', ini + 10);
  assert.ok(fin > ini, `${ruta}: no se pudo acotar renderTicketVenta`);
  const bloque = src.slice(ini, fin);

  // Barrera de datos: los tickets sin número fiscal descartan cualquier nombre
  // de campo QR antes de entrar en el JSX del ticket.
  assert.match(bloque, /const v22 = ticketVenta\.numeroFiscal \? ticketVenta : \{/,
    `${ruta}: falta la separación entre ticket fiscal y ticket interno`);
  for (const campo of ['qr', 'qrCode', 'codigoQr', 'codigoQR', 'fiscalQr', 'verifactuQr', 'codigoVerificacion']) {
    assert.match(bloque, new RegExp(`\\b${campo}: null\\b`),
      `${ruta}: el campo ${campo} no está neutralizado para tickets internos`);
  }

  // No hay componente ni etiqueta de QR en la salida visual del ticket.
  assert.doesNotMatch(bloque, /QrCode|QRCode|qr-code/,
    `${ruta}: el ticket no debe renderizar un componente QR`);
  assert.doesNotMatch(bloque, /v22\.(?:qr|qrCode|codigoQr|codigoQR|fiscalQr|verifactuQr|codigoVerificacion)\b/,
    `${ruta}: el ticket no debe pintar un payload QR`);

  // Identidad visible: ticket interno inequívoco y factura simplificada solo
  // bajo la condición fiscal ya existente.
  assert.match(bloque, /tieneNumeroFiscal && estadoNifEmpresa === "sin_verificar" \? "FACTURA SIMPLIFICADA" : "TICKET \/ RECIBO INTERNO"/,
    `${ruta}: clasificación visual del documento incorrecta`);
  assert.match(bloque, /Documento interno del TPV.*pendiente de numeraci/,
    `${ruta}: falta la leyenda de documento interno`);
}

console.log('PM18 P02 — ticket interno sin QR fiscal: contrato OK');
