# PM26 — Cierre documental final de estado

Fecha de corte: **2026-09-13**.

Este documento consolida el estado real verificado de PM26 después de los
trabajos de P08/P09f y del hotfix posterior del Defecto L. Es un **cierre
documental y técnico del trabajo ejecutado**, no una autorización de merge,
producción, facturación ni cambios adicionales.

La regla principal para una sesión futura es simple: **no repetir paquetes ya
cerrados y no convertir un bloqueo externo en una supuesta deuda de código**.

---

## 1. Coordenadas verificadas antes de este cierre documental

| Elemento | Estado |
|---|---|
| Repositorio | `Plopezm1990/Almacen` |
| Rama de trabajo | `claude/pm26-preparacion-tecnica` |
| HEAD base antes de este cierre documental | `5cc03635e5accd1cd4063283a5e00e2219db48ad` |
| `main` | `93a570badba1c5375febfbddc1dffdbcef003dcd` |
| `release` | `a97740987be57aa9646f6a06e69b2230f140ec5f` |
| PR #38 | abierta, en borrador, no fusionada, base `main`, head = rama de trabajo |

No se fija dentro de este archivo el SHA del commit que lo contiene para evitar
una referencia circular. Al retomar, el HEAD válido es el HEAD remoto de la
rama de trabajo, no el valor histórico de un documento anterior.

---

## 2. Estado final de P09f

### P09f-A — autorización de auditoría

**CERRADO.** El ensayo QA reversible validó cuatro casos de autorización:
usuario autorizado en su empresa/local, empresa ajena bloqueada, local ajeno
bloqueado y llamada sin sesión bloqueada. Terminó con `ROLLBACK` y sin residuos.

### P09f-B1 — caja y arqueos

**CERRADO.** Se validaron los flujos de movimiento/reversión de caja y
arqueo/anulación con replay, conflicto de `operation_id`, separación entre
locales, roles no autorizados y llamadas sin sesión. Las pruebas terminaron en
`ROLLBACK`; no quedaron filas de prueba.

### P09f-B2 — stock

**CERRADO.** Se validaron venta/reversión, traslado interno y traslado entre
locales, incluyendo replays y pruebas negativas de autorización, contexto,
cantidad y stock insuficiente. La transacción se revirtió. El único efecto
persistente permitido del ensayo fue el avance normal de la secuencia de
movimientos; no quedaron operaciones ni movimientos de prueba.

### P09f-B3 — pagos y devoluciones

**CERRADO técnicamente en QA y protegido en repositorio.**

Durante el ensayo se reprodujo un defecto real: `pagos_encargo` podía reutilizar
un `operation_id` ya reclamado por otro ledger porque no participaba en el
ledger global. La corrección se aplicó primero en QA y se verificó con replay,
reversión y matriz de colisiones. Después se incorporó al repositorio sin crear
un segundo motor de idempotencia:

- commit técnico: `9185eb8ce03c8439e26abb53b5ae7a5ce4fc7dde`;
- migración: `supabase/migrations/20260912120000_pm26_p09f_b3_pagos_encargo_operation_id_global.sql`;
- reutiliza `private.g1_operation_ids_global` y
  `private.g1_claim_operation_id()`;
- incluye preflight de dependencias y colisiones históricas, locks acotados,
  backfill conservador, trigger global y postchecks;
- contrato `tests/pm26/p09f-contract.mjs` protege que no aparezca una segunda
  implementación de idempotencia;
- workflow `PM26 P09f QA aislado auditoria`, run `34718309509`: **SUCCESS**.

El commit anterior hizo fallar P01 porque su guarda histórica no admitía todavía
la nueva migración cerrada. Esa deuda de CI se corrigió sin debilitar la guarda
en `5cc03635e5accd1cd4063283a5e00e2219db48ad`; run P01 `34735743022`:
**SUCCESS**.

En ese mismo HEAD base, las regresiones remotas de PM-05 (`34735745299`) y
PM09 (`34735745295`) terminaron también en **SUCCESS**.

---

## 3. Gates históricos

La deuda histórica atribuida a **P04a, P06c, P06i y P07a** ya no existe.
Los workflows actuales están anclados a sus commits de cierre históricos y no
al HEAD vivo. Los cuatro tuvieron ejecuciones verdes después de esa corrección.

El workflow paraguas **P08f — saneamiento histórico de contratos** también fue
corregido posteriormente para provisionar sus dependencias en runners limpios,
incluida la CLI de Supabase donde era necesaria, y tuvo ejecución posterior en
**SUCCESS**.

Consecuencia: **no volver a abrir estos cinco puntos ni crear commits para
“arreglarlos” salvo que una nueva evidencia demuestre una regresión real.**

---

## 4. Defecto L — estado honesto después del hotfix

La parte de base de datos del Defecto L fue aplicada en producción y el cliente
coordinado se desplegó previamente. Después, el flujo real reveló un problema de
contexto cuando la caché del cliente no contenía todos los identificadores
necesarios antes del alta.

Se aplicó un hotfix acotado en `release`:

