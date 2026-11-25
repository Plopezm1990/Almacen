# Hallazgos · Auditoría del TPV · 25/11/2026

SHA auditada: `aa809c3a265eda1d797b7afdb8ce92d9c1ff483b` (rama `rediseno/f0-base-qa`,
PR #225 en borrador, igual en local, remoto y Deploy Preview).
Entorno: Deploy Preview #225 apuntando a QA `qjqorixtkilwsndqayyx`. Producción no se
tocó. No se hizo ninguna escritura de datos en QA. Con autorización del usuario se crearon
dos notebooks de solo lectura en el proyecto QA para consultar el servidor
(`evidencias/servidor-qa-2026-11-25.md`).

## Cómo leer este documento

- **Severidad:** P0 pérdida o corrupción de datos, aislamiento roto o cobro duplicado ·
  P1 impide vender, cobrar o cerrar · P2 fricción o error importante con alternativa ·
  P3 mejora visual o de comodidad.
- **Evidencia:** `VIVO` navegador QA en esta auditoría · `CÓDIGO` inspección de código o
  migraciones · `AUTO` prueba automatizada · `PREVIO` documento anterior sin repetir ·
  `DEDUCIDO` inferencia razonada, no reproducida · `SERVIDOR` consulta de solo lectura al
  servidor QA.
- Ningún hallazgo es P0 o P1 **con la evidencia disponible**. Eso no demuestra que no
  existan: los recorridos con escritura y los dos terminales siguen bloqueados (ver el
  informe).

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
- **DEDUCIDO del código (no reproducido):** un lector de códigos que funcione como teclado
  escribiría en ese buscador oculto mientras la capa está abierta; con Intro,
  `manejarEnterEscaneo` podría añadir un producto al ticket sin que el cajero lo vea.
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

  **No se ha leído su código:** no se sabe si comprueban el rol o el entorno por dentro.
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
  «Guardar pedido». No se ha comprobado qué hace el servidor.
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
