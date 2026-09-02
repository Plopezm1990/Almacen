# Fuente recuperado — Proyecto A

Este directorio preserva una base **recompilable** de la aplicación extraída del `fuente.js` preparado.

## Qué es

- La sección marcada por esbuild como `// fuente.jsx`, separada de las dependencias empaquetadas.
- Conserva nombres de funciones, comentarios y lógica de negocio.
- El JSX original no puede recuperarse exactamente porque no existe source map; quedó transformado a `React.createElement`.
- Los nombres temporales creados por el compilador (`p2`, `s2`, etc.) tampoco se pueden reconstruir con certeza al nombre original.
- `entrada-recuperada.js` restaura explícitamente una dependencia de arranque que el build histórico ocultaba dentro de un chunk: la barrera de seguridad de `edge-auth-patch.js`.

## Paridad comprobada

Se comparó byte por byte el cuerpo de la sección original `// fuente.jsx` del bundle con el cuerpo de `fuente-recuperado.js`, excluyendo únicamente el bootstrap de dependencias que fue sustituido por imports normales.

- Bytes comparados en cada lado: **1.117.758**.
- SHA-256 de ambos cuerpos: `6110b1d1a8a9eeda453cf2387ee2c2b75d6acae76da4c9d1eb6759679e4b3804`.
- Resultado: **PARIDAD_EXACTA=1**.

Por tanto, la lógica recuperada no es una reescritura aproximada: el cuerpo conservado es exactamente el mismo que estaba dentro del bundle preparado.

## Grafo de arranque recuperado

El build histórico empezaba así:

```text
fuente.js
 ├─ chunk-WNPC2SID.js
 ├─ chunk-43ACCR2P.js
 └─ chunk-CZ7CSFO4.js
      └─ edge-auth-patch.js
           └─ seleccion-neutral-patch.js
```

`chunk-CZ7CSFO4.js` no aportaba lógica de negocio propia relevante; su efecto lateral importante era:

```js
import "./edge-auth-patch.js";
```

Al recompilar inicialmente solo la sección `// fuente.jsx`, ese efecto lateral se perdía. La aplicación seguía funcionando, pero faltaban la barrera local por rol, el guard de perfiles inactivos y la capa neutral de selección.

La recuperación definitiva lo hace explícito en `entrada-recuperada.js`:

```js
import "../edge-auth-patch.js";
import "./fuente-recuperado.js";
```

Así la seguridad deja de depender del nombre o existencia de un chunk generado accidentalmente por esbuild.

## Qué se comprobó

### Compilación

- 0 identificadores externos sin resolver tras restaurar imports.
- Compilación correcta con esbuild para navegador.
- `node --check` correcto tanto en el fuente recuperado como en el bundle generado.
- Se conservan marcadores esenciales como `GestionAlmacen`, `crearLogicaCaja` y `SelectorLocalInformes`.
- El build de referencia terminó correctamente (`SOURCE_RECOVERY_OK=1`).

### Navegador

Se compararon el build histórico y el recuperado en Chromium, con Supabase bloqueado para impedir cualquier acceso o modificación de datos reales.

Resultado final del smoke test completo:

- barrera de contexto por rol activa en ambos;
- guard de perfil inactivo activo en ambos;
- `seleccion-neutral-patch.js` activo en ambos;
- `window.storage.get` protegido en ambos;
- cero peticiones a Supabase en modo local;
- cero errores JavaScript;
- cero claves `almacen:*` creadas artificialmente al arrancar con almacenamiento vacío;
- indicador idéntico: **“Guardado en este equipo”**;
- texto inicial local idéntico;
- navegación validada en `Productos`, `Pedidos`, `Resultados` y `Libro de IVA`;
- texto idéntico en todas esas pantallas;
- resultado: **`SMOKE_RECUPERACION_COMPLETA_OK=1`**.

La única diferencia visual técnica observada es de **86 caracteres de HTML** dentro de SVG de iconos Lucide. No modifica textos, navegación ni comportamiento y se debe a que la versión original exacta de `lucide-react` no queda identificada inequívocamente dentro del bundle; la recuperación usa una versión de compatibilidad validada.

## Dependencias

Versiones confirmadas directamente dentro del bundle original:

- `react`: **18.3.1**
- `react-dom`: **18.3.1**
- `@supabase/supabase-js`: **2.112.4**
- `xlsx`: **0.18.5**
- `jspdf`: **4.2.1**

`lucide-react` y `jspdf-autotable` no exponen una cadena de versión inequívoca dentro del bundle. Las versiones fijadas en `package-lock.json` son las versiones de compatibilidad con las que la recuperación fue compilada y validada correctamente; no se presentan como versiones originales demostradas.

## Uso

```bash
npm ci
npm run check
npm run build
```

El resultado se genera en `dist/fuente.js`.

`edge-auth-patch.js` y `seleccion-neutral-patch.js` siguen siendo parte del runtime del proyecto. El primero queda incluido por el build a través de `entrada-recuperada.js`; el segundo continúa cargándose dinámicamente desde la raíz del sitio, igual que en el comportamiento validado actual.

## Importante

Esta es una **base de recuperación y mantenimiento validada**, pero todavía no se debe sustituir automáticamente el `fuente.js` de producción. Antes de convertirla en fuente oficial deben completarse el smoke test integral del negocio, la revisión final de permisos/roles y el despliegue controlado pendiente de Netlify.
