# Objetivo · que el segundo factor lo elija la persona

15 de noviembre de 2026. Encargo del propietario: **la verificación en dos pasos
debe ser voluntaria, no impuesta**, y el propietario debe conservar la palanca
para exigirla a quien quiera. Es la opción B de las tres que puse sobre la mesa.

Esto es el plan y el estado. Se da por terminado cuando todas las casillas de
«Hecho» estén marcadas y lo que no se pueda verificar aquí esté dicho con su
motivo.

## Lo que hay hoy, medido antes de tocar nada

No es un interruptor: son **cuatro puntos de aplicación** y hay que cambiarlos a
la vez o el programa queda incoherente.

| Dónde | Qué hace hoy |
|---|---|
| `supabase/migrations/20261110230000_m03_server_aal2_gate.sql` | `private.la_usuario_activo()` devuelve **false** si tu membresía es Propietario, Encargado o Cajero/a y el JWT no trae `aal2` |
| `edge-auth-patch.js` | `ROLES_MFA_OBLIGATORIA` con esos tres roles; lee `perfiles.rol` del servidor y planta un overlay bloqueante |
| `fuente.js` | `MFA_REQUIRED_FOR_ALL_LA_SUITE = true`, más `MfaGate` y la fase `"mfa"` de `AppConSesion` |
| `owner-bootstrap-post-reset.js` | `mfaAutorizadaParaAplicacion()` exige `currentLevel === "aal2"` antes de abrir la aplicación |

Y **dos contratos** fijan esa conducta a propósito: `m03-mfa-role-gate` y
`m03-mfa-enforcement`. Se van a poner en rojo, y eso está bien: hay que
**reescribirlos** para que fijen la regla nueva, no borrarlos.

Dato importante del servidor: `la_usuario_activo()` es la **guarda maestra**. No
es «te muestro una pantalla»: si devuelve false, esa sesión no es usuario activo
para nada. Tocarla es tocar el RLS de todo el programa.

`membresias_usuario` tiene `user_id`, `empresa_id`, `local_id`, `rol`, `activo`,
así que una política por empresa y por cargo encaja sin inventar nada.

## Lo que se va a construir

**Por defecto, nadie está obligado.** Una fila en la política hace que un cargo
concreto de una empresa concreta sí lo esté. Quien quiera ponérselo sin que se
lo exijan, puede.

1. **Migración nueva** (no se edita la vieja):
   - `private.mfa_politica (empresa_id, rol, exigida, actualizado_en, actualizado_por)`, en el esquema `private` y sin RLS, como `plataforma_admins`, para que no haya recursión con `la_usuario_activo()`.
   - `private.mfa_exigida_para_uid()`: ¿alguna membresía activa de este usuario cae en un cargo con la política puesta?
   - `la_usuario_activo()` reescrita: la cláusula de `aal2` pasa a colgar de esa función en vez de la lista fija de tres roles.
   - `public.mfa_politica_leer()` para la interfaz y `public.mfa_politica_guardar(rol, exigida)` solo para Propietario de esa empresa.
2. **`edge-auth-patch.js`**: deja de decidir por una lista local y pregunta al servidor. Su propio comentario de cabecera ya exige que la exigencia «sea auditable y no dependa de una copia local del rol», así que esto va en su dirección, no en contra.
3. **`fuente.js`**: la puerta deja de ser obligatoria por defecto; aparece dónde activarla voluntariamente y **dónde quitársela**, que hoy no existe en ninguna pantalla.
4. **`owner-bootstrap-post-reset.js`**: no bloquear cuando la política no lo exige.
5. **Pantalla del propietario**: en Configuración, poder exigir el segundo factor por cargo.
6. **Los dos contratos**, reescritos para fijar la regla nueva.
7. **`f7-preflight`**: excluir la migración nueva y justificarla en la tabla que añadí el 15/11, que obliga a nombrar el contrato que la respalda.

## Compatibilidad con un servidor sin migrar, que es el caso de hoy

Yo **no puedo aplicar migraciones**: la CLI del propietario apunta a producción y
hace falta `--project-ref qjqorixtkilwsndqayyx`. Así que el preview de QA va a
correr contra un servidor que todavía no tiene la política.

Por eso el cliente tiene que tratar «la función no existe» como **el
comportamiento de antes**, exactamente como hace el panel de Plataforma con
`esFuncionInexistente(e)`. Sin eso, el día que se despliegue el cliente antes
que la migración, nadie entra.

