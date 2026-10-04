# F5 — etapa 1: terreno de pruebas en QA (catálogo ficticio y día operativo)

Fecha: 2026-10-02
Entorno: Supabase QA `qjqorixtkilwsndqayyx` (solo QA). Producción no se tocó.
Autorización: decisión D07 de `F1_HOJA_DECISIONES_PEDRO_2026-10-02.md`
(«Acepto las recomendadas de los niveles 1 y 2»).
Código: sin cambios. Sin migraciones, sin deploy.
Estado: `SIEMBRA_APLICADA_EN_QA_VERIFICADA_EN_BACKEND_NO_VERIFICADA_EN_PANTALLA`

Esto es **terreno de pruebas provisional**: datos ficticios sembrados por SQL hasta
que exista la ruta autoritativa de `productos` (P3, no iniciada). No cierra ningún
requisito: A02, A03, A04 y A11 siguen `INCOMPLETO`.

## Qué se sembró

Marca de origen: `QA_ETAPA1_2026-10-02`. Empresa `QA-EMP-A`, locales `QA-A1` y
`QA-A2`. Scripts en `docs/plan-abc/etapa1_siembra_qa/`.

| Qué | Cuánto | Detalle |
|---|---|---|
| Catálogo TPV (`catalogo_tpv_productos`) | 30 filas (15 por local) | Artículos «(QA)»: cafés, bebidas, bollería, desayuno, bocadillos, postres y un artículo al peso (queso, 0,250 kg de precisión). Impuesto de ejemplo del 10 %. Ids `QA-CAT-A1-…` y `QA-CAT-A2-…` |
| Grupos y opciones | 6 grupos, 18 opciones, 18 enlaces | Tamaño (variante obligatoria), extras de bebida y complementos de bocadillo. 9 artículos por local con opciones |
| Stock (`stock_ubicacion`) | 30 filas | 50 en piso y 100 en almacén por artículo (el queso: 5 y 20 kg) |
| Colección `productos` (`almacen_kv`) | 1 fila, 30 elementos | Con `empresa_id` explícito. Es la lista que la pantalla de venta muestra |
| Día operativo (`abc_operating_day_reglas`) | 2 filas | `Europe/Madrid`, corte 04:00, **regla de prueba**: no es la decisión D06 del local piloto |
| Infraestructura de A1 | 1 vínculo fiscal, 1 moneda, 1 terminal, 1 caja | A1 no la tenía; A2 ya la tenía de los datos A09. Se reutiliza la entidad fiscal simulada existente |

Precios: el servidor suma el impuesto sobre `precio_unitario` (A03: bruto = cantidad ×
precio; impuesto = base × %; total = base + impuesto). Por eso el catálogo guarda el
precio **base** y la lista de la pantalla guarda `precioVenta` = base × 1,10. Los 30
elementos de la lista coinciden con su fila de catálogo y de stock (30/30/30).

## Cómo se hizo

1. Lectura de esquema, restricciones, políticas RLS, disparadores y migraciones de QA.
2. Ensayo en seco con `ROLLBACK` (dos veces; la primera sirvió para corregir mi
   verificación, no la siembra).
3. Aplicación real: un único bloque atómico con guardas de identidad (huella de
   migraciones de QA y locales QA) y de alcance (aborta si ya hay datos).
4. Verificación posterior de recuentos y de lectura con roles reales (en `ROLLBACK`).

## Resultados

Recuentos tras aplicar (todos como se esperaba; ninguna otra tabla cambió):

| Tabla | Antes | Después |
|---|---|---|
| `catalogo_tpv_productos` | 0 | 30 |
| `catalogo_tpv_grupos_opciones` / `opciones` / `producto_grupos` | 0 / 0 / 0 | 6 / 18 / 18 |
| `stock_ubicacion` | 53 | 83 |
| `almacen_kv` | 24 | 25 (clave `productos`) |
| `abc_operating_day_reglas` | 0 | 2 |
| `entidad_fiscal_locales` / `terminales_tpv` / `cajas_fisicas` | 1 / 1 / 1 | 2 / 2 / 2 |
| Sesiones, cuentas, pedidos, checkouts, caja | 1 / 2 / 2 / 0 / 0 | sin cambio |

Lectura con RLS real (usuarios de QA suplantados a nivel de base de datos):

| Usuario | Catálogo A1 / A2 | Lista `productos` |
|---|---|---|
| Propietario A+B | 15 / 15 | 30 elementos |
| Cajero/a de A1 | 15 / 0 | 30 |
| Encargado de A2 | 0 / 15 | 30 |
| Propietario solo de la empresa B | 0 / 0 | no la ve |

Circuito ABC en A1 con el catálogo sembrado (Propietario, `ROLLBACK`):

| Caso | Resultado |
|---|---|
| Abrir sesión de caja con fondo 100 en A1; abrir cuenta BARRA; crear pedido | OK. El día operativo lo asigna la regla (04:00, `Europe/Madrid`) |
| 3 aguas (sin grupos, vía simple) | base 2,70 · impuestos 0,27 · total 2,97 |
| 0,250 kg de queso (fraccionable) | base 4,50 · impuestos 0,45 · total 4,95 |
| Capuchino + Mediano + leche de avena | precio unitario 2,00 · total 2,20 |
| 2 cafés solo, tamaño Pequeño | base 2,00 · total 2,20 |
| Zumo, tamaño Grande | base 3,10 · total 3,41 |
| Negativas rechazadas | 0,2505 kg (`cantidad_precision_invalida`); 1,5 unidades (`cantidad_no_fraccionable`); artículo inexistente (`producto_tpv_no_disponible`); café por la vía simple (`configuracion_requerida`); capuchino sin tamaño (`grupo_min_selecciones_incumplido`); Propietario de otra empresa (`abc_cuenta_no_autorizada`) |

