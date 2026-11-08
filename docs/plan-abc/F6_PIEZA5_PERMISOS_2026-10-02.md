# F6 · pieza 5 de la capa de configuración: permisos configurables, reabrir cierre (D14) y retirada de roles

Fecha: 2026-10-02
Alcance: **solo QA** (`qjqorixtkilwsndqayyx`) y repositorio. **Producción no tocada. Pantalla no modificada.**
Autorización: «Pieza 5: permisos configurables y retirada de roles» elegida por Pedro el 2/10/2026 (solo en QA, como las
piezas anteriores). Las decisiones de diseño las eligió Pedro con opciones (todas las recomendadas):

| Pregunta | Elección de Pedro |
|---|---|
| ¿Hasta dónde puede cambiar permisos el propietario? | **Con techo en lo delicado**: puede quitar o dar permisos a Encargado, Cajero/a y Camarero/a; lo de dinero y documentos fiscales (devoluciones, cobros inciertos, emisor y documentos, cancelaciones sensibles, reabrir cierres) nunca baja de Encargado; el Propietario no pierde ninguno |
| ¿A qué nivel? | **Empresa y local; el local manda** (D19: «por empresa o local») |
| Retirada de Churrero/a, Básico y Estándar | **Bloquear nuevas altas y quitar sus permisos**; quien ya los tiene no se toca y se lista para reasignarlo |
| Devoluciones pedidas por el cajero (D13) | **Dejarlo sin permiso y anotarlo** (ver «Hallazgo» más abajo) |

Estado: `PIEZA_5_APLICADA_Y_VERIFICADA_EN_QA_SIN_PANTALLA`

## Qué hace

| Pieza | Resultado |
|---|---|
| Plantilla por defecto | Un **catálogo único** (`private.abc_cap_catalogo`) con las 31 capacidades: las 30 que ya existían, **exactamente como estaban** (25 generales y 5 de cocina), más una nueva, `ABC_CIERRE_REABRIR` (D14). Comprobado contra el texto de las migraciones originales B04 y A10 y contra la base real |
| Decisiones del propietario | Tabla nueva `abc_capacidades_rol` (sin acceso directo): por **empresa** (sin local) o por **local**, para Encargado, Cajero/a y Camarero/a. Una decisión nula significa «heredar». Orden de resolución: **local → empresa → plantilla**, siempre limitado por el techo |
| Quién decide | `abc_configurar_capacidad_rol`: solo el **Propietario**. Para toda la empresa hace falta ser Propietario de **todos** sus locales; el Propietario de un solo local decide solo en su local. Encargado, cajero/a, propietario de otra empresa, `anon` y `service_role` quedan rechazados. Idempotente (`operation_id`), con motivo y auditoría |
| Qué se puede hacer | **Dar** (hasta el techo), **quitar** (siempre, también en lo delicado) o **heredar** (volver a lo de la empresa o a la plantilla). El Propietario no se toca nunca y no puede perder ninguna capacidad |
| Cómo se aplica | `private.abc_tiene_capacidad` y `private.abc_a10_tiene_capacidad` se reemplazan **conservando exactamente su inicio** (sesión, local, membresía) y cambiando solo el final. Las **~70 funciones** que las llaman por nombre de capacidad **no se tocan** |
| D14: reabrir un cierre | `abc_reabrir_cierre_provisional` es la original con **una sola diferencia**: exige `ABC_CIERRE_REABRIR` (por defecto **solo Propietario**) en vez de `ABC_CAJA_OPERAR` |
| Lectura | `abc_obtener_capacidades_rol`: cualquier miembro del local ve, para cada capacidad y cada rol, si puede (efectivo), qué dice la plantilla, de dónde viene (plantilla, empresa, local o fijo), las decisiones guardadas y si se le puede dar (techo) |
| Retirada de roles | Un trigger en `membresias_usuario` impide **asignar o reactivar** Churrero/a, Básico y Estándar (`rol_retirado:<rol>`). Quien ya los tiene **no se toca**, pero **pierde todos los permisos ABC**. `abc_listar_roles_retirados` (Propietario) lista a esas personas para reasignarlas |
| Auditoría | Cada cambio real deja un evento `CAPACIDAD_ROL_CONFIGURADA` con ámbito, rol, capacidad, valor anterior y nuevo, motivo, versión y el efecto antes y después. Repetir una decisión no crea versión ni evento. Un cambio **de empresa** queda anotado en el local desde el que se hizo (operaciones y auditoría exigen un local), con ámbito EMPRESA |

