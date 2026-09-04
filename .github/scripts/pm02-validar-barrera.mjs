import fs from 'node:fs';
import vm from 'node:vm';

const codigo = fs.readFileSync('reset-pruebas-preview.js', 'utf8');
const PROD = 'flqercbgpgmmfaakrwkc.supabase.co';

function localStorageFake() {
  const m = new Map();
  return {
    get length() { return m.size; },
    key(i) { return [...m.keys()][i] ?? null; },
    getItem(k) { return m.has(k) ? m.get(k) : null; },
    setItem(k, v) { m.set(String(k), String(v)); },
    removeItem(k) { m.delete(k); }
  };
}

async function probar(hostname, debeSerPreview) {
  let llamadasRed = 0;
  const window = {
    location: { hostname, href: `https://${hostname}/` },
    localStorage: localStorageFake(),
    URL,
    console,
    fetch: async (input) => {
      llamadasRed++;
      return { ok: true, input };
    }
  };
  window.window = window;

  const ctx = vm.createContext({ window, localStorage: window.localStorage, URL, console });
  vm.runInContext(codigo, ctx, { filename: 'reset-pruebas-preview.js' });

  if (debeSerPreview) {
    if (window.__modoPruebasLocal !== true) throw new Error(`${hostname}: modo QA no activo`);
    if (window.__qaFetchProduccionBloqueado !== true) throw new Error(`${hostname}: wrapper no instalado`);
    try {
      await window.fetch(`https://${PROD}/rest/v1/__pm02_probe`);
      throw new Error(`${hostname}: fetch productivo resolvio`);
    } catch (e) {
      if (!String(e?.message || e).includes('QA_BLOCKED_PRODUCTION_SUPABASE')) throw e;
    }
    if (llamadasRed !== 0) throw new Error(`${hostname}: la peticion productiva alcanzo fetch original`);

    await window.fetch('https://cdn.tailwindcss.com/');
    if (llamadasRed !== 1) throw new Error(`${hostname}: trafico no productivo bloqueado por error`);
  } else {
    if (window.__modoPruebasLocal === true) throw new Error(`${hostname}: QA activado fuera de Preview`);
    if (window.__qaFetchProduccionBloqueado === true) throw new Error(`${hostname}: wrapper instalado fuera de Preview`);
    await window.fetch(`https://${PROD}/rest/v1/__pm02_probe`);
    if (llamadasRed !== 1) throw new Error(`${hostname}: comportamiento normal alterado`);
  }

  return { hostname, debeSerPreview, llamadasRed };
}

const resultados = [];
resultados.push(await probar('deploy-preview-13--chic-entremet-9107cf.netlify.app', true));
resultados.push(await probar('6a9a7afd0fe79b0009cac69b--chic-entremet-9107cf.netlify.app', true));
resultados.push(await probar('chic-entremet-9107cf.netlify.app', false));
resultados.push(await probar('main--chic-entremet-9107cf.netlify.app', false));

console.log(JSON.stringify(resultados, null, 2));
console.log('PM02_BARRERA_FETCH_OK=1');
console.log('PM02_PRODUCCION_NO_AFECTADA=1');
