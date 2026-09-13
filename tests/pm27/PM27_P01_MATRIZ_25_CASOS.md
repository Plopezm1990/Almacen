# PM27–P01 — Matriz de reauditoría de 25 casos

Fecha de corte: 2026-09-13
Repositorio: `Plopezm1990/Almacen`
Candidato congelado bajo auditoría: `8256628d922fe0a8dbf18ca792f8b19e89f6d9ad`
Rama de evidencia de auditoría: `claude/pm27-auditoria-25-casos`

## Reglas de ejecución

1. Los 25 casos auditan exactamente el SHA congelado anterior. La rama de auditoría puede añadir exclusivamente evidencia, contratos de auditoría y documentación; no altera el candidato.
2. `main`, `release`, PR #38, Netlify, Supabase producción y usuarios/datos reales quedan fuera de escritura salvo autorización nueva y específica.
3. Las pruebas destructivas o de escritura deben ejecutarse solo en memoria, fixtures, PostgreSQL local o transacciones con `ROLLBACK`. No se inventan UUID, empresas, locales, membresías ni permisos reales.
4. Un PASS histórico no sustituye una reauditoría. La evidencia previa sirve como ancla, pero cada caso PM27 exige evidencia actual sobre el SHA congelado o sobre el estado externo actual cuando el caso sea de solo lectura.
5. Si aparece un defecto funcional real, el candidato deja de ser apto para cierre: se registra FAIL, se prepara corrección en otra rama/SHA y se repite el gate completo. Nunca se modifica el contrato para esconder un defecto.
6. Los bloqueos de capacidad o entorno se clasifican como `BLOCKED_EXTERNAL`, no como PASS ni como fallo de código.
7. Criterio de cierre PM27: 25/25 casos con resultado explícito (`PASS`, `FAIL` o `BLOCKED_EXTERNAL` justificado), cero FAIL abiertos y revisión final de integridad del SHA.

## Matriz