## Las 31 capacidades: plantilla y techo (para que Pedro la revise)

P = Propietario (siempre sí), E = Encargado, C = Cajero/a, M = Camarero/a. «Techo»: hasta qué rol se puede dar.

| Capacidad | E | C | M | Techo |
|---|---|---|---|---|
| ABC_CUENTA_OPERAR, ABC_COBRO_INICIAR, ABC_PEDIDO_ENVIAR, ABC_PEDIDO_SERVIR, ABC_LINEA_CANCELAR, ABC_SALA_VER, ABC_MESA_ASIGNAR, ABC_CUENTA_REPARTIR, ABC_CUENTA_UNIR | sí | sí | sí | todos |
| ABC_COBRO_EFECTIVO, ABC_CAJA_OPERAR, ABC_PEDIDO_CERRAR | sí | sí | no | todos |
| ABC_PREPARACION_INICIAR, ABC_PREPARACION_COMPLETAR | sí | no | sí | todos |
| ABC_CUENTA_REASIGNAR, ABC_PEDIDO_CANCELAR, ABC_SALA_CONFIGURAR, ABC_MESA_RESERVAR, ABC_MESA_BLOQUEAR, ABC_REPARTO_REVERTIR | sí | no | no | todos |
| **ABC_COBRO_RESOLVER_INCIERTO, ABC_REEMBOLSO_SOLICITAR, ABC_REEMBOLSO_CONFIRMAR, ABC_EMISOR_CAMBIAR, ABC_CANCELACION_SENSIBLE** | sí | no | no | **Encargado** |
| **ABC_CIERRE_REABRIR** (nueva, D14) | **no** | no | no | **Encargado** |
| Cocina: ABC_COMANDA_VER, ABC_COMANDA_REIMPRIMIR | sí | sí | sí | todos |
| Cocina: ABC_COMANDA_CAMBIAR | sí | no | sí | todos |
| Cocina: ABC_COMANDA_CONFIGURAR, ABC_COMANDA_MERMA_DECIDIR | sí | no | no | todos |

La clasificación «delicado = techo en Encargado» (las 6 en negrita) es mía, a partir de la lista que aceptó Pedro; si quiere
mover alguna (por ejemplo, ABC_PEDIDO_CANCELAR o la merma de cocina), es un cambio de una línea del catálogo.

## Efecto en la pantalla actual (preview 118) y en QA

1. **Reabrir un cierre**: hoy el cajero y el encargado pueden. Tras la pieza, **solo el Propietario** (D14). Si la pantalla
   actual ofrece el botón a otros roles, **dará error** (`abc_caja_no_autorizado`) hasta la pieza de pantalla.
2. **Dar de alta a un empleado con rol Churrero/a, Básico o Estándar** (flujo de personal de la pantalla actual) **dará
   error** (`rol_retirado:<rol>`) hasta la pantalla.
3. **Quien ya tenga un rol retirado pierde los permisos ABC.** En QA solo hay una membresía «Básico», **inactiva y sin
   local** (no da acceso a nada): no afecta a nadie. En producción **no se ha mirado**.
4. Todo lo demás se comporta **igual que antes** para los cuatro roles (comprobado con las 31 capacidades × 4 roles).

## Hallazgo (D13) y decisión pendiente de diseño

> **Resuelto el 3/10/2026** con la pieza D13 (solo QA): `abc_solicitar_reembolso` ya no encola el envío si quien solicita no puede confirmar, hay una función nueva `abc_aprobar_reembolso` y el permiso de solicitar se puede dar al Cajero/a. Ver `F6_D13_DEVOLUCIONES_RESULTADO_2026-10-03.md`. Lo que sigue describe lo que se encontró entonces.

