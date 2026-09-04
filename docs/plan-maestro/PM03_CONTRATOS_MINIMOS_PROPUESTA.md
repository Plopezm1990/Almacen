# PM-03 · Contratos mínimos · PROPUESTA PARA APROBACIÓN

Fecha: 2026-09-04
Rama: `pm03-contratos-minimos`
Base: cierre PM-02 (`f6cd04d7b4616ccbaa1901e7ea0c6b97c0b2b72d`)
Estado: **PM-03 EN CURSO · DEC-01, DEC-02 Y DEC-03 APROBADOS · DEC-04…05 PENDIENTES**
Producción/main: **sin cambios**

## Objetivo

Cerrar DEC-01…DEC-05 antes de modificar la lógica funcional. Se elige la opción mínima compatible con el diseño actual de L&A Suite y con las decisiones ya documentadas. Ningún contrato de este documento autoriza por sí mismo una publicación ni una modificación de producción.

---

## DEC-01 · Alcance de datos y propiedad — APROBADO

### Regla general
- Ningún dato de negocio se comparte entre empresas salvo una futura función explícita y autorizada.
- El selector de empresa/local es contexto de interfaz, no una credencial. Toda lectura o mutación debe comprobar pertenencia y permiso.
- Un local siempre pertenece a una empresa. Nunca es válida una relación `empresa A + local B1`.

### Ámbito aprobado por entidad

**Global de plataforma**
- Identidad del producto `L&A Suite`.
- Catálogos técnicos del sistema y plantillas de permisos que no contengan datos de negocio de tenants.

**Propiedad de empresa, compartidos entre locales autorizados de esa misma empresa**
- Ficha de empresa / identidad societaria y branding por defecto.
- Proveedores.
- Clientes.
- Catálogo de productos de la empresa, con habilitación/configuración por local cuando corresponda.
- Configuraciones empresariales comunes.

Un proveedor/cliente/producto de Empresa A puede estar disponible en A1 y A2, pero nunca en Empresa B. Si en el futuro se necesita restringir un proveedor/cliente/producto a determinados locales, debe ser una asignación explícita dentro de su propia empresa.

**Propiedad local / operación local**
- Stock total, stock de piso/almacén y movimientos.
- Pedidos, recepción, albaranes operativos y conteos.
- TPV, ventas, anulaciones, devoluciones y tickets.
- Caja, arqueos y movimientos de caja.
- Gastos y facturas directas, conservando además su empresa propietaria.
- Encargos y operaciones de producción.
- APPCC, aceite, mermas y controles operativos.
- Fichajes, turnos, nóminas y asignaciones operativas según el local autorizado.

**Auditoría**
- Actor estable + empresa + local cuando aplique + operación + objeto + fecha/hora.
- La vista consolidada solo puede existir de forma deliberada y para un rol autorizado.

**Todos los locales**
- Solo lectura consolidada dentro de la empresa activa y únicamente sobre locales autorizados.
- Toda mutación exige un local destino explícito.
- TPV operativo bloqueado en contexto `Todos los locales`.

**Local inactivo/cerrado**
- Conserva históricos autorizados.
- No admite nuevas operaciones ordinarias.
- Correcciones posteriores requieren un flujo específico, trazable y autorizado.

### Ejemplos
Válido: proveedor P-A pertenece a Empresa A y puede usarse en pedido A1 y A2.
Inválido: proveedor P-A aparece, se selecciona o se modifica desde Empresa B.
Válido: informe `Todos los locales` agrega A1+A2 para un Propietario A autorizado.
Inválido: crear una venta desde `Todos los locales` sin destino local.

---

## DEC-02 · Stock, disponibilidad, unidades y reservas — APROBADO

### Modelo aprobado
- El catálogo de productos pertenece a la empresa; las existencias físicas pertenecen siempre al local.
- `stock` = total físico del producto en el local.
- `stockPisoVenta` = subconjunto del total que está en piso de venta.
- `stockAlmacen = stock - stockPisoVenta`.
- No se permiten saldos negativos.
- Venta, consumo, merma, ajuste ordinario o traspaso se rechazan antes de mutar si la disponibilidad es insuficiente.
- El stock consolidado de empresa es únicamente informativo; nunca se usa como stock vendible de un local.

### Unidades
- Unidades indivisibles (ud, botella, pieza, caja cuando sea unidad de control): cantidades enteras positivas.
- Unidades fraccionables (kg, g, l, ml u otras declaradas como fraccionables): decimales positivos con precisión definida por el producto/unidad.
- No se redondea una cantidad inválida a cero para aceptarla.
- No se admite fraccionar una unidad indivisible salvo configuración expresa del producto.

