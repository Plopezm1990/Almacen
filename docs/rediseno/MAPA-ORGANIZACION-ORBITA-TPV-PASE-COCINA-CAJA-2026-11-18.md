# L&A Suite · Mapa de organización Órbita · TPV, Pase, Cocina y Caja

Fecha: 18/11/2026  
Rama: `rediseno/f0-base-qa` · PR #225 en borrador  
Criterio elegido: **Órbita como propuesta predeterminada y parecido exacto con la maqueta**.

## Objetivo

La apariencia no se limita a recolorear las pantallas. En esta tanda se reorganiza el marco de operación para que TPV, Pase, Cocina y Caja compartan la misma jerarquía visual de Órbita:

- cabecera contextual con empresa, local, entorno QA y terminal;
- título de pantalla y estado operativo claramente separados;
- acciones primarias visibles, con icono Lucide y texto;
- tarjetas de datos con cristal/carbono, coral para la acción principal y azul acero para información;
- columna principal para el trabajo y columna secundaria para contexto/resumen;
- navegación móvil por tareas, no una copia comprimida del menú de escritorio;
- movimientos y transiciones solo cuando no se haya elegido movimiento reducido.

La lógica de negocio, permisos, RPC, fiscalidad y estados no cambia por el rediseño.

## Marco común de Órbita

### Ordenador y tablet

1. **Chrome lateral**: marca L&A, empresa/local, distintivo `QA / Producción`, navegación agrupada y usuario.
2. **Barra superior contextual**: título del módulo, terminal activo, búsqueda Rumbo y acciones de seguridad.
3. **Lienzo principal**: encabezado de pantalla, resumen de estado y contenido de trabajo.
4. **Panel lateral de contexto** cuando la tarea lo necesite: cuenta actual, cola, caja o alertas.

En TPV el panel de ticket y cuenta permanece a la derecha. En Cocina el panel de filtros/estación queda arriba y la cola ocupa el lienzo. En Caja el resumen del turno ocupa la parte superior y el arqueo/operaciones la parte inferior.

### Móvil

1. Cabecera compacta con local, terminal y estado de conexión.
2. Un solo título visible y una acción principal.
3. Tarjetas apiladas, sin tablas anchas ni columnas invisibles.
4. Barra inferior de cinco tareas: **Inicio, TPV, Pase/Cocina, Caja, Más**.
5. Los filtros y cambios de estación se abren como panel inferior o selector de pantalla completa.

El suelo táctil sigue siendo 44×44 px. La barra inferior no se usa en modo TPV de caja a pantalla completa.

## Mapa de las cuatro pantallas prioritarias

| Área | Componente actual | Organización Órbita objetivo | Escritorio | Móvil |
|---|---|---|---|---|
| TPV | `VentaRapida` / `tpv-layout` | Cabecera “Venta activa”, selector de modo, rejilla de productos a la izquierda y ticket/cuenta persistente a la derecha | `minmax(0,1fr) + 380px`, ticket sticky | Productos por categorías; ticket en panel inferior; acción “Guardar / Cobrar” siempre visible |
| Pase | `la-pase-panel.js` / panel de servicio | Plano y cola en el mismo lienzo, filtro de zona arriba, acciones exactas a TPV/Cocina/Caja y aviso explícito de destino | Plano + cola en dos columnas | Zona como selector, mesas como tarjetas, cola acotada y acceso a Cocina/TPV desde cada tarjeta |
| Cocina | `CocinaA10` | Cabecera con estación/estado, filtros por estado y tarjetas de comanda con línea de tiempo | Cola de comandas en tarjetas, acciones de estado en la tarjeta | Una comanda por tarjeta, filtros horizontales y acción de estado fija en la zona inferior |
| Caja | `ArqueoCaja` | Resumen del turno, medios de pago, diferencia y acciones de apertura/arqueo/cierre en bloques separados | Resumen superior + arqueo y movimientos en dos columnas | Resumen apilado, formulario de contado/denominaciones y cierre en pasos confirmables |

## Contratos que no se pueden perder

### TPV

