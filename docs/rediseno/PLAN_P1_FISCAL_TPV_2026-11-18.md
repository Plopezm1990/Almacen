# P1 fiscal/TPV · factura a empresa y rectificación

Fecha: 18/11/2026  
Rama: `rediseno/f0-base-qa` · PR #225 en borrador  
Entorno permitido: Deploy Preview / Supabase QA. Producción no se toca.

## Estado de la investigación

La siguiente tanda recomendada después del cierre de TPV, Pase y Caja es el
grupo fiscal/TPV. La revisión se hizo contra la fuente de la rama y las
migraciones, no contra nombres de pantallas de la maqueta.

| ID | Alcance | Lo que existe | Lo que falta |
|---|---|---|---|
| `tpv-31` | Solicitar factura a empresa | El servidor contempla `FACTURA_COMPLETA` y exige `datos_receptor.nombre` e `identificador_fiscal` mediante `abc_clasificar_documento`. | Selector de cliente/empresa, formulario fiscal, llamada RPC, conservación del documento y presentación del resultado. |
| `caj-16` | Rectificación fiscal | El servidor contempla `FACTURA_RECTIFICATIVA`; `abc_registrar_correccion_documental` exige documento original conservado, documento rectificativo emitido y motivo no vacío. | Listado de documentos emitidos, formulario de motivo, vínculo original→rectificativa y trazabilidad visible. |
| `tpv-29` | Propina y vale regalo | Propina de cambio verificada en QA y cerrada en `TPV-38`; el vale regalo no tiene contrato ni saldo. | Mantener propina cerrada; separar vale regalo como futura, sin simularlo como medio de pago. |

## Contratos encontrados

- `supabase/migrations/20261001160000_abc_f5_c06_document_types.sql`
  - `abc_clasificar_documento(operation_id, empresa_id, local_id, documento_id, tipo_documental, documento_referencia_id, datos_receptor)`.
  - Tipos aceptados: `FACTURA_COMPLETA` y `FACTURA_RECTIFICATIVA`, entre otros.
  - Una factura completa necesita nombre e identificador fiscal del receptor.
  - Una rectificativa necesita referencia a otra factura y el original debe estar emitido.
- `supabase/migrations/20261001180000_abc_f5_c08_document_retention.sql`
  - `abc_conservar_documento_emitido(...)` conserva una versión inmutable.
  - `abc_registrar_correccion_documental(...)` registra rectificación, cancelación operativa o reembolso con motivo y trazabilidad.
- Ambas migraciones se identifican como candidatas aisladas y no deben aplicarse en QA desde esta tanda sin autorización expresa. Que el SQL exista no demuestra que la capacidad esté publicada en el entorno.

## Decisión de producto para construir

La implementación debe empezar por una **superficie compartida de documentos
fiscales** dentro del marco Órbita aprobado, no por dos pantallas aisladas:

1. En el cierre de una cuenta pagada, acción «Solicitar factura a empresa».
2. Formulario compacto con cliente/empresa, razón social, identificador fiscal y dirección opcional.
3. Resumen de validación antes de confirmar y aviso de que el documento emitido queda sellado.
4. Pantalla de documentos emitidos para abrir una factura y solicitar rectificación.
5. Rectificación con motivo obligatorio, vínculo visible al documento original y estado de servidor.
6. Vista móvil equivalente, sin scroll horizontal, controles de al menos 44 px y estados de error accionables.

No se debe afirmar cumplimiento fiscal real: QA usa el simulador C07-D y no
conecta con AEAT.

## Condiciones de cierre

- Contrato server-side disponible en QA o la fila queda bloqueada como backend pendiente.
- Propietario puede emitir una factura completa sobre un fixture reversible.
- La falta de nombre/NIF se rechaza en servidor y se explica en la UI.
- La versión emitida queda inmutable y se puede leer tras recarga/segunda sesión.
- Una rectificativa exige documento original, motivo y permiso; el original no cambia.
- Camarero/a no puede emitir ni rectificar; no se ejecutan cobros ni reembolsos para probarlo.
- Escritorio 1440×900 y móvil 390×844 sin desbordamiento.
- Batería de contratos, paridad `fuente.js`/`source-recovery` y `git diff --check` en verde.

## Siguiente acción

Antes de escribir UI o aplicar SQL hay que comprobar en el preview, en solo
lectura, si C06/C08 están publicadas y si existen documentos de ensayo. Si no
están publicadas, la siguiente acción correcta es preparar el adaptador y la
pantalla detrás de una capacidad explícita, dejando la prueba live bloqueada;
no crear una falsa factura local.

## Evidencia relacionada

- `docs/rediseno/PLAN_P1_PROPINA_ORBITA_2026-11-18.md` — cobro único de 4,95 €, propina 0,05 €, ticket `TPV-38`, secuencia 34 y cierre formal tras servir el pedido.
- `docs/rediseno/CIERRE-ALCANCE-PENDIENTES-2026-11-18.md` — orden global de las 21 filas no construidas.
- `tests/rediseno/p06-propina-cambio-contract.mjs` — contrato de propina y mensaje honesto de cierre.
