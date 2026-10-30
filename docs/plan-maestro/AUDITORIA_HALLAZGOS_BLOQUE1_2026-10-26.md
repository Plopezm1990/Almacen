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
- **Pantalla / ancho:** TPV, 768px (tablet). Cowork no lo vio a 390px ni a 1440px,
  pero ver la nota al final sobre por qué eso no significa que el mecanismo de la
  causa sea exclusivo de 768px.
- **Resultado esperado:** Un aviso de fondo (el de `historialRespaldos`/PGRST116,
  ver H-MEDIA-01) no debería impedir ver ni usar el TPV.
- **Resultado observado:** El banner se estira al 100% del alto del viewport,
  tapando el TPV por completo hasta cerrarlo manualmente con la "✕".
- **Causa — CONFIRMADA en código (actualización 26/10, segunda vuelta):**
  - El contenedor raíz de `GestionAlmacen` (`fuente.js:107051`) usa
    `className: "w-full min-h-[700px] flex flex-col md:flex-row text-[14px]"`. El
    breakpoint `md:` de Tailwind es exactamente 768px: por debajo es `flex-col`
    (apilado vertical, sin problema), a partir de 768px pasa a `flex-row`.
  - Los dos banners de aviso (`falloGuardadoVisible && ...` en `fuente.js:107051-107064`
    y el de `fallosCarga` en `fuente.js:107065-107072`) son **hijos directos de ese
    mismo contenedor flex**, al mismo nivel que la barra lateral y el contenido
    principal — y ninguno de los dos fija su propia altura.
  - En un `flex-row`, `align-items` por defecto es `stretch`: cada hijo se estira en
    el eje transversal (aquí, la altura) hasta igualar al hermano más alto de la
    fila — que es la columna de contenido principal, tan alta como toda la app. Por
    eso el banner (con fondo rojo/ámbar sólido y `position: sticky`) se estira
    verticalmente y cubre la pantalla: no es un error puntual de una regla CSS
    suelta, es el comportamiento por defecto de flexbox aplicado a un elemento que
    nunca debió estar dentro de la fila.
  - Nota honesta: no he podido confirmar en vivo por qué Cowork no lo vio a 1440px —
    mecánicamente, `md:flex-row` se aplica igual a 1440px que a 768px, así que el
    mismo estiramiento debería ocurrir ahí también. Como el banner solo aparece
    cuando se dispara H-MEDIA-01 (ver abajo), y esa condición es una carrera de
    temporización no determinista, lo más probable es que simplemente no se diera
    la carrera durante la prueba a 1440px, no que el CSS se comporte distinto a ese
    ancho. Recomiendo que Cowork repita la carga varias veces a 1440px para
    confirmar o descartar esto.
- **Corrección recomendada:** sacar los dos banners del flujo `flex` del contenedor
  raíz (por ejemplo, envolviendo `data-tema=...` en un `<div>` exterior no-flex que
  contenga el banner arriba y el `flex md:flex-row` solo alrededor de barra lateral
  + contenido), o añadir `self-start` / `max-h-*` explícito a cada banner para que no
  herede el `stretch` del contenedor.
- **Cómo validarlo:** forzar la aparición del banner (ver H-MEDIA-01) a 768px y a
  1440px tras el cambio y confirmar en ambos que el TPV sigue completamente visible
  y utilizable debajo del banner.

---

## H-MEDIA-01 — Error PGRST116 ("2 rows", se esperaba 1) en 4 colecciones, cada carga

- **Prioridad:** reclasificado de Media a **Alta** — ver nota de riesgo al final.
- **Pantalla:** Cualquiera, en cada carga de página (`traspasos`, `productos`,
  `conteos`, `historialRespaldos`).
