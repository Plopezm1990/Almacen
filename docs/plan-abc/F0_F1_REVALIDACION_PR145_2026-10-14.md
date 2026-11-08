# Punto 3 — revalidación F0/F1 contra PR 145

Fecha: 2026-10-14 (Europe/Madrid)  
Rama: `codex/fix-account-reload-20261013`  
HEAD: `f8763edba997c84828f9bc401d81370292c8993b`  
PR: [#145](https://github.com/Plopezm1990/Almacen/pull/145), abierto, no fusionado, base `release`  
Base `release`: `82ea5130457939e17de2bfd08d3ae2f2377543f7`

## Alcance

Este documento cubre los dos subpuntos del punto 3 del Plan ABC:

- **3.1 / F0:** inventario operativo y técnico A01–C12.
- **3.2 / F1:** contratos comunes, permisos, estados, dinero, fiscalidad y aceptación.

Es una revalidación de solo lectura. No autoriza migraciones, SQL, cambios de
datos, despliegues, fusiones ni promoción a producción. Las matrices del
2026-10-02 conservan el detalle histórico; esta hoja fija el delta frente a la
cabeza exacta de PR 145.

## Evidencia de entorno

| Área | Resultado comprobado | Consecuencia |
|---|---|---|
| GitHub/PR | PR 145 abierto, `mergeable=true`, head `f8763ed…`, base `82ea513…` | No tocar `main`, `release` ni PR 38 |
| CI del head | Netlify preview `success`; `ABC F4 B02-B03` y puerta general `failure` | No es candidato de release |
| Netlify | Deploy productivo `6ace8e97622296989189d498`, `ready`, commit `82ea513…`; build `node .github/scripts/build-netlify-publish.mjs` | No se desplegó el head del PR |
| Supabase QA | `ACTIVE_HEALTHY`, ref `qjqorixtkilwsndqayyx`, PostgreSQL 17.6.1.166 | Solo datos ficticios; no se escribió |
| Supabase producción | `ACTIVE_HEALTHY`, ref `flqercbgpgmmfaakrwkc`, PostgreSQL 17.6.1.155 | Sin cambios |
| Fuente | `node --check` y recuperación `PARIDAD_CUERPO_EXACTA=1` pasan | Sin defecto sintáctico/paridad |
| Manifiesto CI | **Falla**: árbol 268, manifiesto 264; faltan cuatro contratos PM12 | Actualizar inventario sin ocultar tests ni rebajar gates |

### Alerta crítica de RLS

El asesoramiento de Supabase devuelve `rls_disabled`:

- QA: `private.g1_operation_ids_global` y `private.abc_operating_day_reglas`.
- Producción: las anteriores y `private.pm27_prod_recovery_20260914`.

No se aplicó el SQL de remediación. Diseñar políticas y habilitar RLS es un
subpunto separado que requiere revisión y autorización explícita.

## F0 — matriz A01–C12

`INCOMPLETO` exige recorrido y aceptación; `BLOQUEADO` tiene una dependencia
externa/de negocio; `PENDIENTE` carece de evidencia suficiente.

| ID | Estado | Evidencia reutilizable | Falta mínima / dependencia |
|---|---|---|---|
| A01 | PENDIENTE | No hay observación operativa formal | Ficha, medición y elección de piloto |
| A02 | INCOMPLETO | Catálogo ficticio QA, UI y contratos | Recorrido táctil/teclado/móvil y edición |
| A03 | INCOMPLETO | Cálculo servidor; D17/D31 documentados | Vectores de redondeo y confirmación fiscal |
| A04 | INCOMPLETO | RPC/migraciones y grupos de opciones | Variantes y stock en recorrido |
| A05 | INCOMPLETO | Transiciones backend | Negativas y cierre desde UI |
| A06 | INCOMPLETO | Recuperación/listado y recarga PR145 | Dos sesiones, reinicio y conflictos |
| A07 | INCOMPLETO | RPC de zonas/mesas; QA tiene 1+1 | Traslado/liberación en pantalla |
| A08 | INCOMPLETO | División/unión backend | Unión y reparto por importe/persona |
| A09 | INCOMPLETO | Descuento autorizado y política QA | Límites, aprobación, historial y fiscal |
| A10 | INCOMPLETO | Rutas de cocina en UI | Impresión, merma, cancelación y stock |
| A11 | INCOMPLETO | Reglas de día en QA; PROD sin reglas | Medianoche/DST y configuración efectiva |
| A12 | INCOMPLETO | Backend ABC y contratos | Recorridos por pantalla, dispositivos y sesiones |
| B01 | PENDIENTE | Efectivo/tarjeta decididos; sin proveedor | Ficha por medio, datáfono y conciliación |
| B02 | INCOMPLETO | Estados/identidad en QA; workflow falla | Rechazo, cancelación y notificación |
| B03 | INCOMPLETO | Idempotencia/replay y conflicto | Doble clic, recarga y dos terminales |
| B04 | INCOMPLETO | Incidencia bloquea y resolución libera | Proveedor, expiración y concurrencia |
| B05 | INCOMPLETO | Efectivo/cambio/mixto backend | Dos cajas y trazabilidad por importe |
| B06 | INCOMPLETO | Políticas publicadas, fiscal pendiente | Tratamiento de propina/anticipo/fianza |
| B07 | BLOQUEADO | Adaptador y contratos en repo | Proveedor y sandbox |
| B08 | INCOMPLETO | Límite neto y reembolso verificables | Separar dinero, mercancía y stock |
| B09 | BLOQUEADO | Modelo de liquidación/disputa | Proveedor y datos de liquidación |
| B10 | BLOQUEADO | Contratos rechazan PAN | Alcance PCI del adquirente |
| B11 | INCOMPLETO | Online + borrador local decidido | Corte de red y reintento seguro |
| B12 | BLOQUEADO | Simulador/contratos | Sandbox y matriz de casos |
| C01 | INCOMPLETO | Sesiones/cajas QA, máximo 10 | Apertura simultánea y UI |
| C02 | INCOMPLETO | Movimientos, replay y permisos QA | Pantalla y reintento |
| C03 | INCOMPLETO | Arqueo servidor QA | Recorrido histórico y aceptación |
| C04 | INCOMPLETO | Cierre/reapertura/diferencias QA | UI consolidada y aceptación |
| C05 | INCOMPLETO | Series/reserva/replay QA | Asesoría, emisor y pantalla |
| C06 | INCOMPLETO | Tipos documentales/permisos QA | Reglas fiscales y UI |
| C07 | BLOQUEADO | Puerta fiscal sin filas operativas | Asesoría, régimen, emisor y moneda |
| C08 | INCOMPLETO | Conservación/rectificación QA | Política legal, descarga y UI |
| C09 | INCOMPLETO | Idempotencia de impresión QA | Impresora real y UI |
| C10 | INCOMPLETO | Entregas/copias registradas | Envío, caducidad y UI |
| C11 | INCOMPLETO | Cadena documental/huellas QA | Conciliación y exportación |
| C12 | INCOMPLETO | Ensayo de cierre/aislamiento QA | UI, fallos externos y noche real |

**Resultado F0:** el inventario queda trazable, pero ninguna fila pasa a
aceptada. CI, B02–B03, fiscalidad, proveedor y recorridos reales siguen abiertos.

## F1 — contratos y decisiones

1. **Dinero:** EUR, dos decimales, servidor autoritativo. D17/vectores F1.5
   deben ejecutarse; D31 (precio con IVA incluido) está decidido para QA, pero
   requiere confirmación de asesoría.
2. **Estados:** pedido, pago, devolución, caja y documento necesitan actor,
   precondición, efecto y auditoría. Se reutilizan las transiciones backend;
   falta aceptación visual.
3. **Permisos:** cuatro roles (Propietario, Encargado, Cajero/a, Camarero/a),
   plantilla ajustable por empresa/local y prevalencia del local. Operaciones
   delicadas conservan su techo; no se reactivan roles retirados.
4. **Cobros:** primera fase online; efectivo y tarjeta; datáfono independiente,
   confirmación declarada y nunca PAN/secretos en cliente. Proveedor/sandbox sin
   decidir.
5. **Caja/día:** máximo inicial 10 cajas por local; `Europe/Madrid`, corte 00:00
   configurable; diferencia siempre auditada y con motivo, umbral inicial 0 € en
   QA. Producción no se tocó.
6. **Fiscal:** C07 permanece cerrada hasta asesoría, régimen, series, emisor,
   rectificación y conservación. No se inventa una modalidad fiscal.
7. **Prototipo:** backend y contratos tienen evidencia; no hay aceptación
   completa A/B/C con dispositivos y dos sesiones. PR145 solo cubre la cuenta de
   empleado tras recarga.

### Bloqueos de F1

- D24/D26/D31: asesoría fiscal y confirmación de IVA/plazos.
- D20/D23: proveedor, API, sandbox, comisiones y PCI.
- A01/A12: piloto y recorrido que Pedro acepta.
- D04: equipos y red reales.
- RLS: políticas concretas para las tablas advertidas.
- CI: inventario del manifiesto y contrato B02–B03; nunca ocultar pruebas ni
  rebajar gates.

## Cierre del punto 3

F0 queda **documentado y revalidado**. F1 queda **diseñado**, pero su salida
formal no puede declararse aprobada mientras sigan abiertas fiscalidad,
proveedor, piloto/aceptación y la puerta CI. El siguiente trabajo seguro es un
subpunto separado para CI/B02–B03 y después QA visual; no se requiere despliegue
ni SQL para cerrar esta preparación.

## Actualización 2026-10-15 — diagnóstico y corrección del gate

El job de B02–B03 del head anterior no falló en el contrato de cobros: pasaron
la preparación PostgreSQL, `ABC_F4_B02_B03=PASS`, el build de Source Recovery y
la paridad. Falló exclusivamente al validar el manifiesto porque PR 145 había
añadido estos cuatro contratos PM12 sin registrarlos:

- `p03-explicit-load-states-contract.mjs`
- `p04-context-invalidation-race-contract.mjs`
- `p05-save-confirmation-pending-context-contract.mjs`
- `p12-account-enrichment-runtime.mjs`

Se corrigieron únicamente el inventario y sus conteos coherentes:

- 268 archivos de inventario.
- 251 contratos activos.
- 224 contratos activos Node.

`validar-manifiesto-ci.mjs` y sus tres pruebas negativas pasan localmente. La
batería completa `ejecutar_bateria_no_db.sh` no se pudo ejecutar en Windows por
ausencia de Bash; no se sustituye esa prueba por una afirmación local. Queda
pendiente la confirmación de GitHub Actions en Linux.

