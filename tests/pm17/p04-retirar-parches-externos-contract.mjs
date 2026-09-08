import fs from 'node:fs';
import assert from 'node:assert/strict';

// PM17 P04 (lote 4): retirar seleccion-neutral-patch.js y auth-ux-patch.js -- ahora que
// los lotes 1-3 portaron de forma nativa todo lo que aportaban (rollback de suscripción
// push, neutralización de Prefiltros/Entrevistas, recuperación de contraseña y logout de
// Propietario), ya no hace falta que la app dependa de dos archivos sueltos cargados por
// red en runtime, con ventana de carrera frente al montaje de React y sin ningún aviso si
// fallan en desplegarse (ver docs/plan-maestro/PM17_DIAGNOSTICO_PARCHES.md).
//
// Este contrato comprueba, de forma explícita, que ya no queda ningún rastro de la
// inyección dinámica de esos dos scripts, y que los archivos han desaparecido del
// repositorio -- no basta con que la lógica nativa exista si el navegador sigue
// intentando descargar y ejecutar el parche por encima.

const src = fs.readFileSync('fuente.js', 'utf8');

// ---- fuente.js ya no inyecta ningún <script> en runtime hacia estos dos archivos. ----
{
  assert.doesNotMatch(src, /seleccion-neutral-patch\.js/, 'no debe quedar ninguna referencia a seleccion-neutral-patch.js en fuente.js');
  assert.doesNotMatch(src, /auth-ux-patch\.js/, 'no debe quedar ninguna referencia a auth-ux-patch.js en fuente.js');
  assert.doesNotMatch(src, /data-seleccion-neutral/, 'no debe quedar el marcador del script inyectado');
  assert.doesNotMatch(src, /data-auth-ux/, 'no debe quedar el marcador del script inyectado');
  console.log('P04_PM17_SIN_INYECCION_DINAMICA_EN_FUENTE=PASS');
}

// ---- Los dos archivos han desaparecido del repositorio. ----
{
  assert.equal(fs.existsSync('seleccion-neutral-patch.js'), false, 'seleccion-neutral-patch.js debe estar retirado');
  assert.equal(fs.existsSync('auth-ux-patch.js'), false, 'auth-ux-patch.js debe estar retirado');
  console.log('P04_PM17_ARCHIVOS_EXTERNOS_RETIRADOS=PASS');
}

// ---- El resto del bloque nativo heredado de edge-auth-patch.js (aislamiento de
// window.storage por rol, guard de perfil activo, inyección de Authorization en Edge
// Functions) sigue intacto -- este lote solo retira los DOS scripts que se cargaban por
// red, nunca el código ya nativo y síncrono. ----
{
  assert.match(src, /window\.__contextoRolSeguroInstalado = true;/, 'la barrera de aislamiento por rol debe seguir nativa');
  assert.match(src, /window\.__guardPerfilActivoInstalado = true;/, 'el guard de perfil activo debe seguir nativo');
  assert.match(src, /Bearer " \+ token/, 'la inyección de Authorization en Edge Functions debe seguir nativa');
  console.log('P04_PM17_BLOQUE_NATIVO_EDGE_AUTH_INTACTO=PASS');
}

console.log('PM17 P04 (retirada de parches externos) — sin dependencia de red en runtime: contrato OK');
