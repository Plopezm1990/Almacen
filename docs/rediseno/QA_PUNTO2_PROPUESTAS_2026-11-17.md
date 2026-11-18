# L&A Suite · Punto 2 · Nueve propuestas visuales

Fecha: 17 de noviembre de 2026  
Rama: `rediseno/f0-base-qa` · PR #225 en borrador · solo QA  
Preview de referencia: `https://deploy-preview-225--chic-entremet-9107cf.netlify.app/`

## Alcance

El Punto 2 del plan general no es una pantalla nueva aislada. Es completar y
verificar el sistema de apariencia que permite escoger nueve propuestas,
paletas y colores propios, y comprobar que cada propuesta conserva su
identidad en el panel, la navegación, las composiciones y los tamaños de
ordenador y móvil.

Las nueve propuestas registradas son: **Oliva, Claro, Pulso, Patio, Rumbo,
Sello, Órbita, Ascua y Pase**. La biblioteca contiene seis paletas: Bosque,
Café tostado, Azul ámbar, Amatista, Granada y Ascua. El editor admite seis
campos HEX, importación de cinco o seis valores, prueba temporal, guardado por
empresa, historial, restauración y delegación por cargo.

## Evidencia reproducible cerrada

### Código y contratos

- `tests/rediseno/p05-propuestas-contract.mjs`: **PASS**. Fija los nueve
  identificadores, los seis bloques de paleta, las reglas responsive, el modo
  de movimiento reducido, las piezas de Rumbo y los destinos protegidos de
  Pase.
- `tests/rediseno/p01-capas-y-migraciones-contract.mjs`: **PASS**. Las seis
  capas están enlazadas con marca de caché y huella; las dos migraciones de
  apariencia conservan su superficie pública.
- `tests/rediseno/p02-apariencia-empresa-pglite-contract.mjs`: **49/49 PASS**.
- `tests/rediseno/p03-botones-de-solo-icono-contract.mjs`: **PASS**, sin
  botones mudos.
- `tests/rediseno/p04-mfa-politica-pglite-contract.mjs`: **26/26 PASS**.
- Manifiesto CI: **353 contratos activos, 1 histórico, 11 utilidades y 5
  diagnósticos; 370 entradas**. La prueba negativa del validador también
  pasa.

### Banco aislado

El banco `docs/rediseno/banco-apariencia/index.html` cubre nueve diseños, seis
paletas y las 54 combinaciones diseño × paleta, contraste, importación de HEX,
revisiones, restauración, prueba temporal, permisos y controles táctiles. El
panel de `pase.html` cubre el plano de sala, estados, cola, filtros, accesos,
Ascua, permisos, cambio de local, respuestas tardías y el suelo táctil de
44×44 px. Estas pruebas no escriben en QA.

### Corrección incluida en esta tanda

La corrección de destinos Pase → TPV había cambiado `la-pase-panel.js`, pero
`index.html` conservaba la marca de caché anterior. Se renovó la marca a
`qa-destinos-exactos-20261117` y se fijó la nueva huella en P01. Sin este cambio
el navegador podía servir el panel viejo aunque el archivo nuevo estuviera en
el despliegue.

## Cobertura por propuesta

| Propuesta | Composición y comportamiento acreditados | Pendiente real |
|---|---|---|
| Oliva | Tokens de marca y panel general con accesos e indicadores | Repetir recorrido completo en preview con esta propuesta aplicada |
| Claro | Cabecera por áreas y navegación compacta | Repetir recorrido completo en preview |
| Pulso | Panel analítico denso, indicadores y accesos operativos | Repetir recorrido completo en preview |
| Patio | Panel orientado a turno y accesos táctiles amplios | Repetir recorrido completo en preview |
| Rumbo | Ctrl/⌘K, búsqueda por permiso/sinónimo, teclado, foco, fijadas y recientes en `localStorage` por contexto | Falta repetir en preview la persistencia y el salto a un registro concreto; el control de navegador quedó bloqueado por la política URL de Windows en esta tanda |
| Sello | Cabecera corporativa, serif de títulos, agrupación Ventas/Almacén/Equipo/Control y panel de gestión | Repetir recorrido completo en preview |
| Órbita | Carbón/acero/coral, titular degradado, cristal, iconos, entrada al hacer scroll, línea de puntero y alternativa de movimiento reducido; ahora expone ventas registradas calculadas del ledger y enlaza a Resultados | Ocupación y comandas solo deben añadirse cuando exista un contrato/contexto de datos verificable; no se inventan cifras |
| Ascua | Esfera de ocupación, sala, caja y accesos sobre los contratos reales de Pase | Repetir recorrido completo en preview con lectura de datos reales |
| Pase | Plano de sala, estados, cola, filtros, accesos y protección del destino mesa/cuenta | Repetir live los tres destinos con la marca nueva; la regresión ya está corregida y no debe haber fallback silencioso |

