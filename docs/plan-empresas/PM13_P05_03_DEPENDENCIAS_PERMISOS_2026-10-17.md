# PM13 · Punto 5.3 — Dependencias entre permisos

Fecha: 2026-10-17  
Rama: `codex/fix-product-bootstrap-context-20261015`  
Alcance: diseño de dependencias. No se han cambiado resolvers, RLS, RPC, cargos ni datos.

## Regla propuesta

Una acción solo puede evaluarse como permitida si se cumplen **todas** sus dependencias explícitas:

```text
sesión válida
  → membresía activa en empresa/local
    → módulo contratado y activo
      → CONSULTAR del recurso (cuando la acción trabaja sobre un recurso visible)
        → acción concreta
          → alcance del registro (PROPIO, LOCAL o EMPRESA)
```

La cadena no se implementará como una concesión implícita. La UI puede ocultar o deshabilitar un control, pero el servidor debe volver a comprobar cada requisito.

## Dependencias generales

| Acción | Dependencia mínima propuesta | Qué no concede automáticamente |
|---|---|---|
| `CONSULTAR` | Sesión, membresía, módulo y alcance de lectura | Crear, editar, exportar, anular, aprobar o configurar |
| `CREAR` | `CONSULTAR` del recurso cuando se necesita elegir/ver el destino + alcance de creación | Editar o anular cualquier registro creado |
| `EDITAR` | `CONSULTAR` del mismo recurso + alcance sobre el registro | Crear, exportar o cambiar el ámbito del registro |
| `EXPORTAR` | `CONSULTAR` + permiso explícito de exportación + alcance de todos los registros incluidos | Acceso a registros fuera del filtro o al detalle no permitido |
| `ANULAR_ELIMINAR` | `CONSULTAR` + permiso explícito + estado anulable + alcance | Borrado físico, recuperación automática o aprobación |
| `APROBAR` | `CONSULTAR` del expediente + permiso explícito de aprobación + estado pendiente | Solicitar, registrar el pago o ejecutar otra fase |
| `CONFIGURAR` | `CONSULTAR` de la configuración + permiso explícito + autoridad de configuración | Operar transacciones ni ampliar el propio permiso |

## Dependencias operativas ya visibles en el catálogo ABC

| Flujo | Dependencia explícita | Razón |
|---|---|---|
| Cobro | `ABC_COBRO_INICIAR` → `ABC_COBRO_EFECTIVO` o resolución específica | Iniciar un cobro no equivale a confirmarlo. |
| Devolución/reembolso | `ABC_REEMBOLSO_SOLICITAR` → `ABC_REEMBOLSO_CONFIRMAR` | Solicitar y aprobar/confirmar deben poder recaer en personas distintas. |
| Cuenta | `ABC_CUENTA_OPERAR` + capacidades separadas de reasignar, repartir, unir o revertir | Operar una cuenta no concede cambios sensibles de titularidad o estructura. |
| Pedido | `ABC_CUENTA_OPERAR`/consulta del pedido + enviar, servir, cancelar o cerrar según fase | Cada transición tiene estado y permiso propio. |
| Cocina | `ABC_COMANDA_VER` → iniciar/completar preparación, cambiar o reimprimir | Ver comandas no autoriza modificar su estado. |
| Merma | Consulta de comanda/línea + `ABC_COMANDA_MERMA_DECIDIR` | Decidir una merma afecta stock y requiere acción separada. |
| Sala | `ABC_SALA_VER` → configurar zonas/mesas o reservar/bloquear según capacidad | Ver el mapa no concede configuración ni bloqueo. |
| Caja | `ABC_CAJA_OPERAR` para operación ordinaria + `ABC_CIERRE_REABRIR` para reabrir | Reabrir un cierre tiene riesgo superior y no se hereda de operar caja. |
| Documentos del emisor | Consulta de configuración + `ABC_EMISOR_CAMBIAR` | Cambiar datos fiscales no es una edición ordinaria del documento. |

## Dependencias para cargos personalizados

Cuando se conecten las acciones a `abc_cargos`, cada fila de permiso deberá declarar como mínimo:

| Campo | Obligación |
|---|---|
| `capacidad` | Clave estable de la acción; nunca el nombre visible del cargo. |
| `requiere_consulta` | Booleano explícito; para acciones sobre datos será `true` por defecto. |
| `depende_de` | Lista cerrada de capacidades necesarias, sin comodines. |
| `alcance` | `PROPIO`, `LOCAL` o `EMPRESA`; no se hereda de la pantalla. |
| `modulo` | Debe estar contratado y activo; una pantalla activa no lo sustituye. |
| `efecto` | `ORDINARIO`, `HISTORICO`, `FINANCIERO` o `FISCAL`, para exigir controles adicionales. |

Reglas invariables:

- Revocar `CONSULTAR` revoca todas las acciones que dependan de esa consulta.
- Conceder `EDITAR`, `EXPORTAR`, `ANULAR_ELIMINAR`, `APROBAR` o `CONFIGURAR` nunca activa otras acciones por efecto lateral.
- Una dependencia no puede elevar el alcance: una acción `LOCAL` no se convierte en `EMPRESA` porque la consulta sea de empresa.
- Las operaciones masivas y exportaciones evalúan las dependencias por cada registro; no se autoriza por el primer registro válido.
- Los permisos de propietario y las barreras de integridad quedan fuera del editor de cargos y no pueden ser concedidos por un cargo personalizado.
- Una clave desconocida o una dependencia ausente se deniega; no se interpreta como “permitido por compatibilidad”.

## Estado actual y huecos

1. El punto 4 guarda únicamente `ABC_PANTALLA_*_CONSULTAR`; no existe todavía una tabla de acciones por cargo personalizado.
2. El catálogo ABC existente ya separa varias acciones sensibles, pero no constituye por sí solo el resolver completo de cargos libres.
3. No se ha encontrado una autorización general de exportación; debe permanecer denegada hasta inventariar cada salida.
4. Las capacidades de aprobación y confirmación están separadas en los flujos ABC, pero deben quedar expresas también en la futura matriz de cargos.
5. La dependencia entre consulta y acción debe aplicarse en servidor y UI; un botón oculto no es una barrera.

## Decisiones que quedan para aprobación antes de implementar

- Confirmar que toda acción sobre datos requiere la consulta del mismo recurso.
- Confirmar si alguna acción de creación puede ejecutarse sin permiso de consulta cuando el flujo no muestra registros previos.
- Confirmar la lista de dependencias de cada operación masiva y exportación.
- Confirmar si una aprobación puede ser `PROPIO` o debe ser siempre `LOCAL`/`EMPRESA`.

## Estado del subpunto

**5.3 — dependencias inventariadas y política conservadora documentada; falta la aprobación de las decisiones indicadas para convertirla en contrato ejecutable.** No se han cambiado permisos, tablas, RPC, datos, QA, producción ni despliegues.

Siguiente subpunto, solo con autorización: **5.4 — proteger las acciones exclusivas del propietario y los límites no delegables.**
