import fs from 'node:fs';
import assert from 'node:assert/strict';

// PM26 P01: contrato de INVENTARIO Y DIAGNÓSTICO. No certifica ninguna
// corrección -- certifica que el documento registra con precisión que no
// se aplicó ningún cambio, que las tres precisiones exigidas por el
// usuario están incorporadas, que los defectos reproducibles quedan
// listados sin resolver, y que no se publica ningún secreto ni
// identificador interno.

const doc = fs.readFileSync('tests/pm26/P01_INVENTARIO_DIAGNOSTICO.md', 'utf8');

// --- Estado inequívoco: inventario, no corrección ---
assert.match(doc, /Inventario y diagn[óo]stico\. No se ha corregido nada todav[íi]a/i);
assert.match(doc, /PM26_P01_ESTADO=INVENTARIO_COMPLETO_SIN_CORRECCIONES/);
assert.match(doc, /PM26_P01_CORRECCIONES_APLICADAS=NO/);
assert.match(doc, /PM26_P01_MAIN_TOCADO=NO/);
assert.match(doc, /PM26_P01_NETLIFY_MODIFICADO=NO/);
assert.match(doc, /PM26_P01_QA_ESCRITURA=NO/);
assert.match(doc, /PM26_P01_PRODUCCION_ESCRITURA=NO/);
assert.match(doc, /PM26_P01_TPV_TOCADO=NO/);

// --- Las tres precisiones exigidas antes de abrir PM26 están incorporadas ---
assert.match(doc, /no\s+demuestra\s+que\s+el\s+build\s+fuera\s+incapaz\s+de\s+red\s+o\s+escritura/i);
assert.match(doc, /no\s+se\s+encontr[óo]\s+evidencia\s+de\s+DDL\/DML/i);
assert.match(doc, /cubre\s+expl[íi]citamente\s+\*?\*?todo\s+el\s+JavaScript\s+servido/i);
assert.match(doc, /descargado\s+e\s+inspeccionado\s+directamente/i);
assert.match(doc, /clase\s+`?publishable`?/i);
assert.match(doc, /dise[ñn]ada expl[íi]citamente\s+para\s+exponerse en el cliente/i);

// --- Los diez puntos del alcance de P01 están presentes ---
const puntos = [
  /## 1\. Configuraci[óo]n real de build/i,
  /## 2\. Nombres y [áa]mbitos de variables de entorno/i,
  /## 3\. Secretos en todo el repositorio/i,
  /## 4\. Dependencias, versiones fijadas y lockfiles/i,
  /## 5\. Reproducibilidad del build/i,
  /## 6\. Recursos compilados frente a sus fuentes/i,
  /## 7\. Las siete reglas de cabeceras/i,
  /## 8\. Service worker, manifest, actualizaci[óo]n PWA y cach[ée]/i,
  /## 9\. Asesores de seguridad y rendimiento en QA\/test/i,
  /## 10\. Configuraci[óo]n que vincula `main` con producci[óo]n/i,
];
for (const patron of puntos) {
  assert.match(doc, patron, 'falta un punto obligatorio del alcance de PM26 P01: ' + patron);
}

// --- Defectos reproducibles quedan listados, no resueltos ---
assert.match(doc, /Resumen de defectos reproducibles \(sin corregir\)/i);
assert.match(doc, /No se corrigi[óo] ninguno de los defectos A-H/i);
assert.match(doc, /bash\s+\*?\*?no\*?\*?\s+aplica\s+la\s+salida\s+por\s+error\s+a\s+un\s+comando\s+negado\s+con\s+`!`/i);
assert.match(doc, /if\s+grep\s+…;\s+then\s+exit\s+1;\s+fi/i);
assert.match(doc, /No se actualiz[óo] ninguna dependencia para silenciar avisos/i);

// --- La propuesta de separación integración\/publicación está presente pero no aplicada ---
assert.match(doc, /Propuesta exacta para separar integraci[óo]n y publicaci[óo]n \(NO aplicada\)/i);
assert.match(doc, /Riesgos de aplicarlo/i);
assert.match(doc, /Reversi[óo]n/i);
assert.match(doc, /Esta propuesta \*?\*?no se ha aplicado\*?\*?/i);

// --- PM25 P02 sigue arrastrado ---
assert.match(doc, /PM25 P02 sigue \*?\*?PARCIAL\/BLOQUEADO/i);

// --- Sin VALORES de secreto ni identificadores internos publicados ---
// (nombrar el patrón buscado, p.ej. "service_role_key", es metodología
// legítima y no una fuga; lo que no debe aparecer es un VALOR real)
const patronesValorSecreto = [
  /sb_publishable_[A-Za-z0-9_-]{10,}/,
  /sb_secret_[A-Za-z0-9_-]{10,}/i,
  /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/,
  /qjqorixtkilwsndqayyx/,
  /cqtghwiuxrqrxupyonqf/,
  /flqercbgpgmmfaakrwkc/,
];
for (const patron of patronesValorSecreto) {
  assert.doesNotMatch(doc, patron, 'no debe publicarse un valor real de clave o identificador interno: ' + patron);
}

console.log('PM26_P01_INVENTARIO_VERIFICADO=PASS');
console.log('PM26_P01_SIN_SECRETOS=PASS');
console.log('PM26 P01 — inventario y diagnóstico: contrato OK (no certifica corrección)');
