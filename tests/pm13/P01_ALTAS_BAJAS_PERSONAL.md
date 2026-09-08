# PM13–P01 — Altas y bajas de personal

## Estado de cierre

**Checkpoint final de cierre.** Este documento se considera `CERRADO` automáticamente si el workflow **PM13 P01 altas y bajas personal** disparado por este mismo commit concluye `SUCCESS` con `fuente.js` ya integrado y sin generar un nuevo cambio funcional. Si ese gate falla, P01 permanece abierto.

Producción y `main` quedan fuera del alcance de este bloque.

## 1. Problema real encontrado

El flujo histórico de Personal trataba la acción de salida del empleado como eliminación destructiva:

- eliminaba físicamente la ficha del empleado;
- eliminaba también sus nóminas asociadas;
- la UI ofrecía `Eliminar del todo`;
- no existía una semántica de baja laboral trazable como acción principal.

Esto podía destruir trazabilidad laboral y documental y era incompatible con el objetivo de PM13.

## 2. Decisión de arquitectura

PM13–P01 **no crea un segundo motor de Personal**.

Durante la inspección se confirmó que QA ya dispone del motor PM11 de ciclo de vida de empleados:

- `pm11_alta_empleado`;
- `pm11_editar_empleado`;
- `pm11_baja_empleado`;
- `pm11_reactivar_empleado`;
- entidad `public.empleados`;
- helpers existentes de autorización por sesión, empresa, local y rol;
- auditoría de las transiciones.

P01 reutiliza y endurece ese motor, igual que PM12 reutilizó la idempotencia existente del stock.

## 3. Baja lógica y conservación del historial

La acción normal de salida pasa a ser **Dar de baja**.

La baja:

- mantiene la ficha;
- mantiene documentos;
- mantiene ausencias;
- mantiene fichajes;
- mantiene nóminas;
- mantiene la identidad histórica;
- registra estado inactivo;
- conserva fecha de baja;
- conserva motivo cuando se informa;
- puede ser reactivada mediante una acción explícita.

Se eliminaron del flujo normal de P01 las rutas que borraban físicamente empleado o nóminas.

La anonimización no se mezcla con la baja: es otro ciclo de vida y otro RPC. El antiguo atajo local de anonimización se retiró del modal de baja para evitar una mutación fuera del motor autoritativo.

## 4. Backend PM11 endurecido en QA

### Migración QA 1

`20260907194803_pm13_p01_ciclo_personal_idempotente`

Versionada en:

`supabase/migrations/20260907194803_pm13_p01_ciclo_personal_idempotente.sql`

Cambios:

- alta con identidad de operación `pm13AltaOperationId`;
- replay de alta devuelve `yaCreado=true` sin segundo empleado ni segunda auditoría;
- edición repetida sin cambios devuelve `yaSinCambios=true`;
- baja repetida sobre empleado ya inactivo devuelve `yaBaja=true`;
- reactivación repetida sobre empleado ya activo devuelve `yaActivo=true`;
- `SECURITY DEFINER` con `search_path=''`;
- `anon` sin `EXECUTE`;
- `authenticated` con `EXECUTE`;
- sin `DELETE`, `TRUNCATE` ni borrado de historial.

### Migración QA 2

`20260907195207_pm13_p01_alta_concurrency_lock`

Versionada en:

`supabase/migrations/20260907195207_pm13_p01_alta_concurrency_lock.sql`

Cierra la carrera de dos altas simultáneas con la misma identidad mediante un `pg_advisory_xact_lock` por empresa/local/empleado **antes** de comprobar e insertar la fila.

Edición, baja y reactivación ya quedan serializadas por el `FOR UPDATE` del motor PM11.

## 5. Smoke real en QA

Se ejecutó un smoke de escritura dentro de una transacción con `ROLLBACK` final.

Cubrió:

1. alta;
2. replay de la misma alta;
3. edición;
4. replay de la misma edición;
5. baja;
6. replay de la misma baja;
7. reactivación;
8. replay de la misma reactivación;
9. conteo de auditorías por transición.

Resultado:

- una sola transición real por operación;
- una sola auditoría por transición real;
- replay sin duplicados;
- baja persistía estado, fecha y motivo;
- reactivación limpiaba fecha/motivo de baja de la ficha activa;
- transacción revertida;
- comprobación posterior: **0 filas `pm13-p01-smoke-*`**.

## 6. Acceso de cuentas de empleados dados de baja

Se inspeccionó el caso de una cuenta vinculada a un empleado inactivo.

Aunque el perfil/membresía histórica pueda seguir marcada como activa, el helper central `private.la_usuario_activo()` exige también que el empleado vinculado esté en estado `activo`. En la prueba de QA para el empleado inactivo devolvió acceso efectivo `false`.

Por ello P01 no añade un segundo mecanismo paralelo de borrado/desvinculación de cuenta. La baja laboral corta el contexto operativo mediante el motor de autorización existente.

## 7. Frontend híbrido

El frontend queda conectado al mismo motor PM11:

