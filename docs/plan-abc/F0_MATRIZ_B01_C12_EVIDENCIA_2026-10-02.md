# F0 — matriz de evidencia B01–B12 (cobros) y C01–C12 (caja y documentos)

Fecha: 2026-10-02
SHA de código: `a5a4321` (más documentación de esta rama)
Estado: `MATRIZ_CON_EVIDENCIA_PENDIENTE_DE_DECISIONES_Y_ACEPTACION`

Continúa `F0_MATRIZ_A01_A12_EVIDENCIA_2026-10-02.md` con el mismo método y
sustituye al esqueleto `F0_5_MATRIZ_EJECUCION_A01_C12` de la rama
`codex/f0-inventario-abc` (todo en `PENDIENTE`, con numeración de C antigua). No
es una aceptación: ninguna fila pasa a «verificado» sin recorrido real, entorno,
SHA, usuario y quién acepta. No se estiman costes ni esfuerzo (el plan pide
hacerlo después de F0 y con las decisiones de F1).

## Cómo leer el estado

Taxonomía del plan (§2.5): verificado, incompleto, defectuoso, pendiente,
bloqueado, opcional/no aplicable. `⚠` marca un defecto o riesgo reproducible ya
conocido; no cambia la etiqueta. Etiquetas de evidencia:

- `[MIGR]` migración en el repositorio **y aplicada en QA**, comprobada por
  nombre con `list_migrations` de QA (113 migraciones). No se comparó el
  contenido de cada migración.
- `[REPO]` migración o contrato en el repositorio **no aplicado en QA** (por
  nombre). Código preparado, sin ejecutar contra una base real.
- `[QA]` ejecución del 2/10 en QA, en transacciones con `ROLLBACK` y datos
  ficticios (`F5_ENSAYO_INTEGRAL_QA_2026-10-02.md`).
- `[A12]` `A12_EVIDENCIA_QA_2026-10-02.md` (backend con rollback; no es pantalla).
- `[UI]` el paquete `fuente.js` (y `source-recovery`) llama a esa función del
  servidor. Se comprobó por búsqueda de texto; una ausencia no descarta otra vía.
- `[CI]` contratos estáticos de `tests/f4` y `tests/f5`. Hoy: **37 de 46 `.mjs`
  pasan** (12/12 en F4; 25/34 en F5). Los 9 que fallan son los
  `c04…c12-postgres-contract.mjs` y fallan por entorno (falta el módulo `pg` y un
  PostgreSQL local). Muchos de los que pasan lo hacen con la parte viva
  pendiente (`PASS_WITH_POSTGRES_PENDING`, `PASS_WITH_ADVISORS_PENDING`). Los
  `.sql` no se ejecutaron. Un contrato estático **no** acredita un recorrido.
- `[TRASPASO]` dicho en el traspaso del 2/10, no revalidado hoy. En producción la
  última migración ABC es `abc_f4_b02_b03_checkout_bridge`; no están B04, B05
  ni C04–C12.

## Resumen

