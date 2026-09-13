# PM26 P07a — Diagnóstico del defecto K y enlace seguro con la Fase B de F

## Estado

**Diagnóstico cerrado; ninguna corrección aplicada todavía.** Este paquete
determina la causa real del defecto K, el mecanismo mínimo para corregirlo y
el orden en que debe coordinarse con la Fase B del aviso F. La inspección del
backend fue exclusivamente de solo lectura. No se llamó a
`prefiltro-candidato`, no se creó ni eliminó ningún prefiltro y no se aplicó
la migración F en QA.

## 1. Causa real del defecto K

`PrefiltroPublico` realiza dos peticiones —`comprobar` y `enviar`— a una URL
literal de la Edge Function de producción. La ruta pública se monta
directamente cuando el hash coincide con `#/prefiltro/<token>` y **no pasa
por `AppConSesion`**. Por tanto, en ese recorrido:

- `window.conectarNube()` no se ejecuta;
- `window.__nubeCliente` continúa inicialmente en `null`;
- no es correcto hacer depender la solución de un cliente ya inicializado.

En Deploy Preview, `reset-pruebas-preview.js` oculta actualmente el defecto:
intercepta la petición literal destinada a producción y la redirige a QA.
Esa barrera es una defensa adicional útil, pero no convierte el literal en
una selección de entorno correcta. El componente sigue eligiendo producción
y depende de que otro parche lo corrija después.

La configuración fiable ya existe antes de cargar el módulo:

1. `reset-pruebas-preview.js` se ejecuta primero y, solo en un hostname de
   Deploy Preview reconocido, fija el modo QA y su configuración.
2. El bloque de configuración de `index.html` publica `window.NUBE_URL` y
   `window.NUBE_CLAVE`; si el modo QA está activo, sustituye ambas por las de
   QA.
3. `fuente.js` se carga después como módulo.

Por ello, la fuente correcta para la URL pública no es el hostname de la
página ni un segundo mapa de proyectos: es la misma `window.NUBE_URL` activa
que posteriormente utiliza `window.conectarNube()` para crear el cliente.

## 2. Estado remoto relevante, observado sin invocar funciones

La inspección de metadatos y código de las Edge Functions confirmó:

- Producción tiene `prefiltro-candidato` activa, pública a nivel de gateway
  (`verify_jwt=false`) y con la implementación real del cuestionario.
- QA tiene el mismo slug activo y público, pero su implementación actual es
  deliberadamente un simulador que responde `503` sin tocar datos.
- La implementación real de producción usa `SUPABASE_URL` del propio entorno
  para la tabla, pero contiene además una llamada interna de notificación
  fijada a producción.

Consecuencia: K puede y debe enviar el Deploy Preview a la función de QA,
pero no se puede declarar un recorrido público real de QA ni copiar allí la
función de producción tal cual. Hacerlo podría reintroducir comunicación
cruzada con producción y además exigiría revisar CORS. Esa eventual
habilitación es un paquete separado y requiere autorización específica.

La evidencia resumida, sin project refs, claves ni identificadores de
funciones, está en `P07A_EVIDENCIA_EDGE_FUNCTIONS.json`.

## 3. Solución mínima elegida para K

En P07b se añadirá una función pequeña y reutilizable que:

1. acepta únicamente el slug público esperado;
2. rechaza modo local sin backend;
3. obtiene la base exclusivamente de `window.NUBE_URL`;
4. exige una URL absoluta HTTP(S) válida, sin credenciales, query ni hash;
5. si `window.__modoPruebasQA` está activo, exige que el origen de
   `window.NUBE_URL` coincida con `window.__qaNubeUrl`;
6. construye `/functions/v1/prefiltro-candidato` con `URL`, sin concatenación
   de project refs;
7. devuelve fallo de configuración antes de llamar a `fetch` si falta o no
   coincide cualquier dato.

