# Plan de validación autenticada de los módulos Órbita

Fecha: 21/11/2026  
Rama: `rediseno/f0-base-qa` · PR #225 en borrador  
Preview: `https://deploy-preview-225--chic-entremet-9107cf.netlify.app`

Este documento es la lista de cierre del objetivo 4. La inspección estática y
el modo local demuestran que el shell, la escala y la clasificación semántica
están integrados; no sustituyen una sesión QA autenticada. Una fila solo puede
pasar de `PARCIAL` a `CERRADO` cuando se rellenan todos los campos de su ficha.

## Evidencia mínima por módulo

Para cada recorrido se registra: cuenta y rol (sin contraseña), empresa y
local, ruta visible, viewport de escritorio y móvil, resultado de
`data-la-orbita-module`/`data-la-orbita-surface`, `overflow`, control visible
mínimo, estados de carga/vacío/error, operación real ejecutada (si aplica),
persistencia tras recargar y captura o log verificable. No se usan producción,
`sis-13`, restauraciones de QA ni cobros/reembolsos nuevos sin autorización.

## Orden de recorrido

| Orden | Módulo | Ruta(s) a recorrer | Datos/estados que deben quedar probados | Estado |
|---:|---|---|---|---|
| 1 | Inicio y panel general | Panel general | cuatro indicadores, acciones rápidas, detalle operativo separado, carga, vacío y error | PARCIAL |
| 2 | TPV y sala | TPV, Venta rápida, Sala/restaurante, cuentas, mesas, tickets | alta de cuenta, añadir producto, cocina, ticket, paginación, móvil | PARCIAL |
| 3 | Pase | Pase / turno en directo | libre, ocupada, reservada, bloqueada, fuera de servicio, cola de cocina y navegación al TPV | PARCIAL |
| 4 | Cocina | Cocina | nueva, pendiente, en preparación, lista, servida, filtro de estación, vacío y error de conexión | PARCIAL |
| 5 | Caja | Caja, arqueo, movimientos, cierres, reembolsos y documentos | permiso restringido, cobro simulado autorizado, apertura/cierre, recibo y persistencia | PARCIAL |
| 6 | Clientes | Clientes, vistas, ficha | búsqueda, filtros, vistas guardadas, actividad, NIF enmascarado y vacío | PARCIAL |
| 7 | Compras | Proveedores, pedidos, recepción, albaranes, facturas | formularios, recepción confirmada, albarán, pago/eliminación según alcance y errores | PARCIAL |
| 8 | Inventario | Productos, movimientos, mermas, caducidad, ajustes | salida persistente, lote/caducidad, ajuste, reversión, stock mínimo y tablas móviles | PARCIAL |
| 9 | Personal | Empleados, cargos, permisos, turnos, fichajes | alta/edición, permiso denegado, turno, fichaje, carga y vacío | PARCIAL |
| 10 | Configuración | Empresa, locales, terminales, equipos, fiscalidad, apariencia | selector empresa/local, persistencia, delegación, apariencia y permisos | PARCIAL |
| 11 | Plataforma | Paneles exclusivos de administración | acceso de administrador, las vistas administrativas, vacío/error y responsive | PARCIAL |
| 12 | Acceso | login, recuperación, MFA, expiración, selección | login, recuperación, MFA, sesión caducada, empresa/local y móvil | PARCIAL |

## Procedimiento seguro

1. Abrir únicamente el Deploy Preview 225 y confirmar que la URL contiene
   `deploy-preview-225` y que el navegador está en QA.
2. Iniciar sesión con una cuenta de prueba con el local necesario. Nunca
   escribir la contraseña en actas, comentarios o archivos del repositorio.
3. Capturar primero la ruta y el estado semántico de la pantalla; después
   ejecutar solo la operación de ensayo autorizada para esa fila.
4. Comprobar escritorio y `390×844` sin overflow y con controles de al menos
   `44×44 px`. Revisar también carga, vacío y error, no solo el estado lleno.
5. Recargar y, cuando corresponda, cambiar de local o abrir una segunda
   sesión para demostrar persistencia y aislamiento.
6. Añadir la evidencia a la matriz y al traspaso. Solo entonces se cambia la
   fila a `CERRADO`; si falta una condición, se conserva `PARCIAL` con el
   motivo concreto.

## Estado de la tanda actual · 21/11/2026

Ya existe una sesión autenticada real de propietario en el Deploy Preview #225,
empresa `QA-EMP-A`, local `QA-A1`, cuenta `pm07.smoke@qa.invalid`. Con ella se
han recorrido sin mutaciones económicas Inicio, TPV/sala, Cocina, Clientes,
Compras, Inventario, Personal, Configuración y Caja en viewport de escritorio
`1195×678`. Las rutas devuelven el shell Órbita, `overflow=false` y los estados
reales indicados en la matriz; no se cambia ninguna fila a `CERRADO` porque aún
faltan las condiciones móviles, carga/vacío/error y, cuando corresponde, la
operación autorizada.

