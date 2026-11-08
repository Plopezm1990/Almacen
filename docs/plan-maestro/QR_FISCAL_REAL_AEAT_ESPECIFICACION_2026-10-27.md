# QR fiscal y emisión AEAT multiempresa — especificación de cierre técnico

Fecha: 27/10/2026  
Ámbito: L&A Suite, una instalación con varias empresas, emisores, locales y asesorías.  
Estado: **especificación validada; emisión real desactivada**.

Este documento convierte la investigación de C07 en un contrato implementable. No es una declaración de conformidad fiscal ni sustituye la revisión de cada empresa con su asesoría. La activación real queda bloqueada hasta completar los controles de la sección 10.

## 1. Decisión principal

L&A Suite no tendrá un QR genérico ni una URL fiscal introducida manualmente. El QR se construirá de forma determinista a partir de la factura emitida, el emisor fiscal que figura en ella y el importe total. El NIF del emisor y el NIF del presentador son identidades distintas:

- el emisor es el obligado que expide la factura;
- el presentador es quien remite registros a la AEAT cuando la vía elegida lo requiere;
- una asesoría puede presentar por varias empresas, pero cada autorización se conserva separadamente;
- cambiar de empresa, local, asesoría o certificado nunca puede mezclar cadenas, series, colas o credenciales.

La pantalla C07 solo guarda un borrador. Mientras el estado sea `BORRADOR`, `NO_CONFIGURADA` o `emision_habilitada=false`, el sistema no genera un QR fiscal real, no envía registros y no crea una factura fiscal irrevocable.

## 2. Resultado oficial que debe implementarse

### 2.1 QR de cotejo

Para facturas afectadas por el sistema informático de facturación, el QR permite al destinatario cotejar la factura en la sede electrónica de la AEAT. No demuestra por sí solo que L&A Suite haya remitido correctamente el registro ni sustituye la trazabilidad, el hash, el encadenamiento o la conservación.

La especificación técnica oficial de la AEAT exige, en síntesis:

- símbolo QR conforme a ISO/IEC 18004:2015;
- tamaño entre 30×30 mm y 40×40 mm;
- nivel de corrección de errores M;
- zona de reserva mínima de 2 mm y recomendada de 6 mm;
- rótulo `QR tributario:` junto al código;
- en modalidad VERI*FACTU, mención visible `VERI*FACTU` o `Factura verificable en la sede electrónica de la AEAT` debajo del QR;
- ubicación preeminente, preferentemente en la parte superior y visible una sola vez en la primera página;
- en formato vertical, zona superior centrada o izquierda; en horizontal, zona superior izquierda.

