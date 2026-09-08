# PM13–P07 · IA / nóminas asistidas y revisión humana

Base vinculante: P06 cerrado en `b66853f7af29d6781dc7728ac9e43da63f24104e`.

Commit funcional P07: `fe017ebb4048d8d62ef4b4dfeab9f1068ec2946f`.

## Riesgo encontrado

La Edge Function `importar-nomina` devolvía datos que se volcaban al mismo formulario manual. El guardado llamaba directamente a `addNomina(form)`, sin conservar procedencia IA ni una confirmación humana verificable. Además, `addNomina` sustituía silenciosamente el registro del mismo empleado/mes y `deleteNomina` borraba físicamente.

## Contrato P07

1. La IA solo prepara una propuesta de lectura; no emite ni valida una nómina oficial.
2. Toda propuesta IA exige confirmación humana explícita antes de persistirse.
3. El motor rechaza por defensa en profundidad cualquier entrada IA sin `revisionHumanaConfirmada=true`.
4. Las entradas IA confirmadas quedan diferenciadas con `origen=IA` y `estado=APROBADA_HUMANO`.
5. Las entradas manuales quedan `origen=MANUAL` y `estado=REGISTRADA_MANUAL`.
6. Una entrada IA ya aprobada es inmutable. Una corrección exige anulación y nuevo registro.
7. Nunca se sustituye silenciosamente una nómina activa del mismo empleado y mes.
8. La anulación preserva el registro, fecha y auditoría; no hay borrado físico de nóminas registradas.
9. Las anuladas no computan en coste mensual ni ratios de personal.
10. Doble clic/replay inmediato no duplica el alta ni la auditoría.
11. Se conservan aislamiento por local y validaciones de mes, bruto y Seguridad Social.
12. P01–P06, PM10 Personal y PM12 P02–P10 forman parte del gate acumulativo.
13. P07 no añade migraciones ni modifica Supabase/producción.

## Evidencia previa al checkpoint

- El job funcional de la ejecución `34166613599` pasó parche, sintaxis, contrato P07, regresión P01–P06/PM10, regresión PM12 y barreras de dominio.
- Ese job creó el commit funcional `fe017ebb4048d8d62ef4b4dfeab9f1068ec2946f`.
- El `gate-final` de esa misma ejecución no es evidencia de cierre porque GitHub Actions hizo checkout del SHA disparador anterior (`a51c20197f362c1d726ff7c5d7c2c5b85b76401d`) y no del commit que acababa de empujar el job anterior.
- `main` fue verificado de nuevo congelado en `7f792925d6a3d27334ee0e7335ba635b4ed79b6b`.
- Comparación P06→P07: no existen cambios bajo `supabase/`; P07 se limita a `fuente.js`, pruebas, documentación y workflows.

P07 solo se considera cerrado si el workflow disparado por este checkpoint termina `SUCCESS` sobre su HEAD exacto y registra `Fuente ya coincide con P07`, sin crear otro commit funcional intermedio.
