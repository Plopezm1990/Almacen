# PM21 P02 — Corrección: `movimientos_registro`, Storage y matices de rol

Segundo punto de PM21. Corrige, con autorización explícita del usuario, los dos
hallazgos reales identificados en P01, y a continuación (autorización explícita
adicional, "corrígelos también") los dos matices menores.

## 1. `movimientos_registro`

Mismo patrón que `errores_sistema` (PM20 P06): política única `USING(true)`/
`WITH CHECK(true)` para `authenticated`, sin columnas de empresa/local.

Antes de corregir se confirmó que las 3 filas existentes son fixture QA identificable
por su propio id (`QA-MOV-A1-INIT`, `QA-MOV-A2-INIT`, `QA-MOV-B1-INIT`), coincidiendo
exactamente con las identidades reales de empresa/local ya usadas en el resto del
proyecto (`QA-EMP-A`/`QA-A1`/`QA-A2`, `QA-EMP-B`/`QA-B1`, confirmado contra
`stock_ubicacion`). Se rellenaron esas 3 filas con su empresa/local real en vez de
dejarlas huérfanas — no se inventó ni se perdió ningún dato.

Corrección:

- `empresa_id`/`local_id` añadidas.
- Política permisiva retirada.
- Nueva política de solo lectura, mismo criterio que `auditoria_registro`: Propietario
  ve toda su empresa; Encargado, solo su local.
- **Sin política de escritura para clientes**: confirmado en P01 que ninguna función ni
  el frontend escribe en esta tabla — no se repone ninguna vía de inserción/edición/
  borrado por API. Si en el futuro se decide reutilizar esta tabla para algo real, esa
  sería una decisión y una migración nuevas, no una reposición silenciosa del acceso
  amplio anterior.

## 2. Storage — bucket de pruebas

Las 4 políticas (INSERT/SELECT/UPDATE/DELETE) solo comprobaban `bucket_id`. Confirmado
en P01 que el bucket está vacío (0 objetos) y sin ningún consumidor en `fuente.js`.

Corrección: se fija la convención de ruta `empresaId/...` (primer segmento del nombre
del objeto) y las 4 políticas exigen `private.la_tiene_empresa(...)` sobre ese segmento,
mismo helper que ya usa el resto de tablas de ámbito empresa. No fue necesario migrar
ningún objeto existente (no había ninguno). La convención de local (segundo segmento,
si una función de negocio futura lo necesita) queda para cuando exista esa función real
— no se ha inventado una regla de local sin un caso de uso que la exija.

## 3. Matices menores (autorización adicional "corrígelos también")

Dos inconsistencias cosméticas detectadas en P01, sin bypass real, corregidas por
consistencia con el resto del modelo de roles:

### 3.1 `pagos_encargo` / `encargos_empresa` — rol `public` en vez de `authenticated`

Las políticas `pm14_pagos_encargo_select`, `pm14_encargos_select`,
`pm14_encargos_insert`, `pm14_encargos_update` estaban registradas para el rol
`public` en vez de `authenticated`, a diferencia del resto de la base. Verificado antes
de corregir que no era un bypass real: la condición ya exige
`private.la_tiene_empresa(empresa_id) and private.la_tiene_local(empresa_id, local_id)`,
que solo puede cumplir un usuario autenticado con membresía real (un anónimo no supera
`la_tiene_empresa`). Se recrean idénticas, solo cambiando el rol a `authenticated`. Sin
cambio de comportamiento.

### 3.2 `albaranes_empresa` — sin gate de rol financiero en sus mutaciones

A diferencia de sus tablas hermanas (`gastos_empresa`, `facturas_directas_empresa`),
`albaranes_empresa` no exigía `private.pm06_puede_gestionar_finanzas()` (Propietario o
Encargado) en INSERT/UPDATE/DELETE — solo el aislamiento de empresa/local.

Antes de aplicar se verificó específicamente si esto podía romper un flujo real: el
layer de permisos KV-sync del frontend (`CLAVES_CHURRERO`, en `fuente.js`) incluye la
clave `"albaranes"` con acceso de escritura para el rol Churrero/a, lo que en principio
podría chocar con un gate que excluye a ese rol. Se confirmó:

- `albaranes_empresa` (la tabla SQL) no tiene **ningún** consumidor en `fuente.js`: no
  hay llamada `supabase.from('albaranes_empresa')` ni RPC de escritura que la use.
- La tabla tiene **0 filas**.
- El flujo real de "albaranes" que usa el Churrero/a hoy pasa por el mecanismo genérico
  `almacen_kv` (`saveKey`/`loadKey`), una tabla distinta, ya aislada por empresa/local y
  sin restricción de rol — no afectada por este cambio.

Es decir: el gate añadido no quita ninguna capacidad real que el Churrero/a esté usando
hoy, porque la tabla que lo recibe está desconectada del frontend. Se añade el mismo
check que sus tablas hermanas para que, si en el futuro se conecta esta tabla a un flujo
real, ya herede el modelo de roles correcto en vez de reabrir el hueco.

**Observación registrada, sin corregir (fuera del alcance autorizado):** existe una
inconsistencia entre `CLAVES_CHURRERO` (incluye `"albaranes"`) y `ROLES_EMPLEADO` (la
pestaña "albaranes" no está listada para Churrero/a en la UI). Es una divergencia entre
las dos capas de permisos del frontend, no relacionada con Supabase/RLS. Queda anotada
para una decisión futura, no se modifica en este punto.

## 4. Verificación

Confirmado tras aplicar, releyendo las políticas reales:

- `movimientos_registro`: una sola política, `SELECT`, con la condición esperada.
- `storage.objects`: 4 políticas nuevas (`qa_storage_empresa_select/insert/update/delete`),
  todas con `bucket_id = 'qa-pruebas' AND private.la_tiene_empresa((storage.foldername(name))[1])`.
- `pagos_encargo`/`encargos_empresa`: las 4 políticas ahora registradas para
  `authenticated`, misma condición que antes.
- `albaranes_empresa`: INSERT/UPDATE/DELETE ahora exigen también
  `private.pm06_puede_gestionar_finanzas()`; SELECT sin cambios.
- Asesor de seguridad de Supabase releído tras cada corrección: mismos avisos que antes
  (los 3 de RLS-sin-política intencionales, los SECURITY DEFINER ya verificados seguros
  en P01, y el de protección de contraseñas filtradas, ajeno a este punto) — sin ningún
  aviso nuevo introducido por ninguna de las correcciones.
- Las 3 filas de `movimientos_registro` conservan su empresa/local real tras el
  backfill.

## 5. Archivos

- `supabase/migrations/20260908210800_pm21_p01_movimientos_registro_aislamiento.sql`
- `supabase/migrations/20260908210900_pm21_p01_storage_qa_pruebas_aislamiento.sql`
- `supabase/migrations/20260908212000_pm21_p02_matices_rol_politicas.sql`
- `tests/pm21/p02-correcciones-contract.mjs`: confirma que las tres migraciones están
  trackeadas en el repositorio con el contenido esperado.

## Regresión

Sin cambios en `fuente.js` (ninguna de las tablas/bucket de este punto tiene consumidor
en el frontend). Suite completa del proyecto — sin regresiones.

## Estado de main/producción/QA

`main` sin tocar. Tres migraciones aplicadas en **QA únicamente**, autorizadas
explícitamente por el usuario ("Sí, corrige ambos ahora en QA" y, para los dos matices
menores, "corrijelos también") antes de ejecutarse. Producción y TPV sin tocar.

**PM21_P02_CIERRE_CORRECCIONES=PASS**