- commit `a97740987be57aa9646f6a06e69b2230f140ec5f`;
- reconstruye de forma segura el contexto empresa/local solo cuando faltan IDs;
- no sustituye IDs existentes;
- mantiene RLS como autoridad final;
- workflow `PM26 Defecto L hotfix`, run `34738648880`: **SUCCESS**;
- el despliegue de Netlify de ese mismo commit fue verificado en solo lectura en
  estado **ready**, rama `release`, contexto `production`.

### Validación E2E que NO debe inventarse

Después de ese hotfix **no existe todavía una confirmación del usuario de haber
creado un candidato real de prefiltro en la interfaz de producción y haber
comprobado el resultado final**.

Por tanto:

`DEFECTO_L_HOTFIX_TECNICO=VERDE`

pero

`DEFECTO_L_E2E_POST_HOTFIX=PENDIENTE_CONFIRMACION`

No declarar el Defecto L “E2E probado” hasta que esa acción real ocurra.

---

## 5. Bloqueos externos que siguen sin ser deuda de código

### Aviso G — protección de contraseñas filtradas

Sigue bloqueado por plan de Supabase. Requiere una capacidad de pago superior a
la disponible actualmente. No está autorizado contratar, cambiar plan ni generar
facturación. No volver a proponerlo como arreglo técnico local.

### PM25-P02 — recuperación/migración en entorno aislado real

El ensayo PostgreSQL local parcial ya se ejecutó y no detectó defecto en la
migración candidata. Lo que falta requiere un tercer entorno real o branching
para probar Auth/JWT/PostgREST/RLS de punta a punta. Con la capacidad actual no
hay entorno adicional disponible. Sigue **BLOQUEADO POR ENTORNO**, no por fallo
del código probado.

---

## 6. Superficies que este cierre NO autoriza a modificar

- `main`: no tocar ni fusionar sin autorización nueva.
- `release`: no modificar sin autorización específica.
- PR #38: no cerrar ni fusionar por defecto.
- Supabase producción: no escribir por iniciativa propia.
- Supabase QA: cualquier nueva migración persistente requiere autorización propia.
- Netlify: no desplegar ni cambiar configuración por iniciativa propia.
- TPV: fuera de este cierre.
- Usuarios/datos reales: no usar en pruebas automatizadas.

Este cierre documental no modifica ninguna de esas superficies.

---

## 7. Orden correcto para continuar

1. **Primero:** completar la validación E2E post-hotfix del Defecto L creando un
   candidato real controlado desde la interfaz y comprobando que se guarda sin
   error de RLS/contexto. No requiere nuevo código si funciona.
2. Si el E2E pasa, registrar la evidencia y considerar PM26 operativo cerrado,
   manteniendo Aviso G y PM25-P02 como bloqueos externos explícitos.
3. La PR #38 requiere una decisión separada: conservarla como evidencia, cerrarla
   sin merge o revisarla en el futuro. **Nunca merge automático.**
4. Solo después elegir el siguiente bloque funcional del Plan Maestro. No mezclar
   nuevas funcionalidades con la validación operativa pendiente del Defecto L.

---

## 8. Marcadores de estado

```text
PM26_CIERRE_DOCUMENTAL_FECHA=2026-09-13
PM26_RAMA=claude/pm26-preparacion-tecnica
PM26_BASE_HEAD_PRE_CIERRE=5cc03635e5accd1cd4063283a5e00e2219db48ad
PM26_MAIN=93a570badba1c5375febfbddc1dffdbcef003dcd
PM26_RELEASE=a97740987be57aa9646f6a06e69b2230f140ec5f
PM26_PR38=OPEN_DRAFT_NO_MERGE
PM26_P09F_A=CERRADO
PM26_P09F_B1=CERRADO
PM26_P09F_B2=CERRADO
PM26_P09F_B3=CERRADO_TECNICAMENTE
PM26_P09F_B3_REPO_GATE=SUCCESS
PM26_P04A_HISTORICO=CERRADO
PM26_P06C_HISTORICO=CERRADO
PM26_P06I_HISTORICO=CERRADO
PM26_P07A_HISTORICO=CERRADO
PM26_P08F_HISTORICO=CERRADO
PM26_DEFECTO_L_HOTFIX=DEPLOYED_GATE_SUCCESS
PM26_DEFECTO_L_E2E_POST_HOTFIX=PENDIENTE_CONFIRMACION
PM26_AVISO_G=BLOQUEADO_CAPACIDAD_PLAN
PM25_P02=BLOQUEADO_ENTORNO_AISLADO_REAL
PM26_MAIN_MODIFICADO_POR_ESTE_CIERRE=NO
PM26_RELEASE_MODIFICADO_POR_ESTE_CIERRE=NO
PM26_SUPABASE_MODIFICADO_POR_ESTE_CIERRE=NO
PM26_NETLIFY_MODIFICADO_POR_ESTE_CIERRE=NO
PM26_PR38_MODIFICADA_POR_ESTE_CIERRE=NO
```
