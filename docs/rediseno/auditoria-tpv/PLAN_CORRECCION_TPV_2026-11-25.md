# Plan de corrección · TPV · 25/11/2026

Base: `HALLAZGOS_TPV_2026-11-25.md` y `MATRIZ_CASOS_TPV_2026-11-25.csv`, SHA `aa809c3a`.
Este plan **no** está implementado. Ningún punto cambia permisos ni migraciones sin una
decisión explícita.

## Orden recomendado

El orden combina impacto y dependencia: primero lo que falta para poder **verificar**
(sin eso cualquier corrección del flujo de cobro se haría a ciegas), después lo que afecta
al cobro diario y, por último, la comodidad.

| Paso | Qué | Hallazgos | Tipo | Depende de |
|---|---|---|---|---|
| 0 | Desbloquear la verificación: lectura del servidor (**hecho**) y sesión QA (pendiente) | — | Acceso | Autorización (§ Lotes) |
| 1 | Acción principal del modo caja visible y sin solapes | H-01, H-02 | a | — |
| 2 | Capas como diálogos y escaneo bloqueado con capa abierta | H-03 | b | — |
| 3 | Cerrar la escritura directa de encargos | H-04 (confirmado) | c, d | — |
| 4 | Recorridos de escritura autorizados (lote L1) | F-01…F-20, C-04, C-05 | b | Pasos 0-2 |
| 5 | Decisiones de producto | H-07, H-15, H-05, H-12, H-09 | e | — |
| 6 | Accesibilidad y comodidad del modo caja | H-08, H-09, H-10, H-11, H-12, H-13 | a | Paso 5 en lo que dependa de decisión |
| 6b | Nombres de producto en el TPV normal | H-16 | a | — |
| 6c | Segundo factor solo para Propietario y alineación de migraciones | H-17 | c, d | Decisión E6 tomada · autorización para cambiar QA |
| 7 | Funciones de QA sin migración y privilegios sobrantes | H-06, H-18 | c | — |
| 8 | Hallazgos del lote L1: pendientes del modo local, arqueo diario, venta rápida a medias, tarjeta simulada, cierre | H-19 a H-28 | a, b, c | Pasos 0-2 |

## a) Visual y organización

**A1 · Acción principal del modo caja (H-01).**
Subir la especificidad de `.tpv-caja-cobrar` y de `.tpv-side > .la-ui-button` en modo
caja de Órbita (misma técnica que `aa809c3a` aplicó a las tarjetas).
*Aceptación:* a 1440, 1024, 390 y 320 px, el estilo **calculado en el navegador** de
«Cobrar» (ticket vacío) y de «Guardar pedido» (con líneas) es fondo `#FF4B32`, alto ≥ 56 px
en móvil y ≥ 64 px en ordenador, y es la única acción con ese fondo en la banda. El
contrato comprueba el estilo calculado, no solo el texto del CSS.

**A2 · Indicador de sincronización (H-02).**
*Aceptación:* en modo caja ningún elemento `position: fixed` se solapa con `.tpv-side` en
los cuatro tamaños (medido con `getBoundingClientRect`).

**A3 · Contraste (H-08).** *Aceptación:* todos los textos del modo caja ≥ 4,5:1 (≥ 3:1 si
son texto grande), medido en los cuatro tamaños.

**A4 · Categorías paginadas (H-09).** *Aceptación:* sin barra de desplazamiento en la fila
de categorías; acceso a todas con controles de 44×44 px.

**A5 · Accesos de la cabecera en móvil (H-10).** *Aceptación:* a 390 y 320 px, «Salir del
modo caja» y «Terminal» se alcanzan sin desplazamiento oculto (visibles o en un «Más»
visible).

**A6 · Densidad a 320 px (H-11).** *Aceptación:* a 320×640, al menos 4 productos por página
sin recortes.

**A7 · Tema dentro del modo caja (H-13).** Sacarlo o usar el icono del sistema.

