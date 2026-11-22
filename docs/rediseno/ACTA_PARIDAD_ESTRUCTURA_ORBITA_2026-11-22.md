# Acta · paridad de estructura y organización Órbita · 22/11/2026

## Motivo

La maqueta y la suite real compartían paleta y parte del shell, pero no la
misma organización de experiencia. La maqueta agrupa el trabajo por áreas
operativas; la aplicación real seguía mostrando grupos históricos como
«Ventas», «Finanzas y análisis» y «Sistema». Esa diferencia hacía que el
producto pareciera otra aplicación aunque los datos y los permisos fueran
correctos.

## Cambio aplicado

En `fuente.js` y en su espejo
`source-recovery/fuente-recuperado.js`, la distribución de navegación cuando
el diseño activo es `orbita` pasa a ser:

| Orden | Área visible en Órbita | Grupos reales incluidos |
|---:|---|---|
| 1 | Inicio | Inicio |
| 2 | Servicio | Ventas, TPV, Cocina, Encargos y Clientes |
| 3 | Caja y fiscalidad | Cuentas por pagar, libro de IVA, arqueo y tesorería |
| 4 | Compras | Proveedores, pedidos, recepción, albaranes y facturas |
| 5 | Inventario | Almacén, producción y mermas |
| 6 | Equipo | Personal, turnos, fichajes y nóminas |
| 7 | Calidad | Control sanitario y aceite |
| 8 | Informes | Resultados, reportes y rotación, estacionalidad |
| 9 | Organización | Locales y configuración |
| 10 | Sistema | Auditoría, respaldos, notificaciones y errores del sistema |

La agrupación solo cambia el primer nivel visual. Se conservan los ids de
las pantallas, las capacidades `ABC_*`, los handlers de navegación, la
selección de empresa/local y la lógica de cada módulo. Las variantes `claro`
y `sello` mantienen sus agrupaciones específicas.

## Contratos ejecutados

```text
MARCO_ORBITA_CONTRACT=PASS (27/27)
REDISENO_COMPONENTES_ORBITA_CONTRACT=PASS
REDISENO_MIGRACION_MODULOS_CONTRACT=PASS módulos=12 shell=12 responsive=PASS tactil=44
git diff --check = PASS
```

El contrato del marco incluye ahora una aserción de que la distribución
Órbita contiene `Servicio`, `Caja y fiscalidad`, `Compras`, `Inventario`,
`Equipo`, `Calidad`, `Informes`, `Organización` y `Sistema`, y que el espejo
de recuperación conserva exactamente la misma definición.

## Límites y siguiente evidencia

- La organización se ha corregido en la fuente de la rama
  `rediseno/f0-base-qa`; no se ha tocado producción.
- La comprobación de datos, permisos y rutas sigue siendo la del programa
  real: QA conserva `QA Empresa A, S.L.`, sus locales y sus membresías.
- En el Deploy Preview 225, con `QA Empresa A, S.L. · Local A1`, se verificó
  live en móvil el menú «Más»: aparecen los diez rótulos de la maqueta y sus
  destinos reales; la barra inferior mantiene Inicio, Resultados y Arqueo de
  caja, y Pase conserva sus estados y accesos operativos.
- Las pantallas que no son producto real o están bloqueadas por backend siguen
  clasificadas en `MATRIZ-CIERRE-VISUAL-ORBITA-2026-11-22.csv`; esta corrección
  no las inventa ni cambia su alcance.

## Estado

Implementación de la organización Órbita: **aplicada, publicada y verificada
en el preview 225** con el commit `be7532d3` (código `fb53b58e`). La evidencia
live cubre el recorrido móvil; la cobertura de escritorio queda respaldada
por el contrato responsive y la revisión visual de shell, pendiente de una
captura autenticada de escritorio si se necesita una prueba fotográfica.

La revisión posterior del shell añade las etiquetas de zona `Operación` y
`Administración` en el lateral de escritorio, igual que la maqueta. El shell y
la hoja visual se publican con las marcas de caché `qa-orbita-shell-v21-20261122`
y `qa-orbita-modules-v69-20261122`; contrato del marco: `28/28 PASS`.

La página independiente `restablecer-contrasena.html` también apunta a la
misma marca de apariencia, evitando que el acceso de recuperación quede con
otra escala visual. La batería completa `tests/rediseno/*.mjs` queda en
`ALL_REDISENO_TESTS_PASS` y `git diff --check` permanece limpio.

### Plantillas y estados comunes · revisión 22/11/2026

La capa `la-plantillas-orbita.js` queda en versión semántica 2. Además de
marcar la plantilla principal de cada uno de los 12 módulos y las subplantillas
de formulario, tabla, detalle y cola, etiqueta los estados que ya emite el
producto: `vacio`, `carga`, `error` y `estado`. Las marcas
`data-la-orbita-state` y las clases `la-orbita-state-*` son aditivas: no crean
datos, no cambian handlers ni sustituyen componentes. Permiten que la misma
regla de Órbita se aplique a estados equivalentes aunque una pantalla histórica
use una clase distinta.

