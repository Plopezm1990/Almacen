# PM13 · Punto 5.1 — Matriz real de recursos y acciones

Fecha: 2026-10-17  
Rama: `codex/fix-product-bootstrap-context-20261015`  
Alcance: inventario y clasificación. Este documento no concede permisos ni cambia la autorización efectiva.

## Objetivo

Separar la capacidad de consultar una pantalla de las acciones que pueden ejecutarse dentro de ella. La matriz se ha construido a partir de las RPC presentes en `fuente.js` y en `supabase/migrations`, del catálogo ABC existente y de los contratos PM13. No se ha inferido autorización por el nombre visible del cargo.

## Taxonomía de acciones

| Acción | Significado en esta matriz | Riesgo que debe gobernarse después |
|---|---|---|
| `CONSULTAR` | Ver la pantalla o leer el recurso permitido | Puede exponer datos de otra empresa/local si el alcance falla |
| `CREAR` | Crear una entidad o iniciar una operación | Puede crear obligaciones, stock o historial |
| `EDITAR` | Cambiar datos no terminales | Debe conservar empresa/local y trazabilidad |
| `EXPORTAR` | Sacar datos fuera de la pantalla o generar un fichero/informe | Puede ampliar el alcance de datos; no equivale a consultar |
| `ANULAR_ELIMINAR` | Anular, revertir, desactivar o eliminar lógicamente | Puede afectar dinero, stock, fiscalidad o históricos |
| `APROBAR` | Confirmar una operación pendiente o sensible | Debe separarse de solicitar/crear |
| `CONFIGURAR` | Cambiar reglas, capacidades, modalidades, equipos o parámetros | Puede ampliar permisos o cambiar el comportamiento del local |

## Matriz por recurso

