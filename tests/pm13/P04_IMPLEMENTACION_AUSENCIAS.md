# PM13–P04 — Ausencias

Implementación candidata en rama aislada.

- Reutiliza `public.empleados` y `datos.ausencias` como fuente existente.
- Valida empleado activo, empresa/local, tipo y rango de fechas.
- Bloquea solapamientos de ausencias activas.
- Alta remota idempotente y serializada por bloqueo de fila.
- Anulación lógica y trazable; no hay borrado físico del historial.
- Las ausencias anuladas no computan en el contador de vacaciones existente; la política de vacaciones sigue reservada para P05.
- QA únicamente. Producción y `main` quedan fuera de alcance.

Este documento no cierra P04: el cierre exige regresiones y gate remoto final en SUCCESS.
