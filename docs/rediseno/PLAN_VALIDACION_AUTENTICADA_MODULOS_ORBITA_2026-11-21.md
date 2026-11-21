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

## Bloqueo actual

En la última comprobación no había sesión QA autenticada abierta en Codex,
Chrome ni Firefox. Por eso este documento queda preparado para la siguiente
tanda, pero no inventa resultados de negocio ni cierra las doce filas.
