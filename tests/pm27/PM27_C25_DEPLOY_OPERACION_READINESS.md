# PM27-C25 — Deploy, operación, bloqueos externos y readiness real

Fecha de inspección: 2026-09-14

## Objetivo

C25 no despliega por sí mismo. Su función es decidir, con evidencia viva, si el candidato PM27 está listo para un rollout real y separar con precisión tres cosas distintas:

1. defectos de código;
2. estado de despliegue / drift de entornos;
3. bloqueos externos por plan, coste, permisos o autorización.

C25 parte exclusivamente del cierre certificado de C24:

- C24 final: `e78853ecdb58729055a734a651f99a520fe110f0`.
- Rama C25: `claude/pm27-c25-deploy-operacion-readiness`.
- `main` y `release` permanecen protegidas y no se modifican.
- PR #38 permanece `OPEN + DRAFT + NO MERGE`.

## Resultado de readiness

**C25 CHECKPOINT = PASS solo si el workflow C25 termina SUCCESS sobre el SHA exacto que contiene esta evidencia.**

**PM27 ROLLOUT = NO-GO.**

El NO-GO no representa un FAIL de código del candidato. Representa que producción todavía no cumple el baseline funcional/migratorio que C24 exige y que no existe autorización vigente para escribir, reconciliar ni desplegar en producción.

## GitHub — estado vivo

Verificado en lectura:

- `main`: `93a570badba1c5375febfbddc1dffdbcef003dcd`.
- `release`: `a97740987be57aa9646f6a06e69b2230f140ec5f`.
- PR #38: abierto, draft, no fusionado, head `f297be08708d0bbe566c21347123885cb3095a7c`.
- No existía una rama C25 antes de este trabajo.
- La rama C25 se creó exactamente desde el SHA final de C24.

El workflow C25 fija `actions/checkout` y `actions/setup-node` a SHAs completos. No se reescriben workflows históricos dentro de este checkpoint.

## Netlify — estado vivo

Proyecto: `chic-entremet-9107cf`.

Deploy productivo observado:

- estado: `ready`;
- contexto: `production`;
- rama: `release`;
- commit: `a97740987be57aa9646f6a06e69b2230f140ec5f`;
- deploy id: `6aa62a74fc312e00080cd225`;
- deploy automático, no manual;
- variables de entorno del sitio: `0`;
- acceso SSO de equipo requerido para entornos no productivos.

Conclusión: Netlify producción sigue publicando `release`, no el candidato PM27/C24/C25. C25 no cambia ese estado.

## Supabase — comparación QA vs producción

### Producción — L&A Suite

Proyecto `flqercbgpgmmfaakrwkc`, PostgreSQL 17, estado `ACTIVE_HEALTHY`.

El servicio está operativo, pero el baseline de despliegue PM27 no está listo:

- faltan `public.clientes_empresa`, `public.encargos_empresa` y `public.pagos_encargo`;
- faltan las RPC base de venta/traslado/encargos/pagos que C18–C23 endurecen;
- `descontar_stock_carrito(jsonb,text)` sigue ejecutable por `authenticated`;
- `anular_venta_tpv(text,text)` sigue ejecutable por `authenticated`;
- `obtener_contexto_operativo()` sigue ejecutable por `authenticated`;
- ninguna de las 8 versiones del manifest C24 figura registrada en `supabase_migrations.schema_migrations`;
- el preflight estructural C24 falla cerrado por ausencia del baseline PM14;
- Password Breach Protection figura deshabilitado;
- solo existe la rama Supabase `main`; no hay tercer entorno real disponible.

### QA — L&A Suite QA

Proyecto `qjqorixtkilwsndqayyx`, PostgreSQL 17, estado `ACTIVE_HEALTHY`.

QA sí contiene:

- tablas PM14 (`clientes_empresa`, `encargos_empresa`, `pagos_encargo`);
- RPC base de venta, carrito, traspasos, encargos y pagos;
- helpers privados que el preflight C24 exige;
- las RPC legacy de mutación `descontar_stock_carrito` y `anular_venta_tpv` ya no están presentes bajo sus firmas antiguas.

Pero las 8 versiones exactas del manifest C24 tampoco aparecen registradas en `schema_migrations`. Por tanto, QA también presenta drift de historial y no debe utilizarse como justificación para marcar migraciones manualmente.

