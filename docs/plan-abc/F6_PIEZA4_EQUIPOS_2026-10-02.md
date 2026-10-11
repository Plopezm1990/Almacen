# F6 · pieza 4 de la capa de configuración: registro de equipos por local

Fecha: 2026-10-02
Alcance: **solo QA** (`qjqorixtkilwsndqayyx`) y repositorio. **Producción no tocada. Pantalla no modificada.**
Autorización: «Pieza 4: registro de equipos por local» elegida por Pedro el 2/10/2026 (sobre el diseño de
`F6_INVENTARIO_CAPA_CONFIGURACION_2026-10-02.md`; solo en QA, como las piezas anteriores).
Estado: `PIEZA_4_APLICADA_Y_VERIFICADA_EN_QA_SIN_PANTALLA`

## Qué se pidió (D04)

«No tengo ningún equipo por ahora; que sea configurable para los equipos que tengan las empresas o los locales.»
Hoy solo existen los terminales del TPV (`terminales_tpv`). No había dónde anotar una impresora, un cajón monedero o
un datáfono.

## Qué hace

| Pieza | Resultado |
|---|---|
| Dónde se anotan | Tabla nueva `abc_local_equipos` (sin acceso directo). **Empieza vacía**: D04, ningún equipo por ahora |
| Qué se anota | Tipo (`IMPRESORA_TICKET`, `IMPRESORA_COCINA`, `CAJON_MONEDERO`, `DATAFONO`, `OTRO`), nombre (1 a 80 caracteres), referencia libre (modelo, nº de serie o etiqueta; hasta 120), terminal del TPV al que está asociado (opcional), activo o no, y notas (hasta 500) |
| Quién lo cambia | Solo el **Propietario de la empresa**, con `abc_configurar_equipo_local` (alta o actualización, con motivo y `operation_id` idempotente). Encargado, cajero/a, propietario de otra empresa, `anon` y `service_role` quedan rechazados |
| Lectura | `abc_listar_equipos_local`: cualquier miembro del local ve los equipos (por defecto solo los activos; con `p_incluir_inactivos` también los desactivados), ordenados por tipo y nombre y con el nombre del terminal |
| Reglas | El nombre no se repite dentro de un local (sin distinguir mayúsculas de minúsculas, tampoco en las vocales con tilde: «Datáfono» = «DATÁFONO»), pero sí puede repetirse en otro local. El **tipo no cambia** una vez creado. El terminal asociado tiene que ser **del mismo local y estar activo**. El local tiene que existir y estar activo. El identificador de un equipo de otro local no se reutiliza |
| Borrado | **No se borra nunca**: se desactiva (`activo = false`) y se puede volver a activar. Así queda el historial |
| Auditoría | Cada cambio real deja un evento `EQUIPO_LOCAL_REGISTRADO` (alta) o `EQUIPO_LOCAL_ACTUALIZADO` (con valor anterior, nuevo, versión y motivo), con el actor. Repetir los mismos datos no crea versión ni evento |

Es **aditiva**: no reemplaza ninguna función existente (comprobado por texto), no crea triggers, no cambia datos al
aplicarse y no toca ningún flujo. Los permisos se reafirman: solo `authenticated` ejecuta las dos funciones públicas.

## Límite deliberado: solo es un registro

**Ningún flujo lo lee todavía.** Anotar un datáfono o una impresora no conecta, no configura y no activa nada: no
cambia cómo se imprime un ticket, cómo se cobra con tarjeta ni cómo se abre el cajón. Integrar un equipo concreto
(D04: «no se compra ni se integra nada») exigiría su propia pieza y su propia autorización.

La referencia es texto libre: **no debe contener contraseñas ni claves** (queda en la descripción de la tabla). No hay
ningún campo secreto.

## Efecto en la pantalla actual

Ninguno. No hay pantalla de equipos (pieza 6). Hasta entonces se anotan solo por la función del servidor.

## Decisiones y límites

1. **Solo por local**, igual que el resto de la capa: no hay un registro a nivel de empresa que valga para todos sus
   locales. Es una limitación conocida de la capa entera.
2. **Un terminal inactivo no se puede asociar** (ni mantener al actualizar otros datos del equipo): primero se quita el
   vínculo. Si Pedro prefiere que se conserve un vínculo ya existente con un terminal que luego se apagó, se cambia aquí.
