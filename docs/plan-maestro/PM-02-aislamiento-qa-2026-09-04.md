# PM-02 · Asegurar QA y el destino real de guardado

Fecha: 2026-09-04
Estado: **CERRADO TOTAL**

## Base de trabajo

- Repositorio: `Plopezm1990/Almacen`
- Base reproducible: `pm01-fuente-reproducible`
- Paquete PM-02 base: `pm02-integrado`
- Paquete de cierre/apoyo: `reinicio-local-seguro`
- PR de trabajo: #15, borrador, no fusionado.
- `main`: no modificado por este cierre.
- Producción no recibe el código PM-02. El vaciado de datos operativos de producción realizado el mismo día fue una operación separada y expresamente autorizada por el usuario; se conservaron los usuarios/perfiles de acceso.

## 1. Destino productivo identificado

Host productivo identificado:

`flqercbgpgmmfaakrwkc.supabase.co`

Rutas Edge directas encontradas en el bundle:

- `enviar-notificacion`
- `crear-cuenta-empleado`
- `importar-albaran`
- `importar-nomina`
- `entrevista-personal`
- `prefiltro-candidato`

El inventario se valida automáticamente contra el bundle. Una ruta productiva nueva no inventariada hace fallar la prueba.

## 2. Backend QA remoto separado

Se creó un proyecto Supabase independiente, sin copiar datos de producción:

- Nombre: `L&A Suite QA`
- Project ref: `qjqorixtkilwsndqayyx`
- URL: `https://qjqorixtkilwsndqayyx.supabase.co`
- Región: `eu-west-1`
- Coste base informado por Supabase al crear el proyecto: `0 USD/mes`
- Datos de producción copiados: **0**

El proyecto QA contiene la estructura de tablas operativas necesaria para continuar las pruebas, todas con RLS activado, y arranca con 0 filas de negocio.

### Auth

QA usa el servicio Auth propio del proyecto `qjqorixtkilwsndqayyx`, separado del Auth productivo. Los usuarios/fixtures QA se prepararán en PM-04; no se copiaron cuentas reales.

### Storage

Bucket privado creado exclusivamente en QA:

`qa-pruebas`

- público: no;
- límite por archivo: 5 MiB;
- tipos permitidos: JPEG, PNG y PDF;
- políticas limitadas a usuarios autenticados QA.

### Edge Functions

Se desplegaron rutas QA neutralizadas/simuladas para impedir efectos externos reales:

- `importar-albaran` → simulada, sin IA real;
- `importar-nomina` → simulada, sin IA real;
- `entrevista-personal` → simulada;
- `prefiltro-candidato` → simulada;
- `enviar-notificacion` → simulada, `sent=0`;
- `crear-cuenta-empleado` → redirigida en QA a `qa-crear-empleado`, simulada.

No se configuraron credenciales reales de correo, push o IA en QA.

## 3. Deploy Preview aislado y conectado a QA

`reset-pruebas-preview.js` reconoce:

- `deploy-preview-N--chic-entremet-9107cf.netlify.app`;
- permalinks inmutables de 24 caracteres hexadecimales del mismo sitio.

En esos hosts:

1. activa `window.__modoPruebasQA = true`;
2. entrega a la aplicación la URL y clave publicable del proyecto QA;
3. las llamadas normales de Auth/REST/Storage usan QA;
4. las seis Edge Functions compiladas con host productivo se redirigen a sus destinos QA conocidos;
5. cualquier otra petición al host productivo se rechaza con `QA_BLOCKED_PRODUCTION_SUPABASE`;
6. la protección no se activa en el dominio de producción.

La prueba automatizada confirma:

- `PM02_REDIRECCION_EDGE_QA_OK=1`;
- `PM02_PRODUCCION_BLOQUEADA_OK=1`;
- ninguna sonda de prueba sale al host productivo;
- conexión HTTP real al RPC `qa_ping` de QA correcta;
- llamada HTTP real a notificación QA devuelve simulación y `sent=0`.

Netlify mantiene SSO obligatorio en entornos `non_production`. No se debilitó esa protección. El intento histórico de navegador sobre Deploy Preview recibió 401 antes de cargar la app; PM-02 no requiere relajar SSO para demostrar el destino remoto porque la configuración, la barrera y el backend QA real quedaron validados por pruebas automatizadas independientes.

## 4. LA-023

Corregido el mensaje que afirmaba de forma incondicional que todo estaba ya guardado/sincronizado en la cuenta.

- modo local: informa que no existe sincronización;
- modo nube: informa que los cambios se intentan sincronizar y no presenta una escritura como confirmada antes de saberlo.

Evidencia: `docs/plan-maestro/PM02_LA023_EVIDENCIA.txt`.

## 5. Arranque realmente a cero

Durante la limpieza se detectó que el bundle legacy reconstruía automáticamente una empresa/local (`Chocoloyos S.L`) aun cuando el almacenamiento estaba vacío.

Se corrigió para que:

- un estado completamente vacío no cree empresa;
- un estado completamente vacío no cree local;
- no se inyecte configuración legacy de Chocoloyos por defecto;
- la migración legacy se mantenga cuando sí existen datos antiguos reales que requieren migración.

Pruebas:

- `PM02_CERO_NO_RECONSTRUYE=1`;
- `PM02_LEGACY_CON_DATOS_SE_MIGRA=1`;
- build reproducible correcto y paridad exacta de fuente recuperada mantenida.

Evidencia: `docs/plan-maestro/PM02_BOOTSTRAP_CERO_EVIDENCIA.txt`.

## 6. Estado de producción tras el saneamiento autorizado

Después de eliminar los cuatro registros que el arranque antiguo había recreado, el almacenamiento operativo productivo quedó otra vez en 0. Los perfiles de acceso se conservaron.

Este saneamiento no sustituye QA: a partir de este cierre, las pruebas posteriores deben ejecutarse contra `L&A Suite QA`, no contra producción.

## 7. Criterio de cierre PM-02

Cerrados:

- destino productivo identificado;
- inventario de rutas remotas;
- alias y permalink de Preview cubiertos;
- barrera contra Supabase productivo;
- backend QA remoto real e independiente;
- Auth QA separado;
- Storage QA separado;
- Edge Functions externas simuladas;
- LA-023 corregido;
- arranque a cero corregido;
- fuente recompilable de PM-01 conservada;
- evidencia positiva y negativa automatizada;
- sin copia de datos reales a QA.

**PM-02 queda CERRADO TOTAL.**

El siguiente paquete del Plan Maestro es **PM-03**. Por instrucción del usuario, no se inicia hasta que se comunique el cierre y se reciba autorización para continuar.

## Rollback

No fusionar a `main`. El código permanece en ramas de prueba. El proyecto `L&A Suite QA` es independiente de producción y puede pausarse/eliminarse si se decide abandonar el entorno QA. No realizar ninguna acción de promoción o merge sin autorización expresa.
