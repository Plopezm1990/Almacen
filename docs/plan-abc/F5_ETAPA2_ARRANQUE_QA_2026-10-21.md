# Etapa 2 · arranque seguro de la hoja intermedia de contraseñas

Fecha: 2026-10-21
Estado: `SUSTITUCION_RECOMENDADA_DEFINIDA; QA_ONLY; SIN_SECRETOS_MIGRADOS`

## Puerta de entrada

- Etapa 1 aceptada formalmente para QA en
  `F5_AUD009_AUD003_CIERRE_QA_2026-10-21.md`.
- Release validado en el commit
  `ad9f7cab57c8d38cd933af3fde2600c363c3bdd6`.
- QA continúa siendo el único entorno operativo de esta etapa.

## Alcance de esta etapa

La Etapa 2 tratará la antigua hoja intermedia de contraseñas y su posible
retirada o sustitución segura. El primer paquete queda limitado a:

1. Inventariar dónde se menciona, lee o escribe esa hoja en el código y en la
   documentación del proyecto.
2. Identificar qué flujo actual de autenticación y cambio de contraseña es la
   autoridad real.
3. Comprobar si existe algún dato de prueba que dependa de la hoja, sin leer
   ni copiar contraseñas.
4. Diseñar una transición reversible, con aviso visible y sin dejar secretos
   en el repositorio, navegador, logs o exportaciones.

## Límites obligatorios

- No pedir ni recibir contraseñas, claves, tokens ni hojas con secretos.
- No modificar contraseñas de cuentas QA compartidas.
- No crear usuarios ni cambiar permisos durante el inventario.
- No aplicar migraciones ni escribir en Supabase.
- No tocar PROD ni publicar cambios de aplicación.
- No retirar la hoja hasta que exista un reemplazo verificado y una copia de
  configuración que no contenga secretos.

## Criterios de entrada y parada

El análisis se detendrá antes de editar si aparece cualquiera de estas
diferencias:

- QA, `release` y el código local no corresponden al mismo candidato.
- La hoja contiene secretos reales o datos de clientes.
- El flujo actual no tiene una ruta de recuperación clara.
- La retirada puede bloquear el acceso de una cuenta existente.
- Se necesita una decisión sobre correo, proveedor de identidad o política de
  recuperación que todavía no esté aprobada.

## Criterios de aceptación de la Etapa 2

- Inventario completo y revisado de consumidores de la hoja.
- Flujo de acceso/cambio/recuperación documentado sin exponer secretos.
- Plan de retirada o sustitución con rollback y prueba QA definida.
- Prueba de que las cuentas existentes no quedan bloqueadas.
- Autorización separada antes de cualquier escritura remota o cambio de código.

## Inventario inicial de solo lectura

- No aparece en el código una dependencia operativa de una «hoja intermedia»
  con ese nombre; las coincidencias están en documentación de autorización y
  pruebas.
- El flujo implementado usa `owner-bootstrap-prelock.js` y
  `plataforma-panel.js`.
- La comprobación de estado usa la RPC
  `plataforma_mi_estado_password`; el cambio se realiza mediante
  `supabase.auth.updateUser({ password: ... })` desde la pantalla
  «Elige tu contraseña».
- Los contratos locales `p04`, `p05` y `p06`, junto con los contratos de base
  `p11`, `p12` y `p13`, cubren el flujo, los filtros y la recuperación ante
  ausencia de la RPC.
- No se leyeron contraseñas, tokens ni valores secretos. El inventario no
  encontró un secreto que deba copiarse o migrarse.

Conclusión del inventario: la hoja parece ser un artefacto operativo externo al
repositorio, no la fuente de autoridad del acceso actual. Se declara obsoleta
como fuente de acceso; su eliminación física queda pendiente de localizar el
archivo exacto y completar la prueba de recuperación.

## Decisión recomendada

Se adopta la sustitución progresiva por el flujo autoritativo existente:

1. La RPC `plataforma_mi_estado_password` determina si la contraseña inicial
   sigue pendiente.
2. El usuario cambia la contraseña desde «Elige tu contraseña» mediante
   `auth.updateUser`.
3. El servidor mantiene los filtros de capacidad y el cliente no almacena ni
   transmite una hoja de contraseñas.
4. La hoja externa queda declarada **obsoleta y solo de contingencia**, sin
   actualizarla ni copiar sus valores.
5. Su retirada física queda pendiente de identificar el archivo exacto y
   comprobar que ninguna cuenta depende de ella; no se borra nada por
   aproximación.

Esta decisión elimina el riesgo principal —la existencia de contraseñas fuera
del flujo de Auth— sin introducir una migración de secretos ni cambios remotos.

## Plan de retirada segura

- **QA:** comprobar con una cuenta ficticia nueva que el alta, primer acceso,
  cambio de contraseña, cierre de sesión y segundo acceso funcionan sin la
  hoja.
- **Regresión:** repetir P04, P05 y P06 y comprobar que una cuenta existente no
  vuelve a pedir el cambio.
- **Corte:** congelar la hoja como solo lectura y documentar su fecha de
  obsolescencia; no copiar contraseñas a ningún sistema nuevo.
- **Eliminación:** solo después de identificar el archivo exacto y recibir una
  autorización específica para borrarlo.

## Contratos locales comprobados

- P04 panel y reglas de contraseña: PASS.
- P05 runtime de panel y cambio de contraseña: `95/95`, PASS.
- P06 arranque de Plataforma y bloqueo inicial: `44/44`, PASS.
- Las dependencias de UI se instalaron únicamente en una carpeta temporal de
  pruebas; no se añadieron al repositorio.

## Siguiente acción autorizada

Ejecutar en QA la prueba de alta y primer acceso de una cuenta ficticia nueva,
sin que ninguna contraseña sea compartida con el asistente ni guardada en el
repositorio. La eliminación física de la hoja seguirá requiriendo identificar
su archivo exacto y una autorización específica.

## Resultado QA de la acción autorizada · 2026-10-21

- Empresa ficticia creada: `QA Alta 171, S.L.`.
- Primer acceso: la aplicación mostró «Elige tu contraseña» y obligó a
  establecer una contraseña nueva sin revelar su valor al asistente.
- Segundo acceso: la cuenta entró directamente, sin volver a pedir el cambio.
- Cuenta QA existente: entró directamente y no quedó bloqueada.
- Regresión local posterior: P04 PASS; P05 `95/95 PASS`; P06 `44/44 PASS`.
- No se modificó PROD, no se aplicaron migraciones y no se copiaron secretos.

## Inventario final de la hoja externa · 2026-10-21

- No se encontró ninguna hoja de contraseñas ni fichero tabular con ese
  propósito dentro del workspace, `sources/` ni en las carpetas de trabajo
  conocidas de `OneDrive\Documentos\ChatGPT\PLAN ABC`.
- Las coincidencias encontradas corresponden al código, contratos y páginas de
  recuperación, no a una hoja operativa consumida por la aplicación.
- No se inspeccionó ni se abrió ningún archivo de perfil de navegador que
  pudiera contener secretos.
- El archivo externo exacto de la hoja sigue sin localizarse; por tanto queda
  congelado como pendiente y no se elimina, mueve ni modifica nada.

### Estado de cierre

La sustitución funcional queda validada en QA. La retirada física de la hoja
queda fuera de este cierre y requiere: (1) localizar el archivo exacto, (2)
comprobar que ninguna cuenta depende de él y (3) autorización específica para
borrarlo.
