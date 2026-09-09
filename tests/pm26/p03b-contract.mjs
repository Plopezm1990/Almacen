import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { escanearArbol } from '../../tools/seguridad/verificar-secretos-e-identificadores.mjs';
import { ANCLAS_OBLIGATORIAS_AMPLIADAS } from '../../source-recovery/verificar-build-canonico.mjs';

// PM26 P03b: contrato de la INTEGRACIÓN real -- fuente canónica
// actualizada (PM14-PM25) + gate permanente de build. No certifica que el
// build sea byte a byte idéntico a fuente.js (comprobado y documentado
// como no alcanzable en PM26_P03B_CIERRE.md); certifica que el gate real
// se comporta como describe el informe: build real + node --check +
// anclas de negocio en orden, con código de salida real de proceso, y
// que falla ante una divergencia real. También certifica, de forma
// estructural, que nada de lo nuevo contiene un secreto o identificador
// interno real, y que fuente.js real, index.html, main, Netlify y
// Supabase no fueron tocados por este paquete.

const __filename = fileURLToPath(import.meta.url);
const RAIZ_REPO = path.resolve(path.dirname(__filename), '..', '..');
const DIR_RECOVERY = path.join(RAIZ_REPO, 'source-recovery');
const FUENTE_RECUPERADA = path.join(DIR_RECOVERY, 'fuente-recuperado.js');
const CONTENIDO_INICIAL_FUENTE_RECUPERADA = fs.readFileSync(FUENTE_RECUPERADA, 'utf8');

function backup(rutaAbs) {
  const original = fs.readFileSync(rutaAbs, 'utf8');
  return () => fs.writeFileSync(rutaAbs, original);
}

// --- Prueba positiva: el gate real, sobre el repositorio real, termina
// con código de salida 0. ---
{
  const r = spawnSync('node', ['verificar-build-canonico.mjs'], { cwd: DIR_RECOVERY, encoding: 'utf8' });
  assert.equal(r.status, 0, `esperado código de salida 0 del gate de build canónico, obtenido ${r.status}\n${r.stdout}\n${r.stderr}`);
  assert.match(r.stdout, /VERIFICAR_BUILD_CANONICO=PASS/);
  assert.match(r.stdout, new RegExp(`ANCLAS_VERIFICADAS=${ANCLAS_OBLIGATORIAS_AMPLIADAS.length}`));
  console.log('PM26_P03B_GATE_POSITIVO=PASS (código de salida 0, build real + anclas verificadas)');
}

