# PM-04 · Regresión y fixtures desde el inicio · CERRADO

Fecha: 2026-09-04
Rama: `pm04-regresion-fixtures`
Base: cierre PM-03 `7cd75e9672d230ce88625b1a71d82d67d10771db`
Entorno remoto: Supabase **L&A Suite QA** `qjqorixtkilwsndqayyx`
Producción: **NO TOCADA**
Estado: **PM-04 CERRADO**

## Objetivo del paquete

Cumplir PM-04 del Plan Maestro: preparar A1/A2/A cerrado/B1, cuentas separadas y datos sintéticos inequívocos; conservar la evidencia histórica sin mezclarla con un conjunto limpio; crear regresión automatizada para permisos, importes y movimientos; identificar versión/entorno y conservar los fallos de baseline hasta que su paquete de corrección los haga pasar.

## Fixtures montados en QA

Empresas/locales sintéticos:
- `QA-EMP-A` con `QA-A1`, `QA-A2` y `QA-A-CERRADO` (inactivo).
- `QA-EMP-B` con `QA-B1`.

Usuarios Auth reales de QA, todos con correos reservados `.invalid` y credenciales generadas aleatoriamente durante el bootstrap, nunca guardadas en GitHub:
- `owner.a@qa.invalid` · Propietario · A.
- `operator.a1@qa.invalid` · Cajero/a · A1.
- `operator.a2@qa.invalid` · Encargado · A2.
- `owner.b@qa.invalid` · Propietario · B1.
- `inactive@qa.invalid` · Básico · perfil inactivo.

Datos sintéticos:
- marcadores inequívocos de proveedor/cliente/producto A y B;
- stock A1 = 18 almacén + 5 piso = 23 total;
- stock A2 = 8 + 2 = 10;
- stock A cerrado = 4 histórico;
- stock B1 = 5 + 2 = 7;
- movimientos iniciales por A1/A2/B1;
- ejemplo económico: venta 2 × 6 € = 12 €, IVA incluido 10 %, base esperada 10,91 €, IVA 1,09 €, coste 6 €.

Verificación posterior por SQL del propio proyecto QA:
- `auth.users = 5`;
- `perfiles = 5`;
- claves `qa_pm04:% = 21`;
- movimientos fixture `QA-MOV-% = 3`.

## Login real de QA

El bootstrap creó las cuentas mediante Auth Admin del proyecto QA, inició sesión con cada identidad y ejecutó solicitudes REST con su JWT de usuario. La consulta posterior confirma `last_sign_in_at` para las cinco cuentas. Esto permite usar PM-04 como base real para NR-01 y las pruebas negativas posteriores; no sustituye PM-21.

## Baseline automatizado de permisos

GitHub Actions, bootstrap one-shot:
- run `33862997547`;
- job `100991460072`;
- conclusión: **success**.

Resultados reales del backend QA:
- 8 casos de permisos ejecutados;
- 3 positivos/esperados pasan;
- 5 negativos fallan actualmente.

Fallos reproducidos del baseline:
1. Propietario A puede leer marcador de proveedor B.
2. Operador A1 puede leer A2.
3. Operador A1 puede leer B1.
4. Propietario B puede leer marcador de proveedor A.
5. Perfil inactivo autenticado puede leer dato de negocio.

Estos cinco resultados **NO se consideran corregidos**. Son la evidencia “falla antes” exigida por PM-04 y quedan abiertos para PM-05/PM-21. PM-04 monta el fixture y la regresión; no endurece todavía la autorización transversal.

La inspección previa de políticas explica el baseline sin convertir la hipótesis en cierre: `almacen_kv`, `movimientos_registro`, `auditoria_registro`, `fichajes_registro` y `errores_sistema` tienen en QA políticas permisivas para `authenticated`. PM-05 deberá reemplazar ese comportamiento por contratos compatibles con DEC-01 y probar ambos sentidos A/B y A1/A2.

## Contratos de importes y movimientos

El bootstrap comprobó automáticamente cinco invariantes del fixture y todas pasaron:
- total A1 = almacén + piso = 23;
- 12 € IVA incluido al 10 % → base 10,91 €;
- IVA = 1,09 €;
- coste 2 × 3 € = 6 €;
- el caso 24 unidades sobre 23 disponibles queda definido como caso de rechazo para PM-07.

No se afirma aquí que la aplicación ya bloquee la venta 24/23: PM-04 fija el caso y su esperado; PM-07 tendrá que ejecutar la lógica real y demostrarlo.

## Regresión persistente en repositorio

Se añaden y conservan:
- `tests/pm04/fixtures.json`;
- `tests/pm04/contract-tests.mjs`;
- `tests/pm04/baseline-results.json`;
- `tests/pm04/regression-catalog.json` con LA-001…LA-025;
- `.github/workflows/pm04-regresion-base.yml`.

El catálogo conserva los 25 hallazgos del Plan Maestro y los liga a su paquete PM y aceptación mínima. Los casos históricos anteriores siguen siendo evidencia histórica; no se vuelven a contabilizar como progreso por copiarlos.

## Validación de la suite permanente

Workflow permanente: `PM-04 regresión base`.

Validación sobre el paquete documentado:
- run `33863264426`;
- job `100992284672`;
- SHA ejecutado `c971303d066ef1cf0bcd7e499f5dfc85e09206fb`;
- conclusión: **success**.

Pasaron:
- contratos de fixtures;
- catálogo completo LA-001…LA-025;
- evidencia de baseline de permisos;
- comprobación de `productionInteraction=false`.

Tras este run solo se realizó limpieza del workflow temporal y documentación de cierre; no se alteraron fixtures ni lógica de las pruebas permanentes.

## Seguridad y limpieza del bootstrap

El endpoint temporal `qa-pm04-bootstrap` se usó una vez para crear usuarios/fixtures y ejecutar el baseline. Después se desplegó una versión nueva con `verify_jwt=true` que responde `410 disabled`; no queda un bootstrap anónimo reutilizable. Las contraseñas aleatorias no se imprimieron ni guardaron en el repositorio.

El workflow temporal `.github/workflows/pm04-bootstrap-qa.yml` fue eliminado de la rama tras conservar su run y logs como evidencia. La suite permanente de regresión sí permanece.

## Criterio de cierre

PM-04 queda **CERRADO** porque:
- existen A1/A2/A cerrado/B1 sintéticos en backend QA separado;
- existen cinco identidades Auth QA separadas y login probado;
- los datos son sintéticos e inequívocos y no proceden de producción;
- existe catálogo de regresión LA-001…LA-025;
- existe suite automática permanente para fixtures, importes, movimientos y baseline;
- existe evidencia “antes” de cinco negativos de autorización que deberán pasar tras PM-05/PM-21;
- la suite permanente ha pasado sobre un SHA identificado;
- el bootstrap temporal quedó neutralizado y su workflow fue retirado;
- no hubo interacción ni escritura de prueba en producción.

`PM04_ESTADO=CERRADO`

## Rollback

- Código/documentación: descartar la rama `pm04-regresion-fixtures`.
- Datos QA: eliminar únicamente usuarios `@qa.invalid`, claves `qa_pm04:%` y movimientos `QA-MOV-%` del proyecto `qjqorixtkilwsndqayyx`.
- No existe rollback de producción porque no se ha escrito en producción.
