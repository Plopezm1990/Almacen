# Objetivo · terminar completamente el rediseño visual a Órbita

Abierto el 23/11/2026 · Rama `rediseno/f0-base-qa` · PR #225, borrador

## El objetivo

**Que las 236 pantallas trabajables del programa queden visualmente iguales a
la maqueta Órbita** (ordenador y móvil), sin cambiar ninguna función, hasta que
no quede ni una fila pendiente en `ORDEN-PANTALLAS-ORBITA.csv`.

Este objetivo no se da por alcanzado con un acta que lo declare. Se da por
alcanzado cuando **cada una de las 236 filas** tiene las cuatro marcas que
exige el plan: igual en ordenador, igual en móvil, batería en verde, visto
bueno tuyo. Ni una menos.

## El punto de partida real, no el que decía el acta de esta mañana

Antes de fijar este objetivo hice una comprobación que el acta de cierre de
esta mañana no hizo: entrar en el Deploy Preview con una cuenta de cargo
restringido (Camarero/a) y mirar la pantalla de Inicio con mis propios ojos.

**Resultado:** el acta de `ACTA_CIERRE_FINAL_REDISENO_ORBITA_2026-11-23.md`
no se sostiene tal cual. Hay una duplicación real y visible en Inicio —el
panel Órbita correcto y, debajo, un segundo panel de servicio que pertenece al
diseño Pase—, defendida por un contrato que la da por intencionada. El detalle
completo, con capturas descritas y la causa exacta en el código, está en
`CORRECCION_CIERRE_FINAL_ORBITA_2026-11-23.md`.

Esto no quiere decir que no se hiciera nada entre el 21 y el 23 de noviembre.
Se hizo mucho, y parte de ello es bueno: el panel nativo de Órbita para Inicio,
en `fuente.js`, coincide en estructura y en textos con la maqueta nueva. Lo que
cambia es esto:

- **Ninguna fila se hereda como «hecha» sin volver a mirarla.** La matriz
  anterior (`MATRIZ-CIERRE-VISUAL-ORBITA-2026-11-22.csv`) y el acta de esta
  mañana se tratan como **lo que alguien dijo**, no como lo que es cierto. El
  ciclo de ocho pasos de `PLAN_PANTALLA_A_PANTALLA_ORBITA_2026-11-23.md` se
  aplica también a las pantallas que ese acta daba por cerradas.
- El trabajo de días anteriores **ayuda y acorta camino**: si una pantalla ya
  coincide con la maqueta al comprobarla de verdad, su ciclo de ocho pasos se
  recorre rápido y queda firmada; si no coincide, se corrige igual que
  cualquier otra.
- El primer elemento de trabajo no es una pantalla cualquiera: es **decidir
  qué pasa con la duplicación de Inicio**, porque toca código que otra sesión
  escribió a propósito y no se borra sin más.

## Alcance

- Las **236 pantallas trabajables** de `ORDEN-PANTALLAS-ORBITA.csv` (las 31
  restantes —17 sin construir, 14 bloqueadas— quedan fuera hasta que existan o
  se desbloqueen; no cuentan para «completo»).
- Las dos referencias de cada pantalla, ordenador y móvil, las dos
  obligatorias.
- Solo capa visual: estructura, estilos, textos fijos y orden. Nunca permisos,
  RPC, validaciones ni el orden de los pasos de una operación de negocio.
- Ninguna operación económica real, ningún borrado, ninguna cuenta nueva sin
  avisar: sigue vigente todo lo autorizado hasta ahora, solo en QA.

## Cómo se mide el avance

Una sola fuente de verdad: `docs/rediseno/ORDEN-PANTALLAS-ORBITA.csv`, columna
«Estado visual». Tres valores posibles:

| Valor | Significa |
| --- | --- |
| `Pendiente` | No comprobada todavía en esta ronda, o comprobada y con diferencias por corregir |
| `En revisión contigo` | Paso 7 del ciclo: comparada y corregida, esperando tu visto bueno |
| `Terminada` | Las cuatro marcas cumplidas, con su evidencia en la columna de firma |

El objetivo está cumplido cuando las 236 filas trabajables dicen `Terminada` y
no cuando un documento lo afirme sin esa columna rellena.

## Primera decisión antes de la primera pantalla

Antes de tocar nada de `ini-01`, hace falta tu respuesta a una pregunta
concreta: el bloque de bienvenida («Hola, [nombre] · Turno de hoy · Fichaje»)
y el segundo panel de servicio («El turno en directo», con Plano de sala y
Accesos del turno) que aparecen hoy en Inicio **no están en la maqueta nueva**.
¿Se quitan de Inicio en Órbita, o tienen que quedarse en algún sitio y la
maqueta no lo refleja?

## Qué sigue después de esa respuesta

El ciclo de ocho pasos del plan, pantalla por pantalla, empezando por `ini-01`,
en el orden de `ORDEN-PANTALLAS-ORBITA.csv`. Sin empezar la siguiente hasta que
la anterior diga `Terminada`.
