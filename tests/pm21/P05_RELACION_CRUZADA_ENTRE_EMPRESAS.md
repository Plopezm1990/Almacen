# PM21 P05 — Relación cruzada entre empresas: verificada en vivo

Quinto punto de PM21. Con autorización explícita del usuario ("vale crealo"),
crea la única fixture nueva que P04 §2 identificó como necesaria y ejecuta la
prueba de relación cruzada que había quedado pendiente.

## 1. Fixture nueva creada (autorización explícita)

`public.empleados` solo tenía una fila en toda la QA (un empleado inactivo de
`QA-EMP-A`) y ninguna en `QA-EMP-B`, lo que impedía aislar la prueba de
relación cruzada (ver P04 §2). El usuario autorizó explícitamente crear la
fixture que faltaba. Se insertó una única fila:

| Campo | Valor |
|---|---|
| `id` | `QA-CROSS-EMP-B1` |
| `empresa_id` | `QA-EMP-B` |
| `local_id` | `QA-B1` |
| `estado` | `activo` |
| `nombre` | `QA Cross Empresa B1` |

Es una fixture permanente (como `inactive@qa.invalid` o `QA-A-CERRADO`), no un
dato de prueba transitorio: queda en QA para esta y futuras pruebas de
relación cruzada, con un id que la identifica sin ambigüedad como fixture de
PM21 P05.

## 2. Prueba ejecutada

Con la sesión real de `operator.a2@qa.invalid` (Encargado del local `QA-A2`,
empresa `QA-EMP-A`, ya preparada en P03 — no se generó ninguna contraseña
nueva ni se usó `service_role`), se llamó a `pm13_fichaje_manual` declarando
`p_local_id='QA-A2'` (su propio local, el que legítimamente puede usar) pero
`p_empleado_id='QA-CROSS-EMP-B1'` — un empleado real, activo, pero de
**otra empresa** (`QA-EMP-B`, local `QA-B1`).

Resultado: rechazado (`fichaje_empleado_no_activo_o_fuera_de_local`, HTTP 400).
La función localiza la fila real del empleado y compara su `local_id` real
(`QA-B1`) contra el `p_local_id` declarado por la llamada (`QA-A2`) antes de
comprobar ninguna otra cosa — el simple hecho de que el Encargado A2 tenga
permiso sobre su propio local no basta, porque el empleado referenciado no es
suyo. Esto es precisamente lo que P01 §6 pedía verificar: que el RPC rechaza
por el cruce real de contexto (la relación empleado↔empresa/local), no
solo por el nombre o formato del parámetro.

Sin residuo: verificado con una consulta de solo lectura tras la prueba que no
se creó ninguna fila en `fichajes_registro` con el `operationId` de la prueba
— la excepción se lanza antes del `INSERT`.

## 3. Estado de la matriz de P01 §6

Con este punto, todos los casos de la matriz diseñada en P01 §6 han sido
ejecutados en vivo contra QA en P03/P04/P05, salvo la réplica/idempotencia de
un RPC de escritura bajo sesión HTTP real contra QA (ya verificada en PM12 P08
contra una base local desechable) — registrada como pendiente no bloqueante
desde P03 §3.

## 4. Archivos

- `tests/pm21/P05_RELACION_CRUZADA_ENTRE_EMPRESAS.md` (este documento).
- `tests/pm21/p05-relacion-cruzada-contract.mjs` (nuevo): confirma que el
  documento registra la fixture creada, el resultado real del rechazo y que
  no publica identificadores internos ni secretos.

## Regresión

Sin cambios en `fuente.js` ni en ninguna migración de esquema — este punto
inserta una única fila de datos de fixture, no cambia RLS/funciones/columnas.
Suite completa del proyecto — sin regresiones.

## Estado de main/producción/QA

`main` sin tocar. Una única escritura nueva en QA (la fila fixture de
`empleados`), autorizada explícitamente por el usuario. La prueba de
autorización en sí se ejecutó con `anon key` + sesión real, sin `service_role`
y sin dejar ningún dato de la prueba en sí (0 filas de fichaje). Producción y
TPV sin tocar.

**PM21_P05_RELACION_CRUZADA=PASS**
