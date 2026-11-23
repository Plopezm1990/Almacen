# Plan · Igualar el programa a la maqueta Órbita, pantalla a pantalla

23/11/2026 · Rama `rediseno/f0-base-qa` · PR #225 en borrador · Solo QA

## Lo que se pide

Que el programa tenga **la misma parte visual que la maqueta** preparada con
Codex, **sin tocar ninguna funcionalidad**, yendo **pantalla por pantalla** y
**sin empezar una hasta haber terminado la anterior**.

La maqueta de referencia es la **propuesta 7, Órbita**, en vista móvil:

```
http://192.168.1.129:8765/index.html?vista=movil#/screen/ini-01?propuesta=7
```

Su código está en `output/LA-Suite-Traspaso-QA/prototipo/dist/` (`orbita.css`,
`orbita.js`, `orbita-movil.html`) y su sistema visual en
`prototipo/revision/15-orbita.md`: fondo carbón `#17191C`, texto secundario acero
`#929DA7`, acción principal coral `#FF4B32`, titulares en degradado violeta-azul
(`#D0ABFF` → `#B0A6FF` → `#8CC3FF`), Inter en la interfaz e Instrument Serif en
cursiva para las palabras destacadas, iconos Lucide, tarjetas con borde de color
y superficie translúcida, y movimiento que respeta la preferencia de movimiento
reducido. La maqueta tiene las **267 pantallas** verificadas en Órbita.

## La regla que protege las funcionalidades

El programa ya separa la apariencia de la lógica, y este plan se apoya en eso en
vez de reescribir pantallas:

| Pieza | Qué hace | Se toca en este plan |
| --- | --- | --- |
| `fuente.js` (6,3 MB) | Toda la lógica: datos, permisos, cobros, RPC | **No**, salvo excepción justificada y con paridad |
| `la-apariencia.css` | Estilos por diseño, colgados de `[data-la-diseno]` | **Sí**, es donde va casi todo |
| `la-orbita-shell.js` | Marco común Órbita: cabecera, lateral, barra móvil | Sí, sin duplicar manejadores |
| `la-plantillas-orbita.js` | Composición de plantillas | Sí |
| `la-pase-panel.js` | Panel del turno en directo | Sí, con cuidado: lee datos reales |

Reglas que no se saltan en ninguna pantalla:

1. **Solo capa visual.** No se cambian manejadores, permisos, validaciones,
   llamadas al servidor ni el orden de los pasos de una operación.
2. **Los textos fijos, palabra por palabra** con la maqueta. **Los datos, del
   programa**: la maqueta muestra «Casa Oliva · Centro · 16,80 €» y QA muestra
   sus propios datos. Igualar es igualar estructura, no números.
3. **No se fingen datos.** Si la maqueta enseña algo para lo que el programa no
   tiene datos ni función —por ejemplo un gráfico de ventas de siete días—, no se
   pinta con datos inventados: se anota y se decide contigo en esa pantalla
   (construirlo, ocultarlo o dejar un hueco honesto).
4. **Todo cambio colgado de Órbita** (`[data-la-diseno="orbita"]`), para que las
   otras propuestas no se rompan mientras se trabaja.
5. **Ninguna pantalla se da por terminada con la batería en rojo** ni con la
   paridad de `fuente.js` rota.

## Fase 0 · Antes de la primera pantalla

Es bloqueante. Sin esto no se puede comparar ni comprobar ninguna pantalla.

**0.1 · Que el programa se pueda usar.** Hoy, con la cuenta de ensayo, la
aplicación se ve pero deja de responder a los pocos segundos: Firefox avisa de
que «esta página está ralentizando Firefox» y los paneles se quedan en
«Cargando…». Medido: la última llamada antes del parón es el **respaldo
automático diario** (`set historialRespaldos`, 640 KB, a los 4244 ms) y el hilo
deja de latir a los 5007 ms. La bisección que lo confirma o lo descarta ya está
montada. Mientras esto no esté arreglado, ninguna pantalla se puede verificar.

**0.2 · Herramienta de comparación lado a lado.** El panel del navegador de esta
sesión no es fiable para capturas. Se monta un guion con `playwright-core` (ya
está en el proyecto) y el Edge del sistema que, para un ID de pantalla, captura
**la maqueta y el programa al mismo tamaño** y los junta en una sola imagen:

- móvil **390×844**, que es la referencia que mandaste;
- escritorio **1440×900**, porque la maqueta también lo tiene y el mismo CSS
  sirve a los dos: arreglar solo el móvil puede romper el escritorio.

**0.3 · Quitar el andamio de diagnóstico** (`diagnostico-capas-almacen-preview.js`
y su línea en `index.html`) en cuanto el atasco esté resuelto.

**0.4 · Fijar Órbita como diseño de la empresa de QA.** Hoy el panel de inicio
muestra el contenido del panel Pase («El turno en directo»), no el de Órbita.

## El ciclo de cada pantalla

Cada pantalla pasa por los mismos ocho pasos, en este orden. La siguiente no
empieza hasta que la anterior tiene el paso 8.

1. **Captura de referencia.** La maqueta Órbita, en 390×844 y 1440×900, con el
   perfil equivalente (Propietaria en la maqueta, Propietario en QA).
2. **Captura del estado actual** del programa en QA, mismo tamaño, mismo perfil.
3. **Lista de diferencias**, una por línea, clasificada en una de tres:
   - *de estilo* → se arregla en `la-apariencia.css`;
   - *de estructura* (orden, agrupación, un elemento de más o de menos) → se
     arregla en el marco o en las plantillas, sin tocar la lógica;
   - *de función* (la maqueta enseña algo que el programa no hace) → **no se
     toca sin decidirlo contigo**; se anota.
