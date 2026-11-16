import fs from 'node:fs';
import assert from 'node:assert/strict';

// PM17 P05: la entrevista de selección (per-21), ejercitada en QA con una entrevista de
// ensayo.
//
// Lo que se midió, pulsando "Empezar entrevista": la pantalla respondía "No se ha podido
// conectar con la IA. Comprueba tu conexión e inténtalo otra vez.". La conexión no tenía
// nada que ver. La consola del navegador dice, en este orden:
//
//   [QA] Edge Function redirigida a QA: entrevista-personal -> entrevista-personal
//   Access to fetch at 'https://qjqorixtkilwsndqayyx.supabase.co/functions/v1/
//   entrevista-personal' ... blocked by CORS policy: Response to preflight request
//   doesn't pass access control check: It does not have HTTP ok status.
//
// Es decir: la llamada SÍ se redirige al proyecto de QA, y lo que falla es que esa
// función no responde ahí (su fuente tampoco está en este repositorio, así que no se
// despliega desde aquí). Mandar al usuario a revisar su wifi por eso le hace perder la
// tarde buscando donde no es.
//
// Aparte, resp.json() revienta cuando la respuesta no es JSON -un 404 devuelve una
// página-, así que ese fallo caía en el mismo catch y salía con el mismo texto.

const src = fs.readFileSync('fuente.js', 'utf8');

const ini = src.indexOf('async function llamarIA(entrevistaId, historial, finalizar, candidatoNombre) {');
assert.ok(ini >= 0, 'llamarIA no encontrada');
const fin = src.indexOf('function empezar() {', ini);
assert.ok(fin > ini, 'no encuentro el final de llamarIA');
const cuerpo = src.slice(ini, fin);

// ---- 1. Una respuesta que no se puede leer ya no se confunde con un fallo de red. ----
{
  assert.match(cuerpo, /try \{\s*r2 = await resp\.json\(\);\s*\} catch \{\s*r2 = null;\s*\}/, 'resp.json() tiene que poder fallar sin arrastrar el error al catch general');
  assert.match(cuerpo, /if \(!resp\.ok \|\| !r2\) \{/, 'y hay que mirar el estado de la respuesta, no solo su contenido');
  assert.match(cuerpo, /\$\{resp\.status\}/, 'el aviso debe decir con qué contestó el servidor');
  assert.match(cuerpo, /No es tu conexi\\xF3n: esto se arregla en el servidor/, 'y dejar claro de quién es el problema');
  console.log('P05_RESPUESTA_ILEGIBLE_NO_SE_TRAGA=PASS');
}

// ---- 2. El catch ya no culpa a la conexión sin haberla mirado. ----
{
  assert.doesNotMatch(cuerpo, /Comprueba tu conexi\\xF3n e int\\xE9ntalo otra vez/, 'la frase que mandaba a revisar el wifi pasara lo que pasara ya no vale');
  assert.match(cuerpo, /navigator\.onLine === false \?/, 'hay que distinguir el equipo sin red de un servicio que no contesta');
  assert.match(cuerpo, /Este equipo est\\xE1 sin conexi\\xF3n/, 'sin red, se dice sin red');
  assert.match(cuerpo, /ese servicio no est\\xE9 disponible en este servidor/, 'y con red, se dice que lo más probable es el servidor');
  assert.match(cuerpo, /habla con quien lleve el programa/, 'y a quién acudir, porque el usuario no puede arreglarlo');
  console.log('P05_NO_SE_CULPA_A_LA_CONEXION_SIN_MIRAR=PASS');
}

// ---- 3. Lo que se promete al usuario es cierto: la entrevista se guarda ANTES de
// llamar a la IA, así que un fallo no se lleva por delante lo ya respondido. ----
{
  const salidas = cuerpo.match(/setError\(/g) || [];
  assert.equal(salidas.length, 4, 'el setError("") de entrada más tres salidas de error: respuesta ilegible, error dicho por el servicio, y fallo de red');
  const promete = (cuerpo.match(/no se pierde lo ya respondido/g) || []).length;
  assert.equal(promete, 4, 'las cuatro redacciones deben decirlo, incluidas las dos ramas del catch');

  const empezar = src.slice(fin, src.indexOf('function enviarRespuesta(', fin));
  assert.ok(empezar.indexOf('crearEntrevista(') < empezar.indexOf('llamarIA('), 'la entrevista se crea antes de llamar a la IA; si no, la promesa sería mentira');

  const enviar = src.slice(src.indexOf('function enviarRespuesta(', fin), src.indexOf('function finalizarAhora(', fin));
  assert.ok(enviar.indexOf('actualizarEntrevista(activa.id, { historial: nuevoHistorial') < enviar.indexOf('llamarIA('), 'y la respuesta se guarda antes de llamar, por lo mismo');
  console.log('P05_LO_QUE_SE_PROMETE_ES_CIERTO=PASS');
}

// ---- 4. El aviso se oye: aparece tras una espera y nada más cambia en pantalla. ----
{
  assert.match(src, /error && \/\* @__PURE__ \*\/ import_react4\.default\.createElement\(Card, \{ className: "mb-4", style: \{ background: C2\.redSoft, border: "none" \} \}, \/\* @__PURE__ \*\/ import_react4\.default\.createElement\("div", \{ className: "text-\[12\.5px\]", role: "alert" \}, error\)\)/, 'el aviso de la entrevista debe anunciarse, no solo verse');
  console.log('P05_EL_AVISO_SE_OYE=PASS');
}

console.log('PM17 P05 (entrevista) — el aviso dice dónde está el problema: contrato OK');
