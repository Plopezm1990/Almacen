# PM11 · Personal / Empleados · P03 — Contrato de identidad y ciclo de vida

Fecha: 2026-09-06  
Rama: `pm11-personal-empleados`  
Base funcional: cierre G1 `1e21458b48a11302c59911ef966ded0aca3eb639`  
P02 cerrado en HEAD previo `9cff6a788393afef067dc4f3e80d90cda686b7de`  
Producción/main: no tocar

## 1. Objetivo de P03

Congelar antes de implementar el contrato de identidad, contexto, ciclo de vida y vínculo de cuenta del empleado.

P03 es deliberadamente de arquitectura/contrato:

- no modifica `fuente.js`;
- no crea migraciones;
- no cambia datos de QA;
- no toca producción/main;
- decide qué será autoridad en PM11 y qué invariantes deberán cumplir los puntos de implementación posteriores.

## 2. Decisión de arquitectura

PM11 adoptará una entidad SQL dedicada `public.empleados` como autoridad de identidad y ciclo de vida del empleado.

La persistencia genérica `almacen_kv` podrá mantenerse temporalmente como capa de compatibilidad durante la migración de la ficha existente, pero dejará de ser la autoridad para:

- identidad del empleado;
- empresa de pertenencia;
- local de adscripción;
- estado activo/inactivo/anonimizado;
- vínculo con cuenta de acceso;
- referencias de PM12–PM14.

No se realizará un corte destructivo. La migración será progresiva y comprobable.

## 3. Identidad canónica

La identidad laboral de un empleado será un identificador estable `empleado_id` de tipo texto, generado/validado por la capa autoritativa de PM11 y no reutilizable.

Invariantes:

1. `empleado_id` es inmutable durante toda la vida del registro.
2. Un `empleado_id` pertenece exactamente a una `empresa_id`.
3. `empresa_id` es inmutable: un empleado no se puede “mover” a otra empresa mediante edición.
4. El empleado tiene un `local_id` explícito mientras su ficha esté operativa en el alcance actual de PM11.
5. `Todos los locales` nunca es un `local_id` válido para mutaciones.
6. Una edición ordinaria no puede cambiar `local_id`.
7. Cualquier traslado interlocal futuro debe ser una operación explícita, dentro de la misma empresa, con origen/destino auditados; no un cambio silencioso de campo.
8. PM12, PM13 y PM14 deberán referenciar el mismo `empleado_id`, nunca nombre/email como identidad.

## 4. Entidad SQL autoritativa que implementará P04

P04 deberá crear la entidad `public.empleados` con, como mínimo, identidad/contexto/ciclo de vida suficientes para hacer cumplir este contrato.

El diseño deberá permitir conservar los identificadores textuales ya usados por el frontend y detectar colisiones antes de migrar cualquier legado.

La entidad deberá exponer como mínimo estos conceptos, aunque el nombre físico exacto de columnas se fijará en P04:

- `id` / `empleado_id` estable;
- `empresa_id`;
- `local_id`;
- estado de ciclo de vida;
- marcas temporales de creación/actualización/baja/reactivación/anonimización cuando proceda;
- datos mínimos de presentación necesarios para resolver la ficha;
- mecanismo de compatibilidad/migración para el contenido de ficha hoy alojado en el dominio Personal/`almacen_kv`.

No se exige mover en P04 todos los campos laborales a columnas relacionales de una sola vez. Sí se exige que identidad, contexto y estado de ciclo de vida dejen de depender de un JSON cliente sin integridad referencial.

## 5. Estados de ciclo de vida

El contrato funcional tendrá tres estados semánticos:

- `activo`: ficha operativa y utilizable por las operaciones permitidas;
- `inactivo`: baja lógica; conserva historia y puede reactivarse;
- `anonimizado`: estado terminal para datos personales identificativos; conserva el identificador técnico y la trazabilidad mínima necesaria.

No existe una transición de negocio normal que destruya físicamente la fila del empleado.

Transiciones permitidas:

- alta → `activo`;
- `activo` → baja → `inactivo`;
- `inactivo` → reactivación → `activo`;
- `inactivo` → anonimización → `anonimizado`;
- `activo` no se anonimiza directamente: primero debe quedar inactivo y sin cuenta de acceso activa;
- `anonimizado` no puede reactivarse.

