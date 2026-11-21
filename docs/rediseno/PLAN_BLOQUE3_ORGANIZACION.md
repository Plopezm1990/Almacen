# Bloque 3 · Organización · preparación sin sesión

14 de noviembre de 2026, por la tarde. 34 vistas pendientes de 37. Esto es el
trabajo previo, hecho sin gastar ventana de sesión, para que cuando haya sesión
se mida en vez de buscar. Mismo método que el bloque 2, que funcionó.

Y el titular, porque cambia el orden de todo: **de las 34, solo 19 se pueden
medir con la cuenta que tenemos.** Diez están detrás de una puerta que no es un
cargo, y cinco no están construidas.

## El reparto

| | |
|---|---|
| Alcanzables con el propietario de QA | **19** |
| Detrás del panel de Plataforma, que pide administrador de plataforma | **10** |
| No construidas | **5** |

### Las 19 alcanzables, y dónde viven

Solo **tres pestañas** del enrutador dan acceso a todo el bloque: `locales`,
`configuracion` y `descuentos` (esta última ya medida, `org-32`). Lo demás son
secciones dentro de ellas, que es exactamente el error que cometí en el bloque 1
al buscar pestañas inventadas.

**`configuracion` → 13 vistas con siete clics.** `ConfiguracionLocal` es un
índice con una barra de siete botones, y los ids salen del código, no de
adivinarlos:

| Sección | Botón | Vistas |
|---|---|---|
| `dia` | Día y cajas | `org-19` |
| `modalidades` | Modalidades | `org-20` |
| `equipos` | Equipos | `org-21`, `org-22` |
| `terminales` | Terminales y cajas | `org-24`, `org-25` |
| `fiscalidad` | Fiscalidad y AEAT | `org-26` |
| `cargos` | Cargos y permisos | `org-27`, `org-28`, `org-29`, `org-30` |
| `permisos` | Permisos | `org-31` |

Más el índice en sí, `org-18`, que es la barra de los siete botones. La
catorceava de ese grupo, `org-23`, no entra: no está construida, y más abajo
está la prueba. Aun así es la mejor relación de toda la matriz: **una pestaña,
cero datos de ensayo, trece vistas.** Mejor incluso que el conteo del bloque 2,
que fueron seis.

Las siete secciones existen y tienen contenido de verdad, medido en caracteres
de código: `cargos` 31 KB, `fiscalidad` 24 KB —con «Expediente de piloto
sandbox» y «Procesamiento fiscal QA», así que está pensada para esto—,
`permisos` 17 KB, `equipos` 8,7 KB, `terminales` 7,5 KB, `dia` 7 KB,
`modalidades` 4,2 KB.

**`locales` → 6 vistas.** Con sus disparadores reales, leídos del código:

| Vista | Cómo se abre |
|---|---|
| `org-02` Ficha de local | `FichaDatosLocal`, con Guardar y Cerrar |
| `org-03` Alta de local | «+ Añadir local nuevo» → «Crear local» |
| `org-04` Desactivar o reactivar | «Desactivar» y «Locales desactivados» |
| `org-05` Identidad de empresa | `FichaEmpresaBasica`, «Ficha de empresa» |
| `org-06` Empresas desde la aplicación | `GestorEmpresas`, «Empresas» |
| `org-07` Confirmación del propietario | `ConfirmarConContrasenaPM29` |

### Dos guardas que el código dice con sus palabras

`ConfiguracionLocal` aborta antes de dibujar nada en dos casos:

```js
if (!esPropietario) contenido = h(Card, …, "Solo un usuario con rol Propietario puede ver y cambiar la configuración.");
else if (!empresaId || !localId) contenido = h(Card, …, "Selecciona un local concreto para configurarlo.");
```

La segunda importa, y no por casualidad: es **la misma pared** que dejó fuera a
las dos cuentas que creé en el bloque anterior. Sin pertenencia real a un local
no hay `localId`, y sin `localId` esta pantalla no existe. El propietario de QA
sí tiene QA-A1, así que para él las trece están abiertas.

## Las 10 que no son cuestión de cargo

`org-08` a `org-17` son el **panel de Plataforma**, que no vive en el paquete:
es `plataforma-panel.js`, 60 KB, cargado aparte desde `index.html` y mostrado
**antes** de abrir la aplicación, desde `owner-bootstrap-post-reset.js`. Su
propio encabezado lo explica: son las pantallas del administrador de la
plataforma para dar de alta, desactivar, reactivar, copiar y eliminar empresas
clientes.

La puerta está en el servidor, y es exacta:

```sql
create or replace function private.es_admin_plataforma() … as $$
  select auth.uid() is not null
     and exists (select 1 from private.plataforma_admins a where a.user_id = auth.uid())
     and exists (select 1 from public.perfiles p
                  where p.user_id = auth.uid() and p.activo = true and p.rol = 'Propietario');
$$;
```

Dos condiciones, y la primera es la que falta: **una fila en
`private.plataforma_admins`.** El esquema `private` no se alcanza desde el
navegador —no hay API que escriba ahí—, así que esto no es un permiso que se
conceda desde la interfaz ni algo que yo pueda arreglar midiendo mejor. Lo tiene
que hacer alguien con acceso a la base de datos de QA.

