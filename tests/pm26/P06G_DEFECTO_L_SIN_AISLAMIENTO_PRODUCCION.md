# PM26 — Defecto L (nuevo): producción no aísla `prefiltros_candidatos` por empresa/local

## Estado

**Registrado, sin corregir. Ninguna escritura en producción.** Distinto
de los defectos J (identificadores internos en grep, PM26 P02, cerrado)
y K (endpoint de producción hardcodeado en el flujo de prefiltro,
registrado en P06c). Decisión del usuario (Opción B, aviso F): no
copiar a QA el diseño de producción; en su lugar, dejar registrada
aparte, como defecto de producción, la ausencia de aislamiento que
tiene hoy.

## Qué es

Verificado en solo lectura en `P06D_AVISO_F_PRODUCCION_SOLO_LECTURA.md`:
producción tiene 3 políticas RLS reales para `prefiltros_candidatos`
(`SELECT`/`INSERT`/`DELETE`), todas con la misma condición — exigir
`rol = 'Propietario'` en `perfiles`, **sin ninguna comprobación de
empresa ni local**. La tabla tampoco tiene columnas `empresa_id`/
`local_id`. Cualquier usuario autenticado con `rol = 'Propietario'` en
**cualquier** empresa puede leer, crear y borrar prefiltros de
candidatos de **cualquier otra** empresa que use la misma instalación.

En el momento de la verificación (P06d), producción tiene **0 filas**
en esta tabla — el defecto es de diseño (ausencia de aislamiento en la
política), no una fuga de datos ya materializada con datos reales
conocidos.

## Por qué no se corrige aquí

- Corregirlo implica escribir en producción (`L&A Suite`), lo que esta
  sesión no hace sin autorización específica y explícita para esa
  escritura concreta — regla permanente del proyecto.
- El usuario decidió explícitamente (Opción B) no replicar este diseño
  en QA, y tampoco pidió corregirlo en producción en este mensaje —
  solo registrarlo.

## Qué NO se hizo

- No se escribió nada en producción.
- No se cambió ninguna política ni grant en producción.
- No se mezcló con el aviso F (el diseño de QA) ni con el defecto K
  (el endpoint hardcodeado).

```
PM26_DEFECTO_L_ESTADO=REGISTRADO_SIN_CORREGIR
PM26_DEFECTO_L_CORREGIDO=NO
PM26_DEFECTO_L_ESCRITURA_EN_PRODUCCION=NO
PM26_DEFECTO_L_FILAS_AFECTADAS_CONOCIDAS=0
PM26_DEFECTO_L_MEZCLADO_CON_AVISO_F=NO
PM26_DEFECTO_L_MEZCLADO_CON_DEFECTO_K=NO
```

Pendiente de que el usuario decida, en algún momento futuro y por
separado, si autoriza corregir esto en producción.
