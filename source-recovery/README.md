# Fuente recuperado — Proyecto A

Este directorio preserva una base **recompilable** de la aplicación extraída del `fuente.js` preparado.

## Qué es

- La sección marcada por esbuild como `// fuente.jsx`, separada de las dependencias empaquetadas.
- Conserva nombres de funciones, comentarios y lógica de negocio.
- El JSX original no puede recuperarse exactamente porque no existe source map; quedó transformado a `React.createElement`.
- Los nombres temporales creados por el compilador (`p2`, `s2`, etc.) tampoco se pueden reconstruir con certeza al nombre original.

## Qué se comprobó

- 0 identificadores externos sin resolver tras restaurar imports.
- Compilación correcta con esbuild para navegador.
- `node --check` correcto en el bundle generado.
- Se conservan marcadores esenciales como `GestionAlmacen`, `crearLogicaCaja` y `SelectorLocalInformes`.

## Uso

```bash
npm ci
npm run build
```

El resultado se genera en `dist/fuente.js`.

## Importante

Esto es una **base de recuperación y mantenimiento**, no se debe sustituir todavía el `fuente.js` de producción. Antes hace falta una comparación funcional y una prueba integral de la aplicación.
