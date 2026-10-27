# Auditoría comparativa QA / producción y plan correctivo

**Proyecto:** L&A Suite / Almacén  
**Fecha:** 2026-10-27  
**Alcance:** repositorio GitHub accesible, ramas y commits, Netlify, Supabase QA, Supabase producción, funciones SQL/RPC, Edge Functions, logs operativos y datos de control.  
**Modo de ejecución:** solo lectura. No se han aplicado cambios, migraciones, merges, pushes, rollbacks ni modificaciones de variables.

## 1. Resultado ejecutivo

La aplicación está disponible y los despliegues están en estado `READY`, pero existe un desajuste de promoción:

```text
Frontend de producción: release / 2cbc3c4...
Backend Supabase producción: detenido en migraciones de panel/borradores
Backend Supabase QA: contiene C05/C07-D, QR, representación y piloto
```

El frontend publicado en producción referencia funciones C07-D y de representación fiscal que existen en QA y no están todas presentes en producción. Esta es la incidencia prioritaria. No debe resolverse copiando migraciones de forma parcial ni aplicando cambios en producción sin un preflight y un plan de rollback.

## 2. Huella de los entornos auditados

| Capa | Producción | QA | Lectura |
|---|---|---|---|
| Git | `release` en `2cbc3c4fe0a079463bf193d04a37a26e9ad69558` | `codex/fiscal-multiempresa-config` en `8636e8fe8a0c0fe98fb6d4175ca46e08a9d1883f` | QA tiene el último ajuste de impresión/PDF pendiente de promoción |
| Netlify | deploy `6ae0cfad86bbd5a9dfa953d8`, `production`, `READY` | preview 183, deploy `6ae0e4b3178b2f1241d837e0`, `READY` | Ambos compilan; no son el mismo commit |
| Supabase | `flqercbgpgmmfaakrwkc` | `qjqorixtkilwsndqayyx` | QA está por delante en esquema y RPC |
| Migraciones | 159 | 240 | Diferencia material; no es solo visual |
| Tablas/vistas | 119 | 145 | QA contiene artefactos C07-D y QR adicionales |
| Funciones SQL | 392 | 470 | QA contiene 39 funciones relevantes ausentes en producción |
| Edge Functions | 16 | 12 | Versiones y nombres no coinciden; requiere inventario de fuente de verdad |

## 3. Clasificación de diferencias

### 3.1 Diferencias intencionadas

- QA debe contener primero las migraciones de validación C05/C07-D y el piloto sandbox.
- Los datos QA son sintéticos y los datos de producción pertenecen al entorno real.
- QA mantiene fixtures de pruebas, incluidas comandas bloqueadas de laboratorio.
- El PR 183 corrige el cálculo del tamaño del ticket antes de imprimir/guardar el PDF y todavía no está fusionado.
- La preview 182 es anterior; la preview actual para validar es la 183.

### 3.2 Diferencias que deben corregirse o aprobarse formalmente

- Producción sirve frontend fiscal que llama a funciones que no están todas desplegadas en su Supabase.
- El merge de `release` indica que producción debía permanecer sin cambios, pero Netlify producción publica ese commit.
- Las Edge Functions desplegadas no coinciden completamente con las carpetas actuales de `supabase/functions`.
- Producción conserva funciones con nombres de prueba y versiones que no están reflejadas en QA ni en el árbol actual del repositorio.
- QA presenta una concentración anormal de timeouts PostgREST; antes de usarlo como referencia de aceptación hay que identificar la consulta o RPC responsable.

## 4. Funciones críticas faltantes en producción

La siguiente lista debe verificarse antes de cualquier promoción o activación fiscal:

```text
abc_c07d_emitir_checkout
abc_c07d_estado_configuracion_emision
abc_c07d_estado_cuenta
abc_c07d_guardar_emision_config
abc_c07d_leer_emision_config
abc_c07d_guardar_piloto_sandbox
abc_c07d_leer_piloto_sandbox
abc_c07d_listar_adaptadores_fiscales
abc_c07d_reclamar_cola_fiscal
abc_c07d_registrar_documento_fiscal
abc_c07d_resolver_cola_fiscal
abc_fiscal_aceptar_delegacion
abc_fiscal_guardar_representacion
abc_fiscal_invitar_asesoria
abc_fiscal_leer_representacion
abc_fiscal_listar_delegaciones
abc_fiscal_revocar_delegacion
abc_preparar_ticket_fiscal_qa
```

