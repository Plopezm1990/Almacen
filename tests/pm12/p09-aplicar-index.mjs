import fs from 'node:fs';

const path = new URL('../../index.html', import.meta.url);
const source = fs.readFileSync(path, 'utf8');
const tag = '<script src="./pm12-p09-historial-informes-movil-v1.js"></script>';
const anchor = '<script src="pm12-stock-atomico-v1.js"></script>';

const existing = source.split(tag).length - 1;
if (existing > 1) throw new Error('P09_INDEX_DUPLICADO');
if (existing === 1) {
  console.log('P09_INDEX_YA_INTEGRADO=PASS');
  process.exit(0);
}
if (!source.includes(anchor)) throw new Error('P09_INDEX_ANCLA_NO_ENCONTRADA');

const updated = source.replace(anchor, anchor + '\n' + tag);
if (updated === source) throw new Error('P09_INDEX_SIN_CAMBIO');
fs.writeFileSync(path, updated, 'utf8');
console.log('P09_INDEX_INTEGRADO=PASS');
