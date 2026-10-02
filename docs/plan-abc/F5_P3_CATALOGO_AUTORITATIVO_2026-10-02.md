# F5 — P3: ruta autoritativa del catálogo del TPV y precio con IVA incluido (D31)

Fecha: 2026-10-02
Entorno: Supabase QA `qjqorixtkilwsndqayyx` (solo QA). Producción no se tocó. Deploy solo como preview de QA del PR 118 (ver «Despliegue no pedido»).
Autorización: «Autorizo P3 y D31 con IVA incluido» (Pedro, 2/10/2026).
Código base: `a5a4321` + documentación de esta rama.
Estado: `MIGRACION_APLICADA_EN_QA_VERIFICADA_EN_BACKEND_PUENTE_V1_PROBADO_EN_PREVIEW_118_PUENTE_V2_VERIFICADO_EN_PREVIEW_118_P3B_ESPEJO_APLICADO_EN_QA_VERIFICADO_EN_BACKEND_Y_EN_PANTALLA_POR_PEDRO`

No cierra ningún requisito: A02, A03 y A04 siguen `INCOMPLETO` (falta verlo en pantalla).

## Qué problema resuelve

1. **No existía camino de los productos de la pantalla al catálogo del TPV.** La pantalla
   guarda los productos en la colección `productos` y el servidor vende contra
   `catalogo_tpv_productos`. La migración PM10 solo copiaba un producto de prueba de un
   negocio con nombre fijo. En QA, además, la política PM05 de `almacen_kv` rechaza las
   listas.
2. **El precio con IVA no cuadraba.** El formulario pide «Precio de venta CON IVA» y el
   servidor sumaba el IVA encima (3,30 € se cobraría a 3,63 €). Decisión D31: el precio de
   carta lleva el IVA incluido.

## Qué se hizo

### Base de datos (migración `20261002150000_abc_p3_catalogo_autoritativo`)

Aditiva. Aplicada en QA; no aplicada en producción.

| Pieza | Qué hace |
|---|---|
| Columna `catalogo_tpv_productos.precio_con_impuesto` (nullable) | `NULL`: comportamiento anterior, sin cambio. Con valor: precio de carta con IVA incluido |
| Restricción `abc_catalogo_precio_con_impuesto` | El precio base debe coincidir con `precio_con_impuesto / (1 + IVA)` (tolerancia 1e-8) |
| `abc_calcular_linea_tpv` y `…_configurada` (A03/A04) | Con precio con IVA, el **total sale exacto** de cantidad × precio; base e impuesto se derivan del total y suman exactamente el total. Con `NULL` la fórmula es literalmente la anterior |
| `abc_catalogo_guardar_productos` (RPC) | Crea o actualiza el catálogo, desactiva lo que deja de ser vendible, crea el stock inicial si falta |
| `abc_catalogo_puede_gestionar` y `abc_catalogo_numero` (privadas) | Permiso por local y lectura numérica tolerante |

Decisiones de diseño y por qué:

- `precio_unitario` sigue siendo el **precio base**: lo que ya lo consume (la vista previa de
  la pantalla, que calcula `precio_unitario × (1 + IVA)`, las instantáneas de línea) sigue
  funcionando sin tocar el paquete `fuente.js`.
- Un precio base redondeado a 8 decimales **no** garantiza totales exactos al céntimo
  (p. ej. 7 × 1,99 con 21 %); por eso el total se calcula desde el precio con IVA y no al
  revés.
- Las opciones de variante (A04) **siguen en base sin IVA**, igual que la pantalla las
  calcula; la RPC no gestiona opciones.
- RPC: permiso `Propietario` o `Encargado` del local (misma lógica de membresía que
  `abc_tiene_capacidad`), `operation_id` (replay idempotente y conflicto si llega con otro
  contenido, mediante el control de A03), máximo 200 productos, resultado por producto
  (`CREADO`, `ACTUALIZADO`, `SIN_CAMBIOS`, `DESACTIVADO`, `OMITIDO` con motivo). Solo toca lo
  recibido: lo ausente nunca se desactiva por inferencia. La versión solo sube si cambia algo
  de venta. El stock inicial solo se crea si la fila no existe; nunca pisa el stock vivo.