## Estado de cierre

El sistema está **integrado y cubierto en código y banco**, pero el Punto 2 no
se marca todavía como cerrado al 100 % porque quedan dos comprobaciones que
solo son honestas en el preview autenticado:

1. Rumbo: fijar/recuperar un destino y abrir un registro concreto en otra
   sesión/contexto.
2. Repetir las composiciones de las nueve propuestas en desktop y móvil y
   resolver, con contratos reales, los indicadores de Órbita que no existen en
   el `Dashboard` actual.

El intento de reabrir el preview desde el control de navegador de Windows fue
bloqueado por la política de URL del entorno. No se ha tocado ninguna sesión ni
se ha ejecutado una operación económica para compensarlo.

## Siguiente tanda exacta

1. Publicar el commit de esta tanda y verificar que el preview sirve la nueva
   marca de `la-pase-panel.js`.
2. Con un propietario autenticado, aplicar temporalmente cada propuesta y
   medir 1440×900, 1024, 430, 390 y 320 px; guardar solo evidencia, no cambios
   económicos.
3. En Rumbo, fijar un destino permitido, recargar, abrirlo y comprobar el
   retorno de foco; repetir en un segundo contexto.
4. En Órbita, decidir qué RPC o prop proporcionará ocupación y comandas. Las
   ventas ya usan el ledger real; si no existe contrato para los otros dos,
   mantenerlos fuera del panel y documentar la dependencia, nunca presentar
   ceros como datos reales.
5. Actualizar la matriz y este acta con el SHA del preview. Mantener PR #225 en
   borrador y no tocar producción.

## Pruebas ejecutadas en esta tanda

```text
REDISENO_P01_CAPAS_Y_MIGRACIONES_OK=1
REDISENO_P05_PROPUESTAS_OK=1 disenos=9 paletas=6 rumbo=PASS pase=PASS responsive=PASS reduced_motion=PASS
APARIENCIA_LOCAL=PASS (49/49)
REDISENO_P03_BOTONES_SOLO_ICONO_OK=1 solo_icono=3 mudos=0
MFA_POLITICA=PASS (26/26)
MANIFEST_VALIDATION=PASS (370 entradas)
git diff --check=PASS
```

## Corte de esta tanda · SHA `57cf1c84`

La matriz queda fijada al commit `57cf1c84`,
publicado en la rama del PR y con Deploy Preview listo. P01, P02 (49/49),
P03, P04, P05, el validador de manifiesto, su self-test y la paridad de
`source-recovery` pasan localmente.

El PR sigue en borrador, abierto y sin fusionar. La puerta de CI general aún
tiene trabajos en curso y un `p2-p06` histórico en rojo, fuera del alcance de
este Punto 2; no se declara un falso verde global.

## Cierre live actualizado · 18/11/2026 · SHA `107aed65`

La pasada autenticada del Deploy Preview #225 se completó con el propietario
de QA-EMP-A en Local A1. El marcador de caché de `fuente.js` se renovó a
`qa-orbita-ventas-20261118`; el preview nuevo sirve el indicador **Ventas
registradas €311,66**, calculado del ledger real, junto a margen, pedidos y
stock bajo. El cambio corrige la discrepancia que mostraba el bundle anterior
sin ventas aunque el código ya las calculaba.

