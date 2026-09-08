# PM-01 — Base reproducible cerrada

Fecha de validación: 2026-09-04

## Referencia fijada

- Repositorio: `Plopezm1990/Almacen`
- Candidato funcional de referencia: `la-suite-identidad`
- SHA del candidato: `8567a920430d4ec02a6e17386f23b2eaaa1cd86f`
- Rama de trabajo PM-01: `pm01-fuente-reproducible`
- `main` y producción: no modificados.

## Fuente canónica recuperada para continuar el mantenimiento

La base recompilable queda en `source-recovery/`:

- `fuente-recuperado.js`: lógica de aplicación recuperada del candidato actual.
- `entrada-recuperada.js`: entrada explícita que incluye `edge-auth-patch.js` y la fuente recuperada.
- `package.json` + `package-lock.json`: dependencias fijadas.
- `recuperar_candidato.py`: procedimiento reproducible para regenerar la fuente desde el bundle candidato mientras siga siendo necesaria esta etapa de recuperación.

El JSX original no existe porque no hay source map. Por ello, la fuente recuperada conserva el código transformado por esbuild (`React.createElement`) y nombres temporales del compilador. No se presenta como el JSX original.

## Evidencia de paridad

El cuerpo de aplicación del `fuente.js` candidato empieza en la marca `// fuente.jsx`, línea 116850.

- Bundle candidato: 5.522.095 bytes.
- Cuerpo de aplicación recuperado: 1.212.711 bytes.
- Líneas de cuerpo: 14.117.
- SHA-256 del cuerpo en el bundle: `96fb1121e3c57b6b963104e093b93c2508d8706b947b4acc032037647e116d4b`.
- SHA-256 del cuerpo en `fuente-recuperado.js`: `96fb1121e3c57b6b963104e093b93c2508d8706b947b4acc032037647e116d4b`.
- Resultado: `PARIDAD_CUERPO_EXACTA=1`.

Solo se sustituyen los bootstrap internos de React/ReactDOM generados por el bundle por imports normales. La lógica de aplicación se conserva sin reescritura manual.

## Evidencia de build reproducible

Desde una instalación limpia con `npm ci`:

1. `npm run check` correcto.
2. `npm run build` correcto.
3. `node --check dist/fuente.js` correcto.
4. Segundo build después de borrar `dist/`: idéntico byte a byte al primero.
5. SHA-256 de ambos builds: `453c657fe2c9c5d573e67bbbc63dde286e3b06070dca63329fbc154f78a06fcd`.
6. Tamaño de ambos builds: 5.163.594 bytes.
7. Marcadores comprobados: `GestionAlmacen`, `crearLogicaCaja`, `SelectorLocalInformes`, `ErroresSistema` y `obtener_contexto_operativo`.
8. El `fuente.js` candidato quedó intacto durante todo el proceso.

Resultado: `PM01_BUILD_REPRODUCIBLE=1`.

## Criterio de cierre

PM-01 se considera cerrado porque existe una base recompilable asociada al candidato actual, con paridad exacta demostrada del cuerpo de aplicación y build determinista desde dependencias fijadas.

Esto NO autoriza todavía sustituir el bundle de producción ni fusionar a `main`. Esa decisión pertenece a fases posteriores del plan, después del aislamiento QA y las pruebas funcionales/seguridad correspondientes.
