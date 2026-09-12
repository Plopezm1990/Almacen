# PM26 P03b — Integración real: fuente canónica actualizada y gate permanente

## Estado

**Ejecutado y cerrado.** Se regeneró `fuente-recuperado.js` con paridad
exacta de cuerpo respecto al `fuente.js` actual (incluye PM14–PM25) usando
la firma compuesta validada en PM26 P03a. Se añadió un gate CI permanente
que compila la fuente canónica y verifica su integridad estructural. **No
se ha tocado el `fuente.js` real servido en runtime**, ni `index.html`, ni
Netlify, ni Supabase, ni QA, ni producción, ni TPV, ni `main`. Este
paquete no decide si `fuente.js` pasa a ser un artefacto generado en el
pipeline de publicación real — eso queda fuera de alcance (ver sección 5).

## 1. Recuperación inicial (una sola vez)

`recuperar_candidato_p03b.py` (nuevo — no modifica `recuperar_candidato.py`,
que queda intacto como registro histórico de PM01) reutiliza por import la
lógica de detección de la firma compuesta de
`p03a_deteccion_limite.py` (sin modificarlo) y la aplica sobre el
`fuente.js` **actual**, con una lista de anclas de negocio **ampliada**
respecto a las 3 mínimas de P03a — 11 anclas cubriendo PM15–PM25, en el
orden exacto en que aparecen:

| # | Ancla | Línea en `fuente.js` |
|---|---|---|
| 1 | `motivoFalloCargaPM16` | 101246 |
| 2 | `function GestionAlmacen(` | 101581 |
| 3 | `cambiarTabPM15` | 101625 |
| 4 | `__contextoErroresPM20` | 102747 |
| 5 | `bloqueadoPorNubeActivaPM25` | 103563 |
| 6 | `validarRegistroAppccPM19` | 104075 |
| 7 | `function crearLogicaCaja(` | 104503 |
| 8 | `activarSuscripcionPushPM17` | 111379 |
| 9 | `function ErroresSistema(` | 111470 |
| 10 | `estadoIdentidadFiscalPM18` | 111798 |
| 11 | `bloqueadoPorEnvioDuplicadoPM24` | 113290 |

Todas se localizaron y verificaron **en orden** antes de fijarlas.

**Resultado de la recuperación**: límite en línea 100771, cuerpo de
19.028 líneas / 1.523.192 bytes, `SHA256_CUERPO_BUNDLE == SHA256_CUERPO_RECUPERADO`
(`4f770d04...`) — paridad exacta, igual método que certificó PM01.
Evidencia completa en `PM26_P03B_EVIDENCIA.json` (no sobrescribe
`PM01_EVIDENCIA.json`, que sigue documentando la recuperación original).