- **Causa — CONFIRMADA en código y en datos reales de QA (segunda vuelta, 26/10):**
  Mi primera hipótesis (fila duplicada en `almacen_kv`) quedó descartada en la
  primera vuelta y sigue descartada: **el propio `almacen_kv` tiene su clave
  primaria definida como `PRIMARY KEY (empresa_id, key)`** (confirmado por SQL de
  solo lectura contra el proyecto QA), así que una fila duplicada para la misma
  empresa y clave es estructuralmente imposible. La causa real es otra, y la
  localicé siguiendo la ruta de lectura completa:
  1. Al arrancar la app, `fuente.js:105256-105294` lanza un único
     `useEffect(() => {...}, [])` que llama, entre otras, a
     `loadKey("productos", [])`, `loadKey("conteos", [])`,
     `loadKey("historialRespaldos", [])` y `loadKey("traspasos", [])` dentro de un
     `Promise.all`. Esto ocurre **antes** de que exista ningún contexto de
     empresa/local publicado: `window.__empresaActivaIdParaContexto` solo se fija
     más adelante, dentro de ese mismo efecto tras resolverse el `Promise.all`
     (`fuente.js:105472`) o en efectos posteriores que dependen de `ready`
     (`fuente.js:105520-105534`) — `ready` se pone a `true` justo después de este
     mismo `Promise.all` (`fuente.js:105494`), es decir, siempre después.
  2. Cada `loadKey` llama a `window.storage.get(key)`
     (`index-storage-bootstrap.js:1195` y siguientes). Para estas 4 claves (no
     están en `TABLAS_EMPRESA`/`TABLAS_EMPRESA_LOCAL`/`TABLAS_POR_FILA`/`LEDGERS_RPC`,
     `index-storage-bootstrap.js:454-480`), cae en la rama genérica
     (`index-storage-bootstrap.js:1221-1222`):
     `consultaKvPorClave(key, "value").maybeSingle()`.
  3. `consultaKvPorClave` (`index-storage-bootstrap.js:998-1005`) construye:
     `from("almacen_kv").select("value").eq("key", key)` y **solo añade
     `.eq("empresa_id", contexto.empresaId)` si `contexto.empresaId` es verdadero**
     (`if (contexto.empresaId) consulta = consulta.eq(...)`). En el primer
     `Promise.all` del arranque, `contexto.empresaId` todavía es `null`/vacío (ver
     punto 1) — así que ese filtro se **omite por completo** y la consulta pide
     "la fila con esta clave", sin acotar por empresa.
  4. Comprobé en vivo (solo lectura) cuántas filas tiene hoy cada una de esas 4
     claves en el proyecto QA, sin filtrar por empresa: `traspasos` → **2 filas**
     (`QA-EMP-A`, `QA-EMP-B`) — coincide exactamente con el "se esperaba 1, hay 2"
     reportado; `productos` → 10 filas; `conteos` → 8 filas; `historialRespaldos` →
     7 filas (una por cada empresa de prueba creada en este proyecto a lo largo del
     desarrollo). Con 2 o más filas, PostgREST rechaza `.maybeSingle()` con
     PGRST116 ("JSON object requested, multiple (or no) rows returned").
  - **Conclusión:** no es una fila duplicada ni un fallo de servidor — es que la
    primera lectura de estas 4 claves, en cada carga de página, sale sin filtro de
    empresa porque todavía no se ha publicado el contexto en ese instante exacto.
- **Riesgo real, no solo cosmético (por eso subo la prioridad a Alta):** el fallo
  solo es *visible* porque hay más de una empresa de prueba en el proyecto QA. En
  una instalación con una sola empresa, esta misma consulta sin filtro
  devolvería 1 fila por pura coincidencia (la única que existe) y **no lanzaría
  ningún error** — cargando los datos de esa única empresa en silencio, sin que el
  filtro de empresa haya intervenido realmente. Es decir: el filtro de aislamiento
  por empresa de estas 4 claves no está roto por azar en QA — está ausente en ese
  instante del arranque en cualquier entorno, y QA simplemente es el único sitio
  donde hay suficientes empresas para que se note. Antes de promocionar nada de esto
  a producción habría que confirmar que una cuenta con una sola empresa nunca
  importa, por la misma coincidencia de "una fila", datos de otra empresa.
- **Corrección recomendada:** en `consultaKvPorClave`, si `contexto.empresaId` está
  vacío, no lanzar la consulta sin filtro — devolver "sin datos todavía" (como ya
  hace el bloque de `if (!r.data)` más abajo) y dejar que `loadKey` reintente
  cuando el contexto exista. Alternativa más simple: no lanzar estas 4 lecturas
  hasta que `window.__empresaActivaIdParaContexto` esté resuelto por primera vez.
- **Cómo validarlo:** repetir la carga de página varias veces en QA tras el cambio
  y confirmar que la consola no muestra PGRST116 para estas 4 claves ninguna vez,
  en ninguno de los 3 anchos.

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
- H-ALTA-01 y H-MEDIA-01: causa cerrada en la segunda vuelta (26/10), ver ambas
  secciones arriba — quedan las correcciones por aplicar y validar en vivo.
- Quedan 27 de 44 módulos sin ninguna revisión (ver
  `AUDITORIA_COMPLETA_INVENTARIO_Y_MATRIZ_2026-10-26.md`) — esto es solo el Bloque 1.
