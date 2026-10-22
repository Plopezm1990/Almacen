# P2-SEC — Endurecimiento transversal de Edge Functions

## Base exacta

- release: `e8de01fbdad63bd7fbe57982e3ae978e06d1ca52`.
- Este candidato no modifica `fuente.js` ni Supabase PROD.
- Incluye tres migraciones aisladas: rate limit de prefiltro, P2-SEC-F01 y versionado de `pm11_finalizar_creacion_cuenta_empleado(...)`.
- Las tres Edge Functions fueron validadas en QA y posteriormente promovidas a PROD con autorización separada y postflight satisfactorio.
- La migración de rate limit fue aplicada en QA; PROD ya tenía `registrar_intento_prefiltro(text)` equivalente, por lo que no se reaplica solo para igualar historial.
- P2-SEC-F01 fue cerrada en QA. En PROD es N/A porque `public.pm05_scope_almacen_kv()` no existe allí; no se fuerza la creación de ese objeto histórico.
- No modifica `main` ni PR #38.

## Hallazgos cerrados por diseño

### crear-cuenta-empleado

La variante productiva histórica elevaba a `service_role` después de comprobar únicamente un rol global. El candidato toma la empresa/local exclusivamente de la fila `empleados` obtenida por el servidor y exige una membresía activa `Propietario` que cubra exactamente esa empresa/local antes de crear Auth.

La finalización permanece delegada en `pm11_finalizar_creacion_cuenta_empleado`; si falla, se compensa eliminando o bloqueando la cuenta Auth recién creada.

La auditoría posterior a la promoción confirmó que esa RPC existe en QA y PROD con definición idéntica (MD5 `354cd3754c4e09f56d0645a7599baf88`), `SECURITY DEFINER`, `search_path=public, auth, private, pg_temp` y EXECUTE exclusivo de `service_role`. El candidato ahora la versiona explícitamente para que la dependencia de `crear-cuenta-empleado` no quede fuera del control de código.

### enviar-notificacion

El candidato elimina el modelo global por rol. La empresa/local se resuelve en servidor:

- si llega `localId`, el servidor obtiene su `empresa_id` de `locales`;
- un `empresaId` contradictorio falla cerrado;
- si no hay local ni empresa, un usuario solo puede inferir empresa cuando tiene exactamente una empresa activa;
- las llamadas internas por secreto deben aportar un tenant inequívoco.

Los destinatarios requieren `user_id`, perfil activo y una membresía activa en la misma empresa. Para avisos de local, la membresía debe cubrir ese local. Las suscripciones legacy sin `user_id` ya no reciben avisos.

### prefiltro-candidato

El token público conserva su naturaleza pública, pero el servidor lee `empresa_id/local_id` de la propia fila del token y los transmite al aviso interno. La URL de la función interna se deriva de `SUPABASE_URL`; no hay project ref productivo hardcodeado.

El despliegue QA detectó una dependencia real: `public.prefiltro_limites` existe en QA, pero faltaba `public.registrar_intento_prefiltro(text)`. La migración aislada reconstruye esa RPC con el mismo algoritmo atómico de minuto que PROD, `SECURITY INVOKER`, `search_path=''`, validación HMAC de 64 hex y EXECUTE exclusivamente para `service_role`. No concede acceso directo a la tabla.

### P2-SEC-F01 — EXECUTE residual en función trigger

La auditoría transversal detectó que `public.pm05_scope_almacen_kv()` conservaba `EXECUTE` efectivo para `PUBLIC/anon`. Es una función trigger, no una RPC de negocio, y `anon` no dispone de una vía útil de ejecución directa; aun así, el privilegio incumple mínimo privilegio. La segunda migración revoca exclusivamente `EXECUTE` a `PUBLIC` y `anon`, preserva los grants explícitos de `authenticated` y `service_role`, comprueba que el trigger `pm05_scope_almacen_kv_trg` sigue enlazado a `almacen_kv` y no modifica datos.

## verify_jwt

`edge-security-manifest.json` fija el contrato:

- `crear-cuenta-empleado`: `verify_jwt=true`.
- `enviar-notificacion`: `verify_jwt=false` porque acepta dos credenciales excluyentes: JWT validado en cuerpo de función o secreto interno servidor-servidor.
- `prefiltro-candidato`: `verify_jwt=false` porque es un endpoint público por token opaco, con rate limit HMAC y acceso a fila exacta.

## Pruebas

El gate específico comprueba:

- exact-head sobre esta base;
- alcance exacto de trece archivos;
- `fuente.js` intacto y exactamente tres migraciones SQL dentro del candidato;
- propietario de otra empresa rechazado;
- usuario sin membresía rechazado;
- local ajeno rechazado;
- rol fuera del permitido rechazado;
- suscripciones sin identidad rechazadas;
- destinatarios de otro tenant rechazados;
- wiring tenant-aware de las tres Edge Functions;
- contrato y ACL de `registrar_intento_prefiltro(text)`;
- incremento secuencial y rechazo de claves inválidas;
- 16 incrementos concurrentes sin pérdidas;
- contrato estático y ejecución PostgreSQL efímera de P2-SEC-F01: revocación de `PUBLIC/anon`, preservación de `authenticated/service_role`, continuidad del trigger, preflight y ausencia de DML;
- contrato y ejecución PostgreSQL efímera real de `pm11_finalizar_creacion_cuenta_empleado(...)`: hash certificado, ACL solo `service_role`, alta de perfil/membresía, auditoría e idempotencia de replay;
- regresiones R03A/R03B/R03C/PM11/PM13/P06.

