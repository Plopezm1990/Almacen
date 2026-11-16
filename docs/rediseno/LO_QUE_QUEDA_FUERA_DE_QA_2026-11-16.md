# Lo que queda, y por qué no lo puedo hacer yo

16 de noviembre de 2026 · commit `69797c90` · PR #225 (borrador) · preview de QA
`https://deploy-preview-225--chic-entremet-9107cf.netlify.app`

Las 267 filas de la matriz ya no tienen ninguna en «Pendiente». Lo que sigue es
lo que queda, separado por quién puede moverlo. Nada de esto es una suposición:
cada bloqueo lleva al lado cómo se midió.

## Cómo está la matriz hoy

| Estado | Filas |
|---|---|
| Pasa | 228 |
| No construida | 23 |
| Bloqueada | 14 |
| Parcialmente construida | 1 |
| No ejercitada a propósito | 1 |
| **Total** | **267** |

Las 23 «No construida» no son un problema de acceso a QA: son pantallas que el
programa todavía no tiene. Conviene no confundirlas con las bloqueadas.

---

## 1 · Lo que depende del servidor de QA

### 1.1 · No hay forma de apuntar una salida de stock en el servidor

**A quién afecta:** `ini-06` (registrar merma desde la alerta de caducidad), la
pantalla **Mermas** entera, y la salida manual de **Productos**. Las tres llaman
a la misma función, `registrarSalida`.

**Qué pasa.** La merma se registra, la pantalla dice que el stock baja, y el
stock baja — en la copia de este equipo. El servidor no se entera. A la
siguiente recarga, su versión del stock pisa la local y la merma desaparece sin
dejar rastro: vuelve la alerta de caducidad, y la pantalla Mermas dice «Sin
mermas registradas en este periodo».

**Cómo se midió.** Sembrado un producto de ensayo con un lote que caduca en tres
días, confirmada la merma de 6 ud., y preguntado al servidor acto seguido:

```
stock_estado.total = 12   updated_at = 2026-11-16T12:23:48Z   (la hora del albarán)
```

Es decir: el servidor seguía con las 12 unidades del albarán y no había tocado
nada. Al recargar, la copia local volvió a 12 y la alerta reapareció. Repetido
dos veces, con el mismo resultado.

**Por qué.** El servidor tiene función para entrada de mercancía
(`registrar_entrada_stock`), para venta (`registrar_venta_stock_carrito_pm09`) y
para traspaso (`trasladar_stock_interno`, `trasladar_stock_entre_locales`).
**No tiene ninguna para una salida por merma.** Así que `registrarSalida` solo
mueve la copia del equipo, y el puente de autoridad del servidor la pisa al
cargar.

**Qué hace falta.** Una RPC de salida de stock en el proyecto de QA
(`qjqorixtkilwsndqayyx`), con los mismos motivos que ya maneja la aplicación, y
que `registrarSalida` la use igual que la recepción usa la suya.

**Por qué no la escribo yo.** La parte de cliente sí la puedo hacer; la de
servidor no: no tengo la contraseña de esa base de datos, y `supabase db push`
solo alcanza el proyecto enlazado, que es **producción**. Ejecutar ahí sería
exactamente lo que no se debe hacer.

> Esto es lo más serio de la lista. No es una pantalla que falta: es una
> operación que el programa dice haber hecho y no ha hecho.

### 1.2 · `entrevista-personal` no responde en QA

**A quién afecta:** `per-21` (informe de entrevista).

**Qué pasa.** Al pulsar «Empezar entrevista», la llamada falla y no hay
entrevista, así que tampoco hay informe que ver. La pantalla del informe sigue
**sin verificar ni una sola vez**, y así queda dicho.

**Cómo se midió.** La consola del navegador, en dos líneas seguidas:

```
[QA] Edge Function redirigida a QA: entrevista-personal -> entrevista-personal
Access to fetch at 'https://qjqorixtkilwsndqayyx.supabase.co/functions/v1/entrevista-personal'
  ... blocked by CORS policy: Response to preflight request doesn't pass access
  control check: It does not have HTTP ok status.
```

La nota anterior de la matriz decía que la bloqueaba la CSP porque la función
apunta a producción. **Era falso**, y queda desmentido: el shim sí la redirige
al proyecto de QA, y lo que ocurre es que allí esa función no contesta.

**Qué hace falta.** Desplegar `entrevista-personal` en el proyecto de QA.

**Por qué no lo hago yo.** Su fuente **no está en este repositorio**.
`supabase/functions` solo trae `abc-b07-webhook`, `c07d-worker-qa`,
`crear-cuenta-empleado`, `enviar-notificacion`, `importar-factura`,
`plataforma-crear-propietario`, `prefiltro-candidato` y `qa-crear-empleado`. No
se puede desplegar desde aquí ni teniendo credenciales.

