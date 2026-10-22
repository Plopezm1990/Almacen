# Hoja QA-1 · preparación de la Etapa 2

Fecha: 2026-10-22  
Estado: QA_ONLY; AUD006_CERRADO_FLUJO_NORMAL; AUD004_BLOQUEADO_FIXTURE; QA1_EN_CURSO

## 1. Puerta de entrada y límites

- La Etapa 1 de AUD-009 y AUD-003 está formalmente cerrada en
  F5_AUD009_AUD003_CIERRE_QA_2026-10-21.md.
- La base de trabajo es la rama codex/stage1-aud009-aud003 y el cierre
  documental de la Etapa 1 está en el commit cd786ed.
- La implementación QA que se revisa procede del commit 8f35790.
- El único proyecto remoto inspeccionado en esta preparación fue el QA
  qjqorixtkilwsndqayyx.
- No se ha consultado ni modificado PROD.
- No se han aplicado migraciones ni cambios de RLS, grants o funciones.
- Se han creado únicamente fixtures funcionales de importe cero en QA para
  validar AUD-006, mediante el flujo normal de la aplicación. No se han creado
  ventas reales, cobros ni movimientos de stock.
- El candidato de código QA se publicó en la rama
  codex/stage1-aud009-aud003, commit 167869c, y Netlify confirmó el deploy
  como successful para el preview 172 (deploy 6ada5835fc56cd902c5f8bbb).
- La consulta al esquema y a las rutinas fue de solo lectura. No se leyeron
  contraseñas, tokens ni valores de autenticación.

Esta hoja no autoriza migraciones, cambios de RLS, grants o funciones, ni
ninguna actuación en PROD. La escritura de fixtures QA de importe cero queda
limitada a la validación manual documentada en esta misma hoja.

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

Estado de preparación: FIXTURE_QA_EJECUTADO; REASIGNACION_RECHAZADA; ROLLBACK_LOGICO_PASS; AUD004_CONTROL_QA_PASS.

Hallazgos actuales:

- index-storage-bootstrap.js separa las filas de almacen_kv por empresa_id y
  bloquea la sincronización de registros sin empresa.
- La ruta de catálogo usa abc_productos_guardar_lista como autoridad
  transaccional.
- ui-context-bridge.js no envía al catálogo los productos que no tienen
  empresa o local y muestra un aviso de contexto incompleto.
- No se ha demostrado todavía cómo debe tratarse un producto histórico que
  exista sin empresa en el fixture QA real.

Preflight QA de solo lectura realizado el 2026-10-22:

- `catalogo_tpv_productos` contiene 32 filas y todas tienen `empresa_id` y
  `local_id` no nulos; se distribuyen entre QA Empresa A / Local A1 y Local A2.
- La colección `productos` de `almacen_kv` contiene 32 elementos y no presenta
  ningún elemento sin `empresaId` o `localId`, ni un nombre identificable como
  fixture legacy/AUD-004.
- `abc_catalogo_guardar_productos` omite explícitamente entradas sin contexto
  de empresa o local, y `abc_productos_guardar_lista` exige el contexto de la
  empresa llamante y un local perteneciente a ella.
- No existe por tanto una fila legacy reproducible en el dataset QA actual.
  No se hizo INSERT, UPDATE ni migración directa para fabricarla.

Resultado AUD-004 del preflight: BLOQUEADO por falta de fixture controlado.
La reproducción y cualquier corrección deben comenzar con un fixture QA
revisado, una regla de autoridad y un rollback antes de editar datos o servidor.

Ejecución del fixture controlado (2026-10-22):

- El fixture `QA-AUD004-LEGACY-20261022` se creó mediante la RPC autorizada,
  con `empresaId` ausente en el JSON, `localId=QA-A1` y `activo=false`.
- El recuento de la lista pasó de 32 a 33; QA-EMP-B no lo ve; la repetición
  devolvió `productos_cambiados=0` y dejó un único fixture.