Limpieza de la verificación: tras los `ROLLBACK`, 0 filas con ids `5e300000-…`
y sesiones/cuentas/pedidos/líneas en la línea base. Las secuencias no se revierten
y no se inventariaron.

## Hallazgos (requieren decisión; ninguno se ha corregido)

1. **La proyección del catálogo PM10 no es general.** `20260928222000_pm10_bootstrap_tpv_catalogo.sql`
   solo proyecta el producto llamado `PRUEBA A10 VALIDACION` y solo para la empresa
   «Chocolateria San Gines» y el local «Chocoloyos S.L» (nombres fijos). No existe un
   camino que lleve los productos de la pantalla al catálogo TPV. Esto explica el
   catálogo vacío de QA mejor que el rechazo de `productos` por RLS (que también
   ocurre) y sugiere que en producción el catálogo TPV tampoco se llena solo (no se
   consultó producción). P3 pasa de «mejora de QA» a bloqueante general de A02.
2. **Precio con IVA frente a precio base.** El formulario de producto dice «Precio de
   venta CON IVA (€)» y PM10 copia ese `precioVenta` tal cual a `precio_unitario`,
   pero el servidor suma el impuesto encima. Un artículo de 3,30 € con IVA se
   cobraría a 3,63 €. La siembra evita el problema por construcción; el fallo de
   integración sigue. Requiere la decisión D31 de la hoja de decisiones.
3. **Dos fuentes de verdad para los artículos.** La pantalla lista desde la colección
   `productos` (solo vende lo que tiene `precioVenta` > 0, `activo` y stock de piso
   > 0) y el servidor valida cada artículo contra `catalogo_tpv_productos`. Si no
   coinciden, la línea falla con `producto_tpv_no_disponible`.
4. **Observaciones de comportamiento (no son defectos demostrados):**
   - Un Cajero/a de A1 pudo abrir una cuenta dentro de la sesión de caja abierta por
     el Propietario (quedó como responsable de la cuenta). Hay que decidir si es el
     relevo previsto (C01).
   - La fila `productos` no tiene local, así que todos los roles de la empresa
     (también el Encargado de A2) leen la lista de ambos locales.
   - El servidor exige la vía «configurada» para los artículos con grupos
     obligatorios; es el comportamiento correcto de A04.

## Seguimiento (P3, mismo día)

Los hallazgos 1 y 2 (no hay camino de `productos` al catálogo; precio con IVA frente a
base) se atendieron en `F5_P3_CATALOGO_AUTORITATIVO_2026-10-02.md`: Pedro decidió D31
(precio con IVA incluido) y autorizó P3. La siembra de este informe no se modificó: el
catálogo sembrado sigue con la semántica anterior hasta la primera sincronización real.

## Límites

- **No verificado en la pantalla.** La evidencia es de base de datos con roles
  suplantados. No se ha comprobado que la pantalla de venta muestre los 15 artículos
  ni que el flujo funcione desde el navegador.
- El navegador de Pedro tiene `productos` en la cola local («Subiendo»), y esa
  versión del preview lee de local antes que de la nube. Para ver los artículos
  sembrados hace falta un perfil limpio (ventana privada) o limpiar esa clave local.
- La regla de día operativo (04:00) es de prueba: **D06 sigue abierta** para el local
  piloto.
- La reversión (`03_reversion.sql`) **no se ha ejecutado**, ni siquiera en
  `ROLLBACK` (la prueba con borrado fue cancelada). Lo que sí se comprobó, con
  `select`, es que cada criterio de borrado atrapa exactamente las filas sembradas
  (18/18, 18/18, 6/6, 30/30, 30 de 83, 1 de 25, 2/2, 1 de 2, 1 de 2, 2 de 4) y ninguna
  otra.
- Los precios y artículos son inventados; no representan ningún negocio real.

## Reversión

`docs/plan-abc/etapa1_siembra_qa/03_reversion.sql`: atómico, aborta si hay líneas de
pedido o movimientos de stock sobre los artículos sembrados (o por clave foránea si
hay sesiones sobre la terminal o caja sembradas). Deja QA en la línea base: catálogo 0,
stock 53, `almacen_kv` 24 sin `productos`, reglas 0, vínculos/terminales/cajas 1/1/1.

## Qué NO se hizo

Ruta autoritativa de `productos` (P3), historial de respaldos (P2), cambios de código,
migraciones, deploy, producción, ni cobro, devolución ni cierre con el catálogo
nuevo.

## Cómo comprobarlo en pantalla (opcional, lo hace Pedro)

1. Abre una ventana privada y entra en el preview de QA con tu usuario.
2. Elige «Local A1» y abre el TPV.
3. Deberías ver 15 artículos «(QA)» (cafés, bebidas, bollería, bocadillos…).
4. Añade «Café solo (QA)»: debe pedirte el tamaño. Un precio mostrado de 1,10 € por
   unidad es lo esperado (1,00 base + 10 %).
5. Cuéntame qué ves, incluidos los avisos de guardado. No hace falta cobrar.
