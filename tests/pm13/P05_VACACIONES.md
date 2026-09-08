# PM13–P05 — Vacaciones

P05 reutiliza la misma fuente de verdad cerrada en P04: `public.empleados` + `datos.ausencias` con `tipo = Vacaciones`. No crea una tabla paralela ni una segunda persistencia.

Cierre funcional esperado:

- calcular vacaciones por año calendario sin asignar todo el rango al año de inicio;
- excluir ausencias anuladas;
- distinguir días ya disfrutados, día en curso y días programados;
- conservar un saldo honesto frente a `diasVacacionesAnuales`, incluyendo exceso visible si el total reservado supera el cupo configurado;
- no inventar arrastres, prorrateos ni reglas legales no configuradas;
- mantener la validación/persistencia, scope e idempotencia de P04;
- mantener regresiones P01–P04, PM10 Personal y PM12;
- cero cambios Supabase en P05, cero producción y `main` congelado.

Caso de contraste: una ausencia 30/12/2026–02/01/2027 aporta 2 días a 2026 y 2 días a 2027. Una ausencia anulada aporta 0. A fecha 07/09/2026, un rango 07/09–09/09 se desglosa en 1 día en curso y 2 programados.