### Reservas
- No existe reserva implícita por abrir carrito, pedido, encargo o formulario.
- Una reserva solo descuenta disponibilidad si existe un estado de reserva explícito, persistente, identificable e idempotente.
- Cuando existan reservas seguras: `disponible = stock físico - reservado`.
- Hasta implementar reservas seguras, un carrito o formulario abierto no reduce existencias ni se considera stock reservado.

### Movimientos internos y traspasos
- Dentro del local: mover almacén ↔ piso tiene efecto neto total 0 sobre el stock total.
- Entre locales de una misma empresa: la operación es atómica; resta origen y suma destino como una sola operación lógica. Si falla cualquiera de las dos partes, no se confirma ninguna.
- El producto pertenece al catálogo de la empresa y debe estar habilitado/configurado de forma compatible en el local destino.
- Ambos locales deben pertenecer a la misma empresa y el usuario debe tener permiso sobre la operación.
- Si la unidad no coincide, se bloquea salvo que exista una conversión explícita aprobada.
- No existe excepción automática para permitir negativo. Una futura excepción necesitará decisión expresa y trazabilidad.

### Ejemplos
Válido: A1 tiene 23 disponibles; vender 2 → total 21.
Inválido: A1 tiene 23 disponibles; vender 24 → rechazo completo, sin venta, cobro ni movimiento.
Válido: mover 5 de almacén a piso → total del local no cambia.
Válido: traspasar 4 unidades A1→A2 → A1 resta 4 y A2 suma 4 en una única operación confirmada.
Inválido: A1 resta 4 pero A2 no recibe 4 y el sistema considera el traspaso completado.
Inválido: traspasar 2 kg hacia un destino medido en unidades sin conversión definida.

---

## DEC-03 · Operación sin conexión — APROBADO

L&A Suite distingue dos modos.

### A. Solo este equipo / local puro
- Un único dispositivo es la autoridad de trabajo.
- Puede funcionar sin internet.
- No promete sincronización con otros dispositivos ni concurrencia remota.
- La interfaz debe diferenciar claramente `Guardado en este equipo` de `Sincronizado en la nube`.

### B. Modo sincronizado / multi-dispositivo
- El backend es la autoridad para operaciones compartidas y operaciones que pueden colisionar entre dispositivos.
- Si no existe conexión confirmable, se pueden consultar datos locales y preparar borradores, pero no se confirman mutaciones críticas.
- Mientras no haya una política demostrada de reserva/sincronización, se bloquean en modo sincronizado las mutaciones críticas que podrían producir sobreventa o duplicidad: venta/stock, recepción, pago, devolución/reembolso, traspaso y cierre/arqueo con efectos compartidos.
- Una operación crítica enviada al backend utiliza un `operationId` estable e idempotente.
- Un timeout después de enviar una operación se resuelve consultando/reintentando con el mismo `operationId`; nunca ejecutando un segundo fallback independiente.
- Reintentar el mismo `operationId` debe devolver/confirmar la misma operación, no duplicar venta, cobro, stock ni movimiento.

### Regla de comunicación
- La interfaz no puede afirmar `sincronizado/guardado en la cuenta` antes de confirmación real del backend.
- Si queda pendiente, debe mostrarse como pendiente/no confirmado.
- Un borrador local en modo sincronizado no equivale a una operación compartida confirmada.

### Ejemplos
Válido: instalación local de un único equipo vende sin internet y guarda solo en ese equipo.
Válido: modo sincronizado sin red permite preparar un borrador de pedido sin confirmarlo.
Válido: una venta enviada cuyo resultado queda incierto por timeout se consulta/reintenta con el mismo `operationId`.
Inválido: dos TPV sincronizados venden offline simultáneamente la última unidad y ambos se dan por confirmados.
Inválido: tras un timeout se crea una segunda venta con otro identificador como fallback automático.

---

## DEC-04 · Dinero, devoluciones y documentos

### Venta / anulación
- Una venta confirmada nunca se borra físicamente del historial.
- Anulación = reverso vinculado a la operación original, idempotente y con restauración exacta de efectos.
- Una venta ya anulada no puede además devolverse como si siguiera activa.

### Devoluciones
- Devolución normal: debe vincularse a una venta y no puede superar cantidad/importe pendiente de devolver.
- Reembolso negativo: siempre inválido y rechazo total.
- Reembolso 0 €: permitido solo como flujo explícito `sin reembolso/cambio`, con motivo y trazabilidad; puede reponer stock si corresponde, pero no simula una devolución monetaria.
- Sin ticket/venta identificable: en la primera release no se permite un reembolso monetario automático. Propietario/Encargado podrá registrar, si se implementa, una entrada de mercancía/ajuste excepcional con motivo y auditoría; cualquier devolución de dinero sin venta vinculada requiere una decisión/fiscalidad específica posterior.

