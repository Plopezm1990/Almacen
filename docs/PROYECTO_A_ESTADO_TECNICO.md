# Proyecto A — Estado técnico y plan de continuidad

**Proyecto:** Chocoloyos Almacén / Proyecto A  
**Fecha de corte:** 2 de septiembre de 2026  
**Objetivo de este documento:** conservar el estado técnico real del proyecto para continuar sin repetir, deshacer ni reinterpretar decisiones ya validadas.

> Este documento no contiene secretos, tokens, contraseñas ni claves privadas.

---

## 1. Infraestructura

### GitHub

- Repositorio: `Plopezm1990/Almacen`
- Rama de producción: `main`
- `main` actual: `7f792925d6a3d27334ee0e7335ba635b4ed79b6b`
- PR de trabajo acumulado: **#4 — preparación sin Netlify**
- Rama del PR #4: `preparacion-sin-netlify`
- Head validado del PR #4: `567859936ac187e273bceebc366faff25e3ad43e`
- El PR #4 permanece **draft**, sin fusionar y sin desplegar.
- Archivos modificados por el PR #4 respecto de `main`:
  - `_headers`
  - `edge-auth-patch.js`
  - `fuente.js`

### Rama de recuperación de fuente

- Rama: `recuperacion-fuente`
- Head: `3417219fe435bc3d8fcb97d23c3a05a629a9b06e`
- Contiene `source-recovery/` con una base recompilable recuperada desde el bundle existente.
- No sustituye todavía el bundle de producción.

### Supabase

- Project ID: `flqercbgpgmmfaakrwkc`
- Organización actualmente en plan **Free**.
- RLS y permisos han sido endurecidos y probados mediante transacciones reversibles.

### Netlify

- Proyecto: `chic-entremet-9107cf`
- Sitio: `https://chic-entremet-9107cf.netlify.app`
- Rama de producción configurada: `main`
- Repositorio de GitHub correctamente enlazado.
- Build status: activo.
- El bloqueo actual no es un error del código ni de la integración GitHub/Netlify: la cuenta Free agotó los créditos del ciclo.
- Último deploy de producción confirmado: commit `4bf4686d8036ce3d9f1e446c8d51dc6c8a6bd911`.
- El commit `7f79292…` y posteriores no han llegado a producción por el límite de créditos.
- Decisión: **no comprar plan todavía**. Seguir preparando y validando cambios; pagar/esperar créditos únicamente cuando sea necesario publicar.

---

## 2. Estado de seguridad del backend

### Acceso anónimo

- `anon` no tiene acceso directo útil a las tablas públicas sensibles.
- Se retiraron privilegios peligrosos como `TRUNCATE`, `TRIGGER` y `REFERENCES` de roles cliente.
- Las tablas internas de servidor se mantienen cerradas al cliente.

### RLS

RLS está activado y revisado en las tablas críticas. Se eliminaron duplicaciones y patrones de rendimiento problemáticos sin cambiar el comportamiento autorizado.

#### `almacen_kv`

- Políticas unificadas y optimizadas.
- Separación por rol validada.
- `devoluciones` y `movimientosCaja` son claves cloud-sync **bajo demanda**: no necesitan fila física previa porque el almacenamiento usa `upsert`.

#### `fichajes_registro`

- Propietario/Encargado: ven todos.
- Empleado normal: ve únicamente sus propios fichajes.
- Empleado normal: puede insertar únicamente su propio fichaje.
- Empleado normal: no puede corregir ni borrar fichajes.
- Propietario/Encargado pueden corregir.
- Solo Propietario puede borrar.

#### `movimientos_registro`

- Continúa siendo compartido entre perfiles activos porque la sincronización y los cálculos de stock dependen de esa lectura.
- No restringir por usuario/local sin rediseñar antes el sincronizador.
- Los movimientos ya disponen de `localId` histórico y automático para nuevos registros.

#### `auditoria_registro`

- Lectura reservada al Propietario.
- `authenticated` no tiene INSERT directo efectivo.
- Nuevos registros deben pasar por `registrar_auditoria()`.
- Las dos variantes de `registrar_auditoria()` validan sesión/perfil y conservan identidad mostrada + identidad autenticada real.

#### `suscripciones_push`