Se recorrieron las nueve propuestas en el editor y en la suite, en escritorio
(1440×900) y móvil (390×844). Cada una activó su composición esperada, sin
desbordamiento horizontal; en móvil las nueve conservaron la barra inferior.
Rumbo mostró «Ir a una pantalla» y navegó a Clientes por búsqueda; tras
aplicar Rumbo temporalmente en QA, **Clientes** quedó en Fijadas y Panel
general en Recientes después de recargar. Rumbo se restauró después mediante
el botón oficial, como revisión 10, dejando QA-EMP-A de nuevo en Órbita.

Pase se probó temporalmente con datos reales: 4 de 6 mesas con cuenta abierta,
78 pedidos en servicio y caja abierta. «Sala y TPV» abrió TPV, «Cocina» abrió
«Cocina y comandas» y «Caja» abrió «Arqueo de caja». Ascua mostró el panel de
servicio con esos mismos datos. La vista previa del editor confirmó móvil sin
overflow y el aviso de contraste cuando una paleta requiere ajustar enlaces o
borde funcional; no se pulsó «Aplicar a la empresa» para esas pruebas y no se
ejecutó ninguna operación económica.

Con esta evidencia, el Punto 2 queda **cerrado en QA**: selector de nueve
propuestas, seis paletas, prueba temporal y restauración, Rumbo con fijadas y
recientes, Órbita con ventas reales, Pase/Ascua con navegación y contexto,
responsive de escritorio/móvil/tablet, controles táctiles, contraste y
movimiento reducido cubiertos por el preview y los contratos locales. Quedan
fuera del cierre los opcionales ya separados: paginación/búsqueda ampliada de
la cola de Pase, positivo de Cajero/a con MFA y el registro contable de las
migraciones de Apariencia en `schema_migrations`.

## Addendum marco operativo Órbita · 18/11/2026

Por decisión de producto, Órbita queda como marco visual predeterminado para
TPV, Pase, Cocina y Caja, con el parecido exacto a la maqueta: carbón,
acero/coral, cabecera contextual, dos columnas en escritorio y tarjetas
apiladas en móvil. El cambio es de presentación; no modifica permisos, RPC,
estados, fiscalidad ni operaciones económicas.

El panel de servicio de Pase ahora también se monta cuando el diseño activo es
Órbita y recibe la clase `la-orbita-pase`, de modo que plano, cola y accesos
Sala/TPV → Cocina → Caja comparten el mismo marco. La prueba temporal live de
Órbita mostró el panel con datos reales y mantuvo Local A1; no se aplicó la
apariencia a la empresa ni se hicieron cobros, reembolsos o cierres nuevos.

Verificaciones de la tanda: `REDISENO_P05_PROPUESTAS_OK=1`,
`REDISENO_P01_CAPAS_Y_MIGRACIONES_OK=1`, `git diff --check=PASS`, sintaxis de
`la-pase-panel.js=PASS` y paridad `source-recovery=PASS`. El detalle de shell
se fija con la marca de caché `qa-orbita-shell-pase-20261118`; el panel de Pase
con `qa-orbita-pase-20261118`.

## Addendum corrección visual del shell · 18/11/2026 · SHA `ac4731aa`

La primera captura del TPV todavía conservaba verde en el fondo, las tarjetas y
la acción seleccionada aunque el editor indicaba Órbita. La causa fue concreta:
el shell histórico declaraba sus propios tokens en la regla `[data-tema="oscuro"]`
y algunos botones del TPV usaban el verde de marca como color literal, por lo
que no bastaba con cambiar el fondo del diseño.

Se corrigió en `la-apariencia.css` sin tocar la lógica de negocio: Órbita fija en
el contenedor operativo sus tokens carbón/acero/coral (`#17191C`, `#929DA7`,
`#FF4B32`) con superficie, texto, línea, foco y estados derivados; además la
acción seleccionada «Sala / restaurante» usa ahora el coral de Órbita en vez del
verde literal. La marca de caché de `index.html` queda en
`qa-orbita-shell-pase-v5-20261118` para evitar servir el bundle anterior y
corregir el escape del encabezado móvil `.md:hidden`, que impedía aplicar el
carbón de Órbita al shell responsive.

