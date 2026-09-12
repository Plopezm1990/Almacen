# PM26 P03a — Detección experimental del límite del cuerpo de aplicación

## Estado

**Diagnóstico validado experimentalmente. No se ha sustituido ni
sobrescrito ningún archivo del pipeline existente** (`recuperar_candidato.py`,
`fuente-recuperado.js`, `entrada-recuperada.js`, `rebuild-current.mjs`,
`dist/fuente.js` — ninguno tocado). No se ha modificado `fuente.js`,
`index.html`, dependencias, `main`, Netlify, Supabase, QA, producción ni
TPV. Todo lo nuevo vive en `source-recovery/p03a_*`.

## 1. Comparación entre los tres bundles históricos

| Bundle | Commit | Fecha | Bytes | Líneas |
|---|---|---|---|---|
| A — último con `// fuente.jsx` | `7f792925d6a3d27334ee0e7335ba635b4ed79b6b` | main congelado, previo a la consolidación | 5.414.885 | 129.658 |
| B — primero sin marcador (post-PM14) | `767a2c3163f924b7599338785fe4331f78f0e1ac` | 2026-09-08, "consolidación acumulada hasta PM14" | 5.425.479 | 119.413 |
| C — actual (esta rama) | HEAD de `claude/pm26-preparacion-tecnica` | hoy | 5.451.100 | 119.798 |

`git log -S'// fuente.jsx' -- fuente.js` localiza el commit exacto donde
el marcador desapareció: **B es hijo directo de A**, y B ya no lo
contiene. El commit B es un merge de 1031 commits de desarrollo (G1,
PM04, PM05, PM07-PM14) "hacia main" — por su propia naturaleza (fusión de
historial acumulado, no una re-ejecución limpia del bundler original)
no conservó el comentario de sección que esbuild dejaba en A.

## 2. El ancla nueva: por qué y con qué evidencia

Se buscó en B y C la cadena `// fuente-recuperado.js` (el nombre del
archivo que `recuperar_candidato.py` genera). Aparece **dos veces** en
ambos, no una:

| | Bundle B | Bundle C |
|---|---|---|
| 1ª aparición (espuria) | línea 43890 | línea 43872 |
| 2ª aparición (real) | línea 100789 | línea 100771 |

La 1ª aparición está seguida de `var ReactNS = __toESM(require_react(), 1);`
y luego, en la línea siguiente, del comentario de sección
`// node_modules/@supabase/supabase-js/dist/tracingRegistry.mjs` — es
decir, es un efecto del *hoisting* de imports de esbuild, no el inicio
real del cuerpo; tratarla como límite incorporaría código vendorizado
por delante del cuerpo real.

La 2ª aparición está seguida, en ambos bundles, EXACTAMENTE por:
```
var import_react4 = Object.assign({ default: ReactNS.default }, ReactNS);
var import_client2 = { createRoot: import_client.createRoot };
```
y a continuación por `var C2 = { bg: ... }` — el mismo patrón exacto de
transición que existía en el bundle A justo después del marcador antiguo
(`// fuente.jsx` → `var import_react4 = __toESM(require_react());` →
`var import_client = __toESM(require_client());` → `var C2 = {`). Esta
correspondencia estructural (comentario + 2 líneas de bootstrap +
arranque inmediato de `C2`) es la evidencia de que la 2ª aparición es el
equivalente funcional del marcador desaparecido.

**Firma compuesta usada como ancla**: el comentario `// fuente-recuperado.js`
seguido, en las dos líneas siguientes exactas, de esas dos
reasignaciones de bootstrap. Verificado con una búsqueda de la firma
completa (no solo el comentario suelto): **exactamente 1 coincidencia**
en B (línea 100789) y **exactamente 1** en C (línea 100771). Cero
coincidencias en A (que usa el formato antiguo, correcto y esperado — el
detector nuevo no debe ni puede aplicarse a bundles pre-PM14).

## 3. El límite propuesto conserva el cuerpo completo

Comprobado con 7 anclas de negocio conocidas sobre el bundle C:

| Ancla | Línea | ¿Antes o después del límite (100771)? |
|---|---|---|
| `obtener_contexto_operativo` | 43716 | **Antes** — correcto: es una llamada RPC (`supabase.rpc("obtener_contexto_operativo")`) dentro del bloque de `edge-auth-patch.js` inlineado, que nunca formó parte del cuerpo recuperado (ver `docs/plan-maestro/PM17_DIAGNOSTICO_PARCHES.md`, ya documentado en PM26 P01). |
| `function GestionAlmacen(` | 101581 | Después |
| `function crearLogicaCaja(` | 104503 | Después |
| `function ErroresSistema(` | 111470 | Después |
| `registrar_pago_factura` | 104408 | Después |
| `bloqueadoPorEnvioDuplicadoPM24` | 113290 | Después |
| `bloqueadoPorNubeActivaPM25` | 103563 | Después |

