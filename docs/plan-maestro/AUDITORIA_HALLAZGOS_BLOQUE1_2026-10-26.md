# Auditoría completa L&A Suite — Hallazgos verificados, Bloque 1 (TPV/Cobro/Caja)

Fecha: 26/10/2026
Entorno: QA, Deploy Preview `#181` (borrador) — `https://deploy-preview-181--chic-entremet-9107cf.netlify.app`
Rama: `audit/qa-preview-2026-10-26` (= `codex/etapa5-recuperacion-qa`, commit `1719bdd3`)
Fuente de las pruebas en vivo: Cowork, siguiendo `AUDITORIA_COWORK_BLOQUE1_TPV_COBRO_2026-10-26.md`.
Este documento añade, para cada hallazgo que lo permite, la causa en el código real
(archivo y línea), distinguiendo explícitamente lo confirmado de lo que sigue siendo
hipótesis.

---

## H-CRIT-01 — Cobro en efectivo roto (3/3 intentos fallidos)

- **Prioridad:** Crítica.
- **Pantalla / ruta / rol / ancho:** TPV → Cobro·F4, pago en efectivo. Rol Propietario
  QA. Probado a 390px.
- **Pasos para reproducirlo:** Abrir una cuenta con productos, ir a Cobro, elegir
  efectivo, introducir cualquier importe recibido (probado con cambio positivo, sin
  cambio, y con propina desde el cambio — las tres variantes fallan igual).
- **Resultado esperado:** El pago se confirma y la cuenta queda liquidada.
- **Resultado observado:** HTTP 400 con el mensaje "El efectivo recibido y el cambio
  no cuadran con el importe del pago." en los 3 intentos. Tras el tercero, la cuenta
  queda bloqueada en un estado "cobro pendiente o incierto" que impide incluso
  cambiar a tarjeta simulada.
- **Evidencia:** Informe de Cowork (3 reintentos, mismo HTTP 400); comprobado en
  Supabase (proyecto QA) que ninguno de los 3 intentos dejó fila en `pago_intentos`
  ni `abc_operaciones` — el servidor rechaza antes de persistir nada.
- **Causa — CONFIRMADA (discrepancia real entre cliente y servidor, no solo hipótesis
  de por qué dispara en producción):**
  - Cliente (`fuente.js:112944-112946`), dentro de `confirmarCobro`/flujo de pago:
    usa una **tolerancia** de punto flotante:
    `Math.abs((recibido - cambio) - importe) > 0.000001` → lanza el error solo si la
    diferencia supera ese margen.
  - Servidor (`supabase/migrations/20261024150000_t6_bizum_operativo_simulador.sql`,
    función `abc_iniciar_cobro`, rama `if v_medio='EFECTIVO'`): usa **igualdad exacta**
    sobre `numeric`: `p_importe_recibido-p_cambio_entregado<>p_importe_objetivo` — sin
    ningún margen de tolerancia.
  - El cliente puede dejar pasar una resta con un resto de coma flotante
    imperceptible (típico de JavaScript, p. ej. `2 - 0.9` puede no dar exactamente
    `1.1`) que el cliente considera "suficientemente igual", pero que el servidor
    rechaza porque exige igualdad matemática exacta. Es la discrepancia que explica
    por qué un pago con números "normales" (no solo casos extremos) puede fallar de
    forma repetible.
  - Es **impacto crítico**: bloquea el método de pago más común de un bar/restaurante
    y además deja la cuenta en un estado bloqueado del que cuesta salir.
- **Corrección recomendada:** alinear ambas comprobaciones. La más segura es
  endurecer el cliente para que redondee `recibido`, `cambio` e `importe` a centavos
  (2 decimales) antes de enviarlos — así coincide exactamente con lo que puede
  representar `numeric` sin resto — en vez de relajar la igualdad exacta del
  servidor (que es la autoridad económica y no debería aflojarse).