Fuente: [Especificaciones técnicas del código QR de la AEAT, versión 0.5.0](https://www.agenciatributaria.es/static_files/AEAT_Desarrolladores/EEDD/IVA/VERI-FACTU/DetalleEspecificacTecnCodigoQRfactura.pdf).

### 2.2 URL QR

La URL se compone únicamente en el servidor y contiene estos cuatro parámetros obligatorios:

| Parámetro | Regla de implementación |
|---|---|
| `nif` | NIF del obligado emisor, nueve caracteres alfanuméricos, tomado del snapshot fiscal de la factura. |
| `numserie` | Serie y número de factura, hasta 60 caracteres ASCII imprimibles. No se acepta texto libre fuera de la serie/número normalizados. |
| `fecha` | Fecha de expedición en formato `DD-MM-YYYY`. |
| `importe` | Importe total de la factura, decimal con punto y dos decimales; sin separadores de miles. |

Los valores se codifican en UTF-8 y se URL-encodean. La salida debe ser estable: el mismo snapshot produce la misma URL, el mismo contenido QR y el mismo resultado al decodificar. `idioma` puede existir como parámetro opcional si se necesita; `formato=json` sirve para una respuesta técnica del servicio, pero **no se introduce en la URL embebida en el QR**.

La plantilla de endpoint y los parámetros no serán editables por la empresa. El adaptador versionado elegirá la variante oficial según jurisdicción y modalidad. La documentación oficial de QR y sus ejemplos son la fuente de verdad para la plantilla, no una copia de una URL de internet ni un valor introducido por un usuario.

## 3. Modalidades por empresa

La modalidad se configura y aprueba por emisor, no globalmente para toda la plataforma.

### 3.1 VERI*FACTU — primera implementación recomendada

Es la primera ruta que se implementará porque concentra la remisión de los registros y reduce la complejidad de custodia frente a la modalidad no VERI*FACTU, pero sigue requiriendo identidad, representación, cadena, registro, reintentos e inmutabilidad correctos.

Flujo previsto:

1. se valida la venta y la serie autorizada del emisor;
2. se congela el snapshot legal y comercial de la factura;
3. se crea el registro de facturación de alta, su hash y su enlace con el registro anterior;
4. se genera el QR desde el snapshot;
5. se imprime o se muestra el ticket/factura;
6. una cola idempotente remite el registro al servicio oficial de la AEAT;
7. se conserva la petición, la respuesta, el identificador, el estado y los reintentos sin modificar el documento original.

El QR se puede mostrar en una previsualización QA, pero una previsualización nunca debe confundirse con un QR de producción cotejable.

### 3.2 NO VERI*FACTU — no se activa todavía

No es un interruptor para evitar el envío. Solo se habilitará cuando L&A Suite implemente y pruebe, para el alcance concreto, los requisitos adicionales de integridad, inalterabilidad, registro de eventos, firma cuando corresponda, conservación, exportación y controles de acceso.

Si una empresa no puede acreditar su situación o está en un régimen excluido, el estado será `BLOQUEADA_REVISION_FISCAL`, no `NO_VERIFACTU` automático. SII, territorio foral, otros países y cualquier exclusión requieren una ruta fiscal propia y evidencia.

## 4. Registro fiscal y cadena

Se necesitará una capa posterior a C07 para registrar hechos fiscales inmutables. La factura visual, el ticket de TPV y el registro fiscal están relacionados, pero no son el mismo objeto.

Modelo mínimo propuesto por `empresa_id` + `entidad_fiscal_id`:

- `fiscal_documentos`: snapshot inmutable del documento, emisor, serie, número, fecha, totales, modalidad y versión del adaptador;
- `fiscal_registros`: alta, anulación y otros tipos admitidos, con payload normalizado, hash SHA-256, hash anterior y posición de cadena;
- `fiscal_outbox`: entrega pendiente, idempotency key, lote, destino lógico y próximo reintento;
- `fiscal_entregas`: respuesta del servicio, estado, timestamps, código, mensaje sanitizado y referencia externa;
- `fiscal_eventos`: auditoría de cambios de configuración, activación, credenciales y decisiones de bloqueo;
- `fiscal_credenciales`: solo referencia opaca a la custodia segura, nunca certificado, clave privada o contraseña.

La cadena se define por el SIF y el obligado tributario. Altas y anulaciones se enlazan en la misma cadena cuando la normativa y el adaptador así lo determinen. Rectificar no significa editar el registro original: significa crear el registro posterior que documenta la corrección.

La AEAT indica que los registros de alta, anulación y eventos deben llevar huella y encadenamiento; el hash no se coloca dentro del QR. Fuente: [FAQ oficial de la AEAT sobre huella/hash](https://sede.agenciatributaria.gob.es/Sede/iva/sistemas-informaticos-facturacion-verifactu/preguntas-frecuentes/huella-hash.html).

## 5. Presentación directa, asesoría o proveedor

La configuración C07 debe representar una de estas vías, siempre por empresa:

1. **Directa:** la empresa presenta con una credencial admitida y vigente.
2. **Asesoría:** el presentador actúa como representante, apoderado o colaborador social con autorización demostrable para ese obligado.
3. **Proveedor:** un adaptador contratado presenta por cuenta de la empresa; el proveedor no puede convertirse en una URL o secreto libre introducido en el formulario.

El email de la asesoría, una invitación en L&A Suite o un PDF enviado por correo no acreditan por sí solos representación ante AEAT. El alta debe conservar la vía, el titular, el representado, el alcance, la fecha de vigencia, la evidencia y el usuario que aprobó.

La documentación técnica oficial de servicios VERI*FACTU contempla presentación por el obligado, representante, apoderado o colaborador social y exige la autenticación electrónica correspondiente. El transporte se basa en HTTPS/SOAP y contratos XML/XSD oficiales; por ello se implementará como adaptador versionado y no como llamada REST improvisada. Fuente: [descripción oficial de servicios web VERI*FACTU](https://sede.agenciatributaria.gob.es/static_files/AEAT_Desarrolladores/EEDD/IVA/VERI-FACTU/Veri-Factu_Descripcion_SWeb.pdf).

## 6. Datos que se pedirán a cada empresa

Antes de pasar de borrador a prueba, la empresa y su asesoría deberán confirmar:

- razón social, NIF y domicilio fiscal del obligado;
- territorio y jurisdicción aplicable;
- si está dentro o fuera del ámbito del RRSIF y motivo documentado;
- situación SII u otra exclusión relevante;
- modalidad elegida y fecha objetivo;
- series de facturación, locales autorizados y autoridad única de numeración;
- tipo de factura permitido para cada operación, sin forzar siempre simplificada;
- canal de presentación: directa, asesoría o proveedor;
- identidad del presentador y título de representación;
- entorno externo de ensayo y certificado/credencial de prueba;
- aceptación de la política de reintentos, incidencias, conservación y bloqueo;
- responsable de validar el resultado con la asesoría.

La pantalla no almacenará claves privadas, contraseñas, PEM, tokens ni endpoints libres. Solo se guardará metadato seguro y una referencia opaca a la custodia del servidor.

## 7. Estados y activación

Se añadirá un ciclo explícito, independiente del borrador C07:

`BORRADOR` → `READY_FOR_TEST` → `TEST_PASS` → `PRODUCTION_ENABLED`.

Estados de bloqueo:

- `BLOCKED_IDENTITY`: NIF o emisor no validado;
- `BLOCKED_SCOPE`: jurisdicción, SII o ámbito pendiente;
- `BLOCKED_REPRESENTATION`: no hay autorización suficiente;
- `BLOCKED_CREDENTIAL`: credencial ausente, caducada o no verificable;
- `BLOCKED_SERIES`: series o autoridad de numeración no resueltas;
- `BLOCKED_ADAPTER`: modalidad o territorio aún no soportado;
- `BLOCKED_EXTERNAL_TEST`: prueba externa fallida;
- `BLOCKED_HARDWARE`: no se ha validado impresora, pantalla o lector cuando sea necesario.

Solo una operación servidor-side, auditada y con doble confirmación podrá cambiar a `PRODUCTION_ENABLED`. El propietario aprueba la activación de su empresa; la plataforma comprueba que el adaptador, la versión y las pruebas exigidas están vigentes. La simple selección de «VeriFactu» en C07 nunca activa emisión.

## 8. Pruebas obligatorias

### QR y factura

- URL exacta con NIF, serie/número, fecha e importe;
- caracteres especiales, ASCII imprimible, UTF-8 y límites de longitud;
- importes cero, negativos no permitidos, redondeo y dos decimales;
- QR decodificable desde pantalla, PDF y ticket impreso;
- tamaño, nivel M, zona de reserva, rótulo y ubicación;
- solo una aparición en la primera página;
- factura estructurada: URL/contenido dentro de la estructura, sin QR gráfico cuando el formato oficial no lo exige;
- albarán o nota de entrega: no generar QR fiscal de factura;
- modificación posterior de configuración: no cambia el snapshot ni el QR de una factura existente.

### Registro y remisión

- cadena correcta y detección de mutación;
- alta, anulación y rectificación como hechos separados;
- idempotencia ante timeout, reintento y respuesta desconocida;
- no duplicar factura por reintentar una entrega;
- rechazo de lotes mezclados de empresas/emisores;
- respuesta AEAT aceptada, aceptada con errores y rechazada;
- conservación del error real sin incluir certificados o datos sensibles en logs;
- revocación/caducidad de credencial y recuperación documentada;
- prueba de exportación y auditoría.

### Multiempresa y seguridad

- empresa A no puede leer, modificar ni reenviar registros de B;
- un local no puede cambiar el emisor común sin permiso de empresa;
- asesoría solo ve empresas con concesión vigente;
- el usuario cliente nunca recibe el secreto ni la clave privada;
- configuración `BORRADOR` nunca produce QR de producción ni llamada AEAT;
- rollback de adaptador sin alterar registros ya emitidos;
- limpieza de QA separada de producción.

## 9. Fechas y advertencias de cumplimiento

La AEAT publicó una ampliación de los plazos de adaptación: antes del 1 de enero de 2027 para contribuyentes del Impuesto sobre Sociedades y antes del 1 de julio de 2027 para los demás obligados afectados; el periodo previo se contempla para pruebas. Las fechas deben mostrarse como información versionada y revisarse al activar cada empresa, no convertirse en constantes irreversibles del programa. Fuente: [nota oficial de ampliación de plazo de la AEAT](https://sede.agenciatributaria.gob.es/Sede/iva/sistemas-informaticos-facturacion-verifactu/nota-informativa-ampliacion-plazo-adaptacion-facturacion.html).

El productor del sistema debe mantener la declaración responsable correspondiente a la versión. La existencia de un QR o una conexión técnica no equivale a certificación ni garantiza que una empresa concreta esté correctamente encuadrada. Fuente: [FAQ oficial de declaración responsable y certificación](https://sede.agenciatributaria.gob.es/Sede/iva/sistemas-informaticos-facturacion-verifactu/preguntas-frecuentes/certificacion-sistemas-informaticos-declaracion-responsable.html).

## 10. Puerta de producción

No se activa ninguna empresa en producción hasta que exista un expediente con:

1. revisión de alcance por la empresa y su asesoría;
2. NIF y emisor verificados;
3. serie y autoridad de numeración aprobadas;
4. modalidad y adaptador soportados;
5. representación o vía directa documentada;
6. credencial/certificado válido en custodia segura, si procede;
7. prueba satisfactoria en el entorno externo de ensayo;
8. QR leído y cotejado con una factura de prueba;
9. reintentos, idempotencia y respuesta desconocida probados;
10. aceptación de pantalla, PDF, impresora y hardware que vaya a usarse;
11. segunda confirmación de activación y registro de auditoría;
12. plan de incidencia, soporte y recuperación.

El portal externo de pruebas se usará antes de cualquier envío real. La aplicación gratuita de la AEAT distingue la emisión de pruebas de la emisión real; no se deben probar facturas ficticias en el entorno de producción porque podrían tener efectos reales. Fuente: [información oficial de la AEAT sobre el entorno de pruebas](https://sede.agenciatributaria.gob.es/Sede/ayuda/consultas-informaticas/presentacion-declaraciones-ayuda-tecnica/aplicacion-gratuita-verifactu-aeat/emision-facturas.html).

## 11. Orden de ejecución aprobado

1. Implementar el generador determinista de URL y el render del QR en QA, sin emisión.
2. Implementar el snapshot fiscal, registro, hash, encadenamiento y outbox por emisor.
3. Implementar el adaptador VERI*FACTU contra el entorno externo de pruebas.
4. Incorporar validaciones de empresa, representación, series y credenciales.
5. Ejecutar las pruebas de las secciones 8 y 10 con las dos empresas QA ya creadas.
6. Revisar el resultado con la asesoría de cada empresa real.
7. Solo después, preparar activación individual en producción.

**Conclusión de esta etapa:** C07 queda definido para fiscalidad configurable por empresa y el QR fiscal real queda especificado con fuente oficial. El núcleo determinista de URL/payload ya está implementado en `fiscal/qr/aeat-qr.mjs` y cubierto por el contrato `tests/fiscal/aeat-qr-contract.mjs`. No se han activado conexiones AEAT, certificados, envíos reales ni QR de producción.

**Siguiente etapa:** integrar este payload en el ticket de QA y en el renderizador de pantalla/PDF, manteniendo `emision_habilitada=false`; después se probará la lectura visual y la aceptación del hardware.
