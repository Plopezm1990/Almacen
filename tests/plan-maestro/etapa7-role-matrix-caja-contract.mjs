import assert from "node:assert/strict";
import fs from "node:fs";

const fuente = fs.readFileSync("fuente.js", "utf8");

assert.match(
  fuente,
  /function VentaRapida\([\s\S]*?rolPerfil = "" \}\) \{/,
  "VentaRapida debe aceptar el rol efectivo para filtrar Caja"
);

const inicioVenta = fuente.indexOf("function VentaRapida(");
const inicioCaja = fuente.indexOf("function renderMovimientosCajaTpv()", inicioVenta);
const finCaja = fuente.indexOf("function renderValeRegaloF4()", inicioCaja);
assert.ok(inicioVenta >= 0 && inicioCaja > inicioVenta && finCaja > inicioCaja, "deben existir los bloques de TPV y Caja");

const venta = fuente.slice(inicioVenta, finCaja);
assert.match(venta, /rolPerfilRemotoTpv/, "el TPV debe resolver el rol de la sesión cloud si el padre no lo pasa");
assert.match(
  venta,
  /const puedeOperarCajaTpv = \["Propietario", "Encargado", "Cajero\/a"\]\.includes\(rolPerfilEfectivoTpv\)/,
  "solo Propietario, Encargado y Cajero/a pueden operar Caja en el TPV"
);
assert.match(
  venta.slice(venta.indexOf("async function abrirMovimientosCajaDesdeTpv()"), inicioCaja - inicioVenta),
  /if \(!puedeOperarCajaTpv\) return;/,
  "la acción de abrir Caja debe tener una defensa de rol antes de llamar al servidor"
);
assert.match(
  fuente.slice(inicioCaja, finCaja),
  /if \(!puedeOperarCajaTpv\) return null;/,
  "Camarero/a no debe recibir el panel interno de Caja"
);

console.log("ETAPA7_ROLE_MATRIX_CAJA_CONTRACT_PASS");
