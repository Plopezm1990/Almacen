# Traspaso de estado — Proyecto A / L&A Suite

Documento de continuidad para retomar el trabajo en una sesión nueva.
Fecha de corte: **2026-09-12**. Todo lo que aquí se afirma está
verificado; lo que no se pudo verificar se dice explícitamente.

---

## 1. Coordenadas del repositorio

| Elemento | Valor |
|---|---|
| Repositorio | `Plopezm1990/Almacen` |
| Rama de trabajo | `claude/pm26-preparacion-tecnica` |
| HEAD de la rama de trabajo | `11311aa7e6d6db167809708fbf8522d8d3e67aa0` |
| `main` | `93a570badba1c5375febfbddc1dffdbcef003dcd` (sin tocar en todo PM26) |
| `release` (rama que despliega producción vía Netlify) | `9d54fc7ba76bd1285625f37b2940f99d26777ab8` |
| PR #38 | **Abierta, en borrador, NO MERGE.** Base `main`, head = rama de trabajo |

Entornos Supabase: **producción** (`L&A Suite`), **QA** (`L&A Suite QA`),
**TPV** (inactivo). Los identificadores internos de proyecto y el nombre
del site de Netlify **no se publican en este repositorio** — hay un
escáner que lo impide (ver sección 6).

---

## 2. Plan de acción vigente: 4 puntos (no 5)

| # | Punto | Estado real |
|---|---|---|
| 1 | **Defecto E** | **CERRADO** vía PM26-P05c. No reabrir. |
| 2 | **Aviso G** (protección de contraseñas filtradas) | **BLOQUEADO POR DECISIÓN ECONÓMICA PENDIENTE.** |
| 3 | **Defecto L** (aislamiento de `prefiltros_candidatos` por empresa/local) | **APLICADO EN PRODUCCIÓN** el 2026-09-12. Ver sección 3. |
| 4 | **PM25-P02** (ensayo de recuperación + migración) | **BLOQUEADO**, con evidencia parcial local ya ejecutada. Ver sección 5. |

### 2.1 Punto 2 — por qué está bloqueado

La protección de contraseñas filtradas (HaveIBeenPwned) solo existe en
planes Supabase **Pro o superior**; la organización está en **Free**.
No hay alternativa técnica ni local: es una función hospedada.

El usuario, tras una explicación completa del riesgo real (es una capa
extra de defensa, no un agujero activo; el resto de controles —RLS,
roles, Auth— siguen funcionando igual), **decidió de forma informada no
pagar por ahora**. No es un olvido ni una tarea pendiente de ejecución:
es una decisión tomada.

Además: **no existe ninguna herramienta disponible para cambiar el plan
de una organización de Supabase.** Aunque se autorizara, el cambio solo
puede hacerlo el usuario desde el panel de Supabase (Settings →
Billing), con su propia facturación.

---

## 3. Punto 3 — Defecto L: qué se hizo realmente en producción

**Se aplicó de verdad, en producción real, con autorización explícita
paso a paso del usuario.** Es la primera vez en todo PM26 que se tocó
`release` y se desplegó en Netlify.

### 3.1 Secuencia ejecutada

1. **Catálogo backend** (`public.empresas`, `public.locales`): RLS
   activada, cero políticas, `revoke all` a `authenticated`/`anon`/
   `public`. Diseñado y probado en PM26-P08g; aplicado por el usuario
   en producción desde el SQL editor.
2. **Membresía real** del usuario en `membresias_usuario`.
3. **Migración del Defecto L**: añade `empresa_id`/`local_id` NOT NULL a
   `prefiltros_candidatos` y reescribe las 3 políticas RLS para exigir
   `private.la_tiene_local(empresa_id, local_id)`. Aplicada por el
   usuario, con su preflight embebido pasando.
4. **Parche del cliente** (PM26-P08d): commit `9d54fc7` en `release`,
   desplegado por Netlify en contexto `production`, estado `ready`.

### 3.2 Defecto encontrado DESPUÉS del despliegue, y corregido

**Esto es lo más importante de esta sección.**

La membresía inicial se creó con `empresa_id='ADMIN'` — un valor
*placeholder inventado por el asistente*. Pero la aplicación, al crear
un candidato, envía **sus propios identificadores internos** de empresa
y local (los que guarda en `almacen_kv`, clave `locales`). Como no
coincidían con `ADMIN`, la política RLS **bloqueaba la creación de
candidatos**.

El fallo no se detectó en la primera prueba porque el usuario comprobó
que la pantalla *"cargaba bien"* — pero **leer no es crear**: con 0
filas, un `SELECT` devuelve vacío sin error aunque la autorización
falle.

