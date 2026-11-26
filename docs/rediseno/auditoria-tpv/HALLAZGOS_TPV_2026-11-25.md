# Hallazgos · Auditoría del TPV · 25/11/2026

SHA auditada: `aa809c3a265eda1d797b7afdb8ce92d9c1ff483b` (rama `rediseno/f0-base-qa`,
PR #225 en borrador, igual en local, remoto y Deploy Preview).
Entorno: Deploy Preview #225 apuntando a QA `qjqorixtkilwsndqayyx`. Producción no se
tocó. H-01 a H-18 salen de la auditoría sin escrituras operativas; **H-19 a H-28 salen del
lote L1**, **H-29 a H-32 del lote L2** y **H-33 a H-36 de la matriz por rol** **H-37 a H-41 del lote L3** y **H-42 y H-43 del lote L4**, ambos autorizados y ejecutados el 25/11 con
escrituras sintéticas en QA (detalle en `evidencias/lote-L1-ejecucion-2026-11-25.md` y
`evidencias/lote-L2-recarga-desconexion-2026-11-25.md`). Con autorización del usuario se crearon dos
notebooks de solo lectura en el proyecto QA para consultar el servidor
(`evidencias/servidor-qa-2026-11-25.md`).

## Cómo leer este documento

- **Severidad:** P0 pérdida o corrupción de datos, aislamiento roto o cobro duplicado ·
  P1 impide vender, cobrar o cerrar · P2 fricción o error importante con alternativa ·
  P3 mejora visual o de comodidad.
- **Evidencia:** `VIVO` navegador QA en esta auditoría · `CÓDIGO` inspección de código o
  migraciones · `AUTO` prueba automatizada · `PREVIO` documento anterior sin repetir ·
  `DEDUCIDO` inferencia razonada, no reproducida · `SERVIDOR` consulta de solo lectura al
  servidor QA.
- Ningún hallazgo es P0. **H-19, H-24 y H-38 son P1** con la evidencia disponible. Los dos
  terminales (C-04) los hizo el usuario, sin registro; la recarga tras escritura (C-05) se
  probó en el lote L2 sin duplicados.

| ID | Sev. | Título | Evidencia |
|---|---|---|---|
| H-01 | P2 | «Cobrar» del modo caja sin estilo de acción principal | VIVO |
| H-02 | P2 | El aviso de sincronización tapa «Cobrar» en modo caja | VIVO |
| H-03 | P2 | Las capas no son diálogos: el foco se queda en el buscador F2 oculto | VIVO + DEDUCIDO |
| H-04 | P2 | Encargos editables por tabla, sin pasar por funciones de servidor | CÓDIGO + SERVIDOR |
| H-05 | P2 | Revertir anticipo sin interfaz; la función de servidor existe y no se usa | CÓDIGO + matriz |
| H-06 | P2 | 14 funciones de QA sin migración, incluidos simuladores de cobro | CÓDIGO + SERVIDOR |
| H-07 | P2 | El modo caja implantado no coincide con la maqueta Órbita aprobada | VIVO + decisión |
| H-08 | P3 | Contraste insuficiente en la categoría activa | VIVO |
| H-09 | P3 | Categorías con desplazamiento horizontal en lugar de paginación | VIVO |
| H-10 | P3 | En móvil, «Terminal» y «Salir del modo caja» quedan fuera de la vista | VIVO |
| H-11 | P3 | A 320 × 640 solo caben 2 productos por página | VIVO |
| H-12 | P3 | «Cobrar» aparece como acción principal con el ticket vacío | VIVO + CÓDIGO |
| H-13 | P3 | Botón de tema con emoji dentro del modo caja | VIVO |
| H-14 | Descartado | `movimientos_registro`: RLS activado (comprobado en servidor) | SERVIDOR |
| H-15 | Decisión | Venta con stock insuficiente: el cliente solo avisa | CÓDIGO |
| H-16 | P2 | TPV normal: los nombres de producto se salen de su tarjeta | VIVO + CÓDIGO |
| H-17 | P2 | QA no tiene las mismas migraciones que el repositorio (segundo factor) — segundo factor **corregido en QA** el 25/11 | SERVIDOR |
| H-18 | P3 | `pagos_encargo` con privilegios de escritura innecesarios | SERVIDOR |
| H-19 | P1 | Los pendientes del modo local se suben a la primera empresa con sesión | VIVO + SERVIDOR |
| H-20 | P2 | 21 de 22 productos de QA-A1 no se pueden enviar: sin ruta a cocina | VIVO + SERVIDOR |
| H-21 | P2 | Cancelar el pedido deja la cuenta comercial abierta | SERVIDOR |
| H-22 | P2 | En venta rápida, tras guardar y enviar no aparece el cobro | VIVO |
| H-23 | P2 | La venta mixta no emitió documento fiscal (causa por confirmar) | SERVIDOR |
| H-24 | P1 | «Arqueo de caja» mostraba un esperado distinto del servidor | VIVO + SERVIDOR + CÓDIGO |
| H-25 | P3 | El cierre de la sesión de caja está escondido | VIVO |
| H-26 | P3 | Los bloqueos del cierre se muestran con texto genérico | VIVO + SERVIDOR |
| H-27 | P2 | Ni el cobro ni el reembolso con tarjeta simulada se completan desde la aplicación | VIVO + SERVIDOR |
| H-28 | P3 | 85 cuentas abiertas en el local, 83 de días cerrados | VIVO |
| H-29 | P3 | Una recarga a mitad de «Guardar pedido» deja una cuenta sin pedido | VIVO + SERVIDOR |
| H-30 | P3 | Tras recargar hay que volver a abrir las operaciones de cuenta | VIVO |
| H-31 | P3 | Un pendiente de cobro antiguo sigue en el navegador | VIVO + SERVIDOR |
| H-32 | P3 | Sin red, el error se muestra crudo y tarda | VIVO |
| H-33 | P3 | El código lleva fijas direcciones de producción | CÓDIGO |
| H-34 | P3 | «Anular venta» aparece habilitado para quien no tiene permiso | VIVO + SERVIDOR |
| H-35 | P3 | El historial no refleja los reembolsos económicos | VIVO |
| H-36 | P3 | Las cuentas creadas por la aplicación no obligan a cambiar la contraseña inicial | VIVO |
| H-37 | P2 | «Cobrar ahora» falla a medias con la cuenta de Cajero/a | VIVO + SERVIDOR |
| H-38 | P1 | Un cobro del Cajero/a se cierra sin documento fiscal y el cierre no lo detecta | VIVO + SERVIDOR |
| H-39 | P2 | La política de descuento del Encargado no se puede usar | VIVO + SERVIDOR + CÓDIGO |
| H-40 | P3 | El borrador del carrito no pertenece a un usuario | VIVO |
| H-41 | P3 | El Camarero/a no ve las cuentas abiertas y el aviso habla de la caja | VIVO |
| H-42 | P3 | Las cuentas con el pedido cancelado no se pueden retomar y se acumulan | VIVO |
| H-43 | P3 | El descuento no encuentra líneas aptas en una cuenta con un producto recibido por reparto (por confirmar) | VIVO |

---

## H-01 · P2 · «Cobrar» del modo caja sin estilo de acción principal

- **Módulo / ruta:** Servicio → TPV → Modo caja (Órbita) · `la-apariencia.css`, `fuente.js` (VentaRapida).
- **SHA / dispositivo / rol:** aa809c3a · 1440×900, 1024×768, 390×844, 320×640 · modo local (sin rol de servidor).
- **Precondiciones:** modo caja activado, ticket vacío.
- **Pasos:** Servicio → «Modo caja» → mirar la esquina inferior derecha de la banda «Cuenta».
- **Esperado:** botón naranja `#FF4B32`, ancho y de 64 px de alto, única acción destacada.
- **Observado:** texto «Cobrar» sobre fondo de superficie `rgb(32,35,40)`, 44 px de alto
  (`evidencias/mediciones-visuales-aa809c3a.json`, `boton_cobrar_1440`; capturas 01 a 04).
- **Causa confirmada:** la regla existente
  `html[data-la-diseno] #root main[data-la-orbita-module="tpv"] .tpv-side > *`
  (fondo de superficie con `!important`) es más específica que
  `html[data-la-diseno="orbita"][data-tpv-caja="1"] #root .tpv-caja-cobrar`.
  Previsiblemente le pasa lo mismo a «Guardar pedido» (F9) cuando hay líneas: **NO PROBADO**,
  porque en modo local no se pueden añadir productos.
- **Origen:** introducido el 25/11 en `2d49edef` (propuesta 1, doble banda). La comprobación
  en vivo que se hizo tras implantarlo midió desplazamiento y tamaños, pero no el estilo
  del botón, y se dio por bueno sin verlo. Queda corregido aquí el informe anterior.
- **Impacto:** la acción principal no se distingue; incumple «una única acción principal
  destacada por estado».
- **Recomendación:** subir la especificidad de las reglas de `.tpv-caja-cobrar` y de
  `.tpv-side > .la-ui-button` en modo caja (misma técnica que se aplicó a las tarjetas en
  `aa809c3a`) y añadir al contrato una comprobación del **estilo calculado** en el
  navegador, no solo del texto del CSS.

## H-02 · P2 · El aviso de sincronización tapa «Cobrar» en modo caja

- **Módulo:** indicador global «Guardado en este equipo · N sin subir» (`position: fixed`,
  `z-index: 9998`) sobre el modo caja.
- **Dispositivo:** los cuatro tamaños.
- **Observado:** a 1440×900, el aviso ocupa `[1226, 866, 206×27]` y solapa la zona de
  «Cobrar» (`[1115, 831, 300×44]`); se ve en las capturas 01 a 04.
- **Límite:** en modo local el aviso es permanente porque hay cambios sin subir. Con una
  sesión QA normal puede mostrarse solo durante la sincronización: **NO PROBADO**.
- **Impacto:** tapa parte de la acción más usada en el rincón que más se pulsa.
- **Recomendación:** en modo caja, colocar el indicador en la franja superior o reservar
  su hueco fuera de la banda de cobro; criterio: ningún elemento fijo se solapa con
  `.tpv-side` en los cuatro tamaños.

## H-03 · P2 · Las capas no son diálogos: el foco se queda en el buscador F2

- **Módulo:** capas del modo caja (Ventas del día, ···, Cobro, Terminal, Modalidad, Mesas).
- **Observado (VIVO, 1440):** al abrir cualquier capa, `document.activeElement` sigue siendo
  el campo de búsqueda F2, que queda **detrás** de la capa. Las capas no tienen
  `role="dialog"` ni `aria-modal`. Al cerrar, el foco vuelve al buscador, no al botón que
  abrió la capa.
- **REPRODUCIDO en vivo (26/11):** con la capa «Terminal» abierta y el foco en el buscador
  oculto, escribir «Agua 50 cl» y pulsar Intro, como haría un lector de códigos, **añadió el
  producto al ticket** (0 → 1 línea) sin que la capa lo mostrara. Antes se había deducido del
  código (`manejarEnterEscaneo`).
- **Impacto:** lectores de pantalla y teclado pierden el contexto; riesgo de altas
  involuntarias en el ticket con lector de códigos.
- **Recomendación:** convertir la capa en diálogo accesible (rol, `aria-modal`, foco
  inicial en «Volver al pedido», foco atrapado y retorno al botón de origen) e ignorar el
  escaneo mientras haya una capa abierta. Criterio: con una capa abierta, escribir o
  escanear no cambia el ticket; con lector de pantalla se anuncia el título de la capa.

## H-04 · P2 · Encargos editables por tabla, sin pasar por funciones de servidor

- **Evidencia (CÓDIGO, migración `20260908071757_pm14_p02_encar…`):** `encargos_empresa`
  tiene políticas `INSERT` y `UPDATE` condicionadas solo a pertenecer a la empresa y al
  local. El resto de tablas operativas del TPV (cuentas, pedidos, líneas, pagos, checkouts,
  reembolsos, ventas fiscales, comandas) solo tienen políticas `SELECT` y se escriben a
  través de funciones `SECURITY DEFINER`.
- **Confirmado en el servidor QA (SERVIDOR, Q2, R1 y Q7):** `authenticated` tiene
  privilegios `INSERT`, `UPDATE` y `DELETE` sobre `encargos_empresa`; las políticas
  `pm14_encargos_insert` y `pm14_encargos_update` le permiten insertar y modificar dentro de
  su local, y la tabla **no tiene triggers** de validación. `DELETE` lo bloquea RLS porque
  no hay política de borrado. No se ha ejecutado ninguna escritura para demostrarlo.
- **Impacto:** cualquier miembro del local, con su sesión y la clave pública, puede crear
  encargos o cambiar su estado, importes o fechas sin las validaciones de la interfaz ni
  del servidor. Los pagos del encargo (`pagos_encargo`) sí quedan protegidos por RLS.
- **Recomendación:** mover las escrituras de encargos a funciones con validación, como en
  el resto del TPV, y dejar la tabla en solo lectura para `authenticated`.

## H-05 · P2 · Revertir anticipo sin interfaz; función de servidor sin uso

- **Evidencia:** la matriz `ORDEN-PANTALLAS-ORBITA.csv` marca `enc-05 Revertir anticipo`
  como «No construida». En migraciones existe `abc_registrar_movimiento_anticipo`
  (`SECURITY DEFINER`, ejecutable por `authenticated`) y el cliente no la referencia.
  El 15/11 se documentó un `REVERSO` de señal de 1,00 € al cancelar un encargo (PREVIO).
- **Impacto:** devolver un anticipo fuera de la cancelación queda sin camino operativo;
  riesgo de resolverlo con movimientos manuales de caja (doble contabilización).
- **Recomendación:** decidir el flujo (decisión de producto) y, si procede, construir la
  interfaz sobre la función existente, con prueba de no doble contabilización.

## H-06 · P2 · 14 funciones de QA sin migración, incluidos simuladores de cobro

- **Evidencia:** `fuente.js` llama a `abc_preparar_ticket_fiscal_qa`, que no está en
  `supabase/migrations` (excepción conocida del contrato
  `lo-que-el-cliente-llama-existe-en-migraciones` y del `ACTA_CIERRE_REDISENO_2026-11-18`).
- **Ampliado en el servidor QA (SERVIDOR, Q4):** hay **14** funciones `abc_*` en QA sin
  ninguna migración en el repositorio, todas `SECURITY DEFINER` (salvo
  `abc_preparar_bizum_qa`) y ejecutables por `authenticated`:
  - **simuladores de cobro y cierre:** `abc_qa_confirmar_pago_simulado`,
    `abc_qa_compensar_efecto_cierre`, `abc_qa_cancelar_pago_cierre`,
    `abc_qa_listar_pendientes_cierre`;
  - **fiscal y Bizum de QA:** `abc_preparar_ticket_fiscal_qa`, `abc_preparar_bizum_qa`;
  - **vale regalo:** `abc_emitir_vale_regalo`, `abc_consultar_vale_regalo`,
    `abc_confirmar_pago_vale_regalo`;
  - **ticket por correo:** `abc_datos_ticket_correo`, `abc_registrar_ticket_correo_enviado`;
  - **dispositivos simulados:** `abc_simular_apertura_cajon`, `abc_simular_impresion_ticket`;
  - **configuración:** `abc_guardar_tipo_negocio`.

  **Leída después:** `abc_qa_confirmar_pago_simulado` solo acepta QA-EMP-A / QA-A1 y exige
  Propietario (definición leída el 25/11). **El resto sigue sin leer.** Además existe la
  función Edge `qa-card-worker`, sin código en el repositorio ni llamada desde la aplicación
  (H-27).
- **Impacto:** parte del comportamiento de cobro, fiscal y de cierre de QA no se puede
  reproducir ni revisar desde el repositorio. Si un simulador de cobro ejecutable por
  cualquier usuario autenticado llegara a otro entorno, podría dar por pagado lo que no lo
  está. Producción queda fuera del alcance y no se ha comprobado.
- **Recomendación:** volcar estas definiciones al repositorio (migraciones marcadas como
  solo QA o `docs/` con su SQL), revisar sus guardas internas y añadir un contrato que impida
  que existan en producción.

## H-07 · P2 · El modo caja implantado no coincide con la maqueta Órbita aprobada

- **Hechos:** la maqueta Órbita aprobada (`LA-Suite-rediseno/dist`, propuesta 7,
  `tpv-01`) organiza el TPV con el catálogo a la izquierda y el ticket a la derecha. El
  25/11 el usuario aprobó en sesión la **propuesta 1 «doble banda»** de
  `output/tpv-tres-propuestas-20261125` y se implantó en `2d49edef…aa809c3a`. El encargo
  de esta auditoría pide no dar por elegida ninguna de las tres; aquí se audita lo que hay
  desplegado y se deja constancia de la discrepancia.
- **Impacto:** no hay una referencia única para comparar el modo caja; la maqueta y la
  documentación no reflejan lo implantado.
- **Recomendación (decisión de producto):** confirmar o revocar la propuesta 1 como
  referencia del modo caja y, en su caso, añadirla a la maqueta o al documento de
  equivalencias.

## H-08 · P3 · Contraste insuficiente en la categoría activa

- **Observado (VIVO, los cuatro tamaños):** texto blanco de 12 px sobre `#FF4B32` = 3,33:1
  (WCAG AA exige 4,5:1 para texto normal).
- **Recomendación:** texto oscuro sobre el naranja, o aumentar tamaño y peso hasta texto
  grande (≥ 14 px en negrita, que exige 3:1).

## H-09 · P3 · Categorías con desplazamiento horizontal en lugar de paginación

- **Observado (VIVO, 1024×768 y 390×844):** la fila de categorías se desplaza en
  horizontal, con barra de desplazamiento visible a 1024. El requisito del modo caja pide
  categorías paginadas, sin desplazamiento. A 1440 caben todas las categorías de prueba.
- **Recomendación:** flechas o «más categorías» cuando no quepan.

## H-10 · P3 · En móvil, «Terminal» y «Salir del modo caja» quedan fuera de la vista

- **Observado (VIVO, 390 y 320):** la cabecera es una barra que se desliza en horizontal;
  «Terminal», «Salir del modo caja» y el tema quedan a la derecha, sin indicación de que
  hay más.
- **Recomendación:** indicador de continuación o menú «Más» fijo.

## H-11 · P3 · A 320 × 640 solo caben 2 productos por página

- **Observado (VIVO):** 1 fila, 2 productos por página y 10 páginas. Sin desplazamiento
  ni recortes.
- **Recomendación:** tarjetas compactas por debajo de 360 px de ancho o banda de cuenta
  plegable.

## H-12 · P3 · «Cobrar» como acción principal con el ticket vacío

- **Observado:** con el ticket vacío, la acción principal es «Cobrar» y abre la capa de
  cobro con un estado informativo («Venta rápida en curso…»).
- **Recomendación:** con el ticket vacío y sin cuenta pendiente, no destacar ninguna
  acción, o mostrar la acción que corresponda al estado real de la cuenta.

## H-13 · P3 · Botón de tema con emoji dentro del modo caja

- **Observado:** «🌙 Oscuro» en la cabecera del modo caja; Órbita usa iconos de línea y el
  modo caja no necesita el cambio de tema.
- **Recomendación:** sacarlo del modo caja o usar el icono del sistema.

## H-14 · Descartado · `movimientos_registro`: RLS activado

- **Evidencia (CÓDIGO):** la tabla se creó fuera de las migraciones; estas solo añaden
  políticas de `SELECT`, `INSERT` y `DELETE` (borrar exige Propietario activo) y triggers.
- **Comprobado en el servidor QA (SERVIDOR, Q1, Q2 y Q7):** RLS activado, con las tres
  políticas limitadas por `private.plataforma_mov_permitido` y los triggers que completan
  local y empresa. No es un defecto.

## H-15 · Decisión · Venta con stock insuficiente

- **Evidencia (CÓDIGO):** el carrito muestra «Vas a dejar en negativo: …» y no bloquea
  «Guardar pedido». **Comprobado el 25/11 (VIVO + SERVIDOR):** con «Agua 50 cl (QA)», cuyo
  piso de venta es 0, la tarjeta del producto marca «sin stock» pero el ticket **no avisó**
  (el aviso mira el stock total, 73). El servidor aceptó guardar, enviar y cobrar las dos
  ventas y descontó las unidades del **almacén** (73 → 71) sin tocar el piso.
- **Decisión pendiente:** permitir el stock negativo con aviso, exigir autorización o
  bloquear.

## H-16 · P2 · TPV normal: los nombres de producto se salen de su tarjeta

- **Módulo:** Servicio → TPV (fuera del modo caja) · `columnasRejillaTpv()` y `.tpv-rejilla`.
- **Dispositivo:** 1440×900 · modo local.
- **Observado (VIVO):** 10 de los 20 productos tienen el nombre más ancho que su tarjeta
  (tarjetas de 135 px, contenido de 137 a 247 px, `overflow: visible`); el texto sobrepasa
  el borde o se pisa con la tarjeta vecina (captura 05).
- **Causa (CÓDIGO):** el número de columnas se decide con el ancho de la **ventana**
  (5 columnas desde 1280 px; el propio comentario del código lo advierte), pero en Órbita la
  zona de productos es mucho más estrecha porque comparte espacio con el lateral y con la
  columna del ticket.
- **Impacto:** nombres ilegibles o solapados en el TPV que usan todos los roles.
- **Recomendación:** calcular las columnas por el ancho real del contenedor (y mantener la
  paginación coherente con ese cálculo) y cortar el nombre en dos líneas con puntos
  suspensivos. *Aceptación:* ningún nombre sobrepasa su tarjeta a 1440, 1024 y 390.

## H-17 · P2 · QA no tiene las mismas migraciones que el repositorio (segundo factor)

- **Evidencia (CÓDIGO):** la migración `20261115120000_mfa_politica_opcional` sustituye la
  exigencia fija de `aal2` para Propietario, Encargado y Cajero/a por una política en
  `private.mfa_politica`, vacía por defecto, de modo que por defecto no se exigiría a nadie.
- **En el servidor QA (SERVIDOR, Q5, R2, R3 y R5):** `private.mfa_politica` **no existe**;
  la guarda activa `private.la_usuario_activo()` es la del 10/11 (M03), que **exige `aal2`**
  a Propietario, Encargado y Cajero/a; el historial de QA (275 migraciones, la última del
  16/11) contiene `m03_server_aal2_gate` y **no** `mfa_politica_opcional`. Además,
  `20261113090000` y `20261113140000` (apariencia) y `20261120120000` (tarifas por horario)
  no figuran en el historial, aunque sus funciones existen en QA: se aplicaron por otra vía.
- **Consecuencia:** en QA el cobro sigue exigiendo segundo factor a Cajero/a (coherente con
  la evidencia del 15/11). Al aplicar el repositorio en otro entorno cambiaría ese
  comportamiento sin que QA lo haya probado, y el historial de QA no permite saber qué
  versión de cada objeto está desplegada.
- **Decisión del usuario (25/11):** segundo factor obligatorio **solo para Propietario**
  (plan, E6 y D3).
- **Aplicado en QA el 25/11 (autorizado):**
  1. `private.mfa_politica` creada con Propietario obligatorio en las 12 empresas
     (`execute_sql`).
  2. Migración del repositorio aplicada sin cambios con `apply_migration`; consta en el
     historial como `20261125201328 mfa_politica_opcional`.

  Comprobado en el servidor: la guarda consulta la política y conserva sesión, membresía,
  perfil y empleado activos. La simulación por cargo en QA-EMP-A, dentro de una transacción
  deshecha, da: Propietario sin segundo factor sin acceso y con él con acceso; Encargado,
  Cajero/a y Camarero/a con acceso sin segundo factor. El cliente ya consulta
  `mfa_politica_leer`.
  Segunda simulación en QA-EMP-A, también en una transacción deshecha, de la función que
  consulta la aplicación al iniciar sesión (`public.mfa_politica_leer`) y de la guarda, con y
  sin factor inscrito: solo Propietario recibe `exigida_para_mi = true` y solo tiene acceso con
  `aal2`; Encargado, Cajero/a y Camarero/a reciben `false` y tienen acceso con `aal1`.
  **Pendiente:** inicio de sesión real de cada cargo en el navegador (el usuario no tiene las
  contraseñas de las cuentas de Encargado y Cajero/a), y que cada empresa nueva reciba su fila
  de Propietario al darse de alta (hoy, sin fila, no se exige).
- **Recomendación:** alinear QA con el repositorio por el procedimiento de migraciones,
  configurar la política decidida y añadir una comprobación que compare el historial de QA
  con `supabase/migrations`.

## H-18 · P3 · `pagos_encargo` con privilegios de escritura innecesarios

- **En el servidor QA (SERVIDOR, R1 y Q2):** `authenticated` tiene `INSERT`, `UPDATE` y
  `DELETE` sobre `pagos_encargo`, pero solo existe una política `SELECT`, así que RLS
  bloquea esas escrituras. Hoy no es explotable.
- **Recomendación:** revocar esos privilegios para que la protección no dependa de que
  nunca se añada por error una política de escritura.

## H-19 · P1 · Los pendientes del modo local se suben a la primera empresa con sesión

- **Evidencia (VIVO + SERVIDOR, 25/11):** el botón «Trabajar solo en este equipo, sin
  sincronizar» guarda escrituras en `almacen__pendientes` y `almacen__pendientes_contexto`.
  Al iniciar sesión después en el mismo navegador, esos pendientes se **subieron a
  QA-EMP-A**: `productos` (37 artículos con stock distinto) y `historialRespaldos`.
- **Qué se verificó en el servidor:** `productos` no cambió (la función
  `abc_productos_guardar_lista` ignora el stock en su camino rápido); `historialRespaldos` se
  reescribió dos veces (20:41:30 y 20:43:31) con los mismos 5 respaldos automáticos del 13 al
  17/11. Con el usuario se vaciaron las dos claves locales y se comprobó que no hubo más
  escrituras.
- **Impacto:** los datos de pruebas locales de un equipo pueden acabar en la empresa de
  quien inicie sesión después. Aquí la protección fue una casualidad de implementación, no un
  diseño.
- **Aviso de método:** esta auditoría provocó el incidente al iniciar sesión sin vaciar antes
  el estado local; quedó documentado y se avisó al usuario.
- **Recomendación:** asociar los pendientes a la empresa y al usuario que los creó, no
  subirlos a otra empresa y pedir confirmación antes de descartarlos.

## H-20 · P2 · 21 de 22 productos de QA-A1 no se pueden enviar: sin ruta a cocina

- **Evidencia (VIVO + SERVIDOR):** el refresco se guardó (pedido ABIERTO) y el servidor
  rechazó el envío: «producto que requiere preparación pero no tiene una ruta activa a
  cocina». En `catalogo_tpv_productos` de QA-A1, **21 de 22** productos tienen
  `requiere_preparacion = true`; solo «Agua 50 cl (QA)» es `false`.
- **Con «Cobrar ahora» (venta rápida):** guarda, intenta enviar y, si falla, deja la cuenta
  abierta. Mientras siga abierta el terminal **no deja iniciar otra venta rápida** («Hay una
  cuenta abierta en este terminal»).
- **Dos causas:** (1) datos de QA sin rutas para esos productos; (2) la venta rápida no limpia
  ni ofrece cancelar la cuenta que ella misma dejó a medias.
- **Recomendación:** que «Cobrar ahora» cancele la cuenta o ofrezca «Cancelar y empezar de
  nuevo» si falla el envío, y comprobar la ruta antes de guardar.

## H-21 · P2 · Cancelar el pedido deja la cuenta comercial abierta

- **Evidencia (SERVIDOR):** tras «Cancelar pedido», el pedido y su línea quedaron
  CANCELADO y CANCELADA; la cuenta `d9e28655…` **siguió ABIERTA**, sin líneas activas, y
  figura entre las cuentas abiertas del local.
- **Consecuencia:** las cuentas abiertas se acumulan (ver H-28).
- **Recomendación:** cerrar la cuenta cuando su último pedido se cancela y no tiene pagos,
  o dar una acción visible para cerrarla.

## H-22 · P2 · En venta rápida, tras guardar y enviar no aparece el cobro

- **Evidencia (VIVO, dos veces):** después de «Guardar pedido» y «Enviar pedido», el panel
  muestra «Venta rápida en curso» y «Continuar en Sala», pero **no** el cobro «F4». Hubo que
  ir a «Buscar cuentas abiertas», pulsar «Retomar» en la cuenta y entonces aparece.
- **Recomendación:** mostrar el cobro de la cuenta recién enviada o llevar directamente a él.

## H-23 · P2 · La venta mixta no emitió documento fiscal — causa por confirmar

- **Evidencia (SERVIDOR):** la venta 1 (efectivo) tiene documento QA `TPV-000044` en
  `abc_c05_documentos_emitidos`. La venta 2 (efectivo + tarjeta) tiene `ventas_fiscales`
  CERRADA pero **ningún documento**, y refrescar el cobro no lo emitió.
- **Reserva:** la tarjeta se resolvió llamando a `abc_qa_confirmar_pago_simulado` desde la
  consola, no desde la interfaz. Si la emisión se dispara desde el cliente tras el cobro, ese
  camino no se ejecutó. **No hay evidencia de que sea un defecto del producto**; hay que
  repetir el caso por la interfaz cuando exista un camino para resolver la tarjeta (H-27).

## H-24 · P1 · «Arqueo de caja» (cierre diario) mostraba un esperado distinto del servidor

- **Evidencia (VIVO + SERVIDOR):** con el efectivo neto de la sesión en 0,00 € y el servidor
  esperando 0,00 €, la pantalla «Arqueo de caja» mostró **«Efectivo esperado 1,00 €»** con
  «Base efectivo 2,65 · anulaciones venta −1,65 · ajustes/reembolsos caja 0,00». Los dos
  reembolsos en efectivo (−1,50 €) no aparecían: «Nada registrado este día». El cierre de la
  sesión de caja (otra pantalla) sí calculó 0,00 € con «Entradas 1,50 − Salidas 1,50».
- **Causa en el código (CÓDIGO):** el arqueo diario calcula el esperado en el cliente con el
  historial de movimientos local (`resumenMediosVentaCajaPM09`) y con los movimientos de caja
  del día; no usa el cálculo del servidor.
- **No se guardó ningún arqueo diario**, así que no hay datos erróneos en QA. La causa exacta
  de los 2,65 € de base no se reprodujo.
- **Impacto potencial:** un descuadre falso al cerrar el día. Es P1 con la evidencia de
  pantalla; falta confirmar si se repite con los datos del servidor sincronizados del todo.
- **Recomendación:** que el arqueo diario muestre el esperado que calcula el servidor.

## H-25 · P3 · El cierre de la sesión de caja está escondido

- **Evidencia (VIVO):** para iniciar y finalizar el cierre hay que ir a **Servicio → Cocina y
  comandas → Mostrar gestión avanzada**. «Caja y fiscalidad → Arqueo de caja» solo abre la
  sesión y el cierre diario; son dos cierres con nombres parecidos.
- **Recomendación:** una sola entrada «Cerrar caja» en Caja y fiscalidad.

## H-26 · P3 · Los bloqueos del cierre se muestran con un texto genérico

- **Evidencia (VIVO + SERVIDOR):** el servidor devolvió el bloqueo `EFECTOS_PENDIENTES`; la
  pantalla lo mostró como «Pendiente operativo». El cliente busca `detalle`, `tipo` o
  `codigo` en un objeto, pero el servidor envía una lista de textos.
- **Impacto:** quien cierra no sabe qué resolver. Aquí era un reembolso de tarjeta pendiente.
- **Recomendación:** traducir cada código («Reembolsos de tarjeta pendientes del proveedor»).

## H-27 · P2 · Ni el cobro ni el reembolso con tarjeta simulada se pueden completar desde la aplicación

- **Evidencia (VIVO + SERVIDOR):** «Iniciar tarjeta simulada» deja el pago y el intento en
  PENDIENTE con el aviso «lo resolverá el adaptador de proveedor». La pantalla no ofrece
  ningún botón para resolverlo («Recuperar/reintentar mismo intento» no es una aprobación).
  El reembolso de tarjeta deja un efecto `PROVIDER_REEMBOLSO` PENDIENTE que **bloquea el
  cierre definitivo**; solo se pudo salir cancelando la solicitud.
- **Cómo se resolvió el cobro:** llamando a `abc_qa_confirmar_pago_simulado` desde la consola
  del navegador, con el Propietario (la función existe en QA sin migración, H-06). No es un
  camino de la interfaz y no se usó para nada más.
- **Función de QA sin código:** `qa-card-worker` (función Edge, `verify_jwt`) resuelve
  intentos de tarjeta y usa la clave de servicio. **Ningún archivo del repositorio ni la
  aplicación la llaman**; se suma a H-06.
- **Impacto:** no se puede probar de punta a punta un cobro con tarjeta ni su reembolso en
  QA; el cierre de caja puede quedarse bloqueado por un efecto que nada resuelve.
- **Recomendación:** un botón «Aprobar/Rechazar tarjeta simulada» solo en QA (sin consola) y
  que el simulador también resuelva los reembolsos de tarjeta.

## H-28 · P3 · 85 cuentas abiertas en el local, 83 de días ya cerrados

- **Evidencia (VIVO):** «85 cuenta(s) abierta(s) · €265,73 en total; 83 son de días
  operativos ya cerrados, por €264,73. Desde aquí no se retoman y tampoco se cierran solas».
- **Consecuencia:** acumulan ruido en la lista (ver H-21) y no hay acción visible para
  cerrarlas.
- **Recomendación:** decidir quién las cierra y cuándo (cierre automático del día o botón de
  limpieza con permiso).

## H-29 · P3 · Una recarga a mitad de «Guardar pedido» deja una cuenta sin pedido

- **Evidencia (VIVO + SERVIDOR, lote L2):** al recargar con la primera llamada en vuelo, el
  servidor tenía la cuenta `f3d877c7…` ABIERTA sin pedido ni línea. El borrador local se
  recuperó y, al volver a pulsar «Guardar pedido», se **reutilizó esa cuenta**: no hubo
  duplicados.
- **Impacto:** bajo; si el usuario no reintenta, la cuenta queda abierta y suma a H-28.
- **Recomendación:** que la creación de la cuenta y la del pedido sean una sola operación en
  el servidor, o que se cierren las cuentas sin pedido tras un tiempo.

## H-30 · P3 · Tras recargar hay que volver a abrir las operaciones de cuenta

- **Evidencia (VIVO, lote L2):** al recargar, la aplicación vuelve a Inicio y el interruptor
  «Mostrar operaciones de cuenta» se reinicia; para llegar al cobro de una cuenta enviada
  hay que ir a Servicio, mostrar las operaciones, buscar las cuentas abiertas y pulsar
  «Retomar». Se suma a H-22.
- **Recomendación:** recordar la pantalla y la cuenta en curso, o llevar directamente a ella.

## H-31 · P3 · Un pendiente de cobro antiguo sigue en el navegador

- **Evidencia (VIVO + SERVIDOR, lote L2):** `localStorage` conserva
  `la_suite_f4_b02_b03_pago_v1:QA-EMP-A:QA-A1:27ac5cb7…`, creado el 13/11 (tarjeta, 0,60 €),
  con identificadores de operación fijos. En el servidor esa cuenta sigue ABIERTA, con un pago
  en efectivo CONFIRMADO y el de tarjeta CANCELADO. El pendiente de la venta del lote L2 sí
  se limpió al completarse.
- **Impacto potencial:** al retomar esa cuenta, el pendiente podría intentar repetirse.
  No se probó y no se tocó.
- **Recomendación:** caducar el pendiente cuando el servidor resuelve o cancela el intento.

## H-32 · P3 · Sin red, el error se muestra crudo y tarda

- **Evidencia (VIVO, lote L2):** con las peticiones a Supabase rechazadas, «Cerrar cuenta
  pagada» mostró «Cerrando…» unos 15 s y después «TypeError: Failed to fetch». Los datos no
  cambiaron y el reintento con red funcionó.
- **Recomendación:** un tiempo límite más corto y un mensaje comprensible («Sin conexión. No
  se ha cambiado nada. Reintenta»).

## H-33 · P3 · El código lleva fijas direcciones de producción

- **Evidencia (CÓDIGO):** `fuente.js` llama a funciones Edge de **producción**
  (`flqercbgpgmmfaakrwkc.supabase.co/functions/v1/…`) en 12 sitios: `ORIGEN_FUNCTIONS`
  (línea 43519), `enviar-notificacion` (106536, 110269, 115696, 115726 y 131993),
  `importar-albaran` (121816 y 124450), `entrevista-personal` (122808), `importar-nomina`
  (131474) y `prefiltro-candidato` (131912 y 131937). Por ejemplo, **«Anular venta»** manda una
  notificación a producción si el día ya tenía arqueo.
- **Qué lo contiene:** en una Deploy Preview, la política de seguridad del navegador
  (`connect-src` solo a QA, `netlify-csp.mjs`) y la barrera de `reset-pruebas-preview.js`
  (`QA_BLOCKED_PRODUCTION_SUPABASE`, comprobada en CI por `pm02-validar-barrera.mjs`) impiden
  esas llamadas. **No se probó en vivo** para no tocar producción.
- **Impacto:** hoy no sale nada de QA hacia producción, pero la protección depende de que
  esas dos barreras sigan funcionando. Las funciones de producción reciben datos de pruebas si
  alguna vez falla una.
- **Recomendación:** leer el origen de las funciones de la misma configuración que la base de
  datos (como ya hace la creación de cuentas de empleado) y no repetir la dirección de
  producción en el código.

## H-34 · P3 · «Anular venta» aparece habilitado para quien no tiene permiso

- **Evidencia (VIVO + SERVIDOR):** con la cuenta de Camarero/a, el detalle de una venta del
  historial muestra «Anular venta» **habilitado**. El servidor lo rechaza
  (`revertir_venta_stock_carrito_pm09` → `reverso_no_autorizado`), así que no hay riesgo de
  datos, solo confusión: el usuario ve un botón que no puede usar. Cajero/a y Camarero/a sí
  ven el aviso de falta de permiso y el botón deshabilitado en el reembolso económico.
- **Recomendación:** ocultar o deshabilitar el botón según la capacidad, como en el reembolso.

## H-35 · P3 · El historial no refleja los reembolsos económicos

- **Evidencia (VIVO):** la venta `V-20261125-B44A86` (TPV-000045, 1,00 € en efectivo), con un
  reembolso B08 de 1,00 € **confirmado**, figura como **ACTIVA** y su importe sigue en «Total
  vigente»; su ticket no menciona el reembolso.
- **Por qué:** el aviso del B08 dice que no modifica stock ni devoluciones físicas, y es un
  flujo aparte de «Anular venta».
- **Impacto:** quien lee el historial ve una venta íntegra aunque el dinero se haya devuelto;
  la caja y el historial dan cifras distintas.
- **Recomendación:** marcar en el historial y en el ticket las ventas con reembolso
  («Reembolsada 1,00 €») y descontarlas del total vigente.

## H-36 · P3 · Las cuentas creadas por la aplicación no obligan a cambiar la contraseña inicial

- **Evidencia (VIVO):** las cuentas de Encargado, Cajero/a y Camarero/a se crearon con una
  contraseña inicial fijada por quien las crea y entraron sin que la aplicación pidiera
  cambiarla. La propia pantalla dice que «el empleado podrá cambiarla luego».
- **Impacto:** quien crea la cuenta conoce la contraseña mientras nadie la cambie.
- **Recomendación:** obligar al cambio en el primer inicio de sesión (el servidor ya tiene
  `plataforma_debe_cambiar_password()`).

## H-37 · P2 · «Cobrar ahora» falla a medias con la cuenta de Cajero/a

- **Evidencia (VIVO + SERVIDOR, lote L3):** con la cuenta de Cajero/a, «Cobrar ahora» guarda y
  **envía** el pedido (stock del agua 70 → 69) y se corta en el primer paso de preparación con
  «Tu perfil no tiene permiso para realizar esta transición del pedido». La cuenta queda ENVIADA
  y sin cobrar. La matriz de capacidades lo explica: Cajero/a no tiene
  `ABC_PREPARACION_INICIAR` ni `ABC_PREPARACION_COMPLETAR`, y la venta rápida encadena
  iniciar, preparar y servir.
- **Variante:** la pantalla de cobro del Cajero/a muestra el botón «Iniciar preparación», que no
  puede usar.
- **Alternativa que funciona:** retomar la cuenta y cobrarla (el Cajero/a sí puede cobrar un
  pedido enviado); servirla y cerrarla exige otro cargo.
- **Impacto:** con los permisos por defecto, el cargo que más vende en caja no puede completar
  la venta rápida; quedan cuentas enviadas y sin cobrar, y el stock ya consumido.
- **Recomendación:** que la venta rápida use una operación de servidor única con el permiso de
  cobro, o que no encadene pasos de preparación para quien no los tiene, y ocultar los botones
  sin permiso.

## H-38 · P1 · Un cobro del Cajero/a se cierra sin documento fiscal y el cierre no lo detecta

- **Evidencia (VIVO + SERVIDOR, lote L3):** el Cajero/a cobró 1,00 € en efectivo. El pago quedó
  CONFIRMADO y la caja registró la entrada, pero la pantalla mostró «Emisión fiscal bloqueada
  C07D_CONFIG_NO_AUTORIZADO» y **no se emitió ningún documento** (`abc_c05_documentos_emitidos`
  sin filas nuevas). El Encargado sirvió y cerró la cuenta: quedó CERRADA con su venta fiscal y
  **sin documento**, y no hay ninguna acción visible para emitirlo después.
- **El cierre tampoco lo ve:** el «Ensayo C12» devolvió «APTO_CIERRE … documentos conciliados 0 ·
  pendientes 0» y la sesión se cerró en CERRADA_FINAL.
- **Contraste:** las ventas cobradas por el Propietario (TPV-44 y TPV-45) sí emitieron documento.
- **Causa probable:** la lectura de la configuración de emisión exige un permiso que el
  Cajero/a no tiene (`abc_c07d_leer_emision_config`); se concluye del mensaje, no se leyó el
  código de esa comprobación.
- **Impacto:** ventas cobradas y cerradas sin ticket fiscal, sin cola de emisión y sin aviso en
  el cierre.
- **Recomendación:** que la emisión se haga en el servidor con el permiso de cobro (no con el de
  quien lee la configuración), que un cobro sin documento quede como efecto pendiente que
  bloquee el cierre, y que el ensayo C12 cuente las ventas sin documento.

## H-39 · P2 · La política de descuento del Encargado no se puede usar

- **Evidencia (VIVO + SERVIDOR, lote L3):** la política de QA-A1 para Encargado es «puede
  solicitar: sí, puede escalar: sí, puede aplicar: no, máximo 0 %». Al pedir un 10 % la
  respuesta fue `descuento_no_autorizado` y la pantalla dijo «Tu perfil no tiene permiso para
  solicitar o aplicar este descuento»; no se creó ninguna solicitud ni autorización.
- **Causa (CÓDIGO del servidor):** `abc_aplicar_descuento_cuenta` hace
  `if not v_has_authorization and v_max<=0 then raise exception 'descuento_no_autorizado'`
  antes de crear la solicitud de escalado, así que con máximo 0 % «escalar» nunca llega a
  existir.
- **Impacto:** la política parece permitir solicitar descuentos y el servidor lo impide; el
  flujo Encargado → Propietario no se puede ejercitar sin cambiar la configuración.
- **Recomendación:** decidir si «máximo 0 %» significa «sin descuentos» (y entonces ocultar
  «escalar» y «solicitar») o «todo requiere autorización» (y entonces crear la solicitud).

## H-40 · P3 · El borrador del carrito no pertenece a un usuario

- **Evidencia (VIVO):** el Cajero/a dejó un agua sin guardar y, al entrar el Camarero/a en el
  mismo navegador, su carrito ya la traía. La clave del borrador es
  `la_suite_abc_tpv_borrador_v1:<empresa>:<local>`, sin usuario.
- **Impacto:** otro empleado puede guardar o vender lo que dejó otra persona en un equipo
  compartido.
- **Recomendación:** ligar el borrador al usuario o vaciarlo al cerrar sesión.

## H-41 · P3 · El Camarero/a no ve las cuentas abiertas y el aviso habla de la caja

- **Evidencia (VIVO):** con la cuenta de Camarero/a, «Buscar cuentas abiertas» no devuelve
  ninguna y el panel muestra «Tu usuario no tiene permiso para abrir la sesión de caja en este
  local». Probablemente es intencionado (no puede operar caja), pero el mensaje no explica que
  la lista no está disponible para su cargo.
- **Recomendación:** un mensaje del tipo «Tu cargo no puede ver las cuentas abiertas» y la
  ruta alternativa por mesas.

## H-42 · P3 · Las cuentas con el pedido cancelado no se pueden retomar y se acumulan

- **Evidencia (VIVO, lote L4):** las cuentas A y B del lote L3 (pedido CANCELADO, 0 líneas)
  aparecen en «Cuentas abiertas» con «Retomar», pero al pulsarlo la cuenta no queda activa y no
  aparece «Cuenta retomada». Por eso no se pudo revertir desde B el reparto que se le había hecho
  (la opción vive en la cuenta destino) y tampoco cerrarlas desde la pantalla. Se suma a H-21 y
  H-28.
- **Recomendación:** permitir retomar y cerrar una cuenta sin pedidos activos, o cerrarla al
  cancelar su último pedido.

## H-43 · P3 · El descuento no encuentra líneas aptas en una cuenta que ha recibido un producto servido — causa por confirmar

- **Evidencia (VIVO, lote L4):** la cuenta Y recibió por unión y reparto una línea de agua servida
  (reparto ACTIVO de 1,00 €) y tenía además una línea propia en borrador. El panel de descuento
  respondió «La cuenta no tiene líneas aptas para aplicar el descuento» y solo listó la línea en
  borrador; no se creó ninguna fila.
- **Qué no se sabe:** si el servidor lo habría aceptado (la función de servidor bloquea también
  las cuentas que participan por reparto, lo que sugiere que sí se contempla) o si es un límite
  de la pantalla. No se pudo comprobar sin más stock.
- **Recomendación:** repetir con un pedido enviado en la misma cuenta y con una línea recibida
  por reparto, y mostrar en el panel de descuento las líneas recibidas.

## No son defectos (descartados durante la auditoría)

- **El marco Órbita no se aplica con el panel del navegador oculto.** El navegador pausa
  `requestAnimationFrame` en páginas en segundo plano; al hacerse visibles se aplica. Con
  el panel visible se aplicó siempre en las sesiones del 25/11.
- **Tarjetas recortadas a 1024 y 320 tras cambiar el tamaño de la ventana de prueba.** El
  `ResizeObserver` tampoco se dispara en segundo plano. Con el panel visible y la misma SHA,
  a 1024×768 se midieron 8 productos y ninguna tarjeta cortada.
- **Dos respuestas 401 en consola.** Son peticiones a QA sin sesión en modo local.
- **Foco de teclado.** Es visible en todos los controles del modo caja (contorno de
  2,4 px); el botón de página anterior no se enfoca en la página 1 porque está desactivado.
