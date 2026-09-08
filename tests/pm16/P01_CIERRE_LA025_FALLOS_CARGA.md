# PM16 P01 — LA-025: diferenciar ausencia, corrupción, cuota y fallo de acceso

Primer punto de PM16 (Arranque, diagnóstico y respaldo).

## Diagnóstico (inspección de código real, ambas mitades del alcance de PM16)

### Arranque (`loadKey`) — bug real encontrado

`loadKey` capturaba en el **mismo** `catch` dos cosas categóricamente distintas:

1. Un fallo real de `window.storage.get` (red, permiso, cuota).
2. Un `JSON.parse` fallido sobre un valor guardado corrupto.

Ambos casos, tras agotar los reintentos, devolvían el `fallback` (normalmente un array
vacío) con **solo** un `console.error` — invisible para el usuario real de la aplicación.
Una colección legítimamente ausente (primer arranque de verdad) y un dato realmente dañado
o inaccesible eran **indistinguibles** desde fuera de la función. Es exactamente el síntoma
de LA-025: "Corrupción/permiso/fallo real siguen detectándose y no se ocultan" — se
detectaban en la consola, pero se ocultaban del usuario.

Además, reintentar un `JSON.parse` de un valor ya corrupto no tiene sentido (los mismos
bytes corruptos no se arreglan solos): el código anterior sí lo intentaba, desperdiciando
hasta 2 reintentos con 350ms de espera cada uno antes de rendirse.

### Respaldo/restauración — ya resuelto, no se toca

Se auditó `crearLogicaRespaldos`/`validarRespaldo` y el modal de restauración
(`pendingRestore`): **ya cumple el resto del alcance de PM16** sin necesidad de cambios —
valida estructura antes de aceptar un respaldo (rechaza JSON inválido y colecciones con
forma incorrecta sin tocar el estado), muestra vista previa completa (fecha, versión de
formato, comparación colección por colección con el estado actual, aviso explícito si se
perdería algo), crea un punto de recuperación automático antes de sustituir datos, y nunca
sobrescribe silenciosamente. No requiere ningún cambio para este punto.

## Solución (LA-025, arranque)

- **`loadKey`** separa las dos fases: obtener (`window.storage.get`, con reintentos — tiene
  sentido reintentar un fallo transitorio de red/acceso) y parsear (`JSON.parse`, sin
  reintentos — un dato corrupto no se arregla reintentando).
- **`motivoFalloCargaPM16(error)`** (función pura): clasifica el motivo real —
  `"cuota"` (detectado por `QuotaExceededError`/`code 22`, estándar de las Web APIs) o
  `"acceso"` para cualquier otro fallo de `window.storage.get`. La corrupción se clasifica
  aparte, directamente en el punto donde ocurre (`JSON.parse`), como `"corrupcion"`.
- **`notificarFalloCargaPM16`**: dispara un evento `fallo-carga` — mismo patrón ya existente
  y probado para `fallo-guardado` (que usa `saveKey`) — **solo** cuando hay un fallo real,
  nunca para el caso legítimo de "la clave no existe todavía" (que sigue devolviendo el
  `fallback` en silencio, sin evento, sin reintentos falsos: la otra mitad de LA-025 ya
  estaba bien y no se ha tocado).
- **Visibilidad end-to-end** (mismo patrón que `fallosGuardado`, reutilizado, no
  reinventado): un listener en el componente raíz guarda los fallos reales en estado, un
  banner rojo persistente (descartable) los muestra distinguiendo el motivo, y aparecen en
  un tile propio del Dashboard ("Arranque: datos que no se pudieron cargar") enlazando a
  Respaldos.
- El contrato de retorno de `loadKey(key, fallback, retries)` no cambia: los 39 puntos de
  llamada existentes no necesitan tocarse.

## Archivos

- `fuente.js`: `motivoFalloCargaPM16`, `notificarFalloCargaPM16`, `loadKey` reescrita
  (fases separadas); estado `fallosCarga` + listener del evento `fallo-carga`; banner
  sticky; prop y tile nuevos en `Dashboard`.
- `tests/pm16/p01-la025-loadkey-fallos-contract.mjs` (nuevo): clasificación de motivo pura;
  ausencia legítima sin reintentos ni evento; corrupción detectada sin reintentos
  inútiles; fallo de acceso transitorio que se recupera sin avisar; fallo de acceso
  persistente detectado y notificado; cuota clasificada correctamente.
- `tests/pm16/p01-la025-ui-fallos-carga-contract.mjs` (nuevo): el listener está conectado
  con los datos reales del evento, el banner distingue el motivo real, el Dashboard recibe
  el valor real desde la composición y lo muestra en un tile propio.

## Regresión

Suite completa: `tests/g1`, `tests/pm04`, `tests/pm05`, `tests/pm07`, `tests/pm08`,
`tests/pm09`, `tests/pm10`, `tests/pm11-compra`, `tests/pm12`, `tests/pm13`, `tests/pm14`,
`tests/pm15`, `tests/pm16` — sin regresiones.

## Estado de main/producción

`main` = `da7143b3b8a04003cf2212dee341ac5386383736` (release L&A Suite consolidado hasta
PM15), sin tocar directamente — este trabajo vive en la rama
`claude/pm16-arranque-diagnostico-respaldo`. Sin migraciones nuevas (cambio de frontend
puro, `window.storage` es un primitivo local del dispositivo, no Supabase). `L&A Suite`
(producción) y `TPV` no se han tocado.
