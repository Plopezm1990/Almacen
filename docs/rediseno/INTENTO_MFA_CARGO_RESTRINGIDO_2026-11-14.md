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
