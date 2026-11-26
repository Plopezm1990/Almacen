// Contrato: navegación de Órbita en dos niveles (áreas en el lateral,
// pantallas del área como pestañas sobre el contenido; en móvil, «En <área>»
// dentro del menú Más).
//
// Contexto
// --------
// 25/11/2026: el usuario pidió que el lateral dejara de ser una lista larga
// y funcionara como la maqueta (propuesta 7): solo las diez áreas, y al
// entrar en una, sus pantallas arriba. Antes de programar se aprobó la tabla
// docs/rediseno/EQUIVALENCIAS_PESTANAS_ORBITA_2026-11-25.md con cinco
// decisiones: (1) las partes internas de una pantalla no son pestañas,
// (2) cuatro pantallas cambian de área como en la maqueta, (3) Producción se
// queda en Inventario, (4) cada área abre el destino de la maqueta y
// (5) Devoluciones marca Caja salvo si se entró como devolución a
// proveedor.
//
// Qué fija este contrato
// ----------------------
// Que la tabla existe igual en las dos fuentes con paridad, que ningún
// destino real del menú se queda sin área (no se esconde ninguna función),
// que las decisiones aprobadas se cumplen al ejecutar las funciones reales
// (no solo que el texto esté), que las pestañas usan el mismo cambio de
// pantalla protegido que el resto de la navegación y que el menú móvil no
// vuelve a llevar controles de la maqueta sin función.

import fs from 'node:fs';
import assert from 'node:assert/strict';

const ORDEN_MAQUETA = ['Inicio', 'Servicio', 'Caja y fiscalidad', 'Compras', 'Inventario', 'Equipo', 'Calidad', 'Informes', 'Organización', 'Sistema'];

function extraerModelo(texto, nombre) {
  const ini = texto.indexOf('const AREAS_ORBITA = [');
  const fin = texto.indexOf('function agruparNavegacionRediseno(grupos, diseno) {', ini);
  assert.ok(ini > 0 && fin > ini, `${nombre}: no se encuentra la tabla AREAS_ORBITA antes de agruparNavegacionRediseno`);
  const bloque = texto.slice(ini, fin);
  // Se ejecuta el código real de la fuente, no una copia del test.
  return new Function(`${bloque}\nreturn { AREAS_ORBITA, areaOrbitaDeTab, agruparNavegacionOrbita };`)();
}

