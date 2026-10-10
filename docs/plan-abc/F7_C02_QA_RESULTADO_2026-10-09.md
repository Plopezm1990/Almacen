# F7 · C02 — entradas y salidas trazables

Fecha: 2026-10-09  
Entorno de base de datos: QA (`qjqorixtkilwsndqayyx`)  
Estado: `NUCLEO_QA_VERIFICADO; UI_LOCAL_PREPARADA; DEPLOY_QA_PENDIENTE`  
Producción: no tocada

## 1. Alcance completado

La pantalla local de entradas y retiradas deja de usar las funciones heredadas
`registrar_movimiento_caja` y `revertir_movimiento_caja`. Las operaciones
sincronizadas pasan por las funciones autoritativas de M04B:

- `abc_registrar_movimiento_caja`;
- `abc_revertir_movimiento_caja`.

Antes de registrar, el cliente resuelve el usuario autenticado, el terminal de
este dispositivo, su vínculo activo, la sesión y caja abiertas y el día
operativo del servidor. La fecha elegida debe coincidir con ese día. El flujo
actual de apertura trabaja en EUR y C02 conserva esa misma moneda.

## 2. Datos y trazabilidad de la interfaz

El formulario exige importe, categoría, concepto o referencia del justificante
y motivo. Las categorías admitidas son:

| Tipo | Categorías |
|---|---|
| Entrada | `REPOSICION_CAJA`, `INGRESO_MANUAL` |
| Retirada | `RETIRADA_CAJA`, `GASTO_CAJA` |

El identificador de operación se conserva en almacenamiento local si hay un
resultado incierto. Al reintentar se envía el mismo identificador. El reverso
crea otra fila, enlaza el original y exige un motivo; nunca borra la fila
original. La pantalla solo ofrece el reverso para movimientos manuales creados
por la vía ABC y para movimientos locales todavía no sincronizados.

El campo «Concepto o justificante» guarda una referencia textual. C02 no incluye
un adjunto de imagen o PDF porque el contrato M04B actual no dispone de un campo
de archivo.

## 3. Prueba transaccional en QA

La prueba usó la sesión abierta de `QA-EMP-A / QA-A1` y terminó con `ROLLBACK`.

| Comprobación | Resultado |
|---|---|
| Cajero/a registra `INGRESO_MANUAL` por 7,50 EUR | PASS |
| Repetición exacta de la entrada | mismo resultado; una sola fila |
| Cajero/a registra `GASTO_CAJA` por 2,25 EUR | PASS |
| Cajero/a intenta revertir | rechazado: `abc_reverso_caja_no_autorizado` |
| Propietario revierte la entrada con motivo | PASS |
| Repetición exacta del reverso | mismo resultado; una sola fila |
| Camarero/a intenta registrar una entrada | rechazado: `abc_movimiento_caja_no_autorizado` |
| Filas físicas durante la transacción | 3 |
| Eventos durante la transacción | 3 |
| Comandos idempotentes durante la transacción | 3 |
| Efecto neto de la prueba | −2,25 EUR |
| Original conservado y reverso enlazado | sí |

La consulta posterior confirmó cero movimientos, eventos y comandos con el
prefijo de la prueba.

## 4. Controles automáticos

Se añadieron un contrato estático C02 y un flujo de CI. También se amplió la
prueba de ejecución de Caja para cubrir sesión, terminal, categorías, motivo,
reintento, permisos y reverso.

```text
pm08-caja-ui-runtime: 14/14 PASS
PM08_FRONTEND_CHECKS=48
PM08_FRONTEND_CONTRACT_OK=1
ABC_F5_C02_UI_CONTRACT=PASS
ABC_F5_C01_UI_CONTRACT=PASS
node --check fuente.js: PASS
node --check source-recovery/fuente-recuperado.js: PASS
git diff --check: PASS
```

La fuente principal y la fuente de recuperación contienen los mismos bloques
de normalización, lógica y pantalla de C02.

## 5. Pendiente para cerrar C02

1. desplegar la interfaz en QA;
2. recorrer por pantalla una entrada, una retirada y un reverso con los roles
   previstos;
3. comprobar el reintento desde el navegador tras una interrupción simulada;
4. obtener la aceptación funcional del recorrido.

Hasta completar esos pasos, C02 permanece incompleto aunque el núcleo, los
permisos y la idempotencia ya estén verificados en QA.
