# F7 · Resultado de la ventana de promoción a producción (primer paquete)

Fecha: 2026-10-04
Estado: `PRIMER_PAQUETE_APLICADO_EN_PRODUCCION_PENDIENTE_PANTALLAS` (migraciones, D12 y aplicación nueva en producción; falta la vista de pantallas por Cowork)
Autorización: la frase de la hoja (`F7_HOJA_AUTORIZACION_UNICA_PRIMER_PAQUETE_2026-10-04.md`, §5), escrita por Pedro el 4/10/2026 con el commit `ff5015c192a1a01bf09b2e53d31d6339dce48e46` y confirmada para las 10:59 (hora de Madrid). Ante cualquier otra diferencia, parar y esperar su decisión.

## 1. Resumen

| Paso | Resultado |
|---|---|
| Copia manual de la ventana (Pedro, CLI) | Hecha, carpeta `ventana-2026-10-04b` (10:34): `roles.sql` 370 B · `schema.sql` 1.047.547 B · `data.sql` 278.836 B. Las diferencias frente al ensayo de las 10:13 fueron solo filas de `auth.*` (sesiones y tokens). Copia de toda la carpeta en el pendrive ANGIE (D:); no se comprobó su contenido. No se probó restaurarla |
| 21 migraciones | **Aplicadas y verificadas una a una** (§2) |
| D12 | **Escrita y verificada** (§3) |
| Humo transaccional con `ROLLBACK` | **64 comprobaciones; ninguna fila residual** (§4) |
| Aplicación nueva | **Publicada** el 4/10/2026 por la fusión del PR 119 (§5) |
| Pantallas (Cowork, solo mirar) | **Pendiente** |
| Marcha atrás de Netlify | **No necesaria** (la aplicación nueva no falló al publicarse); el despliegue anterior sigue siendo `6abf43047ed8030008ffb5a9` |

## 2. Las 21 migraciones

Método por migración: huella md5 del texto registrado (sin retornos de carro) igual a la del archivo; huella normalizada (sin comentarios ni espacios) igual; huella de cada función igual a la del cuerpo del archivo; tablas, disparadores y permisos comprobados. Antes de cada una, su comprobación previa de huellas se ejecutó dentro de la propia migración y no falló.

| # | Archivo | Registro en producción (nombre · versión) | Verificación |
|---|---|---|---|
| 1 | `20260927203000` A08.2 | `abc_f3_a08_2_payment_interlock` · `20261004090608` | texto y funciones iguales |
| 2 | `20260929213000` B04 | `abc_f4_b04_unknown_payment` · `20261004090725` | iguales |
| 3 | `20260929220000` B05 | `abc_f4_b05_mixed_payments` · `20261004090754` | iguales |
| 4 | `20261001140000` C04 | **sin fila** (aplicada a mano) + `abc_f5_c04_close_reopen_formato` · `20261004093123` (correctora) | funciones iguales tras la correctora (§6) |
| 5–12 | C05 a C12 | `abc_f5_c05_document_series` `093206` · `c06_document_types` `093238` · `c07_fiscal_gate` `093315` · `c08_document_retention` `093358` · `c09_document_printing` `093427` · `c10_document_delivery` `093456` · `c11_explainable_reconciliation` `093527` · `c12_close_rehearsal` `093601` | iguales |
| 13 | `20261002190000` pieza 1 | `abc_config_pieza1_dia_cajas` · `20261004093834` | bruta `ee72e43a…`, 7 funciones y tabla |
| 14 | `20261002210000` pieza 2 | **sin fila** (aplicada a mano) + `abc_config_pieza2_correctora_formato` · `20261004094621` (correctora) | 8 funciones iguales tras la correctora (§6) |
| 15 | `20261002220000` pieza 3 | `abc_config_pieza3_modalidades` · `20261004094706` | bruta `8469550e…`, 5 funciones, tabla y disparador |
| 16 | `20261002230000` pieza 4 | `abc_config_pieza4_equipos` · `20261004094750` | bruta `67e87e1f…`, 2 funciones y tabla |
| 17 | `20261002240000` pieza 5 | `abc_config_pieza5_permisos` · `20261004094916` | bruta `694ced58…`, 13 funciones, tabla y disparador; huellas exactas previas (`abc_tiene_capacidad` `130b601f…`, `abc_a10_tiene_capacidad` `99807108…`, `abc_reabrir_cierre_provisional` `d1965829…`) |
| 18 | `20261002250000` pieza 6d | `abc_config_pieza6d_dia_operativo` · `20261004094940` | bruta `3cfc8b4d…`, función, permisos y comentario |
| 19 | `20261003100000` D13 | `abc_config_d13_reembolsos_aprobacion` · `20261004095102` | bruta `9d86df4b…`, 5 funciones, 2 columnas y restricción; 0 filas en `reembolsos` |
| 20 | `20261003120000` A09 eventos | `abc_a09_eventos_descuento_cuenta` · `20261004095122` | bruta `f405f46a…`, función y permisos |
| 21 | `20261003130000` PM07 | `abc_pm07_correccion_numero_catalogo` · `20261004095140` | bruta `deca38e5…`; `'12.5'`→12,5, `'12'`→12 y `'1,5'`→ valor por defecto |