Se detectó por inspección de solo lectura, se reprodujo en PostgreSQL
local (antes `false`, después `true`, idempotente) y se corrigió en
producción con SQL que **lee los identificadores reales de
`almacen_kv`** en lugar de inventar ninguno. Verificado después:
`la_app_podria_crear_prefiltros = true`.

### 3.3 Lección a conservar

> Que un módulo "cargue bien" **no** prueba que la autorización de
> escritura funcione. Para el Defecto L, la prueba válida es **crear**
> un candidato de prefiltro real, no abrir la pantalla.

### 3.4 Pendiente de confirmación

⚠️ **Al cierre de esta sesión, el usuario aún no había confirmado
haber creado un candidato de prefiltro real en la app.** La corrección
está verificada a nivel de base de datos, pero la prueba de punta a
punta en la interfaz **sigue pendiente**. Es lo primero que debe
comprobarse al retomar.

---

## 4. Dos conceptos de "empresa/local" que NO son el mismo

Fuente frecuente de confusión — dejarlo claro evita errores graves:

| | Catálogo backend (PM26-P08g) | "Empresas y locales" de la app |
|---|---|---|
| Dónde vive | Tablas `public.empresas` / `public.locales` | `almacen_kv`, clave `locales` (JSON) |
| Quién escribe | Solo vía SQL administrativo | La propia aplicación |
| Visible en la interfaz | **No**, no hay ninguna pantalla | Sí, pantalla "Empresas y locales" |
| Para qué sirve | Dar autoridad a la autorización RLS | Organizar el negocio por local |

El catálogo backend existe **solo** para que la autorización de
`prefiltros_candidatos` no dependa de datos que el cliente puede
fabricar. **No sustituye ni alimenta la pantalla de la app.**

Estado actual del catálogo: contiene la empresa/local reales del usuario
(leídos de `almacen_kv`) **más** las filas técnicas `ADMIN`, que quedaron
inservibles pero son inofensivas. Se pueden limpiar más adelante; no
corre prisa.

**Deuda conceptual real, no resuelta:** el catálogo es autoritativo para
la autorización, pero se rellena copiando lo que la app ya tenía en
`almacen_kv` — que es exactamente la fuente que PM26-P08e descartó por
no ser fiable. Hoy funciona porque solo hay un usuario y un local, y la
membresía usa `todos_locales=true`. **Con clientes reales, esto hay que
rediseñarlo**: el alta de empresas/locales debería ser administrativa,
no un reflejo de lo que escribe el cliente.

---

## 5. Punto 4 — PM25-P02: qué se probó y qué falta

**No está cerrado y no debe presentarse como cerrado.**
`tests/pm25/P02_BLOQUEADO_ENTORNO_AISLADO.md` sigue siendo el documento
de estado vigente, y hay un contrato que falla activamente si alguien
cambia sus marcadores.

**Ejecutado** (`tests/pm25/P02_ENSAYO_LOCAL_PARCIAL.md`, gate verde):
ensayo en PostgreSQL local aislado sobre la migración candidata
`20260905185935_g1_p08_operation_id_finanzas_global.sql` — dos réplicas,
fixtures con un `operation_id` duplicado a propósito entre dos libros,
migración aplicada sin modificar, validación del registro global, del
libro ganador (`pagos_factura`), de los permisos revocados, de la
integridad de los 5 libros y del rechazo del disparador, más reversión
comparada contra el punto de recuperación. **Ningún hallazgo indica un
defecto en la migración.**

**Falta**, y no se puede hacer sin entorno aislado real: Auth, JWT,
PostgREST y RLS con sesiones reales. Requiere *branching* (solo Pro) o un
tercer proyecto activo (el plan Free permite 2, y ya están ocupados).

---

## 6. Convenciones del proyecto que hay que respetar

Aprendidas a base de romperlas. Ignorarlas cuesta ciclos de CI:

1. **Cada paquete PM26** = informe `.md` + contrato `.mjs` + workflow de
   dos jobs (`validar` → `gate-final`), acotado con `paths:`.
2. **Nunca declarar un punto cerrado sin gate remoto en verde sobre el
   SHA exacto.** Local en verde no basta.
3. **Los contratos históricos se anclan a su commit de cierre**
   (`git show <sha>:<ruta>`), nunca al árbol vivo. Módulo compartido:
   `tests/pm26/lib/cierre-historico.mjs`.
4. **`fetch-depth: 0`** obligatorio en cualquier job que lea commits
   antiguos, incluido `gate-final`.
5. **Cada workflow provisiona sus propias dependencias.** Si ejecuta
   (aun transitivamente) contratos que necesitan PostgreSQL o la CLI de
   Supabase, debe instalarlos él mismo. Que estén en el entorno local no
   significa nada para un runner limpio.
