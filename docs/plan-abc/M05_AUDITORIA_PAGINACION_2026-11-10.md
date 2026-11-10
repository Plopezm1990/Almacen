# M-05 — Registro de auditoría paginado

Fecha de revisión: 2026-11-10  
Rama de corrección: `fix/m05-audit-pagination`

## Estado

La corrección está versionada y el contrato estático pasa sobre una extracción limpia. El cierre efectivo en un despliegue vivo todavía no está certificado porque la rama no se ha publicado en un preview actualizado.

## Corrección

El commit `1bf5474b` sustituye la lectura única con `.limit(500)` por una carga paginada de 500 filas mediante `.range(...)`, conserva el orden por `creado_en DESC` y concatena páginas hasta recibir una página incompleta. La pantalla muestra si hay más registros, permite cargar la siguiente página y comunica cuándo el registro completo está cargado.

El camino offline ya no recorta la lista local a 500 entradas. En el camino nube, la RLS existente sigue siendo la autoridad sobre qué filas puede ver el usuario; la paginación no amplía permisos.

La corrección es idéntica en `fuente.js` y `source-recovery/fuente-recuperado.js`.

## Verificación reproducida

Sobre la extracción limpia de `fix/m05-audit-pagination`:

```text
M-05: contrato de paginacion de auditoria OK
```

El contrato verifica:

- una única función de carga paginada en cada artefacto;
- páginas ordenadas de 500 mediante `.range`;
- ausencia del límite único de 500;
- ausencia del recorte local a 500;
- estado de carga, error y continuidad;
- control visible para cargar más;
- identidad entre bundle y fuente recuperada;
- secuencia de 1.011 filas como 500 + 500 + 11.

También pasaron `node --check` sobre los dos artefactos JavaScript.

## Estado vivo y límites

- La medición base de QA tenía 1.011 filas de auditoría y la lectura publicada usaba un tope de 500.
- No se creó ningún dato en QA ni se escribió en producción.
- No se ha reproducido todavía el botón de carga de páginas contra un preview actualizado.
- No se certifica que la rama ya esté en producción o en el preview QA servido.
- La exportación completa no se implementa en este cambio; el criterio elegido es paginación.

M-05 queda avanzado como corrección versionada y regresión reproducida, pero continúa abierto para cierre completo hasta verificar un deploy actualizado y observar la paginación funcional con la sesión QA autorizada.
