# Informe de auditoría del TPV · L&A Suite · 25/11/2026

Documentos asociados: [hallazgos](HALLAZGOS_TPV_2026-11-25.md) ·
[matriz de casos](MATRIZ_CASOS_TPV_2026-11-25.csv) ·
[plan de corrección](PLAN_CORRECCION_TPV_2026-11-25.md) ·
[traspaso](TRASPASO_AUDITORIA_TPV_2026-11-25.md) · [evidencias](evidencias/).

## 1. Estado de partida

| Comprobación | Resultado |
|---|---|
| Rama | `rediseno/f0-base-qa`, árbol limpio |
| SHA local = remoto = PR #225 | `aa809c3a265eda1d797b7afdb8ce92d9c1ff483b` |
| PR #225 | Abierto, **borrador**, sin fusionar |
| Deploy Preview | Sirve `fuente.js?v=qa-orbita-home-v15-20261125`, `la-apariencia.css?v=qa-orbita-shell-v90-20261125`, `la-orbita-shell.js?v=qa-orbita-shell-v35-20261125` (las de `aa809c3a`) |
| Backend del preview | `NUBE_URL = https://qjqorixtkilwsndqayyx.supabase.co`, `__modoPruebasQA = true`; no apunta a producción |
| AGENTS.md | No hay en el repositorio; aplica el de la carpeta del proyecto (`sources/` solo lectura) |
| Referencias | Maqueta Órbita propuesta 7 (`LA-Suite-rediseno/dist`, `tpv-01`); propuestas de modo caja en `output/tpv-tres-propuestas-20261125` (A, B y C) |

**Aviso sobre la referencia del modo caja.** El encargo pide no dar por elegida ninguna de
las tres propuestas nuevas. Pero en la sesión del 25/11 el usuario aprobó la propuesta 1
(«doble banda») y está implantada y desplegada (`2d49edef` … `aa809c3a`). Se audita lo
desplegado y la discrepancia queda como decisión pendiente (H-07).

## 2. Método y límites

**Tipos de evidencia.** En vivo (navegador QA), consulta (git, gh, CI), automatizada
(batería y CI), código (fuente y migraciones), previo (actas anteriores, sin repetir).

**Lo que no se pudo hacer, y por qué:**

- **Sin sesión de QA al principio.** El sistema de permisos bloquea leer la contraseña de
  prueba, y el usuario pidió probar sin su intervención. Las primeras pruebas en vivo se
  hicieron con «Trabajar solo en este equipo, sin sincronizar»: sin base de datos, sin rol
  de servidor y sin poder añadir productos. **Después** el usuario inició sesión como
  Propietario (con segundo factor) y se ejecutó el lote L1 (ver más abajo).
- **Lectura del servidor.** Primero se revisaron las 214 migraciones del repositorio. Con
  autorización del usuario («Crea el notebook») se crearon dos notebooks de solo lectura en
  el proyecto QA y se consultaron RLS, políticas, privilegios efectivos, funciones,
  triggers, la guarda de segundo factor y el historial de migraciones
  (`evidencias/servidor-qa-2026-11-25.md`).
- **Escrituras solo con autorización.** Hasta el lote L1 no hubo ningún cobro, envío a
  cocina, movimiento de caja ni de stock. El lote L1 **se ejecutó el 25/11** con la
  autorización del usuario, con cambios respecto del plan original (producto, apertura y
  cierre de caja, 3 reembolsos). Detalle y cifras antes y después en
  `evidencias/lote-L1-ejecucion-2026-11-25.md`. **No se ejecutó** el caso de dos terminales
  (C-04) ni la recarga tras escritura (C-05).
- **Panel del navegador oculto.** El navegador pausa `requestAnimationFrame` y
  `ResizeObserver` en segundo plano. Para medir se sustituyó `requestAnimationFrame` por un
  temporizador y se reinstaló el mismo `la-orbita-shell.js` publicado. Tras cambiar de
  tamaño, el cálculo de filas puede quedar desfasado; en esos casos se usa la medición
  anterior con el panel visible (misma SHA) y se indica.

## 3. Inventario del alcance

Clasificación: **V** existe y verificada (hoy, en vivo) · **E** existe sin verificar hoy
(código o documento previo) · **P** parcial · **A** ausente · **F** fuera de alcance.

