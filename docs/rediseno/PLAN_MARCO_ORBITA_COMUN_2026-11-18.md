# Marco común Órbita · plan y cierre técnico · 18/11/2026

## Objetivo

Convertir Órbita en el único marco estructural de la aplicación autenticada:
cabecera superior, navegación lateral de escritorio, navegación inferior móvil,
contexto de empresa/local, búsqueda global, perfil, avisos, estado QA y entrada
de Apariencia. Las propuestas y paletas siguen pudiendo cambiar el contenido y
los tokens visuales; no cambian la arquitectura de navegación.

## Hallazgo que se corrige

La aplicación tenía dos marcos incompatibles. `SidebarGrupos` sustituía el
lateral por `CabeceraClaro` cuando la propuesta era `claro`, y `BuscadorRumbo`
solo se montaba para `rumbo`. Así una misma ruta podía cambiar de cabecera,
menú y posición del buscador al cambiar de propuesta.

## Implementación

- `la-orbita-shell.js` observa el contenedor React existente y lo normaliza sin
  duplicar handlers, permisos ni llamadas de negocio.
- La cabecera común expone contexto empresa/local, distintivo `QA` o
  `Producción`, búsqueda Ctrl/Cmd-K, avisos, Perfil y Apariencia.
- El lateral de escritorio conserva los botones React originales. En `claro`
  se convierte la navegación desplegable existente en un lateral Órbita; la
  cabecera antigua queda neutralizada.
- El lateral se puede plegar y abrir con estado persistente por dispositivo.
- La barra inferior móvil existente queda en la tercera fila del mismo marco;
  el encabezado móvil antiguo se neutraliza para evitar dos cabeceras.
- El selector común reutiliza el `select` de contexto real cuando está
  presente. Si la pantalla no expone selector de empresa/local, informa dónde
  está el selector operativo en vez de inventar un cambio de contexto.
- El lanzador flotante duplicado de Apariencia se oculta cuando el marco común
  está activo; la acción de cabecera llama al mismo `LAApariencia.abrirEditor`.
- El modo TPV a pantalla completa conserva su excepción explícita: oculta la
  cabecera para no tapar caja y productos, pero mantiene la navegación de caja
  y sus permisos sin cambios.

## Contrato de cierre

`tests/rediseno/marco-orbita-contract.mjs` comprueba 12 condiciones: carga,
cabecera/QA, neutralización de `claro`, plegado, selector, Ctrl/Cmd-K, avisos,
Apariencia, navegación móvil, grid responsive, tratamiento de búsqueda y
objetivo táctil.

La comprobación de paridad `source-recovery/recuperar_candidato.py --check`
continúa siendo obligatoria: esta fase es una capa aditiva fuera del bundle y
no altera `fuente.js` ni `fuente-recuperado.js`.

## Alcance y excepciones explícitas

- Incluye todas las rutas que se renderizan dentro de `#root` tras iniciar
  sesión, incluyendo TPV, Pase, Cocina, Caja, Organización e Inventario.
- Las pantallas independientes de acceso, MFA, recuperación de contraseña,
  impresión y el modo TPV de caja a pantalla completa no usan el shell de la
  aplicación autenticada; quedan fuera por diseño y conservan sus contratos.
- No se ejecutan cobros, reembolsos ni escrituras de negocio en esta fase.

## Evidencia prevista

- Preview de QA del PR #225, sin producción.
- Viewports: 1440×900, 1024×768, 430×932, 390×844 y 320×700.
- `MARCO_ORBITA_CONTRACT=PASS`, batería de contratos, paridad de source-recovery
  y `git diff --check`.
