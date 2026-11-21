# L&A Suite · Traspaso a Claude Code · 17 de noviembre de 2026

Continuar en `Plopezm1990/Almacen`, rama `rediseno/f0-base-qa`, [PR #225 en borrador contra `release`](https://github.com/Plopezm1990/Almacen/pull/225). Trabajar en el [Deploy Preview #225](https://deploy-preview-225--chic-entremet-9107cf.netlify.app/), proyecto Supabase QA `qjqorixtkilwsndqayyx`, empresa `QA-EMP-A`, local `QA-A1`. Mantener el PR sin fusionar y verificar el SHA del preview antes de cada tanda. La última referencia funcional comprobada es `9d4e6d74` y la evidencia se publicó en `9e6f4cef`. [Puerta general de CI de `9e6f4cef`](https://github.com/Plopezm1990/Almacen/actions/runs/43952689302).

## Reanudar por aquí

> **Estado vigente (17/11/2026):** la lista histórica de este apartado queda sustituida por «Cierre formal del punto 1» al final del documento. Q07, Q08, albarán, anticipos, permisos de Camarero/a y regresión Pase → TPV ya están cerrados con evidencia de QA; no reabrirlos. Solo siguen opcionales los puntos indicados allí.

1. **Completar la cuenta restringida de QA-A1.** La ficha sintética **QA Permisos TPV 20261116** ya se creó en Personal. El alta quedó preparada con `qa.permisos.20261116@qa.invalid`, rol **Camarero/a** y campo de contraseña inicial pendiente. El propietario autorizó crearla. La consulta de QA del 17/11 confirmó que todavía no existe en Auth. Completar el alta por la vía autorizada, con la credencial en el navegador o el canal seguro del equipo. Comprobar después que tiene membresía activa con `local_id = 'QA-A1'`, `todos_locales = false` y rol Camarero/a. Las altas anteriores desde Personal llegaron a tener acceso a la empresa y carecían de local operativo. Si ocurre otra vez, resolver únicamente la membresía de la cuenta sintética en QA por el procedimiento autorizado y confirmar que el selector muestra **Local A1**.
2. **Probar permisos con una sesión real.** Usar Chrome o Edge para la sesión restringida y el navegador integrado para conservar el control de Propietario. Verificar acceso a Sala/Pase donde corresponda la capacidad y las restricciones sobre consulta de caja, inicio de cobro y solicitud/aprobación de reembolso. Registrar qué controles aparecen, qué mensaje devuelve el producto y que los intentos denegados dejan intactos pagos, caja y reembolsos. Los ensayos SQL previos ya verificaron las respuestas del servidor. Para comprobar el caso positivo de Cajero/a hacen falta una cuenta de QA-A1 operativa y su segundo factor cuando se exija. Las credenciales de los ensayos MFA anteriores ya no están disponibles.
3. **Cerrar Q07 en un dispositivo táctil.** Probar Interior/Terraza, zona vacía, ficha y enlace exacto, filtros de cola y estados visibles con el cargo real. A 390 px y con movimiento reducido se verificaron selección y ancho sin desbordamiento. En teclado se probaron filtros con Enter. El modelo usa `ABIERTO` para el pedido guardado, y la lista de cuentas abiertas y aparcadas consulta al servidor. Registrar lo que muestra el producto en ese caso. Q08 ya tiene el recorrido, conciliación y reintento verificados con dos terminales de Propietario.
4. **Actualizar la matriz y cerrar el punto 1** cuando se adjunten las evidencias de permisos y del dispositivo real. Usar [el acta del punto 1](QA_PUNTO1_TPV_SALA_CAJA_2026-11-15.md) y [la matriz de 267 vistas](MATRIZ-IMPLANTACION-QA.csv). Añadir evidencia a `ini-01`, `tpv-03`, `tpv-06`, `tpv-09`, `tpv-18`, `tpv-20`, `caj-11` a `caj-13` y `caj-22` según lo efectivamente comprobado. Una de las notas antiguas de `caj-22` conserva el bloqueo previo al ensayo en dos navegadores. Tomar esta acta para el resultado fechado del 16/11.

## Evidencia ya obtenida

| Frente | Resultado y referencia |
| --- | --- |
| Arranque y cuota | Cambiar de cuenta agotaba `localStorage` al apartar datos como auditoría y gastos generales. `be0b722a` traslada las copias aparcadas a IndexedDB después de confirmar la escritura, separadas por cuenta y generación. El banco de copias pasó 32/32 y el usuario abrió Local A1 en el navegador que fallaba. Desde esa sesión se preparó la ficha sintética. |
| Q07, Pase | Interior y Terraza libres al comenzar, zona vacía y navegación exacta de Pase al TPV. Se usaron mesas sintéticas `QA-P1-I02` y `QA-P1-T02`. Interior pasó de libre a ocupada con dos comensales y volvió a libre tras cerrar la cuenta. Los pedidos del 15/11 quedaron abiertos y el TPV los indica como de otro día operativo. |
| Q08, TPV y Cocina | A1 guardó un café con leche con variante Pequeño, extra Leche de avena y nota de ensayo. A2 recuperó el mismo pedido y generó una sola comanda en Cocina QA-A1. A1 comprobó la nota y completó preparación y servicio. El configurador indicaba «Alérgenos: sin declarar» para este artículo. |
| Q08, caja e idempotencia | A2 cobró 1,54 € en el simulador de QA con 5,00 € y 3,46 € de cambio. A1 reintentó sobre el saldo que aún mostraba y recuperó el resultado confirmado. La consulta posterior dio una cuenta cerrada, un checkout, un pago, un asiento, un documento fiscal y un movimiento de stock. |
| Ticket de sala | El recibo mostraba efectivo y cambio fijos e IVA cero. `9d4e6d74` usa la línea fiscal emitida y los pagos del checkout. Reabierto en el preview el mismo **TPV-36**, secuencia **32**, con base 1,40 €, IVA al 10 % de 0,14 €, total 1,54 €, entregado 5,00 €, cambio 3,46 € y mesa/zona correctas. Se verificaron 22 pruebas locales, la paridad de `fuente.js` con `source-recovery` y CI. La fiscalización del ensayo figura en `SIMULADOR_C07D`, con transporte real desactivado. |
| Albarán y Encargos | En `SIM-0001` se verificó el diálogo **Anular entrada y editar** y que **Cancelar** conserva el albarán. En `QA-P1-ANT-1115` se comprobó una señal de 1,00 € y un único `REVERSO` asociado al cancelar. El encargo quedó en el historial como Cancelado. |
| Salidas de stock | `0e95b42a` y `6003c08b` conectan salida manual, Mermas y merma desde caducidad a la autoridad del servidor. Persistencia confirmada al recargar y en Firefox independiente. Tres salidas de 2, 1 y 6 unidades, coste total de 18,00 € y saldo final de 3 unidades. El historial de QA contiene `20261116171854`. Matriz `ini-06`, `inv-02`, `inv-33` e `inv-34`. |

Identificadores para la comprobación del ticket existente en QA. Mesa `QA-P1-I02`, cuenta `afe3a901-3c7c-4d97-89a4-7401cbe581bc`, pedido `12455871-81ff-455b-bd25-5c90436c9e01`, comanda `6b330c07-9856-47e2-9644-e7c9c924ff69`, checkout `272395a6-cbf2-4de2-8410-426b4c95256d`, pago `0176f247-645e-4de6-88dc-f99fcdd2503d`. Abrir el ticket guardado para revisar importes y stock. Chrome permitió controlar A2. En Firefox se verificó stock manualmente y la herramienta de control de Windows se detuvo cuando intentó manejarlo.

## Estado del plan general

- **Matriz al corte.** 230 vistas con algún estado «Pasa», 21 sin construir, 14 bloqueadas, una parcial y una sin ejercitar a propósito. El grupo «Pasa» incluye aperturas, estados vacíos y acciones medidas sin ejecutar. `tpv-09` y `tpv-26` ya se construyeron en esta rama. Contrastar las 21 restantes con las migraciones y los requisitos del Plan maestro antes de decidir el alcance de cada pantalla.
- **Apariencia.** El catálogo permite elegir entre nueve diseños, seis paletas y colores propios, probar temporalmente, guardar por empresa y restaurar. La fila `org-37` recoge propagación entre locales y sesiones, revisión obsoleta, auditoría y delegación concedida y retirada. Los cargos restringidos se probaron para Apariencia, cuyo alcance es de empresa. La prueba de caja, cobros y reembolsos requiere alcance de local.
- **Historial de migraciones.** El 17/11 se confirmó que Apariencia responde y su tabla de delegaciones existe. `20261113090000` y `20261113140000` siguen ausentes del historial de QA. `20261115120000` de MFA opcional sigue ausente y `mfa_politica_leer()` tampoco está disponible. `20261116171854` de salidas de stock está aplicada y registrada. Resolver el registro pendiente de Apariencia mediante el procedimiento del repositorio, después de contrastar cada versión con lo aplicado en QA.
- **Otros bloqueos del plan.** `per-21` depende de la función `entrevista-personal`, cuya fuente faltaba en el repositorio. `per-24` y `per-25` dependen de los permisos de prefiltros. `org-08` a `org-17` requieren una cuenta autorizada para el Panel de Plataforma. `acc-08` requiere una instalación vacía. `cal-03` depende de decidir si editar puntos de control forma parte del producto. `sis-13` se dejó sin ejercitar para conservar los datos de QA. [Inventario de bloqueos y contexto](LO_QUE_QUEDA_FUERA_DE_QA_2026-11-16.md).

## Referencias para revisar

- [Acta de TPV, sala y caja](QA_PUNTO1_TPV_SALA_CAJA_2026-11-15.md) con los ensayos del 15 y del 16, el albarán, Encargos y las pruebas SQL por cargo.
- [Matriz de implantación](MATRIZ-IMPLANTACION-QA.csv) para la cobertura de las 267 vistas y su evidencia por fila.
- [Traspaso inicial](TRASPASO_QA_CLAUDE_2026-11-13.md) y [base de QA](F0_BASE_QA_2026-11-13.md) para la historia de Apariencia, Pase, despliegue y contratos.
- Paquete original `LA-Suite-Traspaso-QA`, en particular `01-PLAN-INTEGRACION-QA.md`, `03-ESPECIFICACION-FUNCIONAL.md` y `04-PRUEBAS-Y-ACEPTACION.md`, para el alcance del rediseño y los casos Q07/Q08.

## Resultado del 17/11 por la tarde · Claude Code

Lo de este tramo salió casi todo del punto 1, y lo que salió no era un permiso
mal puesto.

### Completada el alta de la cuenta restringida

`qa.permisos.20261116@qa.invalid`, rol **Camarero/a**, creada desde Personal →
«QA Permisos TPV 20261116» → Crear cuenta de acceso. La credencial queda en el
fichero local de credenciales, fuera de git.

### Dos defectos que impedían usarla, los dos corregidos

**1 · Ninguna cuenta nueva podía entrar en el programa.** Al entrar con ella,
la aplicación no abría:

```
L&A SUITE · INSTALACIÓN INICIAL
Instalación bloqueada de forma segura
RPC bootstrap no permitido
```

Instrumentando el canal: el arranque llama a `mfa_politica_leer` y ese nombre
nunca se anotó en `RPC_PERMITIDOS` de `owner-bootstrap-prelock.js`. La llamada
no salía del navegador.

El código ya preveía que esa función pudiera faltar en el servidor —la
migración `20261115120000` sigue sin aplicarse en QA— y en ese caso falla
cerrado, que es lo correcto; pero ese cuidado no se ejercía nunca, porque el
error no se parecía a un «función no encontrada». Y solo golpeaba a quien **no**
tiene factor inscrito: con factor, el arranque ni pregunta. Pasaba desapercibido
con las cuentas veteranas y tumbaba exactamente a las recién creadas.

Contrato nuevo `tests/arranque/canal-bootstrap-sin-huecos`, que compara lo que
el arranque llama por ese canal con la lista blanca. Comprobado que se pone rojo
contra la versión de antes. `tests/plataforma/p04` fija esa lista a mano y se
anotó allí el motivo.

**2 · Una activación de segundo factor a medias dejaba sin salida.** El intento
bloqueado había dejado un factor TOTP sin verificar. Al volver a entrar, la
pantalla decía «usa el código de la aplicación autenticadora que vinculaste
anteriormente» a alguien que nunca vinculó nada: sin QR, sin clave y sin salida.
Ahora se retira el factor a medias —no da acceso a nada— y se empieza de cero;
si el servidor no deja retirarlo, se vuelve a la conducta anterior pero diciendo
lo que pasa. El contrato de M-03 pasa a fijar la conducta nueva.

Verificado sobre el preview: la cuenta recibió QR y clave nuevos, se inscribió
el factor y entró.

### El punto 1 sigue bloqueado, y ahora se sabe dónde

Con la sesión de Camarero/a dentro, el menú es el esperado —Panel general, TPV,
Cocina— pero **el selector de local ofrece «Local principal», no «Local A1»**.
Ese local lleva un identificador generado en el cliente, no `QA-A1`, y el
historial de ventas sale a cero. Es decir, la cuenta tiene acceso a la empresa y
no tiene local operativo: justo lo que esta acta avisaba que había pasado antes.

La membresía la escribe `pm11_finalizar_creacion_cuenta_empleado` a partir de
`empleado.local_id`, según `supabase/functions/qa-crear-empleado`. Desde la
sesión de Propietario la ficha se ve en el Personal de QA-A1, así que por el
lado del cliente el dato parece correcto; `membresias_usuario` no se puede leer
desde el navegador con ninguno de los dos roles, así que confirmar y reparar la
membresía necesita a alguien con acceso a la base de QA.

Lo que sí se midió con el cargo restringido, aunque sea sobre el local vacío:
el TPV le ofrece **«Caja del TPV» con «Abrir fondo» y «Ver arqueo y cierre»**,
siendo que `ABC_CAJA_OPERAR` es solo de Propietario, Encargado y Cajero/a según
`20260923233000_abc_f2_m03a_autoridad_transaccional.sql`. Al pulsar «Abrir
fondo» la negativa que vuelve es «No hay ningún terminal TPV activo configurado
para este local», que es el bloqueo del local vacío y no el del cargo, así que
no se puede separar una cosa de la otra hasta tener QA-A1. Queda anotado como
candidato a defecto de pantalla, no confirmado.

Para referencia, lo que el servidor concede a **Camarero/a**: `ABC_CUENTA_OPERAR`
sí, `ABC_COBRO_INICIAR` sí, `ABC_COBRO_EFECTIVO` no, `ABC_REEMBOLSO_SOLICITAR`
no, `ABC_REEMBOLSO_CONFIRMAR` no, `ABC_CAJA_OPERAR` no, `ABC_EMISOR_CAMBIAR` no.

### Lo que queda, por orden

1. Reparar la membresía de `qa.permisos.20261116@qa.invalid` en QA para que
   tenga `local_id = 'QA-A1'`, `todos_locales = false` y rol Camarero/a.
   Necesita acceso a la base: no se puede desde la aplicación.
2. Con eso, los ensayos de caja, cobro y reembolso del punto 2 del acta.
3. Q07 en dispositivo táctil, sin empezar.
4. Aplicar `20261115120000` en QA haría que a Camarero/a no se le exija segundo
   factor, que es la intención de esa migración; mientras no esté, cada cuenta
   nueva tiene que inscribirlo.

## Q07 en táctil · 17/11, Claude Code

Hecho con la sesión de Propietario, no con el cargo restringido, que sigue sin
local operativo. El diseño activo en QA era **orbita**, así que Pase no se
montaba; se activó con **«Probar en la suite»**, que es temporal y no toca la
apariencia guardada de la empresa.

La diferencia con la pasada anterior está en el puntero. Antes se midió a 390 px
de ancho; esta vez además con **puntero grueso**: `any-pointer: coarse` cierto,
cinco puntos de contacto y agente de usuario de Android. Es lo que activa el
suelo táctil de 44 px, que con una ventana estrecha de escritorio no se aplica.

**Medido así, Pase pasa:** 54 controles, **ninguno por debajo de 44×44**,
ninguno sin nombre accesible y sin desbordamiento horizontal.

Lo funcional, con el plano y la cola:

- Zonas: Todas, Sala QA-A1, Terraza · Ensayo punto 1, Zona vacía · Ensayo
  punto 1. Interior muestra `M-QA-01`, `M-QA-02` y `QA-P1-I01` con cuenta
  abierta y `QA-P1-I02` libre; Terraza, `QA-P1-T01` con cuenta abierta y
  `QA-P1-T02` libre.
- El filtro de zona vacía responde y deja «Esta zona no tiene mesas activas».
- La cola tiene Todos / Cocina / Cuentas y el filtro cambia de verdad lo que se
  ve: con **Cocina** salen ocho «Ver en Cocina» con estados «Listo para servir»,
  «Parcialmente listo» y «En preparación»; con **Cuentas** desaparecen los ocho
  y aparecen entradas «Cuenta abierta» con «Abrir TPV».

### Lo que no pasa: el enlace no lleva a la cuenta que se pide

Probados tres accesos distintos y los tres acaban en la **misma** cuenta, que es
la que el terminal ya tenía activa:

| Desde | Lo que se pidió | Dónde acabó |
| --- | --- | --- |
| Cola · Cuentas, fila 1 | pedido `9d10ccfc` | cuenta `c1efab29`, pedido `fc83122f` |
| Cola · Cuentas, fila 2 | pedido `5c214429` | cuenta `c1efab29`, pedido `fc83122f` |
| «Lleva más tiempo abierta» → Ver cuenta | Mesa QA-A1-02 | cuenta `c1efab29`, pedido `fc83122f` |

El TPV se abre, pero sobre otra cuenta, **y no lo dice**. El acta del 15/11
registraba «enlace exacto a la mesa» y «navegación exacta de Pase al TPV», así
que o bien algo cambió desde entonces, o aquella vez la cuenta pedida coincidía
con la que el terminal ya tenía.

No he separado todavía las dos causas posibles: que el enlace no lleve el
destino, o que el TPV se niegue a cambiar de cuenta —`recuperarCuentaA06`
rechaza el cambio si la cuenta actual tiene un cobro pendiente— y se quede
callado. Sea cual sea, el silencio es defecto por sí solo: quien toca una mesa
acaba en otra cuenta sin que nada se lo advierta. Queda como **candidato
confirmado en los síntomas y sin causa aislada**, con la reproducción de arriba.

Nota de método: los toques los da el panel como clics de ratón sobre una
emulación táctil, no un dedo sobre cristal. El suelo de 44 px y las medias
queries sí se evalúan como en un móvil; el gesto, no.

---

**Traspaso de vuelta.** Todo lo de esta tarde está reunido, completo y
autónomo, en [`TRASPASO_QA_CODEX_2026-11-17.md`](TRASPASO_QA_CODEX_2026-11-17.md):
qué se hizo, qué está roto con su reproducción, qué sigue por orden y qué falta.
Empieza por ahí.

## Addendum Codex · 17/11/2026

La membresía de `qa.permisos.20261116@qa.invalid` ya está correcta en QA:
`QA-EMP-A`, `QA-A1`, `todos_locales=false`, rol `Camarero/a`, activa. Se
confirmó por SQL de solo lectura; no hace falta otra reparación de datos.

El defecto de Pase → TPV quedó aislado y corregido en `88bb28ac`: el panel
transporta ahora `mesaId`, `cuentaId` y `operatingDay`, y el TPV valida la
cuenta exacta o muestra un aviso explícito si el destino ya no existe. Se
mantiene la paridad con `source-recovery/fuente-recuperado.js`. Falta repetir en
el preview los tres casos que antes acababan silenciosamente en la cuenta activa
del terminal.

El acta de punto 1 se actualizó con este estado en `302237a1`; la matriz CSV
conserva todavía sus notas de pendiente y debe actualizarse cuando se cierre la
evidencia de permisos y de los tres casos Pase → TPV. El orden actual es:
desplegar y repetir esos tres casos; ejecutar en QA-A1 los ensayos de permisos
de caja, cobro y reembolso con la cuenta Camarero/a; cerrar las filas del punto
1; y solo después valorar la migración MFA opcional. Mantén el PR #225 en
borrador y trabaja únicamente contra QA.

## Evidencia live añadida por Codex · 17/11/2026

La cuenta `qa.permisos.20261116@qa.invalid` ya entra en el local operativo
correcto: **Local A1**, no «Local principal». El arreglo está desplegado en
`a97841eb` y mantiene paridad exacta entre `fuente.js` y
`source-recovery/fuente-recuperado.js`.

En TPV con `QA terminal A1` el servidor devuelve el mensaje visible «No tienes
permiso para operar este TPV en el local seleccionado» y mantiene el QR fiscal
pendiente. Se abrió **Anular venta** hasta la confirmación y se canceló; no se
confirmó ninguna mutación económica. El intento de modo caja tampoco mostró un
control operativo autorizado para Camarero/a. Queda pendiente que Claude
recorra las RPC de caja/cobro/reembolso de forma explícita, abra Q07 y Q08 en
dos perfiles y cierre la evidencia de `caj-11`–`caj-13`, `caj-22`, `tpv-03` y
`tpv-06` sin fusionar el PR #225.

## Tanda de propietario añadida · 17/11/2026

Con `pm07.smoke@qa.invalid` abierta en QA-A1, el servidor indicó que ya había
una sesión de caja activa. El arqueo se confirmó con contado `0,00 €` y cerró
el día: esperado `109,90 €`, descuadre `-109,90 €`. No se registraron entradas,
retiradas ni reembolsos.

Pase se activó solo con «Probar en la suite» y se restauró al salir. El panel
cargó 4/6 mesas con cuenta abierta, 77 pedidos en servicio y el plano real de
QA-A1. «Ver cuenta»/la mesa no dejaron una navegación TPV observable en esta
sesión; repetir con cuenta activa y terminal diferente.

QA mostró avisos de almacenamiento local lleno (`historialRespaldos` y
`productos`), incidencia separada del rediseño. Los dos perfiles IAB comparten
el terminal guardado A1; Q07/Q08 con A1 y A2 requiere Firefox/Chrome separado o
limpiar el terminal por «Terminales y cajas».

## Ajuste Codex para dos terminales en QA · 17/11/2026

El bloqueo de los dos perfiles IAB quedó resuelto en la rama del PR #225. En
Deploy Preview, el componente de TPV vuelve a mostrar el selector de terminal
aunque la pestaña ya tenga uno persistido. La elección de cada pestaña se
guarda en `sessionStorage` con una clave de preview, por lo que una pestaña
puede quedarse en A1 y otra en A2 sin compartir la selección. La resolución de
contexto de caja, movimientos, ventas y reembolsos usa la misma fuente.

Fuera de `deploy-preview-*` no cambia la persistencia de producción: continúa
siendo `localStorage`. Después del despliegue, repetir Q07/Q08 en dos pestañas
del preview seleccionando explícitamente `QA terminal A1 (siembra etapa 1)` y
`QA terminal A2 (ensayo punto 2)`. Esto evita depender del control remoto de
Firefox, que está bloqueado por la política de URL del navegador de Codex.

Publicado en Deploy Preview 225 con `31e7aef3997d77c1979f46394996dcd73c2e1470`.
La verificación live en QA-A1 confirma que el selector ofrece A1 y A2 incluso
cuando A1 ya estaba guardado. Falta ejecutar la batería económica Q07/Q08 con
una sesión de caja válida en cada terminal.

## Ensayo live adicional A1 · 17/11/2026

Codex repitió la primera mitad de Q07/Q08 con `pm07.smoke@qa.invalid` en A1.
Pase mostró el plano real y se abrió la mesa libre `QA-P1-I02`. En TPV se
guardó una cuenta Mesa de 1,54 € con Café con leche (QA), Pequeño, Leche de
avena y la nota «QA Q08 A1-A2 · ensayo selector terminal». La cuenta es
`a8549e71-534b-4ba7-a2e8-96f5ba79febf` y el pedido
`d1a47ffa-f5c6-4fd8-b458-7996993f67e7`; se envió una única comanda y quedó
`Enviado a cocina`. No se cobró ni se cerró caja. Falta comprobar la
recuperación en A2, los estados de cocina y el cobro final con autorización
puntual antes de la operación financiera.

## Resultado Q08 · 17/11/2026

El efectivo simulado de 1,54 € fue confirmado en Firefox: pendiente 0,00 €,
QR fiscal QA preparado y `TPV-37`, secuencia 33, con AEAT real desactivada. La
comanda se avanzó por Enviado a cocina, En preparación, Listo para servir y
Servido. Después se ejecutó el cierre formal; la cuenta
`a8549e71-534b-4ba7-a2e8-96f5ba79febf` ya no aparece en cuentas abiertas. No se
usó tarjeta, no hubo reembolso y no se cerró la caja. Este recorrido de Q08
queda cerrado.

## Sesión Camarero/a · 17/11/2026 · evidencia live

La cuenta `qa.permisos.20261116@qa.invalid` entró como Camarero/a en QA-A1.
Se corrigió el contexto inicial de «Todos los locales» seleccionando
explícitamente «Local A1» antes del ensayo. El TPV muestra los terminales A1/A2,
pero el cobro queda deshabilitado y la fiscalización devuelve
`C07D_CONFIG_NO_AUTORIZADO` con el aviso «No tienes permiso para operar este
TPV en el local seleccionado»; el QR queda pendiente y no se creó ningún pago
ni documento.

El modo caja solo permite entrar y salir de la vista; no aparecen controles
autorizados de apertura, movimientos o arqueo. En «Más», el cargo restringido
solo ve «Apariencia» y no ve Devoluciones ni módulos financieros. No se
seleccionó venta ni se pulsó ninguna operación económica.

Después se capturaron las respuestas RPC con los claims de esta misma cuenta,
en transacciones revertidas para no persistir datos: `abc_abrir_sesion_caja`
devolvió `abc_caja_no_autorizado`, `abc_iniciar_cobro` devolvió
`abc_efectivo_no_autorizado` y `abc_solicitar_reembolso` devolvió
`abc_reembolso_no_autorizado`. La consulta posterior confirmó cero operaciones,
cero sesión ficticia, cero reembolso ficticio y el pago de referencia intacto.
La denegación server-side de Camarero/a para caja, cobro y reembolso queda
cerrada. Falta únicamente actualizar las celdas históricas de
`caj-11`–`caj-13`, `tpv-03` y `tpv-06` con este addendum y completar la
repetición de los tres destinos Pase → TPV. Mantener el PR #225 en borrador y
no conceder delegaciones durante esta comprobación.

## Regresión live de los tres destinos Pase → TPV · 17/11/2026

Con el propietario `pm07.smoke@qa.invalid` en `QA-A1`, terminal A1 y Pase
activo únicamente con «Probar en la suite», se repitieron los tres accesos
sin cobrar ni cerrar cuentas.

- **Cuentas / `9d10ccfc`**: el pedido corresponde a la cuenta
  `aa53c595-293d-4b5c-8df8-eaf8a3b0fd6a`, pero no tiene fila de mesa vigente.
  El botón se renderiza como «Abrir TPV» sin destino y el TPV conserva la
  cuenta previa del terminal (TPV-37, 1,54 €). Falla el aislamiento.
- **Cuentas / `5c214429`**: la cuenta de la fila es
  `3a9bb395-4b86-4640-9ac8-40391469966b`, total de líneas 3,85 €, también sin
  mesa vigente. El TPV vuelve a la cuenta previa abierta (1,54 €), no a la
  cuenta de la fila. Falla el aislamiento.
- **«Lleva más tiempo abierta» → «Ver cuenta»**: el destino sí transporta
  mesa y cuenta. El TPV no reutiliza la cuenta previa y muestra el aviso
  explícito «La cuenta pertenece a otro día operativo y requiere resolución
  antes de continuar». El caso obsoleto deja de fallar en silencio.

Conclusión: `88bb28ac` corrige el enlace cuando hay mesa de destino, pero no
los dos elementos de cola sin mesa. Hay que decidir y construir el contrato
de cuenta independiente (pasar `cuentaId`/`operatingDay` sin `mesaId`) o
deshabilitar esos accesos con un mensaje claro. No cerrar `tpv-03` hasta que
los dos primeros casos dejen de conservar el contexto del terminal.

### Cierre de la regresión · commit e0fe9ebb

Se implementó la opción de cuenta independiente: la cola transmite
`cuentaId`/`operatingDay` aunque no exista `mesaId`; el TPV recupera la cuenta
autoritativamente y muestra el estado también cuando el destino no tiene mesa.
Mientras el servidor resuelve o rechaza el destino, quedan bloqueados cobro y
venta rápida. Se mantuvo la paridad de `fuente.js` con
`source-recovery/fuente-recuperado.js` y pasaron `tests/f3/a06/a06-1-ui-contract.mjs`,
`a06-2-ui-contract.mjs` y el verificador de paridad.

En Deploy Preview 225 se repitieron los tres casos con el propietario en
`QA-A1`, terminal A1 y Pase temporal. Las dos filas sin mesa (`9d10ccfc` y
`5c214429`) y el acceso prioritario de `QA-A1-02` mostraron el aviso explícito
«La cuenta pertenece a otro día operativo y requiere resolución antes de
continuar»; ninguno conservó la cuenta previa del terminal. No hubo cobros,
cierres ni otras mutaciones. La regresión de aislamiento queda cerrada; solo
queda opcional crear una cuenta del día actual para probar el camino positivo
de recuperación sin mesa.

### Ensayo positivo completado · cuenta del día actual sin mesa

Se creó la cuenta QA `d802aad8-0099-4092-945b-01adfbb9a569` con el pedido
`87cf1dad-ea65-4970-a2b8-0e96899441f8`, una línea de Café con leche (QA) por
1,32 €, día operativo `2026-11-17` y `mesa_id = NULL`. Se envió a cocina y se
marcó `SERVIDO`, sin cobro ni cierre. Desde **Cuentas abiertas y aparcadas** se
usó **Retomar**: el preview mostró «Cuenta retomada. El TPV ha pasado a Sala y
la cuenta está abajo, en el pedido operativo». La consulta de solo lectura
confirmó `ABIERTA`, el mismo día y ningún vínculo de mesa.

La recuperación positiva queda verificada a nivel servidor y de interfaz. No
se pudo hacer clic en la fila desde la cola visible de Pase porque esta limita
la muestra a 8 de 78 pedidos; la cuenta sintética queda fuera de esa ventana.
La limitación queda como pendiente independiente de paginación/búsqueda de la
cola. No se hizo ningún cobro, reembolso ni cierre de la cuenta.

## Cierre formal del punto 1 · 17/11/2026

La matriz se actualizó en `ini-01`, `tpv-03`, `tpv-06`, `tpv-09`, `tpv-18`,
`tpv-20`, `caj-11`, `caj-12`, `caj-13` y `caj-22` con la evidencia de QA ya
obtenida. El punto 1 queda **cerrado funcionalmente en QA**: Q07 táctil, Q08
con A1/A2, sala, TPV, caja, cobro simulado, ticket, albarán, anticipos y las
denegaciones server-side/UI de Camarero/a están cubiertos.

Se mantienen separados como opcionales: positivo de Cajero/a con MFA,
paginación/búsqueda de la cola de Pase y el registro de las migraciones de
Apariencia en el historial. La cuenta sintética
`d802aad8-0099-4092-945b-01adfbb9a569` y el pedido
`87cf1dad-ea65-4970-a2b8-0e96899441f8` siguen abiertos en QA, sin cobro ni
reembolso, para conservar la evidencia. No usar `sis-13` ni restablecer QA;
limpiar esa cuenta solo mediante un procedimiento de QA separado.

El PR #225 continúa en borrador, la rama sigue siendo `rediseno/f0-base-qa` y
no se tocó producción.

## Addendum Punto 2 · nueve propuestas visuales · 17/11/2026

El catálogo y el sistema visual quedan fijados por el contrato
`tests/rediseno/p05-propuestas-contract.mjs`: nueve diseños, seis paletas,
54 combinaciones diseño × paleta, Rumbo (teclado, fijadas y recientes), Pase
(destinos mesa/cuenta) y reglas responsive/movimiento reducido. P05 pasa y se
ha incorporado al manifiesto CI; el inventario queda en 370 entradas y 353
contratos activos. P01, P02 (49/49), P03 y P04 siguen en verde.

También se corrigió la marca de caché de `la-pase-panel.js` en `index.html`:
el cambio de destinos exactos ya se sirve con
`qa-destinos-exactos-20261117`, y P01 fija la huella correspondiente. El
detalle de alcance y las comprobaciones pendientes está en
`docs/rediseno/QA_PUNTO2_PROPUESTAS_2026-11-17.md`.

El Punto 2 **no se declara cerrado todavía**: falta repetir en el preview
autenticado la persistencia y el salto concreto de Rumbo, y medir las nueve
composiciones en sus recorridos desktop/móvil con la marca nueva. Órbita
expone ahora también las ventas registradas calculadas del ledger real;
ocupación y comandas no se añaden hasta disponer de un contrato/contexto
verificable. El control de navegador de Windows bloqueó la
reapertura del preview en esta tanda por política de URL, sin tocar sesiones ni
datos económicos.

El último corte de esta tanda es `57cf1c84`.
P01–P05, el manifiesto, la paridad de fuente y `git diff --check` están en
verde localmente; el PR #225 permanece en borrador y sin fusionar. El preview
de Netlify para este SHA está listo. La puerta de CI general aún tiene trabajos
en curso y un `p2-p06` histórico en rojo; no se presenta el conjunto como CI
global verde. Queda pendiente la pasada autenticada del preview: persistencia
y salto de Rumbo y recorrido desktop/móvil de las nueve composiciones.

## Addendum de cierre del Punto 3 · Codex · 18/11/2026

La rama `rediseno/f0-base-qa` queda en `9034d97e` (la corrección de código del
listado está en `a13d5dd7`) y el Deploy Preview #225
correspondiente está listo en
`https://deploy-preview-225--chic-entremet-9107cf.netlify.app/?cache=p3-array-a13d5dd7-reload`.
El PR #225 sigue en borrador y no se ha tocado producción.

### Clientes ya verificados en QA

Con `pm07.smoke@qa.invalid` (Propietario, `QA-EMP-A` / `QA-A1`) se recargó la
pantalla y se vieron los dos clientes de ensayo existentes. Se verificaron
vistas predefinidas, filtros de estado/tipo, búsqueda, paginación `1–2 de 2`,
ficha Resumen/Actividad/Fiscal y el estado vacío de Empresas. El NIF particular
queda enmascarado en listado (`••••678Z`) y completo solo dentro de Fiscal. La
actividad conserva actor, fecha del servidor y anterior/nuevo. El registro
`mwlsn5vplu6tvn` (`QA Punto3 Particular`) queda en QA para reproducibilidad.

El primer despliegue de P3 ocultaba filas porque `clientes_empresa` es una
tabla legacy sin `updated_at` y el bootstrap ordenaba por una columna
inexistente; además el retorno largo de `ClientesPunto3` dejaba el árbol React
incompleto. `a13d5dd7` corrige ambas cosas y añade la regresión al contrato P3.

### Decisión de Compras e Inventario

No se deben reabrir ni inventar pantallas: `com-28`–`com-30` (factura directa,
pago y anulación) y `inv-04`, `inv-15`–`inv-17` (ajuste, aplicación y
reversión) ya tienen evidencia QA en la matriz. `inv-32`, `inv-35` e `inv-36`
siguen fuera del alcance implementado porque no existe superficie en el
bundle; permanecen como decisiones de producto, no como fallos de QA.
`enc-12` se acepta solo como control no destructivo: no se anonimiza ni elimina
el cliente sintético sin autorización explícita.

### Verificaciones ejecutadas

`node --check fuente.js`, `node --check index-storage-bootstrap.js`,
`node tests/p3/p3-clientes-gestion-contract.mjs`,
`node tests/pm14/p06-clientes-aislamiento-contract.mjs`,
`python source-recovery/recuperar_candidato.py --check` y `git diff --check`
quedan en verde. La batería adicional de inventario/compras mantiene las
salvedades históricas ya documentadas; no se ejecutaron cobros, reembolsos,
anonimizaciones, eliminaciones ni `sis-13` en esta tanda.

## Addendum de cierre del Punto 2 · 18/11/2026 · SHA `107aed65`

La pasada pendiente ya está realizada en Deploy Preview #225 con el propietario
de QA-EMP-A en QA-A1. Se actualizó el marcador de `fuente.js` a
`qa-orbita-ventas-20261118` para que el navegador no sirviera el bundle antiguo;
Órbita muestra ahora **Ventas registradas €311,66** desde los movimientos reales.

Las nueve propuestas (Oliva, Claro, Pulso, Patio, Rumbo, Sello, Órbita, Ascua y
Pase) se recorrieron en la suite en 1440×900 y 390×844: composición esperada,
sin overflow y barra inferior móvil. También se midió 1024 px sin overflow. En
Rumbo, la búsqueda «Clientes» abrió la pantalla correcta; aplicado en QA,
«Clientes» quedó en Fijadas y Panel general en Recientes tras recargar. Se
restauró Órbita con el botón oficial como revisión 10.

Pase temporal mostró 4/6 mesas con cuenta abierta, 78 pedidos y caja abierta;
Sala y TPV, Cocina y Caja llegaron a TPV, Cocina y comandas y Arqueo de caja,
respectivamente. Ascua mostró el mismo contexto de servicio. No se cobró,
reembolsó, cerró caja ni se modificó producción. El Punto 2 queda cerrado en
QA; siguen opcionales la paginación/búsqueda ampliada de Pase, el positivo de
Cajero/a con MFA y el bookkeeping de `schema_migrations` de Apariencia.

## Addendum Punto 3 · Clientes, Compras e Inventario · 18/11/2026

Se retomó el tercer punto del plan. El núcleo de Clientes ya está construido
en la rama `rediseno/f0-base-qa` (SHA `3800030e`): tipo Particular/Empresa,
NIF/CIF, búsqueda y filtros, vistas guardadas, paginación, ficha Resumen/
Actividad/Fiscal, NIF particular enmascarado en listado y actividad con actor,
fecha y cambios anterior/nuevo. La eliminación y la anonimización quedan
confirmadas explícitamente y no borran encargos históricos.

El contrato local `tests/p3/p3-clientes-gestion-contract.mjs` pasa en `fuente.js`
y en `source-recovery/fuente-recuperado.js`; también pasa `node --check fuente.js`
y `SOURCE_RECOVERY_CHECK=PASS`. La pantalla todavía requiere el recorrido
autenticado del Deploy Preview para declarar `enc-09`–`enc-12` cerradas: no se
ha afirmado persistencia servidor ni se han creado clientes de ensayo en QA en
esta tanda.

Compras e Inventario permanecen separados. `inv-32`, `inv-35` e `inv-36` siguen
siendo decisiones de alcance (impresión de ficha de coste y biblioteca/editor
de opciones), y los listados que solo tienen evidencia de apertura no se
promueven a “Pasa”. El detalle y el orden de la siguiente pasada están en
`docs/rediseno/QA_PUNTO3_GESTION_2026-11-18.md`.

## Addendum de cierre de alcance · 18/11/2026

Se contrastaron las filas pendientes de la matriz contra la fuente y las 211
migraciones del repositorio. La matriz actual contiene **21 filas exactas con
estado `No construida`**; la cifra histórica de 23 mezclaba además bloqueos de
QA y pantallas no ejercitadas a propósito. El inventario y las decisiones
propuestas están en:

- `docs/rediseno/CIERRE-ALCANCE-PENDIENTES-2026-11-18.md`
- `docs/rediseno/MATRIZ-DECISIONES-PENDIENTES-2026-11-18.csv`

La revisión confirma soporte de servidor parcial para propinas, facturas
completas/rectificativas, variantes/modificadores y zonas/mesas, pero no una
pantalla equivalente; la entrega documental por correo es una migración
candidata aislada y no aplicada en QA/producción. Equipos es solo registro,
no puente de hardware. Bizum, vales regalo, pantalla de cliente, factura
electrónica interoperable, plantillas, teclas por cargo e integraciones no
tienen contrato identificable.

Propuesta de orden: primero `tpv-31`, `caj-16` y propina de `tpv-29`; después
`org-33`, `inv-35`/`inv-36`, `tpv-24` y `tpv-33`; luego integraciones y pagos
externos cuando exista backend aprobado. `sis-14`/`sis-15` se retiran como
andamio de maqueta, `sis-16` se cierra con el comportamiento fail-closed del
producto, y `enc-05`/`org-25` se reencuadran bajo sus pantallas existentes.

No se inició construcción ni se modificaron datos de QA. El siguiente paso
requiere aprobación del alcance por grupo; el PR #225 sigue en borrador y
producción no se ha tocado.

## Addendum Codex · marco Órbita común · 18/11/2026

La recomendación aprobada es usar Órbita como marco común de TPV, Pase, Cocina
y Caja, manteniendo los contratos de negocio intactos. `la-pase-panel.js`
monta ahora el panel operativo también con `data-la-diseno="orbita"` y le da la
clase `la-orbita-pase`; el CSS de Órbita normaliza además el shell histórico
que usaba estilos en línea del tema base. Esto evita que el panel nuevo parezca
Órbita mientras la barra, el fondo y las tarjetas siguen verdes.

La selección se probó mediante «Apariencia → Probar en la suite», sin guardar
la empresa. La evidencia live mostró Local A1, ventas reales del ledger y el
marco temporal de Órbita; la configuración persistida de QA no se cambió.
Antes de fusionar hay que repetir la comprobación visual de TPV, Pase, Cocina y
Caja en 1440×900, 1024, 430, 390 y 320 px y actualizar la matriz con el SHA
final. PR #225 continúa en borrador y producción sigue fuera de alcance.

## Addendum corrección visual de Órbita · 18/11/2026 · SHA `ac4731aa`

La pasada de escritorio/móvil había confirmado la composición de las nueve
propuestas, pero el TPV conservaba verde del shell histórico al activar Órbita.
La causa no estaba en la selección de apariencia: `[data-tema="oscuro"]`
redefinía los tokens CSS en el contenedor y el botón seleccionado «Sala /
restaurante» llevaba un color literal. `la-apariencia.css` fija ahora los tokens
de Órbita en el contenedor operativo (carbón, acero y coral) y normaliza esa
acción a `#FF4B32`; `index.html` usa la marca de caché
`qa-orbita-shell-pase-v5-20261118`; esta revisión corrige además el escape
CSS de `.md:hidden` para que el encabezado móvil use el carbón de Órbita.

Comprobación live en preview #225: prueba temporal de Órbita en TPV móvil con
fondo carbón, superficies oscuras, precios coral, chips y acción seleccionada
coral, sin desbordamiento. No se guardó la apariencia en la empresa ni se
realizaron operaciones económicas. Contratos tras el cambio: P01 PASS, P05
PASS, sintaxis de `la-pase-panel.js` PASS y `git diff --check` PASS.

Pendiente de cierre visual: una pasada dirigida por TPV, Pase, Cocina y Caja en
1440×900, 1024, 430, 390 y 320 px; el PR #225 permanece en borrador y QA sigue
aislado de producción.

## Incidencia corregida: advertencia de guardado en el arranque · 18/11/2026

En el preview se observó una advertencia con tres pendientes:
`conteos`, `movimientos` e `historialRespaldos`. No era un problema del tema
Órbita. `historialRespaldos` agotaba la cuota de `localStorage` al guardar la
copia automática; `conteos` y `movimientos` eran escrituras redundantes
provocadas por la hidratación autoritativa de stock/inventario al iniciar. QA
además registró `57014 canceling statement due to statement timeout` en
escrituras de `almacen_kv` y en `abc_obtener_dia_operativo_local`, lo que hacía
visible el problema pero no cambiaba la causa del cliente.

En `45ea4b11` se movió el historial automático a IndexedDB y se limpian las
marcas de pendiente antiguas cuando la escritura IndexedDB termina. La
hidratación inicial ya no reescribe el historial de movimientos ni de conteos,
y sus efectos reactivos consumen una marca de supresión solo para los cambios
que provienen de esa sincronización; cualquier edición real posterior sigue
usando el guardado normal. La caché de `fuente.js` se renovó a
`qa-persistencia-sin-advertencias-v1-20261118`.

Verificación local completada: sintaxis de `fuente.js` y
`index-storage-bootstrap.js`, paridad `source-recovery` y `git diff --check`.
Pendiente de esta tanda: confirmar en el nuevo Deploy Preview que una recarga
limpia no muestra advertencia/contador de pendientes y que una edición real
continúa confirmándose. No ejecutar cobros, reembolsos ni cierres para esta
verificación. Si vuelve a aparecer un timeout sin que exista una escritura de
arranque, tratarlo como incidencia separada de rendimiento de QA y no ocultar
el aviso.

### Cierre live · 18/11/2026

Con el propietario de QA-EMP-A en `Local A1`, el Deploy Preview actualizado
mostró **Guardado: cambios sin confirmar 0** y **Arranque: datos que no se
pudieron cargar 0**. La cola ya no contiene `conteos`, `movimientos` ni
`historialRespaldos`; Pase sigue mostrando sus datos reales. No se ejecutaron
operaciones económicas para esta comprobación. La advertencia de arranque
queda cerrada; cualquier aviso futuro deberá corresponder a una edición real
que no haya podido confirmarse, no a la hidratación inicial ni a la cuota de
`localStorage`.

## Addendum TPV · historial de ventas en pantalla propia · 18/11/2026 · SHA `acbf303c`

Para evitar que el TPV quede excesivamente largo, el historial se ha separado
de la operación de venta. En el TPV queda un resumen compacto (ventas, total
vigente y ticket medio) y el botón **Ver historial completo**. Ese botón abre
una pantalla completa con el listado y sus filtros, y ofrece **← Volver al TPV**.

No se duplicó la lógica: siguen funcionando la trazabilidad, los estados de
anulación/devolución, el ticket con QR y las acciones existentes. El cambio es
de composición y navegación local, sin nuevas operaciones económicas. La marca
de caché de `fuente.js` es `qa-orbita-ventas-history-v1-20261118`; la paridad
con `source-recovery` y los contratos P01/P05 están en verde. Se confirmó en
el Deploy Preview #225 con Local A1: el resumen permanece en el TPV, el botón
abre la pantalla propia y «← Volver al TPV» restaura la pantalla operativa.

## Addendum organización del TPV · 18/11/2026 · SHA `582e2a07`

Para que el TPV se acerque a la maqueta y no parezca una pantalla interminable,
las operaciones secundarias de cuenta (aparcar, repartir, unir, pedido
operativo y descuentos) quedan plegadas al entrar. El operador las muestra con
**Mostrar operaciones de cuenta** cuando las necesita; no se ha eliminado
ningún flujo ni se han cambiado permisos. Mesas, productos, cobro y resumen
siguen visibles en la pantalla inicial. Cache de `fuente.js`:
`qa-orbita-tpv-organization-v2-20261118`.

## Addendum Cocina y Caja compactas · 18/11/2026 · SHA `d7b2cd9f`

Se extendió la organización progresiva al resto del flujo operativo. Cocina
abre con comandas y acciones del turno; sesión, responsable, terminales, cierre,
estaciones y rutas quedan detrás de **Mostrar gestión avanzada**, con apertura
automática si hay apertura o cierre obligatorio en curso. Caja abre con la
información y el arqueo esencial; movimientos de entrada, retirada y reembolso
e historial quedan bajo **Mostrar movimientos** y **Mostrar historial**. Los
borradores de movimientos fuerzan la apertura del bloque para reintentar de
forma segura.

El cambio es solo de composición: no toca permisos, RPC ni datos financieros.
Cache actual de `fuente.js`: `qa-orbita-cocina-caja-v4-20261118`. La cola de
Cocina queda limitada a las ocho comandas recientes al entrar, con **Mostrar
todas** para ampliar la lista cuando haga falta. PR #225 sigue en borrador y
QA continúa aislado de producción.

## Addendum Órbita fijada en QA · 18/11/2026 · SHA `1932b106`

La apariencia persistida de QA-EMP-A estaba en Ascua; el propietario la
seleccionó y aplicó como **Órbita**, revisión de servidor 12. La recarga del
preview confirma `data-la-diseno="orbita"`, así que TPV, Pase, Cocina y Caja
parten ahora del marco de la maqueta: carbón `#17191C`, superficie `#202328`,
acero `#929DA7`, coral `#FF4B32`, dos columnas en escritorio y tarjetas/barra
de tareas en móvil.

Se corrigió la última discrepancia visual del shell móvil: el selector CSS
duplicaba el escape de `.md:hidden` y dejaba la cabecera verde histórica. El
commit `1932b106` lo corrige y renueva la marca a
`qa-orbita-shell-pase-v5-20261118`. P01, P05, sintaxis, paridad y
`git diff --check` pasan. No se hicieron cobros, reembolsos ni cierres nuevos.

## Addendum sonda P1 fiscal · 18/11/2026

Antes de construir las pantallas pendientes se hizo una consulta **solo de
lectura** al proyecto QA. El servidor expone `abc_clasificar_documento`,
`abc_conservar_documento_emitido` y `abc_registrar_correccion_documental`,
las tres como `SECURITY DEFINER`, con `EXECUTE` para `authenticated` y sin
acceso para `anon`/`public`. También existe
`abc_registrar_propina_efectivo(...)` con el mismo cierre de permisos.

La sonda no ejecutó ninguna de esas RPC. En ese momento la función de propina
no aparecía en la fuente de la rama; la implementación ya se reincorporó en
`2f9679f8` y está descrita en el addendum P1 de este documento. Las versiones
candidatas C06/C08/B06 no constan en `supabase_migrations.schema_migrations`,
aunque sus objetos existen en QA. Por tanto, `tpv-31` y `caj-16` siguen siendo
trabajo P1: primero hay que reconciliar esos contratos con la rama y definir
fixtures reversibles; después se hará la capa visual con el marco Órbita.
No se debe aplicar una migración candidata ni probar un cobro, reembolso o
propina sin autorización explícita.

## Addendum Codex · P1 propina del cambio · 18/11/2026

Se reincorporó la opción «El cambio es propina» sobre el contrato real de QA.
La llamada a `abc_registrar_propina_efectivo` ocurre después de confirmar el
efectivo, conserva el cierre/fiscalización y usa un `operation_id` idempotente.
Se añadió el contrato P06, la migración reproducible y el plan detallado en
`docs/rediseno/PLAN_P1_PROPINA_ORBITA_2026-11-18.md`. No se ejecutaron cobros,
reembolsos, propinas ni migraciones en QA. Antes del cierre manual hace falta
un fixture reversible y autorización explícita para un único cobro simulado.
Commit de código: `2f9679f8`; documentación final: `83679580`.

## Addendum comprobación de previews y TPV · 18/11/2026

El propietario confirmó que abrió ambos enlaces de QA. La revisión manual dejó
constancia de que el preview estable carga Órbita, Pase, Local A1 y el TPV con
`QA terminal A1`; el despliegue directo también carga Órbita y Pase, pero avisa
que ese origen aún no tiene un terminal inequívocamente asignado. No se trata
de una caída del backend ni de un fallo del diseño.

En la cuenta visible del TPV había `1,32 €` pendientes y pago exacto, sin cambio
positivo. La ausencia de «El cambio es propina» es por tanto correcta: la
casilla solo se ofrece cuando el cambio es mayor que cero. Esta tanda no hizo
cobros, reembolsos, cierres ni otras escrituras económicas. La validación
server-side de P06 sigue separada y necesita fixture reversible más autorización
explícita para un único cobro simulado.

## Addendum intento P06 autorizado · 18/11/2026

Se preparó y se ejecutó una sola vez el cobro simulado de `1,32 €` con `5,00 €`
en efectivo y **«El cambio es propina»** activado (`3,68 €` de cambio). El
botón pasó por «Procesando…», pero la vista regresó al estado inicial sin ticket,
confirmación ni error visible. La actualización posterior confirmó desde el
servidor `0,00 €` confirmado y `1,32 €` pendiente; no aparece movimiento de
propina. No se repitió la operación para evitar una posible duplicidad.

P06 queda bloqueado como **fallo de validación funcional**, no como éxito. El
siguiente paso es instrumentar o revisar el error de la ruta
`abc_iniciar_cobro`/`abc_confirmar_efectivo` y su llamada posterior a
`abc_registrar_propina_efectivo`, manteniendo el PR en borrador y sin nuevos
movimientos hasta explicar por qué la UI no expone la respuesta del servidor.

## Addendum causa del mensaje perdido · 18/11/2026

La revisión del código encontró el motivo de la pantalla silenciosa: tras un
resultado `{ ok: false }`, `ejecutarCobroF4()` guardaba el error, llamaba a
`refrescarCobroF4()` y esa función limpiaba el mismo estado si la lectura de la
cuenta era correcta. La operación fallida quedaba así sin mensaje aunque el
servidor no hubiera confirmado ningún pago.

La corrección conserva el error después de refrescar y cubre también
`recuperarCobroF4UI()`. Se añadió una aserción al contrato P06 para bloquear
regresiones. Pendiente todavía: publicar el código corregido, repetir la
prueba solo después de observar el error visible y no crear otra operación
económica antes de esa publicación.

## Addendum estado obsoleto de cuenta · 18/11/2026

La causa del aviso observado en el TPV quedó acotada: el navegador conservaba
un contexto de cuenta de un día operativo anterior. El servidor rechaza la
recuperación con `cuenta_recuperacion_otro_dia`; el cliente mostraba el aviso
solo dentro de «Mostrar operaciones de cuenta» y mantenía los controles de F4
activos, aunque cobrar esa cuenta no era válido.

La corrección añadida en `8cf7d2b0` se amplía en la siguiente revisión: cuando
el servidor devuelve ese rechazo, se elimina solo la clave local del contexto y
se retira la cuenta de `pedidoOperativoA05`. No se borra ni modifica la cuenta
de QA: permanece en el servidor y en la lista de cuentas abiertas como «Día
cerrado». Esto evita nuevos clics de cobro sobre el contexto antiguo y permite
elegir una cuenta del día operativo actual. Se mantiene `fuente.js` ↔
`source-recovery/fuente-recuperado.js` byte a byte y P06 cubre la regla.

No se ejecutó ningún cobro adicional; P06 funcional sigue pendiente de un
fixture del día actual y una autorización explícita.

## Addendum cobro único de propina confirmado · 18/11/2026

Con autorización explícita del propietario se usó el fixture del día actual
`b23f583e-01b4-4329-8502-95c14734bb47` (pedido
`318d1423-d673-4640-bcb3-c5f8038bb387`) en QA-A1. Se ejecutó una sola vez
«Cobrar efectivo» con total `4,95 €`, efectivo recibido `5,00 €` y «El cambio
es propina» activado. Resultado server-side confirmado: `4,95 €` pagados,
`0,00 €` pendientes y propina registrada de `0,05 €`, sin devolución de
cambio. Se emitió `TPV-38`, secuencia `34`, con QR fiscal QA C07-D.

La cuenta quedó pagada pero abierta porque el pedido aún no estaba servido o
cerrado. No se pulsó «Cerrar cuenta pagada» ni se realizó otro movimiento
económico; el cierre queda pendiente de autorización separada. La incidencia
de mensaje perdido ya no se reproduce en este camino confirmado.

## Addendum intento de cierre formal · 18/11/2026

Con autorización explícita se pulsó una sola vez «Cerrar cuenta pagada» para
la cuenta del ensayo de propina. La UI no confirmó el cierre: mantuvo
«Cuenta comercial: Abierta» y, después de recargar, Pase siguió mostrando la
cuenta abierta. No se repitió la acción ni se tocó ninguna otra cuenta.

El cobro y la propina permanecen confirmados; el cierre formal queda pendiente
de servir/cerrar el pedido o de obtener el error server-side que explique por
qué la operación no se aplica.

## Addendum cierre formal completado · 18/11/2026

Se continuó solo el pedido del fixture de propina
`318d1423-d673-4640-bcb3-c5f8038bb387` por la secuencia operativa completa:
`Enviado a cocina → En preparación → Listo para servir → Servido`. Después se
ejecutó una sola vez «Cerrar cuenta pagada».

Resultado confirmado por el servidor: cuenta `Cerrada`, `4,95 €` confirmados,
`0,00 €` pendientes y mensaje visible «Cuenta pagada cerrada formalmente por
el servidor». Se conserva el ticket QA `TPV-38` (secuencia `34`) y el QR
fiscal C07-D. No se tocó ninguna otra comanda, cuenta ni producción.

## Addendum diagnóstico y corrección del mensaje de cierre · 18/11/2026

La migración `abc_cerrar_cuenta_pagada` rechaza correctamente una cuenta si
alguno de sus pedidos no está en `SERVIDO`, `CERRADO` o `CANCELADO`, con el
motivo `cuenta_pedido_no_cerrable`. El pedido del fixture de propina aún no
estaba servido/cerrado.

La pantalla ocultaba ese motivo: la rama de cierre temprano de
`iniciarCobroCuentaF4` devolvía el estado pagado sin asignar `mensaje`, por lo
que la UI enseñaba el texto genérico de cobro confirmado. Se corrigieron ambos
archivos con paridad exacta para construir el mensaje de cuenta abierta junto
al error del servidor; el contrato P06 lo comprueba. No se ejecutó otro cierre.

## Verificación live de la corrección · 18/11/2026

El commit `2c281607` se publicó en el Deploy Preview `6afd9ed0c74b1938b74eb0d3`
(`ready`). Al abrir desde Pase la cuenta antigua de Mesa QA-A1-02, el TPV
mostró el rechazo en el contexto de la mesa, retiró la cuenta obsoleta y dejó
solo la caja del TPV; no aparecieron «Cobro · F4» ni los botones «Cobrar
efectivo»/«Iniciar tarjeta simulada». La cuenta y su evidencia siguen en QA;
no se borró ningún registro servidor y no se ejecutó otro cobro.

## Addendum de continuidad · cierre P06 y siguiente P1 · 18/11/2026

El estado histórico de «propina pendiente» queda supersedido por la evidencia
posterior: con autorización explícita se registró una única propina de cambio
de `0,05 €` sobre `4,95 €` en el ticket `TPV-38` (secuencia 34), se sirvió el
pedido y se cerró formalmente la cuenta en el servidor. La matriz lo registra
como `qa-20261118-p06-propina-cierre`; no se ejecutaron cobros ni reembolsos
adicionales.

La siguiente tanda es la construcción de `tpv-31` (factura completa a empresa)
y `caj-16` (rectificación fiscal). La lectura de QA confirma que C06/C08 ya
están aplicadas; no se requiere SQL nuevo.

## Addendum implementación P1 fiscal · 18/11/2026 · SHA `860c69d8`

La rama ya contiene la primera superficie Órbita para `tpv-31` y `caj-16`.
Cuando el TPV tiene un documento fiscal emitido, aparece la tarjeta «Factura
completa a empresa»: pide razón social, identificador fiscal y dirección
opcional y, tras confirmación, llama a `abc_clasificar_documento` con
`FACTURA_COMPLETA` y a `abc_conservar_documento_emitido`. La tarjeta
«Rectificación fiscal» pide el ID de un documento rectificativo ya emitido y
clasificado, más un motivo; al confirmar llama a
`abc_registrar_correccion_documental`. No se hace DML directo y todos los
payloads declaran `qa_only`/`aeat_transport=DISABLED`.

El contrato estático `tests/rediseno/p1-fiscal-tpv-contract.mjs` pasa junto al
de P06 y la paridad `fuente.js` ↔ `source-recovery` es exacta. El Deploy
Preview #225 del SHA `860c69d8` terminó `ready`; el escaneo de secretos quedó
sin coincidencias. Solo se comprobó que la aplicación carga sin sesión: no se
emitió factura, no se rectificó ningún documento y no se ejecutó cobro nuevo.

Pendiente para cerrar `tpv-31`/`caj-16`: preparar un fixture reversible,
autorizar explícitamente una emisión/clasificación y disponer de un documento
rectificativo válido para probar la vinculación y la persistencia en QA.

## Addendum validación live P1 y corrección de identificador · 18/11/2026

En el primer recorrido con propietario, el TPV sí mostraba el documento
`TPV-38` (C07-D, secuencia 34, QR QA), pero las tarjetas P1 no aparecían. La
causa era una suposición estricta del cliente sobre el nombre del identificador
del documento. Se corrigió en `321743d1`/`ae77bfd4`: la interfaz acepta
`documento_id`, `id` o `documento.id`, se regeneró el espejo de
`source-recovery` y el preview `6afdb01ec74b1938b7558316` quedó `ready` con
SHA `ae77bfd462d07899fe690a07166c2bd315beeb40`.

Con el preview actualizado se abrió «Solicitar factura a empresa» y se
introdujeron datos sintéticos QA (`QA Empresa Factura P1`, `B12345678`,
`Calle QA 1`). El servidor rechazó correctamente el intento con
`documento_tipo_ya_definido`: `TPV-38` ya está clasificado como
`FACTURA_SIMPLIFICADA`, por lo que no se creó una clasificación duplicada ni
una conservación. La consulta posterior confirma `abc_c06_documentos_clasificados`
en 40 filas, `abc_c08_documento_versiones` en 0 y
`abc_c08_correcciones_documentales` en 0.

La rectificación no se ejecutó: QA no tiene ningún documento rectificativo
válido y la única factura emitida sin clasificación está ligada a una cuenta
del 26/10/2026, día operativo cerrado, que el TPV no permite retomar. No se
creó otro cobro ni se modificó ninguna cuenta. Para cerrar P1 falta un fixture
reversible del día actual con documento fiscal aún no clasificado y, después,
un documento rectificativo emitido/clasificado; ambos deben probarse desde la
UI y mantenerse en QA.

La sonda de solo lectura posterior confirma que no hay otro documento apto:
el único sin clasificación es `TPV-6` (`dee9ca1a-79ac-4d53-a902-69976686d497`),
ligado a la cuenta `16cae507-2855-4c02-8d35-5a98abcf3b68` del día operativo
`2026-10-26`. El TPV la muestra como «Día cerrado» y no permite retomarla.
Por tanto, el siguiente paso requiere autorización separada para una venta de
ensayo nueva del día actual; no se debe crear por SQL ni reutilizar un cobro
existente.

## Addendum cierre positivo `tpv-31` · 18/11/2026

Se autorizó y ejecutó una sola venta sintética de `1,00 €` en QA-A1 mediante
efectivo simulado. Generó el ticket simplificado `TPV-39` (secuencia 35),
cuenta `3043de61-52f6-4e49-a847-ec850666b5f6` y documento original
`a178ad98-3d20-43a7-a681-dc9a0d415b3c`.

La UI se corrigió porque el primer intento trataba de cambiar el tipo del
documento simplificado y el servidor devolvía `documento_tipo_ya_definido`.
Ahora reserva un documento nuevo, resuelve su emisión, lo clasifica como
`FACTURA_COMPLETA` y conserva la revisión mediante las RPC C05/C06/C08.

La validación positiva quedó confirmada en QA: factura completa `TPV-40`,
documento `92067547-0938-4844-929b-13fd91be69df`, estado `EMITIDO`, revisión 1,
receptor sintético `QA Empresa Factura P1 / B12345678 / Calle QA 1` y snapshot
con `documento_original_id` apuntando al ticket simplificado. El documento
original no cambió, no se cobró de nuevo y AEAT real permaneció desactivada.

## Addendum cierre positivo `caj-16` · 18/11/2026

Con autorización explícita se creó una única rectificativa sintética en
QA-A1, vinculada a `TPV-40`, y se registró desde la tarjeta fiscal de Órbita.
La rectificativa es `TPV-41`, documento
`039e1b03-a502-479a-8e06-8a4fccfb9f8a`, estado `EMITIDO`, clasificada como
`FACTURA_RECTIFICATIVA` con referencia a
`92067547-0938-4844-929b-13fd91be69df`. La revisión conservada es la 1
(`3140f81f-20e3-4674-98e3-7b396bae5377`).

La UI registró una corrección `RECTIFICACION` con motivo
`Ensayo QA autorizado de rectificación fiscal: TPV-40`. La comprobación
independiente confirma una sola fila en `abc_c08_correcciones_documentales`,
la vinculación exacta y que `TPV-40` continúa `EMITIDO` con su revisión
inmutable. QA simuló todo el flujo con `aeat_transport=DISABLED`; no hubo
cobro, reembolso ni acceso a producción.

## Addendum inicio P2 `org-33` · 18/11/2026

Se inició el bloque P2 con una primera superficie Órbita para `org-33` en
`Configuración → Sala y mesas`. La rama utiliza los contratos reales de QA
`abc_listar_mapa_sala`, `abc_crear_zona`, `abc_actualizar_zona`,
`abc_crear_mesa` y `abc_actualizar_mesa`, con sesión de terminal, día operativo,
UUID de operación y versión esperada.

La pantalla muestra el mapa real, zonas, mesas, capacidad, estado efectivo y
versiones, y ofrece formularios responsive de creación/edición. No se ha
pulsado ningún guardado en QA todavía. Al contrastar el esquema QA directamente
se corrigió una nota inicial: T8 pieza 3 sí está desplegada en QA, con las
tablas `catalogo_tpv_tarifas_horario` y `catalogo_tpv_tarifa_precios` y las RPC
`abc_guardar_tarifa_horario`/`abc_guardar_tarifa_precio`. La UI ahora lee esas
tablas y muestra el editor con motivo obligatorio; si otro entorno no tiene la
migración, conserva el aviso de contrato ausente. Las tarifas se aplican al
local completo, no por zona. En QA queda un fixture previo inactivo en
`QA-EMP-A/QA-A1` (`11111111-1111-1111-1111-111111111111`, «VERIF Hora feliz
temporal», sábado 21:00–23:59, versión 1, un precio especial); no se ha tocado
en esta tanda.

Contrato local: `tests/rediseno/org33-sala-contract.mjs` (`PASS`). La paridad de
`source-recovery` también pasa. El plan y las condiciones para cerrar la
validación live están en `docs/rediseno/PLAN_P2_ORG33_SALA_2026-11-18.md`.

### Addendum validación live org-33 · 18/11/2026

Con autorización se creó en QA-A1 la zona `QA-P2-ZONA-01`
(`00853c8f-8a5d-4e12-997c-8ede808b3714`) y la mesa `QA-P2-MESA-01`
(`f00d03d7-6c10-4a33-899f-988db44aab86`). La segunda sesión actualizó la zona
y la primera, conservando la versión 1, fue rechazada con
`zona_version_conflict`; no hubo pérdida silenciosa de cambios. Se desactivó
primero la mesa (versión 2) y después la zona (versión 4). La consulta posterior
confirma ambos registros inactivos y que ninguna zona o mesa real fue tocada.

La lectura live mostró las tres zonas, seis mesas, estados efectivos y la tarifa
T8 previa inactiva. El contrato funcional de `org-33` queda validado en QA.

### Addendum cierre visual móvil org-33 · 18/11/2026 · commit `89b4bfa8`

La pasada autenticada se completó en el Deploy Preview #225 con el propietario
de `QA-EMP-A`, `Local A1` y el viewport emulado de 390×844. Se recorrió la
pantalla completa de `Configuración → Sala y mesas`, incluyendo las tres zonas,
la tarifa inactiva, el precio especial y las seis mesas reales.

La medición del DOM dio `innerWidth=390`, `innerHeight=844`,
`document.documentElement.scrollWidth=390` y `body.scrollWidth=390`, por lo que
no hay desbordamiento horizontal. El contenedor principal conserva su scroll
vertical interno (`scrollHeight=1931`, `clientHeight=900`) y permite llegar a
la última zona. Todos los botones, campos y selectores medidos tienen al menos
44×44 px; la barra inferior mantiene sus cuatro áreas táctiles.

No se ejecutó ninguna mutación durante la revisión. Los fixtures
`QA-P2-ZONA-01` y `QA-P2-MESA-01` permanecen inactivos para conservar la
evidencia de concurrencia y limpieza reversible. `org-33` queda cerrado como
`Pasa` en QA; producción sigue fuera de alcance.

## Estado vigente de sincronización · 18/11/2026 · commit `27f74c61`

Queda cerrada la actualización documental solicitada:

- `tpv-31` está en `Pasa`: TPV-40 es la factura completa emitida,
  clasificada y conservada en QA; TPV-39 permanece conservado como original.
- `caj-16` está en `Pasa`: TPV-41 es la rectificativa emitida, clasificada,
  conservada y vinculada a TPV-40; el documento original no se modifica.
- El Punto 2 está en `Pasa`: las nueve propuestas y seis paletas se verificaron
  en escritorio y móvil, incluyendo Rumbo, Órbita, Pase y Ascua con contexto
  real. La matriz conserva ambas evidencias (`qa-20261117-punto2-apariencia`
  y `qa-20261118-punto2-live`) como cerradas.

Las notas históricas que describían esas tres superficies como pendientes quedan
supersedidas por este estado vigente. Se mantienen separados, sin bloquear el
cierre, el positivo de Cajero/a con MFA, la paginación/búsqueda ampliada de la
cola de Pase y el registro contable de las migraciones de Apariencia. No se
tocó producción y el PR #225 permanece en borrador.

## Addendum marco común Órbita · 18/11/2026

Se implementó la unificación estructural solicitada en
`docs/rediseno/PLAN_MARCO_ORBITA_COMUN_2026-11-18.md`. El código nuevo es
`la-orbita-shell.js`, cargado desde `index.html`, y su contrato es
`tests/rediseno/marco-orbita-contract.mjs`.

La raíz autenticada usa ahora un único grid responsive. En escritorio mantiene
un lateral Órbita plegable y una cabecera común; en móvil usa cabecera compacta
y la barra inferior existente. Se exponen contexto empresa/local, estado QA,
buscador Ctrl/Cmd-K, avisos, Perfil y Apariencia. El caso `claro` se convierte
al mismo lateral y el buscador de `rumbo` deja de aparecer como una excepción
visual. Los handlers y permisos siguen siendo los del programa.

Pendiente de la siguiente pasada: validar el preview publicado en los cinco
anchos indicados en el plan y actualizar la evidencia con su SHA. No ejecutar
operaciones económicas; PR #225 continúa en borrador y producción permanece
fuera de alcance.

## Addendum arranque resiliente del preview · 20/11/2026

El preview acumulaba un diagnóstico temporal de `window.storage` que envolvía
cada lectura y escritura y escribía trazas en `localStorage`. Se retiró del
runtime. La causa de la espera visible era además el respaldo automático diario:
la aplicación lo construía y guardaba antes de terminar de mostrar la suite,
con una medición de aproximadamente 639.560 caracteres.

La copia automática se mantiene, pero se programa con `requestIdleCallback` (y
un fallback temporizado) después de dejar disponible la interfaz. Si falla, se
avisa en consola sin impedir el uso. `index-loader.js` tiene ahora un watchdog
de 20 segundos que muestra un mensaje accesible y un botón `Reintentar` sin
borrar datos. El shell Órbita evita reescrituras de texto idéntico y agrupa las
mutaciones del observador.

Contrato nuevo: `tests/rediseno/preview-arranque-resiliente-contract.mjs`.
Acta técnica: `docs/rediseno/ACTA_REPARACION_PREVIEW_2026-11-20.md`.

La comprobación live en Chrome, Firefox y el navegador de Codex quedó pendiente
hasta la publicación del commit de esta reparación. No se ejecutaron cobros,
reembolsos ni escrituras nuevas; producción sigue fuera de alcance y el PR #225
permanece en borrador.

El commit `c1893e30` ya está publicado como deploy `6b00a94e6de18dc69d58d259`
(`ready`) en el preview #225. Una pestaña nueva de Codex monta `QA-EMP-A ·
QA-A1`, conserva 67 controles habilitados después de tres segundos y no registra
errores de consola. Falta observar las ventanas nativas de Chrome y Firefox en
primer plano; ambas estaban minimizadas para la automatización al hacer la
comprobación.

Después de la publicación, el usuario confirmó que el preview vuelve a
funcionar en Chrome y Firefox. Con la pestaña nueva de Codex estable e
interactiva, el bloqueo live queda cerrado; no se realizaron cobros,
reembolsos ni otras operaciones económicas durante la confirmación.

## Addendum marco Órbita · selector y perfil comunes · 20/11/2026

Se reanudó el objetivo de marco común sobre el commit
`3d99c877bc95668cc0b31500bccfcad585b8f187`, publicado en el deploy
`6b00add0a3705b197069f1f2` del Preview 225.

- El selector del encabezado distingue el selector operativo real de los
  demás formularios `<select>` y muestra la opción activa.
- Desde una pantalla sin selector se ofrece «Abrir Panel general» y el menú
  reaparece allí; no se inventa contexto ni se escribe en el almacenamiento.
- Perfil reúne Cuenta y seguridad, Cambiar tema, Modo empleado y Cerrar sesión
  ejecutando los botones originales.
- Los controles equivalentes del lateral antiguo se ocultan para no duplicar
  el marco, pero sus handlers permanecen intactos.
- En `390×844` la cabecera y la barra inferior son visibles, el lateral queda
  oculto y no existe desbordamiento horizontal.

Contrato ampliado: `MARCO_ORBITA_CONTRACT=PASS (16/16)`. También pasaron P01,
P03, P05, org-33, paridad `SOURCE_RECOVERY_CHECK=PASS` y `git diff --check`.
No se ejecutaron cobros, reembolsos ni escrituras de negocio. La vista TPV de
caja a pantalla completa conserva la excepción documentada; la revisión
visual pantalla por pantalla continúa como fase posterior.

## Addendum marco Órbita · cobertura de superficies · 20/11/2026

La segunda pasada mantiene la misma raíz visual en todas las rutas autenticadas.
`la-orbita-shell.js` marca la ruta activa en `data-la-orbita-route` y el tipo de
superficie en `data-la-orbita-surface`: `tpv`, `pase`, `cocina`, `caja` o
`general`. Así las reglas de `la-apariencia.css` pueden tratar de forma común
los encabezados, el espaciado y las raíces operativas sin inspeccionar ni
duplicar la lógica de `fuente.js`.

Se añadió tratamiento Órbita para encabezados de vistas generales y una
comprobación estática de las cuatro superficies operativas. La identificación
es idempotente y no escribe estado de negocio; la excepción de TPV en modo caja
completo sigue explícita y documentada.

Resultado de la tanda: commit `9d132d72f996c54177f48cb14031b301b2570f05`,
Deploy Preview `6b00b373ce91b4e9db365e88` (`ready`),
`MARCO_ORBITA_CONTRACT=PASS (19/19)` y
`MARCO_ORBITA_RUTAS_CONTRACT=PASS (20 rutas)`, P01/P03/P05,
org-33, paridad `SOURCE_RECOVERY_CHECK=PASS` y `git diff --check` limpios.
Pendiente de la siguiente pasada: revisión visual manual de las rutas Clientes,
Inventario, Compras, Organización y de los cinco anchos del plan. No se
ejecutaron cobros, reembolsos ni escrituras de negocio; PR #225 sigue en
borrador y producción permanece fuera de alcance.

## Addendum marco Órbita · títulos homogéneos de módulos · 20/11/2026

La pasada de Clientes, Inventario, Compras y Organización encontró que el
contenido ya compartía el shell, pero sus `SectionTitle` quedaban visualmente
anidados de forma distinta según la pantalla. Se añadió una marca de
presentación idempotente (`la-orbita-page-title` y
`la-orbita-page-title-wrap`) sobre el primer título visible de cada vista. La
hoja Órbita aplica la misma escala, línea de acento, separación y adaptación
móvil; las acciones del título siguen siendo los botones React originales.

No se editó `fuente.js` ni se cambió lógica de negocio. Resultado: contrato del
marco `21/21`, contrato de rutas `20 rutas`, P01/P03/P05, org-33, paridad y
`git diff --check` en verde. La revisión autenticada de cinco anchos queda
como comprobación visual final cuando haya una sesión QA disponible.

## Addendum continuidad marco Órbita · 20/11/2026

La referencia vigente de la rama `rediseno/f0-base-qa` es el commit
`9ef6a9c574710efc72964eb1490c559f6acddf3f`, publicado en el Deploy Preview
`6b00b5092bd7410861c6dc3e` (`ready`). Esta entrega homogeneiza también los
títulos de los módulos generales mediante el shell común, sin modificar
`fuente.js` ni la paridad de `source-recovery`.

Resultado de contratos: marco Órbita 21/21, rutas 20/20, P01/P03/P05,
org-33, paridad y `git diff --check` conformes. La revisión visual autenticada
no se pudo cerrar porque el navegador integrado ya no conservaba la sesión QA;
el preview sí carga y la pestaña quedó preparada en el acceso para que el
propietario inicie sesión directamente. No se ejecutaron cobros, reembolsos ni
escrituras de negocio en esta tanda.

## Cierre de revisión visual autenticada · 20/11/2026

Con sesión QA-A1 se recorrieron Productos, Proveedores, Pedidos, Recepción,
Albaranes, Facturas, Clientes, Locales, Configuración, TPV, Cocina y Arqueo de
caja. En escritorio todos conservaron la cabecera y el lateral Órbita; en
móvil (390×844) Clientes y Caja conservaron la cabecera y la barra inferior,
ocultaron el lateral y mantuvieron `scrollWidth === innerWidth`.

La única advertencia observada fue un `key` ausente en la lista de
`ClientesPunto3`. Se corrigió simétricamente en `fuente.js` y
`source-recovery/fuente-recuperado.js`; una pestaña limpia posterior al deploy
no registra errores ni advertencias nuevas.

Código verificado: `614c5580970dd9cae8ab2f07e19227df5b5fa71c`. Deploy de código:
`6b00b89c879fb38200eafb4a` (`ready`). PR #225 continúa en borrador y producción
permanece fuera de alcance.

## Continuación · componentes visuales comunes Órbita · 20/11/2026

La siguiente tarea del plan es sustituir la convivencia de componentes nuevos y
antiguos. Quedó implementada como una capa común: las primitivas React reciben
clases `la-ui-*` (botones y enlaces con variantes, inputs, selects, tarjetas,
títulos, campos, badges, vacíos, alertas, modales y botones de icono) y
`la-apariencia.css` aplica el mismo contrato a tablas, tabs ARIA, paginación,
filtros, dropdowns, estados de carga/error, confirmaciones, tooltips e iconos.
Las reglas se aplican también al marcado histórico mediante roles y elementos
semánticos, por lo que no hay que rediseñar cada pantalla por separado.

La fuente recuperada se regeneró desde `fuente.js` y mantiene paridad exacta.
Se actualizó la marca CSS a `qa-orbita-shell-v13-20261120`; el contrato P01 fija
marca y huella para evitar una publicación servida desde caché antigua.

Contratos de la tanda: `REDISENO_COMPONENTES_ORBITA_CONTRACT=PASS`, marco 21/21,
rutas 20/20, P01/P03/P05, org-33, paridad y `git diff --check`. La revisión
visual autenticada en el preview debe confirmar escritorio y móvil sobre el
deploy de esta rama. No ejecutar cobros, reembolsos ni cambios de datos; PR #225
continúa en borrador y producción sigue fuera de alcance.

## Cierre de sustitución de componentes · 20/11/2026

Objetivo completado en `rediseno/f0-base-qa` con el commit
`b301222a3dc20ea768e5d01d2b8f9da0c91bc1f2`. El contrato Órbita sustituye la
convivencia de componentes antiguos y nuevos: botones por variante, campos,
selectores, tablas, tarjetas, pestañas, modales, paneles, alertas, estados,
badges, paginación, filtros, dropdowns, vacíos, carga, errores,
confirmaciones, tooltips, iconos y botones solo-icono. La capa es semántica y
global; conserva handlers, permisos y lógica de negocio.

Resultados reproducibles: `REDISENO_COMPONENTES_ORBITA_CONTRACT=PASS`, marco
21/21, rutas 20/20, P01/P03/P05, org-33, paridad de source-recovery y
`git diff --check` PASS. La batería completa de contratos registró 305/327
activos PASS, 22 fallos preexistentes no vinculados a esta migración y
`INFRA_FAIL=0`; el límite Netlify pasó.

Smoke visual del Deploy Preview 225: 46 módulos sin overflow en escritorio y
TPV, Cocina, Productos, Configuración y Clientes sin overflow ni controles
menores de 44 px en móvil `390×844`. La última pasada fue en modo local (la
sesión QA había caducado), por lo que no se deben interpretar estos datos como
nuevas escrituras en QA. PR #225 permanece en borrador y producción intacta.

## Cierre del Panel principal · 21/11/2026

Se eliminó la convivencia visible entre `la-panel-diseno` y el dashboard
heredado `la-dashboard-v2`. El commit `04b7cb4809d46904bdf000f5e6784cbe1ad9f3bc`
mantiene `Resumen general` como detalle secundario, oculto al cargar, con la
acción explícita `Ver detalle operativo`; el contenido sigue disponible al
abrirlo y no se tocaron datos, permisos ni handlers.

Preview verificado: deploy `6b01204b515686ad7b0dd5b3` (`ready`). Escritorio
sin overflow y con una única composición visible; móvil `390×844` sin
overflow, barra inferior de 55 px y cero controles visibles por debajo de
44 px. El contrato de componentes Órbita y la sintaxis del nuevo script pasan;
no hubo errores ni advertencias de consola.

La regresión global posterior registró 304/327 contratos activos PASS, 23
fallos históricos no relacionados con el Panel y `INFRA_FAIL=0`; el contrato
del Panel y el contrato de componentes Órbita pasan.

## Continuación · escala visual única Órbita · 21/11/2026

La tercera capa del plan queda implementada sin tocar operaciones: una escala
común de 4 px para espacios, radios `8/10/14/18`, sombras, tipografía
`11/12/14/18/24/30`, controles de 44 px (48 px para acciones grandes) e
iconos `16/20/24`. `la-apariencia.css` traduce además las utilidades directas
que todavía emiten las vistas históricas, por lo que definir variables no es
la única medida: `gap-*`, `p-*`, `px-*`, `py-*`, `rounded-*` y los tamaños
`text-[...]` se resuelven mediante los tokens del contrato.

La capa de controles semánticos mantiene la exclusión explícita de
checkbox/radio/range nativos y la densidad de TPV en modo caja completo. El
dashboard premium ya utiliza la misma escala. Se actualizó la marca de caché
CSS a `qa-orbita-scale-v14-20261121`; el contrato P01 fija marca y huella.

Contratos ejecutados y conformes: componentes Órbita, marco (21/21), rutas
(20/20), P01/P03/P05, org-33, paridad de `source-recovery` y `git diff
--check`. Falta añadir tras el despliegue la evidencia live de escritorio y
móvil y el resultado de la batería global; no ejecutar cobros, reembolsos ni
escrituras de negocio. PR #225 sigue en borrador y producción intacta.

### Cierre y evidencia live · 21/11/2026

Deploy Preview 225 listo en `6b0124c9e2b32501d2e28b9c` (`ready`), commit
`66b2b85360df498f4e39dff1e495c27d121240fb`. En el navegador Codex se midió el
preview en escritorio `1440×900` y móvil `390×844`: sin desbordamiento,
controles visibles con mínimo 44 px y cero mensajes `error`/`warn` en consola.

La batería oficial registró `NODE_ACTIVE_TOTAL=327`,
`NODE_ACTIVE_PASS=304`, `NODE_ACTIVE_FAIL=23`, `UTILITIES_RUN=8`,
`DIAGNOSTICS_RUN=5`, `INFRA_FAIL=0`; el límite Netlify pasó y el runner dejó
el árbol limpio. Los 23 fallos son históricos y no afectan a los contratos de
rediseño, que pasan. No se hicieron cobros, reembolsos ni escrituras de
negocio durante esta tanda.

No quedan acciones técnicas de este objetivo. Las excepciones deliberadas son
checkbox/radio/range nativos y la densidad de TPV en modo caja completo; todo
lo demás queda gobernado por la escala Órbita. PR #225 continúa en borrador y
producción sigue fuera de alcance.

## Objetivo 4 · migración visual por módulos · avance 21/11/2026

La matriz de seguimiento es `docs/rediseno/MATRIZ-MIGRACION-MODULOS-ORBITA-2026-11-21.md`.
La migración se mantiene por bloques y no se declara cerrada por el mero hecho
de cargar el shell: los doce módulos siguen en estados PARCIAL, MARCO o BASE
hasta completar la revisión visual de sus rutas reales.

En esta tanda se corrigió un defecto de identificación en Pase. El panel que
Inicio monta en el preview usa `.la-pase` como raíz semántica, mientras que el
recorrido histórico puede usar `#la-pase`. El shell y la capa CSS aceptan ambas
raíces. El commit es `467c27fc`; la caché pasó a
`qa-orbita-modules-v16-20261121` y el preview se publicó en el deploy
`6b0128d77f7636fabd402947` (PR #225, borrador).

Evidencia live tras el despliegue: en Codex, Inicio quedó marcado como módulo
`pase` cuando está presente el panel real; el acceso `Abrir TPV` cambió la
superficie a `tpv` y montó `.tpv-layout`; en el ancho disponible del banco no
hubo overflow (`scrollWidth === innerWidth`) y el control visible mínimo fue
44 px. Los contratos P01, marco, rutas, componentes y `git diff --check`
siguen pasando. La batería global posterior registró `NODE_ACTIVE_TOTAL=327`,
`NODE_ACTIVE_PASS=304`, `NODE_ACTIVE_FAIL=23`, `UTILITIES_RUN=8`,
`DIAGNOSTICS_RUN=5`, `INFRA_FAIL=0` y dejó el árbol limpio. Los 23 fallos
coinciden con la lista histórica del banco (alb/cfg/f3/f4/plataforma/pm11/pm33)
y no apuntan a esta corrección de selectores. No se hicieron cobros,
reembolsos ni cambios de datos en QA.

### Ajuste posterior de identidad Inicio/Pase · `bab5d3e6`

Al revisar el preview se comprobó que Inicio puede contener el panel Pase sin
dejar de ser Inicio. El shell ahora prioriza `.la-panel-diseno` y etiqueta la
superficie como `inicio`; solo una ruta Pase independiente queda como `pase`.
El cambio se publicó en el deploy `6b012a4769a7c7ccd57b055e` (`ready`) con la
misma política de QA y PR #225 en borrador. Evidencia live en Codex: Inicio
`data-la-orbita-module="inicio"`; `Abrir TPV` → `tpv`; `scrollWidth ===
innerWidth`; control visible mínimo 44 px.

### TPV y sala · avance visual `3ff74403`

Se aplicó la primera capa específica del bloque TPV/sala sobre las raíces
existentes: catálogo y filtros de categoría, tarjetas de producto, paginación,
mesas, columna de ticket/caja y dock móvil. La distribución sigue siendo una
columna operativa más lateral estable en escritorio y una pila vertical en
móvil; no se tocaron handlers, permisos, fiscalidad ni datos. Los contratos
P01, marco, componentes, rutas y fiscal TPV pasan. El bloque permanece
`PARCIAL` hasta verificar cada recorrido real y sus estados vacío/carga/error.

Evidencia live del preview tras `3ff74403`: módulo `tpv`; tarjeta de producto
`104 px` de alto; rejilla de dos columnas en el ancho táctil del banco;
búsqueda `47 px`; lateral estable; `scrollWidth === innerWidth`; control
visible mínimo `44 px`. El despliegue Netlify correspondiente quedó en
`6b012b2dbbd76a7f1b53f032` (`ready`).

### Cocina · primera migración de superficie `6aace0b1` · 21/11/2026

La primera capa específica de Cocina ya está en la rama `rediseno/f0-base-qa`.
Se aplica únicamente a `main[data-la-orbita-module="cocina"]` y a la raíz
`.la-operacion-cocina`: la cabecera «Cocina y comandas», las tarjetas de
sesión, avisos, estaciones/rutas y cola de comandas usan el mismo tratamiento
Órbita que TPV y Pase. Las tarjetas anidadas conservan el contenido y las
acciones de cada comanda; selects, inputs y controles quedan por encima de
`44×44 px`. En móvil la cabecera se adapta y la cola no desborda en
horizontal. No se modificaron lógica, RPC, permisos, estados ni persistencia.

La marca de caché CSS es `qa-orbita-modules-v18-20261121`. Los contratos
dirigidos pasan: P01 capas/migraciones, marco `21/21`, componentes, rutas
`20/20`, autoridad de persistencia y `git diff --check`. El deploy de preview
correspondiente a la rama queda en estado `ready`; el PR #225 continúa en
borrador y producción no se toca.

Queda expresamente pendiente antes de cerrar Cocina: recorrer la ruta real en
QA y documentar estados con datos, vacío, carga, error y transiciones de
comanda en escritorio y móvil. La regresión histórica `pm11-compra/p10`
continúa fallando por el orden de carga de su parche móvil; no fue introducida
por esta migración y se conserva como excepción del banco.

### Caja · primera migración de superficie `92785c52` · 21/11/2026

Caja ya tiene su primera capa Órbita en la rama de QA. Se aplica a
`main[data-la-orbita-module="caja"]` y a `.la-operacion-caja`, cubriendo la
apertura de sesión, el arqueo diario, movimientos/ajustes, historial,
traspasos y avisos. Las tarjetas, campos, selects y acciones comparten la
misma jerarquía que TPV, Pase y Cocina; los controles se mantienen en
`44×44 px` y los formularios de denominaciones se apilan en móvil. La lógica
de cobros, reembolsos, cierres, permisos, fiscalidad y persistencia permanece
intacta.

La caché CSS es `qa-orbita-modules-v19-20261121`, con huella P01
`ce277db80f8e2cf4`. Pasan P01, marco `21/21`, componentes, rutas `20/20`,
autoridad de persistencia y `git diff --check`. No se hicieron cobros ni
reembolsos nuevos. La verificación de QA que falta para cerrar Caja es el
recorrido real de cobro, arqueo, cierre, reembolso y documento, incluyendo
vacío/carga/error en escritorio y móvil.
### Clientes · primera migración de superficie `2c709144` · 21/11/2026

La superficie de Clientes ya usa la capa Órbita para vistas guardadas,
filtros, búsqueda, paginación, tarjetas del listado y estados de ficha. El
alcance está en `main[data-la-orbita-module="clientes"]`; los handlers de
sincronización, anonimización, actividad y NIF no se modificaron. Los
controles mantienen `44×44 px` y los filtros se apilan en móvil sin
desbordamiento.

La caché CSS es `qa-orbita-modules-v20-20261121`, huella P01
`7f70543a840f3e64`. Pasan P01, marco `21/21`, componentes, rutas `20/20` y
`git diff --check`. Falta recorrer en QA la ficha, la actividad, el NIF y los
estados vacío/carga/error para cerrar el módulo; no se hicieron escrituras de
datos en esta tanda.

### Gestión · primera capa común `91943176` · 21/11/2026

Compras, Inventario, Personal, Configuración y Plataforma comparten ahora la
capa visual Órbita scoped por módulo: tarjetas, formularios, tablas,
alertas/estados, tipografía y botones. En móvil los formularios se apilan y
las tablas quedan contenidas en scroll horizontal local. No se modificaron
handlers, permisos, datos, RPC ni el acceso de administrador de Plataforma.

La caché CSS es `qa-orbita-modules-v21-20261121`, huella P01
`b4aa9acf6bc07ec2`. Pasan P01, marco `21/21`, componentes, rutas `20/20` y
`git diff --check`. Los cinco módulos continúan `PARCIAL`: falta recorrer sus
rutas reales, estados vacío/carga/error y acciones específicas en escritorio y
móvil. Plataforma sigue pendiente de una sesión de administrador QA; no se
concedieron privilegios ni se escribieron datos nuevos.

### Batería posterior · 21/11/2026

Tras la capa de gestión se ejecutó `tests/ci/ejecutar_bateria_no_db.sh` fuera
del sandbox con el árbol limpio. Resultado: `NODE_ACTIVE_TOTAL=327`,
`NODE_ACTIVE_PASS=304`, `NODE_ACTIVE_FAIL=23`, `UTILITIES_RUN=8`,
`DIAGNOSTICS_RUN=5`, `INFRA_FAIL=0` y `ARBOL_LIMPIO_TRAS_EJECUCION=1`.
Los 23 rojos coinciden con la lista histórica (alb, cfg, f3, f4, plataforma,
pm11-compra y pm33); no apareció un fallo nuevo atribuible a las capas de
Caja, Clientes o Gestión. El contrato de publicación Netlify y todos los
contratos específicos de rediseño pasan. El PR #225 sigue en borrador y
producción permanece fuera de alcance.

El nuevo contrato `tests/rediseno/migracion-modulos-contract.mjs` comprueba
que los doce módulos aparecen en el shell y en la matriz, que cada superficie
tiene CSS scoped (incluido `.la-acceso`) y que la capa conserva responsive,
reducción de movimiento y controles táctiles de `44 px`. Resultado:
`REDISENO_MIGRACION_MODULOS_CONTRACT=PASS módulos=12 shell=12 matriz=12
responsive=PASS tactil=44`. Es una guarda estática; no sustituye la revisión
live de cada ruta en QA.

### Acceso · alcance vigente

El acceso no se considera cerrado solo por cargar la pantalla partida. La
superficie `.la-acceso` ya está gobernada por los tokens Órbita y mantiene
áreas táctiles mínimas, pero queda `PARCIAL` hasta comprobar en QA login,
recuperación, MFA, expiración de sesión y selección de empresa/local tanto en
escritorio como en móvil. La sesión observada en el preview mostró el acceso
QA y el botón Apariencia, sin realizar ninguna autenticación ni escritura.

### Endurecimiento v22 · estilos inline heredados

Se detectaron `minHeight` inline de `40px` en una ruta histórica de Personal y
reglas equivalentes en tabs/dropdowns. Para que la escala Órbita sea única, la
capa común fuerza ahora `min-height: var(--la-control-height) !important` en
inputs, selects, textareas, botones, tabs, opciones y elementos de menú dentro
de los módulos etiquetados. La caché quedó en
`qa-orbita-modules-v22-20261121` (SHA CSS `bdeee2cb4df1c980`). Es una corrección
de contrato táctil y de consistencia; no modifica handlers, permisos, datos ni
RPC. Los contratos P01, marco, componentes y módulos deben ejecutarse de nuevo
antes de aceptar el deploy. Los doce módulos continúan `PARCIAL` hasta la
revisión QA individual de escritorio, móvil y estados de cada ruta.

### Batería global actualizada · 21/11/2026

El contrato `tests/rediseno/migracion-modulos-contract.mjs` ya forma parte del
manifiesto CI. Se actualizaron sus contadores de inventario a `384` entradas,
`367` contratos activos y `328` contratos Node; el validador y sus pruebas
negativas pasan. La ejecución completa registró:

```text
NODE_ACTIVE_TOTAL=328
NODE_ACTIVE_PASS=305
NODE_ACTIVE_FAIL=23
UTILITIES_RUN=8
DIAGNOSTICS_RUN=5
INFRA_FAIL=0
```

Los 23 fallos son históricos y no cambian respecto a la tanda anterior; no
incluyen el contrato modular ni la defensa de escala v22. El árbol solo queda
con las modificaciones intencionadas del manifiesto/validador y documentación;
la limpieza del runner no revierte cambios del objetivo.

El commit `1e3de70c` está desplegado en el Deploy Preview 225
(`6b01335abbb331413cd060a0`, `ready`). En una comprobación live del alias, el
HTML sirve `la-apariencia.css?v=qa-orbita-modules-v22-20261121`, el control
táctil mínimo es `44 px` y no se observa overflow horizontal en la pantalla de
acceso. Esta comprobación no sustituye los recorridos autenticados de los doce
módulos, que siguen pendientes para pasar de `PARCIAL` a `CERRADO`.

### Inicio · tokens Órbita en el dashboard premium · 21/11/2026

Se corrigió una convivencia visual que no aparecía en los contratos de shell:
`dashboard-premium-v2.js` usaba colores literales verde/dorado en KPIs,
acciones rápidas, alertas, CTA, toast y el botón de detalle operativo. Esos
colores procedían de una versión anterior de Sello y hacían que Inicio no
pareciera Órbita aunque el panel principal ya estuviera separado del detalle
heredado.

La capa ahora consume exclusivamente los tokens semánticos del tema (`--c-*`)
y el recurso se sirve con la marca `qa-orbita-panel-v3-20261121`. Se añadió al
contrato de componentes una aserción que detecta el retorno de la paleta
heredada. No se modificaron datos, indicadores, handlers, permisos ni rutas.
Inicio permanece `PARCIAL`: falta la validación autenticada de sus variantes y
estados en QA.

### Degradados de operación adaptables a paleta · v53 · 21/11/2026

La revisión transversal detectó que los encabezados de Cocina/Caja y el título
de Pase conservaban degradados morado/azul literales. En Órbita ahora se derivan
de `--c-accent-fill`, `--c-accent` y `--c-ink`, por lo que las seis paletas y la
paleta propia mantienen la misma jerarquía sin arrastrar colores de la maqueta
base. No se modifican estados, handlers ni datos. Marca
`qa-orbita-modules-v53-20261121`, huella `7c926e786e2e6488`.

El contrato de componentes comprueba ambos degradados tokenizados. La matriz
funcional continúa `PARCIAL` hasta terminar los recorridos autenticados de los
módulos.

### Iteración visual de Inventario · v52 · 21/11/2026

La revisión del bloque 4 encontró que los informes móviles PM12/P09 todavía
conservaban fondos, bordes y tipografía de la capa anterior. Se añadió una
normalización scoped en `la-apariencia.css` para `.pm12-p09-report`, sus
estadísticas, metadatos, nota, acciones y controles de captura. Todos consumen
los tokens activos de Órbita, radio/sombra común y `--la-control-height` (44 px)
sin tocar la lógica ni los handlers. La marca de caché es
`qa-orbita-modules-v52-20261121`, huella `ce2d5675f6ef1d25`.

El commit `c395ae58` se publicó en el Deploy Preview 225 como
`6b018c8b82a0e124af450238` (`ready`, escaneo de secretos sin coincidencias).
El alias estable sigue siendo
`https://deploy-preview-225--chic-entremet-9107cf.netlify.app/`.

Se añadieron aserciones específicas al contrato de componentes y se actualizaron
las huellas de P01, `index.html`, recuperación de contraseña y marco. La
verificación estática pasa; el estado funcional de Inventario permanece
`PARCIAL` hasta recorrer con sesión sus acciones y estados reales en desktop y
móvil. No hay cambios de datos en QA.

Tras v51 se ejecutó la batería completa de `tests/rediseno/*.mjs`:
`ALL_REDISENO_TESTS_PASS=1`. El árbol permanece limpio y `git diff --check`
continúa pasando. Estos contratos prueban la capa estática y sus bancos de
datos locales; no sustituyen las sesiones autenticadas pendientes de la
matriz.

### Acceso y arranque · tokens Órbita v51

Se neutralizaron los colores Sello que seguían embebidos en el arte de
Acceso y se alineó el aviso de error de arranque con los tokens activos. El
watchdog, el botón de reintento y los handlers permanecen intactos. La hoja
se sirve como `la-apariencia.css?v=qa-orbita-modules-v51-20261121`, huella
`36cdf3112337d2c4`.

La publicación quedó en el deploy `6b018ab0e50f6b98af648911` (`ready`),
commit `5cb4a5ac`, sin coincidencias en el escaneo de secretos. La apertura
limpia del preview confirmó el recurso v51, login visible, Órbita y
`overflow=false`. El estado de error del watchdog no se fuerza durante una
prueba normal; el botón «Reintentar» queda documentado para esa ruta.

### Deploy de la corrección de tokens · 21/11/2026

El commit `46c7e007` está publicado en el Preview 225 como deploy
`6b01888ae50f6b98af641626` (`ready`, escaneo de secretos sin coincidencias).
Una apertura limpia del preview confirmó que el HTML sirve
`la-apariencia.css?v=qa-orbita-modules-v49-20261121`, con Órbita y el flujo de
Acceso visible; la comprobación fue no autenticada y no altera la matriz de
permisos o estados reales.

La declaración final de `--c-on-chrome` está en `ab274506`, publicado como
deploy `6b01897327a3a62ea37e96a9` (`ready`). El alias sirve
`la-apariencia.css?v=qa-orbita-modules-v50-20261121`; la apertura limpia
confirmó Órbita y `overflow=false` en Acceso.

### Evidencia live adicional de la migración por módulos · 21/11/2026

En el Preview 225, después de recargar para descartar una pestaña que aún
servía `qa-orbita-shell-v15`/`qa-orbita-panel-v3`, se verificó el artefacto
actual (`la-apariencia.css` v48, `la-orbita-shell.js` v16 y panel v4). El
control «Ver detalle operativo» ya no aparece en TPV (`toggleCount=0`).

En viewport móvil de 390 px, sin crear ni cobrar datos nuevos, el recorrido
visual confirmó:

| Módulo | Evidencia | Resultado |
|---|---|---|
| TPV | `data-la-orbita-module=tpv` | `overflow=false`, mínimo 44 px |
| Cocina | estado vacío «No hay comandas para este filtro» | `overflow=false`, mínimo 44 px |
| Caja | `data-la-orbita-module=caja` | `overflow=false`, mínimo 44 px |
| Clientes | vacío confirmado y paginación deshabilitada | `overflow=false`, mínimo 44 px |
| Compras | Proveedores vacío | `overflow=false`, mínimo 44 px |
| Inventario | Productos, 23 filas y acciones de tabla | `overflow=false`, mínimo 44 px |
| Personal | «Cargando empleados…» visible | carga no convertida en vacío; requiere sesión/servidor |
| Acceso | login, recuperación y modo sin sincronizar | `overflow=false`, mínimo 44 px |

Esta evidencia es visual y no autenticada. No cierra módulos: todavía faltan
recorridos con sesión, permisos, persistencia, estados reales y acciones de
Pase, Cocina, Caja, Clientes, Compras, Inventario, Personal, Configuración,
Plataforma y Acceso. El estado de Personal queda documentado como carga
honesta, no como ausencia de empleados.

### Corrección transversal de tokens del shell · 21/11/2026

La última auditoría visual encontró literales de color en la barra lateral,
estados activo/hover, control de colapso, menús del shell, barra inferior y
subrayados de página. Se sustituyeron por mezclas derivadas de los tokens del
diseño activo, manteniendo intactos los nodos y handlers existentes. El
recurso actualizado es `la-apariencia.css` v50, huella
`b9519144fc6ebd36`. También se declara `--c-on-chrome` como token base para
evitar texto transparente en una paleta que no lo redefina. Esto evita que Órbita vuelva a imponer una segunda paleta
cuando se eligen las otras propuestas o una paleta personalizada.

La corrección es visual y estática; no convierte ninguna fila en `CERRADO`.
La validación con sesión, datos, permisos y acciones reales sigue pendiente
para los doce módulos según la matriz.

### Clasificación de Configuración · `232f6974`

En la revisión del preview se encontró una diferencia real: el texto con tilde
«Configuración» generaba el módulo `configuracion-configuracion`, por lo que
no aplicaba el CSS scoped de `configuracion`. El detector del shell normaliza
diacríticos antes de evaluar las rutas. La comprobación live posterior devuelve
`module=configuracion`, `surface=configuracion`, `overflow=false` y control
mínimo de 44 px. El contrato de migración de módulos incluye esta defensa.

### Limpieza del detalle heredado fuera de Inicio · `dashboard-premium-v4`

Al cambiar de Inicio a TPV el panel de dashboard se desmontaba, pero su botón
«Ver detalle operativo» quedaba en el `main` nuevo. Se corrigió el observador
para retirar nodos huérfanos y se añadió una defensa scoped que solo permite ese
control en `data-la-orbita-module="inicio"`. La ruta TPV ya no muestra el
control antiguo; el detalle se conserva en Inicio. No cambian handlers ni
datos. La caché queda en `qa-orbita-panel-v4-20261121`.

### Corrección del arranque local · 21/11/2026 · `2c3c84a6`

Se aisló la ruta de «Trabajar solo en este equipo, sin sincronizar» para que
la hidratación inicial lea directamente `localStorage` (`almacen:<clave>`)
cuando esa elección está activa. Antes, cada una de las 37 claves atravesaba
el adaptador asíncrono aunque no había sesión ni nube que consultar; una
IndexedDB bloqueada o una pestaña vieja podía convertir el arranque en una
espera de decenas de segundos. En QA autenticado no se modifica nada: sigue
usando Supabase, RPC, RLS y los límites por intento.

El contrato `preview-arranque-resiliente-contract.mjs` exige el atajo y pasa
(`PREVIEW_ARRANQUE_RESILIENTE=PASS`), junto con la paridad de `fuente.js` y
`git diff --check`. La corrección es soporte de verificación local y no
autoriza a marcar los doce módulos como `CERRADO`: queda pendiente el
recorrido QA autenticado individual de cada bloque.

### Objetivo 4 · refuerzo de la envolvente modular v47 · 21/11/2026

Se publicó `la-apariencia.css?v=qa-orbita-modules-v48-20261121`, con huella
`6ee9a8f9998201d6`. Todas las raíces `main[data-la-orbita-module]` reciben
ahora una envolvente común para tarjetas, campos, botones, estados, badges,
tablas y superficies vacías/cargando/error. También se encapsula el ancho de
grids y tablas en móvil. La capa es scoped y aditiva: lógica, permisos,
persistencia, RPC y handlers permanecen intactos.

La validación estática se actualizó en `componentes-orbita-contract.mjs`,
`marco-orbita-contract.mjs` y `p01-capas-y-migraciones-contract.mjs` para
fijar la marca y la huella de la nueva hoja. La evidencia live disponible
confirma shell interactivo y superficies identificadas; el cierre funcional
de cada módulo continúa pendiente de recorrido QA autenticado.

### Corrección de arranque local · 21/11/2026

El guard de contexto operativo esperaba una sesión remota incluso después de
que el usuario eligiera explícitamente trabajar sin sincronización. `fuente.js`
ahora deriva directamente `get/set/delete` al adaptador local cuando
`__modoPruebasLocal` es `true`; la rama QA autenticada conserva el control de
permisos y contexto. Se invalidó la caché a
`qa-arranque-lectura-local-directa-v4-20261121` y se añadió la aserción al
contrato de arranque. La evidencia anterior de shell y módulos sigue válida;
hay que repetir la medición de tiempo en el preview publicado.

### Hallazgo de arranque durante la migración por bloques · 21/11/2026

En el preview limpio, el modo local podía quedarse en «Cargando almacén…» si
una lectura del adaptador no resolvía su promesa. Se corrigió `loadKey` en las
dos copias protegidas: 1,5 s por lectura sin conexión y 7,5 s en QA, con los
reintentos y el evento de fallo conservados. La app ya no depende de una
promesa de almacenamiento infinita para montar el shell Órbita; el contrato de
arranque exige además el mensaje explícito y el reintento visible. La batería
estática queda verde; las doce filas siguen `PARCIAL` hasta el recorrido
autenticado de cada módulo.

### Punto 4 · estado de publicación y cierre pendiente · 21/11/2026

La revisión vigente de la migración modular es el SHA `ba7bf3e42ca292200dc5dd1a96f4ae36ba5a9a0e`,
publicado en Deploy Preview 225 como `6b01754bbbb331413cdf306d` (`ready`).
El PR #225 sigue en borrador contra `release`; no se ha publicado nada en
producción.

Se confirma en código que los doce módulos enumerados en la matriz comparten
el shell Órbita, la escala responsive y las marcas de componentes; también se
normalizan las dos raíces de Plataforma que aparecen antes del shell. La
batería específica de rediseño termina en `ALL_REDISENO_TESTS_PASS` y
`git diff --check` pasa.

Esto no se presenta como cierre prematuro: las doce filas siguen `PARCIAL`
hasta recorrer cada módulo con sesión QA real, incluyendo estados de carga,
vacío y error, permisos y rutas mutables. Las verificaciones pendientes son
especialmente Plataforma con una cuenta administradora y Acceso con login,
recuperación, expiración, MFA y selección de empresa/local; tampoco se ha
obtenido todavía una pasada independiente en Chrome y Firefox para todos los
módulos.

Corrección transversal de esta tanda: si la empresa todavía no tiene una
preferencia de apariencia, `la-apariencia.js` conserva `orbita` como diseño
base. Antes el resolver eliminaba `data-la-diseno` y permitía que reapareciera
la paleta histórica; las preferencias explícitas de las nueve propuestas no
se modifican.

### Revisión final de controles externos · Plataforma y Acceso · 21/11/2026

La auditoría del marco común encontró una excepción concreta en los paneles
previos al shell: los `textarea` de Plataforma no recibían el mismo contrato
Órbita que `input` y `select`. Se añadió la normalización de altura mínima,
borde, radio, fondo y foco visible a ambos contenedores (`#la-plataforma-root`
y `#la-plataforma-cambio-root`). Login, recuperación y MFA reciben el mismo
foco visible para campos, botones y roles accionables. Es CSS scoped y no toca
handlers, autenticación, permisos, RPC ni datos.

La caché de `la-apariencia.css` pasa a `qa-orbita-modules-v46-20261121`;
huella P01 `ebbf90ccdde80bb4`. La batería completa `tests/rediseno/*.mjs`
queda verde, con P01, componentes, módulos 12/12, marco 23/23, rutas 20/20,
Pase, fiscalidad, MFA, Apariencia, org-33, botones solo icono y arranque
resiliente en PASS; `git diff --check` también pasa.

Esto no cierra por sí solo las filas de matriz: sigue pendiente el recorrido
autenticado de cada módulo con datos y estados reales, la cuenta de
administrador de Plataforma y la comprobación completa de Acceso (login,
recuperación, MFA, expiración y selección de empresa/local). El PR #225 se
mantiene en borrador y producción permanece intacta.

El commit `1878e2b1` quedó publicado en el Deploy Preview 225 como deploy
`6b0170474f1e763bb9d3eab9` (`ready`), con escaneo de secretos sin coincidencias.
La comprobación del navegador integrado llega al formulario de Acceso sin
bloqueo; no se introdujeron credenciales ni se hicieron escrituras de negocio.

### Recorrido local adicional del preview v46 · 21/11/2026

En el deploy `6b0170d2f16c14c121a5b9e5`, modo local y contexto `Local A1`, se
recorrieron Inicio, TPV, Cocina, Caja, Clientes, Compras, Inventario, Personal
y Configuración. El banco mostró el shell Órbita en todas las superficies y
los estados propios de cada ruta: catálogo y sala del TPV, advertencia de
conexión y cola vacía de Cocina, arqueo de Caja, filtros/paginación de
Clientes, vacío de Proveedores, tabla y acciones de Productos, carga de
Personal y selectores/motivo de Configuración. No se introdujeron credenciales,
no se cobraron ventas y no se escribieron datos.

Esta evidencia refuerza la composición visual y el recorrido de navegación,
pero no sustituye la verificación autenticada de permisos, persistencia,
estados de servidor, Plataforma administradora ni login/MFA. Las filas de la
matriz permanecen `PARCIAL` por ese motivo.

### Plataforma previa al shell · marca semántica externa · 21/11/2026

`plataforma-panel.js` marca ahora sus dos raíces externas con
`data-la-orbita-external="plataforma"` y
`data-la-orbita-surface="plataforma"`, y se publica con la caché
`qa-orbita-platform-v3-20261121`. Es una identificación aditiva para que la
capa Órbita pueda reconocer el panel administrador y el cambio de contraseña
antes de que exista el shell autenticado; no modifica operaciones,
autenticación, permisos ni datos. El contrato de componentes la exige. Falta
todavía recorrer esas superficies con una cuenta administradora real de QA.

También se corrigió la prioridad de ruta: al pulsar Panel general, el shell
mantiene `inicio` aunque Pase esté incrustado. La navegación marca el destino
activo para que el siguiente recorrido no confunda la sub-superficie operativa
con el módulo principal.

La marca de ruta se recalcula en el mismo clic, por lo que la cabecera y el
estado activo no quedan un ciclo de render por detrás.
La superficie y el módulo comparten esa prioridad, evitando que un Pase
incrustado se presente como la pantalla principal.

El deploy `6b016e263339e98d72dc5b68` confirmó `inicio/inicio` al seleccionar
Panel general y recorrió TPV, Cocina, Caja, Clientes, Compras, Inventario,
Personal y Configuración en modo local: todos mantuvieron controles de 44 px y
`overflow=false`. La evidencia no sustituye el recorrido autenticado de QA.

### Corrección del modo local · shell Órbita · `1948bc4d`

En el primer ensayo del deploy v45, «Trabajar solo en este equipo» montó el
wrapper React sin `data-la-contenedor`; por eso la capa visual no encontraba la
raíz aunque sus recursos respondieran 200. `la-orbita-shell.js` v11 reconoce
también la clase estable del wrapper y fija el atributo visual `orbita` solo
para que se aplique el shell. No activa nube, no escribe datos y no toca
handlers. El caso queda como regresión explícita para la nueva comprobación
live del Preview 225. En la revisión posterior se añadió al shell v12 el valor
inicial `data-la-diseno="orbita"` cuando el modo local no trae ningún diseño y
la clasificación de «Resumen general» como Inicio; no pisa una elección de
apariencia existente.

Evidencia live: deploy `6b016bd8317438ca308d4d50` (`ready`), SHA `ee43cf1d`.
En modo local se observaron `data-la-diseno="orbita"`, el shell común y la
superficie Pase; 24 controles, 1 campo y 5 estados quedaron marcados por la
capa semántica, con mínimo visible de 44 px y `overflow=false`. La vista
confirmó la cabecera y navegación Órbita; no se escribieron datos de negocio.

### Punto 4 · marcas semánticas para componentes históricos · `f7f6eb58`

El shell Órbita ahora clasifica de forma aditiva los elementos que React ya
renderiza en cada módulo: controles, campos, pestañas, tablas, estados,
diálogos y tarjetas. Las clases `la-orbita-control`, `la-orbita-field`,
`la-orbita-tab`, `la-orbita-table`, `la-orbita-state`, `la-orbita-dialog` y
`la-orbita-card` permiten que `la-apariencia.css` v45 aplique una escala común
sin reemplazar componentes ni tocar handlers, permisos o datos. Se mantienen
el suelo táctil de 44 px, el foco visible, los tokens de color y la reducción
de movimiento. Cache: `qa-orbita-modules-v45-20261121` y
`qa-orbita-shell-v10-20261121`.

Resultado estático: contratos P01, marco, componentes, migración de módulos y
`git diff --check` en verde. La normalización está publicada solo en la rama
`rediseno/f0-base-qa`; PR #225 continúa en borrador y producción no se toca.
Las filas de la matriz permanecen `PARCIAL` hasta validar rutas autenticadas,
estados de carga/vacío/error y escritorio+móvil con datos reales.

### Barra inferior móvil · revisión `5c452ff4`

La barra de pestañas móvil ya no conserva el tratamiento visual histórico:
`la-orbita-shell.js` la marca como navegación del shell, sincroniza el destino
activo y la incluye en el buscador global sin duplicar entradas. `la-apariencia.css`
la presenta con la misma superficie, escala, foco, borde y controles de `44 px`
que el resto de Órbita; en escritorio se oculta y en móvil ocupa su propia fila
sin desbordamiento. El cambio es aditivo y mantiene los handlers y la lógica de
selección existentes. La caché de hoja pasa a `qa-orbita-modules-v44-20261121`.

Verificación estática: `node --check la-orbita-shell.js`, contratos de shell,
rutas, componentes y migración modular, además de `git diff --check`, pasan.
La evidencia visual móvil de esta revisión queda pendiente de una nueva pasada
en el Preview 225; no se debe declarar cierre de ningún módulo hasta repetirla
con la barra renderizada y, para las rutas operativas, con sesión QA.

La pasada se completó después del despliegue: en `618×678`, el modo local del
Preview 225 mostró la barra inferior Órbita con `Inicio`, `Resultados`, `Arqueo
de caja` y `Más`, el activo resaltado y la cabecera común completa. No hubo
desbordamiento horizontal visible ni se ejecutaron escrituras; Pase y Cocina
mostraron sus avisos de conexión de modo local. La evidencia confirma el shell
móvil, pero no sustituye los recorridos autenticados que mantienen las doce
filas de la matriz en `PARCIAL`.

El commit `37080596af67e46a04cc7c313293f69a0e8b3521` está desplegado en el
Preview 225 como `6b01684ad1ed5298eea45317` (`ready`). El escaneo de secretos
de Netlify devolvió cero coincidencias y las siete reglas de cabeceras pasaron.

### Publicación de la revisión actual

Referencia: commit `bfb0e6856c4baa1fe64858f45b98cfdf89485685`, Deploy Preview
`6b015f565f50b1269577c814` (`ready`), alias estable
`https://deploy-preview-225--chic-entremet-9107cf.netlify.app/`. El escaneo de
secretos no encontró coincidencias. Los tests de runtime que requieren
`jsdom/react` no se ejecutaron en este host porque `CFG6_UI_DEPS` no está
disponible; los contratos estáticos y la batería `tests/rediseno/*.mjs` sí
pasaron, junto con `node --check` y `git diff --check`.

### Revisión adicional · Plataforma previa y recuperación de acceso

El último barrido visual encontró una excepción fuera de `#root`: el panel de
Plataforma se monta como `.lap-root` bajo `body` y tenía una hoja inline propia
con verde/beige, mientras que `restablecer-contrasena.html` era un documento
independiente con la tarjeta antigua. Se corrigieron ambas superficies en la
rama `rediseno/f0-base-qa`:

1. `plataforma-panel.js` usa `--c-bg`, `--c-surface`, `--c-ink`,
   `--c-accent-fill`, `--c-red`, `--c-amber` y la escala `--la-*` del diseño
   activo. Barra, tarjetas, diálogos, estados, campos y botones ya comparten
   el marco Órbita; no hay controles de 24 px como excepción de escritorio.
2. `restablecer-contrasena.html` fija `data-la-diseno="orbita"`, carga
   `la-apariencia.css` v43 y reemplaza los colores/radios heredados por los
   tokens comunes. Sigue siendo una ruta independiente, pero ya no es una
   identidad visual distinta.

La caché del script queda marcada como `qa-orbita-platform-v2-20261121`.
Contratos específicos y `git diff --check` pasan. No se ejecutó ninguna
operación de negocio ni se tocó producción. Falta todavía la sesión de
administrador de Plataforma y el recorrido real de recuperación/MFA para
convertir esas filas de `PARCIAL` en `CERRADO`.

### Revisión adicional · arranque y bootstrap de instalación · `9ae45621`

El primer render también queda dentro del contrato Órbita. `index.html` fija
el diseño antes de cargar la aplicación y la pantalla `#cargando` consume los
tokens semánticos, sin la paleta antigua. El diálogo de instalación inicial
de `owner-bootstrap-post-reset.js` usa la misma superficie, tipografía,
alertas, campos y botones; todos sus controles respetan `44×44 px` mínimo.
No se tocaron la sesión, las RPC, los permisos ni la barrera de instalación.

Verificación: `node --check owner-bootstrap-post-reset.js`,
`componentes-orbita-contract`, `marco-orbita-contract`,
`marco-orbita-rutas-contract`, `migracion-modulos-contract` y
`git diff --check` pasan. Commit `9ae4562168c3057d090e857df3e4b205c530446f`;
Deploy Preview 225 `6b0160c90992330e675aecdf` (`ready`, escaneo de secretos sin
coincidencias). Plataforma y Acceso continúan `PARCIAL` hasta la validación
autenticada.

En el mismo Preview 225 se hizo un smoke visual de la pantalla de Acceso sin
sesión: viewport `618×678`, `data-la-diseno="orbita"`, fondo y tipografía
semánticos, `scrollWidth` igual a `innerWidth` y cero controles menores de
`44 px`. Es evidencia de la composición inicial; queda separado el recorrido
autenticado de login, recuperación, expiración, MFA y selección de local.

### Ajuste del shell · control lateral táctil · `6438b207`

En la auditoría del punto 4 se encontró un control común que no cumplía el
mínimo táctil: el botón de contraer la barra lateral medía `36×36 px`. Se
ajustó a `44×44 px`, se actualizó la versión de caché CSS a
`qa-orbita-modules-v41-20261121` y se dejó el contrato automatizado que lo
comprueba. La corrección no modifica lógica ni datos y solo se publicó en la
rama de QA; PR #225 sigue en borrador y producción no se toca.

El deploy correspondiente quedó `ready` como
`6b015a051778aed939b61a43`, con `commit_ref` exacto
`bc8043b217701c7f29198a718a8f759b2680bb08`, en el alias estable del Preview
225. La batería `tests/rediseno/*.mjs` terminó sin fallos y `git diff --check`
quedó limpio.

Tras el commit documental `e5f0a67efe6b2b3d16fff12b048e2eabf25e4dd6`, el
Preview 225 volvió a quedar `ready` en el deploy
`6b015a56e2b32501d2eb2c8d`; el alias estable sigue apuntando a esa rama de QA.

### Plataforma · token tipográfico heredado corregido · `e84079b3`

El panel previo al shell utilizaba `var(--la-font-sans)`, que no existe en el
sistema de tokens Órbita. Se corrigió a `var(--la-font)`, se actualizó la
marca CSS a `qa-orbita-modules-v42-20261121` y se dejó un contrato negativo
para detectar el token inexistente. Plataforma conserva `PARCIAL`: falta la
sesión de administrador QA y el recorrido real de sus paneles.

### Acceso · token tipográfico de MFA declarado · `v43`

El campo de código de MFA consumía `--la-mono` sin que la hoja Órbita lo
declarase. Se añadió IBM Plex Mono en `:root`, se actualizó la marca CSS a
`qa-orbita-modules-v43-20261121` y se añadió una aserción de contrato. La
propiedad `--la-orbita-puntero` queda documentada como dinámica, no como token
huérfano.

La corrección quedó publicada en el deploy `6b015c30695cff02d317a7d6`
(`ready`), con `commit_ref` `af3ba1dec857d8c8219a29a2b50bc98083b84338`.

El contrato de componentes ahora inventaría todos los tokens `--la-*` usados
por la hoja y falla si alguno no está declarado; solo permite la propiedad
dinámica `--la-orbita-puntero`, escrita por el cursor del panel.

### Acceso · revisión responsive no autenticada · 21/11/2026

La pantalla `.la-acceso` se observó directamente en el preview a **390 × 844**
y **1440 × 900**. En ambos tamaños mostró login, recuperación, acceso local y
Apariencia sin desbordamiento y con control mínimo de 44 px. La comprobación
valida solo la composición responsive; el login, la recuperación, la
expiración, el selector de empresa/local y MFA siguen necesitando una sesión
QA autenticada.

### Recorrido de escritorio actualizado · 21/11/2026

La misma selección se repitió en escritorio a **1440 × 900 px**: Inicio, TPV,
Cocina, Proveedores, Productos, Personal, Clientes, Configuración, Arqueo de
caja y Encargos resolvieron respectivamente `inicio`, `tpv`, `cocina`,
`compras`, `inventario`, `personal`, `clientes`, `configuracion`, `caja` y
`tpv`. Todas conservaron `overflow=false`, controles visibles de al menos 44
px y sus alertas/estados visibles. La pasada no sincronizada evita escrituras
de negocio y no sustituye la validación autenticada.

### Evidencia visual móvil · 21/11/2026

Se ejecutó un recorrido completo en el Deploy Preview con emulación de **390 ×
844 px** (`deviceScaleFactor=1`, modo móvil), en sesión local sin
sincronización. Se abrió la navegación inferior y el menú «Más» para cada
entrada. Resultado: **10/10 rutas correctas**, `overflow=false` en todas,
navegación inferior presente y control visible mínimo de **44 px**.

`Panel general → inicio/inicio; TPV → tpv/tpv; Cocina → cocina/cocina;
Proveedores → compras/compras; Productos → inventario/inventario; Personal →
personal/personal; Clientes → clientes/clientes; Configuración →
configuracion/configuracion; Arqueo de caja → caja/caja; Encargos → tpv/tpv.`

Este recorrido demuestra la unificación del shell Órbita en móvil y el
comportamiento del menú «Más». No sustituye la prueba autenticada de datos,
permisos, cobros, MFA ni handlers, por lo que las filas de la matriz continúan
`PARCIAL` hasta completar esas comprobaciones.

En la misma pasada se comprobó que las rutas siguen comunicando estados cuando
el modo local no puede consultar el servidor: TPV y Cocina muestran alertas de
conexión; Compras, Personal y Clientes muestran estados informativos; Inicio y
Caja conservan su composición; Configuración y Encargos muestran estados
vacíos o de conexión. En todos los casos se mantuvieron `overflow=false` y
controles visibles de al menos 44 px. Es una comprobación de presentación y
estados locales, no una validación de datos, permisos o persistencia de QA.

### Inicio y panel general · superficie única v29

Se normalizó la superficie de Inicio completa: el panel Órbita y el detalle
operativo que se abre debajo consumen la misma tarjeta, borde, radio, sombra,
jerarquía tipográfica y altura táctil. Los wrappers de móvil reciben límites
de anchura y los accesos/indicadores se apilan sin ampliar el viewport. La
lógica de KPIs, estados, datos, permisos y handlers queda intacta. Marca
`qa-orbita-modules-v29-20261121`, huella P01 `b729a1b6a5c2f7d3`; falta el
recorrido autenticado de Inicio y sus estados en QA.
El código está publicado en Deploy Preview 225 como
`6b0141b9c36cc507a332a536` (`ready`), commit `41532f7b`.

### TPV y sala · controles secundarios e historial · v30

Se normalizaron también los controles que quedaban fuera del catálogo: ticket,
cuentas, mesas, venta rápida, confirmaciones y selector de modalidad. El
historial usa tabla/tarjeta Órbita y queda contenido en móvil. La capa es solo
visual; conserva cobros, fiscalidad, permisos, persistencia y handlers. Marca
`qa-orbita-modules-v30-20261121`, huella P01 `742bf5b1ac1bc2fd`; falta el
recorrido autenticado de TPV y sala.
La publicación está lista en Deploy Preview 225 como
`6b014268ed0690c4525a4eb2` (`ready`), commit `47368d65`.

### Pase · raíces independientes y cola contenida · v31

Se alinearon las dos raíces de Pase (módulo independiente y panel incrustado)
con la misma composición Órbita. Los estados reales de mesa, filtros, accesos
y cola mantienen sus handlers; en móvil la cola queda acotada a un scroll local
para evitar una pantalla infinita. Marca `qa-orbita-modules-v31-20261121`,
huella P01 `42175d9f2bb452b1`; falta la comprobación autenticada en QA.
La publicación v31 está lista en Deploy Preview 225 como
`6b0142f47b251896fb16c39f` (`ready`), commit `cbea3472`.

### Contenedores históricos · contención móvil común · 21/11/2026

La capa común v28 contiene también los wrappers históricos `overflow-x-auto`
que rodean matrices de permisos, bandas de filtros y listados. El scroll queda
en el wrapper local y el `main`/viewport reciben `min-width: 0` y `max-width:
100%`, evitando que un hijo con anchura intrínseca amplíe la superficie móvil.
No cambian datos, ordenación, selección, handlers ni permisos. Marca
`qa-orbita-modules-v28-20261121`, huella P01 `edb7c9116b854562`.
La publicación v28 ya está lista en `6b01405358c478c62a3c92b0` (`ready`),
commit `1c00a56a`. Queda pendiente el recorrido autenticado de las doce
superficies y la evidencia live de cada ruta.

### Gestión · estados y tablas semánticos · 21/11/2026

La revisión v24 de `la-apariencia.css` completa la capa común de Compras,
Inventario, Personal, Configuración y Plataforma: avisos (`role=alert`),
estados (`role=status`) y tablas consumen los tokens Órbita para fondo,
contraste, bordes y hover, también en móvil. Se conservan lógica, datos,
permisos, ordenación y handlers. Marca `qa-orbita-modules-v24-20261121`,
huella P01 `471a45c1efb84092`. Los cinco módulos siguen `PARCIAL` hasta el
recorrido autenticado de sus rutas y estados. Deploy Preview 225: 
`6b0139add1ed5298ee9b64ab` (`ready`), commit `a1120082`.

### Acceso · MFA alineado con Órbita · 21/11/2026

El overlay de MFA ya no hereda la composición verde/dorada de su estilo inline.
La capa `la-apariencia.css` v25 lo normaliza mediante el atributo estable
`autocomplete="one-time-code"`: superficie, tipografía, campo, error y
acciones usan tokens Órbita, con controles táctiles mínimos de `44 px` también
en móvil. El flujo de autenticación no se tocó. Huella P01:
`e9372afb3252f577`. Sigue pendiente el recorrido autenticado completo.
Publicado en Deploy Preview 225 como `6b013c51e5a98b1501fc71df` (`ready`),
commit `f7157f0c`.

### Estados globales · 21/11/2026

La capa v26 normaliza las primitivas globales: `role=alert` usa el fondo/tinta
de error Órbita y `role=status` la superficie informativa, incluyendo Clientes,
Caja y pantallas aún sin selector específico. La semántica y los handlers no
cambian. Caché `qa-orbita-modules-v26-20261121`, huella P01
`0471acf3bfc85099`.
Deploy Preview 225: `6b013d3584eba994f4ee5306` (`ready`), commit `4e51e027`.

### Tablas · contención móvil común · 21/11/2026

La capa v27 contiene el desplazamiento horizontal de cualquier tabla dentro
de un módulo Órbita en móvil y mantiene una anchura mínima legible por celda.
No cambia semántica, ordenación ni handlers. Caché
`qa-orbita-modules-v27-20261121`, huella P01 `bb7e168a744878e6`.
Deploy Preview 225: `6b013ddcf49a09cfd3ecd251` (`ready`), commit `8b07d8e7`.

### TPV y sala · superficies secundarias · 21/11/2026

La capa `la-apariencia.css` v23 extiende la migración visual de TPV a venta
rápida (`data-tpv-quick`), selector de modalidad, resumen/historial de ventas,
factura a empresa (`data-tpv31-factura-empresa`) y avisos de error. Se usan
tokens Órbita para tarjetas, estados y foco; en móvil el resumen pasa a una
columna. No se tocaron cobro, persistencia, fiscalidad, permisos ni handlers.
Los contratos `componentes-orbita`, `migracion-modulos` y `P01` pasan; la
huella CSS es `dc23dacac016d12d` y la marca es
`qa-orbita-modules-v23-20261121`. El recorrido autenticado de TPV sigue
pendiente para cerrar el bloque.

La versión v23 está publicada en el Deploy Preview 225 como deploy
`6b0137dac55d9e163e63c27e` (`ready`), commit `a9147300`.

### Cocina · controles y estados de la cola · v32

Se normalizaron los controles y estados de Cocina con la escala Órbita:
acciones, filtros, campos, tarjetas, alertas y estados informativos comparten
tokens, foco, radio y altura mínima táctil. La cola y las tarjetas quedan
contenidas en móvil sin ampliar el viewport. Se preservan estaciones, estados,
RPC, permisos y handlers. Marca `qa-orbita-modules-v32-20261121`, huella P01
`9ea641f1c7c6adae`; falta la comprobación autenticada en QA. Deploy Preview
225: `6b014411457f622dbe7439c8` (`ready`), commit `81ca1074`.

### Caja · controles, estados y movimientos · v33

Se completó la capa visual de Caja con la misma escala Órbita para acciones,
campos, estados, detalles y tablas. En móvil las tablas conservan scroll
local, los grupos se envuelven y no se amplía el viewport. La lógica de
cobros, arqueos, cierres, reembolsos, documentos y permisos permanece intacta.
Marca `qa-orbita-modules-v33-20261121`, huella P01 `7ba54937325ac699`; queda
pendiente el recorrido autenticado en QA. Deploy Preview 225:
`6b01458faf0db151e7f4ba59` (`ready`), commit `fd1f6a51`.

### Clientes · listados, vistas guardadas y ficha · v34

Se completó la normalización visual de Clientes para listado, vistas guardadas,
filtros, paginación, ficha, actividad y tablas. Los estados de error e
información consumen tokens Órbita y el scroll queda contenido en móvil. Se
preservan datos, NIF, permisos, actividad y handlers. Marca
`qa-orbita-modules-v34-20261121`, huella P01 `77fa483c6dc0cc62`; queda pendiente
el recorrido autenticado en QA. Deploy Preview 225:
`6b01467d071af1a092f9d639` (`ready`), commit `851f285c`.

### Compras · proveedores, pedidos, recepción y facturas · v35

Se aplicó la escala Órbita a proveedores, pedidos, recepción, albaranes y
facturas: controles de `44 px`, tarjetas y estados comunes, detalles
accionables y tablas contenidas en móvil. Se preservan pagos, datos, permisos
y handlers. Marca `qa-orbita-modules-v35-20261121`, huella P01
`edaafbdf5effde93`; queda pendiente el recorrido autenticado en QA.
Deploy Preview 225: `6b01472c82a0e124af3b427b` (`ready`), commit `5b0c4bad`.

### Inventario · productos, movimientos, mermas y ajustes · v36

Se aplicó la escala Órbita a productos, movimientos, mermas, caducidad y
ajustes: controles táctiles, tarjetas, estados, detalles y tablas comunes,
con scroll local y formularios apilados en móvil. La lógica, persistencia,
permisos y handlers permanecen intactos. Marca `qa-orbita-modules-v36-20261121`,
huella P01 `b0199d11c27752d6`; queda pendiente el recorrido autenticado en QA.
Deploy Preview 225: `6b0147c47a019a8ab1360f4d` (`ready`), commit `e015abb2`.

### Personal · empleados, cargos, permisos, turnos y fichajes · v37

Se aplicó la escala Órbita a empleados, cargos, permisos, turnos y fichajes,
con controles táctiles comunes, estados semánticos, tarjetas y tablas
contenidas en móvil. La lógica, los permisos y los handlers permanecen
intactos. Marca `qa-orbita-modules-v37-20261121`, huella P01
`7360be9936c414f6`; queda pendiente el recorrido autenticado en QA.
Deploy Preview 225: `6b0148194d9d3057193003d7` (`ready`), commit `2f3735b0`.

### Configuración · empresa, locales, terminales, fiscalidad y apariencia · v38

Se aplicó la escala Órbita a empresa, locales, terminales, fiscalidad y
apariencia: controles táctiles comunes, tarjetas, estados y tablas contenidas
en móvil. Se preservan persistencia, permisos y handlers. Marca
`qa-orbita-modules-v38-20261121`, huella P01 `f186177be3f110a1`; queda pendiente
el recorrido autenticado en QA. Deploy Preview 225: `6b0149afafe536f0d8713604`
(`ready`), commit `9b2bde7b`.

### Plataforma · paneles exclusivos de administración · v39

Se aplicó la escala Órbita a los paneles de Plataforma, conservando permisos,
roles, datos y handlers: controles táctiles comunes, tarjetas, estados y
tablas contenidas en móvil. Marca `qa-orbita-modules-v39-20261121`, huella P01
`f26769170c7cdfa3`; queda pendiente el recorrido autenticado con privilegio de
administración en QA. La capa cubre el panel previo `#la-plataforma-root`, su
flujo de cambio de contraseña y la superficie marcada por el shell.
Deploy Preview 225: `6b014af5313583e7553eee86` (`ready`), commit `45722dc5`.

### Acceso · login, recuperación, MFA y selección de empresa/local · v40

Se aplicó la escala Órbita a login, recuperación, MFA y selección de
empresa/local, conservando autenticación, sesiones, permisos y handlers. En
móvil el formulario ocupa el ancho disponible y las opciones se envuelven sin
desbordamiento. Marca `qa-orbita-modules-v40-20261121`, huella P01
`67300938eb8c5c76`; queda pendiente el recorrido autenticado completo en QA.
Deploy Preview 225: `6b014b8aabe0ae40a1c2ee97` (`ready`), commit `b1b142ba`.

### Cierre técnico de la tanda de módulos · 21/11/2026 · SHA `b8a9a132`

Se corrigió la última superficie fuera del `main` común: Plataforma ahora
recibe la escala Órbita también en `#la-plataforma-root` y
`#la-plataforma-cambio-root`, incluidos botones, campos, tarjetas, errores,
estados y filas `.lap-*`. La corrección conserva lógica, datos, permisos,
handlers y rutas. El PR #225 sigue en borrador, dirigido a `release`, y el
estado combinado de GitHub confirma el Deploy Preview 225 correcto.
Deploy `6b015343ff0dcfeeefb454ae` (`ready`), URL estable
`https://deploy-preview-225--chic-entremet-9107cf.netlify.app/`.

Comprobaciones ejecutadas en esta tanda:

- `tests/rediseno/*.mjs`: `REDISENO_REGRESSION_FAILED=0`.
- Contratos Órbita, rutas, módulos (12/12), responsive/táctil, P01,
  Apariencia local (49/49), MFA (26/26), org-33 (43/43), Pase, fiscalidad,
  propina, botones solo icono y arranque resiliente: todos `PASS`.
- Manifiesto CI: 367 contratos activos, 1 histórico esperado, 11 utilidades y
  5 diagnósticos; inventario total 384.
- `python source-recovery/recuperar_candidato.py --check`:
  `PARIDAD_CUERPO_EXACTA=1`, `SOURCE_RECOVERY_CHECK=PASS`.
- `node --check` para `fuente.js` y `source-recovery/fuente-recuperado.js`:
  `PASS`; `git diff --check`: `PASS`; árbol limpio.

La batería Bash global no pudo iniciarse en este Windows porque MSYS2 falla al
crear el objeto `\BaseNamedObjects\msys-*` (fallo de infraestructura del
runner, no del producto). La batería específica reproducible de rediseño sí
queda verde. Los 12 módulos permanecen `PARCIAL` en la matriz hasta completar
el recorrido autenticado de cada ruta real, especialmente Plataforma con
administrador QA y Acceso con sesión/MFA.

### Recorrido visual de rutas históricas · 21/11/2026 · SHA `56be8a75`

El shell ya no depende de `aria-current` para las pantallas antiguas: cuando
un handler no lo actualiza, combina ese valor con el `h1/h2` visible y asigna
la superficie correcta. El recorrido en modo local del preview verificó
`inicio`, `tpv`, `cocina`, `compras`, `inventario`, `personal`, `clientes`,
`configuracion`, `caja` y `tpv` para Encargos; todas las rutas devolvieron
`overflow=false` y un control visible mínimo de 44 px. Se añadió una defensa
contra la coincidencia parcial de «Encargos» con «cargos», que antes podía
clasificar esa ruta como Personal. Esta evidencia es visual y no autenticada;
no sustituye la validación de datos, permisos, cobros ni MFA en QA.
El shell se publica con la marca `qa-orbita-shell-v8-20261121` y huella P01
`a6a93b11be680172` (commit `24d490c8`) para impedir que el navegador conserve
la clasificación anterior.

### Corrección de Plataforma previa al shell · 21/11/2026

La revisión v39 cubría el panel de Plataforma cuando ya existía el shell
Órbita, pero el flujo de cambio de contraseña y el panel administrativo
temprano se montan antes de `main[data-la-orbita-module="plataforma"]`, en
`#la-plataforma-root` y `#la-plataforma-cambio-root`. La capa compartida ahora
normaliza también esos dos contenedores y sus primitivas `.lap-*` (tarjetas,
botones, campos, errores, estados y filas), con la misma superficie, borde,
radio, tipografía, escala táctil y comportamiento móvil. No se ha cambiado
ningún handler, permiso, RPC o dato. La huella P01 de esta corrección es
`67300938eb8c5c76`; la matriz y el contrato de componentes la exigen. Sigue
pendiente la verificación con una cuenta de administrador de Plataforma en QA.
Evidencia no autenticada: el preview muestra `Iniciar sesión`, recuperación,
acceso sin sincronizar y Apariencia; falta recorrer la sesión autenticada y MFA.

### Corrección transversal · arranque local desde Acceso

El modo «sin sincronizar» conservaba el cliente Supabase que se había creado
al abrir el formulario de acceso; en Preview podía dejar la suite en
«Cargando almacén…». La corrección activa `__modoPruebasLocal`, limpia el
cliente y desactiva la sincronización antes de montar la aplicación, con
paridad entre `fuente.js` y `source-recovery/fuente-recuperado.js`. La caché
del recurso pasa a `qa-persistencia-sin-advertencias-v2-20261121`.

### Pase · variante Órbita · 21/11/2026

Se corrigió la variante `.la-orbita-pase`: el panel ya no usa el fondo
verde/lima del componente histórico y consume los tokens carbón/acero/coral
del diseño activo. Se mantienen los estados de sala, la cola de cocina y los
destinos existentes. Marca `qa-orbita-pase-v2-20261121`, huella
`4b14613f8923c353`; el recorrido QA autenticado sigue pendiente.

La publicación de esta corrección quedó en el deploy
`6b01359c82a0e124af379731` (`ready`), commit `74b32091`, PR #225 en borrador.
La batería sin base de datos conserva el resultado `328/305/23`, con
`INFRA_FAIL=0`, y el árbol queda limpio. El navegador llega correctamente a la
pantalla MFA; la comprobación visual autenticada de Inicio se retomará al
introducir el código en el navegador, sin compartirlo en el chat.

### Inicio · tokens Órbita en el dashboard premium · 21/11/2026

Se corrigió una convivencia visual que no aparecía en los contratos de shell:
`dashboard-premium-v2.js` usaba colores literales verde/dorado en KPIs,
acciones rápidas, alertas, CTA, toast y el botón de detalle operativo. Esos
colores procedían de una versión anterior de Sello y hacían que Inicio no
pareciera Órbita aunque el panel principal ya estuviera separado del detalle
heredado.

La capa ahora consume exclusivamente los tokens semánticos del tema (`--c-*`)
y el recurso se sirve con la marca `qa-orbita-panel-v3-20261121`. Se añadió al
contrato de componentes una aserción que detecta el retorno de la paleta
heredada. No se modificaron datos, indicadores, handlers, permisos ni rutas.
Inicio permanece `PARCIAL`: falta la validación autenticada de sus variantes y
estados en QA.
