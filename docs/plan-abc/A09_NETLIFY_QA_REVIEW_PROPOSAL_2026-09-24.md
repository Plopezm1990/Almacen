# F3/A09 — preflight Netlify y propuesta de revisión QA

> **Actualización posterior:** el estado real de QA del 26/09/2026 está en [`A09_QA_STATUS_2026-09-26.md`](A09_QA_STATUS_2026-09-26.md). Este informe conserva la evidencia histórica del 24/09/2026 y sus frases sobre “no aplicado en QA” ya no describen el estado actual.

Fecha de comprobación: 24/09/2026. Este documento registra evidencia de solo lectura. No se ha hecho push, abierto/actualizado una PR, aplicado SQL ni desplegado.

## Estado Git y protecciones

- Rama actual: `codex/abc-f3-a09-discounts-comps`.
- HEAD: `f3fcec8af0a23805592e4ba489a3d8f1ec676473`; árbol de trabajo limpio antes de iniciar este preflight.
- `origin/main`: `93a570badba1c5375febfbddc1dffdbcef003dcd`.
- `origin/release`: `89a163906d2b7c3c7c082e0c0d7a65c334e3871e`.
- PR #38 consultada por la API de solo lectura de GitHub: sigue `open`, `merged=false`, base `main` al SHA `93a570badba1c5375febfbddc1dffdbcef003dcd`, cabeza `claude/pm26-preparacion-tecnica` al SHA `f297be08708d0bbe566c21347123885cb3095a7c`. No se modificó.

## Configuración real de Netlify: acceso bloqueado

Se abrió la ruta de ajustes del proyecto `chic-entremet-9107cf`: <https://app.netlify.com/projects/chic-entremet-9107cf/configuration/deploys>. La interfaz devolvió la pantalla de inicio de sesión. Se comprobó la ruta de acceso con Google y GitHub; ambas llevaron a formularios de autenticación que requieren credenciales. No se introdujeron credenciales ni se aceptó acceso OAuth. En el equipo tampoco están instalados Netlify CLI ni el archivo `.netlify/state.json`.

Por tanto, **no pude comprobar en el sitio** la rama de producción, la lista de branch deploys, el estado de Deploy Previews, los eventos Git actualmente suscritos, el plan del equipo, su saldo de créditos o la política de recarga. No asumo que un push sea gratis ni que no vaya a compilar.

## Evidencia local de build y eventos

