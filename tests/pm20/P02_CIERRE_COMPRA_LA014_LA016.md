# PM20 P02 — Compra: LA-016 corregido, LA-014 revalidado

Segundo punto de PM20, alcance "Pedidos, albaranes y recepción: compra, documentos y
pendientes" de la matriz, cerrando los dos huecos identificados en P01.

## LA-016 — Proveedor: contacto/plazo (defecto real corregido)

Diagnóstico (P01): `crearLogicaProveedores` (`addProveedor`/`updateProveedor`) no
validaba nada más allá del nombre. El formulario usa `type="email"`/`type="number"` como
única pista visual, sin `required` ni `min`, y el JS de envío no comprobaba el resultado.
`updateProveedor` ni siquiera devolvía `{ok,error}` — la UI no podía detectar un rechazo
aunque existiera.

Corrección:

- `validarProveedorPM10(data)` (función pura, nueva): exige nombre; si `email` no está
  vacío, debe tener formato válido; si `leadTime`/`diasPago` no están vacíos, deben ser
  números ≥ 0 (usa `numeroPM10` con `opcional: true`, igual que el resto de validadores
  PM10 — un campo vacío sigue sin ser obligatorio).
- `addProveedor` ahora valida antes de crear; `updateProveedor` valida antes de mutar y
  **ahora devuelve `{ok:true}` / `{ok:false,error}`** en vez de no devolver nada.
- Componente `Proveedores`: `submit()`/`submitEdit()` leen el resultado real y muestran
  el error (usando el estado `error`/`editError` que ya existía en el componente pero
  nunca se alimentaba de una respuesta real del backend) en vez de cerrar el formulario
  como si hubiera funcionado.

Esto también cierra un segundo problema menor detectado durante la corrección: antes de
este punto, un rechazo de `addProveedor` (por ejemplo por falta de empresa activa) ya
existía como contrato `{ok,error}` pero la UI lo ignoraba — el formulario se cerraba y
limpiaba igualmente, un caso de confirmación silenciosa fantasma. Ahora ambos caminos
(alta y edición) respetan la regla de no confirmar en falso.

## LA-014 — Fecha esperada de pedido (revalidado, sin cambio de código)

P01 confirmó por inspección que el código ya era correcto: `fechaValidaPedidoPM10`
valida formato y fecha real (rechaza `2026-02-30`), `validarPedidoPM10` la aplica, y el
circuito de guardado (`crearPedido`/`actualizarPedido`) pasa la cadena `"YYYY-MM-DD"`
intacta sin construir nunca un objeto `Date` — el único uso de `new Date(fechaEsperada)`
está en los puntos de solo lectura/impresión (ticket, listado), que solo desplazan hacia
delante en huso horario positivo, nunca hacia atrás.

Este punto añade la prueba de comportamiento real exigida por G2 ("no reproducido una
vez" no basta): alta con fecha exacta, edición de cantidad que conserva la fecha exacta,
"recarga" (releer el dato persistido en un proceso nuevo) que conserva la fecha exacta, y
rechazo de fecha inválida/inexistente.

## Archivos

- `fuente.js`: `validarProveedorPM10` (nueva); `crearLogicaProveedores.addProveedor`/
  `updateProveedor` corregidas; componente `Proveedores.submit`/`submitEdit` conectados
  al resultado real.
- `tests/pm20/p02-comportamiento-proveedor-contract.mjs` (nuevo): comportamiento real
  positivo/negativo de LA-016 (alta y edición, email/leadTime/diasPago).
- `tests/pm20/p02-wiring-proveedores-contract.mjs` (nuevo): confirma por inspección
  estática que la UI lee `{ok,error}` en vez de ignorarlo.
- `tests/pm20/p02-la014-fecha-esperada-pedido-contract.mjs` (nuevo): revalidación de
  LA-014 de punta a punta (alta, edición, recarga, fecha inválida).

## Regresión

Suite completa del proyecto — 107/107 sin regresiones.

## Estado de main/producción

`main` = `bdf25591a1e986a04223b399d11d8fe81d41d82d`, sin tocar directamente. Frontend
puro, sin migraciones Supabase.

**PM20_P02_CIERRE_COMPRA_LA014_LA016=PASS**
