# F6 · pieza 6 (primera entrega): pantalla «Configuración» y retoques — resultado

Fecha: 2026-10-02
Autorización: «Pantalla completa y retoques: 6a + 6b + 6c + 6f» (Pedro, 2/10/2026). **Solo QA.** Producción no consultada ni tocada.
Estado: `ENTREGADA_Y_PROBADA_EN_PANTALLA_POR_PEDRO_6A_6B_6C_VERIFICADAS_EN_QA_PRUEBA_5_DE_6F_PENDIENTE`
Plan de partida: `F6_PIEZA6_PANTALLA_INVENTARIO_2026-10-02.md`. Guía de prueba: `F6_PRUEBA_PREVIEW_PANTALLA_CONFIG_2026-10-02.md`.

## Qué se ha hecho

| Sub-pieza | Qué es | Dónde |
|---|---|---|
| **6a** Lectura | Pestaña nueva **«Configuración»** (grupo Sistema) con cuatro secciones: Día y cajas, Modalidades, Equipos y Permisos. Cada una carga los valores actuales del servidor | `ConfiguracionLocal` y sus cuatro hijas, en `fuente.js` y `source-recovery/fuente-recuperado.js` (idénticas) |
| **6b** Ajustes editables | Corte del día y zona horaria; cajas abiertas a la vez (1 a 10); umbral de diferencia de caja; modalidades habilitadas; alta, edición y desactivación de equipos | Mismas funciones del servidor de las piezas 1 a 4 (`abc_configurar_dia_operativo`, `abc_configurar_ajuste`, `abc_configurar_modalidad_local`, `abc_configurar_equipo_local`) |
| **6c** Permisos | Matriz de 31 permisos × Encargado, Cajero/a y Camarero/a; ámbito «solo este local» o «toda la empresa»; candado 🔒 donde el techo no deja dar el permiso; «decidido aquí / en la empresa» y «volver a lo normal»; lista de personas con rol retirado | `abc_obtener_capacidades_rol`, `abc_configurar_capacidad_rol`, `abc_listar_roles_retirados` (pieza 5) |
| **6f** Retoques | (1) El botón «Reabrir cierre provisional» solo se ofrece a quien tiene el permiso real (si no, se explica); (2) Churrero/a, Básico y Estándar ya no salen en la lista de alta de empleados | Pantalla de cierre de caja (`CocinaA10`) y alta de personal |

Cómo se comporta (decisiones tomadas sin preguntar, por seguir el patrón de «Descuentos y cortesías»):

- Solo se ve con perfil **Propietario** y con un **local concreto** elegido; si no, avisa. La pestaña no sale en «modo empleado».
- **Cada guardado exige un motivo** (queda en la auditoría) y lleva un identificador de operación único; reintentar no duplica.
- **La pantalla no lee ni escribe ninguna tabla de configuración**: todo pasa por las funciones del servidor, que son quienes imponen el permiso real. La única lectura directa es la lista de terminales activos del local, para el desplegable de equipos.
- Los errores del servidor se traducen a español (hay 38 mensajes propios); lo desconocido se muestra con el código entre paréntesis.
- Varios cambios de modalidades o permisos se envían de uno en uno; si uno falla, la pantalla dice cuántos ya se guardaron y recarga lo real.
- En el móvil todo va en una columna y la matriz de permisos se desplaza de lado dentro de su caja (la página no se desborda).

## Qué no hace todavía (límites conocidos)

