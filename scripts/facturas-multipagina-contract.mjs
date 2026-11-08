import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const repo = process.cwd();
const runtimes = [
  join(repo, 'fuente.js'),
  join(repo, 'source-recovery', 'fuente-recuperado.js'),
];

for (const runtime of runtimes) {
  const source = readFileSync(runtime, 'utf8');
  assert.match(source, /function convertirPDFFacturaAImagenes\(file\)/, `${runtime}: falta conversión de PDF`);
  assert.match(source, /pdfjs-p3-invoice\.mjs/, `${runtime}: falta PDF.js local`);
  assert.match(source, /multiple: true/, `${runtime}: el selector no acepta varias páginas`);
  assert.match(source, /seleccionarArchivos/, `${runtime}: falta selector multipágina`);
  assert.match(source, /imagenes: archivosIA\.map/, `${runtime}: la IA no recibe todas las páginas`);
  assert.doesNotMatch(source, /Para leer con IA usa una foto o imagen de la factura\. El PDF puede quedar adjunto/, `${runtime}: sigue bloqueando PDF`);
  execFileSync(process.execPath, ['--check', runtime], { cwd: repo, stdio: 'pipe' });
}

console.log('FACTURAS_MULTIPAGINA_CONTRACT_PASS');
