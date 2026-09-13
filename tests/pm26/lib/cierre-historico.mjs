import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// PM26 P08f -- anclaje historico compartido.
//
// Un paquete cerrado certifica un HECHO HISTORICO INMUTABLE: que en el
// commit exacto donde su gate paso en verde, los artefactos decian lo
// que el informe afirma. NO certifica una propiedad que deba seguir
// siendo cierta para siempre sobre el arbol vivo: los mismos archivos
// (fuente.js, _headers, index.html, reset-pruebas-preview.js...) siguen
// evolucionando de forma legitima en paquetes posteriores.
//
// Leerlos del arbol de trabajo hace que cualquier avance posterior
// rompa un gate historico sin tener nada que ver con el, que es
// exactamente el defecto que P07c ya habia corregido y que P08f
// extiende a P04a, P06c, P06i y P07a.
//
// Este modulo NO relaja ninguna comprobacion: cambia UNICAMENTE la
// fuente de los bytes (git show <cierre>:<ruta> en vez del arbol vivo).
// Las aserciones sobre esos bytes siguen siendo las mismas, y ademas
// se exige que el commit de cierre exista y siga siendo antepasado de
// HEAD -- si alguien reescribiera la historia para hacerlo desaparecer,
// el gate falla en vez de pasar en vacio.

const __filename = fileURLToPath(import.meta.url);
export const RAIZ_REPO = path.resolve(path.dirname(__filename), '..', '..', '..');

export function anclar(cierre, etiqueta) {
  assert.match(cierre, /^[0-9a-f]{40}$/, `${etiqueta}: el commit de cierre debe ser un SHA-1 completo`);

  // 1) El commit existe de verdad y es un commit, no otro tipo de objeto.
  const tipo = spawnSync('git', ['cat-file', '-t', cierre], { cwd: RAIZ_REPO, encoding: 'utf8' });
  assert.equal(tipo.status, 0, `${etiqueta}: el commit de cierre ${cierre} no existe en este repositorio`);
  assert.equal(tipo.stdout.trim(), 'commit', `${etiqueta}: ${cierre} existe pero no es un commit`);

  // 2) Y sigue siendo antepasado de HEAD: si la rama dejara de
  //    contenerlo, lo que este contrato certifica ya no formaria parte
  //    de esta historia y no puede darse por bueno en silencio.
  const ancestro = spawnSync('git', ['merge-base', '--is-ancestor', cierre, 'HEAD'], { cwd: RAIZ_REPO });
  assert.equal(
    ancestro.status,
    0,
    `${etiqueta}: el commit de cierre ${cierre} ya no es antepasado de HEAD -- la historia certificada no esta en esta rama`
  );

  function leerBuffer(rel) {
    try {
      return execFileSync('git', ['show', `${cierre}:${rel}`], {
        cwd: RAIZ_REPO,
        maxBuffer: 1024 * 1024 * 128,
        // stderr capturado: los controles negativos piden rutas
        // inexistentes a proposito y su "fatal:" no debe ensuciar el log.
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (e) {
      throw new Error(`${etiqueta}: no se pudo leer ${rel} en el commit de cierre ${cierre}: ${e.message}`);
    }
  }

  function leer(rel) {
    return leerBuffer(rel).toString('utf8');
  }

  function sha256(rel) {
    return crypto.createHash('sha256').update(leerBuffer(rel)).digest('hex');
  }

  function oid(rel) {
    const r = spawnSync('git', ['rev-parse', `${cierre}:${rel}`], { cwd: RAIZ_REPO, encoding: 'utf8' });
    assert.equal(r.status, 0, `${etiqueta}: no se pudo resolver el blob de ${rel} en ${cierre}`);
    return r.stdout.trim();
  }

  function existe(rel) {
    return spawnSync('git', ['cat-file', '-e', `${cierre}:${rel}`], { cwd: RAIZ_REPO }).status === 0;
  }

  function listarArchivos() {
    const r = spawnSync('git', ['ls-tree', '-r', '--name-only', cierre], { cwd: RAIZ_REPO, encoding: 'utf8' });
    assert.equal(r.status, 0, `${etiqueta}: no se pudo listar el arbol de ${cierre}`);
    const archivos = r.stdout.split('\n').filter(Boolean);
    assert.ok(archivos.length > 0, `${etiqueta}: el arbol de ${cierre} no puede estar vacio`);
    return archivos;
  }

  return { cierre, etiqueta, leer, leerBuffer, sha256, oid, existe, listarArchivos };
}

// Control negativo del propio anclaje, determinista y sin tocar el
// repositorio: crea un commit HUERFANO en la base de objetos (no
// apuntado por ninguna referencia, asi que git lo recoge solo) que por
// construccion NO es antepasado de HEAD, y exige que `anclar` lo
// rechace. Sin esto, la comprobacion de antepasado podria estar siempre
// dando por buena cualquier entrada.
export function comprobarAnclajeNoPasaEnVacio(anclarFn = anclar) {
  // SHA con forma valida pero inexistente.
  assert.throws(() => anclarFn('0'.repeat(40), 'control'), /no existe en este repositorio/);
  // Cadena que ni siquiera tiene forma de SHA completo.
  assert.throws(() => anclarFn('no-es-un-sha', 'control'), /SHA-1 completo/);
  // Un objeto que existe pero no es un commit (el arbol de HEAD).
  const arbolHead = execFileSync('git', ['rev-parse', 'HEAD^{tree}'], { cwd: RAIZ_REPO, encoding: 'utf8' }).trim();
  assert.throws(() => anclarFn(arbolHead, 'control'), /no es un commit/);
  // Y un commit real que NO es antepasado de HEAD.
  // El runner de GitHub Actions no tiene user.name/user.email
  // configurados globalmente ("fatal: empty ident name"), a diferencia
  // de un entorno local con git ya configurado. Se fija la identidad
  // SOLO para esta invocacion, via variables de entorno, sin tocar la
  // configuracion real del repositorio.
  const huerfano = execFileSync(
    'git',
    ['commit-tree', arbolHead, '-m', 'control negativo de anclaje (commit huerfano, sin referencias)'],
    {
      cwd: RAIZ_REPO,
      encoding: 'utf8',
      input: '',
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: 'PM26 control negativo',
        GIT_AUTHOR_EMAIL: 'control-negativo@localhost',
        GIT_COMMITTER_NAME: 'PM26 control negativo',
        GIT_COMMITTER_EMAIL: 'control-negativo@localhost',
      },
    }
  ).trim();
  assert.match(huerfano, /^[0-9a-f]{40}$/, 'no se pudo crear el commit huerfano de control');
  assert.equal(
    spawnSync('git', ['merge-base', '--is-ancestor', huerfano, 'HEAD'], { cwd: RAIZ_REPO }).status !== 0,
    true,
    'el commit de control debia NO ser antepasado de HEAD'
  );
  assert.throws(() => anclarFn(huerfano, 'control'), /ya no es antepasado de HEAD/);
  return true;
}

// Control negativo reutilizable: comprueba que una asercion NO pasa en
// vacio. Ejecuta `comprobar(textoMutado)` sobre una copia EN MEMORIA con
// una mutacion aplicada y exige que lance. Si la mutacion no llega a
// cambiar nada, la prueba se declara invalida en vez de pasar.
export function exigirDeteccion(texto, mutar, comprobar, patron, etiqueta) {
  const mutante = mutar(texto);
  assert.notEqual(mutante, texto, `${etiqueta}: la mutacion no llego a cambiar nada -- prueba invalida`);
  assert.throws(() => comprobar(mutante), patron, `${etiqueta}: la comprobacion no detecta la mutacion`);
}
