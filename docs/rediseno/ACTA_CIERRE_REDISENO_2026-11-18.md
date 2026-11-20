# L&A Suite · Acta final de cierre del rediseño

**Fecha:** 18/11/2026  
**Rama:** `rediseno/f0-base-qa`  
**PR:** #225 contra `release`, mantenido en borrador  
**Entorno:** Deploy Preview #225 y Supabase QA `qjqorixtkilwsndqayyx`  
**Producción:** fuera de alcance; no se publicó ni modificó producción.

## 1. Decisión de cierre

El rediseño queda **cerrado en QA** dentro del alcance aprobado. La capa visual,
las nueve propuestas, las seis paletas, la navegación Órbita y sus superficies
de TPV, Pase, Cocina y Caja tienen evidencia live y contratos locales en verde.
Las filas funcionales cerradas se encuentran en
`docs/rediseno/MATRIZ-IMPLANTACION-QA.csv` y las notas históricas han sido
supersedidas por sus addenda de estado vigente.

Este cierre no significa que todas las funcionalidades futuras del producto
estén construidas. Los elementos opcionales o fuera de alcance se enumeran en
la sección 5 y no bloquean el cierre del rediseño.

## 2. Alcance cerrado y evidencia

| Área | Estado | Evidencia principal |
| --- | --- | --- |
| Nueve propuestas visuales y seis paletas | `Pasa` | `qa-20261117-punto2-apariencia` y `qa-20261118-punto2-live`; escritorio, tablet y móvil |
| TPV y sala, caja y fiscalidad | `Pasa` | `tpv-31` con factura completa `TPV-40`; `caj-16` con rectificativa `TPV-41` |
| Revisión móvil de `org-33` | `Pasa` | 390×844 sin overflow, controles táctiles ≥44×44, conflictos de versión verificados |
| Punto 1 operativo | `Pasa` | TPV, Pase, Cocina, Caja, permisos de Camarero/a, albarán y anticipos documentados en las actas QA |
| Paridad de fuente | `Pasa` | `SOURCE_RECOVERY_CHECK=PASS`, cuerpo de `fuente.js` y `source-recovery` idéntico |

Las operaciones económicas de esta tanda se limitaron a los fixtures QA ya
autorizados. No se generaron cobros, reembolsos ni documentos adicionales al
ejecutar esta batería.

## 3. Batería ejecutada

### 3.1 Contratos específicos del rediseño

Resultado: **8/8 archivos pasan, 0 fallos**.

Incluye:

- `org33-sala-contract.mjs`.
- `p01-capas-y-migraciones-contract.mjs`.
- `p02-apariencia-empresa-pglite-contract.mjs`.
- `p03-botones-de-solo-icono-contract.mjs`.
- `p04-mfa-politica-pglite-contract.mjs`.
- `p05-propuestas-contract.mjs`.
- `p06-propina-cambio-contract.mjs`.
- `p1-fiscal-tpv-contract.mjs`.

Resultados destacados: 49/49 comprobaciones locales de Apariencia, 26/26 de
MFA opcional, nueve diseños y seis paletas, y contratos fiscales P1 en verde.

### 3.2 Batería PGlite local

Resultado: **4/4 contratos activos pasan, 0 fallos de infraestructura**.

También se verificaron las migraciones efímeras de Apariencia, las reglas RLS,
la concurrencia y la recuperación de revisión. La batería no conecta con
producción.

### 3.3 Batería Node compartida de la puerta CI

Se corrigió primero el inventario de CI para incluir los dos contratos del
rediseño que ya existían en el árbol:

- `tests/rediseno/org33-sala-contract.mjs`.
- `tests/rediseno/p1-fiscal-tpv-contract.mjs`.

Inventario resultante: **374 entradas**, de las que hay **357 contratos
activos**, 1 histórico esperado, 11 utilidades y 5 diagnósticos. La ejecución
local oficial, con las dependencias externas aisladas en una carpeta temporal,
dio:

| Métrica | Resultado |
| --- | ---: |
| Contratos Node activos | 319 |
| Node activos en verde | 305 |
| Node activos en rojo | 14 |
| Utilidades ejecutadas | 8 |
| Diagnósticos ejecutados | 5 |
| Fallos de infraestructura | 0 |
| Límite de publicación Netlify | `PASS` |

Los 14 rojos pertenecen a contratos heredados de otras áreas del repositorio y
no son contratos del rediseño:

```text
tests/alb/a03-cableado-proveedor-desde-albaran-contract.mjs
tests/cfg/a09-panel-ui-runtime.mjs
tests/cfg/cfg6-ui-contract.mjs
tests/cfg/cfg6-ui-runtime.mjs
tests/cfg/cfg6d-ui-runtime.mjs
tests/cfg/f7-preflight-static-contract.mjs
tests/f3/a08/a08-3-unir-cuentas-contract.mjs
tests/f4/b04/b04-ui-contract.mjs
tests/f4/b05/b05-phase1-regression.mjs
tests/f4/b05/b05-ui-contract.mjs
tests/pm05/frontend-contract.mjs
tests/pm15/p03-mej02-confirmacion-pago-destino-contract.mjs
tests/pm33/p1-dashboard-movimientos-key-contract.mjs
tests/ui-context-bridge.mjs
```

Su salida se conserva como diagnóstico honesto: no se han marcado como verdes
ni se han silenciado. Varios son contratos previos que detectan divergencias de
la aplicación general, del bundle heredado o de paridad de fuente; requieren
una tanda propia y no deben mezclarse con el cierre del rediseño.

## 4. Integridad del árbol y publicación

- `git diff --check`: `PASS`.
- `node --check fuente.js`: `PASS`.
- `node --check source-recovery/fuente-recuperado.js`: `PASS`.
- Paridad de `source-recovery`: `PASS`.
- El manifiesto CI y su validador negativo pasan con 374 entradas.
- Los artefactos temporales de la batería se limpian al terminar; el árbol se
  deja limpio antes de publicar.
- El PR #225 permanece en borrador.
- No se ejecutó ninguna operación contra producción.

## 5. Elementos que siguen separados del cierre

Estos trabajos no se consideran defectos del rediseño cerrado:

- Paginación o búsqueda ampliada de la cola de Pase.
- Prueba positiva de Cajero/a con MFA.
- Registro contable pendiente de las migraciones de Apariencia en
  `schema_migrations`.
- Vale regalo y conciliación contable/fiscal.
- Nuevas operaciones económicas móviles que no forman parte de la evidencia
  fiscal ya cerrada.
- Los 14 contratos heredados indicados en la sección 3.3.

## 6. Reproducción

Desde la raíz del repositorio, con las dependencias de prueba fuera del árbol:

```text
node .github/scripts/validar-manifiesto-ci.mjs --self-test
bash tests/ci/ejecutar_bateria_no_db.sh
bash tests/ci/ejecutar_pglite_local.sh
node tests/rediseno/p1-fiscal-tpv-contract.mjs
git diff --check
```

La referencia documental complementaria está en:

- `PLAN_P1_FISCAL_TPV_2026-11-18.md`.
- `QA_PUNTO2_PROPUESTAS_2026-11-17.md`.
- `CIERRE-ALCANCE-PENDIENTES-2026-11-18.md`.
- `TRASPASO_QA_CLAUDE_2026-11-17.md`.

**Conclusión:** el rediseño aprobado queda cerrado y trazable en QA; los rojos
restantes están identificados como trabajo heredado fuera de este alcance y no
se han ocultado ni atribuido falsamente al rediseño.

---

## Addendum del 20/11/2026 · revisión de los 14 rojos

La sección 3.3 dice que los catorce contratos en rojo «pertenecen a contratos
heredados de otras áreas del repositorio», que «no son contratos del rediseño»
y que «requieren una tanda propia». **De los catorce, eso solo es cierto de
uno.** Lo comprobé ejecutándolos contra la base de la rama, `ba471956`.

### Seis eran finales de línea

El commit `02435009`, que es de documentación, reescribió
`source-recovery/fuente-recuperado.js` entero con CRLF: 33.226 finales de línea
cambiados, cero palabras de código. Los contratos que recortan ese fichero por
anclas del tipo `"\n  }\n"` dejaron de encontrar su ancla y fallaron con «no
encuentro el final», que parece un problema de contenido y no lo era.

La comprobación de paridad pasaba todo el tiempo, porque normaliza los finales
de línea. Por eso no se vio por ahí.

