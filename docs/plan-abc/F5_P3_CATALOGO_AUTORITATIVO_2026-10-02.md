# F5 — P3: ruta autoritativa del catálogo del TPV y precio con IVA incluido (D31)

Fecha: 2026-10-02
Entorno: Supabase QA `qjqorixtkilwsndqayyx` (solo QA). Producción no se tocó. Sin deploy.
Autorización: «Autorizo P3 y D31 con IVA incluido» (Pedro, 2/10/2026).
Código base: `a5a4321` + documentación de esta rama.
Estado: `MIGRACION_APLICADA_EN_QA_VERIFICADA_EN_BACKEND_PUENTE_DE_PANTALLA_PROBADO_EN_LOCAL_SIN_DEPLOY_NO_VERIFICADO_EN_NAVEGADOR`

No cierra ningún requisito: A02, A03 y A04 siguen `INCOMPLETO` (falta verlo en pantalla).

## Qué problema resuelve

1. **No existía camino de los productos de la pantalla al catálogo del TPV.** La pantalla
   guarda los productos en la colección `productos` y el servidor vende contra
   `catalogo_tpv_productos`. La migración PM10 solo copiaba un producto de prueba de un
   negocio con nombre fijo. En QA, además, la política PM05 de `almacen_kv` rechaza las
   listas.
2. **El precio con IVA no cuadraba.** El formulario pide «Precio de venta CON IVA» y el
   servidor sumaba el IVA encima (3,30 € se cobraría a 3,63 €). Decisión D31: el precio de
   carta lleva el IVA incluido.

## Qué se hizo

### Base de datos (migración `20261002150000_abc_p3_catalogo_autoritativo`)

Aditiva. Aplicada en QA; no aplicada en producción.

| Pieza | Qué hace |
|---|---|
| Columna `catalogo_tpv_productos.precio_con_impuesto` (nullable) | `NULL`: comportamiento anterior, sin cambio. Con valor: precio de carta con IVA incluido |
| Restricción `abc_catalogo_precio_con_impuesto` | El precio base debe coincidir con `precio_con_impuesto / (1 + IVA)` (tolerancia 1e-8) |
| `abc_calcular_linea_tpv` y `…_configurada` (A03/A04) | Con precio con IVA, el **total sale exacto** de cantidad × precio; base e impuesto se derivan del total y suman exactamente el total. Con `NULL` la fórmula es literalmente la anterior |
| `abc_catalogo_guardar_productos` (RPC) | Crea o actualiza el catálogo, desactiva lo que deja de ser vendible, crea el stock inicial si falta |
| `abc_catalogo_puede_gestionar` y `abc_catalogo_numero` (privadas) | Permiso por local y lectura numérica tolerante |

Decisiones de diseño y por qué:

- `precio_unitario` sigue siendo el **precio base**: lo que ya lo consume (la vista previa de
  la pantalla, que calcula `precio_unitario × (1 + IVA)`, las instantáneas de línea) sigue
  funcionando sin tocar el paquete `fuente.js`.
- Un precio base redondeado a 8 decimales **no** garantiza totales exactos al céntimo
  (p. ej. 7 × 1,99 con 21 %); por eso el total se calcula desde el precio con IVA y no al
  revés.
- Las opciones de variante (A04) **siguen en base sin IVA**, igual que la pantalla las
  calcula; la RPC no gestiona opciones.
- RPC: permiso `Propietario` o `Encargado` del local (misma lógica de membresía que
  `abc_tiene_capacidad`), `operation_id` (replay idempotente y conflicto si llega con otro
  contenido, mediante el control de A03), máximo 200 productos, resultado por producto
  (`CREADO`, `ACTUALIZADO`, `SIN_CAMBIOS`, `DESACTIVADO`, `OMITIDO` con motivo). Solo toca lo
  recibido: lo ausente nunca se desactiva por inferencia. La versión solo sube si cambia algo
  de venta. El stock inicial solo se crea si la fila no existe; nunca pisa el stock vivo.
- No inventa el contexto fiscal: usa el vínculo fiscal activo del local y falla con
  `catalogo_contexto_fiscal_ausente` o `…_ambiguo` si no hay exactamente uno.
- Permisos de ejecución: solo `authenticated`; `anon` y `service_role` reciben `42501`.

### Pantalla (`ui-context-bridge.js`, sin tocar `fuente.js`)

Un puente nuevo, en un archivo que ya se publica (sin ampliar la frontera de publicación):

- Observa los guardados de `productos` y envía **solo las diferencias de venta** (nombre,
  unidad, fraccionable, precisión, precio, IVA, activo, tipo, local) contra la última lista
  conocida de la sesión. Sin lista de referencia no envía nada. Un cambio de stock no
  dispara el catálogo.
- Se ejecuta después del guardado heredado y en segundo plano: un fallo del puente nunca
  rompe el guardado de la pantalla.
- Reintentos con el mismo `operation_id` mientras el contenido no cambia. Si el servidor no
  tiene la RPC (producción antes de promoverla) se apaga en silencio y la pantalla sigue como
  antes. Sin permiso: se descarta y se avisa una vez. Sin contexto fiscal: queda pendiente y
  no entra en bucle.
- Volcado completo solo explícito: `window.__catalogoTpv.sincronizarTodo()`.

## Pruebas

