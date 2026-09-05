import fs from 'node:fs';
import assert from 'node:assert/strict';

const candidatePath = 'fuente.js';
const recoveredPath = 'source-recovery/fuente-recuperado.js';
const historicalEvidencePath = 'docs/plan-maestro/PM02_LA023_EVIDENCIA.txt';
const decisionsPath = 'docs/plan-maestro/PM03_CONTRATOS_MINIMOS_PROPUESTA.md';

for (const path of [candidatePath, recoveredPath, historicalEvidencePath, decisionsPath]) {
  assert.equal(fs.existsSync(path), true, `Falta archivo requerido: ${path}`);
}

const candidate = fs.readFileSync(candidatePath, 'utf8');
const recovered = fs.readFileSync(recoveredPath, 'utf8');
const historicalEvidence = fs.readFileSync(historicalEvidencePath, 'utf8');
const decisions = fs.readFileSync(decisionsPath, 'utf8');

const localText = String.raw`Est\xE1s trabajando solo en este equipo, sin sincronizaci\xF3n`;
const cloudText = String.raw`Los cambios se intentan sincronizar con tu cuenta`;
const cloudFailureText = String.raw`si alguna escritura no se confirma, el programa mostrar\xE1 el error`;
const cloudCondition = 'window.__nubeActiva === true';
const oldFalsePromise = String.raw`Todo lo que capturas en este programa ya se guarda autom\xE1ticamente en tu cuenta`;
const oldCrossDevicePromise = String.raw`ver\xE1s la misma informaci\xF3n`;

function hasHonestCopy(source) {
  return source.includes(localText)
    && source.includes(cloudText)
    && source.includes(cloudFailureText)
    && source.includes(cloudCondition);
}

const checks = {
  candidato_texto_honesto: hasHonestCopy(candidate),
  fuente_recuperada_texto_honesto: hasHonestCopy(recovered),
  candidato_sin_promesa_antigua: !candidate.includes(oldFalsePromise)
    && !candidate.includes(oldCrossDevicePromise)
    && !candidate.includes('ya se guarda autom'),
  fuente_recuperada_sin_promesa_antigua: !recovered.includes(oldFalsePromise)
    && !recovered.includes(oldCrossDevicePromise)
    && !recovered.includes('ya se guarda autom'),
  modo_local_es_predeterminado_si_nube_no_activa: candidate.includes(`typeof window !== "undefined" && ${cloudCondition} ?`)
    || candidate.includes(`typeof window!=="undefined"&&${cloudCondition}?`),
  evidencia_pm02_preservada: historicalEvidence.includes('PM02_LA023_OK=1')
    && historicalEvidence.includes('MODO_LOCAL_TEXTO_HONESTO=1')
    && historicalEvidence.includes('MODO_NUBE_SIN_PROMESA_DE_CONFIRMACION=1'),
  dec03_autoridad_backend: decisions.includes('El backend es la autoridad para operaciones compartidas')
    && decisions.includes('Sin conexión confirmable se pueden consultar datos locales y preparar borradores, pero no se confirman mutaciones críticas.'),
  dec03_comunicacion_honesta: decisions.includes('La interfaz no puede afirmar `sincronizado/guardado en la cuenta` antes de confirmación real del backend.')
    && decisions.includes('Si queda pendiente, debe mostrarse como pendiente/no confirmado.')
};

for (const [name, passed] of Object.entries(checks)) {
  console.log(`G1_P04_${name.toUpperCase()}=${passed ? 1 : 0}`);
  if (!passed) process.exitCode = 1;
}

if (process.exitCode) throw new Error('G1_P04_LA023_CONTRACT_FAIL');
console.log(`G1_P04_CHECKS=${Object.keys(checks).length}`);
console.log('G1_P04_LA023_CONTRACT_OK=1');
