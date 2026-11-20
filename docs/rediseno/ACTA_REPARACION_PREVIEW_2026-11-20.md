# Acta de reparación del arranque del Deploy Preview 225

Fecha: 2026-11-20  
Rama: `rediseno/f0-base-qa`  
PR: #225, borrador, sin fusionar  
Producción: no tocada

## Síntoma

En el Deploy Preview 225 la aplicación parecía bloqueada en Chrome, Firefox y
el navegador de Codex. La pestaña dejaba de responder a lecturas del canal de
automatización y el usuario no podía interactuar con normalidad durante el
arranque.

## Causa técnica

Había un diagnóstico temporal cargado desde `index.html` que envolvía las capas
de `window.storage`, serializaba trazas y escribía en `localStorage` durante
cada lectura y escritura. No era código de producto y estaba en la ruta de
arranque del preview.

Además, `GestionAlmacen` construía y guardaba un respaldo automático completo
antes de terminar de dejar disponible la aplicación. La medición del
diagnóstico registró una escritura de aproximadamente 639.560 caracteres. Esa
serialización y persistencia competían con el primer render y hacían que la
interfaz pareciera bloqueada. El respaldo automático no se elimina: se difiere
hasta un hueco de inactividad del navegador.

La capa Órbita también observaba todo el árbol React. Se corrigió para no
reescribir nodos cuyo texto ya es igual y para agrupar las llamadas del
`MutationObserver`; así una actualización de la cabecera no puede alimentarse
a sí misma.

## Cambios realizados

1. Se retiró el `<script>` de `diagnostico-capas-almacen-preview.js` de
   `index.html`. El archivo queda fuera del runtime y no se publica como una
   dependencia de la aplicación.
2. Se versionó el enlace del almacenamiento como
   `qa-arranque-resiliente-v1-20261120` para invalidar la copia anterior del
   CDN.
3. El respaldo diario se programa con `requestIdleCallback` y fallback de
   `setTimeout`. Un fallo del respaldo se registra en consola, pero no impide
   utilizar la suite.
4. `index-loader.js` incorpora un watchdog de 20 segundos. Si React no monta
   ningún nodo, muestra un aviso accesible, explica que no se han borrado datos
   y ofrece el botón `Reintentar`.
5. `la-orbita-shell.js` usa escrituras de texto idempotentes y agrupa las
   mutaciones con `requestAnimationFrame`.
6. Se añadió `tests/rediseno/preview-arranque-resiliente-contract.mjs` y se
   registró en el manifiesto de la puerta de CI.

## Evidencia local

Contratos ejecutados después de los cambios:

- `PREVIEW_ARRANQUE_RESILIENTE=PASS`
- `REDISENO_P01_CAPAS_Y_MIGRACIONES_OK=1 capas=7 migraciones=2`
- `MARCO_ORBITA_CONTRACT=PASS (12/12)`
- `REDISENO_P05_PROPUESTAS_OK=1 disenos=9 paletas=6 responsive=PASS`
- `REDISENO_ORG33_SALA_CONTRACT=PASS`
- `REDISENO_P03_BOTONES_SOLO_ICONO_OK=1 solo_icono=3 mudos=0`
- `REDISENO_P06_PROPINA_CONTRACT=PASS`
- `UI_CONTEXT_BRIDGE_PASS`
- `SOURCE_RECOVERY_CHECK=PASS`
- `MANIFEST_VALIDATOR_NEGATIVE_TESTS=PASS`
- `git diff --check`: limpio

La batería completa y la comprobación en las tres superficies se registran en
esta misma acta cuando el nuevo Deploy Preview termine de publicarse.

## Publicación y primera comprobación live

Netlify publicó el commit `c1893e30468b1174777e65ec371dca9d44990419` en el
Deploy Preview #225:

- estado: `ready`;
- deploy: `6b00a94e6de18dc69d58d259`;
- URL: `https://deploy-preview-225--chic-entremet-9107cf.netlify.app/`;
- escaneo de secretos: cero coincidencias.

En una pestaña nueva y visible del navegador de Codex, con caché nueva, se
observó lo siguiente:

- `#root` montado con `QA-EMP-A · QA-A1` y el panel operativo;
- 67 botones encontrados, todos los primeros controles habilitados;
- tres segundos después el árbol seguía montado y sin `#error-arranque`;
- consola sin errores ni avisos.

La comprobación directa de las ventanas nativas de Chrome y Firefox queda
pendiente porque ambas están minimizadas para la superficie de automatización.
No se declara todavía el objetivo como terminado hasta observarlas en primer
plano o recibir evidencia equivalente de una carga e interacción completas.

## Estado de QA

- No se ejecutaron cobros, reembolsos ni escrituras nuevas para esta reparación.
- No se modificó producción.
- El PR #225 permanece en borrador.
- Los datos y cuentas de QA anteriores quedan intactos.
- Pendiente de cierre: confirmar en Chrome, Firefox y el navegador de Codex que
  el preview nuevo monta la interfaz, permite hacer clic y no queda en
  `Cargando almacén…`.