1. **BARRA no se puede deshabilitar desde la pantalla.** Hasta la sub-pieza 6e el TPV abre siempre las cuentas en Barra; si se deshabilitara, abrir cuenta daría `modalidad_no_habilitada:BARRA`. La casilla está bloqueada y lo explica. El servidor sí lo permitiría.
2. **Un cierre de caja con diferencia sigue sin poder finalizarse** (sub-pieza 6d, no autorizada). La pantalla de «Día y cajas» lo avisa junto al umbral.
3. **Devoluciones del cajero (D13)**: sigue sin permiso y no se puede dar (techo Encargado) hasta cambiar el flujo de `abc_solicitar_reembolso`. Ver `F6_PIEZA5_PERMISOS_2026-10-02.md`.
4. ~~No he podido ver la pantalla funcionando contra QA~~ (no tengo credenciales para iniciar sesión en el preview): **la probó Pedro en el preview 118 el 2/10/2026** y yo comprobé en QA lo guardado (sección siguiente).
5. La cadena de reconstrucción exacta del bundle (`CURRENT_RELEASE.patch`) la regenera la integración continua; la puerta «Puerta de CI general» sigue en rojo hasta la promoción, como estaba.

## Pruebas hechas (todas locales; ninguna toca QA ni producción)

| Prueba | Resultado |
|---|---|
| Paridad de la fuente recuperada (`recuperar_candidato.py --check`) | PASS, cuerpo idéntico |
| Contrato estático de pantalla `tests/cfg/cfg6-ui-contract.mjs` (nombres y parámetros exactos de cada llamada contra las firmas de las migraciones; sin acceso a tablas; motivo y `operation_id` en cada cambio; modo empleado; roles retirados; paridad entre los dos archivos) | OK |
| Prueba de ejecución `tests/cfg/cfg6-ui-runtime.mjs` (React real en un navegador simulado; pantalla completa y botón «Reabrir» con el módulo entero de la aplicación) | **68/68** |
| Averías provocadas en la ejecución (50 mutantes) | **49 detectados**; 1 equivalente (`m32`: se quita la comprobación del techo en la función `alternar`, que es redundante porque la casilla ya está desactivada cuando el techo lo impide) |
| Averías provocadas en el contrato estático (41 mutantes) | **41/41 detectados** |
| Pruebas de pantalla ya existentes (A05–A10…) | 125/127 igual que antes del cambio (los 2 fallos ya existían, idénticos en la línea base) |
| Contratos estáticos de las piezas 1 a 5 (`cfg1`…`cfg5`) | OK |
| Captura visual en Chromium con la hoja de estilos real y el tema de la aplicación (escritorio, móvil, claro y oscuro) | Sin errores de consola y sin desborde horizontal; revisadas a ojo |

## Prueba en pantalla por Pedro y comprobación en QA (2/10/2026, solo lectura)

Pedro probó las pruebas 1 a 4 de `F6_PRUEBA_PREVIEW_PANTALLA_CONFIG_2026-10-02.md` en el preview 118 (Local A1, QA) y después deshizo
sus cambios desde la propia pantalla. Comprobado en QA (tablas de configuración, `abc_eventos` y registro de llamadas de la API):

| Prueba | Qué consta en QA |
|---|---|
| Lectura de las cuatro secciones | Una lectura de cada una (`abc_obtener_ajustes`, `abc_obtener_modalidades_local`, `abc_listar_equipos_local` + terminales, `abc_obtener_capacidades_rol`) entre las 19:48:29 y las 19:49:00 UTC; tras cada guardado la pantalla recargó lo real |
| 1 · Cajas | 19:50:51: `cajas_abiertas_max` = 4 en QA-A1, motivo «prueba de pantalla», versión 1, evento `AJUSTE_CONFIGURADO` (anterior: sin valor propio). Vuelta: 19:56:55, 10 (versión 2, anterior 4) |
| 2 · Modalidades | 19:51:19: TERRAZA deshabilitada (versión 1, 0 cuentas abiertas afectadas, evento `MODALIDAD_LOCAL_CONFIGURADA`). Vuelta: 19:56:34, habilitada (versión 2) |
| 3 · Equipos | 19:52:30: alta de un Datáfono (`EQUIPO_LOCAL_REGISTRADO`, versión 1); 19:52:43: desactivado (`EQUIPO_LOCAL_ACTUALIZADO`, versión 2). Se deja desactivado: los equipos no se borran |
| 4 · Permisos | 19:53:34: Cajero/a · `ABC_PEDIDO_CANCELAR` = sí en el local (`CAPACIDAD_ROL_CONFIGURADA`, efectivo antes: no, después: sí). Vuelta con «volver a lo normal»: 19:55:46, decisión vacía (versión 2, efectivo después: no). «Ver quién tiene un rol retirado»: llamada a `abc_listar_roles_retirados` a las 19:54:33, respuesta correcta |