El frontend de producción referencia parte de este contrato. La aplicación puede capturar algunos errores y mostrar estados neutros, pero eso no demuestra que la capacidad fiscal esté operativa.

## 5. Plan correctivo sin aplicar cambios

### C01 — Congelación de promoción

No promover más código fiscal ni migraciones a producción hasta cerrar la matriz de compatibilidad.

**Criterio de salida:** frontend, migraciones y RPC de cada entorno aparecen en una misma línea de compatibilidad.

### C02 — Decisión de producto y operación

Elegir una única estrategia:

1. **Producción estable:** retirar del build productivo las llamadas C07-D todavía no soportadas, o volver a un commit frontend compatible con el backend productivo.
2. **Promoción C07-D:** preparar el conjunto completo de migraciones, RPC, RLS, índices y funciones antes de tocar producción.

No se debe aplicar una mezcla de ambas estrategias.

### C03 — Matriz de promoción obligatoria

Crear y conservar por release:

```text
entorno
commit frontend
deploy Netlify
última migración aplicada
tablas requeridas
RPC requeridas
Edge Functions y versiones
variables/secretos requeridos
preflight ejecutado
postflight ejecutado
aprobación y fecha
rollback asociado
```

### C04 — Reconciliación de Edge Functions

Para cada función desplegada:

- localizar su fuente en el repositorio o declararla heredada;
- comparar versión desplegada con la versión de Git;
- clasificarla como `mantener`, `actualizar`, `retirar` o `solo QA`;
- no retirar funciones hasta comprobar consumidores, cron, webhooks y logs.

### C05 — Preflight exclusivo de QA

En QA, validar:

- migraciones C05/C07-D en orden;
- funciones RPC y permisos;
- configuración fiscal multiempresa;
- representación y delegación de asesoría;
- cola fiscal;
- generación y lectura del QR;
- impresión y guardado completo del PDF;
- aislamiento de producción;
- ausencia de timeouts en los recorridos críticos.

### C06 — Investigación de timeouts QA

Identificar endpoint, RPC, usuario de prueba y consulta responsable de los mensajes `Thread killed by timeout manager`. El resultado debe incluir consulta, duración, frecuencia y corrección propuesta. No se deben eliminar logs ni resetear datos como sustituto del diagnóstico.

### C07 — Limpieza controlada de fixtures QA

Las 12 comandas `BLOQUEADA` con `route_key = SIN_RUTA` pertenecen al ámbito QA. Solo después de conservar evidencia y confirmar que son fixtures, se puede ejecutar una limpieza QA separada. Producción no necesita esa limpieza: sus contadores están a cero.

## 6. Criterios de no-go para producción

La promoción debe detenerse si se cumple cualquiera de estas condiciones:

- falta una RPC referenciada por el frontend;
- falta una tabla, columna, constraint o índice requerido;
- hay una función desplegada cuya fuente no está identificada;
- el preflight de aislamiento QA/producción falla;
- existen errores nuevos en emisión, cola fiscal o QR;
- el deploy no corresponde al commit aprobado;
- no existe rollback verificable;
- el gate obligatorio de CI no tiene evidencia válida.

## 7. Evidencia de implementación actual

- [index-storage-bootstrap.js](../../index-storage-bootstrap.js) selecciona la base de datos productiva por defecto.
- [reset-pruebas-preview.js](../../reset-pruebas-preview.js) activa el proyecto QA para previews y bloquea llamadas de preview a producción.
- [netlify.toml](../../netlify.toml) define el build y el directorio publicado.
- [QR fiscal multiempresa — diseño](QR_FISCAL_MULTIEMPRESA_DISENO_2026-10-26.md) documenta la dirección funcional.
- [QR fiscal QA — contrato](QR_FISCAL_QA_CONTRATO_2026-10-27.md) documenta el alcance de pruebas.

## 8. Estado de seguridad y operación

- No se observaron respuestas HTTP 5xx en Netlify durante la ventana revisada.
- No se observaron respuestas Edge 5xx en QA ni en producción durante la ventana revisada.
- Producción tiene `BLOQUEADA + SIN_RUTA = 0` y efectos en `ERROR = 0`.
- QA tiene fixtures bloqueadas y ningún efecto en `ERROR`.
- Los avisos de advisors de Supabase quedan como hardening posterior; no son motivo suficiente para mezclar o promocionar migraciones.

