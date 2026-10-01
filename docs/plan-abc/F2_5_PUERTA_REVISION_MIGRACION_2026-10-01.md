# F2.5 — puerta de revisión del paquete de migración

Fecha: 2026-10-01  
Estado: `PENDIENTE_HERRAMIENTA_Y_REVISION`  
Base: F2.1–F2.4 y `origin/release` `7859508`

Esta puerta evita que una migración se considere lista solo por compilar. El
paquete debe tener SQL generado por la CLI, pruebas locales, revisión de
seguridad y recuperación antes de pedir autorización de entorno.

## Checklist del paquete

| Área | Evidencia requerida | Estado |
|---|---|---|
| Alcance | descripción de tablas/RPC/políticas afectadas | `PENDIENTE` |
| Fuente | migración generada por Supabase CLI | `BLOQUEADO_CLI` |
| Dependencias | orden, nombres, columnas, índices y firmas | `PENDIENTE` |
| Seguridad | RLS, ACL, `search_path`, vistas y funciones | `PENDIENTE` |
| Datos | no modifica hechos históricos sin operación compensatoria | `PENDIENTE` |
| Local | PG01–PG12 en base UTF-8 desechable | `BLOQUEADO_POSTGRES` |
| Advisors | resultado revisado y sin alertas no aceptadas | `PENDIENTE` |
| Reconstrucción | segunda ejecución desde base vacía | `PENDIENTE` |
| Compatibilidad | clientes y RPC existentes | `PENDIENTE` |
| Reversión | procedimiento probado y limitado | `PENDIENTE` |
| Hash | SHA del SQL, fuente y artefacto | `PENDIENTE` |
| Autorización | entorno destino y responsable | `PENDIENTE` |

## Criterios de rechazo

- SQL creado manualmente sin el flujo de la CLI.
- Falta de RLS/ACL o función privilegiada sin justificación.
- Cambio de esquema que rompe el cliente existente.
- Prueba solo en PGlite presentada como PostgreSQL real.
- Hash o manifest ausente.
- Rollback que borra pagos, documentos, caja o stock.
- Autorización genérica usada para escribir en QA/PROD.

## Secuencia de aprobación

1. Habilitar herramientas locales y generar el candidato con nombre descriptivo.
2. Revisar el diff y las dependencias contra `origin/release`.
3. Ejecutar PG01–PG12 y advisors; corregir antes de continuar.
4. Registrar SHA, logs sanitizados, impacto y reversión.
5. Solicitar autorización específica para QA; no se extiende automáticamente a
   PROD.

## Resultado de F2.5

La puerta queda definida pero no abierta. El paquete no puede pasar a aplicación
hasta resolver CLI/PostgreSQL y completar la evidencia. No se crea SQL, no se
aplica migración, no se toca QA/PROD y no se hace deploy de Netlify.
