# PM21 P04 — Local cerrado (verificado en vivo) y relación cruzada (pendiente de datos)

Cuarto punto de PM21. Cierra, con una prueba real, el hueco de "local cerrado"
registrado en P01 §5 y P03 §3, y documenta con precisión por qué la prueba de
relación cruzada entre empresas no puede ejecutarse todavía con los datos QA
existentes — sin inventar datos sin autorización.

## 1. "Local cerrado bloquea operaciones nuevas": sí está implementado en el backend, verificado en vivo

P01 no había localizado esta regla porque no existe una tabla `locales` en el
esquema `public` — no es una tabla de negocio normalizada. Al investigar la
cadena de autorización de `pm11_puede_mutar_personal` (la función que usan las
altas/bajas/ediciones de personal y los fichajes) se encontró
`private.pm11_local_activo(empresa_id, local_id)`, que sí implementa la regla:
lee el registro del local desde `almacen_kv` (el almacén genérico
clave-valor del frontend, donde vive la entidad "local" completa) y comprueba
su campo `activo`. Un local con `activo:false` hace que
`pm11_local_activo` devuelva `false`, lo que a su vez hace que
`pm11_puede_mutar_personal` deniegue la operación **incluso a un Propietario
con `todos_locales`**, que de otro modo tiener alcance sobre toda su empresa.

Verificado en vivo contra QA (no solo lectura de código): existe ya en QA un
local cerrado real, `QA-A-CERRADO` (empresa `QA-EMP-A`, `activo:false` en
`almacen_kv`, fixture de PM04 — ninguna fixture nueva creada). Se llamó al RPC
`pm11_alta_empleado` con la sesión real de `owner.a@qa.invalid` (Propietario A,
`todos_locales=true`, la identidad con más alcance posible en su empresa)
pidiendo dar de alta un empleado en `QA-A-CERRADO`:

- Resultado: rechazado (`personal_contexto_no_autorizado`), pese a que la
  misma identidad sí puede dar de alta empleados en `QA-A1`/`QA-A2` (probado
  indirectamente en P03: pudo insertar en `albaranes_empresa` de su empresa).
- No se creó ninguna fila: la excepción se lanza antes del `INSERT`.
  Verificado con una consulta de solo lectura tras la prueba: 0 filas con el id
  de prueba.
- No se usó ninguna contraseña nueva ni `service_role`: se reutilizó la sesión
  de `owner.a@qa.invalid` ya preparada y autorizada en P03 (mismo alcance de
  autorización, sin ninguna acción de preparación adicional).

**Conclusión**: el hueco "segundo Propietario con local cerrado" de P01 §5
queda cerrado. No hacía falta un segundo Propietario de otra empresa — lo que
importaba verificar era si el estado `activo:false` del local, independiente
de la empresa, bloquea la operación incluso para la identidad con más alcance
posible sobre esa empresa. Confirmado que sí.

## 2. Relación cruzada entre empresas en un RPC: diseñada, no ejecutable hoy sin una fixture nueva

**Actualización (P05)**: el usuario autorizó explícitamente crear la fixture
que faltaba; la prueba se ejecutó y quedó verificada — ver
`tests/pm21/P05_RELACION_CRUZADA_ENTRE_EMPRESAS.md`. Lo que sigue documenta el
análisis que llevó a identificar exactamente qué fixture hacía falta.

El caso de P01 §6 ("relación cruzada, p. ej. `empleado_id` de otra empresa en
un RPC de fichaje") requiere una identidad activa cuyo `empleado_id` real
pertenezca a una empresa distinta de la que un atacante declararía. Se
comprobó el estado real de `public.empleados` en QA: **una sola fila en total**
(`QA-EMP-A`/`QA-A1`, `estado='inactivo'`), sin ningún empleado en
`QA-EMP-B` ni ningún empleado activo. Con estos datos no es posible aislar la
prueba:

- Cualquier llamada a `pm13_fichaje_manual`/RPCs de fichaje con este único
  empleado se rechaza igualmente por `estado <> 'activo'`, antes de llegar a
  comprobar la relación cruzada empresa/local — el resultado sería un
  rechazo, pero no probaría lo que se quiere probar (que el RPC detecta el
  cruce de contexto, no solo que rechaza un registro inválido).
- No existe ningún empleado en `QA-EMP-B` para intentar referenciarlo desde
  una sesión de `QA-EMP-A`.

Ejecutar esta prueba correctamente requeriría insertar una fila de fixture
(un empleado activo en una empresa/local, para referenciarlo desde una sesión
de otra) — una escritura de datos nueva en QA, no una preparación de sesión
como las de P03/P04 §1. Conforme a la regla de que ninguna escritura en QA se
hace sin autorización específica para esa escritura, no se ejecuta esta
prueba en este punto. Queda registrada como pendiente, a la espera de esa
autorización si se decide que vale la pena crear la fixture, o de una
decisión de dejarla fuera de alcance.

## 3. Elemento restante de P03 §3, todavía no ejecutado

La réplica/idempotencia de un RPC de escritura ejecutado dos veces con el
mismo `operationId` bajo sesión HTTP real contra QA (no contra una base local
desechable, que es donde ya se probó en PM12 P08) sigue pendiente. No
bloquea el cierre de este punto.

## 4. Archivos

- `tests/pm21/P04_LOCAL_CERRADO_Y_RELACION_CRUZADA.md` (este documento).
- `tests/pm21/p04-local-cerrado-contract.mjs` (nuevo): confirma que este
  documento registra el resultado real de la prueba de local cerrado y que
  no contiene identificadores internos ni secretos.

## Regresión

Sin cambios en `fuente.js` ni en ninguna migración. Suite completa del
proyecto — sin regresiones.

## Estado de main/producción/QA

`main` sin tocar. Ninguna escritura nueva en QA: se reutilizó la sesión ya
preparada de `owner.a@qa.invalid` (P03) y la prueba fue rechazada antes de
insertar nada — confirmado con una consulta de solo lectura tras la ejecución
(0 filas). Producción y TPV sin tocar.

**PM21_P04_LOCAL_CERRADO=PASS**
