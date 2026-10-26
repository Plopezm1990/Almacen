import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';

const root = resolve(import.meta.dirname, '../..');
const qrSource = readFileSync(resolve(root, 'fiscal-qr.js'), 'utf8');
const index = readFileSync(resolve(root, 'index.html'), 'utf8');
const app = readFileSync(resolve(root, 'fuente.js'), 'utf8');
const migration = readFileSync(resolve(root, 'supabase/migrations/20261026160000_abc_p18_qa_fiscal_qr_ticket.sql'), 'utf8');

if (!index.includes('<script src="./fiscal-qr.js"></script>')) throw new Error('El renderer QR no está cargado en index.html');
if (index.indexOf('./fiscal-qr.js') > index.indexOf('./fuente.js')) throw new Error('El renderer QR debe cargarse antes del bundle TPV');
for (const fragment of [
  'global.LA_FISCAL_QR',
  'function svgForUrl',
  'const RS_BLOCKS_M',
  'error correction M'
]) {
  if (!qrSource.includes(fragment)) throw new Error(`Falta renderer QR local: ${fragment}`);
}
for (const fragment of [
  'abc_preparar_ticket_fiscal_qa',
  'checkout_ventas',
  'abc_fiscal_qr_documentos',
  'ticketFiscalQrReady',
  'QR tributario preparado',
  'No se puede imprimir el ticket fiscal'
]) {
  if (!app.includes(fragment)) throw new Error(`Falta integración del ticket QR en TPV: ${fragment}`);
}
if (!migration.includes("'https://prewww2.aeat.es/wlpl/TIKE-CONT/ValidarQR?nif='")) throw new Error('La URL AEAT de pruebas no está en el contrato servidor');

const sandbox = { TextEncoder, globalThis: {} };
vm.runInNewContext(qrSource, sandbox, { filename: 'fiscal-qr.js' });
const url = 'https://prewww2.aeat.es/wlpl/TIKE-CONT/ValidarQR?nif=Q1234567A&numserie=TPV-000123&fecha=26-10-2026&importe=123.45';
const svg = sandbox.globalThis.LA_FISCAL_QR.svgForUrl(url, { size: 220 });
if (!svg.startsWith('<svg ') || !svg.includes('viewBox=') || !svg.includes('<path ') || !svg.includes('fill="#000"')) {
  throw new Error('El renderer no devuelve un SVG QR utilizable');
}
if ((svg.match(/M/g) || []).length < 100) throw new Error('El SVG QR no contiene suficientes módulos oscuros');

console.log('PASS: renderer e integración QR fiscal TPV QA P18');
