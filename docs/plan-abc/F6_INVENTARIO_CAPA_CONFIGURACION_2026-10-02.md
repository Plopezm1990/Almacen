# F6 — inventario de la capa de configuración por empresa y local

Fecha: 2026-10-02
Alcance: solo lectura. Base de datos de QA (`qjqorixtkilwsndqayyx`) y código del repositorio. **Producción no
consultada. Ningún cambio de código, de base de datos ni de despliegue.**
Autorización: «Sí, autorizo» a la etapa de inventario y diseño (Pedro, 2/10/2026).
Estado: `INVENTARIO_HECHO_PIEZAS_1_A_5_APLICADAS_Y_VERIFICADAS_EN_QA_SOLO_FALTA_LA_PANTALLA` (pieza 5: `F6_PIEZA5_PERMISOS_2026-10-02.md`) (pieza 4: `F6_PIEZA4_EQUIPOS_2026-10-02.md`) (pieza 3: `F6_PIEZA3_MODALIDADES_2026-10-02.md`) (pieza 1: `F6_PIEZA1_DIA_CAJAS_2026-10-02.md`; pieza 2: `F6_PIEZA2_DIFERENCIA_CAJA_2026-10-02.md`)

## Qué se pidió

Decisiones de Pedro que apuntan a una capa de configuración por empresa y local (hoja de decisiones,
`F1_HOJA_DECISIONES_PEDRO_2026-10-02.md`): producto multiempresa (D01), todas las modalidades activables
por local (D02), 10 cajas abiertas a la vez por local y permisos de los roles actuales ajustables (D03),
equipos configurables (D04), corte del día a las 00:00 configurable por local (D06), descuento del encargado
configurable con 0 % inicial (D12), diferencias de caja a la auditoría con motivo y aprobación sobre un umbral
(D15) y la plantilla de permisos D19.

## Resumen: qué existe hoy y qué falta

| Capacidad | Qué existe hoy (QA) | ¿Por empresa/local? | Hueco | Tamaño |
|---|---|---|---|---|
| Corte del día (D06) | Tabla `private.abc_operating_day_reglas` (zona horaria, hora de corte, vigencia, versión). QA: A1 y A2 con 04:00 | **Sí, por local** | Sin función pública para que el propietario la cambie (solo SQL). El valor 04:00 de QA es de prueba; D06 pide 00:00 por defecto | Pequeño |
| Descuento del encargado (D12) | Tabla `abc_descuento_politicas` (por empresa, local, rol o usuario: % máximo, cortesía, solicitar/aplicar/autorizar, doble aprobación) y funciones `abc_configurar_descuento_politica` / `abc_listar_descuento_politicas`. QA: Propietario 100 %, Encargado 20 % | **Sí, por empresa/local/rol/usuario** | Sin fila de política el código aplica por defecto **Encargado 20 %** (escrito en `abc_descuento_politica_usuario`); D12 pide **0 %** inicial. Cambiar ese valor afecta a los contratos A09 | Pequeño |
| Diferencias de caja (D15) | El cierre calcula `difference = contado − esperado` y la guarda en `abc_eventos` (`CAJA_SESION_CIERRE_PROVISIONAL` y `CAJA_SESION_CERRADA`) y en `caja_cierres.expected_snapshot`. El ensayo de cierre marca el bloqueo `DIFERENCIA_EFECTIVO` | Eventos por empresa/local | **Ya se registra** la diferencia. Falta: motivo obligatorio, umbral configurable, aprobación del propietario y su registro. Hoy el cierre acepta una diferencia sin tratamiento | Mediano |
| 10 cajas por local (D03) | `cajas_fisicas` (por local; QA: 1 por local) y un índice único: **una sesión activa por caja**. `abc_abrir_sesion_caja` no cuenta sesiones | Cajas por local | **Nada limita** cuántas cajas hay abiertas. No hay función pública para crear cajas (se crean por SQL) | Pequeño |
| Modalidades (D02) | `cuentas_comerciales.modalidad` con restricción cerrada: `BARRA, MESA, TERRAZA, TAKEAWAY, OTRO`. En uso en QA: solo `BARRA`. Zonas y mesas por local (`tpv_zonas`, `tpv_mesas`): 0 filas en QA | Zonas/mesas por local | **No existe** «modalidades habilitadas por local». La pantalla tiene 11 menciones a «modalidad» (no leídas en detalle) | Mediano |
| Equipos (D04) | Solo `terminales_tpv` (por local: `device_key`, `capacidades` en JSON) y su vínculo con la caja. QA: 2 terminales de prueba | Terminales por local | **No hay registro** de impresora, cajón ni datáfono (la tabla de impresiones documentales C09 solo tiene un campo `canal`) | Mediano |
| Permisos por rol (D03/D19) | Escritos **a mano** en la función `private.abc_tiene_capacidad` (25 capacidades en un `CASE` por nombre de rol), en `private.abc_a10_tiene_capacidad` (cocina), en **19 funciones** con nombres de rol y en el mapa de pantallas `ROLES_EMPLEADO` de la aplicación | **No**: iguales para todas las empresas | Hace falta tabla de capacidades por empresa/local/rol con la plantilla actual como valor por defecto, y cambiar las 19 funciones y la pantalla para leerla | **Grande** |
| Alta de empresas y locales (D01) | `empresas` y `locales` (`datos` en JSON; los locales de QA no guardan nada ahí) y migraciones PM29 (contexto de instalación, baja de empresa con cascada) | Es la base multiempresa | No se ha inventariado cómo se da de alta una empresa cliente de punta a punta | Por inventariar |

## Hallazgos que cambian el plan

