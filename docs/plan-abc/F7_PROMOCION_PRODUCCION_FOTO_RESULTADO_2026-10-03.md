# F7 · Foto de solo lectura de producción · resultado

Fecha: 2026-10-03, 11:33 UTC (hora del servidor de producción)
Proyecto: `flqercbgpgmmfaakrwkc` («L&A Suite», Postgres 17.6, `ACTIVE_HEALTHY`, comprobado antes con `get_project`)
Autorización: Pedro autorizó la foto de solo lectura el 3/10/2026 («Autorizo la foto de solo lectura de producción»).
Estado: `FOTO_HECHA_NADA_ESCRITO` — **solo `select`**. No se aplicó ninguna migración, no se escribió ninguna fila, no se tocó ninguna función ni permiso, no se publicó nada. La promoción sigue **sin autorizar**.
Qué se ejecutó: los bloques P0, P1, P2, P3, P5, P6, P7, P8 y P9 de `F7_PROMOCION_PRODUCCION_PREFLIGHT_SOLO_LECTURA_2026-10-03.sql`, **tal cual**; y de P4, solo una **versión estrecha** (huellas md5 de las 46 funciones que se reemplazan, **sin** sus definiciones), más la definición de **dos** funciones (`pm07_numero_catalogo` y `pm07_inicializar_stock_desde_productos_kv`) para entender una diferencia (ver §4). Solo recuentos y huellas; no se leyó contenido de personas ni de clientes. En QA solo se leyeron las huellas de cuatro funciones, en solo lectura.

## 1. Resumen

1. **Producción está al día hasta B02-B03 (29/9) y no tiene nada posterior.** Registra 10 de las 45 migraciones candidatas (A09, A10, A10b, A11, recuperación de cuenta, A07.2, PM07, PM10 ×2 y B02-B03). Faltan **35**. **Ninguna está a medias** (ninguna migración con «algunos objetos»): cada una está entera o ausente.
2. **El registro y los objetos coinciden entre sí.** Lo que el registro dice que está, está; lo que no dice, no existe.
3. **Hay una deriva pequeña y real: las dos funciones de PM07 de producción no son las del repositorio ni las de QA.** Es una versión anterior del mismo archivo; la más importante tiene una barra invertida de menos en una expresión regular (§4). No impide promocionar, pero hay que corregirla con una migración pequeña.
4. **El navegador ya no puede leer en producción** `abc_eventos`, `pago_intentos`, `efectos_pendientes`, `pago_aplicaciones`, `reembolso_aplicaciones`, `reservas_saldo`, `abc_operaciones`, `operaciones_procesadas`, `abc_descuento_politicas` ni `prefiltro_limites`: **la migración m04d está aplicada**. Por tanto, los dos fallos de pantalla que arreglé en QA (cobro y historial de descuentos) **existen también en producción** en cualquier aplicación que tenga esas lecturas directas.
5. **El volumen de datos es muy pequeño** (§3). Ninguna persona tiene un rol retirado; D13 no tiene reembolsos que marcar; PM07 y PM10 ya hicieron sus bootstraps.
6. **El orden de dependencias queda confirmado con datos de producción** (§5).
7. **El paquete A se reduce de 22 a 12 migraciones** y el resto del plan (§6) queda más corto de lo previsto.

## 2. Qué migraciones tiene producción y cuáles faltan

Registradas en producción (marca de producción · nombre): `20260926051548` A09 · `20260926131350` A10 · `20260926134235` A10b · `20260927072741` A11 · `20260927113504` recuperación de cuenta con día operativo · `20260927172341` A07.2 · `20260928203006` PM07 · `20260928204348` PM10 bootstrap · `20260928211206` PM10 cierre de sesión · `20260929062815` B02-B03. Antes de ellas: la cadena F2 (m01…m04d) y F3 hasta A08 (`20260924082637`).

**Faltan en producción (35):**

| Grupo | Migraciones | Nota |
|---|---|---|
| A08.2 | `20260927203000` bloqueo de cuenta con cobro incierto | Ninguno de sus 3 objetos existe |
| B04, B05 | `20260929213000`, `20260929220000` | B05 da `abc_estado_pago_mixto_cuenta`, que **no existe en producción** y que usa la pantalla de cobro corregida |
| B06–B10 | 12 migraciones | Fuera del primer paquete (nunca se aplicaron en QA) |
| C04–C12 | 9 migraciones | C04 trae `abc_reabrir_cierre_provisional` |
| PM09 | `20261001230000` | **Bloqueada** (base de producción sin reconciliar) |
| P3, P3b | 2 | Precio con IVA incluido (D31): fuera hasta confirmar |
| Configuración | pieza 1, 2, 3, 4, 5, 6d, D13, A09 eventos (8) | Ninguno de sus objetos existe |

## 3. Datos de producción (recuentos, P6, P7, P8 y P9)

