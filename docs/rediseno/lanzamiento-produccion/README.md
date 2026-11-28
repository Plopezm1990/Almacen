# Guiones de lanzamiento a producción · #225 / #226

Preparados el 28/11/2026 como parte del plan `../PLAN_CIERRE_PR225_PR226_2026-11-28.md`. **Nada de esto se ha ejecutado contra producción** (`flqercbgpgmmfaakrwkc`): están validados contra QA (solo lectura)
y, en el caso del informe 01, también contra funciones sin parchear en una base de pruebas, para comprobar que clasifica bien.

> **Regla:** estos archivos están en `docs/`, **no** en `supabase/migrations`, así que ningún despliegue los aplica. Los de solo lectura empiezan por `begin read only;` y terminan en `rollback;`.
> El único que escribe datos es `02b_…ESCRIBE_requiere_autorizacion.sql`, y solo con la autorización expresa del usuario en ese paso.

| Archivo | Para qué | Escribe | Cuándo |
|---|---|---|---|
| `01_deriva_funciones_solo_lectura.sql` | Dice, por función, si la migración encontrará su ancla (`LISTA_PARA_MIGRAR`), ya está aplicada, o hay **deriva** respecto a QA | No | Fase 4 (copia) y, si el usuario lo autoriza, antes de la ventana en producción |
| `02_segundo_factor_informe_solo_lectura.sql` | Empresas, Propietarios y factores verificados; política actual de segundo factor | No | Antes de decidir D3 y después de migrar `20261115120000` |
| `02b_segundo_factor_alta_ESCRIBE_requiere_autorizacion.sql` | Alta de la política «Propietario exige segundo factor» en las empresas elegidas | **Sí** | Paso 5 de la ventana, con autorización |
| `03_emision_fiscal_y_cierre_de_caja_solo_lectura.sql` | Emisión fiscal por local, ventas cobradas sin documento (las que bloquearían el cierre definitivo), existencia del QR fiscal | No | Antes de decidir D6 |
| `04_estado_de_migraciones_solo_lectura.sql` | Estado de las 20 migraciones por nombre y por objeto; privilegios que debe quitar la 14 | No | Antes y después de migrar |
| `05_volcar_definiciones_previas_solo_lectura.sql` | Guarda la definición anterior de cada función que se parchea (base de la vuelta atrás) | No | **Justo antes** de migrar |
| `VUELTA_ATRAS_POR_MIGRACION.md` | Qué hacer con cada migración si hay que deshacer | — | Preparación y ventana |

## Orden de uso
1. En la copia con el esquema de producción: `04` (qué está aplicado) → `01` (deriva) → `05` (volcado) → aplicar las migraciones en orden → `04` y `01` de nuevo (todo `APLICADA` / `YA_APLICADA`).
2. En producción, solo lectura y con tu orden: `01`, `03`, `04` y el informe `02` para tomar D3, D5 y D6.
3. Día del lanzamiento: `05` → migrar → `04` y `01` → `02b` → humo.

## Hallazgos de la validación en QA (28/11/2026)
- Las 12 comprobaciones de `01` salen `YA_APLICADA` en QA (su definición ya lleva los parches); una función inexistente sale `FALTA_FUNCION`; una función sin ancla sale `DERIVA`; una función que solo **menciona** `ABC_COBRO_INICIAR` en un comentario sigue `LISTA_PARA_MIGRAR` (el texto buscado es el que inserta la migración, no cualquier mención).
- `04`: **17 de 20 aplicadas con historial y objeto; 3 `SOLO_OBJETO`** (`rediseno_apariencia_empresa`, `rediseno_apariencia_delegaciones`, `rediseno_org33_tarifas_horario`): existen en QA pero no constan en el historial.
  Si en producción pasara lo mismo, `supabase db push` intentaría reaplicarlas: **hay que reconciliar el historial antes de empujar** (decisión del usuario; no se hace automáticamente).
- `03`: en QA-A1 hay 49 ventas cobradas en 30 días, **4 sin documento emitido**, y emisión usable: con la corrección de #226 esas 4 sí bloquearían el cierre definitivo de la sesión que las contenga, como se pretende.
- `04` (privilegios): en QA, 0 filas de privilegios sobrantes tras la migración 14.
- `02`: `m03_server_aal2_gate` está aplicada en QA (`la_usuario_activo` menciona `aal2`). En producción hay que comprobarlo con este mismo informe.
- Duplicado conocido: la versión `20261029200000` está duplicada en `release` (ya lo estaba antes de este cierre); confirmar que no estorba al `db push`.
