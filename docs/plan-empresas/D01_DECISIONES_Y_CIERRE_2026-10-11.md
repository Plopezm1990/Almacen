# D01 — decisiones abiertas y cierre operativo

Fecha: 11/10/2026  
Estado: preparado para revisión de Pedro; no ejecuta cambios en producción.

El funcionamiento multiempresa está publicado y verificado. Este documento reúne lo que puede decidirse o prepararse antes del 10/11/2026 y separa las decisiones de producto del único pendiente operativo.

## Pendiente operativo con fecha

| Fecha | Acción | Resultado esperado |
|---|---|---|
| 10/11/2026 | Borrar definitivamente `Prueba D01 F7 A 20261010` y `Prueba D01 F7 B 20261010` desde Plataforma | Desaparecen sus empresas, locales, datos y cuentas de acceso |
| Después del borrado | Consulta de solo lectura | 1 empresa real activa, 0 empresas de prueba, 0 filas huérfanas y 0 usuarios de prueba |
| Después de verificar | Actualizar `F7-DOS-EMPRESAS.md` y cerrar el plan | Fase 7 cerrada documentalmente |

Hasta esa fecha A y B deben permanecer desactivadas. No se debe reactivar ninguna de las dos salvo que haya que repetir una prueba.

## Decisiones de producto

Estas decisiones no bloquean el uso actual de multiempresa y no requieren cambios ahora. Cada una necesitará una autorización y una prueba separadas si se implementa.

### 1. Configuración fiscal durante el alta

Situación actual: una empresa nueva puede guardar su catálogo aunque todavía no exista configuración fiscal y moneda.

Decisión pendiente: mantener el alta mínima y configurar lo fiscal después, o añadir un paso obligatorio de configuración fiscal al alta.

### 2. Sincronización entre dispositivos

Situación actual: los datos operativos se sincronizan por empresa; `empresas` y `configEmpresa` conservan la limitación histórica de no sincronizarse entre dispositivos.

Decisión pendiente: aceptar esa limitación, o diseñar una sincronización administrada para esos datos.

### 3. Contraseña inicial obligatoria en servidor

Situación actual: la pantalla obliga al primer cambio de contraseña; el servidor todavía no impone esa condición en todas las rutas.

Decisión pendiente: añadir una comprobación server-side que rechace operaciones hasta completar el cambio, o mantener la exigencia en la interfaz.

### 4. Funciones heredadas de stock

Siguen presentes en producción las funciones `descontar_stock`, `descontar_stock_carrito` y `anular_venta_tpv`.

Decisión pendiente: conservarlas por compatibilidad, marcarlas como heredadas y medir uso, o retirarlas mediante una migración separada después de confirmar que no hay llamadas activas.

### 5. Avisos del asesor de Supabase

El PR de integración dejó constancia de RLS desactivado en dos tablas privadas. Es una revisión de seguridad independiente del alcance D01; no se debe cambiar sin identificar las tablas, sus consumidores y las políticas correctas.

## Trabajo recomendado antes del 10/11

1. Revisar este documento y anotar la decisión de Pedro en cada apartado cuando quiera cerrarlo.
2. Mantener A y B desactivadas y no modificar la empresa real.
3. Conservar las copias y la evidencia de F7 ya verificadas.
4. El 09/11 hacer solo una comprobación de lectura del estado y de la fecha de borrado.
5. El 10/11 ejecutar el borrado con confirmación explícita y registrar el resultado.

## Actualización 16/10/2026 — decisiones de Pedro

Comprobación previa de solo lectura (GitHub y Supabase PROD, sin tocar nada): `release` sigue en `34ea736`; la Fase 5 (F1, F2, F4–F4e, F5) y la Fase 6 parcial siguen aplicadas en producción como las dejó Codex; las empresas de prueba A y B (`empresa-706e41e7d2a65dfc`, `empresa-93ec2338908c9302`) siguen desactivadas desde el 11/10, con sus 2 cuentas y 4 filas de datos intactas, a la espera del 10/11/2026 (el borrado **no se ha ejecutado**, falta la fecha).

Pedro ha respondido a las 5 decisiones de este documento:

1. **Configuración fiscal durante el alta** → **mantener el alta mínima**. Sin cambios de código.
2. **Sincronización entre dispositivos** → **aceptar la limitación**. Sin cambios de código.
3. **Contraseña inicial obligatoria en servidor** → **blindarla también en el servidor**. Queda pendiente de diseño e implementación (comprobación server-side que rechace operaciones hasta completar el cambio); no ejecutado todavía.
4. **Funciones heredadas de stock** (`descontar_stock`, `descontar_stock_carrito`, `anular_venta_tpv`) → **marcarlas como heredadas y medir uso antes de tocar nada**. Comprobación de hoy (solo lectura, PROD): no aparecen en `fuente.js` de `release`, ninguna otra función del servidor las llama, y 0 apariciones en los logs de las últimas 24 h (ventana máxima consultable de una vez; no es un historial completo). No se retiran por ahora.
5. **Avisos del asesor de Supabase** → revisados hoy en PROD y el hallazgo no coincide literalmente con lo descrito arriba («RLS desactivado en dos tablas privadas»): el asesor de seguridad muestra hoy 31 tablas de `private.*` con RLS **activado** pero sin políticas propias (bloqueo por defecto; patrón esperado de tablas solo accesibles por funciones con privilegios elevados, entre ellas `plataforma_admins`, `plataforma_ajustes`, `plataforma_auditoria`, `plataforma_bajas`), y un aviso aparte y real: la protección de Supabase Auth contra contraseñas filtradas (HaveIBeenPwned) está desactivada. Pedro ha aprobado activarla, pero es un ajuste del panel de Supabase (Authentication → Password Security), no una tabla ni una migración: ninguna herramienta de este agente puede cambiarlo. **Pendiente de que Pedro lo active desde el panel**, o indique otra vía. No se ha identificado ninguna de las dos tablas privadas que cita el texto original de 2026-10-11; si Pedro conserva esa referencia por otro medio, conviene contrastarla.

Nada de lo anterior modifica producción. El borrado de F7 sigue programado y sin tocar hasta el 10/11/2026.
