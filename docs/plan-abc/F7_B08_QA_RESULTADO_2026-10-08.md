# F7 · B08 en QA — reembolsos económicos

Fecha: 2026-10-08  
Entorno: `L&A Suite QA` (`qjqorixtkilwsndqayyx`)  
Estado: `YA_INSTALADO_Y_VERIFICADO_EN_QA`  
Producción: no tocada

## 1. Resultado

B08 no tiene una migración independiente que deba repetirse. Su autoridad de
servidor ya estaba instalada en QA mediante las piezas F2 y la aprobación D13:

| Versión remota | Pieza |
|---|---|
| `20260923100046` | `abc_f2_m02b_pagos_reservas_reembolsos` |
| `20260923134932` | `abc_f2_m03c_reembolsos_transaccionales` |
| `20260923170519` | `abc_f2_m04c_outbox_persistente` |
| `20261003081109` | `abc_config_d13_reembolsos_aprobacion` |

No se reaplicó ninguna migración ni se cambió el esquema.

## 2. Contratos locales

Pasaron las comprobaciones de sintaxis y los dos contratos de B08:

- `node --check fuente.js`;
- `ABC_F4_B08_REFUND_ADAPTER=PASS`;
- `ABC_F4_B08_UI=PASS`.

La interfaz mantiene el reembolso económico separado de la devolución física
de mercancía y el adaptador no acepta datos de tarjeta.

## 3. Contrato remoto

QA confirmó la presencia de:

- `reembolsos`, `reembolso_aplicaciones` y `efectos_pendientes`;
- `abc_solicitar_reembolso`;
- `abc_aprobar_reembolso`;
- `abc_confirmar_reembolso_efectivo`;
- `abc_resolver_reembolso`;
- `abc_cancelar_reembolso`.

D13 está activo: las columnas `aprobado_por` y `aprobado_at` existen, una
solicitud comprueba `ABC_REEMBOLSO_CONFIRMAR` para decidir la autoaprobación y
un reembolso en efectivo no puede confirmarse mientras siga pendiente de
aprobación.

Los permisos comprobados fueron:

- `authenticated` puede solicitar y aprobar por RPC;
- `anon` no puede ejecutar esas RPC;
- `service_role` puede resolver la respuesta del proveedor;
- `authenticated` no puede resolverla;
- `service_role` no tiene escritura directa sobre el outbox.

Las tres tablas tienen RLS. El acceso de cliente es de solo lectura únicamente
para `reembolsos`, sujeto a su política; las aplicaciones y el outbox no
permiten lectura o escritura directa al cliente autenticado.

## 4. Simulador transaccional

Se creó dentro de una sola transacción una cuenta, una venta y un cobro externo
de 1 EUR. El ensayo verificó:

1. confirmación simulada del cobro y cierre de su efecto;
2. reembolso parcial de 0,40 EUR, autoaprobado para Propietario;
3. creación de un único efecto `PROVIDER_REEMBOLSO`;
4. resolución confirmada, una aplicación económica y cierre del efecto en un
   intento;
5. segundo reembolso de 0,60 EUR;
6. paso del pago a `REEMBOLSADO` al alcanzar el total;
7. dos reembolsos, dos aplicaciones y dos efectos completados exactamente una
   vez;
8. ausencia de movimientos de caja para los reembolsos externos.

El ensayo terminó con `B08_QA_SMOKE_PASS_ROLLBACK`.

Después de la reversión quedaron en cero todos los identificadores del fixture.
Los conteos globales regresaron a sus valores previos: 4 reembolsos, 4
aplicaciones y 0 efectos pendientes.

## 5. Advisors

El asesor de seguridad conserva avisos generales de QA sobre funciones
`SECURITY DEFINER` ejecutables por usuarios autenticados. En las RPC de B08 es
un diseño intencional: cada función valida `auth.uid()`, la pertenencia y la
capacidad en servidor; `anon` está revocado y la resolución de proveedor queda
reservada a `service_role`.

El asesor de rendimiento informa claves foráneas de `reembolsos` y
`reembolso_aplicaciones` sin índices de cobertura, además de un índice de
aplicación todavía sin uso. Son avisos `INFO`; no impidieron el contrato ni el
ensayo, pero deben revisarse con carga representativa antes de producción.

Referencias de los asesores:

- <https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable>
- <https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys>
- <https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index>

## 6. Límite pendiente

El recorrido usó el proveedor `SIM`. La integración con un proveedor real o su
sandbox continúa pendiente de B07: requiere credenciales o un secreto de
simulación configurado para el webhook. B08 queda verificado en QA sin depender
de ese paso externo.
