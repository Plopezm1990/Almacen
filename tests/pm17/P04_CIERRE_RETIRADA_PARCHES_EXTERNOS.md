# PM17 P04 — Lote 4: retirada de los parches externos

Cuarto y último lote de PM17, según la matriz de
`docs/plan-maestro/PM17_DIAGNOSTICO_PARCHES.md` (punto 6), ejecutado solo tras cerrar y
verificar en verde los lotes 1-3 (rollback nativo de push, neutralización nativa de
Prefiltros/Entrevistas, auth UX nativa) — cumpliendo el punto 5 pedido explícitamente:
"Revisar compatibilidad antes de retirar cualquier parche o endpoint".

## Revisión de compatibilidad (antes de retirar)

- **Nada más referenciaba estos dos archivos.** Único punto de carga:
  el bloque de inyección dinámica en `fuente.js` (heredado de `edge-auth-patch.js`,
  L43871-L43888). `index.html`, `dashboard-premium-v2.js`, `pm11-compra-mobile-p10-v1.js`
  y el resto de scripts cargados no los mencionan — confirmado por búsqueda en todo el
  repositorio antes de tocar nada.
- **Todo lo que aportaban ya tiene equivalente nativo, cerrado y con gate verde:**
  - Rollback de suscripción push → `activarSuscripcionPushPM17` (lote 1).
  - Neutralización de Prefiltros/Entrevistas → `InformeEntrevistaNeutralPM17` /
    `ResumenPrefiltroNeutralPM17` (lote 2).
  - Recuperación de contraseña y logout de Propietario → enlace nativo en login y
    `debeMostrarLogoutPropietarioPM17` (lote 3).
- **La parte de `edge-auth-patch.js` que NO se retira** (aislamiento de `window.storage`
  por rol, guard de perfil activo, inyección de `Authorization` en Edge Functions) ya
  estaba inlineada como código nativo y síncrono en `fuente.js` desde el build original
  — nunca dependió de estos dos archivos ni de la inyección dinámica; sigue intacta.

## Cambio

- **`fuente.js`**: se retira el bloque de dos IIFE (L43871-L43888) que inyectaban en
  runtime `<script src="./seleccion-neutral-patch.js?v=2">` y
  `<script src="./auth-ux-patch.js?v=1">`. El resto del bloque heredado de
  `edge-auth-patch.js` (líneas anteriores) no se toca.
- **Repositorio**: se eliminan `seleccion-neutral-patch.js` y `auth-ux-patch.js` — ya no
  los carga nadie.
- **`edge-auth-patch.js` no se retira en este lote** (fuera del alcance acordado): sigue
  presente en el repositorio como archivo histórico/fuente, nunca cargado directamente
  por `index.html` ni por nada más — su contenido real y vigente vive inlineado en
  `fuente.js`. Queda como cabo suelto cosmético (sus dos últimas líneas de inyección
  ahora apuntan a archivos que ya no existen) para una limpieza futura fuera de PM17, sin
  ningún efecto en la app servida.

## Consecuencia práctica

La app deja de depender de que dos archivos JS sueltos se descarguen por red en runtime
para tener protección de push, neutralización de IA en selección de personal y auth UX de
Propietario — ahora es código nativo, síncrono, sin ventana de carrera frente al montaje
de React y sin punto único de fallo silencioso si un archivo no se despliega o se bloquea.

## Archivos

- `fuente.js`: bloque de inyección dinámica retirado.
- `seleccion-neutral-patch.js`, `auth-ux-patch.js`: eliminados.
- `tests/pm17/p04-retirar-parches-externos-contract.mjs` (nuevo): confirma que no queda
  ninguna referencia a los dos archivos en `fuente.js`, que ambos han desaparecido del
  repositorio, y que el resto del bloque nativo heredado de `edge-auth-patch.js` sigue
  intacto.

## Regresión

Suite completa: `tests/g1`, `pm04`, `pm05`, `pm07`, `pm08`, `pm09`, `pm10`,
`pm11-compra`, `pm12`, `pm13`, `pm14`, `pm15`, `pm16`, `pm17` (los 4 lotes) — 91/91 sin
regresiones.

## Estado de main/producción

`main` = `5db0b9ed03c8f8ecd700ff339edce1dff14ffde4`, sin tocar directamente. Frontend
puro, sin migraciones Supabase. No se ha activado ningún envío real ni retirado ninguna
función productiva más allá de los dos archivos ya sustituidos por su equivalente nativo
probado. `L&A Suite` (producción) y `TPV` no se han tocado.

## PM17 completo

Con este lote se cierran los 4 lotes de la matriz. PM17 (Integrar seguridad y
notificaciones) queda listo para el mismo proceso de release usado en PM14-PM16: revisión
de checks reales del PR, squash merge tras autorización explícita del usuario, verificación
de integridad del árbol, smoke post-merge.
