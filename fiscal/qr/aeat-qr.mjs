/**
 * Núcleo determinista del QR tributario AEAT.
 *
 * Este módulo solo construye y valida el contenido que deberá consumir un
 * renderizador QR. No llama a AEAT, no remite registros y no habilita emisión.
 * Las entradas deben proceder del snapshot inmutable de una factura; nunca de
 * una configuración editable después de emitir.
 */

export const AEAT_QR_ENDPOINT =
  "https://www2.agenciatributaria.gob.es/wlpl/TIKE-CONT/ValidarQR";

export const QR_RENDER_CONTRACT = Object.freeze({
  iso: "ISO/IEC 18004:2015",
  errorCorrection: "M",
  minMm: 30,
  maxMm: 40,
  quietZoneMinMm: 2,
  quietZoneRecommendedMm: 6,
  label: "QR tributario:",
  verifactuLabel: "VERI*FACTU",
  firstPageOnly: true,
});

const PRINTABLE_ASCII = /^[\x20-\x7E]*$/u;
const NIF = /^[A-Z0-9]{9}$/u;
const DATE = /^(\d{2})-(\d{2})-(\d{4})$/u;
const AMOUNT = /^(0|[1-9]\d{0,11})\.\d{2}$/u;

function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  throw error;
}

function requiredString(value, field) {
  if (typeof value !== "string" || value.length === 0) {
    fail("QR_CAMPO_REQUERIDO", `Campo fiscal requerido: ${field}`);
  }
  return value;
}

function validatePrintable(value, field, maxLength) {
  if (value.length > maxLength || !PRINTABLE_ASCII.test(value)) {
    fail("QR_VALOR_NO_ASCII", `${field} debe ser ASCII imprimible y no superar ${maxLength} caracteres`);
  }
  return value;
}

function validateDate(value) {
  const match = DATE.exec(value);
  if (!match) fail("QR_FECHA_INVALIDA", "La fecha debe tener formato DD-MM-YYYY");
  const [, day, month, year] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (
    date.getUTCFullYear() !== Number(year) ||
    date.getUTCMonth() !== Number(month) - 1 ||
    date.getUTCDate() !== Number(day)
  ) {
    fail("QR_FECHA_INVALIDA", "La fecha fiscal no es un día válido");
  }
  return value;
}

function normalizeAmount(value) {
  const text = typeof value === "number" ? value.toFixed(2) : value;
  if (typeof text !== "string" || !AMOUNT.test(text)) {
    fail(
      "QR_IMPORTE_INVALIDO",
      "El importe debe tener punto decimal y dos decimales, con hasta 12 cifras enteras",
    );
  }
  return text;
}

/**
 * Valida y devuelve los cuatro parámetros oficiales en un orden estable.
 * La función no acepta campos extra para impedir que la UI altere el contrato.
 */
export function normalizeAeatQrInput(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    fail("QR_ENTRADA_INVALIDA", "La entrada fiscal debe ser un objeto");
  }

  const allowed = new Set(["nif", "numserie", "fecha", "importe"]);
  for (const key of Object.keys(input)) {
    if (!allowed.has(key)) fail("QR_CAMPO_NO_PERMITIDO", `Campo QR no permitido: ${key}`);
  }

  const nif = requiredString(input.nif, "nif").trim().toUpperCase();
  if (!NIF.test(nif)) fail("QR_NIF_INVALIDO", "El NIF fiscal debe tener nueve caracteres alfanuméricos");

  const numserie = requiredString(input.numserie, "numserie");
  validatePrintable(numserie, "numserie", 60);
  if (numserie.trim() !== numserie) {
    fail("QR_NUMSERIE_INVALIDO", "La serie y número no pueden comenzar ni terminar con espacios");
  }

  const fecha = validateDate(requiredString(input.fecha, "fecha"));
  const importe = normalizeAmount(input.importe);
  return Object.freeze({ nif, numserie, fecha, importe });
}

function encode(value) {
  return encodeURIComponent(value);
}

/**
 * Construye la URL oficial en el orden exigido por el contrato del QR.
 * No añade idioma ni formato=json: esos valores no forman parte del QR base.
 */
export function buildAeatQrUrl(input, { endpoint = AEAT_QR_ENDPOINT } = {}) {
  const normalized = normalizeAeatQrInput(input);
  if (typeof endpoint !== "string" || !/^https:\/\//u.test(endpoint)) {
    fail("QR_ENDPOINT_INVALIDO", "El endpoint QR debe ser HTTPS");
  }
  const base = endpoint.replace(/\?[^#]*$/u, "");
  return `${base}?nif=${encode(normalized.nif)}&numserie=${encode(normalized.numserie)}&fecha=${encode(normalized.fecha)}&importe=${encode(normalized.importe)}`;
}

/**
 * Contrato para el componente de ticket/PDF. El renderizador visual posterior
 * debe respetar estos metadatos y recibir exactamente url como contenido.
 */
export function buildAeatQrPayload(input, options = {}) {
  const normalized = normalizeAeatQrInput(input);
  return Object.freeze({
    url: buildAeatQrUrl(normalized, options),
    textLabel: QR_RENDER_CONTRACT.label,
    modalityLabel: QR_RENDER_CONTRACT.verifactuLabel,
    render: QR_RENDER_CONTRACT,
    source: normalized,
    production: false,
  });
}