## 6. Alta

Una alta válida deberá ser atómica y cumplir simultáneamente:

- actor autorizado;
- empresa derivada del contexto autenticado, nunca aceptada ciegamente desde el cliente;
- local explícito, existente, activo y perteneciente a la empresa del actor;
- nunca `Todos los locales`;
- validaciones heredadas de LA-017;
- `empleado_id` nuevo/no reutilizado;
- estado inicial `activo`;
- auditoría del evento de alta.

Si falla cualquier precondición, no se crea parcialmente la ficha.

## 7. Edición

La edición ordinaria solo puede modificar campos editables de la ficha del mismo empleado y contexto.

Queda prohibido mediante edición ordinaria:

- cambiar `empleado_id`;
- cambiar `empresa_id`;
- cambiar `local_id`;
- revivir un empleado inactivo;
- anonimizar;
- crear/desvincular una cuenta;
- normalizar silenciosamente datos legados inválidos.

LA-017 permanece vigente: ficha inválida = mutación rechazada completa.

## 8. Baja lógica

`deleteEmpleado(...)` no podrá seguir significando borrado físico en la implementación final de PM11.

La operación de baja deberá:

- exigir ficha `activo`;
- conservar la fila y su `empleado_id`;
- pasar a `inactivo`;
- registrar quién/cuándo/contexto;
- conservar referencias históricas de documentos, ausencias, EPI y paquetes PM12–PM14;
- impedir que una cuenta vinculada siga operando como si el empleado continuara activo.

La adaptación concreta de la función histórica se realizará en un punto posterior, con regresión específica.

## 9. Reactivación

La reactivación solo se permite desde `inactivo` y sobre la misma empresa/local congelados en la ficha.

Si el negocio necesita otro local, deberá usarse una operación explícita de traslado, nunca reactivación con cambio silencioso de `local_id`.

La reactivación debe quedar auditada y no recrea ni cambia `empleado_id`.

## 10. Anonimización

La anonimización es irreversible desde el dominio normal de la aplicación.

Precondiciones:

- empleado `inactivo`;
- actor con privilegio de Propietario;
- ninguna cuenta de acceso activa vinculada;
- contexto empresa/local válido.

Efectos contractuales:

- conservar `empleado_id`, empresa/local históricos, estado y marcas de trazabilidad;
- eliminar o sustituir datos directamente identificativos que ya no deban conservarse;
- no borrar referencias técnicas necesarias para integridad de históricos;
- registrar auditoría de la anonimización sin volver a introducir en el log los datos personales eliminados.

## 11. Empresa y local

La empresa es frontera dura de seguridad.

Reglas:

- nunca se puede leer/mutar un empleado de otra empresa por manipulación de payload;
- `empresa_id` se resuelve desde membresía/contexto autenticado;
- `local_id` debe pertenecer a esa empresa y estar activo para altas/mutaciones operativas;
- un Propietario situado en `Todos los locales` debe seleccionar un local concreto antes de mutar una ficha;
- un Encargado solo opera sobre el local concreto que tenga autorizado;
- una referencia hija (documento, ausencia, EPI) hereda empresa/local del empleado y no puede declarar otro contexto.

## 12. Rol laboral frente a rol de acceso

`puesto`/función laboral y rol de acceso son conceptos distintos.

- El puesto laboral pertenece a la ficha del empleado.
- El rol de acceso vive en `perfiles`/`membresias_usuario` y determina permisos de la aplicación.
- Cambiar el puesto no cambia automáticamente el rol de acceso.
- Cambiar el rol de acceso no reescribe la historia laboral.

Roles de acceso existentes que PM11 debe respetar: Propietario, Encargado, Básico, Camarero/a, Cajero/a y Churrero/a.

## 13. Matriz de autoridad de PM11

Contrato mínimo de seguridad:

### Propietario

Puede, con contexto local explícito:

- alta;
- edición;
- baja lógica;
- reactivación;
- anonimización;
- creación/vinculación/desvinculación controlada de cuenta.

### Encargado

Puede únicamente dentro de su local autorizado:

- alta;
- edición;
- baja lógica;
- reactivación;
- gestionar dependencias de Personal que PM11 incorpore expresamente.

