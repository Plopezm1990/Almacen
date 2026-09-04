# PM-02 · Asegurar QA y el destino real de guardado

Fecha: 2026-09-04
Estado: **PARCIALMENTE CERRADO / BLOQUEO EXTERNO PARA BACKEND QA REMOTO**

## Base de trabajo

- Repositorio: `Plopezm1990/Almacen`
- Base reproducible heredada de PM-01: `pm01-fuente-reproducible`
- Rama integrada de este paquete: `pm02-integrado`
- Producción: no modificada.
- `main`: no modificada.

## 1. Destino real identificado

El candidato contiene configuración y llamadas hacia el proyecto Supabase real cuyo host es:

`flqercbgpgmmfaakrwkc.supabase.co`

Se identificaron llamadas directas a rutas de Edge Functions que no dependen de `NUBE_URL`, entre ellas:

- `enviar-notificacion`
- `crear-cuenta-empleado`
- `importar-albaran`
- `importar-nomina`
- `entrevista-personal`
- `prefiltro-candidato`

También existen funciones de prueba en el proyecto real (`importar-albaran-prueba`, `importar-nomina-prueba`, `enviar-notificacion-prueba`, etc.), pero el runtime candidato inspeccionado no usa esas variantes en las rutas directas anteriores.

## 2. Aislamiento del Deploy Preview

`reset-pruebas-preview.js` se reforzó para reconocer dos formas de URL Netlify:

- `deploy-preview-N--chic-entremet-9107cf.netlify.app`
- permalink inmutable de 24 caracteres hexadecimales `...--chic-entremet-9107cf.netlify.app`

En esos hosts:

1. activa `window.__modoPruebasLocal = true`;
2. instala una barrera `window.fetch` antes de la aplicación;
3. rechaza cualquier petición al host Supabase productivo con `QA_BLOCKED_PRODUCTION_SUPABASE`;
4. deja pasar otros destinos;
5. no se activa en producción ni en `main--...`.

### Evidencia automatizada sin tráfico a producción

La prueba `.github/scripts/pm02-validar-barrera.mjs` simuló:

- alias de Deploy Preview: bloqueo correcto;
- permalink inmutable: bloqueo correcto;
- producción: barrera QA no instalada;
- alias `main`: barrera QA no instalada.

La prueba usa un `fetch` falso contado localmente, por lo que la sonda productiva no sale a Internet. Resultado:

- `PM02_BARRERA_FETCH_OK=1`
- `PM02_PRODUCCION_NO_AFECTADA=1`

## 3. Deploy Preview real

Se creó temporalmente el PR #13 exclusivamente para que Netlify generase un Preview del commit PM-02. Netlify creó el deploy `6a9a7afd0fe79b0009cac69b`, contexto `deploy-preview`, estado `ready`, sin Netlify Functions ni Netlify Edge Functions.

El intento de navegación automatizada recibió HTTP 401 antes de cargar la aplicación. La configuración del proyecto Netlify confirma SSO de equipo obligatorio para entornos `non_production`. No se desactivó ni relajó esa protección para realizar la prueba.

Por tanto, la evidencia de ejecución del wrapper se mantiene mediante prueba aislada sin red, mientras la prueba end-to-end del Preview protegido queda condicionada a una sesión SSO autorizada.

## 4. LA-023 · Mensaje de guardado/sincronización

Se comprobó que `Respaldos` mostraba de forma incondicional un mensaje que afirmaba que todo lo capturado ya se guardaba automáticamente en la cuenta y podía verse desde otro dispositivo. Esa afirmación era falsa en modo local.

Se corrigió de forma dinámica:

- **modo local:** informa que se trabaja sin sincronización, que cambios y copias del historial permanecen en el dispositivo y que la copia portátil debe guardarse manualmente fuera del programa;
- **modo nube:** informa que los cambios se intentan sincronizar y que el programa mostrará el error si una escritura no se confirma; no presenta una escritura como confirmada antes de saberlo.

Validaciones:

- texto antiguo eliminado exactamente una vez;
- texto local presente en `fuente.js` y fuente recuperada;
- texto nube presente en ambos;
- `node --check fuente.js` correcto;
- `npm ci`, `npm run check` y `npm run build` de la fuente recuperada correctos;
- paridad exacta del cuerpo recuperado mantenida tras la corrección.

Evidencia: `docs/plan-maestro/PM02_LA023_EVIDENCIA.txt`.

## 5. Backend QA remoto

Estado de Supabase comprobado:

- proyecto real activo identificado;
- no existen development branches en ese proyecto en este momento;
- por tanto, actualmente **no hay un Backend/Auth/Storage remoto separado y exclusivamente QA** listo para ejecutar las pruebas reales de RLS/Auth/Storage/RPC/Edge Functions del Plan Maestro.

No se creó ninguna rama ni proyecto Supabase, no se copiaron datos reales y no se ejecutaron escrituras sobre producción.

La creación de una rama Supabase aislada es una operación potencialmente facturable y requiere confirmación explícita del usuario antes de realizarla. Hasta entonces se mantiene el bloqueo del Preview y no se permite usar el backend real como sustituto de QA.

## 6. Correo, push, IA e importaciones

- No se enviaron emails ni push reales.
- No se invocaron funciones IA/importación reales.
- Las rutas remotas relevantes quedaron inventariadas.
- En Deploy Preview, la barrera impide que las llamadas directas al host productivo lleguen a red.

## 7. Criterio de cierre

Quedan cerrados técnicamente dentro de PM-02:

- identificación del destino real;
- cobertura alias + permalink inmutable;
- bloqueo de tráfico productivo desde Preview;
- prueba positiva/negativa de la barrera sin tráfico real;
- LA-023;
- conservación de la fuente recompilable de PM-01.

Queda **bloqueado por decisión/coste externo**:

- crear y verificar un Backend/Auth/Storage/Functions remoto exclusivamente QA.

Mientras ese punto no se autorice, PM-02 no debe marcarse `CERRADO TOTAL` y GATE G1 permanece bloqueado para las pruebas reales de seguridad/aislamiento.

## Rollback

Todo el trabajo está en ramas de prueba. No hay estado de producción que revertir. Un rollback consiste en descartar los commits de `pm02-integrado` y/o el PR correspondiente. No fusionar a `main`.