Ninguna función de negocio conocida (de PM01 a PM25) aparece antes del
límite propuesto. Se comprobó además que no hay ningún otro comentario de
sección de esbuild (`// <ruta>`) entre la línea 100771 y el final del
archivo — el tramo final es un único bloque continuo, sin código
vendorizado intercalado. La cola del archivo (bloque de licencia ISC de
una librería empaquetada) también existe, en la misma forma, al final
del bundle A histórico — no es una fuga nueva, es contenido ya aceptado
como parte del "cuerpo" desde PM01.

## 4. El detector experimental (`p03a_deteccion_limite.py`)

Implementa exactamente esta firma compuesta + verificación de anclas
obligatorias en orden, y **falla explícitamente** (nunca elige en
silencio) ante:
- cero coincidencias de la firma compuesta;
- más de una coincidencia;
- ausencia de cualquier ancla de negocio obligatoria después del límite;
- anclas fuera del orden esperado.

No sustituye a `recuperar_candidato.py` — es un módulo nuevo, aislado,
pensado para integrarse (o no) según lo que decida el usuario en P03b.

## 5. Resultados de las pruebas (`p03a_test_deteccion.py`)

```
POSITIVO fuente_js_real=PASS (línea límite 100771, 3 anclas encontradas)
POSITIVO fixture_control=PASS (línea límite 3, 3 anclas encontradas)
NEGATIVO ancla_ausente=PASS (cero coincidencias de la firma compuesta)
NEGATIVO ancla_duplicada=PASS (2 coincidencias -- ambiguo, no se elige ninguna)
NEGATIVO ancla_desplazada=PASS (ancla obligatoria ausente después del límite)
NEGATIVO orden_alterado=PASS (ancla fuera de orden)
P03A_PRUEBAS=PASS (2 positivas + 4 negativas, cada una por el motivo exacto esperado)
```

Las 4 pruebas negativas usan fixtures **sintéticos** en
`source-recovery/p03a_fixtures/` (código de relleno inventado, nunca una
copia del bundle real) — cada una diseñada para fallar por un motivo
distinto y verificado que el mensaje de error corresponde exactamente a
ese motivo, no a otro.

## 6. Riesgos y casos ambiguos (honestos, no descartados)

- **Acoplamiento con la plantilla de cabecera de `recuperar_candidato.py`**:
  la firma de bootstrap (`import_react4 = Object.assign(...)`,
  `import_client2 = { createRoot: ... }`) coincide con las líneas que ese
  script ya escribe en su `cabecera`. Si esa plantilla cambia en el
  futuro, el ancla deja de coincidir — el detector fallaría de forma
  explícita (cero coincidencias), no en silencio, pero requeriría
  actualizar ambos a la vez.
- **Mecanismo de la aparición espuria no explicado desde primeros
  principios**: se documentó su comportamiento exacto (posición,
  contenido siguiente) en dos bundles reales, suficiente para descartarla
  con seguridad, pero no se investigó el motivo interno exacto de por qué
  esbuild la genera dos veces. No afecta a la fiabilidad del detector
  (que exige la firma completa de 3 líneas, no el comentario suelto),
  pero se registra como zona no completamente explicada.
- **Riesgo residual de coincidencia accidental**: si algún día apareciera
  por azar la cadena `// fuente-recuperado.js` seguida línea por línea de
  un patrón que casualmente coincidiera con las dos regex de bootstrap,
  el detector podría fallar con "varias coincidencias" (seguro, se
  detiene) o, en el peor caso, elegir mal si solo hay una coincidencia
  real y una casual con exactamente esa forma — probabilidad muy baja
  dada la especificidad de las regex (nombres de variable exactos), pero
  no matemáticamente nula.
- **Renombrar cualquier ancla de negocio** (`GestionAlmacen`,
  `crearLogicaCaja`, `ErroresSistema`) rompería el detector — comportamiento
  correcto (falla explícita), pero exige mantenimiento de la lista de
  anclas si el código cambia esos nombres.
- **Lista de anclas obligatorias deliberadamente mínima** en esta ronda
  (3 nombres, todos ya validados desde PM01). P03b deberá ampliarla con
  funcionalidad específica de PM15-PM25 antes de confiar en el detector
  para producción.

## 7. Grafo de entrada actual (condición 8 — no reintroducir lo retirado en PM17)

