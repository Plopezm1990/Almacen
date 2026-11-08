import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

// ALB-PROV A01: alta automática del proveedor a partir de la foto del albarán (motor puro + lógica).
//
// Pedro pidió (8/10/2026): «que el programa registre el proveedor con foto IA cuando le doy entrada a un albarán,
// que registre ese proveedor por primera vez si nunca se ha registrado». Hasta ahora había que elegir el proveedor a
// mano ANTES de leer la foto, y la IA ya devolvía proveedorNombre/proveedorCif pero la aplicación los ignoraba.
//
// Este contrato prueba, sin interfaz, las piezas que deciden y ejecutan el alta:
//   · normalización de nombres y NIF/CIF (resolverProveedorAlbaran y ayudantes puros);
//   · la decisión: existente (por NIF o por nombre) / parecido (hay que preguntar) / nuevo / sin datos / es la propia empresa;
//   · que NUNCA se fusiona ni se duplica en silencio: lo dudoso se pregunta;
//   · el alta (addProveedorDesdeAlbaran) con marca «creado por IA / pendiente de revisar», auditoría y sin duplicar si se
//     repite en el mismo instante (el estado de React aún no se ha actualizado → solapado de recién creados);
//   · validarProveedorPM10 acepta el campo nif sin cambiar el comportamiento de los proveedores que no lo traen.

const src = fs.readFileSync('fuente.js', 'utf8');
function trozo(desde, hasta) {
  const i = src.indexOf(desde);
  assert.ok(i >= 0, `no se encontró ${desde}`);
  const j = src.indexOf(hasta, i);
  assert.ok(j > i, `no se pudo acotar el bloque que empieza en ${desde}`);
  return src.slice(i, j);
}

let contadorUid = 0;
const auditoria = [];
const ctx = { console, uid: () => `P${++contadorUid}`, todayISO: () => '2026-10-08' };
vm.createContext(ctx);
vm.runInContext(trozo('function tipoIdentificadorFiscalPM18(', 'function FichaEmpresaBasica('), ctx);
vm.runInContext(trozo('function errorValidacionPM10(', 'function validarContextoEscrituraPM10('), ctx);
vm.runInContext(trozo('var FORMAS_SOCIETARIAS_ALB', 'function validarEmpleadoPM10('), ctx);

const NIF_VALIDO = 'B12345609';
const NIF_VALIDO_2 = 'A58818501';
const NIF_MALO = 'B12345608';
assert.equal(ctx.validarIdentificadorFiscalEspanaPM18(NIF_VALIDO), true, 'el NIF de prueba debe ser válido');
assert.equal(ctx.validarIdentificadorFiscalEspanaPM18(NIF_VALIDO_2), true);
assert.equal(ctx.validarIdentificadorFiscalEspanaPM18(NIF_MALO), false);

// ---- normalizarNifProveedorAlb / estadoNifProveedorAlb ----
{
  assert.equal(ctx.normalizarNifProveedorAlb(' b-12.345.609 '), 'B12345609');
  assert.equal(ctx.normalizarNifProveedorAlb('ES-B1234 5609'), 'B12345609', 'el prefijo de país ES se descarta');
  assert.equal(ctx.normalizarNifProveedorAlb('CIF: B12345609'), 'B12345609', 'el rótulo CIF se descarta');
  assert.equal(ctx.normalizarNifProveedorAlb(null), '');
  assert.equal(ctx.normalizarNifProveedorAlb(undefined), '');
  assert.equal(ctx.estadoNifProveedorAlb(NIF_VALIDO), 'valido');
  assert.equal(ctx.estadoNifProveedorAlb(NIF_MALO), 'invalido');
  assert.equal(ctx.estadoNifProveedorAlb('PT501234567'), 'formato_desconocido');
  assert.equal(ctx.estadoNifProveedorAlb(''), 'ausente');
  console.log('A01_ALB_NIF_NORMALIZA_Y_CLASIFICA=PASS');
}

