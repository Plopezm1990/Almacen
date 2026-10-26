# Hallazgos reportados durante la prueba en vivo de la Hoja QA-4 (propina)

Fecha: 24/10/2026. Reportados por Pedro (vía Cowork), mientras montaba el
pedido de prueba antes de llegar a Cobro. **No están relacionados con la
tecla de propina** (que cerró correctamente) — se anotan aparte para no
mezclar alcances.

## 1. Clic abrió el configurador de otro producto

Al añadir productos del catálogo (en "Artículo varios (QA)" y alrededor),
un par de clics abrieron por error el diálogo de configuración de
"Bocadillo de jamón (QA)" en vez del producto pulsado. Pedro canceló ambos
sin añadir nada, así que no generó datos malos.

**Investigado (24/10/2026), solo lectura de código, sin tocar nada:**

- Cada tarjeta de producto usa `key: p22.id` (clave estable, nunca por
  posición) y su `onClick` captura directamente ese mismo producto de la
  iteración — no hay forma de que el cierre de JavaScript apunte al
  producto equivocado.
- La rejilla es CSS Grid de verdad (`grid grid-cols-2 sm:grid-cols-3`), que
  por defecto estira todas las tarjetas de una fila a la misma altura —
  una tarjeta sin foto no debería quedar más baja que sus vecinas y
  desplazar los clics hacia la fila siguiente.
- La foto del producto tiene su alto fijado por CSS
  (`.tpv-product-photo { height: 72px }`) antes incluso de que la imagen
  cargue, así que el hueco se reserva de inmediato: no debería haber un
  salto de maquetación al terminar de cargar la foto.

**No he encontrado un fallo de código que lo explique.** Lo más probable es
un doble clic accidental, o un detalle de cómo Cowork automatiza los
clics (por ejemplo, pulsar antes de que un diálogo anterior terminara de
cerrarse). Si vuelve a pasar con un clic humano normal, lo retomo con los
pasos exactos para reproducirlo.

## 2. Error de base de datos visible en pantalla

Al cancelar una línea del pedido, apareció brevemente en pantalla el texto:

> ⚠ canceling statement due to statement timeout

Comprobado en los registros de QA (solo lectura): hay dos consultas que
agotaron su tiempo límite a las 07:12:40 y 07:12:41 del 24/10/2026 — coincide
con el momento que describe Pedro. Los registros no guardan qué consulta
exacta fue.

**Esto eran dos problemas, no uno:**
1. Una consulta tardó demasiado (posible bloqueo entre operaciones
   concurrentes sobre la misma línea de stock).
2. El error crudo de Postgres llegó tal cual a la pantalla, sin traducir.

**Investigado y corregido el punto 2 (24/10/2026).** El traductor de
errores (`errorRpcA02`, usado por toda la Etapa 3-5) tiene una lista de
~150 códigos conocidos con su mensaje en español, pero cuando no reconoce
el código, **devolvía el texto técnico tal cual** en vez de un mensaje
genérico. Se añadieron tres casos nuevos antes de ese último recurso:
tiempo agotado, bloqueo entre operaciones, y cualquier otro código crudo
de PostgreSQL (detectado por su forma `XXNNN:` o `ERROR:`/`FATAL:` al
principio del mensaje) — los ~150 casos ya traducidos no cambian.

Comprobado en QA (`show statement_timeout`): el rol `authenticated` tiene
un límite de 8 segundos por consulta, a propósito, para no dejar ninguna
pantalla colgada esperando. Los dos avisos de las 07:12:40 y 07:12:41
confirman que algo chocó con ese límite ese día — probablemente un
bloqueo breve entre dos operaciones casi simultáneas sobre la misma línea
(coincide con los clics seguidos que describes en el punto 1). Con el
límite de 8 segundos ya puesto, este tipo de choque puntual es algo que
el sistema está diseñado para encajar con un reintento, no un fallo grave;
lo que faltaba era que el aviso en pantalla fuera comprensible, y eso ya
está corregido.

**Punto 1 (por qué chocó) sigue sin una causa exacta identificada** — no
hay suficiente detalle en los registros de ese momento para saberlo con
certeza. Si vuelve a pasar, lo normal es que ahora se vea como "La
operación ha tardado demasiado y se ha cancelado. Inténtalo de nuevo." en
vez del texto técnico.

## Qué se hizo

Cambio pequeño y de bajo riesgo en `fuente.js` y
`source-recovery/fuente-recuperado.js` (la función de traducción de
errores, compartida por toda la Etapa 3-5): 3 líneas nuevas antes del
último recurso, nada más tocado. Probado: `node --check`, los 10
contratos de las Etapas 3-5 y el manifiesto de CI, todos en verde.
