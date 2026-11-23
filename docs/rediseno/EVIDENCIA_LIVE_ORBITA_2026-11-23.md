# Evidencia live · estructura Órbita en QA · 23/11/2026

## Alcance

Comprobación de solo lectura en el Deploy Preview 225, rama
`rediseno/f0-base-qa`, con sesión autenticada de QA-EMP-A / Local A1. No se
crearon cuentas, no se abrió caja, no se cobró y no se modificó configuración.

## Entorno observado

- URL: `https://deploy-preview-225--chic-entremet-9107cf.netlify.app/?cache=mobile-nav-v72c-20261122`
- Vista servida: `window.innerWidth=758`, `window.innerHeight=678`,
  `devicePixelRatio=1.25`.
- Shell raíz: `.la-orbita-shell`.
- Cabecera móvil: `.la-orbita-legacy-mobile`; barra inferior con `Inicio`,
  `Sala`, `Caja`, `Resultados` y `Más`.
- Cabecera común visible: selector de local, estado `QA`, búsqueda global,
  avisos, perfil y botón `Apariencia`.

## Evidencia observada

### Organización y navegación

El menú `Más` muestra las áreas compartidas de Órbita y sus destinos reales:

`SERVICIO`, `CAJA Y FISCALIDAD`, `COMPRAS`, `INVENTARIO`, `EQUIPO`, `CALIDAD`,
`INFORMES`, `ORGANIZACIÓN` y `SISTEMA`.

La navegación conserva los destinos funcionales del producto: Cocina,
Clientes, Proveedores, Recepción, Albaranes, Facturas, Productos, Personal,
Registro horario, Locales, Configuración, Auditoría, Respaldos,
Notificaciones y Errores del sistema. No se observó una ruta ficticia ni un
enlace que sustituyera el handler real.

### Inicio / Pase

El inicio mostró el panel `El turno, en movimiento`, los indicadores de
ventas, margen, pedidos y stock, el bloque `Pendientes del día` y el panel
Pase `El turno en directo`. El panel Pase mostró el estado honesto de caja
cerrada y los accesos `Abrir TPV`, `Ver cocina`, `Revisar caja`, `Fichar` y
`Recepciones`, sin inventar mesas ni comandas.

### Cocina

La ruta mostró `Cocina y comandas`, filtro de estación, aviso de caja cerrada,
estado de carga inicial y, tras resolverlo, estado vacío `No hay comandas para
este filtro`. Esto confirma la plantilla de cola y los estados de advertencia,
carga y vacío dentro del shell común.

### Clientes

La ruta mostró las vistas guardadas `Todos`, `Particulares`, `Empresas` y
`Activos`, búsqueda, filtros de estado y tipo, ficha, actividad vacía,
anonimización, NIF enmascarado (`••••678Z`) y paginación `1–2 de 2 clientes`.

### Compras

La ruta de Proveedores mostró la plantilla de listado/ficha, proveedor
pendiente de revisar, NIF/CIF, datos de contacto, condiciones y acciones
`Editar` / `Marcar como revisado`.

### Inventario

La ruta de Productos mostró búsqueda, filtros por tipo y departamento, tabla
responsive con stock, coste, PVP, IVA, margen, ABC y acciones `Kardex`,
`Editar`, `Registrar salida` y `Eliminar producto`. También se vieron estados
de stock bajo y productos eliminados.

La ruta `Mermas` mostró filtros por periodo y motivo, totales del periodo,
desglose por motivo y tres registros QA persistidos (lote, autoconsumo y merma
manual), con sus cantidades y valores a coste. La pantalla se observó sin
registrar una nueva merma.

### Caja y compras operativas

`Caja` mostró la apertura de sesión, fondo inicial, arqueo, efectivo esperado,
otras ventas, movimientos y ajustes, contado por denominaciones, notas e
historial. La sesión no se abrió ni se guardó un arqueo en esta comprobación.

