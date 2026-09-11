# PM26 P08a — Defecto L: preparación en solo lectura (producción)

## Estado

**PREPARADO. NO APLICADO.** El usuario autorizó exactamente esto:
preparar el Defecto L en solo lectura, incluyendo migración propuesta,
preflight, rollback y plan de pruebas — **sin aplicar nada en
producción**. Este paquete cumple ese alcance y no más: ninguna
escritura se realizó en `L&A Suite` (producción), QA ni TPV.

---

## 1. Reinspección en vivo, solo lectura (2026-09-11)

Antes de diseñar nada se repitió, contra el proyecto **L&A Suite**
(`ACTIVE_HEALTHY`, identidad confirmada por nombre y estado
inmediatamente antes de consultar), la inspección de `prefiltros_candidatos`
ya hecha en `P06D_AVISO_F_PRODUCCION_SOLO_LECTURA.md`, para no asumir
que el estado seguía igual:

| Comprobación | Resultado |
|---|---|
| Filas totales | **0** (sin cambio desde P06d) |
| Columnas | `token, creado_en, candidato_nombre, estado, respuestas, resumen, completado_en, expira_en` — sin `empresa_id`/`local_id` |
| RLS | activado (`relrowsecurity=true`) |
| Políticas | 3, sin cambio: `prefiltros - propietario lee/crea/borra`, todas exigiendo únicamente `perfiles.rol = 'Propietario'` y `perfiles.activo = true`, sin ninguna referencia a empresa/local |
| Grants de `authenticated` | `SELECT`, `INSERT`, `DELETE` (sin `UPDATE`) — sin cambio |
| Función adicional relacionada | `public.registrar_intento_prefiltro` — limitador de intentos por clave hash, ajeno al aislamiento empresa/local, no se toca |

**Hallazgo nuevo, no visto en P06d:** producción **no tiene** los
helpers `private.pm11_puede_ver_personal` / `private.pm11_puede_mutar_personal`
que sí existen en QA. El esquema `private` de producción tiene sus
propios helpers, ya probados y en uso real:

- `private.la_usuario_activo()`
- `private.la_tiene_empresa(p_empresa text)`
- `private.la_tiene_local(p_empresa text, p_local text)`

`private.la_tiene_local` ya se usa hoy, en producción, como condición
de las políticas de `SELECT` de `movimientos_stock`,
`stock_operaciones` y `stock_ubicacion` (verificado por consulta
directa a `pg_policy`). Es el motor de aislamiento ya autoritativo del
proyecto — **esta propuesta lo reutiliza tal cual, sin inventar una
lógica nueva**, en vez de portar el diseño de QA.

## 2. Por qué esta propuesta NO copia el SQL de QA

`P06H_AVISO_F_DISENO_DESPLIEGUE.md` (aviso F, ya aplicado en QA) usa un
diseño distinto porque el esquema QA es distinto:

| | QA (P06h/P07c) | Producción (esta propuesta) |
|---|---|---|
| Helper de autorización | `private.pm11_puede_ver_personal`/`pm11_puede_mutar_personal` (no existen en producción) | `private.la_tiene_local` (ya vigente en producción, no existe en QA) |
| Escritura | RPC (`SECURITY DEFINER`), mutaciones directas revocadas | RLS directo — arquitectura ya existente, no se introduce RPC |
| Roles admitidos | Propietario y Encargado | Solo Propietario (igual que hoy — no se amplía el alcance de quién puede usar el flujo) |

Instrucción explícita del traspaso: "no copiar automáticamente el SQL
QA suponiendo que ambos esquemas son iguales". Se siguió al pie de la
letra tras comprobar que, en efecto, no lo son.

## 3. Migración propuesta

Archivo (fuera de `supabase/`, **nunca aplicada**):
`tests/pm26/p08-defecto-l-produccion/migracion-propuesta.sql`
(124 líneas).

SHA-256: `9de383864b17f905432cba7bb41aad28bbe859ecfa8b959d23c4432a6cfdcdd9`