Evidencia live en el preview #225: con «Apariencia → Órbita → Probar en la
suite», el TPV móvil muestra shell carbón, tarjetas oscuras, precios coral,
chips de categoría y «Sala / restaurante» coral, sin overflow. La prueba fue
temporal y no aplicó la apariencia a QA-EMP-A; no se ejecutaron cobros ni otras
operaciones económicas. El siguiente control visual sigue siendo recorrer en
este mismo marco TPV, Pase, Cocina y Caja en escritorio y las cuatro anchuras
móviles antes de cerrar la revisión estética final.

## Addendum separación del historial del TPV · 18/11/2026 · SHA `acbf303c`

El bloque largo de «Historial de ventas» ya no se muestra dentro de la pantalla
operativa del TPV. Se conserva su lógica existente —filtros por texto, fechas,
medio de pago y estado, trazabilidad, ticket/QR y anulación—, pero el TPV ahora
presenta solo un resumen compacto de ventas, total vigente y ticket medio.

El botón **Ver historial completo** abre una pantalla propia a pantalla completa,
con el contexto del local activo y **← Volver al TPV**. La pantalla usa el mismo
marco Órbita, funciona en móvil y escritorio, y no cambia datos ni permisos por
el mero hecho de abrirla. Se renovó la marca de caché de `fuente.js` a
`qa-orbita-ventas-history-v1-20261118`.

Contratos tras el cambio: `node --check fuente.js`, `node --check
source-recovery/fuente-recuperado.js`, `SOURCE_RECOVERY_CHECK=PASS`, P01 PASS,
P05 PASS y `git diff --check=PASS`. En el preview #225 se comprobó el flujo
completo en Local A1: resumen compacto → «Ver historial completo» → pantalla
independiente con filtros → «← Volver al TPV», sin perder el contexto del local.

## Addendum organización del TPV · 18/11/2026 · SHA `582e2a07`

La revisión de composición detectó un segundo exceso: el TPV cargaba siempre
reparto de productos, unión de cuentas, pedido operativo, descuentos y cuentas
aparcadas debajo de la venta. Esas funciones no se eliminan, pero pasan a estar
plegadas por defecto detrás de **Mostrar operaciones de cuenta**; mesas, venta,
cobro y el resumen permanecen visibles. El botón cambia a **Ocultar operaciones
de cuenta** al abrirlas y conserva los controles y permisos originales.

La marca de caché de `fuente.js` queda en
`qa-orbita-tpv-organization-v2-20261118`. Se mantiene la paridad con
`source-recovery`; P01, P05, sintaxis y `git diff --check` siguen en verde.

## Addendum Cocina y Caja compactas · 18/11/2026 · SHA `d7b2cd9f`

La misma jerarquía progresiva se aplica ahora a Cocina y Caja. En Cocina quedan
visibles el turno, el aviso de seguridad y las comandas; la gestión de sesión,
responsable, terminales, cierre, estaciones y rutas queda detrás de
**Mostrar gestión avanzada**. Si hace falta abrir sesión o ya existe un cierre
en curso, el bloque se abre automáticamente para no ocultar una acción
obligatoria. En Caja siguen visibles la apertura, el esperado, el contado y el
arqueo; entradas, retiradas, reembolsos y el historial de arqueos se muestran
bajo demanda. Un borrador pendiente vuelve a abrir automáticamente los
movimientos para permitir el reintento sin duplicar.

No cambia ningún RPC, permiso ni operación económica. La marca de caché de
`fuente.js` queda en `qa-orbita-cocina-caja-v4-20261118`; la cola de Cocina
muestra ocho comandas recientes por defecto y ofrece **Mostrar todas** sin
perder el filtro de estación. Se sincroniza `source-recovery` y se mantienen
P01, P05, sintaxis y `git diff --check`.

## Addendum advertencia de guardado al arrancar · 18/11/2026 · SHA `45ea4b11`

La advertencia que aparecía en el panel no era un aviso visual de Órbita. Se
reprodujo en el preview con una sesión real de QA y el detalle de **Guardado**
mostró tres claves distintas: `conteos`, `movimientos` e
`historialRespaldos`. La investigación separó las causas:

