# Traspaso de estado — Proyecto A / L&A Suite

Documento vigente de continuidad. **Sustituye el estado de corte del
2026-09-12** para decidir qué hacer a continuación. Los documentos históricos
P08/P09 siguen siendo evidencia válida de lo que se sabía en su fecha y no deben
reescribirse retrospectivamente.

Fecha de actualización: **2026-09-13**.

---

## 1. Coordenadas actuales

| Elemento | Valor verificado |
|---|---|
| Repositorio | `Plopezm1990/Almacen` |
| Rama de trabajo | `claude/pm26-preparacion-tecnica` |
| HEAD base inmediatamente anterior a este traspaso | `5cc03635e5accd1cd4063283a5e00e2219db48ad` |
| `main` | `93a570badba1c5375febfbddc1dffdbcef003dcd` |
| `release` | `a97740987be57aa9646f6a06e69b2230f140ec5f` |
| PR #38 | abierta, draft, no fusionada; base `main`, head = rama de trabajo |

El SHA del propio commit que contiene este archivo no se incrusta dentro del
archivo para evitar una referencia circular. Al retomar, comprobar el HEAD
remoto de `claude/pm26-preparacion-tecnica` antes de escribir.

---

## 2. Qué está cerrado y NO debe repetirse

### Defecto E

**CERRADO.** No reabrir salvo regresión nueva demostrada.

### Gates históricos PM26

**CERRADOS:** P04a, P06c, P06i, P07a y el paraguas P08f. Sus contratos fueron
anclados correctamente a commits históricos y los workflows posteriores quedaron
en verde. La deuda descrita en traspasos anteriores quedó obsoleta.

### P09f-A — auditoría

**CERRADO.** Ensayo QA reversible 4/4 PASS, `ROLLBACK`, cero residuos.

### P09f-B1 — caja/arqueos

**CERRADO.** Movimiento/reversión y arqueo/anulación validados con autorización,
replay, conflictos y aislamiento. Todo reversible y sin residuos.

### P09f-B2 — stock

**CERRADO.** Venta/reversión, traslado interno y traslado entre locales validados,
incluidas pruebas negativas. Sin residuos funcionales después de `ROLLBACK`.

### P09f-B3 — pagos/devoluciones

**CERRADO técnicamente.** Se reprodujo y corrigió en QA el hueco de idempotencia
global de `pagos_encargo`. El repositorio contiene la migración segura que
reutiliza el ledger global existente y un contrato automático que impide crear un
segundo motor de idempotencia.

Evidencia principal:

- commit B3: `9185eb8ce03c8439e26abb53b5ae7a5ce4fc7dde`;
- workflow P09f run `34718309509`: **SUCCESS**;
- ajuste de guarda P01: `5cc03635e5accd1cd4063283a5e00e2219db48ad`;
- P01 run `34735743022`: **SUCCESS**;
- regresiones del mismo HEAD base: PM-05 `34735745299` SUCCESS y PM09
  `34735745295` SUCCESS.

No volver a aplicar manualmente la corrección QA: ya está aplicada. No promoverla
a producción sin una autorización y un plan de compatibilidad propios.

---

## 3. Defecto L — estado actual real

La corrección de base de datos y RLS fue aplicada en producción con autorización.
Después del primer despliegue se detectó un problema adicional de contexto del
cliente al intentar preparar el alta de prefiltros.

Se corrigió mediante hotfix acotado en `release`:

- commit `a97740987be57aa9646f6a06e69b2230f140ec5f`;
- gate `PM26 Defecto L hotfix`, run `34738648880`: **SUCCESS**;
- despliegue Netlify del mismo commit comprobado en solo lectura: **ready**,
  rama `release`, contexto `production`;
- el hotfix solo rellena IDs ausentes y deja RLS como autoridad final.

### Lo único que falta para el Defecto L

**No hay confirmación posterior al hotfix de una creación E2E real de un
candidato desde la interfaz.** El usuario después del despliegue dijo continuar,
pero no confirmó haber creado la prueba ni su resultado.

Por tanto, al retomar:

- NO volver a tocar Supabase ni `release` de entrada;
- primero hacer una única prueba controlada desde la app;
- si crea correctamente, registrar el E2E como PASS;
- si falla, capturar el error exacto y diagnosticar antes de cualquier cambio.

---

## 4. Lo que sigue bloqueado por factores externos

### Aviso G