4. **Cambios, solo en la capa visual**, colgados de Órbita.
5. **Comprobación de que no se ha roto nada:** batería entera de contratos,
   paridad de `fuente.js`, y el recorrido funcional de esa pantalla en QA (abrir,
   su acción principal, volver).
6. **Comprobación con un cargo restringido** (Camarero/a): que ve lo que le toca
   y nada más, y que la pantalla no se descoloca cuando faltan elementos.
7. **Nueva captura lado a lado** y revisión contigo.
8. **Cierre:** tu visto bueno, fila de `ORDEN-PANTALLAS-ORBITA.csv` en
   «Terminada» con la evidencia, commit, despliegue al preview.

**Terminada** significa las cuatro cosas a la vez: igual en móvil, igual en
escritorio, batería en verde y tu visto bueno. Si falta una, no está terminada.

## El orden

La lista completa, con el enlace a la maqueta de cada pantalla y su estado de
hoy en QA, está en **`docs/rediseno/ORDEN-PANTALLAS-ORBITA.csv`**. Va por
bloques: primero lo que se usa cada día en el turno, después el acceso, después
la gestión, y al final lo que se toca poco.

| Bloque | Área | Pantallas | En espera |
| ---: | --- | ---: | ---: |
| 1 | Inicio | 6 | 0 |
| 2 | Servicio (TPV y sala) | 34 | 4 |
| 3 | Cocina | 12 | 0 |
| 4 | Caja y fiscalidad | 25 | 1 |
| 5 | Acceso | 17 | 1 |
| 6 | Encargos y clientes | 12 | 1 |
| 7 | Compras | 30 | 0 |
| 8 | Inventario | 36 | 3 |
| 9 | Equipo | 26 | 3 |
| 10 | Calidad | 11 | 0 |
| 11 | Informes | 5 | 0 |
| 12 | Organización | 37 | 15 |
| 13 | Sistema | 16 | 3 |
| | **Total** | **267** | **31** |

**236 pantallas se pueden igualar ya.** Las 31 en espera son las 17 que todavía
no existen en QA y las 14 bloqueadas (sobre todo el panel de Plataforma, que
necesita la cuenta de administrador). No se tocan hasta que existan o se
desbloqueen.

**Por qué el Acceso va en el bloque 5 y no el primero:** las pantallas de
acceso no usan el marco común —van aparte, igual que el modo TPV a pantalla
completa—, así que no ayudan a las demás. Las del turno sí comparten marco y
componentes.

## La primera pantalla: `ini-01`, Panel general

Es la más grande de todas, y conviene saberlo antes de empezar: **lleva el
marco común** —cabecera, barra inferior móvil, lateral de escritorio—, que
después aparece en las otras 235. Una vez terminada `ini-01`, las siguientes
heredan el marco ya igualado y solo hay que trabajar su contenido.

Lo que enseña la maqueta en móvil, de arriba abajo:

- Etiqueta «Operación en vivo» con guiones; titular «⚡ El turno, *en
  movimiento.*» con la segunda línea en serifa cursiva y degradado.
- «Ventas, mesas y comandas de Centro.» y la fecha.
- Dos acciones: **Abrir TPV** (coral) y **Ver sala**.
- Tres tarjetas: **Ventas de hoy**, **Mesas ocupadas** y **Comandas activas**,
  cada una con icono, cifra y nota.
- **📈 Pulso de ventas**, últimos siete días, con «Ver informes».
- **📌 Pendientes del día**: recepciones pendientes, incidencias de fichaje y
  productos bajo mínimo.
- Barra inferior: Inicio, Sala, Caja, Resultados y Más.

Lo que enseña hoy el programa en esa ruta es otro panel: «El turno en directo»,
plano de sala, pedidos en servicio, accesos del turno y el selector de local. Así
que `ini-01` empieza con **dos decisiones tuyas**, que son de función y no de
estilo:

1. Si el inicio con Órbita debe ser el panel de la maqueta y no el del turno en
   directo.
2. De dónde salen «Pulso de ventas» y «Pendientes del día», y si el programa ya
   tiene esos datos. Si no los tiene, no se inventan.

## Ritmo, dicho con honestidad

Son 236 pantallas y cada una pasa por ocho pasos con verificación real. No va a
ser rápido, y no conviene que lo sea: el valor de ir una a una es justamente que
cada una quede cerrada.

Lo que sí acelera, sin romper la regla: muchas pantallas comparten plantilla
(listados, fichas, formularios, tablas). Cuando una pantalla obliga a arreglar
una plantilla, las siguientes que la usan llegarán ya más cerca. **Se siguen
firmando una a una**; solo cambia que habrá menos diferencias que corregir.

## Riesgos y cómo se cubren

| Riesgo | Cobertura |
| --- | --- |
| Un cambio visual rompe una función | Solo capa visual; batería entera y recorrido funcional en cada pantalla |
| Un estilo de una pantalla descoloca otra | Todo colgado de Órbita; captura de las pantallas ya terminadas del mismo bloque antes de cerrar |
| Igualar el móvil rompe el escritorio | Las dos medidas son obligatorias para dar una pantalla por terminada |
| La maqueta enseña algo que el programa no hace | No se finge: se anota como diferencia de función y se decide contigo |
| Un cargo restringido ve una pantalla descolocada | Paso 6 del ciclo, con la cuenta Camarero/a |
| El programa se atasca | Fase 0.1: no se empieza hasta resolverlo |