- `addEmpleado` → `pm11_alta_empleado`;
- `updateEmpleado` → `pm11_editar_empleado`;
- `deleteEmpleado` conserva su nombre interno por compatibilidad, pero semánticamente es **baja** → `pm11_baja_empleado`;
- `reactivarEmpleado` → `pm11_reactivar_empleado`.

En navegador:

1. se valida la ficha;
2. se llama al RPC con empresa/local exactos;
3. si backend falla, no se muta la caché local;
4. solo tras éxito se actualiza el estado visible;
5. la auditoría autoritativa queda en backend.

Para alta, la UI conserva un `empleadoId` y `operationId` estables durante el intento/reintento. Dos llamadas concurrentes del mismo submit se coalescen en cliente y, además, backend tiene el lock transaccional.

## 8. Compatibilidad PM10

Los contratos históricos PM10 ejecutan `crearLogicaPersonal` de forma aislada, sin navegador y sin `empresaId`.

Se mantuvo expresamente ese contrato:

- sin `window.getSupabaseClient`, la API conserva fallback local síncrono;
- el fallback sigue validando con `validarEmpleadoPM10`;
- empresa + local son obligatorios únicamente en modo remoto;
- en navegador la UI usa `await`, compatible tanto con valor síncrono como con Promise.

`tests/pm10/p07-personal-contract.mjs` se ajustó únicamente para aceptar el submit seguro PM13 con `await`, manteniendo sus invariantes originales:

- validaciones numéricas;
- cero mutación ante error;
- add/update a través del API validado;
- formulario no se cierra si la operación falla.

## 9. Contratos P01

- `tests/pm13/p01-rpc-personal-contract.mjs`
  - fallback síncrono;
  - error RPC = cero mutación local;
  - scope empresa/local exacto;
  - baja conserva nóminas;
  - auditoría no se duplica en cliente;
  - alta concurrente coalescida;
  - edición y reactivación mediante RPC PM11;
  - UI espera confirmación remota;
  - no hay borrado físico.

- `tests/pm13/p01-backend-personal-contract.mjs`
  - cuatro RPC versionadas;
  - `search_path=''`;
  - replay idempotente;
  - permisos cerrados a `anon`;
  - lock de alta antes de `SELECT/INSERT`;
  - ausencia de borrados/destructivos y secretos.

## 10. Regresiones acumuladas

El gate P01 ejecuta:

- sintaxis de `fuente.js`;
- contrato RPC híbrido P01;
- contrato backend P01;
- PM10–P07 Personal;
- regresión frontend PM12 P02–P10;
- barreras de no borrado;
- barreras de no secretos;
- comprobación de `main` congelado;
- comprobación de que el diff Supabase de P01 contiene exclusivamente sus dos migraciones.

## 11. Historial de fallos del gate durante el desarrollo

Los rojos intermedios se investigaron y no se ocultaron:

- `34157576840`: escape `\\x` del script Python; el parche se detuvo antes de escribir `fuente.js`.
- `34157733365`: segundo transformador redundante; se convirtió en verificador de compatibilidad.
- `34157775511`: falso negativo de test por objetos de realms VM distintos.
- `34157840206`: contrato PM10 aislado no suministraba `empresaId`; se separó el requisito local del requisito remoto.
- `34157901019`: semántica PM10 correcta, pero aserción histórica acoplada a la sintaxis exacta sin `await`; se actualizó sin rebajar invariantes.

Primer gate integral completamente verde después de esos ajustes:

- `34158073549` — **SUCCESS**.

Ese run validó el candidato y generó el commit funcional:

`e7a021a2efb990e983af5b11448c6bedabf9f56b`

Mensaje:

`feat(pm13): conectar altas y bajas al motor PM11`

El push creado por `GITHUB_TOKEN` no dispara otro workflow automáticamente por la protección anti-bucle de GitHub Actions. Por ello este documento se crea después de la integración funcional y su propio commit debe proporcionar el gate final sobre un árbol que ya contiene `fuente.js` integrado.

## 12. Validación final de QA antes de este checkpoint

Confirmado de forma read-only:

- ambas migraciones PM13–P01 presentes en QA;
- 0 restos del smoke;
- `pm11_alta_empleado`: `anon=false`, `authenticated=true`, `search_path=''`, lock de concurrencia presente;
- `pm11_editar_empleado`: `anon=false`, `authenticated=true`, `search_path=''`;
- `pm11_baja_empleado`: `anon=false`, `authenticated=true`, `search_path=''`;
- `pm11_reactivar_empleado`: `anon=false`, `authenticated=true`, `search_path=''`.

## 13. Producción y main

- `main` permanece congelado en `7f792925d6a3d27334ee0e7335ba635b4ed79b6b`.
- Producción no contiene migraciones PM13.
- No se aplicó PM13–P01 a producción.
- No se promovió frontend a `main`.
- No se ejecutó smoke mutante en producción.

## 14. Criterio final

P01 queda **CERRADO** únicamente cuando el workflow `PM13 P01 altas y bajas personal` correspondiente al commit que añade este documento termina `SUCCESS` y la fase `Commit funcional si procede` confirma que `fuente.js` ya coincide con P01 sin crear otro cambio funcional.

Si se cumple ese gate, el siguiente bloque deberá determinarse leyendo el Plan Maestro antes de implementar nada.
