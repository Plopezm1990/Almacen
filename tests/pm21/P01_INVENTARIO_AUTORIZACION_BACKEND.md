# PM21 P01 — Inventario de autorización de backend (solo lectura)

Fecha: 2026-09-08
Rama: `claude/pm21-identidad-autorizacion`
Base: `main` en `93a570badba1c5375febfbddc1dffdbcef003dcd` (PM20/Puerta G2, mergeado y verificado).

## Alcance de este punto

Estrictamente de solo lectura. No se ha aplicado ninguna migración, no se ha escrito
ningún dato, no se ha modificado `fuente.js`. Todo lo descrito aquí es resultado de
inspeccionar directamente el esquema, las políticas RLS, las funciones y sus cuerpos
reales en el entorno QA — nunca supuesto por el nombre de una función o de un paquete.
No se publica ningún identificador interno del proyecto Supabase (ref, host, claves);
las tablas, funciones y políticas se citan por su nombre porque son parte del propio
código de la aplicación, no infraestructura.

## 1. Inventario de funciones `SECURITY DEFINER` expuestas a `authenticated`

41 funciones en el esquema `public` son `SECURITY DEFINER`. De ellas, 39 son ejecutables
por el rol `authenticated` vía `/rest/v1/rpc/...` (el asesor de seguridad de Supabase las
marca todas con el aviso genérico "Signed-In Users Can Execute SECURITY DEFINER
Function" — ese aviso es normal y esperado para RPCs de negocio; no distingue si
autorizan correctamente por dentro, así que no sustituye la revisión real).

Clasificación real, por lectura del cuerpo de cada una:

### 1.1 — 24 funciones que autorizan inline con los helpers establecidos

Todas comprueban `private.la_usuario_activo()` y `private.la_tiene_empresa(...)` /
`private.la_tiene_local(...)` (o el helper de rol específico del módulo) antes de
mutar. Incluye todas las `registrar_*`/`revertir_*`/`trasladar_*`/`anular_arqueo_caja`/
`registrar_auditoria`/`obtener_contexto_operativo` y las `pm13_fichar`/
`pm13_fichaje_manual`/`pm13_corregir_fichaje`/`pm13_anular_fichaje`.

### 1.2 — 8 funciones que en un primer barrido por patrón de texto parecían no autorizar,
### verificadas una a una y confirmadas SEGURAS

Estas ocho no contienen literalmente `membresias_usuario`/`perfiles` en su propio cuerpo
— por eso una búsqueda de texto ingenua las habría marcado como sospechosas. Al leer el
cuerpo completo, las ocho delegan la autorización en una función auxiliar de `private`
que sí consulta `membresias_usuario`, y la llaman antes de cualquier mutación:

| Función | Autoriza vía | Comprobación real |
|---|---|---|
| `pm11_alta_empleado` | `private.pm11_puede_mutar_personal` | Propietario (cualquier local si `todos_locales`, o el local exacto) o Encargado del local exacto |
| `pm11_baja_empleado` | ídem | ídem, más `empresa_id`/`local_id` del empleado objetivo cruzados contra los parámetros |
| `pm11_editar_empleado` | ídem | ídem |
| `pm11_reactivar_empleado` | ídem | ídem |
| `pm11_migrar_empleados_legacy` | `private.pm11_puede_migrar_personal` | Solo Propietario (más restrictivo, correcto para una migración masiva) |
| `pm11_previsualizar_migracion_empleados_legacy` | ídem | ídem |
| `pm13_registrar_ausencia` | `private.pm11_puede_mutar_personal` | ídem a alta/baja, más solapamiento de fechas comprobado |
| `pm13_anular_ausencia` | ídem | ídem, más idempotencia por `operationId` |

**Corrección de método**: este hallazgo (falsos positivos de la heurística de texto) se
documenta explícitamente porque estuvo a punto de reportarse como hueco de autorización
sin serlo. La lección para el resto de PM21: nunca concluir un veredicto sobre una
función por lo que NO contiene en su propio cuerpo; hay que seguir la cadena de llamadas
hasta la comprobación real, tal como exige el encargo.

Pendiente de verificar en P02 (comportamiento real con las 5 identidades QA, no solo
lectura de código): que los helpers `pm11_puede_mutar_personal` / `pm11_puede_migrar_personal`
efectivamente rechazan cuando se ejecutan, no solo que su definición SQL parece correcta.

