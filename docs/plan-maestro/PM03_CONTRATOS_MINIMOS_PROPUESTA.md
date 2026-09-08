# PM-03 · Contratos mínimos · APROBADO

Fecha: 2026-09-04
Rama: `pm03-contratos-minimos`
Base: cierre PM-02 (`f6cd04d7b4616ccbaa1901e7ea0c6b97c0b2b72d`)
Estado: **PM-03 CERRADO · DEC-01…DEC-05 APROBADOS POR EL USUARIO**
Producción/main: **sin cambios**

## Objetivo

Cerrar DEC-01…DEC-05 antes de modificar la lógica funcional. Estos contratos quedan congelados como criterio funcional y de seguridad para los siguientes paquetes del Plan Maestro. Ningún contrato de este documento autoriza por sí mismo una publicación ni una modificación de producción.

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
- Unidades indivisibles: cantidades enteras positivas.
- Unidades fraccionables: decimales positivos con precisión definida por producto/unidad.
- No se redondea una cantidad inválida a cero para aceptarla.
- No se admite fraccionar una unidad indivisible salvo configuración expresa del producto.

### Reservas
- No existe reserva implícita por abrir carrito, pedido, encargo o formulario.
- Una reserva solo descuenta disponibilidad si existe un estado explícito, persistente, identificable e idempotente.
- Cuando existan reservas seguras: `disponible = stock físico - reservado`.

### Movimientos internos y traspasos
- Dentro del local: mover almacén ↔ piso tiene efecto neto total 0.
- Entre locales de la misma empresa: operación atómica; resta origen y suma destino como una única operación lógica.
- Si falla cualquiera de las dos partes, no se confirma ninguna.
- Producto, empresa, local destino, permisos y unidades deben ser compatibles.
- No existe excepción automática para permitir stock negativo.

---

## DEC-03 · Operación sin conexión — APROBADO

### A. Solo este equipo / local puro
- Un único dispositivo es la autoridad de trabajo.
- Puede funcionar sin internet.
- No promete sincronización con otros dispositivos ni concurrencia remota.
- La interfaz diferencia `Guardado en este equipo` de `Sincronizado en la nube`.

### B. Modo sincronizado / multi-dispositivo
- El backend es la autoridad para operaciones compartidas y operaciones que pueden colisionar entre dispositivos.
- Sin conexión confirmable se pueden consultar datos locales y preparar borradores, pero no se confirman mutaciones críticas.
- Se bloquean en modo sincronizado las mutaciones críticas que puedan producir sobreventa o duplicidad: venta/stock, recepción, pago, devolución/reembolso, traspaso y cierre/arqueo con efectos compartidos.
- Toda operación crítica utiliza un `operationId` estable e idempotente.
- Un timeout se resuelve consultando/reintentando con el mismo `operationId`; nunca creando un fallback independiente.
- Reintentar el mismo `operationId` no duplica venta, cobro, stock ni movimiento.

### Regla de comunicación
- La interfaz no puede afirmar `sincronizado/guardado en la cuenta` antes de confirmación real del backend.
- Si queda pendiente, debe mostrarse como pendiente/no confirmado.

---

## DEC-04 · Dinero, devoluciones y documentos — APROBADO

### Venta / anulación
- Una venta confirmada nunca se borra físicamente del historial.
- Anulación = reverso vinculado a la operación original, idempotente y con restauración exacta de efectos.
- Una venta ya anulada no puede además devolverse como si siguiera activa.

### Devoluciones
- Deben vincularse a una venta y no pueden superar cantidad/importe pendiente.
- Reembolso negativo: inválido y rechazo total.
- Reembolso 0 €: solo como flujo explícito `sin reembolso/cambio`, con motivo y trazabilidad.
- Sin ticket/venta identificable: no se permite reembolso monetario automático en la primera release.

### Anticipos / encargos
- Importe > 0 y ≤ total pendiente del encargo.
- Cada cobro conserva empresa, local, encargo, medio de pago, fecha e identificador idempotente.
- `pendiente = total - cobros válidos acumulados`.
- No se cobra por encima del pendiente salvo flujo explícito de devolución/cambio.

### Caja y pagos
- Entrada y Retirada son tipos distintos y afectan al efectivo esperado exactamente una vez.
- Un pago repetido con el mismo identificador no duplica efecto.
- Los importes negativos solo son válidos cuando el tipo de operación lo representa expresamente como salida/reembolso controlado.