- No inventa el contexto fiscal: usa el vínculo fiscal activo del local y falla con
  `catalogo_contexto_fiscal_ausente` o `…_ambiguo` si no hay exactamente uno.
- Permisos de ejecución: solo `authenticated`; `anon` y `service_role` reciben `42501`.

### Pantalla (`ui-context-bridge.js`, sin tocar `fuente.js`)

Un puente nuevo, en un archivo que ya se publica (sin ampliar la frontera de publicación):

- Observa los guardados de `productos` y envía **solo las diferencias de venta** (nombre,
  unidad, fraccionable, precisión, precio, IVA, activo, tipo, local) contra la última lista
  conocida de la sesión. Sin lista de referencia no envía nada. Un cambio de stock no
  dispara el catálogo. (Versión 2, ver «Corrección del puente»: la comparación ignora la
  empresa, las marcas internas y los números escritos como texto; solo envía guardados hechos
  por una persona; nunca desactiva por ausencia; no envía más de 25 cambios de golpe.)
- Se ejecuta después del guardado heredado y en segundo plano: un fallo del puente nunca
  rompe el guardado de la pantalla.
- Reintentos con el mismo `operation_id` mientras el contenido no cambia. Si el servidor no
  tiene la RPC (producción antes de promoverla) se apaga en silencio y la pantalla sigue como
  antes. Sin permiso: se descarta y se avisa una vez. Sin contexto fiscal: queda pendiente y
  no entra en bucle.
- Volcado completo solo explícito: `window.__catalogoTpv.sincronizarTodo()`.

## Pruebas

| Prueba | Dónde | Resultado |
|---|---|---|
| Contrato vivo `tests/p3/p3-catalogo-contract.sql`: migración + 51 comprobaciones en una transacción con `ROLLBACK`, con usuarios suplantados por rol | QA (ensayo en seco, antes de aplicar) | **Todo correcto**: 0 fallos |
| Cuadrícula de redondeo: 3.960 cálculos (≈165 precios × IVA 0/4/10/21 % × 6 cantidades) | QA, dentro del contrato | 0 fallos: total = cantidad × precio con IVA y base + impuesto = total |
| Mismos importes que antes al convertir el catálogo sembrado (45 combinaciones) | QA | Idénticos |
| `tests/p3-catalogo-bridge.mjs`: 21 escenarios del puente (v2) en una máquina virtual | Local | Pasa; 6 mutantes del puente se detectan (la v1 tenía 16 escenarios y 3 mutantes) |
| `tests/p3/p3-catalogo-static-contract.mjs`: forma de la migración y compatibilidad con A03/A04 | Local | Pasa |
| Regresión (conjunto de la v1): 67 contratos pasan (F3, F4, F5, puente de contexto, P1, PM05/07/08, frontera de publicación) | Local | Los mismos 12 de siempre fallan por entorno (sin PostgreSQL/PGlite local). La batería completa de la v2 está en «Corrección del puente» |

Casos que cubre el contrato vivo (resumen):

- **Permisos:** Cajero/a de A1, Encargado de A2 y Propietario de otra empresa reciben
  `abc_catalogo_no_autorizado`; `anon` y `service_role` reciben `permission denied`.
- **Sincronización:** 15 productos sembrados pasan a precio con IVA y versión 2 con los
  mismos importes; repetir el mismo `operation_id` devuelve el resultado original; el mismo
  id con otro contenido da `operation_id_conflict`; otro id con el mismo catálogo no sube
  versiones.
- **Altas:** 3,30 € al 10 % → base 3,00; 1,99 € al 21 %: 7 uds = 13,93 exacto; 4,45 € al
  21 %: 3 uds = 13,35; granel 0,333 kg a 19,80 € = 6,5934.
- **Venta por el circuito ABC** (sesión, cuenta, pedido, línea) con productos creados por P3:
  la línea de 3 × 1,99 € tiene total 5,97 y la de 0,333 kg 6,5934.
- **Variantes (A04)** con producto a precio con IVA: capuchino + Mediano + leche de avena =
  2,20 (igual que antes); 3 uds = 6,60.