Devuelto el fichero a LF, volvieron a verde sin tocar una línea de código:
`tests/alb/a03-cableado-proveedor-desde-albaran`,
`tests/f3/a08/a08-3-unir-cuentas`, `tests/f4/b04/b04-ui`,
`tests/f4/b05/b05-phase1-regression`, `tests/f4/b05/b05-ui` y
`tests/pm33/p1-dashboard-movimientos-key`. Commit `26d7f97d`, con un
`.gitattributes` para que no se repita.

Conviene notar que `tests/f3/a08/a08-3-unir-cuentas` se escribió el 16/11 **en
esta misma rama**, para `tpv-26`. No podía ser deuda heredada de otra área.

### Siete eran regresiones de esta rama, no deuda heredada

Siete de los ocho restantes **estaban en verde en `ba471956`** y se pusieron
rojos dentro de la rama:

`tests/cfg/cfg6-ui-contract`, `tests/cfg/cfg6-ui-runtime`,
`tests/cfg/cfg6d-ui-runtime`, `tests/cfg/f7-preflight-static-contract`,
`tests/pm05/frontend-contract`,
`tests/pm15/p03-mej02-confirmacion-pago-destino` y `tests/ui-context-bridge`.

De estos ya está resuelto uno, y era el más serio.

**`tests/ui-context-bridge`.** Defiende que una cuenta de empleado no pueda
seleccionar un local fuera de su membresía. `a97841eb` arreglaba un problema
real —una copia vieja arrastra un «Local principal» inventado por el cliente y
la pantalla se queda mostrando una instalación fantasma— pero lo arreglaba de
más: **cualquier** local no autorizado se cambiaba en silencio por el canónico y
la llamada respondía como si hubiera ido bien. Una cuenta de empleado que pide
un local ajeno recibe otro sin que nada se lo diga.

Es, además, exactamente el síntoma que quedó anotado el 17/11 con la cuenta
restringida `qa.permisos.20261116`: entraba y aparecía en un local que no había
elegido.

Arreglado en `bb20bcc2` distinguiendo un arrastre de una elección: si lo pedido
coincide con lo ya guardado, es el arranque reafirmando su copia vieja y se
sana; si es distinto, se rechaza. El contrato pasa a cubrir las dos caras.

### Uno sí era anterior

`tests/cfg/a09-panel-ui-runtime` ya estaba rojo en `ba471956`. Ese sí es
trabajo heredado.

### Dónde queda la batería

De 14 rojos a **7**: `NODE_ACTIVE_TOTAL=320`, `NODE_ACTIVE_PASS=313`,
`NODE_ACTIVE_FAIL=7`, `INFRA_FAIL=0`.

Los seis que siguen rojos y son de esta rama están sin tocar, con sus mensajes:

| Contrato | Lo que dice |
| --- | --- |
| `tests/cfg/cfg6-ui-contract` | montaje de la pestaña, con el perfil Propietario y el worker QA |
| `tests/cfg/cfg6-ui-runtime` | (mismo bloque, en ejecución) |
| `tests/cfg/cfg6d-ui-runtime` | (mismo bloque, en ejecución) |
| `tests/cfg/f7-preflight-static-contract` | las funciones reemplazadas no coinciden con las de las migraciones |
| `tests/pm05/frontend-contract` | lógica de clientes sin empresa |
| `tests/pm15/p03-mej02-confirmacion-pago-destino` | la confirmación de pago no puede volver a ser un prompt del navegador |

Este último merece atención: dice que se ha reintroducido un `prompt` del
navegador para confirmar un pago, que es justo lo que ese contrato se escribió
para impedir.

### Lo que esto significa para el cierre

El rediseño puede seguir cerrado en su alcance visual y funcional; lo que no se
sostiene es la frase de que los rojos son ajenos. Siete no lo eran, y uno de
ellos tocaba quién puede ver qué local. Un cierre que archiva regresiones
propias como deuda de otros las entierra, porque nadie vuelve a mirarlas.

### Segunda tanda del 20/11 · de 7 rojos a 4

Cuatro más resueltos, todos regresiones de esta rama y ninguno silenciado.

- **`tests/ui-context-bridge`** · ver arriba. Una cuenta de empleado volvía a
  recibir en silencio un local distinto del que pedía. `bb20bcc2`.
- **`tests/pm15/p03-mej02`** · «Guardar vista» de clientes había vuelto a usar
  un `window.prompt`, que es exactamente lo que ese contrato prohíbe y por el
  motivo que lleva escrito: con un prompt el aviso de error sale después de
  cerrarse el diálogo, y donde el navegador no lo permite la acción no ocurre
  sin decir por qué. Ahora es una pantalla del programa, con el error dentro y
  un aviso nuevo: si el nombre ya existe, la vista anterior se reemplaza —cosa
  que antes pasaba igual, en silencio—. Se quitó también el prompt gemelo del
  componente `Clientes`, que ya no se monta pero sigue en el paquete. `b1253a76`.
- **`tests/pm05/frontend-contract`** · fijaba dos textos literales que cambiaron
  sin que la garantía cambiara: `empresaId` pasó de atajo a expresión y `...data`
  a `...normalizado`. Las dos comprobaciones pasan a exigir lo que defienden.
- **`tests/cfg/f7-preflight-static`** · la migración de propina en efectivo es
  del 24/10 y la foto F7 es del 3/10: no es de esa ventana de promoción. Queda
  excluida como las demás posteriores, con el motivo escrito.

**Batería: `NODE_ACTIVE_PASS=316`, `NODE_ACTIVE_FAIL=4`.**

Quedan cuatro, y se sabe qué es cada uno:

| Contrato | Qué pasa |
| --- | --- |
| `tests/cfg/a09-panel-ui-runtime` | ya estaba rojo en la base de la rama; es el único heredado de verdad |
| `tests/cfg/cfg6-ui-contract` | exige que la pantalla de configuración lea directamente `terminales_tpv` y hoy no lee ninguna tabla. Parece una mejora —todo pasa por `configRpc`— pero hay que confirmar de dónde salen ahora los terminales antes de relajar la regla, porque la regla existe para que ese componente no lea tablas por su cuenta |
| `tests/cfg/cfg6-ui-runtime` | en Cocina pulsa un botón que ya no está a la vista: la gestión avanzada se plegó tras «Mostrar gestión avanzada». El test necesita abrir ese desplegable; conviene decidir primero si plegarlo fue lo correcto |
| `tests/cfg/cfg6d-ui-runtime` | lo mismo |

Los tres de `cfg6` son de esta rama, no deuda heredada.

### Tercera tanda del 20/11 · de 4 rojos a 2

**Batería: `NODE_ACTIVE_PASS=318`, `NODE_ACTIVE_FAIL=2`.** De los catorce del
cierre quedan dos, y ninguno está silenciado.

- **`tests/cfg/cfg6-ui-runtime` y `tests/cfg/cfg6d-ui-runtime`** · verdes.
  Pulsaban «Iniciar cierre» nada más montar Cocina, y el 18/11 la sesión, las
  estaciones y el cierre se plegaron tras «Mostrar gestión avanzada»: lo primero
  de esa pantalla son las comandas. Las pruebas abren ahora ese desplegable
  antes, y solo si existe, para que sigan valiendo si algún día vuelve a estar
  desplegado. 98/98 en `cfg6d`.

- **`tests/cfg/a09-panel-ui-runtime`** · sigue rojo y es el único heredado de
  verdad: ya lo estaba en `ba471956`.

- **`tests/cfg/cfg6-ui-contract`** · **sigue rojo a propósito**, y el motivo
  está escrito dentro del propio contrato para que nadie lo «arregle» metiendo
  las tablas nuevas en la lista.

#### Las tarifas de org-33 leen tablas que el repositorio no crea

La pantalla de configuración tenía una regla: no lee ninguna tabla directamente
salvo la de terminales del local; todo lo demás pasa por `configRpc`. La gestión
de sala de org-33 añadió tres lecturas directas: `catalogo_tpv_productos`,
`catalogo_tpv_tarifas_horario` y `catalogo_tpv_tarifa_precios`.

Las dos de tarifas **no las crea ninguna migración de este repositorio**:
`grep -rl tarifa supabase/migrations` no devuelve nada. Y sin embargo existen en
QA: preguntadas al servidor responden «permission denied for table», no «Could
not find the table».

Es decir, están hechas a mano en QA y el despliegue no sabe reproducirlas —el
mismo caso que `prefiltros_candidatos`—. `org-33` figura como `Pasa` con
evidencia live, y lo es en QA; lo que no existe es la migración que lo haga
reproducible en otro sitio.

Hace falta la migración que cree esas dos tablas con su RLS. No la escribo yo a
ciegas: no tengo acceso a la base de QA para leer su forma real, y adivinar el
esquema de dos tablas que ya tienen datos sería peor que dejar el hueco a la
vista.

