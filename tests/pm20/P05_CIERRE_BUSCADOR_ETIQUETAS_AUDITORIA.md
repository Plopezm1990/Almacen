# PM20 P05 — Buscador, etiquetas/catálogo y Auditoría: alcance verificado

Quinto punto de PM20, alcance "Buscador, etiquetas y catálogo" de la matriz más
"Auditoría" (parte de "Respaldos, errores y auditoría"). Ninguno tenía ficha propia (P01).

## Verificación real (sin defecto encontrado, sin cambios de código)

1. **`BusquedaGlobal`**: `productos`, `fichasCosto` y `empleados` llegan ya filtrados al
   local activo (`productosDelLocalActivo`, `fichasCostoDelLocalActivo`,
   `empleadosDelLocalActivo`). `proveedores`/`clientes` llegan sin filtrar por local — no
   es un hueco: son entidades de ámbito **empresa** por diseño ya establecido
   (`crearLogicaProveedores`/`crearLogicaClientes` solo comprueban `empresaId`, nunca
   `localId`), el mismo criterio confirmado en PM20 P01.
2. **`EtiquetasCatalogo`**: `productos`/`fichasCosto` llegan ya filtrados al local
   activo — no puede imprimir etiquetas ni catálogo de otro local.
3. **`Auditoria`**: recibe el array completo de auditoría sin filtrar por local. Se
   verificó que esto **no es una fuga de aislamiento**: el acceso de lectura a la
   pestaña "auditoria" está restringido al Propietario en tres capas independientes,
   todas confirmadas por inspección real:
   - Ningún rol de empleado (ni los roles reales — Camarero/a, Cajero/a, Churrero/a,
     Encargado — ni el legado "Estándar"/`ITEMS_EMPLEADO`) incluye `"auditoria"` en su
     lista de pestañas permitidas.
   - Existe una redirección real: si un empleado queda en una pestaña que su rol no
     permite, se le envía al dashboard.
   - La capa de sincronización con Supabase (`puedeLeer`/`puedeEscribir`, parte del
     código PM17 inlined) solo concede lectura de la colección `auditoria` al rol
     `"Propietario"` — confirmado también con prueba de comportamiento real
     (`puedeLeer("Propietario","auditoria")===true`, false para el resto de roles).

   Por tanto, que el Propietario vea la auditoría de **toda la empresa** (todos sus
   locales) en vez de solo el local activo es el mismo patrón ya verificado en P04 para
   `PanelDireccion`/`Tesoreria` — una vista de dirección, no una fuga entre locales de
   empleados de distinto local.

## Archivos

- `tests/pm20/p05-buscador-etiquetas-auditoria-contract.mjs` (nuevo): confirma el
  alcance correcto de `BusquedaGlobal`/`EtiquetasCatalogo` y las tres capas de
  restricción de lectura de Auditoría, con prueba de comportamiento real sobre
  `puedeLeer`.

## Regresión

Suite completa del proyecto — 110/110 sin regresiones.

## Estado de main/producción

`main` = `bdf25591a1e986a04223b399d11d8fe81d41d82d`, sin tocar directamente. Sin cambios
de código en este punto (solo prueba de verificación).

**PM20_P05_CIERRE_BUSCADOR_ETIQUETAS_AUDITORIA=PASS**
