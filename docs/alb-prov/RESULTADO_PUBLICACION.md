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


---

# ALB-PROV-2 — publicación de la aplicación (9/10/2026)

Estado: **PUBLICADO EN PRODUCCIÓN** (la aplicación y, desde el apartado «Función de IA v17» de más abajo, también la función de IA).

## Autorización
Pedro: «Vale, primero arregla el texto cortado y después ya publica, autorizo» y, después, «publica ya». La cabeza definitiva del PR 128 no existía cuando lo dijo (había que hacer antes el arreglo del texto); la diferencia entre lo que había visto (`b451c6c`) y lo publicado (`ea76060`) es **solo** ese arreglo (3 líneas: el texto del desplegable y su prueba), que es lo que pidió. Desviación consciente respecto a la frase literal de la hoja, anotada aquí como la vez anterior.

## Comprobaciones justo antes de fusionar
- Cabeza del PR 128: `ea76060e4c66fff87357a30084a673c52523e1ef` (la fusión se hizo con `expectedHeadSha` igual a esa).
- Base `release`: `ee3f57bba3534a52cd9fc89516b8cdc522f391f1` (el squash del PR 127), sin moverse; el PR era descendiente directo.
- `sha256` de `fuente.js` en esa cabeza: `80dc0a9a23fb93a81b61bc14f7b4a6d498671b0a7bcdce9a9c130f272f8bdcbc` (igual al de la rama de trabajo).
- CI: 25 comprobaciones terminadas bien (puerta final, Postgres, Netlify). En local, antes: sintaxis, paridad del espejo, validador del manifiesto, los 204 contratos Node (antes del arreglo de texto) y a01/a02/a03/pm05/pm20 tras él.
- QA: Pedro vio en su móvil, en la vista previa de QA con el simulador v3, el proveedor nuevo con la ficha completa (nombre, NIF, dirección, web, correo, teléfono, condiciones y días de pago).

## Lo que se hizo
1. Fusión **squash** del PR 128 en `release`: commit `54c6ed9b2aaeb671207a16904372aad1840086be`.
2. Netlify publicó en producción el despliegue **`6ac89db60533f200086e4136`** (estado `ready`).
3. Comprobación del servido: `https://chic-entremet-9107cf.netlify.app/fuente.js` devuelve `sha256` **`80dc0a9a23fb93a81b61bc14f7b4a6d498671b0a7bcdce9a9c130f272f8bdcbc`** (antes de la fusión, el del PR 127: `e39af0c4…`); contiene «Completar su ficha con los datos de la foto» y ya no el texto largo del desplegable.

## Lo que NO se tocó
Base de datos, función de IA de producción (`importar-albaran` sigue en la **v16**), permisos, secretos. QA: el simulador sigue en la v3.

## Marcha atrás
Volver a publicar el despliegue anterior `6ac891fd014636000880f339` (PR 127, `fuente.js` `e39af0c4…`). No toca datos.

## Pendiente
1. **Desplegar la función de IA v17** (`docs/alb-prov/edge/importar-albaran_v17.ts`; solo cambia la instrucción) en producción, con autorización propia de Pedro y la huella del texto. Copia de la v16 para la marcha atrás: `…_v16_respaldo.ts`.
2. Tras desplegarla, Pedro vuelve a leer la foto de Arboliva: comprueba líneas y total, y pulsa «Completar su ficha con los datos de la foto».
3. Llevar `docs/alb-prov/` a `release` con un PR aparte `[skip netlify]`.
4. El aviso «1 colección solo en este equipo (el servidor no permite guardarla)» que sale en producción: es de otra colección (no del proveedor ni del albarán, comprobado contando filas); las claves que la aplicación guarda y la política antigua de `almacen_kv` de producción no admite son `configEmpresa`, `empresas` y `pagosFacturas` (esta última va por RPC). Investigar aparte.


---

# ALB-PROV-2 — despliegue de la función de IA v17 (9/10/2026)

Estado: **DESPLEGADA EN PRODUCCIÓN Y VERIFICADA**.

