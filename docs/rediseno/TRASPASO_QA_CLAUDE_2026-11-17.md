# L&A Suite · Traspaso a Claude Code · 17 de noviembre de 2026

Continuar en `Plopezm1990/Almacen`, rama `rediseno/f0-base-qa`, [PR #225 en borrador contra `release`](https://github.com/Plopezm1990/Almacen/pull/225). Trabajar en el [Deploy Preview #225](https://deploy-preview-225--chic-entremet-9107cf.netlify.app/), proyecto Supabase QA `qjqorixtkilwsndqayyx`, empresa `QA-EMP-A`, local `QA-A1`. Mantener el PR sin fusionar y verificar el SHA del preview antes de cada tanda. La última referencia funcional comprobada es `9d4e6d74` y la evidencia se publicó en `9e6f4cef`. [Puerta general de CI de `9e6f4cef`](https://github.com/Plopezm1990/Almacen/actions/runs/43952689302).

## Reanudar por aquí

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

La matriz y el acta de punto 1 se actualizaron con este estado. El orden actual
es: desplegar y repetir los tres casos de Pase; ejecutar en QA-A1 los ensayos de
permisos de caja, cobro y reembolso con la cuenta Camarero/a; cerrar las filas
del punto 1; y solo después valorar la migración MFA opcional. Mantén el PR #225
en borrador y trabaja únicamente contra QA.