// ---- comparación de nombres ----
{
  const nivel = (a, b) => ctx.compararNombresProveedorAlb(a, b).nivel;
  assert.equal(nivel('DISTRIBUCIONES LOPEZ S.L.', 'Distribuciones López, SL'), 'igual', 'mayúsculas, tildes y forma societaria no cuentan');
  assert.equal(nivel('Pérez & Hijos, C.B.', 'PEREZ Y HIJOS'), 'igual', '& = y; comunidad de bienes no cuenta');
  assert.equal(nivel('Coca-Cola', 'COCA COLA'), 'igual');
  assert.equal(nivel('Coca Cola', 'COCACOLA'), 'igual', 'con o sin espacios');
  assert.equal(nivel('Frutas del Valle S.A.', 'Frutas Valle'), 'igual', 'las palabras vacías (de, del, la) no cuentan');
  assert.equal(nivel('Panadería López', 'Panadería Lopes'), 'parecido', 'una errata de OCR se pregunta, no se fusiona');
  assert.equal(nivel('Coca-Cola Europacific Partners Iberia S.L.U.', 'Coca Cola'), 'parecido');
  assert.equal(nivel('MAKRO', 'Makro Autoservicio Mayorista S.A.'), 'parecido');
  assert.equal(nivel('Distribuciones Norte', 'Distribuciones Sur'), 'ninguno', 'una palabra genérica compartida no basta');
  assert.equal(nivel('BEBIDAS', 'Bebidas Gómez Hermanos'), 'ninguno', 'una sola palabra genérica contenida en otro nombre no basta');
  assert.equal(nivel('Frutas García', 'Hijos de García'), 'ninguno');
  assert.equal(nivel('', 'Algo'), 'ninguno');
  assert.equal(nivel('S.L.', 'S.L.'), 'ninguno', 'solo la forma societaria no es un nombre');
  console.log('A01_ALB_NOMBRES_COMPARAN=PASS');
}

// ---- nombre con el que se da de alta ----
{
  const alta = ctx.nombreProveedorParaAltaAlb;
  assert.equal(alta('DISTRIBUCIONES LOPEZ S.L.'), 'Distribuciones Lopez S.L.', 'el rótulo en mayúsculas se pasa a título y la forma societaria se respeta');
  assert.equal(alta('Distribuidora del Norte S.A.'), 'Distribuidora del Norte S.A.', 'un nombre que ya tiene minúsculas no se toca');
  assert.equal(alta('COCA-COLA EUROPACIFIC PARTNERS IBERIA S.L.U.'), 'Coca-Cola Europacific Partners Iberia S.L.U.');
  assert.equal(alta('  JB   SUMINISTROS Y SERVICIOS SL '), 'JB Suministros y Servicios SL');
  assert.equal(alta('3M ESPAÑA SA'), '3M España SA');
  assert.equal(alta(''), '');
  assert.equal(alta(null), '');
  console.log('A01_ALB_NOMBRE_DE_ALTA=PASS');
}

