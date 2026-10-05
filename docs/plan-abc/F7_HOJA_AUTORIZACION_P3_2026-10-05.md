# F7 · Hoja de autorización del paquete P3/P3b/P3c

Fecha: 2026-10-05
Estado: `PREPARADA_NO_AUTORIZADA`
PR: [#121](https://github.com/Plopezm1990/Almacen/pull/121), borrador contra `release`.

Esta hoja delimita una futura ventana. La orden «Vale, hazlo» del 5/10 autorizó
la lectura de titularidad y esta preparación; **no autorizó migraciones,
normalización de datos, fusión ni despliegue en producción**.

## Resultado de la lectura autorizada del 5/10

- P3, P3b y P3c: cero registros por nombre en producción. Faltan la columna
  `precio_con_impuesto`, las dos funciones auxiliares de P3 y sus dos RPC.
  Las 13 dependencias del preflight existen.
- `almacen_kv.productos`: una fila JSON válida, con **`empresa_id = NULL`**.
  Contiene dos artículos; ambos declaran la misma empresa y el mismo local
  activo dentro del JSON. No faltan IDs ni contextos, y no hay IDs duplicados.
  El catálogo TPV tiene una fila, que coincide con uno de esos artículos.
  Huella de la lista en esta lectura: `996a349f363cdad4cd2b32b5cf8884f0`.
  Stock: dos filas, huella `3bfa99d15ebdd7b67646b32703e87686`.
  Catálogo: una fila, huella `5f29d3d0b3faa5cbbcad42f30cce8966`.
  Operaciones: 29 filas, huella `7b6a0b631ac54d267876d5b2278e967b`.
- Existe un contexto fiscal activo sin ambigüedad. Las dos funciones de cálculo
  conservan las huellas previas: `1a3ff32669ae46d5e65520afb4b8782b` y
  `e1e935e1ec1bee56be265326b8dfe565`.
- El navegador autenticado todavía puede escribir `productos` directamente,
  según privilegios y RLS. Hay dos disparadores previos sobre `almacen_kv`,
  ninguno bloquea esa escritura. La carrera que motivó P3c sigue presente.
- P3b busca el espejo por `almacen_kv.empresa_id`. Con la fila productiva
  actual no lo encontraría; P3c rechazaría la venta por `lista_nube=sin_fila`.
  La migración adicional
  `20261005060000_abc_p3c_titularidad_productos.sql` rellena solo ese
  `empresa_id`, bajo bloqueo de fila y después de comprobar la identidad de
  cada artículo y sus locales. No modifica el JSON. En QA se reprodujo la
  forma productiva, se ejecutó la normalización y pasó el contrato P3c completo
  dentro de `BEGIN`/`ROLLBACK`. Una lista simulada con dos empresas fue
  rechazada por la condición prevista. QA quedó en su estado inicial.

La consulta exacta de titularidad, sin identificadores ni contenido, está en
`F7_P3C_TITULARIDAD_SOLO_LECTURA_2026-10-05.sql`. El preflight P0–P7
original está en `F7_P3_P3B_PREFLIGHT_SOLO_LECTURA_2026-10-04.sql`.

## Alcance que se propondrá autorizar

1. Repetir **antes de escribir** el preflight P0–P7, la titularidad y el estado
   operativo de cajas/pagos; parar ante cualquier diferencia material. Las
   lecturas de esta nueva ventana necesitan su permiso de solo lectura.
2. Pedro hace una copia manual nueva de roles, esquema y datos fuera del
   repositorio; anota hora y tamaño, comprueba que los tres archivos no están
   vacíos y conserva otra copia. El plan gratuito no ofrece una restauración
   automática inmediata.
3. Congelar la cabeza exacta del PR, `release`, la CI, hashes de los cuatro
   SQL y de `fuente.js`, y el despliegue de Netlify al que volver. No fusionar
   mientras el PR sea borrador.
4. En una ventana sin operaciones de caja ni personal usando Productos,
   aplicar y verificar por separado en producción:

   | Orden | Archivo | Efecto esperado |
   | --- | --- | --- |
   | 1 | `20261002150000_abc_p3_catalogo_autoritativo.sql` | precio de carta con IVA incluido y RPC P3 |
   | 2 | `20261002170000_abc_p3b_espejo_lista_nube.sql` | espejo del precio aceptado a la lista |
   | 3 | `20261004201358_abc_p3c_concurrencia_productos.sql` | RPC transaccional y bloqueo de escrituras directas antiguas |
   | 4 | `20261005060000_abc_p3c_titularidad_productos.sql` | `empresa_id` de la fila: `NULL` → empresa única de sus artículos |

   Comprobar tras cada paso registro, objetos y huellas. Tras el cuarto,
   `value` debe conservar su huella inicial, `empresa_id` debe coincidir con
   la empresa de los dos artículos, y catálogo y stock deben conservar sus
   recuentos y huellas. La fecha `updated_at` de la fila sí puede cambiar.
5. Ejecutar `F7_P3C_HUMO_ROLLBACK_PRODUCCION_2026-10-05.sql`: cambia
   temporalmente 0,01 € de un artículo del catálogo, confirma lista y TPV,
   hace `ROLLBACK` y devuelve huellas de lista, catálogo y stock. Comparar
   con la foto inmediata anterior; las operaciones del humo también deben
   volver a su recuento previo. El guion pasó en QA sin alterar esas huellas.
   No crea ventas, cobros ni caja persistentes.
6. Fusionar el PR #121 en `release` con `expected_head_sha` igual al commit
   congelado y un título explícito del commit de fusión sin `[skip netlify]`.
   Esto debe provocar **una sola publicación** de la rama `release` en
   Netlify. Comprobar el ID del despliegue, el hash servido de `fuente.js`
   y que el sitio apunta al proyecto productivo; si no se publica, parar.
7. Con Pedro presente, abrir Productos y TPV en producción y comprobar
   carga, contexto y precios **solo mirando**. Una edición real del catálogo
   requeriría autorización aparte. Si falla la aplicación nueva, se podrá
   volver a publicar el despliegue anterior de Netlify **solo si Pedro lo
   incluye expresamente en la autorización de la ventana**. Esa acción no
   deshace migraciones ni datos.

## Datos que se congelarán al abrir la ventana

| Dato | Foto de preparación; debe repetirse |
| --- | --- |
| Cabeza del PR #121 | `[COMMIT_CONGELADO]` |
| Cabeza de `release` | `[RELEASE_CONGELADO]` |
| P3 SHA-256 | `28a37b688e6c9e66b09dcce31ed34430a3b116d90576f53b479892ad6c4aaa3b` |
| P3b SHA-256 | `3f84a5cd7715c6ac6113f707e0ea8fa0eb7b479aeafdc6166bcee9d298cbcf42` |
| P3c SHA-256 | `2a2c66872f9eb2b75ae124dd5c44261f8172f1ea2f1087da7be91fc9818d610f` |
| Titularidad SHA-256 | `1a3fe1429f401656fa6aaae5314f88747cbd74f26874006c9203b677ff1f5a4c` |
| `fuente.js` SHA-256 | `ed618ee61072f92497017bbaa1516f166c888293acee31ca8b064d7e1eaca89f` |
| Netlify actual | `6ac22344948ac900082766ab` (verificar otra vez) |
| Copia manual nueva | `[HORA_Y_TAMAÑOS]` |

## Condiciones de parada

- Falta una copia, cambia la foto de producción, hay otra empresa o un local
  inválido en la lista, o la CI del commit congelado no da la puerta general
  en verde. El workflow antiguo P2-P06 falla por su alcance fijo incluso con
  este PR de P3; esa excepción debe figurar en la decisión de Pedro, sin
  modificar ni desactivar el workflow.
- Una migración falla, no aparece en el registro, no coinciden sus objetos o
  cambia el JSON del producto durante la normalización. Parar sin continuar
  con la siguiente migración; no intentar una reversión de esquema improvisada.
- El humo deja filas o huellas distintas, Netlify publica otro commit, o la
  pantalla muestra errores nuevos. Informar del estado exacto y esperar otra
  decisión. La vuelta al despliegue anterior solo cubre un fallo del cliente.

## Autorización futura

La hoja y la lectura de hoy no son autorización para ejecutarla. Al abrir la
ventana, Pedro podrá aprobar el alcance exacto con una respuesta que identifique
el commit congelado, las cuatro migraciones, la normalización de `empresa_id`,
el humo con `ROLLBACK`, la única publicación de producción y la política de
parada. Si no se cumplen todas las condiciones previas, la opción recomendada
es **posponer**.