## 9. Siguiente decisión

El siguiente paso técnico seguro es ejecutar **C05: preflight comparativo de QA**, sin modificar producción, y producir la matriz de promoción. Solo después se decidirá entre estabilizar el frontend productivo o preparar la promoción completa de C07-D.

**Estado del plan:** PREPARADO.  
**Estado de producción:** SIN CAMBIOS.  
**Siguiente etapa:** C05 — preflight QA y matriz de compatibilidad.

## 10. Resultado de C05 — preflight QA ejecutado

**Fecha de ejecución:** 2026-10-27  
**Proyecto examinado:** `qjqorixtkilwsndqayyx` (QA)  
**Producción:** no consultada para aplicar cambios y no modificada.

### 10.1 Resultado de metadatos y esquema vivo

| Comprobación | Resultado |
|---|---|
| Migraciones registradas | `240` |
| Última migración | `20261027150601 abc_f7_c07d_d3_pilot_sandbox` |
| Tablas C05 requeridas | PRESENTES |
| Tablas C07-D requeridas | PRESENTES |
| Columnas C05 ampliadas | PRESENTES |
| Funciones RPC C07-D requeridas | PRESENTES, una sobrecarga por función |
| RLS en tablas fiscales críticas | HABILITADO en las seis tablas revisadas |
| Series C05 | `2` |
| Documentos C05 | `9` |
| Entidades fiscales activas | `4` |
| Vinculaciones entidad-local activas | `5` |
| Registros C07-D | `2` |
| Elementos cola C07-D | `2` |
| Elementos cola C07-D en `ERROR` | `0` |
| Efectos pendientes en `ERROR` | `0` |
| Comandas `BLOQUEADA` + `SIN_RUTA` | `12` fixtures QA |

Las tablas comprobadas fueron `abc_c05_series_documentales`,
`abc_c05_documentos_emitidos`, `abc_c07d_registros_fiscales`,
`abc_c07d_cola_fiscal`, `abc_fiscal_qr_documentos` y las tablas privadas de
configuración, delegación y representación. El `entidad_fiscal_id` requerido
por C05 está presente en los documentos emitidos.

### 10.2 Contratos automatizados

Pasaron:

- `ABC_F5_C07D_PREFLIGHT_CONTRACT=PASS`.
- `ABC_F7_C07D_MIGRATION_CONTRACT=PASS`.
- Contrato de emisión C07-D: `PASS`.
- Contrato de configuración de emisión C07-D.2: `PASS`.
- Contrato de wiring y resolución server-side: `PASS`.
- Contratos del piloto sandbox C07-D.3: `PASS`.
- Contratos de adaptador y expediente de activación: `PASS`.
- Matriz visual de ticket/hardware: `PASS`.
- Contrato de QR visual y contrato AEAT: `PASS`.
- Contrato de aislamiento de contexto: `PASS`.
- Gate de frontera de publicación Netlify: `PASS` tras regenerar el artefacto local `.netlify-dist` con el exportador oficial.

El gate de publicación había fallado inicialmente porque `.netlify-dist` era
un artefacto local antiguo; no estaba versionado y no representaba el contenido
actual de `fuente.js`. Tras regenerarlo, el gate terminó con:

```text
NETLIFY_PUBLISH_BOUNDARY_PASS entries=64 tailwind_bytes=17792
```

### 10.3 Contrato PostgreSQL aislado

El contrato `tests/f5/c07/c07-postgres-contract.mjs` se ejecutó finalmente en
un PostgreSQL efímero local, separado de QA y de producción. Se preparó la
dependencia `pg`, se levantó el contenedor temporal `codex-c07-postgres` y se
ejecutaron las migraciones y fixtures propias del contrato.

Resultado:

```text
FISCAL_CONFIG_MULTIEMPRESA_CHECKS=41
FISCAL_CONFIG_CONCURRENCIA=PASS
ABC_F5_C07_POSTGRES_CONTRACT=PASS
```

El contenedor y la dependencia temporal fueron eliminados al terminar. No se
dejó ningún runner adicional en el repositorio ni se modificaron proyectos
Supabase.

