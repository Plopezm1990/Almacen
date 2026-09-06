# PM11 · Personal / Empleados · P05 — RPC de ciclo de vida

Fecha: 2026-09-06  
Rama: `pm11-personal-empleados`  
Base P04: `f8eac1f16b3587864c82d176950ea5f8aa512e75`  
Supabase QA: `qjqorixtkilwsndqayyx`  
Producción/main: **no tocar / no tocado**

## 1. Objetivo

Implementar en backend operaciones transaccionales para:

- alta de empleado;
- edición ordinaria;
- baja lógica;
- reactivación.

P05 no conecta todavía la UI de `fuente.js`, no migra `almacen_kv.empleados`, no implementa anonimización ni vínculo de cuenta. Esas piezas continúan en puntos posteriores.

## 2. Migración aplicada en QA

Migración Supabase aplicada correctamente:

- `20260906061626` — `pm11_rpc_ciclo_vida_empleados`.

Archivo versionado:

- `supabase/migrations/20260906084500_pm11_rpc_ciclo_vida_empleados.sql`.

## 3. RPC públicas

Se crearon y se concedieron únicamente a `authenticated`:

- `public.pm11_alta_empleado(...)`;
- `public.pm11_editar_empleado(...)`;
- `public.pm11_baja_empleado(...)`;
- `public.pm11_reactivar_empleado(...)`.

Las cuatro funciones son `SECURITY DEFINER` deliberadamente para que el cliente no reciba privilegios directos de escritura sobre `public.empleados`. Cada RPC valida `auth.uid()`, membresía, rol, empresa, local concreto y estado del empleado antes de mutar.

`anon` no puede ejecutar las RPC.

## 4. Autoridad de contexto

Se añadió `private.pm11_puede_mutar_personal(empresa, local)`.

Reglas:

- actor debe estar activo;
- `empresa_id` recibido debe coincidir con una membresía activa real del actor: no se confía ciegamente en el payload;
- Propietario puede operar en los locales de su empresa cubiertos por su membresía;
- Encargado solo puede operar en su `local_id` exacto y nunca con `todos_locales=true`;
- resto de roles no puede mutar Personal;
- `TODOS` / `TODOS LOS LOCALES` no es contexto de mutación válido.

## 5. Local activo

Se añadió `private.pm11_local_activo(...)` sobre la persistencia de configuración existente en `almacen_kv`.

En QA se comprobó:

- `QA-A1`: operable;
- `QA-A2`: operable;
- `QA-B1`: operable para su empresa;
- `QA-A-CERRADO`: bloqueado para mutaciones.

El histórico de un empleado de local cerrado sigue siendo legible según P04, pero no puede recibir altas/ediciones/bajas/reactivaciones operativas mientras el local esté inactivo.

## 6. Validación laboral en backend

`private.pm11_validar_datos_laborales(jsonb)` replica la frontera numérica esencial heredada de LA-017 cuando los campos están presentes:

- `horasSemanales >= 0`;
- `pagas > 0`;
- `salarioBrutoMensual >= 0`;
- `costeEmpresaMensual >= 0`;
- `diasVacacionesAnuales >= 0`;
- valores no numéricos/no finitos se rechazan.

Así, una llamada directa a la RPC no puede saltarse la validación esencial del frontend.

## 7. Alta

`pm11_alta_empleado` garantiza:

- actor/contexto autorizado;
- local concreto y activo;
- `empleado_id` no vacío y no reutilizado;
- nombre obligatorio;
- estado inicial `activo`;
- validación de datos laborales;
- identidad canónica en columnas SQL;
- espejo de compatibilidad en `datos` con `id`, `empresaId`, `localId`, `nombre`, `activo` y `estado` sobrescritos por los valores autoritativos;
- auditoría en la misma transacción.

## 8. Edición

`pm11_editar_empleado`:

- bloquea la fila con `FOR UPDATE`;
- exige coincidencia exacta `empleado_id + empresa + local`;
- solo edita empleado `activo`;
- fusiona un patch JSON sobre los datos existentes;
- vuelve a imponer identidad/contexto/estado canónicos;
- valida el resultado completo antes de guardar;
- no permite cambiar empresa/local mediante payload;
- audita únicamente nombres de campos modificados, sin volcar PII completa al log.

## 9. Baja lógica