## Autorización
Pedro, en respuesta a mi descripción del cambio (solo cambia la instrucción que recibe la IA: añade la lectura de CIF del proveedor al pie legal, dirección, teléfono, correo, web y condiciones de pago): «Autorizo desplegar la función de IA». No incluye la frase literal de la hoja de autorización; desviación consciente, anotada aquí como en las publicaciones anteriores. El alcance autorizado es exactamente el cambio descrito.

## Lo que se hizo
- Proyecto `flqercbgpgmmfaakrwkc` (producción), función `importar-albaran`: de la **versión 16** a la **versión 17**.
- Fichero desplegado: `docs/alb-prov/edge/importar-albaran_v17.ts`, `sha256` `1ce6f983a419d2a73a0fc72b26a9226173487bc07895db79a457c17e1d301eea` (19 765 caracteres). Solo se diferencia de la v16 en un apartado nuevo del texto de instrucciones (antes de «## LÍNEAS») y en 8 campos nuevos del esquema de salida (tras `proveedorCif`).
- Ajustes de la función sin cambios: `verify_jwt` falso (la función hace su propia autenticación con perfiles Propietario/Encargado), `import_map` con `importar-albaran/deno.json`.

## Comprobaciones
- Estado de la función: versión 17, `ACTIVE`, `ezbr_sha256` `a659f0c1f39fd75e70b237afc99718c6908b7eb5c000e119a158f22bbf2db320`.
- Contenido vivo vuelto a descargar y comparado con el fichero del repositorio: **idéntico** (mismo `sha256`).
- Sin sesión: `POST` → 401 «Debes iniciar sesión para importar albaranes.» (igual que antes); `GET` → 405.
- No se llamó a la IA ni se subió ninguna foto en la comprobación (sin gasto).

## Lo que NO se tocó
Base de datos (ni datos ni estructura), políticas, secretos, la aplicación publicada (sigue en `6ac89db60533f200086e4136`, `fuente.js` `80dc0a9a…`) y QA (sigue con el simulador v3).

## Compatibilidad
La aplicación publicada ya acepta los campos nuevos y, si la IA no los trae, los ignora; la v16 también funciona con la aplicación actual. Por eso se puede volver atrás en cualquier orden.

## Marcha atrás
Volver a desplegar `docs/alb-prov/edge/importar-albaran_v16_respaldo.ts` (`sha256` `b649d268…`, copia literal de la v16 viva) con el mismo diseño de ficheros, `verify_jwt` falso e `import_map` `importar-albaran/deno.json`. No toca datos.

## Pendiente
1. ~~**Prueba real de Pedro:**~~ HECHA, «Todo bien» (ver apartado siguiente). Texto original: volver a leer la misma foto de Arboliva con «Foto con IA» en producción; comparar líneas y total con la primera lectura (v16); pulsar «Completar su ficha con los datos de la foto» (debería rellenar CIF A78540960, dirección, teléfono 91 616 57 45, correo arboliva@arboliva.com, web www.arboliva.es, condiciones «60 días» y 60 días de pago) y **no** dar entrada otra vez (volver atrás). Si las líneas o el total empeoran o los datos salen mal, se vuelve a la v16.
2. Llevar `docs/alb-prov/` a `release` con un PR aparte `[skip netlify]`.
3. Investigar aparte el aviso «1 colección solo en este equipo» (claves `configEmpresa`, `empresas`, `pagosFacturas`).
4. Opcional: volver el simulador de QA al corta-fuegos 503 (`GUIA_PRUEBAS_QA.md` §6).

## Prueba real de Pedro con la v17 (9/10/2026)
Pedro volvió a leer en producción, con «Foto con IA», la misma foto de Arboliva y respondió «Todo bien»: las líneas y el total salieron igual que en la primera lectura (v16) y «Completar su ficha con los datos de la foto» rellenó la ficha (CIF, dirección, teléfono, correo, web y condiciones de pago). No hizo falta marcha atrás: la v17 queda como versión viva. Pedro no copió datos de la ficha en el mensaje; solo confirmó el resultado.

