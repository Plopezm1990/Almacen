# Plan Maestro L&A Suite — corrección del arranque frío offline

Fecha: 26/10/2026  
Entorno: QA `qjqorixtkilwsndqayyx` y Deploy Preview del PR `#175`  
Commit verificado: `6996699e4739d0c6cc670f3a4d30cb9aa1c055ac`  
Estado: **CORRECCIÓN TERMINADA; SHELL DE ARRANQUE OFFLINE EN PASS**

## 1. Alcance

Esta tanda corrige y repite la prueba que había terminado con
`ERR_INTERNET_DISCONNECTED`. El objetivo es que la navegación inicial pueda
montar una superficie propia de L&A Suite sin red, manteniendo bloqueadas las
operaciones que necesitan confirmación del servidor.

Esto no convierte el TPV en un sistema de cobro offline. Sin conectividad no
se presenta ninguna venta, cobro, movimiento de Caja ni sincronización como
confirmada.

La prueba se realizó únicamente contra QA. No se usó ni se modificó el
proyecto Supabase de producción.

## 2. Diagnóstico y corrección

El diagnóstico encontró dos causas consecutivas:

1. `sw.js` era únicamente un receptor de notificaciones push y no precacheaba
   el documento ni los recursos de la aplicación.
2. La primera corrección registraba el service worker con un script inline,
   pero la CSP de la suite contiene `script-src 'self'` y bloqueaba ese código.

La corrección final:

- añade [`offline-shell-bootstrap.js`](../../offline-shell-bootstrap.js), un
  bootstrap externo permitido por la CSP que registra `./sw.js` al abrir la
  página;
- precachea el documento, el CSS, el bootstrap, los módulos de arranque, el
  logo, los iconos y el propio service worker;
- sirve la navegación desde la caché cuando la red falla;
- limita el interceptor a peticiones `GET` del mismo origen;
- no intercepta Supabase ni ninguna petición `POST`, `PUT`, `PATCH` o
  `DELETE`;
- conserva los handlers de notificaciones push;
- muestra una pantalla propia de bloqueo seguro cuando la aplicación no puede
  validar el estado del servidor.

## 3. Verificación local

Los controles ejecutados antes de publicar fueron:

- `node tests/f4/b11/b11-offline-boundary-contract.mjs`: **PASS**;
- `node --check sw.js`: **PASS**;
- `node --check offline-shell-bootstrap.js`: **PASS**;
- `node .github/scripts/build-netlify-publish.mjs`: **PASS**;
- `git diff --check`: **PASS**.

El build incluyó `offline-shell-bootstrap.js`, `sw.js` e `index.html` en
`.netlify-dist`.

## 4. Repetición QA en navegador

Procedimiento:

1. Se abrió un preview nuevo del commit `6996699e4739d0c6cc670f3a4d30cb9aa1c055ac`.
2. Se confirmó la carga online del panel `Plataforma · L&A Suite`.
3. Se recargó con el HTML actualizado y se esperó a que el service worker
   quedara en estado `activated`.
4. Se hizo una recarga online normal para que la pestaña quedara controlada
   por el service worker.
5. Se emuló la pérdida de red y se recargó la misma página.
6. Se restauró la conectividad al terminar.

Resultado observado durante la recarga offline:

- `navigator.onLine`: `false`;
- `navigator.serviceWorker.controller`: `true`;
- título: `L&A Suite`;
- la raíz de la aplicación se montó;
- la interfaz mostró `L&A SUITE · INSTALACIÓN INICIAL` y
  `Instalación bloqueada de forma segura`;
- no apareció la página nativa `ERR_INTERNET_DISCONNECTED`;
- la interfaz informó que no abriría el panel ni sincronizaría datos hasta
  validar el estado del servidor.

El resultado es **PASS para el shell de arranque offline y para el bloqueo
seguro de operaciones server-side**. No se declara PASS para cobrar, guardar
o sincronizar sin conexión porque esas acciones deben seguir requiriendo
servidor.

No se creó ninguna venta, cobro, movimiento de Caja, producto, empleado o
empresa. No se ejecutó ninguna mutación contra QA ni contra producción.

## 5. Publicación y CI

- Deploy Preview del PR `#175`: **READY**;
- status Netlify `netlify/chic-entremet-9107cf/deploy-preview`: **success**;
- contrato `f4-b11-offline`: **success**;
- reglas de cabeceras Netlify: **success**;
- commit publicado: `6996699e4739d0c6cc670f3a4d30cb9aa1c055ac`.

Los demás jobs de CI que no forman parte del contrato offline pueden seguir
su ciclo independiente; la corrección queda cubierta por su contrato
específico y por la prueba viva del preview.

## 6. Decisión

**Corrección del arranque frío offline: TERMINADA.**

La garantía cerrada es concreta: la suite puede montar su shell y mostrar una
decisión segura desde una navegación ya preparada, sin red y sin presentar
operaciones de negocio no confirmadas. La funcionalidad de negocio offline no
se habilita por diseño.

La incidencia histórica y su resultado original `NO APTO` se conservan en
[`ETAPA7_1_RESULTADO_ARRANQUE_FRIO_OFFLINE_QA_2026-10-26.md`](ETAPA7_1_RESULTADO_ARRANQUE_FRIO_OFFLINE_QA_2026-10-26.md).

## 7. Qué sigue

1. Ejecutar la campaña T9 física con el dispositivo, impresora y cajón
   autorizados; el shell offline no sustituye la validación de hardware.
2. Si se requiere la comparación A/B, provisionar un segundo contexto QA y
   repetirla sin reutilizar datos de producción.
3. Al cerrar T9 y A/B, emitir el cierre formal completo de Etapa 7.1.
