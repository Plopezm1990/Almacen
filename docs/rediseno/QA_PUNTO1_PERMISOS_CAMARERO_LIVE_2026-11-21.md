# Evidencia live · permisos de Camarero/a · 21/11/2026

## Alcance

Ensayo realizado únicamente en el Deploy Preview #225, contra QA. No se tocó
producción, no se ejecutó `sis-13` y no se inició ningún cobro, reembolso,
factura o cierre nuevo en esta sesión.

## Sesión y contexto

| Campo | Valor |
| --- | --- |
| Cuenta | `qa.permisos.20261116@qa.invalid` |
| Rol | Camarero/a |
| Empresa | QA Empresa A, S.L. (`QA-EMP-A`) |
| Local | Local A1 (`QA-A1`) |
| Terminal | QA terminal A1 (siembra etapa 1) |
| URL | `https://deploy-preview-225--chic-entremet-9107cf.netlify.app/` |
| Fecha | 21/11/2026 |

La sesión entra con el local operativo correcto. No cae en «Todos los
locales» ni en un local principal generado en el cliente.

## Resultado de permisos

- **Caja, arqueo y cierre:** aparecen deshabilitados con el mensaje de que el
  cargo no tiene acceso a la pantalla.
- **Fichar y Recepciones:** aparecen deshabilitados por la misma guarda de
  permisos.
- **TPV:** la superficie es visible para consultar, pero el servidor muestra
  `C07D_CONFIG_NO_AUTORIZADO` y el texto «No tienes permiso para operar este
  TPV en el local seleccionado».
- **Cobro, tarjeta simulada, factura y reembolso:** no se pulsaron. No hay
  movimiento económico ni documento nuevo generado por esta sesión.
- **Devoluciones:** no aparece como acceso operativo para el cargo restringido.

Esto confirma en vivo la denegación de Camarero/a en la interfaz y conserva la
evidencia server-side previa de `abc_caja_no_autorizado`,
`abc_efectivo_no_autorizado` y `abc_reembolso_no_autorizado`.

## Estado local observado

El navegador compartía un borrador local de TPV con una línea de
`QA Aceite ensayo 20261115` por 1,00 €. El aviso superior decía que un cambio
de `productos` no se había podido sincronizar y ofrecía «Reintentar». No se
reintentó ni se modificó el borrador: queda documentado como estado local del
dispositivo, no como venta o movimiento de servidor.

La cuenta sintética histórica
`d802aad8-0099-4092-945b-01adfbb9a569` / pedido
`87cf1dad-ea65-4970-a2b8-0e96899441f8` permanece abierta en QA conforme al
acta; no se borra para conservar la evidencia y requiere limpieza separada.

## Cierre

La prueba live de permisos queda cerrada. No quedan acciones financieras
pendientes para este ensayo. El positivo de Cajero/a con MFA y cualquier
reintento de sincronización siguen fuera del alcance y requieren autorización
separada.

## Verificación del cierre documental

La batería `tests/rediseno/*.mjs` se ejecutó completa: todos los contratos
pasaron, incluidos marco Órbita, rutas, módulos, Apariencia, MFA, fiscalidad,
propina y arranque resiliente. `git diff --check` también pasó sin hallazgos.