| ID | Requisito | Estado | Evidencia clave | Brecha principal |
|---|---|---|---|---|
| B01 | Medios de pago y proveedores | `PENDIENTE` | Sin inventario real ni ficha por medio | Banco, datáfono, modalidad; decisión de proveedor |
| B02 | Estados del pago | `INCOMPLETO` | `[MIGR]` `[QA]` pendiente→confirmado; incierto sigue visible | Notificación antigua, rechazo/cancelación, «declarado» vs verificado |
| B03 | Una identidad por intento | `INCOMPLETO` | `[QA]` identidad, reserva, replay y conflicto de importe `[UI]` | Doble clic, recarga y dos terminales reales |
| B04 | Cobro de resultado desconocido | `INCOMPLETO` | `[QA]` incidencia bloquea saldo; resolver libera `[UI]` | Consulta al proveedor, expiración, concurrencia |
| B05 | Efectivo y pagos mixtos | `INCOMPLETO` | `[QA]` `[A12]` recibido/cambio, mixto parcial `[UI]` | Dos cajas sobre el mismo saldo; caja que recibió cada importe |
| B06 | Propinas, anticipos y fianzas | `INCOMPLETO` | `[REPO]` 4 migraciones sin aplicar | Política de negocio; sin pantalla; sin ensayo |
| B07 | Notificaciones del proveedor | `BLOQUEADO` | `[REPO]` 3 migraciones y una función de borde; `[CI]` simulado | Sin proveedor ni sandbox; nada aplicado en QA |
| B08 | Devoluciones económicas | `INCOMPLETO` ⚠ | `[QA]` límite neto y reservas; `[UI]` solicitar/confirmar | La pantalla aún usa la devolución heredada que repone stock |
| B09 | Liquidaciones y disputas | `BLOQUEADO` | `[REPO]` 2 migraciones; `[CI]` contratos | Sin proveedor ni datos de liquidación; sin pantalla |
| B10 | Datos de tarjeta | `BLOQUEADO` | `[QA]` rechaza evidencia con PAN; `[REPO]` 3 migraciones | Documentación y alcance PCI del adquirente |
| B11 | Pagos sin conexión | `INCOMPLETO` | `[CI]` contrato; decisión: solo online + borradores | Corte de red real; contingencia sin activar |
| B12 | Ensayo de pagos | `BLOQUEADO` | `[CI]` matriz y simulador | Sin sandbox del proveedor |
| C01 | Cajas, terminales y sesiones | `INCOMPLETO` | `[MIGR]` `[QA]` apertura con fondo; `[UI]` abrir | Relevo, vincular terminal y apertura concurrente |
| C02 | Entradas y salidas trazables | `INCOMPLETO` ⚠ | `[MIGR]` funciones ABC | La pantalla usa las funciones heredadas, no las ABC |
| C03 | Arqueo calculado en servidor | `PENDIENTE` ⚠ | Contrato preparado, sin migración | Sin implementar; la pantalla manda el efectivo base |
| C04 | Cierre provisional y definitivo | `INCOMPLETO` ⚠ | `[MIGR]` `[QA]` flujo y bloqueos `[UI]` | Cierra con diferencia sin tratamiento; T14 |
| C05 | Series y numeración | `INCOMPLETO` | `[MIGR]` tablas y funciones; `[CI]` | Sin ensayo, sin emisor, sin pantalla |
| C06 | Tipos de documento | `INCOMPLETO` | `[MIGR]`; `[CI]` | Sin ensayo ni pantalla; clasificación con asesoría |
| C07 | SIF y modalidad fiscal | `BLOQUEADO` | `[MIGR]` puerta que rechaza sin asesoría | Asesoría, emisor y régimen |
| C08 | Conservar y corregir lo emitido | `INCOMPLETO` | `[MIGR]`; `[CI]` | Sin ensayo ni pantalla |
| C09 | Imprimir sin duplicar | `INCOMPLETO` | `[MIGR]`; `[CI]` | Impresora real; sin pantalla |
| C10 | Entrega y copias | `INCOMPLETO` | `[MIGR]`; `[CI]` | Descarga cruzada, caducidad y envío no probados |
| C11 | Conciliación explicable | `INCOMPLETO` ⚠ | `[MIGR]`; `[QA]` el cierre no pudo explicar −11 | Dos circuitos mezclados; sin pantalla ni exportación |
| C12 | Ensayo del cierre | `INCOMPLETO` | `[QA]` apertura→cierre; marcó la diferencia | Noche, restauración, concurrencia; sin pantalla |

Totales B: 0 verificados, 7 incompletos, 1 pendiente, 4 bloqueados.
Totales C: 0 verificados, 10 incompletos, 1 pendiente, 1 bloqueado.
Con A: **36 requisitos, 0 verificados, 28 incompletos, 3 pendientes, 5 bloqueados.**

## Fichas B

### B01 — Medios de pago y proveedores
- **Aceptación (plan):** ficha por medio con capacidades probadas o pendientes y
  decisión de uso; no se promete compatibilidad solo por marca.
- **Evidencia:** ninguna. No hay inventario de medios, banco, modelo de datáfono
  ni contrato en la documentación revisada. Pedro aún no tiene proveedor
  `[TRASPASO]`.
- **Falta:** inventario real, modalidad (independiente o integrado), comparar con
  mantener el terminal actual, revisar API, comisiones y soporte.
- **Decisión de Pedro:** medios necesarios, datáfono y banco, y si la primera
  entrega usa terminal independiente con confirmación declarada (plan §23.2).

### B02 — Estados del pago
- **Aceptación:** un resultado incierto permanece visible y no se interpreta como
  rechazo; una notificación antigua no deshace un cobro confirmado.
- **Evidencia:** `[MIGR]` puente de checkout (B02/B03). `[QA]` intento
  PENDIENTE→CONFIRMADO; un resultado incierto mantiene la incidencia abierta y el
  saldo bloqueado, y su resolución libera la reserva sin tocar el efectivo.
  Tras un reembolso confirmado de 11, el estado de cobro sigue `PAGADO` con
  confirmado 22 (no es neto).
