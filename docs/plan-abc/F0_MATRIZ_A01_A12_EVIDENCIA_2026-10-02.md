# F0 — matriz de evidencia A01–A12 (TPV)

Fecha: 2026-10-02
SHA de código: `a5a4321` (más documentación de esta rama)
Estado: `MATRIZ_CON_EVIDENCIA_PENDIENTE_DE_DECISIONES_Y_ACEPTACION`

Sustituye al esqueleto `F0_5_MATRIZ_EJECUCION_A01_C12` de la rama
`codex/f0-inventario-abc` (todo en `PENDIENTE`, con numeración de C antigua). No
es una aceptación: ninguna fila pasa a «verificado» sin recorrido real, entorno,
SHA, usuario y quién acepta. El Plan ABC no pide cifras de coste hasta tener esto
y las decisiones de F1; no se estiman aquí.

## Cómo leer el estado

Taxonomía del plan (§2.5): verificado, incompleto, defectuoso, pendiente,
bloqueado, opcional/no aplicable. Etiquetas de evidencia:

- `[MIGR]` migración presente en el repositorio **y aplicada en QA** (comprobado
  hoy con `list_migrations`).
- `[QA]` ejecución de hoy en QA, en transacciones con `ROLLBACK`, con datos
  ficticios (`F5_ENSAYO_INTEGRAL_QA_2026-10-02.md`).
- `[A12]` `A12_EVIDENCIA_QA_2026-10-02.md` (backend con rollback; no es pantalla).
- `[UI]` el paquete `fuente.js` (y `source-recovery`) llama a esa función del
  servidor. Se comprobó por búsqueda de texto; una ausencia no descarta otra vía.
- `[CI]` contratos estáticos de `tests/f3`. Hoy: **17 de 20 `.mjs` pasan**; los 3
  que fallan son de A09 y necesitan PGlite/PostgreSQL local (fallo de entorno).
  Los `.sql` no se ejecutaron aquí. Un contrato estático **no** acredita un
  recorrido.
- `[TRASPASO]` dicho en el traspaso del 2/10, no revalidado hoy.

## Resumen

| ID | Requisito | Estado | Evidencia clave | Brecha principal |
|---|---|---|---|---|
| A01 | Recorrido real del servicio | `PENDIENTE` | Ficha del piloto y mapa de recorridos sin ejecutar (rama F0, no integrada) | Observar y medir; decidir el local piloto |
| A02 | Pantalla de venta | `INCOMPLETO`, bloqueado por catálogo | El TPV carga; el piso de venta está vacío (catálogo TPV con 0 filas) | Catálogo; recorrido en dispositivos; sin llamada a actualizar línea |
| A03 | Cantidad y precio | `INCOMPLETO` | `[QA]` el servidor calculó 20,00 + 2,00 = 22,00 sin recibir precio | Redondeo, fraccionables, repartos; la pantalla no verificada |
| A04 | Variantes y suplementos | `INCOMPLETO` | `[MIGR]`; la pantalla llama a las rutas `_configurada` | No ejercitado; catálogo con opciones |
| A05 | Estados del pedido | `INCOMPLETO` | `[QA]` transiciones válidas hasta cobro | Negativas; sin llamada a cierre operativo |
| A06 | Cuentas abiertas y recuperación | `INCOMPLETO` | `[A12]` lecturas; `[UI]` recuperar y listar | Dos sesiones, reinicio, caducidad |
| A07 | Mesas y responsables | `INCOMPLETO` | `[A12]` zona, mesas, asignar, mover | La pantalla no crea zonas ni mesas ni libera mesa |
| A08 | Dividir y unir cuentas | `INCOMPLETO` | `[A12]` dividir línea y unir (backend) | La pantalla no une ni reparte por importe |
| A09 | Descuentos y cortesías | `INCOMPLETO` | `[A12]` descuento autorizado; `[UI]` completo | Límites por rol, historial, efectos fiscales |
| A10 | Notas y cambios (cocina) | `INCOMPLETO` | `[MIGR]`; `[UI]` completo | Sin ensayo; sin enlace con stock ni impresión real |
| A11 | Día operativo y horas | `INCOMPLETO` | `[QA]` funciona al sembrar la regla | QA sin regla; medianoche y cambio horario |
| A12 | Pruebas funcionales del TPV | `INCOMPLETO` | `[A12]` y `[QA]` backend | Recorridos por pantalla, dos sesiones, dispositivos |

Totales: 0 verificados, 11 incompletos, 1 pendiente.

## Fichas

### A01 — Recorrido real del servicio
- **Aceptación (plan):** flujo acordado por modalidad usada, con errores y
  excepciones; la usuaria confirma que representa la operación.