// ---- resolverProveedorAlbaran ----
const EMP = 'E1';
const prov = (id, nombre, extra = {}) => ({ id, nombre, empresaId: EMP, ...extra });
const base = [
  prov('p1', 'Distribuciones López S.L.', { nif: NIF_VALIDO }),
  prov('p2', 'Panadería Pepe'),
  prov('p3', 'Makro Autoservicio Mayorista S.A.', { cif: NIF_VALIDO_2 }),
  prov('p4', 'Frutas del Valle', { empresaId: 'OTRA' })
];
const resolver = (detectado, extra = {}) => ctx.resolverProveedorAlbaran({ proveedores: base, empresaId: EMP, detectado, ...extra });
{
  const copia = JSON.stringify(base);
  // existente por NIF aunque el nombre sea otro
  let r = resolver({ nombre: 'DISTRIB. LOPEZ HERMANOS', nif: 'b-12345609' });
  assert.equal(r.estado, 'existente'); assert.equal(r.motivo, 'nif'); assert.equal(r.proveedor.id, 'p1');
  // existente por NIF guardado en el campo antiguo cif
  r = resolver({ nombre: 'Otro nombre', nif: NIF_VALIDO_2 });
  assert.equal(r.estado, 'existente'); assert.equal(r.proveedor.id, 'p3');
  // existente por nombre exacto (sin NIF en la ficha → se propone guardarlo)
  r = resolver({ nombre: 'PANADERIA PEPE, S.L.', nif: 'A58818501' });
  assert.equal(r.estado, 'existente'); assert.equal(r.motivo, 'nif'); assert.equal(r.proveedor.id, 'p3', 'un NIF válido manda sobre el nombre');
  r = resolver({ nombre: 'PANADERIA PEPE, S.L.', nif: 'B12345617' });
  assert.equal(r.estado, 'existente'); assert.equal(r.motivo, 'nombre'); assert.equal(r.proveedor.id, 'p2');
  assert.equal(r.proponerNif, true, 'ficha sin NIF y NIF leído válido y libre → se propone guardarlo');
  r = resolver({ nombre: 'PANADERIA PEPE, S.L.', nif: '' });
  assert.equal(r.estado, 'existente'); assert.equal(r.proponerNif, false);
  // mismo nombre pero NIF distinto → se pregunta
  r = resolver({ nombre: 'Distribuciones López', nif: 'B12345617' });
  assert.equal(r.estado, 'parecido'); assert.equal(r.motivo, 'nif_distinto'); assert.equal(r.candidatos[0].id, 'p1');
  // nombre parecido → se pregunta con candidatos ordenados
  r = resolver({ nombre: 'Panaderia Pepa', nif: '' });
  assert.equal(r.estado, 'parecido'); assert.equal(r.motivo, 'nombre_parecido'); assert.equal(r.candidatos[0].id, 'p2');
  // nuevo
  r = resolver({ nombre: 'QUESOS LA ABUELA S.L.', nif: 'B12345617' });
  assert.equal(r.estado, 'nuevo'); assert.equal(r.datos.nombre, 'Quesos la Abuela S.L.'); assert.equal(r.datos.nif, 'B12345617');
  // el proveedor de OTRA empresa no cuenta: no se puede usar en un albarán de esta empresa
  r = resolver({ nombre: 'Frutas del Valle', nif: '' });
  assert.equal(r.estado, 'nuevo', 'un proveedor de otra empresa no se reutiliza');
  // NIF mal leído: se conserva para avisar, pero no se usa ni se guardará
  r = resolver({ nombre: 'Quesos La Abuela', nif: NIF_MALO });
  assert.equal(r.estado, 'nuevo'); assert.equal(r.datos.nif, ''); assert.equal(r.datos.nifLeido, NIF_MALO); assert.equal(r.datos.nifEstado, 'invalido');
  // un NIF inválido no sirve para emparejar con un proveedor que tiene ese mismo texto
  const conMalo = [...base, prov('p9', 'Con NIF malo', { nif: NIF_MALO })];
  r = ctx.resolverProveedorAlbaran({ proveedores: conMalo, empresaId: EMP, detectado: { nombre: 'Otro distinto total', nif: NIF_MALO } });
  assert.equal(r.estado, 'nuevo');
  // sin datos
  assert.equal(resolver({ nombre: '', nif: '' }).estado, 'sin_datos');
  assert.equal(resolver({ nombre: null, nif: undefined }).estado, 'sin_datos');
  assert.equal(resolver({ nombre: 'S.L.', nif: '' }).estado, 'sin_datos');
  assert.equal(resolver({}).estado, 'sin_datos');
  assert.equal(ctx.resolverProveedorAlbaran().estado, 'sin_datos');
  // la propia empresa (el cliente del albarán) nunca es el proveedor
  const propias = [{ id: EMP, razonSocial: 'Chocoloyos Hostelería S.L.', marca: 'Chocoloyos', nif: NIF_VALIDO_2 }];
  assert.equal(resolver({ nombre: 'Lo que sea', nif: NIF_VALIDO_2 }, { empresasPropias: propias }).estado, 'es_propio');
  assert.equal(resolver({ nombre: 'CHOCOLOYOS HOSTELERIA SL', nif: '' }, { empresasPropias: propias }).estado, 'es_propio');
  assert.equal(resolver({ nombre: 'Chocoloyos', nif: '' }, { empresasPropias: propias }).estado, 'es_propio');
  assert.equal(resolver({ nombre: 'Chocolates Valor', nif: '' }, { empresasPropias: propias }).estado, 'nuevo', 'un nombre solo parecido al propio no se bloquea');
  // dos fichas con el mismo NIF o el mismo nombre ya existentes → se pregunta
  const dup = [prov('d1', 'Quesos Uno', { nif: NIF_VALIDO }), prov('d2', 'Quesos Dos', { nif: NIF_VALIDO })];
  r = ctx.resolverProveedorAlbaran({ proveedores: dup, empresaId: EMP, detectado: { nombre: 'Quesos', nif: NIF_VALIDO } });
  assert.equal(r.estado, 'parecido'); assert.equal(r.motivo, 'nif_repetido'); assert.equal(r.candidatos.length, 2);
  const dupN = [prov('n1', 'Aceites Sur'), prov('n2', 'Aceites SUR S.L.')];
  r = ctx.resolverProveedorAlbaran({ proveedores: dupN, empresaId: EMP, detectado: { nombre: 'Aceites Sur', nif: '' } });
  assert.equal(r.estado, 'parecido'); assert.equal(r.motivo, 'nombre_repetido');
  // sin empresa activa no se filtra por empresa (la creación sí exigirá empresa)
  r = ctx.resolverProveedorAlbaran({ proveedores: base, detectado: { nombre: 'Frutas del Valle', nif: '' } });
  assert.equal(r.estado, 'existente');
  assert.equal(JSON.stringify(base), copia, 'el motor no debe modificar sus entradas');
  console.log('A01_ALB_RESUELVE_EXISTENTE_PARECIDO_NUEVO=PASS');
}

