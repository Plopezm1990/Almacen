# P2-SEC — Endurecimiento transversal de Edge Functions

## Base exacta

- release: `e8de01fbdad63bd7fbe57982e3ae978e06d1ca52`.
- Este candidato no modifica `fuente.js`, ninguna migración SQL ni Supabase remoto.
- No despliega Edge Functions. El despliegue en QA requiere autorización separada.
- No modifica `main` ni PR #38.

## Hallazgos cerrados por diseño

### crear-cuenta-empleado

La variante productiva histórica elevaba a `service_role` después de comprobar únicamente un rol global. El candidato toma la empresa/local exclusivamente de la fila `empleados` obtenida por el servidor y exige una membresía activa `Propietario` que cubra exactamente esa empresa/local antes de crear Auth.

La finalización permanece delegada en `pm11_finalizar_creacion_cuenta_empleado`; si falla, se compensa eliminando o bloqueando la cuenta Auth recién creada.

### enviar-notificacion

El candidato elimina el modelo global por rol. La empresa/local se resuelve en servidor:

- si llega `localId`, el servidor obtiene su `empresa_id` de `locales`;
- un `empresaId` contradictorio falla cerrado;
- si no hay local ni empresa, un usuario solo puede inferir empresa cuando tiene exactamente una empresa activa;
- las llamadas internas por secreto deben aportar un tenant inequívoco.

Los destinatarios requieren `user_id`, perfil activo y una membresía activa en la misma empresa. Para avisos de local, la membresía debe cubrir ese local. Las suscripciones legacy sin `user_id` ya no reciben avisos.

### prefiltro-candidato

El token público conserva su naturaleza pública, pero el servidor lee `empresa_id/local_id` de la propia fila del token y los transmite al aviso interno. La URL de la función interna se deriva de `SUPABASE_URL`; no hay project ref productivo hardcodeado.

## verify_jwt

`edge-security-manifest.json` fija el contrato:

- `crear-cuenta-empleado`: `verify_jwt=true`.
- `enviar-notificacion`: `verify_jwt=false` porque acepta dos credenciales excluyentes: JWT validado en cuerpo de función o secreto interno servidor-servidor.
- `prefiltro-candidato`: `verify_jwt=false` porque es un endpoint público por token opaco, con rate limit HMAC y acceso a fila exacta.

## Pruebas

El gate específico comprueba:

- exact-head sobre esta base;
- alcance exacto de nueve archivos;
- ausencia de cambios en `fuente.js` y `supabase/migrations/`;
- propietario de otra empresa rechazado;
- usuario sin membresía rechazado;
- local ajeno rechazado;
- rol fuera del permitido rechazado;
- suscripciones sin identidad rechazadas;
- destinatarios de otro tenant rechazados;
- wiring tenant-aware de las tres Edge Functions;
- regresiones R03A/R03B/R03C/PM11/PM13/P06.

Al abrir PR contra `release`, también debe ejecutarse la puerta general `gate-final` de 133 contratos activos.

## Fronteras de autorización

Este candidato GitHub no autoriza despliegue Edge en QA/PROD, DDL, merge a release ni cambio de Netlify PROD. Cada transición posterior necesita autorización separada.