- RLS por `user_id`.
- Nuevas suscripciones quedan asociadas automáticamente al usuario mediante `suscripciones_push_estampar_propiedad`.
- El trigger redundante antiguo `trg_asignar_usuario_suscripcion_push` y su función fueron eliminados.
- Quedan 4 suscripciones legacy con `user_id = NULL`; no atribuirlas artificialmente a una persona.
- Las cuatro están asociadas al local canónico actual.

### Tablas internas

- `operaciones_procesadas`: RLS sin policies de cliente, uso servidor.
- `prefiltro_limites`: RLS sin policies de cliente, uso servidor/rate-limit.
- Los INFO del Security Advisor sobre “RLS enabled no policy” son intencionales en estas tablas.

---

## 3. RPC / funciones SQL públicas

La superficie pública se redujo deliberadamente.

### RPC necesarias

- `descontar_stock_carrito(...)`
  - SECURITY DEFINER intencional.
  - valida sesión, perfil activo y rol permitido.
  - necesaria para venta atómica/idempotente.

- `registrar_auditoria(...)` — dos variantes
  - SECURITY DEFINER intencional.
  - valida usuario autenticado y perfil activo.
  - necesaria para integridad del historial.

- `obtener_contexto_operativo()`
  - SECURITY DEFINER intencional.
  - solo `authenticated` puede ejecutarla.
  - no acepta un user ID externo: utiliza `auth.uid()`.
  - exige perfil activo.
  - devuelve datos reducidos según rol.
  - está diseñada para no exponer blobs completos sensibles a roles operativos.

### Helpers internos

- El antiguo helper expuesto `es_propietario()` fue retirado al dejar de tener dependencias.
- Las funciones de trigger internas no se exponen como RPC a clientes.
- `search_path` de funciones sensibles fue endurecido donde correspondía.

---

## 4. Matriz de roles validada

Roles considerados:

- Propietario
- Encargado
- Cajero/a
- Churrero/a
- Camarero/a
- Básico

Las pruebas SQL de roles inferiores se realizaron temporalmente dentro de `BEGIN … ROLLBACK`, reutilizando un perfil existente únicamente dentro de la transacción. **No se crearon cuentas reales ni quedaron cambios persistentes.**

### Resultados principales

#### Propietario

- Acceso completo previsto.
- Ve auditoría.
- Ve todos los fichajes.
- Puede gestionar suscripciones legacy.

#### Encargado

- Acceso operativo amplio.
- Ve fichajes de empleados.
- No ve auditoría reservada al Propietario.
- No hereda suscripciones push legacy sin dueño.
- No recibe blobs completos de RR. HH. que no necesita para el registro horario.

#### Cajero/a

- Acceso a Productos y Arqueos según matriz.
- Puede crear y leer `movimientosCaja` y `devoluciones` en el primer uso.
- No recibe Nóminas, Empleados completos ni Proveedores completos.
- Los datos auxiliares necesarios se entregan mediante contexto operativo reducido.

#### Churrero/a

- Acceso a bloques operativos de producción/recepción/conteo correspondientes.
- No puede crear `movimientosCaja`.
- El contexto de fichas de producción excluye campos económicos como precios, coste unitario, mano de obra y gastos generales.

#### Camarero/a

- Claves comunes.
- Puede ver/registrar su propio fichaje.
- No ve fichajes ajenos, auditoría ni suscripciones de otros usuarios.

#### Básico

- Solo claves comunes previstas.

#### Perfil inactivo

- 0 filas visibles en `almacen_kv` durante la prueba.
- El frontend preparado añade además bloqueo global y salida de sesión cuando detecta `activo != true`.

---

## 5. Varios locales

### Datos históricos migrados en Supabase

Se añadió `localId` sin alterar el funcionamiento del frontend de producción anterior.

Estado migrado:

- 497/497 movimientos históricos con `localId`.
- 38 albaranes con `localId`.
- 13 pedidos con `localId`.
- 8 empleados con `localId`.
- 2 gastos con `localId`.

Los 45 movimientos que inicialmente no podían inferirse por producto se completaron únicamente después de verificar que todo el histórico etiquetado y todos los productos pertenecían de forma inequívoca a un único local canónico.

### Nuevos movimientos

Existe lógica de base de datos para que movimientos nuevos hereden automáticamente el `localId` del producto, reduciendo la confianza en valores enviados por navegador.

### Duplicados de locales

Situación real detectada:

