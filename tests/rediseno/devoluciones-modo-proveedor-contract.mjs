// Contrato: Devoluciones no se queda "pegada" en modo proveedor.
//
// Contexto
// --------
// 25/11/2026: al preparar la navegación por pestañas de Órbita se vio un
// fallo que ya existía en todos los diseños. «Devoluciones a proveedor»
// entra en Devoluciones sumando 1 a un contador (saltoDevolucionProveedor)
// que la pantalla lee al montarse: si es distinto de 0, abre en modo
// proveedor. El contador nunca volvía a 0, así que, tras usar ese atajo una
// vez, cualquier entrada posterior a Devoluciones (por ejemplo «Devoluciones
// de clientes») abría en modo proveedor. El usuario pidió arreglarlo.
//
// Qué fija este contrato
// ----------------------
// Que al salir de Devoluciones el contador vuelve a 0, que eso basta porque
// la pantalla se desmonta al salir (solo se pinta con tab === "devoluciones")
// y que la entrada por «Devoluciones a proveedor» sigue abriendo en modo
// proveedor. Se comprueba en las dos fuentes con paridad.

import fs from 'node:fs';
import assert from 'node:assert/strict';

for (const [nombre, ruta] of [
  ['fuente.js', 'fuente.js'],
  ['source-recovery/fuente-recuperado.js', 'source-recovery/fuente-recuperado.js'],
]) {
  const texto = fs.readFileSync(ruta, 'utf8');

  // 1. Al salir de Devoluciones, el contador vuelve a 0.
  const reinicio = texto.match(/\(0, import_react4\.useEffect\)\(\(\) => \{\n    if \(tab !== "devoluciones"\) setSaltoDevolucionProveedor\(0\);\n  \}, \[tab\]\);/g) || [];
  assert.equal(reinicio.length, 1, `${nombre}: debe haber exactamente un efecto que ponga a 0 el salto a proveedor al salir de Devoluciones`);

  // 2. El reinicio basta porque la pantalla se desmonta al salir: solo se
  //    pinta cuando tab === "devoluciones" y recibe el contador por prop.
  assert.match(texto, /tab === "devoluciones" && \/\* @__PURE__ \*\/ import_react4\.default\.createElement\(\n    Devoluciones,\n    \{[^\n]*saltoProveedor: saltoDevolucionProveedor,/,
    `${nombre}: Devoluciones debe montarse solo en su pestaña y recibir el contador`);

  // 3. La pantalla abre en modo clientes y solo pasa a proveedor si el
  //    contador es distinto de 0.
  assert.match(texto, /const \[vista, setVista\] = import_react4\.default\.useState\("cliente"\);\n  \(0, import_react4\.useEffect\)\(\(\) => \{\n    if \(saltoProveedor\) setVista\("proveedor"\);\n  \}, \[saltoProveedor\]\);/,
    `${nombre}: Devoluciones debe abrir en modo clientes salvo que llegue el salto a proveedor`);

  // 4. La entrada por «Devoluciones a proveedor» sigue funcionando igual:
  //    cambia de pantalla con la navegación protegida y suma 1 al contador.
  assert.match(texto, /const irADevolucionProveedor = \(\) => \{\n    if \(!cambiarTabPM15\("devoluciones"\)\) return false;\n    setSaltoDevolucionProveedor\(\(n\) => n \+ 1\);/,
    `${nombre}: «Devoluciones a proveedor» debe seguir abriendo la pantalla en modo proveedor`);
}

console.log('REDISENO_DEVOLUCIONES_MODO_PROVEEDOR=OK');