| Capacidad | Estado | Dónde |
|---|---|---|
| Venta rápida y Sala / restaurante (selector) | V | VentaRapida, `renderSelectorModoTPV` |
| Modo caja y salida | V | `modoCajaTpv`, `data-tpv-caja` |
| Catálogo, categorías, búsqueda, F2 | V (visual) / E (alta de productos) | `tpv-main`, `inputEscaneoRef` |
| Variantes, modificadores, al peso, sin stock | E | `renderConfiguradorA04`, `abc_*_configurada` |
| Carrito, cantidades, precios, impuestos, redondeo | E | Carrito en `tpv-side`; redondeo a céntimos en cobro (C-01) |
| Guardar F9 y envío a cocina | E | `confirmarCobro`, `abc_crear_pedido`, `abc_enviar_pedido` |
| Mesas, zonas, comensales, responsables, notas | E | `renderSalaA07`, `abc_listar_mapa_sala`, `abc_cambiar_responsable_cuenta` |
| Cuentas abiertas, aparcadas, recuperación | E | `renderCuentasAparcadasA06`, `abc_recuperar_cuenta` |
| Unir cuentas y repartir productos | E | `abc_unir_cuentas`, `abc_consultar_reparto_cuenta`, `abc_mover_cantidad_linea_cuenta` |
| Pase → TPV | E | `la-pase-panel.js`, `mesaDestinoTpv` |
| Cocina y estados de comanda | E | CocinaA10, `abc_listar_comandas_estacion` |
| Cobro F4 y medios (efectivo, tarjeta, mixto, transferencia, otro) | E | `renderCobroF4`, `abc_iniciar_cobro`, `abc_confirmar_efectivo` |
| Bizum | A | matriz `tpv-28` |
| Descuentos y cortesías | E | `abc_aplicar_descuento_cuenta`, `abc_aprobar_descuento_cuenta` |
| Tickets, documentos fiscales, impresión, reimpresión | E | `imprimirTicketVenta`, `abc_c07d_*`, `abc_preparar_ticket_fiscal_qa` (no versionada) |
| Historial de ventas y anulaciones | V (capa) / E (anulación) | `renderHistorialVentas` |
| Reembolsos | E | `abc_solicitar_reembolso`, `abc_aprobar_reembolso`, `abc_confirmar_reembolso_efectivo` |
| Terminales, sesión de caja, fondo, arqueo, cierre | E | `abc_abrir_sesion_caja`, `abc_registrar_arqueo_caja`, `abc_iniciar/finalizar_cierre_sesion_caja` |
| Encargos y anticipos en caja | P | anticipo sí; revertir anticipo sin interfaz (`enc-05`, H-05) |
| Stock y movimientos derivados | E | consumo en venta (previo 21/11); stock negativo solo con aviso (H-15) |
| Clientes y datos fiscales en el cobro | E | `tpv-31`, Clientes |
| Roles, permisos, MFA | E | matriz por rol en documentos previos; en vivo, BLOQUEADO |
| Funciones rápidas del TPV, justificante por correo, pantalla de cliente | A | matriz `tpv-24`, `tpv-32`, `tpv-33` |
| Propina y vale regalo | P | matriz `tpv-29`; `abc_registrar_propina_efectivo` existe y el cliente no la usa |

Del servidor (migraciones): **98 funciones del TPV**, 76 referenciadas por el cliente. Las
22 sin referencia incluyen funciones internas de `service_role` y algunas capacidades sin
interfaz (anticipo, propina en efectivo, liberar o cambiar estado de mesa, cerrar sesión de
caja directa). Ver `evidencias/inventario-rpc-migraciones.txt`.

## 4. Resultados

### Lo que funciona, con evidencia de hoy

- **Modo caja de pantalla fija (en vivo):** sin desplazamiento de página a 1440×900,
  1024×768, 390×844 y 320×640. A 1440, 390 y 320: todos los controles de al menos 44 px,
  todos con nombre accesible, ninguno fuera de la pantalla y nada recortado. En sala aparece
  «Mesas» y tampoco hay desplazamiento.
- **Capas (en vivo):** Ventas del día, ···, Cobro y Terminal se abren a pantalla completa y
  vuelven con «Volver al pedido» y con Esc.
- **Fuera del modo caja** el TPV mantiene su composición de dos columnas y el estilo de las
  tarjetas.
- **Seguridad del despliegue (en vivo):** CSP `script-src 'self'` bloquea `eval`.
- **Pruebas:** batería no DB 336/336 con el árbol limpio; 39 comprobaciones del PR en verde,
  incluidos los contratos PostgreSQL (a06…c12, configuración, cfg-sql).
