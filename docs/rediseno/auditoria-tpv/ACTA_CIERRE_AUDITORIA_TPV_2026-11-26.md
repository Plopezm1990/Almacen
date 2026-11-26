# Acta de cierre · Auditoría integral del TPV · 26/11/2026

## 1. Veredicto

La auditoría del TPV de L&A Suite en Órbita **queda cerrada el 26/11/2026**. Se ejecutaron
115 casos y se documentaron 47 entradas de hallazgos. **El TPV cobra, reembolsa, cierra la
caja y no duplica nada ante dobles clics, recargas o fallos de red.** Pero **no está listo para
uso real con el cargo de Cajero/a**: sus cobros se cierran sin documento fiscal y el cierre de
caja no lo detecta (**H-38, P1**). Hay otros dos P1: los pendientes del modo local pueden subirse
a otra empresa (**H-19**) y el arqueo diario muestra un esperado distinto del que calcula el
servidor (**H-24**).

**La auditoría no corrige nada.** Solo hay cambios en documentos. Las correcciones están
ordenadas en `ORDEN_DE_CORRECCIONES_Y_DECISIONES_2026-11-26.md` y siguen sin implementar.

## 2. Alcance y condiciones

| Dato | Valor |
|---|---|
| Periodo | 25 y 26 de noviembre de 2026 |
| Rama y PR | `rediseno/f0-base-qa`, PR #225 **en borrador y sin fusionar** |
| Código auditado | SHA `aa809c3a` (el código no cambió durante la auditoría) |
| Entorno | Deploy Preview #225 apuntando a QA `qjqorixtkilwsndqayyx` |
| Producción | **No se tocó** (`flqercbgpgmmfaakrwkc`) |
| `sis-13` | No se usó |
| Local y empresa de las pruebas | QA-EMP-A / QA-A1, terminal A1 (el terminal A2 solo en lectura) |

**Qué se auditó:** inventario del TPV, aspecto y organización del modo caja a cuatro tamaños
(1440×900, 1024×768, 390×844 y 320 px), recorridos de venta, cobro, reembolso, cuentas,
descuentos, caja y cierre, concurrencia y recuperación tras recarga o red, permisos por cargo con
sesiones reales, seguridad del servidor (RLS, privilegios, funciones, segundo factor) y datos y
documentos fiscales.

## 3. Resultado en cifras

### Casos (`MATRIZ_CASOS_TPV_2026-11-25.csv`, 115 casos)

| Resultado | Casos |
|---|---|
| PASS (incluidos los de documento previo y los deducidos del código, con sus reservas) | 78 |
| FAIL (incluidos los parciales) | 34 |
| NO PROBADO | 1 (C-04, dos terminales: **lo hizo el usuario**, sin registro) |
| BLOQUEADO | 0 |
| NO CONCLUYENTE | 1 (L-08, venta mixta con documento fiscal) |
| NO APLICA | 1 |

### Hallazgos (`HALLAZGOS_TPV_2026-11-25.md`, 47 entradas)

| Gravedad | Entradas |
|---|---|
| P1 (pérdida de datos, cobro sin documento o aislamiento roto) | 3 |
| P2 (fricción o error importante con alternativa) | 16 |
| P3 (mejora o comodidad) | 26 |
| Decisión de producto | 1 (H-15) |
| Descartado | 1 (H-14) |

**Ningún P0.** Los tres P1 son H-19, H-24 y H-38.

## 4. Hallazgos por gravedad

