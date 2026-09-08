# PM11 · Compra, recepción y pago E2E · P07 — Aislamiento y permisos E2E

Fecha: 2026-09-07  
Rama: `pm11-compra-recepcion-pago-e2e`  
P06: pago parcial/total/reverso cerrado  
Producción/main: **NO TOCAR**

## Objetivo

Revalidar que el circuito PM11 no puede saltar de empresa, local o autorización en ninguno de sus tramos críticos:

**pedido → recepción → albarán → factura → pago/reverso**.

La matriz congelada para P07 es:

- A1;
- A2;
- B1 / otra empresa;
- `Todos los locales`;
- usuario inactivo.

P07 no busca reimplementar el aislamiento ya endurecido en PM05/PM09/PM10/G1. Su función es conectar esas garantías heredadas con el E2E de Compra/Recepción/Pago y demostrar que siguen presentes en el candidato actual.

## Resultado técnico

No fue necesario modificar `fuente.js` ni crear una migración nueva.

La revisión encontró que las barreras necesarias ya existen en las capas que utiliza el circuito:

1. **Contrato de plataforma / DEC-01**
   - ningún dato de negocio se comparte entre empresas;
   - una mutación exige local real y explícito;
   - `Todos los locales` es consolidación de lectura, no destino de escritura;
   - un local inactivo no admite nuevas operaciones ordinarias;
   - un usuario inactivo no tiene acceso funcional.

2. **Autorización de local en backend**
   - `private.la_tiene_local()` exige usuario activo;
   - exige membresía activa y empresa correcta;
   - admite `todos_locales` únicamente para operar sobre un **local real autorizado**;
   - rechaza expresamente `p_local='TODOS'`.

3. **Pedidos y recepción**
   - los contratos PM10 conservan rechazo de producto de otro local mediante `referencia_otro_contexto`;
   - sin local activo la operación falla con `contexto_no_autorizado`;
   - la recepción valida el contexto antes del primer efecto físico.

4. **Albarán enlazado**
   - P04 conserva la barrera `validarRecepcionPedidoPM10`;
   - proveedor y pedido enlazado se reconcilian antes de procesar la recepción;
   - la regresión completa P04 vuelve a ejecutarse dentro del gate P07.

5. **Factura de proveedor**
   - P05 mantiene identidad empresa/local/proveedor;
   - el albarán debe ser factura explícita y válida antes de poder llegar al ledger;
   - `marcarPagada` rechaza si `a22.empresaId !== empresaId` o `a22.localId !== localActivoId`.

6. **Pago y reverso en servidor**
   - `registrar_pago_factura()` exige usuario autenticado con permiso financiero;
   - revalida `la_tiene_empresa()` y `la_tiene_local()`;
   - bloquea y resuelve la factura exacta por `id + empresa + local`;
   - `revertir_pago_factura()` revalida el contexto del pago original antes de revertir.

7. **Aislamiento del saldo**
   - P06 demuestra que un movimiento de otro local o de otro origen financiero no contamina el saldo de la obligación exacta.

## Evidencia viva heredada

P07 reutiliza como evidencia viva ya validada la matriz G1 ejecutada en Supabase QA `qjqorixtkilwsndqayyx`, donde se demostró entre otros casos:

- Cajero A1 aislado a A1;
- Encargado A2 aislado a A2;
- Propietario B aislado a Empresa B/B1;
- A1 → A2 rechazado;
- Empresa A → Empresa B rechazado;
- local cerrado rechazado para nueva operación;
- `TODOS` rechazado como destino de mutación;
- usuario inactivo rechazado;
- lectura histórica autorizada de local cerrado conservada.

La evidencia fuente permanece en `tests/g1/P05_PERMISOS_AISLAMIENTO_EVIDENCIA.md`.

P07 no afirma haber repetido una nueva batería SQL viva contra Supabase en este punto. Lo realizado aquí es una **revalidación automatizada y versionada del candidato actual**, apoyada en la evidencia viva G1 ya cerrada. El smoke real del candidato se reserva para P10.

## Contrato automatizado P07

Archivo:

`tests/pm11-compra/p07-aislamiento-permisos-e2e-contract.mjs`

Comprueba conjuntamente:

- alcance P07 A1/A2/B1/Todos/inactivo;
- reglas DEC de empresa/local/inactivo;
- evidencia viva heredada G1;
- bloqueo backend de `TODOS` e inactivo;
- permiso financiero y contexto exacto de pago/reverso;
- aislamiento logístico de Pedidos/Recepción;
- barrera documental de P04;
- guardia frontend de pago P05;
- aislamiento de saldo P06.

## Gate P07

Workflow:

`.github/workflows/pm11-compra-p07-aislamiento-permisos.yml`

Run final:

**`34090453349` — SUCCESS**

En el mismo run pasaron:

- verificación de `main` congelado;
- `node --check fuente.js`;
- contrato P07;
- regresión G1 permisos/aislamiento;
- regresión G1 LA-004 / finanzas seguras;
- regresión PM10 Pedidos;
- regresión PM10 Recepción;
- regresión P06 pago/reverso;
- regresión P05 factura/identidad;
- regresión P04 albarán/trazabilidad;
- contrato E2E P02.

## Intentos previos del arnés

Los dos primeros runs P07 no revelaron defectos funcionales:

- `34090256106`: falló una aserción documental porque buscaba la lista detallada A1/A2/B1/Todos/inactivo dentro de P02, cuando esa lista está congelada en P01 y P02 define la responsabilidad P07 de forma más compacta.
- `34090384587`: falló otra aserción del arnés al inspeccionar el código textual del propio test P04 como si fuera el bloque productivo. P04 ya valida esa coherencia directamente y se ejecuta completo como regresión del gate.

Se corrigieron únicamente las aserciones del contrato P07. `fuente.js` no cambió.

## Límite honesto

P07 demuestra que las barreras de aislamiento y autorización ya cerradas siguen conectadas al circuito PM11 actual y pasan su regresión conjunta.

No declara todavía:

- tolerancia completa a crash/reintento/concurrencia multicliente, que corresponde a P08;
- conciliación numérica integral del caso completo, que corresponde a P09;
- smoke real en Deploy Preview, que corresponde a P10.

## Estado

**PM11_COMPRA_P07_AISLAMIENTO_PERMISOS_E2E=PASS**

**SIGUIENTE=P08_FALLOS_REPLAY_CONCURRENCIA**