- `historialRespaldos` era una copia automática grande que se intentaba meter
  en `localStorage`; cuando el navegador alcanzaba su cuota se marcaba como
  fallo aunque la copia no fuera una edición del usuario.
- `conteos` y `movimientos` se volvían a guardar desde los efectos reactivos
  después de hidratar el estado con datos autoritativos de servidor. Ese
  segundo envío no aportaba cambios y podía quedar pendiente si QA tardaba o
  agotaba el `statement_timeout`.
- Los logs de QA confirmaron el síntoma de backend (`57014`, timeout) en
  escrituras de `almacen_kv` y en la RPC del día operativo. No se tocó esa
  configuración del servidor ni producción porque el aviso específico se
  elimina evitando las escrituras redundantes.

La corrección mueve el historial de copias a IndexedDB, limpia la marca de
pendiente antigua cuando IndexedDB confirma la copia, no sube la
normalización de compatibilidad de conteos/movimientos durante el arranque y
suprime únicamente el siguiente guardado reactivo provocado por la
sincronización autoritativa inicial. Las ediciones reales posteriores siguen
guardándose y conservan el reintento si el servidor falla. También se cambió
la marca de caché de `fuente.js` a `qa-persistencia-sin-advertencias-v1-20261118`.

Contratos de código: `node --check fuente.js`,
`node --check index-storage-bootstrap.js`,
`python source-recovery/recuperar_candidato.py --check` y
`git diff --check` pasan. Falta la verificación final en el nuevo Deploy
Preview: recargar con una sesión limpia, comprobar que no aparece la franja
amarilla ni el contador de pendientes y confirmar que una edición real sigue
produciendo su confirmación normal.

### Verificación live posterior · 18/11/2026

La comprobación autenticada ya está cerrada en el preview con el propietario
de QA-EMP-A y `Local A1`: el panel muestra **Guardado: cambios sin confirmar 0**
y **Arranque: datos que no se pudieron cargar 0**. No aparecen las claves
`conteos`, `movimientos` ni `historialRespaldos` en la cola y el panel Pase
continúa cargando sus datos reales (4/6 mesas con cuenta, 78 pedidos y caja
abierta). La verificación fue de lectura; no se ejecutaron cobros,
reembolsos, cierres ni cambios económicos nuevos.

## Addendum Órbita fijada en QA · 18/11/2026 · SHA `1932b106`

La sesión de propietario confirmó que QA-EMP-A estaba mostrando Ascua, no
Órbita, aunque la propuesta acordada era el parecido exacto con la maqueta.
Se probó Órbita y se aplicó a la empresa mediante el editor, con confirmación
del servidor en la revisión 12. Tras recargar, `data-la-diseno="orbita"` se
resuelve desde el servidor y no desde una copia local.

La revisión visual encontró además que la cabecera móvil seguía verde: la
regla del shell tenía el escape CSS duplicado en `.md\\:hidden`. Se corrigió
el selector a `.md\:hidden`, se renovó la marca de caché a
`qa-orbita-shell-pase-v5-20261118` y los contratos P01/P05 y `git diff --check`
quedaron en verde. No se ejecutaron cobros, reembolsos, cierres ni cambios de
datos económicos.

## Addendum propina del cambio · 18/11/2026

La capa de propina ya está integrada en Órbita, sin ejecutar cobros. La casilla
solo aparece cuando el cambio es positivo y llama a
`abc_registrar_propina_efectivo` después de `abc_confirmar_efectivo`, con
operación idempotente y mensajes de error honestos. El cierre de cuenta y la
fiscalización no se saltan si la segunda operación falla. La fuente y su
espejo de recuperación permanecen byte a byte en paridad.

La migración reproducible y el contrato P06 quedan documentados en
`docs/rediseno/PLAN_P1_PROPINA_ORBITA_2026-11-18.md`. La prueba funcional en QA
queda pendiente de una autorización explícita para un cobro simulado y de un
fixture reversible; la prueba contable/fiscal sigue separada. Implementación
publicada en `2f9679f8`.