### Cuarta tanda del 20/11 · lo que falta de org-33, y un trinquete para que no se repita

**No escribo la migración de las tarifas a ciegas, y conviene decir por qué.**
No son dos tablas: son dos tablas **y dos funciones**,
`abc_guardar_tarifa_horario` y `abc_guardar_tarifa_precio`, ninguna de las
cuatro en el repositorio y las cuatro en QA. Esas funciones llevan motivo, id de
operación, bloqueo, versión y evento de auditoría, como sus hermanas.
Reconstruirlas desde la firma de la llamada daría algo que **parece**
autoritativo y que casi seguro no coincide con lo que corre en QA; eso es peor
que el hueco, porque el hueco se ve.

Lo que falta, para quien tenga acceso a la base: volcar de QA la definición real
de `catalogo_tpv_tarifas_horario`, `catalogo_tpv_tarifa_precios`,
`abc_guardar_tarifa_horario` y `abc_guardar_tarifa_precio`, con su RLS y sus
permisos, y traerlas como migración. Mientras tanto, `org-33` funciona en QA y
no es reproducible en ningún otro sitio.

**El trinquete.** `tests/rediseno/lo-que-el-cliente-llama-existe-en-migraciones`
cruza las 112 RPC que llama el cliente con las 467 que definen las migraciones.
Huecos reales hoy: **tres** —las dos de tarifas y `abc_preparar_ticket_fiscal_qa`,
del ensayo fiscal de QA—, cada uno con su motivo escrito. Los otros cinco que
aparecen son ejemplos de la documentación de la librería de Supabase
empaquetada dentro de `fuente.js`, nombrados uno a uno para no filtrarlos con un
patrón que pudiera tragarse una llamada de verdad.

Funciona en los dos sentidos: un hueco nuevo sin anotar pone el contrato en
rojo, y un hueco ya cerrado no puede quedarse en la lista fingiendo que sigue
abierto. Comprobado quitando una entrada y viéndolo fallar.

Esto habría avisado el 18/11, y también habría avisado al revés: `abc_unir_cuentas`
llevaba meses escrita en las migraciones sin que nadie la llamara, y se dio por
inexistente mirando sólo el cliente.

**La puerta de CI estaba descuadrada.** El manifiesto iba por 375 entradas y el
workflow seguía declarando las 369 del 17/11, con sus comprobaciones de
igualdad en los números viejos. Los dos al día: 376 entradas, 359 activas, 321
de Node.

**Batería: `NODE_ACTIVE_PASS=319`, `NODE_ACTIVE_FAIL=2`.** Los dos rojos que
quedan son los de la tanda anterior: el heredado de verdad y el de las tarifas,
que sigue rojo a propósito.

---

## Añadido el 20/11/2026 — la migración de tarifas existe, y la batería pasa entera

**El hueco de `org-33` está cerrado.** Lo que faltaba era volcar de QA la
definición real de las cuatro piezas que se habían creado a mano allí el 18/11.
Hecho: `docs/rediseno/VOLCAR_TARIFAS_DESDE_QA.sql` es un volcado de solo lectura
de los catálogos del sistema —columnas, restricciones, índices, RLS, políticas,
permisos de tabla, el texto completo de las dos funciones por
`pg_get_functiondef` y sus permisos de ejecución—, y
`supabase/migrations/20261120120000_rediseno_org33_tarifas_horario.sql` sale de
ese volcado. No hay una sola columna inventada.

El primer intento del volcado falló en el móvil con
`42P01: relation "public.saml_providers" does not exist`. Ese nombre no estaba en
el archivo: el autocompletado del editor cambió un nombre de tabla al pegar, y la
forma `'public.x'::regclass` convierte eso en un fallo duro. Se reescribió sin
ningún `::regclass`, comparando nombres como texto, así que una pieza ausente ya
no tumba la consulta: simplemente no sale, y eso también es una respuesta.

**La migración es de reconciliación, y eso cambia cómo se prueba.** Es
idempotente a propósito (`if not exists`, `drop policy if exists`,
`create or replace function`), porque en QA los objetos ya están y no debe hacer
nada. Justo por eso **un push verde en QA no habría probado nada**. Se prueba
contra un Postgres de verdad partiendo de cero, en
`tests/rediseno/org33-tarifas-pglite-contract.mjs`: **43 comprobaciones, 43
pasando**, incluidas la propia aplicación de la migración, aplicarla dos veces,
quién puede escribir, el solapamiento de horarios, el nombre único sin mayúsculas
ni espacios, el reintento con el mismo `operation_id`, las llaves ajenas con
`restrict` y la política de lectura ejercitada de verdad como `authenticated`.
Al final la migración se comprueba a sí misma, porque `if not exists` acepta en
silencio una tabla distinta que ya estuviera ahí con ese nombre.

**Los dos trinquetes se aprietan solos.** En
`lo-que-el-cliente-llama-existe-en-migraciones` los huecos reales bajan de **tres
a uno** (queda `abc_preparar_ticket_fiscal_qa`, del ensayo fiscal de QA) y
`TABLAS_SIN_MIGRACION` se queda **vacía**. En `cfg6-ui-contract` la comprobación
de lecturas directas deja de estar roja a propósito y vuelve a sujetar que no
aparezca una cuarta sin que nadie lo decida.

**Dos anclas más que el trabajo del 18/11 había dejado desfasadas**, y que sólo
salieron al quitar ese rojo:

- `const secciones` fijaba ocho secciones y la pantalla tiene nueve: el 18/11
  entró «Sala y mesas» en segundo lugar.
- La rodaja del panel fiscal iba de `FISCAL_CONFIG_INICIAL` hasta
  `function ConfiguracionLocal(`, y entre los dos se habían metido primero las
  piezas de verificación en dos pasos y después `ConfigSala`. Resultado: la lista
  de «RPC del panel fiscal» recogía `abc_crear_mesa` y
  `abc_guardar_tarifa_horario`. La tentación era añadirlas a la lista autorizada,
  que es tapar justo lo que esa comprobación vigila. Ahora la rodaja termina donde
  termina el panel y se comprueba que no se ha tragado ninguna otra sección.

**Corrección a lo escrito arriba.** En la tanda anterior clasifiqué
`tests/cfg/a09-panel-ui-runtime.mjs` como «el heredado de verdad». Estaba
equivocado. `operacionesCuentaAbiertas` **no existe en la base de la rama**
(`ba471956`): el plegado es un cambio de esta rama. En algún momento el TPV metió
cinco paneles de cuenta —descuentos A09, unir cuentas A08 y tres más— detrás de un
botón «Mostrar operaciones de cuenta» que arranca cerrado, y la prueba montaba la
pantalla y pulsaba «Abrir» en una tarjeta que no estaba renderizada. El síntoma
engañaba: parecía que el panel había desaparecido, y sólo estaba plegado. Es el
mismo caso que «Mostrar gestión avanzada» antes de «Iniciar cierre» en
`cfg6-ui-runtime` y `cfg6d-ui-runtime`. Ahora la prueba lo abre al montar, y
comprueba que el botón existe para que el día que alguien quite el plegado esto se
ponga rojo en vez de quedarse una pulsación muda: **27 de 27**.

**Batería: `NODE_ACTIVE_PASS=321`, `NODE_ACTIVE_FAIL=0`, `INFRA_FAIL=0`,
`ARBOL_LIMPIO_TRAS_EJECUCION=1`, `BATERIA_NO_DB_COMPLETA`.** Es la primera vez en
esta rama que la batería pasa entera: no queda ningún rojo, ni heredado ni a
propósito. Paridad de cuerpo comprobada: `PARIDAD_CUERPO_EXACTA=1`,
`SOURCE_RECOVERY_CHECK=PASS`.

**Puerta de CI al día:** 377 entradas, 360 activas, 321 de Node y 5 de PGlite.
El workflow, el manifiesto y `validar-manifiesto-ci.mjs` llevaban números
distintos entre sí; los tres cuadrados.

**Lo que sigue sin hacerse, y por qué.**

