# Plan: empresas clientes — alta, baja y borrado (propietario de la plataforma)

Fecha: 9/10/2026
Estado: **SOLO PLAN. No se ha cambiado nada** (ni en producción, ni en QA, ni en la aplicación). Todo lo que sigue sale de leer el código, las migraciones y, en producción, solo estructura y recuentos (sin leer el contenido de los datos).

## Estado (actualizado el 9/10/2026)
| Fase | Estado |
|---|---|
| 0 · Decisiones | **Hechas**: empezar por QA; los datos actuales de producción son pruebas y no hace falta conservarlos; plazo de gracia de 30 días; el dueño de cada empresa recibirá una contraseña inicial que le da Pedro |
| 1 · Administrador de plataforma, alta, baja y reactivación | **Hecha y probada de punta a punta en QA** (`FASE1_RESULTADO_QA_2026-10-09.md`) |
| 2 · Borrado definitivo | **Hecha y probada en QA**, con datos reales y un borrado real de la empresa de prueba (`FASE2_RESULTADO_QA_2026-10-09.md`) |
| 3 · Pantalla «Plataforma» y contraseña inicial del dueño | **Hecha y probada de punta a punta en QA** (local con jsdom y Chromium real, 52 variantes rotas en el panel y 18 en la copia local, y con la pantalla por Cowork en dos vueltas). En el camino se corrigió un fallo propio (recarga entre pantallas) y se arregló un hueco de aislamiento (copia local heredada entre cuentas) (`FASE3_RESULTADO_QA_2026-10-09.md`) |
| 4 · Aislamiento de datos por empresa (P3/P3b) | Pendiente; condición previa de la primera empresa cliente real. **Primer paso, encontrado en la prueba de la fase 3 y hecho en QA:** la copia local del navegador se heredaba entre cuentas de distintas empresas (productos de la empresa A llegaban a la vista de la B en el mismo navegador); ahora cada cuenta tiene su propia copia local (`FASE3_RESULTADO_QA_2026-10-09.md`). **Segundo paso, hecho y verificado en QA (2026-10-10):** colecciones comunes de `almacen_kv` por empresa con clave primaria `(empresa_id, key)`, reglas por empresa y cargo y funciones de productos filtradas por empresa; prueba Postgres real, 19 mutaciones detectadas y prueba con la pantalla con dos empresas sin diferencias (`FASE4_AUDITORIA_Y_PLAN_2026-10-09.md`). **Completado en QA (2026-10-10), también con la pantalla:** lista de `productos` de cada empresa nueva (F4b), guardado sin contexto fiscal (F4c) y empresas dadas de baja que no cuentan al elegir la empresa de una cuenta (F4d); cada empresa guarda y recupera lo suyo desde la nube. **Quedan:** F4e, reglas por empresa para `perfiles`, `movimientos_registro` y `suscripciones_push` en la forma de producción (hallazgo del 10/10: hoy no separan empresas; `FASE4_AUDITORIA_Y_PLAN_2026-10-09.md` §4d) y vaciar o conservar las 7 filas sueltas de producción en la Fase 6 |
| 5 · Publicar en producción | Pendiente; autorización escrita de Pedro |
| 6 · Producción a cero y primera empresa cliente | Pendiente; autorización escrita de Pedro |
| 7 · Ensayo en producción con una empresa de prueba | Pendiente |

## 1. Lo que pide Pedro
1. Producción **sin ninguna empresa ni local** (a cero).
2. Que **él**, con su cuenta de propietario del programa, pueda **dar de alta** a las empresas que quieran usar el programa.
3. Poder **desactivar** una empresa si deja de usarlo.
4. Y, si es posible, **eliminar todos sus datos** y eliminar la empresa del programa.

Es la decisión D01 de la hoja F1 (2–3/10): «producto multiempresa, el alta la hace el propietario de la plataforma». Hoy está sin construir (informe de traspaso §7.H puntos 9 y 10).

## 2. Cómo está hoy (comprobado, solo lectura)

