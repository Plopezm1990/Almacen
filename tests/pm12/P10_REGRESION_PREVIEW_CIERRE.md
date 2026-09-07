# PM12–P10 · Regresión integral, Deploy Preview, smoke y cierre

Estado: **EN IMPLEMENTACIÓN**.

## Objetivo

Cerrar PM12 con evidencia acumulada de P02–P09, validar de nuevo el backend P08 en una pila Supabase desechable, comprobar la barrera de Deploy Preview y obtener un Deploy Preview real sin modificar `main` ni producción.

## Criterios

1. `main` debe seguir congelado en el checkpoint acordado.
2. No se permiten cambios nuevos en `supabase/` dentro de P10.
3. Deben pasar todos los contratos frontend PM12 P02–P09 aplicables.
4. P08 debe volver a pasar PostgreSQL y Supabase local completo con Auth, JWT, PostgREST y RLS.
5. El smoke de Preview debe demostrar que:
   - un host `deploy-preview-*` activa el modo QA;
   - cualquier salida inesperada a Supabase productivo queda bloqueada;
   - las Edge Functions conocidas se redirigen a QA;
   - el dominio productivo no activa QA ni recibe el reset de Preview;
   - todos los assets PM12 referenciados desde `index.html` existen.
6. El Deploy Preview real se obtendrá mediante un PR **draft / NO MERGE** contra `main`.
7. No se relajará SSO de entornos no productivos.
8. No se ejecutará smoke mutante en producción.
9. PM12 solo se declarará cerrado con gate GitHub SUCCESS y Deploy Preview Netlify en estado listo/esperado.

## Producción

P10 no contiene despliegues de base de datos ni escrituras de negocio en producción. P08 productivo ya quedó cerrado en el paquete anterior.
