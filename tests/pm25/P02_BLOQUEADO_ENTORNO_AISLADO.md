# PM25 P02 — Recuperación real y ensayo de migración

## Estado

**BLOQUEADO POR FALTA DE ENTORNO AISLADO.**

No probado, no aprobado, no descartado, no cerrado. Este documento registra
el diseño completo ya acordado, el motivo exacto del bloqueo, y las
condiciones necesarias para desbloquearlo — no es un cierre ni debe
presentarse como ejecución satisfactoria de P02. Un contrato en verde sobre
este documento certifica que el estado está registrado con precisión, no
que el ensayo se haya ejecutado.

## Motivo del bloqueo (comprobado, nada creado)

El plan original (dos *branches* de desarrollo de QA: `pm25-base` y
`pm25-ensayo`) falló al primer intento de creación: **"Branching is
supported only on the Pro plan or above"** — la organización está en el
plan `free` y no lo tiene. No se creó nada; el fallo ocurrió antes de
aprovisionar cualquier recurso.

La alternativa autorizada condicionalmente (dos proyectos Supabase nuevos y
separados) se comprobó **antes** de crear nada, tal como se exigió:

1. Plan de la organización: `free`.
2. Proyectos actuales: 3 en total — 2 **activos** (`L&A Suite` = producción,
   `L&A Suite QA`) y 1 **inactivo** (`TPV`).
3. Espacios gratuitos disponibles: el plan Free de Supabase permite un
   máximo de 2 proyectos activos por organización, y esta organización ya
   tiene 2 activos. No queda espacio gratuito para crear proyectos activos
   nuevos sin pagar o sin afectar a un proyecto existente.
4. Coste exacto: no se llegó a comprobar, porque el paso 3 ya no se cumple.
5. Tarjeta/facturación: no se llegó a comprobar, por la misma razón.

Al no cumplirse la condición de "dos espacios disponibles y coste total
exactamente 0 €", no se creó ningún proyecto, y no se tocó, pausó ni
reactivó ningún proyecto existente (ni `TPV`, ni QA, ni producción).

Tampoco se consideró viable Docker/Supabase local en este entorno de
pruebas: sin permisos para iniciar el demonio de Docker, sin systemd —
comprobado directamente, no asumido.

## Diseño del ensayo (conservado íntegro para cuando exista entorno)

### Migración candidata
`supabase/migrations/20260905185935_g1_p08_operation_id_finanzas_global.sql`
— crea el registro global de `operation_id` (`private.g1_operation_ids_global`),
migra identificadores históricos desde cinco libros (`pagos_factura`,
`caja_operaciones`, `stock_operaciones`, `arqueos_caja`,
`arqueos_caja_anulaciones`) vía `UNION ALL ... ON CONFLICT DO NOTHING`, y
añade triggers que reclaman el `operation_id` de forma atómica por libro.

### Entorno aislado (cuando exista)
Dos réplicas gemelas (branches o proyectos, según cuál esté disponible):
`pm25-base` (nunca recibe la migración — es el punto de recuperación real)
y `pm25-ensayo` (donde se aplica la migración a probar). Nunca el QA
compartido, nunca producción, nunca TPV.

### Fixtures antiguas sintéticas
Filas de ejemplo en los cinco libros afectados, incluyendo **un mismo
`operation_id` repetido a propósito entre dos libros distintos** — el
escenario de datos antiguos que se pidió cubrir explícitamente.

### Pasos
1. Construir el esquema en el estado inmediatamente anterior a la
   migración candidata (por reset a la versión de migración anterior, o
   aplicando en orden todas las migraciones previas — nunca por `DROP`
   manual de objetos).
2. Sembrar las fixtures idénticas en ambas réplicas; comparar huellas
   (conteos + hash agregado por tabla) entre ambas antes de continuar —
   deben coincidir exactamente.
3. Capturar "antes": conteos y huellas por tabla, y documentar el
   conflicto esperado (según el orden `UNION ALL` de la migración, el
   primer libro con el `operation_id` repetido "gana" el registro global;
   el otro queda huérfano).
4. Aplicar la migración candidata **tal cual, sin modificarla**, solo en
   `pm25-ensayo`.
5. Validar: conteo del registro global (filas únicas menos la colisión),
   qué libro ganó, permisos (`revoke` aplicado), integridad de los cinco
   libros originales (deben seguir exactamente iguales, porque esta
   migración no los modifica), y una prueba deliberada — insertar una fila
   nueva reutilizando el `operation_id` "perdedor" en su propio libro, para
   comprobar si el trigger la rechaza con `operation_id_conflict`
   (documentar el resultado como hallazgo, sea o no un defecto).
6. Reversión — **nunca simulada con `DROP` manual**: `pm25-base`, al no
   haber recibido nunca la migración, es en sí mismo el punto de
   recuperación; se compara contra la captura del paso 3 (debe coincidir,
   porque no se tocó). Además, se restaura `pm25-ensayo` a la versión de
   esquema anterior y se reinsertan los datos capturados, confirmando que
   el resultado coincide con `pm25-base`.
7. Verificaciones posteriores con sesiones reales de prueba: Auth (login
   real), JWT, PostgREST (peticiones REST reales contra las tablas
   afectadas) y RLS (intentos autorizados y no autorizados) — solo
   alcanzables con el stack completo de Supabase, no con PostgreSQL suelto.
8. Medir la duración real de cada fase contra el presupuesto ya fijado:
   **ciclo completo < 5 minutos, 0 filas perdidas, 0 duplicados o cambios
   ambiguos no esperados**. Cualquier diferencia o duración ≥ 5 minutos se
   registra como fallo del presupuesto, sin reajustar el límite después de
   ver el resultado.
9. Al terminar: pausar (o eliminar, si son *branches*) ambas réplicas.
   Registrar sus nombres exactos para que el usuario las elimine
   manualmente desde el panel si son proyectos (no hay herramienta
   disponible para borrar un proyecto por completo, solo pausarlo).

## Condiciones para desbloquear (cualquiera de las tres)

1. Disponer de un proyecto Supabase aislado, sin coste y sin afectar
   proyectos existentes (por ejemplo, si se libera un espacio gratuito, o
   si la organización pasa a tener más cupo).
2. Autorización expresa y específica para un entorno aislado de pago
   (branching en un plan superior, o proyectos adicionales de pago).
3. Disponer de un entorno local con el stack completo de Supabase (Auth,
   JWT, PostgREST, RLS) — no solo PostgreSQL suelto.

**PostgreSQL local sin el resto del stack puede aportar evidencia parcial
(lógica SQL pura: tablas, backfill, triggers, conflictos) pero no puede
cerrar P02**, porque no permite las pruebas de Auth/JWT/PostgREST/RLS con
sesiones reales que se exigieron como parte de la validación.

## Qué NO se hizo (por precisión)

- No se creó ninguna *branch* ni proyecto Supabase.
- No se pausó, reactivó ni modificó `TPV`, producción ni QA.
- No se subió ningún plan de pago.
- No se creó ninguna otra organización.
- No se ejecutó nada sobre el esquema `public` ni ningún otro esquema del
  proyecto QA compartido.
- No se usó `service_role`.

```
PM25_P02_ESTADO=BLOQUEADO_POR_FALTA_DE_ENTORNO_AISLADO
PM25_P02_EJECUTADO=NO
PM25_P02_APROBADO=NO
PM25_P02_DESCARTADO=NO
PM25_P02_CERRADO=NO
```