function idsDelMenu(texto, nombre) {
  const ini = texto.indexOf('const itemsMeta = [');
  const fin = texto.indexOf('].map((item) => ({ ...item, capacidadConsulta', ini);
  assert.ok(ini > 0 && fin > ini, `${nombre}: no se encuentra itemsMeta`);
  return [...texto.slice(ini, fin).matchAll(/\{ id: "([a-z_]+)", label:/g)].map((m) => m[1]);
}

const modelos = [];
for (const [nombre, ruta] of [
  ['fuente.js', 'fuente.js'],
  ['source-recovery/fuente-recuperado.js', 'source-recovery/fuente-recuperado.js'],
]) {
  const texto = fs.readFileSync(ruta, 'utf8');
  const { AREAS_ORBITA, areaOrbitaDeTab, agruparNavegacionOrbita } = extraerModelo(texto, nombre);
  modelos.push(JSON.stringify(AREAS_ORBITA));

  // 1. Diez áreas, con el nombre y el orden de la maqueta.
  assert.deepEqual(AREAS_ORBITA.map((a) => a.titulo), ORDEN_MAQUETA, `${nombre}: las áreas deben ser las de la maqueta, en su orden`);

  // 2. Ningún destino real se queda sin área: los 45 del menú son pestaña.
  const menu = idsDelMenu(texto, nombre);
  assert.equal(menu.length, 45, `${nombre}: el menú real tiene 45 destinos; si cambia, hay que revisar la tabla de equivalencias`);
  const enTabla = new Set(AREAS_ORBITA.flatMap((a) => a.pestanas.map(([id]) => id)));
  const sinArea = menu.filter((id) => !enTabla.has(id));
  assert.deepEqual(sinArea, [], `${nombre}: destinos del menú sin área en Órbita: ${sinArea.join(', ')}`);
  const inventados = [...enTabla].filter((id) => id !== 'devolucion_proveedor' && !menu.includes(id));
  assert.deepEqual(inventados, [], `${nombre}: pestañas que no son un destino real: ${inventados.join(', ')}`);
  assert.equal(AREAS_ORBITA.flatMap((a) => a.pestanas).length, 46, `${nombre}: 45 destinos + la entrada ya existente de devolución a proveedor`);

  // 3. Las decisiones aprobadas, ejecutando la función real.
  const area = (tab, origen) => areaOrbitaDeTab(tab, origen)?.id;
  assert.equal(area('pagos'), 'compras', `${nombre}: Cuentas por pagar va en Compras`);
  assert.equal(area('tesoreria'), 'informes', `${nombre}: Tesorería va en Informes`);
  assert.equal(area('devoluciones'), 'caja_fiscalidad', `${nombre}: Devoluciones marca Caja y fiscalidad por defecto`);
  assert.equal(area('devoluciones', 'proveedor'), 'compras', `${nombre}: Devoluciones marca Compras si se entró como devolución a proveedor`);
  assert.equal(area('descuentos'), 'organizacion', `${nombre}: Descuentos y cortesías va en Organización`);
  assert.equal(area('produccion'), 'inventario', `${nombre}: Producción se queda en Inventario`);
  const destino = (id) => AREAS_ORBITA.find((a) => a.id === id).destino;
  assert.equal(destino('compras'), 'pedidos', `${nombre}: Compras abre Pedidos a proveedor`);
  assert.equal(destino('organizacion'), 'configuracion', `${nombre}: Organización abre Configuración del local`);
  for (const a of AREAS_ORBITA) {
    assert.ok(a.pestanas.some(([id]) => id === a.destino), `${nombre}: el destino de ${a.titulo} debe ser una de sus pestañas`);
  }

  // 4. Agrupar respeta permisos (solo lo que llega filtrado) y no pierde
  //    destinos nuevos que aún no estén en la tabla.
  const item = (id) => ({ id, label: id });
  const grupos = agruparNavegacionOrbita([
    { id: 'ventas', titulo: 'Ventas', items: [item('venta'), item('cocina')] },
    { id: 'compras', titulo: 'Compras', devolucionProveedor: true, items: [item('proveedores')] },
    { id: 'nuevo', titulo: 'Nuevo', items: [item('pantalla_futura')] },
  ]);
  const servicio = grupos.find((g) => g.titulo === 'Servicio');
  assert.deepEqual(servicio.items.map((i) => i.id), ['venta', 'cocina'], `${nombre}: Servicio solo lleva lo que el rol puede abrir`);
  assert.equal(grupos.find((g) => g.titulo === 'Compras').devolucionProveedor, true, `${nombre}: Compras conserva la entrada de devolución a proveedor`);
  assert.deepEqual(grupos.find((g) => g.titulo === 'Otros')?.items.map((i) => i.id), ['pantalla_futura'], `${nombre}: un destino sin área aparece aparte, no desaparece`);
  assert.equal(grupos[0].titulo, null, `${nombre}: Inicio sigue sin título en el lateral, como antes`);

  // 5. Las pestañas usan el mismo cambio de pantalla protegido y los mismos
  //    destinos filtrados por permiso que el lateral.
  assert.match(texto, /disenoNavegacion === "orbita" && \/\* @__PURE__ \*\/ import_react4\.default\.createElement\(PestanasAreaOrbita, \{ grupos: GRUPOS, tab, setTab: cambiarTabPM15,/,
    `${nombre}: las pestañas se montan solo en Órbita, con GRUPOS y cambiarTabPM15`);
  assert.match(texto, /className: "la-orbita-pestanas hidden md:flex"/, `${nombre}: en móvil no hay fila de pestañas, como en la maqueta`);
  assert.match(texto, /if \(pestanas\.length < 2\) return null;/, `${nombre}: un área con una sola pantalla permitida no pinta fila`);

  // 6. Devoluciones: solo se recuerda por dónde se entró.
  assert.match(texto, /setSaltoDevolucionProveedor\(\(n\) => n \+ 1\);\n    setOrigenDevolucionOrbita\("proveedor"\);/, `${nombre}: entrar como devolución a proveedor marca Compras`);
  assert.match(texto, /if \(tab !== "devoluciones"\) setOrigenDevolucionOrbita\("cliente"\);/, `${nombre}: al salir de Devoluciones se vuelve a marcar Caja`);

  // 7. Menú Más del móvil: «En <área>» y sin controles de maqueta sin función.
  assert.match(texto, /titulo: "En " \+ areaActualOrbita\.titulo, items: pestanasDeAreaOrbita\(areaActualOrbita\)/, `${nombre}: el menú Más enseña las pantallas del área activa`);
  for (const resto of ['abrirRutaDemo', 'Opciones de demo', '\\xCDndice de pantallas', 'Índice de pantallas', 'menu-compras']) {
    assert.ok(!texto.includes(resto), `${nombre}: el menú móvil no debe volver a llevar «${resto}»`);
  }
}

assert.equal(modelos[0], modelos[1], 'la tabla AREAS_ORBITA debe ser idéntica en fuente.js y en la recuperación');

console.log('REDISENO_ORBITA_PESTANAS_AREA=OK');
