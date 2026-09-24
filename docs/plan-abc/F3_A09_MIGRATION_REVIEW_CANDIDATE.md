# F3/A09 — candidato revisado y plan de aplicación

Estado: **contrato del primer alcance A09 verificado localmente; candidato de migración revisable en la rama aislada; no aplicado en QA/PROD**. La doble aprobación configurable no está implementada ni aceptada. F3 sigue en desarrollo y A09 no emite documentos fiscales. Informe actualizado el 24/09/2026.

## Identidad y contenido exacto

- Rama: `codex/abc-f3-a09-discounts-comps`.
- Base inicial comprobada: `45b547bd5bcde485b4203611ce50b38d5fbe79ed`.
- `release` comprobada, sin cambios: `89a163906d2b7c3c7c082e0c0d7a65c334e3871e`. No se modificó `main`, `release` ni PR #38.
- Fuente revisada: `tests/f3/a09/a09-migration-draft.sql`.
- Candidato local: `supabase/migrations/20260924160739_abc_f3_a09_descuentos_cortesias.sql`.
- SHA-256 de ambos archivos: `8d52b521ca9d73a8ea2e27c6accd2ed2a4cb653e76f7ad388427ebb455669096`.
- `supabase migration new` primero apuntó por error a `C:\Users\pedro\supabase` y creó un archivo vacío. Se verificó su longitud cero y se retiró únicamente ese archivo. La invocación siguiente usó `--workdir` explícito; el candidato está en este repositorio y su hash coincide con la fuente.

La migración añade dos tablas, cuatro índices, siete funciones privadas/públicas, RLS/ACL y un trigger `BEFORE INSERT OR UPDATE` de línea fiscal. La RPC modifica repartos A08, líneas fuente, versiones y auditoría/eventos de forma transaccional solo al ser invocada. Los helpers JCS no son accesibles a `authenticated`, `anon` ni `service_role`. La migración no altera datos comerciales al aplicar DDL.

## Puertas ejecutadas

- `node --test tests/f3/a09/*.test.mjs`: **34/34**.
- `node tests/f3/a09/local-pglite-contract.mjs`: **PASS** (PostgreSQL WASM 18, comprobación secundaria).
- `node tests/f3/a09/local-postgres-contract.mjs`: **PASS** con PostgreSQL **16.15** y **17.11**, cada uno en una base UTF-8 nueva y con dos conexiones TCP independientes.
- PG16/17: permisos de RPC, tablas y helpers; rol `authenticated` puede llamar a la RPC pero no escribir política/auditoría; `anon` y `service_role` no pueden ejecutar la RPC; RLS; aislamiento empresa/local; Encargado rechaza 30 % y acepta 20 % exacto; motivo, auditoría/evento únicos; cuenta cerrada, línea borrador/cancelada y fiscalización previa o parcial se rechazan sin rastro parcial.
- PG16/17: RPC A04 real crea una retirada −2 €/unidad; A08 divide cantidad 2 entre dos cuentas; A09 rebaja 2 € en una cuota; el replay no añade un asiento y la cuota fiscal vigente reconcilia. Se comprueban ambos órdenes A08/A09 y fiscalización/A09, operación repetida/concurrente, conflicto de cuerpo, versión obsoleta y rollback sin duplicados ni pérdida de cantidad/importes.
- Proyección comercial/fiscal: fuente y todos los repartos activos concilian a ocho decimales. La cabecera fiscal y sus líneas concilian también a dos decimales. El caso de 10,00 € conserva por separado descuento 3,33 €, base 6,67 €, IVA 0,67 €, ajuste −0,01 € y total 7,33 €.
- JCS v1: bytes UTF-8 exactos y SHA-256 idénticos desde SQL y JS; cubre orden de claves, Unicode, escapes, controles, arrays, `null`, escala/signo y rechazo de números JSON. Se conserva `schema_version=la-fiscal-snapshot-v1`, `canonicalization=RFC8785-JCS`, `hash_algorithm=SHA-256`.
- Revisión independiente del borrador y del contrato: orden de locks cuenta→línea→reparto, autoridad `auth.uid()`/empresa/local, `SECURITY DEFINER` con `search_path=''`, propietario, ACL/RLS, preflight de dependencias/objetos, guard fiscal, idempotencia, rollback y fallos cerrados. `git diff --check` pasa.

El contrato de emisión que contiene un snapshot JCS con hash está **definido y probado en vectores**; persistencia inmutable, snapshot completo/outbox y aceptación por un emisor fiscal siguen reservados para la fase fiscal. El ajuste genérico de −0,01 € no demuestra aceptación legal o técnica del formato tributario.

## Casos que fallan cerrados y alcance aceptable