- **Baja y omisiones:** desactivado deja de venderse (`producto_tpv_no_disponible`);
  omisiones con motivo (sin local, otro local, otra empresa, sin nombre, precio inválido,
  IVA inválido, no vendible, id duplicado, sin id); lista vacía, no-lista, más de 200,
  moneda inválida, moneda sin contexto fiscal y local sin contexto fiscal.

Estado persistido en QA tras aplicar (consultas de catálogo): migración registrada, columna y
restricción presentes, `SECURITY DEFINER` con `search_path` vacío, ACL solo `authenticated`
en la RPC y solo propietario en las privadas, 0 filas con `precio_con_impuesto`, catálogo /
stock / `almacen_kv` en 30 / 83 / 25 (sin cambios), 0 operaciones P3 persistidas, 0 residuos.

**Estado de QA después de la prueba en el preview 118 (leído del servidor):** las 30 filas del
catálogo ya tienen `precio_con_impuesto` (30 de 30, versión 2, última modificación 13:47 UTC)
con los mismos totales que antes; es decir, la conversión «base → IVA incluido» del catálogo
sembrado ocurrió de verdad desde un navegador real. «Agua 50 cl (QA)» sigue en 0,99 € con IVA
(base 0,90) en A1 y A2: a la hora de esta lectura **no había llegado ningún cambio de precio
hecho a mano**.

## Límites y hallazgos

1. **Verificación posterior a la aplicación incompleta.** Tras aplicar la migración lancé una
   prueba corta de humo con `ROLLBACK`; su registro no se devolvió (el `SELECT` final lo
   tapó) y no repetí la llamada porque fue rechazada. La evidencia funcional es la del ensayo
   en seco (mismo SQL, mismo estado de QA) más las consultas de catálogo de arriba.
2. **Pantalla.** El puente v1 llegó a un navegador real (preview 118) y envió al servidor.
   El puente v2 (corregido, ver abajo) está probado en máquina virtual local y, sin que
   se hubiera pedido, llegó también al preview 118 (ver «Despliegue no pedido»); no se ha visto
   en un navegador. El catálogo sembrado de QA ya está convertido a precio con IVA (ver arriba).
3. **Camino de vuelta: resuelto en QA por P3b para los cambios de venta de productos existentes**
   (ver «P3b» más abajo). Lo que sigue sin existir: los productos **dados de alta** en la pantalla
   llegan al catálogo, pero no a la lista de la nube (la pantalla no puede escribirla en QA), así que
   tras recargar no aparecen en la pantalla aunque el servidor los tenga.
4. **Importes fraccionados sin redondear a céntimos.** El servidor calcula a 8 decimales
   (D17 sigue provisional): 0,333 kg a 19,80 € da 6,5934, que no se puede cobrar ni
   conciliar al céntimo. Ya ocurría con el precio base; no se ha cambiado.
5. **Opciones de variante en base sin IVA** y sin RPC ni pantalla de alta: se siguen creando
   por SQL (como la siembra de la etapa 1).
6. **Necesita contexto fiscal por local.** Un local sin vínculo fiscal activo no puede
   guardar catálogo (error explícito). A1 lo tiene por la siembra; los locales reales
   dependen de F1.4 (asesoría).
7. **Solo Propietario y Encargado.** Si otro rol edita productos, el cambio queda solo en la
   pantalla y se avisa una vez.
8. **Promoción a producción:** no autorizada. Exige A03 y A04, el control de `operation_id`
   de F2 y un contexto fiscal en cada local (la migración tiene preflight y falla si falta
   algo). No se ha comprobado el estado de producción.

## Corrección del puente (v2)

**Qué se vio en la prueba real (preview 118, Pedro, mismo día).** Pedro cambió el precio de
«Agua 50 cl (QA)» pero el registro de operaciones de QA (`abc_operaciones`) mostró **seis envíos de
15 productos** (los dos locales, A1 y A2) en vez de uno solo del Agua: dos a las 13:47:47 UTC
(`ACTUALIZADO` ×15 en cada local, la conversión inicial), uno más a las 13:47:48 y tres a las
13:51 UTC, estos cuatro últimos `SIN_CAMBIOS` (envíos redundantes: el contenido ya estaba).
Causa: la aplicación, al arrancar, reescribe la lista de `productos` (normaliza campos, añade
`empresaId` y marcas internas de stock, y a veces cambia entre «lista cruda» y «lista
normalizada»), y el puente v1 comparaba también `empresaId`, así que cada reescritura parecía
un cambio en los 30 productos.

