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
//   - termino_tecnico                 -> reservado para nombres GENÉRICOS de
//                                         patrón (ej. la palabra "service_role"
//                                         o "sb_secret_" sueltas, sin ningún
//                                         valor real adjunto) o expresiones
//                                         puramente estructurales. NUNCA se
//                                         aplica a un project ref real ni a
//                                         una clave publishable completa,
//                                         aunque aparezcan dentro de una
//                                         regex, un comentario o un assert --
//                                         envolver un identificador real en
//                                         un patrón de búsqueda sigue siendo
//                                         una duplicación de ese identificador,
//                                         no una comprobación autorreferencial
//                                         inocua.
//   - falso_positivo                  -> coincidencia de forma sin relación
//                                         real con un identificador (ej.
//                                         subcadena casual de un blob
//                                         binario en base64).
//   - identificador_interno_historico -> duplicación real de un
//                                         identificador interno (project ref
//                                         o clave publishable completa) fuera
//                                         de sus ubicaciones legítimas. Deuda
//                                         de saneamiento, no un secreto.
//
// La categoría de cada coincidencia se RE-DERIVA siempre a partir del
// contenido real del archivo en el momento de verificar -- nunca se toma
// de la palabra de un fichero de línea base sin comprobarla, precisamente
// para que editar esos ficheros a mano no pueda encubrir un secreto real.
//
// El gate ("verificar") compara el ledger REGENERADO EN VIVO contra los
// ficheros de línea base/deuda ENTRADA POR ENTRADA -- archivo, categoría,
// cantidad y el conjunto exacto de huellas. Cualquier alta, baja,
// repetición adicional del mismo valor, cambio de cantidad o
// reclasificación exige regenerar el ledger explícitamente; no basta con
// que la huella ya fuera conocida en algún otro archivo o categoría.

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
// (sha256 truncado del valor), nunca por el valor mismo. ---
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
  const salida = execFileSync('git', ['ls-files'], { cwd: raiz, encoding: 'utf8', maxBuffer: MAX_BUFFER_LECTURA });
  return salida.split('\n').filter(Boolean);
}

/** Lee el contenido de un archivo tal como está en el ÍNDICE de git (lo
 * último añadido con `git add`, o HEAD si no hay cambios en el índice) --
 * no el árbol de trabajo. Se usa cuando el árbol a escanear se enumeró con
 * `git ls-files`, para que el gate sea inmune a mutaciones no
 * deterministas del árbol de trabajo ajenas al contenido rastreado (ej.
 * scripts de diagnóstico de otros paquetes que reescriben su propia
 * evidencia como efecto secundario de ejecutarse). */
// maxBuffer generoso (fuente.js supera 5 MB) -- el default de Node (1 MB)
// hacía fallar `git show` en silencio para los archivos más grandes del
// repositorio, y ese fallo se descartaba como "no legible", dejando esos
// archivos SIN ESCANEAR. No es un límite arbitrario: cubre con margen el
// archivo más grande que el escáner necesita leer hoy.
const MAX_BUFFER_LECTURA = 64 * 1024 * 1024; // 64 MB

