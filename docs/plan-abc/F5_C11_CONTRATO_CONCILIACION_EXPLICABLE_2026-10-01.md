# F5 C11 Contrato de conciliación explicable

Fecha: 2026-10-01  
Estado: `CANDIDATO_C11_VALIDADO_PG_NO_APLICADO`

## Alcance

C11 genera un informe inmutable que explica el estado de un documento C05 a
partir de hechos verificables de C05, C06, C08, C09 y C10. El informe muestra
la identidad del documento, su clasificación, la versión conservada, cantidad
de impresiones, cantidad de entregas, resultado, bloqueos y explicación legible.

Antes de registrar una entrega el resultado es `PENDIENTE_ENTREGA`. Cuando la
cadena está completa el resultado es `CONCILIADO`. Un documento no emitido se
marca `INCONSISTENTE`; la conciliación no corrige ni modifica el documento.

## Contrato técnico

- `abc_generar_conciliacion_documental` exige autenticación y capacidad de
  emisor.
- Comprueba que el documento esté emitido, clasificado y ligado a una versión
  C08 del mismo documento, empresa y local.
- Cuenta impresiones C09 y entregas C10 sin crear nuevos documentos ni ventas.
- El resultado y sus bloqueos quedan en un informe JSON explicable.
- `informe_hash` conserva una huella SHA-256 del informe generado.
- El mismo `operation_id` devuelve el mismo informe; una nueva operación puede
  generar una foto posterior del ciclo documental.
- El informe es inmutable, auditable mediante evento y sin acceso directo del
  cliente.

## Límites explícitos

Esta conciliación no sustituye una conciliación bancaria, no certifica
cumplimiento fiscal, no firma facturas, no envía documentos y no modifica
ventas, caja, stock ni documentos históricos. No se aplican migraciones remotas
y no se ejecuta deploy de Netlify.

## Evidencia y pendiente

La prueba PostgreSQL 16 cubrió estado pendiente, estado conciliado, explicación,
huella, replay, inmutabilidad y comprobación de que C05 conserva un solo
documento. El workflow pasó en 1 minuto y 7 segundos:
https://github.com/Plopezm1990/Almacen/actions/runs/36917196726. Después queda
C12, advisors, revisión de asesoría/proveedor y decisión de aplicación en QA.
