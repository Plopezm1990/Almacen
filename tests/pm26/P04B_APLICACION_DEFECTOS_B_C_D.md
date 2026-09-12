# PM26 P04b — Aplicación de las correcciones B, C y D

## Estado

**Aplicado y cerrado.** Ejecuta exactamente la propuesta mínima
presentada en PM26 P04a (`tests/pm26/P04A_INSPECCION_DEFECTOS_B_C_D.md`),
sin ampliar su alcance. No se reabre PM05–PM09. No se mezclan el defecto
E ni los avisos F–H. `main`, Netlify, Supabase, QA, producción y TPV
intactos.

---

## 1. Defecto B — retirados los 10 archivos huérfanos

Eliminados: `chunk-43ACCR2P.js`, `chunk-CZ7CSFO4.js`, `chunk-SULEHD65.js`,
`chunk-WNPC2SID.js`, `html2canvas-5V7KZ5X4.js`,
`html2canvas-5V7KZ5X4-UL42RKXS.js`, `purify.es-TSVPIOEK.js`,
`purify.es-TSVPIOEK-6SSTY34W.js`, `index.es-SJCMKHSO.js`,
`index.es-SJCMKHSO-5BY7EMAG.js` (1.665.327 bytes en total) — ninguno
tenía consumidor fuera de su propio grupo (verificado exhaustivamente en
P04a) y las tres librerías que contenían (html2canvas, DOMPurify, canvg)
siguen presentes e inlineadas en `fuente.js`, sin cambio ahí.

`tools/seguridad/linea-base-aceptada.json` regenerado con la propia
herramienta (`regenerar-ledgers`), no editado a mano: pasa de 11 a 7
archivos (retira las 4 entradas `falso_positivo` de los archivos ya
eliminados; `deuda-identificadores-historicos.json` no cambia, 83
archivos). `verificar-secretos-e-identificadores.mjs verificar` sigue en
`VERIFICAR_SECRETOS=PASS`.

## 2. Defecto C — retirada la regla residual de `_headers`

Eliminadas únicamente las 3 líneas de `/seleccion-neutral-patch.js`
(regla + `Cache-Control` + línea en blanco). Las otras 6 reglas
(`/`, `/index.html`, `/manifest.json`, `/fuente.js`,
`/edge-auth-patch.js`, `/sw.js`) no se tocaron.

`edge-auth-patch.js` (hallazgo relacionado, fuera de alcance según P04a)
no se toca en este paquete.

## 3. Defecto D — separación aplicada

**Nuevo `pm11-compra-mobile-loader.js`**: exactamente el bloque
universal que antes vivía en las líneas 1–14 de
`reset-pruebas-preview.js` (guard de idempotencia
`window.__pm11CompraMobileLoaderV1`, sin ningún guard de host ni dato
QA), con un comentario que documenta la separación.

**`reset-pruebas-preview.js` reducido**: ya no contiene el bloque del
loader móvil. El resto del archivo (guard de host, constantes QA,
interceptor de `fetch`, reinicio de `localStorage`) queda **byte a byte
igual** que antes — no se ha tocado ni la URL ni la clave pública QA, ni
ninguna otra línea de la parte exclusiva de Deploy Preview.

**`index.html`**: añade
`<script src="./pm11-compra-mobile-loader.js"></script>` justo antes de
`<script src="./reset-pruebas-preview.js"></script>` — misma posición
temprana, sin condición, sin `defer`.

**Efecto real**: producción sigue descargando `reset-pruebas-preview.js`
(sigue siendo un archivo pequeño, ahora sin el bloque del loader), pero
ya no ejecuta ni transporta el código del loader móvil embebido en un
archivo pensado para QA -- el loader vive en su propio archivo,
universal, sin relación con la lógica de Deploy Preview. La propuesta de
P04a valoraba además mover el guard de host a `index.html` para que
producción ni siquiera pidiera `reset-pruebas-preview.js`; esa
alternativa más fuerte **no se aplica aquí** -- se mantiene la forma
mínima ya autorizada.

### Tests vivos actualizados/verificados

