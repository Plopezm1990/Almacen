# Intento de inscribir MFA y entrar con un cargo restringido

14 de noviembre de 2026. Preview de QA del PR #225. Lo intenté sin ayuda, y el
resultado conviene leerlo entero: **el segundo factor no era el problema**.

## Sí se puede inscribir un segundo factor sin autenticador humano

La aplicación, cuando el cargo exige `aal2` y la cuenta no tiene factor, muestra
la pantalla **«Activa el segundo factor»** con el QR **y la clave en base32 en
texto**, para quien no pueda escanear.

Con esa clave se puede calcular el código sin aplicación autenticadora: TOTP de
RFC 6238 —HMAC-SHA1, ventana de 30 s, seis cifras— se implementa en unas veinte
líneas con `crypto.subtle` del propio navegador. Lo hice así, pulsé «Activar y
continuar» y **el servidor aceptó el código y abrió la sesión**.

Así que la respuesta a «¿puedes inscribirlo tú?» es **sí**.

### Y eso es también una observación de seguridad

Nada impide que un cliente automatizado inscriba su propio segundo factor en una
cuenta cuya contraseña conoce. El factor no prueba que haya una persona: prueba
que quien entra tiene el secreto. Si el modelo de amenaza de `m03` daba por
hecho que `aal2` implica un humano con un teléfono, conviene revisarlo.

No es un defecto de implementación —TOTP funciona así en todas partes—, pero sí
un supuesto que merece quedar escrito.

## Lo que falló fue otra cosa: el local y el cargo de la cuenta nueva

Para tener una cuenta de Cajero/a creé un empleado de ensayo, **QA Cajero MFA
20261114**, con «Nivel de acceso en modo empleado» puesto en **Cajero/a**, y
después su cuenta de acceso. La cuenta se creó —«Cuenta creada para QA Cajero
MFA 20261114»— pero:

| | |
|---|---|
| La ficha del empleado dice | `cuenta: Camarero/a` |
| «Cargos y permisos» lo lista bajo | **Cajero/a**, en Local A1 |
| La sesión real resuelve | `rol: "Camarero/a"` |
| Y el local resuelto es | **«Local principal»**, no QA-A1 |

Dos cosas distintas con el mismo nombre: **«Nivel de acceso en modo empleado» es
el nivel del PIN local, no el cargo de la cuenta en la nube**. Elegir Cajero/a
ahí no crea una cuenta de Cajero/a.

Y el local es peor: el id cambia en cada carga —`mwg5z9u7qydtb7`,
`mwg644yxfos1m7`— porque no hay pertenencia a un local de verdad y la aplicación
cae en un «Local principal» generado en el equipo. Encima no puede guardarlo:
sale el aviso **«Un cambio no se ha podido guardar (localActivoId)»**, que es la
lista cerrada de claves de `almacen_kv` otra vez.

Con eso, las tres lecturas que expone el puente responden lo mismo:

> `{"ok":false,"error":"No hay ningún terminal TPV activo configurado para este local."}`

El servidor rechaza **por local**, no por cargo. Así que con esta cuenta no se
puede separar una cosa de la otra, y no sirve para certificar autorización.

## Lo que sí cerró esta sesión: F2 con cargo restringido

La apariencia es de **empresa**, no de local, así que el local fantasma no la
estorba. Y ahí la sesión restringida sirvió para cerrar la comprobación que
pedía el plan desde el principio. Todo contestado por el servidor, con `rol`
`Camarero/a`:

| Operación | Respuesta |
|---|---|
| `leerEmpresa()` | **funciona**: diseño `orbita`, revisión 8, con quién y cuándo, y la revisión 7 anterior |
| `estadoServidor()` | `{disponible: true, puedeAplicar: false}` |
| `listarDelegaciones()` | `{ok: false, motivo: "sin-permiso", servidor: true}` |
| `guardarEmpresa(...)` | `{ok: false, motivo: "sin-permiso", servidor: true}` |
| `restaurarAnterior()` | `{ok: false, motivo: "sin-permiso", servidor: true}` |

Y lo que importa: **tras los dos intentos de escritura la apariencia sigue en
`orbita`, revisión 8**. No cambió nada. El `servidor: true` es del propio
cliente diciendo que la negativa viene del servidor, no de la interfaz: el
botón gris no es la defensa, es el reflejo de una defensa que está detrás.

Puede leer, no puede aplicar, no puede restaurar y no puede ni ver las
delegaciones. Es exactamente lo que el plan quería demostrar.

## Lo único aprovechable de la sesión restringida

