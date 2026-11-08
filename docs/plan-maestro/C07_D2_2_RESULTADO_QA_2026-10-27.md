# C07-D.2.2 — emisión gobernada por configuración fiscal persistente

Fecha: 27/10/2026  
Entorno: Supabase QA `qjqorixtkilwsndqayyx`  
Producción: no modificada  
AEAT: no contactada

## Resultado

**C07-D.2.2 queda implementada y verificada en QA.** La RPC autenticada
`public.abc_c07d_emitir_checkout` ya no toma la serie del navegador como fuente
de verdad. Antes de reservar cualquier número C05, hace un preflight completo
del checkout y resuelve en servidor la empresa, local, entidad fiscal,
configuración persistente, serie C05 activa, adaptador habilitado y entorno
permitido.

La serie enviada por el cliente se conserva únicamente como dato de auditoría
(`serie_solicitada_cliente`). La respuesta efectiva y las tablas C05/C07-D usan
la serie resuelta por servidor (`serie_resuelta_en_servidor`). No se devuelve
`credential_ref` ni ningún secreto.

## Migraciones QA aplicadas

- `20261027160000_abc_f7_c07d_d2_emission_wiring.sql`: conecta la emisión con
  el resolver persistente, añade preflight antes de cualquier mutación y
  mantiene `SIMULADOR_C07D`, `QA` y transporte `DISABLED`.
- `20261027161000_abc_f7_c07d_d2_emission_resolver_lock_fix.sql`: corrige la
  volatilidad del resolver porque usa `FOR SHARE`; debe ser `VOLATILE` para
  poder tomar el bloqueo de lectura de forma válida.
- `20261027162000_abc_f7_c07d_d2_emission_config_indexes.sql`: añade índices
  de cobertura para las nuevas claves foráneas de configuración. El intento
  inicial incluyó por error una columna inexistente (`config_id`), fue
  rechazado por PostgreSQL sin cambios parciales y se reaplicó corregido con
  el mismo nombre.

## Evidencia funcional autenticada

Fixture: empresa `QA-EMP-A`, local `QA-A1`, entidad fiscal
`a0000000-0000-0000-0000-0000000000a2`, tipo `FACTURA`.

Configuración vigente: serie `TPV`, id
`cfc8888c-1777-40db-a205-5c2828a93d0e`; adaptador `SIMULADOR_C07D`, versión
`1.0.0`; entorno `QA`; estado `VALIDADA`; versión de configuración `1`;
`credential_configured: false`.

Se ejecutó una emisión con la serie falsa `CLIENTE_NO_AUTORITATIVO` enviada
desde el cliente. El servidor ignoró esa elección y produjo:

- serie efectiva: `TPV`;
- documento C05: `TPV-6`, estado `EMITIDO`;
- registro C07-D: secuencia `2`;
- cola fiscal: `PENDIENTE`;
- transporte: `DISABLED`;
- hash: `618024bdf6bf732b3f03541314911b0d8b6df62a8070363300c922d4e6eb453a`.

Conteo final de QA para `QA-EMP-A / QA-A1`:

| Indicador | Resultado |
|---|---:|
| Documentos C05 | 9 |
| Registros C07-D | 2 |
| Elementos de cola `PENDIENTE` | 2 |
| Elementos de cola `ERROR` | 0 |
| Credenciales almacenadas para esta configuración | 0 |

## Idempotencia y negativos

- La repetición de la misma operación devuelve el resultado persistido y no
  crea otro documento ni otro registro C07-D.
- La repetición con el mismo `operation_id` pero una petición diferente fue
  rechazada con `operation_id_conflict`.
- Un tipo documental sin configuración devolvió
  `C07D_CONFIG_EMISION_AUSENTE` antes de reservar C05; no generó documentos ni
  registros adicionales.
- La función es ejecutable por `authenticated` y no por `anon`.
- La primera prueba técnica reveló el defecto `STABLE + FOR SHARE`; quedó
  corregido con una migración independiente. La operación fallida no dejó
  datos parciales.

## Contratos y verificaciones

Pasaron:

- `node tests/f5/c07/c07d-d2-emission-wiring-contract.mjs`;
- `node tests/f5/c07/c07d-d2-emission-config-contract.mjs`;
- `node tests/f5/c07/c07d-checkout-emit-contract.mjs`;
- `node tests/f5/c07/c07d-migration-contract.mjs`;
- `node tests/f5/c07/c07d-preflight-contract.mjs`;
- `node tests/f5/c05/c05-series-contract.mjs`;
- `node --check fuente.js`;
- `node --check source-recovery/fuente-recuperado.js`;
- `git diff --check`.

Los asesores de Supabase se volvieron a ejecutar en QA. Las tablas privadas
siguen con RLS sin políticas y sin grants directos de tabla de forma
intencionada: el acceso pasa por RPC autenticada. Los avisos históricos y los
índices nuevos aún no usados en QA son informativos; no se detectó un fallo
funcional de esta entrega.

## Límite explícito

La cadena C05/C07-D actual continúa trabajando con una única entidad fiscal
activa por local. La emisión comprueba esa condición antes de mutar datos y
bloquea una venta que no corresponda a ella. La expansión de varios emisores
activos dentro del mismo local requiere el siguiente trabajo sobre las RPC C05
de reserva y C07-D de registro; no se debe simular con una serie enviada desde
el frontend.

No se ha aplicado ninguna migración en `flqercbgpgmmfaakrwkc`, no se ha usado
producción y no se ha contactado con la AEAT.

## Siguiente paso

El siguiente subpunto recomendado es **C07-D.2.3: reflejar en el frontend el
estado de configuración resuelto por servidor y bloquear visualmente la
emisión cuando no exista configuración `VALIDADA/ACTIVA`**, manteniendo el
backend como autoridad. Después habrá que cerrar la revisión de asesoría por
empresa, definir el contrato real del proveedor/sandbox y solo entonces
preparar la integración AEAT.
