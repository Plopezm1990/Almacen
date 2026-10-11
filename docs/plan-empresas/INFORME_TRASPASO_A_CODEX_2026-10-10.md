# Informe de traspaso a Codex · Plan D01 (multiempresa: alta, baja y borrado de empresas clientes)

Fecha: 2026-10-10 (tarde, hora de Madrid)
Redactado por: Claude (Anthropic), a petición de Pedro, para que Codex (ChatGPT) continúe este plan.
Estado del documento: **informe histórico de traspaso, actualizado el 11/10/2026 con el resultado de Fases 5–7** (véase la actualización de cierre más abajo).
Rama donde vive este trabajo: `claude/vigilant-hawking-uji8l4` (PR [#118](https://github.com/Plopezm1990/Almacen/pull/118), borrador, **«NO FUSIONAR»**: es el vehículo de la vista previa de QA, no se fusiona a `release`). **Esta rama diverge mucho de `release` ahora mismo — leer §6 antes de nada.**

> **Cómo leerlo.** §0 resumen de una página. §1 reglas que no se pueden romper. §2 el sistema y los entornos. §3 todo lo hecho, fase por fase. §4 y §5 estado exacto de producción y QA (verificado hoy). §6 **aviso importante**: mientras se hacía este trabajo, `release`/producción avanzaron por otra vía (plan ABC) y hay que conciliar antes de publicar. §7 **todo lo que falta**, por bloques. §8 procedimientos reutilizables (incluida una corrección importante sobre cómo se comporta realmente la herramienta de migraciones con sentencias destructivas). §9 riesgos y trampas. §10 decisiones de Pedro. §11 índice de documentos. §12 glosario. §13 primeros pasos para Codex.
>
> **Honestidad sobre las fuentes.** Todo lo marcado «(verificado 10/10)» lo comprobé yo hoy, con consultas de solo lectura (recuentos, huellas md5, identificadores; nunca contenido de producción). Donde no hay evidencia escribo «no consta». No he inventado ninguna cifra.

### Actualización de cierre — 11/10/2026

Esta actualización sustituye los estados pendientes de las secciones 0, 6, 7 y 10 cuando se refieren a la publicación y al ensayo en producción:

- **Conciliación con `release`: hecha.** El PR [#134](https://github.com/Plopezm1990/Almacen/pull/134), basado en el `release` que contenía P3/P3b/P3c y los avances posteriores, se fusionó con el commit `01b72e4264c1c7cd5286c269c5e6c0b65b90091d`. El PR [#118](https://github.com/Plopezm1990/Almacen/pull/118) sigue abierto en borrador y **no debe fusionarse**.
- **Fase 5: hecha.** Las migraciones y la aplicación multiempresa se publicaron en producción; se desplegó la función de creación del propietario y se registró `pedroroger1990@gmail.com` como administrador de Plataforma.
- **Fase 6: operativa.** Producción tiene una empresa cliente real activa, `CHOCOLATERIA SAN GINES`. La comprobación de solo lectura del 11/10 encontró 3 empresas en total, 1 activa y 2 desactivadas, 0 filas de `almacen_kv` sin empresa y 0 movimientos sin empresa.
- **Fase 7: ensayo completado salvo el borrado por plazo de gracia.** Se probaron dos empresas ficticias con primer acceso, cambio de contraseña, local, control sanitario, producto, aislamiento A/B, persistencia, vuelta a A, contexto de navegador nuevo y desactivación/reactivación. A y B están ahora desactivadas y sus datos se conservan.
- **Pendiente único de operación:** el borrado definitivo de A y B está bloqueado hasta el 10/11/2026 por el plazo de gracia de 30 días. La evidencia detallada está en `d01-evidencia-produccion-20261010/F7-DOS-EMPRESAS.md`.
- **Trazabilidad del permiso de F5:** el permiso remoto `20261010191547_plataforma_f5_permiso_lookup_empresa` queda registrado también en `supabase/migrations/20261010191547_plataforma_f5_permiso_lookup_empresa.sql`; la comprobación estática F7 lo excluye porque se promovió en una ventana separada.
- **Decisiones de producto que no bloquean el funcionamiento:** configuración fiscal inicial, sincronización de `empresas`/`configEmpresa` entre dispositivos, exigencia del cambio de contraseña en servidor y retirada de tres funciones heredadas de stock.
- El detalle de esas decisiones y del calendario de cierre está en `docs/plan-empresas/D01_DECISIONES_Y_CIERRE_2026-10-11.md`.
- El procedimiento operativo del borrado está en `docs/plan-empresas/D01_BORRADO_F7_PREPARACION_2026-11-10.md`.

---

## 0. Resumen de una página

1. **Qué pide Pedro (decisión D01 del plan ABC, aquí construida):** L&A Suite pasa a ser un producto **multiempresa** donde **Pedro** (dueño de la plataforma, no de cada empresa) da de alta a las empresas clientes, puede **desactivarlas** y, pasado un plazo de gracia, **borrar todos sus datos**. Producción debe acabar **a cero empresas** y recibir después su primer cliente real.
2. **Dónde estamos.** Construidas y verificadas en QA, con Postgres real y con la pantalla (Cowork): **Fase 1** (administrador de plataforma + alta/baja/reactivación de empresas), **Fase 1b** (función de borde que crea la cuenta del dueño), **Fase 2** (borrado definitivo de una empresa y todos sus datos), **Fase 3** (panel «Plataforma» + contraseña inicial obligatoria), y **Fase 4 completa** (aislamiento de datos por empresa, en cinco paquetes: F4, F4b, F4c, F4d, F4e — ver §3.5). **Nada de esto se ha aplicado en producción.**
3. **Qué falta, en una frase.** Decidir y ejecutar la **Fase 5** (publicar todo esto en producción, con autorización escrita de Pedro), la **Fase 6** (producción a cero + primer cliente real) y la **Fase 7** (ensayo en producción con una empresa de prueba antes del primer cliente) — y, **antes de nada**, conciliar esta rama con `release`, que ha avanzado mucho por la vía del plan ABC mientras se hacía este trabajo (§6).
4. **Reglas de oro** (idénticas a las del plan ABC; ver §1): nada se escribe en producción sin autorización expresa y escrita de Pedro; parar a la primera diferencia; sin gasto nuevo; repositorio público (nada de secretos ni datos); Pedro habla español y quiere pasos de uno en uno; nunca pedir la contraseña de la base de datos; nunca circunvenir la protección de la herramienta de migraciones contra sentencias destructivas.
5. **Trampa principal, corregida aquí respecto al informe de traspaso del plan ABC (4/10):** la herramienta de migraciones de Supabase **no cancela cualquier `ALTER TABLE`/`UPDATE`**. Cancela las llamadas que **incluyen una sentencia `DROP` (de política o de disparador)**. Separando el `DROP POLICY`/`DROP TRIGGER` del resto, **todo lo demás** (añadir columnas, relleno de datos, `CREATE POLICY`, `CREATE TRIGGER`, funciones) se aplica con la herramienta sin que Pedro tenga que tocar el editor SQL. Solo los `DROP` finales los ejecuta él (o Cowork bajo su supervisión). Ver §8.2 para el procedimiento exacto, probado hoy dos veces (F4 y F4e).
6. **Hallazgo importante de hoy, fuera del plan de empresas pero que afecta a la Fase 5:** mientras se construía esto, el plan ABC siguió avanzando en `release`/producción (por otra vía, probablemente Codex). Producción **ya tiene P3/P3b/P3c** (el PR #121 que el informe del 4/10 daba como «sin fusionar» **está fusionado**) y migraciones C01–C12, PM09 y stock D09–D11 que esta rama no conoce. La rama de este plan está **79 commits por detrás** de `release` y **166 por delante** (su propio trabajo). Hay que conciliar antes de la Fase 5 (§6).
7. **Lo primero que haría Codex:** leer §1, §2 y §13; comprobar el estado actual de `release` (puede haber avanzado más desde que se escribió esto); decidir con Pedro si F4/F4e se aplican en producción **antes o junto con** el siguiente paquete ABC que esté en marcha; y preguntar por el orden de la Fase 5/6/7 (§7.M).

---

## 1. Personas, reglas y modelo de autorización

### 1.1 Quién es quién

| Quién | Papel |
|---|---|
| **Pedro** (`Plopezm1990` en GitHub) | Dueño de la plataforma y de la empresa productiva real («Chocolatería San Gines» / «Chocoloyos S.L»). Decide, autoriza, acepta resultados. Habla español. Ejecuta a mano lo que una herramienta no puede (copias de seguridad, `DROP` en el editor SQL). |
| **Codex** (ChatGPT) | Construyó la mayor parte del plan ABC (F0–F7, bloques A/B/C) y sigue avanzándolo en paralelo a este plan (ver §6). Puede no tener las mismas herramientas que Claude (conectores de Supabase/Netlify): **no lo doy por hecho — pregunta a Pedro qué acceso tienes antes de planificar**. |
| **Claude** (Anthropic) | Hizo este plan D01 completo (Fases 0–4e) entre el 9 y el 10/10/2026, y antes cerró el plan ABC F5–F7 y la mejora ALB-PROV/ALB-PROV-2 (ya fusionadas en `release`, PR #127 y #128). |
| **Cowork** | Agente de navegador de Claude. Solo se usa para **mirar y pulsar pantallas** con un prompt estricto, listo para pegar (§8.6). No decide nada. |

### 1.2 Reglas permanentes de Pedro (exactamente como en el plan ABC)

- **Idioma y estilo:** español llano. Para pasos operativos en su ordenador, **un paso por mensaje**. Preguntas con opciones seleccionables, **la recomendada primero**. La **autorización de una escritura en producción la tiene que escribir él con su frase**; una opción marcada no basta.
- **Prompts de Cowork:** siempre completos, listos para pegar.
- **Nunca** pedir ni recibir la contraseña de la base de datos ni pedir a Pedro que pegue contenido de producción. Las comprobaciones de producción son **recuentos, huellas md5 e identificadores**.
- **Sin gasto nuevo** sin su aprobación expresa.
- **Copias de seguridad fuera del repositorio** (es **público**). Nunca secretos, claves ni datos de clientes.
- **No esquivar protecciones** de las herramientas (no ofuscar `DROP`, no dividir una sentencia para que pase desapercibida).
- **Parar a la primera diferencia** con lo esperado y esperar su decisión.

### 1.3 Modelo de autorización para producción

Igual que en el plan ABC (§1.3 de `INFORME_TRASPASO_A_CODEX_2026-10-04.md`): lectura con permiso aparte y limitada a `select`; escritura con una autorización por paquete y frase exacta de Pedro (commit, huellas, fecha/hora); parar a la primera diferencia; marcha atrás pre-autorizada solo para volver al despliegue anterior de Netlify si la app nueva falla; una promoción = un despliegue agrupado.

**En este plan, hasta hoy, las aplicaciones a QA se han hecho así:** Pedro aprueba la fase con una frase corta («Sí, aplicar en QA», «vale aplícalo en QA»), y dentro de esa aprobación cada paso operativo (incluidos los `DROP` finales que la herramienta no acepta) se le entrega explicado y listo para pegar, un paso por mensaje. **Para producción hará falta la hoja de autorización formal**, como en el plan ABC (commit exacto, huellas, copia de seguridad hecha, frase dicha por Pedro presente).

### 1.4 Convenciones del repositorio

Las mismas que el plan ABC (§1.4 de su informe): `release` = producción; ramas y PR por pieza; `[skip netlify]` en commits que no cambian la aplicación; **toda prueba nueva debe registrarse en `tests/ci/manifiesto_clasificacion.json`** (y, si cambian los totales, también en los números fijados dentro de `.github/scripts/validar-manifiesto-ci.mjs` y en `.github/workflows/puerta-ci-release.yml` — ver §8.3, es fácil olvidar uno de los tres sitios); migraciones en `supabase/migrations/<AAAAMMDDHHMMSS>_<nombre>.sql`, aditivas, con comprobación previa (`do $$ … raise exception`) y, cuando sustituyen una función de otro paquete, con **huella md5 exacta** de la versión que reemplazan (§8.4); documentación en `docs/plan-empresas/` (este plan) y `docs/plan-abc/` (el otro). Commits de este plan terminan con:
```
Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01TM7XwiSWhn3pMRFgruDrJ5
```

---

## 2. El sistema y los entornos

Arquitectura, publicación y backend: **igual que describe el plan ABC** (§2.1–2.2 de su informe: `fuente.js` como bundle recuperado, Netlify con `netlify.toml`/`build-netlify-publish.mjs`, detección QA/producción **por la URL** — solo `deploy-preview-N--chic-entremet-9107cf.netlify.app` es QA, cualquier otra dirección es producción —, RPC `SECURITY DEFINER` con `search_path=''`, idempotencia por `operation_id`, tablas sin acceso directo). No lo repito aquí salvo lo que añade este plan:

### 2.1 Qué añade este plan sobre la arquitectura general

- **Tabla `public.empresas`** (id, nombre, activo, `created_at`) y **`public.locales`** (empresa_id, nombre, activo) — ya existían del Plan Maestro (PM29/PM33); este plan las usa como base de la multiempresa.
- **Tabla `public.membresias_usuario`** (user_id, empresa_id, local_id, todos_locales, rol, activo) — relaciona cuentas con empresas y su rol **en esa empresa**. Una cuenta puede tener membresía en varias empresas (ver «una cuenta = una empresa activa», §9).
- **Esquema `private`** con las funciones de la plataforma: `plataforma_estado`, `plataforma_registrar_admin`, `plataforma_dar_de_alta_empresa`, `plataforma_asignar_propietario`, `plataforma_desactivar_empresa`, `plataforma_reactivar_empresa`, `plataforma_eliminar_empresa_definitivamente` (Fase 2), y toda la familia `plataforma_kv_*`/`plataforma_mov_*`/`plataforma_perfil_gestionable`/`plataforma_empresa_del_llamante` de la Fase 4 (§3.5).
- **Pantalla «Plataforma»** (`plataforma-panel.js`), visible solo para el administrador de la plataforma, y el flujo de **contraseña inicial obligatoria** (Fase 3).
- **Función de borde `plataforma-crear-propietario`** (Fase 1b): crea la cuenta de acceso del dueño de una empresa cliente nueva.
- **`reset-pruebas-preview.js` / `restablecer-contrasena.js`**: utilidades de la vista previa de QA (bloquean salidas a producción desde el preview, y permiten restablecer contraseñas de prueba).

### 2.2 Entornos (idénticos a los del plan ABC)

| Entorno | Identificador | Notas |
|---|---|---|
| **Producción** (Supabase) | `flqercbgpgmmfaakrwkc` | Sin copias automáticas (plan gratuito). Un local productivo activo. |
| **QA** (Supabase) | `qjqorixtkilwsndqayyx` | Datos ficticios. Este plan la ha usado intensamente (ver §5). |
| **Netlify** | `chic-entremet-9107cf`, rama `release` | Vista previa de este plan: `https://deploy-preview-118--chic-entremet-9107cf.netlify.app`. **Cuidado:** una vista previa «congelada» de un despliegue concreto (del tipo `https://<hash-de-despliegue>--chic-entremet-9107cf.netlify.app`) sirve siempre el commit con el que se generó; si se sigue trabajando en la rama hay que pedir la URL del despliegue **nuevo**, no reutilizar la antigua (§9). |

### 2.3 Ramas y PR (a 10/10, por la tarde — **puede haber cambiado**)

| Rama / PR | Estado a 10/10 |
|---|---|
| `release` | Producción. En movimiento activo por el plan ABC (ver §6). Última cabeza vista: `7640042` (tras PR #128 ALB-PROV-2). |
| PR [#118](https://github.com/Plopezm1990/Almacen/pull/118) (`claude/vigilant-hawking-uji8l4`, este informe) | Borrador «NO FUSIONAR»: vehículo de la vista previa de QA de este plan. Diverge mucho de `release` (§6). |
| PR #121 (P3/P3b/P3c) | **Fusionado.** Antes se describía como «borrador, sin fusionar»; ya no es así. |
| PR #127, #128 (ALB-PROV, ALB-PROV-2) | **Fusionados** (trabajo previo de Claude en esta misma sesión, antes del plan de empresas). |

### 2.4 CI y calidad

- **Manifiesto** `tests/ci/manifiesto_clasificacion.json`: **255 archivos, 238 activos** (211 Node, 23 Postgres, 1 PGlite, 3 pila completa). Última prueba añadida: `tests/plataforma/db/p10-perfiles-movimientos-push-por-empresa-contract.mjs` (F4e).
- **Puerta general** `puerta-ci-release.yml` + `gate-final`: sus números fijados también se actualizaron a 238/238 (antes 237/237) y 23 Postgres (antes 22) — **recuerda tocar los tres sitios** si añades otra prueba (§1.4).
- Batería completa comprobada hoy en local: **211/211 Node, 23/23 Postgres**, árbol limpio tras la ejecución.

---

## 3. Lo que se ha hecho (Fases 0–4e, con pruebas y aplicación en QA)

### 3.1 Fase 0 — Decisiones

- Empezar por QA.
- Los datos actuales de producción son de prueba; no hace falta conservarlos.
- Plazo de gracia antes del borrado definitivo: **30 días** (configurable; en las pruebas de QA se baja a 0 solo durante la prueba y se restaura).
- El dueño de cada empresa cliente recibe una **contraseña inicial que le da Pedro** (no se autorregistra).

### 3.2 Fase 1 — Administrador de plataforma + alta, baja y reactivación de empresas

- Migración `20261009120000_plataforma_f1_administrador_y_empresas.sql`: funciones `private.plataforma_estado`, `plataforma_registrar_admin`, `plataforma_dar_de_alta_empresa` (empresa + local + membresía todo en una transacción), `plataforma_desactivar_empresa` (desactiva empresa, locales y membresías; **empieza a contar el plazo de gracia**), `plataforma_reactivar_empresa`.
- **Aplicada y verificada en QA** (`FASE1_RESULTADO_QA_2026-10-09.md`): prueba de 19 pasos con Cowork y la sesión real de `owner.a@qa.invalid`, los 19 sin diferencias (alta, contraseña débil rechazada, correo duplicado, empresa inexistente, el dueño no es administrador, baja, reactivación…). Quedó una empresa de prueba (`empresa-5ed41d21a3b3b7f8`, «QA Cliente Prueba F1…») reservada para ensayar el borrado de la Fase 2.
- **Administrador registrado solo en QA** (`owner.a@qa.invalid`). **En producción no hay ningún administrador de plataforma registrado todavía** (pendiente de la Fase 5/6, con la cuenta **real** de Pedro).

### 3.3 Fase 1b — Cuenta del dueño de una empresa cliente nueva

- `supabase/functions/plataforma-crear-propietario/index.ts` + `supabase/functions/_shared/plataforma-propietario.js`: comprueba la sesión, comprueba **en el servidor** que quien llama es administrador, valida la petición, comprueba que la empresa existe y está activa, crea la cuenta en Auth (`email_confirm`, `user_metadata.debe_cambiar_contrasena = true`), llama a `plataforma_asignar_propietario` (que vuelve a comprobar el permiso) y, si algo falla a medio camino, **deshace** la cuenta creada.
- **Desplegada solo en QA** (autorizado por Pedro el 9/10), versión 1, `verify_jwt=true`. Contenido vivo verificado igual al del repositorio (huellas `index.ts` y `_shared/plataforma-propietario.js`). **No desplegada en producción.**
- Prueba: `tests/plataforma/p02-crear-propietario-contract.mjs`, 5 mutantes y los 5 detectados; batería Node completa 205/205 en su momento.
- **Límite conocido:** `debe_cambiar_contrasena` todavía no lo exige ninguna pantalla por sí solo hasta la Fase 3 (que lo completa).

### 3.4 Fase 2 — Borrado definitivo de una empresa y todos sus datos

- Función de purga en el orden correcto (hijos antes que padres), con **excepción documentada** para las tablas que no se pueden atribuir a una empresa (`almacen_kv` sin etiqueta, `movimientos_registro`/`fichajes_registro` en producción — se quedan fuera hasta la Fase 4), exportación previa (un único JSON) y acta de borrado.
- Migración `20261009130000_plataforma_f2_eliminar_empresa.sql`. **Prueba de cobertura que falla si se añade una tabla con `empresa_id` y no se incluye en el borrado** (importante: hay que volver a pasarla si el plan ABC añade tablas nuevas con `empresa_id` — y ya ha añadido varias desde que se escribió, ver §6).
- **Aplicada y verificada en QA**, con un borrado real de la empresa de prueba que dejó la Fase 1 (`FASE2_RESULTADO_QA_2026-10-09.md`).
- **Límite conocido:** el plazo de gracia de producción (30 días) no se puede acortar sin autorización escrita; las dos empresas desactivadas de producción no tienen baja registrada con la función nueva (se registrará su fecha en cuanto se desactiven con ella, en la Fase 6).

### 3.5 Fase 3 — Panel «Plataforma» y contraseña inicial obligatoria

- Pantalla nueva (`plataforma-panel.js`) solo para el administrador: lista de empresas, alta, baja, reactivación, copia de export. El dueño de cada empresa no ve este panel; sigue gestionando su propio programa.
- **Contraseña inicial obligatoria:** al primer inicio de sesión con `debe_cambiar_contrasena=true`, la pantalla obliga a cambiarla antes de seguir.
- **Hallazgo propio de la prueba (corregido en el camino, primer paso de la Fase 4):** la copia local del navegador (`localStorage`) se heredaba entre cuentas de distintas empresas en el mismo equipo — productos de la empresa A aparecían en la vista de la empresa B. Arreglado: cada cuenta tiene ahora su propia copia local, con migración de las claves existentes.
- **Aplicada y verificada en QA** de punta a punta, dos rondas con Cowork (la segunda, repetición parcial tras encontrar la causa real de un fallo de recarga entre pantallas) (`FASE3_RESULTADO_QA_2026-10-09.md`, `PRUEBA_COWORK_FASE3_QA.md`, `…_REPETICION.md`).
- **Límite conocido:** que el dueño cambie la contraseña es una exigencia de **pantalla**, no del servidor; alguien con conocimientos técnicos podría saltarla llamando a la API a mano (solo se perjudicaría a sí mismo). Blindarlo en el servidor es una mejora pendiente, no decidida.

### 3.6 Fase 4 — Aislamiento de datos por empresa (en cinco paquetes)

Esta es la parte más grande y más probada del plan. El problema de fondo: varias tablas y colecciones del programa **no separaban por empresa**, así que con dos empresas clientes reales se mezclarían o se pisarían datos. Se resolvió en cinco paquetes, cada uno con su migración, su contrato contra Postgres real (con mutaciones provocadas a propósito para comprobar que las pruebas detectan fallos reales) y, los más visibles, con pruebas de pantalla por Cowork.

#### F4 — Colecciones comunes de `almacen_kv` por empresa
- **Problema:** `public.almacen_kv` (empleados, pedidos, conteos, locales, `productos`…) tenía clave primaria **solo `key`**: una fila por colección para **todo el programa**. Con dos empresas, la segunda no podía crear su fila `empleados` (la clave ya la usaba la primera), y las funciones que escribían `where key='productos'` tocarían la fila de todas las empresas a la vez.
- **Migración** `20261009140000_plataforma_f4_colecciones_por_empresa.sql`: las filas sin empresa se etiquetan con una empresa ficticia (`__sin_empresa__`, a la que nadie pertenece: se conservan pero quedan invisibles) en vez de borrarse; `empresa_id` pasa a obligatorio y la clave primaria pasa a `(empresa_id, key)` (el cliente no cambia: su `upsert({key, value})` sigue usando la clave primaria por defecto, y un disparador nuevo rellena la empresa); reglas nuevas por empresa y por cargo (misma tabla de permisos que ya tenía producción, pero mirando también la empresa); un disparador decide la empresa de las filas nuevas (del JSON, o la única empresa de la cuenta, o falla cerrado); las dos funciones del servidor que escribían la lista `productos` sin filtrar por empresa (`abc_catalogo_guardar_productos` de P3b, `abc_productos_guardar_lista` de P3c) se parchean con **sustitución de texto comprobada contra su huella exacta** (si el texto no coincide, la migración se niega; si la función no existe en ese entorno, no se toca nada — ver §8.4).
- **Aplicada y verificada en QA**: prueba Postgres real (`tests/plataforma/db/p09-colecciones-por-empresa-contract.mjs`) con las dos formas (QA y producción), decenas de mutaciones provocadas y detectadas, y prueba con la pantalla con dos empresas nuevas sin ninguna diferencia (`PRUEBA_COWORK_FASE4_DOS_EMPRESAS.md`).

#### F4b — Cada empresa nace con su lista de `productos` vacía
- **Problema:** la RPC `abc_productos_guardar_lista` (P3c) exige que la fila `productos` de la empresa ya exista; una empresa nueva no la tenía, y el disparador «productos solo por RPC» impedía crearla desde la API. El cliente trataba la respuesta como un fallo que reintenta sin fin.
- **Migración** `20261009150000_plataforma_f4b_lista_productos_inicial.sql`: disparador `AFTER INSERT` en `empresas` que crea `(empresa, 'productos', [])`, más relleno de las empresas existentes sin esa fila. Solo `create or replace` y `on conflict do nothing`.
- **Verificada en QA** con Postgres real y con la pantalla.

#### F4c — La lista se guarda aunque el local no tenga contexto fiscal
- **Decisión de Pedro** («que la lista se guarde aunque falte lo fiscal»): una empresa dada de alta por la plataforma no tiene entidad fiscal ni moneda configuradas (no hay pantalla para crearlas todavía), y sin eso el catálogo del TPV (P3b) rechazaba **toda la transacción**, incluida la lista de productos.
- **Migración** `20261009160000_plataforma_f4c_lista_sin_contexto_fiscal.sql`: si, y solo si, el catálogo falla con `catalogo_contexto_fiscal_ausente`, se salta el catálogo de ese local y se conserva la lista (`catalogo_pendiente_contexto_fiscal=true` en la respuesta). Cualquier otro error sigue abortando todo.
- **Verificada en QA** con Postgres real y con la pantalla (de punta a punta, con el cliente real de P3c).

#### F4d — Una empresa dada de baja no cuenta para elegir la empresa de una cuenta
- **Hallazgo real de una prueba con Cowork** (no una hipótesis): una cuenta con membresía activa en una empresa viva y en una empresa **dada de baja** (la baja normal desactiva las membresías, pero esta era de antes) hacía que el servidor viera «dos empresas» y se negara a guardar (cartel rojo «revisa el acceso»). **Producción tiene exactamente esta forma** (3 empresas, 1 activa, una cuenta con membresía en las 3).
- **Migración** `20261009170000_plataforma_f4d_empresas_vigentes.sql`: `create or replace` de las tres funciones de F4 que miran membresías, para que solo cuenten empresas con `activo=true`. No cambia datos ni políticas.
- **Verificada en QA** con Postgres real (incluida la forma exacta de producción) y con `owner.a` real (prueba deshecha sola, sin dejar nada). 10 mutaciones: 7 detectadas, 3 equivalentes (repiten permisos que `create or replace` ya conserva).

#### F4e — Perfiles, movimientos y avisos push separados por empresa
- **Hallazgo de hoy, leyendo solo estructura y reglas de producción:** fuera de `almacen_kv`, tres tablas más no separaban empresas en producción: `public.perfiles` (cualquier Propietario leía y cambiaba el cargo/estado de cuentas de **cualquier** empresa), `public.movimientos_registro` (sin `empresa_id`; cualquier perfil activo leía e insertaba movimientos de todas las empresas; cualquier Propietario los borraba), `public.suscripciones_push` (las filas sin dueño las veía y borraba cualquier Propietario). Además, dos disparadores antiguos de producción dejaban de funcionar con dos empresas con la misma clave en `almacen_kv` (error real de Postgres: «more than one row returned by a subquery»).
- **Migración** `20261009180000_plataforma_f4e_perfiles_movimientos_push_por_empresa.sql`: añade `empresa_id`/`local_id` a `movimientos_registro` (QA ya los tenía) con relleno por el dato, por el local o por la única empresa de la cuenta; reglas nuevas en las tres tablas con el mismo límite de empresa que F4/F4d; sustituye los dos disparadores antiguos por la misma función con el filtro añadido, **otra vez por huella exacta** de la versión de producción.
- **Probada** (`tests/plataforma/db/p10-perfiles-movimientos-push-por-empresa-contract.mjs`) con la forma de producción y la de QA, antes/después. **29 mutaciones: 27 detectadas, 2 equivalentes** — y esto se comprobó de verdad, no se dio por supuesto: quitar la condición de `WITH CHECK` de la regla de actualizar `perfiles`, o la de propiedad de la regla de borrar `suscripciones_push`, no abre ningún hueco porque **PostgreSQL, bajo RLS, también exige que la fila resultante de un `UPDATE` (o la candidata de un `DELETE`) cumpla la regla de `SELECT` de la tabla, aunque la consulta no lleve `RETURNING`**. Lo comprobé con una tabla de prueba aislada antes de aceptarlo como mutación equivalente (detalle reutilizable en §8.6).
- **Aplicada y verificada en QA hoy** (con la autorización «vale aplícalo en QA»): las funciones, el relleno de columnas, el disparador nuevo y las 9 reglas se aplicaron con la herramienta; solo 4 `DROP POLICY` de reglas ya sustituidas quedaron fuera de su alcance y los ejecutó Pedro en el editor SQL (§8.2). Huellas de las 4 funciones privadas y de las 9 reglas **idénticas** a la copia local. Prueba real con `owner.a` (deshecha con una excepción, sin dejar nada): ve solo los perfiles y movimientos de su empresa activa, un movimiento nuevo se etiqueta solo con ella, y sigue pudiendo actualizar su propio perfil.

**Con F4e, la Fase 4 (aislamiento por empresa) queda completa en QA.**

---

## 4. Estado de producción (verificado 10/10, por la tarde — solo lectura)

| Qué | Cuántos / cómo |
|---|---|
| Empresas | 3: **1 activa** («Chocolateria San Gines», id `empresa-546bc85421e87d88`), 2 desactivadas (de pruebas anteriores, sin baja registrada con la función nueva) |
| Locales | 4 (1 activo) |
| Membresías | 3, todas «Propietario», **todas activas** (la misma cuenta, una por empresa — exactamente la forma que motivó F4d) |
| Perfiles | 1 |
| `almacen_kv` | 7 filas, **clave primaria todavía `(key)` sola** (F4 **no aplicada**): `catalogoProv`, `conteos`, `disenoMenu`, `historialRespaldos`, `productos`, `temaOscuro`, `traspasos`. **La fila `productos` ya tiene `empresa_id`** = la empresa activa (lo hizo la migración de «titularidad» de P3c, que **sí** está en producción — ver §6) y sus 4 artículos llevan `empresaId`/`localId` en el JSON. Las otras 6 filas no tienen empresa. |
| Reglas de `almacen_kv`, `perfiles`, `movimientos_registro`, `suscripciones_push` | **Las antiguas**, sin ningún cambio de este plan: `acceso por rol y clave - *`, `perfiles - leer propio o propietario`/`perfiles - propietario actualiza`, `movimientos - leer/insertar/borrar`, `push - propia *`. Coinciden exactamente con lo que las comprobaciones previas de F4/F4e esperan encontrar. |
| `movimientos_registro` | 3 filas. **Sin columnas `empresa_id`/`local_id`** (las añade F4e). |
| `fichajes_registro`, `suscripciones_push` | 0 filas cada una. |
| P3/P3b/P3c (del plan ABC) | **Ya en producción**: `abc_catalogo_guardar_productos`, `abc_productos_guardar_lista` y el disparador `abc_productos_solo_rpc` existen y funcionan; la fila `productos` ya tiene empresa (ver arriba). Esto es **nuevo** desde el último informe de traspaso del plan ABC (4/10), que lo daba como «sin fusionar» — ver §6. |
| Funciones candidatas a retirar (no urgente) | `descontar_stock`, `descontar_stock_carrito`, `anular_venta_tpv`: siguen escribiendo `where key='productos'` sin filtrar por empresa, pero **ni `authenticated` ni `anon` pueden ejecutarlas y ninguna otra función las llama** (comprobado hoy): no son un riesgo real hoy, pero convendría retirarlas en la Fase 6 para no dejar código muerto peligroso si algún día alguien les da permiso por error. |
| Administrador de plataforma | **Ninguno registrado.** |
| Edge functions | 14 (ninguna de este plan; `plataforma-crear-propietario` no está desplegada aquí). |

**Nada de la Fase 1–4 (ni sus migraciones `plataforma_*`) está aplicado en producción.**

---

## 5. Estado de QA (verificado 10/10, por la tarde)

| Qué | Cuántos |
|---|---|
| Empresas | 8: `QA-EMP-A` y `QA-EMP-B` (fixtures originales; B inactiva), `QA F3 Cliente 2` (inactiva, resto de prueba), `QA F3 Cliente 3`, `QA F3 Cliente 4`, `QA F4 Cliente 1`, `QA F4 Cliente 2`, `QA F4 Cliente 3` (estas 5 últimas activas, creadas durante las pruebas con Cowork de las Fases 3 y 4) |
| Membresías | 15 (12 activas) |
| Perfiles | 14 |
| `almacen_kv` | 45 filas; **7 etiquetadas `__sin_empresa__`** (los fixtures `qa_pm04:*` originales, invisibles e intactos) |
| `movimientos_registro` | **1003 filas**, todas con empresa (0 sin empresa) — acumuladas por las pruebas automáticas y de pantalla a lo largo de todo el plan; no es un problema, pero conviene saber que QA ya no está «limpio» |
| `suscripciones_push` | 0 |
| Edge functions | 9, incluida **`plataforma-crear-propietario` (versión 1, desplegada)** |
| Administrador de plataforma | `owner.a@qa.invalid` (cuenta ficticia) |

**Todas las migraciones `plataforma_f1…f4e` están aplicadas** (comprobado por huellas, no solo por la lista de migraciones — algunas partes se aplicaron por la herramienta y los `DROP` finales los ejecutó Pedro en el editor SQL, así que **no todas aparecen en `supabase_migrations.schema_migrations`** con su nombre completo; verificar siempre por huella, como en el plan ABC, §6.4 de su informe).

**Limpieza pendiente, no urgente:** antes del ensayo de la Fase 7 convendría decidir con Pedro qué hacer con las 6 empresas de prueba creadas durante las Fases 3/4 (`QA F3 Cliente 2/3/4`, `QA F4 Cliente 1/2/3`) y el volumen acumulado en `movimientos_registro`. No estorban a nada hoy.

---

## 6. Aviso importante: `release`/producción avanzaron por otra vía mientras se hacía este plan

Este plan se construyó **solo en QA**, sin tocar `release` salvo con documentación (`[skip netlify]`). Mientras tanto, el **plan ABC** siguió avanzando — probablemente por Codex, no consta quién exactamente — y `release` (y por tanto producción) se ha movido mucho:

- **`release` está 79 commits por delante** del punto donde arrancó esta rama, y esta rama tiene **166 commits propios** que `release` no tiene (su propio trabajo: Fases 0–4e de este plan, más algunos commits de documentación del plan ABC anteriores).
- **Lo más importante:** el PR #121 («publicar P3/P3b/P3c y aviso de caja»), que el informe de traspaso del plan ABC del 4/10 describía como **«borrador, sin fusionar»**, está **fusionado**, y sus tres migraciones (`abc_p3c_concurrencia_productos`, `abc_p3c_titularidad_productos`, `abc_p3c_lista_confirmada`) **ya están aplicadas en producción**. Esto es una **buena noticia** para la Fase 5: la condición previa que el plan de empresas exigía («P3c debe aplicarse antes que F4, para que la fila `productos` ya tenga empresa») **ya se cumple sola**.
- `release` también tiene migraciones nuevas que esta rama no conoce: `abc_f5_c03_arqueo_sesion`, `abc_f5_pm09_reconcile_prod_baseline`, `c01_listar_responsables_caja`, `c03_arqueo_servidor`, `abc_f7_c12_reconciliation_revision`, `abc_f7_c12_session_scope`, `abc_d09_d11_stock_order_integration`, `abc_d10_legacy_refund_guard` (las dos últimas, del **10/10**, muy recientes). **Comprobado hoy:** ninguna de las ocho toca `almacen_kv`, `movimientos_registro` ni `suscripciones_push` (solo una lee `perfiles` en una consulta, sin tocar su estructura ni sus reglas). **Riesgo de conflicto estructural con F4/F4e: bajo**, pero hay que volver a comprobarlo justo antes de aplicar nada, porque `release` sigue moviéndose.
- Las mejoras `ALB-PROV`/`ALB-PROV-2` (detección automática de proveedor desde la foto del albarán) que Claude cerró **antes** de empezar este plan de empresas **ya están fusionadas** (PR #127, #128): si Codex las ve en `release` y no las reconoce, son de esta misma sesión, no del plan ABC.

**Qué hacer con esto (decisión de Pedro, no mía):**
1. Antes de la Fase 5, **releer el estado real de `release`** (puede haber cambiado otra vez) y decidir si se trae ese trabajo a esta rama (rebase/merge) o si se prepara un PR nuevo de empresas **directamente sobre `release` actual** en vez de sobre esta rama vieja.
2. Repetir, sobre el `release` del momento, las comprobaciones previas de F4/F4b/F4c/F4d/F4e (huellas de las funciones que cada una sustituye) **antes** de autorizar nada, porque el texto exacto de `abc_catalogo_guardar_productos`/`abc_productos_guardar_lista` en producción puede haber cambiado desde que se escribieron las migraciones.
3. **No asumir que P3c sigue pendiente**: ya está. Hay que **actualizar la hoja de orden** del plan (ahora mismo todavía dice «aplicar P3c antes que F4» como si P3c estuviera por venir).

---

## 7. Lo que falta (todo, por bloques)

> **Nota de actualización (11/10/2026):** esta tabla conserva el inventario original de pendientes. La conciliación, publicación y ensayo de producción que figuraban como P ya están resueltos según la actualización de cierre al principio del documento. El único pendiente operativo de Fases 5–7 es el borrado de las dos empresas ficticias cuando termine su plazo de gracia el 10/11/2026; las decisiones de producto y la trazabilidad de la migración de permisos quedan como mantenimiento posterior.

Leyenda: **H** hecho · **P** pendiente · **B** bloqueado por una decisión de Pedro · **N** no consta.

### 7.A Reconciliar con `release` (nuevo, prioritario)

| # | Qué | Estado |
|---|---|---|
| A1 | Releer `release` actual y decidir cómo traer este plan sobre él (rebase, merge, o PR nuevo) | P — ver §6 |
| A2 | Repetir las comprobaciones de huella de F4/F4b/F4c/F4e contra el `release` del momento | P |
| A3 | Actualizar la documentación del plan («P3c antes que F4») ahora que P3c ya está en producción | P |
| A4 | Comprobar que ninguna migración nueva del plan ABC desde el 5/10 ha tocado `almacen_kv`, `movimientos_registro`, `perfiles` o `suscripciones_push` (hoy: no, pero puede haber más desde entonces) | P |

### 7.B Fase 5 — Publicar en producción (necesita autorización escrita de Pedro)

1. Preparar un candidato exacto (commit congelado) con las cinco migraciones de la Fase 4 (F4, F4b, F4c, F4d, F4e) **en ese orden**, más las de las Fases 1, 1b y 2, más la aplicación (pantalla «Plataforma», contraseña inicial, puentes del cliente).
2. Foto de solo lectura de producción (igual que hizo el plan ABC, §8.1 de su informe) **repetida** sobre el estado actual.
3. Copia de seguridad manual (producción sigue sin copias automáticas).
4. Hoja de autorización única, con la frase exacta de Pedro, commit y huellas.
5. Aplicar: la parte de funciones/relleno/reglas por la herramienta donde se pueda (§8.2); los `DROP` finales (reemplazo de las reglas antiguas de `almacen_kv`, `perfiles`, `movimientos_registro`, `suscripciones_push`) los ejecuta Pedro o Cowork en el editor SQL, **desde el ordenador, nunca desde el móvil** (la misma lección del plan ABC, §9.2 de su informe — no comprobado aquí pero es prudente asumir que sigue valiendo).
6. Desplegar la aplicación **a la vez** (servidor antes que aplicación nunca deja un hueco porque los puentes del cliente se desactivan en silencio si la función no existe todavía).
7. Registrar la cuenta **real** de Pedro como administrador de la plataforma (`private.plataforma_registrar_admin('<id>')`).
8. Desplegar la función de borde `plataforma-crear-propietario` en producción.
9. Verificar con el mismo patrón de prueba real-y-deshecha usado en QA (§8.5).

### 7.C Fase 6 — Producción a cero y primer cliente real (necesita autorización escrita)

- Decidir qué hacer con: la empresa activa real y sus datos (¿se conserva como primera «empresa cliente» o se empieza de verdad desde cero?), las 2 empresas desactivadas, las 7 filas sueltas de `almacen_kv` sin empresa, los 3 movimientos sin empresa, las 3 funciones candidatas a retirar (§4).
- Dar de alta a la primera empresa cliente real con el flujo completo (Fase 1 + 1b).
- Decidir y ejecutar, si procede, la retirada de las funciones heredadas sin uso (`descontar_stock`, `descontar_stock_carrito`, `anular_venta_tpv`).

### 7.D Fase 7 — Ensayo en producción con una empresa de prueba

- Repetir, en producción y con una empresa ficticia, el mismo tipo de prueba de pantalla que ya se hizo en QA para las Fases 1, 3, 4b (dos empresas) y 4d/4e (empresa dada de baja), **antes** de dar de alta al primer cliente real.
- Borrar la empresa de ensayo con la Fase 2 al terminar.

### 7.E Decisiones abiertas de Pedro (del propio plan de empresas, no del ABC)

| Decisión | Estado |
|---|---|
| Configuración fiscal automática al dar de alta una empresa (hoy el catálogo del TPV de una empresa nueva se queda sin sincronizar hasta que exista entidad fiscal + moneda; no hay pantalla para crearla) | Abierta — se decidió «mientras tanto, que la lista se guarde igual» (F4c), pero la configuración fiscal en sí sigue sin diseñar |
| Sincronización entre dispositivos de `empresas`/`configEmpresa` (hoy no sincronizan, igual que en producción hoy; no es una regresión de este plan) | Abierta |
| Blindar en el servidor la exigencia de cambiar la contraseña inicial (hoy solo la pantalla la exige) | Abierta, sin decidir |
| Opción B del alta: ¿debería la pantalla de alta de empresa pedir ya la configuración fiscal básica? | Abierta |
| Limpieza de las empresas de prueba de QA antes de la Fase 7 | Abierta (administrativo, no bloquea nada) |

### 7.F Cabos sueltos menores (no bloquean nada, documentar y decidir cuándo convenga)

1. **Formato antiguo de `conteos` en QA:** 460 conteos de prueba de `QA-EMP-A` (marca `_pm12Servidor`) no tienen el campo `completado`; el cliente los lee como «conteo abierto» y muestra un aviso ámbar de almacén congelado que no es un fallo del programa, es un dato de prueba con forma antigua. Si se quiere, limpiarlo en QA (no toca producción).
2. **P3c rechaza re-guardar productos antiguos sin `empresaId` en el JSON:** los 30 productos antiguos de `QA-EMP-A` (antes de P3c) no se pueden volver a guardar desde la pantalla (`abc_productos_cambio_contexto_no_admitido`). **No es un problema para producción**: comprobado hoy que los 4 artículos reales de producción ya llevan `empresaId`/`localId` en el JSON (la migración de «titularidad» de P3c los puso al día). Solo afecta a datos de prueba de QA anteriores a P3c.
3. **Caché del navegador y «No se ha podido cargar el programa»:** «borrar los datos del sitio» (cookies, `localStorage`, IndexedDB) **no** borra la caché HTTP ni el service worker; si el navegador tenía una copia vieja del programa, sigue sirviéndola. Solución que funcionó: usar la URL de un **despliegue nuevo** (que no tiene nada en caché) en vez de pedir «borrar datos» sobre la URL vieja. Ver §8.7 para el prompt de Cowork actualizado con esta lección.
4. **Marca de «colección denegada» de 6 horas** (`almacen__denegados`, cliente): tras arreglar un permiso en el servidor, el cliente puede seguir mostrando «N colecciones solo en este equipo» hasta 6 horas si ya había marcado esa clave como denegada en una prueba anterior. No es un fallo nuevo; hay que tenerlo en cuenta al interpretar una prueba repetida poco después de aplicar un arreglo.
5. **Una cuenta = una empresa activa**, declarado como límite en F4/F4d/F4e: una cuenta con membresía activa en **dos empresas activas a la vez** no puede guardar colecciones comunes sin indicar la empresa explícitamente (falla cerrado, no mezclado). Es intencionado; si algún día se quiere permitir «una persona en dos empresas», hace falta diseño nuevo (pedir la empresa en cada pantalla, o un selector).

---

## 8. Procedimientos reutilizables

### 8.1 Foto de solo lectura y verificación por huella

Igual que el plan ABC (§6.4, §8.1 de su informe): comparar md5 de funciones (`md5(replace(prosrc, chr(13), ''))`), de reglas (`md5(coalesce(pg_get_expr(polqual,...),'-')||'|'||coalesce(pg_get_expr(polwithcheck,...),'-'))`) y de disparadores, siempre **por nombre**, nunca por la marca de versión que asigna la herramienta.

### 8.2 Cómo se comporta realmente la herramienta de migraciones con sentencias destructivas (corrección sobre el informe del plan ABC)

El informe del 4/10 decía que la herramienta «rechaza las migraciones con la palabra `drop`» en general. **Más preciso, comprobado dos veces este plan (F4 y F4e):**

- Si en **una misma llamada** mezclas sentencias normales con un `DROP POLICY`/`DROP TRIGGER`/`DROP CONSTRAINT`, la herramienta cancela **toda la llamada** (`{"status":"cancelled"}`, o un tiempo agotado de 60 s sin ningún efecto).
- Si **separas** el `DROP` en su propia llamada y mandas el resto por su cuenta, **todo lo demás se aplica sin problema**, incluido lo que uno esperaría destructivo: `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, un `UPDATE ... SET` que rellena miles de filas, `CREATE POLICY`, `CREATE TRIGGER` (sin un `DROP TRIGGER` delante), y bloques `DO $$ ... EXECUTE 'CREATE OR REPLACE FUNCTION ...'`.
- Solo el propio `DROP POLICY`/`DROP TRIGGER` (incluso con `IF EXISTS`) se queda colgado (tiempo agotado) sin aplicar nada.

**Procedimiento recomendado para aplicar una migración con `DROP` dentro:**
1. Partir la migración en trozos por `apply_migration`, en el orden del archivo: comprobación previa → estructura/relleno de datos → funciones/privilegios → `CREATE POLICY`/`CREATE TRIGGER` de las reglas **nuevas** (sin tocar las viejas todavía) → sustitución de funciones antiguas por huella → comprobación final (esta última fallará mientras las reglas viejas sigan ahí, así que se deja para el final).
2. Verificar con una consulta de solo lectura qué reglas quedan (nuevas **y** viejas convivirán un rato: comprobar que la regla nueva ya es un superconjunto de la vieja, para que no se abra ningún hueco mientras tanto).
3. Entregar a Pedro (o Cowork) **solo** las líneas `DROP POLICY IF EXISTS …`/`DROP TRIGGER IF EXISTS …` que falten, listas para pegar en el editor SQL.
4. En cuanto confirme que las ha ejecutado, verificar que las reglas viejas ya no están y que las huellas de todo (funciones y reglas) coinciden con la copia local.

### 8.3 Dónde se fijan los números de la batería de pruebas (para no olvidar ninguno)

Al añadir una prueba nueva al manifiesto hay que tocar **tres** sitios, no solo uno:
1. `tests/ci/manifiesto_clasificacion.json` (la entrada nueva y los totales `expected_counts`/`expected_environment_counts`).
2. `.github/scripts/validar-manifiesto-ci.mjs` (las constantes `INVENTORY`, `COUNTS`, `ENVIRONMENT_COUNTS` **están repetidas en el código**, no se leen del manifiesto).
3. `.github/workflows/puerta-ci-release.yml` (el título del flujo y varias comprobaciones `-ne 237`/`"= 22"` tienen el número **escrito a mano** en varios sitios).

### 8.4 Sustitución de texto comprobada contra huella exacta (patrón reutilizable)

Cuando una migración tiene que cambiar una función que **pertenece a otro paquete** (aquí: las de P3b/P3c, y los dos disparadores antiguos de producción), el patrón usado en este plan es:
1. Leer la función real con `pg_get_functiondef`.
2. Comparar su md5 contra la huella exacta conocida (la de producción, o la de QA si son distintas formas).
3. Si coincide, generar el texto nuevo sustituyendo **fragmentos literales exactos** (cada uno debe aparecer **exactamente una vez**; si aparece 0 o más de una vez, la migración se niega con un mensaje claro) y ejecutar `CREATE OR REPLACE FUNCTION` con el resultado.
4. Si la función no existe en ese entorno, no hacer nada (no inventar la función de otro paquete).
5. Si ya tiene el parche aplicado (se detecta por un fragmento del texto nuevo), no hacer nada (idempotente).

Las migraciones `20261009140000` (F4), `20261009160000` (F4c) y `20261009180000` (F4e) son los tres ejemplos completos en el repositorio.

### 8.5 Comprobación real y deshecha sola, dentro de una transacción (sin dejar residuo)

Para probar con una cuenta real de QA sin dejar ningún dato de prueba:
```sql
do $t$
declare
  r jsonb := '{}'::jsonb;
begin
  perform set_config('request.jwt.claims', json_build_object('sub','<uuid de la cuenta>','role','authenticated')::text, true);
  set local role authenticated;
  -- ... las comprobaciones, acumulando resultados en r ...
  raise exception 'RESULTADO %', r;  -- fuerza el deshacer de TODO, incluida cualquier escritura de prueba
end
$t$;
```
El mensaje de error (visto en la respuesta de la herramienta) lleva el JSON con todos los resultados. Usado en F4d y F4e para probar con `owner.a` real.

### 8.6 Mutaciones provocadas y mutaciones equivalentes (cómo no engañarse con un 100 % falso)

El patrón de este plan: por cada migración, generar N copias con un cambio de una línea cada una (quitar una condición, invertir un `and`/`or`, saltarse un `revoke`…), apuntar la prueba a cada copia con una variable de entorno (`PLATAFORMA_MIGRACION_F4E=<ruta>`), y exigir que **todas** las copias hagan fallar alguna aserción. Si una copia **no** hace fallar nada:
1. **No asumir que la prueba está mal.** Investigar por qué, con una reproducción mínima aislada (una tabla de prueba de tres columnas, sin nada del esquema real) hasta entender el mecanismo exacto.
2. Si se confirma que el cambio no abre ningún hueco real (como pasó dos veces en F4e con el comportamiento de PostgreSQL bajo RLS descrito en §3.6-F4e), documentarlo como **mutación equivalente**, con la explicación y la prueba aislada que lo confirma — nunca solo «no lo detectó, pero no pasa nada».

### 8.7 Pantallas con Cowork (prompt estricto, con la lección de la caché)

Igual que el plan ABC (§8.6 de su informe: URL, lista de botones prohibidos/permitidos, pasos numerados, qué entregar, parar si la herramienta falla), **con dos añadidos de este plan**:
- «Borrar los datos del sitio» = cookies + `localStorage` + `sessionStorage` + IndexedDB + **caché y service workers** (hay que decirlo explícitamente, con el camino exacto en las herramientas de desarrollador — si no, el navegador puede seguir sirviendo una copia vieja del programa).
- Si tras borrar los datos la pantalla no vuelve al inicio de sesión, o si el aviso de una ronda anterior sigue apareciendo igual, **sospechar de la caché antes que del programa**: pedir la URL de un despliegue nuevo en vez de seguir insistiendo con «borrar datos» en la misma URL.

---

## 9. Riesgos y trampas conocidas (de este plan, además de las del plan ABC)

1. **No repetir el error del informe anterior:** la herramienta de migraciones no cancela «cualquier `ALTER`/`UPDATE`»; cancela las llamadas que incluyen un `DROP` de política o disparador. Ver §8.2 antes de asumir que algo necesita el editor SQL.
2. **Comprobar `release` antes de cada paso de la Fase 5**, no solo una vez: sigue en movimiento (§6).
3. **Las huellas de F4/F4c/F4e están fijadas al texto de producción del 10/10.** Si el plan ABC toca `abc_catalogo_guardar_productos`, `abc_productos_guardar_lista`, `completar_local_movimiento` o `estampar_propiedad_suscripcion_push` antes de la Fase 5, las migraciones de este plan **se negarán a aplicarse** (por diseño) y habrá que generarlas de nuevo contra el texto real.
4. **Una cuenta con membresía activa en dos empresas ACTIVAS sigue fallando cerrado** (una cuenta = una empresa) en colecciones comunes, movimientos y avisos push. Es intencionado, no un fallo.
5. **QA ya no está «limpio»:** 1003 movimientos, 8 empresas, 45 filas de `almacen_kv`. No estorba a las pruebas automáticas (cada una monta su propio esquema en Postgres real, no usa QA para eso), pero sí a las pruebas de pantalla: comprobar siempre qué empresas de prueba existen antes de crear una más.
6. **La URL de un despliegue «congelado» de Netlify no se actualiza** cuando se sigue trabajando en la rama: para probar el commit más reciente hay que pedir la URL del despliegue nuevo, no reutilizar una de una ronda anterior.
7. **El administrador de plataforma de producción no existe todavía.** No hay ninguna cuenta con ese papel hasta que la Fase 6 registre la de Pedro.
8. **Repositorio público:** nada de secretos, claves, tokens ni datos de clientes, ni en migraciones ni en documentos ni en fixtures de prueba.

---

## 10. Registro de decisiones de Pedro (resumen)

- **Producto multiempresa** (igual que D01 del plan ABC): Pedro da de alta a las empresas clientes; no hay «empresa piloto» única.
- Empezar por QA; los datos actuales de producción son de prueba, no hace falta conservarlos.
- Plazo de gracia antes del borrado definitivo: **30 días**.
- El dueño de cada empresa recibe una **contraseña inicial que le da Pedro** (no autorregistro).
- «Sí, aplicar en QA» (Fase 4, F4): aprobado.
- «Sí, prepararlo y probarlo» (F4e): aprobado construir y probar sin tocar QA hasta pedir permiso aparte.
- «Vale, aplícalo en QA» (F4e): aprobado aplicar en QA.
- Catálogo del TPV sin contexto fiscal: **«que la lista se guarde aunque falte lo fiscal»** (decisión que dio lugar a F4c).
- Fase 5 y Fase 6: autorización escrita recibida y ejecución completada el 10/10/2026; la evidencia y el estado posterior se recogen en la actualización de cierre del 11/10/2026.

---

## 11. Índice de documentos y archivos clave

**Plan y resultado por fase**
- `docs/plan-empresas/PLAN_ALTA_BAJA_Y_BORRADO_DE_EMPRESAS_2026-10-09.md` — el plan completo, con la tabla de estado actualizada.
- `FASE1_RESULTADO_QA_2026-10-09.md`, `FASE2_RESULTADO_QA_2026-10-09.md`, `FASE3_RESULTADO_QA_2026-10-09.md`.
- `FASE4_AUDITORIA_Y_PLAN_2026-10-09.md` — diseño y resultado de F4 a F4e (secciones 4, 4b, 4c, 4d, 4e).
- `PRUEBA_COWORK_FASE1_QA.md`, `PRUEBA_COWORK_FASE3_QA.md` (+ `_REPETICION`), `PRUEBA_COWORK_FASE4_APLICAR_EN_QA.md`, `PRUEBA_COWORK_FASE4_DOS_EMPRESAS.md`, `PRUEBA_COWORK_FASE4B_PRODUCTOS_POR_EMPRESA.md` (resultados de las rondas 1 a 4b, incluida la lección de la caché).

**Código**
- `supabase/migrations/20261009120000…180000_plataforma_*.sql` (Fases 1, 2, 4, 4b, 4c, 4d, 4e).
- `supabase/functions/plataforma-crear-propietario/`, `supabase/functions/_shared/plataforma-propietario.js`.
- `plataforma-panel.js`, `reset-pruebas-preview.js`, `restablecer-contrasena.js`.
- `index-storage-bootstrap.js` (copia local por cuenta, aviso de colecciones denegadas), `ui-context-bridge.js`, `server-authority-storage-bridge.js`, `edge-auth-patch.js`.

**Pruebas**
- `tests/plataforma/p02…p08` (Node: crear propietario, panel, arranque, copia local por cuenta).
- `tests/plataforma/db/p01-plataforma-empresas-contract.mjs` (Fase 1), `p03-eliminar-empresa-contract.mjs` (Fase 2), `p09-colecciones-por-empresa-contract.mjs` (F4/F4b/F4c/F4d), `p10-perfiles-movimientos-push-por-empresa-contract.mjs` (F4e).
- `tests/plataforma/db/fixtures-f4/`, `fixtures-f4e/` (copias literales de las funciones de producción usadas para las huellas y las sustituciones).

**Plan ABC (contexto, no de este plan):** `docs/plan-abc/INFORME_TRASPASO_A_CODEX_2026-10-04.md` — léelo también; su §1, §2, §8 y §9 siguen valiendo salvo la corrección de §8.2 de este informe.

---

## 12. Glosario

- **Plataforma / administrador de plataforma:** Pedro, o quien registre como tal; no es dueño de ninguna empresa cliente, solo da de alta, desactiva y borra empresas.
- **Empresa de baja:** desactivada, pero sus datos se conservan durante el plazo de gracia antes del borrado definitivo.
- **`__sin_empresa__`:** empresa ficticia a la que nadie pertenece, usada por F4 para etiquetar (sin borrar) filas antiguas que no se podían atribuir a ninguna empresa real.
- **Una cuenta = una empresa (activa):** límite declarado de F4/F4d/F4e; con dos empresas activas a la vez, las escrituras sin empresa explícita fallan cerradas.
- **Huella:** md5 del cuerpo de una función o del texto de una regla, usado para comprobar que una migración encaja con el código real antes de aplicarse.
- **Mutación equivalente:** un cambio deliberado en una migración, pensado para que una prueba lo detecte, que **no** hace fallar ninguna aserción porque, comprobado aparte, no abre ningún hueco real.
- **Resto:** dato de prueba dejado a propósito en QA para ensayar el siguiente paso (p. ej. la empresa de la Fase 1 para ensayar el borrado de la Fase 2).

---

## 13. Primeros pasos recomendados para Codex

1. **Leer** este informe y `PLAN_ALTA_BAJA_Y_BORRADO_DE_EMPRESAS_2026-10-09.md`, y también `docs/plan-abc/INFORME_TRASPASO_A_CODEX_2026-10-04.md` para el contexto general del sistema (§1, §2, §8, §9 de ese informe siguen valiendo).
2. **Comprobar el estado real de `release` ahora mismo** (ha seguido moviéndose desde que se escribió esto): `git log --oneline origin/release -20`, `git log --oneline HEAD..origin/release | wc -l`, y repetir las consultas de solo lectura de producción de §4 para ver si algo cambió.
3. **Preguntar a Pedro** qué acceso tienes (Supabase de QA y de producción, Netlify, GitHub) — no asumas que tienes los mismos conectores que Claude.
4. **Decidir con Pedro cómo conciliar** esta rama con `release` antes de preparar la Fase 5 (§6, §7.A): ¿rebase de esta rama, o PR nuevo de empresas directamente sobre `release` actual?
5. **Antes de cualquier aplicación a producción:** repetir las comprobaciones de huella de F4/F4b/F4c/F4d/F4e contra el `release`/producción del momento (pueden haber cambiado), y seguir el procedimiento de §8.2 para las sentencias con `DROP` (nunca asumir que hace falta el editor SQL para todo; solo para el `DROP` final).
6. **No hacer sin autorización expresa y escrita de Pedro:** aplicar o desplegar nada en producción, registrar su cuenta como administrador, tocar la copia de seguridad o el plan de Supabase/Netlify, ni dar de alta una empresa cliente real.
7. **Siempre:** responder a Pedro en español llano, en pasos cortos; dar los prompts de Cowork completos y listos para pegar, con la lección de la caché (§8.7); verificar con huellas y recuentos después de cualquier acción; y **parar a la primera diferencia**.
