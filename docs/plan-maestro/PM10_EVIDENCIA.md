# PM10 — Evidencia final de cierre

Fecha: 2026-09-05  
Rama: `pm10-validaciones-altas-datos-legados`  
Base productiva verificada: `main` = `7f792925d6a3d27334ee0e7335ba635b4ed79b6b`  
PR de validación: #25 — **NO MERGE**

## 1. Objetivo del paquete

PM10 corresponde a **Validaciones altas y datos legados**. Su alcance funcional cerrado es impedir que los dominios de Productos, Pedidos, Recepción, Personal y Encargos persistan estados imposibles o parciales, manteniendo el aislamiento de empresa/local, la compatibilidad conservadora con datos legados y la robustez frente a doble clic/replay cuando aplica.

## 2. Hallazgos de auditoría tratados

- **LA-011 — Productos — CERRADO.** Coste/PVP/mínimo no negativos, unidades por caja > 0, IVA acotado, números finitos, stock no negativo y validación antes de mutar.
- **LA-012 — Pedidos — CERRADO.** Proveedor y líneas válidas, cantidad > 0, coste >= 0, referencias/contexto válidos y conservación de `cantidadRecibida` al editar.
- **LA-013 — Recepción — CERRADO.** Control por pendiente, parciales/acumuladas, rechazo de exceso, lote todo-o-nada, recepción directa y albarán enlazado protegidos.
- **LA-017 — Personal — CERRADO.** Nombre obligatorio; horas/salario/coste/vacaciones no negativos y finitos; `pagas` entero > 0; sin normalizaciones silenciosas.
- **LA-018 — Encargos — CERRADO.** Cliente/fecha/contexto/líneas/cantidades/precios/señal validados como una única operación; una línea inválida no se descarta ni permite guardado parcial.

## 3. Puntos PM10 ejecutados

1. Checkpoint y rama PM10 desde HEAD final PM09 — CERRADO.
2. Inventario de validaciones reales — CERRADO.
3. Contrato común de validación congelado — CERRADO.
4. LA-011 Productos — CERRADO.
5. LA-012 Pedidos — CERRADO.
6. LA-013 Recepción — CERRADO.
7. LA-017 Personal — CERRADO.
8. LA-018 Encargos — CERRADO.
9. Revalidación transversal — CERRADO.
10. Autoridad de persistencia / MEJ-07 — CERRADO. Se eliminó el bypass directo de `almacen_kv.upsert` en reintento de sincronización y se recondujo por `window.storage.set`.
11. Robustez / MEJ-10 / NR-06 — CERRADO para el alcance PM10. Recepción usa identidad estable/replay; formularios críticos incorporan guardas contra doble submit. Se conserva la limitación arquitectónica de metadatos `almacen_kv`: no se afirma transacción ACID completa para esos metadatos.
12. Datos legados y ambiguos — CERRADO. Diagnóstico solo lectura, sin reparación automática.
13. Aislamiento A1/A2/B1/Todos/inactivo — CERRADO.
14. Regresión integral — CERRADO, run `33974519798` SUCCESS sobre `20d8f6c51c6c1485b9e6e64fe3f5805239b66083`.
15. Deploy Preview — CERRADO con limitación documentada de smoke autenticado por SSO de Netlify non-production.
16. Cierre formal — EN PROCESO en este commit; el workflow `PM10 Punto 16 cierre final` revalida el HEAD exacto que contiene esta evidencia antes de cerrar la PR sin merge.

## 4. Regresión final previa a esta evidencia

Workflow: `PM10 Punto 16 cierre final`  
Run candidato: `33974924881` — **SUCCESS**  
SHA probado: `34b7a0aecff68a96a8f0c8ff64294194acb70a09`

Pasaron:

- `node --check fuente.js`.
- Contratos PM10 P04–P13.
- PM05 frontend.
- PM07 frontend.
- PM08 frontend + migration contract + replay scope.
- Todos los contratos PM09 disponibles.
- Presencia de evidencias P04–P15.
- Verificación de `main` exacta e intacta.
- Verificación de **0 migraciones nuevas PM10** en `supabase/migrations`.

Huella del artefacto funcional en el candidato:

- `fuente.js` SHA-256: `8dbd5f9be4c172eaa5b28ce84a668414edcd2ec8c9941a2d748c466aa4bbd48c`
- bytes: `5297798`

Este documento no modifica `fuente.js`; por tanto la huella funcional debe permanecer igual en el HEAD final.

## 5. QA / limpieza

Consulta de cierre realizada únicamente en Supabase QA `qjqorixtkilwsndqayyx` y solo de lectura. Resultado de artefactos temporales con prefijo PM10:

- `stock_operaciones`: 0
- `movimientos_stock`: 0
- `devoluciones_venta`: 0
- `caja_operaciones`: 0
- `almacen_kv` con clave PM10: 0

No se aplicaron migraciones PM10 ni escrituras persistentes PM10 en QA durante el cierre.

## 6. Deploy Preview

PR #25 generó Deploy Preview de Netlify correctamente. El build de P15 quedó `ready/success`. Tras cualquier commit documental de cierre Netlify vuelve a generar el mismo preview contra el HEAD actualizado.

Limitación aceptada/documentada: el proyecto exige SSO para entornos **non-production**. El smoke autenticado interactivo no se forzó y no se desactivó la protección. No se declara como ejecutado lo que no pudo ejecutarse.

## 7. Seguridad y producción

- `main` no modificada.
- PR #25 creada solo para Deploy Preview.
- **No merge autorizado ni realizado.**
- Netlify producción no modificada.
- Supabase producción no modificado.
- No se tocaron usuarios ni datos reales.
- No se copiaron migraciones QA a producción.

## 8. Riesgos/limitaciones residuales que NO invalidan el cierre PM10

1. Los cinco dominios PM10 siguen apoyándose mayoritariamente en persistencia genérica `almacen_kv`; PM10 endurece las fronteras de dominio y la ruta autorizada de persistencia, pero no convierte esa arquitectura en una transacción ACID multientidad.
2. El smoke visual autenticado del Deploy Preview está bloqueado por SSO non-production; la protección se mantiene.
3. Datos legados ambiguos se detectan y señalan, pero no se reparan automáticamente ni se alteran históricos reales.
4. El ciclo completo de Encargos (entrega/anticipo/cobro/devolución E2E) permanece fuera de este paquete y continúa en el paquete previsto del Plan Maestro.
5. Los workflows heredados que dependan de mecanismos históricos de reconstrucción del bundle conservan la deuda técnica ya documentada; el cierre PM10 se apoya en el artefacto Git exacto, sintaxis y contratos reproducibles, no en una afirmación falsa de reconstrucción source→bundle.

## 9. Criterio de salida PM10

Para el alcance PM10, **LA-011, LA-012, LA-013, LA-017 y LA-018 quedan cerrados con evidencia reproducible**, sin regresiones detectadas en los contratos heredados ejecutados. El paquete puede cerrarse formalmente una vez que el workflow P16 pase sobre el HEAD exacto que contiene este documento y la PR #25 sea cerrada **sin merge**.

## 10. Continuidad

Siguiente paquete: **G1 — Núcleo seguro**. G1 no se considera aprobado por el mero cierre de PM10. Debe ejecutarse como gate independiente, verificando de nuevo el criterio del Plan Maestro: ausencia de críticos/altos abiertos dentro de su alcance, permisos, cifras, concurrencia y evidencia por build, además de los hallazgos/controles que el Plan asigne expresamente a G1.