### 2.1 Producción (`flqercbgpgmmfaakrwkc`), solo recuentos
| Qué | Cuántos |
|---|---|
| Empresas | 3: una activa (la tuya, creada el 15/9) y dos desactivadas (pruebas del 18/9) |
| Locales | 4: uno activo (de la empresa activa) y tres desactivados |
| Membresías (quién pertenece a qué empresa) | 3, todas «Propietario» (la misma cuenta, una por empresa) |
| Perfiles / cuentas de acceso | 1 perfil Propietario / 2 cuentas de acceso |
| Datos ligados a una empresa | **142 filas en 34 tablas, todas de la empresa activa**. Las dos desactivadas **no tienen datos** (solo la empresa, sus locales y la membresía) |
| Datos generales sin empresa | 7 filas del almacén antiguo (`catalogoProv`, `conteos`, `disenoMenu`, `historialRespaldos`, `productos`, `temaOscuro`, `traspasos`) + 3 movimientos antiguos + 3 filas de límites de prefiltro |
| Fotos guardadas (Storage) | Ninguna |

Qué es la empresa activa en términos de datos: 1 proveedor, 1 albarán, 1 entidad fiscal, 2 pedidos TPV, 1 sesión de caja con su cierre, 31 eventos de descuentos/caja, 29 operaciones, 23 errores de sistema, 17 apuntes de auditoría, etc.

### 2.2 Qué existe ya
- Pantalla «Empresas» donde un **Propietario** puede crear y **desactivar** empresas y locales (PM29): la baja es **lógica** (la fila no se borra, arrastra a sus locales, no deja desactivar la última empresa activa).
- Seguridad por empresa en las tablas nuevas: cada fila lleva `empresa_id` y solo se ve si el usuario tiene una membresía activa en esa empresa (`la_tiene_empresa`).
- Creación de cuentas de empleado (función `crear-cuenta-empleado`): solo roles Encargado, Básico, Camarero/a, Cajero/a, Churrero/a. **No crea Propietarios.**
- Confirmación con contraseña para acciones peligrosas (`ConfirmarConContrasenaPM29`).
- Un asistente de **primera instalación** (`bootstrap_owner_instalacion`): solo funciona si **todo está vacío y hay un único perfil**; crea una empresa y un local para esa cuenta. No sirve para segundas empresas.

### 2.3 Qué NO existe (los huecos que este plan cubre)
1. **No existe el «propietario de la plataforma»** (tú) distinto del «Propietario» de cada empresa. Hoy cualquier cuenta con perfil Propietario puede crear empresas nuevas bajo su propia cuenta.
2. **No hay alta de una empresa cliente de punta a punta**: empresa + local + ajustes por defecto + primer usuario dueño de esa empresa.
3. **No hay borrado definitivo.** La regla actual de PM29 es «la fila nunca se borra». Además:
   - las claves ajenas hacia `empresas` y `locales` son `ON DELETE RESTRICT` (no hay cascada: hay que borrar en orden);
   - varias tablas documentales (impresiones, entregas, conciliaciones y ensayos de cierre) tienen **disparadores que prohíben borrar y modificar** («impresión documental inmutable»), y las políticas de descuento y las membresías tienen un bloqueo de configuración (`a09_lock_*`).
4. **Con producción a cero, la aplicación te enseñaría el asistente de primera instalación** (porque habría un único perfil y nada más) y te crearía una empresa. Hay que enseñarle un estado nuevo: «administrador de plataforma, sin empresas».
5. **Riesgo de mezcla de datos entre empresas (el más serio).** El almacén antiguo (`almacen_kv`) tiene como clave primaria solo `key`: **una fila por colección para todo el programa**, y la política de producción no distingue empresa. Colecciones como `productos`, `conteos`, `catalogoProv`, `historialRespaldos`, `traspasos` y otras 21 de la pantalla (pedidos, fichas de coste, APPCC, turnos, nóminas…) funcionan así; además `movimientos_registro` y `fichajes_registro` no llevan empresa. Con una sola empresa no se nota; **con dos empresas clientes reales compartirían y se pisarían esos datos.** Hay que cerrarlo **antes de la primera empresa cliente real** (es el paquete P3/P3b del plan ABC: pasar productos y demás a tablas por empresa).

## 3. Diseño propuesto

