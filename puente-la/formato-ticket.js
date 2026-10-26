// Construye los bytes ESC/POS de un ticket y del pulso de apertura de cajón.
// ESC/POS es el protocolo que entiende la gran mayoría de impresoras
// térmicas de recibos, sea cual sea la marca. Sin probar todavía contra una
// impresora real: la tabla de caracteres usada aquí (latin1) es la más
// extendida para que salgan bien tildes y la "ñ", pero algunos modelos
// concretos pueden necesitar su propio comando de página de códigos — eso
// solo se puede ajustar con el aparato delante.

const ESC = 0x1b;
const GS = 0x1d;

function validarQrFiscal(qrFiscal) {
  if (qrFiscal == null) return null;
  if (typeof qrFiscal !== "object" || Array.isArray(qrFiscal)) {
    throw new Error("qrFiscal debe ser un objeto");
  }
  const url = String(qrFiscal.url ?? "").trim();
  if (!/^https?:\/\//i.test(url)) {
    throw new Error("qrFiscal.url debe ser una URL http(s)");
  }
  const datos = Buffer.from(url, "utf8");
  if (datos.length > 4096) {
    throw new Error("qrFiscal.url es demasiado larga para un ticket térmico");
  }
  return {
    ...qrFiscal,
    url,
    numero: qrFiscal.numero == null ? "" : String(qrFiscal.numero),
    fecha: qrFiscal.fecha == null ? "" : String(qrFiscal.fecha),
    importe: qrFiscal.importe == null ? "" : String(qrFiscal.importe),
    leyenda: qrFiscal.leyenda == null ? "" : String(qrFiscal.leyenda),
  };
}

// ESC/POS GS ( k: Model 2, nivel M, módulo 6. El QR lo construye la
// impresora a partir de la URL que ya validó el servidor; no se imprime una
// imagen inventada ni se vuelve a numerar el documento fiscal.
export function construirBytesQrFiscal(qrFiscal) {
  const datosQr = validarQrFiscal(qrFiscal);
  if (!datosQr) return Buffer.alloc(0);
  const datos = Buffer.from(datosQr.url, "utf8");
  const longitudAlmacen = datos.length + 3; // cn, fn y m del comando Store
  const pL = longitudAlmacen & 0xff;
  const pH = (longitudAlmacen >> 8) & 0xff;
  return Buffer.concat([
    Buffer.from([GS, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00]), // modelo 2
    Buffer.from([GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, 0x06]), // tamaño
    Buffer.from([GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, 0x31]), // corrección M
    Buffer.from([GS, 0x28, 0x6b, pL, pH, 0x31, 0x50, 0x30]),
    datos,
    Buffer.from([GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30]), // imprimir
  ]);
}

export function construirBytesTicket({ lineas, cortar, qrFiscal } = {}) {
  if (!Array.isArray(lineas)) throw new Error("lineas debe ser un array de texto");
  const partes = [];
  partes.push(Buffer.from([ESC, 0x40])); // ESC @ : inicializar impresora
  for (const linea of lineas) {
    partes.push(Buffer.from(String(linea ?? ""), "latin1"));
    partes.push(Buffer.from([0x0a]));
  }
  const datosQr = validarQrFiscal(qrFiscal);
  if (datosQr) {
    partes.push(Buffer.from("QR FISCAL\n", "latin1"));
    if (datosQr.numero) partes.push(Buffer.from("Documento: " + datosQr.numero + "\n", "utf8"));
    if (datosQr.fecha) partes.push(Buffer.from("Fecha: " + datosQr.fecha + "\n", "utf8"));
    if (datosQr.importe) partes.push(Buffer.from("Importe: " + datosQr.importe + "\n", "utf8"));
    partes.push(construirBytesQrFiscal(datosQr));
    // Texto de respaldo para impresoras que no implementen GS ( k QR. La
    // URL sigue siendo la misma devuelta por el documento fiscal QA.
    partes.push(Buffer.from("Verificación: " + datosQr.url + "\n", "utf8"));
    if (datosQr.leyenda) partes.push(Buffer.from(datosQr.leyenda + "\n", "utf8"));
  }
  partes.push(Buffer.from([0x0a, 0x0a, 0x0a])); // espacio antes del corte
  if (cortar !== false) {
    partes.push(Buffer.from([GS, 0x56, 0x00])); // GS V 0 : corte total de papel
  }
  return Buffer.concat(partes);
}

export function construirBytesAbrirCajon() {
  // ESC p 0 25 250 : pulso del conector de cajón monedero, el mismo comando
  // estándar que usan Epson y la mayoría de impresoras compatibles ESC/POS
  // (el cajón se abre a través de la propia impresora, no es un aparato
  // independiente).
  return Buffer.from([ESC, 0x70, 0x00, 0x19, 0xfa]);
}