La caché del recurso queda fijada como
`qa-orbita-plantillas-v2-20261122`; el contrato P01 fija su huella y obliga a
actualizarla si la capa cambia. La batería de plantillas comprueba 10 plantillas,
12 módulos, ausencia de RPC y la presencia de los cuatro estados comunes.

### Auditoría visual autenticada adicional · móvil 390×844 · 22/11/2026

En el Deploy Preview 225, con `QA-EMP-A / QA-A1` y la sesión de propietario
ya existente, se recorrieron sin escribir datos: Inicio con el panel Pase
«El turno en directo», TPV, Cocina, Clientes, Proveedores (Compras), Productos
(Inventario), Personal, Configuración y Arqueo de caja. En todos se conservó
la cabecera Órbita, la navegación inferior, el selector `Local A1`, el estado
QA, Buscar, Avisos, Perfil y Apariencia.

La evidencia visible confirmó además las composiciones que exige la maqueta:
TPV separa el resumen de ventas del botón «Ver historial completo» y muestra
catálogo con paginación; Clientes expone vistas guardadas, filtros, ficha,
NIF enmascarado y paginación; Cocina muestra el estado vacío de comandas; Caja
separa apertura, movimientos y «Historial de arqueos»; Configuración agrupa
sus pestañas por bloques; Inventario conserva la tabla real con sus acciones
Kardex/Editar/Registrar salida; Personal usa fichas repetibles de empleado.

No se ejecutaron cobros, reembolsos, aperturas, cambios de configuración ni
operaciones de inventario. En TPV se observó el dato de ensayo existente
`operation_id_conflict` en el QR fiscal pendiente; es un estado de QA previo,
no una mutación de esta revisión. Plataforma requiere una cuenta de
administrador específica y Acceso/MFA requiere una sesión separada, por lo que
ambas superficies siguen abiertas en la matriz. Esta pasada es evidencia real
de composición móvil, pero no sustituye la captura de escritorio ni el cierre
por estado de cada fila.

### Plataformas previas y recuperación · marcas de plantilla · 22/11/2026

Las dos superficies que no pasan por el contenedor React también quedan
inscritas en la misma organización visual. `plataforma-panel.js` marca sus
raíces como módulo `plataforma` (plantilla `configuracion`) y
`restablecer-contrasena.html` marca la recuperación como módulo `acceso`
(plantilla `formulario`, móvil común). Conservan sus raíces, handlers,
permisos, persistencia y rutas propias; la marca solo permite que la capa de
plantillas, estados y responsive las trate igual que al resto de la suite.

La recuperación se abrió en el Deploy Preview 225 el 22/11/2026 y se
comprobó visualmente sin mutación: tarjeta Órbita, logo, correo, acción
primaria y retorno visibles, sin overflow ni controles pequeños. No se envió
ningún enlace ni se alteró ninguna cuenta. Plataforma queda pendiente de la
sesión de administrador específica; su composición está cubierta por contrato
y por la marca de plantilla, pero no se inventa una prueba autenticada.

### Auditoría de composición en escritorio · 22/11/2026

Se abrió el Deploy Preview 225 con sesión QA autenticada en `QA-EMP-A / QA-A1`
con viewport 1440×900. La misma cabecera y navegación Órbita permanecen
visibles al cambiar de ruta: logo y contexto de empresa/local, distintivo QA,
Buscar, Avisos, Perfil y Apariencia; el menú lateral conserva las áreas
`Operación`, `Servicio`, `Caja y fiscalidad`, `Compras`, `Inventario`,
`Equipo`, `Calidad`, `Informes`, `Organización` y `Sistema`.

Rutas comprobadas sin mutación de datos: Inicio/Pase, TPV, Cocina, Clientes,
Arqueo de caja, Proveedores, Productos, Personal y Configuración. En todas se
observó el mismo shell y la misma jerarquía Órbita; además se verificaron las
composiciones específicas: catálogo y sala del TPV, estado vacío de Cocina,
vistas guardadas/filtros/NIF en Clientes, apertura-movimientos-historial en
Caja, ficha de proveedor, tabla real de Inventario, fichas repetibles de
Personal y pestañas agrupadas de Configuración. No se pulsaron acciones que
escriben datos.

Esta evidencia cierra la comprobación visual del shell en escritorio, pero no
convierte automáticamente en `CERRADA_QA` las filas funcionales: Plataforma
continúa requiriendo una sesión de administrador y Acceso/MFA una sesión
separada. También queda pendiente completar el cierre individual de los 12
módulos con sus estados de carga/error/vacío y sus variantes móvil/escritorio
según la matriz.
