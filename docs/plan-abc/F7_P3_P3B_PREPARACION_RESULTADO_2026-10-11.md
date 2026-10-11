# Resultado de preparación P3/P3b/P3c — 2026-10-11

## Estado

**PREPARADO_Y_VALIDADO_LOCALMENTE — PRODUCCIÓN PENDIENTE DE PREFLIGHT Y AUTORIZACIÓN DE VENTANA**

La rama de preparación queda lista para una nueva comprobación de solo lectura en producción. En esta actuación no se ejecutaron migraciones, SQL de escritura, despliegues ni cambios en producción.

## Paquete preparado

Rama: `codex/f7-p3-preparacion-20261004`  
Commit verificado: `ddf9f0c88f8829e409a326a6c5039ff76385f89c`

Migraciones previstas, en este orden, únicamente después de superar la preflight y recibir autorización de la ventana:

1. `20261002150000_abc_p3_catalogo_autoritativo.sql`
2. `20261002170000_abc_p3b_espejo_lista_nube.sql`
3. `20261004201358_abc_p3c_concurrencia_productos.sql`
4. `20261005060000_abc_p3c_titularidad_productos.sql`
5. `20261005100000_abc_p3c_lista_confirmada.sql`

## Validaciones realizadas

Todas las comprobaciones terminaron correctamente:

- `p3-catalogo-static-contract: OK`
- `p3b-espejo-static-contract: OK`
- `p3c-client-contract: OK`
- `p3-actualizar-producto-resultado: OK`
- `f7-preflight-static-contract: OK (51 migraciones, 148 objetos, 13 huellas, 48 funciones reemplazadas, 28 tablas)`
- `git diff --check: OK`

La documentación de preparación y el contrato de preflight siguen incluidos en la rama. El historial de QA documenta P3/P3b/P3c y sus comprobaciones de titularidad, concurrencia y lista confirmada.

## Gate de producción

Antes de aplicar cualquier migración se debe repetir la preflight de solo lectura sobre la base de producción actual y generar una copia manual nueva. Deben verificarse de nuevo las cabezas y huellas del paquete, las empresas/locales/productos esperados y la ausencia de cambios inesperados desde la última revisión.

La existencia histórica de la PR #121 no constituye una autorización de producción ni prueba que estas migraciones estén aplicadas en la base de datos. La ejecución de producción sigue separada y requiere una ventana concreta autorizada.

## Siguiente paso

La preflight de producción se ejecutó en modo lectura el 2026-10-11. El resultado obliga a detener la ventana:

- Las cinco migraciones ya están registradas en producción: `20261002150000`, `20261002170000`, `20261004201358`, `20261005060000` y `20261005100000`.
- Los objetos y RPC de P3 existen y las tres columnas esperadas de `almacen_kv` están presentes.
- El catálogo TPV productivo devuelve `0` filas; hay `3` filas de lista `productos`, todas con formato array válido.
- La lectura de titularidad devuelve `3` filas, `2` productos, sin empresas o locales inexistentes, pero `2` productos pertenecen a locales inactivos.
- La cobertura catálogo/lista es `0/0/0` porque el catálogo TPV está vacío.
- No hay contextos fiscales activos para continuar con una validación operativa de precios.
- Las huellas actuales, sin exponer contenido, son: lista `a36f03a1511b8c7ba91e7523ec61bad0`, stock `464f69874de832e1a0f89adcd593cc7e` con `2` filas, catálogo vacío y operaciones `0`.
- Las políticas permiten a `authenticated` leer y escribir `almacen_kv`, pero el trigger `abc_productos_solo_rpc` sigue instalado; no se hizo ninguna prueba de escritura.

**Resultado de preflight: BLOQUEADA para una nueva aplicación.** No se aplicaron migraciones, no se ejecutó SQL de escritura, no se modificaron productos ni se tocó producción más allá de estas consultas `SELECT`. El siguiente trabajo debe ser una revisión funcional de los locales inactivos, del catálogo TPV vacío y de los contextos fiscales antes de cualquier decisión de negocio.
