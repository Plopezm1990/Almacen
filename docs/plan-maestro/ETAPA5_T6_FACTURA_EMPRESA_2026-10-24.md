# Plan Maestro L&A Suite — Etapa 5, T6: factura a empresa (NIF)

Fecha: 24/10/2026
Entorno: QA `qjqorixtkilwsndqayyx`.
Autorización: Hoja QA-5 (Pedro, 24/10/2026, chat).

## 1. Lo pedido

«Factura a empresa (NIF)»: que se pueda emitir una factura completa (con
nombre/razón social y NIF del cliente) cuando el cliente es una empresa,
en vez del ticket normal.

## 2. Punto de partida (investigado antes de escribir la Hoja)

El sistema de documentos fiscales de la Etapa 5 — numeración de series
(C05), clasificación de documentos (C06) y puerta fiscal (C07) — **ya
existía y ya estaba aplicado en QA**, aunque cada migración trae en su
propio comentario «candidato aislado: no aplicado en QA/PROD» (la tercera
vez que aparece este patrón en este proyecto). Comprobado con consultas de
solo lectura:

- `abc_reservar_numero_documental`, `abc_clasificar_documento`,
  `abc_configurar_modalidad_fiscal`, `abc_evaluar_documento_fiscal`,
  `abc_resolver_emision_documental`: existen, están ejecutables para
  `authenticated` y nunca se habían conectado a ninguna pantalla.
- `abc_c05_series_documentales`: existe, pero tenía **0 filas** en QA y
  **ninguna función podía crear una serie** — solo reservar un número de
  una ya existente. Esta era la única pieza que realmente faltaba.
- El permiso que exigen todas estas funciones (`ABC_EMISOR_CAMBIAR`) ya lo
  tienen por defecto Propietario y Encargado (Cajero y Camarero no, con
  techo en Encargado) — no hizo falta conceder nada nuevo para probar con
  la cuenta de pruebas.
- La tabla `empresas` no tiene un campo estructurado para el NIF/razón
  social del propio emisor (el negocio). Para esta primera versión se deja
  así: el NIF del cliente (receptor) se escribe en el momento de emitir la
  factura y no se guarda ningún dato fijo del emisor.

## 3. Qué se construyó

### 3.1 Base de datos (migración nueva, la única pieza que faltaba)

`supabase/migrations/20261024090000_t6_factura_empresa_serie.sql`:

- `public.abc_configurar_serie_documental(p_operation_id, p_empresa_id,
  p_local_id, p_tipo_documento, p_codigo_serie, p_nombre)`.
- Crea la serie si no existe (empieza su numeración en 1) o la reactiva si
  existía pero estaba desactivada — **nunca reinicia la numeración de una
  serie existente**, porque eso rompería la correlatividad legal del
  número.
- Exige el mismo permiso que el resto de piezas C05/C06/C07
  (`ABC_EMISOR_CAMBIAR`), con el mismo patrón de idempotencia
  (`abc_operacion_iniciar`/`completar`/`fallar`) que toda la Etapa 2-5.
- `SECURITY DEFINER`, `grant execute` limitado a `authenticated`.
- No toca ninguna de las piezas C05/C06/C07 ya existentes.

Aplicada en QA. Verificado: `SECURITY DEFINER`, grants
`postgres:EXECUTE, authenticated:EXECUTE`. Probado (sin usuario
autenticado, sin fabricar ninguna sesión) que la función rechaza
correctamente con `abc_serie_no_autorizada` y no deja ninguna fila en la
tabla — confirma que la puerta de permiso funciona antes de dar paso a
Cowork con la cuenta real de QA-EMP-A.

### 3.2 Modo simulador, no activación fiscal real

`abc_configurar_modalidad_fiscal` (ya existente) se llama con
`p_estado: "SIMULADOR"`. El propio servidor bloquea por código cualquier
intento de pasar a `ACTIVO` sin validación de asesoría
(`c07_activacion_requiere_validacion_asesoria`) — esta pieza nunca activa
nada fiscal real, solo prepara el simulador.

### 3.3 Pantalla (`fuente.js` y `source-recovery/fuente-recuperado.js`)

Nueva sección **"Factura a empresa"** en Cobro·F4, visible solo cuando la
cuenta está **PAGADO** (igual que cuando normalmente se entregaría el
ticket):

- Dos campos: **Nombre o razón social** y **NIF/CIF**.
- Botón **"Emitir factura (modo simulador)"**, que encadena en el
  servidor:
  1. `abc_configurar_serie_documental` (crea/activa la serie "FACTURA/FA"
     la primera vez; después solo repite el resultado sin re-ejecutar
     nada, por el mismo `operation_id`).
  2. `abc_configurar_modalidad_fiscal` (modo SIMULADOR; mismo patrón).
  3. `abc_reservar_numero_documental` (reserva el número, ligado al
     checkout de la cuenta).
  4. `abc_clasificar_documento` (tipo `FACTURA_COMPLETA`, con nombre y NIF
     del cliente).
  5. `abc_evaluar_documento_fiscal` (modo simulador — nunca pretende ser
     una verificación fiscal real).
  6. `abc_resolver_emision_documental` (marca el documento como
     `EMITIDO`; si la evaluación no quedó preparada, lo marca `ERROR` en
     vez de `EMITIDO` y se avisa en pantalla).
