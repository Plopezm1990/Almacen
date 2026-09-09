#!/usr/bin/env node
// Escáner centralizado de secretos e identificadores internos (PM26 P02).
//
// Este archivo NO contiene, en ningún punto de su código fuente, ningún
// identificador real (project ref, URL interna, clave publishable completa
// ni ningún otro valor sensible). Los "candidatos a identificador" se
// detectan por FORMA (un project ref de Supabase es siempre una cadena de
// 20 caracteres alfanuméricos en minúsculas, con o sin el sufijo
// ".supabase.co"), nunca por comparación contra un valor memorizado aquí.
//
// Sustituye las cinco implementaciones divergentes (grep inline en cada
// workflow) por un único punto de verdad, reutilizado tanto por los
// workflows de CI como por los contratos de prueba .mjs.
//
// Clasificación de cada coincidencia encontrada (nunca se imprime el valor,
// solo archivo, categoría, cantidad y una huella no reversible):
//   - secreto_real                    -> SIEMPRE bloqueante, nunca admisible
//                                         en ninguna línea base ni deuda.
//   - configuracion_publica_legitima  -> el candidato aparece en una de las
//                                         ubicaciones de runtime ya auditadas
//                                         en PM26 P01, necesarias para que
//                                         el cliente funcione.
//   - termino_tecnico                 -> el candidato aparece como parte de
//                                         un literal de patrón (regex JS o
//                                         cadena de grep) cuyo propio
//                                         propósito es comprobar que ese
//                                         valor NO debe aparecer en otro
//                                         sitio -- uso autorreferencial, no
//                                         una fuga nueva.
//   - falso_positivo                  -> coincidencia de forma sin relación
//                                         real con un identificador (ej.
//                                         subcadena casual de un blob
//                                         binario en base64).
//   - identificador_interno_historico -> duplicación real de un
//                                         identificador interno fuera de sus
//                                         ubicaciones legítimas y sin ser un
//                                         patrón técnico. Deuda de
//                                         saneamiento, no un secreto.
//
// La categoría de cada coincidencia se RE-DERIVA siempre a partir del
// contenido real del archivo en el momento de verificar -- nunca se toma
// de la palabra de un fichero de línea base sin comprobarla, precisamente
// para que editar esos ficheros a mano no pueda encubrir un secreto real.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const RAIZ_REPO = path.resolve(__dirname, '..', '..');

// --- Ubicaciones de runtime ya auditadas en PM26 P01 (index.html y
// reset-pruebas-preview.js contienen la config de cliente activa; fuente.js,
// edge-auth-patch.js, restablecer-contrasena.html y
// source-recovery/fuente-recuperado.js contienen la MISMA URL de producción
// escrita de forma literal en llamadas fetch() directas a Edge Functions,
// necesaria para que esas funciones respondan). Ninguna contiene un secreto
// privado -- solo project refs y claves de clase "publishable", ambas
// diseñadas para ser públicas en el cliente. ---
export const UBICACIONES_RUNTIME_LEGITIMAS = [
  'index.html',
  'reset-pruebas-preview.js',
  'fuente.js',
  'edge-auth-patch.js',
  'restablecer-contrasena.html',
  'source-recovery/fuente-recuperado.js',
];

