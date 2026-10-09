# Resultado de la publicación — alta automática de proveedores desde la foto del albarán

Fecha: 2026-10-09 · Estado: **PUBLICADO EN PRODUCCIÓN** · Paquete propio (PR 127).

## Autorización
Pedro respondió «Autorizo, haz la publicación tú» a la propuesta en la que le presenté la frase con el commit `2d95ee1ac40f4a856353e2d6cafd198cb48586b2` y el `sha256` de `fuente.js` `e39af0c42d135f471682e66a0dc46a86fc614d5919e6efc141c94b2e63eddaf1`. No reescribió la frase completa con la hora; tomé su respuesta como la autorización de **esa** propuesta concreta y, antes de fusionar, comprobé que nada había cambiado (ver abajo). Si se quiere el rigor literal de la hoja, esto queda anotado como una desviación consciente.

## Comprobaciones justo antes de fusionar (todas iguales a lo presentado)
- Cabeza del PR 127: `2d95ee1ac40f4a856353e2d6cafd198cb48586b2` (la fusión se hizo con `expectedHeadSha` igual a esa).
- Base `release`: `9ca58df6633da38edd259d215033a8f71802f587`, sin moverse; el PR era descendiente directo (sin conflictos).
- `sha256` de `fuente.js` en esa cabeza: `e39af0c42d135f471682e66a0dc46a86fc614d5919e6efc141c94b2e63eddaf1`.
- CI: 25 comprobaciones terminadas bien (puerta final, Postgres, Netlify), estado del PR «clean».
- QA: 8 de 8 escenarios OK (`RESULTADO_QA.md`).

## Lo que se hizo
1. Fusión **squash** del PR 127 en `release`: commit `ee3f57bba3534a52cd9fc89516b8cdc522f391f1` («ALB-PROV · Alta automática del proveedor desde la foto del albarán (#127)»).
2. Netlify publicó en producción el despliegue **`6ac891fd014636000880f339`** (estado `ready`, contexto `production`, publicado 2026-10-09 07:04:42 UTC, 11 s).
3. Comprobación del servido: `https://chic-entremet-9107cf.netlify.app/fuente.js` devuelve `sha256` **`e39af0c42d135f471682e66a0dc46a86fc614d5919e6efc141c94b2e63eddaf1`** (antes de la fusión devolvía `88fcf880…fbe8`, el de la ventana del 4/10).

## Lo que NO se tocó
Base de datos (ni migraciones ni datos), funciones de IA de producción (`importar-albaran` sigue en la v16), permisos, secretos. QA: el simulador de la IA sigue desplegado en QA (v2).

## Marcha atrás
Volver a publicar el despliegue anterior `6ac22344948ac900082766ab` (producción 4/10/2026, commit `bad4705`, `fuente.js` `88fcf880…`). No toca datos; los proveedores ya creados se quedan (auditados, borrables a mano).

## Pendiente
- Pantallas de producción, solo mirar (Cowork o Pedro): Proveedores (campo «NIF / CIF (opcional)») y Albaranes > «Foto con IA» (el proveedor dice «Detectar por la foto (recomendado)»), sin subir fotos ni guardar nada.
- La primera foto real de un albarán la hace Pedro: si el proveedor es nuevo se creará de verdad (marcado «Creado por IA · revisar»).
- Llevar `docs/alb-prov/` a `release` con un PR aparte `[skip netlify]` (la documentación vive hoy en la rama de trabajo).
- Opcional: volver el simulador de QA al corta-fuegos 503 (`GUIA_PRUEBAS_QA.md` §6).
- Fase 2: función de IA que distinga emisor/cliente con los datos propios; «Pegar texto» con la misma detección; fusionar proveedores duplicados.
