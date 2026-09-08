import fs from 'node:fs';

const source = fs.readFileSync('fuente.js', 'utf8');
const lower = source.toLowerCase();

const terms = [
  'function crearLogicaNominas', 'addNomina', 'updateNomina', 'deleteNomina',
  'importar-nomina', 'function Nominas', 'Nóminas', 'Nominas',
  'inteligencia artificial', 'generar nómina', 'generar nomina',
  'aprobar nómina', 'aprobar nomina', 'revisión humana', 'revision humana',
  'borrador', 'sintétic', 'sintetic', 'simulad'
];

function snippets(term, max = 4, radius = 2600) {
  const needle = term.toLowerCase();
  const out = [];
  let pos = 0;
  while (out.length < max) {
    const i = lower.indexOf(needle, pos);
    if (i < 0) break;
    out.push({
      offset: i,
      snippet: source.slice(Math.max(0, i - radius), Math.min(source.length, i + term.length + radius))
    });
    pos = i + Math.max(1, needle.length);
  }
  return out;
}

function section(marker, before = 5000, after = 14000) {
  const i = source.indexOf(marker);
  if (i < 0) return `NO ENCONTRADO: ${marker}\n`;
  return source.slice(Math.max(0, i - before), Math.min(source.length, i + marker.length + after));
}

const result = {
  sourceLength: source.length,
  terms: Object.fromEntries(terms.map(t => [t, snippets(t)])),
  flags: {
    hasCrearLogicaNominas: source.includes('function crearLogicaNominas'),
    hasImportarNomina: source.includes('importar-nomina'),
    hasAprobarNominaLiteral: lower.includes('aprobar nómina') || lower.includes('aprobar nomina'),
    hasRevisionHumanaLiteral: lower.includes('revisión humana') || lower.includes('revision humana'),
    hasBorrador: lower.includes('borrador'),
    hasSinteticaLiteral: lower.includes('sintétic') || lower.includes('sintetic'),
    hasSimuladaLiteral: lower.includes('simulad'),
    hasIAVisible: lower.includes('inteligencia artificial') || /(^|[^a-záéíóúñ])ia([^a-záéíóúñ]|$)/i.test(source)
  }
};

const extract = [
  '===== MOTOR NOMINAS =====',
  section('function crearLogicaNominas', 1000, 7000),
  '===== IMPORTACION IA / UI =====',
  section('async function importarNominaConIA', 7000, 18000),
  '===== RENDER NOMINAS =====',
  section('addNomina, updateNomina, deleteNomina', 5000, 16000)
].join('\n\n');

fs.writeFileSync('tests/pm13/P07_DIAGNOSTICO_IA_NOMINAS.json', JSON.stringify(result, null, 2) + '\n');
fs.writeFileSync('tests/pm13/P07_EXTRACT_NOMINAS.txt', extract + '\n');
console.log('PM13_P07_DIAGNOSTICO=PASS');
console.log(JSON.stringify(result.flags));
