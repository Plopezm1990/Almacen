# M-05 — Registro de auditoría paginado

Fecha de revisión: 2026-11-10  
Rama de corrección: `fix/m05-audit-pagination`

## Estado

La corrección está versionada y el contrato estático pasa sobre una extracción limpia. El preview integrado del PR #220 para el commit `e179b807` está listo en Netlify (`6af3746d4210a5c82f09d07b`), pero el botón de carga de páginas todavía no se ha observado con una sesión QA autorizada y producción no se ha modificado.

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
- No se ha reproducido todavía el botón de carga de páginas con una sesión QA contra el preview actualizado.
- El preview QA sí está medido como deploy listo; no se certifica que la rama esté en producción.
- La exportación completa no se implementa en este cambio; el criterio elegido es paginación.

M-05 queda avanzado como corrección versionada, regresión reproducida y preview QA listo, pero continúa abierto para cierre completo hasta observar la paginación funcional con la sesión QA autorizada y resolver la integración de producción mediante una ventana autorizada.

## Observación funcional en preview QA — 2026-11-11

Con la cuenta sintética de propietario ya autenticada mediante MFA se abrió la
sección `Auditoría` del preview del PR 220. La vista mostró el aviso de que el
registro del servidor se carga por páginas y el control `Cargar registro
completo`. Al activarlo, el control pasó a `Cargando...` y después la pantalla
mostró `Mostrando una parte del registro; puedes cargar más` junto con el botón
`Cargar más registros`.

Esto es evidencia **reproducida y observada** del flujo paginado en QA. No se
crearon filas, no se cambió ningún filtro con efecto de escritura y no se
ejecutó ninguna operación de negocio. M-05 queda funcionalmente observado en
QA, pero sigue abierto en alcance global hasta disponer de promoción controlada
a producción y de la verificación equivalente allí.