// --- Negativa 1: si falta una ancla de negocio (lógica perdida), el gate
// falla explícitamente -- probado sobre el árbol real, restaurado siempre
// antes de continuar (incluso si la aserción falla). ---
{
  const restaurar = backup(FUENTE_RECUPERADA);
  try {
    const original = fs.readFileSync(FUENTE_RECUPERADA, 'utf8');
    assert.ok(original.includes('function ErroresSistema('));
    const saboteado = original.replace('function ErroresSistema(', 'function ErroresSistemaRenombradaPruebaPM26(');
    assert.notEqual(saboteado, original);
    fs.writeFileSync(FUENTE_RECUPERADA, saboteado);

    const r = spawnSync('node', ['verificar-build-canonico.mjs'], { cwd: DIR_RECOVERY, encoding: 'utf8' });
    assert.notEqual(r.status, 0, `esperado código de salida distinto de cero con una ancla eliminada, obtenido ${r.status}`);
    assert.match(r.stderr, /ancla_obligatoria_ausente: function ErroresSistema\(/);
  } finally {
    restaurar();
  }
  console.log('PM26_P03B_NEGATIVA_1_ANCLA_AUSENTE=PASS (código de salida distinto de cero, árbol restaurado)');
}

// --- Negativa 2: si la fuente canónica tiene un error de sintaxis, el
// build falla y el gate lo refleja con código de salida distinto de
// cero. ---
{
  const restaurar = backup(FUENTE_RECUPERADA);
  try {
    fs.appendFileSync(FUENTE_RECUPERADA, '\nfunction estoRompeElSintaxisPruebaPM26( { {{\n');
    const r = spawnSync('node', ['verificar-build-canonico.mjs'], { cwd: DIR_RECOVERY, encoding: 'utf8' });
    assert.notEqual(r.status, 0, `esperado código de salida distinto de cero con un error de sintaxis, obtenido ${r.status}`);
    assert.match(r.stdout + r.stderr, /VERIFICAR_BUILD_CANONICO=FALLO/);
  } finally {
    restaurar();
  }
  console.log('PM26_P03B_NEGATIVA_2_SINTAXIS_ROTA=PASS (código de salida distinto de cero, árbol restaurado)');
}

// --- Confirmar que el árbol quedó exactamente restaurado tras las
// pruebas negativas (ninguna sabotea permanentemente el repositorio). ---
{
  const contenidoFinal = fs.readFileSync(FUENTE_RECUPERADA, 'utf8');
  assert.equal(contenidoFinal, CONTENIDO_INICIAL_FUENTE_RECUPERADA, 'fuente-recuperado.js debe quedar exactamente como estaba antes de las pruebas negativas de este contrato');
  console.log('PM26_P03B_ARBOL_RESTAURADO=PASS');
}

// --- Verificación ESTRUCTURAL de que los archivos nuevos de P03b no
// contienen ningún secreto real ni identificador interno fuera de una
// ubicación legítima. ---
{
  const archivosNuevosP03b = [
    'source-recovery/recuperar_candidato_p03b.py',
    'source-recovery/verificar-build-canonico.mjs',
    'source-recovery/PM26_P03B_CIERRE.md',
    'source-recovery/PM26_P03B_EVIDENCIA.json',
    'tests/pm26/p03b-contract.mjs',
  ];
  const hallazgos = escanearArbol({ raiz: RAIZ_REPO, archivos: archivosNuevosP03b, ubicacionesLegitimas: [] });
  const secretosReales = hallazgos.filter((h) => h.tipo === 'secreto_real');
  const identificadoresNoAdmitidos = hallazgos.filter(
    (h) => h.tipo === 'identificador_duplicado' && h.categoria !== 'falso_positivo'
  );
  assert.equal(secretosReales.length, 0, 'los archivos nuevos de P03b no deben contener ningún secreto real');
  assert.equal(
    identificadoresNoAdmitidos.length,
    0,
    'los archivos nuevos de P03b no deben contener ningún candidato a identificador interno real fuera de una ubicación legítima -- encontrado en: ' +
      identificadoresNoAdmitidos.map((h) => `${h.archivo}:${h.linea} (${h.categoria})`).join(', ')
  );
  console.log('PM26_P03B_SIN_SECRETOS_NI_IDENTIFICADORES_ESTRUCTURAL=PASS');
}

// --- Los 4 contratos corregidos en esta misma ronda de P03b (PM05, PM07,
// PM08, PM09 -- rotos por regenerar fuente-recuperado.js) deben pasar
// como procesos reales, con código de salida 0, sobre el repositorio
// real. Esto certifica que la corrección quedó realmente aplicada, no
// solo documentada. ---
{
  const contratosCorregidos = [
    'tests/pm05/frontend-contract.mjs',
    'tests/pm07/frontend-contract.mjs',
    'tests/pm08/frontend-contract.mjs',
    'tests/pm09/p17-robustness-contract.mjs',
  ];
  for (const contrato of contratosCorregidos) {
    const r = spawnSync('node', [contrato], { cwd: RAIZ_REPO, encoding: 'utf8' });
    assert.equal(r.status, 0, `esperado código de salida 0 en ${contrato} tras la corrección, obtenido ${r.status}\n${r.stdout}\n${r.stderr}`);
  }
  console.log('PM26_P03B_CONTRATOS_PM05_PM07_PM08_PM09_CORREGIDOS_PASAN=PASS');
}

// --- Lo que NO cambió respecto al cierre previo de la rama (PM26 P02,
// 1060e2f): fuente.js real, index.html, recuperar_candidato.py (PM01),
// README.md y PM01_CIERRE.md no fueron tocados por este paquete. ---
{
  const intocables = [
    'fuente.js',
    'index.html',
    'source-recovery/recuperar_candidato.py',
    'source-recovery/README.md',
    'source-recovery/PM01_CIERRE.md',
  ];
  const r = spawnSync('git', ['diff', '--name-only', '1060e2f5ec26cb4175150df449c95f7504c32df7..HEAD'], { cwd: RAIZ_REPO, encoding: 'utf8' });
  const cambiados = new Set(r.stdout.trim().split('\n').filter(Boolean));
  for (const archivo of intocables) {
    assert.ok(!cambiados.has(archivo), `PM26 P03b no debe tocar: ${archivo}`);
  }
  console.log('PM26_P03B_INTOCABLES_VERIFICADOS=PASS');
}

// --- El informe de cierre documenta con precisión el diagnóstico y que
// nada de lo prohibido fue tocado. ---
const doc = fs.readFileSync(path.join(DIR_RECOVERY, 'PM26_P03B_CIERRE.md'), 'utf8');

assert.match(doc, /PM26_P03B_ESTADO=EJECUTADO_Y_CERRADO/);
assert.match(doc, /PM26_P03B_FUENTE_RECUPERADA_ACTUALIZADA=SI/);
assert.match(doc, /PM26_P03B_PARIDAD_CUERPO_EXACTA=SI/);
assert.match(doc, /PM26_P03B_BUILD_BYTE_A_BYTE_CONTRA_FUENTE_JS=NO_ALCANZABLE_DOCUMENTADO/);
assert.match(doc, /PM26_P03B_GATE_PERMANENTE_CREADO=SI/);
assert.match(doc, /PM26_P03B_FUENTE_JS_REAL_TOCADO=NO/);
assert.match(doc, /PM26_P03B_INDEX_HTML_TOCADO=NO/);
assert.match(doc, /PM26_P03B_MAIN_TOCADO=NO/);
assert.match(doc, /PM26_P03B_NETLIFY_SUPABASE_TOCADO=NO/);
assert.match(doc, /PM26_P03B_RECUPERAR_CANDIDATO_PY_TOCADO=NO/);
assert.match(doc, /PM26_P03B_CONTRATOS_PM05_PM07_PM08_PM09_CORREGIDOS=SI/);
assert.match(doc, /PM26_P03B_REGRESIONES_FUNCIONALES_REALES_ENCONTRADAS=0/);
assert.match(doc, /PM26_P03B_DOCUMENTACION_HISTORICA_PM05_PM09_TOCADA=NO/);

// La honestidad sobre la NO reproducibilidad byte a byte está presente,
// no maquillada.
assert.match(doc, /NO es byte-id[ée]ntico/i);
assert.match(doc, /no es alcanzable/i);
assert.match(doc, /produc(e|iría)\s+fallos\s+falsos\s+permanentes/i);

// La precisión sobre lo que demuestra (y no demuestra) la igualdad de
// hashes está presente -- no se afirma que el hash por sí solo demuestre
// que el límite es correcto.
assert.match(doc, /no demuestra por s[íi] sola que ese tramo\s*\n?\s*sea el l[íi]mite correcto/i);
assert.match(doc, /el l[íi]mite no es la causa de los 6 fallos/i);

// La sección 7 documenta la corrección de los 4 contratos con causa raíz
// identificada, sin maquillar como "regresión funcional".
assert.match(doc, /## 7\.\s+Corrección de contratos/i);
assert.match(doc, /ninguno es\s*\n?\s*una regresión funcional real/i);
assert.match(doc, /backreference/i);
assert.match(doc, /definida en la migración\s*\n?\s*versionada/i);
assert.doesNotMatch(doc, /verificada en backend real/i);

// Las 11 anclas están documentadas.
for (const ancla of ANCLAS_OBLIGATORIAS_AMPLIADAS) {
  assert.ok(doc.includes(ancla), `falta documentar el ancla ${ancla} en el informe de cierre`);
}

// PM25 P02 sigue arrastrado; defectos B-H siguen pendientes.
assert.match(doc, /PM25 P02 contin[úu]a \*?\*?PARCIAL\/BLOQUEADO\*?\*?/i);
assert.match(doc, /defectos\s+B[\s\S]{0,10}H[\s\S]{1,40}permanecen\s+pendientes/i);

console.log('PM26_P03B_DOC_VERIFICADO=PASS');
console.log('PM26 P03b — integración real de la fuente canónica y gate permanente: contrato OK');
