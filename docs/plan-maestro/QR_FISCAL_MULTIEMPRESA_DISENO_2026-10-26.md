# Fiscalidad configurable por empresa — C07-A

Fecha de investigación: 26/10/2026. Decisión de producto: Pedro solicita fiscalidad propia para cada empresa y su asesoría.

Estado: diseño e implementación local de borradores por emisor; pendiente de revisión CI, pantalla, ensayo QA y conexión fiscal. Este documento no acredita conformidad fiscal ni activa facturación.

## 1. Decisión de arquitectura

Cada empresa de L&A Suite mantiene sus entidades emisoras, su configuración, su asesoría y su vía de presentación. Una empresa de la aplicación puede tener varios emisores; los locales se vinculan a ellos. El NIF del obligado que expide la factura es independiente del NIF del presentador que autentica el envío.

La AEAT es el servicio común. Lo propio de cada empresa es la identidad tributaria bajo la que se factura y el título de representación con el que se envía. Un asesor puede representar a varias empresas, siempre con permisos y autorizaciones separados.

La Orden HAC/1177/2024 contempla sistemas que soportan varios obligados. Se deben separar datos y cumplir las obligaciones por cada uno. No basta con un selector visual de empresa. [BOE, artículo 2](https://www.boe.es/buscar/act.php?id=BOE-A-2024-22138#a2).

El panel deberá mostrar siempre el obligado activo y una indicación consultable de que el sistema soporta varios obligados, incluidos los que estén de baja. Antes de activar se resolverán emisores duplicados del mismo NIF: crear otra ficha o cambiar de empresa en la aplicación no podrá reiniciar silenciosamente una cadena del mismo SIF y obligado.

## 2. Hallazgos oficiales que determinan el diseño

### Identidad y transporte

Se admite usar el certificado cualificado de un tercero cuando actúa por representación, apoderamiento o colaboración social. Cada lote de envío debe contener registros del mismo obligado tributario. Por ello la cola se particiona por emisor y los permisos del presentador se verifican por representado. [AEAT, sistemas VERI*FACTU](https://sede.agenciatributaria.gob.es/Sede/iva/sistemas-informaticos-facturacion-verifactu/preguntas-frecuentes/sistemas-verifactu.html).

Tener el email de una asesoría no acredita representación. La colaboración social dispone de modelos distintos para empresa suministradora de software, profesional tributario y delegación de este al suministrador. Su evidencia se conserva según la vía aplicable; una invitación a L&A Suite no sustituye el título de representación ante AEAT. [AEAT, cumplimiento y delegación](https://sede.agenciatributaria.gob.es/Sede/iva/sistemas-informaticos-facturacion-verifactu/preguntas-frecuentes/cuestiones-generales-cumplimiento-delegacion.html).

### Cadenas y series

La cadena se define por SIF y obligado tributario; altas y anulaciones comparten esa cadena. Las series de factura son otra identidad. Abrir un local, cambiar de asesoría o iniciar un ejercicio no debe reiniciar la cadena arbitrariamente. Si varios terminales expiden de manera independiente, la definición de SIF exige evaluar esa organización antes de fijar sus cadenas. Para el servidor central de L&A Suite se propone autoridad única por instalación SIF y emisor; la operación offline independiente necesita otro diseño y prueba. [AEAT, trazabilidad](https://sede.agenciatributaria.gob.es/Sede/iva/sistemas-informaticos-facturacion-verifactu/preguntas-frecuentes/caracteristicas-requisitos-sif-trazabilidad.html).

### Modalidades y responsabilidad

VERI*FACTU y no VERI*FACTU son modalidades diferentes. Se recomienda implementar primero VERI*FACTU. Se podrá guardar la preferencia de no VERI*FACTU, pero solo se habilitará si la versión del producto implementa y acredita todos sus requisitos. No es un interruptor para dejar de enviar. [AEAT, modalidades](https://sede.agenciatributaria.gob.es/Sede/iva/sistemas-informaticos-facturacion-verifactu/cuestiones-generales/modalidades-cumplimiento-obligaciones.html).

La asesoría valida la situación del contribuyente. El productor mantiene la responsabilidad sobre la conformidad del programa y la declaración responsable por versión. No existe en este diseño una supuesta homologación automática de AEAT por recibir una factura. Tampoco es obligatorio contratar un proveedor fiscal externo: la integración puede ser directa si cumple los requisitos. [AEAT, certificación del sistema](https://sede.agenciatributaria.gob.es/Sede/iva/sistemas-informaticos-facturacion-verifactu/cuestiones-generales/certificacion-sistemas-informaticos_.html).

### Ámbito

La configuración debe distinguir territorio común, normativa foral y otros países, así como la situación SII. No se reutiliza el QR de AEAT para cualquier territorio. Una exclusión requiere motivo y evidencia; seleccionar «excluido» no habilita un motor fiscal alternativo. [AEAT, ámbitos de aplicación](https://sede.agenciatributaria.gob.es/Sede/iva/sistemas-informaticos-facturacion-verifactu/preguntas-frecuentes/cuestiones-generales-ambitos-aplicacion.html).

## 3. Configuración que tendrá cada empresa

Ruta prevista: Configuración → Fiscalidad y AEAT. Cabecera fija con empresa, emisor y NIF; al cambiar de empresa se vacían formulario y caché y se vuelve a leer del servidor.

| Apartado | Datos y comportamiento |
|---|---|
| Emisor | Razón social, NIF, país y domicilio fiscal; datos autoritativos en `entidades_fiscales`. Varios locales pueden usar el mismo emisor. |
| Ámbito | Jurisdicción, aplicación del RRSIF, situación SII y revisión fiscal. Valor inicial: pendiente. |
| Documentos | Tipo preferido, reglas de factura completa/simplificada y rectificativas. La elegibilidad se decide por operación, no solo por preferencia. |
| Series | Series por emisor y uso autorizado por locales. Contador del servidor; no editable libremente después de emitir. |
| Presentación | Directa por empresa, asesoría autorizada o proveedor integrado. Identidad del presentador separada del emisor. |
| Asesoría | Contacto, acceso explícitamente concedido y representación documentada por empresa. |
| Credenciales | Alta segura, titular, vigencia y referencia opaca; nunca descarga de clave privada desde el panel. |
| Estado | Borrador, validación pendiente, pruebas superadas, activo o bloqueado. La activación requiere una operación específica del servidor. |
| Seguimiento | Registros pendientes, aceptados, aceptados con errores y rechazados; última comunicación, causa y recuperación. |

Todo cambio de preferencias crea una revisión. La factura emitida conserva su snapshot de configuración y de emisor. Un cambio posterior de domicilio o asesoría no reescribe facturas antiguas.

No se fuerza factura simplificada en toda venta: primero se comprueba si la operación la permite, si exige datos del destinatario y cuál es el momento de expedición. Cobro, factura, devolución y rectificación son hechos relacionados pero distintos.

## 4. Vías de presentación

1. **Directa.** La empresa usa una credencial admitida para su propia presentación. Se verifica titular y vigencia antes del ensayo de conexión.
2. **Asesoría.** Se utiliza el certificado del presentador autorizado. Se comprueba la representación para ese emisor. Revocar acceso al panel y revocar representación tributaria son operaciones distintas.
3. **Proveedor.** Un adaptador versionado se integra con el proveedor elegido por la empresa. Cambiarlo exige verificar autoridad de numeración, representación, consulta de resultados y continuidad; nunca emitir desde dos autoridades simultáneas.

Que una asesoría reciba un Excel, PDF o email no equivale a remisión VERI*FACTU. El responsable de transmitir el registro debe estar claramente establecido antes de activar el circuito.

## 5. Lo que siempre garantiza el programa

Estas reglas no se ofrecen como preferencias de usuario:

- separación de datos, facturas, colas, credenciales y auditoría por empresa/emisor;
- comprobación del usuario y sus permisos en cada petición, también en reintentos;
- bloqueo de mezclas de obligados en lotes;
- endpoint oficial y entorno controlados por el adaptador, sin URL libre en el formulario;
- formato fiscal, hash, encadenamiento y numeración conforme al adaptador;
- identidad única de factura por emisor, serie y número según las reglas de facturación;
- protección de la versión de configuración frente a guardados concurrentes;
- idempotencia de emisión y envío; «respuesta desconocida» no autoriza otra factura;
- inmutabilidad de documentos y correcciones trazables;
- secreto de credenciales, minimización de logs y auditoría de accesos;
- rechazo de activación cuando el modo o territorio elegido no esté implementado.

La unicidad actual de C05 incluye local y tipo. Antes de usarla fiscalmente se deberá verificar que dos locales no pueden emitir la misma combinación legal de serie y número del mismo emisor. No se modifica C05 sin ese contrato y su migración específica.

## 6. Permisos y ciclo de cambios

- Propietario de empresa: configura borradores, invita a asesores y aprueba una solicitud de activación con permisos de empresa.
- Propietario limitado a un local: no cambia la configuración común de un emisor que comparten otros locales.
- Asesor: consulta o propone cambios solo con autorización explícita de esa empresa. Se diseñarán permisos `CONSULTAR`, `PROPONER` y `VALIDAR_SITUACION`, sin convertirlo en propietario global.
- Cajero: emite mediante el circuito validado; no modifica credenciales, régimen o series.
- Administrador de plataforma: consulta salud técnica mínima; no recibe automáticamente facultades de presentación tributaria.

Invitación con aceptación, caducidad, revocación y auditoría. Una misma cuenta de asesor puede atender varias empresas; cada concesión se resuelve en servidor. Los permisos de esta delegación todavía no están implementados en C07-A.

Una versión activa continúa usando su configuración aprobada mientras se prepara un nuevo borrador. Cambio de modo, certificado, proveedor o emisor exige transición explícita. Si se revoca o caduca una credencial, se conserva la cola y se activa el procedimiento documentado de incidencia; no se finge aceptación ni se reinicia el encadenamiento.

## 7. Credenciales y transporte

Las claves no se almacenan en `almacen_kv`, `localStorage`, el JSON de configuración, el repositorio, el historial de revisiones ni variables públicas. Se usará una custodia de secretos en servidor con referencias vinculadas al emisor y presentador, cifrado, rotación, revocación y control de acceso. El formulario verá solo metadatos seguros.

No se creará una variable de entorno distinta por empresa como única estrategia escalable. Los secretos del proyecto sirven para la infraestructura; las credenciales de cada empresa requieren su inventario y controles propios.

Deno documenta clientes HTTP con certificado y clave PEM. Eso no demuestra por sí mismo que la configuración concreta de Supabase Edge Functions soporte el transporte de AEAT en producción. Antes de elegir ese runtime se hará una prueba mTLS y SOAP en el entorno externo; si no sirve, se implementará un worker apropiado o un adaptador de proveedor. [Deno: cliente HTTP y mTLS](https://docs.deno.com/api/deno/fetch/), [Supabase: Edge Functions](https://supabase.com/docs/guides/functions).

Los registros se generan y confirman en transacción; una cola persistente entrega después al transportista. Es necesario tratar reinicios, rechazos, expiración, respuestas duplicadas y resultados desconocidos, conservando identificadores y evidencia.

## 8. QR tributario

El QR se genera a partir de la factura y su snapshot, con la identidad del emisor aunque envíe un asesor. El programa controla URL, codificación, tamaño y rótulos oficiales. La modalidad aprobada determina la variante de URL y las menciones. No se ofrece un campo «pegar QR fiscal» o «URL de Hacienda» por empresa.

Se validarán contenido, concordancia con la factura y lectura de pantalla/PDF en pruebas. La comprobación con la impresora real queda como aceptación de hardware posterior. Tener un QR escaneable no demuestra que el registro haya sido aceptado. [AEAT: especificaciones del QR](https://sede.agenciatributaria.gob.es/Sede/iva/sistemas-informaticos-facturacion-verifactu/informacion-tecnica/caracteristicas-qr-especificaciones-servicio-cotejo-factura.html).

## 9. Primera entrega implementada: C07-A

Migración local generada con CLI: `20261026175245_abc_fiscal_multiempresa_borradores.sql`.

Preflight específico de solo lectura: `QR_FISCAL_MULTIEMPRESA_PREFLIGHT_SOLO_LECTURA.sql`. La migración se excluye expresamente de la ventana histórica F7 del 3/10; no se incorpora de forma implícita a aquel paquete de promoción.

- Dos tablas privadas: borrador vigente y revisiones inmutables.
- Clave de alcance: empresa y entidad emisora, con FK compuesta.
- RPC `abc_fiscal_leer_borrador`: emisor autoritativo, versión, preferencias y estado.
- RPC `abc_fiscal_guardar_borrador`: versión esperada, operación UUID e historial idempotente.
- Datos admitidos: jurisdicción, sujeción, modalidad deseada, canal, representación declarada, tipo de factura, nombre/email de asesoría y NIF del presentador (formato, sin comprobación censal).
- Campos desconocidos o anidados rechazados. La RPC no admite credenciales, endpoints ni activación.
- `BORRADOR`, `NO_CONFIGURADA` y `emision_habilitada=false` en todos los resultados.
- Acceso limitado inicialmente al Propietario con alcance de empresa y capacidad de emisor en el local vinculado. La asesoría aún no dispone de una nueva concesión de acceso.
- Sin modificación de facturas, entidades emisoras, series ni tabla C07 preexistente.

Guardar preferencias no certifica su exactitud ni crea una representación. Elegir modalidad no habilita el adaptador.

### Evidencia inicial

34 comprobaciones sobre PostgreSQL WASM/PGlite, ejecutando la migración real y el contrato SQL. Cubren dos empresas, emisor compartido entre locales, permisos, replay, versión obsoleta, inmutabilidad y rechazo de secretos/campos no admitidos. Se integra el mismo SQL en el contrato nativo C07 de CI y se añade una carrera de dos conexiones contra una misma versión.

La simulación de identidad utiliza las fixtures del repositorio; no equivale a probar Auth y PostgREST remotos. La aceptación en QA necesita JWT reales de dos empresas y varias personas.

### Estado de despliegue

Migración preparada localmente; no aplicada a QA ni producción. Panel de configuración e invitación de asesorías pendientes. Ningún certificado ha sido solicitado ni importado. No se ha efectuado una remisión tributaria.

La integración de borrado de empresas debe revisarse antes de aplicar: las nuevas tablas tienen alcance por empresa e historial protegido; el procedimiento de baja/purga de plataforma deberá tratarlas según conservación aplicable sin desactivar controles indiscriminadamente.

## 10. Orden de trabajo y cierre

1. **C07-A:** investigación, modelo y borradores multiempresa; revisión del PR y contrato nativo.
2. **C07-B:** panel de configuración con datos del servidor, estados claros, conflictos de versión y cambios de empresa sin herencia de caché. Ensayo QA y ciclo de baja/purga de tablas nuevas.
3. **C07-C:** acceso delegado de asesoría y evidencia de representación; custodia y renovación de credenciales.
4. **C07-D:** emisión, series por emisor, registro y hash encadenado; transporte y cola por obligado. Primero adaptador VERI*FACTU en pruebas.
5. **C07-E:** QR en pantalla/PDF, cotejo oficial, errores, rectificaciones, concurrencia y evidencias con dos empresas.
6. **C07-F:** revisión de conformidad del producto, declaración responsable por versión y activación específica por empresa. Ensayo físico al disponer de hardware.

Se cierra el punto de QR digital cuando existe una factura consistente, un registro correcto, QR correcto y cotejo satisfactorio en el entorno correspondiente, junto con las pruebas negativas y el tratamiento de incidencias. Se cierra la aceptación productiva del circuito fiscal cuando además la versión cumple sus obligaciones, la empresa tiene representación/credencial válida y existe postflight de la promoción autorizada.

El régimen, los tipos de IVA y los plazos legales se confirman al activar cada empresa sobre normativa vigente. No se convierten fechas históricas del plan en constantes del programa. La facturación electrónica B2B y el SII son circuitos que requieren su propio alcance.

**Siguiente entrega concreta: C07-B, pantalla «Fiscalidad y AEAT» conectada a los borradores, después de verificar C07-A en CI.**