Al leer `abc_solicitar_reembolso` se ve que, cuando el pago **no es en efectivo**, la función **encola el efecto hacia el
proveedor en el momento de solicitar** la devolución, no al confirmarla. Hoy no hay proveedor conectado, así que no sale
nada; pero con un proveedor real, quien pueda *solicitar* movería dinero sin aprobación. Por eso D13 («el cajero solo con
aprobación») **no se puede lograr con un permiso**: exigiría cambiar el flujo de devoluciones para que nada salga sin
confirmar. Pedro eligió dejarlo sin permiso para el cajero (con techo en Encargado, **nadie puede dárselo**). Queda como
**punto abierto del flujo de devoluciones**, antes de conectar cualquier proveedor. (Hallazgo por lectura del código, sin
ejecutarlo.)

## Decisiones y límites

1. **Solo ABC.** No cubre los permisos de personal, finanzas, stock (`pm06`, `pm07`, `pm08`, `pm11`), catálogo
   (`abc_catalogo_puede_gestionar`), auditoría (`p2_r03b_puede_leer_auditoria`), descuentos (tiene su propia política por rol)
   ni el mapa de la pantalla (`ROLES_EMPLEADO`, que además conserva Churrero/a, Básico y Estándar). `perfiles.rol` no se toca.
2. **Cuatro roles fijos** (D03: roles nuevos con nombre propio, fuera de alcance). Los nombres están escritos en el catálogo.
3. **Sin «propietario de la plataforma»**: configura cada empresa con su propietario. Sigue sin existir ese concepto.
4. Un cambio **de empresa** se audita en el local desde el que se hace; los demás locales no lo ven en su propia auditoría.
5. **Quitar y heredar siempre se pueden**, incluso a un rol que ya no tiene la capacidad (queda anotado como decisión
   explícita). **Dar** se rechaza por encima del techo (`capacidad_fuera_de_techo`). Si el techo se endureciera después, lo
   ya guardado por encima del techo **no concede nada** (el techo también se aplica al leer; comprobado).
6. Las membresías **sin local ni «todos los locales»** (como la «Básico» antigua de QA) no se listan en
   `abc_listar_roles_retirados`: no dan acceso a nada.
7. **Una cuenta de empleado con rol retirado sigue existiendo**: pierde permisos ABC pero no se desactiva ni se reasigna sola.
8. No se ha comprobado el efecto en **producción**: allí las funciones reemplazadas pueden ser distintas (la migración
   **se niega a aplicarse** si no coinciden con las conocidas) y puede haber personas con roles retirados.

## Pruebas

| Prueba | Resultado |
|---|---|
| Contrato vivo `tests/cfg/cfg5-contract.sql` **en QA**, con `ROLLBACK` (4 bloques: matriz, configuración, reabrir cierre, roles retirados) | **154/154** |
| Mismo contrato en una réplica local (cadena con cocina A10, B04, PM10, C04 y piezas 1 a 4, base en UTF‑8 como QA) | **154/154** |
| Plantilla por defecto = comportamiento anterior (31 capacidades × 4 roles, tabla copiada a mano del texto original, aparte del catálogo) | coincide |
| Contratos vivos de las piezas 1 a 4 con la pieza 5 aplicada (regresión, local) | **102/102, 201/201, 79/79 y 72/72** |
| Contratos de Postgres real C04 a C12 (cierre, series, tipos, puerta fiscal, retención, impresión, entrega, conciliación, ensayo), sin y con la pieza 5 | **9/9 PASS** en las dos variantes |
| Contratos históricos A05, A07, A08 y A10 (con sus pruebas de A03, A04 y M04d), con una copia de la pieza 5 sin comprobaciones previas ni trigger, y A05 con un Camarero/a en lugar del Churrero/a | **PASS** (los 4) |
| Contratos estáticos de las piezas 1 a 5 | OK (los cinco) |
| Mutantes del contrato vivo: 55 averías provocadas (matriz y techos, resolución local/empresa/plantilla, techo al leer, roles configurables y retirados, familias de capacidades, reabrir con la capacidad antigua, quién decide, replay, «siempre cambio», ámbito, eventos, versiones, lectura abierta, origen, listado, trigger de roles, permisos, RLS, índice, restricciones…) | **53/55 detectadas**; las 2 restantes son **equivalentes** (cambian el texto pero no el comportamiento: `permitido is not null` es redundante porque el nulo ya se trata, y `tg_op='INSERT'` es redundante porque en un alta `old.rol` es nulo). Una sobrevivió al primer contrato (quitar un permiso a un rol por encima del techo) y se añadió la prueba |
| Mutantes del contrato estático: 60 averías provocadas (huellas, catálogo, techos, prefijos de las funciones reemplazadas, reabrir, `search_path`, ACL, RLS, políticas, borrados, otras tablas, bloqueos…) | **60/60 detectadas** (una sobrevivió al primer contrato y se endureció) |

