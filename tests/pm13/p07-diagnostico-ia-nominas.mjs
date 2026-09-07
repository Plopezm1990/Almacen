import fs from 'node:fs';

const source = fs.readFileSync('fuente.js', 'utf8');
const lower = source.toLowerCase();

const terms = [
  'nomina', 'nómina', 'nominas', 'nóminas', 'setNominas',
  'inteligencia artificial', ' ia ', 'generarNomina', 'generar nómina',
  'aprobar', 'validar', 'revisar', 'borrador', 'sintetic', 'simulad'
];

function snippets(term, max = 8, radius = 900) {
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

const result = {
  sourceLength: source.length,
  terms: Object.fromEntries(terms.map(t => [t, snippets(t)])),
  flags: {
    hasSetNominas: source.includes('setNominas'),
    hasAprobar: lower.includes('aprobar'),
    hasBorrador: lower.includes('borrador'),
    hasRevisionHumanaLiteral: lower.includes('revisión humana') || lower.includes('revision humana'),
    hasGenerarNominaLiteral: lower.includes('generar nómina') || lower.includes('generar nomina'),
    hasSinteticaLiteral: lower.includes('sintétic') || lower.includes('sintetic'),
    hasIAVisible: lower.includes('inteligencia artificial') || /(^|[^a-záéíóúñ])ia([^a-záéíóúñ]|$)/i.test(source)
  }
};

fs.writeFileSync('tests/pm13/P07_DIAGNOSTICO_IA_NOMINAS.json', JSON.stringify(result, null, 2) + '\n');
console.log('PM13_P07_DIAGNOSTICO=PASS');
console.log(JSON.stringify(result.flags));
