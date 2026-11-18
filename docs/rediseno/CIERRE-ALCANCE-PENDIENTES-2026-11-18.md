# L&A Suite · Cierre de alcance de pantallas pendientes

Fecha: 18/11/2026  
Rama: `rediseno/f0-base-qa` · PR #225 en borrador  
Entorno permitido: Deploy Preview / Supabase QA. Producción no se toca.

## Resultado ejecutivo

La matriz contiene **21 filas con `Estado de apertura QA = No construida`**. La cifra histórica de 23 mezcla estas filas con otros estados (bloqueadas por acceso, bloqueadas por infraestructura o no ejercitadas a propósito). No se debe convertir esa cifra en 23 pantallas nuevas sin revisar la matriz actual.

La revisión se hizo contra:

- la fuente y el bundle de la rama;
- las 211 migraciones de `supabase/migrations`;
- los contratos y evidencias de QA ya documentados;
- la restricción de no tocar producción, no vaciar QA y no usar `sis-13`.

**Decisión de esta tanda:** no se implementa todavía ninguna de las 21 pantallas. Se deja un registro de alcance con una propuesta priorizada y condiciones de cierre. La construcción comienza solo después de aprobar el grupo de producto correspondiente, porque varias filas necesitan contrato funcional y migración/RPC nuevos.

## Inventario y propuesta

| ID | Pantalla | Qué existe hoy | Propuesta de alcance | Condición para construir o cerrar |
|---|---|---|---|---|
| `tpv-24` | Funciones rápidas del TPV | No hay superficie ni contrato identificable | **Futura, P2** | Definir catálogo de acciones, cargos autorizados, atajos de teclado/táctiles y contrato de operación; fixture reversible de QA y desktop/móvil. |
| `tpv-28` | Bizum y estado de pago | No hay Bizum en las migraciones ni en el producto; Transferencia no equivale a Bizum | **Futura, P1 si el negocio lo exige** | Elegir proveedor/estado de pago, webhook/idempotencia, conciliación y permisos antes de UI; nunca simular Bizum como Transferencia. |
| `tpv-29` | Propina y vale regalo | El servidor contempla `PROPINA` como recibo no ordinario (`20260930100000`, `20260930120000`); no hay vale regalo | **Dividir: propina P1; vale regalo futura** | Contrato fiscal y UX para propina; para vale regalo, saldo, emisión, canje, devolución y auditoría. |
| `tpv-31` | Solicitar factura a empresa | Existen tipos `FACTURA_COMPLETA` y validación de receptor (`20261001160000`) | **Candidata P1** | UI de datos fiscales, selección de cliente, validación server-side, emisión QA y comprobación de ticket/documento. |
| `tpv-32` | Enviar justificante por correo | `abc_f5_c10_document_delivery` es candidato aislado y declara “no aplicado en QA/PROD”; no hay envío de correo de tickets | **Futura, bloqueada por backend** | Aplicar contrato/migración autorizados, proveedor de correo y estados de entrega; probar fallo, reintento y no duplicación. |
| `tpv-33` | Pantalla para cliente | No hay salida secundaria ni contrato | **Futura, P2** | Definir dispositivo/canal, datos permitidos, actualización en tiempo real y cierre de sesión; prueba de privacidad. |
| `enc-05` | Revertir anticipo | La operación existe como efecto de cancelar/devolver (`enc-07`/`enc-08`); depende de diálogo nativo | **Reencuadrar, no crear pantalla** | Sustituir el diálogo nativo por confirmación propia o bloquear la operación si no hay confirmación. Mantener la evidencia bajo Encargos; retirar `enc-05` como superficie independiente. |
| `caj-16` | Rectificación fiscal | Existen `FACTURA_RECTIFICATIVA` y `abc_registrar_correccion_documental` (`20261001160000`, `20261001180000`) | **Candidata P1** | Definir motivos, documento original, permisos, cola fiscal QA y prueba de trazabilidad sin alterar el documento original. |
| `caj-20` | Factura electrónica entre empresas | No se encontró una superficie ni un contrato de factura electrónica interoperable | **Futura, P2 fiscal** | Elegir formato/proveedor, validación, firma/entrega, estados y requisitos legales antes de construir. No confundir con `FACTURA_COMPLETA`. |
| `inv-32` | Detalle e impresión de receta | La ficha de coste se edita en `inv-31`; no hay detalle/impresión/PDF | **Decisión de producto** | Construir solo si la receta imprimible es requisito; si no, retirar de la matriz y conservar `inv-31` como ficha de coste. |
| `inv-35` | Biblioteca de opciones | El servidor sí tiene grupos/opciones/variantes (`20260924020000`, `20261002150000`); no hay administración UI | **Candidata P2** | Diseñar CRUD de grupos/opciones, versiones, límites y permisos; fixture con variante/modificador y prueba de snapshot en pedido. |
| `inv-36` | Editor de opciones reutilizables | Mismo desfase servidor/interfaz que `inv-35` | **Parte de `inv-35`, no pantalla independiente obligatoria** | Cerrar junto con la biblioteca o retirar la fila separada; probar conflicto de versión y opción inactiva. |
| `org-23` | Prueba de impresora y cajón | `abc_config_pieza4_equipos` solo registra aparatos y declara que no los conecta ni configura | **Futura, hardware** | Elegir puente local, permisos, protocolo y entorno de prueba; no declarar funcional una pantalla que solo registra equipos. |
| `org-25` | Vincular terminal, caja y equipo | Hay asociación opcional equipo→terminal en `org-22`; no existe vínculo terminal↔caja como vista propia | **Reencuadrar bajo `org-22`/terminales** | Si el vínculo se considera necesario, ampliar la pantalla existente y su contrato; retirar `org-25` independiente para evitar duplicidad. |
| `org-33` | Zonas, mesas y tarifas horarias | El servidor tiene zonas/mesas (`20260924050000`); no hay editor de sala ni tarifas | **Candidata P2** | CRUD de zonas/mesas, concurrencia, estados y tarifas; probar impacto en Pase/TPV sin romper cuentas abiertas. |
| `org-34` | Plantilla por tipo de negocio | Sin rastro en fuente ni migraciones | **Futura / decidir si se retira** | Solo construir con un catálogo de plantillas y efectos explícitos sobre configuración; no inventar presets. |
| `org-35` | Teclas del TPV por cargo | Sin superficie de producto; “teclas” solo aparece en mensajes internos | **Futura / baja prioridad** | Definir personalización, precedencia por cargo/empresa y restauración; de lo contrario retirar. |
| `org-36` | Integraciones y puente de impresión | Sin rastro de puente o integraciones ejecutables | **Futura, bloqueada por arquitectura** | Contrato de integración, secretos, health-check y pruebas de desconexión antes de UI. |
| `sis-14` | Índice de revisión | Andamio de la maqueta; no es pantalla del producto | **Retirar de la matriz de producto** | Conservar solo en documentación de demos/QA; no construir en la suite. |
| `sis-15` | Comparar y reiniciar demostración | Andamio de la maqueta; no existe equivalente runtime | **Retirar de la matriz de producto** | Mantener cualquier herramienta de reset fuera de la aplicación; nunca usarla durante QA funcional. |
| `sis-16` | Pantalla restringida por cargo | El producto oculta módulos y falla cerrado; no necesita una pantalla adicional | **Retirar como pantalla; mantener comportamiento** | Cerrar con pruebas de navegación y de RPC denegada. Solo crear una pantalla si producto decide que el mensaje visible es requisito. |