## Lo que me preocupa y queda dicho

- Esto **reduce** la seguridad por defecto. El segundo factor es hoy lo único que separa una contraseña filtrada del acceso completo a caja, stock, nóminas, DNI de empleados y datos de clientes.
- El limitador de intentos M-04 protege de adivinar una contraseña, no de usar una correcta que se haya filtrado.
- Si el programa maneja datos personales y registros fiscales de verdad, conviene mirar qué obligación aplica. No lo sé y no lo voy a suponer.

Queda escrito aquí porque el encargo es claro y lo voy a hacer; pero que conste
el coste, no vaya a parecer que no se vio.

## Estado

Al 15/11/2026, cerrado todo menos lo que depende de aplicar la migración, que
no puedo aplicar yo (ver «Lo que no puedo hacer» más abajo).

| Paso | Hecho |
|---|---|
| Leer los cinco puntos y los dos contratos | sí |
| Migración nueva | sí — `supabase/migrations/20261115120000_mfa_politica_opcional.sql` |
| Contrato contra Postgres de verdad | sí — `tests/rediseno/p04-mfa-politica-pglite-contract.mjs`, 26/26 |
| `edge-auth-patch.js`: overlay MfaGate | sí |
| `edge-auth-patch.js`: puerta de aplicación | sí — **este punto se me había pasado**; lo encontré al escribir el contrato |
| `fuente.js`: puerta opcional | sí — `evaluarMfaSesion` |
| `fuente.js`: activar y quitar el factor | sí — `MfaMiCuenta`, alcanzable por cualquier rol |
| `owner-bootstrap-post-reset.js` | sí |
| Pantalla del propietario | sí — `MfaPoliticaCargos`, octava sección de Configuración |
| Reescribir los dos contratos | sí — `m03-mfa-enforcement-contract.mjs` fija ahora los cinco puntos |
| `f7-preflight` y recuentos de la puerta | sí — exclusión justificada, 362 entradas, 345 activos, pglite 4 |
| Batería y paridad | sí |
| Verificado en QA lo que se pueda sin migrar | sí — con el servidor sin migrar el programa se comporta como antes, que es lo que promete el respaldo |

## Los cinco puntos que deciden

| # | Dónde | Qué decide |
|---|---|---|
| 1 | `private.la_usuario_activo()` | si la sesión cuenta como usuario activo para TODO el RLS |
| 2 | `fuente.js` → `evaluarMfaSesion` | si el programa planta el desafío o la inscripción |
| 3 | `edge-auth-patch.js` → `mfaAutorizadaParaAplicacion` | si se abre la cola de sincronización |
| 4 | `edge-auth-patch.js` → overlay `MfaGate` | si se planta el overlay por encima del programa |
| 5 | `owner-bootstrap-post-reset.js` | lo mismo que 3, en el arranque histórico |

El punto 4 es el único que conserva la lista de tres cargos de M-03, y solo como
respaldo: conoce el cargo, así que cuando la RPC no existe puede reproducir
exactamente la conducta anterior. Los puntos 2, 3 y 5 no conocen el cargo, así
que su respaldo es «se exige».

## Fallar cerrado

Si el cliente se despliega antes que la migración, `mfa_politica_leer` no existe
y los cuatro puntos de cliente se quedan en la conducta de M-03. Lo contrario
—fallar hacia «no se exige»— dejaría sin segundo factor, durante esa ventana,
justo a quien hoy lo tiene. El contrato lo fija punto por punto.

## Lo que esto cuesta en seguridad, dicho claro

Antes, un Propietario con la contraseña robada no bastaba para entrar: hacía
falta su teléfono. A partir de ahora, si nadie marca nada, sí basta. Eso es lo
que se ha pedido y es una decisión legítima del dueño del negocio, pero no es
gratis. La pantalla lo dice con esas palabras, y el Propietario tiene la casilla
para volver a exigirlo a su cargo cuando quiera, sin tocar código.

## Lo que no puedo hacer

No puedo aplicar la migración: el CLI del propietario apunta a producción y
hace falta `--project-ref qjqorixtkilwsndqayyx`. Hasta que alguien la aplique en
QA, el servidor sigue con la puerta de M-03 y los cuatro puntos de cliente se
comportan como antes a propósito. Por eso la mitad de servidor está probada
contra un Postgres de verdad en memoria (`p04`, 26/26) y no contra QA.