6. **El escáner de secretos lee del ÍNDICE de git, no del árbol de
   trabajo.** Hay que `git add` antes de ejecutarlo, o seguirá viendo la
   versión antigua. Comando:
   `node tools/seguridad/verificar-secretos-e-identificadores.mjs verificar`
7. **Nunca publicar en el repositorio** identificadores internos de
   infraestructura (referencias de proyecto Supabase, nombre del site de
   Netlify). El escáner los detecta; ya ocurrió una vez en esta sesión.
8. **Datos sintéticos siempre**: un solo dígito o patrón repetido
   (`99999999-...`, `EMPRESA_TEST`). Nunca algo que parezca real.
9. **SQL a `psql` por stdin**, nunca `-f <ruta>`: en los runners de CI el
   usuario `postgres` no puede leer el árbol de trabajo.
10. **Un fallo repetido nunca es "flake"** sin haber leído el log real.
    En esta sesión, dos fallos que parecían de *timing* eran en realidad
    una dependencia ausente.

---

## 7. Reglas vinculantes (siguen en vigor)

- Nunca modificar `main` ni fusionar a `main` sin autorización nueva.
- Nunca cerrar ni fusionar la **PR #38**.
- No publicar en producción, cambiar configuración de producción ni
  promover migraciones de QA a producción por iniciativa propia.
- Nunca usar usuarios ni datos reales en pruebas: solo sintéticos.
- Nunca incluir `service_role`, contraseñas, tokens ni claves en código,
  commits o documentos.
- Nunca ocultar un check de CI en rojo ni declarar algo cerrado sin
  evidencia.
- Supabase: **producción = nunca escribir por iniciativa propia**;
  **QA = único sitio para migraciones/RPC/RLS**, con autorización por
  migración; **TPV = ignorar por completo**.
- No inventar identificadores, empresas, locales, usuarios ni
  autorizaciones. *(Esta regla se rompió con el placeholder `ADMIN` —
  ver 3.2. No repetirlo.)*
- **No autorizado hoy**: cambiar Supabase de Free a Pro, contratar
  servicios, crear branches de pago ni generar facturación.

---

## 8. Cómo trabaja el usuario (importante para no hacerle perder tiempo)

- Responde y trabaja **en español**.
- Trabaja **desde el móvil**, con el panel de Supabase en el navegador.
  **No tiene el repositorio delante.** Decirle "abre el archivo X del
  repo" no le sirve: hay que **pegarle el SQL listo para copiar y
  pegar**, ya con sus valores sustituidos.
- Prefiere explicaciones **sin tecnicismos**, y pasos de uno en uno.
- **Él ejecuta las acciones en producción**, no el asistente — salvo el
  push a `release` del 2026-09-12, que autorizó explícitamente.
- Pregunta "¿es necesario?" cuando algo cuesta dinero: merece una
  respuesta honesta sobre riesgo real, no una recomendación de venta.

---

## 9. Qué hacer al retomar, por orden

1. **Confirmar con el usuario si ya creó un candidato de prefiltro real
   en la app** (sección 3.4). Si falla, diagnosticar antes que nada.
2. Si funciona: considerar limpiar las filas técnicas `ADMIN` del
   catálogo (`empresas`, `locales`, y la membresía `ADMIN`) — opcional,
   inofensivas, requiere autorización por ser producción.
3. **TPV**: el usuario dejó explícitamente fuera la ampliación futura
   del TPV *"hasta cerrar este plan de acción"*. El plan ya está en su
   estado final, así que el TPV es el siguiente bloque grande — pero
   **no empezarlo sin que el usuario lo pida**.
4. Puntos 2 y 4: solo avanzan si el usuario decide pagar el plan Pro.
   No volver a proponerlo salvo que él lo saque.

---

## 10. Marcadores de estado

```
TRASPASO_FECHA=2026-09-12
TRASPASO_RAMA=claude/pm26-preparacion-tecnica
TRASPASO_HEAD=11311aa7e6d6db167809708fbf8522d8d3e67aa0
TRASPASO_PUNTO_1_DEFECTO_E=CERRADO
TRASPASO_PUNTO_2_AVISO_G=BLOQUEADO_DECISION_ECONOMICA
TRASPASO_PUNTO_3_DEFECTO_L=APLICADO_EN_PRODUCCION
TRASPASO_PUNTO_3_PRUEBA_EXTREMO_A_EXTREMO=PENDIENTE
TRASPASO_PUNTO_4_PM25_P02=BLOQUEADO_EVIDENCIA_PARCIAL
TRASPASO_MAIN_TOCADO=NO
TRASPASO_PR_38_CERRADA_O_FUSIONADA=NO
TRASPASO_TPV_INICIADO=NO
TRASPASO_PLAN_SUPABASE=free
```