- `tests/pm11-compra/p10-regresion-integral-contract.mjs`: su aserción
  sobre "el layout se carga antes del guard QA, sin quedar limitado al
  preview" se reescribió para comprobar el archivo nuevo
  (`pm11-compra-mobile-loader.js`) en vez de una posición dentro de
  `reset-pruebas-preview.js`, y añade la comprobación de que
  `reset-pruebas-preview.js` ya no contiene el loader. **Pasa.**
- `tests/pm12/p10-preview-smoke-contract.mjs`: no necesitó ningún cambio
  (no asumía que el bootstrap PM11 ocurriera dentro de la misma
  ejecución de `reset-pruebas-preview.js`, tal como anticipaba P04a).
  **Pasa sin modificar.**
- Los 3 scripts/workflows muertos identificados en P04a (en ramas
  antiguas que no disparan aquí) **no se tocan** -- se mantiene la
  decisión ya documentada de dejarlos así.

## 4. Nota sobre el gate de PM26 P04a

El gate de P04a (`tests/pm26/p04a-contract.mjs`,
`.github/workflows/pm26-p04a-inspeccion-defectos-bcd.yml`) certificó,
correctamente, un estado de solo lectura que ya no es el actual -- ese
era su propósito: probar que la inspección no tocó nada, en el commit
exacto de P04a. No se reescribe esa certificación (seguiría siendo
histórica y válida para ese HEAD); el workflow de P04a no vuelve a
dispararse con este cambio (sus `paths` solo cubren sus propios
archivos, no `_headers`/`index.html`/`reset-pruebas-preview.js`/los 10
huérfanos), así que no entra en conflicto con este cierre. Si algún día
se re-ejecuta manualmente contra un HEAD posterior a este, fallará --
correctamente, porque el estado que certificaba ya no es el actual.

## 5. Verificación

- Regresión acumulada completa (`tests/g1` → `tests/pm26`, contratos
  P01–P03b): verde.
- `tests/pm11-compra/p10-regresion-integral-contract.mjs` y
  `tests/pm12/p10-preview-smoke-contract.mjs` (los dos tests vivos
  identificados en P04a): verdes, ejecutados como procesos reales.
- `verificar-secretos-e-identificadores.mjs verificar`: `PASS`.
- `node --check` sobre `reset-pruebas-preview.js` y
  `pm11-compra-mobile-loader.js`: válidos.

## 6. Reversión

Trivial vía `git revert` de este commit: restaura los 10 archivos, la
regla de `_headers`, el archivo `reset-pruebas-preview.js` sin dividir, y
retira `pm11-compra-mobile-loader.js` y su referencia en `index.html`.
Ningún cambio de esquema, backend, ni Netlify/Supabase por medio.

```
PM26_P04B_ESTADO=APLICADO_Y_CERRADO
PM26_P04B_DEFECTO_B_10_ARCHIVOS_ELIMINADOS=SI
PM26_P04B_DEFECTO_B_LEDGER_REGENERADO=SI
PM26_P04B_DEFECTO_C_REGLA_HEADERS_ELIMINADA=SI
PM26_P04B_DEFECTO_C_OTRAS_6_REGLAS_TOCADAS=NO
PM26_P04B_DEFECTO_D_ARCHIVO_UNIVERSAL_CREADO=SI
PM26_P04B_DEFECTO_D_RESET_PREVIEW_QA_ONLY_SIN_CAMBIOS_DE_CONTENIDO_QA=SI
PM26_P04B_DEFECTO_D_TESTS_VIVOS_ACTUALIZADOS_Y_VERDES=SI
PM26_P04B_DEFECTO_D_SCRIPTS_MUERTOS_TOCADOS=NO
PM26_P04B_MAIN_TOCADO=NO
PM26_P04B_NETLIFY_SUPABASE_TOCADO=NO
PM26_P04B_EDGE_AUTH_PATCH_TOCADO=NO
```

PM25 P02 continúa PARCIAL/BLOQUEADO. Defecto E y avisos F–H no se tratan
en este paquete.
