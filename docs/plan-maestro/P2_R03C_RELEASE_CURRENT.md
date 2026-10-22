# P2-R03C — reconstrucción de errores_sistema tenant-aware sobre release actual

Estado: **candidato GitHub-only; no aplicado por este candidato a Supabase QA ni PROD**.

Baseline exacta:

- `release@fe01c398ef1bcc7af54d972e88790592919d4119`
- rama: `claude/p2-r03c-release-current`
- paquete histórico: `50b36da80e4bdb9cea78894ac8b9d429c1a7d633`
- run histórico: `35215095173`
- job histórico: `105181584869` — SUCCESS

## Decisión de reconstrucción

La rama histórica está divergida respecto al release actual y no se reutiliza mediante merge/rebase masivo.

Se recupera únicamente el contrato R03C históricamente validado y se recertifica contra el HEAD vivo. El SQL se conserva byte a byte con blob Git:

- `ef9983098845ceaed25bcef33447334e0d6ea1fe`

Los scripts de prueba se sitúan bajo `.github/scripts/p2-r03c/` para mantener separado el paquete actual de los tests históricos.

## Preflight vivo de solo lectura — 21/09/2026

El preflight exacto del SQL R03C devuelve `P2_R03C_PREFLIGHT_READ_ONLY=PASS` tanto en QA como en PROD.

No se leyó contenido de mensajes, pilas ni dispositivos. El inventario se limitó a catálogo, ACL, políticas y recuentos agregados.

### PROD

`public.errores_sistema`:

- existe;
- RLS está activo;
- 0 filas en el momento del inventario;
- columnas: `id, fecha, mensaje, pantalla, pila, dispositivo`;
- no tiene `empresa_id` ni `local_id`;
- policy INSERT legacy valida sesión activa, pero no tenant;
- policy SELECT legacy permite lectura a propietario activo sin separación empresa/local;
- no existen los helpers privados R03C.

### QA

`public.errores_sistema`:

- existe;
- RLS está activo;
- 0 filas en el momento del inventario;
- ya tiene `empresa_id` y `local_id`;
- la policy INSERT todavía admite `empresa_id IS NULL`;
- la lectura limita empresa pero no instala el contrato final R03C;
- `authenticated` conserva privilegios excesivos: UPDATE, DELETE, TRUNCATE, REFERENCES y TRIGGER además de SELECT/INSERT;
- no existen los helpers privados R03C.

## Wiring frontend vivo

El `release` actual ya consume el contrato tenant-aware:

- `window.__contextoErroresPM20` contiene empresa/local activos;
- `registrarErrorSistema()` inserta `empresa_id` y `local_id`;
- la pantalla `ErroresSistema` consulta `errores_sistema` y delega el aislamiento en RLS.

Por eso este candidato no modifica `fuente.js`.

## Contrato R03C

La migración:

- añade `empresa_id`, `local_id`, `url`, `vista`, `detalle` y `contexto` cuando falten;
- no hace backfill ni inventa tenant para filas históricas;
- mantiene filas legacy sin tenant pero invisibles por RLS;
- instala helpers tenant-aware en `private` con `SECURITY DEFINER` y `search_path=''`;
- restringe SELECT a Propietario dentro de empresa/local;
- permite INSERT solo dentro del alcance activo del usuario;
- bloquea empresa nula como vía de escape;
- elimina policies históricas de la tabla e instala exactamente SELECT + INSERT R03C;
- revoca privilegios de tabla y deja solo SELECT/INSERT a `authenticated`;
- no concede UPDATE/DELETE/TRUNCATE;
- no toca datos existentes.

## Gate del candidato

El workflow específico exige:

1. base exacta `fe01c398ef1bcc7af54d972e88790592919d4119`;
2. exactamente cinco archivos R03C en el diff;
3. blob SQL histórico exacto;
4. contrato estático R03C;
5. regresión de contratos R03A y R03B;
6. sintaxis de `fuente.js`;
7. wiring tenant-aware actual del frontend;
8. PostgreSQL 16 efímero con aislamiento empresa/local, legacy fail-closed y ACL mínima;
9. árbol limpio al finalizar.

Además, el PR queda sujeto al `gate-final` obligatorio de `release` y al Deploy Preview que genere Netlify.

## Fuera de alcance

- No aplicar nada en QA.
- No aplicar nada en PROD.
- No usar `db push`.
- No usar `migration repair`.
- No tocar `main`.
- No tocar PR #38.
- No fusionar a `release` sin autorización separada.
- No iniciar PM11/PM13/P06 todavía.