1. **IVA mixto en reparto A08:** la RPC devuelve `descuento_reparto_iva_mixto_no_soportado`. Está fuera del primer alcance A09, limitado a una tasa efectiva por línea; no es soporte de descuentos sobre todo A04/A08. La ampliación requiere desglose de IVA por componente y cuota. Prueba futura: modificadores de A04 a dos tasas, A08 en dos cuentas, descuentos y reintentos, y conciliación por bucket de cada documento fiscal en PG16/17.
2. **Fiscalización parcial previa:** cualquier línea fiscal no cancelada sobre la fuente bloquea el descuento con `descuento_linea_fiscalizada`, incluso si solo fiscalizó una cuota. El requisito del primer alcance es que las líneas afectadas no tengan fiscalización previa; después de A09 solo se acepta fiscalizar la cuota A08 íntegra y vigente. La compatibilidad con una cuota ya fiscalizada queda fuera de alcance. Prueba futura: ambos órdenes A09/fiscalización parcial, reintentos y carreras con versiones obsoletas; conciliar fuente, saldos de reparto y documentos sin duplicados ni pérdidas.
3. **Doble aprobación:** `requiere_doble_aprobacion=true` rechaza con `descuento_requiere_doble_aprobacion`; la columna configurable no equivale a un flujo implementado. Esto no bloquea la RPC comercial acotada si la opción queda desactivada, pero **sí bloquea la aceptación de la capacidad configurable de doble aprobación**, que permanece pendiente. Requiere aprobación transaccional por una persona distinta, ligada a operación/cuerpo, versiones y límites, más auditoría de ambas identidades. Prueba futura: identidades/roles, rechazo de autoaprobación, cambios de permiso, replay/conflicto, carrera de versiones y rollback sin efectos parciales.

## Cambio, impacto y recuperación para una futura escritura remota

La migración exacta es el archivo citado arriba y su hash. Antes de aplicarla se necesita un preflight nuevo de versión, dependencias A08, ausencia de objetos A09, extensión/hash, permisos y estado del historial, además de una autorización específica para ese entorno.

Impacto previsto al aplicar DDL: estructuras y guardas aditivas; no se recalculan ni escriben pedidos existentes. Al invocar la RPC sí se descuentan y registran las cuotas A08 aptas y se incrementan versiones. El trigger fiscal puede rechazar líneas parciales u obsoletas para fuentes tocadas por A09.

Recuperación prevista: ante error, abortar la migración y verificar objetos parciales. Si la DDL llegó a aplicarse pero todavía no se utilizó, revocar ejecución de la RPC y preparar una migración compensatoria revisada. Si ya hubo descuentos, conservar importes/auditoría y diseñar reversos trazables; no borrar historial ni usar `db push` o `migration repair`. Ninguna escritura QA/PROD queda autorizada por este informe.

## Preflight de Git y Netlify, solo lectura

- `netlify.toml` ejecuta `.github/scripts/build-netlify-publish.mjs` y publica `.netlify-dist`. Ese script excluye `supabase`, `tests`, `docs` y `.github` del artefacto; A09 no cambia los archivos publicados, aunque Netlify podría ejecutar el build igualmente.
- No hay workflow de GitHub Actions para A09. Los workflows F3 A03–A08 limitan sus eventos `push` a sus ramas nombradas y aceptan PR hacia `release` solo con rutas propias; `puerta-ci-release.yml` corre para PR hacia `release`. Un push a esta rama `codex/...` no coincide con esos filtros de Actions.
- El directorio no contiene `.netlify/state.json` y no hay Netlify CLI instalado para leer la vinculación del sitio; la configuración de la integración Git y la lista de ramas con branch deploy habilitado viven en Netlify y no se pueden verificar desde este árbol. La documentación oficial indica que, con continuous deployment enlazado, push activa producción/branch deploy en ramas observadas y el PR puede activar Deploy Preview ([Git workflows overview](https://docs.netlify.com/build/git-workflows/overview/), [Deploy Previews](https://docs.netlify.com/deploy/deploy-types/deploy-previews/)). Por tanto, no se puede asegurar desde aquí si un push a `codex/abc-f3-a09-discounts-comps` generaría un deploy. No se hizo push ni se desplegó.

## Plan exacto para proponer revisión en QA

1. Partir de la base local `45b547bd5bcde485b4203611ce50b38d5fbe79ed` y del commit local que cierre este trabajo. Publicar únicamente la rama `codex/abc-f3-a09-discounts-comps` cuando se decida pedir revisión; no actualizar `main` ni `release`, y abrir/actualizar PR hacia `release` solo con autorización para ese paso. Confirmar de nuevo antes del push el sitio conectado, rama de producción, ramas branch-deploy y ajustes de Deploy Preview en Netlify; prever build/preview y desactivarlo solo desde su configuración autorizada si no se quiere ese coste.
2. En QA, después de autorización específica y preflight nuevo: comprobar `release`/base A08, historial de migración, que no haya objetos A09 parciales, hash exacto de `20260924160739_abc_f3_a09_descuentos_cortesias.sql`, dependencias, extensiones, propietario, ACL/RLS y usuarios/permisos. No usar `db push` ni `migration repair`.
3. Aplicar solo ese SQL revisado en una ventana breve. Ejecutar antes/después las consultas del plan para objetos, funciones, trigger, permisos y ausencia de filas nuevas en políticas/auditoría; en una base QA aislada correr fixture/contrato PG16 de dos conexiones, incluido A04 negativo→A08 reparto→A09, retry, estados, carreras fiscal/A09 y conciliación exacta. Verificar error esperado para los tres casos de la sección anterior.
4. Impacto de DDL: dos tablas vacías, cuatro índices, siete funciones, un trigger, RLS/ACL; sin backfill ni cambio de pedidos existentes. Las invocaciones futuras de la RPC actualizan cuotas A08, línea/versiones y auditoría; el trigger fiscal puede rechazar snapshots parciales u obsoletos de líneas tocadas por A09.
5. Recuperación: si falla la transacción DDL, abortar y comprobar que no quedan objetos; si se aplicó correctamente pero no se usó, revocar ejecución y preparar SQL compensatorio revisado. Si ya hubo descuentos, conservar auditoría y saldos, y revertir con operaciones comerciales trazables; no borrar asientos ni alterar historial. Cada operación de QA/PROD requiere su autorización específica.