### 1.3 — 5 funciones `*_pm09`: envoltorios verificados, no un hueco

`registrar_venta_stock_pm09`, `registrar_devolucion_venta_pm09`,
`registrar_venta_stock_carrito_pm09`, `revertir_venta_stock_pm09`,
`revertir_venta_stock_carrito_pm09` no contienen ninguna comprobación de autorización
propia porque son envoltorios de una sola línea que delegan en la función sin sufijo
`_pm09` (p. ej. `registrar_venta_stock_pm09` llama a `registrar_venta_stock`), que sí
autoriza. `auth.uid()` se preserva correctamente a través de la llamada porque
`SECURITY DEFINER` cambia el rol de ejecución, no la identidad de sesión. Verificado
leyendo el cuerpo completo, no asumido por el nombre.

### 1.4 — 2 funciones sin `EXECUTE` para `authenticated`

`pm11_finalizar_creacion_cuenta_empleado` y `qa_ping` no son ejecutables por
`authenticated` ni `anon`. Sin exposición.

### 1.5 — 3 funciones adicionales encontradas fuera del recuento inicial de 41

- `pm05_scope_almacen_kv`: `RETURNS trigger`, no es una función invocable por RPC —
  el aviso de que `anon` tiene `EXECUTE` es irrelevante en la práctica: Postgres no
  permite invocar una función de disparador directamente por SQL/REST.
- `pm12_cancelar_conteo_stock` / `pm12_confirmar_ajuste_stock`: envoltorios
  `SECURITY INVOKER` de una línea en `public` que delegan en `private.pm12_*`
  (`SECURITY DEFINER`, ahí sí). Cuerpo de ambas funciones `private` leído completo:
  autorización real (`la_usuario_activo`, `la_tiene_empresa`, `la_tiene_local`, y
  `pm07_puede_gestionar_stock()` para el ajuste), idempotencia por `operation_id`,
  bloqueo de filas en orden estable, validación exhaustiva de plan/bases antes de
  mutar. Sin defecto.

## 2. Tablas, RLS y políticas por operación

29 tablas en `public` (más `storage.objects`). Todas tienen RLS activado
(`relrowsecurity=true`); ninguna encontrada con RLS desactivado.

### 2.1 — 3 tablas con RLS activado y CERO políticas (deniegan todo por defecto)

`operaciones_procesadas`, `prefiltro_limites`, `prefiltros_candidatos`. Verificado por
su forma (columnas) que son de uso exclusivamente backend: ledger de idempotencia,
límite de tasa del prefiltro de selección de personal, y tokens/respuestas de
candidatos no autenticados. El acceso legítimo pasa por funciones/edge functions
privilegiadas, nunca por el cliente directamente — correcto por diseño, no un hueco.

### 2.2 — HALLAZGO REAL: `movimientos_registro` sin aislamiento por empresa

Misma forma exacta del defecto ya corregido en PM20 P06 para `errores_sistema`: política
única `cmd=ALL`, `USING(true)`, `WITH CHECK(true)`, para el rol `authenticated`. La
tabla no tiene columnas `empresa_id`/`local_id` (solo `id, fecha, datos, creado_en`).

Verificado que **no está huérfana solo de nombre**: no aparece ninguna referencia en
`fuente.js`, en ninguna migración trackeada en el repositorio, ni en el cuerpo de ninguna
función SQL del proyecto (`information_schema.routines` sin coincidencias). Tiene 3
filas. Todo indica que es un resto de una etapa temprana (probablemente anterior a la
arquitectura de `movimientos_stock` de PM07), nunca limpiado ni endurecido cuando se
corrigió `fichajes_registro`/`auditoria_registro`, sus tablas hermanas de la misma
familia `_registro`, que sí tienen políticas correctas por empresa/local/rol.

**No explotable por la aplicación actual** (nada la usa), pero **sí explotable
directamente por API**: cualquier usuario autenticado del proyecto puede leer, insertar,
modificar o borrar esas filas vía REST, sin relación con su empresa. Es un defecto de
integridad real, aunque de exposición baja mientras nada escriba en ella. Pendiente de
tu autorización específica para la migración de corrección (mismo patrón que
`errores_sistema`: retirar la política permisiva; si se decide conservar la tabla,
añadir `empresa_id`/`local_id` y una política equivalente a `auditoria_registro`; si se
decide que es basura de desarrollo sin ningún consumidor, la alternativa más simple es
eliminarla — ambas opciones son tuyas, no las ejecuto sin decisión).

