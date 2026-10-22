# F5 / PM09 — preflight de producción

Fecha: 2026-10-02  
Proyecto: `flqercbgpgmmfaakrwkc` — L&A Suite producción  
Estado: `BLOQUEADO_POR_DERIVA_DE_ESQUEMA`

## Resultado de lectura

El preflight del hardening PM09 fue de solo lectura. Producción no tiene el
mismo baseline que QA:

| Componente | Producción |
| --- | --- |
| `public.registrar_devolucion_venta_pm09` | existe |
| `public.registrar_venta_stock_pm09` | falta |
| `public.registrar_venta_stock_carrito_pm09` | existe |
| `public.revertir_venta_stock_pm09` | falta |
| `public.revertir_venta_stock_carrito_pm09` | existe |
| `public.revertir_venta_stock` (RPC base) | falta |

El resto de las bases consultadas sí existe (`registrar_venta_stock`,
`registrar_venta_stock_carrito` y `revertir_venta_stock_carrito`). Las funciones
PM09 presentes ya tienen `search_path = ''` y el helper privado también.

## Decisión de seguridad

No se aplicó `abc_f5_pm09_security_hardening` en producción. Aplicarla ahora
crearía los wrappers ausentes sin restaurar la RPC base de reverso, dejando una
superficie aparentemente disponible pero funcionalmente incompleta.

La promoción requiere primero reconciliar el baseline PM09 de producción con
QA, incluyendo la RPC base faltante, y después repetir el preflight y aplicar el
hardening. Esa restauración es un cambio de alcance separado; no se ejecuta de
forma implícita como parte del hardening.