**Riesgo que eso implica.** Los envíos son idempotentes y, por contenido, no cambian importes
(las versiones no subieron en los cuatro envíos redundantes y los totales no cambiaron), pero un guardado de la propia aplicación con una
lista antigua de la nube (la sincronización de `almacen_kv` puede devolver una lista vieja tras
recargar) podría haber **devuelto el catálogo a un precio antiguo** sin que nadie lo tocase.

**Qué hace la v2** (`ui-context-bridge.js`, sin tocar `fuente.js`):

| Cambio | Efecto |
|---|---|
| Solo cuenta un guardado como edición si hubo una acción de la persona (clic, toque, tecla, cambio de campo) en los 3 s anteriores | Un guardado de la propia aplicación al arrancar o recargar no se envía y no pisa el catálogo |
| La firma de comparación no incluye `empresaId` y normaliza texto, números como texto («10» = 10), `activo` por defecto verdadero y `tipo` vacío = «materia_prima» (igual que la pantalla) | Reescrituras que no cambian la venta no generan envío |
| Ausente de la lista ≠ desactivado | Nunca se desactiva un producto por no aparecer; solo `activo:false` explícito lo desactiva |
| Un producto que no estaba en la referencia se envía como alta solo si había referencia | Con la lista de referencia vacía no se confunde una carga con altas |
| Más de 25 cambios en un solo guardado no se envían solos: aviso en consola + evento `catalogo-tpv-cambio-masivo`; el volcado es explícito (`window.__catalogoTpv.sincronizarTodo()`) | Una importación o recarga masiva no reescribe el catálogo por sorpresa |

**Pruebas de la v2 (local, sin red):**

- `tests/p3-catalogo-bridge.mjs`: 21 escenarios (los 16 anteriores adaptados + ausencia sin
  desactivar, `activo:false` explícito, ruido de normalización, guardado sin interacción, cambios
  masivos, referencia vacía, cambio solo de stock/coste). **Pasan.**
- 6 mutantes del puente, **todos detectados**: sin la puerta de interacción, sin la guarda
  masiva, `empresaId` en la firma, altas sin referencia, `tipo` literal, números sin normalizar.
- `tests/p3/p3-catalogo-static-contract.mjs` y `tests/ui-context-bridge.mjs`: pasan.
- Batería completa de `.mjs` (211): 185 pasan; los 26 que fallan lo hacen por entorno (falta
  `pg` o PGlite en este contenedor); `tests/netlify-publish-boundary.mjs` pasa tras reconstruir
  `.netlify-dist`.

**Límites de la v2:**

- **Aún no se ha visto en un navegador real.** Hay que repetir la prueba del Agua en el preview 118
  y mirar `abc_operaciones` (esperado: un solo envío de 1 producto, sin envíos de 15).
- La puerta de interacción es una heurística de 3 s: una acción de la persona seguida, dentro
  de esos 3 s, de una recarga de lista antigua por la aplicación aún podría enviarse (muy
  improbable; sería un cambio de venta real frente a lo último visto).
- Fuera de alcance: la lectura de vuelta del catálogo (P3b). El aviso falso «No se pudo actualizar
  el producto» se corrige aparte (ver abajo).

### Despliegue no pedido (hay que decirlo)

La autorización fue «corrige el puente y pruébalo **sin desplegar**». Al subir el commit
`4a4c13e` (con `[skip netlify]` al final de la primera línea) Netlify **construyó
igualmente** el Deploy Preview del PR 118 («Deploy Preview ready», 14:48 UTC). Es decir: la etiqueta
no impidió el build (los commits anteriores con la etiqueta delante se subieron cuando aún no
existía el PR, así que esa suposición no estaba comprobada para un PR abierto). Efecto: el preview
118 ya sirve el puente v2. Alcance: solo QA (Deploy Preview de un PR en borrador, protegido por el
equipo de Netlify), sin producción, sin fusión, sin cambio de `release`. No se puede deshacer sin
otro despliegue; no se intentó. Lección: en un PR abierto, **`[skip netlify]` no evita el build**,
ni al final ni al principio del mensaje (comprobado con dos pushes seguidos: `4a4c13e` y
`49293db` generaron cada uno su Deploy Preview). **Cada push a la rama `claude/vigilant-hawking-uji8l4`
reconstruye el preview 118.** Para subir trabajo sin construir hay que usar otra rama que no sea la
del PR; hasta autorización, el trabajo nuevo no se sube a esta rama salvo que se acepte un build.