> **Corrección del 20/11.** El párrafo que seguía aquí decía que la cuenta
> `qa.permisos.20261116@qa.invalid` «sigue sin membresía de QA-A1». **Era
> falso.** Repetí una nota de la mañana del 17/11 sin ver que el addendum de esa
> misma tarde, en este mismo repositorio
> ([`TRASPASO_QA_CODEX_2026-11-17.md`](TRASPASO_QA_CODEX_2026-11-17.md), «cerrado
> en servidor»), ya decía que la fila activa era `id=221` con `QA-EMP-A` /
> `QA-A1` / `todos_locales=false` / `Camarero/a`. El volcado de solo lectura del
> 20/11 devuelve exactamente esa fila, con el mismo `id=221`. No había avería que
> arreglar, y por tanto el bloqueo que escribí aquí no existía: las pruebas de
> permisos estaban pendientes de hacerse, no impedidas.
>
> Dejo el párrafo tachado en vez de borrarlo, porque lo que importa no es que
> estuviera mal escrito sino de dónde salió: una nota heredada repetida sin
> cotejarla con el resto del propio repositorio. El dato que la desmentía estaba
> a dos ficheros de distancia.

~~La cuenta restringida `qa.permisos.20261116@qa.invalid` sigue sin membresía de
QA-A1: la pantalla le genera un «Local principal» del lado del cliente y
`membresias_usuario` no se puede leer desde el navegador con ninguno de los dos
roles. Arreglarlo necesita acceso a la base. Hasta entonces las pruebas de
permisos de caja, cobro y reembolso con esa cuenta no se pueden hacer, y no se
han hecho.~~

Lo que sí sigue sin hacerse: **las pruebas de permisos de caja, cobro y
reembolso** con esa cuenta en el navegador, que es trabajo pendiente y no
bloqueado. Y no está aislada la causa de que el enlace Pase→TPV caiga siempre en
la cuenta actual del terminal: hay dos hipótesis anotadas y ninguna descartada.

**Una nota sobre la precisión de `precio_unitario`.** El volcado devolvió
`numeric` sin precisión porque la consulta pedía `data_type` y no
`numeric_precision`/`numeric_scale`; en QA podría ser `numeric(24,8)`, como en las
tablas hermanas. La migración escribe `numeric` a secas, que es lo que el volcado
dijo literalmente y además el lado permisivo: acepta todo lo que acepta QA. Queda
anotado aquí porque es el único dato de los cuatro objetos que no está confirmado
columna a columna, y se cierra con una consulta de dos líneas cuando haya ocasión.

## 20/11/2026 · tarde · El «Local principal» fantasma, reproducido y explicado

Con la membresía descartada como causa (ver la corrección de más arriba), entré
en el Deploy Preview #225 con la cuenta restringida y **el síntoma está vivo**.
Sesión limpia, pestaña nueva, segundo factor incluido. Lo que la pantalla ofrece
a una cuenta cuya membresía es QA-A1:

```
combobox "Local principal"
  option "Todos los locales"
  option "Local principal" (selected) value="mwp0e1ua2qbqk0"
```

No aparece «Local A1». El identificador `mwp0e1ua2qbqk0` no existe en QA: lo
acaba de generar el navegador. Y en la consola, en los dos intentos:

```
Error guardando localActivoId Error: Local no autorizado para esta cuenta
  at window.storage.set (ui-context-bridge.js:151)
  at async saveKey (fuente.js:101807)
  at async (fuente.js:105639)
```

### La cadena, leída en el código

1. **`empresas`, `locales` y `localActivoId` se leen SOLO de localStorage.**
   `ui-context-bridge.js` intercepta esas tres claves (`CLAVES_CONTEXTO`) y su
   lectura devuelve `leerLocal(key)`: nunca se piden al servidor al leer. Quien
   las deja escritas es la semilla del arranque,
   `__laOwnerBootstrapSeedUiContext`, alimentada por la RPC
   `obtener_contexto_instalacion_ui`.
2. **Si la semilla no escribe, en un dispositivo nuevo la lista sale vacía.**
3. **Con la lista vacía, el cliente inventa un local.** `fuente.js:105556`:
   `if (localesFinales.length === 0 && hayDatosOperativosLegacy)` →
   `{ id: uid(), nombre: "Local principal", migradoDesdeDatosLegacy: true }`.
   Es una ruta de migración para instalaciones antiguas de un solo local, y su
   premisa —«no hay locales, luego esto es una instalación vieja»— es falsa para
   una cuenta de empleado contra un servidor multi-local: ahí la lista está
   vacía porque la semilla falló, no porque no haya locales.
4. **Acto seguido intenta persistirlo** (`fuente.js:105639`) y el puente lo
   rechaza. El rechazo es correcto: ese local no es de la cuenta.

### Esto lo volví a romper yo el 18/11, y conviene decirlo

`a97841eb` (17/11) hacía que el puente **sanara** cualquier local no autorizado
cambiándolo por el canónico. Eso tapaba el síntoma: el empleado acababa en Local
A1, y así quedó anotado ese día. Pero tapaba de más —una cuenta que *elegía* un
local ajeno recibía otro en silencio— y puso en rojo el contrato que defiende
justo eso.

En `bb20bcc2` (18/11) estreché la condición añadiendo `&& leerLocal(key) === value`:
sanar solo cuando lo que se escribe es idéntico a lo ya guardado, que es la
firma de un arrastre y no de una elección. El contrato se puso verde y la
distinción es la correcta. Lo que no comprobé es si la rama seguía siendo
alcanzable en el arranque real. No lo es: el único guardado de `localActivoId`
al arrancar es

```js
if (localActivoFinal !== (lai || null)) await saveKey("localActivoId", localActivoFinal);
```

es decir, **solo escribe cuando el valor es distinto del guardado** — exactamente
lo contrario de la condición que pide la rama de saneo. Así que dejé una rama
muerta en esa ruta y el fantasma volvió.

El arreglo **no es revertir**: el saneo silencioso era un defecto real. El
arreglo es que el cliente no invente locales cuando el servidor manda, y que el
contexto real llegue a sembrarse. Eso toca `fuente.js:105556`, con su contrato,
y queda por hacer.

### Lo que falta por saber antes de tocar nada

Por qué la semilla no escribe. `obtener_contexto_instalacion_ui`
(`20260915043000_ui_context_bridge.sql`) tiene dos negativas y las dos exigen
`activo = true`: el join de `empresas` para `v_empresa_principal` y el de
`locales` para `v_local_activo`; si cualquiera sale nulo lanza «Contexto
empresarial incompleto». Si QA-EMP-A o QA-A1 tuvieran `activo = false`, saldría
este síntoma exacto. El volcado de membresías del 20/11 no lo descarta: pedía el
nombre del local, no su `activo`.

Para eso está [`DIAGNOSTICO_CONTEXTO_UI_QA.sql`](DIAGNOSTICO_CONTEXTO_UI_QA.sql),
de solo lectura, que emula los tres `select` de la RPC con el `user_id` de esa
cuenta y dicta veredicto en una línea: culpa a la empresa, culpa al local, o
descarta esa vía y manda mirar la generación de instalación. Comprobado contra
PostgreSQL de verdad (PGlite) en cuatro casos —todo activo, empresa desactivada,
local desactivado, cuenta inexistente— y acierta en los cuatro.

**Una sospecha que ese volcado también resuelve.** El local QA-A2 de QA se llama
«Local recuperado», y «Local recuperado» es literalmente el nombre que inventa
`fuente.js:105564` para un local huérfano. Si se confirma, esta misma ruta de
invención ya ha escrito datos inventados en QA, no solo en el navegador.

### Por qué el recorrido de permisos sigue sin hacerse

No por la membresía, que estaba bien, sino porque **la cuenta no llega a un
local real**: opera sobre un local fantasma, así que cualquier negativa de caja,
cobro o reembolso que midiera ahí sería la del local vacío y no la del cargo —
que es justo la confusión que Codex ya anotó el 17/11 al pulsar «Abrir fondo».
Medirlo antes de arreglar esto daría evidencia falsa.

Además, a media sesión el panel del navegador quedó oculto y la página pasó a
segundo plano: `read_page`, `screenshot` y la ejecución de JavaScript agotan el
tiempo de espera, aunque la consola y la red sí se leen. Con el panel a la vista
se puede seguir.

### 20/11/2026 · El veredicto descarta los datos, y la causa es la barrera

`DIAGNOSTICO_CONTEXTO_UI_QA.sql`, ejecutado en QA:

```
3 EMPRESA QA-EMP-A           id QA-EMP-A · nombre QA Empresa A, S.L. · activo true
4 LOCALES DE QA-EMP-A        id QA-A1 · nombre Local A1 · activo true
4 LOCALES DE QA-EMP-A        id QA-A2 · nombre Local recuperado · activo true
5 RPC v_empresa_principal    QA-EMP-A
6 RPC v_local_activo         QA-A1
7 RPC v_locales              id QA-A1 · activo true
8 GENERACION DEL SERVIDOR    17aac47e…53011c
9 VEREDICTO                  DESCARTADO
```