// ---- validarProveedorPM10 con nif ----
{
  const v = ctx.validarProveedorPM10;
  let r = v({ nombre: 'Sin nif', email: '' });
  assert.equal(r.ok, true); assert.equal('nif' in r.datos, false, 'un proveedor sin campo nif queda exactamente como antes');
  r = v({ nombre: 'Con nif', nif: ' b-12345609 ' });
  assert.equal(r.ok, true); assert.equal(r.datos.nif, 'B12345609');
  r = v({ nombre: 'Nif vacío', nif: '' });
  assert.equal(r.ok, true); assert.equal(r.datos.nif, '');
  r = v({ nombre: 'Nif malo', nif: NIF_MALO });
  assert.equal(r.ok, false); assert.equal(r.campo, 'nif');
  r = v({ nombre: 'Nif extranjero', nif: 'PT501234567' });
  assert.equal(r.ok, true, 'un formato no español no se rechaza (solo se rechaza el que parece español y tiene mal el control)');
  console.log('A01_ALB_VALIDAR_PROVEEDOR_NIF=PASS');
}

// ---- crearLogicaProveedores: alta automática ----
function entorno({ proveedores = [], empresaId = EMP, recientes = new Map() } = {}) {
  const estado = { proveedores: proveedores.map((p) => ({ ...p })) };
  const registro = [];
  const setProveedores = (f) => { estado.proveedores = typeof f === 'function' ? f(estado.proveedores) : f; };
  const logica = () => ctx.crearLogicaProveedores({
    proveedores: estado.proveedores, setProveedores, empresaId, proveedoresRecientes: recientes,
    registrarAuditoria: (accion, detalle) => registro.push([accion, detalle])
  });
  return { estado, registro, recientes, logica };
}
{
  const e = entorno();
  // addProveedor sigue igual
  let r = e.logica().addProveedor({ nombre: 'Manual', email: '' });
  assert.equal(r.ok, true); assert.equal(r.proveedor.empresaId, EMP); assert.equal('pendienteRevision' in r.proveedor, false);

  // alta automática
  r = e.logica().addProveedorDesdeAlbaran({ nombre: 'QUESOS LA ABUELA S.L.', nif: 'b-12345617' });
  assert.equal(r.ok, true); assert.equal(r.reutilizado, false);
  assert.equal(r.proveedor.nombre, 'Quesos la Abuela S.L.');
  assert.equal(r.proveedor.nif, 'B12345617');
  assert.equal(r.proveedor.empresaId, EMP);
  assert.equal(r.proveedor.creadoPorIA, true);
  assert.equal(r.proveedor.pendienteRevision, true);
  assert.equal(r.proveedor.altaEl, '2026-10-08');
  assert.ok(Array.isArray(r.proveedor.diasReparto) && r.proveedor.diasReparto.length === 0);
  assert.equal(e.estado.proveedores.length, 2);
  assert.ok(e.recientes.has(r.proveedor.id), 'queda en el solapado de recién creados (el estado de React aún no se ha actualizado)');
  assert.equal(e.registro.at(-1)[0], 'Alta automática de proveedor (foto del albarán)');

  // misma petición en el mismo instante (con la lógica creada ANTES de que React refresque): no duplica
  const logicaVieja = ctx.crearLogicaProveedores({ proveedores: [], setProveedores: (f) => { e.estado.proveedores = f(e.estado.proveedores); }, empresaId: EMP, proveedoresRecientes: e.recientes, registrarAuditoria() {} });
  const antes = e.estado.proveedores.length;
  const r2 = logicaVieja.addProveedorDesdeAlbaran({ nombre: 'Quesos La Abuela', nif: 'B12345617' });
  assert.equal(r2.ok, true); assert.equal(r2.reutilizado, true); assert.equal(r2.proveedor.id, r.proveedor.id);
  assert.equal(e.estado.proveedores.length, antes, 'no se crea un segundo proveedor');

  // NIF inválido: se crea sin NIF
  const e2 = entorno();
  const r3 = e2.logica().addProveedorDesdeAlbaran({ nombre: 'Sin nif bueno', nif: NIF_MALO });
  assert.equal(r3.ok, true); assert.equal(r3.proveedor.nif, '');

  // sin empresa o sin nombre
  assert.equal(entorno({ empresaId: null }).logica().addProveedorDesdeAlbaran({ nombre: 'X Y' }).ok, false);
  assert.equal(entorno().logica().addProveedorDesdeAlbaran({ nombre: '  ' }).ok, false);
  assert.equal(entorno().logica().addProveedorDesdeAlbaran(null).ok, false);

  // "No, es nuevo" cuando se parece a uno existente: se crea igualmente (lo decidió la persona)
  const e3 = entorno({ proveedores: [prov('x1', 'Panadería Pepe')] });
  const r4 = e3.logica().addProveedorDesdeAlbaran({ nombre: 'Panaderia Pepa', nif: '' });
  assert.equal(r4.ok, true); assert.equal(r4.reutilizado, false); assert.equal(e3.estado.proveedores.length, 2);

  // borrar un proveedor lo saca también del solapado
  const l = e.logica();
  l.deleteProveedor(r.proveedor.id);
  assert.equal(e.recientes.has(r.proveedor.id), false);
  console.log('A01_ALB_ALTA_AUTOMATICA=PASS');
}