| ID | Gravedad | Título |
|---|---|---|
| H-19 | P1 | Los pendientes del modo local se suben a la primera empresa con sesión |
| H-24 | P1 | «Arqueo de caja» mostraba un esperado distinto del servidor |
| H-38 | P1 | Un cobro del Cajero/a se cierra sin documento fiscal y el cierre no lo detecta |
| H-01 | P2 | «Cobrar» del modo caja sin estilo de acción principal |
| H-02 | P2 | El aviso de sincronización tapa «Cobrar» en modo caja |
| H-03 | P2 | Las capas no son diálogos: el foco se queda en el buscador F2 oculto |
| H-04 | P2 | Encargos editables por tabla, sin pasar por funciones de servidor |
| H-05 | P2 | Revertir anticipo sin interfaz; la función de servidor existe y no se usa |
| H-06 | P2 | 14 funciones de QA sin migración, incluidos simuladores de cobro |
| H-07 | P2 | El modo caja implantado no coincide con la maqueta Órbita aprobada — **decidido el 26/11: referencia oficial «doble banda»; falta actualizar la maqueta** |
| H-16 | P2 | TPV normal: los nombres de producto se salen de su tarjeta |
| H-17 | P2 | QA no tiene las mismas migraciones que el repositorio (segundo factor) — segundo factor **corregido en QA** el 25/11 |
| H-20 | P2 | 21 de 22 productos de QA-A1 no se pueden enviar: sin ruta a cocina |
| H-21 | P2 | Cancelar el pedido deja la cuenta comercial abierta |
| H-22 | P2 | En venta rápida, tras guardar y enviar no aparece el cobro |
| H-23 | P2 | La venta mixta no emitió documento fiscal (causa por confirmar) |
| H-27 | P2 | Ni el cobro ni el reembolso con tarjeta simulada se completan desde la aplicación |
| H-37 | P2 | «Cobrar ahora» falla a medias con la cuenta de Cajero/a |
| H-39 | P2 | La política de descuento del Encargado no se puede usar |
| H-08 | P3 | Contraste insuficiente en la categoría activa |
| H-09 | P3 | Categorías con desplazamiento horizontal en lugar de paginación |
| H-10 | P3 | En móvil, «Terminal» y «Salir del modo caja» quedan fuera de la vista |
| H-11 | P3 | A 320 × 640 solo caben 2 productos por página |
| H-12 | P3 | «Cobrar» aparece como acción principal con el ticket vacío |
| H-13 | P3 | Botón de tema con emoji dentro del modo caja |
| H-18 | P3 | `pagos_encargo` con privilegios de escritura innecesarios |
| H-25 | P3 | El cierre de la sesión de caja está escondido |
| H-26 | P3 | Los bloqueos del cierre se muestran con texto genérico |
| H-28 | P3 | 85 cuentas abiertas en el local, 83 de días cerrados |
| H-29 | P3 | Una recarga a mitad de «Guardar pedido» deja una cuenta sin pedido |
| H-30 | P3 | Tras recargar hay que volver a abrir las operaciones de cuenta |
| H-31 | P3 | Un pendiente de cobro antiguo sigue en el navegador |
| H-32 | P3 | Sin red, el error se muestra crudo y tarda |
| H-33 | P3 | El código lleva fijas direcciones de producción |
| H-34 | P3 | «Anular venta» aparece habilitado para quien no tiene permiso |
| H-35 | P3 | El historial no refleja los reembolsos económicos |
| H-36 | P3 | Las cuentas creadas por la aplicación no obligan a cambiar la contraseña inicial |
| H-40 | P3 | El borrador del carrito no pertenece a un usuario |
| H-41 | P3 | El Camarero/a no ve las cuentas abiertas y el aviso habla de la caja |
| H-42 | P3 | Las cuentas con el pedido cancelado no se pueden retomar y se acumulan |
| H-43 | P3 | El descuento no encuentra líneas aptas en una cuenta con un producto recibido por reparto (por confirmar) |
| H-44 | P3 | «Reintentar aplicación» falla con `operation_id_conflict` si el formulario está vacío |
| H-45 | P3 | Guardar políticas reescribe también las que no cambian |
| H-46 | P3 | Arranque bloqueado tras cambiar de sesión con pendientes locales |
| H-47 | P3 | No hay botón para deshacer un reparto |
| H-15 | Decisión | Venta con stock insuficiente: el cliente solo avisa |
| H-14 | Descartado | `movimientos_registro`: RLS activado (comprobado en servidor) |

## 5. Lo que funciona, con evidencia de la auditoría

- **Cobro en efectivo y mixto** (efectivo con tarjeta simulada): importes correctos en servidor.
- **Doble clic** en «Guardar pedido» y en «Cobrar efectivo»: una cuenta, un pedido, un pago y una
  entrada de caja.
- **Recarga y red:** recargar a mitad de guardar o de cobrar no duplica; un cobro interrumpido se
  recupera con «Recuperar/reintentar mismo intento»; sin red nada cambia y el reintento no duplica.
- **Reembolso en efectivo (B08):** un único movimiento negativo de caja.
- **Caja:** apertura y cierre con esperado igual a contado en las cinco sesiones de la auditoría.
- **Cuentas:** aparcar, recuperar, unir (con las reglas del servidor), repartir un producto y
  devolverlo; el descuento viaja con la línea.
- **Descuentos:** el del Propietario se aplica con importes correctos; el escalado Encargado →
  Propietario → Encargado funciona con una política que lo permita.
- **Permisos por cargo con sesiones reales:** Encargado, Cajero/a y Camarero/a entran sin segundo
  factor; el servidor rechaza lo que su cargo no puede; no hay escritura directa en las tablas
  de cobro; no ven otros locales ni otras empresas.
- **Segundo factor:** obligatorio solo para el Propietario (decisión E6), probado en servidor y en vivo.
- **Producción protegida:** las llamadas a producción que lleva el código están contenidas por la
  política de seguridad del navegador y por una barrera que se prueba en CI (no se probó en vivo).

## 6. Lo que se hizo en QA

Todo con autorización expresa del usuario, lote a lote.

