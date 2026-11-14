import fs from 'node:fs';
import assert from 'node:assert/strict';

// Por qué existe este contrato.
//
// El 14/11/2026, barriendo vistas en QA, apareció esto: en el TPV, en modo sala, el panel
// "Asignar <mesa>" se dibujaba, su botón estaba habilitado, y al pulsarlo no pasaba nada.
// La mesa seguía libre, no salía ningún mensaje y no se enviaba ni una petición de red
// (comprobado instrumentando fetch: cero llamadas).
//
// La causa: `crearLogicaVenta` definía `asignarMesaCuentaA07` pero NO la incluía entre los
// nombres que devuelve. `AppConSesion` la desestructuraba de ese retorno, así que recibía
// `undefined`, y se la pasaba igual a `VentaRapida`. El manejador salía por su primera
// guarda:
//
//     if (!mesaSeleccionadaA07 || typeof asignarMesaCuentaA07 !== "function") return;
//
// Ese `return` es mudo: ni efecto ni aviso. Es lo que convierte un cable sin conectar en un
// botón que miente. Entró con "A07.1" y nunca se exportó; "A07.2" sí exportó la suya, y por
// eso trasladar cuentas parecía existir mientras asignarlas no funcionaba. Ningún contrato
// cubría la asignación, así que la puerta pasaba en verde con el cable suelto.
//
// Lo que fija este contrato, por tanto, no es esa función concreta: es la clase entera.
// Todo manejador que `VentaRapida` declara y protege con `typeof … !== "function"` tiene que
// llegarle de verdad, es decir, estar en el objeto que devuelve `crearLogicaVenta` y
// aparecer en las props con las que el enrutador lo monta. Si alguien añade un manejador y
// se olvida de exportarlo, esto se pone rojo en vez de dejar un botón mudo en producción.

const src = fs.readFileSync('fuente.js', 'utf8');
const lineas = src.split('\n');

// ---- 1. Los manejadores que VentaRapida declara y protege con una guarda muda. ----
const firma = src.match(/function VentaRapida\(\{([^}]*)\}\)/);
assert.ok(firma, 'No se encuentra la firma de VentaRapida');
const props = new Set(
  firma[1]
    .split(',')
    .map((p) => p.trim().split('=')[0].trim())
    .filter((p) => /^[A-Za-z_$][\w$]*$/.test(p)),
);
assert.ok(props.size >= 30, `VentaRapida declara ${props.size} props; se esperaban 30 o más`);

const guardados = new Set(
  [...src.matchAll(/typeof (\w+) !== "function"/g)].map((m) => m[1]),
);
const manejadores = [...props].filter((p) => guardados.has(p)).sort();
assert.ok(
  manejadores.length >= 20,
  `Solo ${manejadores.length} manejadores con guarda; se esperaban 20 o más. ` +
    'Si la cifra baja de golpe, probablemente cambió la forma de la guarda y este ' +
    'contrato dejó de ver lo que debía vigilar.',
);

// ---- 2. El objeto que devuelve crearLogicaVenta. ----
// Se localiza por su contenido, no por número de línea, para que renombrar o mover
// funciones no rompa el contrato por el motivo equivocado.
const retorno = lineas.filter(
  (l) => l.trim().startsWith('return {') && l.includes('venderCarrito'),
);
assert.equal(
  retorno.length,
  1,
  `Se esperaba un único retorno de crearLogicaVenta; hay ${retorno.length}`,
);
const devueltos = new Set(
  retorno[0]
    .replace(/^\s*return \{/, '')
    .replace(/\};\s*$/, '')
    .split(',')
    .map((x) => x.trim()),
);

// ---- 3. Las props con las que el enrutador monta VentaRapida. ----
const montaje = lineas.filter((l) => l.includes('createElement(VentaRapida, {')).join(' ');
assert.ok(montaje.length > 0, 'No se encuentra el montaje de VentaRapida');

// ---- 4. Cada manejador con guarda muda tiene que llegar de verdad. ----
const sueltos = [];
for (const nombre of manejadores) {
  const exportado = devueltos.has(nombre);
  const pasado = new RegExp(`\\b${nombre}\\b`).test(montaje);
  if (!exportado || !pasado) {
    sueltos.push(`${nombre} (exportado: ${exportado}, pasado: ${pasado})`);
  }
}
assert.deepEqual(
  sueltos,
  [],
  'Hay manejadores que VentaRapida protege con una guarda muda y que no le llegan. ' +
    'Su botón existirá, estará habilitado y no hará nada, sin decirlo. Detalle: ' +
    sueltos.join('; '),
);

// ---- 5. El caso que originó el contrato, fijado por su nombre. ----
// Los dos del mismo par: uno se exportó y el otro no, y esa asimetría fue el defecto.
for (const nombre of ['asignarMesaCuentaA07', 'moverMesaCuentaA07']) {
  assert.ok(manejadores.includes(nombre), `${nombre} ya no es un manejador con guarda`);
  assert.ok(devueltos.has(nombre), `${nombre} no está en el retorno de crearLogicaVenta`);
}

console.log(`PM15_P05_MANEJADORES_VENTARAPIDA_OK=1 vigilados=${manejadores.length}`);
