# PM12 · P03 — Documento de conteo y corte temporal

Fecha: 2026-09-07  
Rama: `pm12-conteo-estados-honestos`

## Resultado

Se añadió un documento canónico versionado para los conteos nuevos. Su identidad no depende del selector visual ni de metadatos editables del usuario.

## Identidad obligatoria

- ID único del conteo.
- `empresaId`.
- `localId` real; `todos` queda rechazado.
- ámbito `total`, `almacen` o `piso_venta`.
- actor de inicio.
- conjunto de productos sin duplicados.
- versión documental.

## Corte temporal

Al iniciar se fija `iniciadoEn`. Cada captura válida actualiza `actualizadoEn`. Al cerrar se congelan:

- empresa, local y ámbito;
- fecha/hora de inicio y cierre;
- actor de cierre;
- responsable y revisor;
- productos incluidos;
- total, contados, pendientes y porcentaje de cobertura;
- motivo cuando el cierre es parcial.

## Inmutabilidad

Un documento `PARCIAL`, `COMPLETADO` o `CANCELADO` no permite cambiar cantidades ni responsables. Un producto fuera del conjunto inicial no puede inyectarse silenciosamente durante el cierre.

## Aislamiento

Toda mutación comprueba empresa y local contra la identidad del documento. `Todos los locales` queda reservado a lectura consolidada y nunca sirve como destino de escritura.

P03 no crea tablas ni escribe en Supabase. La integración con la lógica real de `crearLogicaConteos` corresponde a P04.

**PM12_P03_DOCUMENTO_CORTE=PASS**  
**PM12_P03_SUPABASE_WRITES=0**  
**PM12_P03_PRODUCTION_WRITES=0**
