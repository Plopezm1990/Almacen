# D01 — auditoría: funciones que NO pasan por el blindaje de la contraseña inicial

Fecha: 16/10/2026. Entorno auditado: QA (`qjqorixtkilwsndqayyx`), solo lectura (consultas a `pg_proc`/`pg_proc.proacl`, nada escrito). Pendiente desde la hoja de autorización del blindaje (§7, punto 4).

## 1. Qué se comprobó y cómo

El blindaje (D01, decisión 3) añade el bloqueo dentro de cuatro sitios: `private.abc_tiene_capacidad`, `private.plataforma_kv_permitido`, `private.plataforma_mov_permitido` y las políticas de `suscripciones_push`. Esta auditoría listó **todas** las funciones de `public` que no son de solo-lectura (`provolatile <> 'i'`) y comprobó, sobre el texto real de cada una en QA, si su cuerpo menciona alguno de esos cuatro sitios (o las funciones nuevas del blindaje). Es una comprobación automática y objetiva: no interpreta intención, solo si el texto está o no está.

**Resultado:** 123 funciones no inmutables. 68 pasan por algún filtro del blindaje (directa o indirectamente). **55 no pasan por ninguno.**

De esas 55, varias son inofensivas por diseño (no necesitan el filtro) y se explican en el punto 2. El resto — un grupo real y significativo — queda listado y priorizado en el punto 3.

## 2. De las 55, las que NO son un problema

- **No se pueden llamar desde fuera (sin permiso `EXECUTE` para `authenticated` ni `anon`):** `abc_b07_procesar_evento`, `abc_b09_importar_liquidacion`, `abc_b09_resolver_disputa`, `abc_b09_vincular_linea`, `abc_b07_obtener_configuracion`. Son puntos de integración de pasarelas de pago (webhooks/servicio), no algo que una cuenta de usuario pueda invocar. Verificado con `has_function_privilege`.
- **Hacen falta para arrancar el programa, incluso ANTES de poder mostrar la pantalla «Elige tu contraseña»:** `obtener_estado_instalacion`, `obtener_contexto_instalacion_ui`, `guardar_contexto_instalacion_ui`, `obtener_generacion_instalacion`, `obtener_contexto_operativo`, `plataforma_estado`, `plataforma_mi_estado_password` (la propia función del blindaje), `qa_ping`, `p2_server_authority_capabilities`. Bloquear esto rompería el arranque para todo el mundo, incluida la propia pantalla de cambio de contraseña.
- **Pruebas internas de QA, no alcanzables en producción real:** `abc_qa_cancelar_pago_cierre`, `abc_qa_compensar_efecto_cierre`, `abc_qa_confirmar_pago_simulado`, `abc_qa_listar_pendientes_cierre`.

Ninguna de estas necesita cambio.

## 3. Las que sí son un hueco real, priorizadas

Todas estas **se pueden llamar con una sesión autenticada corriente** (comprobado con `has_function_privilege('authenticated', …, 'execute') = true`) y tienen su **propio** control de acceso (rol, pertenencia a la empresa/local…) — no están abiertas a cualquiera — pero ese control **no mira si la cuenta todavía tiene pendiente el cambio de la contraseña inicial**. Es decir: un dueño nuevo, antes de cambiar su contraseña, no puede tocar el TPV ni las colecciones de la Plataforma (eso ya está blindado), pero **si conociera estas funciones** podría seguir usándolas con normalidad.

**Prioridad alta — mueven dinero o stock de verdad:**
`registrar_venta_stock`, `registrar_venta_stock_carrito`, `registrar_venta_stock_pm09`, `registrar_venta_stock_carrito_pm09`, `revertir_venta_stock`, `revertir_venta_stock_carrito`, `revertir_venta_stock_pm09`, `revertir_venta_stock_carrito_pm09`, `registrar_movimiento_caja`, `revertir_movimiento_caja`, `registrar_arqueo_caja`, `anular_arqueo_caja`, `registrar_pago_factura`, `revertir_pago_factura`, `registrar_pago_encargo`, `revertir_pago_encargo`, `registrar_encargo`, `registrar_devolucion_venta`, `registrar_devolucion_venta_pm09`, `registrar_devolucion_proveedor`, `trasladar_stock_entre_locales`, `trasladar_stock_interno`.