- **Cómo validarlo:** repetir el mismo pago en QA tras el cambio y confirmar que
  `abc_iniciar_cobro` no lanza `efectivo_recibido_cambio_inconsistente`; añadir un
  test que envíe valores con resto de coma flotante típico de JS (p. ej.
  `recibido=2, cambio=0.9, importe=1.1`, calculados como en el cliente) y confirme
  que el servidor los acepta.

---

## H-CRIT-02 — El ticket en pantalla dice "Factura simplificada"

- **Prioridad:** Crítica (riesgo legal/fiscal, no solo visual).
- **Pantalla / ruta / rol:** TPV → Cobro·F4 → "Ver ticket", cuando el QR fiscal QA ya
  está listo.
- **Pasos para reproducirlo:** Completar un cobro con éxito (ej. con vale regalo,
  que sí funciona) y abrir la vista del ticket en pantalla.
- **Resultado esperado:** El documento de cierre `ETAPA_7_CIERRE_FORMAL_POST_ROLLBACK_2026-10-26.md`
  fija la regla explícita: "Mientras eso no exista, el producto debe seguir
  etiquetando el ticket como `TICKET / RECIBO INTERNO`."
- **Resultado observado:** El encabezado del bloque de QR fiscal dice literalmente
  "Factura simplificada · [serie]-[número]", con fecha e importe — presentándose
  como una factura simplificada de verdad. Solo hay un aviso secundario, en letra
  pequeña, "Simulador QA; no presentado a AEAT".
- **Evidencia / causa — CONFIRMADA (código, no hipótesis):**
  `fuente.js:127639` y `fuente.js:127754` (dos sitios con el mismo texto):
  ```
  "Factura simplificada · ", qrFiscal.codigo_serie, "-", String(qrFiscal.numero).padStart(6, "0")
  ```
  Llama la atención que la rama vecina del mismo bloque (cuando el QR todavía no
  está listo, línea 127642) sí dice correctamente "No lo presentes como factura
  simplificada" — quien escribió el código conocía la regla, pero no la aplicó en
  la etiqueta principal cuando el QR SÍ está listo, que es el caso normal.
- **Impacto:** si esta pantalla llegara a producción tal cual, cualquier empleado o
  cliente podría interpretar (o imprimir/enseñar) el ticket como una factura
  simplificada real — exactamente lo que la Etapa 7 dejó bloqueado a propósito.
- **Corrección recomendada:** cambiar la etiqueta principal a algo como "TICKET /
  RECIBO INTERNO · QR de prueba QA" y mover el aviso "no presentado a AEAT" a la
  misma prominencia que el título, no como nota secundaria.
- **Cómo validarlo:** repetir el cobro con éxito y confirmar en pantalla que ningún
  texto dice "factura" en ningún contexto que no sea, explícitamente, una negación.

---

## H-ALTA-01 — Banner de error ocupa toda la pantalla a 768px

- **Prioridad:** Alta.
- **Pantalla / ancho:** TPV, 768px (tablet). No ocurre a 390px ni a 1440px según
  Cowork.
- **Resultado esperado:** Un aviso de fondo (el ya conocido de
  `historialRespaldos`/PGRST116) no debería impedir ver ni usar el TPV.
- **Resultado observado:** El banner se estira al 100% del alto del viewport,
  tapando el TPV por completo hasta cerrarlo manualmente con la "✕".
- **Causa:** NO CONFIRMADA en código por mi parte en esta vuelta — Cowork apunta a
  "CSS con `flex-row` y sin límite de altura a partir de un breakpoint `md:`", pero
  es su hipótesis, no algo que yo haya verificado leyendo el componente exacto.
  Queda pendiente de localizar el componente del banner y confirmar la regla CSS
  responsable antes de dar un veredicto de causa cerrado.
- **Corrección recomendada (provisional):** fijar una altura máxima y `overflow:
  auto` en el contenedor del banner para cualquier ancho ≥768px, una vez localizado.
