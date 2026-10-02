# F6 · pieza 1 de la capa de configuración: corte del día y límite de cajas

Fecha: 2026-10-02
Alcance: **solo QA** (`qjqorixtkilwsndqayyx`) y repositorio. **Producción no tocada. Pantalla no desplegada ni
modificada.**
Autorización: «Sí, solo en QA y sin desplegar la pantalla» (Pedro, 2/10/2026), sobre el diseño de
`F6_INVENTARIO_CAPA_CONFIGURACION_2026-10-02.md`.
Estado: `PIEZA_1_APLICADA_Y_VERIFICADA_EN_QA_SIN_PANTALLA_D12_PENDIENTE_DE_ELEGIR`

## Qué se hizo

| Decisión | Resultado |
|---|---|
| D06 · corte del día a las 00:00, configurable por local | Función `abc_configurar_dia_operativo`: crea una regla **nueva** (versión siguiente) y cierra la vigente; nunca reescribe el pasado ni borra. Por defecto `Europe/Madrid` y 00:00; corte permitido de 00:00 a 12:00. Rige desde la próxima medianoche local (o la fecha futura que se pida) |
| D03 · 10 cajas abiertas a la vez por local, configurable | Tabla `abc_config_ajustes` (sin acceso directo) y funciones `abc_configurar_ajuste` / `abc_obtener_ajustes`. Ajuste `cajas_abiertas_max`: entero de 1 a 10, **10 por defecto**. `abc_abrir_sesion_caja` rechaza con `caja_limite_sesiones_alcanzado` cuando el local ya tiene ese número de cajas ocupadas |
| Quién configura | Solo el **Propietario de la empresa** (con acceso al local). Encargado, cajero/a, propietario de otra empresa, `anon` y `service_role` no pueden. Leer los ajustes puede cualquier miembro del local |
| Auditoría | Cada cambio real deja un evento (`AJUSTE_CONFIGURADO` o `DIA_OPERATIVO_REGLA_CAMBIADA`) con valor anterior, nuevo, motivo y actor. Repetir un valor no crea versión ni evento. Motivo obligatorio |
| Idempotencia | `operation_id` como en el resto de ABC: el replay devuelve el resultado original y el mismo identificador con otro contenido da `operation_id_conflict` |

Detalles que conviene saber:

- «Caja ocupada» cuenta las mismas cuatro situaciones que el índice «una sesión activa por caja»
  (`PREPARANDO_APERTURA`, `ABIERTA`, `EN_CIERRE`, `CIERRE_PROVISIONAL`).
- **Bajar el límite no cierra cajas ya abiertas**: solo impide abrir nuevas.
- Un cerrojo por local serializa las aperturas, para que dos aperturas simultáneas no superen el límite.
- El error de siempre manda sobre el nuevo: una caja ya ocupada sigue dando `caja_con_sesion_activa`.
- Un local sin regla del día **sigue fallando de forma explícita** (`operating_day_configuracion_ausente`,
  requisito A11); la primera regla de un local se crea con la misma función.
- La migración es aditiva y no toca datos al aplicarse. `abc_abrir_sesion_caja` se reemplaza solo si su texto
  coincide con la versión M04a (comprobado por huella); si no, la migración se detiene.

## Qué NO se hizo

- No hay **pantalla** para configurar: solo funciones del servidor.
- **D12 (descuento del encargado a 0 %)**: no se ha tocado. Hoy sin política escrita el encargado puede hasta
  el 20 % (valor en código y en los contratos A09). Falta elegir entre **(A)** escribir una política explícita
  de 0 % por datos al dar de alta cada empresa/local o **(B)** cambiar el valor por defecto del código y adaptar
  los contratos A09. Recomendación: A ahora, B al promocionar.
- No se han retirado los roles Churrero/a, Básico y Estándar (es de la pieza de permisos; hay que reasignar
  personas y no se ha revisado producción).
- No existe el «propietario de la plataforma» (Pedro configurando cualquier empresa) ni ajustes a nivel de
  empresa (solo por local).
