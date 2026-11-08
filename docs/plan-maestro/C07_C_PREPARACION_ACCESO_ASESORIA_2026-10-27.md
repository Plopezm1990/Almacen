# C07-C · Acceso delegado de asesoría y evidencia de representación

Fecha: 27/10/2026
Entorno de trabajo: QA únicamente.
Producción: no modificada.
Estado: **BACKEND TERMINADO EN QA; INTERFAZ PREPARADA LOCALMENTE; NO PROMOVIDO A PRODUCCIÓN**.

## 1. Resultado de C07-A/B

C07-A y C07-B quedan validados como configuración fiscal multiempresa en
borrador:

- cada empresa conserva sus emisores y su configuración separada;
- el panel lee el emisor desde el servidor y no confía en un selector local;
- el cambio de empresa/local limpia el estado anterior;
- los guardados tienen versión esperada, operación idempotente e historial
  inmutable;
- se rechazó el acceso cruzado entre las dos empresas de QA;
- `conexion = NO_CONFIGURADA` y `emision_habilitada = false` siguen siendo
  invariantes;
- no se han enviado facturas a la AEAT ni se han importado certificados.

La evidencia detallada está en
`docs/plan-maestro/C07_PRUEBA_AISLAMIENTO_MULTIEMPRESA_QA_2026-10-27.md`.

## 2. Qué resuelve C07-C

C07-C añade la separación que falta entre tres conceptos que no deben mezclarse:

1. **Acceso de la asesoría al panel.** Permite consultar o proponer cambios
   únicamente sobre las empresas que la han autorizado.
2. **Representación tributaria.** Acredita, por empresa y emisor, la vía
   válida (`APODERAMIENTO` o `COLABORACION_SOCIAL`) y su vigencia. Una cuenta
   creada en L&A Suite o un correo guardado no equivalen a esta representación.
3. **Credencial de presentación.** Conserva solo metadatos y una referencia
   opaca a la custodia de secretos. La clave privada nunca se devuelve al
   navegador ni se guarda en la configuración fiscal.

Una misma cuenta de asesoría podrá tener concesiones distintas para varias
empresas, pero cada concesión se autorizará, caducará y revocará por separado.

## 3. Modelo técnico previsto

Las tablas serán privadas y se expondrán solo mediante RPC autorizadas. El
alcance mínimo es:

| Objeto | Finalidad | Nunca debe contener |
|---|---|---|
| Delegación | Empresa/emisor, usuario o email invitado, permiso, estado, caducidad y auditoría | contraseña, token crudo o clave privada |
| Evidencia de representación | tipo, referencia externa opaca, huella del documento, vigencia, estado y quién validó | documento completo en el panel o secreto de firma |
| Credencial | titular, proveedor/adaptador, huella, vigencia, estado y `secret_ref` opaco | PEM, certificado privado, contraseña o endpoint editable |
| Revisión | cambio inmutable de cualquiera de los anteriores | actualización destructiva del historial |

Permisos de asesoría previstos:

- `CONSULTAR`: leer estado y configuración aprobada;
- `PROPONER`: crear una propuesta de borrador, sin activarla;
- `VALIDAR_SITUACION`: registrar la revisión de la situación comunicada por
  la asesoría, sin convertirla por sí sola en representación válida.

El propietario conserva la aprobación de la configuración y de la activación.
El administrador de plataforma no recibe por defecto facultades fiscales de la
empresa.

## 4. Reglas de seguridad y de ciclo de vida

- La autorización del panel se comprueba en servidor en cada lectura, guardado,
  reintento y revocación.
- Una invitación debe tener aceptación explícita, caducidad, revocación y
  registro de quién hizo cada operación.
- Revocar el acceso al panel no revoca automáticamente la representación ante
  la AEAT; ambas operaciones deben quedar separadas y visibles.
- Una representación caducada o revocada bloquea la activación y los envíos
  nuevos, pero no borra la cola ni la evidencia histórica.
- La credencial no se activa por tener una referencia almacenada: requiere
  titular, vigencia, prueba de conexión y una validación explícita posterior.
- No se aceptará una URL de Hacienda, un QR pegado ni un certificado desde un
  campo libre del formulario.
- Ninguna migración de C07-C puede cambiar facturas, series, hashes o datos de
  producción.
- C07-C no habilita todavía emisión, transporte, QR productivo ni Veri*Factu.

## 5. Criterios de aceptación QA

Antes de considerar C07-C terminada deben pasar, como mínimo:

1. propietario de A invita a un asesor con `CONSULTAR`; el asesor acepta y ve
   solo A;
2. el mismo asesor recibe una concesión separada para B y no obtiene B antes
   de aceptarla;
3. el asesor no puede leer, guardar ni reintentar sobre una tercera empresa;
4. `CONSULTAR` no puede proponer ni validar;
5. `PROPONER` crea una propuesta auditada, pero no cambia la configuración
   aprobada ni activa emisión;
6. `VALIDAR_SITUACION` no equivale a aprobar representación;
7. caducidad y revocación bloquean el acceso en servidor, incluidos reintentos;
8. el historial no admite `UPDATE` ni `DELETE` desde el cliente;
9. se rechazan tokens, certificados, claves, contraseñas y endpoints en
   cualquier RPC de configuración;
10. la misma credencial o referencia no puede quedar vinculada a emisores de
    empresas distintas sin una operación explícita y auditada;
11. los asesores de Supabase no dejan nuevos avisos de seguridad creados por
    C07-C;
12. todos los ensayos se ejecutan en QA con datos ficticios y transacción
    reversible, sin tocar producción.

## 6. Dependencias que impiden cerrarlo todavía

C07-C no debe marcarse como terminado hasta tener estas decisiones y datos:

- cuenta real de asesoría que vaya a aceptar la invitación;
- empresa y emisor concretos a los que se concederá acceso;
- permiso inicial (`CONSULTAR`, `PROPONER` o `VALIDAR_SITUACION`);
- vía de representación que la asesoría confirme (`APODERAMIENTO` o
  `COLABORACION_SOCIAL`);
- referencia de evidencia y fechas de vigencia, revisadas por la asesoría;
- decisión sobre la custodia técnica de la credencial y prueba mTLS/SOAP del
  adaptador elegido;
- política de conservación y revocación aprobada por la empresa.

El correo de contacto de una asesoría, por sí solo, no es suficiente para
crear una delegación fiscal ni para activar un certificado.

## 7. Siguiente paso autorizado

La invitación y el control de permisos se implementaron y validaron en el
backend de QA como acceso al panel, con representación y credenciales aún en
estado `PENDIENTE`. La interfaz pasa sus contratos locales, pero todavía no se
ha publicado el commit en un Deploy Preview. La evidencia completa está en
`C07_C_QA_RESULTADO_2026-10-27.md`.

No se debe promover C07-C a producción hasta que exista una evidencia real de
representación para cada empresa y se haya decidido la custodia de credenciales.