- Había dos registros de local duplicados con el mismo nombre.
- Los 116 productos utilizaban un tercer ID histórico que no estaba en la lista visible de locales.
- Decisión segura: preservar el ID histórico usado por productos como ID canónico y marcar duplicados como fusionados/inactivos, sin reescribir los 116 productos.

### Frontend del PR #4

Preparado y probado:

- Selector `Todos los locales` + local activo.
- Filtro por local en:
  - Panel general
  - Resultados
  - Libro de IVA
- Nuevas operaciones etiquetan `localId` en los puntos ya adaptados.
- Avisos de stock bajo, caducidad y caja incorporan `localId`.
- Arqueos incorporan `localId`.

El resto de módulos mantiene por ahora vista conjunta hasta completar separación progresiva. No ampliar todo de golpe sin pruebas funcionales.

---

## 6. Frontend, privacidad y modo local-first

### `edge-auth-patch.js`

La barrera preparada hace varias funciones:

- carga/valida perfil activo;
- aplica matriz de colecciones permitidas por rol;
- sustituye colecciones sensibles por contexto operativo reducido;
- filtra fichajes por empleado cuando corresponde;
- impide que un usuario de rol inferior lea datos sensibles antiguos del Propietario guardados en el mismo navegador;
- revalida el perfil al abrir, periódicamente, al recuperar foco y al volver a la pestaña;
- si el perfil se desactiva, limpia la sesión local necesaria y fuerza recarga/salida.

### Corrección del modo local puro

Durante los smoke tests se detectó que la barrera inicial ocultaba también datos legítimos de una instalación que nunca había sido asociada a una cuenta.

Corrección validada:

- un equipo puramente local/no reclamado puede seguir leyendo y escribiendo sus datos locales;
- una vez que el navegador ha tenido contexto autenticado, cerrar sesión/no tener sesión no permite usar el modo local para saltarse permisos.

### Pendientes falsos de sincronización

También se corrigió que la migración de locales volviera a guardar `locales`/`localActivoId` aunque no hubiera cambios, evitando crear pendientes innecesarios por el mero arranque.

`historialRespaldos` puede generar un pendiente legítimo: la app crea deliberadamente un respaldo automático diario cuando corresponde. No tratarlo como falso positivo.

### `Errores del sistema`

El recorrido de módulos detectó que esta pantalla era la única que intentaba contactar Supabase incluso en modo local.

Corrección incorporada al PR #4:

- si `window.__nubeActiva` es falsa, no intenta cargar `errores_sistema` remotamente;
- muestra un mensaje indicando que el historial remoto no está disponible en modo local.

---

## 7. Caché / PWA

Auditoría completada:

- `sw.js` actual se usa para notificaciones push; no implementa una caché general de la aplicación.
- El riesgo de código antiguo proviene principalmente de caché HTTP de archivos estáticos con nombres estables, especialmente `fuente.js`.
- El PR #4 añade `_headers` para forzar revalidación adecuada de archivos críticos (`index.html`, `fuente.js`, patches y `sw.js`).

No añadir un sistema de cache PWA complejo sin necesidad.

---

## 8. Recuperación del código fuente y build reproducible

El repositorio original no conservaba `fuente.jsx`, `package.json` ni un proceso de build original recuperable desde historial Git.

### Hallazgo

Dentro de `fuente.js` existe una sección marcada `// fuente.jsx`.

- Bundle completo aproximado: 129.764 líneas / 5,43 MB.
- Sección de aplicación recuperada: ~12.915 líneas / ~1,12 MB.
- Conserva nombres de funciones, comentarios y lógica; JSX ya estaba transformado a `React.createElement`.

### Paridad

Se verificó paridad exacta del cuerpo recuperado:

- bytes comparados: 1.117.758 vs 1.117.758;
- SHA-256 idéntico;
- marcador: `PARIDAD_EXACTA=1`.

### Recompilación

- 0 identificadores indefinidos tras restaurar imports.
- Recompila correctamente con esbuild.
- Bundle recompilado pasa `node --check`.
- Se restauró explícitamente `edge-auth-patch.js` en el grafo de entrada recuperado.

### Dependencias identificadas

Versiones originales demostradas desde el bundle cuando fue posible:

- React 18.3.1
- Supabase JS 2.112.4
- XLSX/SheetJS 0.18.5
- jsPDF 4.2.1