// --- Patrones estructurales de SECRETO REAL (nunca un identificador público) ---
const PATRONES_SECRETO_REAL = [
  { nombre: 'clave-secreta-supabase', patron: /sb_secret_[A-Za-z0-9_-]{10,}/g },
  { nombre: 'jwt-tres-segmentos', patron: /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g },
  { nombre: 'clave-aws', patron: /(^|[^A-Za-z0-9+/])AKIA[0-9A-Z]{16}(?![A-Za-z0-9+/])/g },
  { nombre: 'bloque-clave-privada', patron: /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]{0,200}-----END/g },
  { nombre: 'service-role-key-asignada', patron: /(service_role|SUPABASE_SERVICE_ROLE_KEY)["'`]?\s*[:=]\s*["'`][A-Za-z0-9_.=-]{15,}["'`]/g },
];

// --- Forma estructural de un project ref de Supabase: 20 caracteres
// alfanuméricos en minúsculas, como token independiente. Detectado por
// FORMA, no por comparación contra un valor conocido. ---
const PATRON_CANDIDATO_REF = /(?<![a-z0-9])[a-z0-9]{20}(?![a-z0-9])/g;
const PATRON_CLAVE_PUBLICABLE = /sb_publishable_[A-Za-z0-9_-]{10,}/g;

// --- Falsos positivos ya investigados y confirmados (PM26 P02): palabras
// de exactamente 20 caracteres en código de terceros vendorizado (nombres
// de atributo HTML y de color CSS de DOMPurify/html2canvas), coincidencia
// casual de longitud, no un identificador. Se registran por HUELLA
// (sha256 truncado del valor), nunca por el valor mismo -- ver
// tools/seguridad/README.md para el detalle de la investigación. ---
const HUELLAS_FALSO_POSITIVO = new Set([
  'e4bcca595cb58f11', // atributo HTML de 20 letras en la lista de permitidos de DOMPurify
  'd85b2d645bf7db44', // atributo HTML/MathML de 20 letras en la misma lista
  'ab4eeda43e545149', // nombre de color CSS de 20 letras ("lightgoldenrod...")
]);

const EXTENSIONES_BINARIAS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.woff', '.woff2', '.ttf',
  '.eot', '.pdf', '.zip',
]);

function esProbablementeBinario(rel) {
  return EXTENSIONES_BINARIAS.has(path.extname(rel).toLowerCase());
}

function huellaDe(valor) {
  return crypto.createHash('sha256').update(valor).digest('hex').slice(0, 16);
}

function listarArchivosGit(raiz) {
  const salida = execFileSync('git', ['ls-files'], { cwd: raiz, encoding: 'utf8' });
  return salida.split('\n').filter(Boolean);
}

/** Lista archivos de forma recursiva sin depender de git -- para escanear
 * un directorio aislado (ej. en pruebas), nunca el repositorio real. */
export function listarArchivosRecursivo(raiz) {
  const resultado = [];
  const pila = [''];
  while (pila.length > 0) {
    const rel = pila.pop();
    const abs = path.join(raiz, rel);
    for (const entrada of fs.readdirSync(abs, { withFileTypes: true })) {
      const relHijo = rel ? `${rel}/${entrada.name}` : entrada.name;
      if (entrada.isDirectory()) pila.push(relHijo);
      else if (entrada.isFile()) resultado.push(relHijo);
    }
  }
  return resultado;
}

function lineaYColumnaDe(texto, indice) {
  const hastaAqui = texto.slice(0, indice);
  const numeroLinea = hastaAqui.split('\n').length;
  const inicioLinea = hastaAqui.lastIndexOf('\n') + 1;
  return { numeroLinea, columna: indice - inicioLinea };
}

function textoDeLinea(texto, indice) {
  const inicio = texto.lastIndexOf('\n', indice - 1) + 1;
  let fin = texto.indexOf('\n', indice);
  if (fin === -1) fin = texto.length;
  return texto.slice(inicio, fin);
}

// --- Heurística SINTÁCTICA (misma línea) de "término técnico": el valor
// aparece como parte de un literal de patrón, no como un dato suelto. ---
function pareceTerminoTecnico(lineaTexto, columna, longitudValor) {
  const antes = lineaTexto.slice(0, columna);
  const despues = lineaTexto.slice(columna + longitudValor);

  // 1. Literal de regex JS: /valor/ (con flags opcionales) en la misma línea.
  if (/\/$/.test(antes) && /^\/[a-z]*/.test(despues)) return true;

  // 2. Elemento de una cadena de alternancia grep -E: aparece junto a un '|'
  //    inmediatamente antes o después, dentro de una línea que invoca grep.
  if (/grep\s+-[A-Za-z]*E/.test(lineaTexto) && (/\|$/.test(antes) || /^\|/.test(despues))) return true;

  // 3. Elemento de un array/lista de "patron(es)"/"secreto" declarado en la
  //    misma línea que el valor (ej. "const patronesSecreto = [ /x/, ").
  if (/patron(es)?[_a-zA-Z]*\s*=\s*\[/.test(antes)) return true;

  // 4. La propia línea es un comentario o assert que nombra el patrón como
  //    metodología (ej. "no debe publicarse X", "assert.doesNotMatch").
  if (/assert\.doesNotMatch|no debe (publicarse|aparecer)/i.test(lineaTexto)) return true;

  return false;
}

/**
 * Escanea un árbol de archivos y clasifica cada coincidencia encontrada.
 * @param {object} opciones
 * @param {string} opciones.raiz - directorio raíz a escanear
 * @param {string[]} [opciones.archivos] - lista explícita de rutas relativas
 *   a escanear; si se omite, se usa `git ls-files` sobre `raiz`.
 * @param {string[]} [opciones.ubicacionesLegitimas] - rutas relativas que se
 *   clasifican como configuración pública legítima en vez de duplicación.
 */
export function escanearArbol({ raiz, archivos, ubicacionesLegitimas = UBICACIONES_RUNTIME_LEGITIMAS }) {
  const listaArchivos = archivos ?? listarArchivosGit(raiz);
  const legitimasSet = new Set(ubicacionesLegitimas);

  const hallazgos = [];

  for (const rel of listaArchivos) {
    if (esProbablementeBinario(rel)) continue;
    const abs = path.join(raiz, rel);
    let texto;
    try {
      texto = fs.readFileSync(abs, 'utf8');
    } catch {
      continue;
    }
    if (texto.includes(' ')) continue; // binario real, no texto

    // 1. Secretos reales -- SIEMPRE bloqueante, en cualquier archivo.
    for (const { patron } of PATRONES_SECRETO_REAL) {
      patron.lastIndex = 0;
      let m;
      while ((m = patron.exec(texto))) {
        const { numeroLinea } = lineaYColumnaDe(texto, m.index);
        hallazgos.push({
          tipo: 'secreto_real',
          categoria: 'secreto_real',
          archivo: rel,
          linea: numeroLinea,
          huella: huellaDe(m[0]),
        });
        if (patron.lastIndex === m.index) patron.lastIndex++;
      }
    }

    // 2. Claves publicables completas: legítimas solo en sus ubicaciones.
    PATRON_CLAVE_PUBLICABLE.lastIndex = 0;
    let mClave;
    while ((mClave = PATRON_CLAVE_PUBLICABLE.exec(texto))) {
      const { numeroLinea } = lineaYColumnaDe(texto, mClave.index);
      const categoria = legitimasSet.has(rel) ? 'configuracion_publica_legitima' : 'identificador_interno_historico';
      const lineaTexto = textoDeLinea(texto, mClave.index);
      const { columna } = lineaYColumnaDe(texto, mClave.index);
      const categoriaFinal = categoria === 'identificador_interno_historico' && pareceTerminoTecnico(lineaTexto, columna, mClave[0].length)
        ? 'termino_tecnico'
        : categoria;
      hallazgos.push({
        tipo: 'identificador_duplicado',
        categoria: categoriaFinal,
        archivo: rel,
        linea: numeroLinea,
        huella: huellaDe(mClave[0]),
      });
    }

    // 3. Candidatos a project ref (forma: 20 alfanuméricos en minúsculas).
    PATRON_CANDIDATO_REF.lastIndex = 0;
    let mRef;
    while ((mRef = PATRON_CANDIDATO_REF.exec(texto))) {
      const valor = mRef[0];
      const { numeroLinea, columna } = lineaYColumnaDe(texto, mRef.index);
      const lineaTexto = textoDeLinea(texto, mRef.index);

      const huella = huellaDe(valor);
      let categoria;
      if (HUELLAS_FALSO_POSITIVO.has(huella)) {
        categoria = 'falso_positivo';
      } else if (legitimasSet.has(rel)) {
        categoria = 'configuracion_publica_legitima';
      } else if (pareceTerminoTecnico(lineaTexto, columna, valor.length)) {
        categoria = 'termino_tecnico';
      } else {
        categoria = 'identificador_interno_historico';
      }

      hallazgos.push({
        tipo: 'identificador_duplicado',
        categoria,
        archivo: rel,
        linea: numeroLinea,
        huella,
      });
    }
  }

  return hallazgos;
}

/** Agrupa hallazgos por (archivo, categoría) sin exponer valores -- solo cantidad y huellas. */
export function agruparHallazgos(hallazgos) {
  const grupos = new Map();
  for (const h of hallazgos) {
    const clave = `${h.archivo} ${h.categoria}`;
    if (!grupos.has(clave)) {
      grupos.set(clave, { archivo: h.archivo, categoria: h.categoria, cantidad: 0, huellas: new Set() });
    }
    const g = grupos.get(clave);
    g.cantidad++;
    g.huellas.add(h.huella);
  }
  return [...grupos.values()]
    .map((g) => ({ archivo: g.archivo, categoria: g.categoria, cantidad: g.cantidad, huellas: [...g.huellas].sort() }))
    .sort((a, b) => a.archivo.localeCompare(b.archivo) || a.categoria.localeCompare(b.categoria));
}

const CATEGORIAS_LINEA_BASE = new Set(['termino_tecnico', 'falso_positivo', 'configuracion_publica_legitima']);
const CATEGORIAS_DEUDA = new Set(['identificador_interno_historico']);

export function separarEnLedgers(hallazgos) {
  const agrupado = agruparHallazgos(hallazgos.filter((h) => h.tipo === 'identificador_duplicado'));
  return {
    lineaBase: agrupado.filter((g) => CATEGORIAS_LINEA_BASE.has(g.categoria)),
    deuda: agrupado.filter((g) => CATEGORIAS_DEUDA.has(g.categoria)),
  };
}

/**
 * Verifica el árbol actual contra los ledgers ya registrados.
 * Devuelve { ok, secretosReales, nuevasApariciones, resumenDeuda }.
 * Nunca imprime valores -- solo archivo/categoría/huella.
 */
export function verificar({ raiz, rutaLineaBase, rutaDeuda, archivos }) {
  const hallazgos = escanearArbol({ raiz, archivos });
  const secretosReales = hallazgos.filter((h) => h.tipo === 'secreto_real');

  const lineaBase = JSON.parse(fs.readFileSync(rutaLineaBase, 'utf8'));
  const deuda = JSON.parse(fs.readFileSync(rutaDeuda, 'utf8'));
  const huellasConocidas = new Set();
  for (const entrada of [...lineaBase.entradas, ...deuda.entradas]) {
    for (const h of entrada.huellas) huellasConocidas.add(`${entrada.archivo} ${h}`);
  }

  const nuevasApariciones = hallazgos
    .filter((h) => h.tipo === 'identificador_duplicado')
    .filter((h) => !huellasConocidas.has(`${h.archivo} ${h.huella}`));

  return {
    ok: secretosReales.length === 0 && nuevasApariciones.length === 0,
    secretosReales,
    nuevasApariciones,
    resumenDeuda: deuda.entradas,
  };
}

// --- CLI ---
if (process.argv[1] === __filename) {
  const modo = process.argv[2] || 'verificar';
  const rutaLineaBase = path.join(RAIZ_REPO, 'tools/seguridad/linea-base-aceptada.json');
  const rutaDeuda = path.join(RAIZ_REPO, 'tools/seguridad/deuda-identificadores-historicos.json');

  if (modo === 'regenerar-ledgers') {
    const hallazgos = escanearArbol({ raiz: RAIZ_REPO });
    const secretosReales = hallazgos.filter((h) => h.tipo === 'secreto_real');
    if (secretosReales.length > 0) {
      console.error('DETENIDO: se encontró un posible SECRETO REAL. No se regeneró ningún ledger.');
      for (const s of secretosReales) console.error(`  ${s.categoria} en ${s.archivo}:${s.linea} (huella ${s.huella})`);
      process.exit(2);
    }
    const { lineaBase, deuda } = separarEnLedgers(hallazgos);
    fs.writeFileSync(rutaLineaBase, JSON.stringify({
      descripcion: 'Coincidencias admitidas: término técnico, falso positivo o configuración pública legítima. Regenerar solo con "node ... regenerar-ledgers" tras revisión manual. Nunca contiene valores, solo huellas no reversibles (sha256 truncado).',
      entradas: lineaBase,
    }, null, 2) + '\n');
    fs.writeFileSync(rutaDeuda, JSON.stringify({
      descripcion: 'Identificadores internos históricos (deuda de saneamiento): duplicación de un identificador interno fuera de sus ubicaciones de runtime legítimas, en contenido preexistente de PM02-PM23. No son secretos -- ninguno concede acceso por sí solo. No se corrigen en PM26 P02 (fuera de su alcance autorizado). Nunca contiene valores, solo huellas no reversibles (sha256 truncado).',
      entradas: deuda,
    }, null, 2) + '\n');
    console.log(`LEDGERS_REGENERADOS: linea_base=${lineaBase.length} archivos, deuda=${deuda.length} archivos`);
    process.exit(0);
  }

  if (modo === 'verificar') {
    const r = verificar({ raiz: RAIZ_REPO, rutaLineaBase, rutaDeuda });
    if (r.secretosReales.length > 0) {
      console.error('VERIFICAR_SECRETOS=FALLO: posible secreto real encontrado');
      for (const s of r.secretosReales) console.error(`  ${s.categoria} en ${s.archivo}:${s.linea} (huella ${s.huella})`);
      process.exit(2);
    }
    if (r.nuevasApariciones.length > 0) {
      console.error('VERIFICAR_SECRETOS=FALLO: aparición nueva fuera de línea base y deuda registrada');
      for (const n of r.nuevasApariciones) console.error(`  ${n.categoria} en ${n.archivo}:${n.linea} (huella ${n.huella})`);
      process.exit(1);
    }
    const totalDeuda = r.resumenDeuda.reduce((acc, e) => acc + e.cantidad, 0);
    console.log('VERIFICAR_SECRETOS=PASS');
    console.log(`VERIFICAR_SECRETOS_DEUDA_PENDIENTE=${totalDeuda} coincidencias en ${r.resumenDeuda.length} archivos (ver tools/seguridad/deuda-identificadores-historicos.json)`);
    process.exit(0);
  }

  if (modo === 'escanear-ruta') {
    // Modo aislado, sin ledgers ni dependencia de git: solo comprueba si hay
    // SECRETOS REALES en una ruta arbitraria (para pruebas positiva/negativa
    // sobre un directorio temporal aislado, nunca el repositorio real).
    const ruta = process.argv[3];
    if (!ruta) {
      console.error('Uso: escanear-ruta <directorio>');
      process.exit(2);
    }
    const hallazgos = escanearArbol({ raiz: ruta, archivos: listarArchivosRecursivo(ruta), ubicacionesLegitimas: [] });
    const secretosReales = hallazgos.filter((h) => h.tipo === 'secreto_real');
    if (secretosReales.length > 0) {
      console.error(`ESCANEAR_RUTA=FALLO: ${secretosReales.length} posible(s) secreto(s) real(es)`);
      for (const s of secretosReales) console.error(`  ${s.categoria} en ${s.archivo}:${s.linea} (huella ${s.huella})`);
      process.exit(2);
    }
    console.log('ESCANEAR_RUTA=PASS');
    process.exit(0);
  }

  console.error(`Modo desconocido: ${modo}. Usa "verificar", "regenerar-ledgers" o "escanear-ruta".`);
  process.exit(2);
}