| Prueba | Dónde | Resultado |
|---|---|---|
| Contrato vivo `tests/p3/p3-catalogo-contract.sql`: migración + 51 comprobaciones en una transacción con `ROLLBACK`, con usuarios suplantados por rol | QA (ensayo en seco, antes de aplicar) | **Todo correcto**: 0 fallos |
| Cuadrícula de redondeo: 3.960 cálculos (≈165 precios × IVA 0/4/10/21 % × 6 cantidades) | QA, dentro del contrato | 0 fallos: total = cantidad × precio con IVA y base + impuesto = total |
| Mismos importes que antes al convertir el catálogo sembrado (45 combinaciones) | QA | Idénticos |
| `tests/p3-catalogo-bridge.mjs`: 16 escenarios del puente en una máquina virtual | Local | Pasa; 3 mutantes del puente se detectan |
| `tests/p3/p3-catalogo-static-contract.mjs`: forma de la migración y compatibilidad con A03/A04 | Local | Pasa |
| Regresión: 67 contratos pasan (F3, F4, F5, puente de contexto, P1, PM05/07/08, frontera de publicación) | Local | Los mismos 12 de siempre fallan por entorno (sin PostgreSQL/PGlite local) |

Casos que cubre el contrato vivo (resumen):

- **Permisos:** Cajero/a de A1, Encargado de A2 y Propietario de otra empresa reciben
  `abc_catalogo_no_autorizado`; `anon` y `service_role` reciben `permission denied`.
- **Sincronización:** 15 productos sembrados pasan a precio con IVA y versión 2 con los
  mismos importes; repetir el mismo `operation_id` devuelve el resultado original; el mismo
  id con otro contenido da `operation_id_conflict`; otro id con el mismo catálogo no sube
  versiones.
- **Altas:** 3,30 € al 10 % → base 3,00; 1,99 € al 21 %: 7 uds = 13,93 exacto; 4,45 € al
  21 %: 3 uds = 13,35; granel 0,333 kg a 19,80 € = 6,5934.
- **Venta por el circuito ABC** (sesión, cuenta, pedido, línea) con productos creados por P3:
  la línea de 3 × 1,99 € tiene total 5,97 y la de 0,333 kg 6,5934.
- **Variantes (A04)** con producto a precio con IVA: capuchino + Mediano + leche de avena =
  2,20 (igual que antes); 3 uds = 6,60.
- **Baja y omisiones:** desactivado deja de venderse (`producto_tpv_no_disponible`);
  omisiones con motivo (sin local, otro local, otra empresa, sin nombre, precio inválido,
  IVA inválido, no vendible, id duplicado, sin id); lista vacía, no-lista, más de 200,
  moneda inválida, moneda sin contexto fiscal y local sin contexto fiscal.

Estado persistido en QA tras aplicar (consultas de catálogo): migración registrada, columna y
restricción presentes, `SECURITY DEFINER` con `search_path` vacío, ACL solo `authenticated`
en la RPC y solo propietario en las privadas, 0 filas con `precio_con_impuesto`, catálogo /
stock / `almacen_kv` en 30 / 83 / 25 (sin cambios), 0 operaciones P3 persistidas, 0 residuos.

## Límites y hallazgos

1. **Verificación posterior a la aplicación incompleta.** Tras aplicar la migración lancé una
   prueba corta de humo con `ROLLBACK`; su registro no se devolvió (el `SELECT` final lo
   tapó) y no repetí la llamada porque fue rechazada. La evidencia funcional es la del ensayo
   en seco (mismo SQL, mismo estado de QA) más las consultas de catálogo de arriba.
2. **Pantalla sin verificar y sin desplegar.** El puente solo llega al navegador con un
   deploy, que no está autorizado. Hasta entonces el catálogo sembrado de QA sigue con la
   semántica anterior (precio base): se convierte con la primera sincronización real, y los
   importes no cambian.
3. **No hay camino de vuelta.** La RPC escribe el catálogo; la lista que ve la pantalla en
   otro dispositivo sigue viniendo de `almacen_kv`, que en QA no admite escrituras de listas.
   Los productos editados en un equipo no aparecen en la lista de otro hasta resolverlo
   (propuesta P3b: función de lectura del catálogo para reconstruir la lista).
4. **Importes fraccionados sin redondear a céntimos.** El servidor calcula a 8 decimales
   (D17 sigue provisional): 0,333 kg a 19,80 € da 6,5934, que no se puede cobrar ni
   conciliar al céntimo. Ya ocurría con el precio base; no se ha cambiado.
5. **Opciones de variante en base sin IVA** y sin RPC ni pantalla de alta: se siguen creando
   por SQL (como la siembra de la etapa 1).
6. **Necesita contexto fiscal por local.** Un local sin vínculo fiscal activo no puede
   guardar catálogo (error explícito). A1 lo tiene por la siembra; los locales reales
   dependen de F1.4 (asesoría).
7. **Solo Propietario y Encargado.** Si otro rol edita productos, el cambio queda solo en la
   pantalla y se avisa una vez.
8. **Promoción a producción:** no autorizada. Exige A03 y A04, el control de `operation_id`
   de F2 y un contexto fiscal en cada local (la migración tiene preflight y falla si falta
   algo). No se ha comprobado el estado de producción.

## Reversión (QA)

La migración es aditiva y sin datos: basta con un SQL de reversión que restaure las dos
funciones de cálculo desde `20260924010000_abc_f3_a03_server_authority.sql` y
`20260924020000_abc_f3_a04_variants_modifiers.sql`, elimine la RPC y los dos auxiliares y
quite la restricción y la columna. No se ha escrito ni ensayado: no hay filas con
`precio_con_impuesto` en QA ni cambios de datos que deshacer.

## Cómo probarlo en pantalla (cuando haya deploy)

1. Ventana privada, preview de QA, Propietario, Local A1, pestaña de productos.
2. Cambia el precio de «Agua 50 cl (QA)» a 1,00 € y guarda.
3. En la consola: `window.__catalogoTpv.pendientes()` debe devolver `{}` en unos segundos y
   no aparecer avisos «[catálogo TPV]».
4. En el TPV, añade 3 aguas: el total debe ser 3,00 €.