Lucide y AutoTable se fijaron como versiones de compatibilidad validadas cuando el bundle no exponía una cadena inequívoca de versión.

### Browser smoke del build recuperado

- pantalla inicial equivalente;
- mismo título y contenido inicial relevante;
- 0 errores JavaScript en la primera comparación;
- la recuperación queda como base de mantenimiento futuro, no como sustitución inmediata de producción.

---

## 9. Edge Functions de Supabase

Estado listado el 2/09/2026.

### Definitivas / funcionales

- `importar-albaran` — v15 ACTIVE
- `importar-nomina` — v10 ACTIVE
- `entrevista-personal` — v12 ACTIVE, `verify_jwt=true`
- `prefiltro-candidato` — v17 ACTIVE, público por diseño con token/controles propios
- `crear-cuenta-empleado` — v10 ACTIVE, `verify_jwt=true`
- `enviar-notificacion` — v6 ACTIVE
- `entrevista-personal-neutral` — v2 ACTIVE, puente temporal mientras producción use frontend anterior

### Funciones desplegadas pero cerradas con 410

Supabase puede mostrarlas como ACTIVE porque el handler sigue desplegado, pero ya no ejecutan la funcionalidad antigua:

- `super-function` — cerrada por seguridad, HTTP 410
- `importar-albaran-prueba` — HTTP 410
- `importar-nomina-prueba` — HTTP 410
- `enviar-notificacion-prueba` — HTTP 410
- `enviar-notificacion-segura` — HTTP 410
- `enviar-notificacion-dispositivo-prueba` — HTTP 410
- `push-prueba-un-dispositivo` — HTTP 410

No confundir “ACTIVE” en la lista de Supabase con “funcionalidad antigua todavía abierta”.

### Importación de nómina

Aunque `verify_jwt=false` a nivel de gateway en la versión actual, la función definitiva realiza autorización personalizada:

- exige Bearer token;
- valida sesión contra Supabase Auth;
- identifica el usuario real;
- consulta su perfil con el servidor;
- exige perfil activo y rol Propietario;
- sin esa autorización devuelve 401/403.

La importación solo devuelve extracción/revisión; no debe guardar nómina automáticamente durante pruebas de lectura.

### Entrevista

`entrevista-personal` v12:

- sesión obligatoria;
- perfil activo;
- solo Propietario/Encargado;
- CORS restringido a orígenes previstos;
- preguntas laborales neutrales;
- sin ranking, scoring ni recomendación contratar/rechazar;
- sin preguntas sobre características protegidas;
- salida descriptiva para revisión humana.

`entrevista-personal-neutral` debe permanecer activa hasta que Netlify publique `7f79292…` o un commit posterior que deje de redirigir hacia ella. Solo entonces cerrar el puente.

### Prefiltro

`prefiltro-candidato`:

- flujo público por token;
- expiración;
- rate limit;
- resumen neutral;
- sin ranking/recomendación automatizada;
- notificación servidor-a-servidor con secreto interno.

### Notificaciones

`enviar-notificacion` v6:

- envío real habilitado;
- destinatarios por rol;
- soporte de `localId`;
- perfiles inactivos fuera;
- alertas operativas filtradas por local para roles operativos;
- Propietario/Encargado pueden recibir alertas empresariales conforme al diseño;
- compatibilidad temporal con 4 suscripciones legacy.

---

## 10. Advisors de Supabase

### Performance Advisor

Las advertencias antiguas de `auth_rls_initplan` y políticas permisivas duplicadas fueron eliminadas.

Quedan avisos INFO de índices todavía no usados. No borrar índices útiles solo para dejar el panel sin avisos, especialmente índices recientes de `suscripciones_push.user_id`/`local_id` que tendrán más uso cuando se renueven dispositivos y se segmenten avisos.

### Security Advisor

Restan principalmente avisos esperados:

- tablas internas con RLS y sin policies de cliente;
- RPC SECURITY DEFINER necesarias (`descontar_stock_carrito`, `registrar_auditoria`, `obtener_contexto_operativo`);
- Leaked Password Protection desactivada.

### Leaked Password Protection

La organización está en Supabase Free. Esta protección se reserva a planes que la soportan; no subir de plan únicamente para eliminar el warning mientras no sea necesario por otras razones.

---