`Recepción de mercancía` mostró el estado vacío honesto `No hay pedidos
pendientes de recibir`. `Entrada de albaranes` mostró tres albaranes QA con
proveedor, fecha, líneas, base, IVA y total, junto a las acciones `Ver`,
`Anular para editar` y `Eliminar`; no se pulsó ninguna. `Facturas` mostró el
resumen mensual con base, IVA, total y el estado vacío `No hay facturas
confirmadas en este mes`, sin crear factura.

### TPV y sala

El TPV real se recorrió en móvil con Local A1 seleccionado. La composición
incluye el selector de modo (`Venta rápida` / `Sala-restaurante`), terminal
del navegador, búsqueda F2, categorías, rejilla de productos, paginación,
Sala y mesas, cobro F4, estado fiscal QA y resumen de ventas. La pantalla
mostró correctamente el aviso de que el terminal no tiene una sesión de caja
abierta y mantuvo las acciones de cobro deshabilitadas mientras no exista esa
sesión. No se cobró ni se modificó la cuenta durante este recorrido.

Desde los `Accesos del turno` de Pase se pulsó `Abrir TPV` y la navegación
llegó a la vista TPV del mismo Local A1, conservando el terminal y la
superficie de sala/cobro. No se abrió una cuenta nueva ni se cobró; la
comprobación se limitó al salto y a la lectura del destino.

### Cocina y Caja · comprobación visual adicional

En Cocina se confirmó la jerarquía `Cocina y comandas` → aviso de caja cerrada
→ apertura requerida → gestión avanzada de estaciones → cola de comandas. La
cola queda en estado vacío (`No hay comandas para este filtro`) cuando no hay
datos, y el botón de apertura se mantiene visible sin ejecutarlo.

En Caja se confirmó la composición `Arqueo de caja` → apertura de sesión →
fecha y efectivo esperado → movimientos y ajustes → efectivo contado →
denominaciones → notas → guardar arqueo → historial. Los controles respetan la
escala táctil y no se abrió la sesión ni se guardó el arqueo.

### Personal

La ruta mostró la plantilla de empleados con altas, bajas, vacaciones,
historial, EPI, exportación de datos, edición y creación de cuenta de acceso.
También se observaron cargos reales de QA (`Encargado`, `Cajero/a` y
`Camarero/a`) sin abrir diálogos ni cambiar permisos.

### Configuración

La ruta mostró la ficha `QA Empresa A, S.L. · Local A1`, el aviso de que los
cambios quedan auditados y los bloques de Día y cajas, Sala y mesas,
Modalidades, Equipos, Terminales y cajas, Fiscalidad y AEAT, Cargos y
permisos, Permisos y Verificación en dos pasos. Los campos y botones se
mantuvieron sin editar.

## Resultado de esta tanda

- Shell y organización móvil: **PASS observado**.
- Cocina: **PASS observado** para advertencia, carga y vacío.
- Clientes: **PASS observado** para filtros, ficha, NIF y paginación.
- Compras / Proveedores: **PASS observado** para listado y ficha.
- Inventario / Productos: **PASS observado** para tabla, filtros y acciones.
- Inventario / Mermas: **PASS observado** para filtros, totales, motivos y
  persistencia de los registros QA existentes.
- Caja: **PASS observado** para la estructura de apertura, arqueo, movimientos
  e historial; la operación de apertura/cierre no se repitió.
- Compras / Recepción, Albaranes y Facturas: **PASS observado** para estados
  vacíos, listados, resumen fiscal y acciones disponibles; no se ejecutaron
  nuevas escrituras.
- TPV / Sala: **PASS observado** para modos de venta, terminal, búsqueda,
  categorías, paginación, sala, cobro y resumen; caja cerrada mantenida como
  estado honesto.
- Personal: **PASS observado** para ficha, cargos y acciones de empleado.
- Configuración: **PASS observado** para bloques de empresa/local y seguridad.
- Plataforma: **PASS observado** para panel administrativo, suelo táctil y
  salto Plataforma ↔ aplicación.
- No se realizaron escrituras ni operaciones financieras.

### Plataforma

