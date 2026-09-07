# PM11 · Compra, recepción y pago E2E · P01 — Checkpoint e inventario

Fecha: 2026-09-07  
Rama: `pm11-compra-recepcion-pago-e2e`  
Checkpoint de partida: `1e21458b48a11302c59911ef966ded0aca3eb639`  
Tree de partida: `6867b87e1485f0bf49da97422a90f33f4049508e`  
`main` congelado: `7f792925d6a3d27334ee0e7335ba635b4ed79b6b`  
Producción: **NO TOCAR**

## 1. Objetivo de P01

Congelar el punto de partida y mapear el circuito completo que PM11 debe demostrar de extremo a extremo:

**Pedido de compra → recepción parcial/total → albarán → factura → pago/reverso → conciliación final.**

P01 es de inventario y contrato. No modifica `fuente.js`, no aplica migraciones y no escribe en Supabase.

## 2. Nota de numeración

Existe documentación de cierre G1 que dejó escrito `SIGUIENTE=PM11_PERSONAL_EMPLEADOS`. Ese rótulo convivió con una planificación anterior donde el siguiente paquete funcional de la secuencia es Compra/Recepción/Pago E2E. La decisión operativa actual es conservar el trabajo de Personal ya realizado como trabajo adelantado para su paquete correspondiente y ejecutar ahora esta rama específica de Compra/Recepción/Pago, sin repetir ni borrar lo anterior.

Esta nota evita volver a mezclar ambos alcances.

## 3. Base segura heredada

### 3.1 Pedidos — PM10 P05 / LA-012

Ya existe y se conserva:

- proveedor obligatorio y resoluble;
- al menos una línea válida;
- producto resoluble y del local activo;
- cantidad finita y `> 0`;
- coste unitario finito y `>= 0`;
- fecha esperada válida si se informa;
- validación todo-o-nada antes de mutar;
- edición que conserva `cantidadRecibida`;
- imposibilidad de reducir lo pedido por debajo de lo ya recibido;
- imposibilidad de borrar en edición ordinaria una línea que ya tiene recepción;
- una línea nueva empieza con recepción `0`;
- `Todos los locales` no es contexto de escritura.

Referencia heredada: `tests/pm10/P05_PEDIDOS_EVIDENCIA.json`.

### 3.2 Recepción — PM10 P06 / LA-013

Ya existe y se conserva:

- pendiente = pedido - recibido acumulado;
- recepción parcial acumulativa;
- recepción exacta del resto;
- rechazo de sobre-recepción antes de tocar stock;
- lote todo-o-nada;
- actualización exacta de `cantidadRecibida`;
- contexto de local obligatorio;
- recepción directa desde pedido;
- recepción mediante albarán enlazado a `pedidoId`;
- conversión de cajas a unidades mediante `udsPorCaja` en la ruta de albarán;
- productos repetidos tratados sin doble conteo accidental;
- el estado del pedido progresa `Pendiente → Parcial → Recibido` según cantidades realmente recibidas.

La implementación enlazada valida primero y solo después llama a `procesarRecepcion`; si hay `pedidoId`, `confirmarAlbaran` actualiza el pedido con las unidades efectivamente resueltas.

Referencia heredada: `tests/pm10/P06_RECEPCION_EVIDENCIA.json` y parche reproducible `source-recovery/post-pm08-patches/11-91860ef67e94fbfe60e498408f61cd2f5d33381d.patch`.

### 3.3 Identidad de factura y pagos — PM06

Ya existe y se conserva:

- factura/albarán con identidad `empresaId` + `localId`;
- proveedor compatible con empresa y `proveedorSnapshot` para conservar identidad histórica;
- cálculo común de base, IVA, cargos y total;
- libro de hechos `pagosFacturas` en vez de usar un booleano `pagada` como autoridad;
- pagos parciales;
- rechazo de importe `<= 0` y de sobrepago;
- saldo = total - pagos confirmados + reversos;
- reverso trazable del último pago no revertido;
- fallo cerrado cuando una operación sincronizada no puede confirmarse en nube;
- factura directa con anulación lógica, no borrado físico, y bloqueo de cambio de total si ya tiene pagos.

Referencia heredada: implementación PM06 y workflow `.github/workflows/pm06-aplicar-identidad-financiera.yml`.

### 3.4 Endurecimiento financiero — G1 / LA-004

G1 revalidó en QA la identidad financiera y corrigió dos defectos reales de replay. Queda heredado:

- `operationId` global entre pagos, Caja, stock y arqueos;
- replay exacto idempotente;
- mismo `operationId` con contenido distinto → conflicto;
- colisión del mismo ID entre ledgers → conflicto;
- bloqueo de fila de factura al pagar;
- total autoritativo del backend;
- pago parcial y saldo pendiente;
- sobrepago rechazado;
- reverso único, trazable e idempotente;
- permisos y empresa/local comprobados en servidor.

