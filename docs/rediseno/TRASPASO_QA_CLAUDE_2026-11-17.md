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
