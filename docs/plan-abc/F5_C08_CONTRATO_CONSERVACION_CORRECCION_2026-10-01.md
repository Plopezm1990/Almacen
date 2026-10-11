# F5 C08 Contrato de conservación y corrección documental

Fecha: 2026-10-01  
Estado: `IMPLEMENTADO_Y_VERIFICADO_EN_QA; POLITICA_LEGAL_Y_UI_PENDIENTES`

## Alcance

C08 conserva una instantánea inmutable del documento emitido, junto con emisor,
receptor, respuesta del modo fiscal y una huella SHA-256 de la instantánea.
También registra por separado una rectificación vinculada, una cancelación
operativa o un reembolso. La corrección no modifica el documento original.

La rectificación exige un documento emitido clasificado por C06 como
`FACTURA_RECTIFICATIVA` y vinculado al documento original. La cancelación
operativa y el reembolso se registran como hechos operativos sin presentar una
afirmación de validez fiscal.

## Contrato técnico

- `abc_conservar_documento_emitido` exige autenticación y capacidad de emisor.
- Solo conserva documentos C05 en estado `EMITIDO` y ya clasificados por C06.
- La conservación es idempotente por `operation_id` y única por documento.
- `snapshot_hash` debe ser una cadena hexadecimal SHA-256 de 64 caracteres.
- Triggers de base de datos impiden actualizar versiones conservadas o
  correcciones registradas.
- `abc_registrar_correccion_documental` exige que el original esté conservado.
- `RECTIFICACION` exige documento corrector emitido, rectificativo y vinculado;
  `CANCELACION_OPERATIVA` y `REEMBOLSO` no aceptan documento corrector.
- Las tablas quedan sin acceso directo del cliente y las RPC dejan evento
  auditable.

## Límites explícitos

Este candidato no firma documentos, no genera una factura fiscal válida, no
conecta un proveedor, no envía registros a la AEAT, no declara SIF/Veri*Factu,
no decide el régimen legal y no sustituye la revisión de asesoría. El campo de
respuesta fiscal conserva el resultado del modo configurado por C07, incluido
`SIMULADOR`, sin convertirlo en una acreditación fiscal.

## Evidencia y pendiente

La prueba PostgreSQL 16 cubrió conservación, huella, replay, inmutabilidad,
rectificación vinculada, cancelación operativa y reembolso. El workflow pasó en
32 segundos: https://github.com/Plopezm1990/Almacen/actions/runs/36914004105.

El ensayo conectado en QA del 9/10/2026 cubrió las mismas rutas, la unicidad de
versión y el rechazo del Camarero/a. Terminó con `ROLLBACK` y cero residuos. Las
tablas no conceden acceso directo al cliente y las RPC solo se conceden a
`authenticated`, con validación interna de capacidad.

Quedan pendientes la revisión de asesoría/proveedor, la política de
conservación y acceso, la descarga autorizada, la pantalla y la aceptación.
Producción no se ha modificado. Evidencia consolidada:
`F7_C08_QA_RESULTADO_2026-10-09.md`.