Evidencias registradas en `MATRIZ-IMPLANTACION-QA.csv`:

- `qa-20261121-orbita-cocina`
- `qa-20261121-orbita-clientes`
- `qa-20261121-orbita-compras`
- `qa-20261121-orbita-inventario`
- `qa-20261121-orbita-personal`
- `qa-20261121-orbita-configuracion`
- `qa-20261121-orbita-caja`

Siguen pendientes la revisión móvil completa, la validación de estados de
carga/vacío/error, Plataforma con una cuenta administradora específica y el
recorrido de Acceso sin destruir la sesión de QA. No se usa `sis-13`, no se
restaura QA y no se ejecutan cobros ni reembolsos nuevos sin autorización.

## Evidencia móvil añadida · 21/11/2026

Con `pm07.smoke@qa.invalid` en `QA-EMP-A / QA-A1` se verificaron en el preview
225 los módulos Inicio, TPV y Configuración a `390×844`. En los tres casos el
DOM expuso el módulo y la superficie Órbita esperados, `scrollWidth` coincidió
con `innerWidth` (`overflow=false`) y el mínimo de los controles visibles fue
`44 px`. TPV mostró catálogo, paginación y Caja del TPV; Configuración mostró
las ocho pestañas operativas; Inicio mostró el panel y la navegación inferior.
Fue una revisión de lectura y no generó operaciones ni cambios de datos.

Esta tanda mejora la cobertura responsive, pero no permite cerrar por sí sola
las filas: faltan estados de negocio, Plataforma con administrador y Acceso/MFA.

La sesión continuó con `Más → Productos` y `Más → Proveedores` en el mismo
viewport. Inventario (`inventario/inventario`) y Compras
(`compras/compras`) conservaron `overflow=false`, `scrollWidth=390` y un
mínimo interactivo de `44 px`; se observaron «Productos» y «Proveedores» sin
escribir datos.

La pasada continuó con `Personal`, `Cocina`, `Caja` y `Clientes`. En
`390×844`, las cuatro superficies conservaron su par semántico, sin overflow y
con mínimo interactivo de `44 px`. La cobertura móvil autenticada acumulada es
de nueve módulos; Pase queda observado dentro de Inicio. Plataforma sigue
requiriendo privilegio administrador y Acceso/MFA una sesión separada.

## Estados comprobados sin mutación · 21/11/2026

La misma cobertura se amplió con estados seguros que no escriben datos:

- Inicio: carga transitoria «Cargando almacén…» y resolución posterior estable.
- Clientes: búsqueda sin resultados, con estado vacío semántico.
- Productos: búsqueda sin resultados, con estado vacío semántico.
- Cocina: comandas sin estación con estado `BLOQUEADA` y explicación de la
  ruta faltante.

No se provocaron errores de red deliberados. Hacerlo requeriría interrumpir el
transporte de QA y se reserva para una prueba controlada; los contratos de
estados y fail-closed ya pasan en local.

## Sesión restringida · permisos de Camarero/a · 21/11/2026

Se inició sesión en Deploy Preview #225 con
`qa.permisos.20261116@qa.invalid`, rol Camarero/a, `QA-EMP-A / QA-A1` y
terminal A1. La sesión confirma el local operativo correcto y los límites de
este cargo: Caja, arqueo, cierre, fichajes y recepciones aparecen
deshabilitados; el TPV muestra `C07D_CONFIG_NO_AUTORIZADO` y «No tienes permiso
para operar este TPV en el local seleccionado». No se ejecutó ninguna
operación financiera ni se creó un documento nuevo.

La evidencia detallada está en
`docs/rediseno/QA_PUNTO1_PERMISOS_CAMARERO_LIVE_2026-11-21.md`. Esta sesión no
puede cerrar la validación funcional de los módulos porque no tiene permisos
para las operaciones de negocio ni para Plataforma, MFA, recuperación y
configuración administrativa. Las filas que requieren propietario o
administrador permanecen `PARCIAL` hasta disponer de esas sesiones.

El navegador conservaba un borrador local del TPV y un aviso de sincronización
fallida de `productos`; no se reintentó ni se modificó. La cuenta sintética
abierta `d802aad8-0099-4092-945b-01adfbb9a569` sigue documentada y requiere
limpieza separada. No se usa `sis-13`, no se restaura QA y producción sigue
fuera de alcance.
