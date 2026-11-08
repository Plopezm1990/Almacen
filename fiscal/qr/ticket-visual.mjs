/**
 * Contrato de presentación del payload QR en el ticket de QA.
 *
 * Este módulo no dibuja una matriz QR ni emite documentos fiscales. Su
 * función es impedir que el ticket muestre como fiscal un payload incompleto,
 * de producción o sin procedencia explícita del snapshot de la venta.
 */

export const TICKET_QR_PREVIEW_CONTRACT = Object.freeze({
  mode: "QA_PAYLOAD_PREVIEW",
  production: false,
  printVisible: true,
  matrixRendered: true,
  renderMode: "LOCAL_SVG",
  label: "QR tributario:",
  modalityLabel: "VERI*FACTU",
});

export function buildTicketQrPreview(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  if (payload.production !== false) return null;
  if (typeof payload.url !== "string" || !/^https:\/\//u.test(payload.url)) return null;

  return Object.freeze({
    ...TICKET_QR_PREVIEW_CONTRACT,
    url: payload.url,
    textLabel: payload.textLabel || TICKET_QR_PREVIEW_CONTRACT.label,
    modalityLabel: payload.modalityLabel || TICKET_QR_PREVIEW_CONTRACT.modalityLabel,
  });
}
