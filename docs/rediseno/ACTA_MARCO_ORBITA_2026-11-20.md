# Acta · marco Órbita común · 20/11/2026

## Alcance de esta iteración

Se reanudó el objetivo de convertir Órbita en el único marco visual de la
aplicación autenticada. La capa sigue siendo aditiva: no se modifican los
handlers de negocio, permisos, contratos de TPV ni datos de QA.

## Cambios realizados

- El selector de empresa/local del encabezado ahora identifica únicamente el
  selector operativo real, evitando confundirlo con formularios ajenos.
- Cuando una pantalla no expone ese selector, el mismo menú ofrece «Abrir
  Panel general» y vuelve a abrir el selector allí, sin inventar empresas ni
  locales.
- El menú de contexto marca la opción activa con `aria-checked` y mantiene
  áreas táctiles de 44 px.
- Perfil, seguridad, tema, modo empleado y cierre de sesión se reúnen en un
  único menú de cabecera y ejecutan los handlers originales.
- Los controles duplicados que permanecían en el bloque antiguo del lateral
  se neutralizan visualmente; no se eliminan sus handlers.
- Se actualizaron las marcas de caché de `la-orbita-shell.js` y
  `la-apariencia.css` para impedir que el CDN sirva la versión anterior.

## Evidencia estática

- `MARCO_ORBITA_CONTRACT=PASS (16/16)`.
- `REDISENO_P01_CAPAS_Y_MIGRACIONES_OK=1 capas=7 migraciones=2`.
- `REDISENO_P05_PROPUESTAS_OK=1 disenos=9 paletas=6 rumbo=PASS pase=PASS responsive=PASS reduced_motion=PASS`.
- `REDISENO_ORG33_SALA_CONTRACT=PASS`.
- `REDISENO_P03_BOTONES_SOLO_ICONO_OK=1 solo_icono=3 mudos=0`.
- `SOURCE_RECOVERY_CHECK=PASS`.
- `git diff --check` sin salida.

## Evidencia live · Deploy Preview 225

- Commit: `3d99c877bc95668cc0b31500bccfcad585b8f187`.
- Deploy Netlify: `6b00add0a3705b197069f1f2`, estado `ready`.
- URL: https://deploy-preview-225--chic-entremet-9107cf.netlify.app
- La pestaña autenticada monta `.la-orbita-shell`, cabecera, lateral y barra
  inferior; muestra el distintivo `QA` y no presenta `#error-arranque`.
- El selector global abrió y mostró `Todos los locales`, `Local A1` y
  `Local recuperado`.
- El menú de perfil mostró `Cuenta y seguridad`, `Cambiar tema`, `Modo
  empleado` y `Cerrar sesión`.
- En viewport `390×844`: cabecera visible, lateral oculta, barra inferior
  visible y `document.documentElement.scrollWidth === innerWidth`.
- No hubo errores ni advertencias de consola durante la prueba.

## Estado y límites

El marco común queda operativo en la base de QA. La vista TPV de caja a
pantalla completa conserva su excepción documentada para no tapar el ticket y
los productos; no se ejecutaron cobros, reembolsos ni escrituras de negocio.
La revisión visual pantalla por pantalla continúa después de cerrar este
marco estructural.
