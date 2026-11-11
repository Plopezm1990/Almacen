# M-06 — Purga y plazo de conservación

Fecha de revisión: 2026-11-10

## Estado

M-06 está técnicamente diagnosticado, pero no puede cerrarse como remediación sin una decisión aprobada sobre plazos de conservación, excepciones, anonimización y autoridad para ejecutar la purga. No se inventa un plazo legal ni se borra información viva para fabricar una prueba.

## Evidencia medida

La última medición registrada en QA y producción confirma:

- no existe `pg_cron`, `pg_net` ni `pgmq`;
- no existen `cron.job` ni `cron.job_run_details`;
- QA conserva histórico en auditoría, errores, empleados y fichajes;
- producción conserva al menos una baja sin anonimizar;
- `private.plataforma_ajustes.dias_gracia_borrado=30` es la gracia del borrado manual de una empresa, no una política de conservación por tabla;
- los códigos con `expira_en` dejan de ser reutilizables, pero no existe una tarea que purgue sus filas.

## Evidencia probada por código/desplegado

`private.plataforma_plan_purga()` construye un plan relacionado con operaciones explícitas de exportación, resumen y borrado de una empresa; no ejecuta una purga temporal. No contiene la política ni el mecanismo programado necesarios para auditar conservación de auditoría, errores, fichajes, empleados, nóminas y datos de candidatos.

QA dispone además de `public.pm11_anonimizar_empleado(...)`, pero es una operación individual a demanda; su presencia no equivale a una política periódica. Producción no tiene esa función. Las definiciones de `plataforma_plan_purga()` también divergen entre entornos, por lo que no se traslada una conclusión de uno al otro por analogía.

## Decisión pendiente

Antes de versionar una migración o una tarea programada deben aprobarse, por tabla y finalidad:

- plazo de conservación;
- excepciones por obligación fiscal, laboral, auditoría o litigio;
- anonimización frente a borrado;
- alcance de los datos derivados y de los registros técnicos;
- rol autorizado y mecanismo de revisión;
- ventana y estrategia de ejecución segura en QA.

## Límites

- No se creó `pg_cron`.
- No se creó ninguna tarea de purga.
- No se borró ni anonimizó ningún dato.
- No se escribió en producción.
- M-06 queda abierto hasta recibir una política aprobada y poder convertirla en migración/contrato verificable.

## Inventario de retención actualizado — 2026-11-10

Se repitió la medición en solo lectura sobre QA y producción. Las filas son
conteos actuales; las fechas son límites observados, no plazos recomendados:

| Tabla | QA: filas / rango temporal observado | Producción: filas / rango temporal observado |
|---|---:|---:|
| `auditoria_registro` | 1.016 / 2026-09-04 a 2026-11-10 | 19 / 2026-10-12 a 2026-11-07 |
| `errores_sistema` | 830 / 2026-10-01 a 2026-11-04 | 1 / 2026-10-20 |
| `fichajes_registro` | 10 / 2026-09-06 a 2026-10-29 | 0 |
| `movimientos_registro` | 904 / 2026-09-04 a 2026-10-28 | 5 / 2026-10-11 a 2026-10-21 |
| `caja_operaciones` | 64 / 2026-10-03 a 2026-11-08 | 9 / 2026-10-29 a 2026-10-30 |
| `prefiltros_candidatos` | 0 | 0 |

La comprobación de mecanismos devuelve en ambos entornos: `pg_cron` ausente,
`pg_net` ausente, `pgmq` ausente, `cron.job` inexistente y
`cron.job_run_details` inexistente. QA sí tiene
`public.pm11_anonimizar_empleado(...)`; producción no. Esta última diferencia
es de inventario, no autorización para ejecutarla ni evidencia de que una
anonimización periódica exista.

La medición es **medida** sobre catálogos y filas reales. No convierte la edad
de una fila en una infracción ni permite inferir un plazo legal. M-06 sigue
abierto hasta que se aprueben los plazos y excepciones por finalidad, se elija
anonimización o borrado y se versionen una tarea y sus contratos.

## Revalidación de mecanismos y volumen — 2026-11-11

La lectura de solo lectura se repitió en ambos proyectos. El resultado actual
es:

| Tabla / mecanismo | QA | Producción |
|---|---:|---:|
| `auditoria_registro` | 1.016 filas; 2026-09-04 a 2026-11-10 | 19; 2026-10-12 a 2026-11-07 |
| `errores_sistema` | 830; 2026-10-01 a 2026-11-04 | 1; 2026-10-20 |
| `fichajes_registro` | 10; 2026-09-06 a 2026-10-29 | 0 |
| `movimientos_registro` | 904; 2026-09-04 a 2026-10-28 | 5; 2026-10-11 a 2026-10-21 |
| `caja_operaciones` | 65; 2026-10-03 a 2026-11-10 | 9; 2026-10-29 a 2026-10-30 |
| `pg_cron`, `pg_net`, `pgmq` | ausentes | ausentes |
| `cron.job`, `cron.job_run_details` | ausentes | ausentes |

La diferencia de una operación adicional de caja en QA frente al corte
anterior se limita a una lectura de estado; no se generó desde esta auditoría.
Este corte sigue siendo **medido** y no fija plazos legales ni autoriza purgas.
M-06 continúa abierto a la espera de la decisión aprobada y del mecanismo de
ejecución correspondiente.
