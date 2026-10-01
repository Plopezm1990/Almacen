# F1.1 — contratos comunes antes de programar

Fecha: 2026-10-01  
Estado: `PENDIENTE_APROBACION_DE_NEGOCIO`  
Base: Plan ABC oficial y `origin/release` `7859508`

Este documento fija la frontera que deben respetar los paquetes posteriores.
No aplica migraciones, no elige proveedor y no convierte una simulación en
aceptación fiscal o bancaria.

## 1. Contrato monetario

| Decisión | Propuesta segura para revisar | Estado |
|---|---|---|
| Moneda | ISO 4217 por empresa/local | `PENDIENTE` |
| Representación | unidad menor o decimal exacto según moneda | `PENDIENTE` |
| Redondeo | regla única documentada y reproducible | `PENDIENTE` |
| Impuestos | tipo, inclusión y base conservados por línea | `PENDIENTE` |
| Precio histórico | la línea conserva precio e impuesto autorizados | `PENDIENTE` |
| Descuento | motivo, actor, límite y aprobación trazables | `PENDIENTE` |
| Reparto | suma exacta; céntimo asignado por regla estable | `PENDIENTE` |

Ningún cliente puede decidir el total final enviando un importe libre. El
servidor calcula y devuelve el desglose autorizado; la interfaz lo presenta.

## 2. Estados separados

Los siguientes estados no se sustituyen entre sí:

| Objeto | Estados mínimos a definir | Regla de separación |
|---|---|---|
| Pedido | borrador, abierto, enviado, servido, cerrado, cancelado | preparación no equivale a cobro |
| Pago | pendiente, autorizado, confirmado, rechazado, desconocido, reembolsado | desconocido exige conciliación |
| Documento | pendiente, emitido, rechazado, rectificado | emitir no significa cobrar |
| Caja | sesión abierta, cerrada, diferencia | saldo sale de movimientos |
| Stock | reservado, consumido, devuelto, merma | devolver dinero no repone producto preparado |

Cada transición tendrá actor, contexto empresa/local, condición previa, efecto
esperado y operación idempotente. Un reintento con el mismo identificador y
otro contenido debe producir conflicto.

## 3. Permisos y contexto

- Toda operación valida `auth.uid()`, empresa, local, rol y capacidad en
  servidor.
- La UI no puede elevar permisos ni cambiar identificadores de contexto para
  acceder a otra empresa o local.
- Cobro, devolución, descuento, cierre y reapertura tendrán permisos separados
  cuando el negocio lo confirme.
- La auditoría conserva actor, causa, operación, estado anterior y estado nuevo.
- `anon`, una sesión revocada y un contexto ajeno deben fallar sin efectos
  parciales.

## 4. Externos y resultado desconocido

Para datáfono, proveedor fiscal, impresora o cualquier efecto externo, la base
solo registra el intento, referencia, estado, reintentos y última incidencia.
Una transacción SQL no demuestra por sí sola que el sistema externo cobró o
emitió. Un timeout no permite realizar un segundo cargo ciego.

B07, B08 y B12 siguen detrás de adaptadores y contratos hasta que exista un
proveedor elegido y un sandbox verificable.

## 5. Fiscalidad pendiente de asesoría

| Decisión | Estado requerido antes de C03 |
|---|---|
| Territorio y régimen | `PENDIENTE_ASESORIA` |
| Emisor propio o integrado | `PENDIENTE_COMPARACION` |
| Serie, numeración y rectificación | `PENDIENTE_DEFINICION` |
| Exportación y conservación | `PENDIENTE_DEFINICION` |
| Pruebas oficiales | `PENDIENTE_FUENTE_OFICIAL` |

No se implementa una declaración fiscal ni se marca un documento como válido
solo por mostrar una pantalla o generar un PDF.

## 6. Criterios de aceptación F1.1

1. Los vectores monetarios aprobados coinciden en cliente, servidor y pruebas.
2. Alterar precio, impuesto, descuento, empresa o local en la petición falla.
3. Las transiciones incompatibles fallan sin escritura parcial.
4. Un resultado externo desconocido queda consultable y no genera doble cargo.
5. La fiscalidad permanece explícitamente pendiente hasta la decisión de
   asesoría y la fuente oficial aplicable.

## Resultado de F1.1

El contrato común queda preparado para revisión. Hasta que se aprueben moneda,
redondeo, impuestos, permisos y régimen fiscal, los paquetes posteriores deben
usar estos valores como `PENDIENTE` y no inventar decisiones. No requiere
secrets, migración remota, merge ni deploy de Netlify.