- **Cinco guardados de ida y tres de vuelta, ocho eventos de auditoría con el usuario de Pedro**, todos con respuesta correcta; ninguna petición
  fallida a QA en el periodo. Cada guardado dejó exactamente un evento (una llamada, un evento).
- **El comportamiento volvió al de antes, pero el estado no es idéntico**: nada se borra por diseño, así que quedan filas con historial
  (cajas «fijado en este local» = 10, Terraza «decidida en este local» = habilitada, permiso con decisión vacía, equipo de prueba desactivado).
- **Pedro vio el aviso rojo «Abre o recupera primero un pedido real para resolver el día operativo del servidor»** al pulsar «Iniciar cierre» en
  Cocina A10. **No es de la pantalla nueva**: es el comportamiento previo del cierre de caja (A10/F5, `contextoA10`): el día operativo se toma
  de la última cuenta abierta en el TPV *en ese mismo navegador* (clave de almacenamiento local) y en una ventana privada no hay ninguna.
- **Efecto de la prueba en QA que queda**: la sesión de caja de QA-A1 abierta a las 19:47:43 (fondo 0 €, por Pedro desde Cocina A10) sigue
  **ABIERTA**; no hay inicio de cierre.

### Pendiente de esa prueba (Prueba 5 de la guía, retoques 6f)

- El botón «Reabrir cierre provisional» no se ha visto en pantalla: hace falta un cierre provisional, y el cierre de Cocina A10 exige antes una
  cuenta abierta en el mismo navegador. Solo está cubierto por las pruebas automáticas (C1 a C10 de `cfg6-ui-runtime.mjs`).
- La lista de puestos del alta de empleados (sin Churrero/a, Básico ni Estándar) tampoco se ha visto en pantalla: no deja huella en el servidor.
- **Decisión de Pedro (2/10/2026): anotar la limitación y seguir** (no abrir una cuenta de prueba en el TPV para cerrar la caja).

### Limitación para la 6d (cierre con diferencia)

El cierre de caja depende de un contexto guardado en el navegador (la última cuenta del TPV) para saber el día operativo. Es frágil: no funciona
en una ventana privada ni en otro equipo. La 6d debería obtener el día operativo del servidor (por ejemplo, de la propia sesión de caja) en vez
de exigir una cuenta reciente en ese navegador. **Plan y hallazgos ampliados** (incluido que, por lectura del código, los pasos posteriores a «Iniciar cierre»
buscan la sesión en estado ABIERTA y fallarían): `F6_PIEZA6D_CIERRE_DIFERENCIA_PLAN_2026-10-02.md`.

## Efectos y avisos

- **Preview 118 (solo QA)**: este `push` lo reconstruye. Es el único tipo de despliegue reconocido como QA.
- **Nada cambia en producción**: no se ha tocado, y su base de datos no se ha consultado.
- No hay migraciones nuevas en esta entrega: usa las funciones ya aplicadas en QA (piezas 1 a 5).
- Quien no sea Propietario no ve la pantalla; quien lo sea y cambie algo, lo cambia de verdad en QA (con auditoría). Para dejarlo como estaba hay que deshacerlo desde la propia pantalla (la guía lo indica).

## Antes de producción (no autorizado; solo para que conste)

- Revisar quién tiene Churrero/a, Básico o Estándar en producción (perderían permisos) y la huella de las funciones de permisos (la migración se niega a aplicarse si no coincide).
- Adaptar los contratos históricos A05–A08 citados en `F6_PIEZA5_PERMISOS_2026-10-02.md` y registrar los contratos nuevos (`cfg1`…`cfg6`) en la puerta de CI.
- Terminar 6d y 6e: con ellas la pantalla puede dejar de bloquear Barra y los cierres con diferencia.
