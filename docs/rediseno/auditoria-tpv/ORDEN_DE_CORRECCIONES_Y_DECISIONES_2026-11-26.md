# Orden de las correcciones y recomendación para las decisiones · TPV · 26/11/2026

Sustituye al orden de la tabla inicial de `PLAN_CORRECCION_TPV_2026-11-25.md`, que se hizo antes
de los lotes L1 a L5. El detalle de cada corrección (criterio de aceptación, tipo) sigue en el
plan, con los códigos A1…A8, B1…B3, C1…C5, D1…D3 y F1…F11.

**Nada de esto está implementado.** Las recomendaciones de la segunda parte están **pendientes de
aprobación**: ninguna cuenta como decisión tomada hasta que el usuario la confirme.

## 1. Orden de implementación por olas

Criterio: primero lo que pierde o falsea dinero, documentos o datos; después lo que bloquea el
trabajo diario; después seguridad del servidor; después el modo caja según la referencia; por
último las decisiones de producto y las mejoras menores. Cada ola termina con una **verificación
en QA** con los casos de la matriz que la cubren.

| Ola | Qué se arregla | Hallazgos | Cambia servidor | Se verifica con |
|---|---|---|---|---|
| **0 · P1** | Documento fiscal del cobro del Cajero/a y detección en el cierre | **H-38** | Sí | R-14, R-19, F-18 |
| 0 | Copia local ligada a empresa y usuario: pendientes que se suben a otra empresa, borrador del carrito de otro usuario, arranque bloqueado, pendiente de cobro antiguo | **H-19**, H-40, H-46, H-31 | No | L-07, R-17, R-32 |
| 0 | «Arqueo de caja» con el esperado del servidor | **H-24** | No | L-05, F-16 |
| **1 · cobro y venta** | Venta rápida a medias con Cajero/a, productos sin ruta, cuentas que no se cierran, cobro que no aparece tras enviar, cuentas con pedido cancelado | H-37, H-20, H-21, H-22, H-42 | Sí | R-13, L-03, R-25, F-03 |
| 1 | Política de descuentos coherente, «Reintentar aplicación», líneas recibidas por reparto | H-39, H-44, H-43 | Sí | R-15, R-28, R-30, R-24 |
| 1 | Tarjeta simulada y su reembolso desde la interfaz, documento fiscal de la venta mixta, bloqueos del cierre legibles | H-27, H-23, H-26 | Sí | F-09, F-10, **L-08**, L-06 |
| **2 · seguridad** | Encargos solo por funciones de servidor, privilegios sobrantes, funciones y función Edge de QA sin código en el repositorio, alta de empresa con su política de segundo factor | H-04, H-18, H-06, H-17 | Sí | P-03, matriz por rol |
| 2 | Direcciones de producción fuera del código, cambio obligatorio de la contraseña inicial, guardar solo las políticas modificadas | H-33, H-36, H-45 | Sí / No | R-08, R-01, R-33 |
| **3 · modo caja** | Referencia «doble banda»: acción principal, aviso de sincronización, capas como diálogos, contraste, cabecera móvil, densidad a 320 px, tema | H-01, H-02, H-03, H-08, H-10, H-11, H-13 | No | V-10, V-16, mediciones a 4 tamaños |
| 3 | Categorías y acción con el ticket vacío (según las decisiones E4 y E5) | H-09, H-12 | No | mediciones visuales a 4 tamaños |
| **4 · decisiones** | Stock insuficiente y devolución de anticipos (según E2 y E3) | H-15, H-05 | Sí | F-20, F-17 |
| **5 · resto** | TPV normal, cierre de caja visible, cuentas de días cerrados, recarga a mitad de guardar, mensaje sin red, anular y reembolsos en el historial, mensaje del Camarero/a, botón de deshacer reparto | H-16, H-25, H-28, H-29, H-30, H-32, H-34, H-35, H-41, H-47 | Algunos | L-09, F-19, R-06, R-07 |

**Cobertura:** las 47 entradas de `HALLAZGOS_TPV_2026-11-25.md` están en una ola, salvo H-14
(descartado) y H-07 (decidido el 26/11, solo falta actualizar la maqueta).

**Por qué H-38 va primero:** es la única que cierra ventas cobradas sin documento fiscal sin
avisar a nadie, ni siquiera al cierre de caja, y afecta al cargo que más cobra.

