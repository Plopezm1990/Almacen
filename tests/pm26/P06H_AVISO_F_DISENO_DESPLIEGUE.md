# PM26 P06h — Aviso F: diseño estricto (Opción B), validación aislada

## Estado

**SQL preparado y validado en aislamiento; cliente preparado en P07b.
No autorizado a aplicarse en QA.** Responde a la decisión del usuario
(Opción B) sobre el aviso F:
mantener para QA el diseño estricto de aislamiento por empresa/local,
sin copiar el diseño de producción (registrado aparte como Defecto L,
sin corregir). P07b corrige el Defecto K y prepara la Fase B del cliente,
pero no despliega el cliente ni aplica este SQL.

Addenda de preflight P07c: antes de la aplicación, la inspección real de QA
detectó que sus `ALTER DEFAULT PRIVILEGES` conceden `EXECUTE` directamente a
`anon`, `authenticated` y `service_role` para funciones nuevas de `public`.
La versión anterior retiraba `PUBLIC`, pero ese `REVOKE` no elimina grants
directos. La migración quedó endurecida para retirar expresamente los cuatro
orígenes (`PUBLIC`, `anon`, `authenticated`, `service_role`) y volver a
conceder únicamente `authenticated`. No se escribió en QA para descubrirlo.

---

## 1. Decisión Opción B confirmada

El usuario eligió explícitamente la Opción B: aislamiento obligatorio
por empresa y local; lectura mediante RLS; escritura exclusivamente
mediante RPC; permisos para Propietario/Encargado según
`private.pm11_puede_ver_personal`/`private.pm11_puede_mutar_personal`
(ya vigentes en QA, sin modificarlos); `INSERT`/`UPDATE`/`DELETE`
directos revocados. El diseño inseguro/permisivo de producción
(`Defecto L` — ver `P06G_DEFECTO_L_SIN_AISLAMIENTO_PRODUCCION.md`) no
se replica en QA.

## 2. Migración combinada — por qué es segura aquí

En un entorno con filas existentes, esto exigiría dos migraciones
separadas:

- **Fase A (aditiva)**: columnas nullable, RPC, política de lectura,
  revocar mutaciones directas.
- **Fase C (endurecer)**: `NOT NULL` en `empresa_id`/`local_id`, solo
  cuando un preflight confirma que ninguna fila quedaría inválida
  (backfill previo).

QA y producción tenían **0 filas** en `prefiltros_candidatos` en el
momento del conteo agregado autorizado (`P06D_AVISO_F_PRODUCCION_SOLO_LECTURA.md`).
Por eso `supabase/qa-solo/pm26_p06h_aislamiento_prefiltros_candidatos.sql`
combina A y C en un solo archivo: el preflight embebido vuelve a
comprobar, en el momento mismo de aplicar, que la tabla sigue vacía —
si no lo estuviera, **aborta explícitamente** en vez de imponer
`NOT NULL` a ciegas, dirigiendo al diseño en dos fases.

El preflight también comprueba, antes que nada, que ninguna de las 3
políticas reales de producción (`prefiltros - propietario ...`) existe
sobre la tabla — a diferencia del aviso H (donde aplicarlo por error a
producción simplemente fallaría por nombres de política inexistentes),
aplicar esto a producción sería **activamente dañino**: producción
concede hoy `INSERT`/`DELETE` directos a `authenticated`, y el `REVOKE`
de este archivo rompería ese acceso real ya en uso. El preflight aborta
si detecta esas políticas: su presencia demuestra un catálogo incompatible.
Su ausencia es solo una condición necesaria y no sustituye la identificación
explícita del proyecto QA antes de una futura aplicación.

Los límites `SET LOCAL lock_timeout = '5s'` y
`SET LOCAL statement_timeout = '30s'` aparecen inmediatamente después de
`BEGIN`, por lo que cubren también el preflight embebido y no sobreviven a
la transacción. Existe además un preflight independiente de solo lectura en
`tests/pm26/p06h-f-aislado/preflight-catalogo.sql`: su bloque crítico es
byte a byte idéntico al de este SQL y termina en `ROLLBACK`.