`pm11_baja_empleado`:

- solo acepta estado `activo`;
- conserva la fila y el mismo `empleado_id`;
- cambia a `inactivo`;
- fija `baja_at`;
- mantiene empresa/local;
- actualiza el espejo `datos.activo=false` / `datos.estado='inactivo'`;
- registra auditoría.

No existe DELETE físico dentro de la RPC.

## 10. Reactivación

`pm11_reactivar_empleado`:

- solo acepta estado `inactivo`;
- exige el mismo contexto empresa/local;
- exige local activo;
- conserva `empleado_id`;
- cambia a `activo`;
- fija `reactivado_at`;
- registra auditoría.

Un empleado ya activo no puede “reactivarse” de nuevo.

## 11. Prueba funcional positiva QA

Con **Propietario A** se ejecutó el ciclo real:

1. alta `P05-QA-A1` en `QA-EMP-A / QA-A1`;
2. edición de `horasSemanales 40 → 37.5`, nombre y puesto;
3. baja lógica;
4. reactivación.

Resultado final antes de limpieza:

- mismo ID `P05-QA-A1` durante todo el ciclo;
- empresa `QA-EMP-A` intacta;
- local `QA-A1` intacto;
- `baja_at` presente;
- `reactivado_at` presente;
- estado final `activo`;
- **4 eventos de auditoría**, uno por operación.

## 12. Matriz negativa QA

Todas estas pruebas devolvieron el rechazo esperado:

- Propietario A intentando alta en Empresa B → `personal_contexto_no_autorizado`;
- alta en local cerrado → `personal_contexto_no_autorizado`;
- mutación con `TODOS` → bloqueada;
- horas semanales negativas por llamada directa → `empleado_valor_fuera_rango:horasSemanales`;
- reutilización de `empleado_id` → `empleado_id_ya_existe`;
- edición de empleado A1 declarando A2 → `empleado_contexto_no_coincide`;
- reactivar un empleado ya activo → `empleado_reactivacion_estado_invalido`;
- Encargado A2 alta en A2 → permitida;
- Encargado A2 intentando alta en A1 → `personal_contexto_no_autorizado`;
- Cajero A1 intentando alta → `personal_contexto_no_autorizado`.

Las pruebas negativas que requerían mutaciones temporales se ejecutaron dentro de transacciones revertidas.

## 13. Privilegios

Comprobado en QA:

- `authenticated` SELECT directo sobre `empleados`: sí;
- `authenticated` INSERT directo: no;
- `authenticated` UPDATE directo: no;
- `authenticated` DELETE directo: no;
- `authenticated` EXECUTE de RPC P05: sí;
- `anon` EXECUTE de RPC P05: no.

Por tanto, la única escritura disponible para usuarios autenticados es la frontera transaccional controlada.

## 14. Advisor de seguridad

Tras el DDL se ejecutó el advisor de seguridad de Supabase.

El linter marca las cuatro RPC P05 con el aviso genérico `authenticated_security_definer_function_executable`. En este caso la exposición a `authenticated` es **intencional**: son precisamente la API pública de dominio y contienen validaciones explícitas de `auth.uid()`, membresía, rol, empresa/local y estado antes de cualquier escritura. La tabla continúa sin privilegios directos de mutación.

El advisor también mantiene avisos heredados ajenos a P05 (`operaciones_procesadas`, `prefiltro_limites`, `prefiltros_candidatos` sin policy, protección de contraseñas filtradas desactivada y otros RPC históricos SECURITY DEFINER). No se amplía el alcance de P05 para corregir paquetes ajenos.

## 15. Limpieza QA

Se eliminaron al terminar:

- empleado sintético `P05-QA-A1`;
- sus cuatro eventos de auditoría sintéticos.

Resultado:

- empleados `P05-*` restantes: **0**;
- auditoría `P05-*` restante: **0**.

## 16. Frontend y producción

- cambios en `fuente.js`: **0**;
- cambios en `source-recovery`: **0**;
- producción: **0 cambios**;
- `main`: no tocar;
- cambios de base de datos: exclusivamente QA.

**PM11_P05_RPC_CICLO_VIDA_EMPLEADOS=PASS**  
**SIGUIENTE=PM11_P06_PUENTE_FRONTEND_SQL_EMPLEADOS**
