# supabase/qa-only · funciones de QA sin migración

Hallazgo **H-06** de la auditoría del TPV (25/11/2026). En el servidor de QA había 14 funciones `abc_*` (y una
privada de apoyo) **sin ninguna migración en el repositorio**. Estos archivos son el volcado de su definición
VIVA, leída el 27/11/2026, para poder reproducirlas, revisarlas y detectar deriva.

**Esto NO son migraciones.** No están en `supabase/migrations`, así que no se aplican a producción ni a ningún
otro entorno de forma automática. Cada archivo de `funciones/` es el `CREATE OR REPLACE FUNCTION` exacto
(comprobado byte a byte con el `md5` de `pg_get_functiondef` en QA, sin los `\r`).

| Carpeta o archivo | Qué es |
|---|---|
| `funciones/<esquema>.<nombre>.sql` | Definición de cada función, lista para aplicar en QA. |
| `tablas/abc_vales_regalo.sql` | Definición **leída** de la tabla del vale regalo (tampoco tiene migración). Referencia, no se aplica. |
| `REGISTRO.json` | Para cada función: firma, `md5`, clasificación y nota de seguridad. Lo comprueba el contrato. |

Contrato: `tests/rediseno/h06-funciones-qa-versionadas-contract.mjs`.

## Dos clases de funciones

**1. Solo QA por diseño (7).** Llevan una barrera propia que las limita a `QA-EMP-A` / `QA-A1` y, las
`abc_qa_*`, a Propietario. Aunque llegaran a otro entorno, rechazarían cualquier otra empresa o local:
`abc_qa_confirmar_pago_simulado`, `abc_qa_rechazar_pago_simulado` (nueva, 27/11, H-27: se creó en QA solo con SQL, sin
migración, con `authenticated` sí y `anon` no), `abc_qa_cancelar_pago_cierre`, `abc_qa_compensar_efecto_cierre`,
`abc_qa_listar_pendientes_cierre` (con la privada `private.abc_qa_c04_propietario`) y `abc_preparar_ticket_fiscal_qa`.
`abc_preparar_bizum_qa` no escribe nada: devuelve constantes marcadas `PREPARADO_QA`.

**2. Producto que existe solo en QA (8).** No son simuladores de QA sino funciones de producto que nadie
migró: **vale regalo** (3, con la tabla `abc_vales_regalo`), **ticket por correo** (2), **simuladores de
dispositivo** (cajón e impresora, 2) y **guardar tipo de negocio** (1). Están bien guardadas (capacidad por
local y operación idempotente), pero **si se quieren en producción necesitan su migración real**, con la
tabla y sus contratos. Mientras tanto no existen allí.

## Cómo aplicar en QA

Cada archivo de `funciones/` se ejecuta tal cual contra el proyecto de QA. Después de cambiar una definición
en QA hay que volver a volcarla aquí y actualizar el `md5` en `REGISTRO.json`; el contrato lo exige.