## 3. Fases de despliegue

1. **Fase A+C combinada (este archivo)**: columnas `empresa_id`/
   `local_id` (`NOT NULL` directo, seguro porque el preflight garantiza
   0 filas), política `prefiltros_candidatos_select_gestion` (RLS,
   lectura), RPC `pm11_crear_prefiltro_candidato` /
   `pm11_eliminar_prefiltro_candidato` (escritura, `SECURITY DEFINER`,
   `search_path` vacío, empresa/local fijados en el servidor — nunca
   aceptados del cliente), `EXECUTE` retirado de `PUBLIC`, `anon`,
   `authenticated` y `service_role` antes de concederlo solo a
   `authenticated`, `REVOKE` de `INSERT`/`UPDATE`/`DELETE`
   directos, `GRANT SELECT` a `authenticated`. **No aplicada en QA
   todavía.**
2. **Fase B — PREPARADA EN P07b, SIN DESPLEGAR**: la fuente canónica y
   `fuente.js` llaman a `pm11_crear_prefiltro_candidato` y
   `pm11_eliminar_prefiltro_candidato`; el listado continúa siendo
   `SELECT` directo protegido por RLS. Crear usa empresa/local activos y
   eliminar usa empresa/local de la propia fila. P07b corrige también el
   Defecto K, de modo que la ruta pública deriva su Edge Function de la
   `NUBE_URL` activa y falla cerrada ante configuración QA incoherente.
   Nada de esto autoriza ni implica un despliegue en QA.
3. **Orden exigido**: Fase A+C y Fase B deben aplicarse en el mismo
   cambio (migración + despliegue del cliente), nunca la primera sin
   la segunda inmediatamente detrás, para no romper temporalmente la
   pantalla de selección de personal.

## 4. Validación aislada (Postgres local, nunca QA ni producción)

`tests/pm26/p06h-f-aislado/`: `schema.sql` (copia literal del
subconjunto de esquema QA relevante, incluidos los 4 helpers
`private.*` ya vigentes, sin modificarlos), `seed.sql` (4 usuarios: dos
empresas, Propietario con `todos_locales`, Encargado de un local
concreto, un rol Básico sin permisos de gestión), `comportamiento.sql`
(15 casos), `revertir.sql`, `validar.sh` (orquesta todo el ciclo).

**Batería de 15 casos** (positivos y negativos de rol, empresa, local y
tokens), todos ejecutados como el rol `authenticated` (nunca como
superusuario, que saltaría todos los `GRANT`/RLS):

- P1/P2: Propietario (`todos_locales`) crea en dos locales distintos de
  su empresa.
- P3: Encargado crea en su propio local.
- N4: Encargado no puede crear en otro local de la misma empresa.
- N5: Propietario de una empresa no puede crear en otra empresa.
- N6: rol Básico (no Propietario/Encargado) no puede crear.
- N7: sin identidad (`auth.uid()` nulo) no puede crear.
- N8: `local_id` vacío, rechazado.
- P9: `SELECT` como Propietario ve solo las filas de su empresa.
- N10: Propietario de otra empresa ve 0 filas (aislamiento por RLS).
- P11: Encargado elimina un token de su propio local.
- N12: Encargado, autorizado sobre su propio contexto declarado, no
  puede eliminar un token que en realidad pertenece a otro local de la
  misma empresa (`prefiltro_candidato_contexto_no_coincide`, distinto
  del rechazo por falta de autorización).
- N13: eliminar un token inexistente devuelve `false`, sin excepción.
- N14/N15: `INSERT`/`DELETE` directos (sin pasar por la RPC) quedan
  revocados (`insufficient_privilege`).

El arnés reproduce además los tres grants directos por defecto observados en
QA para funciones nuevas. Tras aplicar la migración comprueba para ambas RPC
que `authenticated` conserva `EXECUTE` y que `anon`/`service_role` no lo
conservan, aunque el catálogo de partida sí concediera esos privilegios.

