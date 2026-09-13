# PM27 — C05 Dependencias y supply chain

Fecha de corte: 2026-09-13
Candidato auditado: `8256628d922fe0a8dbf18ca792f8b19e89f6d9ad`
Resultado: `PASS` con riesgo residual documentado.

## 1. Instalación reproducible

El workflow del candidato ejecuta `npm ci --prefix source-recovery` sobre `source-recovery/package-lock.json`. En el run remoto exacto `34765942761`, asociado al mismo SHA candidato, la instalación terminó correctamente: 50 paquetes instalados / 51 auditados. El job completo terminó `SUCCESS`.

`source-recovery/package.json` fija versiones exactas para las dependencias directas del build recuperado y `package-lock.json` usa lockfile v3 con integridad de paquetes.

## 2. Hallazgo HIGH identificado

La única advertencia HIGH mostrada por `npm ci` corresponde a la dependencia directa:

- `xlsx@0.18.5` (SheetJS CE)
- GHSA-4r6h-8v6p-xvw6 / CVE-2023-30533 — prototype pollution al leer un workbook manipulado. Afecta `<0.19.3`.
- GHSA-5pgg-2g8v-p4x9 / CVE-2024-22363 — ReDoS. Afecta `<0.20.2`.

La versión npm `xlsx@0.18.5` no tiene versión corregida disponible en el registro npm oficial de ese paquete; las versiones corregidas de SheetJS CE se distribuyen fuera del registro npm.

## 3. Explotabilidad en el candidato actual

La fuente recuperada importa `xlsx`, pero el uso observado en el candidato es de salida/exportación:

- `XLSX.utils`
- `json_to_sheet`
- `book_append_sheet`
- `writeFile` / `writeFileSync`

No aparece `XLSX.read`, `readFile`, `sheet_to_json` ni otra ruta de parseo de workbooks no confiables en `source-recovery/fuente-recuperado.js`.

Por tanto, el vector documentado de prototype pollution por lectura de un archivo manipulado no es alcanzable por el flujo Excel actual del candidato. No se ha demostrado una ruta actual donde un usuario entregue un workbook a SheetJS para ser parseado.

Esto NO convierte la dependencia en "segura": sigue siendo una dependencia con avisos HIGH y está incluida en el build. La aceptación es estrictamente por alcance actual de uso (exportación, no importación/parsing).

## 4. Decisión de riesgo

Clasificación PM27 C05:

`PASS` con riesgo residual aceptado y acotado para el candidato congelado.

Condiciones de esta aceptación:

1. No se considera resuelta la vulnerabilidad upstream.
2. No se debe añadir ningún flujo de importación/lectura de XLSX no confiable mientras siga `xlsx@0.18.5`.
3. Antes de introducir importación Excel, hay que sustituir o actualizar SheetJS a una distribución corregida y repetir regresiones de exportación/importación.
4. La remediación preferente debe evaluarse en un paquete separado, con SHA nuevo y gate completo; no se modifica este candidato congelado durante la auditoría.

Opciones de remediación para una futura rama específica:

- migrar a una versión oficial corregida de SheetJS CE distribuida por SheetJS (>=0.20.2), validando procedencia e integridad;
- o sustituir la dependencia por otra librería mantenida, con regresiones de los dos flujos de exportación existentes.

No se adopta automáticamente un fork npm de terceros durante esta auditoría.

## 5. GitHub Actions / procedencia

Workflow PM27:

- permisos `contents: read`;
- `supabase/setup-cli` fijado a SHA completo `3c2f5e2ae34c34e428e8e206e2c4d21fa2d20fbf` y CLI `2.117.0`;
- `actions/checkout@v4` y `actions/setup-node@v4` usan etiquetas de major, no SHA inmutable.

En el run auditado GitHub resolvió concretamente:

- `actions/checkout@v4` -> `11d5960a326750d5838078e36cf38b85af677262`
- `actions/setup-node@v4` -> `49933ea5288caeca8642d1e84afbd3f7d6820020`
- `supabase/setup-cli` -> SHA exacto ya fijado.

El uso de tags `@v4` en acciones oficiales no se clasifica aquí como defecto funcional del candidato, especialmente con token de solo lectura, pero queda como endurecimiento de supply chain: GitHub documenta que fijar acciones a SHA completo es la opción inmutable más fuerte. En una futura modificación del workflow conviene sustituir esos tags por SHAs verificados.

## 6. Conclusión

No se silenció el HIGH: se identificó paquete, avisos, alcance, explotabilidad actual, ausencia de fix npm directo y estrategia de remediación. El build del candidato es reproducible con lockfile y el riesgo residual de `xlsx@0.18.5` queda aceptado únicamente porque el código actual exporta hojas y no parsea workbooks no confiables.

Marcadores:

`PM27_C05_NPM_CI_REPRODUCIBLE=PASS`
`PM27_C05_XLSX_HIGH_IDENTIFICADO=PASS`
`PM27_C05_XLSX_PARSEO_NO_ALCANZABLE_EN_FLUJO_ACTUAL=PASS`
`PM27_C05_RIESGO_RESIDUAL_DOCUMENTADO=PASS`
`PM27_C05_ACTIONS_SUPPLY_CHAIN_REVISADO=PASS`
`PM27_C05=PASS`
