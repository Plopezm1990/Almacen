# Plan Maestro L&A Suite — Etapa 5, T6: vale regalo

Fecha: 24/10/2026
Entorno: QA `qjqorixtkilwsndqayyx`.
Autorización: Hoja QA-7 (Pedro, 24/10/2026, chat).

## 1. Lo pedido

«Vale regalo»: vender un vale por el importe que el cliente quiera y
poder canjearlo después, como forma de pago, en una compra futura.
Decisiones de Pedro antes de diseñar: importe libre (no importes fijos)
y sin caducidad.

## 2. Qué se construyó

### 2.1 Base de datos (migración nueva)

`supabase/migrations/20261024120000_t6_vale_regalo.sql`:

- Tabla `abc_vales_regalo` (cerrada: sin ningún privilegio directo para
  `public`/`anon`/`authenticated`/`service_role`, solo accesible a
  través de las funciones de abajo). Guarda código, importe inicial,
  saldo actual y estado (`ACTIVO`/`AGOTADO`/`ANULADO`).
- `abc_emitir_vale_regalo(...)`: vende un vale. Exige el mismo permiso
  que un cobro en efectivo (`ABC_COBRO_INICIAR` + `ABC_COBRO_EFECTIVO`).
  Genera un código único y registra el dinero en caja exactamente igual
  que cualquier cobro en efectivo (mismo patrón que la propina, Hoja
  QA-4).
- `abc_consultar_vale_regalo(...)`: consulta de solo lectura del saldo
  de un vale por su código.
- `abc_confirmar_pago_vale_regalo(...)`: resuelve el canje. Reutiliza
  `abc_iniciar_cobro` con `medio='OTRO'` (que el servidor ya admitía sin
  ningún cambio) y `abc_resolver_intento` (la misma pieza interna que ya
  usa el resolutor de tarjeta simulada de QA-3), en vez de inventar un
  cobro aparte. No entra dinero nuevo en caja al canjear: ya entró
  cuando se vendió el vale.

Todas con el mismo patrón de idempotencia
(`abc_operacion_iniciar`/`completar`/`fallar`) que el resto del
proyecto.

### 2.2 Pantalla (`fuente.js` y `source-recovery/fuente-recuperado.js`)

