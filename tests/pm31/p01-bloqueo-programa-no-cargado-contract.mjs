import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

// PM31 P01: "Cuando el bloqueo es porque el programa no se descargo, no se
// culpa al servidor y el boton hace algo."
//
// El propietario se encontro la pantalla de bloqueo con el mensaje "Cliente
// Supabase no disponible... para proteger el estado post-reset". El servidor
// estaba perfectamente: lo que fallo fue la descarga de fuente.js (5,5 MB).
// Y el boton "Reintentar comprobacion" no hacia absolutamente nada, porque su
// codigo era `if (supabaseActual && usuarioActual) validarSesion(...)` y en
// ese caso no hay ni cliente ni usuario. La unica salida era recargar, cosa
// que la pantalla no decia en ningun sitio.

const fuente = fs.readFileSync('owner-bootstrap-post-reset.js', 'utf8');

function montar({ defineGetSupabaseClient }) {
  const recargas = [];
  const creados = [];

  const nuevoNodo = (tag) => {
    const n = {
      tagName: tag,
      children: [],
      style: {},
      innerHTML: '',
      textContent: '',
      _ev: {},
      setAttribute() {},
      appendChild(h) { this.children.push(h); return h; },
      addEventListener(tipo, fn) { this._ev[tipo] = fn; },
      remove() {},
    };
    creados.push(n);
    return n;
  };

  const body = nuevoNodo('body');
  const documento = {
    body,
    documentElement: { classList: { add() {}, remove() {} } },
    getElementById: () => null,
    createElement: nuevoNodo,
  };

  const ventana = {
    location: { reload: () => recargas.push(1) },
    __instalacionSyncPermitida: false,
  };
  if (defineGetSupabaseClient) {
    // El programa cargo, pero la nube nunca llego a conectarse.
    ventana.getSupabaseClient = async () => null;
  }

  const ctx = {
    window: ventana,
    document: documento,
    setTimeout,
    Promise,
    String,
    console,
  };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(fuente, ctx);

  return { recargas, creados, body };
}

const textoDe = (nodo) => {
  const propio = String(nodo.innerHTML || '').replace(/<[^>]*>/g, ' ') + ' ' + String(nodo.textContent || '');
  return (propio + ' ' + nodo.children.map(textoDe).join(' ')).replace(/\s+/g, ' ');
};
const botonDe = (creados) => creados.find((n) => n.tagName === 'button') || null;

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- 1. El programa no llego a cargarse: no se menciona al servidor. ----
{
  const { recargas, creados, body } = montar({ defineGetSupabaseClient: false });
  await esperar(5200);
  const texto = textoDe(body);

  assert.ok(texto.includes('No se ha podido cargar el programa'),
    'debe decirse que lo que falta es el programa');
  assert.ok(!texto.includes('estado del servidor'),
    'no debe culparse al servidor: no sabemos nada de el');
  assert.ok(!texto.includes('post-reset'),
    'no debe hablarse de proteger un estado del servidor');
  assert.ok(texto.includes('conexi'), 'debe apuntarse a la conexion como causa habitual');
  assert.ok(texto.includes('No se ha perdido'), 'debe tranquilizarse sobre los datos');

  const boton = botonDe(creados);
  assert.ok(boton, 'debe ofrecerse una accion');
  assert.equal(boton.textContent, 'Volver a cargar', 'la accion debe decir lo que realmente hace');

  assert.equal(recargas.length, 0, 'no debe recargarse solo');
  boton._ev.click();
  assert.equal(recargas.length, 1,
    'el boton debe recargar: reintentar la comprobacion no vuelve a bajar el archivo que falta');
  console.log('P01_PROGRAMA_NO_CARGADO=PASS');
}

// ---- 2. El programa cargo pero no hay cliente: se conserva el mensaje de
//         siempre, y el boton deja de ser decorativo. ----
{
  const { recargas, creados, body } = montar({ defineGetSupabaseClient: true });
  await esperar(5200);
  const texto = textoDe(body);

  assert.ok(texto.includes('Cliente Supabase no disponible'),
    'este caso conserva su mensaje');
  assert.ok(!texto.includes('No se ha podido cargar el programa'),
    'no debe confundirse con el caso de descarga fallida');

  const boton = botonDe(creados);
  assert.equal(boton.textContent, 'Reintentar comprobación', 'conserva su etiqueta');
  boton._ev.click();
  assert.equal(recargas.length, 1,
    'sin cliente ni usuario el boton debe recargar en vez de no hacer nada');
  console.log('P01_SIN_CLIENTE_BOTON_UTIL=PASS');
}

console.log('PM31_P01_BLOQUEO_PROGRAMA_NO_CARGADO=PASS');
