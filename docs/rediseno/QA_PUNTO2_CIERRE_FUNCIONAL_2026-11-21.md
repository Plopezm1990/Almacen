# Cierre funcional del punto 2 · 21/11/2026

## Estado vigente

**CERRADO por aceptación del propietario de QA.**

El propietario confirma que los recorridos funcionales de los módulos de la
suite fueron comprobados en QA y funcionan correctamente. Esta confirmación
completa la evidencia técnica y de lectura ya registrada en la matriz, el plan
de validación y las actas anteriores.

## Alcance aceptado

La aceptación cubre:

- TPV: venta rápida, sala, mesas, cuentas y tickets.
- Pase: enlaces hacia TPV y cola de cocina.
- Cocina: cambios de estado de comanda.
- Caja: apertura, arqueo, cobro, cierre y reembolso.
- Clientes: ficha, actividad, vistas guardadas y NIF.
- Compras: proveedores, pedidos, recepción, albaranes y facturas.
- Inventario: movimientos, mermas, caducidades y ajustes.
- Personal: fichajes, cargos y permisos.
- Configuración: empresa, locales, terminales, fiscalidad y apariencia.
- Plataforma: paneles administrativos.
- Acceso: login, recuperación, MFA, expiración y selección de local.

## Naturaleza de la evidencia

Este documento registra el **sign-off funcional del propietario** recibido el
21/11/2026. No inventa identificadores de operaciones ni sustituye los
registros ya existentes de cada ensayo. La matriz conserva las notas históricas
`PARCIAL` para mantener trazabilidad; este cierre es el estado vigente de
aceptación del punto 2.

La aceptación no autoriza nuevas operaciones financieras, cambios de permisos,
restauración de QA ni acciones sobre producción. El PR #225 permanece en
borrador y la rama de trabajo es `rediseno/f0-base-qa`.

## Excepciones que no bloquean este punto

Se mantienen fuera del alcance de este cierre las tareas independientes ya
identificadas: limpieza de fixtures sintéticos sin borrar evidencia, mejoras
de paginación/búsqueda de la cola Pase y bookkeeping de migraciones de
Apariencia. Deben tratarse en sus propios objetivos.
