# Etapa 7 — cierre formal posterior al rollback del PR #175

Fecha: 26/10/2026  
Entorno evaluado: producción L&A Suite  
Proyecto Supabase de producción: `flqercbgpgmmfaakrwkc`  
Sitio Netlify: `chic-entremet-9107cf`  

## Estado ejecutivo

**Etapa 7: cierre técnico de la incidencia de promoción terminado; cierre funcional global todavía pendiente.**

El PR #175 no se considera una promoción válida de producción. Su contenido QA, demasiado amplio para el alcance productivo, fue retirado de la rama `release` mediante el PR de rollback #178. La aplicación de producción quedó publicada de nuevo sobre la rama `release`, con el rollback verificado.

Este documento no declara terminada toda la Etapa 7. Deja separado lo que está cerrado, lo que está operativo y lo que necesita una validación posterior con hardware, fiscalidad o una decisión de negocio.

## 1. Cierre realizado

### 1.1 Retirada del PR #175

- PR revisado: [#175](https://github.com/Plopezm1990/Almacen/pull/175).
- Acción correctora: [PR #178 — revert: retirar PR 175 de release](https://github.com/Plopezm1990/Almacen/pull/178).
- Commit de merge del rollback:

  `80f9a814a26a750f978e83e9cc9a9297ae604c8c`

- El rollback retiró el paquete QA de etapas 5–7 y Documento 2 que había entrado en `release` con el PR #175.
- Los ajustes adicionales del rollback fueron únicamente de contratos de CI para que la validación de seguridad reconociera el perímetro de reversión. No reintroducen funcionalidades QA.
- El archivo local `ticket-preview-qa-2026-10-26.svg` quedó fuera de los commits y no se modificó.

### 1.2 Publicación posterior

- Deploy Netlify de producción: `6adf87fe87fdb708dc75d3b8`.
- Estado: `READY`.
- Rama: `release`.
- Commit servido: `80f9a814a26a750f978e83e9cc9a9297ae604c8c`.
- URL: https://chic-entremet-9107cf.netlify.app

La promoción anterior ya existente en `release` no se volvió a mezclar con el paquete retirado. El rollback se limitó a retirar los cambios del PR #175.

## 2. Evidencia técnica del estado actual

### 2.1 CI y código

- CI del rollback: **25/25 comprobaciones correctas**.
- Gate principal: `40364487185`, resultado `SUCCESS`.
- `node --check` ejecutado sobre las fuentes afectadas: correcto.
- `git diff --check`: correcto.
- Build reproducible de Netlify: correcto.

### 2.2 Netlify

Desde la publicación del rollback:

- respuestas HTTP `200` verificadas: 20;
- respuestas HTTP `5xx` en la rama `release`: 0;
- error de deploy: ninguno;
- funciones o Edge Functions de Netlify creadas por el rollback: ninguna.

### 2.3 Supabase Producción

- Estado del proyecto: `ACTIVE_HEALTHY`.
- No se aplicaron migraciones ni cambios de datos como parte del rollback.
- No aparecieron nuevos errores reales `ERROR`, `FATAL` o `PANIC` en la ventana comprobada después de la publicación.
- Comandas `BLOQUEADA` con `route_key = SIN_RUTA`: 0.
- Efectos pendientes en estado `ERROR`: 0.
- Las migraciones QA específicas de P3c y P18 no están aplicadas en producción.

## 3. Qué queda fuera de la Etapa 7 por ahora

### 3.1 Hardware físico

La validación con impresora, lector o periférico físico queda pendiente porque todavía no se dispone del hardware. No se debe declarar validado el circuito físico basándose solo en el preview o en una simulación.

Pendiente cuando llegue el equipo:

1. probar conexión y permisos del dispositivo;
2. comprobar impresión o visualización del ticket en el flujo real;
3. comprobar reintento, desconexión y recuperación sin duplicar la venta;
4. guardar evidencia de la prueba y de cualquier incidencia;
5. repetir el smoke de una venta controlada sin datos reales.

### 3.2 Ticket fiscal y QR fiscal

El ticket actual no debe presentarse como factura simplificada ni como documento fiscal válido. El QR mostrado en pruebas no constituye por sí mismo un QR fiscal.

La emisión fiscal real continúa bloqueada hasta definir y validar, como mínimo:

- identidad fiscal y datos del emisor;
- numeración y series correlativas;
- régimen e IVA aplicables;
- proveedor o sistema fiscal autorizado;
- formato exacto del QR y contenido exigido;
- persistencia inmutable del documento;
- correcciones mediante reverso o documento rectificativo;
- outbox, reintentos e idempotencia;
- pruebas y revisión fiscal específica.

Mientras eso no exista, el producto debe seguir etiquetando el ticket como `TICKET / RECIBO INTERNO`.

### 3.3 Cierre funcional de la Etapa 7

No se puede marcar la Etapa 7 como cerrada al 100 % porque siguen abiertos los puntos que dependen de hardware, fiscalidad real y aceptación operativa. El estado correcto es:

| Bloque | Estado | Observación |
|---|---|---|
| Retirar PR #175 de producción | TERMINADO | Rollback #178 fusionado y verificado |
| Salud del deploy actual | TERMINADO | Netlify `READY`, sin 5xx detectados |
| Salud de Supabase producción | TERMINADO | `ACTIVE_HEALTHY`, sin errores reales nuevos |
| Comandas sin ruta y efectos en error | TERMINADO | Ambos contadores en 0 |
| Funcionalidades QA de PR #175 | FUERA DE PRODUCCIÓN | No deben promocionarse como paquete global |
| Notas y recuperación de rutas ya existentes | MANTENIDO | No forma parte del rollback de PR #175 |
| Validación con hardware real | PENDIENTE | No hay hardware disponible |
| Emisión fiscal y QR fiscal | PENDIENTE/BLOQUEADA | Requiere diseño, proveedor y revisión fiscal |
| Cierre global de Etapa 7 | NO CERRADO | Se retomará tras los puntos anteriores |

## 4. Regla de promoción a partir de ahora

No se debe volver a fusionar un paquete transversal como el PR #175. Cada promoción futura debe cumplir estas condiciones:

1. un único objetivo funcional;
2. alcance explícito de producción y de QA;
3. migraciones separadas de la interfaz cuando corresponda;
4. preflight de Supabase en solo lectura;
5. CI y preview verificables;
6. PR pequeño y revisable;
7. autorización específica para migraciones, merge y deploy;
8. postflight de Netlify, Supabase y contadores operativos.

La existencia de este documento no autoriza por sí sola una nueva promoción ni una escritura en Supabase Producción.

## 5. Siguiente paso recomendado

El siguiente paso operativo es preparar una única ficha de promoción para una funcionalidad concreta ya validada en QA, sin hardware ni fiscalidad. Antes de fusionarla se debe repetir el preflight y comprobar que el diff no contiene cambios de QA ajenos al objetivo.

La validación física y el QR fiscal se mantienen deliberadamente para el momento en que estén disponibles el hardware, los datos fiscales y la definición del proveedor.

**Resultado de este documento: cierre de la incidencia PR #175 TERMINADO; cierre global de la Etapa 7 PENDIENTE.**