### 2.3 — Resto de tablas: políticas correctas, con dos matices menores

- `pagos_encargo` y las 3 políticas de `encargos_empresa` están registradas para el rol
  `{public}` en vez de `{authenticated}` como el resto de la base. No es una vía de
  bypass real: la condición (`private.la_tiene_empresa`/`la_tiene_local`) exige
  `auth.uid()` no nulo con membresía activa a través de `la_usuario_activo()`, así que
  una petición anónima sigue siendo rechazada por la propia condición, no por el ámbito
  del rol. Queda anotado como inconsistencia de estilo a corregir cuando se autorice
  cualquier migración de PM21, no como hallazgo de seguridad por sí solo.
- `albaranes_empresa` no exige el rol de gestión financiera
  (`private.pm06_puede_gestionar_finanzas()`) en sus mutaciones, a diferencia de
  `gastos_empresa`/`facturas_directas_empresa`. Plausible por diseño (recepción de
  mercancía vs. gestión económica son privilegios distintos), pero no está confirmado
  como decisión deliberada — se registra como pregunta para resolver con matriz de
  roles en P02, no como defecto.

### 2.4 — Grants de tabla (`GRANT`) frente a políticas RLS

Confirmado en `pagos_encargo` (y es el patrón estándar de Supabase en todo el esquema):
los roles `anon`/`authenticated`/`service_role` tienen `GRANT` de INSERT/SELECT/UPDATE/
DELETE a nivel de tabla. Esto por sí solo no autoriza nada: RLS sigue exigiendo una
política que además autorice esa combinación de rol y comando. Donde no existe política
de escritura para una tabla (p. ej. las tablas cuyo único acceso de cliente es SELECT,
como `stock_operaciones`, `movimientos_stock`, `arqueos_caja`), el `GRANT` de escritura
es letra muerta: RLS deniega por ausencia de política, no hace falta revocar el `GRANT`.

## 3. Vistas

Una sola vista en `public`: `stock_estado`, con `security_invoker=true` — respeta las
políticas RLS del usuario que consulta, no las del propietario de la vista. Correcto.

## 4. Storage (adjuntos)

Un único bucket, no público, con límite de tamaño y tipos MIME restringidos
(imagen/PDF).

### HALLAZGO REAL: políticas de `storage.objects` sin aislamiento por empresa

Las 4 políticas (INSERT/SELECT/UPDATE/DELETE) del bucket solo comprueban que
`bucket_id` sea el del propio bucket — ninguna comprueba la ruta del objeto ni ningún
metadato de empresa/local. Cualquier usuario autenticado del proyecto puede leer, subir,
modificar o borrar cualquier archivo de cualquier empresa dentro de ese bucket.

