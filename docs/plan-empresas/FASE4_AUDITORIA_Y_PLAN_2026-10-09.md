# Fase 4 · Colecciones comunes por empresa — auditoría, diseño y estado

Fecha: 2026-10-09 · Rama `claude/vigilant-hawking-uji8l4` (QA) · **Solo QA. Producción no se toca.**

## 1. Qué se encontró (solo lectura)

`public.almacen_kv` guarda las colecciones «pequeñas» del programa como **una fila por colección**:

| | QA (`qjqorixtkilwsndqayyx`) | Producción (`flqercbgpgmmfaakrwkc`) |
|---|---|---|
| Clave primaria | `(key)` | `(key)` |
| Reglas de acceso | `pm05_almacen_*`: exigen `empresa_id` no nulo; el cliente nunca lo manda → **toda lista se rechaza (403)** | «acceso por rol y clave»: tabla de claves por cargo, **sin mirar la empresa** |
| Disparadores | `abc_productos_solo_rpc` (productos solo por RPC), `pm05_scope_almacen_kv_trg`, `pm07_bootstrap…` | solo `almacen_kv_actualizar_fecha` y `pm07_bootstrap…` |
| Filas | 25 (4 de la empresa de demostración y 21 de fixtures `qa_pm04:*`, 7 sin empresa) | 7 sueltas, sin empresa (catalogoProv, conteos, disenoMenu, historialRespaldos, productos, temaOscuro, traspasos) |

Consecuencias con varias empresas:

1. Una segunda empresa **no puede crear** su fila `empleados`, `pedidos`… (la clave ya existe).
2. El cliente guarda con `upsert({key, value})` y lee con `.eq("key", key).maybeSingle()`: no manda empresa.
3. Funciones del servidor que escriben `where key='productos'` **sin filtrar por empresa**:
   - `abc_catalogo_guardar_productos` (espejo P3b): el `UPDATE` final tocaría la fila de todas las empresas.
   - `abc_productos_guardar_lista` (P3c, **sin fuente en el repositorio**: existe solo en QA): leía, bloqueaba y escribía la fila `productos` de «cualquier» empresa.
4. El resto de lecturas del servidor (`obtener_contexto_operativo`, `pm08_local_operable`) ya filtran por `empresa_id`.
5. El cliente tiene 25 colecciones por `almacen_kv`; `proveedores`, `clientes`, `albaranes`, `facturasDirectas`, `gastosGenerales`, `movimientos`, `fichajes`, `auditoria` y los libros de caja ya van por tablas con empresa o por RPC.
   **Corrección (2026-10-10, ver §4d):** para `movimientos` y `fichajes` esto solo es cierto en QA; en producción `movimientos_registro` y `fichajes_registro` no llevan `empresa_id` y las reglas de `movimientos_registro` no miran la empresa.

## 2. Diseño (migración `20261009140000_plataforma_f4_colecciones_por_empresa.sql`)

- Filas sin empresa: **se conservan**, etiquetadas con la empresa ficticia `__sin_empresa__` (nadie pertenece a ella, así que nadie las ve). Nada se borra.
- `empresa_id NOT NULL` y clave primaria `(empresa_id, key)`. **El cliente no cambia**: PostgREST usa la clave primaria como destino del `upsert`; el disparador rellena la empresa.
- Disparador `pm05_zz_plataforma_f4_kv_empresa_trg`:
  - alta sin empresa → la del JSON (`empresaId`) o la **única** empresa con membresía activa de la persona; si hay varias o ninguna, **42501** (falla cerrado);
  - desde la API la empresa de una fila **no se puede cambiar**.
- Reglas nuevas `plataforma_kv_*` (sustituyen a las dos familias conocidas; la migración se niega si encuentra otra): pertenecer a ESA empresa **y** que el cargo que se tiene EN ESA empresa pueda tocar esa clave (misma tabla que producción). Borrar: solo Propietario. `empresas` y `configEmpresa` siguen sin poder guardarse (igual que hoy en producción).
- Funciones `abc_catalogo_guardar_productos` y `abc_productos_guardar_lista`: se añade el filtro por empresa con una sustitución de texto comprobada (cada fragmento debe aparecer exactamente una vez, si no la migración aborta; si la función no existe en ese entorno no se toca).

## 3. Pruebas

`tests/plataforma/db/p09-colecciones-por-empresa-contract.mjs` (Postgres real, registrada en la puerta de CI como contrato activo):

