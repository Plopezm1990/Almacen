# Acta de cierre del objetivo 4 · Migración visual Órbita

Fecha: 21/11/2026  
Rama: `rediseno/f0-base-qa`  
PR: #225, borrador  
Producción: sin cambios

## Resultado

La implementación visual del objetivo 4 queda **terminada** para los doce
módulos de L&A Suite: Inicio, TPV, Pase, Cocina, Caja, Clientes, Compras,
Inventario, Personal, Configuración, Plataforma y Acceso. Todos reciben el
shell Órbita, la escala común, los componentes normalizados, los estados
semánticos, el responsive y el suelo táctil de `44 × 44 px`.

## Evidencia

- Recorrido autenticado de escritorio en QA-EMP-A/A1 para Inicio/Pase, TPV,
  Cocina, Clientes, Productos, Personal, Configuración, Caja, Proveedores y
  Plataforma.
- Auditoría automatizada con viewport `320×844`, `390×844` y `430×932` para
  nueve rutas operativas: en todos los casos `overflow=false` y mínimo
  interactivo `44 px`.
- Capturas móviles aportadas por el usuario para Acceso, MFA y Plataforma:
  login en una columna, MFA sin modal duplicado y tarjetas administrativas
  apiladas sin desbordamiento horizontal.
- Cierre de sesión móvil comprobado y documentado.
- La integración MFA queda corregida: React es la única puerta visible y el
  parche histórico ya no monta un overlay sobre el QR/formulario.

## Pruebas

La batería `tests/rediseno/*.mjs` pasa completa, incluidos componentes,
marco (24/24), rutas (20/20), migración modular (12/12), responsive, táctil,
P01/P03/P05, org-33, fiscalidad TPV, propina, apariencia local (49/49),
política MFA (26/26), arranque resiliente y paridad. `git diff --check` está
limpio.

El runner Bash de la batería general de CI no se pudo lanzar en este entorno
Windows porque no hay `bash.exe` disponible; no se interpreta como fallo del
producto. Los contratos Node reproducibles son los que se ejecutaron y
pasaron.

## Separación de alcance

Este acta cierra la **migración visual**. La matriz funcional conserva
`PARCIAL` donde aún faltan pruebas de negocio que no deben inventarse como
evidencia visual:

- estados reales de carga/vacío/error que no aparecen en una navegación normal;
- operaciones con escritura (cobros, reembolsos, arqueos, permisos y acciones
  administrativas) que requieren autorización explícita;
- pruebas de persistencia o aislamiento entre sesiones cuando la ruta lo exija;
- recorridos funcionales específicos de Plataforma y Acceso/MFA.

No se ejecutaron esas operaciones durante esta tanda, no se usó `sis-13`, no
se restauró QA y no se tocó producción.

## Último cambio

La evidencia móvil de Acceso, MFA y Plataforma quedó publicada en el commit
`b348cf0d` de `rediseno/f0-base-qa`. El PR #225 sigue en borrador.

## Cierre funcional posterior · punto 2 · 21/11/2026

El propietario de QA confirma que la validación funcional de TPV, Pase, Cocina,
Caja, Clientes, Compras, Inventario, Personal, Configuración, Plataforma y
Acceso funciona correctamente, incluidos recuperación, MFA, expiración y
selección de local. El cierre detallado está en
`QA_PUNTO2_CIERRE_FUNCIONAL_2026-11-21.md`.

El acta pasa a considerar el punto 2 **CERRADO por aceptación del propietario**.
Las salvedades y marcas históricas `PARCIAL` se conservan para trazabilidad y
no reabren el punto. No se autoriza por ello ninguna nueva operación financiera
ni se modifica producción.

## Cierre global del objetivo · verificación final · 21/11/2026

La verificación final se ejecutó sobre `rediseno/f0-base-qa` después del cierre
operativo de QA-A1. Los doce módulos quedan migrados al shell Órbita y el
Punto 2 funcional queda cerrado por aceptación del propietario. La sesión A1
`b0255efb-664d-4e8e-9dd9-a0ae0c59e0c2` quedó además en `CERRADA_FINAL`; A2
conserva la cobertura Q08 de dos terminales.

### Batería final reproducible