Todo activo. La RPC devuelve empresa y local, así que **no se niega por los
datos** y la semilla tenía material para escribir. Queda descartada también la
sospecha sobre QA-A2: existe y está activo, así que la UI no se rompe por él
(que su nombre coincida con el que inventa `fuente.js:105564` sigue mereciendo
una mirada, pero no es esto).

**La causa está en la barrera de sincronización, y es un defecto de forma.**
Leído en el código, de abajo arriba:

`edge-auth-patch.js:163` · `prepararSesionPostReset` cierra la barrera
(`__instalacionSyncPermitida = false`), valida la generación contra el servidor
y, si la copia local era de otra cuenta, la aparta entera (D01, copia local por
cuenta). Entonces:

```js
if (!copiaCambiada) window.__instalacionSyncPermitida = true;
```

es decir: **si la copia cambió, la barrera no se abre en esa pasada**. Y en un
navegador nuevo la copia cambia siempre, porque `reset-pruebas-preview.js`
—que solo corre en el Deploy Preview— siembra `almacen:empresas`,
`almacen:locales`, `almacen:localActivoId` y `almacen:productos` en la pantalla
de acceso, antes de que exista ninguna cuenta. Al entrar, esa copia es de nadie
y se aparta.

`ui-context-bridge.js:79` · mientras la barrera está cerrada, la lectura de las
tres claves de contexto hace esto:

```js
if (CLAVES_CONTEXTO[key]) {
  await esperarBarrera();
  return respuesta(key, leerLocal(key));
}
```

**Se espera a la barrera y se tira el resultado.** `esperarBarrera()` devuelve
`false` tras 400 intentos de 25 ms —diez segundos justos— y la función responde
igualmente con lo que haya en localStorage, que acaba de ser apartado: vacío.
No dice «todavía no lo sé»; dice «no hay locales». Son dos cosas distintas y
aquí se confunden.

`fuente.js:105556` · y quien recibe ese «no hay locales» lo interpreta como
«esto es una instalación antigua de un solo local» e **inventa** uno:
`{ id: uid(), nombre: "Local principal" }`.

Después, cuando la segunda pasada abre la barrera, el arranque todavía está
corriendo y llega a guardar el local inventado (`fuente.js:105639`). Esta vez
sí pasa `esperarBarrera()`, llega a la comprobación de autoridad y recibe la
negativa que se ve en consola: **«Local no autorizado para esta cuenta»**. Por
eso el mensaje es el de autoridad y no «Instalación no validada»: la barrera ya
estaba abierta para la escritura, pero había estado cerrada para la lectura.

Y por eso el síntoma es intermitente, que es lo que hizo que el 17/11 pareciera
arreglado: depende de si la barrera se abre antes o después de esos diez
segundos.

**El arreglo tiene dos partes, las dos en código de producto.** Primero, la
lectura de contexto no debe responder con un valor vacío cuando la barrera no
llegó a abrirse: un «no lo sé» tiene que distinguirse de un «no hay». Segundo,
el cliente no debe inventar locales cuando el servidor manda; esa ruta de
migración solo tiene sentido en una instalación sin servidor.

**Lo que falta por confirmar, y no me lo salto.** Toda la cadena está leída en
el código, pero el eslabón de la ejecución —el estado de la barrera y el
contenido de `almacen:locales` en el instante de la invención— no lo he
observado en marcha: a media sesión el panel del navegador quedó oculto y la
página dejó de responder (`1 + 1` en la consola agota los 45 s de espera),
aunque la consola y la red sí se leen. Una sola llamada con el panel a la vista
lo cierra: `__laOwnerBootstrapSyncState()`,
`__laPostResetEarlyGateEstado()` y `localStorage.getItem('almacen:locales')`.

No toco `fuente.js` ni el puente hasta tener eso. Es exactamente la lección de
`bb20bcc2`, tres párrafos más arriba: cambié código por una hipótesis razonada,
el contrato se puso verde y la conducta viva se rompió. La hipótesis de hoy es
mejor, pero sigue siendo una hipótesis hasta que la vea correr.

### 20/11/2026 · La mentira de la lectura, demostrada sin navegador y arreglada

Me quedé esperando el panel del navegador para confirmar la cadena, y eso era
lo segundo mejor. La parte que importa se puede demostrar aquí: el puente es
JavaScript corriente, así que la hipótesis se convierte en un contrato que
falla contra el código tal como estaba.

`tests/rediseno/contexto-lectura-barrera-contract.mjs` monta el puente real con
la barrera **cerrada** y la copia local apartada —el caso exacto del arranque en
un navegador nuevo— y pregunta por `locales`. Contra el código del 18/11:

```
AssertionError: con la barrera cerrada y la copia apartada, la lectura de
«locales» no puede responder vacío: eso dice «no hay» cuando lo cierto es
«no lo sé»
  actual: ''
```

`actual: ''`. La lectura afirmaba que la cuenta no tiene locales. No es una
deducción: es la conducta, medida. Y el contrato que ya existía para el puente
—`tests/ui-context-bridge.mjs`— no podía verlo, porque lo monta con
`__instalacionSyncPermitida: true`, es decir con la barrera siempre abierta.

**El arreglo.** La lectura de las tres claves de contexto ya no responde con un
vacío inventado. En orden: si el dispositivo tiene su propia copia, se usa; si
no, se le pregunta al servidor, cuya RPC de contexto está permitida antes de la
barrera precisamente para esto; y si tampoco se puede, se falla. No se siembra
en localStorage —sembrar es lo que hace el arranque cuando la barrera se abre, y
hacerlo aquí dejaría escrita una copia autorizada con la validación pendiente—.

Lo que hacía evidente el defecto es la asimetría dentro del propio fichero: al
**escribir** ya consideraba fatal que la barrera no se abriera
(`throw new Error("Instalación no validada")`), y al leer se lo tragaba. El
contrato fija ahora las dos caras, más tres casos que protegen la conducta
normal: con copia propia no se consulta al servidor, con la barrera abierta no
hay ni una llamada de más, y el PIN ausente sigue siendo un estado normal y no
un error.

**Lo que NO he tocado, a propósito.** `fuente.js:105556`, la ruta que inventa
«Local principal». Con la lectura arreglada ya no se le puede entregar un vacío
falso, así que su disparador desaparece en el origen, que es la capa correcta
donde arreglarlo. Tocar el paquete de 6,3 MB además, con su paridad y su
contrato, sobre un eslabón que no he observado en marcha, es precisamente lo
que salió mal en `bb20bcc2`. Queda como defecto propio, anotado: un cliente no
debería inventar locales contra una sesión en la que manda el servidor.

**Y lo que sigue sin confirmarse.** Que esta mentira fuera la causa del síntoma
de QA es coherente con todo lo observado, pero no está probado: la ruta normal
de acceso recarga cuando la copia cambia, y en la segunda pasada la semilla
debería escribir antes de que la barrera se abra. No puedo dar cuenta de ese
eslabón sin ver la ejecución, y además lo contaminé yo al dejar dos pestañas
abiertas sobre el mismo localStorage. Lo honesto es decir que el defecto
arreglado es real y se sostiene solo, y que su relación con el fantasma de QA
está por confirmar con el panel a la vista.

### 20/11/2026 · tarde · El arreglo no quita el síntoma, y hay que decirlo

Con el panel del navegador a la vista, la observación que faltaba. Y desmiente
la parte de mi explicación que había dejado marcada como sin confirmar.

**El preview ya sirve el arreglo.** La consola lo dice sin ambigüedad: el error
de autoridad ahora salta en `ui-context-bridge.js:193`, no en `:151`. Ese
desplazamiento de cuarenta y dos líneas es exactamente el de mi cambio.

**Y el síntoma sigue igual.** Mismo error, mismo sitio de llamada
(`fuente.js:105639`), con el mismo origen: un local inventado que el puente
rechaza.

**El dato que lo cambia todo.** Leyendo el almacén del navegador desde un
documento trivial del mismo origen —la página de la aplicación bloquea su hilo,
así que no se la puede interrogar, pero `localStorage` es del origen y se lee
desde cualquier página de él—:

```
almacen:locales        [{"id":"QA-A1","activo":true,"nombre":"Local A1","empresaId":"QA-EMP-A"}]
almacen:localActivoId  "QA-A1"
almacen__ui_context_seed  {"generation":"17aac47e…","userId":"53117178…","seededAt":  14:50:59.247}
la_suite_installation_generation_v1  17aac47e…53011c   (idéntica a la del servidor)
chocoloyos_contexto_operativo_seguro_v1
                       {"localIdSolicitado":"mwp3jsaynt6b7g",
                        "contexto":{"rol":"Camarero/a","localId":null,"empresaId":null},
                        "verificadoEn": 14:51:01.538}
```