- **Diseño del servidor (comprobado en QA):** las 29 tablas del TPV tienen RLS activado;
  las del núcleo solo admiten `SELECT` por local y, además, `authenticated` no tiene
  privilegios de escritura sobre ellas; todas las funciones `abc_*` son `SECURITY DEFINER`
  con `search_path` vacío (salvo `abc_preparar_bizum_qa`), y `anon` y `public` no ejecutan
  ninguna; las funciones internas no las ejecuta `authenticated`. La guarda activa en QA
  exige segundo factor a Propietario, Encargado y Cajero/a.
- **Protecciones en el servidor (migraciones):** las 21 funciones críticas revisadas
  (cobro, efectivo, checkout, pedidos, líneas, unir, repartir, descuentos, reembolsos,
  caja, cierre de cuenta, emisión fiscal, anticipo y propina) comprueban permiso, local o
  empresa, `auth.uid()` e idempotencia, y casi todas bloquean filas con `FOR UPDATE` y
  versión esperada (`evidencias/validaciones-servidor-funciones-criticas.txt`). El MFA no
  se comprueba en cada función, sino en la guarda común `private.la_usuario_activo()`.
- **Foco de teclado (en vivo):** visible en todos los controles del modo caja.
- **Cobro robusto (código):** cobro pendiente guardado con identificadores estables antes de
  llamar al servidor, idempotencia por `p_intento_id` y versiones esperadas en el servidor,
  redondeo a céntimos del efectivo, botón Guardar desactivado durante el envío.
- **Previo, sin repetir hoy:** venta → cobro → ticket QA (TPV-42, TPV-43), sala completa
  hasta cuenta cerrada, anulación auditable, reembolso B08 con un único movimiento,
  apertura duplicada de caja rechazada, recuperación de cuenta entre A1 y A2, y denegaciones
  de Camarero/a y de Cajero/a sin MFA.

### Lo que falla, por gravedad

Ningún P0. **P1: H-19 los pendientes del modo local se subieron a la empresa de quien
inició sesión después (incidente de esta auditoría, mitigado por casualidad) y H-24 la
pantalla «Arqueo de caja» mostró un esperado distinto del que calcula el servidor.** P2: H-01 «Cobrar» sin estilo principal,
H-02 el aviso de sincronización lo tapa, H-03 capas sin diálogo y con el foco en el
buscador oculto, **H-04 encargos modificables directamente por cualquier miembro del local
(confirmado en servidor)**, H-05 revertir anticipo sin interfaz, **H-06 14 funciones de QA
sin migración, incluidos simuladores de cobro ejecutables por `authenticated`**, H-07
referencia del modo caja sin decidir y diferencias con la maqueta, H-16 nombres de producto
fuera de su tarjeta en el TPV normal, **H-17 QA no tiene las mismas migraciones que el
repositorio (segundo factor)**, y del lote L1: H-20 productos sin ruta a cocina dejan la
venta rápida a medias, H-21 cancelar un pedido deja la cuenta abierta, H-22 tras enviar no
aparece el cobro, H-23 la venta mixta sin documento fiscal (causa por confirmar), H-27 la
tarjeta simulada y su reembolso no se completan desde la aplicación. P3: H-08 a H-13, H-18,
H-25, H-26 y H-28. Decisión pendiente: H-15.
Descartado tras consultar el servidor: H-14. Detalle en
[hallazgos](HALLAZGOS_TPV_2026-11-25.md).

### Comparación con la maqueta Órbita `tpv-01` (1440×900)

Capturas `evidencias/05-tpv-normal-1440x900.jpg` y
`evidencias/06-maqueta-orbita-tpv01-1440x900.jpg`. Diferencias de estructura (no de datos):

- el programa no tiene la ruta «L&A Suite / Punto de venta» ni el título grande con icono y
  el subtítulo de terminal y sesión;
- la maqueta pone el catálogo en una tarjeta con multiplicadores de cantidad (x1, x2, x3,
  x5) y fotos de producto, y el ticket «Mesa 8» con sus acciones agrupadas;
- el programa añade la tarjeta «Modo de venta» y el aviso del terminal encima del catálogo.

No se comparan los productos, precios ni nombres de ejemplo de la maqueta.

### Resumen de la matriz (77 casos, tras el lote L1)