Se ejecutaron todos los scripts `tests/rediseno/*.mjs`: **18 scripts, 0
fallos**. Quedan acreditados `marco-orbita 24/24`, `marco-orbita-rutas 20/20`,
`migracion-modulos 12/12`, `apariencia 49/49`, `MFA 26/26`, `org-33`,
fiscalidad TPV, propina/cambio, arranque resiliente, paridad, estados y
componentes. `git diff --check` pasa y el árbol de trabajo queda limpio.

El runner Bash general de CI no se pudo lanzar en este Windows porque no hay
`bash.exe`; no es un fallo del producto. La batería Node reproducible sí se
ejecutó completa y pasó. No se tocó `sis-13`, no se restauró QA, no se fusionó
el PR #225 y producción permanece intacta.

### Estado de cierre por módulo

| Módulo | Estado | Evidencia principal |
|---|---|---|
| Inicio y panel general | Cerrado | shell Órbita, panel, estados y móvil |
| TPV y sala | Cerrado | venta rápida, sala, cuentas, mesas, tickets y Q08 |
| Pase | Cerrado | estados de sala, enlace a TPV y cola de cocina |
| Cocina | Cerrado | cabecera, estaciones, estados, filtros y estados sin ruta |
| Caja | Cerrado | cobro, reembolso, arqueo, cierre final A1/A2 y documentos QA |
| Clientes | Cerrado | listado, filtros, ficha, actividad, vistas y NIF |
| Compras | Cerrado | proveedores, pedidos, recepción, albaranes y facturas |
| Inventario | Cerrado | productos, movimientos, mermas, caducidad y ajustes |
| Personal | Cerrado | empleados, cargos, permisos, turnos y fichajes |
| Configuración | Cerrado | empresa, locales, terminales, equipos, fiscalidad y apariencia |
| Plataforma | Cerrado | paneles administrativos y revisión móvil |
| Acceso | Cerrado | login, recuperación, MFA, expiración y selección de local |

### Excepciones que permanecen documentadas

Las marcas históricas `PARCIAL` de la matriz no se borran: conservan el
camino de cada tanda anterior. Las salvedades no bloqueantes son la mejora
futura de paginación/búsqueda de la cola Pase y el bookkeeping pendiente de
migraciones de Apariencia. No reabren el objetivo ni alteran su cierre.

**Resultado:** objetivo 4 Órbita terminado en QA. El último SHA de la rama es
`9258f2222429c7e377c0afdd20b66feaa21d7876`; PR #225 sigue en borrador.

## Auditoría y retirada de CSS antiguo · 21/11/2026

Como continuación del cierre visual se inspeccionaron las capas que todavía
podían sobrescribir Órbita. La retirada se hizo por superficie, sin reescribir
la lógica del producto:

1. Inicio (`dashboard-premium-v2.js`) quedó sin `!important` ni colores HEX
   directos; todos sus componentes visuales usan tokens semánticos y la
   escala común.
2. Pase (`la-pase.css`) dejó radios, gaps, márgenes y paddings literales en
   favor de `--la-space-*` y `--la-radius-*`. Solo quedan tres sobrescrituras
   de estado, explícitamente limitadas a la variante Órbita para neutralizar
   estilos inline históricos.
3. Plataforma (`plataforma-panel.js`) dejó de producir estilos inline de
   layout/ocultación. El panel usa clases tokenizadas y conserva sus RPC,
   permisos, diálogos y flujo de administración.
4. La hoja común mantiene los puentes legacy estrictamente necesarios para
   MFA, la cabecera antigua y los estados inline de Inventario. No se
   presentan como componentes nuevos: están anotados, acotados a la superficie
   Órbita y cubiertos por contrato.

La caché se renovó (`la-apariencia` v68, `la-pase` v3, panel v5). El nuevo
contrato `tests/rediseno/css-orbita-legacy-contract.mjs` registra la frontera:
`dashboardImportant=0`, `paseImportant=3`, `plataformaInline=0` y 45 puentes
inline documentados. P01, componentes, marco y `git diff --check` pasan.
Los fallbacks HEX de tokens y las composiciones de las otras propuestas se
conservan como excepciones intencionadas; no sobrescriben el marco cuando
Órbita está activo.

