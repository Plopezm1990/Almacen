# PM11 · Personal / Empleados · P07 — Migración controlada de fichas legacy/KV

Fecha: 2026-09-06  
Rama: `pm11-personal-empleados`  
Base cerrada P06: `358de7d8d99d0e0504da2e23996582d306562dd2`  
Supabase QA: `qjqorixtkilwsndqayyx`  
Producción/main: **no tocar / no tocado**

## 1. Objetivo

Cerrar el paso de transición entre las fichas históricas de Personal conservadas en almacenamiento legacy/KV y la autoridad SQL `public.empleados`, sin borrar el origen y sin permitir una migración silenciosa que oculte colisiones o fichas inválidas.

P07 introduce una frontera explícita de **previsualización → validación completa → migración atómica**.

## 2. Situación inicial observada en QA

Antes de la prueba P07:

- `public.empleados`: 0 filas;
- no existían claves de `almacen_kv` cuyo nombre contuviera `emplead`;
- por tanto, QA no contenía fichas legacy reales de empleados que debieran migrarse.

Para probar el proceso sin inventar datos persistentes se usaron únicamente fichas sintéticas dentro de transacciones revertidas.

## 3. Migración aplicada en QA

Migración Supabase aplicada correctamente:

- versión QA: `20260906072402`;
- nombre: `pm11_migracion_controlada_empleados_legacy`.

Archivo versionado en GitHub:

- `supabase/migrations/20260906093000_pm11_migracion_controlada_empleados_legacy.sql`.

No se modificó producción.

## 4. API de migración

Se añadieron dos RPC públicas, ejecutables solo por `authenticated`:

- `pm11_previsualizar_migracion_empleados_legacy(empresa, local, fichas)`;
- `pm11_migrar_empleados_legacy(empresa, local, fichas)`.

`anon` no tiene `EXECUTE`.

La función de migración es `SECURITY DEFINER` porque `authenticated` no tiene escritura directa sobre `public.empleados`; la propia RPC vuelve a validar actor, rol, empresa y local antes de escribir.

## 5. Por qué la RPC recibe el array legacy

P07 no intenta adivinar desde PostgreSQL el nombre físico de la clave que usa cada versión del storage del frontend.

La capa que ya conoce la ficha exacta cargada por `loadKey("empleados")` entrega el array a la RPC. El backend **no confía** en `empresaId`, `localId`, estado ni identidad contextual del JSON: los valida y vuelve a imponer desde los parámetros autorizados.

Esto desacopla la migración de la convención de nombres/namespace de `almacen_kv` y evita migrar por accidente otra clave JSON.

## 6. Autorización especial

La migración histórica es más sensible que una edición ordinaria:

- solo `Propietario` activo puede ejecutarla;
- la empresa debe coincidir con una membresía activa real del actor;
- el local debe ser concreto y pertenecer a la empresa;
- `TODOS` / `TODOS LOS LOCALES` no es un local válido;
- un Encargado, Cajero u otro rol no obtiene esta facultad.

A diferencia de alta/edición operativa, P07 permite migrar un **local cerrado**. La razón es preservar historia laboral ya existente; el local cerrado continúa bloqueado para operaciones ordinarias por P05.

## 7. Normalización y validación

Cada ficha legacy se normaliza antes de insertar:

- `id` obligatorio y estable;
- empresa legacy, si está presente, debe coincidir;
- local legacy, si está presente, debe coincidir;
- estados admitidos: `activo`, `inactivo`, `anonimizado`;
- `activo=false` se interpreta como `inactivo` si no hay un estado más específico;
- `anonimizado=true` se interpreta como estado terminal `anonimizado`;
- nombre obligatorio para activo/inactivo;
- validación laboral heredada de LA-017/P05 (`horasSemanales`, `pagas`, salarios/coste y vacaciones);
- timestamps legacy se convierten de forma tolerante y pasan a columnas SQL;
- si una baja/anonimización legacy no trae timestamp, se registra el momento de migración como fallback técnico para mantener invariantes SQL.

La identidad y contexto se vuelven a escribir canónicamente dentro de `datos`.

## 8. Anonimización legacy

Si una ficha ya estaba anonimizada antes de P07:

- `nombre` SQL queda `NULL`;
- se eliminan del JSON migrado campos directos conocidos como DNI/NIE, PIN, email, teléfono, dirección y datos de cuenta;
- se eliminan documentos y ausencias embebidos de esa ficha legacy para no reintroducir PII desde una copia histórica;
- se conserva el `empleado_id`, empresa/local, estado y trazabilidad técnica.

Prueba QA: la ficha sintética anonimizada quedó con `nombre IS NULL` y sin `dni`, `pin` ni `documentos` en `datos`.

## 9. Previsualización obligatoria

Antes de escribir, la RPC clasifica cada ficha como:

- `candidato`;
- `ya_migrado`;
- `problema`.

Bloqueos comprobados:

- ID duplicado dentro del mismo lote;
- empresa legacy distinta de la empresa autorizada;
- local legacy distinto;
- colisión global de ID con otro contexto;
- mismo ID/contexto pero contenido SQL diferente;
- estado inválido;
- ficha sin ID o sin nombre cuando corresponde;
- valores laborales inválidos.

Si existe **un solo problema**, el lote completo devuelve `migracion_legacy_bloqueada` y no crea ninguna fila.

## 10. Idempotencia

La migración puede repetirse con el mismo lote ya migrado:

- primera ejecución sintética: `insertados=1`;
- segunda ejecución: `insertados=0`, `omitidosYaMigrados=1`;
- filas SQL finales dentro de la prueba: 1;
- auditorías de migración: 1.

No duplica empleados ni auditorías en un reintento exacto.

## 11. Prueba funcional positiva QA

Con Propietario A y `QA-A1` se migró dentro de una transacción revertida un lote de tres fichas sintéticas:

1. activa;
2. inactiva;
3. anonimizada.

Resultado antes del rollback:

- `insertados=3`;
- 3 filas en `public.empleados`;
- la anonimizada cumplió limpieza de PII;
- 3 eventos de auditoría `Personal · migrar empleado legacy`;
- `kvEliminado=false`.

## 12. Prueba desde una fila KV sintética

Se creó temporalmente una fila `almacen_kv` sintética que contenía un array de empleados, se pasó su `value` exacto a la RPC y se comprobó:

- empleado SQL insertado: 1;
- fila KV de origen seguía existiendo: sí;
- resultado RPC: `kvEliminado=false`.

Después se hizo `ROLLBACK`.

P07 **no borra ni reescribe** `almacen_kv`.

## 13. Lote negativo atómico

Se probó un lote con:

- un candidato válido;
- un ID duplicado;
- una empresa forzada distinta;
- horas semanales negativas.

Resultado:

- `problemas=3`;
- `puedeMigrar=false`;
- respuesta `migracion_legacy_bloqueada`;
- filas creadas: **0**.

## 14. Local cerrado

Propietario A migró dentro de transacción revertida una ficha histórica inactiva hacia `QA-A-CERRADO`.

Resultado: permitido e insertado correctamente como histórico.

Esto no habilita el local para altas/ediciones/bajas/reactivaciones ordinarias: P05 sigue bloqueando esas mutaciones mientras el local esté cerrado.

## 15. Matriz de privilegios

Comprobado en QA:

- `authenticated` puede ejecutar preview: sí;
- `authenticated` puede ejecutar migración: sí;
- `anon` puede ejecutar preview: no;
- `anon` puede ejecutar migración: no;
- Cajero A1 intentando previsualizar/migrar: `personal_migracion_no_autorizada`.

La autorización real dentro de la RPC queda restringida a Propietario.

## 16. Auditoría

Cada ficha realmente insertada registra:

- acción `Personal · migrar empleado legacy`;
- `empleadoId`;
- empresa;
- local;
- actor autenticado;
- origen técnico `legacy_kv`;
- estado migrado.

No se vuelca la ficha completa ni PII al log.

## 17. Advisor de seguridad

El advisor de Supabase marca las dos RPC P07 con el aviso genérico `authenticated_security_definer_function_executable` porque son `SECURITY DEFINER` y están expuestas a `authenticated`.

En P07 esta exposición es intencional: la tabla `empleados` continúa sin escritura directa para `authenticated`, mientras las RPC validan `auth.uid()`, rol Propietario, membresía, empresa y local antes de cualquier inserción.

Los avisos preexistentes sobre otras RPC y tablas de paquetes anteriores no se amplían dentro del alcance P07.

## 18. Limpieza QA

Todas las pruebas de datos se ejecutaron dentro de transacciones revertidas.

Comprobación posterior:

- empleados `P07-QA-*` restantes: 0;
- auditorías `P07-QA-*` restantes: 0;
- clave KV sintética P07 restante: 0.

La migración DDL P07 sí permanece aplicada en QA, como corresponde.

## 19. Frontend, fuente y producción

P07 no necesita modificar el frontend para cerrar la frontera segura de migración:

- `fuente.js`: sin cambios respecto al cierre P06;
- `source-recovery`: sin cambios;
- `almacen_kv` real: no borrado;
- producción: 0 cambios;
- `main`: no tocar.

La integración visual/operativa futura podrá invocar esta frontera sin tener que relajar seguridad ni reescribir datos silenciosamente.

**PM11_P07_MIGRACION_CONTROLADA_EMPLEADOS_LEGACY=PASS**  
**SIGUIENTE=PM11_P08_VINCULO_CUENTA_EMPLEADO_INTEGRIDAD**
