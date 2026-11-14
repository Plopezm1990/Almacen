# Punto 2 · Cerrar las salvedades de lo ya abierto

14 de noviembre de 2026. Preview de QA del PR #225, sesión real de Propietario
en QA-EMP-A / QA-A1.

El punto 1 dejó 51 vistas abiertas, pero varias con una salvedad al margen:
«falta el cargo restringido», «falta un segundo terminal», «falta medir este
modal». Esto es el repaso de esas salvedades.

## Cerradas

### Un segundo terminal, y con él `caj-22`

QA tenía un solo terminal, así que «Terminales vinculados» decía *«No hay otros
terminales activos disponibles en este local»* y el control no existía.

Creado **QA terminal A2 (ensayo punto 2)** en Configuración → Terminales y
cajas, con su motivo obligatorio para la auditoría. El propio panel reacciona:
pasa de *«Con un único terminal activo, el TPV lo selecciona automáticamente»* a
*«Hay varios terminales activos: el TPV deberá seleccionar cuál usa»*.

Con eso, `caj-22` queda abierta **y operada**: «Añadir terminal a esta sesión» →
«Vincular terminal» → el A2 aparece como **auxiliar**, con «Desvincular» y su
campo «Motivo para desvincular un terminal auxiliar». Tres campos, todos con
nombre; ningún control corto; sin desbordamiento.

El terminal nuevo se queda: es la precondición de los casos de concurrencia y
desactivarlo volvería a dejar QA sin ellos.

### El aviso del contenido del envase

Era el segundo de los dos pendientes de la pasada de accesibilidad. No salía, y
buscarlo a ciegas no servía. Leyendo la fuente aparece la condición exacta —son
**tres** a la vez:

```js
const cambioContenido = contenidoAntes > 0 && contenidoAhora > 0 && contenidoAntes !== contenidoAhora;
const afectadas = cambioContenido ? fichasQueUsan(editFor) : [];
if (afectadas.length > 0) setAvisoContenido({ … });
```

Es decir: el contenido tenía que ser positivo antes **y** después **y**
distinto, **y** alguna ficha de costo tiene que usar ese producto. Mi primer
intento falló por el primer punto —el campo estaba vacío— y habría fallado
igual por el último, porque acababa de borrar la receta de ensayo del punto 1.

Reproducido con las tres condiciones: receta de ensayo usando *Agua 50 cl (QA)*,
y el contenido del envase de 2 a 3. El aviso dice:

> Agua 50 cl (QA) pasó de 2,00 a 3,00 por envase. Hay 1 ficha(s) de costo que
> usan este producto. Sus cantidades están guardadas por envase, así que ahora
> significan una cantidad real distinta — y el coste no cambia, así que no se
> notaría en ningún informe.

Y ofrece «Convertir las fichas» o «Dejarlas como están». Medido: tres controles,
ninguno sin nombre, ninguno por debajo de 24 × 24, sin desbordamiento. Cerrado
sin convertir nada.

Merece decirse que **el aviso es bueno**: avisa de una trampa que no deja rastro
en ningún informe. Es exactamente lo que un programa de gestión debe hacer.

Después se deshizo todo: receta eliminada y el contenido del envase devuelto a
vacío. Fichas de costo vuelve a cero.

## Bloqueadas, y por qué

### Los casos de concurrencia Q07 y Q08

Ya hay dos terminales, pero no bastan. La identidad de terminal **se ancla al
navegador**: el A1 aparece como «Identidad de dispositivo vinculada» y el A2
como «Sin identidad de dispositivo; se puede vincular más adelante». Un solo
panel de navegador es un solo dispositivo, así que no puedo *ser* los dos
terminales a la vez por muchas pestañas que abra: comparten sesión y
almacenamiento.

Para Q07 y Q08 hace falta **un segundo navegador o perfil operando al mismo
tiempo**. No es una vista que falte ni un permiso: es un segundo dispositivo.

### El cargo restringido

Sigue bloqueado donde estaba: `m03_server_aal2_gate` exige `aal2` a Propietario,
Encargado y Cajero/a, y las cuentas de prueba de esos dos cargos no tienen MFA
inscrito. Sin inscribirlo, el servidor no las deja entrar, y las comprobaciones
de autorización por cargo no se pueden hacer con sesión real.

Es trabajo de una persona con acceso a esas cuentas, no de interfaz.

## Lo que queda del punto 2

| | |
|---|---|
| Segundo terminal y `caj-22` | **cerrado** |
| Aviso del contenido del envase | **cerrado** |
| Modal «Eliminar producto» | cerrado en el punto 1 |
| Concurrencia Q07 y Q08 | bloqueado: hace falta un segundo navegador o perfil |
| Cargo restringido | bloqueado: hace falta inscribir MFA en Encargado y Cajero/a |