| Lote | Qué | Evidencia |
|---|---|---|
| L0 | Lectura del servidor con notebooks de solo lectura | `evidencias/servidor-qa-2026-11-25.md` |
| L1 | Ventas en efectivo y mixta, dobles clics, tres reembolsos, cierre de caja | `evidencias/lote-L1-ejecucion-2026-11-25.md` |
| L2 | Recarga y desconexión tras escribir | `evidencias/lote-L2-recarga-desconexion-2026-11-25.md` |
| Roles | Tres cuentas de prueba y matriz de permisos | `evidencias/matriz-por-rol-2026-11-26.md` |
| L3 | Cuentas, descuentos y cobro por cargo | `evidencias/lote-L3-roles-cuentas-descuentos-2026-11-26.md` |
| L4 | Unir cuentas y repartir como Propietario | `evidencias/lote-L4-unir-repartir-propietario-2026-11-26.md` |
| L5 | Descuento aplicado, reparto y escalado con política temporal | `evidencias/lote-L5-descuentos-reparto-politica-2026-11-26.md` |

### Cambios de configuración y de servidor

- **Segundo factor solo para Propietario** (decisión del usuario): `private.mfa_politica` con 12
  filas y la migración `mfa_politica_opcional` aplicada sin cambios (`20261125201328`).
  **Esto sigue aplicado y es el estado deseado.**
- **Política de descuentos del Encargado:** cambiada dos veces (máximo 5 %, después «Puede
  aplicar») y **restaurada** al original (máximo 0 %, aplicar no); comprobado en el servidor.

### Cuentas de prueba creadas (4)

`qa-aud-encargado-20261125@qa.invalid`, `qa-aud-cajero-20261125@qa.invalid`,
`qa-aud-camarero-20261125@qa.invalid` y `qa-aud-encargado2-20261126@qa.invalid`, con su empleado
en QA-A1. **Ninguna contraseña se guardó en ningún documento ni archivo**; se generaron al azar en
la página y se borraron de la memoria al terminar.

### Datos operativos que quedan en QA (QA-EMP-A / QA-A1)

| Dato | Antes de la auditoría (25/11 20:40 UTC) | Final (26/11 10:32 UTC) |
|---|---|---|
| Pagos | 77 | 82 |
| Checkouts | 68 | 72 |
| Pedidos | 118 | 130 |
| Ventas fiscales | 68 | 72 |
| Documentos fiscales QA nuevos | — | 2 (TPV-44 y TPV-45) |
| Reembolsos | 6 | 11 |
| Movimientos de caja | 78 | 86 (neto de la auditoría: 0,00 €) |
| Descuentos aplicados / autorizaciones | 6 / 3 | 8 / 4 |
| Stock del agua (almacén / piso) | 73 / 0 | 66 / 0 |
| Stock del refresco | 100 / 50 | 100 / 50 (sin cambios) |

Las cinco sesiones de caja de la auditoría están en **CERRADA_FINAL**. La sesión de caja abierta
de QA-A2 del 21/11 es anterior y no se tocó.

## 7. Incidentes y errores propios

Se documentan porque afectan a cómo leer la evidencia:

1. **Pendientes del modo local subidos a QA-EMP-A (H-19).** Al iniciar sesión sin vaciar antes el
   estado local, se subieron `productos` (sin efecto, protegido por la función) y
   `historialRespaldos` (reescrito con el mismo contenido). Se vaciaron las dos claves con
   autorización del usuario.
2. **Una afirmación mía sobre «Cobrar» (H-01) se hizo sin comprobar el estilo calculado.**
   Se corrigió y quedó documentada.
3. **Commit parcial de la documentación del lote L2:** un script falló y la cadena no se detuvo;
   se completó en el commit siguiente. Sin consecuencias en los datos.
4. **El envío de un pedido a cocina lo frenó el sistema de permisos** porque no estaba en el lote
   autorizado; se pidió autorización y se hizo después.
5. **La sesión del Propietario caducó varias veces** y se repitió el inicio de sesión con el
   código que el usuario escribió en cada ocasión.
6. **Por el borrado de contraseñas de prueba**, al final se creó una cuenta de Encargado nueva
   para completar el escalado de descuentos.

## 8. Lo que no se probó, y por qué

| Pendiente | Motivo |
|---|---|
| L-08, venta mixta con documento fiscal | La tarjeta simulada no se puede resolver desde la interfaz (H-27); la vía que existe es una función de QA llamada desde la consola, que quedó fuera |
| Corte de red real | Solo se puede simular desde la página; se simuló con `fetch` y `setTimeout` |
| Cuadro de impresión real y PDF | Se comprobó que el botón llama a imprimir y que la regla de impresión existe; no se abrió el cuadro del sistema |
| Dos terminales (C-04) | Lo hizo el usuario con su Chrome y dice que está bien; no hay captura ni registro |
| Descuento sobre una línea recibida por reparto (H-43) | Sin más stock autorizado |
| El Propietario en la matriz por rol | Solo por servidor y menú; en vivo solo para descuentos, caja, cuentas y políticas |

