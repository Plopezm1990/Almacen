# PM26 P06d — Aviso F: verificación de solo lectura en producción

## Estado

**Solo lectura, autorizada explícitamente por el usuario para este
alcance exacto.** Ningún cambio aplicado. Ninguna fila individual
leída, descargada, registrada ni mostrada — la tabla tiene 0 filas, así
que esa restricción no llegó a ser relevante en la práctica, pero se
respetó el límite de la consulta desde el principio (solo agregados y
metadatos).

Consultas ejecutadas contra el proyecto de producción, exactamente las
4 autorizadas:

1. Existencia y estructura de la tabla.
2. Número total de filas.
3. Políticas, RLS y permisos actuales.
4. Existencia de las columnas `empresa_id`/`local_id`.

Nada más se consultó contra producción.

---

## 1. Estructura de `prefiltros_candidatos` en producción

Idéntica a QA — mismas columnas, mismos tipos, mismos valores por
defecto:

| Columna | Tipo | Nullable | Default |
|---|---|---|---|
| `token` | text | NO | — |
| `creado_en` | timestamptz | NO | `now()` |
| `candidato_nombre` | text | NO | — |
| `estado` | text | NO | `'pendiente'` |
| `respuestas` | jsonb | sí | — |
| `resumen` | jsonb | sí | — |
| `completado_en` | timestamptz | sí | — |
| `expira_en` | timestamptz | NO | `now() + 7 days` |

## 2. Número total de filas

**0.** No hay backfill que resolver — no hay ninguna fila existente
cuyo `empresa_id`/`local_id` haya que rellenar ni migrar.

## 3. Políticas, RLS y permisos reales en producción — hallazgo crítico

**Producción no está en el mismo estado que QA.** QA tiene RLS
activado sin ninguna política y sin ningún `GRANT` a `authenticated`
(bloqueo total). Producción tiene **tres políticas reales, ya
desplegadas, y `GRANT`s activos**:

| Política | Comando | Condición |
|---|---|---|
| `prefiltros - propietario lee` | `SELECT` | `EXISTS (SELECT 1 FROM perfiles p WHERE p.user_id = (SELECT auth.uid()) AND p.activo = true AND p.rol = 'Propietario')` |
| `prefiltros - propietario crea` | `INSERT` | mismo `WITH CHECK` |
| `prefiltros - propietario borra` | `DELETE` | mismo `USING` |

`GRANT`s a `authenticated`: `SELECT`, `INSERT`, `DELETE` (no `UPDATE`
— coherente con que la aplicación nunca actualiza esta tabla, solo
crea/lista/elimina).

**Diferencias estructurales frente al diseño que propuse para QA**
(`P06B_AVISO_F_DISENO_CORREGIDO.md`), ninguna decidida todavía:

1. **Producción exige `rol = 'Propietario'` únicamente** (columna
   `perfiles.rol`, el enum amplio) — no distingue `Encargado`, y no usa
   `membresias_usuario` en absoluto para esta tabla.
2. **Producción no tiene ninguna restricción por empresa o local.** La
   condición de la política solo comprueba el rol global del usuario
   que llama — no compara contra ninguna columna `empresa_id`/`local_id`
   (que, además, no existen — punto 4). Un `Propietario` autenticado
   puede leer/crear/borrar prefiltros de **cualquier** empresa, no solo
   la suya.
3. **Producción resuelve todo con RLS directo — sin ninguna RPC.** No
   hay `pm11_puede_ver_personal` ni `pm11_puede_mutar_personal`
   involucrados; el propio `INSERT`/`DELETE` directo del cliente está
   permitido, con la política como único control.
4. **Producción ya usa el patrón `(select auth.uid())`** (el mismo que
   propone el aviso H para QA) — sus políticas no tienen el problema de
   rendimiento `auth_rls_initplan` que sí tienen las de QA.

Esto significa que mi diseño corregido para QA
(`private.pm11_puede_mutar_personal`, aislamiento por empresa/local,
RPC para mutar) **no reproduce lo que ya existe y funciona en
producción** — construye algo más estricto y más alineado con el
patrón de `empleados`, pero diferente de la autoridad real que ya
corre en producción para esta tabla en concreto.

## 4. Columnas `empresa_id`/`local_id`

**No existen en producción**, igual que en QA. Confirmado en la
sección 1 — la lista completa de columnas no incluye ninguna de las
dos.

---

## Decisión que hace falta antes de seguir

No se ha decidido nada — se presenta la divergencia para que el
usuario elija, no se asume ninguna opción:

**Opción A — Alinear QA con el diseño real de producción.** Migrar QA
a las mismas 3 políticas (`Propietario` únicamente, sin
empresa/local, RLS directo sin RPC), en vez del diseño más elaborado
que propuse. Más simple, coherente con lo que ya funciona en
producción — pero **hereda también la ausencia de aislamiento
multiempresa que ya tiene producción hoy**, si esta instalación llega
a tener más de una empresa activa.

**Opción B — Mantener el diseño más estricto para QA** (el ya
presentado: `Propietario`/`Encargado` con aislamiento por
empresa/local vía `pm11_puede_mutar_personal`, RPC para mutar) **y
registrar aparte, como un defecto nuevo de producción**, que
`prefiltros_candidatos` en producción no aísla por empresa/local hoy —
sin corregirlo todavía, solo documentarlo, como se hizo con el defecto
K.

**Opción C** — alguna combinación o algo distinto que el usuario
prefiera plantear.

No se ha tocado nada en producción ni en QA para este punto. No se
elige ninguna opción aquí.

## Qué NO se hizo

- No se leyó, descargó, registró ni mostró ninguna fila individual
  (no había ninguna).
- No se escribió nada en producción ni en QA.
- No se decidió ninguna de las tres opciones.
- No se preparó ninguna migración.

```
PM26_P06D_ESTADO=SOLO_LECTURA_COMPLETO
PM26_P06D_PRODUCCION_FILAS_TOTALES=0
PM26_P06D_PRODUCCION_TIENE_POLITICAS_REALES=SI
PM26_P06D_PRODUCCION_DISEÑO_DIVERGE_DEL_PROPUESTO_PARA_QA=SI
PM26_P06D_PRODUCCION_AISLAMIENTO_EMPRESA_LOCAL=NO
PM26_P06D_COLUMNAS_EMPRESA_LOCAL_EXISTEN_EN_PRODUCCION=NO
PM26_P06D_FILAS_INDIVIDUALES_LEIDAS=NO
PM26_P06D_ESCRITURA_APLICADA=NO
PM26_P06D_DECISION_TOMADA=NO
```

PM25 P02 continúa PARCIAL/BLOQUEADO. No se toca `main`, `release`,
Netlify, Supabase en escritura, QA, producción ni TPV.
