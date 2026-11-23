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

## Cierre que sigue pendiente

Esta evidencia no permite marcar terminado el objetivo global por sí sola.
Quedan por cerrar con evidencia live separada: una captura autenticada de
escritorio; las rutas completas de Caja, Compras (recepción/albarán/factura),
Inventario (mermas/caducidad/ajustes) y Acceso/MFA/expiración. Plataforma ya
queda observada en QA, aunque sus operaciones destructivas no se ejercitaron.
Los contratos estructurales y la batería local siguen siendo necesarios y no
se sustituyen por esta revisión manual.
