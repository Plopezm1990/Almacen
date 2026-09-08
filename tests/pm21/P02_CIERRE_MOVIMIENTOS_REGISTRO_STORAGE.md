# PM21 P02 — Corrección: `movimientos_registro` y Storage sin aislamiento

Segundo punto de PM21. Corrige, con autorización explícita del usuario, los dos
hallazgos reales identificados en P01.

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

## 3. Verificación

Confirmado tras aplicar, releyendo las políticas reales:

- `movimientos_registro`: una sola política, `SELECT`, con la condición esperada.
- `storage.objects`: 4 políticas nuevas (`qa_storage_empresa_select/insert/update/delete`),
  todas con `bucket_id = 'qa-pruebas' AND private.la_tiene_empresa((storage.foldername(name))[1])`.
- Asesor de seguridad de Supabase releído tras la corrección: mismos avisos que antes
  (los 3 de RLS-sin-política intencionales, los 39 de SECURITY DEFINER ya verificados
  seguros en P01, y el de protección de contraseñas filtradas, ajeno a este punto) — sin
  ningún aviso nuevo introducido por la corrección.
- Las 3 filas de `movimientos_registro` conservan su empresa/local real tras el
  backfill.

## 4. Archivos

- `supabase/migrations/20260908210800_pm21_p01_movimientos_registro_aislamiento.sql`
- `supabase/migrations/20260908210900_pm21_p01_storage_qa_pruebas_aislamiento.sql`
- `tests/pm21/p02-correcciones-contract.mjs` (nuevo): confirma que ambas migraciones
  están trackeadas en el repositorio con el contenido esperado.

## Regresión

Sin cambios en `fuente.js` (ninguna de las dos tablas/bucket tiene consumidor en el
frontend). Suite completa del proyecto — sin regresiones.

## Estado de main/producción/QA

`main` sin tocar. Dos migraciones aplicadas en **QA únicamente**, autorizadas
explícitamente por el usuario ("Sí, corrige ambos ahora en QA") antes de ejecutarse.
Producción y TPV sin tocar.

**PM21_P02_CIERRE_CORRECCIONES=PASS**