- **Cómo validarlo:** repetir la carga a 768px tras el cambio y confirmar que el
  TPV sigue visible debajo/junto al banner.

---

## H-MEDIA-01 — Error PGRST116 ("2 rows", se esperaba 1) en 4 colecciones, cada carga

- **Prioridad:** Media (no bloquea la operación, pero ensucia la consola en cada
  carga y generó el banner de H-ALTA-01).
- **Pantalla:** Cualquiera, en cada carga de página (`traspasos`, `productos`,
  `conteos`, `historialRespaldos`).
- **Causa — investigada, NO encontrada la fuente exacta todavía:** comprobé
  directamente en la base de datos QA (`almacen_kv`, solo lectura) si había filas
  duplicadas para `(empresa_id, local_id, key)` en esas cuatro claves — **no hay
  ninguna duplicada** (cada una tiene exactamente 1 fila, con `local_id` nulo porque
  son colecciones de ámbito de empresa, no de local). Esto descarta mi primera
  hipótesis (duplicado simple en `almacen_kv`). La causa real del "2 rows" que
  PostgREST reporta sigue sin identificarse — probablemente en otra tabla o en cómo
  `window.storage.get` construye la petición (cabecera `Accept:
  application/vnd.pgrst.object+json`, que exige exactamente 1 fila) contra una vista
  o join con más de una fila real. **Marco esto explícitamente como pendiente de
  investigar con una sesión en vivo** (inspeccionar la pestaña Red del navegador para
  ver la URL exacta de la petición que falla), no como una causa cerrada.

---

## Resuelto — H7 (traspaso Empresa B) ya no se reproduce

Cowork repitió el traspaso de almacén a piso de venta en `QA Empresa B` que había
quedado rechazado en la comparación A/B anterior (documentada en
`ETAPA7_1_COMPARACION_AB_QA_2026-10-26.md`). Esta vez se completó con éxito y se
confirmó, por consulta directa a Supabase (solo lectura), que quedó persistido en
`movimientos_stock` y `stock_operaciones` con el mismo `operation_id`. Se cierra este
hallazgo como resuelto — no hace falta seguir investigándolo.

## Hallazgos menores (no bloqueantes, UX)

- El botón rápido "+3" sobre un producto con opciones obligatorias no da ningún
  feedback inmediato; la cantidad queda en cola silenciosa hasta completar su modal.
- El campo "Efectivo recibido" no se resetea entre cuentas distintas.
- La pantalla de Caja no muestra un saldo/total acumulado, solo movimientos sueltos;
  "Abrir caja" no pide un importe de apertura; el campo "Concepto o justificante" en
  Entrada/Retirada parece opcional por su texto de ejemplo pero es obligatorio para
  poder guardar.
- El diálogo "Modo empleado" puede abrirse oculto detrás del modal "Más" (posible
  conflicto de `z-index`).

## Lo que no tuvo ningún hallazgo (sólido)

- Accesibilidad de teclado en el TPV (Tab, foco visible, activación con Enter) y
  comportamiento con zoom de página 50%–200%: sin problemas encontrados.
- Separación de permisos Cajero/a vs Camarero/a vs Encargado/a en la pestaña Caja y
  en el menú "Más": coherente con el nivel de cada rol.

## Límites de esta vuelta

- No se pudo confirmar un PIN propio y reproducible para las cuentas `QA Cajero` /
  `QA Encargado` (Cowork entró gracias a la autorización directa de Pedro cada vez).
- H-ALTA-01 y H-MEDIA-01 quedan con causa sin cerrar — necesitan otra vuelta de
  investigación en código/red, no solo narración de lo que se vio en pantalla.
- Quedan 27 de 44 módulos sin ninguna revisión (ver
  `AUDITORIA_COMPLETA_INVENTARIO_Y_MATRIZ_2026-10-26.md`) — esto es solo el Bloque 1.