3. **No hay límite de equipos por local.** Si hiciera falta uno, es un cambio pequeño.
4. **Los equipos no se pueden cambiar de local** (se desactiva el de un local y se da de alta otro en el nuevo, con otro
   identificador).
5. Las comprobaciones de datos (tipo, nombre, local activo, terminal activo del mismo local) se hacen **antes** de
   reconocer una repetición. Si una operación ya completada se repite (mismo `operation_id`) después de que su terminal
   o su local se hayan desactivado, la repetición recibe el error de esa comprobación y no el resultado original. Con el
   terminal y el local en su estado normal, la repetición devuelve el resultado original (comprobado). Es un caso raro y
   sin efecto sobre los datos; si Pedro prefiere que una repetición devuelva siempre el original, es un cambio pequeño.
6. No se ha comprobado el efecto en **producción**: la tabla no existe allí.

## Pruebas

| Prueba | Resultado |
|---|---|
| Contrato vivo `tests/cfg/cfg4-contract.sql` **en QA**, con `ROLLBACK` | **72/72** |
| Mismo contrato en una réplica local (cadena de migraciones con PM10, C04 y las piezas 1 a 3, base en UTF‑8 como QA) | **72/72** |
| Contratos vivos de las piezas 1, 2 y 3 con la pieza 4 aplicada (regresión, local) | **102/102**, **201/201** y **79/79** |
| Contratos estáticos de las piezas 1, 2, 3 y 4 | OK (los cuatro) |
| Doble aplicación de la migración | Rechazada por la comprobación previa (`ABC_CFG4_PREFLIGHT_FALLO: objetos de la pieza 4 ya existen`); la primera aplicación dentro de una transacción funciona |
| Mutantes del contrato vivo: 43 averías provocadas (sin tipo inmutable, nombre sensible a mayúsculas en la función y en el índice, terminal de otro local o inactivo, encargado que configura, sin replay, siempre «cambio», eventos mal nombrados, lectura abierta, id reutilizable, versión que no sube, motivo opcional, lista con inactivos o sin orden o sin filtro de local, sin nombre de terminal, sin recortar espacios, tipo en minúsculas rechazado, local inactivo admitido, permisos a `anon`/`service_role`/tabla, RLS apagada, longitudes, evento sin motivo o sin valor anterior, búsqueda sin local, nombre único global, defecto «inactivo»…) | **43/43 detectadas** (5 sobrevivieron al primer contrato; se añadieron las comprobaciones que faltaban y ya se detectan) |
| Mutantes del contrato estático: 40 averías provocadas (sin `lock_timeout`, `search_path`, ACL, RLS, política, `create or replace`, trigger, borrado, otra tabla tocada, función extra, `drop function`, comprobaciones previas debilitadas…) | **40/40 detectadas** (2 sobrevivieron al primer contrato; se endureció) |

Estado de QA comprobado después de aplicar y de las pruebas: tabla con RLS activada, sin políticas, sin triggers y sin
permisos de tabla (solo el dueño); las 2 funciones son SECURITY DEFINER con `search_path` vacío y solo `authenticated`
con EXECUTE; las huellas md5 de las dos funciones en QA coinciden con las de la réplica local donde se probaron;
migración **registrada** en la lista de Supabase (`20261002183425 … pieza4_equipos`); **cero residuos** de las pruebas
(empresas, locales, membresías, terminales, equipos, eventos y operaciones `CFG-*`/`cfg4-*`), sin transacciones
abiertas ni bloqueos; los 2 terminales reales de QA siguen intactos.

## Límites de la verificación

- La réplica local no incluye todas las migraciones posteriores a C04; la ejecución en QA cubre la cadena real. **QA no
  es producción.**
- Sin prueba de carga ni de concurrencia real (el bloqueo por local y el `FOR UPDATE` se comprueban por texto y por
  efecto en una sola transacción, no con dos sesiones a la vez).
- Antes de promocionar: registrar `cfg4-static-contract.mjs` y el contrato vivo en la puerta de CI, y construir la
  pantalla (pieza 6) para que el propietario los gestione.

## Siguiente paso

Pieza 5 (permisos configurables y retirada de roles) o la pantalla (pieza 6); cada una necesita su autorización.