| Tabla | Filas | Tabla | Filas |
|---|---|---|---|
| `empresas` | 3 | `cuentas_comerciales` | 2 |
| `locales` | 4 | `pagos` | **0** |
| `membresias_usuario` | 3 (**las tres «Propietario», activas**) | `reembolsos` | **0** |
| `almacen_kv` | 6 | `efectos_pendientes` | 1 |
| `stock_ubicacion` | 2 | `abc_eventos` | 30 |
| `catalogo_tpv_productos` | 1 | `caja_sesiones` | 1 |
| `entidades_fiscales` | 1 | `abc_config_ajustes`, `abc_capacidades_rol` | no existen |

- **Estados:** la única sesión de caja está `CERRADA_FINAL`; las **2 cuentas** están `ABIERTA`; el **1 efecto** está `PENDIENTE`; no hay reembolsos.
- **Última actividad:** último evento 28/9/2026 21:28 UTC; última sesión de caja 28/9/2026 20:09 UTC. **Nada desde hace cinco días.**
- **Roles retirados (P7):** **nadie** tiene Churrero/a, Básico o Estándar. La pieza 5 no quita permisos a ninguna persona de producción.
- **D13:** el `update` que marca los reembolsos existentes como aprobados tocaría **0 filas**.
- **PM07 y PM10:** ya aplicadas, no hay datos nuevos que crear.
- **P3:** la interpretación del precio con IVA incluido afectaría a **1 producto** del catálogo.
- **A revisar antes de la ventana:** las 2 cuentas abiertas y el 1 efecto pendiente (no se ha mirado qué son; se pueden mirar con tu permiso, solo lectura).

## 4. Huellas de las funciones (P3 y P4 estrecha)

**P3: 11 funciones que las migraciones exigen conocer exactamente**

| Migración | Función | En producción |
|---|---|---|
| pieza 1 | `abc_abrir_sesion_caja` | **COINCIDE** (`416d085f…`): la pieza 1 se puede aplicar tal cual |
| pieza 2 | `abc_configurar_ajuste`, `abc_obtener_ajustes` | No existen (las crea la pieza 1; comprobado en la réplica que coinciden justo después) |
| pieza 5 | `abc_a10_tiene_capacidad` | **COINCIDE** |
| pieza 5 | `abc_tiene_capacidad` | **DISTINTA** (`62ab0a1b…` en producción; espera `130b601f…`). **No es deriva:** `62ab0a1b…` es exactamente la versión de la cadena en el estado de A08 (comprobado en la réplica) y `130b601f…` es la que deja **B04**, que producción aún no tiene. Tras aplicar B04 coincidirá |
| pieza 5 | `abc_reabrir_cierre_provisional` | No existe (la crea C04) |
| D13 | `abc_solicitar_reembolso`, `abc_confirmar_reembolso_efectivo`, `abc_cancelar_reembolso` | **COINCIDEN** las tres |
| D13 | `abc_cap_catalogo`, `abc_cap_techo_permite` | No existen (las crea la pieza 5) |

**P4 estrecha: de las 46 funciones que se reemplazan, producción tiene 33** (las otras 13 llegan con migraciones que faltan). Comparadas con una réplica local reconstruida con **exactamente las migraciones que producción tiene registradas**:

- **27 coinciden** exactamente (26 con la réplica, 1 —`pm10_numero_catalogo`— con el cuerpo del archivo). Incluye `abc_abrir_cuenta`, `abc_iniciar_cobro`, `abc_resolver_intento`, `abc_confirmar_efectivo`, las de cocina y las de cuentas.
- **2 son distintas: `pm07_numero_catalogo` y `pm07_inicializar_stock_desde_productos_kv`.** La primera, en producción, tiene la expresión regular `'^[0-9]+(.[0-9]+)?$'` y el repositorio y QA tienen `'^[0-9]+(\.[0-9]+)?$'`: **a producción le falta la barra invertida**, de modo que el punto acepta cualquier carácter. La segunda es la misma lógica sin los comentarios y con el bucle escrito en otras líneas (un borrador anterior del mismo archivo). **Efecto posible:** un valor como `1,5` (con coma) en `stock`, `stockPisoVenta` o `stockMinimo` de un producto de la lista pasaría la comprobación y el `::numeric` posterior lanzaría un error al guardar la lista de productos (según el archivo, el disparador `pm07_bootstrap_stock_desde_productos_kv` está sobre `almacen_kv`; no he comprobado el disparador en producción). Con los números normales (`12`, `12.5`) no cambia nada. **No lo he arreglado** (producción no se toca): propongo una migración correctora pequeña, con su contrato, en el paquete A.
- **4 no se pueden comparar localmente** (la base PM09 no está en mi réplica): `pm09_bloquear_operation_id_stock`, `registrar_devolucion_venta_pm09`, `registrar_venta_stock_carrito_pm09`, `revertir_venta_stock_carrito_pm09`. Van con la reconciliación de la base PM09. Es coherente con el informe del 2/10: producción **no** tiene `registrar_venta_stock_pm09` ni `revertir_venta_stock_pm09`.
- Una consecuencia práctica: **las migraciones de producción se aplicaron por un camino que perdió una barra invertida.** Al promocionar, tras **cada** migración hay que comprobar la huella del cuerpo (md5) contra QA, no solo que «se aplicó». Las migraciones que apliqué yo a QA con la herramienta de migraciones coinciden con la réplica (por ejemplo, la de A09 eventos).

