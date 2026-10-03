# F6 · pieza 3 de la capa de configuración: modalidades de cuenta por local

Fecha: 2026-10-02
Alcance: **solo QA** (`qjqorixtkilwsndqayyx`) y repositorio. **Producción no tocada. Pantalla no modificada.**
Autorización: «Pieza 3: modalidades por local» elegida por Pedro el 2/10/2026 (sobre el diseño de
`F6_INVENTARIO_CAPA_CONFIGURACION_2026-10-02.md`; solo en QA, como las piezas anteriores).
Estado: `PIEZA_3_APLICADA_Y_VERIFICADA_EN_QA_SIN_PANTALLA`

## Qué se pidió (D02)

«Todas las modalidades que se puedan seleccionar; cada empresa o cada local en específico usa las suyas.»
Hoy las cuentas tienen una modalidad cerrada (`BARRA`, `MESA`, `TERRAZA`, `TAKEAWAY`, `OTRO`) y nada impide usar
cualquiera en cualquier local.

## Qué hace

| Pieza | Resultado |
|---|---|
| Qué modalidades usa cada local | Tabla nueva `abc_local_modalidades` (sin acceso directo). **Sin fila, la modalidad está habilitada**: el comportamiento de hoy no cambia hasta que un propietario decide |
| Quién lo cambia | Solo el **Propietario de la empresa**, con `abc_configurar_modalidad_local` (habilitar o deshabilitar una modalidad de un local, con motivo y `operation_id` idempotente). Encargado, cajero/a, propietario de otra empresa, `anon` y `service_role` quedan rechazados |
| Mínimo | Siempre queda **al menos una modalidad habilitada** por local (`modalidades_minimo_una`) |
| Lectura | `abc_obtener_modalidades_local`: cualquier miembro del local ve las cinco con su estado (`habilitada`, `origen` defecto o local, `version`) y la lista de habilitadas en orden fijo |
| Guarda | Un trigger en `cuentas_comerciales`: crear una cuenta en una modalidad deshabilitada, o cambiar a ella una cuenta existente (por ejemplo al asignarla a una mesa o a la terraza), da `modalidad_no_habilitada:<MODALIDAD>`. Vale para cualquier camino, no solo para la función de abrir cuenta |
| Cuentas ya abiertas | **No se tocan.** Deshabilitar solo impide abrir cuentas nuevas o cambiar a esa modalidad; una cuenta ya abierta sigue funcionando (y la repetición idempotente de su apertura sigue devolviendo su resultado). El resultado informa de cuántas cuentas abiertas había en esa modalidad |
| Auditoría | Cada cambio real deja un evento `MODALIDAD_LOCAL_CONFIGURADA` con modalidad, valor anterior, nuevo, motivo, actor y cuentas abiertas. Repetir un estado no crea versión ni evento |

Es **aditiva**: no reemplaza ninguna función existente (comprobado por texto) ni cambia datos al aplicarse. Los
permisos se reafirman: solo `authenticated` ejecuta las dos funciones públicas.

## Efecto en la pantalla actual

La pantalla actual abre **siempre** las cuentas en `BARRA`. Un local que **deshabilite BARRA** no podrá abrir cuentas
desde ella hasta que la pantalla elija entre las modalidades habilitadas (pieza 6). Con todo por defecto (nada
configurado) no cambia nada. En QA no hay ninguna decisión guardada, así que hoy no afecta a nadie.

## Decisiones y límites

1. **Valor por defecto: todas habilitadas** (el comportamiento actual). Si Pedro prefiere que un local nuevo empiece solo
   con alguna modalidad, se cambia aquí.
2. **Solo por local**: no hay valores por defecto a nivel de empresa (la empresa no puede fijar un conjunto para todos
   sus locales de golpe). Es una limitación conocida de la capa entera.
3. La pantalla de sala (mesas y zonas) y las modalidades fiscales (`NO_FISCAL`, `SIF_…`) son otra cosa y no se tocan.
4. No se ha comprobado el efecto en **producción**: allí la apertura de cuentas puede ser distinta.

## Pruebas

| Prueba | Resultado |
|---|---|
| Contrato vivo `tests/cfg/cfg3-contract.sql` **en QA**, con `ROLLBACK` | **79/79** |
| Mismo contrato en una réplica local (cadena de migraciones con C04 y las piezas 1 y 2) | **79/79** |
| Contratos vivos de las piezas 1 y 2 con la pieza 3 aplicada (regresión, local) | **102/102** y **201/201** |
| Contratos originales de Postgres real M04d, A03, A04, A05, A06, A07, A08 y A10 con la guarda aplicada | **PASS** (todas) |
| Contrato estático `tests/cfg/cfg3-static-contract.mjs` | OK |
| Mutantes del contrato vivo: 19 averías provocadas (sin guarda, guarda solo al insertar, guarda que no distingue si cambia la modalidad, defecto «deshabilitada», sin mínimo, encargado configura, siempre «cambio», evento equivocado, sin mayúsculas, lectura abierta, sin versión, motivo opcional, sin comprobar el local, mensaje sin modalidad, sin unicidad, sin replay, estado nulo, cuentas abiertas mal contadas…) | **19/19 detectadas** |
| Mutantes del contrato estático: 24 averías provocadas (permisos, `search_path`, ACL, RLS, política, reemplaza `abc_abrir_cuenta`, borra cuentas, lista de modalidades, unicidad, bloqueo…) | **24/24 detectadas** |

Estado de QA comprobado después de aplicar y de las pruebas: tabla con RLS activada, sin políticas y sin permisos de
tabla; las 5 funciones son SECURITY DEFINER con `search_path` vacío, las 3 privadas sin permiso para nadie y las 2 públicas
solo para `authenticated`; el trigger nuevo es el único de `cuentas_comerciales`; migración **registrada** en la lista de
Supabase; **cero residuos** de las pruebas (empresas, locales, membresías, cuentas, sesiones, entidades, reglas, eventos y
operaciones `CFG-*`), sin transacciones abiertas ni bloqueos; las dos cuentas de QA siguen en `BARRA`.

## Límites de la verificación

- La réplica local no incluye todas las migraciones posteriores a C04; la ejecución en QA cubre la cadena real. **QA no
  es producción.**
- Los contratos antiguos (A03 a A10) se ejecutaron sobre la cadena de su época (antes del día operativo A11) con **solo la
  guarda y su tabla** aplicadas, porque la pieza completa necesita funciones posteriores; prueban que la guarda no rompe
  los flujos por defecto, no la pieza entera.
- No se probó la asignación a mesa/terraza con una modalidad deshabilitada a través de las funciones de sala; se prueba
  con cambios directos de la modalidad (que es lo que ejecutan esas funciones).
- Sin prueba de carga ni de concurrencia real.
- Antes de promocionar: registrar `cfg3-static-contract.mjs` y el contrato vivo en la puerta de CI, y adaptar la pantalla
  (pieza 6) para elegir entre las modalidades habilitadas.

## Siguiente paso

Pieza 4 (registro de equipos), pieza 5 (permisos configurables y retirada de roles) o la pantalla (pieza 6); cada una
necesita su autorización.