`importar-albaran` e `importar-nomina` están en el mismo caso: aparecen en la
lista `RUTAS_QA` del shim, y tampoco tienen fuente en `supabase/functions`. Pero
**no se han pulsado** —harían falta una foto de albarán y una de nómina—, así
que lo que pase con ellas está sin medir y no lo doy por bueno.

### 1.3 · Faltan permisos sobre `prefiltros_candidatos`

**A quién afecta:** `per-24` (resumen de prefiltro) y `per-25` (eliminar
prefiltro).

**Qué pasa.** No se puede crear un prefiltro, así que no hay resumen que abrir
ni prefiltro que eliminar.

**Cómo se midió.** Pulsado «Nuevo prefiltro» → «Crear enlace» con una sesión
real de Propietario que acababa de **leer** esa misma tabla sin problema. El
servidor responde a las tres operaciones:

```
42501 · permission denied for table prefiltros_candidatos
```

El rol `authenticated` tiene `SELECT` y no tiene `INSERT`, `UPDATE` ni `DELETE`.

**Qué hace falta.**

```sql
GRANT INSERT, UPDATE, DELETE ON public.prefiltros_candidatos TO authenticated;
```

en el proyecto de QA, y sólo ahí.

**Por qué no lo aplico yo.** La misma razón que 1.1: sin contraseña de esa base,
y `supabase db push` apunta a producción. Además **ninguna migración del
repositorio define esa tabla**, así que su esquema tampoco se reproduce desde
aquí: existe en los servidores pero no en el código.

### 1.4 · El Panel de Plataforma necesita una concesión de privilegio

**A quién afecta:** las diez filas `org-08` a `org-17`.

**Cómo se midió.** `private.es_admin_plataforma()` exige dos cosas a la vez: una
fila en `private.plataforma_admins` y un perfil Propietario activo. La segunda
la tengo; la primera no existe. El esquema `private` no se alcanza desde el
navegador, así que no es un permiso que se conceda desde la interfaz.

**Qué hace falta.** Una fila en `private.plataforma_admins` en el proyecto de
QA, y sólo ahí.

**Por qué no la creo yo.** Porque es una **concesión de privilegio**, y esa
decisión es tuya, no mía. Aunque tuviera acceso a la base, no me la daría a mí
mismo sin que lo digas.

### 1.5 · `acc-08` necesita una instalación vacía

**Qué pasa.** La pantalla de primer acceso del propietario sale cuando
`obtener_estado_instalacion` devuelve `needs_setup`. En QA devuelve
`{state:"ready"}`, y ese estado es **de la instalación entera**, no de cada
usuario: ni creando una cuenta nueva aparecería.

Tampoco se puede montar a mano, como sí se hizo con `acc-06`:
`mostrarNecesitaSetup` es privada de `owner-bootstrap-post-reset.js` y no se
expone.

**Qué hace falta.** Un entorno vacío aparte, o autorización expresa para vaciar
QA. Lo segundo borraría los datos de ensayo de los que dependen otras filas de
la matriz, así que no lo haré por mi cuenta.

### 1.6 · La migración de MFA opcional no está aplicada en QA

**Qué pasa.** `supabase/migrations/20261115120000_mfa_politica_opcional.sql`
está en el repositorio pero no en el servidor de QA. Preguntado:

```
mfa_politica_leer → "Could not find the function public.mfa_politica_leer in the schema cache"
```

que es lo que contesta cuando esa función no está. Mientras no se aplique, el
segundo factor sigue siendo obligatorio en QA — que es, de hecho, lo que me pasa
cada vez que entro.

Las dos migraciones del rediseño (`20261113090000_rediseno_apariencia_empresa`
y `20261113140000_rediseno_apariencia_delegaciones`) **sí están**: sus tablas
responden «permission denied», no «no existe», y eso sólo lo contesta una tabla
que existe.

### 1.7 · Cuatro notas de la matriz decían algo falso, y ya no

La misma explicación equivocada se había copiado por varias filas: «esa función
está codificada a producción y la CSP de QA no la permite». Suena razonable, y
es mentira: `reset-pruebas-preview.js` lleva esas funciones en su lista
`RUTAS_QA` y las **redirige** al proyecto de QA. Lo comprobé leyendo la consola,
dos veces, con `prefiltro-candidato` y con `entrevista-personal`.

Retiradas de `com-14`, `com-22`, `per-17` y `per-23`. En su lugar queda lo que
sí se sabe, y dicho en cada caso si se midió o no. El peor de los cuatro era
`per-23`, que estaba mal dos veces: crear un prefiltro **no llama** a esa
función —va contra la tabla con el cliente de la sesión—, y lo que de verdad lo
impide es el permiso que falta (1.3).