- La pantalla Productos lo mostró como eliminado/inactivo y no vendible.
- La RPC rechazó el borrado físico con
  `abc_productos_borrado_fisico_no_admitido`; la baja lógica compatible se
  aplicó con `activo=false` y `eliminadoEn=2026-10-22`. No se hizo SQL directo.
- Tras la baja lógica, el catálogo TPV devuelve cero coincidencias y la
  pantalla muestra `Ver 1 producto eliminado`.
- La tentativa de reasignación del fixture a `QA-EMP-B` fue rechazada por la
  RPC con `abc_productos_cambio_contexto_no_admitido`. La colección de
  QA-EMP-A siguió en 33 elementos, el fixture conservó `localId=QA-A1`,
  `activo=false` y `eliminadoEn=2026-10-22`, y QA-EMP-B siguió sin verlo.

Resultado AUD-004: PASS de aislamiento, idempotencia, rechazo de reasignación
y rollback lógico. El borrado físico no forma parte del contrato. El control
QA de AUD-004 queda cerrado.

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

Estado de preparación: CIERRE_QA_PASS_FLUJO_NORMAL; EDGE_CASES_BLOQUEADOS.

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
- El cambio se ha desplegado en QA; no se ha escrito en Supabase.
- El contrato tests/pm14/p09-aud006-pendientes-contract.mjs pasa.

Comprobación manual en QA del 2026-10-22, preview 172:

- El contexto abrió correctamente como QA Empresa A, S.L. · Local A1.
- Se crearon mediante la interfaz cinco fixtures de importe 0,00 €, sin
  producto de catálogo, sin cobro y sin movimiento de stock:
  `QA-AUD006-PEND-01`, `QA-AUD006-PEND-02`,
  `QA-AUD006-RETURN-01`, `QA-AUD006-DELIVERED-01` y
  `QA-AUD006-PEND-03` (el primer fixture se canceló y el tercero se devolvió;
  se conservaron dos pendientes y uno entregado).
- La lista principal dejó únicamente los pendientes y los mostró ordenados por
  fecha/hora: 2026-10-25 11:00 antes de 2026-10-28 08:30. No apareció botón
  Entregar para los estados cancelado, devuelto o entregado.
- En esas mismas tarjetas activas, la aplicación mostró «Sin cliente» y
  «En undefined días», aunque la consulta QA confirmó `cliente_id=QA-CLI-A` y
  las fechas de entrega introducidas eran válidas. El historial sí mostró
  «QA Cliente SOLO A» y las referencias correctamente. Esto deja una
  discrepancia de presentación/hidratación pendiente de corregir.
- El contador visible mostró 1 encargo entregado y 2 elementos en el historial
  de cancelados/devueltos. El historial mostró explícitamente los motivos de
  cancelación y devolución.
- La comprobación remota de solo lectura confirmó cinco filas QA con estados
  `Cancelado`, `Pendiente`, `Devuelto`, `Entregado` y `Pendiente`, todas con
  cliente `QA-CLI-A` y total `0.00`.
- Se intentó guardar un encargo sin cliente y sin fecha; la interfaz lo
  rechazó con «Selecciona o crea un cliente.» y no creó ningún registro. Por
  tanto, los casos de ausencia de cliente y fecha ausente quedan BLOQUEADOS
  para una prueba de datos preexistentes: el formulario normal no permite
  fabricarlos y no se hizo una inserción directa.
- Resultado inicial AUD-006: PASS para filtro de estados, ordenación, historial
  y ausencia de acción Entregar en estados no pendientes; se observó un FAIL
  PARCIAL de representación del cliente y del texto de días en tarjetas
  pendientes; BLOQUEADO para validar filas históricas con cliente/fecha
  ausentes.

Corrección aplicada después de la prueba y verificada en el preview QA 172:

- La lista del local activo ahora recibe el mismo enriquecimiento que la lista
  general: calcula `dias`, calcula `total` e hidrata `cliente` desde el
  `clienteId` antes de renderizar las tarjetas.
