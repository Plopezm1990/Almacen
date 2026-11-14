# Acceso a QA para las pruebas de aceptación

13 de noviembre de 2026. Medido en el preview y en la base de QA. Esta nota
existe porque el acceso condiciona cómo se pueden certificar las 267 filas de
la matriz, y conviene saberlo antes de planificar la aceptación.

## La sesión caduca en 15 minutos

Lo fija A-05 (`docs/plan-abc/A05_SESIONES_CADUCIDAD_2026-11-09.md`). En la
práctica, un barrido de más de un cuarto de hora se queda sin sesión a mitad y
hay que volver a entrar, con un segundo factor nuevo.

Durante el barrido móvil del 13/11 ocurrió exactamente eso: las 44 pantallas
cupieron en la ventana, pero el siguiente bloque de trabajo ya encontró la
sesión cerrada.

## Qué cuentas pueden usarse, y a qué coste

La migración `m03_server_aal2_gate` exige `aal2` a **Propietario, Encargado y
Cajero/a**. Medido en QA-EMP-A:

| Cargo | Cuentas activas | Factores verificados | ¿Exige aal2? | Situación |
|---|---|---|---|---|
| Propietario | 3 | **1 cada una** | sí | Entra, pero cada acceso pide código del autenticador |
| Encargado | 4 | **0** | sí | Necesita inscribir un segundo factor la primera vez |
| Cajero/a | 2 | **0** | sí | Igual que Encargado |
| Camarero/a | 2 | 0 | **no** | Entra sólo con contraseña |

La aplicación **sí ofrece la inscripción**: si el cargo exige `aal2` y no hay
factor verificado, llama a `mfa.enroll` y muestra el QR y el secreto para
vincular una aplicación autenticadora. También reutiliza una activación
pendiente en vez de crear otra.

## Lo que esto significa para la aceptación

- **Sin acompañamiento sólo se puede trabajar con Camarero/a**, que es
  justamente el cargo que menos pantallas ve. Sirve para probar denegaciones,
  no para recorrer la matriz.
- Para recorrer módulos completos hace falta Propietario, y por tanto alguien
  con el autenticador delante, en tandas de menos de quince minutos.
- Si se quiere probar **Encargado y Cajero/a** —que los casos Q03 y Q16 piden—,
  antes hay que inscribir un segundo factor en esas seis cuentas. Quien lo
  inscriba se queda con el autenticador, así que conviene decidir de antemano
  quién lo custodia y si va a estar disponible durante las pruebas.

## Recomendación

Planificar la aceptación en **tandas cortas y preparadas**: la lista de
comprobaciones escrita de antemano, el recorrido guionizado, y el código sólo
cuando hace falta entrar. Lo que se pueda medir sin sesión —estructura,
tamaños, contraste, contratos— se mide antes en banco, y la ventana con sesión
se reserva para lo que de verdad necesita datos reales.
