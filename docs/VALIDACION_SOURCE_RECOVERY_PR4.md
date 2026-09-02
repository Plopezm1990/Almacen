# Validación del source recovery contra PR #4

**Fecha:** 2 de septiembre de 2026  
**Rama de fuente recuperada:** `recuperacion-fuente`  
**Head documentado:** `5ba86a6d46f843b9385fb07de36cde6fe19b0c1d`  
**Bundle de referencia:** PR #4 / `preparacion-sin-netlify`

Este documento complementa la sección 8 de `PROYECTO_A_ESTADO_TECNICO.md` y deja constancia de la validación más reciente del código recuperado.

## 1. Paridad exacta

Se regeneró `source-recovery/fuente-recuperado.js` a partir del `fuente.js` validado del PR #4.

- Bundle de referencia: **5.427.505 bytes**.
- Cuerpo de aplicación comparado en cada lado: **1.118.121 bytes**.
- SHA-256 del cuerpo en ambos lados: `03962de3bb9ae5ab6889f20bd772e422097d8ffd895c8e4ded06a9e7f1a76356`.
- Resultado: **`PARIDAD_EXACTA_PR4=1`**.
- Blob Git exacto validado de `source-recovery/fuente-recuperado.js`: `c43d24f861452ba722a8a07fdd44f71513767b3b`.

La lógica recuperada actual coincide exactamente con el cuerpo de aplicación del bundle preparado; no es una reconstrucción aproximada.

## 2. Build reproducible

Con las dependencias ya fijadas en `source-recovery/package-lock.json` se ejecutó una instalación limpia y la cadena completa:

```bash
npm ci
npm run check
npm run build
node --check dist/fuente.js
```

Resultado:

- instalación limpia correcta;
- `fuente-recuperado.js` y `entrada-recuperada.js` pasan `node --check`;
- esbuild genera correctamente el bundle para navegador;
- bundle recompilado: **5.065.205 bytes**;
- se conservan `GestionAlmacen`, `crearLogicaCaja`, `SelectorLocalInformes` y `ErroresSistema`;
- resultado: **`BUILD_PR4_RECUPERADO_OK=1`**.

## 3. Seguridad incluida

El build funcional final se realizó usando el `edge-auth-patch.js` actual del PR #4. Antes del smoke de navegador se comprobó que el bundle recompilado contiene:

- la lógica que utiliza `obtener_contexto_operativo`;
- la carga de `seleccion-neutral-patch.js`.

Resultado: **`SEGURIDAD_INCLUIDA_EN_BUILD=1`**.

`entrada-recuperada.js` mantiene explícitamente el grafo:

```js
import "../edge-auth-patch.js";
import "./fuente-recuperado.js";
```

De esta forma la seguridad ya no depende accidentalmente del nombre de un chunk generado por esbuild.

## 4. Smoke integral en Chromium

Se construyó un sitio temporal con todos los archivos del PR #4 y se sustituyó únicamente `fuente.js` por el bundle recompilado desde `source-recovery`.

La prueba se ejecutó en Chromium headless con:

- contexto de navegador limpio para cada módulo;
- service worker bloqueado;
- Supabase interceptado para impedir acceso o modificación de datos reales;
- datos ficticios en almacenamiento local.

En cada sesión se comprobó:

- entrada correcta por **“Trabajar solo en este equipo, sin sincronizar”**;
- `window.storage` disponible;
- `window.__nubeActiva === false` en modo local;
- cero errores JavaScript nuevos;
- `#root` renderizado;
- cero peticiones a Supabase.

Se recorrieron los **38 módulos** del smoke completo del PR #4.

Resultado final:

- **`MODULOS_OBJETIVO=38`**
- **`MODULOS_OK_TOTAL=38`**
- **`FALLOS=[]`**
- **`SMOKE_FUENTE_RECUPERADO_PR4_OK=1`**

## 5. Estado y decisión

La rama `recuperacion-fuente` conserva ya una base recompilable que:

- tiene paridad exacta con el cuerpo de aplicación del bundle validado del PR #4;
- compila desde una instalación limpia;
- incluye la capa de seguridad actual;
- supera el mismo recorrido integral de 38 módulos.

Esto permite considerar **cerrada la recuperación técnica del código fuente como base mantenible**.

No significa que deba sustituirse inmediatamente el `fuente.js` de producción. La adopción como fuente oficial debe realizarse dentro del despliegue controlado pendiente, una vez estabilizado Netlify y completadas las pruebas reales de roles y del negocio.