### Anticipos / encargos
- Anticipo permitido: importe > 0 y ≤ total del encargo.
- Cada anticipo/cobro queda ligado a empresa, local, encargo, medio de pago, fecha e identificador idempotente.
- `pendiente = total - cobros válidos acumulados`.
- No se acepta cobrar por encima del pendiente salvo flujo de devolución/cambio explícito.

### Caja y pagos
- Importes monetarios no pueden ser negativos salvo que el tipo de operación sea explícitamente una salida/reembolso y el modelo lo represente con signo/tipo controlado.
- Entrada y Retirada son tipos distintos y afectan al efectivo esperado exactamente una vez.
- Un pago repetido con el mismo identificador no duplica el efecto.

### Periodos cerrados
- Un periodo cerrado no se reescribe con operaciones ordinarias.
- Una corrección posterior se registra como reverso/ajuste trazable en el periodo permitido y enlazado al original.

### Redondeo
- Importes de presentación/documento: 2 decimales de euro.
- Cálculos internos pueden conservar mayor precisión.
- Repartos de IVA/descuentos/devoluciones parciales deben usar un algoritmo determinista y reconciliar exactamente con el total del documento.

### Ámbito documental/fiscal habilitado ahora
- El ticket del TPV sigue siendo `TICKET / RECIBO INTERNO`.
- No se denomina ni se trata como `FACTURA SIMPLIFICADA` hasta completar numeración correlativa segura, identidad fiscal, pruebas y revisión del paquete fiscal correspondiente.
- L&A Suite puede gestionar documentos y datos contables internos sin afirmar certificación fiscal que aún no haya sido validada.

### Ejemplos
Válido: encargo 20 €, anticipo 5 €, pendiente 15 €.
Inválido: anticipo 25 € sobre total 20 €.
Válido: devolución de 1 unidad de una venta activa de 2, con reembolso hasta el pendiente.
Inválido: reembolso −5 € o devolver 3 unidades de una venta pendiente de 2.

---

## DEC-05 · Alcance de release

- Se mantienen en cobertura todos los módulos solicitados de L&A Suite; no se elimina trabajo silenciosamente.
- No hay exclusiones aprobadas en este momento.
- Un módulo que no supere seguridad/integridad no se presenta como terminado ni se deja operativo por defecto para `cumplir fecha`.
- Cualquier piloto, exclusión o riesgo aceptado necesita decisión expresa del usuario, con impacto, alternativa y condición de salida.
- La fiscalidad avanzada y la emisión como Factura Simplificada permanecen deshabilitadas hasta cumplir su contrato específico; esto es una limitación explícita, no una certificación pendiente escondida.
- `GO` solo se considera cuando se superen las puertas del plan maestro; fusionar a `main` o publicar requiere autorización nueva y expresa.

---

## Reglas mínimas por rol

Todos los permisos se entienden dentro de empresas/locales expresamente autorizados.

- **Propietario**: administración completa, empresa/local, configuración, auditoría, datos financieros y laborales, altas de cuentas permitidas y operaciones sensibles.
- **Encargado**: operativa amplia; gestión diaria, movimientos/fichajes y funciones asignadas. No obtiene automáticamente privilegios exclusivos de Propietario ni acceso indiscriminado a datos sensibles que su función no requiera.
- **Cajero/a**: TPV/caja, arqueos, devoluciones y movimientos de caja dentro de su local; datos reducidos de clientes/proveedores cuando sean necesarios. Sin nóminas, auditoría global ni administración de empresa.
- **Churrero/a**: producción, pedidos/recepción, conteos, aceite/APPCC y operativa necesaria del local. Sin datos financieros completos, nóminas ni información personal innecesaria.
- **Camarero/a**: operativa de sala/TPV que le sea asignada y fichaje propio; sin nóminas, gastos, auditoría ni administración.
- **Básico**: solo las funciones comunes explícitamente habilitadas; sin acceso sensible ni mutaciones privilegiadas.
- **Inactivo**: sin acceso funcional aunque conserve un token previo; la sesión debe bloquearse/expulsarse.

## Relaciones siempre inválidas

- Empresa A + local de Empresa B.
- Documento de A pagado/modificado desde un usuario sin permiso en A/local del documento.
- Proveedor/cliente de A visible o editable desde B.
- Producto/movimiento de A1 operado como si perteneciera a A2 sin flujo de traslado explícito.
- Mutación desde `Todos los locales` sin destino local.
- Reintento con mismo `operationId` y contenido distinto.
- Operación crítica marcada como confirmada si solo existe localmente en un modo que exige confirmación remota.

## Criterio de cierre PM-03

PM-03 solo puede pasar a `CERRADO` cuando el usuario apruebe explícitamente DEC-01…05 o indique cambios concretos. DEC-01, DEC-02 y DEC-03 ya están aprobados. Tras aprobar DEC-04 y DEC-05 se actualizará este documento a `APROBADO`, se registrará el commit final y se preparará PM-04. No se modifica lógica funcional durante PM-03.