| Recurso o familia | Consultar | Crear | Editar | Exportar | Anular/eliminar | Aprobar | Configurar | Evidencia actual y clasificación de riesgo |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| Personal / empleados | Sí | Sí | Sí | Pendiente de localizar | Baja lógica y reactivación | No separada | Cargo/cuenta aparte | `pm11_alta_empleado`, `pm11_editar_empleado`, `pm11_baja_empleado`, `pm11_reactivar_empleado`. La baja conserva historial; el acceso de cuenta no es un PIN. |
| Fichajes | Sí | Fichaje automático y manual | Corrección | Pendiente | Anulación lógica | No | Periodo/criterio pendiente | `pm13_fichar`, `pm13_fichaje_manual`, `pm13_corregir_fichaje`, `pm13_anular_fichaje`. Tiene efecto histórico/laboral. |
| Ausencias y vacaciones | Sí | Registrar | No separada | Pendiente | Anular | No | Política pendiente de otro punto | `pm13_registrar_ausencia`, `pm13_anular_ausencia`; las ausencias anuladas no se borran físicamente. |
| Cargos personalizados | Listar | Crear | Renombrar/descripción | No | Desactivar/reactivar | No | Pantallas y futuras acciones | `abc_listar_cargos`, `abc_crear_cargo`, `abc_editar_cargo`, `abc_duplicar_cargo`, `abc_desactivar_cargo`, `abc_reactivar_cargo`. Propietario protegido. |
| Asignaciones de cargo | Ver asignaciones | Asignar | No | No | Desasignar | No | No | `abc_asignar_cargo`, `abc_desasignar_cargo`. El alcance es empresa + local + empleado. |
| Pantallas por cargo | Ver catálogo/estado | No | Selección | No | Revocar selección | No | Guardar capacidades de consulta | `abc_listar_cargo_pantallas`, `abc_guardar_cargo_pantallas`. Solo `*_CONSULTAR`; las acciones de este punto aún no están concedidas a cargos personalizados. |
| Productos y catálogo | Sí | Guardar/alta según módulo | Editar lista/datos | Pendiente | Revertir o retirar según operación | No separada | Catálogo/configuración | `abc_catalogo_guardar_productos`, `abc_productos_guardar_lista` y funciones de stock. Cambiar precios o catálogo puede tener impacto comercial. |
| Stock, movimientos y traspasos | Sí | Movimiento/traspaso | Ajuste controlado | Pendiente | Revertir/anular | Confirmación de ajuste cuando aplica | Reglas de stock | `registrar_venta_stock*`, `trasladar_stock_*`, `revertir_venta_stock*`, `pm12_confirmar_ajuste_stock`. Efecto histórico y sobre existencias. |
| Proveedores, pedidos y recepción | Sí | Pedido/recepción | Editar datos antes del cierre | Pendiente | Anular/revertir según estado | No separada | No separada | Las RPC de compras/recepción están repartidas entre módulos; requieren completar el inventario por endpoint antes de asignar capacidades. |
| Albaranes, facturas y pagos | Sí | Documento/pago | Edición limitada por estado | Exportación pendiente de clasificar | Reverso/anulación | Aprobación no debe confundirse con registrar | Configuración fiscal aparte | `registrar_pago_factura`, `revertir_pago_factura` y flujos de documentos. Efecto fiscal/financiero; requiere barreras de estado e histórico. |
| Ventas, cuentas y pedidos | Sí | Abrir cuenta/crear pedido/línea | Cambiar línea o pedido permitido | Pendiente | Cancelar línea/pedido/cuenta | Resolver incidencias/cobro | Modalidades/sala/comanda | RPC ABC de cuentas, pedidos, cobros, cancelaciones y comandas. Efecto financiero y operativo. |
| Cobros, caja y arqueos | Sí | Cobrar, movimiento, arqueo | Corrección controlada | Pendiente | Revertir/anular | Resolver incierto, diferencia o devolución | Abrir/configurar caja | `abc_iniciar_cobro`, `abc_confirmar_efectivo`, `registrar_movimiento_caja`, `revertir_movimiento_caja`, `abc_registrar_arqueo_caja`, `anular_arqueo_caja`, `abc_decidir_diferencia_caja`. Alto riesgo financiero. |
| Devoluciones y reembolsos | Sí | Solicitar devolución/reembolso | No equivale a confirmar | Pendiente | Cancelar/revertir | Aprobar/confirmar reembolso | Política de descuentos/reembolsos | `abc_solicitar_reembolso`, `abc_cancelar_reembolso`, `abc_aprobar_reembolso`, `abc_confirmar_reembolso_efectivo`, además de devoluciones de venta/proveedor. Alto riesgo financiero e histórico. |
| Encargos y pagos de encargos | Sí | Encargo/pago | Cambio según estado | Pendiente | Revertir/devolver | No separada | Modalidad/configuración aparte | `registrar_encargo`, `registrar_pago_encargo`, `revertir_pago_encargo`. Efecto financiero e histórico. |
| Descuentos y cortesías | Sí | Aplicar/solicitar | No | Pendiente | Revertir si el flujo lo permite | Aprobar descuento | Configurar política | `abc_aplicar_descuento_cuenta`, `abc_solicitar_descuento_cuenta`, `abc_aprobar_descuento_cuenta`, `abc_configurar_descuento_politica`. Efecto financiero. |
| Cocina, comandas y producción | Sí | Enviar/iniciar preparación | Cambiar comanda/línea | No identificada | Cancelar línea/merma | Completar/servir/decidir merma | Configurar estación/comanda | Catálogo ABC: `ABC_PEDIDO_ENVIAR`, `ABC_PREPARACION_INICIAR`, `ABC_PREPARACION_COMPLETAR`, `ABC_PEDIDO_SERVIR`, `ABC_LINEA_CANCELAR`, `ABC_COMANDA_MERMA_DECIDIR`. Efecto operativo y, en merma, sobre stock. |
| Configuración de local y permisos | Sí | No | No | No | No | No | Sí | `abc_configurar_dia_operativo`, `abc_configurar_ajuste`, `abc_configurar_modalidad_local`, `abc_configurar_equipo_local`, `abc_configurar_capacidad_rol`. Alto riesgo de configuración y escalada. |
| Empresas, locales y membresías | Sí | Crear/asignar | Reactivar/cambiar | Exportar empresa | Desactivar/eliminar | No separada | Configurar propietario | `plataforma_crear_empresa`, `plataforma_asignar_propietario`, `plataforma_desactivar_empresa`, `plataforma_reactivar_empresa`, `plataforma_exportar_empresa`, `plataforma_eliminar_empresa`. Fuera del permiso ordinario de un cargo de local. |
| Auditoría, diagnósticos, respaldos y errores | Sí | Registrar evento/error/backup | No | Exportación pendiente | No | No | No | `registrar_auditoria` y pantallas de soporte. La consulta debe respetar tenant y no revelar secretos. |

## Catálogo ABC operativo ya existente

El servidor ya contiene 30 capacidades ABC configurables para los roles técnicos `Encargado`, `Cajero/a` y `Camarero/a`, con techo y límites protegidos: cuentas, cobros, caja, reembolsos, pedidos, preparación, sala, mesas y comandas. Ese catálogo pertenece al modelo técnico existente; todavía no demuestra que un cargo personalizado pueda recibir esas capacidades.

## Hallazgos de 5.1

1. La separación `CONSULTAR` frente a acciones operativas es real: el punto 4 persiste únicamente 45 capacidades `ABC_PANTALLA_*_CONSULTAR`.
2. Ya existen acciones de alto impacto (finanzas, fiscalidad, stock, historial y configuración) que no pueden tratarse como simples botones de la interfaz.
3. Existen familias con acción de solicitud y acción de aprobación separadas; no deben fusionarse en un único permiso.
4. Exportaciones e informes no están inventariados de forma suficiente en la fuente actual; quedan marcados como pendientes y no se les asigna permiso por defecto.
5. La matriz no decide todavía el alcance `propio/local/empresa` ni la precedencia entre cargos y excepciones; eso corresponde a 5.2 y 5.3.

## Estado del subpunto

**5.1 — inventario inicial completado, pendiente de revisión/aceptación.** No se han cambiado permisos, tablas, RPC, datos, QA, producción ni despliegues.

Siguiente subpunto, solo con autorización: **5.2 — definir los alcances propio, local asignado y empresa para cada recurso.**
