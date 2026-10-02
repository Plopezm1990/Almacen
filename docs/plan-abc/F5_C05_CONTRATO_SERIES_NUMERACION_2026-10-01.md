# F5 C05 Contrato de series y numeracion documental

Fecha: 2026-10-01  
Estado: `CANDIDATO_C05_VALIDADO_PG_NO_APLICADO`
Base: Plan ABC C05, F2 operaciones idempotentes y F5 C04

## Alcance de este subpunto

C05 prepara la identidad documental antes de decidir el proveedor fiscal. Cada
serie pertenece a una empresa, un local y un tipo de documento. La asignacion
del numero ocurre dentro de una transaccion y bajo bloqueo de la serie, por lo
que dos solicitudes concurrentes no pueden recibir el mismo numero.

Este paquete no afirma emision fiscal, no selecciona proveedor, no valida SIF,
no crea facturas conformes y no sustituye la decision de C06/C07. La autoridad
actual del candidato es `INTERNA`; queda preparado el valor
`PROVEEDOR_FISCAL` para una decision posterior, sin activarlo por defecto.

## Contrato

- `abc_c05_series_documentales` mantiene la siguiente numeracion por
  empresa/local/tipo/serie.
- `abc_reservar_numero_documental` bloquea la serie, incrementa el contador y
  crea un documento `RESERVADO` con `operation_id` estable.
- `abc_resolver_emision_documental` transforma la reserva en `EMITIDO`,
  `PENDIENTE` o `ERROR`, conservando el resultado recibido y la misma
  identidad documental.
- Repetir una reserva con el mismo `operation_id` recupera el resultado
  anterior; repetir la resolucion de un documento ya emitido recupera el mismo
  numero sin renumerar.
- La identidad de serie, tipo y numero no puede cambiar después de reservarse.
  Un documento emitido tampoco puede reescribirse.
- Las tablas quedan sin acceso directo del cliente; la escritura se hace por
  RPC autenticada con contexto empresa/local y capacidad de emisor.

## Dependencias y límites

C05 usa la tabla común de operaciones y eventos. C06 definirá los tipos de
documento y C07 decidirá régimen, emisor y proveedor fiscal. C08 definirá la
conservación y rectificación. Mientras esas decisiones no existan, los datos
de este paquete son identidad y estado técnico, no evidencia de cumplimiento
fiscal.

## Evidencia prevista

1. Contratos estáticos de preflight, concurrencia, idempotencia, ACL/RLS y
   no-renumeracion.
2. Prueba PostgreSQL 16 ejecutada con dos conexiones: dos reservas concurrentes de la
   misma serie, recuperación por `operation_id`, transición pendiente a
   emitido y bloqueo de modificación de un documento emitido.
3. No se aplican migraciones remotas, no se escribe QA/PROD y no se ejecuta
   deploy de Netlify en este subpunto.

## Criterios de aceptación

- una sola identidad documental por numero dentro de empresa/local/tipo/serie;
- ninguna carrera entrega el mismo numero;
- una reserva repetida recupera el documento original;
- una respuesta pendiente o error no consume otra identidad al reintentarse;
- un documento emitido conserva serie y numero;
- proveedor, fiscalidad y asesoria quedan expresamente pendientes de C06/C07.

La ejecución PostgreSQL 16 de C05 pasó en GitHub Actions (run 1, 34 s). La
revisión de advisors y la aplicación en QA/PROD siguen separadas y pendientes.
