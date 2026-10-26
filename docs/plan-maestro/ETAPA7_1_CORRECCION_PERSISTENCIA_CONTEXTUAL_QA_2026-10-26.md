# Etapa 7.1 — Corrección de persistencia contextual de productos en QA

**Fecha:** 2026-10-26  
**Entorno:** QA exclusivamente (`qjqorixtkilwsndqayyx`)  
**Empresa/local probado:** `QA-EMP-B` / `QA-B1` (`Local B1`)  
**Producción:** no modificada

## 1. Incidencia cerrada

En la sesión B de la prueba A/B, un producto elaborado se veía en el navegador, pero no se persistía en el servidor. Al intentar mover una unidad desde almacén a piso de venta, la operación respondía con un error genérico y no debía modificar el stock local.

La evidencia de QA identificó dos errores reales:

- `almacen_kv_empresa_ambigua` en la RPC histórica de cuatro parámetros `public.abc_productos_guardar_lista(text,jsonb,jsonb,jsonb)`.
- `stock_no_configurado` en `public.trasladar_stock_interno`, porque la falta de persistencia del producto impedía crear su fila en `stock_ubicacion`.

La causa era la combinación de dos diseños incompatibles: la caché del navegador puede contener artículos de varias empresas, mientras que la fila `almacen_kv` de productos está segregada por empresa y la RPC antigua deducía la empresa por membresía. Con dos empresas activas, esa deducción debe fallar cerrado; no puede adivinar el contexto seleccionado.

## 2. Corrección implementada

### 2.1 RPC contextual y validación de permisos

Se aplicó en QA la migración:

- `supabase/migrations/20261026110210_abc_p3c_contexto_productos.sql`

La migración conserva la RPC histórica de cuatro parámetros para instalaciones antiguas y añade la sobrecarga de seis parámetros con `p_empresa_id` y `p_local_id`. La nueva ruta valida autenticación, pertenencia a empresa/local, permisos de escritura y existencia de la fila de productos de la empresa. Usa un GUC transaccional para que la RPC P3c existente reutilice su lógica de fusión, conflictos y catálogo sin cambiar el comportamiento fail-closed de la ruta legacy. El `EXECUTE` de la nueva sobrecarga queda concedido a `authenticated`.

Después se aplicó en QA:

- `supabase/migrations/20261026111358_abc_p3c_reload_postgrest.sql`

Esta migración envía `pg_notify('pgrst', 'reload schema')`. Fue necesaria porque PostgreSQL ya contenía la sobrecarga nueva, pero PostgREST aún resolvía la firma antigua desde su caché de esquema. Tras la recarga, la llamada de seis parámetros respondió correctamente.

### 2.2 Cliente aislado por empresa activa

En `index-storage-bootstrap.js` se actualizó la ruta P3c para:

- enviar el contexto explícito cuando existe empresa y local activos;
- filtrar `p_base`, `p_nuevo` y `p_venta` a la empresa activa antes de llamar a la RPC;
- preservar en la caché local los productos de las demás empresas al recibir la lista confirmada;
- leer la confirmación remota usando también `empresa_id`;
- conservar el fallback legacy solo cuando la instalación todavía no conoce la sobrecarga contextual.

El contrato de cliente incluye un caso A/B que comprueba que una lista mixta no cruza productos entre empresas.

### 2.3 Caché offline del preview

Se incrementó el nombre de caché del service worker en `sw.js` de `v2` a `v3`. Sin ese cambio, un navegador QA que ya tuviera el shell anterior podía seguir ejecutando el bundle antiguo después de un deploy correcto de Netlify.

## 3. Verificación técnica

Pruebas locales ejecutadas y superadas:

- `node tests/p3/p3c-client-contract.mjs` → `p3c-client-contract: OK`;
- `node tests/p3/p3-catalogo-static-contract.mjs` → `OK`;
- `node tests/p3/p3b-espejo-static-contract.mjs` → `OK`;
- `node tests/f4/b11/b11-offline-boundary-contract.mjs` → `ABC_F4_B11_OFFLINE_BOUNDARY=PASS`;
- `git diff --check` → limpio.

El preview de Netlify de la rama QA confirmó el bundle con el aislamiento contextual y activó `la-suite-shell-v3`.

## 4. Prueba funcional QA cerrada

Producto de prueba:

- nombre: `QA B Scoped Producto 4`;
- SKU: `QA-B-SCOPE-04`;
- producto_id: `mvp5p6r2a9v4uz`;
- empresa/local: `QA-EMP-B` / `QA-B1`;
- stock inicial: `10 ud` en almacén, mínimo `2 ud`.

Resultado de la RPC contextual después de recargar PostgREST:

```text
ok=true
productos_cambiados=1
venta_cambiada=1
catalogo_ya_sincronizado=false
```

Resultado server-side en QA:

- `public.almacen_kv`, empresa `QA-EMP-B`, clave `productos`: 1 elemento y contiene `QA-B-SCOPE-04`;
- `public.stock_ubicacion`, `QA-B1`, `mvp5p6r2a9v4uz`: `almacen=9`, `piso=1`, `minimo=2`, `unidad=ud`;
- `public.movimientos_stock`: un movimiento `TRASLADO_INTERNO`, operación `mvp5t0y2cbv2ez`, cantidad `1`, `delta_almacen=-1`, `delta_piso=+1`, `delta_total=0`;
- la interfaz mostró: `Traspasado 1,00 ud al piso de venta`;
- el producto aparece en `QA-EMP-B` y no aparece en la colección de `QA-EMP-A`.

La prueba no realizó ventas, cobros ni operaciones de caja. El cambio validado es únicamente persistencia de producto y traspaso de stock en QA.

## 5. Limitación independiente que queda abierta

La respuesta devuelve `catalogo_ya_sincronizado=false` porque el fixture B no tiene contexto fiscal configurado. Por ello no se ha creado todavía la fila correspondiente en `public.catalogo_tpv_productos` para este nuevo SKU.

Esto ya no es el bloqueo de persistencia ni el de stock: el producto y su stock son server-side y el traspaso funciona. Queda como trabajo separado configurar el contexto fiscal de QA B y repetir la publicación al catálogo TPV, sin activar nada en producción.

## 6. Commits de la corrección

- `a590dc7` — `fix(p3c): persist products with explicit QA context`;
- `420cdae` — `fix(p3c): scope product sync to active company`;
- `fa28d52` — `fix(offline): refresh cached QA shell after deploy`.

## Estado

**CERRADA en QA:** persistencia contextual de productos y traspaso almacén → piso de venta.  
**PENDIENTE separado:** contexto fiscal y espejo en catálogo TPV de QA B.  
**Producción:** sin cambios.

## Siguiente paso

Configurar o reutilizar un contexto fiscal controlado para `QA-EMP-B / QA-B1`, repetir la confirmación del catálogo TPV y comprobar que el producto queda vendible sin ejecutar una venta real. Después se puede cerrar el subbloque P3c de la Etapa 7 y continuar con la siguiente prueba de aceptación prevista.
