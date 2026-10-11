# Punto 7 — Frontend hardening

**Base del candidato:** `release@7f4539f5e09a48141f89e3f1526cdffa7f8d4e10`  
**Rama:** `claude/punto7-frontend-hardening`  
**Estado:** candidato preparado; pendiente de CI y Deploy Preview.

## Hallazgos de preflight

1. `index.html` cargaba `https://cdn.tailwindcss.com` en runtime.
2. `_headers` contenía únicamente reglas de caché, sin CSP, `X-Content-Type-Options`, `Referrer-Policy` ni `Permissions-Policy`.
3. La aplicación usa cámara mediante `getUserMedia`, Service Worker/Push, Web Share, portapapeles y Supabase.
4. `index.html` y `restablecer-contrasena.html` contenían scripts inline.

## Candidato

- Tailwind fijado a `3.4.17` como dependencia exclusivamente de build.
- El CSS se genera en `.netlify-dist/tailwind.generated.css`; no se publica `node_modules`, `package.json` ni material de build.
- Los scripts inline se extraen a archivos locales para permitir `script-src 'self'` sin `'unsafe-inline'`.
- CSP permite los orígenes necesarios para Supabase PROD/QA y Google Fonts; workers `blob:` se conservan.
- `Permissions-Policy` conserva `camera=(self)` porque la cámara es una función real de L&A Suite y deshabilita capacidades no usadas.
- Se añaden `X-Content-Type-Options: nosniff` y `Referrer-Policy: strict-origin-when-cross-origin`.
- El contrato existente `tests/netlify-publish-boundary.mjs` valida el nuevo artefacto y las cabeceras sin aumentar el número de contratos activos.

## Límites

- No se modifica `fuente.js`, Supabase, `main` ni PR #38.
- No se autoriza merge ni producción en esta fase.
- La dependencia directa Tailwind queda fijada a `3.4.17`; el repositorio no tenía previamente un lockfile raíz. CI y Deploy Preview son obligatorios antes de proponer promoción.
