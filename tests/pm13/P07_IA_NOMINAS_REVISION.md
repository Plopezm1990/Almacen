# PM13–P07 · IA / nóminas asistidas y revisión humana

Base vinculante: P06 cerrado en `b66853f7af29d6781dc7728ac9e43da63f24104e`.

## Riesgo encontrado

La Edge Function `importar-nomina` devolvía datos que se volcaban al mismo formulario manual. El guardado llamaba directamente a `addNomina(form)`, sin conservar procedencia IA ni una confirmación humana verificable. Además, `addNomina` sustituía silenciosamente el registro del mismo empleado/mes y `deleteNomina` borraba físicamente.

## Contrato P07

1. La IA solo prepara una propuesta de lectura; no emite ni valida una nómina oficial.
2. Toda propuesta IA debe exigir confirmación humana explícita antes de persistirse.
3. El motor rechaza por defensa en profundidad cualquier entrada IA sin `revisionHumanaConfirmada=true`.
4. Las entradas IA confirmadas quedan diferenciadas con `origen=IA` y `estado=APROBADA_HUMANO`.
5. Las entradas manuales quedan `origen=MANUAL` y `estado=REGISTRADA_MANUAL`.
6. Una entrada IA ya aprobada es inmutable. Una corrección exige anulación y nuevo registro.
7. Nunca se sustituye silenciosamente una nómina activa del mismo empleado y mes.
8. La anulación preserva el registro, fecha y auditoría; no hay borrado físico de nóminas registradas.
9. Las anuladas no computan en coste mensual ni ratios de personal.
10. Doble clic/replay inmediato no duplica el alta ni la auditoría.
11. Se conservan aislamiento por local y validaciones de mes, bruto y Seguridad Social.
12. P01–P06, PM10 Personal y PM12 P02–P10 deben continuar en verde.
13. P07 no añade migraciones ni modifica Supabase/producción.

P07 no se considera cerrado hasta que un gate remoto posterior al commit funcional termine `SUCCESS` sobre el HEAD exacto y confirme que `fuente.js` ya coincide con el endurecimiento P07.