El componente usará un único adaptador para las acciones `comprobar` y
`enviar`. Se conserva `fetch` —forma admitida oficialmente por Supabase para
funciones públicas desde el navegador— porque crear el cliente solo para
esta ruta añadiría automáticamente cabeceras de clave/sesión y cambiaría la
semántica pública actual. No se añadirá ninguna clave al componente.

Referencias técnicas:

- https://supabase.com/docs/guides/functions/quickstart-dashboard
- https://supabase.com/docs/reference/javascript/functions-invoke

## 4. Fase B del aviso F — cambio exacto del cliente autenticado

El flujo de gestión sí se ejecuta después de inicializar el cliente. Hoy:

- crear hace `INSERT` directo;
- listar hace `SELECT` directo;
- eliminar hace `DELETE` directo.

El SQL preparado de F establece lectura por RLS y mutaciones solo mediante
RPC. P07b debe cambiar exclusivamente las dos mutaciones:

| Operación cliente | Destino final | Contexto enviado |
|---|---|---|
| Crear prefiltro | `pm11_crear_prefiltro_candidato` | empresa activa, local activo y nombre |
| Listar prefiltros | `SELECT` con RLS | ninguno añadido por el cliente |
| Eliminar prefiltro | `pm11_eliminar_prefiltro_candidato` | empresa/local de la propia fila y token |

Para crear, `GestionAlmacen` debe entregar a `crearLogicaPrefiltros` la
empresa y el local activos. Si falta cualquiera, la llamada debe fallar
cerrada. Para eliminar no debe reutilizarse a ciegas el local actualmente
seleccionado: se pasarán `empresa_id` y `local_id` de la fila mostrada. La RPC
volverá a comprobar tanto la autorización del usuario como que el token
pertenece exactamente a ese contexto.

La respuesta de creación solo se aceptará como token si tiene la forma
esperada; la auditoría local se registrará únicamente tras éxito real. En la
eliminación se exigirá `data === true`; un token inexistente o una respuesta
ambigua no se presentarán como éxito.

Referencia técnica para RPC:

- https://supabase.com/docs/reference/javascript/rpc

## 5. Ajustes pendientes del artefacto F antes de aplicarlo

La migración preparada de F todavía no debe aplicarse. Antes se corregirán
dos detalles ya endurecidos en H pero aún ausentes aquí:

- `SET LOCAL lock_timeout = '5s'` y
  `SET LOCAL statement_timeout = '30s'` deben ir inmediatamente después de
  `BEGIN`, antes del preflight;
- se añadirá un preflight independiente de solo lectura para repetir, contra
  el mismo proyecto QA, las condiciones críticas justo antes de la única
  llamada a `apply_migration`.

También se actualizarán el hash y el contrato de P06h. Ningún cambio de este
apartado se aplicará todavía a QA.

Precisión sobre el estado actual: el alta/borrado de prefiltros ya está
bloqueado en QA por RLS sin políticas/grants; aplicar solo F no rompería una
mutación QA funcional, pero tampoco resolvería la pantalla mientras el
cliente siguiera usando escrituras directas. La entrega debe seguir siendo
coordinada.

## 6. Orden de trabajo y despliegue

### P07b — código y validación, sin despliegue de esquema

Archivos de aplicación previstos:

- `source-recovery/fuente-recuperado.js`;
- `fuente.js`;
- el SQL QA-only de F y su documentación/contrato, solo para el
  endurecimiento previo descrito arriba;
- nuevos contrato, informe y workflow P07b.

Procedimiento:

1. modificar primero la fuente canónica recuperada;
2. ejecutar su build canónico y validar sintaxis/anclas;
3. reflejar únicamente el cambio funcional revisado en el bundle servido,
   evitando adoptar las diferencias cosméticas históricas de un reemplazo
   completo no byte-idéntico;
4. comprobar las mismas garantías en fuente canónica, bundle construido y
   `fuente.js` servido;
