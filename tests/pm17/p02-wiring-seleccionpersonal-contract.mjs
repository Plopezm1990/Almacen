import fs from 'node:fs';
import assert from 'node:assert/strict';

// PM17 P02: comprueba, por inspección estática del componente real SeleccionPersonal,
// que la neutralización quedó realmente conectada -- no basta con que existan las
// funciones nuevas si el JSX real sigue mostrando puntuaciones/recomendaciones.

const src = fs.readFileSync('fuente.js', 'utf8');
const iniComponente = src.indexOf('function SeleccionPersonal({');
assert.ok(iniComponente >= 0, 'SeleccionPersonal no encontrado');
const finComponente = src.indexOf('function ModalCrearCuenta(', iniComponente);
assert.ok(finComponente > iniComponente, 'no se pudo acotar SeleccionPersonal');
const cuerpo = src.slice(iniComponente, finComponente);

// ---- Informe de entrevista: usa el componente neutral, no vuelve a construir los
// bloques puntuados directamente en el JSX. ----
{
  assert.match(cuerpo, /import_react4\.default\.createElement\(InformeEntrevistaNeutralPM17, \{ inf \}\)/, 'verInforme debe delegar en InformeEntrevistaNeutralPM17');
  assert.doesNotMatch(cuerpo, /"Recomendaci\\xF3n final"/, 'no debe quedar la tarjeta de recomendación final en el JSX real');
  assert.doesNotMatch(cuerpo, /"Se\\xF1ales de riesgo"/, 'no debe quedar la tarjeta de señales de riesgo en el JSX real');
  assert.doesNotMatch(cuerpo, /"Competencias generales"/, 'no debe quedar la tarjeta de competencias generales en el JSX real');
  assert.doesNotMatch(cuerpo, /"Por qu\\xE9 esta confianza"/, 'no debe quedar la tarjeta de justificación de confianza en el JSX real');
  assert.match(cuerpo, /"Ver transcripci\\xF3n completa de la entrevista"/, 'la transcripción completa debe seguir disponible para revisión humana');
  console.log('P02_PM17_INFORME_ENTREVISTA_USA_COMPONENTE_NEUTRAL=PASS');
}

// ---- Modal de prefiltro: usa el componente neutral, no vuelve a construir Puntuación
// orientativa/Avisos/Recomendación directamente. ----
{
  assert.match(cuerpo, /import_react4\.default\.createElement\(ResumenPrefiltroNeutralPM17, \{ resumen: verResumenPrefiltro\.resumen \}\)/, 'el modal de prefiltro debe delegar en ResumenPrefiltroNeutralPM17');
  assert.doesNotMatch(cuerpo, /"Puntuaci\\xF3n orientativa/, 'no debe quedar la tarjeta de puntuación orientativa en el JSX real');
  assert.doesNotMatch(cuerpo, />, "Avisos"\)/, 'no debe quedar la tarjeta de avisos suelta en el JSX real');
  assert.match(cuerpo, /"Respuestas completas"/, 'las respuestas completas del candidato deben seguir visibles para revisión humana');
  console.log('P02_PM17_MODAL_PREFILTRO_USA_COMPONENTE_NEUTRAL=PASS');
}

// ---- Listados: sin insignias de puntuación/avisos, sin "Recomendado: <puesto>". ----
{
  assert.doesNotMatch(cuerpo, /p22\.resumen\.puntuacion_orientativa, "\/100"/, 'no debe quedar la insignia de puntuación en la lista de prefiltros');
  assert.doesNotMatch(cuerpo, /con avisos/, 'no debe quedar la insignia "con avisos" en la lista de prefiltros');
  assert.doesNotMatch(cuerpo, /Recomendado: \$\{e2\.informe/, 'no debe quedar el texto "Recomendado: <puesto>" en la lista de entrevistas');
  assert.match(cuerpo, /"Entrevista completada"/, 'la lista de entrevistas debe mostrar el estado neutral');
  console.log('P02_PM17_LISTADOS_SIN_PUNTUACION=PASS');
}

// ---- Textos introductorios: neutrales, sin "sustituye/descartar" ni "puntuado". ----
{
  assert.match(cuerpo, /No punt\\xFAa, no recomienda y no sustituye la entrevista\./, 'intro de prefiltro debe llevar el texto neutral');
  assert.match(cuerpo, /No debe punt\\xFAar, clasificar ni decidir una contrataci\\xF3n\./, 'intro de entrevista debe llevar el texto neutral');
  assert.doesNotMatch(cuerpo, /genera un informe puntuado/, 'no debe quedar el texto antiguo que anuncia un informe puntuado');
  console.log('P02_PM17_TEXTOS_INTRO_NEUTRALES=PASS');
}

console.log('PM17 P02 (wiring nativo) — SeleccionPersonal neutralizado de punta a punta: contrato OK');
