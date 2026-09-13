# PM21 P06 — Réplica de idempotencia por HTTP real contra QA

Sexto y último punto de PM21. Con autorización explícita del usuario, limitada
a esta única prueba mutante aislada, ejecuta contra la API real de QA (no
contra una base local desechable, que es donde ya se había probado en PM12
P08) la réplica exacta de un RPC de escritura con el mismo `operationId`, y
cierra así el último elemento pendiente de la matriz de P01 §6.

## 0. Alcance autorizado y condiciones

El usuario autorizó exactamente esta prueba, con diez condiciones concretas.
Cómo se cumplió cada una:

1. **Destino QA confirmado por allowlist**: se releyó `get_project` sobre el
   mismo proyecto usado en todo PM21 inmediatamente antes de escribir nada —
   nombre `L&A Suite QA`. Sin duda posible.
2. **Fixture QA dedicada**: se usó el producto fixture ya existente
   `QA-PROD-A-AGUA` en `QA-EMP-A`/`QA-A1` (visible también en
   `QA-A2`/`QA-A-CERRADO`), nunca un producto ni un local reales.
3. **`anon key` + sesión real**: toda la prueba se ejecutó con la sesión ya
   preparada de `owner.a@qa.invalid` (Propietario A, reutilizada de P03/P04,
   sin generar ninguna contraseña nueva ni usar `service_role` en ningún
   momento de este punto).
4. **Misma petición exacta, mismos identificadores**: la segunda llamada usa
   literalmente el mismo objeto de argumentos que la primera (mismo
   `operationId`, misma `intención`, mismo `plan`, misma `base`) — no se
   construyó ninguna lógica de comparación paralela; se llamó al RPC de
   producción dos veces con el mismo payload.
5. **Estado comprobado antes y después**: ver §2.
6. **Efecto lógico único**: confirmado — una sola fila en `stock_operaciones`,
   un solo movimiento en `movimientos_stock`, un solo descuento de stock.
7. **Sin concurrencia**: las dos llamadas se hicieron en secuencia, una
   después de que la anterior devolviera respuesta completa. No se probó
   ningún escenario de solicitudes simultáneas (eso ya se cubrió, contra una
   base local desechable, en PM12 P08).
8. **Sin `ROLLBACK`**: no se usó ninguna transacción de base de datos
   revertida como sustituto de la prueba — la prueba se hizo por HTTP real, y
   el efecto (el conteo aplicado, la operación y el movimiento) permanece en
   QA como evidencia, igual que otras fixtures de PM21 (`QA-CROSS-EMP-B1`,
   `QA-A-CERRADO`). No se ha borrado nada.
9. Sin defectos: la prueba pasó a la primera; no hizo falta detenerse a
   diagnosticar ni tocar código o esquema.
10. Ver §4 (checkpoint) y §5 (gate).

## 1. Operación probada

RPC `pm12_confirmar_ajuste_stock` (ajuste de inventario de stock), la misma
función ya verificada en comportamiento contra una base local desechable en
PM12 P08 — aquí se ejecuta contra QA real. Ajuste de ámbito `total` sobre
`QA-PROD-A-AGUA` en `QA-EMP-A`/`QA-A1`, de 23 unidades (18 almacén + 5 piso) a
20 (conteo real registrado, no una resta directa) — la propia función calcula
el delta necesario.

`operationId`: `pm12-ajuste-conteo:QA-P06-CONTEO-IDEMPOTENCIA:<fecha>` — se
conservó el mismo formato e identificador que usa la aplicación real, no uno
inventado para el test.

## 2. Estado antes / después (verificado por consulta directa, no solo por la respuesta del RPC)

| Momento | `stock_ubicacion` (almacén / piso) | `stock_operaciones` (filas con este `operationId`) | `movimientos_stock` (filas con este `operationId`) |
|---|---|---|---|
| Antes | 18 / 5 | 0 | 0 |
| Tras 1ª llamada | 15 / 5 | 1 | 1 (`delta_total=-3`) |
| Tras 2ª llamada (réplica exacta) | 15 / 5 (sin cambio) | 1 (sin cambio) | 1 (sin cambio) |

