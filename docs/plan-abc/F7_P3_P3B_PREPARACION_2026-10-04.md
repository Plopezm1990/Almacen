# F7 · Preparación del paquete P3/P3b/P3c

Fecha: 2026-10-04
Estado: `P3C_EN_REVISION_NO_APTO_PARA_PRODUCCION`

## Alcance y evidencia actual

- P3 (`20261002150000_abc_p3_catalogo_autoritativo.sql`) y P3b (`20261002170000_abc_p3b_espejo_lista_nube.sql`) ya están en `release`, pero no figuran como aplicadas en producción según la ventana del 4/10. La lectura de QA del 4/10 confirma ambas por **nombre** en su registro; allí hay 30 productos del TPV con `precio_con_impuesto` informado.
- P3 añade el precio de carta con IVA incluido (D31), sin reescribir automáticamente los precios existentes. El precio de un producto cambia de interpretación cuando la pantalla lo sincroniza mediante `abc_catalogo_guardar_productos`. P3b refleja los campos de venta aceptados en la lista heredada `almacen_kv.productos`.
- El puente de pantalla ya está publicado. Esta rama corrige el aviso desactualizado de «Día y cajas» sobre el cierre con diferencia, manteniendo la paridad entre `fuente.js` y `source-recovery/fuente-recuperado.js`.
- En QA se documentaron 51 comprobaciones de P3, 3.960 cálculos de redondeo, 56 comprobaciones de P3b con `ROLLBACK` y una edición observada por Pedro que sobrevivió a la recarga. El contrato estático de P3b también pasa en Windows tras normalizar los saltos de línea; no cambia el SQL de las migraciones.

## Condición que impide promoverlo ahora

El informe `F5_ANALISIS_CLAVES_PENDIENTES_QA_2026-10-02.md` registra una lectura autorizada de producción: allí el navegador **sí puede escribir** la lista completa `almacen_kv.productos`. El código actual hace ese `upsert` y después llama a la RPC de P3; P3b modifica la misma fila desde la RPC. En un dispositivo, el orden de las dos llamadas evita la carrera habitual. Entre dos dispositivos, una subida de lista basada en una lectura antigua puede sobrescribir el espejo de P3b. El contrato de QA no prueba esa combinación porque allí la política PM05 rechaza las subidas de la lista desde el navegador.

La rama incorpora el candidato P3c `20261004201358_abc_p3c_concurrencia_productos.sql`. Su RPC bloquea la fila `almacen_kv.productos`, fusiona por producto y campo frente a la base confirmada del dispositivo, y llama a P3 dentro de la misma transacción para los cambios comerciales iniciados por una persona. Un disparador impide que una pestaña antigua con rol `authenticated` o `anon` reemplace directamente la lista. Los conflictos sobre el mismo campo se rechazan y quedan pendientes en el dispositivo. El navegador conserva la base y el cambio comercial hasta recibir confirmación; la RPC P3 antigua se omite cuando P3c confirma lista y catálogo juntos.

En QA se ensayó la migración más `tests/p3/p3c-concurrencia-contract.sql` dentro de `BEGIN`/`ROLLBACK`: dos dispositivos con la misma base conservaron un precio y un coste distintos; una edición de nombre con precio antiguo mantuvo el precio nuevo en la lista y en el TPV; un precio en conflicto fue rechazado; un alta sobrevivió y llegó al TPV; un usuario de otra empresa y un `UPDATE` directo con política temporal permisiva fueron rechazados. Con P3c cargado de forma transitoria, el contrato P3b obtuvo 56/56 resultados esperados (50 positivos y seis rechazos previstos). `tests/p3/p3c-client-contract.mjs` prueba la cola, la base confirmada, el reintento tras corte de red, la ausencia de `upsert` en errores y el puente de pantalla. **No se aplicó P3c de forma persistente en QA**; la vista previa existente ejecuta el cliente antiguo y el disparador la bloquearía hasta publicar ambos lados de forma coordinada.

