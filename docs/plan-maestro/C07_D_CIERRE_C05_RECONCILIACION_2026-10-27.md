# C07-D — cierre QA de reconciliación C05 y protección post-merge

Fecha: 27/10/2026  
Entorno validado: QA y CI efímera  
Proyecto Supabase QA: `qjqorixtkilwsndqayyx`  
Producción: no modificada  
AEAT: no contactada  

## 1. Alcance de este cierre

Este documento cierra formalmente el bloque técnico de reconciliación C05 y su
protección dentro de C07-D en QA. El cierre cubre:

- la creación y validación de una fixture QA limpia y repetible;
- la comprobación económica entre documentos C05 y su origen de venta;
- la protección automática del contrato dentro del workflow fiscal;
- la integración del cambio en la rama `release`;
- la verificación de que el cambio no referencia producción ni transporta
  credenciales.

Este documento no constituye autorización fiscal, activación AEAT, alta de una
empresa real ni autorización de producción. Tampoco declara cerrado el piloto
empresarial C07-D.3.

## 2. Fixture QA cerrada

La fixture `C05_RECONCILIACION_LIMPIA` quedó definida como exclusiva de QA y
contiene tres documentos emitidos, con sus datos económicos reconciliados:

| Documento | Estado | Moneda | Base | Impuesto | Total | Origen | Líneas |
|---:|---|---|---:|---:|---:|---|---:|
| 1 | `EMITIDO` | `EUR` | 10,00 | 2,10 | 12,10 | encontrado | 1 |
| 2 | `EMITIDO` | `EUR` | 20,00 | 4,20 | 24,20 | encontrado | 1 |
| 3 | `EMITIDO` | `EUR` | 30,00 | 6,30 | 36,30 | encontrado | 1 |

Controles que quedan protegidos:

- `qa_only = true` y entorno `QA`;
- cero errores de cola en el fixture;
- numeración completa 1, 2 y 3;
- origen económico presente para cada documento;
- exactamente una línea de origen por documento;
- igualdad de base, impuesto y total entre C05 y el origen;
- `subtotal + tax = total` para todos los documentos;
- ausencia de referencias a `flqercbgpgmmfaakrwkc` o a producción en el
  contrato de migración.

La fixture se encuentra en:

`tests/f5/c07/fixtures/c05-reconciliacion-limpia.json`

## 3. Protección automatizada

El workflow `.github/workflows/fiscal-multiempresa-config.yml` ejecuta en
PostgreSQL 16 el contrato:

`node tests/f5/c07/c07d-migration-contract.mjs`

El contrato verifica tanto la estructura C07-D como la fixture económica limpia.
No se añadió una entrada nueva al inventario de contratos; se amplió el
contrato C07-D existente para mantener el recuento único y evitar duplicidades.

Resultado reproducido:

```text
ABC_F7_C07D_MIGRATION_CONTRACT=PASS
ABC_F7_C07D_C05_CLEAN_FIXTURE_CONTRACT=PASS
```

## 4. Evidencia CI y merge

El cambio se preparó en el PR 185:

- PR: https://github.com/Plopezm1990/Almacen/pull/185
- commit de trabajo: `ad001a2196749e98f4c886af4d80ab238ee8e6f4`;
- commit de merge en `release`:
  `6a5c3e0538e513cfb0902e65e68c9c13d57595f7`.

Antes del merge quedaron en verde:

- puerta general `297/297 contratos activos`;
- C05, C06, C07, C08, C09, C10, C11 y C12;
- configuración fiscal C07-A/B en PostgreSQL 16 y 17;
- contratos Supabase/PostgreSQL efímeros;
- Deploy Preview de Netlify.

Después del merge se verificó directamente la rama `release` y se confirmó
que contiene:

- el workflow con el paso de la fixture limpia;
- `tests/f5/c07/c07d-migration-contract.mjs` actualizado;
- `tests/f5/c07/fixtures/c05-reconciliacion-limpia.json`.

## 5. Estado de QA y producción

El alcance QA queda cerrado para esta protección automatizada. Los datos
históricos defectuosos de QA no se borraron ni se reescribieron; se conservan
como evidencia y la fixture limpia queda separada para regresión repetible.

No se hizo ninguna de las siguientes acciones:

- no se modificó el proyecto Supabase de producción;
- no se aplicaron migraciones a producción;
- no se contactó con la AEAT;
- no se almacenaron NIF, certificados, tokens ni secretos en el repositorio;
- no se activó un transporte real;
- no se marcó ningún expediente como `PRODUCTION_ENABLED`.

## 6. Decisión de cierre

```text
C05_RECONCILIACION_QA                 = CERRADA
C07D_FIXTURE_ECONOMICA_QA             = CERRADA
C07D_CONTRATO_AUTOMATIZADO            = CERRADO
C07D_MERGE_RELEASE                    = COMPLETADO
PRODUCCION                            = SIN CAMBIOS
AEAT                                  = NO CONTACTADA
C07D3_PILOTO_EMPRESA_REAL             = BLOQUEADO
```

## 7. Siguiente paso

La siguiente validación funcional queda definida como C07-D.3, piloto sandbox
por empresa. Sigue bloqueada hasta disponer de una empresa real, asesoría o
representante, proveedor/adaptador sandbox y hardware para cotejar ticket,
QR y salida física.

Mientras no exista esa empresa piloto, el trabajo permitido continúa siendo
QA técnico: contratos, simulador, validación visual y endurecimiento de
seguridad. El simulador `SIMULADOR_C07D` no demuestra aceptación de una factura
por la AEAT y no puede utilizarse como motivo para activar producción.

**Cierre formal: TERMINADO en QA.**
