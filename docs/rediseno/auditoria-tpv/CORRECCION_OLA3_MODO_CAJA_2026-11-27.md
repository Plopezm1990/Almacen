# Corrección de la Ola 3 · modo caja · 27/11/2026

Estado: **H-01, H-02, H-03, H-08, H-09, H-10, H-11, H-12 y H-13 corregidas en código, con contrato propio y comprobadas en el navegador en lo que el modo local permite** (ver «Qué NO está verificado»).
Rama `correccion/ola0-tpv-2026-11-26`. Solo presentación: no cambia ningún flujo de venta ni de servidor. Producción no se ha tocado.
Contrato nuevo: `tests/rediseno/ola3-modo-caja-contract.mjs` (con el código anterior falla 28 comprobaciones).

| Hallazgo | Cambio | Comprobado |
|---|---|---|
| **H-01 / H-12 (E4)** | «Guardar pedido» (con líneas) y «Cobrar» (solo con una cuenta enviada, abierta y con saldo) son la única acción naranja; con el ticket vacío y nada que cobrar, «Cobrar» queda neutro. La regla se sube de especificidad (Órbita + caja + `#root` + `main` del TPV), que es lo que la anulaba. El texto usa el color del tema (`--c-on-accent`, oscuro) y la altura es de 64 px (56 en móvil). La decisión sale de `cuentaConSaldoParaCobrarTpv` (mismo saldo que la capa de cobro). | Contrato (ejecuta la función). Navegador: «Cobrar» neutro con el ticket vacío a 1440 (fondo `rgb(32,35,40)`, 64 px); con la clase principal puesta a mano queda `rgb(255,75,50)` con texto `rgb(23,25,28)`. |
| **H-02** | El aviso de sincronización pasa abajo a la derecha en modo caja y la pantalla reserva 40 px (las capas abiertas, 48) mientras está visible. | Navegador, 1440 / 1024 / 390 / 320: el aviso queda por debajo de la banda de cuenta, sin solape. |
| **H-03** | La capa abierta es un diálogo (`role`, `aria-modal`, nombre = su título); el foco entra en «Volver al pedido», Tab no sale de la capa, Escape cierra y el foco vuelve al botón de origen (o al buscador). Con una capa abierta, F2, F9 y el Intro del escáner se ignoran. | Navegador: «Ventas del día» abre con `role=dialog`, 12 Tab seguidos no salen de la capa, Escape devuelve el foco al botón «Ventas del día». |
| **H-08** | El texto de la categoría activa se elige entre blanco y oscuro por contraste (`textoLegibleSobreFondoTpv`); «Todos» usa el color de texto del tema. | Contrato: los 9 colores de categoría ≥ 4,5:1; sobre `#FF4B32` 5,3:1 (antes 3,33:1). Navegador: «Todos» con texto `rgb(23,25,28)`. |
| **H-09 (E5)** | En el modo caja de Órbita las categorías se reparten en páginas según el ancho real de cada una (`paginasCategoriasTpv`) y se avanza con flechas de 44 × 44 px; sin barra de desplazamiento; las de otra página quedan ocultas (no enfocables); la página sigue a la categoría activa. | Contrato (función pura). Navegador: 1440 caben todas (sin flechas); 1024 dos páginas (5 + 4), flechas 44 × 44, anterior deshabilitada en la primera; 390 flechas visibles. |
| **H-10** | En móvil «Salir del modo caja» va el primero de la barra; la barra se desliza (no la página) y avisa con sombras de borde. | Navegador 320 y 390: «Salir» a la vista en x = 12; el resto se corta en el borde. |
| **H-11** | Por debajo de 360 px: banda de cuenta de 168 px (antes 192) y tarjetas compactas (fila mínima de 68 px en vez de 96). | Navegador 320 × 640 sin el aviso de modo local: **4 productos por página** (antes 2), sin recortes ni desplazamiento de la página. |
| **H-13** | El botón de tema no se muestra en el modo caja de Órbita. | Navegador: la barra solo trae Salir, Venta rápida, Sala, Ventas del día y Terminal. |

Otros cambios necesarios: `Btn` admite una clase extra (`claseExtra`), la marca de caché de `la-apariencia.css` sube a `qa-orbita-shell-v92-20261127` (con su huella), y se actualizaron las aserciones de `a02-1`, `tpv-caja-orbita`, `componentes-orbita`, `marco-orbita` y `p01-capas-y-migraciones`, que fijaban el código anterior.

## Qué NO está verificado

- **«Guardar pedido» naranja y «Cobrar» naranja con una cuenta con saldo, en vivo:** en modo local no se pueden añadir productos al ticket ni abrir cuentas, así que solo se comprobó (a) el estilo de la clase principal puesta a mano, (b) la función de decisión con casos, (c) el texto del código. Falta verlo con una sesión de QA.
- **Escaneo con una capa abierta:** el código lo ignora (`manejarEnterEscaneo`), pero la prueba en vivo no fue concluyente (no hay producto con código de barras en la siembra local).
- **Sin sesión de QA:** las pruebas del navegador se hicieron en `localhost` con productos sembrados solo en el almacenamiento local del navegador (no en el servidor); en ese modo aparecen avisos del TPV («necesita conexión…») que ocupan sitio; las medidas de 320 × 640 se tomaron ocultándolos.
- La sombra de continuación de la barra móvil es discreta; lo que más avisa es que el siguiente botón queda cortado.
- H-14 en adelante no se tocan aquí (Ola 4 y 5).
