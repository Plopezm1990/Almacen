// Construye los bytes ESC/POS de un ticket y del pulso de apertura de cajón.
// ESC/POS es el protocolo que entiende la gran mayoría de impresoras
// térmicas de recibos, sea cual sea la marca. Sin probar todavía contra una
// impresora real: la tabla de caracteres usada aquí (latin1) es la más
// extendida para que salgan bien tildes y la "ñ", pero algunos modelos
// concretos pueden necesitar su propio comando de página de códigos — eso
// solo se puede ajustar con el aparato delante.

const ESC = 0x1b;
const GS = 0x1d;

export function construirBytesTicket({ lineas, cortar } = {}) {
  if (!Array.isArray(lineas)) throw new Error("lineas debe ser un array de texto");
  const partes = [];
  partes.push(Buffer.from([ESC, 0x40])); // ESC @ : inicializar impresora
  for (const linea of lineas) {
    partes.push(Buffer.from(String(linea ?? ""), "latin1"));
    partes.push(Buffer.from([0x0a]));
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