- **Evidencia:** el backend acepta las cuatro modalidades (`BARRA`, `MESA`,
  `TERRAZA`, `TAKEAWAY`) `[A12]`. No hay observación real ni tiempos. La ficha
  F0.2 (`PENDIENTE_DECISION_USUARIO`) y el mapa F0.3
  (`PENDIENTE_EJECUCION_CON_DATOS_FICTICIOS`) existen solo en una rama no integrada.
- **Falta:** rellenar la ficha del piloto; observar y medir; acta.
- **Decisión de Pedro:** local, modalidades, roles, equipos, responsable que acepta.

### A02 — Pantalla de venta
- **Aceptación:** localizar, añadir, modificar y retirar artículos sin ambigüedad
  en los dispositivos acordados.
- **Evidencia:** `[A12]` el TPV carga en el preview; con «Todos los locales» bloquea
  la mutación `[TRASPASO]`. `[UI]` llama a abrir cuenta, crear pedido, agregar,
  confirmar, enviar y cancelar línea. **No llama a `abc_actualizar_linea_pedido`.**
  Catálogo TPV con 0 filas en QA: no hay productos vendibles.
- **Falta:** catálogo (ver P3 del análisis de claves), recorrido táctil, teclado y
  móvil, estado de conexión/local/cuenta visibles, que volver atrás no confirme una
  venta, contraste y foco. Cómo se cambia una cantidad ya añadida.
- **Dependencias:** A01, catálogo H mínimo, matriz de equipos V.

### A03 — Cantidad y precio visibles
- **Aceptación:** no se confunde precio con cantidad; editar el precio en una
  petición no evita la validación; los totales coinciden con casos conocidos.
- **Evidencia:** `[QA]` 2 × (10,00 + 10 %) = base 20,00, impuestos 2,00, total
  22,00 calculado por el servidor; `abc_agregar_linea_pedido` no tiene parámetro de
  precio. `[MIGR]` A03 aplicada.
- **Falta:** redondeo, fraccionables, descuentos y reparto de céntimos (vectores
  F1.5 sin aprobar); manipulación de cantidades; que la pantalla muestre el
  desglose del servidor.

### A04 — Variantes y suplementos
- **Aceptación:** se rechazan combinaciones inválidas y cada variante se prepara,
  cobra, devuelve y audita.
- **Evidencia:** `[MIGR]` A04. `[UI]` llama a agregar y confirmar `_configurada`.
  Existen las tablas de opciones del catálogo; con el catálogo vacío no hay nada que
  ejercitar. Hoy no se probó ninguna variante.
- **Falta:** catálogo con grupos de opciones; dos líneas del mismo producto con
  variantes y precios distintos; consumo agregado de stock.
- **Dependencias:** H01–H05, I.

### A05 — Estados del pedido
- **Aceptación:** el backend rechaza transiciones incompatibles y la pantalla
  muestra los efectos pendientes.
- **Evidencia:** `[QA]` borrador → confirmada → enviado → checkout → pagada
  funciona. Tras un reembolso parcial de 11, el estado de cobro sigue `PAGADO` con
  22 confirmados (no es neto). `[UI]` cancela línea y pedido; **no llama a
  `abc_cerrar_pedido_operativo`**.
- **Falta:** matriz F1.2 aprobada; pruebas negativas (cancelar una cuenta pagada,
  líneas servidas…); cierre operativo del pedido.

### A06 — Cuentas abiertas y recuperación
- **Aceptación:** dos sesiones modifican la misma cuenta con resultado explícito;
  un reinicio no pierde líneas ni genera copias.
- **Evidencia:** `[MIGR]` A06 y recuperación por día operativo. `[UI]` llama a
  listar y recuperar. `[A12]` lectura de cuentas recuperables.
- **Falta:** dos navegadores simultáneos, corte de red, reinicio, caducidad de
  borradores locales, conflicto de versiones.

### A07 — Mesas y responsables
- **Aceptación:** trasladar una mesa conserva líneas, pagos, responsables e
  historial; una mesa no parece libre con servicio activo.
- **Evidencia:** `[A12]` crear zona y mesas, asignar y trasladar en backend. `[UI]`
  llama a asignar, mover, mapa de sala, cambiar y listar responsables.
  **No llama a `abc_crear_zona`, `abc_crear_mesa` ni `abc_liberar_cuenta_mesa`:**
  desde la pantalla no se configura el plano ni se libera una mesa.
- **Falta:** decidir dónde se configura el plano; traslado y acceso desde otro
  local, en pantalla.

### A08 — Dividir y unir cuentas
- **Aceptación:** la suma de las partes coincide con el original, incluso con
  pagos parciales; unir o trasladar no duplica artículos, cobros ni stock.
- **Evidencia:** `[A12]` dividir una línea y unir cuentas en backend. `[MIGR]` A08
  y el bloqueo por cobro incierto. `[UI]` solo mueve cantidad de línea y consulta
  el reparto. **No llama a `abc_unir_cuentas`, `abc_asignar_cuota_importe` ni
  `abc_revertir_cuota_importe`**: no hay unir ni repartir por importe o personas.