**Dependencias:** la ola 1 necesita antes la ola 0 (si no, las pruebas de cobro vuelven a
ensuciar el navegador y el arqueo). La ola 3 puede ir en paralelo con la 1 y la 2 porque solo
toca la presentación. La ola 4 espera a las decisiones de abajo.

## 2. Recomendación del auditor para las cuatro decisiones pendientes

Estas cuatro condicionan qué se implementa en las olas 3 y 4. Cada una se puede cambiar.

### E2 · Stock insuficiente (H-15) — recomiendo **permitir la venta con aviso**

- **Qué pasa hoy (VIVO, 26/11):** la tarjeta del agua marca «sin stock» (piso de venta 0), el
  ticket **no avisa** y el servidor deja guardar, enviar y cobrar; descuenta del almacén y no
  toca el piso.
- **Recomendación:** no bloquear. Mostrar el aviso **en la tarjeta y en el ticket** antes de
  guardar (hoy el aviso mira el stock total y no el del piso), dejar vender y que el servidor
  **registre el déficit del piso** para reponerlo. El código ya tiene el campo
  `deficitPendiente`, así que el modelo lo contempla.
- **Por qué:** el producto ya está en la barra; bloquear la venta paraliza el servicio por un
  desajuste de inventario. Un déficit registrado y visible se corrige; una venta no hecha no.
- **Alternativas:** exigir al Encargado que autorice cada venta sin stock (más control, más
  fricción) o bloquear (lo más estricto, pero tira el servicio ante cualquier descuadre).
- **Aceptación:** vender 1 unidad de un producto con piso 0 muestra el aviso, se confirma, queda
  el déficit anotado y el Encargado lo ve en pendientes.

### E3 · Devolución de anticipos (H-05) — recomiendo **una pantalla en Encargos, solo Encargado y Propietario**

- **Qué pasa hoy:** la función `abc_registrar_movimiento_anticipo` existe en el servidor y
  **no tiene pantalla**.
- **Recomendación:** botón «Devolver anticipo» en la ficha del encargo, con permiso de Encargado
  y Propietario (no Cajero/a ni Camarero/a), motivo obligatorio, importe máximo igual al
  anticipo disponible, un único movimiento con identificador de operación y reflejo en la caja
  si se devuelve en efectivo.
- **Por qué:** es dinero del cliente; que lo toque más gente multiplica los errores, y la
  función de servidor ya trae la idempotencia.
- **Aceptación:** devolver un anticipo genera un único movimiento y dos reintentos no lo
  duplican; un Cajero/a recibe el rechazo del servidor.

### E4 · Acción principal con el ticket vacío (H-12) — recomiendo **ninguna acción naranja**

- **Qué pasa hoy:** con el ticket vacío el modo caja muestra «Cobrar» como acción principal.
- **Recomendación:** con el ticket vacío y sin cuenta pendiente, **ninguna acción destacada**.
  Con líneas, «Guardar pedido». Con una cuenta abierta con saldo, «Cobrar».
- **Por qué:** cumple la regla de la referencia («un único botón naranja por vista») y evita
  pulsar «Cobrar» sin nada que cobrar.
- **Aceptación:** a 1440, 1024, 390 y 320 px, el estilo calculado del botón activo coincide
  con el estado real de la cuenta.

### E5 · Categorías (H-09) — recomiendo **paginación con flechas**

- **Qué pasa hoy:** la fila de categorías se desliza en horizontal.
- **Recomendación:** paginar por grupos con flechas, sin desplazar, con controles de 44 × 44 px.
- **Por qué:** es lo que exige la referencia «doble banda» («las categorías avanzan por grupos
  mediante flechas, sin deslizar») y evita elementos que quedan fuera de la vista.
- **Aceptación:** sin barra de desplazamiento en la fila de categorías y todas accesibles.

## 3. Qué no necesita decisión

Todo lo demás se puede empezar sin consultar: son defectos con criterio de aceptación en el plan.
Las únicas **acciones del usuario** que quedan fuera de código son actualizar la maqueta Órbita
con la pantalla de modo caja «doble banda» (ver
`../REFERENCIA_MODO_CAJA_DOBLE_BANDA_2026-11-26.md`) y limpiar en QA lo que dejó la auditoría
(ver el acta de cierre).
