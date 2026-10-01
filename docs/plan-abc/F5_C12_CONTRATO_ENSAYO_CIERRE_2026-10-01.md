# F5 C12 Contrato de ensayo del cierre

Fecha: 2026-10-01  
Estado: `CANDIDATO_C12_PENDIENTE_VALIDACION_PG`

## Alcance

C12 añade un ensayo de cierre de sesión de caja. El ensayo toma una fotografía
explicable del estado de la sesión, el efectivo esperado y contado, los
bloqueos de pagos y efectos, y la conciliación documental más reciente de
C11. Su finalidad es anticipar si el cierre está apto, pendiente o bloqueado
sin ejecutar el cierre real.

## Contrato técnico

- `abc_ensayar_cierre_sesion_caja` exige autenticación, capacidad de caja y
  una terminal vinculada a la sesión.
- Lee la sesión sin `FOR UPDATE` y no actualiza `caja_sesiones`,
  `caja_cierres`, `caja_conteos`, pagos, efectos ni documentos.
- Integra los bloqueos operativos de C04, la diferencia de efectivo y el
  último informe C11 por documento.
- Devuelve `APTO_CIERRE`, `PENDIENTE` o `BLOQUEADO`, con bloqueos y explicación
  legible.
- Guarda un informe JSON inmutable con huella SHA-256, un evento
  `CIERRE_ENSAYADO` y replay idempotente por `operation_id`.
- La tabla de informes no tiene acceso directo del cliente y está protegida
  contra actualización y borrado.

## Límites explícitos

El ensayo no confirma el conteo, no finaliza el cierre, no reabre la sesión,
no modifica pagos ni efectos, no corrige documentos y no sustituye la revisión
operativa, fiscal o bancaria. No se aplican migraciones remotas y no se hace
deploy de Netlify.

## Evidencia y pendiente

La prueba PostgreSQL 16 debe cubrir un estado pendiente por falta de conteo y
entrega, un estado `APTO_CIERRE` después de completar el flujo, hash, replay,
inmutabilidad y comprobación de que las tablas de cierre no cambian. Tras esa
validación, C03-C12 quedarán implementados como candidatos técnicos sin aplicar
en QA/PROD. Quedarán aparte la revisión de asesoría/proveedor, las decisiones
de configuración y la autorización explícita de una aplicación remota.