- Nada de esto está en producción ni registrado en el manifiesto de la puerta de CI.

## Cambio de datos en QA

Las reglas de prueba `QA-A1` y `QA-A2` (empresa `QA-EMP-A`) eran de 04:00. Se cambiaron a **00:00** con la propia
función, como Propietario, motivo «D06 (Pedro, 2/10/2026)…»:

| Local | Antes | Ahora |
|---|---|---|
| QA-A1 | v1 · 04:00 | v1 cerrada el 2/10 22:00 UTC · **v2 · 00:00** desde esa hora (medianoche del 3/10 en Madrid) |
| QA-A2 | v1 · 04:00 | igual: **v2 · 00:00** desde la medianoche del 3/10 |

Hasta esa medianoche sigue mandando el 04:00. Las cuentas y pedidos ya creados conservan su día guardado
(`opened_operating_day`, `created_operating_day`…): el cambio solo afecta a lo que se registre después. Quedan
dos eventos de auditoría con el actor propietario.

## Pruebas

| Prueba | Resultado |
|---|---|
| Contrato vivo `tests/cfg/cfg1-contract.sql` en una réplica local (cadena de migraciones hasta A02, funciones reales de membresía) | **102/102** |
| Mismo contrato en QA, con `ROLLBACK`, en cuatro trozos (la herramienta corta a los 60 s): A 29/29, B1 27/27, B2 32/32, B8 15/15 | **todo OK** (103 comprobaciones; B3.1 aparece en dos trozos) |
| Residuos tras las pruebas en QA (empresas, locales, sesiones, ajustes y eventos `CFG-*`, transacciones abiertas) | **0** |
| Contrato estático `tests/cfg/cfg1-static-contract.mjs` | OK |
| Mutantes del contrato vivo (réplica local): 16 cambios deliberados, entre ellos ajuste sin versión y límite que solo cuenta cajas abiertas | **16/16 detectados** |
| Mutantes del contrato estático: 24 cambios deliberados (permisos, `search_path`, ACL, RLS, cerrojo, orden de comprobaciones, valores por defecto, alcance…) | **24/24 detectados** |
| Regresión: el contrato M04a original de apertura de caja con el parche | OK |

Hallazgos durante las pruebas (corregidos):

- La función auxiliar `la_tiene_local` del entorno de CI devuelve NULL en lugar de falso para un usuario sin
  acceso: la migración ya lo trata con `coalesce(…,false)`; sin eso, en CI un propietario de otra empresa podía
  saltarse esa comprobación al **leer** los ajustes. La versión real de QA devuelve falso.
- QA tiene un guarda (C04) que impide pasar una sesión directamente a `CERRADA_FINAL`: el contrato libera cupo
  con `APERTURA_CANCELADA` (estado cerrado) y no fuerza el cierre definitivo.

## Límites de la verificación

- La réplica local **no** incluye las migraciones posteriores a A02 (C04 y siguientes); lo que cubre esa cadena
  completa es la ejecución en QA.
- El contrato en QA se ejecutó en trozos recortados (solo los datos y funciones auxiliares que cada trozo
  necesita); el archivo del repositorio es el completo y se comprobó entero en la réplica local.
- Producción **no** se consultó: puede tener una versión distinta de `abc_abrir_sesion_caja` (la migración se
  detendría por la huella) o de las funciones de membresía.
- No se probó con carga concurrente real; el cerrojo por local se razona, no se midió.
- Antes de promocionar: registrar `cfg1-static-contract.mjs` y el contrato vivo en la puerta de CI, y decidir D12.
- La migración quedó registrada en QA con la marca `20261002164602` (la que asigna la herramienta); el archivo
  del repositorio se llama `20261002190000_abc_config_pieza1_dia_cajas.sql`.

## Cómo se prueba (sin pantalla)

No hay nada que probar desde la pantalla: la prueba es el contrato vivo (SQL con `ROLLBACK`). Para ver el estado
de un local basta `select public.abc_obtener_ajustes('QA-EMP-A','QA-A1')` como Propietario, que devuelve el
límite de cajas efectivo y la regla del día vigente.
