#!/usr/bin/env node
// PM26 P03b — gate permanente de la fuente canónica.
//
// Verifica, en la dirección fuente canónica -> build -> ¿es consistente?,
// SIN volver a extraer nunca el cuerpo desde fuente.js para compararse
// contra sí mismo (la validación circular que el usuario advirtió que no
// se puede hacer). Concretamente:
//   1. `npm run build` (esbuild sobre entrada-recuperada.js) debe terminar
//      con éxito.
//   2. El resultado del build debe ser JavaScript sintácticamente válido.
//   3. Todas las anclas de negocio conocidas (las mismas que usa
//      recuperar_candidato_p03b.py para validar la recuperación PM14-PM25)
//      deben aparecer en el build, EN EL MISMO ORDEN.
//
// Lo que este gate NO hace, documentado honestamente en
// PM26_P03B_CIERRE.md: NO compara el build byte a byte ni línea a línea
// contra el fuente.js committeado. Un experimento real (PM26 P03b, sección
// "Diagnóstico de reproducibilidad") demostró que un build limpio desde la
// fuente canónica NO es byte-idéntico al fuente.js actual -- esbuild
// recorta algunos comentarios de línea y renombra variables locales de
// forma distinta según la composición global del bundle (p.ej. un
// parámetro `f2` puede pasar a llamarse `f22`) -- sin que eso represente
// ninguna pérdida de lógica de aplicación. Exigir una comparación byte a
// byte aquí produciría fallos falsos permanentes, no señal real.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const DIR_RECOVERY = path.dirname(__filename);
const DIST = path.join(DIR_RECOVERY, 'dist', 'fuente.js');

// Debe coincidir exactamente con ANCLAS_OBLIGATORIAS_AMPLIADAS en
// recuperar_candidato_p03b.py (misma lista, mismo orden).
export const ANCLAS_OBLIGATORIAS_AMPLIADAS = [
  'motivoFalloCargaPM16',
  'function GestionAlmacen(',
  'cambiarTabPM15',
  '__contextoErroresPM20',
  'bloqueadoPorNubeActivaPM25',
  'validarRegistroAppccPM19',
  'function crearLogicaCaja(',
  'activarSuscripcionPushPM17',
  'function ErroresSistema(',
  'estadoIdentidadFiscalPM18',
  'bloqueadoPorEnvioDuplicadoPM24',
];

export function verificarAnclasEnOrden(texto, anclas = ANCLAS_OBLIGATORIAS_AMPLIADAS) {
  const lineas = texto.split('\n');
  const encontradas = {};
  let ultima = -1;
  for (const nombre of anclas) {
    let posicion = null;
    for (let j = 0; j < lineas.length; j++) {
      if (lineas[j].includes(nombre)) {
        posicion = j;
        break;
      }
    }
    if (posicion === null) {
      throw new Error(`ancla_obligatoria_ausente: ${nombre}`);
    }
    if (posicion <= ultima) {
      throw new Error(`ancla_fuera_de_orden: ${nombre} (línea ${posicion + 1})`);
    }
    encontradas[nombre] = posicion + 1;
    ultima = posicion;
  }
  return encontradas;
}

function main() {
  execFileSync('npm', ['run', 'build'], { cwd: DIR_RECOVERY, stdio: 'inherit' });

  if (!fs.existsSync(DIST)) {
    throw new Error('build_sin_salida: no se generó dist/fuente.js');
  }

  execFileSync('node', ['--check', DIST], { stdio: 'inherit' });

  const texto = fs.readFileSync(DIST, 'utf8');
  const anclas = verificarAnclasEnOrden(texto);

  console.log('BUILD_CANONICO_OK=1');
  console.log(`ANCLAS_VERIFICADAS=${Object.keys(anclas).length}`);
  console.log('VERIFICAR_BUILD_CANONICO=PASS');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    main();
  } catch (e) {
    console.error(`VERIFICAR_BUILD_CANONICO=FALLO: ${e.message}`);
    process.exit(1);
  }
}