// ---- el NIF es único por empresa (altas y ediciones) ----
{
  const e = entorno({ proveedores: [prov('u1', 'Uno', { nif: NIF_VALIDO }), prov('u2', 'Dos'), prov('u3', 'Otra empresa', { empresaId: 'OTRA', nif: NIF_VALIDO_2 })] });
  let r = e.logica().addProveedor({ nombre: 'Tres', nif: NIF_VALIDO });
  assert.equal(r.ok, false); assert.equal(r.campo, 'nif'); assert.match(r.error, /Ya tienes un proveedor con ese NIF\/CIF: Uno/);
  r = e.logica().addProveedor({ nombre: 'Tres', nif: NIF_VALIDO_2 });
  assert.equal(r.ok, true, 'el NIF de un proveedor de otra empresa no cuenta');
  r = e.logica().updateProveedor('u2', { nombre: 'Dos', nif: NIF_VALIDO });
  assert.equal(r.ok, false); assert.equal(r.campo, 'nif');
  r = e.logica().updateProveedor('u1', { nombre: 'Uno bis', nif: NIF_VALIDO });
  assert.equal(r.ok, true, 'editar un proveedor conservando su propio NIF es válido');
  // dos fichas antiguas con el mismo NIF y la persona dice «No, es nuevo»: se crea sin NIF (el NIF ya es de otros)
  const dup = entorno({ proveedores: [prov('d1', 'Quesos Uno', { nif: NIF_VALIDO }), prov('d2', 'Quesos Dos', { cif: NIF_VALIDO })] });
  r = dup.logica().addProveedorDesdeAlbaran({ nombre: 'Quesos Tres', nif: NIF_VALIDO });
  assert.equal(r.ok, true); assert.equal(r.reutilizado, false); assert.equal(r.proveedor.nif, '');
  console.log('A01_ALB_NIF_UNICO_POR_EMPRESA=PASS');
}

