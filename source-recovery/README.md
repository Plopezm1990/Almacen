# Fuente recuperado — Proyecto A

Este directorio preserva una base **recompilable** de la aplicación extraída del `fuente.js` preparado.

## Qué es

- La sección marcada por esbuild como `// fuente.jsx`, separada de las dependencias empaquetadas.
- Conserva nombres de funciones, comentarios y lógica de negocio.
- El JSX original no puede recuperarse exactamente porque no existe source map; quedó transformado a `React.createElement`.
- Los nombres temporales creados por el compilador (`p2`, `s2`, etc.) tampoco se pueden reconstruir con certeza al nombre original.
- `entrada-recuperada.js` restaura explícitamente una dependencia de arranque que el build histórico ocultaba dentro de un chunk: la barrera de seguridad de `edge-auth-patch.js`.

## Paridad comprobada con el bundle validado del PR #4

La recuperación fue actualizada usando el `fuente.js` preparado y validado del PR #4 (`preparacion-sin-netlify`). Se comparó byte por byte el cuerpo de la sección `// fuente.jsx` del bundle con el cuerpo de `fuente-recuperado.js`, excluyendo únicamente el bootstrap de dependencias sustituido por imports normales.

- Bundle de referencia: **5.427.505 bytes**.
- Bytes comparados en cada lado del cuerpo de aplicación: **1.118.121**.
- SHA-256 del cuerpo en ambos lados: `03962de3bb9ae5ab6889f20bd772e422097d8ffd895c8e4ded06a9e7f1a76356`.
- Resultado: **`PARIDAD_EXACTA_PR4=1`**.
- Blob Git validado de `source-recovery/fuente-recuperado.js`: `c43d24f861452ba722a8a07fdd44f71513767b3b`.

Por tanto, la lógica recuperada actual no es una reescritura aproximada: el cuerpo conservado coincide exactamente con el cuerpo de aplicación del bundle del PR #4 validado.

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

### Compilación reproducible

Con las dependencias fijadas en `package-lock.json` se ejecutó:

```bash
npm ci
npm run check
npm run build
node --check dist/fuente.js
```

Resultado:

- instalación limpia correcta;
- `node --check` correcto en `fuente-recuperado.js` y `entrada-recuperada.js`;
- compilación correcta con esbuild para navegador;
- `node --check` correcto en el bundle generado;
- marcadores esenciales conservados (`GestionAlmacen`, `crearLogicaCaja`, `SelectorLocalInformes`, `ErroresSistema`);
- bundle recompilado de referencia: **5.065.205 bytes**;
- resultado: **`BUILD_PR4_RECUPERADO_OK=1`**.

### Seguridad incluida en el build recompilado

Para la prueba funcional final se compiló la fuente recuperada usando el `edge-auth-patch.js` actual del PR #4. Antes de abrir el navegador se comprobó que el bundle recompilado contiene tanto la llamada a `obtener_contexto_operativo` como la carga de `seleccion-neutral-patch.js`.

Resultado: **`SEGURIDAD_INCLUIDA_EN_BUILD=1`**.

### Smoke integral de navegación en Chromium

Se construyó un sitio temporal con todos los archivos del PR #4 y se sustituyó únicamente su `fuente.js` por el bundle recompilado desde `source-recovery`.

La prueba se ejecutó en Chromium headless, con una sesión limpia para cada módulo, service worker bloqueado y Supabase interceptado para impedir cualquier acceso o modificación de datos reales. En cada pantalla se comprobó que:

- aparece y funciona la entrada **“Trabajar solo en este equipo, sin sincronizar”**;
- `window.storage` está instalado;
- el modo local deja `window.__nubeActiva === false`;
- no aparecen errores JavaScript nuevos;
- `#root` permanece renderizado;
- no se realiza ninguna petición a Supabase en modo local.

Se recorrieron los **38 módulos** del menú:

`Panel general`, `Buscar`, `Proveedores`, `Pedidos`, `Recepción`, `Albaranes`, `Cuentas por pagar`, `Facturas`, `Productos`, `Historial de producto`, `Inventario ciego`, `Saldo de almacén`, `Mapa de almacén`, `Traspasos`, `Venta rápida`, `Encargos`, `Clientes`, `Devoluciones`, `Fichas de costo`, `Producción`, `Mermas`, `Etiquetas y catálogo`, `Resultados`, `Reportes y rotación`, `Libro de IVA`, `Arqueo de caja`, `Tesorería`, `Estacionalidad`, `Personal`, `Registro horario`, `Cuadrante de turnos`, `Coste de personal`, `Control sanitario`, `Aceite de freidoras`, `Auditoría`, `Respaldos`, `Errores del sistema` y `Locales`.

Resultado final:

- **`MODULOS_OBJETIVO=38`**
- **`MODULOS_OK_TOTAL=38`**
- **`FALLOS=[]`**
- **`SMOKE_FUENTE_RECUPERADO_PR4_OK=1`**

Esto demuestra que la fuente recuperada actualizada reproduce correctamente el bundle preparado del PR #4 para el recorrido integral disponible en modo local y conserva la capa de seguridad actual.

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

## Estado actual

La fuente recuperada ya está actualizada al bundle validado del PR #4, tiene paridad exacta del cuerpo de aplicación, compila desde una instalación limpia y ha superado el smoke integral **38/38** con la seguridad actual incluida.

Aun así, **no se sustituye automáticamente el `fuente.js` de producción**. La incorporación como fuente oficial debe hacerse dentro del despliegue controlado pendiente, después de estabilizar Netlify y completar las pruebas reales de roles y el smoke final del negocio con usuarios autorizados.
