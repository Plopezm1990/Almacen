# Hoja de decisiones para Pedro (Plan ABC, etapa 0)

Fecha: 2026-10-02
Estado: `NIVELES_1_Y_2_ACEPTADOS_CON_HECHOS_ABIERTOS_NIVELES_3_Y_4_PENDIENTES`
Base: `a5a4321`, las matrices `F0_MATRIZ_A01_A12_EVIDENCIA_2026-10-02.md` y
`F0_MATRIZ_B01_C12_EVIDENCIA_2026-10-02.md`, y las fichas de la rama
`codex/f1-contratos-comunes` (F1.1–F1.6) y `codex/f0-inventario-abc` (F0.2).

Esta hoja reúne en un solo sitio lo que solo puede decidir el negocio y que hoy
bloquea el avance (puerta F1.6: `PENDIENTE_APROBACION_F1`). Cada decisión lleva
una **recomendación** para que puedas contestar «sí» o cambiarla. Una
recomendación no es una decisión tomada: nada de lo que sigue se da por
aprobado hasta que lo confirmes. No hay código, base de datos ni producción
implicados en rellenarla.

## Cómo contestar

La forma más rápida es una sola respuesta, por ejemplo:

> Acepto las recomendadas de los niveles 1 y 2, salvo D05 (…) y D12 (…).

Las decisiones marcadas **HECHO** no tienen recomendación porque dependen de
datos que solo conoces tú (nombre del local, modelo de datáfono…): rellénalas.
Nunca escribas contraseñas, claves ni datos reales de clientes.

## Respuesta de Pedro (2/10/2026) y estado

Pedro respondió: «Acepto las recomendadas de los niveles 1 y 2». Se registra así:

| Estado | Decisiones |
|---|---|
| **Aceptada la recomendación** | D02, D06 (condicional), D07, D08, D09, D10, D11, D13, D14, D16, D17 (provisional, hasta los 12 vectores F1.5), D18 |
| **Sigue abierta: es un dato tuyo, no tenía recomendación** | D01 (local piloto), D03 (cajas simultáneas y roles), D04 (equipos), D05 (quién acepta) |
| **Aceptada la regla, falta la cifra** | D12 (porcentaje de descuento del encargado), D15 (umbral de diferencia de caja) |
| **Aceptada, pero hay que responder lo que deja pendiente** | D19 (los `pendiente` de la matriz F1.3) |
| **Condicional que depende de un hecho tuyo** | D02 (qué modalidades usas hoy), D06 (¿hay servicio que cruza la medianoche?) |
| **Resuelta el 2/10 tras la etapa 1** | D31: Pedro decide **precio de carta con IVA incluido**. Implementada en QA con P3 (`F5_P3_CATALOGO_AUTORITATIVO_2026-10-02.md`); falta confirmarlo con la asesoría |
| **Niveles 3 y 4** | Sin responder |

Efecto: P3 (ruta autoritativa de `productos`) quedó autorizada por Pedro el 2/10 y se ejecutó
en QA. La **D07 se ejecutó** (etapa 1, `F5_ETAPA1_SIEMBRA_QA_2026-10-02.md`). La regla
de día operativo sembrada en QA (corte 04:00) es **de prueba**: D06 sigue abierta para
el local piloto. Nada de lo aceptado autoriza producción, despliegues ni gasto.

## Nivel 1 — necesarias para empezar las etapas 1 y 2 (terreno de pruebas y pantalla)

