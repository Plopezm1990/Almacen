# C07-D.3 — Piloto sandbox por empresa

Fecha: 27/10/2026  
Estado: **PREPARADA — BLOQUEADA HASTA DISPONER DE UNA EMPRESA REAL Y UN SANDBOX EXTERNO**.  
Ámbito: una empresa, un obligado tributario, un local inicial y una configuración fiscal aislada.

## 1. Propósito

C07-D.3 es la puerta entre el diseño técnico de C07-D.2 y cualquier decisión de
activación fiscal real. Su objetivo es probar, para una empresa concreta, que la
identidad, la representación, la serie, el adaptador, el transporte sandbox, el
encadenamiento, el QR y la operación del ticket son coherentes de extremo a extremo.

La etapa no se puede cerrar con datos inventados ni con la fixture `SIMULADOR_C07D`.
El simulador sirve para comprobar la interfaz y las guardias internas de QA; no
demuestra que un proveedor, la AEAT o una asesoría hayan aceptado una factura.

## 2. Puerta de entrada

El piloto no puede comenzar hasta que el propietario aporte, fuera del código fuente:

1. empresa piloto identificada y autorizada;
2. NIF y razón social verificados por la asesoría o responsable fiscal;
3. local y entidad emisora que entrarán en el primer alcance;
4. modalidad y territorio aplicables;
5. serie inicial y regla de numeración aprobadas;
6. vía de presentación: directa, asesoría/representante o proveedor;
7. adaptador y proveedor/sandbox externo elegido;
8. contrato, documentación técnica y resultado esperado del sandbox;
9. autorización de la empresa para ejecutar únicamente pruebas sandbox;
10. disponibilidad de impresora y dispositivo/lector para la prueba física.

Los secretos, certificados y claves se entregan solo por el canal server-side previsto
para el adaptador. Nunca se copian en el frontend, en fixtures, en commits, en logs ni
en el expediente público.

## 3. Estados de la empresa piloto

```text
PENDIENTE_EMPRESA
  → EXPEDIENTE_EN_REVISION
  → READY_FOR_SANDBOX
  → SANDBOX_EN_CURSO
  → SANDBOX_PASS
  → PILOTO_CERRADO
```

`PRODUCTION_ENABLED` no forma parte del cierre automático de C07-D.3. Si el piloto
termina correctamente, se abre una revisión separada con doble aprobación; nunca se
salta directamente desde `SANDBOX_PASS` a producción.

Los bloqueos mínimos son:

- `PILOTO_SIN_EMPRESA_REAL`;
- `PILOTO_IDENTIDAD_NO_VERIFICADA`;
- `PILOTO_REPRESENTACION_NO_ACREDITADA`;
- `PILOTO_ADAPTADOR_NO_ELEGIDO`;
- `PILOTO_SANDBOX_NO_COTEJADO`;
- `PILOTO_QR_NO_COTEJADO`;
- `PILOTO_HARDWARE_NO_PROBADO`;
- `PILOTO_DOBLE_REVISION_PENDIENTE`.

## 4. Secuencia de ejecución

### D3.0 — Alta del expediente

Se crea un expediente por empresa y se relaciona con `empresa_id`, `local_id`,
entidad, modalidad, serie, adaptador y entorno. No se reutilizan credenciales,
series, snapshots ni resultados de otra empresa.

### D3.1 — Revisión de identidad y representación

La asesoría o responsable fiscal confirma identidad, alcance, autoridad de numeración
y vía de presentación. La revisión se registra como evidencia, pero no convierte por
sí sola el expediente en activo.

### D3.2 — Configuración sandbox

El servidor resuelve el adaptador versionado, el entorno y la credencial opaca. El
frontend solo recibe estado y campos seguros. El emisor de la aplicación debe impedir
que el cliente elija una serie distinta de la asignada por servidor.

### D3.3 — Prueba externa controlada

Se genera un documento de prueba con identificador de idempotencia estable, se envía
al sandbox externo mediante el adaptador server-side y se guarda la respuesta
normalizada, el código de cotejo y la evidencia de consulta. Un resultado `UNKNOWN` o
`RETRYABLE` no se puede interpretar como aprobación.

### D3.4 — Ticket, QR y hardware

Se verifica el mismo snapshot en pantalla, PDF y papel. El QR se escanea desde la
pantalla y desde el ticket impreso. Se documentan modelo de impresora, ancho de rollo,
tamaño de matriz, distancia de lectura, dispositivo utilizado y resultado.

### D3.5 — Revisión conjunta

El propietario y la asesoría revisan número, fecha, importes, impuestos, serie,
respuesta del sandbox, QR y trazabilidad. Cualquier diferencia devuelve el expediente
a `SANDBOX_EN_CURSO`.

### D3.6 — Cierre del piloto

Solo se marca `PILOTO_CERRADO` cuando existe evidencia de todos los controles y una
decisión explícita: continuar a revisión de activación o detener el uso fiscal. El
cierre no habilita producción por sí mismo.

## 5. Paquete de evidencias

El expediente final debe contener, como mínimo:

- identificador de empresa, local y alcance;
- revisión de identidad y representación;
- versión del adaptador y entorno;
- referencia opaca de credencial, sin el secreto;
- solicitud sandbox y `idempotency_key`;
- respuesta normalizada y comprobación externa;
- snapshot inmutable de documento y hash/encadenamiento;
- captura de ticket en pantalla;
- PDF o salida imprimible;
- fotografía o escaneo del ticket físico;
- resultado de lector móvil y, si aplica, lector de sobremesa;
- revisión de la asesoría y del propietario;
- incidencias, reintentos y resolución;
- decisión de salida y fecha.

## 6. Bloqueos actuales

En la fecha de este documento no se debe avanzar a `READY_FOR_SANDBOX` porque no se
han aportado una empresa real, un proveedor/adaptador externo ni hardware físico.
Por tanto:

- el proyecto permanece en `PENDIENTE_EMPRESA`;
- `SIMULADOR_C07D` sigue limitado a QA;
- no se introducen NIF, certificados ni endpoints de una empresa en el repositorio;
- no se aplican migraciones nuevas por esta preparación;
- no se modifica Supabase de producción;
- no se cambia ningún estado a `TEST_PASS` o `PRODUCTION_ENABLED`.

## 7. Entrada necesaria para continuar

Cuando el propietario tenga la primera empresa piloto, debe aportar en el chat solo la
decisión y los identificadores no secretos: empresa seleccionada, asesoría o vía de
representación, proveedor/adaptador elegido y disponibilidad de hardware. Los datos
sensibles se introducirán después por el canal seguro correspondiente.

El siguiente trabajo técnico será implementar el registro server-side del expediente
y su transición controlada a `READY_FOR_SANDBOX`, únicamente después de comprobar esos
datos.