Con la cuenta administradora `owner.a@qa.invalid` se verificó el panel
`Plataforma · L&A Suite` en el mismo preview. El panel mostró 11 empresas
activas y 1 desactivada, con sus locales, usuarios, dueños y acciones
administrativas. Los controles mantuvieron el suelo táctil mínimo de 44 px.
No se pulsaron `Desactivar`, `Reactivar`, `Eliminar para siempre`, `Añadir
dueño` ni `Dar de alta una empresa`.

El botón `Abrir mi aplicación` llevó al programa real con empresa y local
seleccionables (`QA Empresa A, S.L. · Local A1`), shell Órbita y la pestaña
`← Plataforma`. El retorno confirma la separación de privilegios y la
integración de la superficie externa sin copiar datos ni cambiar handlers.

### Acceso y MFA

Desde `Configuración → Verificación en dos pasos` se comprobó la pantalla de
seguridad con una sesión de plataforma autenticada. La interfaz informa que
la cuenta tiene la verificación en dos pasos activa y que el acceso requiere
un código de seis cifras de la aplicación autenticadora. También muestra de
forma explícita que la migración de la política por cargo todavía no está
aplicada en este entorno y que esa política será obligatoria para
Propietario, Encargado y Cajero/a. La comprobación fue de lectura: no se
añadió, eliminó ni verificó ningún factor MFA y no se cerró ninguna sesión.

### Comparación directa con la maqueta Órbita

Se comparó la pantalla `Panel general · L&A Suite · Órbita` de la maqueta
(`index.html#/screen/ini-01?propuesta=7`) con Inicio del programa real en el
preview. La cabecera, selector de empresa/local, búsqueda, avisos, perfil,
botón Apariencia y navegación inferior están presentes en ambos. La brecha
restante es de composición y no de datos: la maqueta ordena tres indicadores
operativos y después dos bloques paralelos (`Pulso de ventas` y `Pendientes
del día`), mientras que el programa real conserva cuatro indicadores
(`Ventas registradas`, `Margen promedio`, `Pedidos pendientes` y `Productos en
stock bajo`) y añade el bloque operativo Pase (`Plano de sala`, estado de caja,
pedidos en servicio y accesos del turno). La información real no debe
eliminarse; el siguiente ajuste debe reordenarla dentro de la misma jerarquía
visual de la maqueta, llevando margen/stock a un bloque secundario y dejando
la operación de Pase como la superficie operativa enlazada.

Tras la comparación se aplicó una corrección acotada en los dos artefactos de
fuente (`fuente.js` y `source-recovery/fuente-recuperado.js`): Órbita separa
los tres primeros indicadores en la región `Indicadores principales` y pasa
cualquier indicador adicional —por ejemplo margen o stock— a
`Indicadores secundarios`. Así la jerarquía coincide con la maqueta sin
perder ningún dato, permiso, ruta ni handler. La segunda región usa los mismos
controles, estados y objetivo táctil; en móvil se apila sin scroll horizontal.
La hoja añade el estilo de esa región y en escritorio conserva tres columnas
para los indicadores principales. Contratos CSS, shell y recorridos móviles
pasan tras el ajuste.

También se compactó en móvil la tarjeta de contexto de Inicio: Empresa y Local
se mantienen como selectores operativos en dos columnas y el texto de ámbito
ocupa la fila completa. Esto aproxima la composición de la maqueta sin quitar
el selector del programa real.

La corrección de caché quedó registrada con la marca `qa-orbita-modules-v74-20261123`
en `index.html` y `restablecer-contrasena.html`, junto con la huella fijada en
el contrato P01. Así el preview no puede servir una copia anterior de la hoja
Órbita después de un cambio visual.

## Cierre que sigue pendiente

Esta evidencia no permite marcar terminado el objetivo global por sí sola.
Quedan por cerrar con evidencia live separada: una captura autenticada de
escritorio; las rutas completas de Caja, Compras (recepción/albarán/factura),
Inventario (mermas/caducidad/ajustes) y el recorrido de Acceso (login,
recuperación, expiración y desafío MFA). La pantalla de política MFA y el
panel de Plataforma ya quedan observados en QA, aunque sus operaciones
destructivas y el desafío de seis cifras no se ejercitaron. Los contratos
estructurales y la batería local siguen siendo necesarios y no se sustituyen
por esta revisión manual.
