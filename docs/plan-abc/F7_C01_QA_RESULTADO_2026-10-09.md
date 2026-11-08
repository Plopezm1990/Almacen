# F7 · C01 — cajas, sesiones, responsables y terminales

Fecha: 2026-10-09  
Entorno de base de datos: QA (`qjqorixtkilwsndqayyx`)  
Estado: `NUCLEO_QA_VERIFICADO; UI_LOCAL_PREPARADA; DEPLOY_QA_PENDIENTE`  
Producción: no tocada

## 1. Alcance verificado

Se comprobó la implementación M04A ya instalada en QA y se completó la
interfaz local para consultar una sesión, registrar un relevo de responsable y
vincular o desvincular terminales auxiliares. Todas las escrituras de la
interfaz pasan por las RPC autoritativas; el navegador solo hace lecturas
acotadas por empresa, local y sesión.

Durante la revisión se detectó que la lista inicial de candidatos reutilizaba
`abc_listar_responsables_cuenta`, que exige `ABC_CUENTA_REASIGNAR`. Ese permiso
no corresponde al Cajero, aunque sí dispone de `ABC_CAJA_OPERAR`. Se añadió la
migración `20261009054351_c01_listar_responsables_caja.sql`, con una función de
solo lectura específica de caja y el permiso correcto.

## 2. Prueba transaccional de M04A en QA

La prueba usó identificadores ficticios y terminó con `ROLLBACK`. Verificó:

| Comprobación | Resultado |
|---|---:|
| Sesiones abiertas en dos cajas independientes | 2 |
| Fondos iniciales registrados | 1 |
| Terminales activos en la segunda sesión | 1 |
| Tramos del historial de responsables tras el relevo | 2 |
| Repetición idempotente de la apertura | 1 |
| Segundo vínculo del mismo terminal | rechazado |
| Segunda sesión activa para la misma caja | rechazado |

La consulta posterior confirmó cero cajas, terminales, sesiones y operaciones
ficticias remanentes.

## 3. Permisos de la lista de responsables

La migración correctiva se aplicó únicamente en QA. Una prueba dentro de una
transacción anulada obtuvo estos resultados sobre una sesión operativa real de
QA:

| Rol | Resultado esperado | Resultado |
|---|---|---|
| Propietario | autorizado | autorizado; 4 candidatos |
| Cajero/a | autorizado | autorizado; 4 candidatos |
| Camarero/a | rechazado | `responsables_caja_listar_no_autorizado` |

La función es `STABLE`, fija `search_path=''`, no concede ejecución a `anon` y
solo concede ejecución a `authenticated`. Además comprueba `auth.uid()`,
`ABC_CAJA_OPERAR`, el ámbito del local y que el terminal pertenezca a la sesión
operativa.

Los asesores de Supabase se ejecutaron después de la migración. La advertencia
general sobre funciones `SECURITY DEFINER` ejecutables por usuarios autenticados
también incluye esta RPC y es intencionada: es el punto de entrada del cliente,
con autorización y ámbito comprobados dentro de la función. No se añadieron
tablas ni índices.

## 4. Interfaz preparada en la rama local

La pantalla de caja muestra:

- sesión y responsable activos;
- selección del nuevo responsable y motivo obligatorio del relevo;
- terminales vinculados y distinción del terminal actual;
- vínculo de un terminal disponible;
- desvínculo de un terminal auxiliar con motivo obligatorio;
- bloqueo local para impedir desvincular el terminal desde el que se opera.

La fuente principal y la fuente de recuperación contienen el mismo bloque.
La interfaz aún no se ha desplegado en QA, por lo que falta el recorrido visual
con sesión real.

## 5. Regresión local

```text
ABC_F5_C01_UI_CONTRACT=PASS
A10 UI: 4/4 PASS
cfg6d-ui-contract: OK
cfg6d-ui-runtime: 93/93 PASS
cfg6-ui-runtime: 68/68 PASS
node --check fuente.js: PASS
node --check source-recovery/fuente-recuperado.js: PASS
git diff --check: PASS
```

Las dos pruebas de ejecución se corrigieron para resolver rutas y finales de
línea de Windows. El cambio solo afecta a los comprobadores.

## 6. Pendiente para cerrar C01

1. desplegar esta versión de la interfaz en QA;
2. recorrer por pantalla un relevo y el vínculo/desvínculo de un terminal de
   prueba;
3. ejecutar una apertura verdaderamente simultánea desde dos conexiones;
4. obtener la aceptación funcional del recorrido.

Hasta entonces C01 permanece incompleto aunque su núcleo y sus permisos estén
verificados en QA.