**Prioridad alta — cambian la configuración de permisos/capacidades, no solo datos:**
`abc_configurar_capacidad_rol` (qué puede hacer cada rol), `abc_configurar_modalidad_local`, `abc_configurar_dia_operativo`, `abc_configurar_equipo_local`, `abc_configurar_ajuste`, `abc_configurar_descuento_politica`, `abc_configurar_modalidad_fiscal` (esta última sí pasa el filtro — revisar si por descuido o a propósito).

**Media — aprobación de descuentos (dinero, pero con un paso de aprobación de por medio):**
`abc_aplicar_descuento_cuenta`, `abc_aprobar_descuento_cuenta`.

**Media — personal y fichajes (datos sensibles de personas, no dinero directo):**
`pm11_alta_empleado`, `pm11_baja_empleado`, `pm11_editar_empleado`, `pm11_reactivar_empleado`, `pm11_anonimizar_empleado`, `pm11_vincular_cuenta_empleado`, `pm11_desvincular_cuenta_empleado`, `pm11_migrar_empleados_legacy`, `pm11_crear_prefiltro_candidato`, `pm11_eliminar_prefiltro_candidato`, `pm11_estado_cuentas_empleados`, `pm11_preparar_cuenta_empleado`, `pm11_finalizar_creacion_cuenta_empleado`, `pm13_fichar`, `pm13_fichaje_manual`, `pm13_corregir_fichaje`, `pm13_anular_fichaje`, `pm13_registrar_ausencia`, `pm13_anular_ausencia`.

**Media — conteos e inventario:**
`pm12_cerrar_conteo`, `pm12_cancelar_conteo_stock`, `pm12_confirmar_ajuste_stock`, `pm12_listar_cierres`.

**Baja — cocina/preparación (KDS), probablemente autenticadas por terminal/estación y no por la sesión del dueño; necesita revisarse aparte antes de decidir si aplica el mismo blindaje:**
`abc_abandonar_efecto`, `abc_completar_efecto`, `abc_reclamar_efectos`, `abc_reclamar_efectos_cocina`, `abc_registrar_error_efecto`, `abc_reprogramar_efecto`, `abc_confirmar_entrega_comanda`, `abc_confirmar_linea_pedido_configurada`, `abc_agregar_linea_pedido_configurada`, `abc_actualizar_linea_pedido_configurada`, `abc_iniciar_preparacion_linea`, `abc_marcar_linea_preparada`, `abc_servir_linea`, `abc_enviar_cambio_comanda`, `abc_asignar_producto_estacion`, `abc_crear_estacion_preparacion`, `abc_actualizar_estacion_preparacion`, `abc_listar_comandas_estacion`, `abc_reimprimir_comanda`, `abc_resolver_merma_comanda_linea`.

**Aparte, revisar:** `abc_catalogo_guardar_productos` y `abc_productos_guardar_lista` (tocan precios del catálogo) y `abc_obtener_modalidades_local`/`abc_obtener_ajustes`/`abc_listar_*`/`abc_obtener_capacidades_rol` (lecturas de configuración — menor riesgo, pero informan a quien no debería operar todavía).

## 4. Lo que esto NO es

Esta auditoría **no** implica que D01 tenga un fallo: el diseño original (decisión 3) acotó el alcance a lo que pasa por los filtros compartidos, y lo dijo explícitamente («strict blocking: todo lo que pase por los filtros comunes»), dejando el resto para esta auditoría de seguimiento. El hueco es real pero **preexistente**, de antes de D01, y de un tamaño que no cabe en un solo paso: son dos sistemas de permisos distintos (ABC/Plataforma, ya blindado, y el «almacén» clásico — Personal, Fichajes, Conteos, Stock/Caja — con su propio control, sin blindar).

## 5. Propuesta (a decidir)

No se ha tocado ningún código ni ninguna migración en esta auditoría. Opciones, de menor a mayor alcance:
1. Dejarlo documentado y aceptar el riesgo por ahora (el camino de venta principal, TPV/ABC, ya está cubierto).
2. Blindar solo la lista de «prioridad alta» (dinero/stock + configuración de permisos) — sigue el mismo patrón de hoy (huella exacta + una línea), pero son ~28 funciones: un trabajo serio, no un parche rápido.
3. Blindar todo lo de prioridad alta y media.
4. Diseñar un filtro compartido para el «almacén» clásico (equivalente a `abc_tiene_capacidad` pero para PM11/12/13 y las funciones de stock/caja), en vez de tocar cada función suelta — más trabajo de diseño, pero más sostenible a largo plazo.
