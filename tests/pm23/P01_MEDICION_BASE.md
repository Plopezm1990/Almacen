# PM23 P01 — Medición base de red, carga y simultaneidad (diagnóstico, sin veredicto)

Texto literal del Plan Maestro: *"PM-23 · Red, carga y simultaneidad: Extender
NR-06/12: recarga durante guardado, timeout tras confirmación, varias
pestañas, última unidad, recepción/pago/devolución concurrentes y volumen
representativo."* Entrega verificable: *"Una operación persistida por
identificador; estado recuperable tras timeout. Presupuesto de rendimiento y
muestra acordados, con mediciones, no solo percepción."*

Por instrucción explícita del usuario, este punto se ejecuta primero como
**medición pura**, sin fijar todavía un presupuesto de aprobado/rechazado ni
modificar código. El presupuesto (candidatos iniciales: p95 < 2 s,
recuperación < 5 s) se decide en un punto posterior con estos datos delante,
y entonces se repite la validación formal contra ese presupuesto.

## 0. HEAD, build y entorno exactos

- Rama: `claude/pm23-red-carga-simultaneidad`, base `main` en
  `93a570badba1c5375febfbddc1dffdbcef003dcd` (el mismo punto de partida que
  PM21/PM22 — PM21/PM22 aún no fusionados).
- Entorno: el proyecto QA de Supabase de este proyecto (nunca producción,
  nunca TPV) — el mismo usado en todo PM21.
- Autenticación: `anon key` + sesión real de `owner.a@qa.invalid`
  (Propietario de `QA-EMP-A`, ya preparada en PM21 P03) — en ningún momento
  `service_role`.
- Cliente: Node.js (`fetch`/undici) ejecutado desde el entorno de esta sesión
  de desarrollo — **no** un navegador ni un dispositivo móvil real. La red
  entre este cliente y QA pasa por el proxy saliente de esta sesión, cuya
  latencia/jitter propios no son representativos de la red de un usuario
  final. Esto se registra como limitación explícita del método, igual que ya
  se hizo con "Android/iOS reales" en PM22.

## 1. Operaciones y fixtures usadas

| Operación | RPC real | Fixture QA aislada |
|---|---|---|
| Pago | `registrar_pago_factura` | Una factura ficticia (`importeTotal` 100000) en `QA-EMP-A`/`QA-A1`, compartida entre todos los pagos — recrea el escenario real de "varios pagos concurrentes contra el mismo documento". |
| Devolución | `registrar_devolucion_venta_pm09` | Un producto ficticio con stock amplio; cada devolución se hace sobre una venta real de 1 unidad creada justo antes (paso de preparación, no cronometrado), sin reembolso monetario (para no depender del arqueo de caja del día). |
| "Recepción" | **Sin RPC dedicada — ver hallazgo §2** | 45 productos ficticios independientes, para que la concurrencia real no choque por fila. |

Todos los identificadores de fixture usan el prefijo `QA-PM23-` para que
queden identificables sin ambigüedad como datos de esta medición.

## 2. Hallazgo arquitectónico: "recepción" no tiene una vía transaccional propia

Al buscar la RPC de "recepción" (entrada de mercancía desde un pedido de
compra) para poder medirla igual que pago/devolución, se confirmó que **no
existe ninguna función `registrar_*`/`recibir_*` para ello** en el backend
— coincide con el hallazgo ya registrado en PM21 P01: `albaranes_empresa`
(la tabla que lógicamente debería representar la recepción) no tiene ningún
consumidor real en `fuente.js`. La recepción de compra hoy se gestiona por el
mecanismo genérico `almacen_kv` (lectura/escritura de bloque completo), no
por una RPC con control de concurrencia por fila como `registrar_pago_factura`
o `registrar_devolucion_venta`.

Por eso, la medición de "recepción/pago/devolución concurrentes" del Plan
Maestro se ejecuta aquí como **pago y devolución reales**, y como sustituto
de "recepción" se usa `pm12_confirmar_ajuste_stock` (la RPC real de ajuste de
inventario, con el mismo tipo de control de concurrencia por fila) —
etiquetado explícitamente como sustituto en todos los resultados, nunca
presentado como si fuera la propia recepción. Queda como decisión pendiente
del usuario: si se quiere medir la ruta real de recepción (`almacen_kv`),
esa es una medición de un mecanismo cliente-servidor distinto (lectura y
fusión de un bloque JSON completo, no una RPC transaccional), con su propio
diseño de prueba — no se inventa aquí sin decisión explícita.

