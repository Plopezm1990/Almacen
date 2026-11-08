# Preparación de promoción C07-D — 2026-10-30

## Alcance

Este documento prepara la promoción técnica del circuito C07-D desde QA hacia producción.
Es una matriz de comparación y preflight. No aplica migraciones, no modifica producción,
no copia datos de QA y no activa emisión fiscal real.

Proyectos comprobados:

- QA: `qjqorixtkilwsndqayyx`.
- Producción: `flqercbgpgmmfaakrwkc`.

## Resultado ejecutivo

La promoción queda en **NO-GO técnico para producción**.

La aplicación productiva está sana y el bloqueo que muestra el TPV es correcto: producción
no tiene todavía los objetos C07-D necesarios para evaluar una configuración
`VALIDADA/ACTIVA`. La promoción no debe hacerse copiando solamente la configuración de QA
ni aplicando una migración C07-D marcada `QA-only` sin preparar antes una variante de
producción.

## Comparación de estado

| Área | QA | Producción | Decisión |
|---|---|---|---|
| Proyecto Supabase | Activo | `ACTIVE_HEALTHY` | OK |
| Entidad fiscal | Simulada de fixture | Simulada, NIF vacío | No apto para fiscalidad real |
| Configuración C07-D | 1, `VALIDADA`, `SIMULADOR_C07D`, entorno `QA` | 0 | Falta promoción técnica |
| Registro C07-D | 14 | 0 / tabla ausente | Falta objeto de producción |
| Cola fiscal C07-D | 14: 11 `PENDIENTE`, 3 `ACEPTADO` | Tabla ausente | Falta objeto de producción |
| Piloto sandbox | 0 | Tabla ausente | No promover datos; solo código tras revisión |
| Serie C05 | Presente | Presente | Reconciliar y verificar dependencias |
| Multiempresa base | Borradores y panel en ambos | Borradores y panel en ambos | Delegación/representación aún incompleta en producción |
| Transporte AEAT | Desactivado | No disponible | No activar |

La comparación de migraciones se ha normalizado por nombre semántico porque QA conserva
versiones históricas con timestamps distintos para algunas migraciones ya presentes en
producción. No se ha interpretado una diferencia de timestamp como permiso para reaplicar
DDL.

## Migraciones C07-D candidatas

El conjunto que existe en el repositorio y está representado en QA es:

1. `20261027130000_abc_f7_c07d_c05_reconcile.sql`
2. `20261027131500_abc_f7_c07d_fiscal_chain_queue.sql`
3. `20261027133000_abc_f7_c07d_chain_hardening.sql`
4. `20261027134500_abc_f7_c07d_fk_indexes.sql`
5. `20261027135000_abc_f7_c07d_entity_fk_index.sql`
6. `20261027143000_abc_f7_c07d_checkout_emit_qa.sql`
7. `20261027150000_abc_f7_c07d_d2_emission_config.sql`
8. `20261027151000_abc_f7_c07d_d2_emission_config_fix.sql`
9. `20261027152000_abc_f7_c07d_d2_adapter_scope_fix.sql`
10. `20261027160000_abc_f7_c07d_d2_emission_wiring.sql`
11. `20261027161000_abc_f7_c07d_d2_emission_resolver_lock_fix.sql`
12. `20261027162000_abc_f7_c07d_d2_emission_config_indexes.sql`
13. `20261027163000_abc_f7_c07d_d2_3_frontend_config_status.sql`
14. `20261027150403_abc_f7_c07d_d3_pilot_sandbox.sql`

Estas migraciones son un **paquete de análisis**, no una orden de aplicación. Varias llevan
explícitamente la protección `QA-only`, transporte AEAT `DISABLED` o guardas para no
guardar secretos. Antes de producción deben transformarse en una variante de producción
revisada, conservando esas garantías y separando claramente:

- infraestructura C07-D;
- configuración por empresa/local/entidad/serie;
- adaptador y transporte;
- piloto sandbox;
- integración de credenciales mediante referencia opaca server-side;
- activación real, que sigue bloqueada.

## Dependencias de empresa y representación

Para un piloto real también están en QA las piezas de representación fiscal:

- `abc_fiscal_multiempresa_delegacion`;
- `abc_fiscal_multiempresa_delegacion_accept`;
- `abc_fiscal_multiempresa_representacion_read`;
- `abc_fiscal_multiempresa_delegacion_lifecycle_checks`.

