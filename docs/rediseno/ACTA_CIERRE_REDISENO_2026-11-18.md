# L&A Suite · Acta final de cierre del rediseño

**Fecha:** 18/11/2026  
**Rama:** `rediseno/f0-base-qa`  
**PR:** #225 contra `release`, mantenido en borrador  
**Entorno:** Deploy Preview #225 y Supabase QA `qjqorixtkilwsndqayyx`  
**Producción:** fuera de alcance; no se publicó ni modificó producción.

## 1. Decisión de cierre

El rediseño queda **cerrado en QA** dentro del alcance aprobado. La capa visual,
las nueve propuestas, las seis paletas, la navegación Órbita y sus superficies
de TPV, Pase, Cocina y Caja tienen evidencia live y contratos locales en verde.
Las filas funcionales cerradas se encuentran en
`docs/rediseno/MATRIZ-IMPLANTACION-QA.csv` y las notas históricas han sido
supersedidas por sus addenda de estado vigente.

Este cierre no significa que todas las funcionalidades futuras del producto
estén construidas. Los elementos opcionales o fuera de alcance se enumeran en
la sección 5 y no bloquean el cierre del rediseño.

## 2. Alcance cerrado y evidencia

| Área | Estado | Evidencia principal |
| --- | --- | --- |
| Nueve propuestas visuales y seis paletas | `Pasa` | `qa-20261117-punto2-apariencia` y `qa-20261118-punto2-live`; escritorio, tablet y móvil |
| TPV y sala, caja y fiscalidad | `Pasa` | `tpv-31` con factura completa `TPV-40`; `caj-16` con rectificativa `TPV-41` |
| Revisión móvil de `org-33` | `Pasa` | 390×844 sin overflow, controles táctiles ≥44×44, conflictos de versión verificados |
| Punto 1 operativo | `Pasa` | TPV, Pase, Cocina, Caja, permisos de Camarero/a, albarán y anticipos documentados en las actas QA |
| Paridad de fuente | `Pasa` | `SOURCE_RECOVERY_CHECK=PASS`, cuerpo de `fuente.js` y `source-recovery` idéntico |

Las operaciones económicas de esta tanda se limitaron a los fixtures QA ya
autorizados. No se generaron cobros, reembolsos ni documentos adicionales al
ejecutar esta batería.

## 3. Batería ejecutada

### 3.1 Contratos específicos del rediseño

Resultado: **8/8 archivos pasan, 0 fallos**.

Incluye:

- `org33-sala-contract.mjs`.
- `p01-capas-y-migraciones-contract.mjs`.
- `p02-apariencia-empresa-pglite-contract.mjs`.
- `p03-botones-de-solo-icono-contract.mjs`.
- `p04-mfa-politica-pglite-contract.mjs`.
- `p05-propuestas-contract.mjs`.
- `p06-propina-cambio-contract.mjs`.
- `p1-fiscal-tpv-contract.mjs`.

Resultados destacados: 49/49 comprobaciones locales de Apariencia, 26/26 de
MFA opcional, nueve diseños y seis paletas, y contratos fiscales P1 en verde.

### 3.2 Batería PGlite local

Resultado: **4/4 contratos activos pasan, 0 fallos de infraestructura**.

También se verificaron las migraciones efímeras de Apariencia, las reglas RLS,
la concurrencia y la recuperación de revisión. La batería no conecta con
producción.

### 3.3 Batería Node compartida de la puerta CI

Se corrigió primero el inventario de CI para incluir los dos contratos del
rediseño que ya existían en el árbol:

- `tests/rediseno/org33-sala-contract.mjs`.
- `tests/rediseno/p1-fiscal-tpv-contract.mjs`.

Inventario resultante: **374 entradas**, de las que hay **357 contratos
activos**, 1 histórico esperado, 11 utilidades y 5 diagnósticos. La ejecución
local oficial, con las dependencias externas aisladas en una carpeta temporal,
dio:

| Métrica | Resultado |
| --- | ---: |
| Contratos Node activos | 319 |
| Node activos en verde | 305 |
| Node activos en rojo | 14 |
| Utilidades ejecutadas | 8 |
| Diagnósticos ejecutados | 5 |
| Fallos de infraestructura | 0 |
| Límite de publicación Netlify | `PASS` |

Los 14 rojos pertenecen a contratos heredados de otras áreas del repositorio y
no son contratos del rediseño:

```text
tests/alb/a03-cableado-proveedor-desde-albaran-contract.mjs
tests/cfg/a09-panel-ui-runtime.mjs
tests/cfg/cfg6-ui-contract.mjs
tests/cfg/cfg6-ui-runtime.mjs
tests/cfg/cfg6d-ui-runtime.mjs
tests/cfg/f7-preflight-static-contract.mjs
tests/f3/a08/a08-3-unir-cuentas-contract.mjs
tests/f4/b04/b04-ui-contract.mjs
tests/f4/b05/b05-phase1-regression.mjs
tests/f4/b05/b05-ui-contract.mjs
tests/pm05/frontend-contract.mjs
tests/pm15/p03-mej02-confirmacion-pago-destino-contract.mjs
tests/pm33/p1-dashboard-movimientos-key-contract.mjs
tests/ui-context-bridge.mjs
```

Su salida se conserva como diagnóstico honesto: no se han marcado como verdes
ni se han silenciado. Varios son contratos previos que detectan divergencias de
la aplicación general, del bundle heredado o de paridad de fuente; requieren
una tanda propia y no deben mezclarse con el cierre del rediseño.

## 4. Integridad del árbol y publicación

- `git diff --check`: `PASS`.
- `node --check fuente.js`: `PASS`.
- `node --check source-recovery/fuente-recuperado.js`: `PASS`.
- Paridad de `source-recovery`: `PASS`.
- El manifiesto CI y su validador negativo pasan con 374 entradas.
- Los artefactos temporales de la batería se limpian al terminar; el árbol se
  deja limpio antes de publicar.
- El PR #225 permanece en borrador.
- No se ejecutó ninguna operación contra producción.

## 5. Elementos que siguen separados del cierre

Estos trabajos no se consideran defectos del rediseño cerrado:

- Paginación o búsqueda ampliada de la cola de Pase.
- Prueba positiva de Cajero/a con MFA.
- Registro contable pendiente de las migraciones de Apariencia en
  `schema_migrations`.
- Vale regalo y conciliación contable/fiscal.
- Nuevas operaciones económicas móviles que no forman parte de la evidencia
  fiscal ya cerrada.
- Los 14 contratos heredados indicados en la sección 3.3.

## 6. Reproducción

Desde la raíz del repositorio, con las dependencias de prueba fuera del árbol:

```text
node .github/scripts/validar-manifiesto-ci.mjs --self-test
bash tests/ci/ejecutar_bateria_no_db.sh
bash tests/ci/ejecutar_pglite_local.sh
node tests/rediseno/p1-fiscal-tpv-contract.mjs
git diff --check
```

La referencia documental complementaria está en:

- `PLAN_P1_FISCAL_TPV_2026-11-18.md`.
- `QA_PUNTO2_PROPUESTAS_2026-11-17.md`.
- `CIERRE-ALCANCE-PENDIENTES-2026-11-18.md`.
- `TRASPASO_QA_CLAUDE_2026-11-17.md`.

**Conclusión:** el rediseño aprobado queda cerrado y trazable en QA; los rojos
restantes están identificados como trabajo heredado fuera de este alcance y no
se han ocultado ni atribuido falsamente al rediseño.