## 3. Resultados (p50/p95/p99/max, muestras, errores)

Todos los tiempos en milisegundos. "Errores" cuenta respuestas HTTP que no
sean `{ok:true}` (ninguna se produjo en esta medición).

### 3.1 Pago (`registrar_pago_factura`)

| Modo | n | p50 | p95 | p99 | max | errores |
|---|---|---|---|---|---|---|
| Arranque frío (1ª llamada) | 1 | 182 | — | — | 182 | 0 |
| Concurrente × 2 | 2 | 199 | 200 | 200 | 200 | 0 |
| Concurrente × 5 | 5 | 217 | 239 | 239 | 239 | 0 |
| Concurrente × 10 | 10 | 173 | 284 | 284 | 284 | 0 |
| Concurrente × 20 | 20 | 213 | 401 | 409 | 409 | 0 |
| Secuencial × 200 | 200 | 133 | 148 | 287 | 576 | 0 |

### 3.2 "Recepción" — sustituto `pm12_confirmar_ajuste_stock` (ver §2)

| Modo | n | p50 | p95 | p99 | max | errores |
|---|---|---|---|---|---|---|
| Arranque frío | 1 | 154 | — | — | 154 | 0 |
| Concurrente × 2 | 2 | 152 | 163 | 163 | 163 | 0 |
| Concurrente × 5 | 5 | 143 | 166 | 166 | 166 | 0 |
| Concurrente × 10 | 10 | 195 | 224 | 224 | 224 | 0 |
| Concurrente × 20 | 20 | 156 | 192 | 380 | 380 | 0 |
| Secuencial × 200 | 200 | 144 | 153 | 164 | 186 | 0 |

### 3.3 Devolución (`registrar_devolucion_venta_pm09`)

| Modo | n | p50 | p95 | p99 | max | errores |
|---|---|---|---|---|---|---|
| Arranque frío | 1 | 171 | — | — | 171 | 0 |
| Concurrente × 2 | 2 | 162 | 167 | 167 | 167 | 0 |
| Concurrente × 5 | 5 | 213 | 235 | 235 | 235 | 0 |
| Concurrente × 10 | 10 | 196 | 229 | 229 | 229 | 0 |
| Concurrente × 20 | 20 | 215 | 466 | 498 | 498 | 0 |
| Secuencial × 200 | 200 | 143 | 200 | 275 | 291 | 0 |

**Lectura honesta, sin conclusión de aprobado/rechazado**: la cola (p95/p99)
crece de forma visible en pago y devolución al llegar a 20 solicitudes
concurrentes (hasta 409 ms y 498 ms respectivamente), mientras que en el
sustituto de recepción se mantiene mucho más plana (máximo 380 ms en p99, el
resto por debajo de 225 ms). La explicación más plausible, coherente con el
propio código: pago y devolución bloquean una fila compartida (la factura
única; el producto único usado para todas las ventas/devoluciones) mediante
`for update`, mientras que el sustituto de recepción usó productos
independientes por diseño — la contención de fila parece ser el factor
dominante en el crecimiento de cola, no un límite genérico de rendimiento del
backend. Esto es una hipótesis respaldada por el diseño del código, no una
conclusión de causalidad definitiva sin más instrumentación.

## 4. Arranque frío vs. caliente

La primera llamada de cada operación fue entre un 15 % y un 35 % más lenta
que la mediana en caliente (pago 182 ms vs 133 ms; recepción-sustituto 154 ms
vs 144 ms; devolución 171 ms vs 143 ms) — una diferencia moderada, coherente
con el coste de establecer la primera conexión/negociación TLS, no con un
problema de la propia operación.

## 5. Recuperación tras timeout

Se calculó un timeout de cliente de 66 ms (mitad de la p50 secuencial de
pago), deliberadamente por debajo del tiempo real de respuesta para forzar
que el cliente abandone mientras el servidor puede seguir procesando. 5
intentos: en los 5, el cliente abortó la conexión (`AbortError`) y, tras un
reintento con el **mismo identificador de operación** 1,5 s después, el
servidor devolvió `replayed:true` — la operación ya se había completado en el
primer intento, y el reintento no la duplicó. Verificado con una consulta
directa: exactamente 1 fila por identificador en los 5 casos. Ningún caso
produjo 0 filas (pérdida) ni 2 filas (duplicado).

