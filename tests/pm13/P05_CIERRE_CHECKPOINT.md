# PM13–P05 — Checkpoint final de vacaciones

Checkpoint sobre la implementación funcional ya integrada en `fuente.js`.

Evidencia previa al gate exacto:

- `main` sigue congelado en `7f792925d6a3d27334ee0e7335ba635b4ed79b6b`.
- P05 no añade ni modifica migraciones Supabase; reutiliza la persistencia de ausencias cerrada en P04.
- QA conserva su estado previo y no dejó residuos de vacaciones P05.
- Producción no contiene migraciones PM13/P05.
- Cruce anual, anulaciones, separación disfrutadas/en curso/programadas, saldo, exceso y fechas UTC se validan mediante contrato automático.
- Regresiones PM13 P01–P04, PM10 Personal y PM12 P02–P10 pasan antes del checkpoint.

Este commit es el candidato de cierre. P05 solo se considera cerrado si el workflow `PM13 P05 vacaciones` termina en `SUCCESS` sobre este SHA y `fuente.js` no vuelve a cambiar.