| ID | Decisión | Recomendación | Por qué importa | Desbloquea |
|---|---|---|---|---|
| D01 | **Local piloto** (empresa y local) | **HECHO:** un solo local representativo | Todo el diseño de sesiones, carga y pruebas parte de aquí | A01, A12, C01 |
| D02 | **Modalidades que se usarán** (barra, mesa, terraza, para llevar) | Empezar solo por las que ya usas a diario; barra y mesa si ambas | Decide qué botones faltantes hay que conectar (mesas, unir cuentas, repartos) y cuáles no | A02, A07, A08 |
| D03 | **Cajas simultáneas, usuarios y roles** | **HECHO:** cifra máxima de cajas a la vez y los roles reales (propietario, encargado, cajero, camarero) | Define sesiones de caja, permisos y el ensayo de concurrencia | C01, B05, T08 |
| D04 | **Equipos** (dispositivo de caja, impresora, cajón, red) | **HECHO:** modelo o «no aplica». Probar primero lo que ya tienes; no comprar nada sin necesidad acreditada | Matriz de dispositivos y pruebas de impresión | A02, C09, A12 |
| D05 | **Quién acepta el resultado** | **HECHO:** una persona con nombre o rol, no el desarrollador | Ninguna fila pasa a «verificado» sin esa aceptación | todas |
| D06 | **Corte del día operativo y zona horaria** | `Europe/Madrid`; corte a las **04:00** solo si hay servicio que cruza la medianoche; si no, 00:00 | QA no tiene esta regla y abrir una cuenta falla sin ella. Un turno nocturno debe conservar su día | A11, C01, T20 |
| D07 | **Catálogo de prueba en QA:** ¿autorizas sembrar un catálogo ficticio (unos 15–20 artículos con 2–3 variantes y un impuesto de ejemplo) y la regla de día operativo en QA? | Sí, claramente marcado como provisional y con limpieza verificable, hasta que exista la ruta autoritativa de `productos` | Sin catálogo no se puede probar nada por pantalla | A02–A04, A10, A12 |
| D08 | **Datos de prueba** | Datos ficticios y entorno aislado hasta tu aceptación; sin dinero real ni facturación real | Es el alcance por defecto de F0.2 | todas |

## Nivel 2 — necesarias antes de dinero y stock (etapa 3)

| ID | Decisión | Recomendación | Por qué importa | Desbloquea |
|---|---|---|---|---|
| D09 | **Consumo de stock por flujo** | Barra: se descuenta al confirmar la venta. Sala: se reserva al confirmar el pedido y se consume al preparar o servir. Cobrar una cuenta ya consumida no vuelve a descontar | Hoy el circuito ABC no mueve stock. Es la regla que falta para conectarlo | A10, B08, I |
| D10 | **Devolución: ¿vuelve el producto al stock?** | Un reembolso de dinero **no** repone stock. Solo se repone mercancía realmente recuperable (cerrada, no preparada). Comida consumida: compensación o merma, sin unidades vendibles | Hoy la devolución heredada repone siempre | B08, T11 |
| D11 | **Cancelar una línea ya preparada** | Se registra la merma que corresponda; no se restaura stock | Coste y trazabilidad de cancelaciones tardías | A10, A05 |
| D12 | **Descuentos y cortesías: límites por rol** | Propietario sin límite; encargado hasta un % que fijas tú (**HECHO**: cuál); cajero y camarero sin descuento libre. Toda cortesía o invitación con motivo, y aprobación proporcional al importe | Los límites exactos son tuyos; el servidor ya valida roles | A09 |
| D13 | **Devoluciones: quién puede y hasta cuánto** | Propietario y encargado; cajero solo con aprobación; límite neto = cobrado menos devuelto menos reservado | Define permisos de reembolso y su auditoría | B08, F1.3 |
| D14 | **Reabrir un cierre de caja** | Solo propietario, con motivo y auditoría | Un cierre no se reescribe: se crea una incidencia o versión nueva | C04 |
| D15 | **Diferencias de caja** | Toda diferencia exige motivo. Por encima de un umbral (**HECHO**: cuál) requiere aprobación del propietario. No se inventa un ingreso para cuadrar | Hoy el cierre acepta −11 sin tratamiento | C03, C04 |
| D16 | **Propinas, anticipos y fianzas** | Conceptos **separados** de la venta: la propina no es ingreso por ventas, el anticipo se aplica a la cuenta o se devuelve con trazabilidad, la fianza se devuelve. Revisión con tu asesoría contable | La política es del negocio; el código está preparado pero sin aplicar | B06, C11 |
| D17 | **Moneda, decimales y redondeo** | EUR, 2 decimales; redondeo «mitad hacia arriba» calculado solo en el servidor. Hay que comprobarlo contra los 12 vectores F1.5 antes de darlo por bueno | Sin parámetros aprobados los vectores no se convierten en pruebas | A03, F1.5 |
| D18 | **Reparto de céntimos** | La primera parte absorbe el céntimo (10,00 entre tres: 3,34 + 3,33 + 3,33) | Regla estable y determinista | A08 |
| D19 | **Permisos por operación** | Validar la matriz F1.3 con los roles reales; los `pendiente` de esa matriz son tuyos (por ejemplo si el cajero abre caja o cierra) | Sin ella no se endurecen los permisos | F1.3, U |
| D31 | **Precio de venta: ¿incluye el IVA?** (nueva, hallazgo de la etapa 1) | Sí: el precio de carta es con IVA incluido, como ya dice el formulario de producto («Precio de venta CON IVA»); el servidor debe partir de ese precio y obtener la base. Confírmalo con la asesoría | El servidor suma hoy el impuesto sobre el precio del catálogo, y la proyección copia el precio con IVA sin convertirlo: 3,30 € con IVA se cobraría a 3,63 €. Es una decisión antes de tocar A03 | A03, F1.1, B08, C06 |

