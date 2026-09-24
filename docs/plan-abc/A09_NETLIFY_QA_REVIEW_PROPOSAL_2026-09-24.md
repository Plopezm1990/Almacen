# F3/A09 — preflight Netlify y propuesta de revisión QA

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

- Commit local exacto: `f3fcec8af0a23805592e4ba489a3d8f1ec676473`, rama `codex/abc-f3-a09-discounts-comps`, padre `45b547bd5bcde485b4203611ce50b38d5fbe79ed`.
- Migración candidata exacta: `supabase/migrations/20260924160739_abc_f3_a09_descuentos_cortesias.sql`.
- SHA-256 verificado igual al borrador: `8d52b521ca9d73a8ea2e27c6accd2ed2a4cb653e76f7ad388427ebb455669096`.
- Alcance: dos tablas, cuatro índices, siete funciones, RLS/ACL y un trigger fiscal. La DDL no hace backfill. La RPC nueva solo muta descuentos/repartos al llamarse.

### Orden y gates

1. **Antes de push:** obtener acceso de lectura a los ajustes reales del sitio. Registrar rama productiva, branch deploys habilitados, previews para PR, integración Git y plan/saldo. Confirmar si el push de `codex/abc-f3-a09-discounts-comps` o una PR hacia `release` iniciaría builds y estimar coste. Si no se puede comprobar, mantener el push pendiente.
2. **Push eventual:** publicar solo el commit exacto arriba en la rama `codex/abc-f3-a09-discounts-comps`; nunca directamente en `release`. Esperar CI de esa rama/PR y revisar artefactos. El push todavía no autoriza aplicación de migración.
3. **PR eventual:** solo cuando el propietario decida abrirla, dirigirla a `release`, nunca a `main`. Esperar `puerta-ci-release` y los checks definidos; confirmar si Netlify crea Deploy Preview y que esta sigue sin publicarse como producción. No fusionar en esta propuesta.
4. **Preflight QA separado:** antes de cualquier escritura y con autorización específica, comprobar estado vivo de QA, PostgreSQL/extensiones, A08 e historial, ausencia de objetos A09 y hash exacto; capturar recuentos iniciales de políticas/auditoría y revisar propietario, grants, RLS, locks y dependencias.
5. **Aplicación QA eventual:** en ventana acordada, aplicar únicamente el archivo de migración revisado por la vía SQL aprobada; no usar `db push` ni `migration repair`. Correr inmediatamente comprobaciones de objetos, funciones, trigger, ACL/RLS y cero filas de negocio agregadas por DDL. Después, en fixtures QA desechables, verificar llamada autenticada, aislamiento, límite/motivo/auditoría, estados, reintentos/conflictos, operaciones A04/A08/A09, y concurrencia/rechazo fiscal con conciliación a ocho y dos decimales. Comparar resultado con los contratos PG16 y PG17.
6. **Recuperación:** si la DDL falla dentro de la transacción, abortar y comprobar que no queda ningún objeto. Si quedó aplicada y la RPC no se usó, revocar su `EXECUTE` y preparar una migración compensatoria revisada. Si ya hay descuentos, conservar la auditoría y corregir con operaciones compensatorias trazables; no borrar registros ni reescribir el historial.

### Límites declarados del primer alcance

1. **IVA mixto repartido:** A09 rechaza con `descuento_reparto_iva_mixto_no_soportado`. Fuera del primer alcance: una línea debe tener una única tasa efectiva. Ampliación: desglose A08 por componente/cuota y prueba futura A04 multitasas → reparto → descuento/reintento → documento, conciliado por tipo de IVA en PG16/17.
2. **Fiscalización parcial previa:** A09 rechaza cualquier fuente con línea fiscal no cancelada (`descuento_linea_fiscalizada`). Fuera del primer alcance: las fuentes afectadas deben estar sin fiscalizar al aplicar el descuento. Ampliación futura: RPC fiscal de saldo/cuota, reglas de redondeo y serialización; probar ambos órdenes, reintentos, versiones obsoletas y ausencia de céntimos duplicados/perdidos.
3. **Doble aprobación configurable:** la opción activa rechaza (`descuento_requiere_doble_aprobacion`). El descuento comercial acotado solo cubre políticas con doble aprobación desactivada. La capacidad configurable de doble aprobación **no está implementada ni aceptada** y bloquea la aceptación de ese requisito. Ampliación futura: segunda aprobación de usuario distinto, ligada al cuerpo/operación y versiones, auditoría de ambas identidades y pruebas de permisos, replay, concurrencia y rollback.

## Estado de la solicitud

Este documento es una propuesta, no autorización para los pasos externos. No se ha hecho push, abierto ni fusionado PR, aplicado la migración, escrito en QA/PROD ni desplegado. A09 no se declara funcionalmente completa; emisión fiscal y doble aprobación permanecen fuera de aceptación.
