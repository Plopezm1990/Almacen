import assert from "node:assert/strict";
import test from "node:test";

import {
  TICKET_QR_PREVIEW_CONTRACT,
  buildTicketQrPreview,
} from "../../fiscal/qr/ticket-visual.mjs";

test("el ticket acepta únicamente payloads QA HTTPS y los deja visibles para impresión", () => {
  const preview = buildTicketQrPreview({
    url: "https://www2.agenciatributaria.gob.es/wlpl/TIKE-CONT/ValidarQR?nif=A12345678",
    production: false,
    textLabel: "QR tributario:",
    modalityLabel: "VERI*FACTU",
  });

  assert.deepEqual(preview, {
    ...TICKET_QR_PREVIEW_CONTRACT,
    url: "https://www2.agenciatributaria.gob.es/wlpl/TIKE-CONT/ValidarQR?nif=A12345678",
    textLabel: "QR tributario:",
    modalityLabel: "VERI*FACTU",
  });
  assert.equal(preview.printVisible, true);
  assert.equal(preview.matrixRendered, true);
  assert.equal(preview.renderMode, "LOCAL_SVG");
});

test("el ticket no muestra payloads de producción ni URLs no HTTPS", () => {
  assert.equal(
    buildTicketQrPreview({
      url: "https://www2.agenciatributaria.gob.es/wlpl/TIKE-CONT/ValidarQR?nif=A12345678",
      production: true,
    }),
    null,
  );
  assert.equal(buildTicketQrPreview({ url: "javascript:alert(1)", production: false }), null);
  assert.equal(buildTicketQrPreview(null), null);
});