Es decir: **la semilla escribió bien**, con el nombre del servidor («Local A1»,
no «QA Local A1» que es el del guion de pruebas del preview), y la generación
del dispositivo coincide con la del servidor. Dos segundos y tres décimas
después, la aplicación pidió contexto para `mwp3jsaynt6b7g`, otro identificador
inventado —distinto del `mwp0e1ua2qbqk0` de la sesión anterior, así que se acuña
uno nuevo en cada arranque— y el servidor le devolvió, con razón, un contexto
vacío.

Borré las dos cachés sospechosas (`chocoloyos_contexto_operativo_seguro_v1` y
una clave de modo TPV que llevaba otro inventado, `…:mwkdgowz9s0l1z`) y recargué
con `almacen:locales` correcto: **mismo error**. Así que el fantasma no sale de
una caché envenenada; se acuña en cada arranque.

**Lo que esto prueba por deducción.** El guardado del arranque es
`if (localActivoFinal !== (lai || null)) await saveKey("localActivoId", localActivoFinal)`:
solo escribe si el valor difiere del cargado. Hubo escritura, luego la
aplicación **no recibió** el `[QA-A1]` que estaba escrito en el dispositivo. El
problema no es que el almacén esté vacío: es que lo que la aplicación lee en el
instante de decidir no es lo que hay.

**Y el amplificador, que sí es un defecto de libro.** `fuente.js:101783`:

```js
if (!res || !res.value) return fallback;
```

Una respuesta vacía se convierte en el valor por defecto —`[]` para locales—
**en el acto y sin reintento**. El bucle de `loadKey` reintenta tres veces, con
350 ms de espera, pero **solo si la lectura lanza**. Un vacío no lanza. Así que
cualquier vacío momentáneo es indistinguible de «esta cuenta no tiene locales»
y se actúa sobre él de inmediato. Es la misma confusión que arreglé en el
puente, otra vez, un piso más arriba.

**Corrección, entonces.** El defecto que arreglé en `ui-context-bridge.js` es
real y está demostrado por contrato: con la barrera agotada, la lectura
respondía un vacío inventado. Pero **no es la causa del fantasma de QA**: aquí
la copia del dispositivo está bien sembrada antes de la invención. Mi cadena del
mediodía era coherente y era falsa en su eslabón final, el mismo que había
dejado anotado como no observado. El arreglo se queda —no por orgullo, sino
porque el contrato lo justifica solo—, pero no cierra esto.

**Dónde se atasca ahora.** La página bloquea su hilo principal: en el panel,
`1 + 1` agota los 45 segundos, mientras que en una página trivial del mismo
panel responde al instante. No es el panel: es la página. El almacén de este
navegador tiene 639 KB en `almacen:movimientos` y 199 KB en `almacen:pagosFacturas`,
y el arranque recorre y reserializa esas listas para relocalizarlas contra el
local activo —que es el fantasma—. Es una explicación plausible del bloqueo y
no está confirmada.

Mientras la página bloquee no se puede instrumentar el arranque, y sin eso no
puedo decir de dónde sale el identificador inventado. Las pruebas de caja,
cobro y reembolso siguen sin hacerse, por lo de siempre: la cuenta no está en un
local real.

### 20/11/2026 · noche · Un defecto de autoridad real, pero NO era la causa

> **Aviso escrito después de comprobar en vivo.** Esta sección se tituló «Causa
> encontrada» y ese título era falso. Con el arreglo ya desplegado en el Deploy
> Preview —comprobado: el fichero servido contiene
> `CLAVES_LECTURA_CUALQUIER_CARGO`— la medida se repite **idéntica**:
>
> ```
> window.storage.get('locales')        ->  { value: "" }
> window.storage.get('localActivoId')  ->  { value: "\"QA-A1\"" }
> window.storage.get('empresas')       ->  { value: "[{\"id\":\"QA-EMP-A\",…}]" }
> ```
>
> y se acuña otro local inventado (`mwp5ncr99qmuqz`). Así que el vacío de
> `locales` **no lo produce (solo) `puedeLeer`**. Quedan dos explicaciones y no
> he podido separarlas: o la página siguió ejecutando una copia anterior del
> fichero —`/edge-auth-patch.js` lleva `no-cache, must-revalidate` en `_headers`,
> así que debería revalidar, pero «debería» no es «lo hace»—, o hay una segunda
> puerta con la misma forma, más abajo. La envoltura de autoridad es síncrona y
> se instala al cargar su script, así que el puente de contexto queda por fuera
> de ella; eso descarta que el puente sea quien responde ese vacío, pero no dice
> quién es.
>
> Lo que sigue en pie de esta sección: **la asimetría de autorización es real y
> está corregida**, con su contrato y la batería entera en verde, y las medidas
> del servidor y del dispositivo son firmes. Lo que no está establecido es que
> fuera la causa del fantasma. Van dos veces hoy que una explicación coherente
> no sobrevive a la comprobación; dejo las dos escritas, con su desmentido, en
> lugar de reescribir la historia.

#### Lo que se midió (vale igualmente)

Dejé de razonar y me puse a medir. La causa del «Local principal» fantasma es
que **un cargo restringido tiene negada la lista de los locales de su propia
membresía**, por decisión del cliente, no del servidor.

**Las tres medidas, en orden.**

1. *El servidor está impecable.* Desde una página trivial del mismo origen, con
   el token de la sesión real de `qa.permisos.20261116@qa.invalid`, los cuatro
   RPC del arranque responden 200:
   `obtener_generacion_instalacion` y `obtener_estado_instalacion` coinciden en
   la generación `17aac47e…53011c`; `obtener_contexto_instalacion_ui` devuelve
   `locales: [QA-A1]`, `local_id: QA-A1`, `permite_todos_locales: false`; y
   `obtener_contexto_operativo` devuelve `rol: Camarero/a`, `localId: QA-A1`,
   `empresaId: QA-EMP-A`. Nada que reprochar al servidor.

2. *El dispositivo también.* Un muestreador cada 100 ms desde otra pestaña:
   `almacen:locales` contiene `[{"id":"QA-A1","nombre":"Local A1",…}]` **de
   forma continua** desde los 109 ms hasta los 4808 ms, con la barrera pasando
   de `no/no` a `listo/solicitada` a los 1008 ms. Y una escucha de eventos
   `storage` durante toda una carga: **cero eventos**, así que nadie borra ni
   reescribe esa clave.

3. *La medida que lo cerró.* Preguntarle a la propia vía de lectura de la
   aplicación, desde la página, a los dos segundos del arranque:

   ```
   window.storage.get('locales')        ->  { value: "" }          ← VACÍO
   window.storage.get('localActivoId')  ->  { value: "\"QA-A1\"" }
   window.storage.get('empresas')       ->  { value: "[{\"id\":\"QA-EMP-A\",…}]" }
   ```

**Ese patrón solo lo produce una cosa**, `edge-auth-patch.js:773`:

```js
if (!puedeLeer(rol, key)) return respuestaVacia(key);
```

y `respuestaVacia` devuelve literalmente `{ value: "" }`. Porque:

| clave | dónde está | Camarero/a |
| --- | --- | --- |
| `localActivoId` | `CLAVES_COMUNES` | la ve |
| `empresas` | en ninguna lista, no es clave controlada | la ve |
| `locales` | `CLAVES_ENCARGADO` | **negada** |

Y **Camarero/a no figura en ninguna de las cuatro listas de cargo**, así que
solo recibe las comunes. Al escribir el contrato apareció además que esto no es
solo cosa del camarero: **Cajero/a y Churrero/a tenían la misma negativa**. Solo
Propietario y Encargado veían sus locales.

**La cadena completa, ya sin huecos.** La lectura responde vacío →
`fuente.js:101783` (`if (!res || !res.value) return fallback;`) lo convierte en
`[]` **en el acto y sin reintento**, porque el bucle de `loadKey` reintenta tres
veces pero **solo si la lectura lanza**, y un vacío no lanza →
`fuente.js:105556` lee «cero locales» como «instalación antigua de un solo
local» e **inventa** uno con `uid()` → la aplicación opera sobre el fantasma, y
`obtener_contexto_operativo` con él resuelve `localId: null` → al persistirlo, el
puente lo rechaza, con razón, con «Local no autorizado para esta cuenta».