**A8 · Nombres de producto en el TPV normal (H-16).** Columnas calculadas con el ancho real
de la zona de productos, con la paginación coherente con ese cálculo, y nombre cortado en
dos líneas. *Aceptación:* ningún nombre sobrepasa su tarjeta a 1440, 1024 y 390 px.

## b) Funcional

**B1 · Capas accesibles y escaneo protegido (H-03).**
*Aceptación:* al abrir una capa, el foco entra en ella (primero «Volver al pedido»), queda
atrapado y vuelve al botón de origen al cerrar; la capa tiene `role="dialog"`,
`aria-modal="true"` y nombre; con una capa abierta, simular un escaneo (texto + Intro) **no**
cambia el ticket. Prueba automatizada con jsdom para el escaneo y medición en vivo para el
foco.

**B2 · Recorridos de escritura (lote L1).** Ejecutar solo tras autorización. *Aceptación:*
cada caso de la matriz pasa de BLOQUEADO / NO PROBADO a PASS o FAIL con evidencia en vivo
y consulta de servidor, y los datos sintéticos quedan cerrados o revertidos según el lote.

**B3 · Anticipos (H-05).** Tras la decisión E3: interfaz de devolución de anticipo sobre
`abc_registrar_movimiento_anticipo`. *Aceptación:* devolver un anticipo genera un único
movimiento y no se puede contabilizar dos veces (prueba con dos reintentos).

## c) Servidor y datos

**C1 · Consultas de verificación — HECHO el 25/11** (lote L0 autorizado, dos notebooks de
solo lectura en QA; `evidencias/servidor-qa-2026-11-25.md`). Confirmó S-01, S-02, S-03 y
S-05; confirmó H-04 y amplió H-06; descartó H-14; reescribió H-17 y abrió H-18.

**C2 · Encargos (H-04, confirmado en servidor).** Funciones de servidor para crear, editar y
cambiar el estado de encargos con validación; revocar a `authenticated` la escritura
directa y dejar solo la política `SELECT`. *Aceptación:* un `insert` o `update` directo con
la clave pública y un usuario del local falla; las funciones validan importes, estados y
fechas, y la prueba PostgreSQL lo cubre.

**C3 · Funciones de QA sin migración (H-06).** Volcar al repositorio las 14 funciones
(migraciones marcadas como solo QA o `docs/` con su SQL); leer y revisar las guardas internas
de los simuladores de cobro y cierre. *Aceptación:* el contrato
`lo-que-el-cliente-llama-existe-en-migraciones` deja de necesitar excepciones y un contrato
nuevo impide que las funciones `abc_qa_*` y de simulación existan fuera de QA.

**C4 · Alinear QA con el repositorio (H-17).** Aplicar por el procedimiento de migraciones
lo que falta en QA (o retirarlo del repositorio, según la decisión E6) y registrar en el
historial lo aplicado fuera de él. *Aceptación:* cada archivo de `supabase/migrations`
tiene su entrada en `supabase_migrations.schema_migrations` de QA, comprobado con una
consulta.

**C5 · Privilegios sobrantes (H-18).** Revocar `INSERT`, `UPDATE` y `DELETE` de
`authenticated` sobre `pagos_encargo`. *Aceptación:* `has_table_privilege` devuelve falso.

## d) Permisos

**D1 · Matriz por rol en vivo.** Con una cuenta por rol (Propietario, Encargado,
Cajero/a, Camarero/a): consulta, edición, cocina, cobro, descuento, reembolso, caja y
configuración, comprobando el **rechazo del servidor**, no solo el botón oculto.
*Aceptación:* matriz completa con evidencia de servidor por celda.

**D2 · Encargos (H-04)** — ver C2.