**Estado:** retirada/aislamiento CSS antiguo cerrada para el marco Órbita. La
limpieza futura de los puentes MFA/Inventario queda como trabajo de sustitución
del componente histórico, no como regla visual activa sin documentar.

## Revisión móvil transversal · 21/11/2026

Se cierra la revisión móvil como sistema, no como una colección de parches por
pantalla. Las doce superficies (`inicio`, `tpv`, `pase`, `cocina`, `caja`,
`clientes`, `compras`, `inventario`, `personal`, `configuracion`, `plataforma` y
`acceso`) reciben la plantilla móvil Órbita y el shell común. En 390×844 se
verificó la familia de rutas de producto con `overflow=false` y objetivos
táctiles de 44 px; 1440×900 queda como regresión de escritorio. El mismo
contrato cubre cabecera compacta, navegación inferior, menús agrupados,
tablas como fichas, filtros, acciones visibles, formularios por bloques,
diálogos al ancho disponible y estados vacío/carga/error.

Pase deja de presentar una limitación opaca: además del límite visual de ocho
filas, la cola tiene búsqueda accesible por texto sobre los datos cargados. No
se añadió una consulta ni se modificó el destino de ningún botón. La paginación
ampliada de la Cocina sigue siendo la pantalla de listado completa, no una
duplicación dentro del panel.

Evidencia y controles:

- `REDISENO_MOVIL_RECORRIDOS_ORBITA_CONTRACT=PASS modulos=12 shell=PASS pase-busqueda=PASS overflow=PASS touch=44`.
- Contrato de plantillas: 10 plantillas, 12 módulos, sin RPC ni handlers nuevos.
- Contrato de capas: marcas CDN renovadas para `la-pase.css` y `la-pase-panel.js`.
- `git diff --check=PASS`; producción no se toca y PR #225 permanece en borrador.

La cobertura de marco visual no sustituye la evidencia funcional autenticada:
las capacidades de Caja, Plataforma y permisos siguen remitiendo a sus actas
QA respectivas. No se inventan datos ni recorridos para las vistas que solo
pertenecen a la maqueta.

## Fase de plantillas reutilizables y cobertura de pantallas · 21/11/2026

Se incorporó `la-plantillas-orbita.js` como registro único de composición.
Las pantallas reales no se duplican para cada propuesta: el registro asigna
una plantilla de panel, listado, ficha, formulario, tabla, detalle, TPV,
cola-operativa, configuración y móvil a cada superficie. Las subraíces
(`form`, `table`, `dialog` y colas) reciben su subplantilla de forma aditiva.
No se modificaron handlers, rutas, RPC, datos, permisos ni la paridad de
`source-recovery`.

La asignación estática es 12/12 módulos y el contrato exige que la capa no
contenga `fetch`, Supabase ni llamadas RPC. `la-tablas-fichas.js` sigue siendo
la única capa que convierte cabeceras reales en etiquetas móviles; no se
reimplementó por pantalla.

La auditoría de vistas sin capa nueva queda cerrada por decisión: recuperación
de contraseña está cubierta por Acceso/formulario; Plataforma, Equipos y las
funciones fiscales están cubiertas por sus superficies reales; Impresión de
receta y prueba de impresora/cajón son capacidades dentro de Inventario o
Configuración; Bizum y pantalla para cliente quedan fuera como futuras
integraciones sin backend QA. No se añadieron pantallas falsas para satisfacer
el recuento de la maqueta.

La revisión móvil queda expresada como sistema: navegación inferior y cabecera
del shell, formularios por bloques, tablas con fichas, filtros desplegables,
diálogos acotados al viewport, controles de 44 px y encapsulado del overflow.
El contrato de plantillas verifica los diez tipos, los doce módulos, la
ausencia de RPC y el comportamiento móvil; el recorrido QA funcional de cada
capacidad permanece separado y no se da por hecho por una marca visual.

La publicación de esta fase queda en `b008bc6c583042740337aeaf02d9f7935401a575`.
Netlify la dejó lista en el Deploy Preview 225 (`6b021314756178af22771d3a`).
La comprobación del navegador mostró Acceso interactivo, `overflow=false` y
control mínimo de 44 px; producción no fue modificada y el PR sigue en borrador.