### Prueba real de la v2 en el preview 118 (Pedro, 14:54 UTC)

Pedro cambió «Agua 50 cl (QA)» a 1,00 € en el preview 118 y lo leí en QA (solo lectura): **una sola
operación** nueva en `abc_operaciones` (14:54:05 UTC, local A1, `ACTUALIZADO` ×1, no 15), el Agua de A1
quedó con `precio_con_impuesto` 1,00 (base 0,90909091, versión 3) y el Agua de A2 no se tocó (0,99,
versión 2). Es la primera vez que el camino completo pantalla → catálogo funciona con un solo producto
desde un navegador real. Sigue en pie: el preview puede tardar en servir el puente nuevo si el navegador
tiene la versión antigua en caché.

### Corrección del aviso falso «No se pudo actualizar el producto» (autorizada por Pedro)

Síntoma: al guardar la edición de un producto sale el cartel rojo aunque el cambio se guardó. Causa
(lectura de código): `updateProducto(id, data)` de `fuente.js` no devolvía nada cuando iba bien, y
`submitEdit` trata «sin resultado» o `ok === false` como fallo. Es previo a P1 y P3.

Corrección mínima: `updateProducto` devuelve `{ ok: true }` al terminar. Se aplica con el mismo cambio
de una línea en `fuente.js` y en `source-recovery/fuente-recuperado.js` (los dos bloques son idénticos
y se comprobó). El único consumidor del resultado es `submitEdit` (el uso desde fichas de coste lo
ignora); `submitEdit` no se toca: los fallos reales (dato inválido, producto de otro local, producto
inexistente) siguen devolviendo `{ ok: false, … }` y siguen mostrando su mensaje.

Prueba: `tests/p3/p3-actualizar-producto-resultado.mjs` ejecuta la función real extraída de las dos
copias (stub del motor de stock): éxito → `{ ok: true }` (y el cartel no se mostraría), cambio de stock
→ éxito con un movimiento de stock, precio negativo / producto de otro local / inexistente → rechazo sin
cambiar nada. Un mutante (quitar la línea) lo hace fallar. `tests/pm10/p04-productos-contract.mjs` y
`tests/pm19/p04-wiring-merma-contract.mjs` siguen pasando. Batería completa de `.mjs`: 187 pasan; los
25 que fallan son de entorno (sin `pg`/PGlite).

Límite: no visto en un navegador hasta que Pedro lo pruebe en el preview 118 reconstruido.

### Puerta de CI del PR 118: roja desde que se añadieron los tests de P1/P3

La «Puerta de CI general -- candidato a release» falla en el PR 118 (también antes de este cambio, desde
que existen estos archivos de test): su inventario está escrito a mano (208 archivos, 194 contratos
activos, 171 en Node) en `tests/ci/manifiesto_clasificacion.json`, `.github/scripts/validar-manifiesto-ci.mjs`
y `.github/workflows/puerta-ci-release.yml`, y los tests nuevos no están registrados:

- `tests/p1-denied-keys-solo-local.mjs` (P1)
- `tests/p3-catalogo-bridge.mjs` (P3)
- `tests/p3/p3-catalogo-static-contract.mjs` (P3)
- `tests/p3/p3-actualizar-producto-resultado.mjs` (corrección del cartel)
- `tests/p3/p3b-espejo-static-contract.mjs` (P3b)

Error literal del registro: `inventory_count: inventario=211; esperado=208` (con P3b serán 213) y
`missing_path` por cada uno. Los trabajos PostgreSQL (C05–C12), A09, PM12 y PM33 del mismo flujo pasan.
**No se ha tocado la puerta**: registrar los archivos exige cambiar cifras de una puerta de publicación
(manifiesto, validador y flujo) y debe hacerse en el PR de promoción real, no en un PR de preview «NO
FUSIONAR». Se deja como decisión de Pedro.

