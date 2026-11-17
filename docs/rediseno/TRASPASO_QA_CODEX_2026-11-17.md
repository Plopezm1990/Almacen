# L&A Suite · Traspaso a Codex · 17 de noviembre de 2026, tarde

Escrito por Claude Code al terminar su tanda, para que puedas seguir sin tener
que reconstruir nada. Este documento se basta solo: lo que hay, lo que hice, lo
que está roto, lo que sigue y lo que falta.

## Dónde estás

| | |
| --- | --- |
| Repositorio | `Plopezm1990/Almacen` |
| Rama | `rediseno/f0-base-qa` |
| Último commit | `0fcd0f0d` (código Pase en `88bb28ac`) |
| PR | [#225 contra `release`](https://github.com/Plopezm1990/Almacen/pull/225), **en borrador, no fusionar** |
| Preview | `https://deploy-preview-225--chic-entremet-9107cf.netlify.app/` |
| Supabase QA | `qjqorixtkilwsndqayyx`, empresa `QA-EMP-A`, local `QA-A1` |
| Puerta de CI | 369 entradas · 352 contratos activos · 314 de Node |
| Batería local | `bash tests/ci/ejecutar_bateria_no_db.sh` → 314/314 |

La batería necesita `CFG6_UI_DEPS`, `CFG6E_UI_DEPS` y `CFG_SCOPE_DEPS`
apuntando a una carpeta con `node_modules` que tenga `react@18.3.1`,
`react-dom@18.3.1`, `jsdom` y **`fake-indexeddb`** — esta última hace falta
desde tu `be0b722a` y no estaba; la instalé en mi copia, pero si montas el
entorno de cero, tenla en cuenta.

Y se niega a correr con el árbol sucio en los ficheros que toca: confirma antes
de lanzarla.

## Lo que hice, y por qué

Tomé tu acta `TRASPASO_QA_CLAUDE_2026-11-17.md` y empecé por el punto 1. No
llegué al 2 ni al 4, y el 3 está hecho a medias, por los motivos de abajo.

### 1 · Completada el alta de la cuenta restringida

`qa.permisos.20261116@qa.invalid`, rol **Camarero/a**, creada desde Personal →
«QA Permisos TPV 20261116» → Crear cuenta de acceso. La contraseña y el secreto
TOTP están en `qa-credenciales.local.md`, que sigue fuera de git por
`.gitignore` (`*.local.md`). Si no lo tienes, pídeselo al propietario: no lo
voy a poner aquí.

Aviso por si lo repites: en Personal hay **ocho** botones «Crear cuenta de
acceso», uno por ficha. El primero del DOM no es el que buscas; el diálogo dice
a quién pertenece y conviene leerlo antes de rellenar nada.

### 2 · Dos defectos que impedían usar cualquier cuenta nueva

Commits `2c045e0b`, `e55e75b7` y `4abaf1ff`.

**El programa no abría para ninguna cuenta recién creada.**

```
L&A SUITE · INSTALACIÓN INICIAL
Instalación bloqueada de forma segura
RPC bootstrap no permitido
```

Causa, instrumentando `window.__laOwnerBootstrapRpc`: el arranque llama a
`mfa_politica_leer` y ese nombre nunca se anotó en `RPC_PERMITIDOS` de
`owner-bootstrap-prelock.js`. La llamada no salía del navegador.

Tiene un doble fondo que conviene entender. `mfaExigidaPorElServidorBootstrap`
en `owner-bootstrap-post-reset.js` **ya preveía** que la función faltara en el
servidor —tu migración `20261115120000` sigue sin aplicarse en QA— y en ese caso
falla cerrado, siguiendo con el segundo factor exigido, que es lo correcto. Pero
ese cuidado no se ejercía nunca, porque «RPC bootstrap no permitido» no casa con
el patrón `could not find the function|PGRST202|HTTP 404`. Y solo golpeaba a
quien **no** tiene factor inscrito: con factor, `hayFactorVerificado`
cortocircuita y no se pregunta. Por eso pasaba desapercibido con las cuentas
veteranas y tumbaba exactamente a las nuevas.

Contrato nuevo `tests/arranque/canal-bootstrap-sin-huecos-contract.mjs`: compara
las RPC que el arranque llama por ese canal con la lista blanca y exige que no
haya huecos. **Comprobado que se pone rojo contra la versión de antes del
arreglo**, que es lo único que demuestra que un contrato sirve.
`tests/plataforma/p04-panel-contract.mjs` fija esa lista a mano, y ahí anoté el
motivo de la entrada nueva.

**Una activación de segundo factor a medias dejaba sin salida.** El arranque
bloqueado había dejado un factor TOTP `unverified`. Al volver a entrar, la
pantalla decía «usa el código de la aplicación autenticadora que vinculaste
anteriormente» a alguien que nunca vinculó nada: sin QR, sin clave y sin salida
salvo que alguien se lo retirase por detrás.

Ahora se retira el factor a medias —no da acceso a nada— y se empieza de cero;
si el servidor no deja retirarlo, se vuelve a la conducta anterior pero diciendo
lo que de verdad pasa. `tests/m03/m03-mfa-enforcement-contract.mjs` fijaba la
conducta vieja y pasa a fijar la nueva, defendiendo lo mismo que defendía: que
el factor pendiente se reconozca y no se llame a `enroll()` a ciegas.

Verificado sobre el preview: la cuenta recibió QR y clave nuevos, inscribí el
factor y entró.

### 3 · Q07 en táctil, hecho a medias

Commit `f378292d`.

El diseño activo en QA era **orbita**, así que Pase ni se montaba. Lo activé con
**«Probar en la suite»**, que es temporal: **la apariencia guardada de la
empresa no la he tocado**.

La diferencia con tu pasada está en el puntero, y no es cosmética. Tú mediste a
390 px de ancho; yo medí además con **puntero grueso**: `any-pointer: coarse`
cierto, cinco puntos de contacto y agente de Android. Eso es lo que activa el
suelo táctil de 44 px; una ventana estrecha de escritorio no lo activa, así que
una medida a 390 px sin eso no dice nada sobre el tamaño de los controles.

**Así medido, Pase pasa**: 54 controles, ninguno por debajo de 44×44, ninguno
sin nombre accesible, sin desbordamiento horizontal.

Lo funcional responde: zonas Todas / Sala QA-A1 / Terraza / Zona vacía; Interior
con `M-QA-01`, `M-QA-02` y `QA-P1-I01` con cuenta abierta y `QA-P1-I02` libre;
Terraza con `QA-P1-T01` abierta y `QA-P1-T02` libre; la zona vacía deja «Esta
zona no tiene mesas activas»; y la cola filtra de verdad — con **Cocina** salen
ocho «Ver en Cocina» con estados «Listo para servir», «Parcialmente listo» y «En
preparación», y con **Cuentas** desaparecen los ocho y salen entradas «Cuenta
abierta» con «Abrir TPV».

Lo anoté en `tpv-03` de la matriz.

## Lo que está roto y sin resolver

### A · El enlace de Pase no lleva a la cuenta que se pide

Tres accesos distintos, el mismo destino:

| Desde | Lo que se pidió | Dónde acabó |
| --- | --- | --- |
| Cola · Cuentas, fila 1 | pedido `9d10ccfc` | cuenta `c1efab29`, pedido `fc83122f` |
| Cola · Cuentas, fila 2 | pedido `5c214429` | cuenta `c1efab29`, pedido `fc83122f` |
| «Lleva más tiempo abierta» → Ver cuenta | Mesa QA-A1-02 | cuenta `c1efab29`, pedido `fc83122f` |

`c1efab29` es simplemente la cuenta que el terminal ya tenía activa. El TPV se
abre, pero sobre otra cuenta, **y no lo dice**.

Tu acta del 15/11 registraba «enlace exacto a la mesa» y «navegación exacta de
Pase al TPV», así que o cambió algo desde entonces, o aquella vez la cuenta
pedida coincidía con la que el terminal ya tenía.

**Causa aislada y corrección integrada (commit `88bb28ac`).** Pase solo enviaba
`mesaId`; el TPV recuperaba la mesa y, cuando el destino no se resolvía o había
más de una cuenta, conservaba la cuenta que el terminal ya tenía activa. No
había comprobación explícita de que la cuenta mostrada fuera la solicitada.

Ahora los tres accesos transportan `mesaId`, `cuentaId` y `operatingDay`.
`navegarRediseno` valida esos valores, `VentaRapida` busca la cuenta exacta en
el mapa real antes de llamar a `recuperarCuentaA06`, y si la cuenta ya no está
en la mesa muestra «La cuenta solicitada ya no está en esta mesa. Vuelve a Pase
y actualiza el estado.» La misma lógica queda reflejada en
`source-recovery/fuente-recuperado.js`; la paridad del cuerpo sigue siendo
exacta. El contrato A06 comprueba tanto el transporte de `cuenta_id` desde la
cola como el mensaje de desajuste.

La reproducción anterior queda como regresión: las dos filas de Cuentas y
«Lleva más tiempo abierta» terminaban en `c1efab29`/`fc83122f`, la cuenta activa
del terminal. Falta repetir esos tres clics en el preview desplegado desde
`88bb28ac`; hasta entonces el arreglo está probado en contrato y código, no
cerrado todavía como recorrido visual en QA.

Las dos hipótesis originales eran:

1. El enlace no lleva el destino hasta el TPV.
2. `recuperarCuentaA06` se niega a cambiar de cuenta —rechaza si la actual tiene
   un cobro pendiente, con «Resuelve primero el cobro pendiente de la cuenta
   actual»— y el resultado se pierde por el camino sin llegar a pantalla.

Para separarlas: instrumentar `recuperarCuentaA06` y mirar si llega a llamarse
con `cuentaIdDestino`, o leer cómo Pase pasa el destino al TPV
(`mesaDestinoTpv`, `pedidoDestinoCocina` y compañía en `fuente.js`). Sea cual
sea, el silencio ya es defecto por sí solo.

### B · La cuenta restringida no tiene QA-A1

Esto es lo que bloquea tus puntos 2 y 4, y es exactamente el fallo que tu propia
acta avisaba que había pasado antes.

Con la sesión de Camarero/a dentro, **el menú es el correcto** —Panel general,
TPV, Cocina y nada más—, pero el selector de local ofrece **«Local principal»**,
con un identificador generado en el cliente (`mwkdgowz9s0l1z`), no `QA-A1`. El
historial de ventas sale a cero. La cuenta tiene acceso a la empresa y no tiene
local operativo.

Lo que averigüé de la cadena: `supabase/functions/qa-crear-empleado` llama a
`pm11_finalizar_creacion_cuenta_empleado` pasándole `empleado.local_id`. Desde
la sesión de Propietario la ficha se ve en el Personal de QA-A1, así que por el
lado del cliente el dato parece correcto. `membresias_usuario` **no se deja leer
desde el navegador con ninguno de los dos roles** —responde «permission denied
for function la_usuario_activo»—, así que confirmar y reparar la membresía
necesita acceso a la base de QA. Ahí se me acabó el diagnóstico.

**Estado actualizado (17/11): cerrado en servidor.** La membresía real se
comprobó directamente en QA con una consulta de solo lectura sobre
`auth.users`, `public.membresias_usuario` y `public.empleados`. Para
`qa.permisos.20261116@qa.invalid` la fila activa es `id=221`, con
`empresa_id='QA-EMP-A'`, `local_id='QA-A1'`, `todos_locales=false` y
`rol='Camarero/a'`. No se hizo una escritura redundante. La ausencia de una
fila coincidente en `empleados.datos->>email` no cambia la membresía efectiva;
la cuenta ya tiene el local operativo correcto en `membresias_usuario`.

El ensayo funcional con esa cuenta aún debe repetirse en el preview para
confirmar que el selector muestra QA-A1 y no vuelve a crear un «Local
principal» en el cliente.

### C · Candidato sin confirmar: caja ofrecida a quien no puede operarla

Con el cargo restringido, el TPV le ofrece una sección **«Caja del TPV»** con
**«Abrir fondo»** y **«Ver arqueo y cierre»**. Según
`20260923233000_abc_f2_m03a_autoridad_transaccional.sql`, `ABC_CAJA_OPERAR` es
solo de Propietario, Encargado y Cajero/a.

Al pulsar «Abrir fondo» la negativa que vuelve es «No hay ningún terminal TPV
activo configurado para este local», que es el bloqueo del local vacío y **no**
el del cargo. Así que no se puede separar una cosa de la otra hasta que la
cuenta tenga QA-A1. Queda anotado como candidato, no confirmado.

Para referencia, lo que el servidor concede a **Camarero/a**:

| Capacidad | Camarero/a |
| --- | --- |
| `ABC_CUENTA_OPERAR` | sí |
| `ABC_COBRO_INICIAR` | sí |
| `ABC_COBRO_EFECTIVO` | no |
| `ABC_REEMBOLSO_SOLICITAR` | no |
| `ABC_REEMBOLSO_CONFIRMAR` | no |
| `ABC_CAJA_OPERAR` | no |
| `ABC_EMISOR_CAMBIAR` | no |

## Lo que sigue, por orden

1. **Publicar el commit `88bb28ac` en el Deploy Preview #225 y repetir los tres
   casos de Pase** de la tabla A con un terminal que ya tenga otra cuenta
   activa. Confirmar que cada botón abre la cuenta/pedido pedido y que una
   cuenta obsoleta produce el aviso explícito, nunca un cambio silencioso.
2. **Completar los ensayos de permisos** con
   `qa.permisos.20261116@qa.invalid` en QA-A1: acceso a Sala/Pase,
   consulta de caja, inicio de cobro, solicitud y aprobación de reembolso.
   Registrar controles, mensajes y que las negativas dejan intactos pagos,
   caja y reembolsos. La membresía ya está reparada; solo falta el recorrido
   navegador.
3. **Cerrar el punto 1** en la matriz con las evidencias de los puntos 1 y 2:
   `ini-01`, `tpv-03`, `tpv-06`, `tpv-09`, `tpv-18`, `tpv-20`, `caj-11` a
   `caj-13` y `caj-22`.
4. **Aplicar `20261115120000`** (MFA opcional) en QA solo si se autoriza. Mientras no esté, a cada
   cuenta nueva se le exige segundo factor aunque su cargo no lo requiera, que
   es justo lo contrario de lo que esa migración quiere.

## Lo que falta, más allá de esta tanda

La matriz de 267 vistas, al corte de hoy: **230 pasan**, **21 sin construir**,
**14 bloqueadas**, 1 parcial y 1 sin ejercitar a propósito.

Seis asuntos dependen del servidor de QA, detallados en
[`LO_QUE_QUEDA_FUERA_DE_QA_2026-11-16.md`](LO_QUE_QUEDA_FUERA_DE_QA_2026-11-16.md):
la RPC de salida de stock —que tú ya resolviste con `0e95b42a` y `6003c08b`, así
que ese punto del documento está desactualizado—, el despliegue de
`entrevista-personal`, el `GRANT` sobre `prefiltros_candidatos`, la fila en
`private.plataforma_admins`, una instalación vacía para `acc-08`, y la migración
de MFA opcional.

Dos filas esperan una decisión y no trabajo: `cal-03` —si editar un punto de
control forma parte del producto— y `sis-13`, sin ejercitar para no borrar QA.

De las 21 sin construir, `tpv-09` y `tpv-26` se construyeron en esta rama. Una
advertencia sobre las otras 21: **no te fíes del cliente para decidir si el
servidor sabe hacer algo**. Yo di por imposible «unir mesas» porque miré qué RPC
llamaba el cliente; `public.abc_unir_cuentas` llevaba meses escrita en las
migraciones, con catorce motivos de negativa, y nadie la había llamado nunca. La
fuente buena son las 211 migraciones, no el bundle.

## Estado al reanudar · verificación adicional

La revisión estática no encuentra ningún acceso de Pase a TPV que siga
enviando solo `mesaId`: los tres caminos de cuenta usan `destinoMesa(...)` y
transportan `cuenta_id`; los botones genéricos «Abrir TPV» de zona vacía no
pretenden abrir una cuenta concreta. A06-1, A06-2, A06-3, CFG6E (77/77), P08
(32/32) y P08C pasan, y la paridad de fuente sigue en PASS.

En esta reanudación la superficie de navegador de Codex no estaba disponible,
por lo que no se introdujeron credenciales ni se simuló una sesión. Queda como
acción manual en el preview repetir los tres casos de Pase y ejecutar el
recorrido de permisos con la cuenta Camarero/a ya vinculada a QA-A1.

## Convenciones de la casa, por si acaso

- `fuente.js` y `source-recovery/fuente-recuperado.js` se editan **siempre a la
  vez**; se comprueba con `python -I source-recovery/recuperar_candidato.py
  --check` → `PARIDAD_CUERPO_EXACTA=1`.
- Un contrato nuevo hay que registrarlo en `tests/ci/manifiesto_clasificacion.json`,
  en `.github/scripts/validar-manifiesto-ci.mjs` y en los contadores de
  `.github/workflows/puerta-ci-release.yml`. Y **confirmarlo antes** de validar:
  el inventario sale de `git ls-tree -r HEAD -- tests/`.
- Varios contratos fijan por texto literal tramos del cableado del TPV y del
  arranque. Están puestos a propósito: cuando un cambio los rompe, se actualiza
  el texto fijado con el motivo escrito, no se esquiva el ancla.

## Verificación live añadida · 17/11/2026

La cuenta `qa.permisos.20261116@qa.invalid` entra como **Camarero/a** y el
selector real muestra `Local A1 · QA Empresa A, S.L.`. El arreglo del estado
antiguo «Local principal» está en `a97841eb`, desplegado en el preview 225;
`fuente.js` y `source-recovery/fuente-recuperado.js` conservan paridad exacta.

En TPV, con `QA terminal A1 (siembra etapa 1)`, el servidor muestra «No tienes
permiso para operar este TPV en el local seleccionado» y deja la cola fiscal
pendiente. Se abrió el flujo **Anular venta** hasta la confirmación y se pulsó
«Cancelar»; no se creó cobro, reembolso ni anulación. El modo caja no mostró
un control operativo autorizado para este rol. La prueba demuestra la
denegación live del terminal, pero siguen pendientes caja con Propietario o
Cajero, Q07/Q08 en dos perfiles y el recorrido explícito de las RPC de
cobro/reembolso para el rol Camarero/a.
