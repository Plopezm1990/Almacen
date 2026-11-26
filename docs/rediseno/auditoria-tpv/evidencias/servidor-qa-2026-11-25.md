# Lectura del servidor QA · 25/11/2026

Proyecto `qjqorixtkilwsndqayyx` (QA). Autorizado por el usuario («Crea el notebook»).
Consultas de **solo lectura**, ejecutadas por el usuario de base de datos
`supabase_read_only_user` (PostgreSQL 17.6) a las 19:44-19:46 UTC. No se modificaron datos.

Notebooks creados en el proyecto QA (contienen solo SQL de lectura; se pueden borrar
cuando ya no hagan falta):

- «Auditoría TPV 25/11 (solo lectura)» — `d74a43f4-c389-45c1-b365-e6a0620d107e`
- «Auditoría TPV 25/11 · parte 2 (solo lectura)» — `932cd704-cf01-4ee8-9230-20dab2162975`
  (la herramienta no permite añadir celdas a un notebook existente)

## Resultados

| Consulta | Resultado |
|---|---|
| Q1 · RLS de 29 tablas del TPV | **Activado en todas**, incluida `movimientos_registro`; ninguna con RLS forzado |
| Q2 · Políticas | Coinciden con las migraciones: núcleo solo `SELECT` por `private.la_tiene_local`; `encargos_empresa` con `INSERT` y `UPDATE` para `authenticated` limitados al local; `movimientos_registro` con `SELECT`, `INSERT` y `DELETE` mediante `private.plataforma_mov_permitido` |
| Q3 · `information_schema.role_table_grants` | Vacía: **no concluyente**, esa vista no muestra privilegios ajenos al usuario de solo lectura; sustituida por R1 |
| R1 · Privilegios efectivos (`has_table_privilege`) | `authenticated` **sin** `INSERT`, `UPDATE` ni `DELETE` en cuentas, pedidos, líneas, pagos, intentos, checkouts, reembolsos, ventas fiscales, comandas, caja, terminales, mesas y movimientos de stock. **Con** `INSERT`, `UPDATE` y `DELETE` en `encargos_empresa`, `pagos_encargo` y `movimientos_registro`. `anon` sin `SELECT` ni `INSERT` en ninguna |
| Q4 · Funciones `abc_*` | Todas `SECURITY DEFINER` con `search_path=""`, salvo `abc_preparar_bizum_qa` (invoker). `anon` y `public` no ejecutan ninguna. Las internas (`abc_resolver_reembolso`, `abc_confirmar_entrega_comanda`, `abc_reclamar_efectos*`, `abc_b07_*`, `abc_b09_*`, etc.) no las ejecuta `authenticated` |
| Q4 · Funciones sin migración en el repositorio | 14: `abc_preparar_ticket_fiscal_qa`, `abc_preparar_bizum_qa`, `abc_qa_confirmar_pago_simulado`, `abc_qa_compensar_efecto_cierre`, `abc_qa_cancelar_pago_cierre`, `abc_qa_listar_pendientes_cierre`, `abc_simular_apertura_cajon`, `abc_simular_impresion_ticket`, `abc_datos_ticket_correo`, `abc_registrar_ticket_correo_enviado`, `abc_emitir_vale_regalo`, `abc_consultar_vale_regalo`, `abc_confirmar_pago_vale_regalo`, `abc_guardar_tipo_negocio`. Todas ejecutables por `authenticated`; su código **no** se ha leído |
| Q5/Q6 · `private.mfa_politica` | **No existe** en QA |
| R2 · Guarda `private.la_usuario_activo()` | Exige `aal2` y menciona Cajero/a y Encargado; no usa `mfa_politica` (es la versión M03 del 10/11) |
| R3/R5 · Historial de migraciones | 275 aplicadas, de `20260904091829` a `20261116171854`. Consta `m03_server_aal2_gate`; **no consta** `mfa_politica_opcional` |
| Deriva con el repositorio | `20261115120000_mfa_politica_opcional` no aplicada. `20261113090000`/`20261113140000` (apariencia) y `20261120120000` (tarifas por horario) no figuran en el historial, pero sus funciones existen en QA: se aplicaron fuera del historial |
| Q7 · Triggers | `encargos_empresa`: **ninguno**. `pagos_encargo`: `g1_operation_id_global` (idempotencia). `movimientos_registro`: completar local y empresa |
| Q8 · `abc_preparar_ticket_fiscal_qa` | Existe, `SECURITY DEFINER`, ejecutable por `authenticated`, definición de 10 032 caracteres |