Al abrir PR contra `release`, también debe ejecutarse la puerta general `gate-final` de 133 contratos activos.

## Fronteras de autorización

Este candidato GitHub no autoriza aplicar la migración en QA/PROD, nuevos despliegues Edge, merge a release ni cambio deliberado de Netlify PROD. Cada transición posterior necesita autorización separada.

## Reconciliación histórica QA ↔ PROD — 2026-09-22

Estado posterior al merge de PR #54:

- `release` quedó en `cfd429ed721c54552928581c964196d361c709ce`.
- PR #54 quedó `MERGED`.
- No se aplicaron migraciones adicionales a QA/PROD durante el merge.
- No se redeplegaron Edge Functions.
- Netlify PROD se mantuvo deliberadamente en el deploy anterior porque el candidato no modificó el artefacto web publicado.

La reconciliación se basa en el contrato vivo, no en exigir igualdad nominal de historiales. QA y PROD conservan secuencias de migración diferentes por razones históricas; no se deben normalizar mediante `db push`, `migration repair` ni reaplicaciones artificiales cuando el objeto funcional vivo ya es equivalente o la diferencia está justificada.

### Diferencias verificadas y clasificación

1. **R03A**
   - QA conserva la secuencia histórica post-reset.
   - PROD contiene la variante compuesta endurecida `20260922111934_p2_r03a_restore_pm08_pm09_post_reset_hardened`.
   - Clasificación: **diferencia histórica justificada**. No requiere normalización.

2. **`public.registrar_intento_prefiltro(text)`**
   - QA y PROD exponen la misma definición viva.
   - MD5 en ambos entornos: `710a74b0a1e52321a1876e503f6ec35c`.
   - `SECURITY INVOKER`, `search_path=''`, EXECUTE solo para `service_role`.
   - Clasificación: **equivalencia funcional certificada**. PROD no necesita reaplicar la migración de QA únicamente para igualar el historial.

3. **P2-SEC-F01 / `public.pm05_scope_almacen_kv()`**
   - QA conserva el objeto y tiene revocados `PUBLIC/anon`, preservando `authenticated/service_role`.
   - PROD no contiene `public.pm05_scope_almacen_kv()`.
   - Clasificación: **N/A en PROD**. No se debe crear un objeto histórico inexistente solo para aplicar una revocación.

4. **`public.pm11_finalizar_creacion_cuenta_empleado(...)`**
   - QA y PROD son idénticos por definición.
   - MD5 en ambos: `354cd3754c4e09f56d0645a7599baf88`.
   - `SECURITY DEFINER`.
   - `search_path=public, auth, private, pg_temp`.
   - EXECUTE exclusivo de `service_role`.
   - Clasificación: **equivalencia funcional certificada**. La migración versionada en PR #54 documenta el contrato; no justifica reaplicarlo en un entorno donde ya coincide exactamente.

5. **`public.registrar_auditoria(...)` canónica**
   - La variante de 8 parámetros es idéntica por definición en QA y PROD, MD5 `b2973c713fe81c6f40ff96cd32ba19ac`.
   - QA concede EXECUTE a `authenticated` y `service_role`.
   - PROD concede EXECUTE únicamente a `authenticated` además del propietario `postgres`.
   - Ninguna función SQL viva ni ninguna de las 14 Edge Functions activas de PROD referencia `registrar_auditoria`.
   - Clasificación: **diferencia ACL justificada**. PROD es más restrictivo; no se debe ampliar su ACL solo para igualar QA.

6. **Overloads legacy de `registrar_auditoria` en PROD**
   - QA tiene un único overload, el canónico de 8 parámetros.
   - PROD conserva además:
     - `registrar_auditoria(p_id text, p_usuario text, p_accion text, p_detalle text, p_fecha text, p_hora text)`
     - `registrar_auditoria(p_usuario text, p_accion text, p_detalle text)`
   - Ambos overloads legacy solo son ejecutables por `postgres`; no tienen EXECUTE para `PUBLIC`, `anon`, `authenticated` ni `service_role`.
   - Clasificación: **legacy controlado y cerrado al cliente**. No requiere borrado para cerrar este plan.

7. **Default ACL de funciones en `public`**
   - QA conserva defaults más permisivos para funciones creadas por `postgres`.
   - PROD conserva un default ACL más restrictivo para ese propietario.
   - Clasificación: **diferencia justificada**. No se debe relajar PROD para buscar simetría nominal.

8. **`idx_fichajes_fecha`**
   - QA no contiene un índice con ese nombre.
   - PROD sí conserva `public.idx_fichajes_fecha` sobre `public.fichajes_registro(fecha)`, con definición `CREATE INDEX idx_fichajes_fecha ON public.fichajes_registro USING btree (fecha)`.
   - La reauditoría de Performance Advisors del 2026-09-22 lo clasifica como `unused_index` (INFO).
   - Clasificación: **diferencia histórica real y no bloqueante**. No se elimina de PROD ni se crea en QA solo para buscar simetría; cualquier optimización futura debe basarse en carga representativa y uso real.

### Conclusión de reconciliación

No se detecta ninguna divergencia QA ↔ PROD que exija una migración correctiva solo por paridad histórica.

Criterio final:

- equivalencia funcional viva > igualdad de nombres de migración;
- diferencias más restrictivas en PROD se conservan salvo evidencia funcional contraria;
- objetos históricos ausentes en PROD no se crean para reproducir pasos de QA;
- overloads legacy cerrados al cliente se documentan como residuo controlado;
- no usar `db push` ni `migration repair` para forzar simetría.

**Resultado: RECONCILIACIÓN QA ↔ PROD = CERRADA, sin cambios de base de datos.**

