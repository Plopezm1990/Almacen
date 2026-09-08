import fs from 'node:fs';
import assert from 'node:assert/strict';

// PM17 P03: confirma, por inspección estática, que el enlace de recuperación y el botón
// de logout de Propietario están realmente conectados en el JSX real -- no basta con que
// existan las funciones nuevas si no se usan.

const src = fs.readFileSync('fuente.js', 'utf8');

// ---- Login: enlace "¿Olvidaste tu contraseña?" navega a restablecer-contrasena.html,
// colocado junto al botón "Entrar" real (no un formulario nuevo). ----
{
  const iniLogin = src.indexOf('if (fase === "login") {');
  assert.ok(iniLogin >= 0, 'pantalla de login no encontrada');
  const finLogin = src.indexOf('return /* @__PURE__ */ import_react4.default.createElement(GestionAlmacen, null);', iniLogin);
  assert.ok(finLogin > iniLogin, 'no se pudo acotar la pantalla de login');
  const bloque = src.slice(iniLogin, finLogin);

  assert.match(bloque, /window\.location\.href = "\.\/restablecer-contrasena\.html";/, 'el enlace debe navegar al mismo restablecer-contrasena.html que ya usaba el parche');
  assert.match(bloque, /"\\xBFOlvidaste tu contrase\\xF1a\?"/, 'debe mostrar el texto real del enlace');
  assert.match(bloque, /placeholder: "Correo"/, 'debe seguir siendo el mismo formulario de login real (no uno nuevo)');
  console.log('P03_PM17_LOGIN_ENLACE_OLVIDE_CONTRASENA=PASS');
}

// ---- BotonModoEmpleado: el botón de logout de Propietario está condicionado a
// debeMostrarLogoutPropietarioPM17 y usa auth.signOut real, con confirmación previa. ----
{
  const iniComponente = src.indexOf('function BotonModoEmpleado({');
  assert.ok(iniComponente >= 0, 'BotonModoEmpleado no encontrado');
  const finComponente = src.indexOf('function SidebarGrupos(', iniComponente);
  assert.ok(finComponente > iniComponente, 'no se pudo acotar BotonModoEmpleado');
  const cuerpo = src.slice(iniComponente, finComponente);

  assert.match(cuerpo, /debeMostrarLogoutPropietarioPM17\(miPerfil\) &&/, 'el botón debe estar condicionado a la misma función probada en el contrato de funciones puras');
  assert.match(cuerpo, /onClick: \(\) => setConfirmarLogoutPropietarioPM17\(true\)/, 'el clic debe abrir confirmación, no cerrar sesión directamente');
  assert.match(cuerpo, /supabase\.auth\.signOut\(\{ scope: "local" \}\)/, 'debe cerrar sesión solo en este dispositivo (scope local), igual que ya hace el empleado');
  assert.match(cuerpo, /errorLogoutPropietarioPM17 &&/, 'un fallo al cerrar sesión debe mostrarse, nunca ocultarse en silencio');
  console.log('P03_PM17_LOGOUT_PROPIETARIO_CONECTADO=PASS');
}

console.log('PM17 P03 (wiring auth UX nativo) — login y logout de Propietario: contrato OK');
