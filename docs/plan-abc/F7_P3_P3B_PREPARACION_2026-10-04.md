# F7 · Preparación del paquete P3/P3b

Fecha: 2026-10-04
Estado: `PREPARADO_PARA_REVISION_NO_APTO_PARA_PRODUCCION`

## Alcance y evidencia actual

- P3 (`20261002150000_abc_p3_catalogo_autoritativo.sql`) y P3b (`20261002170000_abc_p3b_espejo_lista_nube.sql`) ya están en `release`, pero no figuran como aplicadas en producción según la ventana del 4/10. La lectura de QA del 4/10 confirma ambas por **nombre** en su registro; allí hay 30 productos del TPV con `precio_con_impuesto` informado.
- P3 añade el precio de carta con IVA incluido (D31), sin reescribir automáticamente los precios existentes. El precio de un producto cambia de interpretación cuando la pantalla lo sincroniza mediante `abc_catalogo_guardar_productos`. P3b refleja los campos de venta aceptados en la lista heredada `almacen_kv.productos`.
- El puente de pantalla ya está publicado. Esta rama corrige el aviso desactualizado de «Día y cajas» sobre el cierre con diferencia, manteniendo la paridad entre `fuente.js` y `source-recovery/fuente-recuperado.js`.
- En QA se documentaron 51 comprobaciones de P3, 3.960 cálculos de redondeo, 56 comprobaciones de P3b con `ROLLBACK` y una edición observada por Pedro que sobrevivió a la recarga. El contrato estático de P3b también pasa en Windows tras normalizar los saltos de línea; no cambia el SQL de las migraciones.

## Condición que impide promoverlo ahora

El informe `F5_ANALISIS_CLAVES_PENDIENTES_QA_2026-10-02.md` registra una lectura autorizada de producción: allí el navegador **sí puede escribir** la lista completa `almacen_kv.productos`. El código actual hace ese `upsert` y después llama a la RPC de P3; P3b modifica la misma fila desde la RPC. En un dispositivo, el orden de las dos llamadas evita la carrera habitual. Entre dos dispositivos, una subida de lista basada en una lectura antigua puede sobrescribir el espejo de P3b. El contrato de QA no prueba esa combinación porque allí la política PM05 rechaza las subidas de la lista desde el navegador.

Antes de promocionar, hay que resolver y probar la concurrencia de dos dispositivos sin perder altas, campos no comerciales ni cambios de precio. La ruta recomendada es que los campos de venta se escriban mediante una operación del servidor que serialice la modificación de catálogo y lista; la pantalla no debería poder reemplazar esos campos con un `upsert` antiguo. La solución debe probarse primero en QA y compararse con las políticas reales de producción. No se debe usar una prueba con un solo dispositivo como sustituto de esa garantía.

## Comprobación previa y puerta de producción

`F7_P3_P3B_PREFLIGHT_SOLO_LECTURA_2026-10-04.sql` está preparado y sus nueve consultas se ejecutaron **solo en QA** para validar sintaxis. En producción requiere permiso de lectura separado: no se ha ejecutado allí en esta preparación. Devuelve nombres de migración, existencia de dependencias, recuentos, identificadores de contexto fiscal, huellas de dos funciones y metadatos de permisos/disparadores; no devuelve contenido de productos ni datos de personas.

Para abrir una ventana de producción harán falta, en este orden:

1. Resolver la carrera de `productos`, verificarla en QA y dejar en verde la CI de un candidato exacto. La corrección del texto de «Día y cajas» se agrupa en ese único despliegue de aplicación.
2. Con permiso específico, repetir la foto de solo lectura de producción y ejecutar el preflight P3/P3b. Deben faltar las dos migraciones y todos los objetos P3; deben existir las 13 dependencias y las tres columnas de `almacen_kv`. Contrastar las huellas de cálculo con el candidato y revisar la política que permite escribir la lista.
3. Pedro hace y comprueba una copia manual fuera del repositorio. Congelar commit, `sha256` de `fuente.js`, condiciones de parada y una hoja de autorización **nueva para este paquete**. La autorización del primer paquete no cubre P3/P3b.
4. Solo tras esa autorización: aplicar P3 y verificar; aplicar P3b y verificar; hacer humo con `ROLLBACK` sin dejar filas; publicar una vez la aplicación, comprobar el archivo servido y pedir a Pedro la aceptación del recorrido acordado. Parar ante la primera diferencia.

No se aplica SQL ni se despliega producción desde esta rama. P3/P3b siguen fuera de «verificado» hasta la aceptación de Pedro (D05).
