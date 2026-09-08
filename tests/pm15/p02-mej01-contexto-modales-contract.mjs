import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

// PM15 P02 (MEJ-01): "Empresa/local inequívocos también en modales y acciones sensibles."
//
// Inspección de código real (sin PM15-P01 el punto anterior): ninguno de los modales de
// acciones sensibles ya construidos por PM14 (Cancelar/Devolver encargo, Eliminar cliente)
// ni los de Personal/Locales (Dar de baja empleado, Desactivar local) mostraba en qué
// local/empresa estaba actuando -- solo el motivo/consecuencia de la acción. Cambio
// aditivo y de solo texto: una etiqueta de contexto ("Local: X · Empresa Y") calculada una
// vez y pasada a los componentes, sin tocar ninguna lógica de negocio existente.

const src = fs.readFileSync('fuente.js', 'utf8');

// ---- Función pura etiquetaContextoPM15: positivo/negativo. ----
{
  const ini = src.indexOf('function etiquetaContextoPM15(');
  assert.ok(ini >= 0, 'etiquetaContextoPM15 no encontrada');
  const fin = src.indexOf('function Personal(', ini);
  assert.ok(fin > ini, 'no se pudo acotar etiquetaContextoPM15');
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(src.slice(ini, fin), ctx);
  const etiquetaContextoPM15 = ctx.etiquetaContextoPM15;
  assert.equal(typeof etiquetaContextoPM15, 'function');

  assert.equal(etiquetaContextoPM15({ nombre: 'San Ginés Centro' }, { razonSocial: 'Chocoloyos S.L.' }), 'San Ginés Centro · Chocoloyos S.L.');
  assert.equal(etiquetaContextoPM15({ nombre: 'San Ginés Centro' }, { marca: 'Chocoloyos' }), 'San Ginés Centro · Chocoloyos');
  assert.equal(etiquetaContextoPM15({ nombre: 'San Ginés Centro' }, null), 'San Ginés Centro');
  assert.equal(etiquetaContextoPM15(null, { razonSocial: 'Chocoloyos S.L.' }), 'Chocoloyos S.L.');
  assert.equal(etiquetaContextoPM15(null, null), '');
  assert.equal(etiquetaContextoPM15({}, {}), '', 'sin nombre/razón social no se inventa nada');
  console.log('P02_MEJ01_ETIQUETA_CONTEXTO_PURA=PASS');
}

// ---- Las 5 modales de acciones sensibles auditadas muestran el contexto. ----
{
  const modales = [
    { titulo: 'Cancelar encargo', marcador: 'title: "Cancelar encargo" }, contextoActivoPM15' },
    { titulo: 'Devolver encargo', marcador: 'title: "Devolver encargo" }, contextoActivoPM15' },
    { titulo: 'Eliminar cliente', marcador: 'title: "Eliminar cliente" }, contextoActivoPM15' },
    { titulo: 'Dar de baja empleado', marcador: 'title: "Dar de baja empleado" }, contextoActivoPM15' },
  ];
  for (const { titulo, marcador } of modales) {
    assert.ok(src.includes(marcador), `el modal "${titulo}" debe mostrar contextoActivoPM15 inmediatamente tras el título`);
  }
  assert.match(src, /title: "Desactivar local" }, \/\* @__PURE__ \*\/ import_react4\.default\.createElement\("div", \{ className: "text-\[11px\] mb-2", style: \{ color: C2\.inkSoft \} \}, "Empresa: "/, 'Desactivar local debe mostrar la empresa del local afectado');
  console.log('P02_MEJ01_CINCO_MODALES_MUESTRAN_CONTEXTO=PASS');
}

// ---- La etiqueta se calcula una vez en la composición y se pasa a Encargos/Clientes/
// Personal (no se inventa un valor distinto por componente). ----
{
  assert.match(src, /const contextoActivoPM15 = etiquetaContextoPM15\(locales\.find\(\(l22\) => l22\.id === localActivoId\) \|\| null, empresaDelLocalActivo\);/);
  const ini = src.indexOf('tab === "personal" &&');
  const finEncargos = src.indexOf('tab === "clientes" &&', ini);
  const finClientes = src.indexOf('tab === "devoluciones" &&', finEncargos);
  const composicion = src.slice(ini, finClientes);
  const apariciones = composicion.split('contextoActivoPM15').length - 1;
  assert.ok(apariciones >= 3, `contextoActivoPM15 debe pasarse a Personal, Encargos y Clientes (encontrado ${apariciones} veces)`);
  console.log('P02_MEJ01_CONTEXTO_PASADO_A_LOS_TRES_COMPONENTES=PASS');
}

// ---- Negativo: sin contexto disponible (p.ej. "Todos los locales"), no se renderiza una
// etiqueta vacía ni inventada -- el `&&` corto-circuita a false y no pinta nada. ----
{
  assert.match(src, /contextoActivoPM15 && \/\* @__PURE__ \*\/ import_react4\.default\.createElement\("div", \{ className: "text-\[11px\] mb-2", style: \{ color: C2\.inkSoft \} \}, "Local: ", contextoActivoPM15\)/);
  console.log('P02_MEJ01_SIN_CONTEXTO_NO_PINTA_NADA=PASS');
}

console.log('PM15 P02 (MEJ-01) — empresa/local visibles en modales de acciones sensibles: contrato OK');