Ya verificado en PM26 P01 y reconfirmado aquí: el `fuente.js` actual **no**
contiene ninguna referencia a `seleccion-neutral-patch.js` ni a
`auth-ux-patch.js` (0 coincidencias) — ambos fueron retirados
deliberadamente en PM17 P04 junto con su bloque de inyección en tiempo de
ejecución. El `README.md` histórico de `source-recovery/` todavía los
menciona como "parte del runtime del proyecto" — **eso es documentación
desactualizada, no un requisito**. Cualquier diseño futuro de
`entrada-recuperada.js` (P03b) no debe reintroducir esa importación.

## 8. Diseño de transición hacia una fuente canónica (propuesta para P03b — NO aplicada)

Se separan expresamente los dos conceptos pedidos:

**(a) Recuperación inicial (una sola vez)**: usar el detector validado
aquí para extraer, una única vez, el cuerpo actual de `fuente.js` (que ya
incluye PM14-PM25) y regenerar `fuente-recuperado.js` con paridad exacta
de cuerpo — igual que hizo `recuperar_candidato.py` en PM01, pero con el
ancla nueva. Este paso usa el artefacto (`fuente.js`) como origen porque
es, precisamente, el único rescate posible: no existe otra copia de esos
cambios.

**(b) Pipeline permanente (a partir de ese punto)**: una vez recuperada y
versionada, `fuente-recuperado.js`/`entrada-recuperada.js` pasan a ser la
**fuente de verdad**. A partir de aquí, el gate de CI **nunca** vuelve a
extraer el cuerpo desde `fuente.js` para comparar contra sí mismo —
eso sería la validación circular que el usuario advirtió explícitamente
que no se puede hacer. En su lugar, el gate permanente compila
`entrada-recuperada.js` con esbuild y compara el **resultado del build**
contra el `fuente.js` committeado — dirección única: fuente canónica →
build → ¿coincide con lo publicado? Si algún paquete futuro necesita
tocar la aplicación, se edita la fuente canónica, no `fuente.js`
directamente, y `fuente.js` pasa a ser un artefacto generado.

**Sin acumulación indefinida de parches de texto**: el patrón de
`post-pm08-patches/` + `rebuild-current.mjs` (una serie fija de parches
`.patch` aplicados en orden, con SHA de cada paso fijado en un
manifiesto) es exactamente el mecanismo que el usuario pide NO repetir
indefinidamente. La propuesta de P03b, en cambio, es de una sola vez:
recuperar el cuerpo actual completo (que ya integra PM14-PM25 como texto
final, no como una cadena de parches por PM), fijarlo como nueva
fuente canónica, y a partir de ahí el pipeline es directo
(canónica → build → artefacto), sin más parches acumulados encima.

### Lista de archivos que P03b necesitaría modificar (a autorizar aparte, no ahora)

- `source-recovery/recuperar_candidato.py` — adoptar el detector validado
  (o una versión madura de él) en lugar del marcador `// fuente.jsx`.
- `source-recovery/fuente-recuperado.js` — regenerar con paridad exacta
  contra el `fuente.js` actual (PM14-PM25 incluido).
- `source-recovery/PM01_EVIDENCIA.json` — o un nuevo
  `PM26_P03B_EVIDENCIA.json` que no sobrescriba el histórico de PM01.
- `source-recovery/entrada-recuperada.js` — revisar que su grafo de
  imports siga sin `seleccion-neutral-patch.js`/`auth-ux-patch.js`
  (condición 8, ya verificado que el `fuente.js` actual tampoco los usa).
- Un nuevo workflow de CI **permanente** que compile desde la fuente
  canónica y compare contra `fuente.js`, ejecutando además toda la
  regresión vigente del proyecto contra el resultado — a diseñar y
  autorizar en P03b, no en este punto.
- `source-recovery/README.md` y `PM01_CIERRE.md` — no se reescriben;
  P03b añadiría un `PM26_P03B_CIERRE.md` nuevo, igual que se ha hecho en
  todo este paquete con P01/P02.

```
PM26_P03A_ESTADO=DIAGNOSTICO_VALIDADO_EXPERIMENTALMENTE
PM26_P03A_DETECTOR_INTEGRADO=NO
PM26_P03A_RECUPERAR_CANDIDATO_MODIFICADO=NO
PM26_P03A_FUENTE_RECUPERADA_MODIFICADA=NO
PM26_P03A_ENTRADA_RECUPERADA_MODIFICADA=NO
PM26_P03A_REBUILD_CURRENT_MODIFICADO=NO
PM26_P03A_DIST_FUENTE_MODIFICADO=NO
PM26_P03A_WORKFLOW_PERMANENTE_CREADO=NO
PM26_P03A_FUENTE_JS_TOCADO=NO
PM26_P03A_MAIN_TOCADO=NO
```

PM25 P02 continúa PARCIAL/BLOQUEADO. Los defectos B-H de PM26 P01
permanecen pendientes. P03b (integración real, autorización aparte)
queda pendiente de que el usuario revise esta evidencia.