1. **Hay más roles que los 4 de la matriz.** En el servidor aparecen **6 nombres de rol**: Propietario,
   Encargado, Cajero/a, Camarero/a, **Churrero/a** y **Básico**; en la pantalla, además, **Estándar**.
   Churrero/a tiene permisos reales de producción y cocina; Básico y Estándar no tienen ninguna capacidad ABC
   (Básico solo ve «dashboard, venta, fichaje»). La decisión «ajustar los permisos de los 4 roles actuales»
   deja sin tratar a los otros tres. **Pregunta abierta 1.**
2. **Los permisos están en tres sitios que deben cambiar a la vez** (función de capacidades, 19 funciones con
   roles escritos y mapa de la pantalla). Es lo más grande de la capa, y lo que más riesgo de regresión tiene.
3. **La plantilla D19 coincide en gran parte con el comportamiento actual.** Comprobado en `abc_tiene_capacidad`:
   el cajero ya abre y cierra caja (`ABC_CAJA_OPERAR`: propietario, encargado y cajero), no resuelve cobros
   inciertos (`ABC_COBRO_RESOLVER_INCIERTO`: propietario y encargado) y cancelar un pedido (`ABC_PEDIDO_CANCELAR`)
   es de propietario y encargado. **Difiere de lo decidido:**
   - **Reabrir un cierre provisional** (`abc_reabrir_cierre_provisional`) usa `ABC_CAJA_OPERAR`, es decir, **hoy
     también puede hacerlo el cajero**; D14 y la plantilla D19 piden solo el propietario.
   - **Solicitar devoluciones:** hoy solo propietario y encargado (`ABC_REEMBOLSO_SOLICITAR`); D13 pide que el
     cajero pueda solicitarlas con aprobación.
   - **Emitir y rectificar documentos:** no existen todavía funciones para hacerlo (puerta fiscal cerrada). Las
     funciones documentales actuales (clasificar, configurar modalidad fiscal, conservar, evaluar) exigen
     `ABC_EMISOR_CAMBIAR` (propietario y encargado). Las casillas D19 de «emitir» y «rectificar» no tienen
     todavía nada a lo que aplicarse.
4. **El descuento del encargado por defecto es 20 %, no 0 %.** Hay que cambiarlo y revisar los contratos A09.
5. **El corte del día ya es por local** (con vigencias y versión); solo falta la forma de cambiarlo y el valor
   00:00. Un cambio de corte con cuentas abiertas puede mover cuentas de día: hay que definir cuándo se aplica.
6. **La regla de 10 cajas puede ser pequeña**: contar sesiones activas del local al abrir caja, con el límite
   guardado como ajuste del local.
7. **La diferencia de caja ya se registra**; lo que falta es tratarla (motivo, umbral, aprobación), no capturarla.

## Diseño propuesto (a validar; nada implementado)

Principios: (a) **el valor por defecto es el comportamiento actual** (más los cambios de D06/D12/D19), para no
romper nada; (b) la configuración se lee con herencia **local → empresa → por defecto**; (c) toda lectura y
escritura pasa por funciones del servidor con permiso del propietario y **auditoría del cambio**; (d) cada pieza
se prueba con contrato vivo en QA con `ROLLBACK`, como P3/P3b.

Piezas, de menos a más riesgo (cada una exigiría su autorización):

1. **Ajustes simples por local:** corte del día (00:00 por defecto), límite de cajas abiertas (10) y descuento
   inicial del encargado (0 %). Aprovechan tablas y funciones que ya existen.
2. **Tratamiento de la diferencia de caja:** motivo obligatorio, umbral configurable, aprobación del
   propietario y su registro en la auditoría.
3. **Modalidades habilitadas por local** y su comprobación al abrir una cuenta.
4. **Registro de equipos por local** (tipo, referencia, estado); sin comprar ni integrar nada.
5. **Permisos configurables por rol**: tabla de capacidades por empresa/local/rol con la plantilla D19 por
   defecto; cambiar `abc_tiene_capacidad`, `abc_a10_tiene_capacidad`, las 19 funciones y el mapa de pantalla.
6. **Pantalla de configuración para el propietario** (hoy no existe ninguna): se construye después de las
   funciones del servidor, que se pueden probar sin pantalla.

## Preguntas abiertas para Pedro

**Respondidas el 2/10/2026** (detalle en la hoja de decisiones): (1) los roles Churrero/a, Básico y Estándar se
**retiran** (se aplica en la pieza de permisos); (2) configura **cada empresa con su propietario**; (3) se empieza
por la **pieza 1, solo en QA y sin desplegar la pantalla**. Texto original de las preguntas:

1. **Roles:** ¿Churrero/a, Básico y Estándar se mantienen como roles de la plantilla (con sus permisos de hoy), se
   fusionan con los otros o se retiran?
2. **Quién configura:** ¿cada empresa cliente configura lo suyo con su propietario, o lo hace solo el propietario de
   la plataforma (tú)? Cambia los permisos de las funciones de configuración.
3. **Por dónde empezar:** mi recomendación es la pieza 1 (ajustes simples), porque ya tiene base y desbloquea D06,
   D12 y D03 (cajas) sin tocar permisos.

## Límites

- Solo QA y repositorio; producción no consultada (puede diferir).
- No se leyó el código de pantalla por completo (por ejemplo, para qué usa «modalidad») ni se ejecutó nada.
- «19 funciones con nombres de rol escritos» es un recuento por texto de la definición; no se revisó una a una
  su semántica.
- No se inventarió el alta de empresas de punta a punta (D01).
- Tamaños «pequeño/mediano/grande» son relativos, no estimaciones de tiempo.