Contenido, en orden: `BEGIN` → `SET LOCAL lock_timeout`/`statement_timeout`
→ preflight embebido (bloque `DO $$ ... $$`, idéntico byte a byte al
preflight independiente, verificado por contrato) → `ALTER TABLE ADD
COLUMN empresa_id/local_id text NOT NULL` (seguro porque el preflight
ya confirmó 0 filas) → recreación de las 3 políticas, añadiendo
`AND private.la_tiene_local(empresa_id, local_id)` a la condición de
rol ya existente (que se conserva intacta, no se sustituye) → `COMMIT`.

El preflight comprueba, antes de nada: (1) que las 3 políticas
originales existen con su texto exacto (normalizado de espacios) —
si no coincide, el catálogo no es el esperado y aborta; (2) que las
columnas nuevas no existen ya; (3) que `private.la_tiene_local(text,
text)` existe con la firma esperada; (4) que la tabla tiene 0 filas.
Cualquier fallo aborta con `PREFLIGHT_FALLO` y un mensaje explícito.

## 4. Preflight independiente

`tests/pm26/p08-defecto-l-produccion/preflight-independiente.sql`
(68 líneas) — de solo lectura, termina siempre en `ROLLBACK`.

SHA-256: `b15cef52f9d584e60119be90ffbf7aa2d2c51be51bea9340a46182c47c3d8fe2`

Su bloque crítico (entre los marcadores `PM26_P08_PREFLIGHT_INICIO` /
`PM26_P08_PREFLIGHT_FIN`) es **idéntico byte a byte** al embebido en la
migración propuesta — verificado por el contrato de este paquete, no
solo afirmado.

## 5. Rollback

`tests/pm26/p08-defecto-l-produccion/revertir.sql` — restaura las 3
políticas originales con su texto exacto y retira las dos columnas
nuevas. No restaura ningún grant, porque esta propuesta no cambia
ningún grant de tabla (a diferencia del aviso F en QA, aquí no hay
`REVOKE`/`GRANT` de por medio — la arquitectura de escritura directa
por RLS no cambia).

## 6. Plan de pruebas — ejecutado en aislamiento, nunca contra QA ni producción

`tests/pm26/p08-defecto-l-produccion/`: `schema.sql` reproduce, en un
Postgres local aislado, el subconjunto exacto de esquema de
**producción** verificado en la sección 1 (columnas, las 3 políticas
reales con su texto exacto, y copias literales de
`la_usuario_activo`/`la_tiene_empresa`/`la_tiene_local`, sin
modificarlos). `seed.sql`: 5 identidades sintéticas — Propietario con
`todos_locales`, Propietario limitado a un local, un rol no-Propietario
en ese mismo local, un Propietario de otra empresa, y un Propietario
con el perfil marcado inactivo.

**Batería de comportamiento** (`comportamiento.sql`), corriendo como
rol `authenticated` (nunca como superusuario):

- P1/P2: Propietario con `todos_locales` crea en dos locales distintos
  de su empresa.
- P3: Propietario limitado a un local crea en ese local.
- N4: ese mismo Propietario no puede crear en otro local de su empresa
  (`INSERT` bloqueado por RLS con error real `insufficient_privilege`).
- N5: Propietario de otra empresa no puede crear.
- N6: un rol no-Propietario (aunque esté en el local correcto) no
  puede crear — la restricción de rol original se conserva.
- N7: un perfil Propietario pero marcado `activo=false` no puede crear.
- N8: sin identidad (`auth.uid()` nulo) no puede crear.
- P9: `SELECT` como Propietario con `todos_locales` ve solo las 3 filas
  de su empresa.
- N10: Propietario de otra empresa ve 0 filas.
- P11: el Propietario limitado a un local borra su propia fila.
- N12: ese mismo Propietario intenta borrar una fila de otro local de
  su empresa — a diferencia del `INSERT` (que lanza excepción), un
  `DELETE` bloqueado por `USING` simplemente no afecta ninguna fila,
  sin excepción; se comprueba explícitamente que la fila ajena sigue
  existiendo después.
- N13: borrar un token inexistente no afecta filas ni lanza excepción.