### P3b — espejo en la lista de la nube (opción A, autorizada por Pedro, solo QA)

**Qué se vio.** Con el preview 118 (puente v2 + corrección del cartel), Pedro cambió el Agua a 1,00 y al
recargar volvió a salir 0,99. Lectura de QA (después de las 15:02 UTC, la última operación vista):

| Dónde | Agua de A1 | Qué hace |
|---|---|---|
| `catalogo_tpv_productos` (servidor) | 1,00 € (versión 3, desde las 14:54) | lo que **cobra** el TPV |
| `almacen_kv.productos` (lista que carga la pantalla) | 0,99 €, `updated_at` 13:00:17 (la siembra) | lo que **muestra** la pantalla al recargar |

La fecha de la lista no se había movido desde la siembra: ninguna escritura de la pantalla llega a la
nube (la política PM05 la rechaza; ya lo marcaba P1 como «solo en este equipo»; no se vio en los
registros del servidor, es la deducción que mejor encaja con esa fecha). Resultado: la pantalla mostraba
un precio y el servidor cobraba otro.

**Qué hace P3b** (migración `20261002170000_abc_p3b_espejo_lista_nube`, **solo QA**): la RPC
`abc_catalogo_guardar_productos` refleja además, en la misma transacción, los campos de venta aceptados
(nombre, unidad, fraccionable, precisión si es al peso, `precioVenta`, `ivaVenta` y, si llega, `activo`)
en los elementos recibidos de la fila `productos` de la empresa. Reglas:

- Solo se tocan elementos que ya existen, del local de la llamada, y solo esos campos. **No se crean ni
  se borran elementos**, no se toca stock, coste, código ni nada más, y se conserva el orden.
- No cambia el catálogo ni los importes. No reescribe la fila (ni mueve su fecha) si no hay cambios.
- Los omitidos por el servidor (otro local, otra empresa, inválidos) no se reflejan.
- Fila de otra empresa o que no es una lista → no se toca (`lista_nube: sin_fila`). La respuesta añade
  `lista_nube`: `actualizada | sin_cambios | sin_fila | sin_productos`.
- Efecto colateral conocido: al actualizar la fila se ejecuta el disparador existente
  `pm07_bootstrap_stock_desde_productos_kv`, que solo **inserta** filas de stock que falten
  (`on conflict do nothing`). Comprobado: el stock existente no cambia.
- Permisos intactos (`create or replace` + se reafirman): solo `authenticated`; Cajero/a, Encargado de
  otro local y Propietario de otra empresa siguen rechazados.

**Pruebas.**

- Ensayo en seco en QA (migración + contrato, `ROLLBACK`): 54 de 55 correctas; el fallo era mi propia
  expectativa («el stock no cambia en todo el contrato»): el alta de un producto nuevo crea, por diseño
  de P3, su fila de stock inicial. Se corrigió el test (excluir el producto nuevo y comprobar aparte que
  su stock inicial es 0) y se demostró con la ejecución siguiente.
- Aplicada en QA con el contrato vivo `tests/p3/p3b-espejo-contract.sql` ejecutado **contra la función
  ya persistida** (con `ROLLBACK`): **56 de 56** (50 afirmaciones + 6 rechazos esperados). Incluye el caso
  real (catálogo 1,00 con la lista a 0,99 → guardar → la lista pasa a 1,00 y el servidor cobra 3 x 1,50 =
  4,50 tras otro cambio), idempotencia/replay/conflicto, texto «1.25» → número, baja/reactivación/no
  vendible, artículo al peso, alta sin crear elementos, omitidos, mezcla, otra empresa, fila que no es lista,
  y lectura con rol real.
- Mutante en vivo (función sin la escritura del espejo, con `ROLLBACK`): `lista_nube` seguía diciendo
  «actualizada» pero el precio en la lista se quedaba en 0,99. Por eso el contrato **lee el dato real** y no
  se fía del indicador (el caso 2.3 falla con el mutante).
