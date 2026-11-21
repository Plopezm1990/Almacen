# Punto 3 · validación de permisos con cuenta restringida · 21/11/2026

## Estado

**CERRADO en QA.**

Cuenta utilizada: `qa.permisos.20261116@qa.invalid`, rol **Camarero/a**,
empresa `QA-EMP-A`, local `QA-A1`, terminal A1, Deploy Preview #225.

## Comprobaciones

| Requisito | Resultado |
| --- | --- |
| No puede cobrar sin permiso | Confirmado server-side con `abc_efectivo_no_autorizado`; la interfaz muestra `C07D_CONFIG_NO_AUTORIZADO` y «No tienes permiso para operar este TPV en el local seleccionado». No se creó ningún pago nuevo. |
| No puede reembolsar | Confirmado server-side con `abc_reembolso_no_autorizado`; Devoluciones no aparece como acceso operativo para el cargo. No se creó ningún reembolso nuevo. |
| No puede modificar configuración | Configuración y sus acciones administrativas no están disponibles para el cargo restringido; no se ejecutó ninguna escritura. |
| No puede ejecutar acciones de Plataforma | La superficie de Plataforma y sus acciones administrativas no están disponibles para el cargo; no se ejecutó ninguna acción. |
| Solo usa sus pantallas | La sesión queda limitada a Inicio, TPV y Cocina/turno operativo. Caja, arqueo, cierre, fichajes y Recepciones aparecen deshabilitados; el selector mantiene Local A1. |

## Evidencia complementaria

La prueba server-side previa conserva las tres denegaciones exactas:
`abc_caja_no_autorizado`, `abc_efectivo_no_autorizado` y
`abc_reembolso_no_autorizado`. La pasada live del 21/11 confirmó el local y el
rol, la navegación restringida y el mensaje de bloqueo del TPV. No se hicieron
operaciones financieras nuevas.

El navegador conservaba un borrador local de una línea de TPV y un aviso de
sincronización de `productos`; no se reintentó ni se modificó. La cuenta
sintética abierta `d802aad8-0099-4092-945b-01adfbb9a569` permanece documentada
para una limpieza separada y no forma parte de este cierre.

## Condición de cierre

El punto queda cerrado por evidencia server-side y confirmación live de la
interfaz. No se cambia ningún permiso ni se toca producción.