- Sección nueva **"Vale regalo"**, siempre visible (igual que "Factura a
  empresa"), con un campo de importe y el botón "Vender vale regalo".
  Tras vender, muestra el código generado para apuntarlo.
- Dentro de Cobro·F4, junto al resto de medios de pago: campo "Vale
  regalo (código)" y botón "Aplicar vale", que aplica como pago el
  mínimo entre el saldo del vale y lo que quede pendiente de la cuenta
  (nunca más que uno de los dos).

## 3. Cuatro fallos encontrados y corregidos en las pruebas en vivo (Cowork)

1. **`gen_random_bytes` sin esquema.** `abc_emitir_vale_regalo` es
   `security definer` con `search_path=''` (medida de seguridad estándar
   de este proyecto) y llamaba a `gen_random_bytes(4)` sin especificar
   esquema. En este entorno `pgcrypto` está instalado en el esquema
   `extensions`, no en `public` ni en `pg_catalog` (el único que sí se
   busca siempre). La llamada fallaba siempre con el error crudo de
   Postgres `function gen_random_bytes(integer) does not exist`, visible
   tal cual en pantalla — "Vender vale regalo" nunca creaba ningún vale.
   Corregido (migración
   `20261024130000_t6_vale_regalo_fix_gen_random_bytes.sql`) usando
   `extensions.gen_random_bytes(4)`, el mismo patrón que ya usa
   `pm11_crear_prefiltro_candidato` en este mismo proyecto.
2. **Saldo pendiente mal calculado antes del primer checkout.** El
   panel de Cobro ya sabe calcular el pendiente de una cuenta que nunca
   pasó por ningún cobro (`totalPedido - confirmado`, cuando el servidor
   todavía no tiene checkout). Mi función `pagarConValeRegaloF4` no
   replicaba ese cálculo: leía directamente `estado.saldo`, que en ese
   caso no está preparado, y rechazaba siempre con "No hay saldo
   pendiente que cobrar con un vale" aunque la pantalla mostrara un
   pendiente real. Corregido con el mismo patrón ya usado en la Hoja
   QA-6: como `pagarConValeRegaloF4` vive dentro de `crearLogicaVenta` y
   no puede leer `pedidoOperativoA05` (estado local de `VentaRapida`),
   ahora recibe `totalPedido` como parámetro desde
   `pagarConValeRegaloF4UI` y calcula el pendiente igual que la
   pantalla cuando todavía no hay checkout.
3. **Referencia única chocando al reaplicar el mismo vale.**
   `abc_confirmar_pago_vale_regalo` usaba el código del propio vale como
   `provider_reference` al resolver el intento de pago.
   `pago_intentos` tiene un índice único sobre `(empresa_id,
   provider_code, provider_reference)`, así que aplicar el MISMO vale
   una segunda vez (legítimo: un vale puede dejar saldo tras un pago
   parcial) chocaba siempre con el registro de la primera aplicación,
   reventando con el error crudo de Postgres `duplicate key value
   violates unique constraint "abc_intento_provider_reference_uq"`.
   Corregido (migración
   `20261024140000_t6_vale_regalo_fix_provider_reference.sql`) derivando
   la referencia del propio intento de pago
   (`'VALE-REGALO-' || intento_id`), igual que ya hace el resolutor de
   tarjeta simulada de QA-3.
4. **Efecto secundario del fallo anterior: cuenta bloqueada para
   cualquier cobro.** El intento de pago que falló por el choque de
   clave (hallazgo 3) se quedó en estado `PENDIENTE` sin resolver — la
   propia protección del sistema (`cobroIncierto`, ya existente y
   correcta) bloqueó entonces CUALQUIER nuevo intento de cobro sobre esa
   cuenta (efectivo, tarjeta, Bizum o vale), mostrando únicamente el
   formulario de "Abrir incidencia". No es un fallo nuevo del código:
   es la protección de siempre reaccionando correctamente a un intento
   huérfano. Con autorización expresa de Pedro, se resolvió ese intento
   concreto como `RECHAZADO` con la propia función genérica
   `abc_resolver_intento` (sin tocar el saldo del vale: `aplicado=0`,
   `liberado=5.15`), dejando la cuenta libre para intentar de nuevo.

## 4. Verificación

- `node --check` en ambos archivos tras cada corrección: OK.
- Prueba de contrato
  (`tests/plan-maestro/etapa5-t6-vale-regalo-contract.mjs`): comprueba
  la sección "Vale regalo" siempre visible (no dentro de Cobro·F4), los
  4 puntos de conexión de las 3 funciones nuevas, la paridad carácter a
  carácter entre `fuente.js` y el espejo, los permisos y el patrón de
  idempotencia de la migración, y las tres correcciones (esquema de
  `gen_random_bytes`, cálculo del saldo sin checkout, y la referencia
  derivada del intento). Todo en verde.
- Todos los contratos existentes de `tests/plan-maestro/`: sin cambios
  de resultado.
- Manifiesto de CI actualizado (313→314 archivos, 296→297 contratos
  activos, Node 266→267).
- Verificado en QA, con datos reales: vale `VALE-E39567` emitido por
  €20,00 (evento `VALE_REGALO_EMITIDO`, entrada de caja de €20,00 en
  efectivo); primer canje parcial de €14,85 dejando €5,15 de saldo
  (evento `VALE_REGALO_CANJEADO`); segundo canje del resto, €5,15,
  dejando el vale en saldo €0,00 y estado `AGOTADO` (segundo evento
  `VALE_REGALO_CANJEADO`). Las dos cuentas usadas en la prueba quedaron
  con su estado correcto (`PAGADO` y `PARCIALMENTE_PAGADO` con el resto
  disponible para completar con otro medio).

## 5. Límites respetados

- No se ha tocado PROD.
- El tratamiento fiscal/contable de vender y canjear vales queda
  `PENDIENTE_ASESORIA`, igual que la propina: esto solo lleva la cuenta
  interna del dinero y del saldo.
- No se puede anular un vale ya emitido en esta primera versión (fuera
  de alcance de la Hoja QA-7).
- Solo efectivo al vender, en esta primera versión.
- La corrección puntual del intento atascado (hallazgo 4) se hizo con
  autorización expresa de Pedro, sin tocar el saldo del vale ni ningún
  otro dato real.

## 6. Pendiente

- Anular un vale ya emitido (por ejemplo, por error al venderlo).
- Pago parcial con vale regalo en el mismo acto de venta (hoy se vende
  y se canjea siempre como dos operaciones separadas).
- Revisar si conviene impedir, desde la propia pantalla, reintentar un
  cobro inmediatamente después de un fallo de red/servidor sin primero
  comprobar el estado — para reducir la posibilidad de que vuelva a
  quedar un intento sin resolver por cualquier otro motivo futuro.

**T6, punto 5 (vale regalo): cerrado.**
