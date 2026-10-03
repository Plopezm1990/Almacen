# F7 · CI de la capa de configuración · resultado

Fecha: 2026-10-03
Autorización: Pedro eligió «Preparar antes lo que no toca producción» (3/10/2026): registrar las pruebas nuevas en el manifiesto de CI, crear el flujo de CI para los contratos SQL de configuración y escribir y probar la corrección de PM07.
Estado: `HECHO_PROBADO_EN_LOCAL_Y_EN_VERDE_EN_GITHUB` (25 de 25 comprobaciones del PR 118 sobre el commit `c66da24`, 3/10/2026 15:15 UTC)
Alcance: solo repositorio, réplica local y QA con `ROLLBACK`. **Producción no se ha tocado** (la foto de solo lectura es del paso anterior). Los flujos de GitHub no se pueden ejecutar desde aquí: primero se probó el mismo código en local y después se miró el resultado real en GitHub (§5).

## 1. Qué se ha hecho

| Pieza | Qué es |
|---|---|
| Manifiesto de CI | Registradas las **33** pruebas nuevas (30 contratos activos y 3 utilidades), todas `node`. Total: **241 archivos, 224 contratos activos, 11 utilidades** (antes 208, 194 y 8). Node: **201** activos y 10 utilidades. Validador, manifiesto y «Puerta de CI general» actualizados a los mismos números |
| Dependencias | Las pruebas de ejecución necesitan `react`, `react-dom`, `jsdom`, y el contrato de alcance `acorn` y `eslint-scope`, que no están en el repositorio. La puerta de CI los instala **fuera del árbol** en un paso nuevo, con versiones fijadas: react 18.3.1, react-dom 18.3.1, jsdom 24.1.3, acorn 8.17.0 y eslint-scope 8.4.0, y exporta `CFG6_UI_DEPS`, `CFG6E_UI_DEPS` y `CFG_SCOPE_DEPS` |
| Contratos SQL | Script `tests/cfg/ci/ejecutar_contratos_sql.sh` y flujo nuevo `abc-f6-config-contract.yml`: PostgreSQL 16 efímero, **cadena construida desde cero** (esquema de prueba, 19 migraciones F2/F3, A10, A10b, B04, PM10 cierre, C04, piezas 1 a 5, D13, 6d y A09 eventos) y ejecución de `cfg1` (102 comprobaciones), `cfg2` (201), `cfg3` (79), `cfg4` (72), `cfg5` (154), `cfg6d` (56), `d13` (85), `a09-eventos` (40), la prueba de actualización de D13 y el contrato de la corrección de PM07. Cada uno exige **cero fallos y su número exacto de comprobaciones** |
| Corrección de PM07 | Migración `20261003130000_abc_pm07_correccion_numero_catalogo.sql` con su contrato vivo y estático (informe: `F7_PROMOCION_PRODUCCION_FOTO_RESULTADO_2026-10-03.md`, §8). **No aplicada en producción** |

## 2. Pruebas hechas

| Prueba | Resultado |
|---|---|
| Validador del manifiesto (`validar-manifiesto-ci.mjs`) y sus pruebas negativas | OK: 241 / 224 / 11 / 5; `--self-test` pasa |
| **Batería Node de la puerta de CI**, tal cual la ejecuta el flujo (`tests/ci/ejecutar_bateria_no_db.sh`, con `npm install` de Tailwind 3.4.17, las dependencias de arriba y **Node 20.19.5**, en un árbol limpio) | **201 de 201 contratos activos, 8 utilidades, 5 diagnósticos, 0 fallos de infraestructura, árbol limpio al terminar** |
| Las 30 pruebas nuevas con Node 20.19.5 y con Node 22 | 30/30 en ambos; la más lenta tarda unos 5 s (el límite del ejecutor es 60 s) |
| Contratos SQL en un **clúster PostgreSQL 16 nuevo y limpio** (sin mis plantillas), 5 s en total | `cfg1` 102/102, `cfg2` 201/201, `cfg3` 79/79, `cfg4` 72/72, `cfg5` 154/154, `cfg6d` 56/56, `d13` 85/85, `a09-eventos` 40/40, actualización de D13 OK, PM07 OK |
| Averías provocadas sobre el ejecutor SQL (5): contrato recortado (una comprobación menos), error de SQL a mitad de contrato, avería en la migración de la pieza 5, avería en la de D13, avería en la corrección de PM07 | **5/5 detectadas** (por número de comprobaciones, por falta de resumen, por fallos del contrato, por la prueba de actualización y por el contrato de PM07) |
| Los dos YAML (`puerta-ci-release.yml` y `abc-f6-config-contract.yml`) | Se leen bien como YAML |

