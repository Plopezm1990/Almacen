# F7 · C03 — arqueo calculado en servidor

Fecha: 2026-10-09  
Entorno de base de datos: QA (`qjqorixtkilwsndqayyx`)  
Estado: `NUCLEO_QA_VERIFICADO; UI_LOCAL_PREPARADA; DEPLOY_QA_PENDIENTE`  
Producción: no tocada

## 1. Implementación consolidada

C03 queda cubierto por dos funciones complementarias:

- `abc_previsualizar_arqueo_caja` desglosa fondo, entradas, salidas y esperado
  antes de confirmar el cierre de sesión C04;
- `abc_registrar_arqueo_caja` registra el arqueo histórico con el efectivo
  contado y calcula base, esperado y diferencia en el servidor.

La segunda función se añadió con la migración local
`20261009060339_c03_arqueo_servidor.sql`, registrada en QA con la versión
`20261009060339`. Amplía `arqueos_caja` de forma compatible para conservar
comando, caja, sesión, terminal, moneda, día operativo y denominaciones.

La interfaz sincronizada ya no envía `p_efectivo_base` ni un esperado. Resuelve
la sesión y el terminal activos, consulta el día operativo y envía únicamente
el contado, las notas y el desglose opcional. El modo local conserva su cálculo
anterior para poder seguir trabajando sin cuenta sincronizada.

## 2. Conteo por denominaciones

La pantalla permite introducir cantidades de billetes y monedas EUR y calcula
el contado. El servidor admite únicamente denominaciones conocidas, cantidades
enteras no negativas y exige que su suma coincida con el contado. También se
puede registrar un total directo sin desglose.

## 3. Ensayo transaccional en QA

Se creó una caja, un terminal y una sesión temporales dentro de una transacción:

| Paso | Resultado |
|---|---:|
| Fondo inicial | 100,00 EUR |
| Entrada manual | +50,00 EUR |
| Retirada manual | −30,00 EUR |
| Vista previa del servidor | 120,00 EUR |
| Conteo por denominaciones | 2×50 + 1×20 = 120,00 EUR |
| Esperado registrado | 120,00 EUR |
| Diferencia | 0,00 EUR |

Además se verificó:

- replay del mismo comando sin una segunda fila;
- rechazo de denominaciones que no suman el contado;
- rechazo de un segundo arqueo activo para el local y día;
- autorización del Cajero/a y rechazo del Camarero/a;
- anulación por el Propietario con motivo y conservación del original;
- un solo arqueo, cuatro eventos ABC y cuatro comandos ABC durante el ensayo.

La transacción terminó con `ROLLBACK`. La consulta posterior encontró cero
arqueos, sesiones, movimientos y comandos con los identificadores de prueba.

## 4. Interfaz y regresión local

La interfaz de cierre C04 muestra el cálculo previo del servidor y mantiene
deshabilitada la confirmación provisional hasta recibirlo. El arqueo histórico
usa la nueva función C03 y conserva el mismo `operation_id` en reintentos.

```text
ABC_F5_C03_CASH_CONTRACT=PASS
c03-arqueo-ui-runtime: 7/7 PASS
cfg6d-ui-runtime: 93/93 PASS
pm08-caja-ui-runtime: 14/14 PASS
```

## 5. Pendiente para cerrar C03

1. desplegar la interfaz consolidada en QA;
2. recorrer por pantalla un arqueo histórico con total directo y otro con
   denominaciones;
3. comprobar visualmente el reintento tras una interrupción;
4. obtener aceptación funcional.

Hasta entonces C03 permanece incompleto, aunque el cálculo autoritativo, los
permisos, la idempotencia y la trazabilidad están verificados en QA.