## Soporte de servidor encontrado

La búsqueda de migraciones cambia la clasificación de varias filas, pero no las convierte automáticamente en pantallas construidas:

- **Disponible parcialmente:** propinas y anticipos (`20260930100000`, `20260930120000`), documentos completos/rectificativos (`20261001160000`, `20261001180000`), variantes y modificadores (`20260924020000`, `20261002150000`) y zonas/mesas (`20260924050000`).
- **Candidato no aplicado:** entrega documental por EMAIL (`20261001200000`) declara expresamente que está aislada y no aplicada en QA/producción; no se puede cerrar `tpv-32` con esa migración.
- **Registro sin conexión:** equipos (`20261002230000`) guarda impresoras/cajón/datáfono como inventario; la propia migración limita el alcance y no abre un puente de hardware.
- **Sin contrato encontrado:** Bizum, vales regalo, pantalla para cliente, plantillas de negocio, teclas por cargo, integraciones de impresión y factura electrónica interoperable.

## Fuera de las 21 filas

No se mezclan con “no construida”:

- `acc-08`: bloqueada porque QA no está vacío; no se autoriza vaciarlo.
- `org-08`–`org-17`: bloqueadas por falta de administrador de plataforma autorizado.
- `per-21`, `per-24`, `per-25`: bloqueadas por funciones/permisos externos del entorno QA.
- `sis-13`: no ejercitada a propósito; no se toca mientras QA sea la base de evidencia.

Estas filas conservan su estado independiente en la matriz.

## Orden recomendado después de aprobar el alcance

1. **P1 fiscal/TPV:** `tpv-31`, `caj-16` y la parte de propina de `tpv-29`, con contrato server-side y fixtures reversibles.
2. **P2 operación de sala/catálogo:** `org-33`, `inv-35` + `inv-36`, `tpv-24` y `tpv-33`.
3. **Integraciones y pagos externos:** `tpv-28`, `tpv-32`, `caj-20`, `org-23`, `org-36` solo cuando exista backend/proveedor aprobado.
4. **Limpieza de matriz:** retirar `sis-14`, `sis-15`, `sis-16`; reencuadrar `enc-05` y `org-25`; decidir `inv-32`, `org-34`, `org-35`.

## Criterio de cierre de cualquier nueva pantalla

Una fila solo pasa a “Pasa” cuando tiene contrato de datos y permisos, operación ejercitada en QA con datos reversibles, persistencia comprobada tras recarga/segunda sesión cuando aplique, escritorio y móvil sin desbordamiento, evidencia fechada en el acta y batería de contratos/regresión en verde. Abrir una ruta o encontrar una RPC no basta.

## Próximo paso solicitado al propietario

Aprobar o modificar los cuatro grupos del orden recomendado. Hasta esa decisión, la rama queda en modo documentación: no se añaden pantallas especulativas, no se aplican migraciones candidatas y no se modifica ningún dato de QA.