## 6. Volumen y niveles de concurrencia

Concurrencia ascendente 2 → 5 → 10 → 20 (nunca se saltó directamente a 20),
más 200 llamadas secuenciales por operación — 236 llamadas por operación,
708 en total más la preparación de ventas para las devoluciones (238 ventas
adicionales, sin cronometrar) y los 5 ciclos de recuperación tras timeout.
Ninguna señal de impacto sobre el proyecto QA compartido (advisors sin
cambios, sin 5xx ni 429 en ningún momento — de haberlos habido, la
instrucción era detener la medición de inmediato, y no hizo falta).

## 7. Integridad final (verificada por consulta directa, no por la respuesta del RPC)

- **Pagos**: 486 filas en `pagos_factura` para la factura fixture, todas con
  `id` único (sin duplicados), coincidiendo exactamente con el número de
  intentos exitosos esperado en cada fase.
- **Stock del sustituto de recepción**: los 45 productos fixture terminaron
  en valores enteros consistentes con los ajustes aplicados — sin
  fraccionarios espurios, sin negativos, sin saltos inexplicables.
- **Stock del producto de venta/devolución**: consistente con el neto de
  ventas menos devoluciones (cada devolución compensa exactamente su venta).
- Cero efectos parciales, cero mezcla entre `QA-EMP-A` y cualquier otra
  empresa/local (todas las operaciones se mantuvieron dentro de
  `QA-EMP-A`/`QA-A1`, la fixture prevista).

## 8. Bug propio detectado y corregido durante la preparación

La primera ejecución del arnés de medición reservó solo 20 productos fixture
para el sustituto de recepción, pero la suma de los niveles de concurrencia
(2+5+10+20) más el arranque en frío exige 38 — el nivel de concurrencia 20
terminó midiendo solo 2 muestras reales antes de agotar el cupo. Detectado
antes de presentar el resultado (el tamaño de muestra registrado no
coincidía con el solicitado), se amplió el fondo de fixtures a 45 productos,
se añadió una comprobación explícita que detiene la medición si el fondo se
agota, y se repitió la medición completa desde cero. Los números de este
documento son de la segunda ejecución, ya corregida.

## 9. Archivos

- `tests/pm23/p01-medicion-base.mjs`: el arnés de medición real. Requiere
  credenciales de sesión QA que solo existen de forma efímera en la sesión
  interactiva que las preparó (mismo patrón que los scripts vivos de PM21) —
  no se ejecuta en CI ni se conecta a QA automáticamente.
- `tests/pm23/p01-resultado-medicion.json`: la salida real de la segunda
  ejecución (los datos de este documento).
- `tests/pm23/p01-contract.mjs` (nuevo): confirma que este documento y el
  resultado registran las métricas reales (p50/p95/p99/max por operación y
  modo, el hallazgo de "recepción", la prueba de recuperación tras timeout,
  y la integridad final) y que no publican identificadores internos ni
  secretos.

## Regresión

Sin cambios en `fuente.js` ni en ninguna migración de esquema — este punto
mide comportamiento ya existente, no lo modifica. Suite completa del
proyecto — sin regresiones.

## Estado de main/producción/QA

`main` sin tocar. Todas las llamadas mutantes se hicieron con `anon key` +
sesión real, nunca `service_role`, contra fixtures QA aisladas y
prefijadas. Producción y TPV sin tocar.

## Siguiente paso (pendiente de decisión del usuario)

Este documento **no declara aprobado ni rechazado**. Con estos datos
delante, falta:

1. Fijar el presupuesto de rendimiento definitivo (los candidatos p95 < 2 s
   y recuperación < 5 s quedan muy por debajo de lo medido — la decisión es
   del usuario, no automática).
2. Decidir el alcance de "recepción" (§2): aceptar el sustituto medido aquí,
   o diseñar una medición específica del mecanismo `almacen_kv`.
3. Repetir la validación formal contra el presupuesto acordado — ahí sí con
   veredicto de aprobado, hallazgo a corregir, o excepción aceptada
   expresamente.

**PM23_P01_MEDICION_BASE=EJECUTADA_SIN_VEREDICTO**