**Precisión sobre qué demuestra esta igualdad de hashes (y qué no):** que
`SHA256_CUERPO_BUNDLE == SHA256_CUERPO_RECUPERADO` demuestra que el
contenido recuperado coincide, byte a byte, con el tramo de `fuente.js`
que el detector seleccionó -- **no demuestra por sí sola que ese tramo
sea el límite correcto** (un detector que cortara sistemáticamente en un
punto distinto produciría igualmente un hash coincidente entre "lo que
cortó" y "lo recuperado", sin que el corte fuera el correcto). La validez
del límite se sustenta, independientemente del hash, en sus propios
anclajes: unicidad de la firma compuesta (sección 2 de
`P03A_DETECCION_LIMITE.md`), orden y presencia de las 11 anclas de
negocio (tabla de arriba), comprobación del contexto inmediatamente
anterior y posterior al límite, y ausencia de comentarios de sección de
esbuild (código vendorizado) después de él. Sí puede afirmarse, con esa
base independiente, que el límite no es la causa de los 6 fallos de
contrato descritos en la sección 7.

### Diferencia estructural con el bootstrap de PM01

En el bundle **pre-PM14** (formato que usaba `recuperar_candidato.py`),
las dos líneas de bootstrap tras el marcador (`import_react4`,
`import_client`) eran shims internos de esbuild (`__toESM(require_react())`)
que no existen fuera del bundle completo — por eso PM01 las **eliminaba**
del cuerpo y las sustituía por `const` en la cabecera.

En el bundle **post-PM14** (el que usa la firma compuesta de P03a), las
dos líneas de bootstrap (`var import_react4 = Object.assign(...)`,
`var import_client2 = { createRoot: ... }`) ya **no** son shims internos:
dependen solo de nombres normales (`ReactNS`, `import_client`) que la
cabecera sigue proveyendo vía imports estándar. Por eso en P03b estas dos
líneas se **conservan como parte del cuerpo** en vez de eliminarse — la
cabecera ya no declara `import_react4` (lo declara ahora el propio
cuerpo) pero sigue declarando `import_client = { createRoot }`.

### Ajuste de la cabecera: alias `X as X2`

Se comprobó que el bundle actual usa el nombre desambiguado `X2` para el
icono `X` de `lucide-react` en todo el cuerpo (mientras que los otros 25
iconos de la cabecera original se siguen usando sin sufijo). Esto es la
misma situación que ya existía para `Map` (importado como `Map as Map2`
desde PM01) — se añadió el alias equivalente `X as X2` en la cabecera. Se
comprobó exhaustivamente (por script, no a mano) que ningún otro
identificador usado en el cuerpo carece de declaración local o de
cabecera: de 83 nombres usados como componente en `createElement(...)`,
57 tienen declaración local en el propio cuerpo (`Card`, `Field`,
`GestionAlmacen`, etc.) y los 26 restantes son exactamente los iconos de
la cabecera (25 sin alias + `X2`).

## 2. `entrada-recuperada.js`

Revisado, **sin cambios**: sigue importando únicamente
`../edge-auth-patch.js` y `./fuente-recuperado.js`. Se confirmó que
`fuente-recuperado.js` (ya regenerado con PM14–PM25) no contiene ninguna
referencia a `seleccion-neutral-patch.js` ni `auth-ux-patch.js` (0
coincidencias) — no se reintrodujo lo retirado en PM17.

## 3. Diagnóstico de reproducibilidad del build (honesto, no forzado)

Se ejecutó `npm run build` (esbuild, misma configuración que PM01) sobre
la `entrada-recuperada.js` con la fuente canónica ya regenerada, y se
comparó el resultado (`dist/fuente.js`) contra el `fuente.js` committeado
actual.

**Resultado: NO es byte-idéntico, ni siquiera línea a línea.**
`SHA256` distinto, 12.399 bytes y 301 líneas más en el build. Se
investigó la causa real, no se asumió:

- La firma compuesta de P03a (comentario + 2 líneas de bootstrap exactas)
  **no se reproduce igual** en el build fresco: esbuild reordena y
  duplica las 4 primeras líneas del cuerpo (`import_react4`,
  `import_client2`, `utils2`, `writeFileSync2`) con sufijos adicionales
  (`import_client22`, `utils22`, `writeFileSync22`) — un artefacto de
  cómo esbuild resuelve el módulo `fuente-recuperado.js` cuando la
  composición global del bundle es distinta a la del bundle histórico.
  Esto confirma, con un experimento independiente, la misma naturaleza
  del fenómeno de "aparición espuria" ya documentado en P03a (ligado al
  bundling de esbuild, no al contenido de la aplicación).
- Comparado el resto del cuerpo (a partir de `var C2 = {`, ya fuera de la
  zona de bootstrap): **166 hunks de diferencia** en ~19.000 líneas,
  pero de naturaleza sistemáticamente cosmética, verificada línea por
  línea en varias muestras:
  - esbuild **recorta algunos comentarios** de línea dentro de cuerpos de
    función al reimprimir el AST (p. ej. un bloque de 3 líneas de
    comentario sobre PM-09/LA-008 desaparece en el build) — sin efecto en
    tiempo de ejecución.
  - esbuild **renombra variables locales** con un sufijo numérico
    distinto según la tabla de símbolos global del bundle (p. ej. un
    parámetro `f2` pasa a llamarse `f22`) — el código es funcionalmente
    idéntico dentro de su propio ámbito, solo cambia el nombre elegido
    por el minificador/empaquetador.
- **Ninguna de las 166 diferencias observadas en las muestras
  inspeccionadas representa pérdida o alteración de lógica de negocio.**
  Se confirmó estructuralmente que las 11 anclas de negocio (misma
  lista de la sección 1) aparecen en el build, en el mismo orden, en
  posiciones consistentes con las del cuerpo canónico.

**Conclusión honesta**: el diseño originalmente propuesto ("el gate
permanente compara el resultado del build byte a byte contra el
`fuente.js` committeado") **no es alcanzable** con la configuración de
esbuild disponible — no porque el pipeline esté roto, sino porque esbuild
no garantiza una salida estable byte a byte entre distintas
composiciones de bundle. Exigir esa comparación produciría fallos falsos
permanentes del gate, no señal real de ningún defecto. Por eso el gate
permanente (sección 4) verifica lo que sí es alcanzable y sigue siendo
una señal real: que el build **compila sin errores**, que el resultado es
**sintácticamente válido**, y que **toda la lógica de negocio conocida
sigue presente y en orden**.

## 4. Gate CI permanente

`source-recovery/verificar-build-canonico.mjs` (nuevo): ejecuta
`npm run build`, valida `node --check` sobre el resultado, y verifica que
las 11 anclas de la sección 1 aparecen en el build en el mismo orden
(nunca compara contra `fuente.js` re-extrayendo su cuerpo — no hay
validación circular). Falla explícitamente si el build no compila, si el
resultado no es JS válido, si falta una ancla, o si aparecen fuera de
orden — verificado con 2 pruebas negativas reales (ancla eliminada;
fuente canónica con error de sintaxis), cada una revertida antes de
continuar.

`.github/workflows/pm26-p03b-pipeline-canonico.yml` (nuevo): instala
dependencias fijadas de `source-recovery/package-lock.json` y ejecuta
este gate en cada push que toque la fuente canónica.

`tests/pm26/p03b-contract.mjs` (nuevo): arnés de pruebas — positivo
sobre el repositorio real (build + gate en verde) y 2 negativos
sintéticos que demuestran que el gate detecta una divergencia real,
restaurando siempre el árbol de trabajo real antes de terminar.

## 5. Qué NO cambia en este paquete

- **`fuente.js` real servido**: intacto, sigue siendo la fuente de la
  aplicación en producción. Este paquete no lo sustituye ni decide
  hacerlo — esa es una decisión de despliegue posterior, fuera de
  alcance (tocaría Netlify), tal como ya cerró PM01: "esto NO autoriza
  todavía sustituir el bundle de producción ni fusionar a `main`".
- `index.html`, dependencias del proyecto raíz, `main`, Netlify,
  Supabase, QA, producción, TPV: sin tocar.
- `README.md` y `PM01_CIERRE.md`: sin tocar — este cierre queda en un
  documento nuevo, `PM26_P03B_CIERRE.md`.
- `recuperar_candidato.py` (PM01): sin tocar — sigue siendo el registro
  histórico exacto de cómo se recuperó la base original.

## 7. Corrección de contratos que dependían de `fuente-recuperado.js` congelado (PM05, PM07, PM08, PM09)

Al ejecutar la regresión completa tras regenerar `fuente-recuperado.js`
(sección 1), 6 comprobaciones repartidas en 4 contratos de paquetes ya
cerrados fallaron: `tests/pm05/frontend-contract.mjs` (1),
`tests/pm07/frontend-contract.mjs` (2, más 5 adicionales detectados al
auditar el archivo completo, no solo las 2 iniciales),
`tests/pm08/frontend-contract.mjs` (3) y
`tests/pm09/p17-robustness-contract.mjs` (1). Investigado caso por caso
(commit exacto del cambio, migración correspondiente cuando aplicaba,
comparación línea a línea del bloque de función completo), **ninguno es
una regresión funcional real**. Se confirmó que las 4 diferencias
originales (y las adicionales de PM07) están todas muy dentro del cuerpo
recuperado (líneas 101246–113290), lejos del límite (100771) y sin
ningún comentario de sección de esbuild entre medias -- el detector de
P03a no es la causa.

Tres causas raíz, todas con evidencia directa:

1. **`fuente-recuperado.js` nunca se regeneró entre su creación (previa a
   PM09) y esta corrección** -- varios contratos citaban ese snapshot
   como si fuera el código vivo, y nunca vieron correcciones reales
   posteriores: PM20 P02 (commit `47c3744`, defecto LA-016: añade
   validación real -- `validarProveedorPM10` -- al alta/edición de
   proveedores) y dos renombres de RPC de PM09 (`registrar_devolucion_venta`
   → `registrar_devolucion_venta_pm09`, `registrar_venta_stock_carrito` →
   `..._pm09`, `revertir_venta_stock_carrito` → `..._pm09`; commit
   `78cfd94`), cada uno con su función **definida en la migración
   versionada correspondiente** (`supabase/migrations/20260905115000_pm09_fecha_operacion_economica.sql`
   y `..._pm09_operation_id_global_hardening.sql`) -- no se hizo ninguna
   comprobación remota de backend real, solo lectura de las migraciones
   versionadas del repositorio.
2. **Renombrado de variables locales por esbuild** (`p2`→`p22`,
   `a2`→`a22`, `l2`→`l22`, `f2`→`f22`...), mismo fenómeno ya documentado
   en la sección 3 -- ocurrió en algún punto de la historia de edición
   directa de `fuente.js`, y el snapshot congelado simplemente no lo
   heredó. Comparación línea a línea de cada función afectada completa
   confirma que ningún otro carácter cambia.
3. **Convención de escritura de caracteres acentuados**: el mensaje de
   conflicto de idempotencia es el mismo mensaje exacto, pero
   `fuente.js` lo escribe con escapes (`\xF3`, `\xE9`) mientras el
   snapshot congelado lo tenía con el carácter UTF-8 literal (`ó`, `é`)
   -- ambas formas son el mismo string en tiempo de ejecución.

**Corrección aplicada** (los 4 contratos, mínima y dirigida a la causa,
nunca a maquillar el fallo):

- Ninguna assertion nueva sustituye simplemente `p2` por `p22` (eso
  volvería a romperse en el próximo renombrado) -- se reescribieron con
  `RegExp` que capturan el nombre real del parámetro/variable con un
  grupo y lo reutilizan por backreference (`\1`), válidas para cualquier
  nombre que el bundler elija.
- PM05: nueva función `verificarAltaValidadaConEmpresa` comprueba,
  dentro de `addProveedor`, que se llama a `validarProveedorPM10(data)`
  antes de mutar, que el fallo de validación detiene el alta (`if
  (!validacion.ok) return validacion`), que el registro usa los datos ya
  validados (`...validacion.datos`, no `...data`), y que `empresaId`
  queda fijado como propiedad shorthand incondicional. Un verificador
  análogo (`verificarEdicionLimitadaAEmpresa`) cubre `updateProveedor` y
  `updateCliente`. 4 pruebas negativas en memoria.
- PM07: `verificarTeoricoAutoritativo` y `verificarRetornoSinMutacionLocal`
  capturan el parámetro real de `diagnosticarStock`/`corregirProducto`
  sin presuponerlo. `verificarPrecedenciaAlertas` generaliza la
  detección de la forma ambigua (sin paréntesis) y la correcta con
  backreference. `verificarRpcVigente` exige la RPC vigente, rechaza
  explícitamente la antigua, y exige que esté definida en una migración
  versionada. 5 pruebas negativas en memoria, cada una elimina una
  garantía por separado.
- PM08: `verificarBloqueoArqueoActivo` generaliza el bloqueo por arqueo
  activo. `verificarRpcVigente` (mismo criterio que PM07) para
  `registrar_devolucion_venta_pm09`, sin aceptar indistintamente la RPC
  antigua. `verificarConflictoIdempotenciaPorResultado` comprueba el
  conflicto de idempotencia por su rama/resultado funcional (comparación
  `JSON.stringify(...) !== JSON.stringify(...)` y forma exacta del
  objeto devuelto en cada rama), no por la frase visible del mensaje de
  error. 4 pruebas negativas en memoria.
- PM09: se eliminó el `OR` entre `source` (`fuente.js` real) y
  `recovered` (`fuente-recuperado.js`) en las 4 comprobaciones de
  frontend -- ahora ambos deben superar cada garantía **de forma
  independiente**; el conflicto de idempotencia usa el mismo verificador
  por resultado funcional que PM08. 1 prueba negativa en memoria.

Cada prueba negativa opera sobre una **copia en memoria** del bloque de
función extraído (nunca sobre la aplicación real ni sobre
`fuente-recuperado.js`/`fuente.js` en disco), confirma primero que la
mutación sintética realmente cambió el texto (`assert.notEqual`), y
después que el verificador correspondiente detecta la ausencia exacta de
esa garantía (`motivo` esperado, no solo "falló").

No se modificó ninguna implementación de la aplicación (`fuente.js`,
`fuente-recuperado.js` salvo la regeneración ya descrita en la sección
1), ninguna migración, ni la documentación histórica de PM05–PM09. Solo
se modificaron los 4 archivos de contrato.

## 8. Riesgos y limitaciones reconocidas

- La reproducibilidad del build está limitada a la verificación
  estructural (anclas en orden + sintaxis válida), no a una comparación
  byte a byte. Un cambio que alterase lógica DENTRO del rango cubierto
  por dos anclas consecutivas sin tocar ninguna ancla no sería detectado
  por este gate — limitación reconocida, no oculta.
- El mecanismo exacto por el que esbuild reordena/duplica las líneas de
  bootstrap al recompilar sigue sin explicarse desde primeros principios
  (igual que la aparición espuria ya señalada en P03a) — se documentó su
  comportamiento observado, suficiente para descartarlo como riesgo de
  pérdida de lógica, pero no se investigó su causa interna en esbuild.
- La lista de 11 anclas, aunque más amplia que las 3 de P03a, sigue sin
  cubrir exhaustivamente cada función de negocio de PM15–PM25 — cubre una
  muestra representativa y bien distribuida, no la totalidad.

```
PM26_P03B_ESTADO=EJECUTADO_Y_CERRADO
PM26_P03B_FUENTE_RECUPERADA_ACTUALIZADA=SI
PM26_P03B_PARIDAD_CUERPO_EXACTA=SI
PM26_P03B_BUILD_BYTE_A_BYTE_CONTRA_FUENTE_JS=NO_ALCANZABLE_DOCUMENTADO
PM26_P03B_GATE_PERMANENTE_CREADO=SI
PM26_P03B_CONTRATOS_PM05_PM07_PM08_PM09_CORREGIDOS=SI
PM26_P03B_REGRESIONES_FUNCIONALES_REALES_ENCONTRADAS=0
PM26_P03B_FUENTE_JS_REAL_TOCADO=NO
PM26_P03B_FUENTE_JS_PASA_A_SER_GENERADO_EN_DESPLIEGUE_REAL=NO_DECIDIDO_AQUI
PM26_P03B_INDEX_HTML_TOCADO=NO
PM26_P03B_MAIN_TOCADO=NO
PM26_P03B_NETLIFY_SUPABASE_TOCADO=NO
PM26_P03B_RECUPERAR_CANDIDATO_PY_TOCADO=NO
PM26_P03B_DOCUMENTACION_HISTORICA_PM05_PM09_TOCADA=NO
```

PM25 P02 continúa PARCIAL/BLOQUEADO. Los defectos B–H de PM26 P01
permanecen pendientes.