## 3. Hallazgo: `tests/netlify-publish-boundary.mjs` ya no es un fallo

En el informe de la pieza A09 anoté que ese contrato «falla igual antes del cambio». Era una **copia vieja del build** en mi entorno (`.netlify-dist`, ignorada por git): la batería de CI la reconstruye siempre antes de ejecutarlo, y con la reconstrucción **pasa**. No hay fallo de verdad.

## 4. Qué no se ha podido comprobar

- La **puerta completa** en local: solo pude probar su parte Node. El resto (PostgreSQL 16, PGlite, PostgreSQL 17 y Supabase completo) lo he visto solo en GitHub (§5).
- Los contratos SQL de configuración **no cuentan en los números del manifiesto** (el validador solo cuenta archivos `.mjs`): van en el flujo propio `abc-f6-config-contract.yml`.

## 5. Resultado en GitHub (PR 118)

| Comprobación | Resultado |
|---|---|
| Commit `b5ba70e` (primer push con todo lo anterior) | Node: pasos «Instalar dependencias…» y «201 contratos activos Node» **correctos**; PGlite correcto; `f4-b02-b03` correcto; `abc-f6-config-contract` (contratos SQL de configuración) **correcto en 36 s** sobre PostgreSQL 16.15. **Un fallo:** `tests/f3/a09/local-postgres-contract.mjs` (contrato A09 con PostgreSQL, que tiene carreras entre conexiones) salió con código 1 a los 1,1 s, sin más información que «Node.js v22.23.3»; `gate-final` en rojo por ese único contrato |
| Por qué no se veía antes | Hasta entonces la puerta se paraba en la validación del manifiesto (`inventario=213; esperado=208` y luego 239/240) y **los pasos de PGlite y PostgreSQL 16 se saltaban**: ese contrato no se había evaluado nunca en esta rama |
| Diagnóstico | Con el mismo script (`preparar_postgres_local.sh`) y el mismo código en un PostgreSQL 16 local, **pasa** (1,2 s). Ni mi rama ni el commit de fusión con `release` cambian ese contrato, sus fixtures ni las migraciones F2/A03–A08 que usa. El baseline de `release` (PR 117, 1/10) pasaba la puerta entera |
| Cambio | El ejecutor de Postgres imprime ahora las últimas 40 líneas de salida de un contrato que falla (`tests/ci/preparar_postgres_local.sh`, solo en caso de fallo, sin cambio de conteos) |
| Commit `c66da24` (con ese cambio) | **25 de 25 comprobaciones en verde**: `node-y-postgres` (Node 201/201, PGlite, Postgres 16 19/19 + 1 histórico esperado), `gate-final`, `a09_postgres17`, `pm12-p08-supabase-full`, `pm33-p05-supabase-full`, `f4-b02-b03`, `f4-b04`, `f4-b08` (y sus dos hermanos), `f4-b11-offline`, `c04`…`c12`, `validar` y **`cfg-sql`** |

**Conclusión:** el fallo del contrato A09 en `b5ba70e` **no se reprodujo** ni en local ni en la ejecución siguiente, sin ningún cambio relacionado. Lo trato como **intermitente** (hay carreras entre conexiones en ese contrato), no como un defecto de esta rama, pero **no puedo probar que lo sea**: con una sola muestra no se descarta que dependa de algo del entorno de GitHub. Si vuelve a salir, el registro ya mostrará la causa.