- `tests/p3/p3b-espejo-static-contract.mjs` (local): la función de P3b es la de P3 más cuatro añadidos exactos
  y nada más; un único `update` sobre `almacen_kv`, sin `insert`/`delete`; solo campos de venta; bloqueo de fila,
  filtro de empresa y de local; ACL. **11 mutantes detectados.**
- Batería completa de `.mjs`: 188 pasan; los 25 que fallan son de entorno (sin `pg`/PGlite).
- Estado persistido en QA tras aplicar: función `SECURITY DEFINER` con `search_path` vacío, `EXECUTE` solo
  para `authenticated`, migración registrada, y los **datos reales sin tocar** (lista de la nube sigue en 0,99
  hasta la próxima edición real, catálogo 1,00 v3, 30 filas de catálogo y 83 de stock, 0 residuos del contrato).

**Límites de P3b.**

1. **Verificado en pantalla por Pedro (preview 118, 2/10/2026).** Con la lista de la nube a 0,99, Pedro guardó
   el Agua de A1 a 1,00 € y tras **recargar siguió en 1,00 €** (el cartel rojo ya no aparece). Lectura de QA
   (solo lectura) a continuación: una sola operación nueva, a las 15:34:54 UTC, local A1, `n=1`, `sin_cambios=1`
   (el catálogo ya estaba en 1,00) y `lista_nube=actualizada`; la lista de la nube tiene el Agua de A1 en 1 y la
   de A2 intacta en 0,99, con `updated_at` 15:34:54; el catálogo no cambió (A1 1,00 versión 3, A2 0,99 versión 2;
   30 filas) y el stock tampoco (83 filas). Es la primera vez que el camino completo pantalla → servidor →
   pantalla funciona desde un navegador real con un solo producto. **Sigue sin probarse:** dos dispositivos a la
   vez, otros roles, productos nuevos y el TPV con la lista recargada.
2. **Altas desde la pantalla no sobreviven a la recarga en QA** (ver límite 3 arriba). Crear elementos en la lista
   desde una función del servidor se descartó por ahora: pasaría datos de la pantalla sin validar a una lista que
   consume toda la aplicación.
3. **Carrera con la propia pantalla en producción.** En producción la pantalla escribe la lista entera; si lo hace
   a la vez con la RPC puede pisar el espejo (la RPC bloquea la fila, pero la pantalla no pasa por la RPC). No se ha
   comprobado el comportamiento de PM05 en producción. Hay que revisarlo antes de promover P3/P3b.
4. **Sigue el riesgo de una pantalla con la lista antigua en memoria** (sin recargar): si alguien edita otro dato
   de venta del mismo producto, el puente enviaría también el precio antiguo. P3b reduce la ventana (tras cualquier
   guardado la nube queda al día) pero no la elimina.
5. **No aplicado en producción.** Solo QA, por autorización expresa.

## Reversión (QA)

**P3b** se revierte con `create or replace` de `abc_catalogo_guardar_productos` usando el cuerpo de la
migración `20261002150000` (sin el espejo); no deja datos propios, pero **las listas ya reflejadas en
`almacen_kv.productos` conservan los precios reflejados** (son datos válidos; no hay que deshacerlos).
No se ha escrito ni ensayado el SQL de reversión de P3b.

La migración de P3 es aditiva y sin datos: basta con un SQL de reversión que restaure las dos
funciones de cálculo desde `20260924010000_abc_f3_a03_server_authority.sql` y
`20260924020000_abc_f3_a04_variants_modifiers.sql`, elimine la RPC y los dos auxiliares y
quite la restricción y la columna. No se ha escrito ni ensayado: no hay filas con
`precio_con_impuesto` en QA ni cambios de datos que deshacer.

## Cómo probarlo en pantalla (preview 118)

1. Ventana privada, preview de QA, Propietario, Local A1, pestaña de productos.
2. Cambia el precio de «Agua 50 cl (QA)» a 1,00 € y guarda.
3. En la consola: `window.__catalogoTpv.pendientes()` debe devolver `{}` en unos segundos y
   no aparecer avisos «[catálogo TPV]».
4. En el TPV, añade 3 aguas: el total debe ser 3,00 €.
