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
| `tpv-29` | Propina y vale regalo | Propina de cambio verificada en QA y cerrada en `TPV-38`; QA también expone `abc_emitir_vale_regalo` y `abc_consultar_vale_regalo`, pero no hay superficie Órbita ejercitada. | Mantener propina cerrada; tratar el vale como trabajo separado con saldo, emisión, canje, devolución y auditoría antes de darlo por construido. |

## Contratos encontrados

- `supabase/migrations/20261001160000_abc_f5_c06_document_types.sql` (registrada en QA como `20261002060700`).
  - `abc_clasificar_documento(operation_id, empresa_id, local_id, documento_id, tipo_documental, documento_referencia_id, datos_receptor)`.
  - Tipos aceptados: `FACTURA_COMPLETA` y `FACTURA_RECTIFICATIVA`, entre otros.
  - Una factura completa necesita nombre e identificador fiscal del receptor.
  - Una rectificativa necesita referencia a otra factura y el original debe estar emitido.
- `supabase/migrations/20261001180000_abc_f5_c08_document_retention.sql` (registrada en QA como `20261002060718`).
  - `abc_conservar_documento_emitido(...)` conserva una versión inmutable.
  - `abc_registrar_correccion_documental(...)` registra rectificación, cancelación operativa o reembolso con motivo y trazabilidad.
- La consulta de solo lectura de QA del 18/11/2026 confirma que ambas están
  aplicadas: existen `abc_c06_documentos_clasificados` (40 filas),
  `abc_c08_documento_versiones` (0 filas) y
  `abc_c08_correcciones_documentales` (0 filas). Los cinco RPC relevantes
  (`abc_clasificar_documento`, `abc_conservar_documento_emitido`,
  `abc_registrar_correccion_documental`, `abc_emitir_vale_regalo` y
  `abc_consultar_vale_regalo`) existen, son `SECURITY DEFINER` y solo tienen
  `EXECUTE` para `authenticated`. No hay que aplicar una migración para esta
  tanda; hay que construir la interfaz y usar fixtures reversibles.

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

La disponibilidad del contrato ya está comprobada en QA. La siguiente acción
de implementación ya está realizada en la rama: la tarjeta fiscal de Órbita
incluye `tpv-31` («Solicitar factura a empresa») y `caj-16` («Registrar
rectificación»). No hay DML directo: la primera usa
`abc_clasificar_documento` + `abc_conservar_documento_emitido` y la segunda
usa `abc_registrar_correccion_documental`, siempre detrás de confirmación
propia y con `qa_only`/`aeat_transport=DISABLED`.

Queda pendiente la validación live. Antes de pulsar cualquier operación en QA
se debe preparar un fixture reversible, comprobar que existe un documento
rectificativo válido y pedir autorización explícita; no se debe usar una venta
real ni afirmar cumplimiento AEAT.

## Implementación de interfaz · 18/11/2026

- `tpv-31` se muestra cuando la cuenta tiene documento fiscal emitido. Pide
  razón social, identificador fiscal y dirección opcional; exige nombre e
  identificador antes de llamar al servidor; conserva la revisión inmutable y
  muestra el resultado sin cerrar ni modificar el cobro.
- `caj-16` se muestra junto al documento original. Pide el ID del documento
  rectificativo ya emitido/clasificado y un motivo obligatorio; el mensaje
  explica que el original no se modifica y que el vínculo queda en servidor.
- La vista es responsive porque reutiliza `Modal`, `Field`, `Input` y `Btn`
  del TPV, con áreas táctiles del sistema Órbita.
- Contrato nuevo: `tests/rediseno/p1-fiscal-tpv-contract.mjs`.
- Paridad `fuente.js` ↔ `source-recovery/fuente-recuperado.js`: exacta.

## Evidencia relacionada

- `docs/rediseno/PLAN_P1_PROPINA_ORBITA_2026-11-18.md` — cobro único de 4,95 €, propina 0,05 €, ticket `TPV-38`, secuencia 34 y cierre formal tras servir el pedido.
- `docs/rediseno/CIERRE-ALCANCE-PENDIENTES-2026-11-18.md` — orden global de las 21 filas no construidas.
- `tests/rediseno/p06-propina-cambio-contract.mjs` — contrato de propina y mensaje honesto de cierre.

## Corrección de interoperabilidad de respuesta · 18/11/2026

En la primera revisión live de QA el documento C07-D se veía (serie, número,
cola y QR), pero no aparecían las acciones P1. La causa era una suposición
demasiado estricta del cliente: la tarjeta exigía que el identificador viniera
únicamente en `documento_id`, aunque el contrato de lectura también puede
entregarlo como `id` o anidado en `documento.id`. La UI ahora normaliza esas
formas antes de mostrar y ejecutar `tpv-31`/`caj-16`; no cambia el contrato
server-side ni permite operar sin un identificador. Se regeneró el espejo de
`source-recovery` y el contrato de P1 sigue pasando. La validación live de la
emisión queda pendiente de repetir en el preview actualizado.

La consulta posterior de QA no encuentra otro fixture utilizable: solo queda
sin clasificación el documento `dee9ca1a-79ac-4d53-a902-69976686d497`
(`TPV-6`), ligado a la cuenta `16cae507-2855-4c02-8d35-5a98abcf3b68` del día
operativo `2026-10-26`. El servidor lo mantiene abierto históricamente, pero
el TPV lo expone como «Día cerrado» y no permite retomarlo. Para obtener una
prueba positiva de `tpv-31` hace falta una venta de ensayo nueva del día
actual, expresamente autorizada, y después dejar la cuenta pagada/cerrada sin
reutilizarla en producción.