5. interceptar todas las peticiones en memoria: cero solicitudes reales;
6. ejecutar pruebas de producción, QA, configuración ausente, URL inválida,
   incoherencia QA, modo local y ausencia de filtración cruzada;
7. ejecutar pruebas negativas que eliminen por separado cada garantía;
8. ejecutar regresión acumulada, commit/push único y gate remoto sobre el
   HEAD exacto.

P07b no aplicará F ni modificará Netlify.

### P07c — aplicación controlada de F en QA

Solo después de P07b verde y de una autorización específica:

1. redescubrir el proyecto por nombre y confirmar que es L&A Suite QA;
2. comprobar hash, catálogo, políticas, funciones y que la tabla sigue con
   cero filas;
3. ejecutar el preflight independiente contra ese mismo proyecto;
4. una única llamada a `apply_migration`, sin reintento automático;
5. verificar columnas, `NOT NULL`, RLS, grants, RPC, historial de migración y
   ausencia de cambios fuera de la tabla/funciones previstas;
6. desplegar/abrir únicamente el Deploy Preview correspondiente al cliente
   P07b y validar la gestión autenticada con identidades QA autorizadas.

La prueba pública real seguirá bloqueada por el simulador 503 de QA. No se
usará producción para suplirla.

## 7. Riesgos y reversión

- **Riesgo de fuga cruzada**: contenido mediante coincidencia obligatoria de
  la configuración QA y peticiones interceptadas en pruebas.
- **Riesgo de cambiar la semántica pública**: se evita manteniendo `fetch` y
  sin introducir claves o sesiones en el cuestionario.
- **Riesgo de contexto equivocado al eliminar**: se evita usando el contexto
  de la fila y revalidándolo en la RPC.
- **Riesgo de desplegar cliente y esquema descoordinados**: la rama no se
  promueve a producción; F solo se aplica a QA tras P07b verde.
- **Reversión de código**: revertir el commit P07b y regenerar/verificar de
  nuevo ambos artefactos.
- **Reversión de F**: nunca automática. Si aún no existen filas, puede usarse
  la reversión ya probada. Si existen filas, detenerse y diseñar una
  reversión preservando `empresa_id`/`local_id`; no se eliminan columnas ni
  datos a ciegas.

## 8. Alcance preservado

- No se modificó `fuente.js`, la fuente recuperada, `index.html`, el reset de
  preview ni el SQL de F en P07a.
- No se invocó ninguna Edge Function.
- No se escribió en QA, producción ni TPV.
- No se tocó `main`, `release` ni Netlify.
- El defecto E sigue pendiente de la acción manual acordada.
- El defecto L sigue sin corregir en producción.
- PM25 P02 continúa `PARCIAL/BLOQUEADO`.

```text
PM26_P07A_ESTADO=DIAGNOSTICO_CERRADO_SIN_APLICAR
PM26_P07A_DEFECTO_K_CAUSA=URL_LITERAL_PRODUCCION
PM26_P07A_RUTA_PUBLICA_NO_INICIALIZA_CLIENTE=SI
PM26_P07A_CONFIG_QA_ANTES_DEL_MODULO=SI
PM26_P07A_EDGE_QA_ACTIVA_SIMULADA_503=SI
PM26_P07A_EDGE_PROD_NO_COPIAR_A_QA=SI
PM26_P07A_SOLUCION_ELEGIDA=NUBE_URL_ACTIVA_FAIL_CLOSED
PM26_P07A_FASE_B_RPC_MAPEADA=SI
PM26_P07A_F_REQUIERE_ENDURECIMIENTO_PREVIO=SI
PM26_P07A_PRUEBAS_VIVAS_PREFILTRO=NO
PM26_P07A_AVISO_F_APLICADO_QA=NO
PM26_P07A_FUENTE_JS_TOCADO=NO
PM26_P07A_SUPABASE_ESCRITURA=NO
PM26_P07A_MAIN_RELEASE_NETLIFY_TPV_TOCADOS=NO
```