// ---- datos de contacto leídos de la foto (ALB-PROV-2) ----
{
  const limpiar = ctx.limpiarDatosContactoProveedorAlb;
  // el albarán de Arboliva tal como lo leería la IA
  let c = limpiar({ direccion: 'Polígono Pinares Llanos, C/ Electricistas, 7, 28670 Villaviciosa de Odón (Madrid)', telefono: ' 91 616 57 45 ', email: 'ARBOLIVA@arboliva.com', web: 'WWW.arboliva.es', condiciones: '60 DIAS', diasPago: null });
  assert.equal(c.direccion, 'Polígono Pinares Llanos, C/ Electricistas, 7, 28670 Villaviciosa de Odón (Madrid)');
  assert.equal(c.telefono, '91 616 57 45');
  assert.equal(c.email, 'arboliva@arboliva.com');
  assert.equal(c.web, 'www.arboliva.es');
  assert.equal(c.condiciones, '60 días', 'una condición impresa en mayúsculas pasa a frase y recupera la tilde de días');
  assert.equal(c.diasPago, 60, 'los días de pago se deducen de «60 DIAS» si la IA no los dio aparte');
  // basura: se descarta en vez de guardarla
  c = limpiar({ direccion: 'x', telefono: '12', email: 'no es un correo', web: 'sin punto', condiciones: '', diasPago: 0 });
  assert.equal(Object.values(c).map(String).join('|'), '|||||', 'datos dudosos no se guardan');
  c = limpiar({ web: 'https://Foo.com/tienda ', telefono: 'Tel. +34 600 000 000', condiciones: 'Transferencia 30 DIAS F/F', diasPago: '45' });
  assert.equal(c.web, 'foo.com/tienda'); assert.equal(c.telefono, '+34 600 000 000'); assert.equal(c.condiciones, 'Transferencia 30 días F/F'); assert.equal(c.diasPago, 45, 'si la IA da los días, mandan');
  c = limpiar({ diasPago: 400, condiciones: 'Contado' });
  assert.equal(c.diasPago, '');
  assert.equal(limpiar(undefined).email, ''); assert.equal(limpiar(null).diasPago, '');
  // idempotente: pasar dos veces no cambia nada
  const una = limpiar({ condiciones: '60 DIAS', email: 'A@B.COM', web: 'WWW.X.ES' });
  assert.equal(JSON.stringify(limpiar(una)), JSON.stringify(una));

  // qué le falta a una ficha: solo lo vacío, nunca se pisa lo escrito
  const datos = { nif: 'A78540960', direccion: 'C/ Electricistas 7, Madrid', telefono: '91 616 57 45', email: 'arboliva@arboliva.com', web: 'www.arboliva.es', condiciones: '60 días', diasPago: 60 };
  assert.equal(Object.keys(ctx.camposQueFaltanEnFichaAlb(prov('f1', 'Arboliva SA'), datos)).sort().join(','), 'condiciones,diasPago,direccion,email,nif,telefono,web');
  assert.equal(Object.keys(ctx.camposQueFaltanEnFichaAlb(prov('f2', 'Arboliva SA', { telefono: '600', diasPago: 30, cif: NIF_VALIDO }), datos)).sort().join(','), 'condiciones,direccion,email,web', 'el teléfono, los días de pago y el NIF (aunque esté en el campo antiguo cif) no se pisan');
  assert.equal(Object.keys(ctx.camposQueFaltanEnFichaAlb(prov('f3', 'Arboliva SA'), { nif: '', direccion: '', diasPago: '' })).length, 0);

  // el resolver arrastra los datos leídos y descarta el NIF del cliente
  const r = ctx.resolverProveedorAlbaran({ proveedores: [], empresaId: EMP, detectado: { nombre: 'ARBOLIVA SA', nif: 'A-78540960', email: 'ARBOLIVA@arboliva.com', condiciones: '60 DIAS', clienteNif: 'B87342077' } });
  assert.equal(r.estado, 'nuevo'); assert.equal(r.datos.nif, 'A78540960'); assert.equal(r.datos.email, 'arboliva@arboliva.com'); assert.equal(r.datos.diasPago, 60);
  const rc = ctx.resolverProveedorAlbaran({ proveedores: [], empresaId: EMP, detectado: { nombre: 'ARBOLIVA SA', nif: 'B87342077', clienteNif: 'b-87342077' } });
  assert.equal(rc.estado, 'nuevo'); assert.equal(rc.datos.nif, '', 'el NIF del cliente no es el del proveedor'); assert.equal(rc.datos.nifEstado, 'del_cliente'); assert.equal(rc.datos.nifLeido, 'B87342077');

  // alta con datos: el proveedor nuevo nace con toda su ficha
  const e = entorno();
  const alta = e.logica().addProveedorDesdeAlbaran({ nombre: 'Arboliva SA', nif: 'A78540960', ...limpiar({ direccion: 'C/ Electricistas 7, Madrid', telefono: '91 616 57 45', email: 'arboliva@arboliva.com', web: 'www.arboliva.es', condiciones: '60 DIAS' }) });
  assert.equal(alta.ok, true);
  assert.equal(alta.proveedor.nif, 'A78540960'); assert.equal(alta.proveedor.direccion, 'C/ Electricistas 7, Madrid'); assert.equal(alta.proveedor.telefono, '91 616 57 45');
  assert.equal(alta.proveedor.email, 'arboliva@arboliva.com'); assert.equal(alta.proveedor.web, 'www.arboliva.es'); assert.equal(alta.proveedor.condiciones, '60 días'); assert.equal(alta.proveedor.diasPago, 60);
  // un correo basura no impide el alta
  const e2 = entorno();
  const alta2 = e2.logica().addProveedorDesdeAlbaran({ nombre: 'Con correo basura', email: 'esto no es un correo', telefono: '1' });
  assert.equal(alta2.ok, true); assert.equal(alta2.proveedor.email, ''); assert.equal(alta2.proveedor.telefono, '');

  // completar la ficha de un proveedor que ya existe (el caso de Arboliva, dado de alta solo con el nombre)
  const ec = entorno({ proveedores: [prov('a1', 'Arboliva SA', { pendienteRevision: true, creadoPorIA: true }), prov('a2', 'Otro', { nif: NIF_VALIDO, telefono: '600' })] });
  let rr = ec.logica().completarProveedorConDatosAlb('a1', { nif: 'A78540960', direccion: 'C/ Electricistas 7, Madrid', telefono: '91 616 57 45', email: 'arboliva@arboliva.com', web: 'www.arboliva.es', condiciones: '60 DIAS' });
  assert.equal(rr.ok, true); assert.equal([...rr.aplicados].sort().join(','), 'condiciones,diasPago,direccion,email,nif,telefono,web');
  const f = ec.estado.proveedores.find((x) => x.id === 'a1');
  assert.equal(f.nif, 'A78540960'); assert.equal(f.diasPago, 60); assert.equal(f.condiciones, '60 días'); assert.equal(f.pendienteRevision, true, 'completar datos no la da por revisada: eso lo decide la persona');
  assert.equal(ec.registro.at(-1)[0], 'Completar ficha de proveedor con los datos de la foto del albarán');
  // segunda vez: no hay nada que completar y no se pisa nada
  rr = ec.logica().completarProveedorConDatosAlb('a1', { telefono: '999 999 999', email: 'otro@x.es' });
  assert.equal(rr.ok, true); assert.equal(rr.aplicados.length, 0); assert.equal(ec.estado.proveedores.find((x) => x.id === 'a1').telefono, '91 616 57 45');
  // el NIF que ya es de otro proveedor no se aplica, lo demás sí
  const ed = entorno({ proveedores: [prov('b1', 'Sin datos'), prov('b2', 'Otro', { nif: NIF_VALIDO })] });
  rr = ed.logica().completarProveedorConDatosAlb('b1', { nif: NIF_VALIDO, telefono: '91 616 57 45' });
  assert.equal(rr.ok, true); assert.equal(JSON.stringify(rr.aplicados), '["telefono"]'); assert.equal(ed.estado.proveedores.find((x) => x.id === 'b1').nif, undefined);
  // proveedor de otra empresa o inexistente
  assert.equal(entorno({ proveedores: [prov('z', 'Z', { empresaId: 'OTRA' })] }).logica().completarProveedorConDatosAlb('z', { telefono: '91 616 57 45' }).ok, false);
  assert.equal(entorno().logica().completarProveedorConDatosAlb('nada', {}).ok, false);

  // validarProveedorPM10 recorta dirección y web
  const v = ctx.validarProveedorPM10({ nombre: 'Con extras', direccion: '  C/ Mayor 1  ', web: ' www.x.es ' });
  assert.equal(v.ok, true); assert.equal(v.datos.direccion, 'C/ Mayor 1'); assert.equal(v.datos.web, 'www.x.es');
  assert.equal('direccion' in ctx.validarProveedorPM10({ nombre: 'Sin extras' }).datos, false, 'sin esos campos todo queda como antes');
  console.log('A01_ALB_DATOS_DE_CONTACTO_DE_LA_FOTO=PASS');
}