(Las versiones llevan la hora UTC de aplicación: 09:06 a 09:51 UTC = 11:06 a 11:51 en Madrid.)

## 3. D12 (política de descuento del Encargado, 0 %)

- Local productivo: el único activo (`Chocoloyos S.L`, empresa `empresa-546bc85421e87d88`, local `local-eac70cb00c2c67c4`). Los otros tres locales están inactivos y no se tocaron.
- Antes: Encargado 20 % (puede solicitar, aplicar y escalar; no autorizar). Ahora: **0 %**, puede solicitar y escalar al propietario; no aplica ni autoriza por sí mismo; sin cortesía; sin doble aprobación. El Propietario sigue en 100 %.
- Escrita con la función oficial `abc_configurar_descuento_politica`, ejecutada con la identidad del único Propietario de esa empresa (fijada con la configuración de sesión de la transacción, el mismo método que en QA) y la operación `abc.f7.d12.encargado.0pct.20261004`. Queda el evento `DESCUENTO_POLITICA_CONFIGURADA` con antes (20) y después (0), motivo y actor.
- No había autorizaciones de descuento pendientes ni aprobadas que invalidar. No hay ningún Encargado en producción (las tres membresías son «Propietario»).

## 4. Humo con `ROLLBACK`

Un único bloque que terminó con un error forzado (`HUMO_RESULTADO`), de modo que todo se anuló. 64 comprobaciones con la identidad del Propietario, con una identidad ficticia y sin sesión: ajustes de caja (límite 1 a 10, umbral, repetición idempotente), regla del día operativo y día operativo del local, modalidades (incluido «mínimo una»), equipos (duplicado, tipo inmutable, terminal inexistente), permisos (techo, ámbito empresa, rol retirado bloqueado por el disparador), devoluciones (aprobar, solicitar y confirmar inexistentes), diferencia de caja (sin cierre y sobre la sesión real ya cerrada: diferencia 0, sin bloqueos), historial de descuentos y las políticas D12. Todos dieron lo esperado, con dos matices:

- Las pruebas 40 (confirmar reembolso) y 47 (abrir sesión de caja) con un terminal falso fallaron por la clave de `abc_operaciones` hacia terminales, no por el mensaje previsto. La capacidad y los parámetros pasaron; **no se ejercitó** el rechazo `caja_limite_sesiones_alcanzado` ni el camino feliz de cobros y devoluciones, porque producción no tiene cajas, terminales ni pagos. Esas rutas quedan cubiertas por las huellas de función (idénticas al archivo) y por los contratos de CI y de QA.
- No se probó el disparador de modalidades sobre cuentas reales (habría obligado a tocar las 2 cuentas de restos).

**Comprobación de que no queda nada:** recuento y huella md5 de 13 tablas (`abc_operaciones` 29, `abc_eventos` 31, `abc_config_ajustes` 0, `abc_local_modalidades` 0, `abc_local_equipos` 0, `abc_capacidades_rol` 0, `abc_operating_day_reglas` 1, `membresias_usuario` 3, `caja_cierre_diferencias` 0, `reembolsos` 0, `abc_descuento_politicas` 2, `cuentas_comerciales` 2, `caja_sesiones` 1) tomados justo antes y justo después: **idénticos**. Solo quedan huecos en contadores internos, normales tras una anulación.

## 5. Aplicación nueva

