# C07-C · Resultado de QA

Fecha: 27/10/2026
Entorno: QA (`qjqorixtkilwsndqayyx`)
Producción: **no modificada**.

## Resultado

**PASS — backend de acceso delegado al panel y ciclo de vida de la delegación.**

La interfaz correspondiente quedó implementada en el bundle y pasó los
contratos locales (`cfg6-ui-contract: OK`, runtime `73/73`), pero el commit aún
no se ha subido a GitHub; por ello todavía no se declara un ensayo visual en
Deploy Preview.

Se aplicaron únicamente en QA estas migraciones:

- `abc_fiscal_multiempresa_delegacion`;
- `abc_fiscal_multiempresa_delegacion_accept`;
- `abc_fiscal_multiempresa_representacion_read`;
- `abc_fiscal_multiempresa_delegacion_lifecycle_checks`.

No se aplicaron en producción.

## Ensayos ejecutados

### 1. Invitación y aceptación como `CONSULTAR`

- El propietario de la empresa A creó una invitación para una cuenta QA.
- La respuesta quedó en `INVITADA` y señaló `envio_email = PENDIENTE`; el sistema no fingió haber enviado correo.
- La cuenta invitada aceptó solo porque su email Auth coincidía con el email invitado.
- La aceptación quedó en `ACEPTADA` y mantuvo `emision_habilitada = false`.
- La asesoría pudo leer el borrador de su empresa.
- La misma cuenta no pudo leer el emisor de la empresa B: `FISCAL_CONFIG_NO_AUTORIZADO`.
- El permiso `CONSULTAR` no pudo guardar un borrador.

### 2. Permiso `PROPONER` y revocación

- Se creó y aceptó una segunda invitación para la empresa A con permiso `PROPONER`.
- La cuenta invitada pudo guardar una nueva revisión del borrador.
- La operación devolvió la versión esperada y mantuvo la emisión deshabilitada.
- El propietario revocó la delegación.
- Después de revocarla, la cuenta no pudo volver a leer el borrador: `FISCAL_CONFIG_NO_AUTORIZADO`.
- La fecha de aceptación y el actor se conservaron como evidencia histórica.

### 3. Representación

- El propietario registró la representación en estado `PENDIENTE`.
- La lectura devolvió metadatos controlados y `emision_habilitada = false`.
- No se subieron documentos, certificados, contraseñas ni claves privadas.
- La vía de representación y la evidencia externa permanecen separadas del acceso al panel.

## Controles aplicados

- tablas en esquema `private`;
- RLS activado;
- privilegios directos revocados;
- RPC con `SECURITY DEFINER`, `search_path` vacío y comprobación de empresa/emisor/local;
- revisión de delegaciones y representación inmutable;
- operación idempotente mediante UUID;
- permisos separados: `CONSULTAR`, `PROPONER`, `VALIDAR_SITUACION`;
- caducidad limitada a un máximo de 180 días;
- revocación del panel separada de la representación ante la AEAT;
- sin endpoint fiscal editable ni secreto en la configuración.

## Incidencia encontrada y corregida

El primer ensayo detectó que una restricción confundía el estado actual con la
historia: al revocar una delegación aceptada se pretendía borrar implícitamente
la evidencia de aceptación. Se corrigió la restricción para que una delegación
`REVOCADA` o `CADUCADA` conserve `aceptada_at` y `aceptada_por`, mientras el
acceso efectivo queda bloqueado.

La corrección se validó repitiendo todo el recorrido con `PROPONER`.

## Asesores de Supabase

Tras las migraciones, el asesor mantiene avisos generales del proyecto,
incluido `RLS Enabled No Policy` para las nuevas tablas privadas. Es esperado
en este diseño: las tablas no se exponen directamente, tienen los privilegios
revocados y solo se accede mediante RPC controladas. No se aplicó una política
RLS genérica que pudiera bloquear el funcionamiento ni se corrigieron avisos
ajenos a C07-C.

Los avisos existentes sobre funciones `SECURITY DEFINER`, contraseñas filtradas
y otras tablas del proyecto siguen siendo una línea de seguridad separada.

## Límites de este cierre

C07-C queda validada técnicamente en QA, pero esto no significa que exista una
representación tributaria real ni que L&A Suite pueda enviar facturas. Quedan
fuera:

- envío real de correo de invitación;
- custodia de certificados o claves en un vault;
- prueba mTLS/SOAP o adaptador de proveedor fiscal;
- validación legal de una evidencia real;
- emisión, cola, hash, QR productivo y cotejo real con AEAT.

### Estado

**C07-C backend: TERMINADA EN QA.**
**Interfaz: preparada y validada localmente; Deploy Preview pendiente.**
**Producción: sin cambios.**
**Emisión fiscal: deshabilitada.**

Siguiente bloque: C07-D, diseño de series por emisor, registro fiscal, hash
encadenado y cola por obligado, todavía en modo de pruebas y sin transporte real.
