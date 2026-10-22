# Hoja QA-1 · preparación de la Etapa 2

Fecha: 2026-10-22  
Estado: EN_IMPLEMENTACION_LOCAL; QA_ONLY; PENDIENTE_VALIDACION_QA

## 1. Puerta de entrada y límites

- La Etapa 1 de AUD-009 y AUD-003 está formalmente cerrada en
  F5_AUD009_AUD003_CIERRE_QA_2026-10-21.md.
- La base de trabajo es la rama codex/stage1-aud009-aud003 y el cierre
  documental de la Etapa 1 está en el commit cd786ed.
- La implementación QA que se revisa procede del commit 8f35790.
- El único proyecto remoto inspeccionado en esta preparación fue el QA
  qjqorixtkilwsndqayyx.
- No se ha consultado ni modificado PROD.
- No se han aplicado migraciones, no se han ejecutado escrituras en Supabase,
  no se han creado fixtures y no se han publicado cambios.
- La consulta al esquema y a las rutinas fue de solo lectura. No se leyeron
  contraseñas, tokens ni valores de autenticación.

Esta hoja no autoriza todavía una migración, un cambio de RLS, una modificación
de funciones, una escritura de fixture ni una publicación.

## 2. Alcance de QA-1 según el plan maestro

La Hoja QA-1 reúne los fallos altos de la Etapa 2:

1. AUD-004: producto legado sin empresa que no puede guardarse.
2. AUD-010: notificaciones móviles que no llegan porque la función emisora no
   puede leer las membresías.
3. AUD-006: Encargos con cliente ausente, fecha mostrada como undefined,
   cancelados mezclados con pendientes y acción Entregar en cancelados.
4. Endurecimiento del bloque intermedio de contraseña, contrastado con el
   flujo QA real.

La T1 del TPV puede adelantarse sin tocar servidor, pero no se incorpora a
esta hoja como autorización de cambios remotos.

## 3. Inventario técnico de solo lectura

### 3.1 Objetos QA relevantes

El esquema QA contiene, entre otros, estos objetos relevantes:

- empresas y locales para el contexto de empresa y local.
- membresias_usuario, con user_id, empresa_id, local_id, rol y activo.
- catalogo_tpv_productos y catalogo_tpv_producto_grupos para el catálogo con
  empresa y local.
- encargos_empresa y pagos_encargo para encargos y anticipos.
- suscripciones_push para suscripciones de notificaciones.
- tpv_producto_estaciones y tpv_estaciones_preparacion para rutas de Cocina.

Las tablas QA relevantes localizadas tienen RLS activo. La existencia de RLS no
demuestra por sí sola que la función de notificaciones tenga el SELECT mínimo
que necesita; esa comprobación queda como prueba específica antes de tocar
permisos.

Rutinas públicas relacionadas localizadas en QA:

- abc_productos_guardar_lista y abc_catalogo_guardar_productos.
- registrar_encargo, registrar_pago_encargo y revertir_pago_encargo.
- plataforma_crear_empresa, plataforma_listar_empresas y
  plataforma_mi_estado_password.
- abc_asignar_producto_estacion.

No se localizó una tabla pública llamada notificaciones ni una RPC pública con
nombre de notificación. El envío observado en el programa usa la Edge Function
enviar-notificacion; su código/configuración y sus permisos deben revisarse
como dependencia separada.

## 4. Estado por incidencia y trabajo propuesto

### AUD-004 · producto legado sin empresa

Estado de preparación: PENDIENTE_DE_REPRODUCCION_QA.

Hallazgos actuales:

- index-storage-bootstrap.js separa las filas de almacen_kv por empresa_id y
  bloquea la sincronización de registros sin empresa.
- La ruta de catálogo usa abc_productos_guardar_lista como autoridad
  transaccional.
- ui-context-bridge.js no envía al catálogo los productos que no tienen
  empresa o local y muestra un aviso de contexto incompleto.
- No se ha demostrado todavía cómo debe tratarse un producto histórico que
  exista sin empresa en el fixture QA real.

Cambio propuesto y pendiente de validación QA:

1. Crear o localizar en QA un producto legado ficticio sin empresa_id.
2. Comprobar el error exacto y conservar el registro sin inventar una empresa.
3. Permitir una acción explícita «Anotar la empresa que falta», que complete
   únicamente el vínculo ausente y deje constancia de la operación.
4. Impedir que esa acción cambie la empresa de un producto que ya tiene
   empresa_id.
5. Validar aislamiento por empresa, repetición idempotente y recuperación si
   la RPC rechaza la operación.

No se autoriza un UPDATE directo ni una migración hasta disponer del fixture,
de la regla de autoridad y de un rollback revisado.

### AUD-010 · notificaciones y membresías

Estado de preparación: PENDIENTE_DE_AUDITORIA_DE_EDGE_FUNCTION_Y_GRANTS.

Hallazgos actuales:

- El cliente invoca enviar-notificacion mediante fetch cuando detecta
  caducidades.
- El esquema QA contiene suscripciones_push y membresias_usuario, ambas con
  RLS activo.
- El inventario de rutinas públicas no muestra una RPC de notificaciones.
- Con la consulta de esquema no es posible afirmar todavía si el fallo está
  en SELECT de membresías, en el JWT/contexto de usuario, en el filtrado por
  empresa/local o en la propia Edge Function.

Cambio propuesto, aún no aplicado:

1. Obtener el contrato de entrada/salida de enviar-notificacion sin enviar
   una notificación real.