Protección de contraseñas filtradas: **BLOQUEADO POR CAPACIDAD DEL PLAN**. No se
ha autorizado pagar, cambiar plan ni generar facturación. No existe una
corrección equivalente local que cierre esa función hospedada.

### PM25-P02

Ensayo de recuperación/migración: **BLOQUEADO POR FALTA DE ENTORNO AISLADO REAL**.
La parte PostgreSQL local ya fue ensayada sin defecto. Falta Auth/JWT/PostgREST/
RLS con sesiones reales en un tercer entorno o branching. No crear recursos de
pago sin autorización explícita.

Estos dos puntos no deben aparecer como “trabajo técnico olvidado”.

---

## 5. Reglas vinculantes que continúan

1. No modificar ni fusionar `main` sin autorización nueva.
2. No modificar `release` sin autorización específica.
3. No cerrar ni fusionar la PR #38 por iniciativa propia.
4. Producción Supabase: no escribir sin autorización de cambio concreta.
5. QA Supabase: una migración persistente nueva requiere autorización propia;
   pruebas temporales deben ser identificables y terminar en `ROLLBACK` cuando
   sea posible.
6. No modificar usuarios reales ni inventar empresas/locales/UUIDs.
7. No crear una segunda lógica de idempotencia: reutilizar el motor global ya
   existente.
8. No copiar QA a producción: comparar catálogo, funciones, RLS, grants,
   helpers y contratos por dominio antes de cualquier promoción.
9. Cada cambio técnico: preflight, pruebas negativas, rollback, regresión,
   commit aislado y gate remoto verde.
10. No tocar Netlify ni desplegar producción sin autorización explícita.

---

## 6. Orden exacto para la siguiente sesión

1. **Validar E2E del Defecto L post-hotfix**: crear un candidato real controlado
   desde la interfaz y comprobar si el alta termina correctamente.
2. Si pasa: documentar `E2E=PASS` sin tocar código ni infraestructura y considerar
   el trabajo operativo de PM26 cerrado salvo los dos bloqueos externos.
3. Si falla: no improvisar otro parche. Leer el error real, revisar request,
   contexto y RLS, y pedir autorización solo para la superficie que realmente
   necesite cambiar.
4. Mantener PR #38 abierta/draft hasta una decisión separada. No merge por defecto.
5. Después de resolver el E2E, escoger explícitamente el siguiente bloque del Plan
   Maestro; no mezclar nuevas funcionalidades con esta comprobación.

---

## 7. Estado resumido para no repetir trabajo

```text
TRASPASO_FECHA=2026-09-13
TRASPASO_RAMA=claude/pm26-preparacion-tecnica
TRASPASO_BASE_HEAD_PRE_DOCUMENTO=5cc03635e5accd1cd4063283a5e00e2219db48ad
TRASPASO_MAIN=93a570badba1c5375febfbddc1dffdbcef003dcd
TRASPASO_RELEASE=a97740987be57aa9646f6a06e69b2230f140ec5f
TRASPASO_PR38=OPEN_DRAFT_NO_MERGE
TRASPASO_DEFECTO_E=CERRADO
TRASPASO_GATES_HISTORICOS_P04A_P06C_P06I_P07A=CERRADOS
TRASPASO_P08F=CERRADO
TRASPASO_P09F_A=CERRADO
TRASPASO_P09F_B1=CERRADO
TRASPASO_P09F_B2=CERRADO
TRASPASO_P09F_B3=CERRADO_TECNICAMENTE
TRASPASO_DEFECTO_L_HOTFIX=DEPLOYED_GATE_SUCCESS
TRASPASO_DEFECTO_L_E2E_POST_HOTFIX=PENDIENTE_CONFIRMACION
TRASPASO_AVISO_G=BLOQUEADO_CAPACIDAD_PLAN
TRASPASO_PM25_P02=BLOQUEADO_ENTORNO_AISLADO_REAL
TRASPASO_MAIN_TOCADO_POR_ESTE_DOCUMENTO=NO
TRASPASO_RELEASE_TOCADO_POR_ESTE_DOCUMENTO=NO
TRASPASO_SUPABASE_TOCADO_POR_ESTE_DOCUMENTO=NO
TRASPASO_NETLIFY_TOCADO_POR_ESTE_DOCUMENTO=NO
TRASPASO_PR38_TOCADA_POR_ESTE_DOCUMENTO=NO
```

Documento de detalle complementario: `tests/pm26/PM26_CIERRE_FINAL_2026-09-13.md`.