- Contexto de local concreto; nunca abrir TPV en “Todos los locales”.
- Terminal activo y modo de venta visibles.
- Destinos de Pase deben transportar `mesaId`, `cuentaId` y `operatingDay`.
- Mientras se resuelve una cuenta destino, cobro y venta rápida permanecen bloqueados.
- Si la cuenta no es recuperable, el aviso debe ser visible; no se conserva silenciosamente la cuenta previa del terminal.

### Pase

- Estados permitidos: `LIBRE`, `OCUPADA`, `RESERVADA`, `BLOQUEADA`, `FUERA_SERVICIO`.
- La cola no inventa comandas ni estados.
- Si la lista está limitada, se muestra el límite y se ofrece Cocina o una futura paginación/búsqueda.
- Un enlace debe abrir la cuenta solicitada o explicar por qué no puede abrirse.

### Cocina

- La comanda debe conservar pedido, estación, estado, notas, opciones y versión.
- Las transiciones siguen la máquina server-side; el rediseño no habilita estados nuevos.
- Reimpresión y resolución de merma mantienen sus permisos actuales.

### Caja

- Apertura, arqueo, cierre, diferencias, movimientos y reembolsos mantienen las RPC y permisos existentes.
- Camarero/a no recibe controles de caja por efecto del estilo.
- No se ejecutan cobros, reembolsos ni cierres nuevos durante la reorganización sin autorización explícita.

## Qué significa “parecido exacto”

Se conservarán de la maqueta de Órbita:

- carbón `#17191C`, superficie `#202328`, acero `#929DA7` y coral `#FF4B32`;
- titular degradado y jerarquía tipográfica;
- tarjetas con cristal, borde fino y acento superior;
- iconografía de línea;
- entradas suaves y línea que sigue al puntero en escritorio;
- reducción automática de movimiento;
- composición de dos columnas en trabajo operativo.

Se adaptarán solo los elementos que la maqueta no puede conocer:

- datos reales de la cuenta, mesa, comanda o caja;
- permisos y estados server-side;
- longitud de nombres, tickets y mensajes de error;
- teclado, lector, impresión y accesibilidad.

## Orden de implementación

1. Crear el marco contextual compartido para las cuatro áreas.
2. Ajustar TPV, porque es el origen de los destinos de Pase y Cocina.
3. Ajustar Pase y repetir los tres destinos: fila con cuenta sin mesa, fila obsoleta y cuenta del día actual.
4. Ajustar Cocina y comprobar que una comanda enviada desde TPV conserva su ruta y estado.
5. Ajustar Caja sin ejecutar operaciones económicas nuevas; solo abrir vistas, comprobar estados y usar fixtures ya existentes.
6. Medir 1440×900, 1024, 430, 390 y 320 px.
7. Actualizar matriz, acta y traspaso con capturas/evidencia del preview.

## Criterio de cierre visual

Una pantalla no se marca como alineada con Órbita solo porque usa los colores. Debe tener el marco común, la misma jerarquía de acciones, el comportamiento responsive, los estados visibles, los controles accesibles y una comparación visual aprobada en ordenador y móvil.

## Decisión pendiente mínima

La propuesta de este documento aplica **Órbita también al marco de Pase**. El panel operativo de Pase conservará sus estados y datos, pero adoptará la cabecera, tarjetas, coral, acero y navegación de Órbita. Si se quiere conservar la estética verde especializada de Pase dentro del panel, debe tratarse como una excepción explícita y no como el diseño predeterminado.

## Addendum · marco común implementado · 18/11/2026

El punto 1 del orden de implementación queda ejecutado en la capa compartida
`la-orbita-shell.js`: todas las rutas autenticadas dentro de `#root` reciben la
misma cabecera, lateral de escritorio, barra móvil, contexto, búsqueda, avisos,
estado QA y Apariencia. La propuesta `claro` ya no conserva su cabecera superior
alternativa; su navegación se presenta en el lateral Órbita y mantiene los
handlers originales. El plan, las excepciones y el contrato de cierre están en
`docs/rediseno/PLAN_MARCO_ORBITA_COMUN_2026-11-18.md`.
