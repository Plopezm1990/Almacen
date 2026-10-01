# F0.4 — inventario técnico y operativo

Fecha: 2026-10-01  
Estado: `PENDIENTE_RECOGIDA_DE_DATOS`  
Base: F0.1–F0.3 sobre `origin/release` `7859508`

Esta matriz registra dependencias que afectan al diseño y a las pruebas. No
selecciona proveedor, no compra hardware y no incorpora datos reales de
clientes o ventas.

## Catálogo, importes y reglas

| Área | Qué se debe confirmar | Valor actual | Evidencia prevista |
|---|---|---|---|
| Catálogo | productos, unidades y activos | `PENDIENTE` | exportación ficticia o lectura controlada |
| Precios | precio vigente e histórico por línea | `PENDIENTE` | caso con cambio de precio |
| Variantes | tamaños, extras y compatibilidades | `PENDIENTE` | dos líneas del mismo producto |
| Impuestos | tipos, inclusión y redondeo | `PENDIENTE` | vector monetario aprobado |
| Descuentos | límites, motivo y aprobación | `PENDIENTE` | usuario autorizado y denegado |
| Stock | unidad, receta, reserva y consumo | `PENDIENTE` | venta y devolución ficticias |

## Roles y permisos

| Rol existente | Contexto | Operaciones previstas | Estado |
|---|---|---|---|
| Propietario | empresa/local | configuración y aceptación | `PENDIENTE` |
| Encargado | local | operación y supervisión | `PENDIENTE` |
| Cajero | caja/local | cobro y arqueo | `PENDIENTE` |
| Camarero | local/mesa | pedido y preparación | `PENDIENTE` |
| Otro | `PENDIENTE` | `PENDIENTE` | `PENDIENTE` |

La matriz no concede permisos. Solo documenta los que deben probarse en
backend y UI, incluyendo aislamiento entre empresas y locales.

## Equipos y periféricos

| Equipo o periférico | Datos mínimos | Estado | Prueba posterior |
|---|---|---|---|
| Terminal de caja | sistema, navegador y pantalla | `PENDIENTE` | foco, táctil, teclado y lectura |
| Móvil/tableta | sistema, navegador y tamaño | `PENDIENTE` | recorrido de venta y recuperación |
| Impresora | modelo, conexión y caracteres | `PENDIENTE` | ticket, corte y fallo |
| Cajón | método de apertura autorizada | `PENDIENTE` | apertura vinculada a operación |
| Datáfono | modelo, contrato y API | `PENDIENTE` | sandbox del proveedor, no simulación como cierre |
| Red | tipo, cobertura y corte esperado | `PENDIENTE` | reconexión y contingencia |

## Reglas de seguridad de la recogida

- Usar únicamente datos ficticios o metadatos no sensibles.
- No copiar credenciales, tokens, PAN, CVV, clientes ni ventas reales.
- Registrar solo nombres lógicos de secretos; sus valores se cargarían después
  en el almacén autorizado del entorno correspondiente.
- Un periférico no se considera compatible hasta observar su prueba concreta.
- El inventario no autoriza compras, contratos, migraciones, merge ni deploy.

## Resultado de F0.4

La matriz técnica queda lista para completar con el local piloto. El siguiente
paso será convertir los datos confirmados en una matriz A01–C12 con evidencias,
pruebas y costes; cualquier elemento sin confirmación permanecerá `PENDIENTE`.
