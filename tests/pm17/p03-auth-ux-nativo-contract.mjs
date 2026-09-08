import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

// PM17 P03 (lote 3): "olvidé mi contraseña" y el cierre de sesión de Propietario solo
// existían en auth-ux-patch.js -- un archivo externo cargado por red en runtime, sin
// ningún equivalente nativo (ver docs/plan-maestro/PM17_DIAGNOSTICO_PARCHES.md, sección
// 3: "no existe ningún equivalente nativo"). Este lote los porta directamente al
// componente nativo: el enlace de recuperación en la pantalla de login, y un botón de
// cierre de sesión para Propietario junto al de Modo empleado (el empleado ya tenía uno
// nativo desde antes -- BotonModoEmpleado, rama miPerfil.rol !== "Propietario").

const src = fs.readFileSync('fuente.js', 'utf8');

// ---- debeMostrarLogoutPropietarioPM17: positivo/negativo/replay ----
{
  const ini = src.indexOf('function debeMostrarLogoutPropietarioPM17(');
  assert.ok(ini >= 0, 'debeMostrarLogoutPropietarioPM17 no encontrada');
  const fin = src.indexOf('function BotonModoEmpleado(', ini);
  assert.ok(fin > ini, 'no se pudo acotar debeMostrarLogoutPropietarioPM17');
  const ctx = { console };
  vm.createContext(ctx);
  vm.runInContext(src.slice(ini, fin), ctx);

  assert.equal(ctx.debeMostrarLogoutPropietarioPM17({ rol: 'Propietario' }), true);
  assert.equal(ctx.debeMostrarLogoutPropietarioPM17({ rol: 'Encargado' }), false, 'un empleado no debe ver el botón de logout de Propietario');
  assert.equal(ctx.debeMostrarLogoutPropietarioPM17({ rol: 'Cajero/a' }), false);
  assert.equal(ctx.debeMostrarLogoutPropietarioPM17(null), false, 'sin perfil verificado, no se muestra (falla cerrado, igual que el resto de la app)');
  assert.equal(ctx.debeMostrarLogoutPropietarioPM17(void 0), false);
  // Replay: dos llamadas consecutivas con perfiles distintos no dejan estado compartido.
  assert.equal(ctx.debeMostrarLogoutPropietarioPM17({ rol: 'Propietario' }), true);
  assert.equal(ctx.debeMostrarLogoutPropietarioPM17({ rol: 'Churrero/a' }), false);

  console.log('P03_PM17_DEBE_MOSTRAR_LOGOUT_PROPIETARIO=PASS');
}

console.log('PM17 P03 (auth UX nativo) — debeMostrarLogoutPropietarioPM17: contrato OK');