## 5. Dependencias confirmadas con producción

`A08.2 → B04 (deja la versión de abc_tiene_capacidad que espera la pieza 5) → B05 → C04 (crea abc_reabrir_cierre_provisional) … C12 → [PM09 reconciliada] → pieza 1 (misma abc_abrir_sesion_caja que espera) → pieza 2 → pieza 3 → pieza 4 → pieza 5 → pieza 6d → D13 (necesita las funciones de capacidades de la pieza 5) → A09 eventos`, y después la aplicación.

## 6. Qué cambia en el plan de promoción

- **Paquete A** (base): de 22 a **12 migraciones**: A08.2, B04, B05 y C04–C12. PM09 solo tras reconciliar. Más una corrección pequeña de PM07.
- **Paquete C** (configuración): 8 migraciones, sin datos de personas ni de reembolsos que migrar.
- **Fuera:** B06–B10 (12), P3 y P3b (2) y PM09 (1, bloqueada).
- **La aplicación nueva necesita B05** en producción (la pantalla de cobro corregida usa `abc_estado_pago_mixto_cuenta`).
- **Ventana:** producción lleva cinco días sin actividad, pero hay 2 cuentas abiertas y 1 efecto pendiente por mirar.
- **Sigue pendiente** (nada de esto lo toca la foto): D12 en el local productivo (política de 0 %), la rama de producción de Netlify, el registro de las 32 pruebas en el manifiesto de CI y el flujo de CI para los contratos SQL.

## 7. Qué NO cubre la foto

- No sé qué versión de la **aplicación** sirve hoy producción; la base de datos no lo dice.
- No miré el contenido de las 2 cuentas abiertas ni del efecto pendiente.
- No comprobé permisos (ACL) de las funciones en producción ni las advertencias de seguridad de Supabase (`get_advisors`); es el bloque de postflight.
- No hay copia de seguridad hecha ni consultada: no se sabe si el proyecto tiene copia diaria o recuperación a un instante.
- La definición completa de las 46 funciones (la copia de seguridad real de P4) **no se ha guardado**; se hará dentro de la ventana, justo antes de aplicar.

## 8. Seguimiento (3/10/2026, después de la foto): la corrección de PM07 está escrita y probada, sin aplicar

Pedro eligió preparar lo que no toca producción. Resultado para la deriva de PM07:

- **Migración nueva** `20261003130000_abc_pm07_correccion_numero_catalogo.sql`: reemplaza **solo** `private.pm07_numero_catalogo` por la versión del archivo de PM07 (con la barra invertida). No toca la otra función de PM07 (solo difiere en comentarios y espacios, no en lógica), ni tablas, ni el disparador, ni permisos. **Se niega a aplicarse** si la función no existe o si su cuerpo no es uno de los dos conocidos: el borrador de producción (`3dcbe27249f1fd2d37c40ea6398d0215`) o el correcto (`7f36af3c791b2d94a2c76aed2ee4a095`, repetición sin efecto). Comprobado que el borrador de producción es **exactamente** el cuerpo correcto sin la barra invertida (mismo md5).
- **Contrato vivo** `tests/cfg/pm07-fix-contract.sql` + `tests/cfg/pm07-fix-run.sh`: crea el borrador de producción, reproduce el defecto (`1,5` lanza 22P02; también `1x5` y `1 5`), aplica la migración, comprueba el cuerpo, el comportamiento (`1,5` → 0 y los números normales igual), las propiedades, los permisos y la repetición, y las dos negativas. **14/14 en la réplica local + 2 negativas; 15/15 en QA con `ROLLBACK`** (la negativa «sin función» no se repitió en QA porque la herramienta cancela las sentencias `drop`; sí está en la réplica). QA después: misma huella, mismos permisos, sin migraciones nuevas.
- **Contrato estático** `tests/cfg/pm07-fix-static-contract.mjs`: el cuerpo es idéntico al de la migración original de PM07 byte a byte, las dos huellas son las reales, la migración solo hace tres cosas y no toca nada más.
- **Averías provocadas:** 13 sobre la migración (sin barra invertida, comprobación previa mal, sin comprobación, no inmutable, otro `search_path`, `SECURITY DEFINER`, sin comprobar existencia, sobrecarga, sin `or replace`, permisos, acepta cualquier cuerpo, cuerpo distinto, valor por defecto distinto): **13/13 detectadas por el contrato vivo y por el estático**; un cambio solo de comentario pasa (no es avería).
- **No se ha aplicado en producción.** Entra en el paquete A (de 12 pasa a 13 migraciones). El archivo de comprobaciones previas (P3) tiene ahora dos filas más para esta función.

> **Actualización (3/10/2026, más tarde):** las 2 cuentas abiertas y el efecto pendiente se miraron después con autorización de Pedro; son restos de la prueba A10 del 28/9. Ver `F7_PROMOCION_PRODUCCION_DECISIONES_2026-10-03.md`, §3 bis.
