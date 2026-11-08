# PM13 · Punto 5.8 — Revocación y sesión abierta en QA

Fecha: 2026-10-17  
Subcaso: revocación, sesión abierta, recarga y cambio de local  
SHA de código verificado: `b7140c9bd26c3ed31b58c28a2a240d6cd72a727b`  
Entorno servidor: Supabase QA `qjqorixtkilwsndqayyx`  
Preview inspeccionado: Deploy Preview 150

## Resultado de servidor

En una transacción QA con `set local role authenticated` y rollback final:

1. La identidad QA vinculada a `QA-EMP-A/QA-A1` resolvió `PM13_PERSONAL_CONSULTAR` como permitido antes de la revocación.
2. El Propietario QA revocó temporalmente esa decisión mediante `pm13_configurar_cargo_permiso`.
3. La misma sesión autenticada, sin recargar tokens ni confiar en caché, resolvió inmediatamente `permitido=false` con `motivo=cargo_revocado`.
4. Al cambiar a `QA-A2`, la resolución fue `membresia_no_autorizada`.
5. Una clave desconocida continuó devolviendo `clave_no_catalogada`.
6. El rollback dejó la fila persistente con `permitido=true`, `activo=true`, versión `3`; no quedó evento con el `operation_id` de prueba.

**Resultado servidor: PASS.**

## Bloqueo de la prueba visual

Después de recargar el Deploy Preview 150, la interfaz mostró:

`Algo ha fallado — Se ha registrado el error automáticamente. Recarga la página para continuar.`

Una segunda recarga mediante el botón produjo el mismo resultado. La sesión disponible en el navegador es de Propietario en `Local F3 · QA F3 Cliente 3`, por lo que tampoco es válida para demostrar visualmente la revocación sobre un empleado no propietario.

La misma pantalla se reprodujo en una pestaña nueva del preview, descartando que el fallo dependa únicamente del almacenamiento de la pestaña original. El check remoto de GitHub para `netlify/chic-entremet-9107cf/deploy-preview` aparece como `success`, pero eso solo acredita el deploy; no acredita que el runtime React renderice correctamente.

La comprobación del permalink inmutable del deploy `6ad3ab5aa39997a176cdf475` sí cargó la pantalla de inicio de sesión correctamente. El alias `deploy-preview-150` continuó mostrando el error. Esto acota el bloqueo a la propagación/alias o al estado de sesión asociado al preview, no al build del artefacto. La instrumentación temporal usada para descartar un error de renderizado se retiró después; los checks de sintaxis y paridad volvieron a PASS.

No se introdujeron credenciales, no se copiaron tokens y no se modificaron datos mediante la interfaz.

## Estado

**PARCIAL / BLOQUEADO:** el comportamiento de revocación del servidor está probado y cerrado; la parte visual de recarga con una sesión no propietaria queda pendiente hasta disponer de un Deploy Preview funcional y una sesión QA autorizada de empleado.

El siguiente paso no debe marcar este subcaso como cerrado completo. Primero hay que resolver la disponibilidad del preview o aportar una sesión QA no propietaria autorizada; después se repetirá únicamente la comprobación visual de recarga y cambio de local.