### 3.1 El «administrador de la plataforma» (tú)
- Un permiso propio en el servidor, **distinto** de «Propietario» de empresa, concedido solo a tu cuenta (tabla privada `plataforma_admins`, que el navegador no puede escribir).
- Todas las funciones de plataforma comprueban ese permiso en el servidor; la pantalla solo lo refleja.
- Se **cierra el hueco actual**: un Propietario de una empresa cliente **no podrá crear empresas nuevas**; solo administrar la suya.
- Acciones delicadas con confirmación por contraseña (ya existe el componente) y, recomendado, segundo factor en tu cuenta.
- Tu cuenta debe seguir pudiendo entrar con producción a cero: el estado nuevo del servidor será «administrador de plataforma, sin empresas», y la aplicación te lleva directo al panel.

### 3.2 Pantalla «Plataforma» (solo tú)
Lista de empresas con estado (**Activa**, **Desactivada**, **En borrado programado**), número de locales y de usuarios, fecha de alta y de baja. **No muestra datos de negocio de los clientes** (ventas, proveedores…), solo lo necesario para administrar. Botones: **Dar de alta**, **Desactivar**, **Reactivar**, **Descargar copia de sus datos**, **Eliminar definitivamente**.

### 3.3 Alta de una empresa cliente
Un formulario (nombre de la empresa, CIF si lo tiene, primer local, nombre y correo del dueño) que llama a **una sola función de servidor transaccional**: o se crea todo o no se crea nada.
- Crea la empresa, su primer local, los ajustes por defecto (política de descuentos D12, modalidades, permisos por defecto) y la membresía de **Propietario de esa empresa** para su dueño.
- El dueño recibe su acceso mediante una función de servidor nueva (como `crear-cuenta-empleado`, con clave de servicio guardada solo en el servidor). **Decisión pendiente (fase 1):** invitación por correo o contraseña inicial que le das tú; el correo del plan gratuito de Supabase tiene límites.
- Idempotente (repetir la orden no duplica) y con apunte de auditoría de plataforma.

### 3.4 Desactivar y reactivar (reversible)
- La empresa y sus locales pasan a inactivos (ya existe la lógica PM29) y **sus usuarios no pueden entrar**; las sesiones abiertas dejan de funcionar al renovar el acceso.
- **Los datos no se tocan.** Se puede reactivar en cualquier momento.
- Se guardan fecha y motivo de la baja.

### 3.5 Eliminar definitivamente (con varias puertas)
1. **Solo si la empresa ya está desactivada** y ha pasado un **plazo de gracia** (propuesta: 30 días; configurable).
2. **Antes, copia descargable** de todos sus datos (para ti y para entregarla al cliente).
3. **Confirmación triple:** escribir el nombre exacto de la empresa, tu contraseña y un código de un solo uso.
4. Una **función de servidor de purga** borra **en el orden correcto** (de las tablas hijas a la raíz) todo lo que lleve su `empresa_id`, sus locales, sus membresías, sus perfiles y cuentas de acceso que **solo** pertenezcan a esa empresa (se borran con la API de administración de Auth, no con SQL suelto), sus suscripciones push y cualquier colección antigua que pase a estar por empresa.
5. **Tablas inmutables:** la purga necesita un **modo excepcional y controlado** (solo administrador de plataforma, solo dentro de esa operación, comprobado en QA) para poder borrar también lo que los disparadores protegen. No se debilita la protección para el resto de usos.
6. **Acta de borrado** que se conserva sin datos personales: quién lo pidió, cuándo, id de la empresa, número de filas borradas por tabla y una huella. Sirve de prueba de que se borró y de lo que se borró.
7. **Prueba de cobertura automática:** un test que falla si alguien añade en el futuro una tabla con `empresa_id` y no la incluye en la purga. Es lo que evita que quede un resto de datos de un cliente dado de baja.

#### Aviso legal (orientativo; confírmalo con tu gestor o abogado)
- Tú eres el **encargado del tratamiento** de los datos de tus clientes: al terminar el servicio, el cliente decide si se **devuelven** o se **borran** (RGPD art. 28.3.g). Conviene que lo diga por escrito y que el contrato lo recoja.
- Las **facturas y la contabilidad** de una empresa tienen plazos de conservación (en España, orientativamente 4 años a efectos tributarios y 6 años mercantiles). La obligación es del cliente, no tuya, pero por eso la copia descargable es obligatoria antes de borrar y el plazo de gracia es recomendable.

