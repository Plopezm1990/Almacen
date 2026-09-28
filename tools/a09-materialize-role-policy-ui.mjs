import fs from 'node:fs';

const targets = ['source-recovery/fuente-recuperado.js', 'fuente.js'];

function replaceRequired(text, before, after, label) {
  const first = text.indexOf(before);
  if (first < 0) throw new Error(\`A09 materializer: falta \${label}\`);
  if (text.indexOf(before, first + 1) >= 0) throw new Error(\`A09 materializer: \${label} no es único\`);
  return text.slice(0, first) + after + text.slice(first + before.length);
}

function patchBlock(block) {
  let out = block;
  out = replaceRequired(out,
\`  const politicaInicial = {
    Propietario: {\`,
\`  const crearPoliticaVacia = (rol) => ({
    rol,
    max_percent: "0",
    permite_cortesia: false,
    puede_solicitar: false,
    puede_aplicar: false,
    puede_autorizar: false,
    permite_escalado: false,
    requiere_doble_aprobacion: false,
    activa: true
  });
  const politicaInicial = {
    Propietario: {\`,
  'factory de política segura');

  out = replaceRequired(out,
\`    Encargado: {
      rol: "Encargado",
      max_percent: "20",
      permite_cortesia: false,
      puede_solicitar: true,
      puede_aplicar: true,
      puede_autorizar: false,
      permite_escalado: true,
      requiere_doble_aprobacion: false,
      activa: true
    }
  };\`,
\`    Encargado: {
      rol: "Encargado",
      max_percent: "20",
      permite_cortesia: false,
      puede_solicitar: true,
      puede_aplicar: true,
      puede_autorizar: false,
      permite_escalado: true,
      requiere_doble_aprobacion: false,
      activa: true
    },
    "Cajero/a": crearPoliticaVacia("Cajero/a"),
    "Camarero/a": crearPoliticaVacia("Camarero/a"),
    "Churrero/a": crearPoliticaVacia("Churrero/a"),
    "Básico": crearPoliticaVacia("Básico")
  };\`,
  'roles base A09');

  out = replaceRequired(out,
\`  const [form, setForm] = (0, import_react4.useState)(politicaInicial);
  const [motivo, setMotivo]\`,
\`  const [form, setForm] = (0, import_react4.useState)(politicaInicial);
  const [nuevoRol, setNuevoRol] = (0, import_react4.useState)("");
  const [motivo, setMotivo]\`,
  'estado nuevoRol');

  out = replaceRequired(out,
\`      setForm((anterior) => {
        const siguiente = { ...anterior };
        for (const politica of lista) {
          if (politica?.rol && siguiente[politica.rol]) siguiente[politica.rol] = { ...siguiente[politica.rol], ...politica, max_percent: String(politica.max_percent ?? "0") };
        }
        return siguiente;
      });\`,
\`      setForm(() => {
        const siguiente = Object.fromEntries(
          Object.entries(politicaInicial).map(([rol, politica]) => [rol, { ...politica }])
        );
        for (const politica of lista) {
          if (!politica?.rol) continue;
          siguiente[politica.rol] = {
            ...crearPoliticaVacia(politica.rol),
            ...(siguiente[politica.rol] || {}),
            ...politica,
            max_percent: String(politica.max_percent ?? "0")
          };
        }
        return siguiente;
      });\`,
  'carga dinámica de roles');

  out = replaceRequired(out,
\`  const guardar = async () => {\`,
\`  const anadirRol = () => {
    setError("");
    setConfirmacion("");
    const rol = nuevoRol.trim();
    if (!rol) {
      setError("Escribe el nombre del rol que quieres añadir a A09.");
      return;
    }
    if (rol.length > 80) {
      setError("El nombre del rol no puede superar 80 caracteres.");
      return;
    }
    if (form[rol]) {
      setError(\`\${rol}: ya existe en esta configuración.\`);
      return;
    }
    setForm((anterior) => ({ ...anterior, [rol]: crearPoliticaVacia(rol) }));
    setNuevoRol("");
  };
  const guardar = async () => {\`,
  'alta de rol A09');

  const fixed = 'for (const rol of ["Propietario", "Encargado"])';
  const dynamic = 'for (const rol of Object.keys(form))';
  const fixedCount = out.split(fixed).length - 1;
  if (fixedCount !== 2) throw new Error(\`A09 materializer: loops fijos inesperados \${fixedCount}\`);
  out = out.split(fixed).join(dynamic);

  out = replaceRequired(out,
\`  return /* @__PURE__ */ import_react4.default.createElement(\`,
\`  const rolesConfigurados = Object.keys(form);
  return /* @__PURE__ */ import_react4.default.createElement(\`,
  'lista dinámica render');

  out = replaceRequired(out,
\`      tarjeta("Propietario"),
      tarjeta("Encargado"),
      /* @__PURE__ */ import_react4.default.createElement(Field, { label: "Motivo del cambio" }\`,
\`      rolesConfigurados.map(tarjeta),
      /* @__PURE__ */ import_react4.default.createElement(
        Card,
        { className: "mb-3" },
        /* @__PURE__ */ import_react4.default.createElement("div", { className: "font-semibold mb-2" }, "Añadir rol A09"),
        /* @__PURE__ */ import_react4.default.createElement(
          "div",
          { className: "flex gap-2 flex-wrap items-end" },
          /* @__PURE__ */ import_react4.default.createElement(
            "div",
            { className: "min-w-[220px] flex-1" },
            /* @__PURE__ */ import_react4.default.createElement(Field, { label: "Nombre exacto del rol" },
              /* @__PURE__ */ import_react4.default.createElement(Input, {
                value: nuevoRol,
                onChange: (e2) => setNuevoRol(e2.target.value),
                maxLength: 80,
                placeholder: "Ej. Supervisor de sala"
              })
            )
          ),
          /* @__PURE__ */ import_react4.default.createElement(Btn, { variant: "ghost", onClick: anadirRol }, "Añadir")
        ),
        /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[11px] mt-1", style: { color: C2.inkSoft } },
          "Añadir un rol aquí configura únicamente sus límites A09; no crea ni amplía permisos generales de acceso.")
      ),
      /* @__PURE__ */ import_react4.default.createElement(Field, { label: "Motivo del cambio" }\`,
  'render de roles');

  for (const required of [
    '"Cajero/a": crearPoliticaVacia("Cajero/a")',
    '"Camarero/a": crearPoliticaVacia("Camarero/a")',
    'const rolesConfigurados = Object.keys(form)',
    'rolesConfigurados.map(tarjeta)',
    'const anadirRol = () =>'
  ]) {
    if (!out.includes(required)) throw new Error(\`A09 materializer: falta \${required}\`);
  }
  if (out.includes(fixed)) throw new Error('A09 materializer: persiste el hardcode de dos roles');
  return out;
}

let reference = null;
for (const file of targets) {
  const source = fs.readFileSync(file, 'utf8');
  const start = source.indexOf('function PoliticasDescuentos');
  const end = source.indexOf('function GestionAlmacen()', start);
  if (start < 0 || end < 0) throw new Error(\`A09 materializer: límites no encontrados en \${file}\`);
  const patchedBlock = patchBlock(source.slice(start, end));
  if (reference === null) reference = patchedBlock;
  else if (patchedBlock !== reference) throw new Error('A09 materializer: los bloques resultantes divergen');
  fs.writeFileSync(file, source.slice(0, start) + patchedBlock + source.slice(end), 'utf8');
  console.log(\`A09_ROLE_POLICY_UI_PATCHED=\${file}\`);
}
console.log('A09_ROLE_POLICY_UI_MATERIALIZE=PASS');