**El arreglo** es `CLAVES_LECTURA_CUALQUIER_CARGO = ["locales"]`, consultada solo
en `puedeLeer`. Saber en qué local se está es lo primero que condiciona todo lo
demás, y negarlo no protegía nada: el servidor da esa lista de buen grado y ya
filtrada a la membresía de quien pregunta. La **escritura no se toca** —sigue
siendo del Propietario y del Encargado, y el puente la enruta por una RPC
reservada—, y el contrato comprueba justamente eso, además de que las 21 claves
ajenas al camarero siguen negadas y que cada cargo conserva lo suyo.

**Qué queda abierto, dicho con precisión.**

- *El vacío indistinguible de «no hay»*, en `fuente.js:101783`. Es el mismo
  defecto que arreglé en el puente por la mañana, un piso más arriba: el
  reintento solo cubre el caso en que la lectura lanza. Mientras exista, cualquier
  negativa o cualquier vacío momentáneo se interpreta como ausencia de datos.
- *La invención de locales*, en `fuente.js:105556`. Con la autoridad arreglada su
  disparador desaparece, pero sigue siendo una premisa falsa contra un servidor
  multi-local.
  Las dos están en `fuente.js`, con su paridad y su contrato; no las toco en la
  misma tanda que la causa.
- *Por qué la página congela el hilo principal a los ~4,8 s.* Está medido el
  cuándo —el muestreador se detiene ahí— y no el por qué. Descarté el volumen de
  registros: los aparté y la aplicación volvió a bajárselos de la nube y los
  reescribió idénticos dentro de la misma carga, así que mi prueba era inválida.
  Descarté también las sentencias `debugger` del paquete: las cuatro están en
  html2canvas y bajo banderas de depuración.
- *Las pruebas de caja, cobro y reembolso*, que siguen sin hacerse y ahora sí
  tienen vía: en cuanto el preview reconstruya con este arreglo, la cuenta debería
  entrar en Local A1 de verdad.

**Y una corrección sobre mi propio arreglo de la mañana.** El de
`ui-context-bridge.js` es real y su contrato lo sostiene solo, pero **no era
esto**: ahí la barrera se abre a tiempo y la copia del dispositivo está bien. Lo
dije ya al mediodía y lo repito aquí para que no quede la impresión de que
aquello cerraba este caso.

### 20/11/2026 · cierre de la tanda · Caché descartada, y la cadena no cuadra

Quedaban dos explicaciones del vacío de `locales` tras el arreglo de autoridad:
caché del navegador, o una segunda puerta. **La caché está descartada**, y con
una medida limpia: `performance.getEntriesByType('resource')` en la propia
página da, para `edge-auth-patch.js`, `transferSize=300` —una revalidación 304—
con `decodedBodySize=46247`. El fichero arreglado pesa en disco exactamente
46247 bytes; el anterior pesaba 44941. **La página ejecutó el código nuevo.** Y
el commit desplegado lleva la línea en su sitio:

```
function puedeLeer(rol, key) {
  if (rol === "Propietario") return !!CLAVES_CONTROLADAS[key];
  if (estaEn(CLAVES_COMUNES, key)) return true;
  if (estaEn(CLAVES_LECTURA_CUALQUIER_CARGO, key)) return true;   ← desplegada
  ...
```

Aun así, con el código nuevo corriendo, la respuesta se repite: `locales` → `""`.

**Y aquí la cadena deja de cuadrar, que es lo que hay que decir.** Medí cuál es
la envoltura más externa de `window.storage.get` en la página:

```
async function(key, shared) { if (!CLAVES_CONTROLADAS[key]) return getOriginal(key, shared); …
```

Es la **puerta de autoridad**, no el puente de contexto, aunque el HTML cargue
`edge-auth-patch.js` antes que `ui-context-bridge.js` y ambos se declaren
instalados (`__contextoRolSeguroInstalado` y `__laUiContextBridgeV1`, los dos
ciertos). Así que la cadena efectiva es puerta → puente/base.

Y recorriendo el código, **ninguna de las capas de debajo puede devolver `""`**
para esa clave:

- con `puedeLeer` ya en cierto, la puerta solo tiene una salida para `locales`:
  `return getOriginal(key, shared)`. No hay rama especial para esa clave entre
  las sustituciones de mínimo privilegio; las comprobé una a una.
- el **puente** sirve las tres claves de contexto desde `localStorage`, y
  `almacen:locales` **sí** se lee desde la propia página al principio de la
  carga: lo medí, devuelve `[{"id":"QA-A1",…}]`.
- la **base** (`index-storage-bootstrap.js:1243`) no trata `locales` como tabla
  de nube —no está en `TABLAS_EMPRESA` ni en `TABLAS_EMPRESA_LOCAL`— y su clave
  de caché no se namespacea por usuario, porque `locales` no está en
  `CLAVES_CACHE_POR_USUARIO`. Acaba en `leerLocalOpcional('locales')`, que es
  `almacen:locales`.

El único productor de `""` que queda en todo el recorrido es `respuestaVacia` de
la puerta, y para llegar ahí hace falta `!rol` —falso: el contexto guardado dice
`rol: "Camarero/a"`— o `!puedeLeer`, que ya es cierto.

**Conclusión honesta: una de mis lecturas de la cadena está mal, y no sé cuál.**
No puedo decidirlo sin instrumentar las tres capas desde dentro de la página, y
eso choca con el bloqueo del hilo a los ~4,8 s, que sigue sin explicar. Lo que no
voy a hacer es ofrecer una tercera explicación coherente: hoy ya se han caído dos.

**Para quien siga, el camino más corto.** Envolver las tres capas y registrar
quién responde cada clave, con un guion de diagnóstico cargado solo en el Deploy
Preview —el repositorio ya tiene ese precedente exacto en
`reset-pruebas-preview.js`, que solo corre si el host casa con el patrón del
preview—. Escribir el registro en `localStorage` y leerlo desde otra pestaña del
mismo origen, que es la técnica que ha funcionado toda la tarde: la página se
congela, pero `localStorage` es del origen y se lee desde cualquier documento de
él.

**Lo que queda en firme de la tanda.** El servidor está impecable de punta a
punta con la sesión real. El dispositivo tiene su copia correcta y continua. Los
dos arreglos —la lectura del puente con la barrera agotada, y `locales` legible
para todo cargo— son defectos reales, cada uno con su contrato, y la batería pasa
entera: 323/323. Ninguno de los dos cierra el fantasma. Y las pruebas de caja,
cobro y reembolso siguen sin hacerse.

### 20/11/2026 · noche · El fantasma, cerrado. Y de dónde salía de verdad

Está arreglado, y la medida lo dice sin ambigüedad. Mismo sondeo, misma cuenta,
sesión limpia, con todo desplegado:

```
17652ms empresas      <- puerta-autoridad = [{"id":"QA-EMP-A",…}]
18456ms locales       <- puerta-autoridad = [{"id":"QA-A1","nombre":"Local A1",…}]
18456ms localActivoId <- puerta-autoridad = "QA-A1"

contexto operativo: rol=Camarero/a · localId=QA-A1 · empresaId=QA-EMP-A
consola: ni un «Local no autorizado para esta cuenta»
```

Compárese con la medida de esta tarde: `locales` devolvía `""` a los 4081 ms, el
contexto resolvía `localId: null` con un `localIdSolicitado` inventado distinto
en cada arranque, y la consola traía el rechazo. **Ya no se acuña ningún local
fantasma.** Y la lectura ahora llega a los 18456 ms en vez de a los 4081: es el
reintento de `loadKey` haciendo su trabajo, que es exactamente lo que se buscaba.

#### La causa, en una frase

Un vacío haciendo de «no lo sé», en una tabla de autoridad **duplicada**.

Y con más precisión, porque cada palabra costó una medida:

1. `locales` estaba solo en `CLAVES_ENCARGADO`, y Camarero/a no figura en
   ninguna de las cuatro listas de cargo, así que Camarero/a, Cajero/a y
   Churrero/a tenían negada la lista de los locales de su propia membresía. El
   servidor la da de buen grado, ya filtrada a quien pregunta.
2. La rama del cargo sin verificar respondía `respuestaVacia(key)`, es decir
   `{ value: "" }`, confiando en que `loadKey` aplicara su valor por defecto. Y
   lo aplicaba: ése era el problema.
3. `fuente.js:101783` convierte un vacío en el valor por defecto **en el acto y
   sin reintento** —el bucle reintenta tres veces, pero solo si la lectura
   lanza—, y `fuente.js:105556` lee cero locales como una instalación antigua de
   un solo local e inventa uno.