P3c sigue en revisión. Antes de promocionarlo hay que confirmar en una ventana nueva la titularidad/contexto de la fila productiva `almacen_kv.productos`, repetir las lecturas de producción que puedan haber cambiado, y hacer una prueba integrada del cliente actualizado contra QA con esquema P3c persistente y una vista previa nueva. La lectura autorizada de nueve consultas no incluyó la titularidad de esa fila y no autoriza más consultas productivas ni escrituras.

## Comprobación previa y puerta de producción

`F7_P3_P3B_PREFLIGHT_SOLO_LECTURA_2026-10-04.sql` contiene nueve consultas `SELECT`/`WITH`. Primero se validó su sintaxis en QA. Pedro autorizó por separado la opción 1 de lectura de producción y las nueve se ejecutaron allí el 4/10/2026 a las 19:44 UTC. No se ejecutó ningún SQL de escritura ni se desplegó la aplicación. La consulta de QA posterior solo repitió P5 para comparar huellas. El preflight no devuelve contenido de productos ni datos de personas.

### Resultado de la lectura de producción (9/9)

| Bloque | Resultado |
| --- | --- |
| P0 | Cero filas registradas por nombre para P3 y P3b. |
| P1 | Existen las 13 dependencias exigidas (7 tablas y 6 funciones). |
| P2 | No existen `precio_con_impuesto`, las dos funciones auxiliares P3 ni la RPC P3; están las tres columnas esperadas de `almacen_kv`. |
| P3 | Un producto en el catálogo TPV y una fila `productos` con una lista JSON válida. Solo se leyeron recuentos. |
| P4 | Un contexto fiscal activo para el único local y EUR. Se omiten aquí los identificadores productivos. |
| P5 | `abc_calcular_linea_tpv`: `1a3ff32669ae46d5e65520afb4b8782b`; variante configurada: `e1e935e1ec1bee56be265326b8dfe565`. Ambas son `SECURITY DEFINER` con `search_path` fijado. QA, donde P3 ya está aplicado, devuelve respectivamente `35c8f1fb38850c92f38e600981437ab1` y `336123cdb9a826977cbe9ed32feacb39`. La diferencia es coherente con los estados anterior y posterior a P3, pero no demuestra por sí sola que los cuerpos coincidan con el candidato: eso queda pendiente para una promoción. |
| P6 | `authenticated` tiene privilegios de lectura, inserción y actualización. La política RLS de `INSERT`/`UPDATE` incluye expresamente `productos` para cualquier perfil activo. Queda confirmada la carrera del `upsert` del navegador contra el espejo P3b. |
| P7 | Dos disparadores habilitados: actualización de fecha y creación inicial de stock desde `productos`. No existe uno que proteja los campos de venta ante la sustitución de la lista. |

La lectura cumple las condiciones de ausencia y dependencias, pero **no levanta el bloqueo de concurrencia**. El PR de preparación permanece como borrador y no debe fusionarse.

Para abrir una ventana de producción harán falta, en este orden:

1. Terminar la revisión de P3c, verificarlo de forma integrada en QA y dejar en verde la CI de un candidato exacto. La corrección del texto de «Día y cajas» se agrupa en ese único despliegue de aplicación.
2. La lectura específica de producción se completó el 4/10 (resultados arriba). Refrescarla si se abre otra ventana y contrastar las huellas del cuerpo exacto del candidato una vez resuelta la carrera. No asumir que la foto de hoy sigue vigente entonces.
3. Pedro hace y comprueba una copia manual fuera del repositorio. Congelar commit, `sha256` de `fuente.js`, condiciones de parada y una hoja de autorización **nueva para este paquete**. La autorización del primer paquete no cubre P3/P3b.
4. Solo tras esa autorización: aplicar P3 y verificar; aplicar P3b y verificar; aplicar P3c y verificar; hacer humo con `ROLLBACK` sin dejar filas; publicar una vez la aplicación, comprobar el archivo servido y pedir a Pedro la aceptación del recorrido acordado. Parar ante la primera diferencia.

No se aplica SQL ni se despliega producción desde esta rama. P3/P3b siguen fuera de «verificado» hasta la aceptación de Pedro (D05).
