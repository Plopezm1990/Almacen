# PM27 — C16 Defecto L: E2E post-hotfix

Fecha: 2026-09-13
Baseline técnico corregido: `b3d37a4cf2fdc37f66d862948a5894dfbc66b0be`
Rama de auditoría: `claude/pm27-c16-e2e-post-hotfix`

## 1. Contrato del caso

C16 no puede cerrarse mediante una simulación estática ni por repetir C14/C15. El criterio histórico vinculante exige **una operación real de prefiltro realizada desde la UI post-hotfix** y prohíbe afirmar que se probó si no existe evidencia de esa operación.

La evidencia mínima para un PASS futuro debe identificar de forma trazable:

- SHA/versión exacta servida por la UI;
- entorno utilizado;
- identidad QA/autenticada autorizada;
- empresa/local efectivos;
- acción real de creación de prefiltro desde la UI;
- respuesta del backend/RLS;
- fila creada y posteriormente limpiada si el entorno es QA;
- ausencia de escritura en producción cuando la prueba sea no productiva.

## 2. Estado vivo verificado antes de probar

### Producción Netlify

El despliegue productivo actual del sitio `chic-entremet-9107cf` está `ready` y sirve la rama `release` en el commit:

`a97740987be57aa9646f6a06e69b2230f140ec5f`

Ese commit corresponde al hotfix PM26 de contexto de prefiltros.

### Producción Supabase

Lectura únicamente:

- `public.prefiltros_candidatos`: 0 filas;
- último `creado_en`: `NULL`.

Por tanto, ejecutar el E2E real sobre producción implicaría crear datos reales. Las reglas vinculantes de Proyecto A prohíben esa escritura sin autorización específica para producción.

### QA Supabase

Lectura únicamente:

- `public.prefiltros_candidatos`: 0 filas;
- último `creado_en`: `NULL`.

QA sería el destino correcto para una prueba destructible/limpiable, pero hace falta una UI post-hotfix que apunte a QA.

### Deploy Preview disponible

PR #38 sigue abierto/draft/no-merge y su HEAD es:

`f297be08708d0bbe566c21347123885cb3095a7c`

Ese PR pertenece a PM26 P07c y no es el candidato post-hotfix corregido `b3d37a4c...`. Por tanto, no puede utilizarse como evidencia válida de C16 post-hotfix.

Crear un nuevo PR/Deploy Preview del candidato o cambiar Netlify para generar una UI QA post-hotfix sería una acción adicional de despliegue/configuración no autorizada en este caso.

## 3. Por qué no se sustituye por pruebas locales

C14 ya demostró el comportamiento de caché/contexto del cliente y C15 ya demostró la autoridad RLS real con lectura viva + reproducción aislada. Repetir esas pruebas no demuestra el requisito adicional de C16: **UI real -> petición real -> backend real -> persistencia observable**.

También se descarta declarar PASS basándose únicamente en:

- unit/integration tests del wrapper `fetch`;
- `curl` directo al REST;
- inserciones SQL manuales;
- reproducción PostgreSQL local;
- inspección del bundle o del despliegue.

Cualquiera de esas vías omite la operación real desde la interfaz.

## 4. Bloqueo actual

No existe en este momento un camino que cumpla simultáneamente:

1. UI post-hotfix exacta;
2. backend QA;
3. sesión autenticada QA utilizable desde la UI;
4. cero escrituras en producción;
5. cero cambios de Netlify/PR sin autorización específica.

Por tanto, C16 no es PASS ni FAIL funcional. Su estado correcto es:

**BLOCKED_EXTERNAL / PENDIENTE_CONFIRMACION**

No se ha creado ningún prefiltro, no se ha modificado QA/producción, no se ha cambiado Netlify y no se ha tocado `main`, `release` ni PR #38.

## 5. Desbloqueo requerido

Para reabrir y cerrar C16 en PASS se necesita una de estas dos vías autorizadas:

- **Preferida:** Deploy Preview/entorno QA que sirva el candidato post-hotfix exacto y esté conectado exclusivamente a Supabase QA, con acceso autenticado disponible para ejecutar y limpiar un prefiltro sintético.
- **Alternativa de mayor riesgo:** autorización específica para realizar una única operación sintética de prefiltro desde la UI productiva y posterior limpieza trazable en producción. Esta vía no se ejecutará por defecto.

## 6. Resultado

`PM27_C16_E2E_REAL=NO_EJECUTADO`

`PM27_C16_RESULTADO=BLOCKED_EXTERNAL`

`PM27_C16_ESTADO_HISTORICO=PENDIENTE_CONFIRMACION`

`PM27_C16_PRODUCCION_ESCRITURAS=0`

`PM27_C16_QA_ESCRITURAS=0`

Este bloqueo no debe convertirse en PASS hasta obtener la evidencia E2E real descrita arriba.
