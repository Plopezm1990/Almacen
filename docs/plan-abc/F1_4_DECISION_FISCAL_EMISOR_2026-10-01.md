# F1.4 — decisión fiscal y emisor

Fecha: 2026-10-01  
Estado: `PENDIENTE_ASESORIA`  
Base: F1.1–F1.3 y `origin/release` `7859508`

Este documento prepara la decisión con asesoría. No es una certificación de
cumplimiento ni una opinión fiscal. La aplicabilidad depende del obligado, el
territorio, el régimen y la forma real de facturar.

## Fuentes oficiales a revisar

- [Real Decreto 1007/2023, texto consolidado en BOE](https://www.boe.es/buscar/act.php?id=BOE-A-2023-24840): requisitos de sistemas informáticos que soportan procesos de facturación.
- [Real Decreto 1007/2023, PDF consolidado](https://www.boe.es/buscar/pdf/2023/BOE-A-2023-24840-consolidado.pdf): texto para revisión y archivo de la asesoría.

La norma oficial describe requisitos de integridad, conservación, accesibilidad,
legibilidad, trazabilidad e inalterabilidad de los registros de facturación; la
asesoría debe confirmar si y cómo aplican al caso concreto antes de cerrar C03.

## Datos que debe confirmar la asesoría

| Decisión | Valor | Estado |
|---|---|---|
| País, territorio y establecimiento | `PENDIENTE` | `PENDIENTE_ASESORIA` |
| Tipo de obligado y actividad | `PENDIENTE` | `PENDIENTE_ASESORIA` |
| Régimen de IVA u otros impuestos | `PENDIENTE` | `PENDIENTE_ASESORIA` |
| Tipo de documento por operación | `PENDIENTE` | `PENDIENTE_ASESORIA` |
| Factura simplificada/completa u otra modalidad | `PENDIENTE` | `PENDIENTE_ASESORIA` |
| Series y numeración | `PENDIENTE` | `PENDIENTE_DEFINICION` |
| Rectificación y anulaciones | `PENDIENTE` | `PENDIENTE_DEFINICION` |
| Conservación y exportación | `PENDIENTE` | `PENDIENTE_DEFINICION` |
| Remisión o no remisión de registros | `PENDIENTE` | `PENDIENTE_ASESORIA` |
| Fecha aplicable al sistema | `PENDIENTE` | `PENDIENTE_FUENTE_OFICIAL` |

## Comparación de alternativas

| Criterio | Emisor propio | Proveedor integrado |
|---|---|---|
| Control del modelo de datos | mayor control interno | depende del contrato/API |
| Mantenimiento normativo | responsabilidad del proyecto | responsabilidad compartida/contractual |
| Integración | desarrollo y pruebas propios | adaptación al API y eventos |
| Exportación y auditoría | diseñar y conservar internamente | verificar acceso y formato |
| Coste recurrente | soporte y actualización propios | tarifa, comisión y soporte |
| Continuidad | plan de cambios propio | SLA, salida y portabilidad |
| Evidencia | contratos y pruebas internas | documentación, sandbox y declaración del proveedor |
| Decisión | `PENDIENTE` | `PENDIENTE` |

## Criterios de no aceptación provisional

No se elegirá una opción solo porque genere un PDF, tenga una pantalla de
factura o aparezca como compatible en una página comercial. Antes de decidir se
requiere comprobar alcance territorial, registros, numeración, rectificaciones,
conservación, exportación, seguridad, soporte y procedimiento de recuperación.

No se marcará C03 como cerrado mientras falten régimen, emisor, serie,
requisitos aplicables y evidencia de prueba. El desarrollo puede mantener una
interfaz o contrato provisional, pero no emitir documentos fiscales reales.

## Ficha mínima de decisión

```text
Asesoría revisora: [pendiente]
Territorio/régimen: [pendiente]
Documento aplicable: [pendiente]
Opción: emisor propio / proveedor integrado / otra
Proveedor o sistema: [pendiente]
Serie y numeración: [pendiente]
Rectificación/anulación: [pendiente]
Conservación/exportación: [pendiente]
Pruebas oficiales: [pendiente]
Aceptación y fecha: [pendiente]
```

## Resultado de F1.4

La decisión fiscal queda preparada para asesoría y no se presume resuelta por
el código existente. No requiere secretos, migración remota, merge ni deploy de
Netlify.
