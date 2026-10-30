# C07-D.2.6 — expediente de activación fiscal por empresa

Fecha: 27/10/2026  
Estado: plantilla técnica preparada; ninguna empresa activada  
Entorno: QA y documentación  
Producción: sin cambios  
AEAT/proveedor: sin conexión

## Objetivo

Crear un expediente repetible para cada empresa que quiera pasar de la
simulación QA a una prueba externa y, eventualmente, a producción. El
expediente no almacena secretos ni sustituye la revisión de la asesoría. Es la
lista de evidencias que el servidor debe comprobar antes de permitir un cambio
de estado.

Una empresa nueva parte siempre de `BORRADOR`. No hereda la activación, la
credencial, la representación, la serie, el adaptador ni la cadena de otra
empresa.

## Identidad del expediente

Campos de ámbito, todos resueltos por servidor:

- `empresa_id`;
- `local_id` o conjunto explícito de locales;
- `entidad_fiscal_id`;
- `tipo_documento`;
- `adapter_code` y `adapter_version`;
- `environment` (`QA`, `SANDBOX` o `PRODUCCION`);
- versión de la configuración y actor de cada decisión.

La identidad visible para la asesoría debe mostrar razón social, NIF y emisor
sin exponer credenciales. Un cambio de NIF, emisor, modalidad, serie,
representante o adaptador crea una nueva revisión y nunca reescribe documentos
ya emitidos.

## Checklist de entrada

El expediente debe registrar cada control como `PENDIENTE`, `PASS` o `BLOCKED`:

| Control | Evidencia mínima | Bloquea activación si falta |
|---|---|---|
| Identidad | NIF, razón social, domicilio y emisor verificados | Sí |
| Ámbito | jurisdicción, RRSIF/SII y modalidad revisados | Sí |
| Representación | vía directa, apoderamiento o colaboración documentada | Sí |
| Asesoría | asesor responsable y concesión por empresa | Sí cuando intervenga |
| Series | serie, numeración y autoridad aprobadas | Sí |
| Adaptador | versión y capacidades compatibles | Sí |
| Credencial | referencia opaca, titular y vigencia; secreto fuera de negocio | Sí si el adaptador la exige |
| Sandbox | prueba aceptada y respuesta cotejada | Sí |
| QR | lectura del QR y coincidencia con snapshot | Sí para documentos afectados |
| Idempotencia | repetición, conflicto y timeout probados | Sí |
| Hardware | pantalla, PDF, impresora y lector aceptados | Sí si se usan |
| Incidencias | recuperación, reintentos y soporte definidos | Sí |
| Doble aprobación | propietario y segundo responsable registrados | Sí para producción |

La evidencia se guarda como metadatos: tipo, referencia opaca, huella,
fecha, vigencia, resultado y usuario. No se sube al panel un PEM, certificado,
contraseña, token, XML completo de una respuesta ni documento personal sin una
política específica de custodia.

## Estados del expediente

```text
BORRADOR
  └─ READY_FOR_TEST
       ├─ BLOCKED_*       (falta o falla un control)
       └─ TEST_PASS
            └─ PRODUCTION_ENABLED  (solo con doble aprobación)
```

Reglas:

- `READY_FOR_TEST` exige identidad, alcance, representación, series, adaptador
  y credencial preparada cuando proceda;
- `TEST_PASS` exige resultado externo satisfactorio, QR cotejado,
  idempotencia, respuesta desconocida e incidencias probadas;
- cualquier caducidad de credencial, representación o prueba devuelve el
  expediente a un bloqueo, pero conserva la historia;
- `PRODUCTION_ENABLED` requiere operación server-side, versión de adaptador,
  fecha, motivo, actor propietario, segundo aprobador y auditoría;
- el frontend nunca puede escribir directamente `TEST_PASS` ni
  `PRODUCTION_ENABLED`;
- una empresa en `BLOCKED_*` puede seguir usando el TPV comercial, pero la
  emisión fiscal se mantiene bloqueada.

## Expediente QA de referencia

El expediente actual de QA se usa solo para comprobar el flujo de control:

- empresa: `QA-EMP-A`;
- local: `QA-A1`;
- emisor: entidad simulada de QA;
- adaptador: `SIMULADOR_C07D` `1.0.0`;
- entorno: `QA`;
- transporte: `DISABLED`;
- credencial: no requerida;
- producción: bloqueada;
- AEAT/proveedor: no contactado.

Este expediente no es una plantilla de activación fiscal real y no puede
convertirse automáticamente en `PRODUCTION_ENABLED`.

## Criterios de cierre técnico

C07-D.2.6 se considera preparado cuando:

1. existe la checklist anterior versionada;
2. cada control tiene resultado y evidencia mínima definida;
3. la transición a producción exige doble aprobación server-side;
4. las credenciales se representan solo con referencias opacas;
5. una caducidad o revocación bloquea sin borrar historia;
6. QA no puede ejecutar transporte externo;
7. existe contrato automático que evita introducir secretos o una activación
   directa desde el frontend.

## Siguiente paso

Cuando exista una empresa piloto, se rellenará este expediente con su asesoría
y su sandbox. Hasta entonces, el trabajo técnico puede continuar con
`SIMULADOR_C07D`, pruebas de estados y validación de pantalla/PDF, manteniendo
la emisión fiscal real desactivada.
