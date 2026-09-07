# PM13–P02 — Turnos

Estado del checkpoint: candidato de cierre final.

## Base y alcance

- Rama: `pm13-p02-turnos`.
- Base cerrada P01: `4a178637d48aed85a6b8d00bcddb6d5659a06605`.
- `main` permanece congelado en `7f792925d6a3d27334ee0e7335ba635b4ed79b6b`.
- P02 no modifica `supabase/` ni realiza despliegues/escrituras en producción.

## Correcciones cerradas

1. Solo se pueden crear/copiar/editar turnos para empleados activos y dentro del local activo.
2. Fecha estricta `YYYY-MM-DD` con validación de calendario real.
3. Horas estrictas `HH:MM`; se rechaza una sola hora vacía y un tramo de duración cero.
4. Se conservan turnos sin tramo horario cuando ambas horas están vacías (por ejemplo, `Libre`).
5. Se permiten turnos nocturnos que cruzan medianoche.
6. Se rechazan solapamientos del mismo empleado, también entre días cuando un turno nocturno invade el día siguiente.
7. La edición falla cerrada si intenta usar un empleado inactivo, otro local, datos inválidos o un horario solapado.
8. El borrado solo actúa sobre turnos del local activo.
9. `Copiar semana` es idempotente: reintentar no duplica; tampoco copia empleados ya dados de baja ni crea solapamientos con el destino.
10. La UI no cierra el formulario cuando `addTurno` rechaza la operación y muestra error.
11. El mensaje de copia distingue correctamente que no existen turnos nuevos por copiar.

## Evidencia automática

Contrato específico:

- `tests/pm13/p02-turnos-contract.mjs`

Regresiones incluidas en el gate:

- PM13–P01 frontend/backend.
- PM10–P07 Personal.
- PM12 frontend P02–P10.
- Sintaxis de `fuente.js`.
- `main` congelado.
- Cero cambios Supabase desde el cierre P01.
- Cero secretos de backend introducidos por P02.

Gate verde previo a la integración final del bundle:

- Actions `34160106313`: `validar-p02=success`, `gate-final=success`.
- Ese run integró el `fuente.js` funcional mediante `github-actions[bot]` en `53dfc39a8cb432dd1979224da3a0168f388aa590`.

El commit de este documento fuerza el gate exact-head sobre el `fuente.js` ya integrado. P02 solo se considera formalmente cerrado si dicho gate termina `SUCCESS` y el paso `Commit funcional si procede` confirma que la fuente ya coincide con P02.
