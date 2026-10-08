import fs from 'node:fs';
import assert from 'node:assert/strict';

// ALB-PROV A03: cableado de la aplicación para el alta automática de proveedores desde la foto del albarán.
//
// La prueba de ejecución (a02) monta Albaranes y Proveedores con un «arnés» que imita a la aplicación, pero NO monta la aplicación
// completa (GestionAlmacen). Este contrato fija por texto las conexiones de la aplicación que el arnés da por supuestas; si alguien las
// rompe, el alta automática volvería a perderse en silencio (guardarAlbaran rechaza un albarán cuyo proveedor aún no está en su vista):
//   · proveedorPorId debe encontrar también los proveedores recién creados (solapado) aunque React aún no haya refrescado el estado;
//   · el solapado se limpia solo cuando el proveedor ya está en el estado y al borrar un proveedor;
//   · el permiso para crear proveedores desde un albarán es el mismo que ya tiene la función de IA (Propietario y Encargado);
//   · Albaranes recibe empresa, empresas propias (para no tomar al cliente por proveedor), permiso y las dos funciones;
//   · Proveedores recibe «marcar revisado»; la lectura por IA sigue yendo a la misma función con el mismo cuerpo.
for (const archivo of ['fuente.js', 'source-recovery/fuente-recuperado.js']) {
  const src = fs.readFileSync(archivo, 'utf8');
  const unico = (fragmento, que) => {
    const n = src.split(fragmento).length - 1;
    assert.equal(n, 1, `${archivo}: ${que} debe aparecer exactamente una vez (aparece ${n})`);
  };

  unico('const proveedoresRecientesRef = (0, import_react4.useRef)(/* @__PURE__ */ new Map());', 'el solapado de proveedores recién creados');
  unico('const proveedorPorId = (id) => proveedores.find((p22) => p22.id === id) || proveedoresRecientesRef.current.get(id);', 'proveedorPorId con solapado');
  unico('for (const p22 of proveedores) recientes.delete(p22.id);', 'la limpieza del solapado cuando el estado ya lo tiene');
  unico('const puedeAltaProveedorIA = rolNavegacionMovil === "Propietario" || rolNavegacionMovil === "Encargado";', 'el permiso de alta (Propietario o Encargado)');
  unico('proveedoresRecientes: proveedoresRecientesRef.current });', 'la lógica de proveedores recibe el solapado');
  unico('const { addProveedor, updateProveedor, deleteProveedor, addProveedorDesdeAlbaran, asignarNifProveedor, marcarProveedorRevisado } = crearLogicaProveedores(', 'la desestructuración de la lógica de proveedores');
  unico('Proveedores, { proveedores, addProveedor, updateProveedor, deleteProveedor, marcarProveedorRevisado, pedidos: pedidos2 }', 'las propiedades de Proveedores');

  const montaje = src.indexOf('tab === "albaranes" && /* @__PURE__ */ import_react4.default.createElement(\n    Albaranes,');
  assert.ok(montaje > 0, `${archivo}: no se encuentra el montaje de Albaranes`);
  const bloque = src.slice(montaje, src.indexOf('tab === "pagos"', montaje));
  for (const prop of ['empresaId: empresaDelLocalActivo?.id || null', 'empresasPropias: [...empresas, configEmpresa].filter(Boolean)', 'puedeAltaProveedorIA', 'addProveedorDesdeAlbaran', 'asignarNifProveedor', 'proveedorPorId']) {
    assert.ok(bloque.includes(prop), `${archivo}: Albaranes debe recibir ${prop}`);
  }

  // la función que lee la foto no cambia de destino ni de cuerpo (el cambio es solo del lado de la aplicación)
  unico('"https://flqercbgpgmmfaakrwkc.supabase.co/functions/v1/importar-albaran",\n        {\n          method: "POST",\n          headers: { "Content-Type": "application/json" },\n          body: JSON.stringify({ imagenes: fotosIA.map((f22) => ({ base64: f22.base64, mediaType: f22.mediaType })) })', 'la llamada a importar-albaran (dirección y cuerpo)');

  // el solapado lo borra deleteProveedor y lo rellena el alta; el resolver recibe las empresas propias
  unico('proveedoresRecientes.delete(id);', 'deleteProveedor limpia el solapado');
  unico('proveedoresRecientes.set(res.proveedor.id, res.proveedor);', 'el alta rellena el solapado');
  unico('const detectado = resolverProveedorAlbaran({ proveedores, empresaId, empresasPropias, detectado: { nombre: d2.proveedorNombre, nif: d2.proveedorCif } });', 'la detección usa nombre y NIF leídos y las empresas propias');
}

// los dos archivos llevan el mismo motor, carácter por carácter
const a = fs.readFileSync('fuente.js', 'utf8');
const b = fs.readFileSync('source-recovery/fuente-recuperado.js', 'utf8');
const corta = (s) => s.slice(s.indexOf('var FORMAS_SOCIETARIAS_ALB'), s.indexOf('function validarEmpleadoPM10('));
assert.equal(corta(a), corta(b), 'el motor y la lógica de proveedores deben ser idénticos en fuente.js y en el espejo');
console.log('A03_ALB_CABLEADO_APLICACION=PASS');
