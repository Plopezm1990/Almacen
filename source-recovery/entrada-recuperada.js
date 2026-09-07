// Entrada reproducible del frontend recuperado.
//
// El build histórico cargaba la barrera de seguridad indirectamente mediante:
// fuente.js -> chunk-CZ7CSFO4.js -> edge-auth-patch.js.
// Aquí la dependencia queda explícita para que no vuelva a perderse al recompilar.
import "../edge-auth-patch.js";
import "./fuente-recuperado.js";