// ---- asignar NIF y marcar revisado ----
{
  const e = entorno({ proveedores: [prov('a', 'Sin NIF'), prov('b', 'Con NIF', { nif: NIF_VALIDO }), prov('c', 'Pendiente', { pendienteRevision: true, creadoPorIA: true }), prov('d', 'Otra empresa', { empresaId: 'OTRA' })] });
  assert.equal(e.logica().asignarNifProveedor('a', 'b-12345617').ok, true);
  assert.equal(e.estado.proveedores.find((p) => p.id === 'a').nif, 'B12345617');
  assert.equal(e.registro.at(-1)[0], 'Asignar NIF/CIF a proveedor desde albarán');
  assert.equal(e.logica().asignarNifProveedor('a', NIF_VALIDO_2).ok, false, 'no se pisa un NIF ya guardado');
  assert.equal(e.logica().asignarNifProveedor('b', NIF_VALIDO_2).ok, false, 'no se pisa un NIF ya guardado');
  assert.equal(entorno({ proveedores: [prov('a', 'Sin NIF'), prov('b', 'Con NIF', { nif: NIF_VALIDO })] }).logica().asignarNifProveedor('a', NIF_VALIDO).ok, false, 'ese NIF es de otro proveedor');
  assert.equal(e.logica().asignarNifProveedor('a', NIF_MALO).ok, false);
  assert.equal(e.logica().asignarNifProveedor('d', NIF_VALIDO_2).ok, false, 'no se toca un proveedor de otra empresa');
  assert.equal(e.logica().asignarNifProveedor('zzz', NIF_VALIDO_2).ok, false);

  // editar la ficha de un proveedor pendiente de revisar cuenta como revisarlo
  const eEdit = entorno({ proveedores: [prov('c', 'Pendiente', { pendienteRevision: true, creadoPorIA: true })] });
  assert.equal(eEdit.logica().updateProveedor('c', { nombre: 'Pendiente', telefono: '600000000' }).ok, true);
  const editado = eEdit.estado.proveedores[0];
  assert.equal(editado.pendienteRevision, false); assert.equal(editado.creadoPorIA, true); assert.equal(editado.telefono, '600000000');
  // y editar uno normal no le inventa la marca
  const eNormal = entorno({ proveedores: [prov('n', 'Normal')] });
  eNormal.logica().updateProveedor('n', { nombre: 'Normal 2' });
  assert.equal('pendienteRevision' in eNormal.estado.proveedores[0], false);

  assert.equal(e.logica().marcarProveedorRevisado('c').ok, true);
  const c = e.estado.proveedores.find((p) => p.id === 'c');
  assert.equal(c.pendienteRevision, false); assert.equal(c.revisadoEl, '2026-10-08'); assert.equal(c.creadoPorIA, true, 'se conserva el origen');
  e.logica().marcarProveedorRevisado('d');
  assert.equal(e.estado.proveedores.find((p) => p.id === 'd').pendienteRevision, undefined, 'otra empresa: intacto');
  console.log('A01_ALB_ASIGNAR_NIF_Y_REVISAR=PASS');
}

console.log('A01_ALB_PROVEEDOR_DESDE_ALBARAN_MOTOR_CONTRACT=PASS');
