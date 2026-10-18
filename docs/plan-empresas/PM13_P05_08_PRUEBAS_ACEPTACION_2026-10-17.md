# PM13 · Punto 5.8 — Matriz final de pruebas y criterios de aceptación

Fecha: 2026-10-17
Rama: `codex/fix-product-bootstrap-context-20261015`
Alcance: cierre documental del punto 5 y verificación de contratos existentes. No se han modificado aplicación, Supabase, datos, permisos ni despliegues.

## Criterio de cierre

El punto 5 solo podrá considerarse implementado cuando una decisión de permiso de cargo personalizado pase simultáneamente contexto, catálogo, límites del propietario, techo técnico, dependencias, alcance, estado, auditoría y revocación. Que la interfaz oculte un botón no es evidencia suficiente.

## Matriz de aceptación

| ID | Área | Prueba mínima | Resultado exigido | Estado actual |
|---|---|---|---|---|
| P5-A | Catálogo | Clave válida, clave desconocida y módulo inactivo | Válida solo la clave catalogada y activa; las demás se deniegan | Contrato estático cubierto; resolver común pendiente |
| P5-B | Consulta frente a acción | Cargo con `*_CONSULTAR` intenta crear/editar/exportar | Consultar no eleva ninguna acción | Cubierto por contrato de pantallas; acciones de cargo aún no conectadas |
| P5-C | Empresa/local | Misma clave desde local autorizado y otro local/empresa | Solo pasa el contexto perteneciente al actor | Contratos de aislamiento en verde; QA autenticado pendiente |
| P5-D | Propio | `PROPIO` con empleado correcto y con empleado ajeno | Se deriva desde `auth.uid()`; el ID enviado por cliente no basta | Criterio documentado; implementación futura pendiente |
| P5-E | Techo técnico | Cargo permite una capacidad por encima del rol | Denegar siempre por techo | ABC técnico existente; cargo personalizado aún no resuelve acciones |
| P5-F | Propietario | Intento de asignar cargo reservado, cambiar propietario o dejarlo sin protección | Rechazar sin alterar membresía ni perfil | Contratos PM13 P12 y P13 en verde |
| P5-G | Dependencias | Revocar consulta mientras existe una acción dependiente | Acción dependiente queda denegada | Política documentada; prueba de servidor futura |
| P5-H | Estado | Acción en estado no modificable o ya completada | Rechazar sin borrar histórico | Contratos de cargos y flujos previos; matriz completa pendiente |
| P5-I | Auditoría | Concesión, revocación, conflicto y rechazo | Actor, contexto, antes/después, motivo, versión y operación trazables | Auditoría existente en piezas ABC/PM13; explicación unificada pendiente |
| P5-J | Revocación | Revocar con sesión abierta y recargar/cambiar local | Siguiente mutación denegada; no confiar en caché | Criterio documentado; QA visual pendiente |
| P5-K | Concurrencia | Dos cambios con la misma versión/`operation_id` | Uno gana; el otro devuelve conflicto o resultado idempotente | Operaciones ABC existentes; resolver de cargos pendiente |
| P5-L | Interfaz | Pantalla muestra origen, alcance y motivo sin datos ajenos | Explicación clara y sin enumeración cross-tenant | UI de pantallas cubierta; explicación de acciones pendiente |

## Contratos automatizados ejecutados

Se ejecutaron en local, sin conexión a QA/producción ni mutación de datos, los contratos PM13 del catálogo de cargos y pantallas:

| Archivo | Resultado |
|---|---|
| `p08-cargos-permisos-ui-contract.mjs` | PASS |
| `p09-cargos-crud-contract.mjs` | PASS |
| `p10-cargo-asignaciones-contract.mjs` | PASS |
| `p11-cargo-estado-contract.mjs` | PASS |
| `p12-cargo-propietario-contract.mjs` | PASS |
| `p13-cargos-aislamiento-contract.mjs` | PASS; informa pendiente la separación efectiva de permisos por empresa hasta completar los puntos 4 y 5 |
| `p14-pantallas-inventario-contract.mjs` | PASS; 45 claves estables |
| `p15-pantallas-capacidades-contract.mjs` | PASS; consulta separada de navegación/etiquetas |
| `p16-editor-pantallas-contract.mjs` | PASS |
| `p17-cargo-pantallas-persist-contract.mjs` | PASS |

Estos PASS validan contratos estáticos de código, SQL preparado y UI. No demuestran que las migraciones estén aplicadas en QA/producción ni sustituyen una prueba autenticada con dos empresas/locales.

## Pruebas que quedan para la fase de implementación/QA

1. Aplicar el resolver común de acciones para cargos personalizados en una migración revisada y con preflight.
2. Ejecutar contratos SQL con `ROLLBACK` en una base de QA autorizada.
3. Probar dos empresas, dos locales, membresía inactiva, cargo desactivado y clave desconocida.
4. Probar revocación con dos sesiones y recarga del navegador.
5. Probar concurrencia, repetición de `operation_id` y conflicto de versión.
6. Verificar en la interfaz el origen, alcance y motivo sin exponer datos de otro tenant.
7. Repetir QA visual antes de considerar cualquier despliegue de producción.

## Evidencia y reglas de salida

- No se acepta “funciona en la pantalla” como única evidencia.
- Cada caso debe conservar resultado, hora, commit, entorno y operación correlacionada.
- Un fallo de aislamiento, techo, revocación o auditoría bloquea el cierre del punto.
- No se permite debilitar tests, permisos, RLS ni gates para convertir un fallo en PASS.
- La producción queda fuera hasta que QA tenga todos los casos en verde y una revisión explícita.

## Estado del subpunto y del punto 5

**5.8 — matriz final y criterios de aceptación completados; contratos estáticos P08–P17 ejecutados en verde, con la observación pendiente de P13.**

Con esto queda **cerrada la fase documental del punto 5**. El punto 5 **no queda declarado implementado**: siguen pendientes el resolver de acciones para cargos personalizados y las pruebas SQL/QA autenticadas indicadas arriba. No se han cambiado permisos, tablas, RPC, datos, QA, producción ni despliegues.

Siguiente paso del plan general, solo con autorización: **revisar el resumen de cierre del punto 5 y decidir si se autoriza la implementación del resolver en QA**.