**D3 · Segundo factor (H-17, decisión E6: solo Propietario) — APLICADO EN QA el 25/11.**
Política con Propietario obligatorio en las 12 empresas y migración aplicada
(`20261125201328 mfa_politica_opcional`); simulación por cargo correcta. Quedan: (a) la
prueba en vivo con inicio de sesión de cada cargo; (b) que el alta de empresa cree la fila
de Propietario obligatorio (hoy una empresa nueva queda sin exigencia hasta que su
Propietario la active). Pasos originales, para otros entornos:

1. aplicar en QA `20261115120000_mfa_politica_opcional` por el procedimiento de migraciones;
2. con el Propietario, `mfa_politica_guardar('Propietario', true)` en la empresa de QA (y
   en cada empresa, como parte del alta);
3. revisar que la pantalla de configuración permita al Propietario ver y cambiar esa
   política.

*Aceptación:* en vivo, un Cajero/a y un Encargado sin segundo factor trabajan y cobran; un
Propietario sin segundo factor es rechazado por el servidor en las operaciones protegidas;
el contrato de la política de segundo factor lo cubre.

## f) Correcciones nuevas del lote L1 (propuestas, sin implementar)

- **F1 · H-19 (P1).** Asociar los pendientes del modo local a empresa y usuario, no subirlos
  a otra empresa. *Aceptación:* iniciar sesión tras trabajar en modo local no escribe en el
  servidor sin confirmación; prueba automatizada con dos empresas.
- **F2 · H-24 (P1).** El arqueo diario usa el esperado del servidor. *Aceptación:* con la
  misma sesión, «Arqueo de caja» y el cierre de la sesión muestran el mismo esperado.
- **F3 · H-20 y H-21.** «Cobrar ahora» cancela o permite cancelar la cuenta si falla el
  envío; cancelar el último pedido cierra la cuenta sin pagos. *Aceptación:* tras un envío
  rechazado se puede iniciar otra venta rápida; la cuenta queda CERRADA.
- **F4 · H-22.** Mostrar el cobro de la cuenta enviada. *Aceptación:* tras «Enviar pedido» en
  venta rápida aparece el cobro sin retomar la cuenta.
- **F5 · H-27 y H-23.** Camino de interfaz para resolver tarjeta y reembolso de tarjeta en
  QA; repetir la venta mixta por ese camino. *Aceptación:* cobro y reembolso con tarjeta
  simulada completos sin consola y documento fiscal emitido.
- **F6 · H-25, H-26 y H-28.** Cierre de caja en Caja y fiscalidad, bloqueos con texto claro
  y una acción para las cuentas abiertas de días cerrados.
- **F11 · H-44 a H-47 (lote L5).** «Reintentar aplicación» con los datos de la autorización, guardar
  solo las políticas modificadas, ligar la copia local al usuario y un botón «Deshacer reparto».
  *Aceptación:* el reintento aplica sin tocar el formulario; el historial de políticas solo
  muestra las que cambian; cambiar de sesión no bloquea el arranque.
- **F10 · H-42 y H-43 (lote L4).** Permitir retomar o cerrar una cuenta sin pedidos activos y
  mostrar en el descuento las líneas recibidas por unión o reparto. *Aceptación:* una cuenta con el
  pedido cancelado se retoma o se cierra; tras unir o repartir, el descuento ofrece la línea
  recibida.
- **F8 · H-38 (P1, lote L3) — urgente.** Emitir el documento fiscal en el servidor con el
  permiso de cobro, no con el de leer la configuración. *Aceptación:* un cobro del Cajero/a
  emite su documento igual que el del Propietario; un cobro sin documento queda como efecto
  pendiente que bloquea el cierre y el ensayo C12 cuenta las ventas sin documento.
- **F9 · H-37, H-39, H-40 y H-41 (lote L3).** La venta rápida no encadena pasos de preparación
  para quien no los tiene; decidir qué significa «máximo 0 %» en la política de descuentos;
  ligar el borrador del carrito al usuario; mensaje claro para el Camarero/a. *Aceptación:*
  «Cobrar ahora» funciona con la cuenta de Cajero/a de principio a fin; el Encargado puede
  solicitar un descuento que escala; un usuario no ve el carrito de otro.