| Caso | Área / riesgo | Prueba positiva obligatoria | Prueba negativa obligatoria | Evidencia mínima | Estado inicial |
|---|---|---|---|---|---|
| C01 | Integridad del candidato | Confirmar HEAD exacto `8256628d...`, árbol estable y gate remoto SUCCESS asociado al mismo SHA | Detectar cualquier deriva de HEAD, commit posterior o gate de otro SHA | refs GitHub, workflow run, comparación de commits | PENDIENTE |
| C02 | Alcance PM27 y no arrastre | Verificar que desde `f297be...` solo cambian los 5 archivos previstos de PM27 | Fallar si aparece cualquier archivo funcional, migración o secreto adicional | `compare_commits` + lista exacta de archivos | PENDIENTE |
| C03 | Reproducibilidad de fuente/build | Reconstruir la fuente canónica y comprobar sintaxis/anclas/hash esperados | Mutación controlada de ancla o sintaxis debe ser detectada | contratos PM26 P03 + build local aislado | PENDIENTE |
| C04 | Secretos e identificadores | Escaneo real del árbol sin secretos nuevos ni identificadores QA copiados | Fixture con secreto/identificador debe provocar fallo sin imprimir el valor | contrato P02 + control negativo | PENDIENTE |
| C05 | Dependencias y supply chain | `npm ci` reproducible con lockfile y acciones críticas fijadas por SHA/versiones previstas | Registrar vulnerabilidades de `npm audit`; no aceptar HIGH sin clasificación y decisión | salida npm, lockfile, acciones workflow | PENDIENTE |
| C06 | Frontera QA / producción del cliente | Loader universal funciona sin depender del reset de preview; `reset-pruebas-preview.js` queda QA-only | Reintroducir guard/enganche que rompa producción debe detectarse | P04b + inspección de `index.html`/loader/reset | PENDIENTE |
| C07 | Configuración de endpoints | Confirmar que el cliente obtiene endpoint/configuración del entorno correcto | Detectar endpoint de producción hardcodeado en ruta que deba ser configurable | P07a/P07b + búsqueda estructural | PENDIENTE |
| C08 | Auth/JWT en Edge Functions | Rutas privadas llevan JWT y preservan cabecera válida existente | Sin sesión no se envía petición; ruta pública no debe ser interceptada | P09c + pruebas in-memory | PENDIENTE |
| C09 | Autorización backend por empresa/local | Usuario autorizado opera solo en su empresa/local | Empresa ajena, local ajeno y llamada sin sesión quedan bloqueados | P09f-A o ensayo equivalente con ROLLBACK | PENDIENTE |
| C10 | RLS multiempresa | Lectura/escritura de una empresa no cruza a otra | Identidad A no puede leer/escribir B | catálogo/políticas RLS + pruebas negativas aisladas | PENDIENTE |
| C11 | Aislamiento multilocal | Usuario con acceso a A1 opera A1 dentro de su empresa | No puede operar A2 sin autorización aunque pertenezca a la misma empresa | RLS/helpers + pruebas negativas aisladas | PENDIENTE |
| C12 | Roles y privilegios | Rol autorizado ejecuta cada operación objetivo | Rol no autorizado y `anon`/sin sesión son rechazados | funciones/RPC/GRANT/RLS + matriz negativa | PENDIENTE |
| C13 | SECURITY DEFINER y helpers privados | Todas las funciones mutadoras críticas validan autorización directa o delegada a helper fiable | Detectar función SECURITY DEFINER mutadora sin control efectivo de identidad/contexto | inventario funciones + cuerpo/helpers + grants | PENDIENTE |
| C14 | Defecto L — caché/contexto | Prefiltro añade `empresa_id/local_id` solo cuando el contexto es inequívoco y conserva IDs existentes | Cache corrupta, múltiples locales o local desconocido deben fallar cerrado/sin inventar contexto | `defecto-l-context-hotfix.test.mjs` | PENDIENTE |
| C15 | Defecto L — RLS real | Backend de `prefiltros_candidatos` exige empresa/local válidos y RLS sigue siendo autoridad | Contexto ajeno o incompleto no debe quedar autorizado por el cliente | lectura catálogo/policies + negativo seguro | PENDIENTE |
| C16 | Defecto L — E2E post-hotfix | Crear un candidato controlado desde interfaz y comprobar guardado correcto | Probar contexto inválido controlado sin afectar datos reales, o documentar imposibilidad segura | evidencia UI/backend del mismo flujo | PENDIENTE |
| C17 | Caja y arqueos | Movimiento/reversión y arqueo/anulación funcionan con replay idempotente | operation_id en conflicto, otro local, rol no autorizado y sin sesión fallan | P09f-B1 o reproducción con ROLLBACK | PENDIENTE |
| C18 | Stock y ventas | Venta/reversión actualiza stock una sola vez; replay no duplica | Cantidad inválida, stock insuficiente, contexto/rol ajeno y replay conflictivo fallan | P09f-B2 / motor real idempotente | PENDIENTE |
| C19 | Traspasos | Traslado interno y entre locales conserva identidad, cantidades y stock de origen/destino | Local ajeno, producto/identidad incompatible o replay conflictivo se rechaza | contratos históricos de traspasos + ensayo aislado | PENDIENTE |
| C20 | Inventarios/conteos | Estados, cantidades 0 válidas, cobertura y cierre completo/parcial cumplen PM12 | Vacíos, negativos, texto, indivisibles inválidos y cierre sin requisitos se rechazan | contratos PM12/regresión existente sobre candidato | PENDIENTE |
| C21 | Encargos, anticipos y clientes | Flujo conserva cliente, encargo, anticipo/pago y contexto empresa/local | Cruce empresa/local, importe inválido o referencia inexistente se rechaza | código/migraciones PM14 + pruebas aisladas | PENDIENTE |
| C22 | Pagos/devoluciones — ledger global | `pagos_encargo` reclama operation_id en el ledger global y replay legítimo es estable | Colisión del mismo operation_id con otro ledger/operación debe bloquearse | migración P09f-B3 + contrato `p09f-contract.mjs` | PENDIENTE |
| C23 | Concurrencia, replay y atomicidad | Doble clic/reintento/concurrencia producen un solo efecto completo | Dos operaciones incompatibles simultáneas no deben duplicar ni dejar efectos parciales | pruebas P08/P12 + locks/transacciones | PENDIENTE |
| C24 | Migraciones, preflight y rollback | Migraciones candidatas validan dependencias, locks/timeouts y postchecks; rollback/restauración es conservador | Reaplicación/estado inesperado/colisión histórica debe abortar antes de daño | preflights P06/P08/P09f + PostgreSQL local | PENDIENTE |
| C25 | Despliegue/operación y bloqueos externos | Verificar en solo lectura ramas, PR, artefactos Netlify, headers, ausencia de escrituras remotas y estado de bloqueos | No declarar PASS técnico para Aviso G o PM25-P02 si siguen bloqueados; no confundir warning de entorno con defecto | GitHub + Netlify/Supabase solo lectura + cierre PM26 | PENDIENTE |

## Orden de ejecución

Se ejecutarán en cinco bloques, sin saltar un FAIL:

- Bloque A — integridad y cadena de suministro: C01–C05.
- Bloque B — cliente, auth y autorización: C06–C16.
- Bloque C — transacciones funcionales: C17–C23.
- Bloque D — migraciones y recuperación: C24.
- Bloque E — despliegue, entornos y cierre: C25.

## Reglas especiales heredadas de PM26

- El hotfix técnico del Defecto L tiene gate verde, pero el E2E real post-hotfix no se hereda como PASS: C16 debe demostrarlo o quedar explícitamente pendiente/bloqueado.
- Aviso G (protección de contraseñas filtradas) sigue sujeto a capacidad del plan de Supabase; si la capacidad no cambió, su clasificación correcta es `BLOCKED_EXTERNAL`.
- PM25-P02 necesita un entorno aislado real adicional para Auth/JWT/PostgREST/RLS E2E; si sigue sin existir, se clasifica `BLOCKED_EXTERNAL`.
- PR #38 permanece evidencia histórica: abierta/draft/no merge salvo autorización separada.
- La vulnerabilidad HIGH observada por `npm audit` no bloqueó el gate de candidato, pero C05 debe identificar paquete, ruta de dependencia, explotabilidad y remediación/aceptación antes del cierre PM27.

## Criterio de resultado por caso

- `PASS`: positiva y negativa ejecutadas con evidencia suficiente y sin defecto abierto.
- `FAIL`: defecto reproducible del candidato o de una superficie que PM27 pretende certificar.
- `BLOCKED_EXTERNAL`: no ejecutable por capacidad/entorno/permiso externo, con causa demostrada y sin fingir validación.
- `PENDIENTE`: todavía no ejecutado.

Marcador de este paquete:

`PM27_P01_MATRIZ_25_CASOS=FIJADA`
