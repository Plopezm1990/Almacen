# PM20 P03 — Dashboard, informes y Resultados: fórmulas y filtros reproducibles

Tercer punto de PM20, alcance "Dashboard, informes y Resultados" de la matriz. `Dashboard`
nunca había tenido una ficha propia (P01); las cifras que muestra (LA-007/LA-008,
márgenes, rotación) sí están cerradas a nivel de motor en PM09/G1, pero no se había
verificado que el **componente de pantalla** consuma esas cifras con la fórmula correcta
y el alcance correcto.

## Verificación real (sin cambios de código: no se encontró ningún defecto)

Por inspección directa de `fuente.js` (confirmado también con el contrato de este punto,
no solo leído):

1. **Misma fórmula en las tres variantes de alcance.** `valorInventario` (toda la
   empresa), `valorInventarioDelLocalActivo` (local activo) y `valorInventarioInforme`
   (alcance seleccionable en el informe) usan exactamente la misma expresión
   (`stock × costo`, excluyendo utillaje). Lo mismo ocurre con `stockBajo` (mismo
   criterio de "bajo mínimo" en sus tres variantes) y con `margenPromedio`/
   `margenPromedioInforme` (mismo promedio de `margenDe` sobre productos con precio).
   No hay una segunda fórmula divergente en ningún punto.
2. **Dashboard, Resultados y LibroIva comparten el mismo alcance.** Las tres pantallas
   usan un único `SelectorLocalInformes` (`localInformeId`) y consumen consistentemente
   las variantes `*Informe` de los datos — nunca se mezcla, por ejemplo, `productos`
   (toda la empresa) en una pantalla con `productosDelLocalActivo` en otra bajo el mismo
   selector, lo que habría producido cifras incoherentes entre pantallas para el mismo
   contexto elegido.
3. `analisisABC`/`analisisABCDelLocalActivo` (clasificación ABC de rotación) también
   están duplicados por alcance (empresa vs. local activo) con lógica idéntica —
   confirmado, no se ha tocado: no es la clase de duplicación que PM19 P05 corrigió (esa
   era lógica de autorización con riesgo de "Todos" como destino de mutación; esta es
   lectura pura, recalculada por alcance, sin riesgo de integridad).

Conclusión: no se ha encontrado ningún hallazgo nuevo en Dashboard/Resultados/LibroIva.
El punto cierra con la prueba de reproducibilidad que faltaba, no con una corrección.

## Archivos

- `tests/pm20/p03-dashboard-informes-resultados-contract.mjs` (nuevo): confirma por
  inspección real que las fórmulas de valorInventario/stockBajo/margenPromedio son
  idénticas entre sus variantes de alcance, y que Dashboard/Resultados comparten el
  selector y las variantes `*Informe`.

## Regresión

Suite completa del proyecto — 108/108 sin regresiones.

## Estado de main/producción

`main` = `bdf25591a1e986a04223b399d11d8fe81d41d82d`, sin tocar directamente. Sin cambios
de código en este punto (solo prueba de verificación).

**PM20_P03_CIERRE_DASHBOARD_INFORMES_RESULTADOS=PASS**