## Regla de drift

Queda prohibido resolver el drift insertando o editando manualmente filas en `supabase_migrations.schema_migrations`.

La reconciliación debe hacerse por definición real de objetos: tablas, funciones, triggers, RLS, grants, constraints, datos compatibles y hashes de migración. Después se vuelve a ejecutar el preflight.

## BLOCKED_EXTERNAL

### 1. Reconciliación y rollout productivo

Estado: `BLOCKED_EXTERNAL`.

No es un defecto nuevo de código. El candidato C24 está certificado, pero producción está por detrás del baseline.

Condición de desbloqueo:

- autorización explícita nueva para preparar/aplicar la reconciliación productiva;
- snapshot recuperable;
- diff vivo de objetos e historial;
- migración versionada de reconciliación de `clientes_empresa` y demás dependencias;
- preflight C24 PASS;
- aplicación exacta del manifest C24;
- postflight PASS;
- smoke y comprobación de ausencia de efectos parciales.

### 2. Tercer entorno real Supabase

Estado: `BLOCKED_EXTERNAL`.

Solo existe la rama default `main` del proyecto productivo. La creación de una rama Supabase puede tener coste y requiere autorización específica.

Condición de desbloqueo: disponer de rama/tercer entorno representativo con coste y creación aprobados, o entorno equivalente autorizado.

### 3. Password Breach Protection

Estado: `BLOCKED_EXTERNAL`.

El advisor de Supabase la reporta deshabilitada. No se trata como defecto del código de L&A Suite.

Condición de desbloqueo: habilitarla cuando el plan/configuración lo permita y exista autorización para el cambio.

## Deuda residual no bloqueante

- `xlsx 0.18.5`: advisory histórico conservado. No se eleva a bloqueo actual; antes de introducir lectura/importación Excel debe revalidarse/remediarse. En el árbol C24/C25 no se observó un artefacto `xlsx` por nombre.
- GitHub Actions históricos con tags como `@v4`: hardening pendiente. El nuevo workflow C25 sí fija los actions críticos a SHA completo.
- Advisors `SECURITY DEFINER`: no se interpretan automáticamente como vulnerabilidad. Varias RPC modernas están diseñadas para ser ejecutables por `authenticated` y deben juzgarse por sus guardas internas; el hallazgo material de C25 es que las dos RPC legacy de C13 siguen expuestas en producción.
- Advisors de performance sobre índices: deuda de rendimiento, no bloqueo funcional de este rollout.

## Orden obligatorio para un futuro GO

1. Mantener `main`, `release`, PR #38 y producción sin cambios hasta autorización específica.
2. Preparar entorno de reconciliación representativo.
3. Tomar snapshot/backup recuperable de producción.
4. Reinspeccionar esquema e historial.
5. Crear migraciones de reconciliación mínimas y versionadas; no reaplicar a ciegas migraciones históricas.
6. Certificar esas reconciliaciones en entorno aislado/representativo.
7. Ejecutar `pm27_c24_preflight_migraciones.sql` y exigir PASS.
8. Verificar byte a byte las ocho migraciones del manifest C24.
9. Con autorización explícita, aplicar el lote productivo.
10. Ejecutar postflight y smoke funcional.
11. Solo entonces desplegar frontend/candidato en Netlify por la ruta de release aprobada.
12. Repetir advisors, verificación de refs, drift y clean-up.
13. Cambiar la decisión `PM27 ROLLOUT = NO-GO` a `GO` únicamente con evidencia de todos los pasos anteriores.

## Criterio de cierre de C25

C25 queda cerrado como PASS cuando:

- esta evidencia está versionada;
- el contrato automático C25 pasa;
- el workflow C25 confirma refs protegidas y PR #38;
- el workflow demuestra que C25 solo modifica su alcance propio;
- C24 vuelve a pasar su gate PostgreSQL 17 como regresión;
- el árbol queda limpio;
- GitHub Actions termina SUCCESS sobre el SHA final exacto.

El cierre de C25 **no autoriza** el rollout productivo. El estado operativo permanece `NO-GO / BLOCKED_EXTERNAL` hasta cumplir las condiciones documentadas.