### 10.4 Dictamen C05

```text
C05 PREFLIGHT QA: APROBADO Y CERRADO
Producción: NO TOCADA
Migraciones aplicadas durante C05: NINGUNA
Datos QA modificados durante C05: NINGUNO
```

La parte funcional, estática, de metadatos, concurrencia y PostgreSQL aislado
de QA está aprobada. C05 queda formalmente cerrado en QA.

**Siguiente etapa:** cerrar la decisión de promoción de C07-D y, si se decide
continuar, preparar un paquete de promoción separado para revisión. No
corresponde aplicar nada en producción todavía.

## 11. Matriz de compatibilidad de promoción

| Control | QA | Producción | Dictamen |
|---|---|---|---|
| Commit frontend | `8636e8fe8a0c0fe98fb6d4175ca46e08a9d1883f` | `2cbc3c4fe0a079463bf193d04a37a26e9ad69558` | Diferentes; QA incluye el ajuste de PDF del PR 183 |
| Deploy Netlify | preview 183, `6ae0e4b3178b2f1241d837e0` | `6ae0cfad86bbd5a9dfa953d8` | Ambos `READY` |
| Última migración | `20261027150601 abc_f7_c07d_d3_pilot_sandbox` | `20261027052534 abc_fiscal_multiempresa_panel` | QA por delante |
| Tablas C07-D y QR | Presentes | No completas | Producción no compatible con C07-D completo |
| RPC de configuración/emisión | Presentes | Faltan varias | No promover frontend fiscal sin resolver |
| RLS fiscal crítico | Habilitado | No existe todo el objeto fiscal | No-Go para C07-D productivo |
| Transporte AEAT | `DISABLED` | Fuera de alcance | Correcto; no se activa por esta auditoría |
| Edge Functions | 12 activas | 16 activas | Deriva de inventario; requiere reconciliación |
| 5xx Netlify/Edge | No observados | No observados | Sin incidencia de disponibilidad |
| Comandas `BLOQUEADA/SIN_RUTA` | 12 fixtures | 0 | QA pendiente de limpieza documentada |
| Efectos en `ERROR` | 0 | 0 | Correcto |
| Contrato PostgreSQL | `PASS` en runner aislado | No ejecutado | QA validado; producción no evaluada para promoción |
| Promoción | `PASS` | `NO-GO` para C07-D | No promover todavía |

### Decisión resultante

La matriz queda en estado **NO-GO para promoción de C07-D a producción**. El
motivo no es un error de disponibilidad, sino la incompatibilidad entre el
frontend de producción y el backend de producción. QA sí está preparado para
continuar la validación aislada. C05 ya quedó formalmente cerrado tras ejecutar
el contrato PostgreSQL en un runner temporal con `pg` disponible.

## 12. Estabilización del frontend preparada

Como aplicación de la recomendación de estabilizar producción antes de
promover C07-D, se preparó en el repositorio una puerta de entorno para el
frontend:

- C07-D solo ejecuta sus RPC de emisión, estado y cola cuando
  `window.__modoPruebasQA === true` y el host pertenece a una preview QA o a un
  entorno local permitido.
- Producción deja de llamar al cargar las RPC de delegación y representación
  que todavía no están desplegadas allí.
- Producción muestra un aviso explícito de que delegación y representación no
  están activas, en vez de presentar controles que acabarían fallando.
- La configuración fiscal en borrador existente permanece separada de la
  activación fiscal; no se habilita conexión con AEAT, certificados ni emisión.
- La misma lógica se conserva en `fuente.js` y
  `source-recovery/fuente-recuperado.js`.

Contratos ejecutados después del cambio:

```text
C07D_CHECKOUT_EMIT_CONTRACT=PASS
C07D_D2_3_FRONTEND_CONTRACT=PASS
C07D_D3_PILOT_SANDBOX_UI=PASS
cfg6-ui-contract: OK
QR ticket UI contract: PASS
NETLIFY_PUBLISH_BOUNDARY_PASS entries=64 tailwind_bytes=17792
```

La estabilización está preparada localmente, pero todavía no se ha hecho
commit, push, merge ni despliegue. Antes de publicarla hay que revisarla en una
preview QA nueva y comprobar que producción ya no genera llamadas a las RPC
C07-D ausentes. La promoción C07-D a producción continúa en `NO-GO`.
