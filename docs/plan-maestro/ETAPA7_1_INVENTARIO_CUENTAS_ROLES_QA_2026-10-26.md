# Plan Maestro L&A Suite — Etapa 7.1 — inventario de cuentas QA para matriz de roles

Fecha: 26/10/2026  
Entorno: QA `qjqorixtkilwsndqayyx` y Deploy Preview del PR `#175`  
Estado: `INVENTARIO_LEIDO; BLOQUEO_DE_CREDENCIALES; SIN_CAMBIOS_DE_CUENTAS`

## 1. Objetivo

Se inspeccionó la pantalla `Personal` del entorno QA para preparar la matriz
viva de permisos de la Etapa 7.1. La inspección fue únicamente de lectura:
no se abrió el editor, no se creó ningún empleado, no se modificó ningún rol y
no se reveló ni se introdujo ningún PIN.

## 2. Resultado observado

La pantalla de Personal muestra un único perfil de empleado visible en el
contexto QA actual. La ficha indica:

- PIN configurado;
- rol efectivo: `Encargado`;
- cuenta de empleado existente;
- relación laboral indefinida.

No aparecen perfiles QA dedicados visibles para:

- `Propietario` como cuenta de empleado de prueba;
- `Cajero/a`;
- `Camarero/a`.

La sesión actualmente abierta en la aplicación es de Propietario, pero eso no
sustituye una cuenta de empleado dedicada para probar el flujo de entrada en
modo empleado y sus permisos efectivos.

## 3. Decisión de seguridad

No se crean cuentas ni se cambian roles por inferencia. Tampoco se intenta
adivinar o reutilizar el PIN visible en la ficha. Crear perfiles, asignar
permisos o establecer credenciales requiere una decisión explícita sobre los
datos QA y las credenciales que se quieren utilizar.

## 4. Estado de la matriz

| Perfil | Contrato técnico | Cuenta QA dedicada visible | Prueba viva |
|---|---:|---:|---:|
| Propietario | PASS | No | Pendiente |
| Encargado | PASS | Sí, un perfil visible | Pendiente de login con PIN autorizado |
| Cajero/a | PASS | No | Pendiente |
| Camarero/a | PASS | No | Pendiente |

Los contratos técnicos de roles y Caja ya están en verde. La falta de cuentas
dedicadas bloquea únicamente la certificación viva por perfil; no es un fallo
del código.

## 5. Qué sigue

Para continuar la matriz viva se necesita disponer de credenciales QA dedicadas
para los perfiles pendientes y autorización para usarlas. Con ellas se podrá
verificar, sin hacer operaciones de negocio, que:

1. `Propietario`, `Encargado` y `Cajero/a` ven y pueden abrir Caja;
2. `Camarero/a` no recibe la pestaña interna de Caja;
3. el aislamiento de empresa y local se conserva en cada sesión;
4. el cierre de sesión y la entrada en modo empleado no dejan contexto de
   otro perfil.

Hasta entonces, la matriz viva permanece `PENDIENTE_POR_CREDENCIALES` y la
Etapa 7 no se promociona a producción.
