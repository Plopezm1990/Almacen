# F5 — P1: claves que el servidor rechaza por permisos (capa de sincronización)

Fecha: 2026-10-02
Estado: `IMPLEMENTADO_Y_PROBADO_EN_LOCAL_SIN_DEPLOY_SIN_VERIFICAR_EN_NAVEGADOR_REAL`
Archivos: `index-storage-bootstrap.js`, `tests/p1-denied-keys-solo-local.mjs`
Código base: `a5a4321`. Sin migraciones, sin cambios en `fuente.js`, sin deploy.

## Por qué cambió el diseño de P1

El análisis propuso dejar de subir `temaOscuro`, `movimientos` y `conteos`
(«solo local»). Antes de implementarlo se hizo una lectura mínima y solo de lectura
de producción (autorizada), que lo desaconseja:

| | QA | Producción |
|---|---|---|
| Políticas de `almacen_kv` | `pm05_almacen_*`: exigen `empresa_id` no nulo derivado de `value->>'empresaId'` | «acceso por rol y clave»: listas de claves por rol (`perfiles`), sin exigir empresa |
| Escritura de `productos`, `temaOscuro`, `conteos`, `historialRespaldos` | Rechazada (`42501`) | Permitida; existen las filas (`conteos` 1/10, `historialRespaldos` y `productos` 2/10 05:48 UTC, `temaOscuro` 26/9) |
| `movimientos_registro` | Solo política `SELECT` | Políticas de `INSERT`, `SELECT` y `DELETE` |
| Trigger `pm07_bootstrap_stock_desde_productos_kv` | Sí | Sí |

Un «solo local» fijo habría quitado a producción una sincronización que hoy
funciona (tema entre dispositivos, conteos, copia de seguridad, `productos`).
Además, **aplicar a producción las políticas PM05 de `almacen_kv` tal como están en
QA rompería esas sincronizaciones**, porque el cliente no manda `empresaId` en
estas claves. No se ha decidido promover nada; queda como riesgo a resolver antes
(véase P3 en `F5_ANALISIS_CLAVES_PENDIENTES_QA_2026-10-02.md`).

## Qué hace ahora

No depende de qué clave sea, sino de la respuesta del servidor.

- **El servidor acepta:** no cambia nada.
- **El servidor rechaza por permisos** (`code 42501` o mensaje «row-level
  security»/«permission denied»): la clave se anota aparte en
  `almacen__denegados` y se retira de `almacen__pendientes`. Sigue guardándose y
  leyéndose en este equipo. No se vuelve a intentar durante 6 horas. Pasado el
  plazo se reintenta una vez; si funciona, la marca se retira. Se emite una sola
  advertencia por clave y plazo y el evento `clave-solo-local`.
- **Fallo transitorio** (red, tiempo, sesión caducada): sigue como pendiente y se
  reintenta, igual que antes.
- **Lectura:** una clave con marca de denegada se lee de este equipo y no de la
  nube, igual que las pendientes, para que una copia antigua de la nube no pise lo
  que aquí no se pudo subir.
- **Aviso** (`#estado-guardado`): ya no dice «Subiendo N…» para claves
  rechazadas. Muestra «N colecciones solo en este equipo (el servidor no permite
  guardarlas)», o «Subiendo 1… · 1 solo en este equipo» si hay de ambos tipos.
  `window.__clavesSoloLocal()` lista las claves afectadas.
- Una cola antigua se limpia sola: al subir pendientes, las que el servidor rechaza
  pasan a «solo en este equipo».

## Pruebas

- Nuevo `tests/p1-denied-keys-solo-local.mjs` (9 escenarios): servidor que acepta,
  rechazo por permisos, no reintento dentro del plazo, lectura local, limpieza de
  cola antigua, fallo transitorio, rechazo sin código, reintento tras el plazo
  (con y sin éxito) y mezcla. Contra el código original **falla** (`['temaOscuro',
  'productos']` se quedan pendientes: el síntoma de QA) y con el cambio pasa.
- Siguen pasando: `pm05`, `pm07`, `pm08`, `p1-empty-kv-first-run`,
  `hotfix-barrera-reset-local`, `p2-p06` (contrato y stack) y
  `netlify-publish-boundary` tras regenerar `.netlify-dist` (requiere
  `tailwindcss 3.4.17`, instalado solo en local y sin añadir a Git).
- Carga real de la página con el cambio (Chromium, producción bloqueada): sin
  errores de JavaScript, API presente, 0 intentos hacia producción.

## Límites

- **No se ha desplegado** ni verificado en un navegador real contra QA: llega al
  navegador solo con un deploy, que no está autorizado.
- **No arregla que los datos no lleguen al servidor en QA.** `productos`,
  `conteos` y el resto siguen solo en el navegador. Cambia lo que se muestra y
  deja de repetir subidas rechazadas.
- El plazo de 6 horas y los textos del aviso son una propuesta; Pedro debe
  validarlos.
- Un navegador que ya tenga la cola antigua conserva su aviso hasta cargar la
  versión nueva.
