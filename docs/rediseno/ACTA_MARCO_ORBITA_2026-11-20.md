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
- El shell identifica la ruta activa con `data-la-orbita-route` y la superficie
  operativa con `data-la-orbita-surface`. TPV, Pase, Cocina, Caja y las vistas
  generales pasan por la misma raíz de contenido, lo que permite aplicar el
  mismo tratamiento tipográfico y de espaciado sin duplicar componentes.
- Las vistas generales reciben un encabezado Órbita homogéneo (jerarquía,
  subrayado de acento y separación) y las cuatro superficies operativas quedan
  marcadas para que sus reglas no dependan de encabezados históricos.

## Evidencia estática

- `MARCO_ORBITA_CONTRACT=PASS (19/19)`.
- `MARCO_ORBITA_RUTAS_CONTRACT=PASS (20 rutas)`.
- `REDISENO_P01_CAPAS_Y_MIGRACIONES_OK=1 capas=7 migraciones=2`.
- `REDISENO_P05_PROPUESTAS_OK=1 disenos=9 paletas=6 rumbo=PASS pase=PASS responsive=PASS reduced_motion=PASS`.
- `REDISENO_ORG33_SALA_CONTRACT=PASS`.
- `REDISENO_P03_BOTONES_SOLO_ICONO_OK=1 solo_icono=3 mudos=0`.
- `SOURCE_RECOVERY_CHECK=PASS`.
- `git diff --check` sin salida.

## Evidencia live · Deploy Preview 225

- Commit final de esta tanda: `9d132d72f996c54177f48cb14031b301b2570f05`.
- Deploy Netlify: `6b00b373ce91b4e9db365e88`, estado `ready`.
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
marco estructural; esta tanda deja cubierta la identificación y composición
común de las superficies que todavía tenían raíces visuales distintas.