**Lo que falta, dicho con precisión:** una fila en
`private.plataforma_admins` para un usuario que ya tenga perfil
`Propietario` activo, **en el proyecto de QA** (`qjqorixtkilwsndqayyx`) y solo
ahí. Es una concesión de privilegio, así que la decisión es del propietario, no
mía; yo no tengo acceso a la base y no voy a pedirlo por otra vía.

Mientras no exista, las diez quedan como «bloqueada por acceso» y no como
«pendiente», que no es lo mismo y conviene que la matriz lo distinga.

**Una medición barata que sí se puede hacer en la próxima sesión**, de una
línea y sin escribir nada: leer `window.__laPlataformaActiva`. El servidor lo
pone a cierto cuando hay **algún** administrador registrado. Si sale cierto, el
panel existe en QA y solo falta la fila; si sale falso, en QA no hay ningún
administrador de plataforma todavía. Dos respuestas distintas, y conviene saber
cuál es antes de pedir nada.

## Las 5 no construidas, con su prueba

Mismo patrón que `inv-35`, `inv-36` y «unir mesas»: el servidor va por delante
de la interfaz, o simplemente no hay pantalla.

| Vista | Prueba |
|---|---|
| `org-23` Prueba de impresora y cajón | **El producto lo dice solo.** `ConfigEquipos` avisa: «Solo es un registro de los aparatos del local (impresoras, cajón, datáfono…). **No los conecta ni los configura.**» Y en toda la sección no hay ni «prueba», ni «probar», ni «imprimir» |
| `org-33` Zonas, mesas y tarifas horarias | «tarifa» aparece **cero** veces en el paquete. Y no hay pantalla de crear o editar mesas ni zonas de sala: el mapa se **lee** (`cargarMapaSalaA07`), como las variantes. Las «zonas» que sí hay son `ZONAS_ALMACEN`, de producto, no de sala |
| `org-34` Plantilla por tipo de negocio | «tipo de negocio», cero veces |
| `org-35` Teclas del TPV por cargo | «teclas» solo aparece en mensajes internos de React, ninguno del producto |
| `org-36` Integraciones y puente de impresión | «puente de impresión» e «integracion», cero veces |

Las cinco citan «Plan maestro» o «Informe de estado» en su referencia y no un
componente, que es la misma firma que tenían `inv-35` e `inv-36`. Esa firma
empieza a ser un indicador fiable: **si la referencia no nombra código,
probablemente no hay código.** Vale la pena comprobarlo en el resto de la matriz
antes de gastar sesión en ellas.

## Cómo medir, y en qué orden

1. **`configuracion` y sus siete secciones.** Trece vistas, cero datos de
   ensayo, una sola pestaña. Primero esto, siempre.
2. **`locales`**, las de leer: `org-02`, `org-05`, `org-06`, `org-07`.
3. **`locales`, las que escriben**, al final y con cuidado (ver abajo).
4. Leer `window.__laPlataformaActiva` de paso, que es gratis.

### Lo que escribe, y la regla que me pongo

Tres de las diecinueve no se miran: se hacen.

- `org-03` crea un local. Se crea **uno de ensayo**, con nombre que lo diga.
- `org-04` desactiva un local. Se desactiva **el de ensayo, nunca QA-A1**.
  Desactivar QA-A1 dejaría sin suelo todo el trabajo anterior.
- `org-22` crea un equipo. De ensayo también, y el propio producto avisa de que
  «los equipos no se borran: se desactivan», así que quedará uno desactivado en
  el historial y eso se anota en vez de fingir que se limpió.

Y una que **no** se hace: `org-06` tiene «+ Añadir empresa», y crear una
empresa en QA es mucho más que un dato de ensayo. Se mide la pantalla y su
estado, no se pulsa. Hay además un detalle que conviene comprobar: el arranque
pone `window.__laPlataformaActiva` precisamente para que esa pantalla **no**
ofrezca «Añadir empresa» cuando las altas las hace el administrador de la
plataforma. Si en QA sale sin el botón, no es un defecto: es esa regla
funcionando.

## Lo que falta para empezar

Sesión de propietario. Nada más para las diecinueve: ni dato previo, ni segundo
dispositivo, ni permiso nuevo. Las diez de Plataforma necesitan además la
decisión sobre `private.plataforma_admins`, y las cinco no construidas no
necesitan sesión en absoluto: ya están resueltas aquí.

## Lo ya escrito en la matriz, sin sesión

Quince de las 34 no necesitaban entrar en QA para tener veredicto, así que
están volcadas ya: las **cinco no construidas** y las **diez bloqueadas por
acceso**. 15 filas tocadas y ninguna otra; 267 filas y 25 columnas intactas.

Con eso la matriz baja de 134 a **119 pendientes**, y así queda el reparto
completo de las 267:

| | |
|---|---|
| Pasa | 113 |
| Pasa (vacío con los datos actuales) | 6 |
| Pasa en preview | 2 |
| No construida | 17 |
| **Bloqueada por acceso** | **10** |
| Pendiente | 119 |

### Un valor nuevo, y por qué

«Bloqueada por acceso» no existía en la matriz. Lo he añadido porque llamar
«Pendiente» a las diez de Plataforma sería engañoso en los dos sentidos: ni
están sin medir por falta de tiempo, ni se van a medir con más sesiones. Están
esperando una decisión que no es mía. Mezclarlas con las 119 que sí se abren
con una sesión haría que la cifra de pendientes dijera menos de lo que parece.

Cuesta explicarlo una vez y evita malentendidos cada vez que alguien cuente la
columna.