No se deben promocionar datos de la empresa ficticia `QA-EMP-A` ni la configuración
`SIMULADOR_C07D`. Esos datos sirven para verificar el contrato, no para representar a una
empresa ante la AEAT.

## Preflight de código ejecutado

Todos los contratos siguientes terminaron correctamente:

- `ABC_F5_C07D_PREFLIGHT_CONTRACT=PASS`.
- `ABC_F7_C07D_MIGRATION_CONTRACT=PASS`.
- `ABC_F7_C07D_C05_CLEAN_FIXTURE_CONTRACT=PASS`.
- `C07D_D2_CONFIG_CONTRACT=PASS`.
- `C07D_D2_WIRING_CONTRACT=PASS`.
- `C07D_D2_6_ACTIVATION_DOSSIER=PASS`.
- `C07D_D3_PILOT_SANDBOX_CONTRACT=PASS`.
- `C07D_D3_PILOT_SANDBOX_MIGRATION=PASS`.
- Matriz QR: 4 pruebas `PASS`.
- Manifest seco de promoción: `14` archivos identificados, `4` con marca QA-only y puerta
  `BLOCKED_UNTIL_PRODUCTION_VARIANT`.

Esto demuestra que el diseño y el paquete fuente pasan sus contratos. No demuestra que
producción tenga aplicado el esquema C07-D; la consulta de producción demuestra lo
contrario.

## Bloqueos para promover a producción

### Bloqueo 1 — objetos de base de datos

Producción no tiene las tablas `abc_c07d_*` de registros, cola, adaptadores ni configuración
privada. Tampoco expone las RPC C07-D completas de emisión, estado, configuración y cola.

El preflight de C05 en producción ha comprobado que actualmente hay `0` series y `0`
documentos C05; por tanto, no hay histórico que reconciliar ni conflicto de emisor en esta
base. Aun así, la migración de reconciliación contiene cambios de esquema y backfill, por
lo que no se puede aplicar sin revisión y una ejecución controlada.

### Bloqueo 2 — configuración fiscal real

La entidad productiva actual es simulada y no tiene identificador fiscal. Faltan, como
mínimo:

- razón social legal;
- NIF/CIF válido;
- domicilio y datos fiscales;
- entidad fiscal no simulada;
- serie C05 real;
- asesoría o responsable autorizado;
- modalidad y adaptador fiscal aprobados;
- entorno de pruebas o sandbox externo, si el proveedor lo exige;
- referencia server-side a las credenciales, sin almacenar secretos en tablas públicas,
  frontend, commits o logs.

### Bloqueo 3 — aprobación de emisión

Aunque se promueva la infraestructura, la emisión debe quedar bloqueada hasta que exista
una configuración revisada y aprobada con los estados previstos (`BORRADOR`, `VALIDADA`,
`ACTIVA`). No se debe marcar `ACTIVA` con datos ficticios.

### Bloqueo 4 — reconciliación histórica

Producción contiene cuatro registros internos `ventas_fiscales` en estado `ABIERTA`. No
son registros C07-D ni facturas AEAT, pero deben revisarse y reconciliarse antes de
presentar producción como limpia para un piloto real.

## Puertas de promoción

| Puerta | Resultado |
|---|---|
| P0 — inventario QA/producción | `PASS`, solo lectura |
| P1 — contratos estáticos y de migración | `PASS` |
| P2 — no secretos en configuración/fixtures | `PASS` |
| P3 — QA con configuración simulada | `PASS` |
| P4 — producción con esquema C07-D | `NO-GO`, objetos ausentes |
| P5 — empresa real y representación | `BLOQUEADA`, aún no existe empresa piloto |
| P6 — credenciales/adaptador fiscal externo | `BLOQUEADA`, requiere proveedor/asesoría |
| P7 — aplicación a producción | `NO EJECUTADA` |

## Próximo paso autorizado

El siguiente paso seguro es preparar una **variante de producción de las migraciones C07-D**
en una rama o entorno desechable, ejecutar allí los contratos y la auditoría RLS, y generar
un diff final para aprobación. Después se podrá decidir si se promueve únicamente la
infraestructura o si se espera a disponer de una empresa piloto real.

Hasta esa aprobación no deben ejecutarse `supabase_apply_migration`, `supabase_merge_branch`
ni escrituras de configuración en el proyecto `flqercbgpgmmfaakrwkc`.