- PR 119 marcado como listo y fusionado con el método «merge» y la cabeza esperada `ff5015c`: commit de fusión `bad47053b804513472087a95461661a2b12a3993` en `release` (antes `01f47bf`). Su árbol es `e1a0119e8680386cba9ad97eab9336954b7cb1c4`, idéntico al del candidato.
- Despliegue de producción: `6ac22344948ac900082766ab` (estado `ready`, el actual). Antes: `6abf43047ed8030008ffb5a9`.
- Servido por `chic-entremet-9107cf.netlify.app`: `fuente.js` `88fcf88015b6c85eb75c98080480ffde3da9a80f67688ff1824c7f1dfc07fbe8` (igual al del candidato), `index-storage-bootstrap.js` y `ui-context-bridge.js` iguales a los del repositorio. `index.html` solo difiere en un script `hud` que Netlify inyecta por su cuenta.
- Los registros de Supabase (`postgres_logs`) no se pudieron consultar (error del servicio de registros); no se comprobaron errores de la API tras el despliegue.

## 6. Diferencias respecto a lo previsto (comunicadas a Pedro, ambas con su aprobación)

1. **La herramienta de migraciones rechaza las que contienen `drop`** (tiempo agotado y «cancelled» en C04, tres intentos sin efecto, comprobado después de cada uno). C04 y la pieza 2 las aplicó Pedro a mano, desde el editor SQL, en una consulta nueva. No se esquivó la protección de la herramienta.
2. **El editor SQL (esta vez desde el móvil) añadió espacios de sangría** y las funciones quedaron con texto distinto (una pasó de 3.912 a 124.413 caracteres), aunque iguales tras quitar espacios (comprobado en las ocho de la pieza 2, comentarios incluidos). Pedro aprobó una migración correctora por cada una (`create or replace` con el texto exacto del archivo, sin la palabra `drop`, sin cambios de lógica, datos ni permisos). Quedan en el registro con el sufijo `_formato` o `_correctora_formato`.
3. **Registro de migraciones:** C04 y la pieza 2 no tienen su fila original (se aplicaron fuera de la herramienta); solo tienen las filas de sus correctoras. QA tampoco tiene fila de la pieza 2. **Decisión de Pedro (4/10/2026): dejarlo anotado, sin insertar ninguna fila a mano.**
4. **Corrección a la hoja:** la hoja exigía «13 huellas COINCIDE» antes de empezar, imposible; el estado conocido era 6 `COINCIDE`, 5 `NO EXISTE` y 2 `DISTINTA`, y cada huella se comprobó justo antes de la migración que la necesita.

## 7. Postflight

- **Estructura frente a QA (solo lectura en ambos):** columnas, restricciones, índices, disparadores, seguridad por filas y permisos de 28 tablas. Idénticas en 26. `membresias_usuario` difiere en restricciones, índices, disparadores y permisos (producción tiene `pm12_prod_*`; QA tiene `pm11_membresias_vinculo_guard` y permisos de `service_role` más amplios) y `caja_operaciones` en los permisos de `service_role`. **Ninguna de las 21 migraciones contiene sentencias de política**; son diferencias anteriores entre ambos entornos, ajenas a este paquete. Los dos disparadores de este paquete sobre `membresias_usuario` (`a09_lock_membresia_config` y `abc_f6_cfg5_guard_rol_retirado`) están en producción.
- **Avisos de seguridad de Supabase (producción):** 3 (24 tablas con seguridad por filas y sin política, de acceso solo por funciones; 130 funciones `SECURITY DEFINER` ejecutables por usuarios con sesión, que es el diseño de las funciones ABC; protección contra contraseñas filtradas desactivada, ajuste de Auth). Todos están también en QA (24, 142 y 1). Ninguno señala objetos de este paquete como diferencia; las únicas diferencias de funciones son anteriores y ajenas (`bootstrap_owner_instalacion` solo en producción; PM09/PM11/PM13 y catálogo solo en QA).
- **Fila de caja anterior:** producción conserva una sesión de caja del 28/9 en `CERRADA_FINAL` (1 cierre, sin movimientos); no cuenta para el límite de cajas abiertas.

## 8. Lo que queda

1. **Pantallas de producción, solo mirar (Cowork, decisión 21).** Pendiente; el prompt lo recibe Pedro por separado.
2. **Registro de migraciones:** cerrado; sin las filas originales de C04 y de la pieza 2, por decisión de Pedro (§6.3).
3. Las 2 cuentas, 2 pedidos y la comanda de la prueba A10 del 28/9 siguen como restos conocidos; no se tocó nada.
4. No se abrió caja ni se hizo ninguna venta, cobro o descuento.
5. Siguientes paquetes, cada uno con su autorización: P3/P3b, B06–B10 (antes a QA), PM09.
6. Copia manual: no se ha comprobado que se pueda restaurar; producción sigue sin copias automáticas (plan gratuito).