4. Y lo que escondió todo medio día: **la tabla está en dos sitios**.
   `edge-auth-patch.js` la tiene, y `fuente.js` lleva inlineada su propia copia.
   El paquete se carga el último, así que su envoltura queda por fuera y su
   copia es la que decide. Arreglé el fichero suelto dos veces, comprobé byte a
   byte que lo desplegado llevaba el cambio, y el comportamiento no se movía.

#### Lo que lo resolvió, y no fue razonar

Un andamio de diagnóstico cargado solo en el Deploy Preview que se vuelve a
poner por encima de las envolturas de `window.storage` cada vez que lo
desplazan, y escribe en `localStorage` lo que ve, porque la página congela su
hilo y no se la puede interrogar desde fuera. Eso dio tres cosas que no se
podían leer en el código: que la pila de envolturas se reconstruye durante el
arranque (appcc a los 371 ms, el observador del catálogo TPV a los 1371, la
puerta de autoridad a los 2386), que las tres claves de contexto nunca bajan a
la base, y qué capa responde qué y cuándo.

Dos tropiezos propios en el camino, los dos escritos: la primera versión del
andamio se llamaba en círculo (`Maximum call stack size exceeded`, 606
registros), y mi primer arreglo no distinguía **sin sesión** —donde un vacío es
honesto y definitivo— de **con sesión y cargo sin resolver**, que es el «no lo
sé». Lo segundo lo destapó `tests/pm33/p03-frontend-multilocal-contract.mjs`
poniéndose rojo, y tenía razón: ahora la rama consulta la sesión y solo lanza
cuando hay alguien detrás.

#### Lo que impide que vuelva

`tests/rediseno/locales-visibles-para-su-cargo-contract.mjs` carga **las dos
copias** de la tabla y exige que decidan lo mismo, exhaustivo: todos los cargos
contra todas las claves controladas, en lectura y en escritura. Una divergencia
significa que el arreglo no está donde corre.
`tests/rediseno/fallar-cerrado-sin-mentir-contract.mjs` ejecuta el fichero real
en un entorno donde el cargo no se puede verificar y exige que la lectura lance,
también en la copia del paquete. Batería entera: 324/324. Paridad:
`PARIDAD_CUERPO_EXACTA=1`.

#### Lo que sigue abierto, sin adornos

- **Por qué la página congela el hilo principal.** Ahora es el bloqueo
  principal: `read_page` y la ejecución de JavaScript agotan el tiempo de espera
  pasados unos segundos, así que **no he podido leer la interfaz** ni confirmar
  en pantalla que el selector dice «Local A1». Lo que confirmo es la capa de
  datos, que es donde estaba el defecto. Descartados el volumen de registros
  (prueba invalidada y explicada) y las sentencias `debugger` del paquete.
- **Las pruebas de caja, cobro y reembolso** siguen sin hacerse, y ahora el
  obstáculo es el bloqueo del hilo, no los permisos.
- **Los dos defectos de `fuente.js`**: el vacío indistinguible en `101783` y la
  invención de locales en `105556`. Con la autoridad arreglada su disparador
  desaparece, pero siguen ahí.
- **La escritura que miente**: en la misma puerta, un `set` con el cargo sin
  verificar devuelve éxito simulado. Es el mismo defecto del lado de escribir.
  No lo he tocado porque afecta a la cola de pendientes y merece su propia
  tanda.
- **El andamio sigue puesto**, a propósito: es la única forma de ver dentro de
  una página que no responde, y hace falta para el bloqueo del hilo. Sale antes
  de cualquier cierre, y está marcado como tal en su cabecera y en el
  `index.html`.

### 20/11/2026 · noche · El bloqueo no era de la página. Corrección

Escribí varias veces hoy que «la página congela su hilo principal». **Era
falso**, y lo desmiente la primera medida que hice del hilo en vez de deducirlo.

Instrumenté dos cosas en el andamio: la deriva del reloj —si entre dos tics de
150 ms pasan muchos más, el hilo estuvo ocupado— y las tareas largas con
`PerformanceObserver`. En un arranque completo de cuarenta segundos:

```
atascos del hilo:  922ms → bloqueado 765ms
                  3039ms → bloqueado 1967ms      (y nada más en 40 s)
tareas largas:     la mayor dura 336ms
reloj de 150 ms:   tictaqueando los 39 s completos
lecturas:          registradas a los 15600 ms, con locales = [{QA-A1}]
```

Dos atascos cortos durante el arranque y ninguno después. **La página no se
congela.** Lo que se atasca es el **canal del panel del navegador**: en esa misma
pestaña, `1 + 1` por CDP agota los 45 segundos de espera mientras el interior de
la página funciona con normalidad, y una pestaña recién abierta vuelve a
responder un rato antes de atascarse igual.

El patrón, ahora que se ve: una pestaña nueva contesta una o dos llamadas y
luego todas agotan su espera; abrir otra vuelve a funcionar. Eso es una sesión
de depuración atascada por pestaña, no un programa que se cuelga.

**Qué cambia esto.** Tres cosas, y dos son buenas:

1. No hay ningún defecto de rendimiento del producto que perseguir. El punto
   de la lista «por qué la página congela el hilo» queda **cerrado por
   inexistente**, no pendiente.
2. Las pruebas de caja, cobro y reembolso **no están bloqueadas por el
   producto**. Están estorbadas por la herramienta, y eso tiene apaño: pestaña
   nueva por medida, lotes cortos, y el registro por `localStorage` leído desde
   otro documento del mismo origen, que es lo que ha funcionado toda la tarde.
3. Y lo que no es bueno: me pasé horas tratando como defecto algo que era mi
   instrumento. La señal estaba disponible desde el principio —una página
   trivial del mismo origen respondía al instante—, y la interpreté como «es la
   página, no el panel» cuando decía justo lo contrario en cuanto se medía el
   hilo por dentro.

Para dejarlo probado y no deducido, el andamio escribe ahora un **latido** en su
propia clave (`diag_latido_v1`), con reloj de pared, cada segundo. Si una llamada
del panel agota su espera y justo después el latido tiene una marca de hace un
segundo, la página estaba viva mientras el canal no respondía.

**Lo que esto no explica, y hay que decirlo:** por qué se atasca el canal. No lo
sé, y como es la herramienta y no el producto, no voy a gastar la tanda en
averiguarlo; se trabaja alrededor. Lo que sí queda anotado es cómo reconocerlo,
para no volver a confundirlo con un defecto del programa: si `read_page` y la
ejecución de JavaScript agotan su espera **pero la consola y la red siguen
leyéndose**, es el canal.

#### Matiz, media hora después: tampoco «el canal» está probado

En la sección anterior dije que lo atascado es el canal del panel. Eso sigue
siendo lo más probable, pero el latido me obliga a matizarlo antes de que quede
como un hecho.

El latido —una clave propia, reloj de pared, cada segundo— **se detuvo a los
15 segundos** del arranque en la pestaña que acababa de abrir, y no volvió a
latir en los siete minutos siguientes. Es decir: en esa carga los temporizadores
de la página sí pararon. En la carga anterior, en cambio, el reloj de 150 ms del
andamio tictaqueó sus 39 segundos completos. Dos cargas, dos conductas.

La explicación que encaja con las dos, y con todo lo demás, es que **el panel
del navegador estaba oculto**: una página de un panel oculto es una página en
segundo plano, y el navegador estrangula y acaba congelando sus temporizadores.
Eso detiene el latido y hace que una evaluación por el canal agote su espera,
porque la evaluación necesita que la página ejecute una tarea. Y cuadra con el
control que sí hice: con el panel a la vista, `1 + 1` en una página trivial del
mismo origen respondió al instante.

**Pero el control que lo probaría no lo he podido hacer.** Intenté poner la
pestaña en primer plano y recargarla para ver si el latido seguía: el lote entero
agotó sus 300 segundos: `tabs_select` y `navigate` también se atascan. Así que lo
dejo dicho como lo que es:

- **Descartado**: que sea un defecto de rendimiento del producto. Dentro de la
  página, el peor atasco de un arranque de cuarenta segundos es de unos dos
  segundos, y la tarea más larga dura 336 ms. Eso no cuelga nada.
- **Probable, no probado**: que el mecanismo sea el estrangulamiento de una
  página en segundo plano dentro de un panel oculto.
- **Lo que hace falta para cerrarlo y para seguir**: el panel del navegador a la
  vista y en primer plano. No es algo que yo pueda poner desde aquí.

Y la señal para reconocerlo, que es lo que vale para la próxima: si `read_page` y
la ejecución de JavaScript agotan su espera **pero la consola y la red siguen
leyéndose**, no es el programa.