## Nivel 3 — dependen de terceros (se lanzan ya para que no sean el cuello de botella)

| ID | Decisión | Recomendación | Por qué importa | Desbloquea |
|---|---|---|---|---|
| D20 | **Cobro con tarjeta en la primera entrega** | Datáfono independiente con confirmación **declarada** y conciliación manual (plan §23.2), más el simulador. No prometer integración hasta verificar la API de tu banco | No tienes proveedor; B07, B09 y B12 siguen bloqueados sin él | B01, B02, B11 |
| D21 | **Medios de pago** | **HECHO:** efectivo y tarjeta; di si necesitas transferencia u otros | Una ficha por medio | B01 |
| D22 | **Pagos sin conexión** | Primer alcance solo con conexión; sin conexión solo borradores locales identificados y contingencia manual | El plan lo recomienda; evita cobros ficticios | B11 |
| D23 | **Proveedor de pagos** | Mantenerlo configurable; elegirlo cuando haya presupuesto. Antes, pedir al adquirente la API, el sandbox, las comisiones y la documentación PCI | Hasta entonces B07, B09, B10 y B12 siguen bloqueados | B07–B12 |
| D24 | **Asesoría fiscal** | **HECHO:** quién es y contacto. Enviarle F1.4 (territorio, régimen, tipo de documento, series, rectificación, conservación) | No hay emisión fiscal posible sin su validación. La puerta fiscal está cerrada a propósito | C05–C08, A09 |
| D25 | **Emisor fiscal: propio o integrado** | Preferir un proveedor integrado y mantenido si cubre el alcance y el coste; no construir un motor propio por defecto | Decisión del plan §24; depende de la asesoría | C05, C07 |
| D26 | **Plazos fiscales** | La asesoría confirma qué plazo aplica a tu caso; el plan cita fechas de 2027 que hay que revalidar con fuente vigente | Fija la urgencia del bloque fiscal | C07 |

## Nivel 4 — presupuesto y promoción

| ID | Decisión | Recomendación | Por qué importa |
|---|---|---|---|
| D27 | **Tope de gasto recurrente** (alojamiento, proveedor, soporte, equipos) | **HECHO:** un tope explícito. Ninguna ampliación de plan ni contratación queda autorizada por esta hoja | Plan §24 |
| D28 | **Despliegues** | 0 durante la iteración y 1 productivo agrupado al final; incluye P1 de sincronización cuando toque | Ahorra créditos y evita desfases |
| D29 | **Promoción a producción** | Se decide más tarde, con candidato exacto, preflight y recuperación; no está autorizada ahora | QA y producción son proyectos distintos |
| D30 | **Sincronización de claves en QA** (P1 ya hecho, sin desplegar): ¿validas el plazo de 6 h y los textos del aviso? | Sí, y desplegar con el primer paquete web | Es lo único del lote anterior que espera tu visto bueno |

## Qué pasa con las respuestas

- **Nivel 1 completo** → se puede abrir la etapa 1 (catálogo y regla de día en QA)
  y planificar la etapa 2 con el tamaño correcto.
- **Nivel 2 completo** → se puede abrir F2 de dinero y stock sin rehacerlo.
- **Nivel 3** → solo requiere que pidas las respuestas a la asesoría y al banco;
  no bloquea el trabajo de QA, pero sí la aceptación de B07, B09, B10, B12 y C07.
- Lo que no contestes se queda en `PENDIENTE`: no se asume.

## Límites

- Las recomendaciones salen del plan oficial (§4.2, §23.2, §24), de las fichas
  F1 y de las matrices. No son una opinión fiscal ni contable.
- No se leyó la función del servidor que calcula impuestos y redondeo; D17 se
  confirma con los 12 vectores F1.5 y no antes.
- Los umbrales y porcentajes (D12, D15) no se proponen con cifra: son tuyos.
