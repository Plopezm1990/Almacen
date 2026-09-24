# F3/A09 — descuentos y cortesías: diseño local

Estado: **diseño y cálculo de referencia; sin migración aplicable ni RPC A09**. Base: `release` en `89a163906d2b7c3c7c082e0c0d7a65c334e3871e`, tras el cierre técnico A08 en PROD del 24/09/2026. Rama local `codex/abc-f3-a09-discounts-comps`.

## Contratos y dependencias comprobados

- A03 (`20260924010000`): `private.abc_calcular_linea_tpv` y las altas/ediciones de `pedido_lineas` fijan descuento cero y calculan importes en servidor. La línea guarda `descuento_total`, `base`, `impuestos`, `total`, `version` y snapshots.
- A04 (`20260924020000`): la línea configurada contiene producto y opciones con bases y tipos de IVA potencialmente distintos. `catalogo_tpv_opciones.delta_precio` admite valores negativos. Por ello no basta con multiplicar el total de la línea por un porcentaje; hay que definir cómo distribuir el descuento entre componentes fiscales firmados y reconciliar cada impuesto.
- F2 M02A: `ventas_fiscales` y `venta_fiscal_lineas` conservan importes derivados de la línea y pueden estar `BLOQUEADA` o `CERRADA`. El contrato PM03 exige que IVA, descuento y total concilien; el ticket sigue siendo recibo interno, sin afirmar validación fiscal operativa.
- A08 (`20260924060000`): `cuenta_linea_repartos` materializa descuento, base, IVA y total desde `pedido_lineas`; `private.abc_total_comercial_cuenta` usa esos importes y cuotas. Modificar la línea después de un reparto haría incoherente el saldo. Las fusiones/cuotas y los cobros A06 dependen del saldo comercial.
- F2 M03A: `private.abc_tiene_capacidad` es el adaptador actual de permisos; `abc_operaciones` proporciona idempotencia/huella de petición y `abc_eventos` registra operaciones. A09 debe seguir este patrón, con `auth.uid()` y ámbito empresa/local en servidor.

## Contrato funcional propuesto

1. Operaciones explícitas `PERCENT`, `AMOUNT` y `COURTESY`, sobre una línea o sobre una cuenta abierta. `COURTESY` equivale a cubrir el 100 % de la base elegible y queda etiquetada de forma distinta al descuento ordinario. Moneda, motivo no vacío, solicitante, autorizador, porcentaje o importe, hora, empresa y local son obligatorios en el registro de auditoría. Una repetición con el mismo `operation_id` y el mismo cuerpo devuelve el resultado original; con cuerpo distinto falla.
2. La base es el importe antes de impuestos y después de cualquier descuento anterior. Un porcentaje se calcula sobre esa base; un importe se distribuye proporcionalmente con residuo mayor a precisión interna de ocho decimales y desempate estable por identificador. Cada componente recalcula su IVA y `total = base + IVA`. La presentación a dos decimales no altera el asiento interno; el documento final debe conciliar explícitamente sus redondeos.
3. El servidor vuelve a leer y bloquea cuenta, pedido, líneas y componentes en orden estable; compara versiones esperadas. Verifica local, moneda, estado, capacidad, límite aplicable y saldo antes de escribir. Solicitud y autorización se registran como identidades separadas. La aprobación por una segunda persona, si se configura, exige identidad distinta con capacidad suficiente; jamás se acepta un identificador de autorizador enviado por el cliente como prueba de aprobación.
4. Límite inicial de política recuperado de decisiones F1: Encargado hasta 20 %, Propietario hasta 100 %. La configuración efectiva por empresa, local, perfil y usuario y la concesión a otros perfiles requieren una tabla de política auditada y una precedencia inequívoca antes de activar RPC. Cortesía, edición manual de precio y descuentos son capacidades distintas; editar precio no se incluye en A09. La autorización compara descuento acumulado con base original, no solo el incremento, para impedir superar el límite mediante varias llamadas pequeñas.
5. No se modifica una línea `CANCELADA`, una cuenta cerrada, una venta fiscal bloqueada/cerrada, una línea con venta fiscal no cancelada, cobro/check-out o saldo reservado. Hasta implementar una actualización atómica y probada de A08, también se rechaza cualquier línea con reparto activo o cuota activa en su cuenta. El descuento de cuenta se traduce en asignaciones trazables por línea; no se añade una rebaja agregada invisible a A08.
6. Las opciones A04 con base negativa se rechazan en la primera entrega A09 mientras no exista una regla fiscal aprobada y ensayada para distribuir descuentos entre componentes positivos y negativos. Se conserva el pedido original sin cambios. El cálculo local actual modela solamente componentes no negativos.
7. Escritura de importes, snapshots, evento de auditoría, nueva versión y resultado idempotente en **una transacción**. Sin actualización directa por `authenticated`; tablas de política y auditoría con RLS/ACL explícitos y RPC `SECURITY DEFINER` con `search_path` fijo. Denegación entre empresas/locales y para `anon`/`service_role` en el contrato. Ningún flujo A09 inicia pagos ni despliegues.

## Trabajo local realizado

- `tests/f3/a09/discount-math.mjs`: aritmética de referencia con enteros de escala 10⁸ para descuentos, IVA y reparto. Es deliberadamente independiente del producto; **no se invoca desde una RPC ni constituye la implementación de base de datos**.
- `tests/f3/a09/discount-math.test.mjs`: vectores A03, A04 con IVA mixto, cortesía, redondeo determinista, límites y entradas inválidas. Ejecutar `node --test tests/f3/a09/discount-math.test.mjs`.
- Se creó mediante Supabase CLI un nombre de migración A09, pero el archivo vacío se retiró de `supabase/migrations`: nunca debe registrarse una migración vacía como aplicada. La implementación SQL y su contrato se crearán juntos cuando se haya resuelto el modelo fiscal de A04 y el bloqueo/actualización de A08.

## Criterios de aceptación pendientes

- Contrato PostgreSQL desechable de RPC, idempotencia, límites acumulados, doble autorización, motivo/auditoría, errores de versión, estados y aislamiento empresa/local; paridad de cálculo con los vectores de referencia y reconciliación fiscal a ocho y dos decimales.
- Contrato de A04 con modificadores negativos y tasas mixtas, o exclusión explícita validada por producto; contrato de A08 que pruebe rechazo o recálculo atómico de repartos, cuotas, fusiones y saldos.
- Revisión de RLS/ACL/propiedad de funciones, migración reversible y ruta de recuperación, CI verde. Si se propone QA/PROD, presentar SQL exacto, preflight, impacto y recuperación y pedir autorización específica antes de cualquier escritura.
- Antes de cualquier push, comprobar los eventos Git que disparan builds del sitio Netlify y su configuración efectiva. No hay push ni despliegue en esta etapa.

F3/A09 permanece **en desarrollo**. Este diseño no habilita descuentos/cortesías para el piloto de San Ginés y no valida cobros reales.