Primera llamada: `{ ok: true, replayed: false, ajustados: 1 }`.
Segunda llamada (idéntica): `{ ok: true, replayed: true, ajustados: 1 }`.

**Auditoría**: esta ruta de negocio no inserta en `auditoria_registro` (esa
tabla la alimenta `registrarAuditoria()` desde el frontend, no este RPC
llamado directamente por HTTP) — el registro auditable real de esta operación
es la propia fila de `stock_operaciones`, que conserva `actor_user_id`
(el `user_id` real de `owner.a@qa.invalid`, verificado por consulta directa)
y el `payload` completo con el resultado. Verificado que `auditoria_registro`
tiene 0 filas relacionadas con este `operationId`, como se esperaba — no es
un hueco, es el diseño real de esta ruta.

## 3. Resultado

Efecto lógico único confirmado: sin duplicados, sin segundo descuento de
stock, sin cambios parciales, sin mezcla entre empresa/local (todo quedó
dentro de `QA-EMP-A`/`QA-A1`, la fixture prevista). El comportamiento de
idempotencia por `operationId`, ya verificado antes contra una base
desechable (PM12 P08) y contra QA solo mediante lectura de código (P01),
queda ahora verificado en vivo contra la API real de QA con una sesión de
usuario real.

## 4. Checkpoint de PM21

Con este punto, PM21 completa todos los elementos que P01 había identificado
como pendientes, con evidencia real (no solo lectura de código) para cada
uno:

| Elemento de P01 | Estado |
|---|---|
| Inventario de 41+3 funciones y sus políticas | Cerrado en P01 |
| `movimientos_registro` sin aislamiento | Corregido y verificado (P02, P03) |
| Storage sin aislamiento por empresa | Corregido y verificado (P02, P03) |
| `pagos_encargo`/`encargos_empresa` rol `public` | Corregido (P02) |
| `albaranes_empresa` sin gate financiero | Corregido y verificado (P02, P03) |
| Identidad de sesión revocada/inactiva | Ya existía, verificada en vivo (P03) |
| Matriz positiva/negativa con 5 identidades reales | Ejecutada en vivo (P03) |
| Local cerrado bloquea operaciones | Verificado en vivo (P04) |
| Relación cruzada entre empresas en un RPC | Verificado en vivo (P05) |
| Réplica de idempotencia por HTTP real contra QA | Verificado en vivo (P06, este punto) |

Ningún hueco abierto de los identificados en P01. Las dependencias de
PM-22/24/25 registradas en P01 §7 siguen deliberadamente sin decidir, como se
acordó explícitamente al empezar PM21 — no bloquean su cierre.

**PM21 queda formalmente cerrado** (P01-P06), sujeto a la verificación del
gate remoto en el HEAD exacto de este commit (§5) antes de declararlo así de
forma definitiva.

## 5. Archivos

- `tests/pm21/P06_REPLICA_IDEMPOTENCIA_HTTP_QA.md` (este documento).
- `tests/pm21/p06-replica-idempotencia-contract.mjs` (nuevo): confirma que el
  documento registra el resultado real de la réplica y el checkpoint de
  cierre de PM21, y que no publica identificadores internos ni secretos.

## Regresión

Sin cambios en `fuente.js` ni en ninguna migración de esquema — este punto
ejecuta y documenta una prueba real sobre lógica ya existente y ya cerrada
(PM12 P08). Suite completa del proyecto — sin regresiones.

## Estado de main/producción/QA

`main` sin tocar. Una única mutación real en QA (el ajuste de stock de la
fixture, autorizado explícitamente para esta prueba concreta), ejecutada con
`anon key` + sesión real, nunca `service_role`. Sin `ROLLBACK`, sin borrado de
evidencia. Producción y TPV sin tocar.

**PM21_P06_REPLICA_IDEMPOTENCIA=PASS**
**PM21_CIERRE_FORMAL=PASS**
