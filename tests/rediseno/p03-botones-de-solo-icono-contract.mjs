import fs from 'node:fs';
import assert from 'node:assert/strict';

// Por qué existe este contrato.
//
// El 15/11/2026, midiendo el bloque de Equipo en QA, el cuadrante de turnos salió
// con **siete botones sin nombre accesible**: uno por día de la semana, 44x44, con
// un icono de más y nada más. Un lector de pantalla los anuncia como «botón» siete
// veces seguidas, sin decir de qué día es cada uno. El tamaño estaba bien; lo que
// faltaba era el nombre.
//
// La causa no estaba en el cuadrante, sino en `Btn`:
//
//     function Btn({ children, onClick, variant, type, small, disabled }) { … }
//
// `Btn` **no reenviaba ninguna prop**. Su firma acepta seis y descarta el resto,
// así que un `aria-label` pasado a `Btn` no llegaba al `<button>`: se caía en
// silencio. No había ningún intento de pasarlo —cero en todo el paquete—, así que
// no era un fallo latente sino una capacidad que no existía: **un botón de solo
// icono hecho con `Btn` no tenía forma de recibir nombre.**
//
// Arreglado en el componente, que es donde estaba el problema: `Btn` acepta
// `ariaLabel` y lo reenvía. Y etiquetados los dos únicos usos de solo icono que
// hay, de 381 usos de `Btn` en total: el más de cada día del cuadrante y la
// descarga de datos de cada cliente.
//
// Lo que fija este contrato no es esos dos botones: es la clase. Si alguien añade
// un `Btn` con un icono y sin texto y se olvida del nombre, esto se pone rojo en
// vez de dejar un botón mudo en producción. Es el mismo razonamiento que el
// contrato de los manejadores de VentaRapida: el defecto concreto se arregla una
// vez, la clase se vigila siempre.
//
// Nota de método: esto mira la fuente, no el navegador. Un `aria-label` puesto a
// mano sobre un `<button>` crudo no lo ve, y no hace falta que lo vea: para eso
// están las mediciones en QA. Aquí solo se vigila la forma que resultó frágil.

const src = fs.readFileSync('fuente.js', 'utf8');

// ---- 1. Btn tiene que seguir aceptando y reenviando el nombre. ----
const firma = src.match(/function Btn\(\{([^}]*)\}\)/);
assert.ok(firma, 'No se encuentra la firma de Btn');
assert.ok(
  /\bariaLabel\b/.test(firma[1]),
  'Btn ya no acepta ariaLabel en su firma. Sin eso, los botones de solo icono hechos con Btn ' +
    'vuelven a no poder tener nombre accesible, y el aria-label que alguien le pase se caera en silencio.',
);
const cuerpoBtn = src.slice(src.indexOf('function Btn('), src.indexOf('function Btn(') + 1400);
assert.ok(
  /"aria-label":\s*ariaLabel/.test(cuerpoBtn),
  'Btn acepta ariaLabel pero ya no lo reenvia al <button>. Aceptarlo sin reenviarlo es peor que ' +
    'no aceptarlo: quien lo use creera que ha puesto un nombre.',
);

// ---- 2. Ningun Btn de solo icono sin nombre. ----
//
// Aqui hubo que rehacerlo, y conviene que quede dicho. La primera version buscaba
// las props con `\{([^}]{0,260})\}`, y eso **no sabe leer una plantilla**: en
// cuanto una prop vale `` `… ${DIAS_SEMANA[i]} …` `` hay una `}` dentro del valor
// y el patron se rompe. El contrato daba `solo_icono=0` y pasaba en verde sin
// vigilar nada: justo despues de que yo etiquetara los dos botones, dejo de
// verlos. Lo delato el numero que imprime, no el codigo de salida.
//
// Asi que las props se recortan contando llaves, que es lo unico fiable.
function bloqueDeLlaves(texto, desde) {
  const abre = texto.indexOf('{', desde);
  if (abre < 0) return null;
  let nivel = 0;
  for (let i = abre; i < texto.length; i += 1) {
    if (texto[i] === '{') nivel += 1;
    else if (texto[i] === '}') {
      nivel -= 1;
      if (nivel === 0) return { props: texto.slice(abre + 1, i), fin: i + 1 };
    }
  }
  return null;
}

const soloIcono = [];
const ICONO_UNICO = /^\s*,\s*\/\* @__PURE__ \*\/ [\w.]*createElement\(([A-Z]\w+),\s*\{[^{}]{0,80}\}\)\s*\)/;

for (const m of src.matchAll(/createElement\(\s*Btn\s*,/g)) {
  const bloque = bloqueDeLlaves(src, m.index + m[0].length - 1);
  if (!bloque) continue;
  const resto = src.slice(bloque.fin, bloque.fin + 220);
  const hijo = resto.match(ICONO_UNICO);
  if (hijo) soloIcono.push({ icono: hijo[1], props: bloque.props });
}

const mudos = soloIcono.filter((b) => !/\bariaLabel\b/.test(b.props)).map((b) => b.icono);

assert.deepEqual(
  mudos,
  [],
  'Hay Btn con un icono como unico hijo y sin ariaLabel. Son botones que se ven, se pulsan y no ' +
    'dicen que hacen: un lector de pantalla solo puede anunciarlos como «boton». Iconos sin ' +
    'nombre: ' + mudos.join(', '),
);

// ---- 3. Los dos casos que originaron el contrato, fijados por su contenido. ----
// No por su numero de linea, para que mover codigo no rompa el contrato por el
// motivo equivocado.
assert.ok(
  /ariaLabel: `A\\xF1adir turno el \$\{DIAS_SEMANA\[\w+\]\} \$\{fecha\}`/.test(src),
  'El mas de cada dia del cuadrante de turnos ya no nombra el dia. Eran siete botones iguales; ' +
    'sin el dia en el nombre vuelven a ser indistinguibles.',
);
assert.ok(
  /ariaLabel: `Descargar los datos de \$\{\w+\.nombre\}`/.test(src),
  'La descarga de datos por cliente ya no nombra al cliente.',
);

// ---- 4. Que la cifra de usos de solo icono no crezca a espaldas de nadie. ----
// Si manana hay veinte, conviene saberlo: el patron se habra vuelto comun y este
// contrato tendra que mirarse con mas cuidado, no solo contar.
assert.ok(
  soloIcono.length <= 6,
  `Hay ${soloIcono.length} Btn de solo icono; cuando se escribio esto habia 2. No es un fallo, ` +
    'pero conviene revisar si el patron se ha vuelto comun y si todos siguen teniendo nombre util.',
);

console.log(
  `REDISENO_P03_BOTONES_SOLO_ICONO_OK=1 solo_icono=${soloIcono.length} mudos=${mudos.length}`,
);