Verificado el uso real: **el frontend no llama a `supabase.storage.from(...)` en ningún
punto de `fuente.js`** — ninguna funcionalidad de adjuntos está conectada todavía (el
bucket existe por la preparación de entorno de PM-02, "Storage exclusivamente de
pruebas", pero no hay ninguna función de negocio que suba o lea archivos ahí). Riesgo
real hoy: bajo (no hay archivos de negocio expuestos, y nada de la app los genera).
Riesgo si se activa cualquier función de adjuntos sin corregir esto antes: alto — es
exactamente el escenario que el Plan Maestro señala en NR-02 y en la fila "Storage" del
contrato de permisos.

Pendiente de tu autorización específica: definir la convención de ruta (p. ej.
`empresaId/localId/...`) y añadir la comprobación correspondiente a las 4 políticas
antes de que cualquier paquete futuro conecte una función de adjuntos real.

## 5. Identidades QA disponibles para la matriz de pruebas

Confirmado el inventario de perfiles con membresía activa: 3 Propietario (uno con
`todos_locales`), 1 Encargado, 1 Cajero/a, 1 Camarero/a, 1 Básico — 7 perfiles en total,
todos con membresía. Cubre los roles reales de `ROLES_EMPLEADO` del frontend
(`fuente.js`), más el propietario con alcance ampliado.

**Hueco identificado**: no hay confirmado un segundo Propietario de una empresa
*distinta* con un local ya cerrado/fusionado, ni una cuenta explícitamente inactiva
(`perfiles.activo=false`) o con membresía revocada (`membresias_usuario.activo=false`)
para probar el caso negativo "sesión revocada". Antes de ejecutar la matriz en P02 hace
falta o bien confirmar que esas identidades ya existen con otro nombre, o crear fixtures
adicionales — ambas cosas requieren tu autorización si implican escritura en QA.

## 6. Matriz de pruebas prevista para P02 (diseño, no ejecutada aún)

| Caso | Identidad | Objeto | Esperado |
|---|---|---|---|
| Positivo | Propietario A | Cualquier tabla/RPC de su empresa | Lectura y escritura autorizadas según su rol |
| Negativo | Propietario A | Fila/objeto de empresa B (manipulando `empresa_id` directamente en la petición) | Rechazo — 0 filas en SELECT, excepción en RPC |
| Negativo | Encargado A1 | Objeto de A2 (mismo empresa, otro local) | Rechazo si el rol exige local exacto |
| Positivo | Encargado A1 | Objeto de A1 | Autorizado según su rol |
| Negativo | Cajero/a, Camarero/a, Básico | RPCs de personal/finanzas/migración | Rechazo — su rol no las incluye |
| Negativo | Cualquier identidad | Relación cruzada (p. ej. `empleado_id` de otra empresa en un RPC de fichaje) | Rechazo por el cruce de contexto, no solo por el nombre del recurso |
| Negativo | Sesión revocada/caducada | Cualquier lectura/escritura | Rechazo — requiere fixture o confirmación de identidad existente (ver §5) |
| Negativo (Storage) | Cualquier autenticado | Objeto subido por otra empresa (una vez exista convención de ruta) | Bloqueado tras la corrección — hoy pasaría, ver §4 |

No se usará `service_role` para ninguna prueba de autorización — solo, si hiciera falta
preparar un fixture controlado (p. ej. la identidad de sesión revocada del §5), con tu
autorización previa y dejando constancia expresa de que esa fila es de preparación, no
de prueba.

## 7. Dependencias registradas para PM-22/24/25 (sin decidir alcance todavía)

- **PM-22** (móvil/accesibilidad): necesita dispositivos Android/iOS reales o una
  decisión explícita de qué se simula (viewport/DevTools) y qué queda bloqueado por
  falta de dispositivo real.
- **PM-24** (integraciones): necesita definir los sandboxes de correo/push/WhatsApp/IA y
  confirmar que ningún destinatario real se usa; el envío push ya se implementó en PM17
  P01 pero nunca se ha probado E2E contra un destinatario de prueba real.
- **PM-25** (recuperación/migración): el mecanismo de respaldo/restauración ya se probó
  en comportamiento en PM20 P08 (vm, sin tocar QA real); el ensayo completo sobre QA con
  acta antes/después que pide PM-25 sigue pendiente y requiere autorización específica
  antes de tocar datos de QA.

## 8. Discrepancias con el Plan Maestro

Ninguna discrepancia de fondo. Dos matices:

- El Plan Maestro data NR-02 en "F1 PM-05/06; F3 PM-21" para "cobertura completa de
  roles, RLS, API, vistas, RPC y Storage" — ese barrido completo nunca se había hecho
  hasta este punto (P01 de PM21 es la primera vez que se revisan las 41 funciones y las
  políticas de Storage en conjunto). Los dos hallazgos reales de este punto
  (`movimientos_registro`, Storage) son precisamente el tipo de defecto que esa
  cobertura completa está diseñada para encontrar — confirma que adelantar PM-21 era la
  decisión correcta.
- El catálogo de 25 hallazgos (`tests/pm04/regression-catalog.json`) no incluye ninguno
  de estos dos hallazgos nuevos: no son regresiones de un hallazgo LA-0XX existente, son
  hallazgos nuevos de PM21 (mismo patrón que `errores_sistema` en PM20, que tampoco
  estaba en el catálogo original).

## 9. Resumen y siguiente paso

Inventario completo. Dos hallazgos reales pendientes de autorización específica
(`movimientos_registro`, Storage `qa-pruebas`), un hueco de identidades QA (§5) y una
matriz de pruebas diseñada y lista para ejecutarse en P02 en cuanto haya autorización
para preparar los fixtures que falten. Ningún cambio de código ni de esquema en este
punto — sin gate remoto de regresión aplicable (no hay código modificado), solo
verificación de sintaxis y de que este documento no contiene identificadores internos ni
secretos.

**PM21_P01_INVENTARIO=PASS**
**PM21_P01_SOLO_LECTURA=CONFIRMADO**
