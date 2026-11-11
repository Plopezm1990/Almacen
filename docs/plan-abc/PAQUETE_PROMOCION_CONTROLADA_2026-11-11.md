# Paquete de promoción controlada — fase 4

Fecha de preparación: 2026-11-11  
PR de auditoría: [#220](https://github.com/Plopezm1990/Almacen/pull/220)  
Rama: `codex/fase4-remediacion-restante`  
Commit de preparación: `dba4a605`

## Estado

Este documento deja preparada la revisión para una promoción posterior. La
auditoría no ejecuta la promoción: producción permanece en solo lectura por
la regla de alcance establecida para este trabajo.

Los contratos focales de M-01, M-03, M-04, M-05, M-07, B-02 y N-02 pasan en la
rama. Eso es evidencia **reproducida en código local**; no acredita que la
corrección esté aplicada en producción.

## Cambios candidatos a revisar por el responsable de producción

La ventana autorizada debe revisar el PR completo y el historial real de
migraciones antes de ejecutar nada. Como mínimo, los cambios directamente
relacionados con los puntos listos para promoción son:

- M-01: `20261108120000_m01_server_pin_authentication.sql` y
  `20261110190000_m01_enable_pin_rls.sql`.
- B-02: `20261109120000_b02_errores_sistema_fecha_idx.sql`.
- M-04, M-05 y M-07: cambios de cliente y de `source-recovery` contenidos en
  el PR; no se debe asumir que son solo DDL.

No se incluyen automáticamente en esta ventana:

- M-03, hasta aprobar la política de roles, recuperación y exigencia de
  `aal2`, y planificar el enrolamiento de los propietarios productivos.
- A-05, porque la caducidad efectiva depende de la configuración de sesiones
  del proyecto y no se demuestra con una migración de este PR.
- M-06, hasta aprobar plazos, excepciones y tratamiento de conservación.
- M-08, hasta disponer de un entorno limpio PostgreSQL 16 para reproducir el
  bootstrap.
- N-02, hasta decidir el destino de las funciones legacy exclusivas de
  producción y completar la comparación de procedencia. No se deben copiar ni
  eliminar funciones que escriben ventas, stock o auditoría por inferencia.

## Precondiciones obligatorias

1. El PR debe estar dirigido a `release`, con todos sus checks remotos en
   `success` y el preview disponible.
2. El responsable debe revisar la lista de migraciones ya registradas en
   producción. Hay versiones reparadas manualmente, por lo que no se debe
   ejecutar una sincronización ciega que repita o salte SQL.
3. Debe existir una copia/restore o procedimiento de recuperación aprobado,
   además de una ventana de mantenimiento y un responsable identificable.
4. El cambio debe ejecutarse primero en QA o en una copia equivalente, con la
   misma secuencia aprobada para producción.
5. No se deben introducir credenciales, tokens ni contraseñas en el PR, en
   este documento ni en el chat.

## Verificación posterior, siempre de solo lectura

Después de la promoción, el responsable debe guardar la salida de las
comprobaciones siguientes contra producción y adjuntarla al expediente:

- existencia de `private.pm11_empleado_pin`, RLS activo y sus políticas;
- existencia de `errores_sistema_fecha_idx` sobre
  `public.errores_sistema (fecha DESC)`;
- existencia y huella de las funciones que el PR pretende promover;
- historial oficial de migraciones y correspondencia con la secuencia aprobada;
- ausencia de cambios en operaciones comerciales durante la ventana;
- para M-03, factores MFA verificados y prueba de desafío con una cuenta
  productiva autorizada, sin compartir el secreto;
- para A-05, valores efectivos de `sessions_inactivity_timeout` y
  `sessions_timebox` en la configuración del proyecto.

La salida debe clasificarse como **medida**, **probada por código**,
**reproducida** u **observada**. Una migración marcada como aplicada en el
historial no demuestra por sí sola que su SQL haya cambiado correctamente el
objeto: hay que comprobar el objeto desplegado.

## Criterio de cierre

Ningún punto se marca como «terminado completamente» solo porque el PR se
fusione o porque QA pase. Cada hallazgo requiere la evidencia efectiva que
corresponda al entorno, la lectura posterior y la documentación de cualquier
límite restante.
