# Fuente recuperado — Proyecto A

Este directorio preserva una base **recompilable** de la aplicación extraída del `fuente.js` preparado.

## Qué es

- La sección marcada por esbuild como `// fuente.jsx`, separada de las dependencias empaquetadas.
- Conserva nombres de funciones, comentarios y lógica de negocio.
- El JSX original no puede recuperarse exactamente porque no existe source map; quedó transformado a `React.createElement`.
- Los nombres temporales creados por el compilador (`p2`, `s2`, etc.) tampoco se pueden reconstruir con certeza al nombre original.

## Paridad comprobada

Se comparó byte por byte el cuerpo de la sección original `// fuente.jsx` del bundle con el cuerpo de `fuente-recuperado.js`, excluyendo únicamente el bootstrap de dependencias que fue sustituido por imports normales.

- Bytes comparados en cada lado: **1.117.758**.
- SHA-256 de ambos cuerpos: `6110b1d1a8a9eeda453cf2387ee2c2b75d6acae76da4c9d1eb6759679e4b3804`.
- Resultado: **PARIDAD_EXACTA=1**.

Por tanto, la lógica recuperada no es una reescritura aproximada: el cuerpo conservado es exactamente el mismo que estaba dentro del bundle preparado.

## Qué se comprobó

- 0 identificadores externos sin resolver tras restaurar imports.
- Compilación correcta con esbuild para navegador.
- `node --check` correcto en el bundle generado.
- Se conservan marcadores esenciales como `GestionAlmacen`, `crearLogicaCaja` y `SelectorLocalInformes`.
- El build de referencia generado durante la recuperación terminó correctamente (`SOURCE_RECOVERY_OK=1`).

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

## Importante

Esto es una **base de recuperación y mantenimiento**, no se debe sustituir todavía el `fuente.js` de producción. Aunque la lógica tiene paridad exacta y recompila correctamente, antes de convertirla en fuente oficial hace falta una comparación funcional en navegador y una prueba integral de la aplicación.