46 PASS (incluidos los de documento previo y los deducidos del código, con sus reservas) ·
20 FAIL (incluidos los parciales) · 5 NO PROBADO · 4 BLOQUEADO · 1 NO CONCLUYENTE ·
1 NO APLICA. Antes del lote eran 67 casos con 6 BLOQUEADO.

**Resultado del lote L1, en una frase:** el cobro en efectivo, el pago mixto, los dos dobles
clics, el reembolso en efectivo y el cierre de caja funcionan y no duplican nada; fallan
los caminos laterales (productos sin ruta, tarjeta simulada, arqueo diario, mensajes del
cierre).

## 5. Relación con la matriz de pantallas existente

Los IDs `tpv-*`, `caj-*`, `coc-*` y `enc-*` de `ORDEN-PANTALLAS-ORBITA.csv` figuran como
«Pasa» en QA y «Pendiente» en lo visual. Esta auditoría **no** modifica esa matriz ni
convierte sus cierres históricos en evidencia nueva: la columna «ID matriz pantallas» de la
matriz de casos solo los relaciona.

## 6. Comandos ejecutados

| Comando | SHA | Resultado | Límites |
|---|---|---|---|
| `bash tests/ci/ejecutar_bateria_no_db.sh` (con `CFG6_UI_DEPS`, `CFG6E_UI_DEPS`, `CFG_SCOPE_DEPS`) | aa809c3a | 336/336, `BATERIA_NO_DB_COMPLETA` | Sin base de datos; ejecutada tras el último commit |
| `gh pr checks 225` | aa809c3a | 39 pass, 2 skipping | Los contratos PostgreSQL se ejecutan en CI, no en local |
| Medidor visual en el navegador (`evidencias/mediciones-visuales-aa809c3a.json`) | aa809c3a | ver § 4 | Modo local; panel oculto |
| Inventario de migraciones (`evidencias/inventario-rpc-migraciones.txt`) | aa809c3a | ver § 3 | Lo que dicen las migraciones, no el servidor |
| Notebooks de solo lectura en QA (`evidencias/servidor-qa-2026-11-25.md`) | servidor QA | ver § 4 | Usuario de solo lectura; solo se leyó después el código de `abc_qa_confirmar_pago_simulado` |
| Lote L1 en el navegador y consultas SQL de lectura (`evidencias/lote-L1-ejecucion-2026-11-25.md`) | aa809c3a | 77 casos de la matriz | Una sesión, un terminal; la tarjeta simulada se resolvió desde la consola |

No se cambió ningún test para obtener verde.

## 7. Datos de QA creados o modificados

**Datos operativos creados por el lote L1 (autorizado, 25/11):** 3 pedidos, 3 cuentas
comerciales, 2 ventas fiscales y 1 documento fiscal QA, 3 pagos, 3 reembolsos (uno
cancelado), 4 movimientos de caja con neto 0,00 € y una sesión de caja abierta y cerrada
(`14d01b2f-0276-42ac-82cf-0d41bf5828a3`, CERRADA_FINAL). Stock: Agua 50 cl de QA-A1,
almacén 73 → 71; el refresco no cambió. **Quedan:** la cuenta `d9e28655…` abierta sin
líneas activas (H-21) y 2 unidades de agua sin reponer. Cifras antes y después en
`evidencias/lote-L1-ejecucion-2026-11-25.md`.

**Incidente del modo local (H-19):** `historialRespaldos` de QA-EMP-A se reescribió dos veces
con el mismo contenido; `productos` no cambió. Se vaciaron las dos claves locales con
autorización del usuario.

**Cambio de configuración de seguridad en QA (autorizado por el usuario el 25/11):**

- creada `private.mfa_politica` con 12 filas (Propietario obligatorio en cada empresa);
- aplicada la migración `mfa_politica_opcional` del repositorio, registrada como
  `20261125201328`;
- efecto: Encargado y Cajero/a ya no necesitan segundo factor y los Propietarios siguen
  igual.

**Para deshacerlo:** volver a la guarda de `20261110230000_m03_server_aal2_gate` y
eliminar las filas de la política.

**Elementos del proyecto QA creados (autorizados):** dos notebooks de solo lectura,
«Auditoría TPV 25/11 (solo lectura)» (`d74a43f4-c389-45c1-b365-e6a0620d107e`) y
«Auditoría TPV 25/11 · parte 2 (solo lectura)» (`932cd704-cf01-4ee8-9230-20dab2162975`).
Solo contienen SQL de lectura y se pueden borrar cuando ya no hagan falta.