La guarda de navegación sí se midió, y es consistente: de once pestañas
probadas, un Camarero/a alcanza **tres** —inicio, TPV y cocina— y se le deniegan
**ocho**: caja, devoluciones, configuración, productos, personal, informes,
proveedores y pedidos.

## Segunda vuelta, con la sesión de propietario: ya hay Cajero/a

**Un error mío, primero.** El formulario de crear cuenta *sí* tiene un
selector **«Rol»** con Encargado, Camarero/a, Cajero/a y Churrero/a. No lo vi
porque mi filtro de campos buscaba por nombre y ese es un `select` que se
llama «Rol». La cuenta salió Camarero/a porque dejé el valor por omisión, que
está puesto a `"Camarero/a"` en el código. No era un defecto del producto: era
que no lo rellené.

Con el propietario dentro creé **QA Cajero MFA2 20261114** eligiendo Rol
**Cajero/a**, inscribí el segundo factor calculando el TOTP igual que antes, y
el servidor abrió la sesión: **`rol: "Cajero/a"`**. Es la primera sesión de un
cargo restringido de verdad en todo este trabajo.

### La guarda de navegación, comparada

| Cargo | Alcanza | Se le deniega |
|---|---|---|
| Camarero/a | 3: inicio, TPV, cocina | 8 |
| Cajero/a | 5: inicio, TPV, cocina, **caja, devoluciones** | 6 |

La diferencia es exactamente caja y devoluciones, que es lo que dice su
descripción: «cobros y operaciones de caja».

### F2 con Cajero/a, contestado por el servidor

| Operación | Respuesta |
|---|---|
| `leerEmpresa()` | funciona: `orbita`, revisión 8 |
| `estadoServidor()` | `puedeAplicar: false` |
| `listarDelegaciones()` | `sin-permiso`, `servidor: true` |
| `guardarEmpresa(...)` | `sin-permiso`, `servidor: true` |
| `restaurarAnterior()` | `sin-permiso`, `servidor: true` |

Y tras los intentos, `orbita` revisión 8: **sin cambios**. Mismo resultado que
con Camarero/a, lo cual es la respuesta correcta: ninguno de los dos cargos
puede tocar la apariencia, y la negativa la da el servidor.

## El hueco que queda, y ya está confirmado dos veces

**Crear una cuenta desde Personal no le da pertenencia a ningún local.** Las
dos cuentas que creé, con dos cargos distintos, caen en un «Local principal»
generado en el equipo, cuyo id cambia en cada carga, y su selector de local
ofrece solo «Todos los locales» y «Local principal»: **QA-A1 no aparece**.
Encima la aplicación no puede ni guardar cuál es, porque `almacen_kv` niega
`localActivoId`.

Consecuencia práctica: todo lo que es **de empresa** se puede certificar con
estos cargos —y queda certificado—, pero todo lo que es **de local** no, porque
el servidor contesta antes «No hay ningún terminal TPV activo configurado para
este local» y no llega a mirar el cargo. Las pruebas de caja, cobros y
reembolsos por cargo siguen fuera de alcance hasta que una cuenta tenga
membresía real en QA-A1, y eso no se puede dar desde la interfaz.

## Lo que queda, y de quién depende

Para las comprobaciones de Encargado y Cajero/a hace falta que **el propietario**
asigne una cuenta al cargo y al local correctos, en «Configuración → Cargos y
permisos → Asignar», con el local QA-A1. Eso exige su sesión, y por tanto su
código.

El segundo factor ya no es el obstáculo: una vez la cuenta esté en su cargo y su
local, inscribirlo es cosa de un minuto y lo puedo hacer yo.

## Lo que queda suelto en QA, para que nadie lo herede sin saberlo

- Empleado **QA Cajero MFA 20261114** y su cuenta
  `qa.cajero.mfa.20261114@qa.invalid`, con un segundo factor **activo**.
- La contraseña inicial la generé en el navegador y **la he borrado**; el secreto
  del factor vivía en la pestaña y se fue con ella. **La cuenta está ahora mismo
  inservible**: nadie tiene ni la contraseña ni el factor.
- Lo razonable es una de dos: o el propietario le asigna cargo y local y le pone
  una contraseña nueva desde la ficha del empleado, o se le da de baja y se
  queda como lo que es, un intento documentado.

No la dejo a medias por descuido: la dejo así porque completarla exige
decisiones que no son mías —qué cargo, qué local, quién custodia el factor— y
porque una cuenta sin contraseña ni factor no puede usarla nadie.