No puede:

- anonimizar;
- crear una cuenta con privilegio superior;
- apropiarse de empleados de otro local/empresa;
- operar desde `Todos los locales`.

La creación de cuenta por Encargado queda denegada por defecto en PM11 hasta que un punto específico la habilite con un rol destino acotado y prueba de escalada de privilegios.

### Resto de roles

No tienen mutaciones estructurales de empleados por defecto. Las vistas/acciones de autoservicio, si existen, deberán resolverse en paquetes específicos y con alcance propio.

## 14. Vínculo con cuenta de acceso

La cuenta de acceso es opcional: puede existir empleado sin usuario de acceso.

Cuando exista vínculo, debe ser inequívoco:

`auth.users.user_id ↔ perfiles.user_id ↔ perfiles.empleado_id ↔ empleados.id`

y la membresía activa del usuario deberá coincidir con `empleados.empresa_id` y con el alcance local autorizado.

Invariantes:

1. Un empleado no puede estar vinculado a dos usuarios de acceso.
2. Un usuario no puede apropiarse de un `empleado_id` de otra empresa.
3. La vinculación/desvinculación se hace mediante operación transaccional, no por escrituras cliente independientes.
4. Una baja lógica debe deshabilitar el acceso efectivo asociado o dejarlo en un estado que no autorice operaciones hasta reactivación explícita.
5. Anonimizar exige vínculo de acceso previamente desactivado/desvinculado según el contrato del punto que implemente cuentas.
6. P04/Puntos posteriores deberán añadir integridad referencial/índices o trigger equivalente para que `perfiles.empleado_id` no quede como texto libre sin control.

## 15. Dependencias hijas

Documentos, ausencias y EPI que formen parte de PM11 deben:

- referenciar un `empleado_id` existente;
- heredar empresa/local desde el empleado autoritativo;
- rechazar payload que intente forzar otro contexto;
- conservarse tras baja lógica;
- seguir reglas específicas de anonimización sin romper históricos.

Fichajes, turnos y nóminas permanecen fuera de PM11, pero deberán enlazar más adelante con la misma identidad autoritativa.

## 16. Auditoría mínima

Deben producir evento de auditoría, como mínimo:

- alta;
- edición relevante;
- baja;
- reactivación;
- traslado interlocal cuando se implemente;
- anonimización;
- creación/vinculación/desvinculación de cuenta;
- cambios de rol de acceso realizados desde Personal.

La auditoría debe incluir actor, `empleado_id`, empresa/local, operación y tiempo, evitando almacenar secretos o reinyectar PII anonimizada.

## 17. Estrategia de migración

La migración desde el estado actual será progresiva:

1. crear autoridad SQL e invariantes sin tocar producción;
2. probar RLS/funciones en QA con datos sintéticos;
3. crear puente de lectura/escritura compatible con la UI actual;
4. migrar/sembrar fichas existentes solo después de detectar duplicados/colisiones/legados inválidos;
5. enlazar `perfiles.empleado_id` con integridad real;
6. retirar el borrado físico;
7. cerrar regresiones;
8. solo al final plantear integración/despliegue autorizado.

Nunca se debe borrar `almacen_kv.empleados` antes de demostrar equivalencia y recuperación.

## 18. No alcance de P03

P03 no implementa:

- tabla SQL;
- RLS;
- RPC de Personal;
- migración de KV;
- cambios en `fuente.js`;
- fichajes;
- turnos;
- nóminas.

## 19. Criterio de cierre

P03 queda cerrado si:

- la autoridad futura queda fijada en `public.empleados`;
- identidad/empresa/local son inequívocos;
- baja lógica sustituye el borrado como contrato objetivo;
- reactivación y anonimización tienen transiciones explícitas;
- cuenta/perfil/membresía/empleado quedan definidos como un vínculo controlado;
- matriz Propietario/Encargado/resto queda congelada;
- PM12–PM14 reciben una identidad estable;
- `fuente.js` y migraciones siguen sin cambios desde G1.

**PM11_P03_CONTRATO_IDENTIDAD_CICLO_VIDA=PASS**  
**SIGUIENTE=PM11_P04_ENTIDAD_SQL_EMPLEADOS_RLS**