- Se conserva el predicado común de estados y la ordenación por fecha/hora.
- El cambio se ha aplicado en `fuente.js` y en
  `source-recovery/fuente-recuperado.js`; no modifica Supabase.

Cierre formal de AUD-006 en QA (2026-10-22):

- PASS en el flujo normal: la vista general y la del local muestran solo
  pendientes, ordenan por fecha/hora, hidratan cliente y días correctamente,
  y reservan cancelados/devueltos para el historial.
- PASS de regresión técnica: `node --check` en ambas fuentes, contrato
  `tests/pm14/p09-aud006-pendientes-contract.mjs`, paridad de
  `source-recovery` y build Netlify completados correctamente.
- PASS de recomprobación visual en preview 172: 2 pendientes visibles con
  `QA Cliente SOLO A`, `En 3 días` y `En 6 días`; 1 entregado y 2 elementos
  en historial.
- BLOQUEADO fuera del flujo normal: no se pudieron validar filas
  preexistentes sin cliente o fecha porque el formulario las rechaza y no se
  autorizó una escritura directa para fabricar datos corruptos.

AUD-006 queda cerrado como PASS para el flujo normal de QA. Los casos de datos
ausentes quedan registrados como limitación de fixture y no impiden este cierre.

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
- Autorización para editar código: CONSUMIDA para la corrección AUD-006
  publicada en QA; no se autoriza PROD.
- Autorización para fixtures QA de importe cero: CONSUMIDA en la comprobación
  manual documentada arriba.
- Autorización para migraciones, grants, RLS o funciones QA: PENDIENTE.
- Autorización para PROD: NO_CONCEDIDA.

La siguiente acción segura es continuar con AUD-010, pendiente de auditoría de
Edge Function y grants. AUD-006 ya está cerrado para su flujo normal. AUD-004
queda cerrado en el control QA ejecutado, con borrado físico expresamente fuera
del contrato por diseño.

## 7. Registro de comprobaciones realizadas

- Consulta de tablas, columnas, rutinas y RLS del proyecto QA: solo lectura,
  2026-10-22.
- Revisión local de fuente.js, index-storage-bootstrap.js,
  ui-context-bridge.js, plataforma-panel.js y owner-bootstrap-prelock.js:
  solo lectura, 2026-10-22.
- Publicación del candidato QA cca22bc y comprobación del deploy 172:
  2026-10-22.
- Comprobación manual de Encargos en QA: pantalla sin pendientes y contadores
  entregados/historial a 0; 2026-10-22.
- Se ejecutaron escrituras funcionales en QA para cinco encargos de importe
  cero y cambios de estado asociados (cancelado, devuelto y entregado); no se
  ejecutaron migraciones ni escrituras administrativas directas en Supabase.
- Tras la corrección local: `node --check` sobre las dos fuentes, contrato
  AUD-006, comprobación de paridad de source-recovery y build de publicación
  Netlify: PASS. El nuevo candidato QA ya carga en el preview 172 y la
  comprobación visual posterior confirma el cliente y los días correctamente.
- Preflight AUD-004: consulta de columnas, recuentos, claves QA y definiciones
  de las RPC de catálogo; solo lectura, sin fixture legacy presente y sin
  escrituras directas, 2026-10-22.
- Ejecución AUD-004: creación del fixture por RPC, comprobación visual,
  aislamiento e idempotencia; borrado físico rechazado y rollback lógico
  trazable aplicado por la RPC, 2026-10-22.
- Reasignación contradictoria AUD-004: RPC rechazada con
  `abc_productos_cambio_contexto_no_admitido`, sin cambios en QA-EMP-A y sin
  exposición en QA-EMP-B, 2026-10-22.

Recomprobación visual posterior en QA, preview 172:

- Las tarjetas pendientes muestran `QA Cliente SOLO A`, la fecha y hora de
  entrega y el texto calculado (`En 3 días`, `En 6 días`), sin `undefined`.
- Se conservan los contadores: 2 pendientes, 1 entregado y 2 en historial.
- Resultado de la corrección de representación: PASS.