- forma «qa» (con la RPC real de P3c copiada literalmente en `fixtures-f4/`) y forma «prod» (políticas por rol y clave, siete colecciones sin etiqueta);
- dos empresas con la misma clave, cada una ve y reescribe solo la suya; `UPDATE`/`DELETE` por clave solo alcanzan la propia; no se puede insertar en la empresa ajena ni en la ficticia; la empresa no se cambia ni por columna ni por JSON;
- tabla de cargos (Camarero/a, Cajero/a, Churrero/a, Encargado, Propietario), borrar solo Propietario, perfil desactivado, administrador de plataforma sin membresía;
- empresa ambigua (cuenta con dos empresas) y cuenta sin empresa: rechazo 42501;
- las dos funciones de productos solo tocan la lista de su empresa (mismo id de producto en A y B);
- idempotente, atómica (política desconocida / texto de función inesperado / empresa ficticia ya existente → aborta sin dejar nada a medias).

Pruebas de mutación: 19 mutaciones de la migración (quitar el cargo, quitar la pertenencia, empresa mutable, elegir empresa al azar, quitar cada filtro de las funciones, borrar sin ser Propietario, etc.) — **todas detectadas** (`M16`, la atomicidad, se cubre con los casos de aborto).

## 4. Estado en QA

- **Aplicado y verificado** (2026-10-09):
  - Funciones y ayudas (`plataforma_f4_a_ayudas_privadas`, `plataforma_f4_d_funciones_filtran_por_empresa`): aplicadas con la herramienta; las huellas coinciden con las del Postgres local.
  - Estructura, disparador y reglas (la parte «destructiva»): la herramienta de base de datos la cancela sola aunque Pedro la autorice, así que la ejecutó Cowork desde el editor SQL de Supabase (`PRUEBA_COWORK_FASE4_APLICAR_EN_QA.md`; resultado «Success. No rows returned»). Queda fuera del historial de migraciones de QA (no se registra al ejecutarse desde el editor).
  - Comprobado después, solo leyendo: clave primaria `(empresa_id, key)`, `empresa_id` obligatorio, cuatro reglas `plataforma_kv_*` con huellas **idénticas** a las del Postgres local, disparador `pm05_zz_plataforma_f4_kv_empresa_trg`, RLS activa, 7 filas antiguas conservadas con `__sin_empresa__` (13 de QA-EMP-A y 5 de QA-EMP-B intactas), y `anon` sin permiso de ejecución.
  - Prueba real dentro de QA con cuentas reales (dueñas `duena.f3.4` y `duena.f3.5`) y deshecha al final (sin dejar datos): el `upsert` sin empresa crea una fila por empresa; cada una ve solo la suya; reescribir una no toca la otra; no se escribe en la empresa ajena (42501); la clave `empresas` sigue rechazada (42501); `UPDATE` por clave alcanza una sola fila; la cuenta con dos empresas (`owner.a`) falla cerrado (`almacen_kv_empresa_no_determinada`).
- **Prueba con la pantalla (Cowork, 2026-10-10, `PRUEBA_COWORK_FASE4_DOS_EMPRESAS.md`): 6 de 6 pasos sin ninguna diferencia.** Dos empresas nuevas (`QA F4 Cliente 1` y `2`), cada una con su dueña: sin aviso rojo, «Guardado: cambios sin confirmar: 0», cada empresa ve solo sus puntos de control (`Frigorífico F4-1` / `Congelador F4-2`), un solo local cada una, y al entrar «desde otro equipo» (almacenamiento del navegador borrado) cada una recupera lo suyo **desde la nube**. La administradora, en `QA-EMP-A`, no ve ninguno de los dos.
- **Comprobado después en la base de QA (solo lectura):** cada empresa nueva tiene exactamente sus tres filas (`conteos`, `puntosControl`, `temaOscuro`), el `puntosControl` de cada una lleva solo su punto, `temaOscuro` es distinto en cada una (`false` / `true`) y no hay ninguna fila sin empresa nueva. Esto prueba también que **el cliente actual funciona sin cambios**: `upsert({key, value})` usa por defecto la clave primaria `(empresa_id, key)` y el disparador pone la empresa.
- Aviso «N colecciones solo en este equipo»: salió **N = 1** en las dueñas nuevas (se esperaba 3: solo una colección queda sin poder guardarse). En la cuenta administradora (`owner.a`, con membresía en `QA-EMP-A` y `QA-EMP-B`) sale 4 y luego 5: es el caso «una cuenta, dos empresas» declarado en las limitaciones (falla cerrado), no un fallo.
- Observación de Cowork: no hubo ventanas de incógnito reales; simuló «otro equipo» borrando todos los datos del sitio entre ventanas, lo que equivale para comprobar que lo guardado viene del servidor.
- Para deshacer en QA: guion guardado fuera del repositorio (volver a `PRIMARY KEY (key)`, quitar etiqueta `__sin_empresa__`, recrear `pm05_almacen_*`).

