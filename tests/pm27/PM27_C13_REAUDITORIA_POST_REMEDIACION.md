# PM27 — C13 Reauditoría post-remediación

Fecha: 2026-09-13

## 1. Alcance y trazabilidad

C13 fue auditado originalmente contra el candidato congelado `8256628d922fe0a8dbf18ca792f8b19e89f6d9ad` y quedó en **FAIL** por tres RPC `SECURITY DEFINER` alcanzables desde `authenticated` sin una precondición de membresía empresa/local suficiente.

Esta reauditoría se ejecuta contra el candidato corregido exacto:

`b3d37a4cf2fdc37f66d862948a5894dfbc66b0be`

La rama de reauditoría `claude/pm27-c13-reauditoria` nace directamente de ese SHA. Los únicos cambios permitidos sobre el candidato corregido en esta rama son este documento de evidencia y el workflow de reauditoría. No se modifica código funcional, migraciones ni artefactos de producción durante la reauditoría.

## 2. Qué cambió respecto al candidato que falló

El delta entre el candidato congelado y el candidato corregido está acotado a la remediación C13 y sus contratos/gates:

- migración funcional C13 para retirar la ejecución autenticada de las dos RPC legacy globales;
- `obtener_contexto_operativo()` reconstruido para derivar el contexto exclusivamente desde `auth.uid()` y membresías activas;
- hardening de helper privado y `search_path`;
- pruebas reproducibles C13 en PostgreSQL local aislado;
- regresiones PM07/PM08/PM12/PM26 y compatibilidad histórica;
- workflow remoto específico de C13.

No se sustituyó el motor moderno de TPV/stock ni se creó un segundo sistema de autorización o idempotencia.

## 3. Reauditoría del hallazgo bloqueante

### 3.1 `descontar_stock_carrito(jsonb,text)`

La firma legacy se conserva, pero el navegador autenticado ya no tiene `EXECUTE`. La corrección no inventa una empresa/local para una RPC cuyo contrato no contiene contexto de tenant.

Resultado: **PASS** para el hallazgo C13 de superficie privilegiada alcanzable.

### 3.2 `anular_venta_tpv(text,text)`

La firma legacy se conserva, pero `authenticated` ya no puede ejecutarla. No se autoriza una anulación global basada solo en rol/perfil.

Resultado: **PASS** para el hallazgo C13 de superficie privilegiada alcanzable.

### 3.3 `obtener_contexto_operativo()`

La firma cero argumentos se mantiene para compatibilidad del cliente. El servidor:

- exige sesión;
- exige usuario activo con membresía activa;
- exige coherencia entre rol del perfil y rol de membresía;
- deriva empresas únicamente de membresías activas del `auth.uid()`;
- no selecciona una empresa o local arbitrarios cuando existe ambigüedad;
- filtra el catálogo legacy de locales únicamente cuando empresa/local puede demostrarse contra membresías activas;
- devuelve valores neutros para colecciones legacy cuyo tenant no puede demostrarse de forma autoritativa;
- mantiene `EXECUTE` solo para `authenticated`, con `anon` y `PUBLIC` revocados.

Resultado: **PASS** para el guard multiempresa/multilocal exigido por C13.

## 4. Hardening SECURITY DEFINER

La remediación fija `search_path = ''` en la RPC de contexto y cualifica referencias sensibles. El helper privado endurecido queda con `search_path = ''`. Los grants por defecto se revocan y solo se concede la superficie estrictamente necesaria.

Resultado: **PASS**.

## 5. Negativos reproducibles

El contrato automatizado C13 ejecutado en PostgreSQL local aislado cubre y exige PASS en:

- ausencia de sesión;
- perfil activo sin membresía activa;
- empresa ajena;
- local ajeno;
- rol insuficiente;
- positivo en empresa/local propios;
- ausencia de efectos parciales en negativos;
- ACL y `search_path` de las superficies corregidas.

La prueba no usa UUID, empresa ni local reales: genera fixtures efímeros en runtime.

## 6. Regresiones

La batería acumulada conserva en verde:

- TPV y stock;
- anulaciones/reversos;
- movimientos y trazabilidad;
- `operation_id`;
- replay y concurrencia;
- contratos PM26 aplicables;
- compatibilidad histórica de los gates PM26;
- Defecto L del contexto de prefiltros.

El gate remoto del candidato corregido ya terminó en **SUCCESS** sobre el SHA exacto `b3d37a4cf2fdc37f66d862948a5894dfbc66b0be`, run `34780093973`.

El workflow de esta rama vuelve a ejecutar C13 y las regresiones contra una rama que es descendiente directa de ese SHA y comprueba que el delta posterior contiene únicamente evidencia de reauditoría.

## 7. Resultado C13

El hallazgo original cambia de estado:

- `PM27_C13_ANON_SECURITY_DEFINER=PASS`
- `PM27_C13_HELPERS_PRIVATE_AISLADOS=PASS`
- `PM27_C13_RPC_TENANT_GUARD=PASS`
- `PM27_C13_PERFIL_SIN_MEMBRESIA_BLOQUEADO=PASS`
- `PM27_C13_NEG_EMPRESA_AJENA=PASS`
- `PM27_C13_NEG_LOCAL_AJENO=PASS`
- `PM27_C13_NEG_SIN_EFECTOS_PARCIALES=PASS`
- `PM27_C13_REGRESIONES=PASS`
- `PM27_C13_RESULTADO=PASS`

**Conclusión de reauditoría: C13 pasa de FAIL a PASS sobre el candidato corregido.**

## 8. Límite de esta conclusión

Este PASS certifica el **candidato corregido**, no afirma que la remediación haya sido aplicada a Supabase producción o QA. En este punto no se ha escrito en ninguno de esos proyectos, no se ha desplegado Netlify y no se han modificado `main`, `release` ni PR #38.

La aplicación/despliegue de la corrección, si procede, requiere su autorización y secuencia específica fuera de esta reauditoría.

## 9. Cierre C13 y habilitación de C14 — Punto 10

El gate de reauditoría post-remediación terminó en **SUCCESS** y confirmó de nuevo el contrato C13 completo, sus negativos y las regresiones acumuladas. Por tanto, se cumple la condición vinculante del plan: **solo C13 PASS permite continuar a C14**.

C13 queda formalmente **CERRADO / PASS** sobre el candidato corregido `b3d37a4cf2fdc37f66d862948a5894dfbc66b0be`.

A partir de C14, el baseline técnico válido de la continuación PM27 es ese candidato corregido. El candidato original `8256628d922fe0a8dbf18ca792f8b19e89f6d9ad` y la rama `claude/pm27-auditoria-25-casos` se conservan sin reescribir como evidencia histórica del FAIL que originó la remediación.

El siguiente caso habilitado es **C14 — Defecto L: caché/contexto**, cuyo contrato exige comprobar que `empresa_id/local_id` solo se completen cuando el contexto sea inequívoco, que nunca se sobrescriban IDs existentes y que caché corrupta, múltiples locales o local desconocido fallen cerrado/sin inventar contexto.

No se autoriza por este cierre ningún merge, despliegue ni migración remota. `main`, `release`, PR #38, Netlify y Supabase producción/QA siguen fuera de escritura salvo autorización específica posterior.

Marcadores de cierre:

`PM27_C13_PUNTO10=PASS`

`PM27_C13_CERRADO=PASS`

`PM27_C14_HABILITADO=YES`
