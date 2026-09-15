# Source Recovery — Proyecto A / L&A Suite

Este directorio conserva una fuente recuperada y verificable de la aplicación a partir del bundle histórico `fuente.js`.

## Qué se conserva

- `fuente-recuperado.js`: cuerpo de aplicación recuperado desde la sección `// fuente.jsx` del bundle, con JSX ya transformado por esbuild y dependencias expresadas como imports normales.
- `entrada-recuperada.js`: entrada de build que incorpora explícitamente `edge-auth-patch.js` antes de cargar la lógica recuperada.
- `package.json` / `package-lock.json`: dependencias y herramienta de build fijadas.
- `recuperar_candidato.py`: extracción controlada del cuerpo de aplicación. Con `--check` no modifica archivos y falla si la fuente recuperada deriva del bundle actual.
- `rebuild-current.mjs`: reconstrucción exacta del `fuente.js` vigente usando un baseline histórico reproducible y un diff acumulado fail-closed.
- `CURRENT_RELEASE.patch`: diff acumulado exacto desde el baseline histórico hasta el último commit que modificó `fuente.js`.
- `CURRENT_RELEASE_MANIFEST.json`: contrato de procedencia, hashes y commits de la reconstrucción actual.
- `CURRENT_RELEASE_EVIDENCE.json`: evidencia de la última certificación remota.

## Dos garantías distintas

### 1. Paridad de la lógica de aplicación

`python3 recuperar_candidato.py --check` localiza exactamente una marca `// fuente.jsx`, valida el bootstrap esperado de React/ReactDOM y exige que el cuerpo de aplicación de `fuente-recuperado.js` coincida con el cuerpo actual de `fuente.js`.

La comparación es fail-closed: si cambia el bundle y la fuente recuperada no se actualiza de forma equivalente, el comando falla.

### 2. Reconstrucción byte a byte del runtime actual

`npm run build:current` no acepta `fuente.js` como fuente de entrada para producirse a sí mismo. El proceso es:

1. montar en un worktree temporal el baseline histórico fijado en `CURRENT_RELEASE_MANIFEST.json`;
2. ejecutar allí `npm ci`, `npm run check` y `npm run build`;
3. exigir que el SHA-256 del bundle base coincida con el hash fijado;
4. copiar ese artefacto base a `source-recovery/dist/fuente.js`;
5. aplicar `CURRENT_RELEASE.patch` con `patch --batch --fuzz=0`;
6. exigir que el SHA-256 final coincida con el objetivo;
7. comparar byte a byte la salida reconstruida contra `../fuente.js`;
8. ejecutar `node --check` sobre el artefacto final.

El uso de `--fuzz=0` es deliberado: cualquier drift en la base o en el parche invalida la reconstrucción en vez de intentar adaptarla silenciosamente.

## Certificación remota

El workflow `.github/workflows/validate-source-recovery-release.yml`:

- hace checkout con historial Git completo;
- ejecuta `recuperar_candidato.py --check`;
- genera de forma determinista el diff acumulado desde el baseline hasta el último commit que modificó `fuente.js`;
- genera el manifiesto actual con hashes SHA-256;
- ejecuta la reconstrucción exacta dos veces desde cero;
- exige igualdad entre ambas reconstrucciones;
- exige igualdad byte a byte contra `fuente.js`;
- conserva evidencia versionada del resultado.

Si los archivos generados cambian, el propio workflow los versiona en la rama candidata. La siguiente ejecución valida el HEAD final ya materializado, sin reescrituras adicionales.

## Uso local

Se requiere un clon con el historial Git necesario para alcanzar el baseline fijado en el manifiesto.

```bash
cd source-recovery
npm ci --no-audit --no-fund
npm run check
python3 recuperar_candidato.py --check
npm run build:current
cmp -s dist/fuente.js ../fuente.js
```

Resultado esperado:

```text
PARIDAD_CUERPO_EXACTA=1
SOURCE_RECOVERY_CHECK=PASS
SOURCE_RECOVERY_BYTE_PARITY=PASS
SOURCE_RECOVERY_REBUILD_CURRENT=PASS
```

## Evidencia histórica

`PM01_EVIDENCIA.json`, `PM01_BUILD_EVIDENCIA.txt`, `PM01_CIERRE.md` y la antigua serie `post-pm08-patches/` se conservan como evidencia histórica de etapas anteriores. No deben interpretarse por sí solas como certificación del `release` actual.

La fuente recuperada comenzó como recuperación del bundle validado en etapas históricas del proyecto. La certificación vigente del runtime actual se expresa mediante `CURRENT_RELEASE_MANIFEST.json`, `CURRENT_RELEASE.patch` y `CURRENT_RELEASE_EVIDENCE.json`.

## Restricción de despliegue

Este mecanismo no sustituye automáticamente `fuente.js`, no mueve `release` y no despliega Netlify. Su función es demostrar reproducibilidad y detectar drift. Cualquier promoción de una rama candidata sigue requiriendo el proceso de release y las autorizaciones correspondientes del Proyecto A.