## 11. Pruebas de navegador sobre PR #4

### Smoke global multilocal/seguridad

Aprobado con datos ficticios y Supabase bloqueado.

Cobertura relevante:

- selector de locales;
- Dashboard;
- Resultados;
- Libro IVA;
- migración/reparación histórica;
- modo local puro;
- navegador previamente autenticado sin sesión;
- rol operativo offline;
- no generar pendientes falsos de `locales`/`localActivoId`.

### Smoke de navegación completa

Run final: `33624132256`.

Resultado:

- `MODULOS_OBJETIVO=38`
- `MODULOS_OK_TOTAL=38`
- `FALLOS=[]`
- `SMOKE_NAVEGACION_LIMPIA_OK=1`

Cada módulo se abrió desde un contexto de navegador nuevo para evitar que un clic anterior alterase el menú del siguiente.

Módulos cubiertos incluyen compras, almacén, ventas, costes, finanzas, RR. HH., calidad y sistema.

No hubo:

- errores JavaScript;
- root vacío;
- conexiones a Supabase en modo local tras la corrección de `Errores del sistema`.

---

## 12. Qué NO hacer todavía

1. **No fusionar PR #4** mientras no haya capacidad de desplegar y validar producción de forma controlada.
2. **No cerrar `entrevista-personal-neutral`** antes de que Netlify publique el frontend que deja de redirigir hacia el puente.
3. **No restringir `movimientos_registro` por usuario/local** sin rediseñar primero la sincronización.
4. **No atribuir las 4 suscripciones push legacy a usuarios sin evidencia.**
5. **No borrar índices útiles solo por warnings INFO.**
6. **No reescribir los 116 productos a otro ID de local.** El ID histórico se conserva como canónico.
7. **No sustituir de golpe `fuente.js` por el source recovery.** La recuperación se usará para migración mantenible controlada.
8. **No repetir pruebas de seguridad ya cerradas** salvo que cambie la función/policy relacionada.

---

## 13. Orden recomendado cuando Netlify vuelva a estar disponible

1. Confirmar créditos renovados o plan activado.
2. Verificar que Netlify sigue enlazado a `Plopezm1990/Almacen` y producción sigue en `main`; no reconfigurar si continúa correcto.
3. Revisar una última vez el diff del PR #4.
4. Fusionar/desplegar de forma controlada.
5. Confirmar en Netlify el commit exacto publicado y estado `ready`.
6. Verificar inicio de sesión real Propietario/Encargado.
7. Verificar perfil inactivo.
8. Probar selector de locales en Dashboard/Resultados/Libro IVA con datos reales.
9. Probar ventas, stock, albaranes, gastos y arqueos sin duplicar histórico.
10. Probar notificaciones en al menos un dispositivo renovado para confirmar `user_id + local_id`.
11. Confirmar que el frontend ya llama directamente `entrevista-personal`.
12. Solo después: cerrar `entrevista-personal-neutral`.
13. Hacer smoke final por roles con cuentas reales cuando existan de forma legítima.
14. Limpiar ramas temporales y compatibilidades que ya no hagan falta.

---

## 14. Pendientes reales después del PR #4

Aunque el backend/seguridad está avanzado, todavía quedan tareas de producto/mantenimiento:

- extender separación por local gradualmente al resto de módulos donde tenga sentido;
- renovar las 4 suscripciones push legacy de forma natural cuando los dispositivos vuelvan a registrarse;
- continuar transición desde bundle compilado hacia el código recuperado/recompilable;
- retirar patches temporales cuando exista build fuente definitivo y probado;
- cerrar el puente neutral después del deploy correcto;
- prueba integral real del negocio después del despliegue;
- limpieza final de ramas/compatibilidades/documentación.

---

## 15. Criterio de cierre de Proyecto A

Proyecto A podrá considerarse estable/cerrado cuando:

- producción esté en el commit aprobado;
- roles reales hayan sido validados en interfaz y backend;
- varios locales no oculten, dupliquen ni reasignen histórico;
- ventas/stock/caja/recepción/personal/IVA/resultados funcionen extremo a extremo;
- notificaciones estén asociadas a usuarios/locales donde corresponda;
- no dependamos de endpoints provisionales;
- exista un proceso de build mantenible y documentado;
- se complete una última ronda de smoke con el negocio real sin modificaciones destructivas.
