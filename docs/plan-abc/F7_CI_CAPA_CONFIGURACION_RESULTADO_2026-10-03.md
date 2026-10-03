# F7 · CI de la capa de configuración · resultado

Fecha: 2026-10-03
Autorización: Pedro eligió «Preparar antes lo que no toca producción» (3/10/2026): registrar las pruebas nuevas en el manifiesto de CI, crear el flujo de CI para los contratos SQL de configuración y escribir y probar la corrección de PM07.
Estado: `HECHO_Y_PROBADO_EN_LOCAL_PENDIENTE_VER_EL_RESULTADO_EN_GITHUB`
Alcance: solo repositorio, réplica local y QA con `ROLLBACK`. **Producción no se ha tocado** (la foto de solo lectura es del paso anterior). Los flujos de GitHub **no se han podido ejecutar desde aquí**: lo que se probó es el mismo código que ejecutan, en local.

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

- **Los flujos en GitHub**: son los mismos scripts y versiones que probé en local, pero el entorno de GitHub (imagen `ubuntu-latest`, `postgres:16` como contenedor de servicio, red) puede diferir. Hay que mirar el resultado en el PR 118 tras el push.
- La **puerta completa**: solo he podido probar su parte Node. Los trabajos de PostgreSQL 16 de la puerta, PGlite, PostgreSQL 17 y los de Supabase completo no los toqué ni los probé aquí.
- Las pruebas **Postgres de la puerta** no incluyen los contratos SQL de configuración: van en el flujo propio `abc-f6-config-contract.yml`, que no forma parte de los números del manifiesto (el validador solo cuenta archivos `.mjs`).
- `git push` dispara el PR 118: si algún flujo falla en GitHub por una razón que no veo en local, se corrige con un commit nuevo.