- `netlify.toml` configura el build como `node .github/scripts/build-netlify-publish.mjs` y publica `.netlify-dist`.
- El script borra/recrea `.netlify-dist`, copia las entradas permitidas y excluye `.github`, `tests`, `supabase`, `docs`, `tools`, `source-recovery`, `package.json` y otros archivos de control. Después compila Tailwind. Los cambios A09 están bajo `supabase`, `tests` y `docs`, así que no cambian por sí mismos los recursos publicados; si el evento está conectado, el build todavía puede ejecutarse y ocupar capacidad.
- No existe workflow de Actions específico de A09. Los workflows F3 A03–A08 filtran los pushes a sus propias ramas; sus triggers de PR apuntan a `release` y a sus rutas. `puerta-ci-release.yml` sí se ejecuta con PR dirigido a `release`. Actions y Netlify son disparadores distintos.
- La documentación oficial de Netlify dice que continuous deployment puede compilar producción/branch deploys en pushes a ramas observadas y actualizar Deploy Previews al crear o actualizar PRs ([Git workflows](https://docs.netlify.com/build/git-workflows/overview/)). Como los filtros y toggles reales no se pudieron leer, un push a `codex/abc-f3-a09-discounts-comps` puede causar un build de branch si esa rama está habilitada; abrir una PR puede producir preview si Deploy Previews están activos.

## Créditos: coste posible, no coste confirmado para este sitio

- Para los **planes basados en créditos** actuales, Netlify publica que Deploy Previews y branch deploys consumen 0 créditos cada uno; cada deploy de producción exitoso consume 15 créditos. Los minutos de build no se facturan como medidor aparte en esos planes ([How credits work](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/how-credits-work/), [Billing FAQ](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/billing-faq-for-credit-based-plans/)).
- El plan Free basado en créditos incluye 300 créditos al mes con límite duro; la página vigente indica que no hay recarga automática en Free ([Credit-based pricing plans](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/credit-based-pricing-plans/)).
- Esto no demuestra el coste del proyecto: no se verificó si la cuenta usa ese plan actual o precios heredados. Tampoco se verificó si `codex/...` está habilitada como branch deploy o si es la rama productiva. Si el push actualizara la rama productiva, el coste publicado para el plan de créditos sería 15 por deploy exitoso; si genera preview/branch deploy sería 0 créditos bajo ese plan. Un build puede ejecutarse aunque el cambio solo afecte archivos excluidos del artefacto.
- No se disparó build en este preflight. **No proponer push hasta leer la configuración efectiva del sitio y el plan/saldo.**

## Propuesta revisable para integrar A09 y pedir QA

### Artefacto

- Base de la implementación: commit del informe Netlify `b1f502f34b05fdcb7a68763dfa4481be0456c506`, seguido por el commit local de esta revisión. No se ha publicado en remoto.
- Migración candidata exacta: `supabase/migrations/20260924160739_abc_f3_a09_descuentos_cortesias.sql`.
- SHA-256 final del candidato y borrador, idénticos: `18364a2aafd09e3fdfd9bd13a90a169bbf4c55882265139e44d583a5dc114e01`.
- Alcance DDL: cuatro tablas, siete índices explícitos, diecisiete funciones y tres triggers, RLS/ACL. No hace backfill ni recalcula pedidos existentes. Una solicitud de descuento crea una operación pendiente y fotografía JCS sin mutar importes ni evento comercial. Las RPC de configuración del Propietario crean una operación y un evento de auditoría. El solicitante aplica solo tras una firma distinta y vigente, o directamente si la política no exige firma y tiene permiso de aplicación.
- In-cap con doble firma: el límite aplicado es el menor de los límites del solicitante y aprobador. Escalado: solo si `permite_escalado=true`; el aprobador necesita `puede_autorizar` y un tope suficiente y, tras su firma, aplica su propio tope. Prueba: Encargado 20 % solicita 30 %, Propietario 100 % aprueba; un supervisor 20 % no alcanza; si se apaga escalado no se crea solicitud. Cambios concurrentes de política/membresía esperan el lock de aplicación e invalidan solicitudes activas.
- Las RPC `abc_listar_descuento_politicas` y `abc_configurar_descuento_politica` son de A09 y solo el Propietario vigente del local puede usarlas; cada edición conserva motivo y estado anterior/nuevo en auditoría. A02 puede añadir la pantalla. F0 queda pendiente hasta que QA confirme que el Propietario dispone de un cliente autorizado para administrar límites.

### Orden y gates

1. **Antes de push:** obtener acceso de lectura a los ajustes reales del sitio. Registrar rama productiva, branch deploys habilitados, previews para PR, integración Git y plan/saldo. Confirmar si el push de `codex/abc-f3-a09-discounts-comps` o una PR hacia `release` iniciaría builds y estimar coste. Si no se puede comprobar, mantener el push pendiente.
2. **Push eventual:** después de cerrar y revisar los cambios locales, publicar el commit local de implementación en la rama `codex/abc-f3-a09-discounts-comps`; no hay un commit de código exacto preparado en este momento. Nunca hacer push directo a `release`. Esperar CI de esa rama/PR y revisar artefactos. El push todavía no autoriza aplicación de migración.
3. **PR eventual:** solo cuando el propietario decida abrirla, dirigirla a `release`, nunca a `main`. Esperar `puerta-ci-release` y los checks definidos; confirmar si Netlify crea Deploy Preview y que esta sigue sin publicarse como producción. No fusionar en esta propuesta.
4. **Preflight QA separado:** antes de cualquier escritura y con autorización específica, comprobar estado vivo de QA, PostgreSQL/extensiones, A08 e historial, ausencia de objetos A09 y el hash final documentado arriba; capturar recuentos iniciales de políticas/autorizaciones/intentos/auditoría y revisar propietario, grants, RLS, locks y dependencias, incluida `membresias_usuario.updated_at`.
5. **Aplicación QA eventual:** en ventana acordada, aplicar únicamente el archivo de migración revisado por la vía SQL aprobada; no usar `db push` ni `migration repair`. Comprobar objetos, funciones, triggers, ACL/RLS y que DDL no inserte filas de política/autorización/intentos/auditoría. En fixtures QA aislados probar permisos separados; lectura/escritura de políticas por Propietario con auditoría e idempotencia; in-cap con doble firma; escalado 20 %→30 % con aprobador al 100 % y supervisor al 20 % rechazado; escalado desactivado; cambios de cuenta/descuento/membresía/configuración, carreras con dos conexiones, replay y rollback; A04 negativo→A08→A09 y conciliación a ocho y dos decimales. Comparar con PG16/17.
6. **Recuperación:** si la DDL falla dentro de la transacción, abortar y comprobar que no queda ningún objeto. Si quedó aplicada y las RPC no se usaron, revocar su `EXECUTE` y preparar una migración compensatoria revisada. Invalidar solicitudes pendientes con resultado trazable antes de retirar las RPC/tablas. Si ya hay descuentos o cambios de política, conservar la auditoría y corregir con operaciones compensatorias trazables; no borrar registros ni reescribir el historial.

### Límites declarados del primer alcance

1. **IVA mixto repartido:** A09 rechaza con `descuento_reparto_iva_mixto_no_soportado`. Fuera del primer alcance: una línea debe tener una única tasa efectiva. Ampliación: desglose A08 por componente/cuota y prueba futura A04 multitasas → reparto → descuento/reintento → documento, conciliado por tipo de IVA en PG16/17.
2. **Fiscalización parcial previa:** A09 rechaza cualquier fuente con línea fiscal no cancelada (`descuento_linea_fiscalizada`). Fuera del primer alcance: las fuentes afectadas deben estar sin fiscalizar al aplicar el descuento. Ampliación futura: RPC fiscal de saldo/cuota, reglas de redondeo y serialización; probar ambos órdenes, reintentos, versiones obsoletas y ausencia de céntimos duplicados/perdidos.
La doble aprobación y el escalado condicionado se implementan en el candidato y se probaron localmente. Un cambio de versión/importes o de política/membresía invalida la autorización y obliga a iniciar otra operación. La configuración queda tras RPC de Propietario con DML directo revocado. La pantalla de A02 puede esperar; F0 no se da por satisfecho hasta verificar en QA un cliente autorizado utilizable por el Propietario. La emisión fiscal real y el outbox siguen reservados para una fase posterior.

## Estado de la solicitud

Este documento es una propuesta, no autorización para los pasos externos. No se ha hecho push, abierto ni fusionado PR, aplicado la migración, escrito en QA/PROD ni desplegado. A09 sigue pendiente de aceptación en QA; IVA mixto, fiscalización parcial previa y emisión fiscal real permanecen fuera del primer alcance.