- Mensaje final: `Factura FA-000001 emitida (modo simulador) a <nombre>
  (NIF <nif>).`
- Los campos se vacían solos tras una emisión correcta.

## 4. Verificación

- `node --check` en ambos archivos: OK.
- `node .github/scripts/build-netlify-publish.mjs` + `node --check` del
  resultado: OK (hash de identificadores comparado entre fuente y dist).
- Prueba de contrato nueva
  (`tests/plan-maestro/etapa5-t6-factura-empresa-contract.mjs`): PASS —
  comprueba la sección de pantalla, que solo aparece con la cuenta
  PAGADO, que la modalidad fiscal nunca pide ACTIVO, el orden correcto de
  las llamadas (reservar → clasificar → evaluar → resolver) y que la
  migración exige el permiso correcto y no reinicia la numeración al
  reactivar una serie.
- Todos los contratos existentes de `tests/plan-maestro/` (Etapas 3, 4 y
  5): en verde, sin cambios de resultado.
- Manifiesto de CI actualizado (311→312 archivos, 294→295 contratos
  activos, Node 264→265).
- Probado en QA, solo lectura: sin usuario autenticado la función rechaza
  (`abc_serie_no_autorizada`) y la tabla de series sigue vacía.

## 5. Límites respetados

- No se ha tocado PROD.
- No se activa ninguna modalidad fiscal real (solo SIMULADOR).
- No se decide ni se guarda ningún dato fijo del NIF/razón social del
  propio negocio (emisor) — eso queda pendiente, fuera de esta pieza.
- No se ha tocado ninguna de las funciones C05/C06/C07 ya existentes.
- No se ha fabricado ni usado ninguna credencial para probar: la única
  prueba hecha desde aquí fue confirmar que la puerta de permiso rechaza
  sin usuario autenticado. La prueba con la cuenta real de QA-EMP-A queda
  para Cowork.

## 6. Bug encontrado y corregido en la primera prueba en vivo (24/10/2026)

La primera prueba de Cowork (cuenta PAGADO, campos rellenos, botón
pulsado) no hizo nada: ni mensaje, ni red, ni "Emitiendo…". Dos rondas de
investigación:

1. **Primer sospechoso (descartado): el botón deshabilitado.** El botón
   se deshabilitaba si el texto de los campos no coincidía con el estado
   de React. Se corrigió (el botón ya solo depende de que no haya otra
   emisión en curso), pero el fallo seguía igual tras repetir la prueba.
2. **Causa real: `emitirFacturaEmpresaF4` nunca llegaba al componente
   que dibuja el botón.** La función se definió dentro de
   `crearLogicaVenta()`, pero esa función nunca la devolvía en su
   `return`, el componente padre (`GestionAlmacen`) nunca la recogía de
   ahí, el componente `<VentaRapida>` (el que de verdad renderiza
   Cobro·F4) nunca la recibía como prop, y `VentaRapida` nunca la tenía
   como parámetro. Resultado: `typeof emitirFacturaEmpresaF4` daba
   `"undefined"` en tiempo de ejecución — confirmado en vivo con una
   traza de depuración temporal — y el botón cortaba la ejecución justo
   ahí, sin ninguna señal visible. Se corrigieron los cuatro puntos de
   conexión, siguiendo el mismo patrón que `resolverPagoSimuladoQAF4`
   (que sí funcionaba). Se añadió una comprobación al test de contrato
   para que esta clase de fallo — una función bien escrita pero nunca
   enlazada al componente — no pueda volver a pasar en silencio.

## 7. Cierre confirmado (24/10/2026)

Cowork repitió la prueba dos veces tras la corrección (recarga completa
entre medias): cuenta PAGADO, "Cliente Prueba S.L." / "B12345678",
"Emitir factura (modo simulador)". Mensajes en pantalla: `Factura
FA-000001 emitida...` y, en la segunda repetición, `Factura FA-000002
emitida...`.

Cowork reportó además, en ese mismo intento, que no veía tráfico de red
nuevo ni cambio de la consola — una lectura que resultó ser un resto de
una captura anterior (el aviso de depuración ya no existe en este
build). Para no depender de esa lectura, se comprobó directamente en la
base de datos de QA, solo lectura:

- `abc_c05_series_documentales`: serie `FACTURA/FA` creada a las 09:31,
  `siguiente_numero=3` (consistente con dos facturas ya emitidas).
- `abc_c05_documentos_emitidos` + `abc_c06_documentos_clasificados`:
  **dos filas**, números 1 y 2, ambas `estado=EMITIDO`,
  `tipo_documental=FACTURA_COMPLETA`, `datos_receptor={"nombre":"Cliente
  Prueba S.L.","identificador_fiscal":"B12345678"}`, evaluación
  `resultado=PREPARADO_SIMULADOR` / `modo=SIMULADOR` (nunca `ACTIVO`).

Los datos de la base de datos no dejan duda: el recorrido completo
(reservar → clasificar → evaluar → resolver) ocurrió de verdad, por
servidor, en modo simulador, con los datos exactos introducidos en
pantalla.

**T6, punto 3 (factura a empresa): cerrado.**

## 8. Pendiente

- Antes de usar esto con una factura real: NIF/razón social del propio
  negocio (emisor) necesita un sitio permanente donde guardarse (no
  existe hoy en la tabla `empresas`), y la validación de asesoría sigue
  pendiente para cualquier activación fiscal real (`ACTIVO`).
