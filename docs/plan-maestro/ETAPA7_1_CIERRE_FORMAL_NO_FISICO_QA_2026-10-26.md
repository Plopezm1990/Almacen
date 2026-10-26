# Plan Maestro L&A Suite — cierre formal del bloque no físico de la Etapa 7.1

Fecha: 26/10/2026  
Entorno: QA `qjqorixtkilwsndqayyx` y Deploy Preview del PR `#175`  
Producción: sin cambios  
Estado: **BLOQUE NO FÍSICO CERRADO EN QA; ETAPA 7 GLOBAL ABIERTA**

## 1. Decisión ejecutiva

Se cierra el bloque no físico de la Etapa 7.1 dentro del alcance realmente
verificado en QA. La evidencia acumulada cubre contratos técnicos, matriz viva
de roles, aislamiento entre locales y empresas, persistencia contextual del
catálogo, rendimiento de la navegación, shell de arranque offline y revisión
responsive del TPV.

Este cierre no declara cerrada la Etapa 7 completa. Permanecen fuera de este
cierre:

- la aceptación física T9 con impresora y cajón reales;
- la decisión final sobre la entrega push observable de AUD-010;
- cualquier promoción a `release` o modificación de Producción.

## 2. Resultado de la matriz no física

| Bloque | Resultado | Evidencia principal |
|---|---|---|
| Contratos de roles, Caja y movimientos | PASS | `ETAPA7_1_RESULTADO_CONTRATOS_ROLES_CAJA_MOVIMIENTOS_QA_2026-10-26.md` |
| Matriz viva Propietario/Encargado/Cajero/a/Camarero/a | PASS | `ETAPA7_1_CUENTAS_QA_CREADAS_ROLES_2026-10-26.md` |
| Aislamiento Local A1 ↔ Local A2 | PASS | `ETAPA7_1_CIERRE_INCIDENCIA_CAMBIO_LOCAL_PRODUCTOS_QA_2026-10-26.md` |
| Aislamiento QA Empresa A ↔ QA Empresa B | PASS | `ETAPA7_1_COMPARACION_AB_QA_2026-10-26.md` y corrección contextual P3c |
| Rehidratación del catálogo al cambiar de contexto | PASS | `ETAPA7_1_CIERRE_REHIDRATACION_CATALOGO_QA_2026-10-26.md` |
| Persistencia contextual de producto, stock y catálogo fiscal QA B | PASS | `ETAPA7_1_CORRECCION_PERSISTENCIA_CONTEXTUAL_QA_2026-10-26.md` |
| Rendimiento A1 ↔ A2, apertura TPV y recuperación del shell | PASS | `ETAPA7_1_MEDICION_RENDIMIENTO_QA_2026-10-26.md` |
| Responsive TPV y frontera de no cobro/no guardado offline | PASS | `ETAPA7_1_RESULTADO_MATRIZ_TPV_RESPONSIVE_OFFLINE_QA_2026-10-26.md` |
| Arranque frío offline | PASS dentro del alcance del shell seguro | `ETAPA7_1_CORRECCION_ARRANQUE_FRIO_OFFLINE_QA_2026-10-26.md` |
| Revisión A03/A04/A17 del Documento 2 | PASS | `DOCUMENTO2_REVISION_FINAL_A03_A04_A17_QA_2026-10-26.md` |

La corrección contextual de P3c sustituyó el bloqueo inicial de persistencia
de Empresa B por una ruta con empresa y local explícitos, validación de
permisos, recarga de PostgREST y fixture fiscal QA seguro. La evidencia nueva
prevalece sobre el smoke test inicial que había dejado la comparación A/B como
no concluyente.

## 3. Validación ejecutable de esta tanda

Se ejecutaron, con resultado satisfactorio:

- `node tests/f4/b11/b11-offline-boundary-contract.mjs`;
- `node tests/plan-maestro/etapa7-role-matrix-caja-contract.mjs`;
- `node tests/plan-maestro/etapa7-movimientos-sync-read-scope-contract.mjs`;
- `node tests/p3/p3c-client-contract.mjs`;
- `node tests/p3/p3-catalogo-static-contract.mjs`;
- `node tests/p3/p3b-espejo-static-contract.mjs`;
- `node tests/plan-maestro/documento2-revision-final-a03-a04-a17-contract.mjs`;
- `node tests/pm18/p05-ticket-screen-contract.mjs`;
- `node --check fuente.js`;
- `node --check index-storage-bootstrap.js`;
- `node --check sw.js`;
- `node --check offline-shell-bootstrap.js`;
- `node .github/scripts/build-netlify-publish.mjs`;
- `git diff --check`.

El build incluye el shell offline, el service worker, la vista TPV y la
opción de ticket en pantalla. El ticket con QR que se probó después quedó
limitado a QA y no representa un documento fiscal presentado ante la AEAT.

## 4. Límites que permanecen abiertos

### 4.1 T9 física

La simulación de impresora y cajón está en PASS, pero no certifica un puesto
real. La Etapa 7.2/T9 solo se abrirá cuando estén disponibles impresora,
cajón, puesto Windows y, si procede, el Puente L&A. La secuencia física queda
documentada en `ETAPA7_2_T9_BLOQUEO_HARDWARE_2026-10-26.md`.

### 4.2 AUD-010

La seguridad, las membresías y el timeout están corregidos, pero la entrega
push real observable sigue requiriendo una comprobación compatible con el
dispositivo y el proveedor. No se oculta como PASS ni se transforma en un
fallo de Producción sin evidencia nueva.

### 4.3 Offline de negocio

El shell puede montar una pantalla segura sin red. Esto no habilita cobros,
guardados, movimientos de Caja ni sincronización sin confirmación del
servidor. La frontera offline queda cerrada precisamente con esa limitación.

## 5. Estado global de la Etapa 7

| Elemento | Estado |
|---|---|
| Etapa 7.1, bloque no físico de software QA | **CERRADO** |
| Etapa 7.2/T9, hardware físico | **PENDIENTE POR HARDWARE** |
| AUD-010, entrega push observable | **PARCIAL / DECISIÓN PENDIENTE** |
| Cierre global de Etapa 7 | **ABIERTO** |
| Preflight de Producción | **NO INICIADO COMO PROMOCIÓN** |
| Producción | **SIN CAMBIOS** |

## 6. Qué sigue

El siguiente paso del plan es la Etapa 7.2/T9 cuando llegue el hardware. En
paralelo, se debe resolver o declarar formalmente el alcance de AUD-010. Solo
después se emitirá el acta global de cierre de la Etapa 7 y se preparará el
preflight de promoción.

No se debe crear una Etapa 8 por inferencia ni promover a Producción desde
este cierre parcial.
