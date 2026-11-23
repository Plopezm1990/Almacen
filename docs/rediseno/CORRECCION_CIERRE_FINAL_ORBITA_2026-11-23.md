# Corrección al «Acta de cierre final · rediseño visual Órbita»

23/11/2026, por la tarde · Corrige `ACTA_CIERRE_FINAL_REDISENO_ORBITA_2026-11-23.md`
(SHA `db7ac239`, publicada esa misma mañana a las 09:30)

## Qué decía el acta

Que «el marco visual Órbita queda consolidado para los doce módulos de la
suite» y que la batería de 22 contratos de `tests/rediseno/*.mjs` pasaba
entera, con paridad de `fuente.js` intacta. Presentaba esto como un cierre.

## Qué no se comprobó

Buscando «la-pase-panel», «Hola,», «Turno de hoy» o «duplicad» en
`EVIDENCIA_LIVE_ORBITA_2026-11-23.md`, el documento de evidencia que acompaña
el acta, **no aparece ninguna mención**. La pantalla de Inicio (`ini-01`) no
se comprobó en vivo con una cuenta de cargo restringido.

## Lo que hay de verdad en el Deploy Preview, hoy, con `qa.permisos.20261116@qa.invalid` (Camarero/a)

Entrando en `ini-01` aparecen **dos paneles de turno, uno debajo del otro**:

1. Una ficha «Hola, QA Permisos TPV 20261116 · Camarero/a · Local A1» con
   «Turno de hoy: sin turno asignado» y un aviso de fichaje. Esto no está en
   ninguna de las dos maquetas (ordenador ni móvil) de la propuesta Órbita.
2. El panel Órbita correcto: «OPERACIÓN EN VIVO», «El turno, *en movimiento.*»,
   fecha, Abrir TPV / Ver sala, Pulso de ventas con datos reales (€7,00),
   Pendientes del día con alertas reales (1 · Stock bajo). **Esta parte sí
   coincide con la maqueta** en estructura y en contenido.
3. Inmediatamente debajo, **un segundo panel completo**: «El turno *en
   directo.*», «Mesas, comandas y acciones del servicio», con tarjetas «Plano
   de sala», «Pedidos en servicio» y «Accesos del turno». Esto es
   `la-pase-panel.js`, el panel de servicio que se escribió para el diseño
   Pase, montado también sobre Órbita.

Capturas tomadas hoy, con el panel del navegador a la vista: la duplicación
se ve directamente en pantalla, no es una lectura de código.

## Por qué pasó, y por qué no es un despiste cualquiera

No es un olvido suelto: hay un contrato que **defiende la duplicación como si
fuera correcta**. `tests/rediseno/componentes-orbita-contract.mjs:92-93`
exige que `la-pase-panel.js` busque `.la-panel-diseno` como ancla y se
inserte justo después, «para no romper la jerarquía Órbita». Y
`la-pase-panel.js:48` incluye `"orbita"` en `esPanelServicio`, con una cadena
de versión `qa-orbita-pase-v5-20261122` — tocado ayer, 22/11, el día antes del
acta de cierre.

Es decir: alguien montó esto a propósito ayer, escribió un contrato que lo
confirma, y hoy por la mañana el acta de cierre lo dio por bueno sin
comprobarlo con una cuenta real. El propio comentario de cabecera de
`la-pase-panel.js` sigue diciendo que esto «se monta... cuando la empresa usa
el diseño Pase» — en singular, sin mencionar Órbita — así que ni el comentario
ni el acta están de acuerdo con lo que el código realmente hace.

## Lo que esto cambia

- El acta de cierre final **no se puede dar por buena sin volver a comprobar
  cada pantalla**, exactamente como ya preveía
  `PLAN_PANTALLA_A_PANTALLA_ORBITA_2026-11-23.md`. No se descarta el trabajo
  de los commits de los días 21 a 23 — la parte de Órbita en `fuente.js` para
  Inicio coincide bien con la maqueta nueva — pero no se da por cerrado nada
  sin volver a mirarlo con los propios ojos.
- La duplicación está **acotada a la pestaña Inicio** (`tabActual ===
  "dashboard"`): `la-pase-panel.js` solo se monta ahí. No es un problema
  repartido por las 267 pantallas.
- Queda una decisión de producto, no de estilo, para antes de tocar `ini-01`:
  si el bloque de bienvenida y fichaje y el segundo panel de servicio deben
  **quitarse** de Inicio en Órbita (porque la maqueta nueva no los lleva), o
  si deben **quedarse en otro sitio** de la pantalla, o si hay una razón de
  negocio para mantener los dos paneles que no se ve en el código. Se pregunta
  al dueño del producto antes de borrar nada que otra sesión escribió a
  propósito.

## Lección para no repetirla

Un acta que dice «verificado» sin una cuenta real de un cargo restringido no
prueba nada sobre lo que ve ese cargo. Esta misma sesión ya lo había aprendido
por las malas el 20/11 con el fantasma de «Local principal», y vuelve a
aparecer aquí. El ciclo de ocho pasos del plan pantalla a pantalla —incluido el
paso 6, probar con un cargo restringido— existe precisamente para que esto no
vuelva a colarse.