## 4b. Lista de productos de cada empresa nueva (F4b, 2026-10-10)

- **Hallazgo (leyendo el cliente de P3c):** la RPC `abc_productos_guardar_lista` exige que la fila `productos` de la empresa ya exista (si no, `abc_productos_lista_nube_ausente`, que el cliente no trata como permiso denegado sino como fallo a reintentar: «cambios sin confirmar» y aviso rojo), y `abc_productos_solo_rpc` impide crearla desde la API. Una empresa dada de alta por la plataforma no tenía esa fila, así que su lista de productos nunca llegaba a la nube.
- **Arreglo (`20261009150000_plataforma_f4b_lista_productos_inicial.sql`):** disparador `AFTER INSERT` en `public.empresas` que crea `(empresa, 'productos', [])` con los permisos del propietario de la función (la protección «productos solo por RPC» sigue intacta para la API) y relleno de las empresas existentes sin fila. Solo usa `create or replace` y `on conflict do nothing`: no borra ni pisa nada, y la herramienta de base de datos lo aceptó sin pedir confirmación.
- **Probado:** `p09` (Postgres real) ampliado: relleno, alta nueva, no pisa una lista previa, idempotente, la API no ejecuta el disparador y la empresa nueva guarda su lista con la RPC; 6 mutaciones, todas detectadas. Aplicado en QA: todas las empresas tienen su lista (QA-EMP-A conserva sus 30 productos).
- **Abierto (no es de F4):** un producto con **precio de venta** exige que el local tenga contexto fiscal (entidad fiscal y moneda); el alta de empresa de la plataforma no lo crea, así que guardar un producto con precio en una empresa nueva fallará hasta que se configure (capa de configuración ABC). Productos sin precio de venta (ingredientes) sí se guardan.

## 4c. Empresas dadas de baja no cuentan (F4d, 2026-10-10)

- **Hallazgo (Cowork, ronda 3b, paso 5):** `owner.a` tiene membresía activa en `QA-EMP-A` y en `QA-EMP-B` (empresa dada de baja con la membresía aún activa). Desde F4b ambas tenían fila `productos` y el servidor veía dos empresas para la cuenta: `almacen_kv_empresa_no_determinada` (subidas) y `almacen_kv_empresa_ambigua` (RPC de la lista), banner rojo «productos — revisa el acceso».
- **Producción tiene la misma forma** (solo conteos): 3 empresas, 1 activa, una cuenta con membresía activa en las tres y ninguna con dos empresas activas. Sin arreglo, esa cuenta no habría podido guardar tras F4.
- **Arreglo (`20261009170000_plataforma_f4d_empresas_vigentes.sql`):** solo cuentan las empresas con `activo = true` al decidir la empresa de una cuenta y al dar acceso a una fila (tres funciones, `create or replace`; sin cambios de datos, tablas ni reglas). **Orden en producción: F4, F4b, F4c, F4d.**
- Probado (`p09`, Postgres real, incluida la forma «prod» con tres empresas y una activa; 10 mutaciones: 7 detectadas, 3 equivalentes) y aplicado en QA con huellas idénticas. Comprobado en QA con `owner.a` real, deshecho al final. Falta repetir el paso 5 con la pantalla (`PRUEBA_COWORK_FASE4B…`, ronda 4).

## 4d. Fuera de `almacen_kv`: lo que aún no separa empresas en producción (hallazgo 2026-10-10, solo lectura de estructura y reglas)

Repaso de las 90 tablas de `public` de producción. Todas llevan `empresa_id` y reglas que lo miran, **salvo estas** (las demás sin reglas están cerradas a la API):

| Tabla (producción) | Qué dejan hacer hoy las reglas | Riesgo con 2 empresas clientes |
|---|---|---|
| `movimientos_registro` (sin `empresa_id`; columnas `id, fecha, datos, creado_en`) | leer e insertar: cualquier perfil activo; borrar: cualquier Propietario | **Alto**: una empresa lee los movimientos de la otra y un Propietario puede borrarlos |
| `perfiles` | leer: el propio **o cualquier Propietario activo**; actualizar: cualquier Propietario activo (`private.es_propietario_activo()` no mira la empresa) | **Alto**: el Propietario de una empresa puede leer y cambiar rol/activo de los perfiles de otra |
| `suscripciones_push` (sin `empresa_id`; tiene `local_id`) | las propias; y las de `user_id` nulo, para cualquier Propietario | Medio-bajo: avisos push sin dueño visibles/borrables por cualquier Propietario |
| `fichajes_registro` (sin `empresa_id`) | lectura filtrada por empleado/`pm11_puede_ver_personal(e.empresa_id, …)`; sin reglas de escritura | Bajo: la lectura ya pasa por la empresa del empleado |
| `empresas`, `operaciones_procesadas`, `prefiltro_limites` | sin reglas: cerradas a la API | Ninguno |

