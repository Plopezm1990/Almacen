# C07-D.2.5 — contrato del adaptador fiscal y sandbox por empresa

Fecha: 27/10/2026  
Entorno de implementación: QA, sin transporte externo  
Producción: no modificada  
AEAT/proveedor: no contactado  
Estado: contrato técnico preparado y verificable; activación externa pendiente

## Objetivo

Definir la frontera entre L&A Suite y cualquier transporte fiscal externo sin
atar el producto a una asesoría, proveedor o certificado concreto. Cada
empresa y cada emisor fiscal deben poder elegir su vía —directa, asesoría o
proveedor— manteniendo separados el obligado tributario, el presentador, la
credencial, la serie, la cadena y la cola.

Este contrato no crea una conexión, no acepta certificados, no envía XML/SOAP
ni HTTPS a AEAT o a un proveedor y no habilita emisión real. Su propósito es
evitar que una futura integración convierta un endpoint o secreto en una
opción editable desde el navegador.

## Ámbito de una configuración

La clave efectiva de una configuración es:

`empresa_id + local_id + entidad_fiscal_id + tipo_documento`

El adaptador seleccionado debe declarar, en servidor:

- `adapter_code` y `adapter_version` inmutables para la revisión;
- entornos permitidos (`QA`, `SANDBOX`, `PRODUCCION`);
- si requiere credencial (`credential_required`);
- capacidades declaradas, sin URLs ni secretos;
- soporte de cola, reintento y resultado desconocido;
- estado `enabled` controlado por la plataforma.

Un emisor nunca puede utilizar el adaptador, la serie o la credencial de otra
empresa. Un asesor puede tener acceso a varias empresas, pero cada concesión y
cada evidencia de representación se comprueban por separado.

## Interfaz lógica del adaptador

El contrato servidor-side queda limitado a estas operaciones. El navegador no
las invoca directamente ni conoce credenciales:

```text
describe(configuracion) -> capacidades declaradas
validar_preparacion(snapshot, configuracion) -> READY_FOR_TEST | BLOCKED_*
preparar_envio(snapshot, registro, idempotency_key) -> solicitud normalizada
enviar_sandbox(solicitud, credential_ref) -> respuesta normalizada
consultar_resultado(referencia_externa, credential_ref) -> respuesta normalizada
clasificar_error(respuesta) -> reintentar | bloquear | resultado_desconocido
```

Las funciones de transporte solo existirán en un worker/adaptador server-side
aprobado. Las RPC de configuración pueden devolver metadatos y estados, pero
nunca el secreto, el certificado, la clave privada, el token crudo o el
endpoint editable.

## Entrada mínima y snapshot

`preparar_envio` recibe únicamente datos congelados de una factura y de su
registro fiscal:

- empresa y entidad emisora;
- NIF del obligado y datos fiscales del snapshot;
- serie y número ya resueltos por C05 en servidor;
- fecha y total normalizados;
- modalidad y versión del adaptador;
- hash y hash anterior de la cadena cuando proceda;
- tipo de registro: alta, anulación o rectificación;
- `idempotency_key` estable por registro y adaptador.

No se acepta como autoridad ningún `codigo_serie`, NIF, importe, endpoint o
credencial proporcionado por el frontend. Si el snapshot no coincide con la
configuración del emisor, se bloquea antes de crear un envío.

## Respuesta normalizada

El adaptador no escribe directamente una factura ni modifica el registro
original. Devuelve un objeto equivalente a:

```json
{
  "outcome": "ACCEPTED | ACCEPTED_WITH_ERRORS | REJECTED | UNKNOWN | RETRYABLE",
  "external_reference": "referencia-opaca",
  "provider_code": "codigo-sanitizado",
  "provider_message": "mensaje-sanitizado",
  "received_at": "2026-10-27T00:00:00.000Z",
  "retry_after_seconds": 60,
  "request_fingerprint": "sha256",
  "adapter_code": "ADAPTADOR_VERSIONADO",
  "adapter_version": "1.0.0"
}
```

Reglas obligatorias:

- `external_reference` no es un secreto y no se reutiliza entre empresas;
- mensajes y logs se sanitizan para eliminar certificados, tokens, SOAP
  completo, NIF innecesario y datos personales;
- `UNKNOWN` nunca se convierte automáticamente en rechazo ni en aceptación;
- una repetición con la misma clave y el mismo payload devuelve el resultado
  persistido;
