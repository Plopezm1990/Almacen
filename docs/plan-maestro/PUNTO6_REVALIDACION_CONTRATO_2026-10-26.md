# Punto 6 — Revalidación del contrato de publicación Netlify

**Fecha:** 26/10/2026  
**Alcance:** contrato histórico de publicación y recuperación de Netlify  
**Producción:** no modificada  
**Supabase:** no utilizado y no modificado

## 1. Incidencia corregida

El script:

`.github/scripts/punto6-netlify-publicacion-recuperacion.mjs`

contenía plantillas literales JavaScript escritas con las comillas invertidas y
las interpolaciones escapadas (`\`` y `\${...}`). Node interpretaba esos
caracteres como una expresión inválida y detenía el contrato antes de iniciar
la comprobación de publicación.

La corrección se limitó a restaurar las plantillas literales normales en:

- mensajes de aserción;
- resolución de `RELEASE_BASE` y del rango Git;
- mensajes de salida del contrato.

No se cambió la política del contrato, la lista de archivos permitidos, la
comparación SHA-256 ni las exclusiones del payload.

## 2. Revalidación en el contexto correcto

El contrato es específico de la candidata histórica del Punto 6. Por eso se
probó desde el commit histórico que contiene exactamente los dos archivos
esperados respecto de la base de release:

- base release: `21ee66bdb52e4d5ad0af2341543f53720a4cf027`;
- candidata histórica: `7f4539f5e09a48141f89e3f1526cdffa7f8d4e10`;
- archivos cambiados respecto de release: `2`;
- archivos permitidos: contrato de Punto 6 y su documento histórico.

Resultado:

```text
PUNTO6_RELEASE_BASE=21ee66bdb52e4d5ad0af2341543f53720a4cf027
PUNTO6_CANDIDATE_HEAD=7f4539f5e09a48141f89e3f1526cdffa7f8d4e10
PUNTO6_CHANGED_FILES=2
PUNTO6_PUBLISH_FILES=33
PUNTO6_PAYLOAD_BYTE_PARITY=PASS
PUNTO6_NETLIFY_REPO_CONTRACT=PASS
```

La prueba creó un worktree temporal de la base, reconstruyó el artefacto
`.netlify-dist` en base y candidata, comparó todos los archivos publicables por
SHA-256, verificó que no hubiera rutas técnicas y eliminó el worktree temporal
al terminar.

## 3. Distinción respecto de la rama actual

La rama actual de Etapa 7 contiene cambios de varias etapas, por ejemplo
correcciones P3c, contratos y documentación QA. Si el script histórico se
ejecuta directamente en ella, termina con:

```text
Error: Cambio fuera del alcance 6A: .github/scripts/build-netlify-publish.mjs
```

Esto no es un fallo de sintaxis ni de publicación. Es la barrera de alcance
que el contrato debe aplicar: una rama posterior no puede presentarse como una
candidata exclusiva de Punto 6. Para las ramas actuales, el contrato general
vigente es `tests/netlify-publish-boundary.mjs`, que también pasó tras generar
el artefacto de forma secuencial.

## 4. Estado

**Punto 6 revalidado:** el script vuelve a ser ejecutable y su candidata
histórica pasa paridad de payload y contrato de repositorio.

**Netlify producción:** sin cambios ni deploy manual.

**Siguiente:** mantener este contrato ligado a su candidata histórica y usar el
contrato general de frontera de publicación para las ramas posteriores. El
trabajo de la Etapa 7 continúa con la aceptación física T9.