QA **no** refleja esto: allí `perfiles` y `suscripciones_push` solo dejan lo propio (`qa_*`) y `movimientos_registro` tiene `empresa_id` y solo lectura, así que QA oculta el problema y rompe la subida de `movimientos` desde el cliente (el «1 colección solo en este equipo» de la ronda 4b). Probar el arreglo exige alinear antes las reglas de QA con la forma de producción o probar en Postgres real con las dos formas, como en F4.

**Siguiente paquete (F4e, por diseñar):** reglas por empresa para `perfiles`, `movimientos_registro` y `suscripciones_push` en la forma de producción, sin romper la pantalla de empleados del Propietario (que lista perfiles de su propia empresa) ni la subida de movimientos del cliente actual. No se aplica nada en QA ni en producción sin presentar antes el diseño. Condición previa de la primera empresa cliente real, igual que F4.

## 5. Limitaciones declaradas

- **Una cuenta = una empresa activa** para las colecciones comunes. Con membresías activas en varias empresas **activas** (las dadas de baja no cuentan desde F4d), las escrituras sin empresa se rechazan y las lecturas por clave devolverían varias filas.
- **`productos`** (4b): la lista solo la escribe el servidor (RPC) mientras exista `abc_productos_solo_rpc`; el cliente de esta rama todavía no llama a la RPC de P3c, así que en QA la lista de productos de una empresa nueva se queda «solo en este equipo». Es el siguiente subpaso y depende del cliente de P3c, que no está en esta rama.
- `empresas` y `configEmpresa` siguen sin sincronizar entre equipos (igual que en producción hoy).
- **P3c** (lista `productos` por RPC) tiene su fuente en el PR #121 (`codex/f7-p3-preparacion-20261004`, borrador, «NO FUSIONAR», con conflictos con `release`; ventana de producción pospuesta por Pedro el 5/10): migraciones `20261004201358_abc_p3c_concurrencia_productos`, `20261005060000_abc_p3c_titularidad_productos` y `20261005100000_abc_p3c_lista_confirmada`. Comprobado (2026-10-10, solo lectura): los cuatro fragmentos que F4 sustituye en `abc_productos_guardar_lista` aparecen **exactamente una vez** en la versión de ese PR y son idénticos a los de QA, así que F4 encaja con P3c sin cambios. (El PR #123 no es P3c: es un arreglo del arqueo de caja.) Esta rama (#118) todavía no lleva el cliente de P3c, por eso la lista de productos de una empresa nueva se queda «solo en este equipo» en su vista previa.
- La identidad por empleado de `obtener_contexto_operativo` en la rama del repositorio (PM33) busca filas con `local_id`; en QA ya usa la tabla `empleados`. Misma divergencia repositorio↔QA a resolver en la Fase 5.

## 6. Para la Fase 5 / 6 (necesitan autorización escrita de Pedro)

- **Orden de aplicación en producción:** primero las tres migraciones de P3c (la de «titularidad» rellena la empresa de la fila `productos` de producción, que hoy tiene `empresa_id` nulo) y **después** F4 (`20261009140000`, posterior por fecha). Si F4 fuese antes, la fila `productos` de producción quedaría etiquetada `__sin_empresa__` y P3c rechazaría la venta.
- **Fases 5 y 6 en la misma ventana:** tras F4, las siete colecciones sueltas de producción (la fila `productos` ya con empresa si P3c entró antes) dejan de verse en la aplicación de la empresa actual; con la Fase 6 (producción a cero) da igual, pero entre 5 y 6 sin vaciar la aplicación actual dejaría de ver esos datos.

- Reemplazar en producción «acceso por rol y clave» por `plataforma_kv_*` (la migración lo hace sola) **a la vez** que se publica la app; entre una cosa y otra un cliente antiguo vería fallar el guardado en la nube (queda en la cola local y se reintenta).
- Las siete colecciones sueltas de producción quedan etiquetadas `__sin_empresa__` (invisibles); la Fase 6 decide si se borran.