- una misma clave con payload diferente se bloquea como conflicto;
- el documento fiscal y su hash no se editan para acomodar una respuesta
  tardía.

## Estados y puerta de activación

La revisión fiscal de una empresa sigue este ciclo independiente:

`BORRADOR → READY_FOR_TEST → TEST_PASS → PRODUCTION_ENABLED`

Estados de bloqueo definidos:

- `BLOCKED_IDENTITY`: NIF o emisor no validado;
- `BLOCKED_SCOPE`: jurisdicción, RRSIF, SII o territorio pendiente;
- `BLOCKED_REPRESENTATION`: no existe representación suficiente;
- `BLOCKED_CREDENTIAL`: credencial ausente, caducada o no verificable;
- `BLOCKED_SERIES`: serie o autoridad de numeración no resuelta;
- `BLOCKED_ADAPTER`: modalidad o territorio no soportado;
- `BLOCKED_EXTERNAL_TEST`: sandbox fallido o no cotejado;
- `BLOCKED_HARDWARE`: pantalla, PDF, impresora o lector sin validar.

Solo se puede solicitar `PRODUCTION_ENABLED` si se cumplen simultáneamente:

1. empresa y asesoría han revisado el alcance;
2. emisor, NIF, modalidad y series están aprobados;
3. la representación o vía directa está documentada;
4. la credencial se custodia fuera de la base de datos de negocio;
5. el adaptador ha superado la prueba externa de sandbox;
6. el QR de una factura de prueba se ha leído y cotejado;
7. idempotencia, timeout, rechazo y resultado desconocido están probados;
8. existe segunda confirmación del propietario y auditoría de la activación.

La selección de `VeriFactu`, el estado `VALIDADA` o una credencial configurada
no activan por sí solos la emisión real.

## Adaptador QA actual

`SIMULADOR_C07D` permanece como único adaptador de QA:

- versión `1.0.0`;
- entornos `QA` y `SANDBOX` declarados, nunca `PRODUCCION`;
- transporte `DISABLED`;
- sin credencial;
- cola, reintentos y resultado desconocido simulables;
- no contacta AEAT ni proveedor externo.

No se añade todavía un adaptador de proveedor real. Para hacerlo harán falta
el proveedor elegido por la empresa, contrato de sandbox, esquema XML/XSD o
API oficial, método de autenticación, límites, respuestas de rechazo y
procedimiento de soporte.

## Evidencia que debe aportar cada empresa antes del sandbox

- razón social, NIF, domicilio y jurisdicción;
- régimen y motivo de cualquier exclusión;
- responsable de la decisión fiscal;
- vía elegida: directa, asesoría o proveedor;
- identidad del presentador y título de representación;
- series y locales autorizados;
- credencial/certificado de ensayo y su titular, sin entregarlo al panel;
- endpoint oficial de sandbox aprobado por la plataforma, nunca texto libre;
- fecha de prueba, resultado esperado y persona que cotejará la factura;
- aceptación del procedimiento de reintento, incidencia y recuperación.

## Pruebas que quedan como aceptación C07-D.2.5

- una empresa A no puede preparar ni consultar envíos de B;
- una asesoría con concesión para A no obtiene B ni una tercera empresa;
- el navegador no recibe `credential_ref` ni ningún secreto;
- `QA` nunca ejecuta transporte externo;
- `SANDBOX` requiere adaptador habilitado y credencial server-side cuando
  corresponda;
- `PRODUCCION` se rechaza mientras la puerta no esté aprobada por doble
  confirmación;
- el mismo `idempotency_key` y payload se reproduce sin duplicar envío;
- el mismo `idempotency_key` con payload diferente se bloquea;
- timeout y respuesta desconocida no crean un segundo documento;
- una respuesta rechazada conserva el registro original y abre la incidencia
  correspondiente;
- el cambio de asesoría, adaptador o credencial no reescribe documentos
  históricos ni reinicia la cadena;
- se conserva auditoría de configuración, prueba, activación y revocación.

## Decisión y siguiente paso

C07-D.2.5 queda preparado como contrato técnico y puerta de seguridad, pero no
se considera integración externa terminada. El siguiente paso requiere una
decisión empresarial concreta: elegir para la primera empresa piloto si la vía
será directa, asesoría o proveedor, y aportar los datos de sandbox y la
asesoría que revisará el resultado.

Hasta entonces se mantiene `SIMULADOR_C07D`, `DISABLED`, QA y emisión real
desactivada. No se aplican cambios en Supabase producción.
