# F7 · C12 — ensayo explicable del cierre

Fecha: 2026-10-09  
Entorno de base de datos: QA (`qjqorixtkilwsndqayyx`)  
Estado: `NUCLEO_C12_VERIFICADO_QA; UI_LOCAL_VERIFICADA; RESILIENCIA_Y_ACEPTACION_PENDIENTES`

Producción: no tocada

## 1. Defecto encontrado y corregido

C12 elegía la conciliación C11 más reciente con `created_at DESC, id DESC`.
Dos fotos creadas dentro de una misma transacción comparten `created_at`, y el
UUID aleatorio no representa el orden de creación. El ensayo podía conservar
un estado `PENDIENTE_ENTREGA` aunque después ya existiera `CONCILIADO`.

La migración QA `20261009111255 · abc_f7_c12_reconciliation_revision`:

- añade `revision bigint generated always as identity` a C11;
- crea una unicidad global y un índice por empresa, local, documento y revisión;
- deja la secuencia accesible solo al propietario de la base;
- cambia C12 para ordenar cada documento por `revision DESC`.

La huella posterior confirmó la columna identity, los dos índices y la nueva
definición de la función.

La migración QA `20261009112332 · abc_f7_c12_session_scope` añadió un
`session_id` opcional a los documentos C05, con clave foránea e índice. La
reserva valida `metadata.session_id`, el vínculo queda inmutable y C12 filtra
las fotos C11 por la sesión ensayada.

## 2. Ensayo transaccional

Se creó un local aislado, una sesión, un documento emitido y conservado, y dos
fotos C11 dentro de la misma transacción.

| Caso | Resultado |
|---|---|
| Sin conteo ni entrega | `PENDIENTE` |
| Bloqueos iniciales | `CONTEO_FALTANTE`, `CONCILIACIONES_DOCUMENTALES_PENDIENTES` |
| Cadena C11 por revisión | `PENDIENTE_ENTREGA` → `CONCILIADO` |
| Con entrega y conteo | `APTO_CIERRE`, sin bloqueos |
| Efectivo | esperado 0, contado 0, diferencia 0 |
| Documentos finales | 1 conciliado, 0 pendientes |
| Efectos del ensayo | La sesión, el cierre y el conteo quedaron idénticos |
| Replay | Mismo ensayo y misma huella |
| Modificar o borrar informe | Rechazado por inmutabilidad |
| Camarero/a | Rechazado con `ensayo_cierre_no_autorizado` |

El ensayo terminó mediante un subbloque transaccional deliberadamente
revertido. La consulta posterior confirmó cero locales, terminales, cajas,
sesiones, series, operaciones e informes residuales.

## 3. Aislamiento entre sesiones

Una segunda prueba creó dos cajas y dos sesiones activas en el mismo local:

| Sesión | Documento | Resultado C12 |
|---|---|---|
| 1 | Entregado y `CONCILIADO` | `APTO_CIERRE`, 1 conciliado y 0 pendientes |
| 2 | `PENDIENTE_ENTREGA` | `PENDIENTE`, 0 conciliados y 1 pendiente |

La sesión 2 no bloqueó la sesión 1. También pasaron el rechazo de una sesión
inexistente, la inmutabilidad de `session_id` y una reserva administrativa sin
sesión para mantener compatibilidad. La prueba terminó con cero residuos.

## 4. Seguridad y revisión posterior

La secuencia de revisión solo concede privilegios a `postgres`. La tabla C11
continúa sin acceso directo del cliente y C12 sigue validando autenticación y
la capacidad `ABC_CAJA_OPERAR`. Se ejecutaron los asesores de seguridad y
rendimiento después del DDL. Las entradas de C11/C12 sobre RLS sin políticas y
la RPC `SECURITY DEFINER` corresponden al patrón de tablas cerradas y
autorización interna que ya usa este bloque; los demás avisos quedan fuera del
alcance de C12.

## 5. Integración local de pantalla

La pantalla de cierre provisional ya ofrece `Ensayar cierre C12`. La llamada
usa `abc_ensayar_cierre_sesion_caja` con empresa, local, sesión, terminal, día
operativo del servidor y un `operation_id` recuperable. El resultado muestra
el estado, la explicación, el efectivo esperado/contado, la diferencia, los
documentos conciliados/pendientes y los bloqueos legibles. El ensayo es
informativo y no finaliza ni modifica la sesión.

El contrato estático confirmó la paridad entre `fuente.js` y la fuente
recuperada, además del nombre y los parámetros exactos de la RPC. El contrato
de ejecución pasó 98 casos sobre la fuente recuperada, incluidos:

- `APTO_CIERRE` sin cambiar `CIERRE_PROVISIONAL`;
- `PENDIENTE` por documento de la sesión sin conciliar;
- conservación del cierre definitivo disponible cuando el servidor informa
  que el ensayo es apto.

Esta integración está verificada localmente; todavía no se desplegó ni se
recorrió visualmente en QA.

## 6. Límites confirmados

- La prueba cubre la recuperación idempotente mediante replay, pero no una
  caída real de red o proceso.
- No se probaron hardware de impresión, emisión fiscal real ni una sesión
  nocturna operada desde la pantalla.
- Falta desplegar la interfaz consolidada y recorrerla visualmente en QA.

Por estos límites, C12 permanece `INCOMPLETO`; su núcleo de servidor queda
verificado en QA y la interfaz queda verificada localmente.
