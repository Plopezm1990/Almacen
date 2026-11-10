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