- **Falta:** matriz de estados aprobada (F1.2); rechazo y cancelación; efecto de
  una notificación antigua (depende de B07); marcar en pantalla que un cobro de
  terminal independiente es «declarado» y requiere conciliación.
- **Dependencias:** A05, proveedor elegido, C11.

### B03 — Una identidad por intento
- **Aceptación:** doble clic, recarga y dos terminales no originan otro cargo ni
  otra venta; reutilizar una clave con otro importe da conflicto.
- **Evidencia:** `[QA]` identidad de intento, una reserva activa, replay sin
  duplicar y `operation_id_conflict` con importe distinto. `[UI]` `abc_iniciar_cobro`
  se llama con un borrador de cobro guardado antes de la llamada.
- **Falta:** concurrencia real (la prueba negativa de una segunda caja fue
  secuencial), doble clic y recarga por pantalla, pérdida de respuesta.
- **Dependencias:** X02–X04.

### B04 — Cobro de resultado desconocido
- **Aceptación:** se recupera un cobro efectuado sin volver a cargarlo; una
  autorización caducada o cancelación confirmada libera el saldo de forma
  controlada.
- **Evidencia:** `[MIGR]` B04. `[QA]` incidencia ABIERTA mantiene el saldo
  bloqueado; resolución CONFIRMADO libera la reserva y confirma el pago. `[UI]`
  abrir, listar y resolver incidencias. `[CI]` contrato de interfaz.
- **Falta:** consulta por referencia al proveedor (no hay proveedor), caducidad y
  cancelación confirmada, resolución con responsable y evidencia desde pantalla,
  dos usuarios resolviendo a la vez.

### B05 — Efectivo y pagos mixtos
- **Aceptación:** los pagos netos y el saldo explican el total; el cambio no es
  ingreso; el pendiente no se vuelve negativo por una carrera.
- **Evidencia:** `[QA]` efectivo recibido 25, cambio 3, caja +22. `[A12]` efectivo 8
  (recibido 10, cambio 2) más tarjeta reservada 14: cuenta parcialmente pagada.
  `[UI]` confirmar efectivo y estado del pago mixto. `[CI]` contrato de interfaz.
- **Falta:** dos cajas cobrando el mismo saldo con conexiones simultáneas (T08);
  que se conserve qué caja recibió cada importe (depende de C01); recorrido por
  pantalla.

### B06 — Propinas, anticipos y fianzas
- **Aceptación:** un anticipo aplicado no se cobra ni se cuenta como ingreso dos
  veces; una propina o fianza no incrementa el precio vendido.
- **Evidencia:** `[REPO]` cuatro migraciones (recibos que no son venta,
  trazabilidad y saldo de anticipos, catálogo de políticas). No están en QA. La
  pantalla no llama a `abc_registrar_movimiento_anticipo`.
- **Falta:** política de negocio y revisión contable; aplicarlas en QA; ensayo
  de anticipo, consumo parcial, cancelación y devolución; pantalla.
- **Decisión de Pedro:** política de anticipos, propinas y fianzas (hoja de
  decisiones).

### B07 — Notificaciones del proveedor
- **Aceptación:** un evento duplicado no duplica caja y uno ajeno no modifica
  datos; las transiciones conservan el estado confirmado correcto.
- **Evidencia:** `[REPO]` tres migraciones (registro de proveedores, configuración
  de servidor, procesado de eventos) y la función de borde `abc-b07-webhook`; no
  hay migraciones B07 en QA y no se comprobó si la función está desplegada.
  `[CI]` contratos con un proveedor simulado y firma simulada.
- **Falta:** proveedor y sandbox reales; firma real, orden y duplicados contra
  un servicio verdadero. Con terminal independiente es no aplicable solo a esa
  modalidad, no a B completo (plan).
- **Estado:** `BLOQUEADO` por proveedor.

### B08 — Devoluciones económicas
- **Aceptación:** se devuelve como máximo lo cobrado neto; comida consumida no
  vuelve al stock; un reembolso pendiente no aparece confirmado.
- **Evidencia:** `[QA]` reembolso parcial 11 confirmado, 50 sobre 22 y 12 con 11
  reservado rechazados (`saldo_reembolsable_insuficiente`); el reembolso ABC no
  toca el stock. `[UI]` solicitar, confirmar en efectivo y cancelar reembolso.
  `[CI]` contratos del adaptador y de interfaz.