- **Falta:** esa parte de la pantalla; reparto determinista de céntimos; pagos
  parciales y dos cajas sobre el mismo saldo. El traspaso cita una aserción de
  interfaz A08 desalineada; hoy el único contrato estático de A08 pasa.

### A09 — Descuentos y cortesías
- **Aceptación:** el usuario autorizado aplica el ajuste previsto y otro no puede
  forzarlo por API; stock y caja reflejan efectos distintos.
- **Evidencia:** `[MIGR]` A09. `[UI]` llama a aplicar, aprobar, configurar política y
  listar. `[A12]` descuento autorizado en backend. `[CI]` 11 contratos `.mjs`: 8
  pasan, 3 necesitan PGlite/PostgreSQL local. Hoy no se probó ningún descuento. Los
  documentos `A09_CIERRE_*` tienen etiquetas de cierre que el traspaso pide
  revalidar.
- **Falta:** límites por rol, motivo, aprobación, historial; efecto fiscal (C06) y
  de stock/caja; intento de forzar por API en QA; clasificación fiscal con asesoría.

### A10 — Notas y cambios enviados (cocina)
- **Aceptación:** cocina sabe qué cambió y no prepara dos veces una comanda
  repetida; una cancelación tardía conserva su coste y trazabilidad.
- **Evidencia:** `[MIGR]` A10 y A10b. `[UI]` llama a todas las funciones de cocina
  (estaciones, preparar, marcar, servir, cambio, reimprimir, listar, merma). No hay
  ensayo de cocina en `[A12]` ni en `[QA]`. **Ninguna función ABC mueve stock**
  (comprobado en las migraciones): una merma o cancelación tardía no genera efecto
  de stock.
- **Falta:** enrutado, versiones y acuse, reenvío, impresora caída (V), cancelación
  en preparación, enlace con stock (I).

### A11 — Día operativo y horas
- **Aceptación:** venta, pago, documento y cierre se explican en su fecha, sin
  trasladarlos al día equivocado.
- **Evidencia:** `[MIGR]` A11. `[QA]` `private.abc_operating_day_reglas` está
  **vacía en todos los locales**: abrir cuenta falla con
  `operating_day_configuracion_ausente`. Con una regla sembrada (corte 04:00,
  `Europe/Madrid`) la cuenta y la sesión asignan el día. No probado: medianoche,
  cambio de hora, reloj del dispositivo, qué valida el servidor si el cliente manda
  otro día.
- **Falta:** decisión de corte y zona por local; regla en el local piloto; T20.

### A12 — Pruebas funcionales del TPV
- **Aceptación:** cada recorrido aplicable tiene evidencia; no se pierden ni
  duplican líneas; los límites quedan registrados.
- **Evidencia:** `[A12]` y `[QA]`: modalidades, zona/mesas, pedido, descuento,
  dividir/unir, checkout, cobro en efectivo, mixto y con tarjeta simulada,
  reembolso y cierre, con negativas por rol y empresa. Nada por pantalla; piso de
  venta vacío.
- **Falta:** todos los recorridos por pantalla, dos sesiones reales, usuario sin
  permiso, reinicio, dispositivos; comparar pedido, stock y saldo; candidato exacto;
  aceptación de la usuaria; T01–T24.

## Bloqueos que afectan a varias filas

1. **Catálogo TPV vacío** (`productos` no se guarda en el servidor en QA): A02,
   A03, A04, A09, A10, A12.
2. **Decisiones sin aprobar:** F1 (estados, permisos, vectores monetarios, fiscal) →
   A03, A05, A09, A11. Ficha del piloto → A01, A12.
3. **Pantalla sin llamar a funciones que ya existen** (zona, mesa, liberar, unir,
   cuotas, actualizar línea, cerrar pedido): A02, A05, A07, A08.
4. **Stock sin conectar al circuito ABC:** A10, A12.
5. **QA sin regla de día operativo:** A11 y cualquier prueba por pantalla.
6. **Equipos reales (V) sin matriz:** A02, A10, A12.

## Límites de esta matriz

- No se ha usado la aplicación como usuario ni se han mirado las pantallas, salvo
  capturas del preview. `[UI]` es búsqueda de texto en el paquete.
- No se ejecutaron los contratos `.sql` ni los 3 de A09 (sin PostgreSQL local).
- Producción no se revalidó para A. Según el traspaso su última migración ABC es
  `abc_f4_b02_b03_checkout_bridge`, por lo que A03–A11 estarían allí; hay un
  postflight de A08 del 24/9. No se ha comprobado hoy.
- Sin estimaciones de coste ni de esfuerzo: dependen de las decisiones de F1.