**Resultado reproducible en PostgreSQL local aislado:**

- El preflight independiente pasa sobre el catálogo limpio y su bloque
  crítico coincide byte a byte con el embebido.
- Preflight rechaza un catálogo simulado de producción; la única política
  de fixture se retira explícitamente después y no deja rastro.
- Preflight rechaza una fila simulada existente; la única fila de fixture
  se retira explícitamente después y no deja rastro.
- Migración se aplica limpia; los 15 casos pasan.
- La simulación de ACL de Supabase pasa y ambas RPC quedan ejecutables solo
  por `authenticated`.
- Reaplicar la migración completa inmediatamente después **falla**
  con `PREFLIGHT_FALLO` (columnas/política/funciones ya existen) — igual
  que el aviso H endurecido, un rechazo explícito, no un no-op
  silencioso.
- Reversión exacta: retira columnas, política y funciones; revoca
  `SELECT`; **no** restaura `INSERT`/`UPDATE`/`DELETE` para
  `authenticated` porque QA nunca los tuvo concedidos (confirmado en la
  investigación previa del aviso F).
- Tras revertir y limpiar las filas de prueba de la propia batería (no
  parte de la reversión real — un revert real no debe borrar datos;
  esto es limpieza del propio arnés de prueba aislado), la migración
  se reaplica limpia de nuevo.

## 5. Archivo final y SHA-256

Archivo: `supabase/qa-solo/pm26_p06h_aislamiento_prefiltros_candidatos.sql`
(152 líneas) — vive en `supabase/qa-solo`, no en `supabase/migrations`,
igual que el aviso H, por el mismo motivo (invisible para la CLI de
Supabase y para cualquier cadena de CI/CD, verificado con la misma
prueba de exclusión ya usada para H).

SHA-256: `7edbeefd92e82bb806265d29ccf3a2c30e411b4c4f5ec654f05e969ec19d5b1a`

Preflight independiente:
`tests/pm26/p06h-f-aislado/preflight-catalogo.sql`
(48 líneas), SHA-256:
`a224fc1dd0501f5336ff86acf8f81c0d6f329676a8913b5713ef5ebd540325d9`.

## Qué NO se hizo

- No se aplicó nada en QA ni en producción.
- P07b sí preparó `fuente.js` y la fuente canónica; no se desplegaron.
- No se corrigió el Defecto L (ausencia de aislamiento en producción).
- No se tocó `main`, `release`, Netlify, ni TPV.

```
PM26_P06H_OPCION_B_CONFIRMADA=SI
PM26_P06H_MIGRACION_COMBINADA_JUSTIFICADA_0_FILAS=SI
PM26_P06H_PREFLIGHT_DETECTA_PRODUCCION=SI
PM26_P06H_PREFLIGHT_DETECTA_FILAS_EXISTENTES=SI
PM26_P06H_PREFLIGHT_INDEPENDIENTE_IDENTICO=SI
PM26_P06H_FASE_B_CLIENTE_PREPARADA_P07B=SI
PM26_P06H_FUENTE_JS_TOCADO_EN_P07B=SI
PM26_P06H_BATERIA_15_CASOS=PASS
PM26_P06H_REAPLICACION_RECHAZADA_POR_PREFLIGHT=SI
PM26_P06H_REVERSION_EXACTA=SI
PM26_P06H_RPC_EXECUTE_SOLO_AUTHENTICATED=SI
PM26_P06H_SHA256_CALCULADO=SI
PM26_P06H_APLICADO_EN_QA=NO
PM26_P06H_APLICADO_EN_PRODUCCION=NO
```

Pendiente de que el usuario confirme los gates remotos en verde y
autorice específicamente aplicar esta migración en QA dentro de P07c.
PM25 P02 continúa
PARCIAL/BLOQUEADO. Defecto E sigue esperando el cambio manual del
usuario en Netlify. No se toca `main`, `release`, Netlify, Supabase en
escritura, QA, producción ni TPV.