function leerDesdeIndiceGit(raiz, rel) {
  return execFileSync('git', ['show', `:${rel}`], { cwd: raiz, encoding: 'utf8', maxBuffer: MAX_BUFFER_LECTURA });
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

function lineaDe(texto, indice) {
  return texto.slice(0, indice).split('\n').length;
}

/**
 * Escanea un árbol de archivos y clasifica cada coincidencia encontrada.
 * IMPORTANTE: un candidato a project ref o una clave publishable completa
 * SIEMPRE se clasifica como configuracion_publica_legitima (si está en una
 * ubicación autorizada) o identificador_interno_historico (en cualquier
 * otro sitio) -- nunca como termino_tecnico, sin importar si está envuelto
 * en una regex, un comentario o un assert. termino_tecnico queda reservado
 * para patrones genéricos que este escáner no detecta como candidatos
 * (nombres de prefijo sin valor adjunto), así que hoy no lo produce nunca
 * esta función -- se mantiene como categoría válida del esquema para no
 * cerrar la puerta a un uso futuro legítimo, distinto de un identificador.
 *
 * @param {object} opciones
 * @param {string} opciones.raiz - directorio raíz a escanear
 * @param {string[]} [opciones.archivos] - lista explícita de rutas relativas
 *   a escanear; si se omite, se usa `git ls-files` sobre `raiz`.
 * @param {string[]} [opciones.ubicacionesLegitimas] - rutas relativas que se
 *   clasifican como configuración pública legítima en vez de duplicación.
 */
export function escanearArbol({ raiz, archivos, ubicacionesLegitimas = UBICACIONES_RUNTIME_LEGITIMAS }) {
  // Si no se pasa una lista explícita, se enumera (y se LEE) vía git --
  // índice, no árbol de trabajo -- para que el resultado sea inmune a
  // mutaciones no deterministas del árbol de trabajo ajenas al contenido
  // rastreado. Cuando se pasa una lista explícita (directorios aislados de
  // prueba, sin git), se lee del sistema de archivos como siempre.
  const usarIndiceGit = archivos === undefined;
  const listaArchivos = archivos ?? listarArchivosGit(raiz);
  const legitimasSet = new Set(ubicacionesLegitimas);

  const hallazgos = [];

  for (const rel of listaArchivos) {
    if (esProbablementeBinario(rel)) continue;
    const abs = path.join(raiz, rel);
    let texto;
    try {
      texto = usarIndiceGit ? leerDesdeIndiceGit(raiz, rel) : fs.readFileSync(abs, 'utf8');
    } catch {
      continue;
    }
    if (texto.includes(' ') === false) continue; // binario real, no texto

    // 1. Secretos reales -- SIEMPRE bloqueante, en cualquier archivo,
    //    cualquiera que sea el contexto sintáctico que lo envuelva.
    for (const { patron } of PATRONES_SECRETO_REAL) {
      patron.lastIndex = 0;
      let m;
      while ((m = patron.exec(texto))) {
        hallazgos.push({
          tipo: 'secreto_real',
          categoria: 'secreto_real',
          archivo: rel,
          linea: lineaDe(texto, m.index),
          huella: huellaDe(m[0]),
        });
        if (patron.lastIndex === m.index) patron.lastIndex++;
      }
    }

    // 2. Claves publicables completas: legítimas solo en sus ubicaciones de
    //    runtime autorizadas; en cualquier otro sitio son deuda histórica,
    //    nunca "término técnico" -- el valor real sigue siendo el valor
    //    real aunque esté dentro de una regex o un comentario.
    PATRON_CLAVE_PUBLICABLE.lastIndex = 0;
    let mClave;
    while ((mClave = PATRON_CLAVE_PUBLICABLE.exec(texto))) {
      const categoria = legitimasSet.has(rel) ? 'configuracion_publica_legitima' : 'identificador_interno_historico';
      hallazgos.push({
        tipo: 'identificador_duplicado',
        categoria,
        archivo: rel,
        linea: lineaDe(texto, mClave.index),
        huella: huellaDe(mClave[0]),
      });
    }

    // 3. Candidatos a project ref (forma: 20 alfanuméricos en minúsculas).
    //    Mismo principio: legítimo solo en su ubicación, deuda histórica en
    //    cualquier otro sitio, sin excepción por contexto sintáctico.
    PATRON_CANDIDATO_REF.lastIndex = 0;
    let mRef;
    while ((mRef = PATRON_CANDIDATO_REF.exec(texto))) {
      const valor = mRef[0];
      const huella = huellaDe(valor);

      let categoria;
      if (HUELLAS_FALSO_POSITIVO.has(huella)) {
        categoria = 'falso_positivo';
      } else if (legitimasSet.has(rel)) {
        categoria = 'configuracion_publica_legitima';
      } else {
        categoria = 'identificador_interno_historico';
      }

      hallazgos.push({
        tipo: 'identificador_duplicado',
        categoria,
        archivo: rel,
        linea: lineaDe(texto, mRef.index),
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
    const clave = `${h.archivo} ${h.categoria}`;
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

function cargarLedger(ruta) {
  const doc = JSON.parse(fs.readFileSync(ruta, 'utf8'));
  const mapa = new Map();
  for (const e of doc.entradas) {
    mapa.set(`${e.archivo} ${e.categoria}`, { cantidad: e.cantidad, huellas: new Set(e.huellas) });
  }
  return { doc, mapa };
}

function mismasHuellas(a, b) {
  if (a.size !== b.size) return false;
  for (const h of a) if (!b.has(h)) return false;
  return true;
}

/**
 * Verifica el árbol actual contra los ledgers ya registrados, comparando
 * cada entrada COMPLETA (archivo + categoría + cantidad + conjunto exacto
 * de huellas) -- no solo si una huella individual ya era conocida en algún
 * sitio. Cualquier alta, baja, cambio de cantidad o de categoría para un
 * (archivo, categoría) exige regenerar el ledger explícitamente.
 * Devuelve { ok, secretosReales, discrepancias, resumenDeuda }. Nunca
 * imprime valores -- solo archivo/categoría/motivo/huella.
 */
export function verificar({ raiz, rutaLineaBase, rutaDeuda, archivos }) {
  const hallazgos = escanearArbol({ raiz, archivos });
  const secretosReales = hallazgos.filter((h) => h.tipo === 'secreto_real');

  const { doc: deudaDoc, mapa: mapaLineaBaseYDeuda } = (() => {
    const lb = cargarLedger(rutaLineaBase);
    const de = cargarLedger(rutaDeuda);
    const combinado = new Map([...lb.mapa, ...de.mapa]);
    return { doc: de.doc, mapa: combinado };
  })();

  const actual = agruparHallazgos(hallazgos.filter((h) => h.tipo === 'identificador_duplicado'));
  const mapaActual = new Map(actual.map((e) => [`${e.archivo} ${e.categoria}`, { cantidad: e.cantidad, huellas: new Set(e.huellas) }]));

  const discrepancias = [];
  const todasLasClaves = new Set([...mapaLineaBaseYDeuda.keys(), ...mapaActual.keys()]);
  for (const clave of todasLasClaves) {
    const [archivo, categoria] = clave.split(' ');
    const enLedger = mapaLineaBaseYDeuda.get(clave);
    const enActual = mapaActual.get(clave);

    if (enLedger && !enActual) {
      discrepancias.push({ archivo, categoria, motivo: 'registrado_en_ledger_pero_ya_no_aparece' });
    } else if (!enLedger && enActual) {
      discrepancias.push({ archivo, categoria, motivo: 'aparicion_nueva_fuera_de_ledger' });
    } else if (enLedger.cantidad !== enActual.cantidad) {
      discrepancias.push({ archivo, categoria, motivo: `cantidad_distinta_ledger_${enLedger.cantidad}_actual_${enActual.cantidad}` });
    } else if (!mismasHuellas(enLedger.huellas, enActual.huellas)) {
      discrepancias.push({ archivo, categoria, motivo: 'huellas_distintas' });
    }
  }

  return {
    ok: secretosReales.length === 0 && discrepancias.length === 0,
    secretosReales,
    discrepancias,
    resumenDeuda: deudaDoc.entradas,
  };
}

function analizarArgumentosCLI(argv) {
  const opciones = {};
  for (const arg of argv) {
    const m = arg.match(/^--([a-zA-Z-]+)=(.*)$/);
    if (m) opciones[m[1]] = m[2];
  }
  return opciones;
}

// --- CLI ---
if (process.argv[1] === __filename) {
  const modo = process.argv[2] || 'verificar';

  if (modo === 'regenerar-ledgers') {
    const opts = analizarArgumentosCLI(process.argv.slice(3));
    const raiz = opts.raiz ? path.resolve(opts.raiz) : RAIZ_REPO;
    const rutaLineaBase = opts['linea-base'] ? path.resolve(opts['linea-base']) : path.join(RAIZ_REPO, 'tools/seguridad/linea-base-aceptada.json');
    const rutaDeuda = opts.deuda ? path.resolve(opts.deuda) : path.join(RAIZ_REPO, 'tools/seguridad/deuda-identificadores-historicos.json');
    const archivos = opts['sin-git'] === 'true' ? listarArchivosRecursivo(raiz) : undefined;

    const hallazgos = escanearArbol({ raiz, archivos });
    const secretosReales = hallazgos.filter((h) => h.tipo === 'secreto_real');
    if (secretosReales.length > 0) {
      console.error('DETENIDO: se encontró un posible SECRETO REAL. No se regeneró ningún ledger.');
      for (const s of secretosReales) console.error(`  ${s.categoria} en ${s.archivo}:${s.linea} (huella ${s.huella})`);
      process.exit(2);
    }
    const { lineaBase, deuda } = separarEnLedgers(hallazgos);
    fs.writeFileSync(rutaLineaBase, JSON.stringify({
      descripcion: 'Coincidencias admitidas: término técnico, falso positivo o configuración pública legítima. Un project ref real o una clave publishable completa NUNCA se clasifican aquí como término técnico, sin importar el contexto sintáctico. Regenerar solo con "regenerar-ledgers" tras revisión manual. Nunca contiene valores, solo huellas no reversibles (sha256 truncado).',
      entradas: lineaBase,
    }, null, 2) + '\n');
    fs.writeFileSync(rutaDeuda, JSON.stringify({
      descripcion: 'Identificadores internos históricos (deuda de saneamiento): duplicación real de un project ref o una clave publishable completa fuera de sus ubicaciones de runtime legítimas, en contenido preexistente. No son secretos -- ninguno concede acceso por sí solo. No se corrigen en PM26 P02 (fuera de su alcance autorizado). Nunca contiene valores, solo huellas no reversibles (sha256 truncado).',
      entradas: deuda,
    }, null, 2) + '\n');
    console.log(`LEDGERS_REGENERADOS: linea_base=${lineaBase.length} archivos, deuda=${deuda.length} archivos`);
    process.exit(0);
  }

  if (modo === 'verificar') {
    const opts = analizarArgumentosCLI(process.argv.slice(3));
    const raiz = opts.raiz ? path.resolve(opts.raiz) : RAIZ_REPO;
    const rutaLineaBase = opts['linea-base'] ? path.resolve(opts['linea-base']) : path.join(RAIZ_REPO, 'tools/seguridad/linea-base-aceptada.json');
    const rutaDeuda = opts.deuda ? path.resolve(opts.deuda) : path.join(RAIZ_REPO, 'tools/seguridad/deuda-identificadores-historicos.json');
    const archivos = opts['sin-git'] === 'true' ? listarArchivosRecursivo(raiz) : undefined;

    const r = verificar({ raiz, rutaLineaBase, rutaDeuda, archivos });
    if (r.secretosReales.length > 0) {
      console.error('VERIFICAR_SECRETOS=FALLO: posible secreto real encontrado');
      for (const s of r.secretosReales) console.error(`  ${s.categoria} en ${s.archivo}:${s.linea} (huella ${s.huella})`);
      process.exit(2);
    }
    if (r.discrepancias.length > 0) {
      console.error('VERIFICAR_SECRETOS=FALLO: el árbol actual no coincide exactamente con la línea base y la deuda registradas');
      for (const d of r.discrepancias) console.error(`  ${d.categoria} en ${d.archivo}: ${d.motivo}`);
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