Lo menciono porque es el tipo de error que se propaga solo: una explicación
plausible escrita una vez, copiada a las filas vecinas, y nadie vuelve a
comprobarla. Si al revisar esta lista encuentras una nota que explica demasiado
bien por qué algo no se puede hacer, desconfía.

---

## 2 · Lo que no está construido (23 pantallas)

No es un problema de QA ni de permisos: estas pantallas no existen todavía en el
programa. Agrupadas por dónde irían.

**Servicio · TPV (8)**
`tpv-09` recuperar cuenta y tickets aparcados · `tpv-24` funciones rápidas ·
`tpv-26` unir mesas · `tpv-28` Bizum y estado de pago · `tpv-29` propina y vale
regalo · `tpv-31` solicitar factura a empresa · `tpv-32` enviar justificante por
correo · `tpv-33` pantalla para cliente

**Organización (6)**
`org-23` prueba de impresora y cajón · `org-25` vincular terminal, caja y
equipo · `org-33` zonas, mesas y tarifas horarias · `org-34` plantilla por tipo
de negocio · `org-35` teclas del TPV por cargo · `org-36` integraciones y puente
de impresión

**Inventario (3)**
`inv-32` detalle e impresión de receta · `inv-35` biblioteca de opciones ·
`inv-36` editor de opciones reutilizables

**Sistema (3)**
`sis-14` índice de revisión · `sis-15` comparar y reiniciar demostración ·
`sis-16` pantalla restringida por cargo

**Caja y fiscalidad (2)**
`caj-16` rectificación fiscal · `caj-20` factura electrónica entre empresas

**Encargos (1)**
`enc-05` revertir anticipo

Construirlas sí entra dentro de lo que puedo hacer, una a una. Lo que hace falta
antes es que digas cuáles quieres y en qué orden: ocho de las veintitrés son del
TPV, y ese bloque se sostiene entre sí.

---

## 3 · Lo que está esperando una decisión tuya

### `cal-03` · Editar o desactivar punto de control

La mitad existe: cada punto de control tiene su «Desactivar». La otra mitad no:
la palabra «Editar» aparece **cero veces** en todo el componente de APPCC, y en
pantalla no hay ningún control para modificar un punto ya creado.

Puede ser deliberado y con buen criterio — los registros pasados se tomaron
contra los umbrales de ese punto, así que reescribirlos después falsearía el
historial. Si es así, lo que sobra es el nombre de la fila en la matriz, no el
programa. **Decide una de las dos** y lo dejo coherente:

- editar un punto debe existir → lo construyo;
- no debe existir → separo «desactivar» de «editar» en la matriz y lo explico
  ahí, para que nadie lo vuelva a dar por defecto.

### `sis-13` · Restablecer entorno de pruebas

No se ha pulsado ni buscado, a propósito: restablecer el entorno borraría la
base sobre la que se está midiendo todo lo demás, incluidos los datos de ensayo
de las sesiones anteriores. Se mide cuando el entorno ya no haga falta, y no
antes.

---

## 4 · Datos de ensayo que se quedan en QA

Puestos a propósito y documentados, porque son la evidencia de varias filas:

- `QA-ENSAYO-SENAL-20261115`, `QA-DEVOL-20261116`, `QA-ENSAYO-BORRADO-20261116`
- empleado «QA Encargado ensayo 20261115» y su cuenta de acceso
- producto `QA-ENSAYO-ENVASE-20261116` (500 ml por botella) y ficha
  `QA ENSAYO FICHA ENVASE 20261116`
- producto `QA ENSAYO CADUCIDAD 20261116` y los dos albaranes
  `QA-ENSAYO-CADUC-20261116` y `-B`, los dos con el lote `QA-LOTE-CAD-01` y
  caducidad `2026-11-19` — son la prueba de 1.1
- dos entrevistas «QA Candidato Ensayo 20261116» y «… B», que se quedan «En
  curso» porque no pueden avanzar — son la prueba de 1.2
- terminal «QA terminal A2 (ensayo punto 2)», precondición de los casos de
  concurrencia

---

## Resumen en una línea por asunto

| # | Asunto | Quién | Qué hace falta |
|---|---|---|---|
| 1.1 | La merma no llega al servidor | propietario | una RPC de salida de stock en QA |
| 1.2 | `entrevista-personal` no responde | propietario | desplegarla en QA (su fuente no está en el repo) |
| 1.3 | Prefiltros sin permisos | propietario | un `GRANT` en QA |
| 1.4 | Panel de Plataforma | propietario | una fila en `private.plataforma_admins` |
| 1.5 | Primer acceso del propietario | propietario | una instalación vacía |
| 1.6 | MFA opcional | propietario | aplicar la migración en QA |
| 2 | 23 pantallas sin construir | tú decides el orden | yo las construyo |
| 3 | `cal-03`, `sis-13` | tú decides | una decisión, no trabajo |