- **⚠ Defecto de integración conocido:** la pantalla conserva la llamada a
  `registrar_devolucion_venta_pm09`, que **repone stock vendible sin condición**
  (8→9 en el ensayo) y escribe en caja sin sesión. No hay forma de indicar comida
  consumida o merma.
- **Falta:** decidir y construir el destino del stock en una devolución (retorno
  vendible, merma o compensación); T10 (concurrencia real) y T11.
- **Dependencias:** C08, I09.

### B09 — Liquidaciones y disputas
- **Aceptación:** cada diferencia queda explicada o como incidencia abierta; un
  abono neto del banco no reduce artificialmente la venta bruta.
- **Evidencia:** `[REPO]` dos migraciones (importar liquidación, resolver disputa,
  vincular línea; exigen `service_role`). No están en QA. `[CI]` contratos.
  Sin pantalla.
- **Falta:** datos reales de liquidación de un adquirente; ensayo con comisión,
  devolución y disputa de ejemplo.
- **Estado:** `BLOQUEADO` por proveedor y por M04–M05 (conciliación bancaria).

### B10 — Datos de tarjeta
- **Aceptación:** las pruebas y la revisión de logs no encuentran datos sensibles;
  proveedor y modalidad tienen obligaciones y responsables documentados.
- **Evidencia:** `[QA]` una evidencia con PAN se rechaza
  (`evidencia_datos_tarjeta_prohibidos`) y la tarjeta simulada no guardó PAN ni
  CVV. `[REPO]` tres migraciones (frontera de datos, modos de captura, puerta de
  revisión PCI) sin aplicar. `[CI]` contrato. La ficha de alta del proveedor es
  una plantilla sin datos.
- **Falta:** revisión de logs y copias, diagrama de datos, alcance PCI con el
  adquirente.
- **Estado:** `BLOQUEADO` por la documentación del adquirente.

### B11 — Pagos sin conexión
- **Aceptación:** la pantalla distingue confirmado, declarado y pendiente;
  perder Internet no crea una confirmación ficticia ni libera un pago incierto.
- **Evidencia:** `[CI]` contrato de la frontera: el primer alcance exige conexión
  para confirmar y solo permite borradores locales identificados; el borrador del
  TPV (A06) tiene caducidad visible. La contingencia del terminal offline está
  descrita y no activada.
- **Falta:** corte de red antes y después de solicitar un cobro (prueba real);
  contingencia operativa revisada con el negocio.
- **Decisión de Pedro:** aceptar el primer alcance solo conectado.

### B12 — Ensayo de pagos
- **Aceptación:** todos los medios activados superan sus pruebas y conciliación;
  un proveedor sin acceso a pruebas figura bloqueado y no verificado.
- **Evidencia:** `[CI]` matriz de ensayo y simulador. No prueba autorización
  bancaria, liquidación ni sandbox.
- **Falta:** sandbox del proveedor; ensayo de expiración, duplicados, devolución
  concurrente; documentar qué se simula y qué se valida contra el servicio real.
- **Estado:** `BLOQUEADO` (`PROVIDER_SANDBOX_PENDING`).

## Fichas C

### C01 — Cajas, terminales y sesiones
- **Aceptación:** cada cobro tiene sesión y responsable; un segundo inicio
  incompatible falla; el relevo conserva quién actuó en cada momento.
- **Evidencia:** `[MIGR]` M04A. `[QA]` apertura con fondo 100 (+100 en el libro);
  abrir cuenta en una sesión cerrada falla (`terminal_sesion_no_operativa`).
  `[UI]` `abc_abrir_sesion_caja`. No llama a vincular terminal, cambiar
  responsable ni cancelar apertura.
- **Falta:** definir caja física, terminal y sesión; si varios dispositivos
  comparten caja; relevo por pantalla; apertura concurrente y local ajeno.
- **Decisión de Pedro:** cajas simultáneas y quién autoriza el relevo.

### C02 — Entradas y salidas trazables
- **Aceptación:** toda variación física se explica y el replay no mueve dinero de
  nuevo; las correcciones conservan original y motivo.
- **Evidencia:** `[MIGR]` M04B (`abc_registrar_movimiento_caja`,
  `abc_revertir_movimiento_caja`). `[QA]` el cobro en efectivo y el reembolso
  generan un solo movimiento y el replay no duplica. La pantalla **no** llama a las
  funciones ABC: usa `registrar_movimiento_caja` y `revertir_movimiento_caja`
  heredadas.
