# F7 · C12 — ensayo explicable del cierre

Fecha: 2026-10-09  
Entorno de base de datos: QA (`qjqorixtkilwsndqayyx`)  
Estado: `NUCLEO_C12_VERIFICADO_QA; UI_Y_RESILIENCIA_PENDIENTES`  
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

## 3. Seguridad y revisión posterior

La secuencia de revisión solo concede privilegios a `postgres`. La tabla C11
continúa sin acceso directo del cliente y C12 sigue validando autenticación y
la capacidad `ABC_CAJA_OPERAR`. Se ejecutaron los asesores de seguridad y
rendimiento después del DDL. Las entradas de C11/C12 sobre RLS sin políticas y
la RPC `SECURITY DEFINER` corresponden al patrón de tablas cerradas y
autorización interna que ya usa este bloque; los demás avisos quedan fuera del
alcance de C12.

## 4. Límites confirmados

- C12 toma las conciliaciones documentales del local completo; todavía no las
  relaciona estrictamente con la sesión de caja ensayada.
- La prueba cubre la recuperación idempotente mediante replay, pero no una
  caída real de red o proceso.
- No se probaron hardware de impresión, emisión fiscal real ni una sesión
  nocturna operada desde la pantalla.
- La RPC no está conectada a la interfaz.

Por estos límites, C12 permanece `INCOMPLETO`; su núcleo de servidor queda
verificado en QA.
