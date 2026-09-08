# PM17 P03 — Lote 3: auth UX nativa (recuperar contraseña, logout de Propietario)

Tercer lote de PM17, según la matriz de `docs/plan-maestro/PM17_DIAGNOSTICO_PARCHES.md`
(punto 6).

## Diagnóstico (confirmado en el turno del diagnóstico)

`auth-ux-patch.js` era el único sitio donde existían dos funciones, sin ningún
equivalente nativo en `fuente.js` (a diferencia de los lotes 1 y 2, donde la lógica base
ya existía nativamente y solo faltaba el rollback/la neutralización):

1. Enlace "¿Olvidaste tu contraseña?" en la pantalla de login, hacia
   `restablecer-contrasena.html`.
2. Botón de cierre de sesión visible para el rol Propietario. El rol no-Propietario
   (empleado) **ya tenía** un botón de logout nativo desde antes
   (`BotonModoEmpleado`, rama `miPerfil.rol !== "Propietario"` → botón "🔒 nombre · cerrar
   sesión"); solo faltaba el equivalente para Propietario, que en su lugar solo veía el
   selector de "Modo empleado".

## Solución

- **Login**: se añade un enlace "¿Olvidaste tu contraseña?" justo debajo del botón
  "Entrar" real (mismo formulario, mismo componente — no se crea ninguna pantalla
  nueva), que navega al mismo `restablecer-contrasena.html` que ya usaba el parche.
- **`debeMostrarLogoutPropietarioPM17(miPerfil)`** (función pura nueva): decide si se
  muestra el botón de logout de Propietario — solo cuando `miPerfil.rol === "Propietario"`.
  Sin perfil verificado, no se muestra (falla cerrado, coherente con el resto de la app).
- **`BotonModoEmpleado`**: cuando `debeMostrarLogoutPropietarioPM17` es cierto, añade
  (junto al selector de "Modo empleado" existente, sin sustituirlo) un botón "🔒 Cerrar
  sesión" que abre una confirmación (reutilizando el componente `Modal` ya usado en el
  resto de la app, no un modal a medida como hacía el parche) antes de llamar a
  `supabase.auth.signOut({ scope: "local" })` — mismo alcance de sesión que ya usaba el
  logout de empleado. Un fallo al cerrar sesión se muestra en el propio modal, nunca se
  oculta en silencio.
- El parche externo (`auth-ux-patch.js`) **sigue activo** y no se ha tocado en este
  lote — queda redundante (intentará añadir sus propios botones/enlace por DOM, sin
  encontrar ya elementos que sustituir gracias a los `class`/selectores de referencia que
  usa, o coexistiendo sin conflicto real); se revisará su retirada en el lote 4.

## Archivos

- `fuente.js`: `debeMostrarLogoutPropietarioPM17` (nueva, antes de `BotonModoEmpleado`);
  `BotonModoEmpleado` ampliado con el botón/modal de logout de Propietario; pantalla de
  login (`AppConSesion`, fase `"login"`) con el enlace de recuperación de contraseña.
- `tests/pm17/p03-auth-ux-nativo-contract.mjs` (nuevo): `debeMostrarLogoutPropietarioPM17`,
  positivo/negativo/replay.
- `tests/pm17/p03-wiring-login-logout-contract.mjs` (nuevo): por inspección estática,
  confirma que el enlace de login y el botón de logout están conectados de verdad en el
  JSX real.

## Regresión

Suite completa: `tests/g1`, `pm04`, `pm05`, `pm07`, `pm08`, `pm09`, `pm10`,
`pm11-compra`, `pm12`, `pm13`, `pm14`, `pm15`, `pm16`, `pm17` — 90/90 sin regresiones.

## Estado de main/producción

`main` = `5db0b9ed03c8f8ecd700ff339edce1dff14ffde4`, sin tocar directamente. Frontend
puro, sin migraciones Supabase. No se ha activado ningún envío real ni retirado ninguna
función productiva. `L&A Suite` (producción) y `TPV` no se han tocado.

## Pendiente

- Lote 4: retirar `seleccion-neutral-patch.js`/`auth-ux-patch.js` y el bloque de
  inyección dinámica en `fuente.js` (heredado de `edge-auth-patch.js`), ahora que los
  lotes 1-3 cubren de forma nativa todo lo que ambos archivos aportaban. Revisar
  compatibilidad antes de retirar (punto 5 pedido explícitamente): confirmar que ningún
  otro flujo depende de las variables globales que instalan
  (`window.__pushSubscriptionSafetyPatched`, `window.__contextoRolSeguroInstalado`,
  `window.__guardPerfilActivoInstalado` — estas tres últimas siguen siendo del bloque
  inlineado de `edge-auth-patch.js`, que no se retira, solo su parte final de inyección
  de los otros dos archivos).
