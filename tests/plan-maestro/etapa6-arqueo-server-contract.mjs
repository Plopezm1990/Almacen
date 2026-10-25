import fs from "node:fs";
import assert from "node:assert/strict";

for (const ruta of ["fuente.js", "source-recovery/fuente-recuperado.js"]) {
  const fuente = fs.readFileSync(ruta, "utf8");
  const esperado = [
    "async function leerEstadoCajaServerPM08",
    ".from(\"caja_sesiones\")",
    ".from(\"caja_cierres\")",
    "abc_previsualizar_arqueo_caja",
    "estadoCajaServerPM08",
    "estadoCajaServer: estadoCajaServerPM08",
    "const servidorVigente = estadoCajaServer?.fuente === \"SERVER\"",
    "const efectivoEsperado = servidorVigente ? redondearDineroPM08(Number(estadoCajaServer.expectedAmount)) : efectivoEsperadoLocal",
    "Desglose server-side: fondo €"
  ];
  for (const fragmento of esperado) {
    assert.ok(fuente.includes(fragmento), ruta + ": falta " + fragmento);
  }
}

console.log("ETAPA6_ARQUEO_SERVER_CONTRACT=PASS");
