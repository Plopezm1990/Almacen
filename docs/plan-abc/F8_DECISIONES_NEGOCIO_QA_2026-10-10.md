# F8 — Decisiones de negocio aplicadas y verificadas en QA

Fecha: 2026-10-10  
Proyecto: `qjqorixtkilwsndqayyx` (QA)  
Local de prueba: `QA-EMP-A / QA-A1`  
Actor de comprobación: Propietario QA `16c79749-a206-47d9-8d56-fbc7a4a49eb7`

## Resultado

La configuración elegida para el piloto de Chocoloyos S.L. queda aplicada de forma efectiva en QA. No se modificó producción.

## Decisiones comprobadas

1. **Modalidades del piloto**
   - BARRA: habilitada en el local.
   - MESA: habilitada en el local.
   - TERRAZA: habilitada en el local.
   - TAKEAWAY: habilitada por la configuración efectiva por defecto del local.
   - El RPC de lectura devuelve las cuatro modalidades elegidas; no se creó una fila artificial para TAKEAWAY porque el diseño la considera habilitada por defecto cuando no existe una desactivación explícita.

2. **Día operativo y cajas**
   - Zona horaria: `Europe/Madrid`.
   - Corte: `00:00`.
   - Máximo configurado: `10` cajas abiertas por local.
   - El umbral de diferencia de caja sigue en `0` por defecto, de acuerdo con la decisión de exigir revisión de cualquier diferencia.

3. **Precios**
   - Catálogo activo: 30 filas.
   - Filas con `precio_con_impuesto`: 30.
   - Relación servidor: `round(precio_unitario * (1 + impuesto_pct / 100), 2) = precio_con_impuesto` en todas las filas.
   - Se mantiene la decisión de mostrar el precio con IVA incluido y derivar la base en servidor.

4. **Propinas, anticipos y fianzas**
   - Existen las tres políticas B06: `PROPINA`, `ANTICIPO` y `FIANZA`.
   - Las tres mantienen `PENDIENTE_ASESORIA` en estado, tratamiento fiscal y documento requerido.
   - Sus capacidades de registro y devolución están publicadas por las RPC ABC, sin afirmar todavía un tratamiento fiscal definitivo.

5. **Pagos**
   - QA admite `EFECTIVO` y `TARJETA` en el contrato de pago/caja.
   - El datáfono sigue siendo independiente y de confirmación declarada; no se activó ningún proveedor ni se almacenan datos de tarjeta.

6. **Puerta fiscal**
   - `abc_c07_modalidades_fiscales` contiene 0 filas.
   - La puerta fiscal productiva permanece cerrada hasta recibir la decisión de asesoría y el emisor correspondiente.

## Integración D09–D11 aplicada en QA

Se aplicó la migración `20261010150000_abc_d09_d11_stock_order_integration` y la protección de devoluciones `20261010153000_abc_d10_legacy_refund_guard`.

- BARRA y TAKEAWAY consumen al confirmar la línea.
- MESA y TERRAZA crean una reserva sin bajar el saldo disponible.
- Al iniciar preparación, la reserva pasa a consumo y descuenta del libro PM07.
- Una cancelación antes de preparar libera la reserva o revierte un consumo recuperable.
- Una cancelación tras iniciar preparación registra `MERMA_COMANDA` y no repone unidades.
- La devolución legacy se permite para una línea ABC aún recuperable en `CONFIRMADA` y se bloquea con `devolucion_abc_no_recuperable` cuando ya está preparada, servida o marcada como merma.
- El camino offline de la UI no aplica una devolución ABC sin validación online; conserva el borrador para reintentar con el servidor.

## Prueba QA realizada

Con producto `QA-CAT-A1-AGUA`, en una transacción revertida:

- BARRA: consumo y reverso, saldo final restaurado.
- TERRAZA: reserva con saldo intacto.
- MESA: consumo al iniciar preparación y merma al cancelar después.
- Devolución recuperable: estado final `REVERTIDA`.
- Devolución tras preparación: rechazada con `devolucion_abc_no_recuperable`.

La configuración y el subbloque de stock quedan **aplicados y verificados en QA**. La producción no se tocó.

## Paso 3 — comprobación de interfaz

Se revisó el candidato local y los contratos de la interfaz:

- `tests/f3/a02/a02-1-contract.mjs`: PASS.
- `tests/f3/a07/a07-1-ui-contract.mjs`: PASS.
- `tests/f3/a07/a07-2-ui-contract.mjs`: PASS.
- `tests/f3/a10/a10-ui.test.mjs`: 4/4 PASS.
- `tests/cfg/cfg6-ui-contract.mjs`: PASS.
- `tests/cfg/cfg6e-ui-contract.mjs`: PASS.
- `node --check fuente.js`: PASS; `git diff --check`: PASS.

El preview `deploy-preview-123--chic-entremet-9107cf.netlify.app` responde con la protección de equipo de Netlify en la sesión de comprobación disponible. Por ello no se ha podido ejecutar la prueba manual autenticada de apertura de cuenta desde el preview. La pestaña `https://chic-entremet-9107cf.netlify.app/` se dejó sin cambios y no se usó para escribir en producción.

Además, la lectura de QA confirma que `QA-A1` todavía tiene 0 zonas y 0 mesas activas. Esto permite validar BARRA y TAKEAWAY desde el circuito de pedido, pero impide una prueba manual de sala para MESA y TERRAZA hasta que el preview autenticado y la configuración de sala estén disponibles. No se crearon datos de sala artificiales para maquillar la prueba.

**Estado del Paso 3:** contratos de UI cerrados; prueba manual en preview pendiente por protección Netlify y ausencia de zonas/mesas en `QA-A1`.