- **⚠ Riesgo:** en el ensayo, la devolución heredada escribió su movimiento con
  `session_id = NULL`; dentro de una sesión ABC el cierre calculó esperado 111
  frente a 100 físico y no pudo explicar −11. No se comprobó si los demás
  movimientos heredados hacen lo mismo.
- **Falta:** una sola vía de movimientos por sesión; categoría, motivo y
  justificante; pruebas de reverso y permisos.

### C03 — Arqueo calculado en servidor
- **Aceptación:** el esperado no cambia por manipular el navegador; cada
  diferencia tiene responsable y tratamiento explícito.
- **Evidencia:** `[CI]` contrato `CONTRATO_C03_PREPARADO_NO_APLICADO`; no hay
  migración de C03. `[UI]` la pantalla llama a `registrar_arqueo_caja` heredada
  con `p_efectivo_base` enviado por el cliente.
- **⚠ Hallazgo `[QA]`:** `abc_finalizar_cierre_sesion_caja` cerró con −11 sin
  motivo ni aprobación, aunque el ensayo C12 la marcó `DIFERENCIA_EFECTIVO`.
- **Falta:** implementar el contrato (esperado = base + entradas − salidas
  confirmadas, un arqueo activo por local y día), conteo por denominaciones, cero,
  sobrante y faltante, y el tratamiento de la diferencia.
- **Decisión de Pedro:** tolerancia y aprobación de diferencias de caja.

### C04 — Cierre provisional y definitivo
- **Aceptación:** no entran movimientos en una sesión cerrada por una carrera; los
  pendientes son visibles; el relevo nocturno conserva su fecha operativa.
- **Evidencia:** `[MIGR]` C04. `[QA]` iniciar→conteo provisional→ensayo→finalizar;
  negativas: cierre directo desde `ABIERTA`, finalizar sin provisional y cierre
  con un cobro pendiente (`PAGOS_PENDIENTES`) rechazados. `[UI]` iniciar,
  confirmar provisional, reabrir y finalizar. `[CI]` contratos (el de PostgreSQL
  falla por entorno).
- **⚠ Falta:** el cierre acepta una diferencia sin tratamiento (ver C03); reabrir
  una sesión `CERRADA_FINAL` responde `cierre_provisional_no_encontrado`, poco
  explícito; cierre simultáneo con cobro (T14); devolución de un día cerrado (T19).

### C05 — Series y numeración documental
- **Aceptación:** dos emisores concurrentes no generan la misma identidad;
  reintentar la misma emisión recupera el documento.
- **Evidencia:** `[MIGR]` C05 (`abc_reservar_numero_documental`,
  `abc_resolver_emision_documental`). `[CI]` contratos de serie y seguridad; el
  de PostgreSQL falla por entorno. El ensayo no ejercitó documentos. Sin pantalla.
  Producción no tiene estas tablas.
- **Falta:** emisor único elegido; ensayo de concurrencia e interrupción;
  conexión con la pantalla.
- **Decisión de Pedro / asesoría:** emisor y series.

### C06 — Tipos de documento
- **Aceptación:** la persona usuaria sabe qué documento entrega y el sistema pide
  solo los datos exigibles; cambiar de modalidad mantiene los vínculos.
- **Evidencia:** `[MIGR]` C06 (`abc_clasificar_documento`). `[CI]` contratos. Sin
  ensayo ni pantalla.
- **Falta:** ejemplos con asesoría para simplificada, completa y rectificativa;
  petición posterior de factura completa sin duplicar la venta.

### C07 — SIF y modalidad fiscal
- **Aceptación:** el recorrido fiscal elegido tiene validación técnica y de
  asesoría; no se afirma certificación por tener un QR o una API.
- **Evidencia:** `[MIGR]` C07: la puerta rechaza la activación con el motivo
  `c07_activacion_requiere_validacion_asesoria`. No es un emisor fiscal real.
  La decisión F1.4 está `PENDIENTE_ASESORIA`.
- **Falta:** asesoría, territorio, régimen, emisor propio o integrado, formatos y
  pruebas oficiales. Según el plan (fuente AEAT citada, a revalidar al iniciar
  el área fiscal), los plazos de adaptación son antes del 1/1/2027 para
  Sociedades y del 1/7/2027 para el resto.
- **Estado:** `BLOQUEADO` por asesoría y emisor.