Referencia: `tests/g1/P08_LA004_GATE_EVIDENCIA.md` y `supabase/migrations/20260905185935_g1_p08_operation_id_finanzas_global.sql`.

## 4. Mapa del circuito actual

| Tramo | Estado heredado | Qué debe demostrar PM11 E2E |
|---|---|---|
| Pedido → recepción | Base fuerte | Identidad estable del mismo pedido y no duplicación ante repetición/reintento |
| Recepción parcial → siguiente recepción | Base fuerte | Varias recepciones acumulan exactamente y nunca exceden el pendiente |
| Pedido → albarán enlazado | Base fuerte | `pedidoId`, proveedor, local y cantidades permanecen coherentes |
| Albarán → factura | Existe tratamiento de albarán confirmado como factura cuando `esFactura !== false` | Congelar contrato explícito de cuándo nace la obligación de pago, número/fecha de factura y evitar duplicidades o ambigüedad documental |
| Factura → pago parcial/total | Base fuerte | El pago corresponde a la factura exacta nacida del circuito y conserva empresa/local/proveedor/total |
| Pago → reverso | Base fuerte | Reverso no duplica, no cambia identidad y reabre exactamente el saldo correspondiente |
| Cierre económico | Parcialmente cubierto por PM09/G1 | Pedido, recibido, factura, pagado y pendiente deben reconciliar en un único caso E2E |

## 5. Huecos que PM11 debe cerrar o demostrar

P01 no declara defectos sin prueba. Congela los siguientes puntos como **obligatorios de validar en los puntos siguientes**:

1. **Identidad del circuito completo.** Un mismo flujo debe conservar empresa, local y proveedor desde pedido hasta factura/pago.
2. **Trazabilidad pedido ↔ albarán.** Debe comprobarse una y varias recepciones parciales con documentos enlazados sin duplicar unidades.
3. **Semántica albarán ↔ factura.** Hay que definir y probar de forma explícita `esFactura`, `numeroFactura` y `fechaFactura`, incluida la diferencia entre simple albarán y documento que genera obligación de pago.
4. **No duplicación documental.** Repetir confirmación, recargar o reintentar no debe volver a sumar stock, recepción ni crear una segunda obligación económica por el mismo hecho.
5. **Pago del documento exacto.** El ledger financiero debe referenciar el albarán/factura exacto del flujo y respetar su total autoritativo.
6. **Conciliación numérica.** `pedido = recibido acumulado` al completar; `factura total = pagado + pendiente`; un reverso debe incrementar el pendiente exactamente por el importe revertido.
7. **Aislamiento.** A1/A2/otra empresa/`Todos los locales` no pueden cruzarse en ningún salto del circuito.
8. **Fallos intermedios.** Si falla nube/validación en un paso crítico, no se debe mostrar como confirmado ni avanzar falsamente el siguiente estado.
9. **Persistencia genérica.** Parte de pedidos/albaranes continúa apoyándose en `almacen_kv`; PM11 no afirmará transacción ACID multientidad donde no exista. Se endurecerá la frontera necesaria o se documentará explícitamente la garantía real.
10. **Regresión.** No se puede romper PM05/PM06/PM07/PM08/PM09/PM10/G1 al cerrar el E2E.

## 6. Secuencia de trabajo congelada tras P01

- **P02 — Contrato E2E y estados:** definir identidad y transiciones válidas del circuito.
- **P03 — Pedido y recepciones múltiples:** validar parciales, reintentos y cierre exacto.
- **P04 — Albarán y trazabilidad documental:** asegurar enlace estable con pedido/recepciones.
- **P05 — Conversión/identidad de factura:** cerrar número, fecha, `esFactura`, total y unicidad.
- **P06 — Pago parcial/total/reverso E2E:** conectar el documento exacto al ledger autoritativo.
- **P07 — Aislamiento y permisos:** A1/A2/B1/Todos/inactivo.
- **P08 — Fallos, replay y concurrencia:** doble clic, recarga, reintento y fallo de nube.
- **P09 — Conciliación E2E:** cantidades, IVA, total, pagado y pendiente.
- **P10 — Regresión integral + Deploy Preview + smoke real + cierre formal.**

La numeración posterior solo podrá ampliarse si aparece un defecto real que necesite un punto específico; no se cerrará por calendario.

## 7. Criterio de salida de P01

P01 queda cerrado cuando:

- la rama de trabajo parte del checkpoint G1 exacto;
- el alcance E2E está separado del trabajo de Personal;
- las garantías heredadas están identificadas para no reimplementarlas;
- los huecos entre dominios están congelados como contratos de prueba;
- `main` y producción permanecen intactos.

**PM11_COMPRA_P01_CHECKPOINT_INVENTARIO=PASS**
