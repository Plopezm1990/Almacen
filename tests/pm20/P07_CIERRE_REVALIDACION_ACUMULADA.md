# PM20 P07 — Revalidación acumulada de módulos con cobertura histórica fuerte

Séptimo punto de PM20. Cubre el resto de la matriz que ya tenía cierre sustentado en
paquetes anteriores: Login/sesiones, Empresas/locales/configuración, Productos/
movimientos, Inventarios/conteos/traspasos, Caja/TPV/devoluciones, Gastos/pagos/facturas/
IVA, Personal, Clientes/encargos, Producción/fichas/mermas, APPCC/aceite.

No se rehace ningún paquete cerrado. Este punto: (1) confirma que la evidencia histórica
de cierre de cada uno sigue presente en el árbol; (2) hace una revisión real (no de
memoria) de la única pieza de este bloque que P01 marcó sin ficha propia —
`VentaRapida`/TPV— antes de darla por buena; (3) confirma la regresión acumulada.

## Ficha por módulo (alcance, evidencia, riesgo)

| Módulo | Paquete(s) que lo cierran | Evidencia | Riesgo residual |
|---|---|---|---|
| Login, recuperación y sesiones | PM03 (DEC-01..05), G1 | `tests/g1/P05_PERMISOS_AISLAMIENTO_EVIDENCIA.md` | Ninguno nuevo detectado |
| Empresas, locales y configuración | PM03, PM10, PM18 P01, PM19 P05 | `tests/pm19/P05_CIERRE_CONTEXTO_ESCRITURA_UNICO.md`, `tests/pm18/P01_CIERRE_LA021_IDENTIDAD_FISCAL.md` | Ninguno nuevo |
| Productos y movimientos | PM07, PM10, PM19 | `tests/pm10/P04_LA011_PRODUCTOS_EVIDENCIA.md` | Ninguno nuevo |
| Inventarios, conteos y traspasos | PM12, PM19 P03/P05 | `tests/pm12/P05_AJUSTES_TRAZABLES.md`, `tests/pm19/P03_CIERRE_TRASPASO_LOCAL_CERRADO.md` | Ninguno nuevo |
| Caja, TPV, historial y devoluciones | PM08 (motor), este punto (pantalla TPV) | `tests/pm08/*`, verificación real de `VentaRapida` en este punto | Ninguno nuevo — ver detalle abajo |
| Gastos, pagos, facturas e IVA | PM06 (G1 LA-004), PM11-compra P05/P06 | `tests/pm11-compra/P05_FACTURA_IDENTIDAD.md`, `P06_PAGO_REVERSO_E2E.md` | Ninguno nuevo |
| Personal y submódulos | PM13 | `tests/pm13/P06_CIERRE.md` | Ninguno nuevo |
| Clientes y encargos | PM14 | `tests/pm14/P08_CIERRE_HISTORIAL_INFORMES_MOVIL_REGRESION.md` | Ninguno nuevo |
| Producción, fichas de coste y mermas | PM19 P01/P04/P05 | `tests/pm19/P04_CIERRE_MERMA_DESCUENTA_UNA_VEZ.md` | Ninguno nuevo |
| APPCC y aceite de freidoras | PM19 P01/P02/P05 | `tests/pm19/P01_CIERRE_APPCC_HISTORICO_TRAZABLE.md`, `P02_CIERRE_ACEITE_RESPONSABLE.md` | Ninguno nuevo |

## Verificación real: `VentaRapida` (TPV) nunca tenía ficha de pantalla propia

`venderCarrito`/`anularVenta` son las mismas funciones del motor ya probadas
exhaustivamente en PM07/PM08/PM09 — el componente no reimplementa nada, solo las invoca.
`productos`/`movimientos` llegan ya filtrados al local activo
(`productosDelLocalActivo`/`movimientosDelLocalActivo`).

Se confirmó además el propio criterio NR-07/"Todos nunca destino" aplicado a nivel de
**navegación de pantalla completa**, no solo de mutación individual: si el contexto de
informe (`localInformeId`) no coincide con un local activo concreto (`localActivoId`), el
TPV ni siquiera se renderiza — se muestra un aviso explícito ("El TPV no puede abrirse en
Todos los locales...") junto con el selector para elegir un local. Nunca se llega a
mostrar un carrito de venta operando sin local real.

## Archivos

- `tests/pm20/p07-revalidacion-acumulada-contract.mjs` (nuevo): confirma el bloqueo de
  TPV en "Todos" y la presencia de la evidencia histórica de cierre por módulo.

## Regresión

Suite completa del proyecto — 112/112 sin regresiones.

## Estado de main/producción

`main` = `bdf25591a1e986a04223b399d11d8fe81d41d82d`, sin tocar directamente. Sin cambios
de código en este punto (solo prueba de verificación).

**PM20_P07_CIERRE_REVALIDACION_ACUMULADA=PASS**
