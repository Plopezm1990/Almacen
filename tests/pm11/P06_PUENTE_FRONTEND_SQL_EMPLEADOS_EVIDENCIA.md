# PM11 · Personal / Empleados · P06 — Puente frontend ↔ SQL empleados

Fecha: 2026-09-06  
Rama: `pm11-personal-empleados`  
Backend previo: P04 entidad/RLS + P05 RPC de ciclo de vida  
Producción/main: **no tocar**

## 1. Objetivo

Conectar el módulo Personal existente con la autoridad SQL `public.empleados` y con las RPC cerradas en P05, sin romper el modo local/compatibilidad legado y sin introducir todavía una migración destructiva de `almacen_kv.empleados`.

P06 cubre:

- lectura SQL de empleados permitidos por RLS;
- alta SQL;
- edición SQL;
- baja lógica SQL;
- reactivación SQL;
- persistencia de ausencias/EPI a través de la edición autoritativa;
- adaptación de la UI al ciclo `activo ↔ inactivo`;
- eliminación del borrado físico del flujo normal de Personal;
- compatibilidad temporal con fichas legacy/KV todavía no migradas.

## 2. Autoridad y compatibilidad

En modo nube (`window.__nubeActiva === true`), las operaciones estructurales de empleado dejan de depender de una mutación aislada del array cliente:

- alta → `pm11_alta_empleado`;
- edición → `pm11_editar_empleado`;
- baja → `pm11_baja_empleado`;
- reactivación → `pm11_reactivar_empleado`.

La respuesta del backend se normaliza al shape que ya consume la aplicación. La identidad canónica (`id`, `empresaId`, `localId`, `estado`, `nombre`) procede de columnas SQL y no del payload mutable.

El array React sigue existiendo como estado de presentación. Al sincronizar, SQL gana por `empleado_id` sobre una ficha legacy con el mismo ID, pero las fichas KV que todavía no tengan equivalente SQL se mantienen de forma temporal para no destruir datos antes del punto de migración.

## 3. Modo local

El paquete conserva el funcionamiento sin nube:

- `addEmpleado` y `updateEmpleado` siguen devolviendo resultado síncrono en modo local;
- no se introduce `async` universal en esas funciones porque la regresión LA-017 heredada ejecuta la lógica sin `window`;
- la UI acepta indistintamente resultado síncrono o Promise mediante `Promise.resolve(...)`.

Esto evita romper el contrato PM10 y mantiene la aplicación utilizable en el modo local existente mientras continúa la migración.

## 4. Lectura SQL

Se introduce una sincronización de Personal cuando:

- la aplicación está `ready`;
- la nube está activa;
- cambia el local activo.

La consulta va contra `public.empleados`. La RLS de P04 sigue siendo la barrera de lectura y la consulta puede además acotarse al `localActivoId` concreto.

La sincronización no escribe directamente en la tabla; únicamente actualiza el estado React con los datos permitidos por backend.

## 5. Alta y edición

La validación LA-017 sigue ejecutándose antes de invocar el backend.

En nube:

- el frontend envía empresa/local/empleado y datos mutables a la RPC correspondiente;
- P05 vuelve a validar autenticación, membresía, rol, empresa/local, local activo, estado y campos laborales;
- la UI solo cierra el formulario después de recibir éxito;
- si backend rechaza la operación, se conserva el formulario y se muestra el error.

La empresa y el local no se pueden trasladar mediante edición ordinaria.

## 6. Baja lógica y reactivación

El nombre interno heredado `deleteEmpleado(...)` se conserva temporalmente como adaptador para reducir el radio del cambio, pero **ya no significa DELETE físico**.

Su semántica P06 es:

- nube: invocar `pm11_baja_empleado`;
- local: cambiar a `estado='inactivo'`, `activo=false` y conservar la ficha;
- no borrar nóminas;
- no borrar documentos;
- no borrar ausencias;
- no cambiar `empleado_id`.

La UI sustituye “Eliminar empleado / Eliminar del todo” por “Dar de baja empleado / Dar de baja”.

Se añade `reactivarEmpleado(...)` y un botón “Reactivar” únicamente para fichas inactivas no anonimizadas.

## 7. Acciones sobre empleado inactivo

Una ficha inactiva continúa visible para historial y trazabilidad, pero P06 evita tratarla como una ficha operativa:

- no se ofrece edición ordinaria;
- no se ofrece registrar ausencia;
- no se ofrece entregar EPI;
- no se ofrece crear cuenta de acceso;
- sí se puede consultar historial;
- sí se puede reactivar si el backend lo autoriza.

## 8. Ausencias y EPI

Las operaciones de ausencia y EPI que ya pertenecen a PM11 dejan de ser únicamente mutaciones locales del array en modo nube.

P06 las hace pasar por `updateEmpleado(...)`; por tanto, terminan en `pm11_editar_empleado` y heredan:

- identidad del empleado;
- empresa/local;
- autorización de P05;
- validación de estado activo;
- auditoría de edición.

No se crean tablas hijas independientes en P06; esa normalización puede abordarse después sin perder la autoridad de la ficha.

## 9. Anonimización

P06 **no inventa** una anonimización SQL antes de disponer de una operación backend dedicada que pueda validar precondiciones y desvinculación de acceso.

En modo nube, la anonimización permanece cerrada y devuelve un error explícito. En modo local se conserva la compatibilidad histórica, pero exige que el empleado ya esté inactivo.

La UI del flujo de baja no ofrece anonimización como sustituto improvisado del backend pendiente.

## 10. Cuenta de acceso

La creación de cuenta existente no se rehace en P06. Se conserva la Edge Function actual, pero la acción se restringe en UI/lógica a empleados activos.

La integridad completa `auth user ↔ perfil ↔ membresía ↔ empleado` continúa como punto posterior de PM11.

## 11. Reproducibilidad

P06 se aplica mediante:

- `tools/corregir_pm11_p06_frontend.py`.

El script es idempotente y puede recibir una ruta alternativa. Esto permite validar reproducibilidad así:

1. reconstruir el `fuente.js` base mediante `source-recovery/rebuild-current.mjs`;
2. aplicar el parche P06 al artefacto reconstruido;
3. comparar byte a byte contra `fuente.js` versionado.

P06 no altera la serie congelada PM09/PM10 de `source-recovery`.

## 12. Validación prevista

El gate P06 debe comprobar como mínimo:

- sintaxis de `fuente.js`;
- contrato P06;
- regresión LA-017 de Personal;
- regresiones P05/P04/P03/P02/P01;
- build reproducible + aplicación determinista del parche P06;
- ausencia de nuevas migraciones en P06;
- `main` intacto.

## 13. Alcance excluido

No pertenece a P06:

- migrar todas las fichas legacy/KV a SQL;
- eliminar `almacen_kv.empleados`;
- anonimización SQL definitiva;
- vínculo referencial completo de cuenta de acceso;
- fichajes PM12;
- turnos PM13;
- nóminas PM14;
- despliegue o fusión a producción.

## 14. Estado

Implementación preparada para gate automático. El punto no se considera cerrado hasta que el workflow P06 aplique el parche y termine en verde.

**PM11_P06_ESTADO=CANDIDATO**  
**SIGUIENTE_TRAS_PASS=PM11_P07_MIGRACION_CONTROLADA_FICHAS_LEGACY**
