# PM11 · Personal / Empleados · P08 — Vínculo Cuenta ↔ Perfil ↔ Membresía ↔ Empleado

Fecha: 2026-09-06  
Rama: `pm11-personal-empleados`  
Base P07 cerrada: `2c2f66617ad9bd24324babcd9c2601ce1c870ab5`  
Supabase QA: `qjqorixtkilwsndqayyx`  
Producción/main: **no tocar**

## 1. Objetivo

Cerrar el hueco congelado en P03/P07 para que `perfiles.empleado_id` deje de ser una referencia libre y el vínculo de una cuenta de acceso con una ficha laboral sea inequívoco, auditable y seguro por empresa/local.

P08 no crea usuarios de Auth. Esa operación administrativa se adapta en P09 sobre este contrato.

## 2. Cambio SQL

Migración versionada:

`supabase/migrations/20260906094500_pm11_vinculo_cuenta_empleado_integridad.sql`

Aplicación real en QA:

`20260906074000 · pm11_vinculo_cuenta_empleado_integridad`

La migración añade:

- FK real `perfiles.empleado_id -> empleados.id` con borrado/actualización restrictivos;
- `CHECK` para impedir `empleado_id` vacío;
- índice único parcial para que un empleado no pueda pertenecer a dos perfiles/cuentas;
- guard de perfil para exigir empleado existente, membresía compatible y cambio explícito desvincular→vincular;
- guard de membresía para impedir activar membresías incompatibles con el empleado ya vinculado;
- endurecimiento de `private.la_usuario_activo()` para que una cuenta vinculada solo sea operativa cuando el empleado esté `activo` y exista membresía activa compatible;
- RPC `pm11_vincular_cuenta_empleado(...)`;
- RPC `pm11_desvincular_cuenta_empleado(...)`;
- autorización de vínculo/desvínculo limitada a Propietario.

## 3. Semántica de acceso

Una cuenta sin `empleado_id` mantiene el comportamiento histórico: perfil activo + alguna membresía activa.

Una cuenta vinculada exige además:

1. empleado SQL existente;
2. empleado en estado `activo`;
3. al menos una membresía activa en la empresa del empleado y cuyo alcance incluya su local;
4. ninguna membresía activa incompatible con la empresa/local del empleado.

Consecuencia deliberada:

- baja lógica del empleado → la cuenta vinculada deja de estar activa para los helpers de autorización;
- reactivación del mismo empleado → la cuenta vuelve a ser elegible sin recrear el vínculo;
- no hace falta borrar el usuario ni alterar manualmente sus credenciales.

## 4. Autoridad para vincular/desvincular

En P08 solo un `Propietario` activo y autorizado para la empresa/local puede gestionar el vínculo.

`Encargado` no puede hacerlo en este punto.

La vinculación exige además local activo y empleado activo.

La desvinculación no exige que el local siga activo: es una decisión intencional para permitir cierres administrativos y preparar una anonimización posterior incluso si el local fue cerrado.

## 5. Idempotencia y auditoría

Repetir exactamente el mismo vínculo devuelve `yaVinculado=true` y no duplica auditoría.

Repetir un desvínculo ya realizado devuelve `yaDesvinculado=true` y no duplica auditoría.

Los cambios reales generan respectivamente:

- `Personal · vincular cuenta empleado`;
- `Personal · desvincular cuenta empleado`.

La auditoría registra `empleadoId`, empresa/local, actor y `cuentaUserId`, sin almacenar contraseña ni secretos.

## 6. Pruebas reales ejecutadas en QA

Se ejecutó un escenario transaccional con rollback usando únicamente datos sintéticos `P08-QA-*`.

PASS comprobados:

- Propietario A vincula cuenta Cajero A1 ↔ empleado A1;
- repetir el vínculo es idempotente;
- la cuenta vinculada activa queda autorizable;
- Propietario B no puede apropiarse de empleado A;
- Encargado A2 no puede gestionar vínculos;
- un empleado no puede vincularse a una segunda cuenta;
- una cuenta no puede vincularse simultáneamente a otro empleado;
- una cuenta de A2 no puede apropiarse de empleado A1;
- baja lógica del empleado suspende acceso efectivo de la cuenta vinculada;
- reactivación restaura elegibilidad sin recrear identidad;
- no se puede activar una membresía incompatible mientras el vínculo existe;
- desvinculación por Propietario funciona;
- repetir desvínculo es idempotente;
- auditoría real de vínculo/desvínculo aparece una sola vez por cambio real;
- escritura directa del propio `perfiles.empleado_id` por `authenticated` sigue bloqueada por el guard P04.

Resultado del escenario principal:

`PM11_P08_QA_TRANSACCIONAL=PASS`

Resultado de autogestión:

`PM11_P08_AUTOGESTION_BLOQUEADA=PASS`

## 7. Verificación estructural QA

Tras aplicar P08 se verificó:

- FK empleado: `true`;
- índice único de empleado: `true`;
- `authenticated` puede ejecutar RPC de vínculo/desvínculo: `true`;
- `anon` puede ejecutar esas RPC: `false`;
- residuos `P08-QA-*` en empleados: `0`;
- residuos de auditoría P08: `0`;
- residuos de vínculos P08: `0`.

## 8. Compatibilidad con P03–P07

P08 mantiene:

- identidad estable del empleado;
- frontera dura empresa/local;
- separación entre puesto laboral y rol de acceso;
- baja lógica en lugar de borrado;
- acceso opcional: puede existir empleado sin cuenta;
- `almacen_kv` intacto;
- frontend P06 intacto;
- producción/main intactos.

## 9. Bloqueante detectado para la creación de cuentas

Inspección **solo lectura** de la Edge Function actual de producción `crear-cuenta-empleado` mostró que el flujo histórico:

1. crea `auth.users`;
2. inserta `perfiles` directamente con `empleado_id`;
3. no crea la membresía correspondiente en esa misma operación.

Ese orden ya no cumple el contrato P08 y el guard SQL lo rechazará deliberadamente.

Esto **no se modifica en producción durante P08**.

Antes de cualquier integración/despliegue, P09 deberá adaptar la creación de cuenta en QA para que sea compensable/atómica a nivel de flujo:

1. autenticar y autorizar Propietario real;
2. crear Auth user;
3. crear perfil inicialmente sin apropiarse del empleado;
4. crear membresía acotada empresa/local + rol permitido;
5. invocar el RPC autoritativo P08 para vincular;
6. ante cualquier fallo, compensar usuario/perfil/membresía creados;
7. probar escalada de privilegios, empresa/local, duplicados y rollback.

## 10. Criterio de cierre

P08 queda cerrado cuando:

- `perfiles.empleado_id` tiene FK real;
- un empleado solo admite una cuenta;
- una cuenta no puede apropiarse de otra empresa/local;
- cliente autenticado no puede autogestionar el vínculo;
- solo Propietario usa las RPC controladas;
- baja/reactivación gobiernan el acceso efectivo de la cuenta vinculada;
- auditoría e idempotencia están probadas;
- QA queda sin residuos sintéticos;
- P01–P07 + LA-017 + fuente P06 siguen en regresión PASS;
- main/producción permanecen intactos.

**PM11_P08_VINCULO_CUENTA_EMPLEADO_INTEGRIDAD=PASS**  
**SIGUIENTE=PM11_P09_CREACION_CUENTA_EMPLEADO_SEGURA**
