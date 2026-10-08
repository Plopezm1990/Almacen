# Hoja de autorización — publicar en producción el alta automática de proveedores desde la foto del albarán

Fecha de preparación: 2026-10-08 · Estado: `PREPARADA_NO_AUTORIZADA` · Paquete **propio** (un solo despliegue de la aplicación).

> **Esta hoja no autoriza nada por sí sola.** Leerla o estar de acuerdo no es la autorización. La autorización existe solo cuando Pedro escribe la frase de §5 con el commit y la huella (`sha256`) exactos. Una respuesta ambigua («vale», «adelante») no cuenta.

## 1. Qué se autorizaría (y nada más)

| # | Qué | Detalle |
|---|---|---|
| 1 | **Fusionar en `release` el PR de promoción de este paquete** | Es el **único despliegue** (Netlify publica `release` en producción). Contiene el cambio de `fuente.js` y su espejo, 3 pruebas nuevas, los contadores de CI y la documentación. |
| 2 | **Comprobar después lo servido** | `sha256` de `fuente.js` servido en producción = el de §4. Solo lectura. |
| 3 | **Pantallas, solo mirar** | Proveedores (aparece el campo «NIF / CIF (opcional)») y Albaranes > «Foto con IA» (el proveedor dice «Detectar por la foto»), **sin subir ninguna foto y sin guardar nada**. |
| 4 | **Marcha atrás si la aplicación falla tras publicarla** | Volver a publicar en Netlify el despliegue anterior (§4). No toca datos. |

**Cero cambios** en la base de datos (ni migraciones ni datos), en las funciones de IA de producción, en permisos o en secretos.

## 2. Lo que NO se autoriza

- Subir una foto real de un albarán en producción durante la verificación (eso **crearía un proveedor real**: lo hace Pedro cuando quiera, con un albarán real, sabiendo que quedará «pendiente de revisar»).
- Tocar la función `importar-albaran` de producción (fase 2, con su propia autorización).
- P3/P3b, B06–B10, PM09 o cualquier otro paquete.
- Escrituras en la base de datos de producción de cualquier tipo.
- Seguir adelante después de un fallo o de una diferencia.

## 3. Condiciones previas (todas, antes de decir la frase)

| ✔ | Condición | Cómo se comprueba |
|---|---|---|
| ☐ | **QA hecha** con la guía `GUIA_PRUEBAS_QA.md` (escenarios A–I) sin diferencias | Resultado anotado en `docs/alb-prov/RESULTADO_QA.md` |
| ☐ | **Candidato congelado**: commit exacto de la cabeza del PR de promoción y `sha256` de `fuente.js` | §4 se rellena con el valor real; si cambia una sola letra, se repite QA |
| ☐ | **El PR sale de `release`** y solo lleva este paquete | `git diff origin/release...` sin nada de otros paquetes |
| ☐ | **CI en verde** en esa cabeza (puerta de CI: 227 de 227 contratos activos + Netlify sin error) | Panel de comprobaciones del PR |
| ☐ | **`release` no se ha movido** desde que se creó el PR | Si se movió: actualizar el PR, repetir CI y volver a congelar |
| ☐ | **Despliegue de Netlify al que volver** anotado y comprobado como el actual | Último conocido: `6ac22344948ac900082766ab` (4/10/2026). Se vuelve a comprobar con Netlify el día de la publicación |
| ☐ | **Sin servicio crítico en curso** (no es obligatorio parar la tienda: el cambio no toca caja ni ventas) | Pedro lo valora |
| ☐ | **Pedro presente** hasta ver la comprobación de §1.3 | — |

## 4. Valores a congelar (se rellenan el día de la publicación)

| Dato | Valor |
|---|---|
| Rama del PR de promoción | `[RAMA]` (sale de `release`) |
| Commit de la cabeza | `[COMMIT]` |
| `sha256` de `fuente.js` esperado | `[SHA256]` |
| Despliegue de Netlify al que volver | `[DEPLOY_ANTERIOR]` |

Referencia (código en la rama de trabajo `claude/vigilant-hawking-uji8l4`, **no es el candidato final**, porque el candidato sale de `release`): el `fuente.js` de la rama de trabajo tiene `sha256` que cambiará con cualquier ajuste posterior; el candidato definitivo se calcula al crear el PR de promoción.

## 5. La frase (la que Pedro diría, con los huecos rellenados)

> «Autorizo publicar en producción el alta automática de proveedores desde la foto del albarán: fusionar en `release` el PR `[PR]` en el commit `[COMMIT]` (`sha256` de `fuente.js` `[SHA256]`), hoy `[FECHA]` a las `[HORA]`. Sin cambios en base de datos ni en las funciones de IA.»

## 6. Dónde paro (a la primera diferencia, sin seguir)

1. La CI del PR no está verde o el `sha256` del candidato no coincide con §4 → no fusiono.
2. Tras fusionar, Netlify no publica o el `sha256` servido no coincide → aviso a Pedro y propongo la marcha atrás (la hace Pedro o yo con su «sí»).
3. En las pantallas de §1.3 se ve algo distinto de lo esperado → aviso; si la aplicación no carga o da errores, marcha atrás autorizada de §1.4.

## 7. Después

- Anotar el resultado (commit, `sha256` servido, hora, despliegue) en `docs/alb-prov/RESULTADO_PUBLICACION.md`.
- La primera foto real la hace Pedro. Si el proveedor sale mal leído, se corrige o se borra desde Proveedores (queda auditado).