### C08 — Conservar y corregir lo emitido
- **Aceptación:** una factura emitida no se altera silenciosamente; la corrección
  tiene identidad propia y el saldo sigue explicable.
- **Evidencia:** `[MIGR]` C08. `[CI]` contratos. Sin ensayo ni pantalla.
- **Falta:** ensayo con cambio de precio posterior y rectificativa; descarga
  autorizada; conservación y acceso con asesoría.

### C09 — Imprimir sin duplicar la venta
- **Aceptación:** repetir la impresión da una copia del documento correcto y
  ninguna venta, pago o consumo adicional.
- **Evidencia:** `[MIGR]` C09. `[CI]` contratos. Sin ensayo ni pantalla.
- **Falta:** impresora real apagada tras un cobro confirmado (T17) y
  recuperación de la copia; matriz de equipos V.

### C10 — Entrega y copias
- **Aceptación:** solo accede quien corresponde; una entrega fallida se recupera;
  las copias mantienen el mismo contenido.
- **Evidencia:** `[MIGR]` C10. `[CI]` contratos. Sin ensayo ni pantalla.
- **Falta:** descarga cruzada, enlace caducado, reimpresión y envío de prueba
  autorizado; política de datos personales mínimos.

### C11 — Conciliación explicable
- **Aceptación:** cada total lleva a sus movimientos y cada diferencia tiene causa
  o incidencia; el cierre coincide con lo esperado.
- **Evidencia:** `[MIGR]` C11 (`abc_generar_conciliacion_documental`). `[CI]`
  contratos. Sin pantalla ni exportación. `[QA]` el cierre no pudo explicar −11
  porque se mezclaron los circuitos ABC y heredado.
- **⚠ Falta:** una sola autoridad de movimientos (C02); ligar pagos, anticipos,
  devoluciones, comisiones y liquidaciones (B06, B09); exportación para la
  asesoría.

### C12 — Ensayo del cierre
- **Aceptación:** el conjunto reconcilia, los casos negativos bloquean cuando
  deben y la recuperación conserva los hechos externos confirmados.
- **Evidencia:** `[QA]` apertura, venta, cobro en efectivo y con tarjeta simulada,
  reembolso, incidencia, cierre y ensayo C12, con negativas (arriba, B y C04).
  `abc_ensayar_cierre_sesion_caja` no se llama desde la pantalla.
- **Falta:** pago incierto en el cierre, emisión concurrente, impresora caída,
  rectificación, sesión nocturna, restauración (T23); acta con versión y
  limitaciones.

## Bloqueos que afectan a varias filas

1. **Dos circuitos de caja en la pantalla.** Cobro, reembolso, incidencias y cierre
   usan funciones ABC, pero movimientos de caja, arqueo y devolución usan las
   heredadas. Explica el −11 sin causa y afecta a B08, C02, C03, C04, C11 y C12.
2. **Stock sin conectar** al circuito ABC y devolución que repone sin condición
   (B08, A10, T11).
3. **Código preparado y no aplicado:** B06, B07, B09 y B10 están en el repositorio
   pero no en QA (por nombre; el contenido no se comparó). C03 ni siquiera tiene
   migración. La función de borde `abc-b07-webhook` no se comprobó en QA.
4. **Documentos sin pantalla:** las diez funciones documentales (C05–C11) y
   `abc_ensayar_cierre_sesion_caja` no se llaman desde `fuente.js` (se traza, no
   se descarta una vía indirecta).
5. **Terceros ausentes:** proveedor y adquirente (B01, B07, B09, B10, B12),
   asesoría y emisor (C05–C07).
6. **QA ≠ producción:** producción solo llega a `abc_f4_b02_b03_checkout_bridge`
   `[TRASPASO]` y tiene deriva en PM09. No se promueve nada sin candidato,
   preflight y autorización específica.
7. **Contratos de PostgreSQL sin ejecutar** (9 `.mjs` y los `.sql`): su parte viva
   sigue pendiente.

## Límites de esta matriz

- No se usó la aplicación como usuario; `[UI]` es búsqueda de texto en el
  paquete. No se comprobó qué medios de pago ofrece la pantalla.
- Se comprobó la presencia de migraciones por nombre; no su contenido ni la
  presencia de funciones en la base de QA en esta revisión.
- Producción no se revalidó (solo `[TRASPASO]`).
- Sin estimaciones de coste ni de esfuerzo. Dependen de las decisiones de F1.
