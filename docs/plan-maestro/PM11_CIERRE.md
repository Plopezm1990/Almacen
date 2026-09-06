# PM11 — Cierre formal

Fecha: 2026-09-06
Rama: `pm11-personal-empleados`
Estado: **CERRADO EN RAMA DE PRUEBAS / NO MERGE**

## Resultado

PM11 P01–P10 completados y validados.

Smoke manual P10 validado en móvil con `PM11 Smoke A1`:
- acceso directo a TPV;
- local fijado a `QA Local A1`;
- menú limitado a TPV + Registro horario;
- registro horario aislado al propio empleado;
- corrección manual bloqueada para camarero;
- Entrada/Salida correctas;
- historial y exportación aislados;
- baja lógica conserva la ficha;
- sesión activa expulsada tras baja;
- nuevo acceso rechazado mientras el empleado está de baja.

Correcciones finales incorporadas:
- `pm11-mobile-layout-v3.js`;
- `pm11-access-runtime-v3.js`;
- `pm11-session-guard-v4.js`.

Regla de cierre:
- no repetir P01–P10;
- mantener PR en DRAFT / NO MERGE;
- no tocar `main` ni producción sin autorización expresa.
