# PM11 · Personal / Empleados · P10 — Anonimización segura + smoke de cuenta

Fecha: 2026-09-06  
Rama: `pm11-personal-empleados`  
Base P09: `6fa5eabb213a39cb06291d106dc616de0d2b5f12`  
Supabase QA: `qjqorixtkilwsndqayyx`  
Producción/main: no tocar

## Estado del punto

P10 contiene dos frentes distintos:

1. anonimización segura del empleado: **implementada y validada en QA**;
2. smoke end-to-end de creación de cuenta desde Deploy Preview con una sesión real de Propietario QA: **pendiente de sesión navegador real**.

Por tanto no se declara todavía el cierre total de PM11.10. Se deja la parte de anonimización en PASS y el smoke como única condición pendiente.

## Implementación de anonimización

Migración versionada:

- `supabase/migrations/20260906103000_pm11_anonimizacion_segura_empleado.sql`

Migración aplicada únicamente a QA:

- nombre: `pm11_anonimizacion_segura_empleado`;
- versión observada en QA: `20260906080951`.

RPC pública controlada:

- `public.pm11_anonimizar_empleado(p_empresa_id text, p_local_id text, p_empleado_id text)`.

Contrato aplicado:

- requiere usuario autenticado y Propietario autorizado en la empresa/local histórica;
- rechaza `Todos los locales`;
- bloquea el empleado `FOR UPDATE`;
- exige estado previo `inactivo`;
- un empleado `activo` no puede anonimizarse directamente;
- el estado `anonimizado` es terminal e idempotente;
- conserva `empleado_id`, empresa/local y trazabilidad técnica;
- `nombre` pasa a `NULL`;
- el JSON se reconstruye mediante whitelist de datos laborales no identificativos;
- no se conservan DNI/NIE/NIF, email, teléfono, dirección, PIN, documentos, ausencias, EPI, foto, firma, notas ni otras colecciones identificativas del JSON anterior;
- si existe perfil/cuenta vinculada, se desactivan sus membresías, se desactiva y sanea el perfil y se elimina el vínculo `perfil.empleado_id` dentro de la misma transacción;
- la auditoría registra solo identidad técnica, contexto, transición y retirada de acceso, sin reinyectar PII.

Permisos comprobados en QA:

- `authenticated`: EXECUTE = true;
- `anon`: EXECUTE = false.

## Pruebas dinámicas QA con ROLLBACK

Se ejecutaron transacciones sintéticas que terminaron siempre en `ROLLBACK`.

### Anonimización e idempotencia

Empleado temporal `PM11-P10-TEMP`, Empresa A / A1, con PII sintética y campos laborales:

- primera anonimización: PASS;
- estado final dentro de la transacción: `anonimizado`;
- nombre: `NULL`;
- `anonimizado_at`: informado;
- PII/colecciones sensibles: eliminadas;
- `puesto` y `horasSemanales`: conservados;
- `historialLaboralConservado=true`;
- auditoría de anonimización: exactamente 1;
- segundo intento: `yaAnonimizado=true` y auditoría sigue siendo 1.

### Histórico de local cerrado

Empleado inactivo sintético en `QA-A-CERRADO`:

- Propietario A pudo anonimizarlo como operación administrativa histórica;
- no se exige que un local cerrado vuelva a estar operativo para retirar PII.

### Autorización

Sobre un empleado A/A1 inactivo se comprobó:

- Owner B: rechazado;
- Encargado A2: rechazado;
- Cajero A1: rechazado.

Resultado registrado: `PM11_P10_AUTORIZACION_QA=PASS`.

### Ciclo terminal

Se comprobó:

- empleado activo → anonimización directa: rechazada;
- empleado inactivo → anonimizado: permitido;
- anonimizado → reactivación: rechazada.

Resultado registrado: `PM11_P10_CICLO_TERMINAL_QA=PASS`.

### Rama de cuenta vinculada

La lógica que retira una cuenta vinculada está implementada en la misma transacción y cubierta por contrato estático/integridad P08. No se declara una prueba dinámica positiva con una cuenta Auth desechable porque esta sesión no dispone de una identidad QA descartable/JWT de navegador y no se alteraron contraseñas ni fixtures reales para forzarla.

## Limpieza QA

Tras los rollbacks se verificó:

- empleados `PM11-P10-%`: **0**;
- auditorías `PM11-P10-%`: **0**;
- vínculos de perfil `PM11-P10-%`: **0**.

No queda residuo sintético P10.

## Frontend Personal

Parche reproducible:

- `tools/corregir_pm11_p10_anonimizacion.py`.

Cambios funcionales:

- el bloqueo provisional P06 fue sustituido por la RPC `pm11_anonimizar_empleado`;
- el botón **Anonimizar** solo se ofrece a empleados de baja y no anonimizados;
- se solicita confirmación explícita informando que la operación es irreversible y puede retirar la cuenta de acceso;
- el resultado cloud se espera de forma asíncrona y los errores se muestran sin mutación optimista falsa;
- Reactivar no se ofrece a un registro terminal anonimizado.

Commit funcional generado por el gate:

- `8f0c3ad97299381804c9cb197d16aa4ecd6f360a` — `PM11 P10: conectar anonimización segura en Personal`.

## Regresión histórica P06

El primer gate P10 `34021284164` falló únicamente porque el contrato histórico P06 exigía todavía la frase del bloqueo provisional de anonimización.

Se hizo mantenimiento no funcional del contrato P06 para aceptar las dos fases válidas de la transición:

- antes del commit frontend P10: bloqueo provisional presente;
- después de P10: RPC dedicada existente + frontend conectado.

La regresión P06 posterior `34021423676` terminó `success`.

## Gate P10

Gate final sobre HEAD ya conteniendo el commit funcional y la regresión mantenida:

- run `34021423687`: **SUCCESS**.

Pasaron:

- origen/alcance y `main` intacto;
- sintaxis de `fuente.js`;
- contrato P10;
- regresiones P09, P08, P07, P06;
- LA-017;
- regresiones P05 → P01;
- reconstrucción base + P06 + P09 + P10 y comparación byte a byte.

Checkpoint P01 paralelo `34021423677`: **SUCCESS**.

## Smoke Deploy Preview

El proyecto Netlify `chic-entremet-9107cf` tiene configurado `requireSSOTeamLogin=true` para entornos **no-production**. La sesión de herramientas actual no contiene una sesión navegador autenticada como Propietario QA ni un JWT reutilizable del usuario QA.

Por seguridad no se:

- cambió ninguna contraseña de fixture;
- fabricó un JWT;
- desactivó el SSO de Netlify;
- desplegó a producción;
- modificó la Edge Function de producción.

El smoke positivo pendiente debe hacerse con una sesión real de Propietario QA en el Deploy Preview y comprobar, como mínimo:

1. alta o selección de empleado activo QA;
2. Crear cuenta de acceso;
3. creación real Auth + perfil + membresía + vínculo;
4. acceso con la cuenta creada dentro del alcance correcto;
5. baja lógica suspende acceso;
6. reactivación vuelve a habilitar el acceso efectivo según P08;
7. baja + anonimización retira el vínculo/acceso y no deja PII en la ficha SQL.

## Producción

`main` continúa congelado en:

`7f792925d6a3d27334ee0e7335ba635b4ed79b6b`

No se aplicó P10 al proyecto Supabase de producción ni se hizo deploy de producción.

**PM11_P10_ANONIMIZACION_SEGURA=PASS**  
**PM11_P10_SMOKE_PREVIEW=PENDIENTE_SESION_QA_REAL**  
**PM11_P10_CIERRE=PARCIAL**