### 3.6 Producción a cero (se hace al final)
Orden fijo, con tu autorización escrita en cada paso:
1. Copia manual completa con la CLI (el plan gratuito no tiene copias automáticas; no se ha probado a restaurar ninguna), guardada fuera del repositorio.
2. Exportación de tus datos actuales (la empresa activa).
3. Borrado con la misma función de purga (empresas `empresa-546bc…`, `mu6nc…` y `mu70l…`), más las 7 filas del almacén antiguo y los registros sin empresa (3 movimientos y 3 límites de prefiltro).
4. Comprobación: 0 empresas, 0 locales, 0 membresías, 0 filas con empresa; queda solo tu cuenta como administrador de plataforma.
5. Primera empresa cliente real dada de alta desde el panel.

**Importante:** esto borra lo que hoy hay en tu empresa activa (el proveedor Arboliva, el albarán, los productos, los conteos…). Se puede exportar antes. Por eso se hace al final y con tu decisión expresa (ver §5).

## 4. Fases (cada una con su puerta de autorización)
| Fase | Qué se hace | Dónde | Autorización |
|---|---|---|---|
| 0 | Contestar las decisiones de §5. No se toca nada | — | — |
| 1 | Administrador de plataforma + alta, desactivar y reactivar por función de servidor (migraciones y pruebas) | **QA** | Tu OK para escribir en QA |
| 2 | Borrado definitivo: función de purga, exportación, acta y prueba de cobertura; ensayo con una empresa ficticia llena de datos | **QA** | Tu OK para QA |
| 3 | Pantalla «Plataforma» en la aplicación; la prueba la hace Cowork en la vista previa | QA (vista previa) | Tu OK para QA |
| 4 | **Aislamiento de datos por empresa** (P3/P3b): productos, conteos y demás pasan a tablas por empresa; prueba automática de que la empresa A no ve nada de la B | QA, luego producción | Tu OK por separado |
| 5 | Publicar en producción las migraciones y la aplicación | **Producción** | **Autorización escrita tuya**, con copia previa |
| 6 | Producción a cero (§3.6) y primera empresa cliente real | **Producción** | **Autorización escrita tuya**, paso a paso |
| 7 | Ensayo real con una empresa de prueba creada desde el panel: dar de alta, desactivar, exportar y eliminar, antes de usarlo con un cliente de verdad | Producción | Tu OK |

Las fases 1 a 3 se pueden empezar ya (solo QA). La fase 4 hay que terminarla **antes de la fase 6**.

## 5. Decisiones que necesito de Pedro
1. **¿Empezamos por la fase 1 en QA?** (Recomendado: sí; producción no se toca.)
2. **Tus datos actuales de la empresa activa** (Arboliva, albarán, productos…): exportarlos y borrarlos al final (recomendado), o conservarlos como «empresa demo».
3. **Plazo de gracia** antes del borrado definitivo: 30 días (recomendado), inmediato o 90 días.
4. Más adelante, en la fase 1: invitación por correo o contraseña inicial para el dueño de cada empresa cliente.

## 6. Riesgos y cómo se controlan
| Riesgo | Control |
|---|---|
| Borrar una empresa por error | Solo desactivadas, plazo de gracia, copia descargable, confirmación triple, acta |
| Quedarse sin copia (plan gratuito, sin copias automáticas) | Copia manual con la CLI antes de cada operación en producción; pasar a un plan de pago es **tu** decisión de gasto (no la tomo yo) |
| Mezcla de datos entre empresas | Fase 4 obligatoria antes de la primera empresa cliente; prueba automática de aislamiento |
| Quedar datos huérfanos de un cliente | Prueba de cobertura que falla si falta una tabla en la purga |
| Que alguien robe la cuenta de administrador | Una sola cuenta, comprobación en servidor, contraseña de confirmación, segundo factor recomendado; activar la protección contra contraseñas filtradas (hoy desactivada) |
| Quedarte fuera con producción a cero | El estado «administrador sin empresas» se prueba en QA antes de producción |
| Romper algo que ya funciona (alta de proveedor desde foto, TPV…) | Todo en QA primero, con los contratos de CI actuales en verde |

## 7. Qué no se hará sin tu autorización escrita
Nada en producción (ni lectura de contenidos, ni migraciones, ni borrados, ni publicar la aplicación); nada que cueste dinero; nada de contraseñas ni claves en el repositorio (es público).