## 9. Decisiones

**Tomadas durante la auditoría:**

- **E6 (25/11):** segundo factor obligatorio solo para Propietario. Aplicado y verificado.
- **E1 (26/11):** referencia oficial del modo caja = «doble banda»
  (`../REFERENCIA_MODO_CAJA_DOBLE_BANDA_2026-11-26.md`). Falta actualizar la maqueta Órbita.

**Pendientes, con mi recomendación en `ORDEN_DE_CORRECCIONES_Y_DECISIONES_2026-11-26.md`:**
E2 stock insuficiente (permitir con aviso), E3 devolución de anticipos (pantalla solo para
Encargado y Propietario), E4 acción principal con el ticket vacío (ninguna) y E5 categorías
(paginación con flechas).

## 10. Estado del repositorio

- **El código no cambió.** Solo se tocó `docs/rediseno/`.
- La batería de pruebas sin base de datos pasó 336/336 y el PR #225 tenía 39 comprobaciones
  correctas sobre `aa809c3a`; **no se repitieron tras los commits de documentos** (no hay
  código nuevo).
- **Commits de la auditoría (todos subidos):** `b3a44f81`, `72938812`, `67dabbf6`, `3e4140a4`,
  `146a8159`, `a632db19`, `5e0b7f27`, `4e5fe6d1`, `784ca4b7`, `4dc5a65e`, `cce6c7e3` y el de
  esta acta.

## 11. Limpieza recomendada en QA (no hecha)

La auditoría dejó cosas que conviene limpiar **cuando el usuario lo decida**:

1. Desactivar las **4 cuentas de prueba** desde Equipo.
2. Cerrar las **cuentas abiertas** que dejaron las pruebas (hoy hay 89 abiertas en QA-A1; la gran
   mayoría son anteriores a la auditoría; ver H-28).
3. Reponer el **stock del agua** de QA-A1 (73 → 66 en la auditoría).
4. Borrar los **notebooks de solo lectura** creados en el proyecto QA para consultar el servidor.
5. Cerrar la **sesión del Propietario** que sigue abierta en el navegador de la auditoría.
6. Vaciar los **pendientes locales de `productos`** del navegador de la auditoría.

## 12. Condiciones de cierre

La auditoría se da por cerrada porque se cumple lo siguiente:

- [x] Todos los casos de la matriz tienen resultado, salvo uno declarado por el usuario (C-04)
      y uno no concluyente (L-08, por falta de camino en la interfaz).
- [x] Cada FAIL tiene hallazgo y evidencia (comprobado en la matriz). Todos los P1 y P2 tienen su
      corrección con criterio de aceptación en el plan; **ocho P3 (H-30, H-31, H-33, H-34, H-35,
      H-36, H-45 y H-46)** solo tienen la recomendación del propio hallazgo y su ola en el orden
      de correcciones.
- [x] Cada escritura en QA tuvo autorización expresa y quedó documentada con cifras antes y
      después.
- [x] La configuración temporal se restauró y se comprobó en el servidor.
- [x] No hay contraseñas, códigos ni claves en los documentos (comprobado con una búsqueda).
- [x] Producción y `sis-13` no se tocaron.
- [x] Las correcciones están ordenadas, con la recomendación del auditor para las cuatro
      decisiones de producto.

## 13. Índice de documentos

| Documento | Para qué sirve |
|---|---|
| `ACTA_CIERRE_AUDITORIA_TPV_2026-11-26.md` | Esta acta |
| `INFORME_AUDITORIA_TPV_2026-11-25.md` | Informe completo: método, límites, resultados, comparación con la maqueta |
| `HALLAZGOS_TPV_2026-11-25.md` | Los 47 hallazgos con evidencia, impacto y recomendación |
| `MATRIZ_CASOS_TPV_2026-11-25.csv` | Los 115 casos con resultado y evidencia (`;`, UTF-8 con BOM) |
| `PLAN_CORRECCION_TPV_2026-11-25.md` | Cada corrección con su criterio de aceptación |
| `ORDEN_DE_CORRECCIONES_Y_DECISIONES_2026-11-26.md` | Orden por olas y recomendación para las cuatro decisiones |
| `TRASPASO_AUDITORIA_TPV_2026-11-25.md` | Dónde está todo y cómo retomar |
| `../REFERENCIA_MODO_CAJA_DOBLE_BANDA_2026-11-26.md` | Referencia oficial del modo caja, con imágenes en `../referencias/` |
| `evidencias/` | Servidor, lotes L1 a L5, matriz por rol, capturas, mediciones, CI y batería |