### Periodos cerrados
- Un periodo cerrado no se reescribe con operaciones ordinarias.
- Correcciones posteriores se registran como reverso/ajuste trazable y enlazado al original.

### Redondeo
- Presentación/documento: 2 decimales de euro.
- Cálculos internos pueden conservar mayor precisión.
- IVA, descuentos y devoluciones parciales deben reconciliar exactamente con el total del documento.

### Ámbito documental/fiscal habilitado ahora
- El ticket del TPV sigue siendo `TICKET / RECIBO INTERNO`.
- No se denomina ni se trata como `FACTURA SIMPLIFICADA` hasta completar numeración correlativa segura, identidad fiscal, pruebas y revisión fiscal específica.
- L&A Suite puede gestionar documentos internos sin afirmar certificación fiscal no validada.

---

## DEC-05 · Alcance de release — APROBADO

- Se mantienen en cobertura todos los módulos previstos de L&A Suite; no se elimina trabajo silenciosamente.
- Un módulo que no supere seguridad, aislamiento o integridad no se presenta como terminado ni se deja operativo por defecto para cumplir una fecha.
- Cada módulo podrá clasificarse internamente como `APROBADO`, `EN CORRECCIÓN`, `BLOQUEADO` o `PENDIENTE`.
- Un módulo con fallo crítico permanece en corrección o bloqueado hasta superar las pruebas correspondientes.
- Cualquier piloto, exclusión o riesgo aceptado necesita decisión expresa del usuario, con impacto, alternativa y condición de salida.
- La fiscalidad avanzada y la emisión como `FACTURA SIMPLIFICADA` permanecen deshabilitadas hasta cumplir su contrato específico.
- `GO` solo se considera cuando se superen las puertas del Plan Maestro.
- Fusionar a `main` o publicar requiere autorización nueva y expresa del usuario.

### Alcance funcional que permanece dentro del proyecto
- TPV y ventas.
- Historial de ventas.
- Caja y arqueos.
- Inventario y stock.
- Pedidos, compras y recepción.
- Traspasos.
- Proveedores y clientes.
- Encargos.
- Personal, fichajes y turnos.
- Nóminas.
- APPCC y controles operativos.
- Gastos.
- Informes.
- Auditoría.
- Multiempresa y multilocal.
- Roles y permisos.
- Importaciones con IA.
- Notificaciones.
- Fiscalidad prevista.

---

## Reglas mínimas por rol

Todos los permisos se entienden dentro de empresas/locales expresamente autorizados.

- **Propietario**: administración completa, empresa/local, configuración, auditoría, datos financieros y laborales, altas de cuentas permitidas y operaciones sensibles.
- **Encargado**: operativa amplia y gestión diaria; no obtiene automáticamente privilegios exclusivos de Propietario ni acceso indiscriminado a datos sensibles.
- **Cajero/a**: TPV/caja, arqueos, devoluciones y movimientos de caja dentro de su local; sin nóminas, auditoría global ni administración de empresa.
- **Churrero/a**: producción, pedidos/recepción, conteos, aceite/APPCC y operativa necesaria del local; sin datos financieros completos ni nóminas.
- **Camarero/a**: operativa de sala/TPV asignada y fichaje propio; sin nóminas, gastos, auditoría ni administración.
- **Básico**: solo funciones comunes explícitamente habilitadas; sin acceso sensible ni mutaciones privilegiadas.
- **Inactivo**: sin acceso funcional aunque conserve un token previo; la sesión debe bloquearse/expulsarse.

## Relaciones siempre inválidas

- Empresa A + local de Empresa B.
- Documento de A pagado/modificado desde un usuario sin permiso en A/local del documento.
- Proveedor/cliente de A visible o editable desde B.
- Producto/movimiento de A1 operado como si perteneciera a A2 sin flujo de traslado explícito.
- Mutación desde `Todos los locales` sin destino local.
- Reintento con mismo `operationId` y contenido distinto.
- Operación crítica marcada como confirmada si solo existe localmente en un modo que exige confirmación remota.

## Cierre PM-03

DEC-01, DEC-02, DEC-03, DEC-04 y DEC-05 han sido aprobados expresamente por el usuario el 2026-09-04. PM-03 queda **CERRADO**. No se ha modificado lógica funcional, `main` ni producción durante este paquete.

El siguiente paquete del Plan Maestro es PM-04, pero no se inicia automáticamente desde este cierre.
