import fs from 'node:fs';

const targets = ['source-recovery/fuente-recuperado.js', 'fuente.js'];

function replaceRequired(text, before, after, label) {
  const first = text.indexOf(before);
  if (first < 0) throw new Error('A09 materializer: falta ' + label);
  if (text.indexOf(before, first + 1) >= 0) throw new Error('A09 materializer: ' + label + ' no es único');
  return text.slice(0, first) + after + text.slice(first + before.length);
}

function patchBlock(block) {
  let out = block;

  out = replaceRequired(
    out,
    '  const politicaInicial = {\n    Propietario: {',
    '  const crearPoliticaVacia = (rol) => ({\n' +
      '    rol,\n' +
      '    max_percent: "0",\n' +
      '    permite_cortesia: false,\n' +
      '    puede_solicitar: false,\n' +
      '    puede_aplicar: false,\n' +
      '    puede_autorizar: false,\n' +
      '    permite_escalado: false,\n' +
      '    requiere_doble_aprobacion: false,\n' +
      '    activa: true\n' +
      '  });\n' +
      '  const politicaInicial = {\n' +
      '    Propietario: {',
    'factory de política segura'
  );

  out = replaceRequired(
    out,
    '    Encargado: {\n' +
      '      rol: "Encargado",\n' +
      '      max_percent: "20",\n' +
      '      permite_cortesia: false,\n' +
      '      puede_solicitar: true,\n' +
      '      puede_aplicar: true,\n' +
      '      puede_autorizar: false,\n' +
      '      permite_escalado: true,\n' +
      '      requiere_doble_aprobacion: false,\n' +
      '      activa: true\n' +
      '    }\n' +
      '  };',
    '    Encargado: {\n' +
      '      rol: "Encargado",\n' +
      '      max_percent: "20",\n' +
      '      permite_cortesia: false,\n' +
      '      puede_solicitar: true,\n' +
      '      puede_aplicar: true,\n' +
      '      puede_autorizar: false,\n' +
      '      permite_escalado: true,\n' +
      '      requiere_doble_aprobacion: false,\n' +
      '      activa: true\n' +
      '    },\n' +
      '    "Cajero/a": crearPoliticaVacia("Cajero/a"),\n' +
      '    "Camarero/a": crearPoliticaVacia("Camarero/a"),\n' +
      '    "Churrero/a": crearPoliticaVacia("Churrero/a"),\n' +
      '    "Básico": crearPoliticaVacia("Básico")\n' +
      '  };',
    'roles base A09'
  );

  out = replaceRequired(
    out,
    '  const [form, setForm] = (0, import_react4.useState)(politicaInicial);\n' +
      '  const [motivo, setMotivo]',
    '  const [form, setForm] = (0, import_react4.useState)(politicaInicial);\n' +
      '  const [nuevoRol, setNuevoRol] = (0, import_react4.useState)("");\n' +
      '  const [motivo, setMotivo]',
    'estado nuevoRol'
  );

  out = replaceRequired(
    out,
    '      setForm((anterior) => {\n' +
      '        const siguiente = { ...anterior };\n' +
      '        for (const politica of lista) {\n' +
      '          if (politica?.rol && siguiente[politica.rol]) siguiente[politica.rol] = { ...siguiente[politica.rol], ...politica, max_percent: String(politica.max_percent ?? "0") };\n' +
      '        }\n' +
      '        return siguiente;\n' +
      '      });',
    '      setForm(() => {\n' +
      '        const siguiente = Object.fromEntries(\n' +
      '          Object.entries(politicaInicial).map(([rol, politica]) => [rol, { ...politica }])\n' +
      '        );\n' +
      '        for (const politica of lista) {\n' +
      '          if (!politica?.rol) continue;\n' +
      '          siguiente[politica.rol] = {\n' +
      '            ...crearPoliticaVacia(politica.rol),\n' +
      '            ...(siguiente[politica.rol] || {}),\n' +
      '            ...politica,\n' +
      '            max_percent: String(politica.max_percent ?? "0")\n' +
      '          };\n' +
      '        }\n' +
      '        return siguiente;\n' +
      '      });',
    'carga dinámica de roles'
  );

  out = replaceRequired(
    out,
    '  const guardar = async () => {',
    '  const anadirRol = () => {\n' +
      '    setError("");\n' +
      '    setConfirmacion("");\n' +
      '    const rol = nuevoRol.trim();\n' +
      '    if (!rol) {\n' +
      '      setError("Escribe el nombre del rol que quieres añadir a A09.");\n' +
      '      return;\n' +
      '    }\n' +
      '    if (rol.length > 80) {\n' +
      '      setError("El nombre del rol no puede superar 80 caracteres.");\n' +
      '      return;\n' +
      '    }\n' +
      '    if (form[rol]) {\n' +
      '      setError(rol + ": ya existe en esta configuración.");\n' +
      '      return;\n' +
      '    }\n' +
      '    setForm((anterior) => ({ ...anterior, [rol]: crearPoliticaVacia(rol) }));\n' +
      '    setNuevoRol("");\n' +
      '  };\n' +
      '  const guardar = async () => {',
    'alta de rol A09'
  );

  const fixed = 'for (const rol of ["Propietario", "Encargado"])';
  const dynamic = 'for (const rol of Object.keys(form))';
  const fixedCount = out.split(fixed).length - 1;
  if (fixedCount !== 2) throw new Error('A09 materializer: loops fijos inesperados ' + fixedCount);
  out = out.split(fixed).join(dynamic);

  const mainReturn = '  return /* @__PURE__ */ import_react4.default.createElement(';
  const mainReturnIndex = out.lastIndexOf(mainReturn);
  if (mainReturnIndex < 0) throw new Error('A09 materializer: falta render principal');
  out = out.slice(0, mainReturnIndex) +
    '  const rolesConfigurados = Object.keys(form);\n' +
    mainReturn +
    out.slice(mainReturnIndex + mainReturn.length);

  out = replaceRequired(
    out,
    '      tarjeta("Propietario"),\n' +
      '      tarjeta("Encargado"),\n' +
      '      /* @__PURE__ */ import_react4.default.createElement(Field, { label: "Motivo del cambio" }',
    '      rolesConfigurados.map(tarjeta),\n' +
      '      /* @__PURE__ */ import_react4.default.createElement(\n' +
      '        Card,\n' +
      '        { className: "mb-3" },\n' +
      '        /* @__PURE__ */ import_react4.default.createElement("div", { className: "font-semibold mb-2" }, "Añadir rol A09"),\n' +
      '        /* @__PURE__ */ import_react4.default.createElement(\n' +
      '          "div",\n' +
      '          { className: "flex gap-2 flex-wrap items-end" },\n' +
      '          /* @__PURE__ */ import_react4.default.createElement(\n' +
      '            "div",\n' +
      '            { className: "min-w-[220px] flex-1" },\n' +
      '            /* @__PURE__ */ import_react4.default.createElement(Field, { label: "Nombre exacto del rol" },\n' +
      '              /* @__PURE__ */ import_react4.default.createElement(Input, {\n' +
      '                value: nuevoRol,\n' +
      '                onChange: (e2) => setNuevoRol(e2.target.value),\n' +
      '                maxLength: 80,\n' +
      '                placeholder: "Ej. Supervisor de sala"\n' +
      '              })\n' +
      '            )\n' +
      '          ),\n' +
      '          /* @__PURE__ */ import_react4.default.createElement(Btn, { variant: "ghost", onClick: anadirRol }, "Añadir")\n' +
      '        ),\n' +
      '        /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[11px] mt-1", style: { color: C2.inkSoft } },\n' +
      '          "Añadir un rol aquí configura únicamente sus límites A09; no crea ni amplía permisos generales de acceso.")\n' +
      '      ),\n' +
      '      /* @__PURE__ */ import_react4.default.createElement(Field, { label: "Motivo del cambio" }',
    'render de roles'
  );

  for (const required of [
    '"Cajero/a": crearPoliticaVacia("Cajero/a")',
    '"Camarero/a": crearPoliticaVacia("Camarero/a")',
    'const rolesConfigurados = Object.keys(form)',
    'rolesConfigurados.map(tarjeta)',
    'const anadirRol = () =>'
  ]) {
    if (!out.includes(required)) throw new Error('A09 materializer: falta ' + required);
  }
  if (out.includes(fixed)) throw new Error('A09 materializer: persiste el hardcode de dos roles');
  return out;
}

let reference = null;
for (const file of targets) {
  const source = fs.readFileSync(file, 'utf8');
  const start = source.indexOf('function PoliticasDescuentos');
  const end = source.indexOf('function GestionAlmacen()', start);
  if (start < 0 || end < 0) throw new Error('A09 materializer: límites no encontrados en ' + file);
  const patchedBlock = patchBlock(source.slice(start, end));
  if (reference === null) reference = patchedBlock;
  else if (patchedBlock !== reference) throw new Error('A09 materializer: los bloques resultantes divergen');
  fs.writeFileSync(file, source.slice(0, start) + patchedBlock + source.slice(end), 'utf8');
  console.log('A09_ROLE_POLICY_UI_PATCHED=' + file);
}
console.log('A09_ROLE_POLICY_UI_MATERIALIZE=PASS');
