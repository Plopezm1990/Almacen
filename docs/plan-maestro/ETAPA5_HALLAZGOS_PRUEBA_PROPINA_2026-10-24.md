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

**Estado: NO investigado todavía.** Puede ser un fallo real de la rejilla
de productos (por ejemplo, un cierre que capturó el producto equivocado al
reordenarse la lista) o un problema puntual de la propia prueba. Hace falta
reproducirlo para saber cuál.

## 2. Error de base de datos visible en pantalla

Al cancelar una línea del pedido, apareció brevemente en pantalla el texto:

> ⚠ canceling statement due to statement timeout

Comprobado en los registros de QA (solo lectura): hay dos consultas que
agotaron su tiempo límite a las 07:12:40 y 07:12:41 del 24/10/2026 — coincide
con el momento que describe Pedro. Los registros no guardan qué consulta
exacta fue.

**Esto son dos problemas, no uno:**
1. Una consulta tardó demasiado (posible problema de rendimiento en
   cancelar una línea).
2. El error crudo de Postgres llegó tal cual a la pantalla, sin traducir —
   el mensaje debería ser algo como "No se pudo cancelar la línea, inténtalo
   de nuevo", nunca el texto técnico de la base de datos.

**Estado: NO investigado todavía.**

## Qué hacer con esto

No se ha tocado nada para corregir estos dos puntos — están fuera del
alcance de la Hoja QA-4. Pendiente de decidir con Pedro:

- Investigarlos ahora, aparte de T6.
- Dejarlos anotados para la Etapa 7 (pruebas completas en QA), que ya
  incluye un repaso de los 10 fallos de la auditoría y pruebas con datos
  reales.