2. Revisar sus logs QA y su identidad de ejecución.
3. Comprobar el SELECT mínimo sobre membresias_usuario y las tablas de
   suscripciones, manteniendo RLS y el filtro por empresa/local.
4. Si hace falta una función SECURITY DEFINER, limitarla a la lectura
   necesaria, fijar search_path, revocar ejecución pública innecesaria y
   documentar el propietario y las comprobaciones de pertenencia.
5. Probar: usuario con membresía activa recibe el aviso; usuario sin
   membresía no recibe datos; una empresa no puede descubrir membresías de
   otra; reintentar no duplica suscripciones ni avisos persistidos.

No se cambiarán grants ni RLS sin una migración revisada y autorización
específica de QA-1.

### AUD-006 · Encargos

Estado de preparación: CORRECCION_LOCAL_APLICADA; PENDIENTE_VALIDACION_QA.

Hallazgos actuales en el código:

- La lista principal calculada en fuente.js excluye Entregado, Cancelado y
  Devuelto, calcula los días a partir de fechaEntrega y ordena por esos días.
- La tarjeta muestra Sin cliente cuando no se encuentra el cliente y usa
  textoDias, que contempla fecha ausente, hoy, mañana y días futuros.
- La lista entregable presenta el botón Entregar dentro de los pendientes.
- Hay otra lista de pendientes por local que actualmente excluye solo
  Entregado; debe alinearse para no reintroducir cancelados o devueltos en
  resúmenes y avisos del contexto local.

Cambio propuesto y pendiente de validación QA:

1. Unificar la función de pendiente para excluir siempre Cancelado y Devuelto,
   además de Entregado.
2. Normalizar fechas inválidas para que nunca se renderice undefined.
3. Ordenar por fecha/hora de entrega y usar un desempate estable por id.
4. Mantener cancelados y devueltos solo en el historial.
5. Ocultar Entregar en cualquier ruta que pueda recibir una fila cancelada o
   devuelta.
6. Probar empresa/local, cliente inexistente, fecha inválida, cancelado,
   devuelto, entregado y encargo activo.

Avance aplicado en código local el 2026-10-22:

- Se creó el predicado común esEncargoPendientePM14.
- La vista general y la vista del local activo usan ahora el mismo filtro.
- El predicado excluye Entregado, Cancelado y Devuelto.
- Ambas listas ordenan ahora por fecha y hora de entrega, dejando los registros
  sin fecha al final y usando el id como desempate estable.
- No se ha desplegado el cambio a QA ni se ha escrito en Supabase.
- El contrato tests/pm14/p09-aud006-pendientes-contract.mjs pasa.

### Contraseña inicial · bloque intermedio

Estado de preparación: VALIDADO_EN_QA; RETIRADA_FISICA_PENDIENTE.

El documento F5_ETAPA2_ARRANQUE_QA_2026-10-21.md ya registra que:

- la autoridad es plataforma_mi_estado_password más
  supabase.auth.updateUser;
- el primer acceso QA obligó al cambio de contraseña;
- el segundo acceso entró sin repetir el cambio;
- no se copiaron ni compartieron secretos;
- no se localizó la hoja externa y no se borrará por aproximación.

La única tarea abierta es localizar físicamente esa hoja, comprobar que ninguna
cuenta depende de ella y pedir autorización específica antes de eliminarla.
No debe migrarse ninguna contraseña a un fichero nuevo.

## 5. Criterios de aceptación de QA-1

QA-1 podrá considerarse cerrada cuando, en QA y sin PROD:

- AUD-004 complete el vínculo de empresa únicamente cuando falta, sin permitir
  reasignación y sin crear duplicados.
- AUD-010 demuestre lectura mínima y segura de membresías/suscripciones, con
  aislamiento por empresa y sin elevar acceso general.
- AUD-006 muestre únicamente encargos pendientes en la lista principal, ordene
  por fecha válida, muestre cliente/ausencia de cliente de forma determinista
  y reserve cancelados/devueltos para historial.
- El flujo de contraseña conserve el primer cambio obligatorio, el acceso
  posterior y la recuperación documentada sin hoja de secretos.
- Existan contratos automatizados, evidencia manual QA y rollback para cada
  cambio de código o servidor.
- El build de QA y la regresión pasen sin modificar archivos de referencia.

## 6. Autorización y siguiente puerta

Estado actual de la autorización:

- Autorización para inspección de esquema QA: CONSUMIDA; SOLO LECTURA.
- Autorización para editar código: PENDIENTE_DE_CONFIRMACION_EN_QA-1.
- Autorización para migraciones, grants, RLS o funciones QA: PENDIENTE.
- Autorización para PROD: NO_CONCEDIDA.

La siguiente acción segura es revisar esta Hoja QA-1 y autorizar
expresamente la ventana de cambios QA indicando, como mínimo:
«Autorizo QA-1 para AUD-004, AUD-010 y AUD-006; no PROD». Después se creará
una rama de Etapa 2, se prepararán contratos y se aplicarán únicamente los
cambios aprobados en QA, con preflight, pruebas y rollback.

## 7. Registro de comprobaciones realizadas

- Consulta de tablas, columnas, rutinas y RLS del proyecto QA: solo lectura,
  2026-10-22.
- Revisión local de fuente.js, index-storage-bootstrap.js,
  ui-context-bridge.js, plataforma-panel.js y owner-bootstrap-prelock.js:
  solo lectura, 2026-10-22.
- No se ejecutaron escrituras remotas ni migraciones durante la preparación.