Estado de QA comprobado después de aplicar y de las pruebas: tabla con RLS activada, **sin políticas y sin permisos de
tabla**; las 13 funciones son SECURITY DEFINER con `search_path` vacío, las 9 privadas **sin permiso para nadie** y las 4
públicas solo para `authenticated`; las **13 huellas md5 coinciden** con las de la réplica donde se probó; el trigger de roles
retirados está activo (`membresias_usuario` tiene ahora tres triggers: los dos que ya había y este); migración **registrada**
(`20261002190532 … pieza5_permisos`); **cero residuos** (empresas, locales, membresías, terminales, decisiones, eventos y
operaciones `CFG-*`/`cfg5-*`) y sin transacciones abiertas ni bloqueos; las 8 membresías reales de QA siguen igual.

## Límites de la verificación

- La réplica local no incluye todas las migraciones posteriores a C04; la ejecución en QA cubre la cadena real. **QA no es
  producción.**
- Los contratos históricos A05–A10 se ejecutaron sobre la cadena de su época con una copia **relajada** de la pieza 5 (sin las
  comprobaciones de huella ni el trigger), porque en esas cadenas parciales `abc_tiene_capacidad` aún no tiene todas las
  capacidades. Prueban que el comportamiento por rol no cambia; no prueban la comprobación previa ni el trigger (eso lo
  cubren el contrato vivo y el estático).
- **Los contratos A05 a A08 comprueban por texto que `abc_tiene_capacidad` nombre las capacidades**: con la pieza 5 los nombres
  están en el catálogo, así que esas comprobaciones (en una copia) se ajustaron para leer también el catálogo. A05, A07 y A10
  tienen además un **Churrero/a** en sus datos de prueba, un rol que ya no tiene permisos. No se han modificado los
  originales: **deberán adaptarse si alguna vez se ejecutan sobre una cadena que incluya la pieza 5.**
- Sin prueba de carga ni de concurrencia real (el bloqueo por empresa y el `FOR UPDATE` se comprueban por texto y por efecto en
  una sola transacción).
- No se ha medido el coste de la resolución nueva en cada comprobación de permiso (una o dos búsquedas por índice, solo para
  Encargado, Cajero/a y Camarero/a).

## Antes de promocionar (no autorizado)

1. Revisar en producción las funciones reemplazadas (la migración se niega si no coinciden) y **quién tiene Churrero/a, Básico
   o Estándar** (perderían permisos): reasignarlos antes.
2. Adaptar los contratos históricos citados arriba y registrar `cfg5-static-contract.mjs` y el contrato vivo en la puerta de CI.
3. Construir la pantalla (pieza 6): matriz de permisos del propietario, quitar los tres roles de la lista de alta de empleados y
   ocultar «reabrir cierre» a quien no pueda.
4. Decidir el cambio del flujo de devoluciones (hallazgo D13) antes de conectar un proveedor de pagos.

## Siguiente paso

La pantalla de configuración (pieza 6) o parar y revisar las piezas 1 a 5. La promoción a producción sigue sin autorizar.