**Resultado, reproducido dos veces de forma independiente, mismo
resultado ambas veces:** preflight pasa sobre el catálogo limpio;
preflight rechaza un catálogo simulado distinto (una política
renombrada temporalmente, restaurada explícitamente después, sin
dejar rastro) y una fila simulada existente (insertada y borrada
explícitamente, sin dejar rastro); migración se aplica limpia; los 14
casos de comportamiento pasan; reaplicar la migración completa
inmediatamente después falla con `PREFLIGHT_FALLO`; reversión exacta
confirmada (columnas retiradas); preflight vuelve a pasar limpio tras
revertir; reaplicación limpia final.

## 7. Riesgo e impacto — por qué esto NO debe aplicarse solo

**Riesgo bloqueante identificado:** en cuanto `empresa_id`/`local_id`
pasen a `NOT NULL`, cualquier intento de `INSERT` del cliente de
producción actual (sin esos dos campos, porque hoy no existen)
violaría la restricción `NOT NULL` y el alta de un prefiltro de
candidato dejaría de funcionar en producción. Esta migración, aplicada
sola, **rompería una función real y en uso** — a diferencia de QA,
donde el cliente aún no llamaba en producción al flujo equivalente sin
antes coordinar la Fase B.

Por tanto, aplicar esta migración requiere, en el mismo cambio,
actualizar también el cliente de producción (`fuente.js` servido desde
`release`) para que envíe `empresa_id`/`local_id` al crear un
prefiltro — el equivalente, en producción, a la Fase B del aviso F en
QA. **Ese cambio de cliente no es parte de esta preparación** y
requeriría su propia autorización explícita y separada, porque implica
modificar el código servido en producción.

Riesgos adicionales considerados y descartados:
- **Backfill**: no aplica — 0 filas confirmadas en el momento de la
  inspección y reconfirmadas por el preflight en el momento de aplicar.
- **Bloqueos**: `lock_timeout`/`statement_timeout` limitan cualquier
  bloqueo por actividad concurrente a un fallo limpio, nunca una
  espera indefinida.
- **Otros consumidores de las 3 políticas**: no se encontró ninguna
  otra tabla ni política que dependa del texto exacto de estas 3
  políticas de `prefiltros_candidatos`.
- **`registrar_intento_prefiltro`**: opera sobre una clave hash sin
  relación con empresa/local; esta propuesta no lo toca ni lo afecta.

## Qué NO se hizo

- No se aplicó ningún cambio en producción, QA ni TPV.
- No se copió el diseño de QA sin verificar antes las diferencias
  reales de esquema.
- No se tocó `fuente.js`, `main`, `release`, Netlify ni Supabase en
  escritura.
- No se amplió el alcance de quién puede usar el flujo (sigue
  exigiendo rol Propietario, igual que hoy).
- No se leyó, mostró ni registró ninguna fila individual de
  producción — solo conteos, estructura, políticas y grants agregados.

```
PM26_P08A_ESTADO=PREPARADO_NO_APLICADO
PM26_P08A_REINSPECCION_SOLO_LECTURA=SI
PM26_P08A_FILAS_PRODUCCION_EN_INSPECCION=0
PM26_P08A_COPIA_CIEGA_DISENO_QA=NO
PM26_P08A_HELPER_REUTILIZADO=private.la_tiene_local
PM26_P08A_MIGRACION_PROPUESTA_PRESENTADA=SI
PM26_P08A_PREFLIGHT_PRESENTADO=SI
PM26_P08A_ROLLBACK_PRESENTADO=SI
PM26_P08A_PLAN_PRUEBAS_EJECUTADO_AISLADO=SI
PM26_P08A_BATERIA_CASOS=PASS
PM26_P08A_RIESGO_BLOQUEANTE_CLIENTE_PRODUCCION=SI
PM26_P08A_FASE_CLIENTE_PRODUCCION_AUTORIZADA=NO
PM26_P08A_APLICADO_EN_PRODUCCION=NO
PM26_P08A_APLICADO_EN_QA=NO
```

Pendiente de que el usuario decida si autoriza, por separado y de
forma explícita, (1) aplicar esta migración en producción y (2) el
cambio coordinado del cliente de producción que la migración exige
para no romper el alta de prefiltros. Ninguna de las dos cosas se
ejecuta con esta preparación. Quedan Aviso G y PM25–P02 sin tocar.