- **F7 · H-29 a H-32 (lote L2).** Crear cuenta y pedido en una sola operación del servidor,
  recordar la pantalla y la cuenta tras recargar, caducar los pendientes de cobro resueltos y
  mostrar «Sin conexión, no se ha cambiado nada» en lugar del error técnico. *Aceptación:*
  recargar a mitad de «Guardar» no deja cuenta sin pedido; sin red aparece un mensaje claro en
  menos de 8 s; ningún pendiente de cobro sobrevive a su cancelación en el servidor.

## e) Decisiones de producto pendientes

- **E1 · Referencia del modo caja (H-07).** Confirmar la propuesta 1 «doble banda» como
  referencia (y reflejarla en la maqueta y en las equivalencias) o volver a la composición
  de la maqueta Órbita.
- **E2 · Stock insuficiente (H-15).** Permitir con aviso, exigir autorización o bloquear.
- **E3 · Devolución de anticipos (H-05).** Flujo y permisos.
- **E4 · Acción principal con el ticket vacío (H-12).** Ninguna destacada o la del estado
  real de la cuenta.
- **E5 · Categorías (H-09).** Paginación frente a desplazamiento en la fila.
- **E6 · Segundo factor (H-17) — DECIDIDO por el usuario el 25/11:** obligatorio **solo para
  Propietario**. Encargado, Cajero/a y Camarero/a sin segundo factor (el personal entra con
  su PIN de empleado). Riesgo aceptado: el Encargado puede aprobar reembolsos y descuentos
  sin segundo factor; el Propietario puede exigírselo más adelante sin cambiar código.

## Lotes que necesitan autorización

**L0 · Lectura del servidor — AUTORIZADO Y EJECUTADO el 25/11.** Dos notebooks de solo
lectura en QA (`d74a43f4-…` y `932cd704-…`); sin cambios de datos.

**L1 · Escrituras sintéticas en QA — AUTORIZADO Y EJECUTADO el 25/11** (con cambios sobre
el texto de abajo: producto agua, caja abierta y cerrada, 3 reembolsos; dos terminales: lo
hizo el usuario y dice que está bien, sin registro). Resultado y cifras en `evidencias/lote-L1-ejecucion-2026-11-25.md`. Texto
original de la propuesta:

- **Actor y lugar:** Propietario `pm07.smoke@qa.invalid` en QA-EMP-A / QA-A1, terminal
  `QA terminal A1`; para concurrencia, una segunda sesión en `QA terminal A2`.
- **Datos:** producto `QA Aceite ensayo 20261115`, en la sesión de caja ya abierta, sin abrir
  ni cerrar caja.
- **Casos:**
  1. Venta rápida de 1,00 € → Guardar (F9) → cobro en efectivo exacto → ticket QA.
  2. Pago mixto de 1,00 € (0,50 tarjeta simulada y 0,50 efectivo).
  3. Doble clic en Guardar y en Confirmar cobro, comprobando un único pedido y un único
     pago.
  4. A1 y A2 cambian la cantidad de la misma cuenta: se espera rechazo por versión
     obsoleta.
  5. Reembolso B08 de las ventas 1 y 2.
- **Impacto:** 2 ventas sintéticas de 1,00 €, 2 reembolsos, 4 movimientos de caja con saldo
  neto 0,00 € y 2 unidades de stock que se consumen y no vuelven, porque el B08 no devuelve
  stock. Hay que decidir si se reponen con un ajuste.
- **Cómo queda:** cuentas pagadas y cerradas, ventas reembolsadas visibles en el historial
  y documentos QA del simulador.
- **Excluido:** sin cambios de configuración ni de permisos, sin `sis-13` y sin producción.
