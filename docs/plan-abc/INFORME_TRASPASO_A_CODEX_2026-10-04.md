# Informe de traspaso a Codex · Plan ABC de L&A Suite

Fecha: 2026-10-04 (noche, hora de Madrid)
Redactado por: Claude (Anthropic), a petición de Pedro, para que Codex (ChatGPT) continúe el proyecto.
Estado del proyecto: `PRIMER_PAQUETE_EN_PRODUCCION_RESTO_PENDIENTE`
Rama donde vive este informe: `claude/vigilant-hawking-uji8l4` (no está en `release`; ver §2.4 y §13).

> **Cómo leerlo.** §0 es el resumen de una página. §1 son las reglas que no se pueden romper. §2 explica el sistema y los entornos. §3 cuenta todo lo hecho. §4 y §5 dan el estado exacto de producción y de QA. §6 es la ventana del 4/10 con sus lecciones. §7 es **todo lo que falta**, por bloques. §8 son los procedimientos reutilizables. §9 los riesgos. §10 las decisiones de Pedro. §11 el índice de documentos. §12 el glosario. §13 los primeros pasos recomendados.
>
> **Honestidad sobre las fuentes.** Lo que está marcado «(verificado 4/10)» lo comprobé yo ese día con consultas de solo lectura o con el resultado de la ventana. Lo que viene de las matrices F0 es del 2/10 y puede haber mejorado; lo marco «(a 2/10)». Donde no hay evidencia escribo «no consta». No he inventado cifras.

---

## 0. Resumen de una página

1. **Qué es.** L&A Suite es una aplicación web de gestión de hostelería (compras, stock, personal, caja y TPV) con backend en Supabase y alojamiento en Netlify. El «Plan ABC» es la reconstrucción del TPV, los cobros y la caja/documentos con servidor autoritativo: **A** = TPV (A01–A12), **B** = cobros (B01–B12), **C** = caja y documentos (C01–C12), más una capa de configuración (F6) y la promoción a producción (F7).
2. **Dónde estamos.** El 4/10/2026, con la autorización escrita de Pedro (10:59 hora de Madrid), se aplicó en **producción** el «primer paquete»: 21 migraciones, la política de descuento D12 (Encargado 0 %) y la aplicación nueva (PR 119, commit `bad47053`, despliegue de Netlify `6ac22344948ac900082766ab`). Todo verificado (§6). **Producción no tiene ninguna caja abierta, ni ventas, ni cobros.** Es un único local productivo con datos de prueba mínimos.
3. **Qué falta, en una frase.** Paquete P3/P3b (precio con IVA incluido), llevar B06–B10 primero a QA, reconciliar PM09, recorridos en pantalla y con caja real de todo A/B/C, **todo lo fiscal** (bloqueado: Pedro no tiene asesoría), conexión con stock, proveedor de pagos (bloqueado: sin proveedor ni presupuesto), endurecimiento de seguridad (contraseñas filtradas, funciones públicas, edge functions), copias de seguridad y un plan de aceptación por Pedro (§7).
4. **Reglas de oro.** Nada se escribe en producción sin autorización expresa y escrita de Pedro (frase concreta, commit exacto). Parar a la primera diferencia. Sin gasto nuevo. Repositorio público: nada de secretos ni datos. Pedro habla español y quiere pasos guiados de uno en uno (§1).
5. **Trampas que ya nos mordieron.** La herramienta de migraciones de Supabase **rechaza** las migraciones con la palabra `drop`; el editor SQL desde el **móvil** mete espacios de sangría y cambia el texto de las funciones; producción **no tiene copias automáticas** (plan gratuito) (§9).
6. **Lo primero que haría Codex.** Leer §1, §2 y §13; traer al `release` los documentos de esta ventana que solo están en la rama de trabajo (con `[skip netlify]`, §13); y preguntar a Pedro qué quiere atacar primero (propuesta de orden en §7.M).

---

## 1. Personas, reglas y modelo de autorización

### 1.1 Quién es quién

| Quién | Papel |
|---|---|
| **Pedro** (`Plopezm1990` en GitHub) | Propietario de la plataforma y de la empresa productiva. Decide, autoriza y **acepta resultados** (D05). Habla español. Ejecuta a mano lo que una herramienta no puede (copias de seguridad, SQL con `drop`). |
| **Codex** (ChatGPT) | Construyó la mayor parte de F0–F5 (ramas `codex/*`: A09, A10, A11, F2, F3, F4, C03…). 135 commits en `release`. |
| **Claude** (Anthropic) | Hizo el Plan Maestro previo (ramas `claude/pm*`), y desde el 2/10 el cierre de F5, F6 (capa de configuración) y F7 (promoción). 66 commits en `release`. Ejecutó la ventana del 4/10 con la herramienta de Supabase. |
| **Cowork** | Agente de navegador de Claude. Solo se usa para **mirar pantallas** con un prompt estricto (§8.6). No es una persona ni decide nada. |

Codex puede no tener las mismas herramientas que Claude (conectores de Supabase y Netlify). **No lo des por hecho:** pregunta a Pedro qué acceso tienes antes de planificar ejecuciones.

### 1.2 Reglas permanentes de Pedro

- **Idioma y estilo:** responder en **español llano**, sin jerga innecesaria. Para pasos operativos en su ordenador, **un paso por mensaje** («dame el paso a paso»). Preguntas con opciones seleccionables, **la recomendada la primera**. Pero **la autorización de una escritura en producción tiene que escribirla él con su frase**; una opción marcada no basta.
- **Cuando haya que mandar algo a Cowork,** entregar el **prompt completo, listo para pegar** (nunca «dile a Cowork que mire…»).
- **Nunca** pedir ni recibir la contraseña de la base de datos. **Nunca** pedir a Pedro que pegue contenido de producción. Las comprobaciones de producción son **recuentos, huellas md5 e identificadores**, no contenido.
- **Sin gasto nuevo** (D27): no contratar ni ampliar nada (planes de Supabase/Netlify, proveedor de pagos, asesoría, equipos) sin su aprobación expresa. Si algo requiere dinero, decirlo y parar.
- **Copias de seguridad fuera del repositorio** (el repositorio es **público**). Nunca subir dumps, claves, cadenas de conexión, tokens ni datos de clientes.
- **No esquivar protecciones** de las herramientas (p. ej. no ofuscar `drop` para saltarse el rechazo).

### 1.3 Modelo de autorización para producción

1. **Lectura de producción:** requiere permiso aparte y se limita a `select` (recuentos, huellas, identificadores). Pedro la ha dado en bloques concretos («foto», «lecturas previas»).
2. **Escritura en producción (migraciones, datos, despliegue):** una sola autorización por paquete, con una **frase que redacta la hoja de autorización** (`F7_HOJA_AUTORIZACION_UNICA_PRIMER_PAQUETE_2026-10-04.md`, §5) con **commit exacto, `sha256` de `fuente.js`, fecha y hora**, dicha por Pedro **presente** y con **copia de seguridad hecha**.
3. **Parar a la primera diferencia** con lo autorizado y esperar su decisión. No «arreglar y seguir».
4. **Marcha atrás pre-autorizada, solo un caso:** si la aplicación nueva falla tras publicarse, volver a publicar el despliegue anterior de Netlify. Cualquier otra marcha atrás necesita su decisión.
5. **Una promoción = un despliegue de producción** (D28). No desplegar durante la iteración; las vistas previas de QA no cuentan.
6. **Nada pasa a «verificado» sin la aceptación de Pedro** (D05): recorrido real, entorno, SHA, usuario y quién acepta.

### 1.4 Convenciones del repositorio

- **Ramas:** `release` = producción (Netlify publica `release`). `main` **no se ha tocado** desde el 24/9. Cada pieza va en su rama y PR (`codex/...`, `claude/...`).
- **Commits:** mensajes descriptivos en español o inglés técnico (`feat(abc): …`, `docs(abc): …`, `test(...)`, `fix(...)`). Los commits de fixtures usaban el prefijo **`[skip netlify]`** para no provocar despliegues; úsalo en cualquier commit a `release` que no cambie la aplicación.
- **CI:** toda prueba nueva debe **registrarse en el manifiesto** (`tests/ci/manifiesto_clasificacion.json`) o la puerta general falla (`.github/scripts/validar-manifiesto-ci.mjs`).
- **Migraciones:** archivos `supabase/migrations/<AAAAMMDDHHMMSS>_<nombre>.sql`; **aditivas**, con **comprobación previa** (`do $$ … raise exception`) y con huella md5 exacta de las funciones que reemplazan.
- **Documentación:** `docs/plan-abc/` (ABC) y `docs/plan-maestro/` (Plan Maestro anterior). Cada informe lleva una línea `Estado:`.

---

## 2. El sistema y los entornos

### 2.1 Producto

L&A Suite: multiempresa y multilocal (D01: producto para vender a varias empresas; sin «local piloto» único). Módulos previos al plan ABC (Plan Maestro, PM01–PM33): compras y albaranes, stock por ubicación, conteos, personal (turnos, fichajes, ausencias, nóminas), encargos, tesorería, informes, APPCC. El plan ABC añadió el circuito servidor-autoritativo del **TPV**, **cobros**, **caja** y **documentos**.

### 2.2 Arquitectura

- **Frontend:** un bundle gigante `fuente.js` (≈5,9 MB, React; espejo reproducible en `source-recovery/fuente-recuperado.js` + `source-recovery/recuperar_candidato.py` y parches `post-pm08-patches/`). Alrededor, puentes y parches cargados desde `index.html`: `index-storage-bootstrap.js` (P1: aviso de claves solo locales), `ui-context-bridge.js` (contexto empresa/local y puente de catálogo P3), `server-authority-storage-bridge.js`, `edge-auth-patch.js`, `owner-bootstrap-*.js`, `sw.js`, etc. **No hay un proyecto de código fuente limpio por módulos**: se edita el bundle recuperado y se comprueba que coincide (`python source-recovery/recuperar_candidato.py --check`, `node --check fuente.js`).
- **Publicación:** Netlify. `netlify.toml` ejecuta `.github/scripts/build-netlify-publish.mjs`, que copia la raíz a `.netlify-dist` **excluyendo** `tests`, `supabase`, `docs`, `source-recovery`, `.github`, etc. `_headers` fija la política de seguridad (CSP: `connect-src` permite **los dos** proyectos de Supabase, producción y QA) y cabeceras de caché.
- **Cómo decide la app si es QA o producción:** por la dirección. Solo los previews de PR `deploy-preview-N--chic-entremet-9107cf.netlify.app` usan QA; **cualquier otra dirección usa producción**. Por eso el PR 118 existe como «vehículo» de QA y **no se debe fusionar**.
- **Backend:** Supabase (Postgres 17). Patrón de todo el plan ABC:
  - Escrituras por **RPC `SECURITY DEFINER`** con `search_path=''`, que comprueban `auth.uid()` y **capacidad** (`private.abc_tiene_capacidad`) por empresa/local.
  - **Idempotencia** por `operation_id` (`private.abc_operacion_iniciar/completar/fallar` + tabla `abc_operaciones`) y **auditoría** en `abc_eventos`.
  - Tablas sin acceso directo (RLS activo, sin políticas, sin permisos de tabla para `anon`/`authenticated`/`service_role`): se lee y escribe **solo por RPC**.
  - El navegador **no lee** `abc_eventos`, `pago_intentos`, etc. directamente (migración «ACL parity» `20260924004000`); cada lectura necesita su RPC (así se arregló el historial de descuentos y la lectura del cobro).
  - **Día operativo** calculado en el servidor (A11) con regla versionada por local (`private.abc_operating_day_reglas`).
- **Edge functions** (en el repositorio: `supabase/functions/` → `abc-b07-webhook`, `crear-cuenta-empleado`, `enviar-notificacion`, `prefiltro-candidato`, `_shared`): ver §4.7 para lo desplegado.

### 2.3 Entornos

| Entorno | Identificador | Notas |
|---|---|---|
| **Producción** (Supabase) | `flqercbgpgmmfaakrwkc` («L&A Suite», eu-west-1, Postgres 17.6.1.155) | **Plan gratuito: sin copias automáticas ni recuperación a un instante.** Un local productivo activo: «Chocolatería San Gines» (empresa «Chocoloyos S.L»). |
| **QA** (Supabase) | `qjqorixtkilwsndqayyx` («L&A Suite QA», eu-west-1, Postgres 17.6.1.166) | Datos **ficticios**: empresas `QA-EMP-*`, locales A1/A2 activos y B1/B2 inactivos. |
| Otros proyectos Supabase | `cqtghwiuxrqrxupyonqf` («TPV»), `ytavvyusrmwandchjyei` («P2-R03 validation») | Inactivos. No usar. |
| **Netlify** | proyecto `chic-entremet-9107cf`, rama de producción `release` | Producción: `https://chic-entremet-9107cf.netlify.app`. Vistas previas: `https://deploy-preview-<N>--chic-entremet-9107cf.netlify.app`. |
| **CI local de pruebas** | PostgreSQL 16/17 desechable en GitHub Actions y PGlite | Los contratos SQL corren aquí, no en QA. |

Los nombres de los proyectos de Supabase aparecen en el repositorio público (CSP, migraciones y documentos); no son secretos. **Las claves, contraseñas y cadenas de conexión sí lo son y no están en ningún sitio del repositorio.**

### 2.4 Ramas y pull requests (a 4/10)

| Rama / PR | Estado |
|---|---|
| `release` | **Producción.** Cabeza `bad47053b804513472087a95461661a2b12a3993` (fusión del PR 119). Árbol `e1a0119e8680386cba9ad97eab9336954b7cb1c4`. |
| PR [119](https://github.com/Plopezm1990/Almacen/pull/119) (`claude/promocion-primer-paquete-uji8l4`) | **Fusionado** el 4/10. No reutilizar ni apilar commits encima. |
| PR [118](https://github.com/Plopezm1990/Almacen/pull/118) (`claude/vigilant-hawking-uji8l4`) | Borrador «NO FUSIONAR»: **vehículo de la vista previa de QA**. Su árbol es el de `release` más **documentación** (resultado de la ventana, decisión 28, hoja actualizada y este informe) que **no está en `release`**. Su historial (97 commits propios) diverge del de `release` (25 propios). |
| `main` | Sin tocar desde el 24/9. |
| `codex/*`, `claude/*` | Ramas de trabajo históricas (194 ramas remotas en total). Casi todas están fusionadas o son diagnóstico. |

### 2.5 CI y calidad

- **238 flujos** en `.github/workflows` (contratos por pieza: `abc-f2-*`, `abc-f3-*`, `abc-f4-*`, `abc-f5-*`, `abc-f6-config-contract.yml`, y toda la historia `pm*`/`g1-*`/`p2-*`).
- **Puerta general:** `puerta-ci-release.yml` + `gate-final`; en el PR 119 pasaron **25 de 25** comprobaciones.
- **Manifiesto de CI:** 241 archivos, **224 activos** (el 3/10 se registraron 33 pruebas que faltaban). Detalle en `F7_CI_CAPA_CONFIGURACION_RESULTADO_2026-10-03.md`.
- **Pruebas de la capa de configuración:** `tests/cfg/*` (contratos SQL `cfg1…cfg6d`, `d13`, `a09-eventos`, `pm07-fix`, y pruebas de ejecución de interfaz). Verificaciones locales de cada pieza: pieza 1 (QA), pieza 2 **201/201**, pieza 3 **79/79**, pieza 4 **72/72**, pieza 5 **154/154**, interfaz **68/68** en ejecución y **91 averías provocadas** detectadas.
- **Contrato A09 contra Postgres:** falló tres veces en CI por carreras **de la propia prueba** (foto cacheada de `pg_stat_activity`; rechazo sin manejar), ya arregladas (`948af6d`, `d3633fb`). Informe en `F7_CI_CAPA_CONFIGURACION_RESULTADO_2026-10-03.md` §6.
- **Una falla de infraestructura vista dos veces:** `address already in use` del puerto 54322 al arrancar la base desechable de `pm33-p05-supabase-full`, antes de ejecutar nada. Se relanzó.

---

## 3. Lo que se ha hecho

### 3.1 Antes del plan ABC: Plan Maestro (PM01–PM33), septiembre de 2026

Referencia: `docs/plan-maestro/`. Resumen:
- **PM01** fuente reproducible (`source-recovery`); **PM02** aislamiento de QA y bootstrap en cero; **PM03** contratos mínimos; **PM04–PM05** regresión y aislamiento transversal; **PM06** identidad financiera; **PM07** stock y reversos por ubicación; **PM08** cierre y evidencia de QA (origen de la función `money` de la pantalla de caja); **PM09** conciliar ventas y analítica; **PM10** módulos operativos en servidor (productos, pedidos, recepción, personal, encargos) y adaptador KV; **PM11** compras (albarán, factura, pago y reverso); **PM12** conteos/estados de stock; **PM13** personal (altas, turnos, fichajes, ausencias, vacaciones, costes, nóminas con IA); **PM14** encargos y anticipos; **PM15–PM17** contexto, errores, arranque, seguridad de notificaciones; **PM18** identidad fiscal de empresa; **PM19–PM20** cobertura de módulos y puerta G2; **PM25–PM27** ensayo integral y auditoría de 25 casos; **PM29–PM33** locales/empresas, selector, entorno aislado equivalente a producción.
- **Puertas «Punto 1–13»** y **acta GO/NO-GO** del 21/9 (`PUNTO13_ACTA_GO_NO_GO_2026-09-21.md`); índices de rendimiento (Punto 9), publicación y recuperación de Netlify (Punto 6), endurecimiento del frontend (Punto 7).
- **G1** (`tests/g1/`): inventario de evidencias, permisos y aislamiento, cifras y conciliaciones, concurrencia y replay.
- **P2**: candidatos `release-current` para publicar con seguridad de bordes.

### 3.2 Plan ABC · F0 (inventario y matrices, 2/10)

`F0_MATRIZ_A01_A12_EVIDENCIA_2026-10-02.md` y `F0_MATRIZ_B01_C12_EVIDENCIA_2026-10-02.md`: estado de cada requisito con etiquetas de evidencia (`[MIGR]` migración aplicada en QA, `[QA]` ejecución con `ROLLBACK`, `[A12]`, `[UI]` la pantalla llama a la función, `[CI]`, `[TRASPASO]`). Taxonomía del plan §2.5: verificado, incompleto, defectuoso, pendiente, bloqueado, opcional. **Ninguna fila está «verificada»** (D05). Las matrices están **fechadas el 2/10** y no recogen lo posterior (§7.C–7.E las actualizan).

### 3.3 F1 (decisiones y contratos comunes)

- **Hoja de decisiones** `F1_HOJA_DECISIONES_PEDRO_2026-10-02.md` con D01–D31 (resumen en §10). Contratos comunes F1.1–F1.6 en la rama `codex/f1-contratos-comunes` (permisos F1.3, fiscal F1.4, vectores de redondeo F1.5…).
- Pedro contestó el 2/10 y el 3/10 casi todo con las recomendaciones; lo abierto está en §7.J.

### 3.4 F2 (base transaccional, Codex)

M01 base transaccional de caja; M02A núcleo comercial y fiscal; M02B pagos, reservas y reembolsos; M03A autoridad transaccional; M03B checkout y cobro; M03C; M04A (apertura de caja, C01); M04B (entradas y salidas, C02); M04C (efectos pendientes/outbox); M04D («ACL parity»: el navegador deja de leer tablas internas). Contratos `abc-f2-m01…m04d` en CI.

### 3.5 F3 · TPV A02–A12 (Codex, hasta el 28/9)

- **A02/A03/A04/A05:** pedido, cantidades y precio calculado en servidor, variantes y suplementos, estados del pedido (+ adaptadores de pantalla).
- **A06:** cuentas abiertas y recuperación (A06.1/A06.2) con **día operativo del servidor**.
- **A07:** mesas, zonas, responsables (A07.1/A07.2, lista de responsables).
- **A08:** dividir y unir cuentas (A08, A08.1 interfaz, A08.2 concurrencia, A08.2 **bloqueo de cuenta con cobro incierto**). A08 aplicada y verificada en producción el 24/9 (`A08_POSTFLIGHT_PROD_2026-09-24.md`: tablas, funciones por huella, humo con `ROLLBACK`).
- **A09:** descuentos y cortesías con autorización (A09.1 límites por rol, A09.2.1–A09.2.9: denegaciones autoritativas, apilado, escalado de rol, doble aprobación, auditoría, conciliación de caja, línea de producto de stock). **Cerrada** el 28/9 (`A09_CIERRE_2026-09-28.md`, 46/46 pruebas Node y contrato PGlite).
- **A10 / A10b:** comandas de cocina y auditoría de cocina; enrutado de comanda en la interfaz; cierre de caja desde cocina (PM10).
- **A11:** día operativo autoritativo. **Cerrada** el 28/9 (`A11_CIERRE_2026-09-28.md`); en producción desde el 28/9 con regla `Europe/Madrid`, corte 00:00.
- **A12:** evidencia funcional del backend TPV en QA con `ROLLBACK` (`A12_EVIDENCIA_QA_2026-10-02.md`): apertura de cuenta en las cuatro modalidades, zona/mesas, pedido, descuento autorizado, reparto y unión, checkout, cobro mixto (8 € efectivo con 10 € recibidos y 2 € de cambio + 14 € en tarjeta reservada), lecturas de sala y políticas.

### 3.6 F4 · Cobros B02–B12 (Codex)

- **B02–B03** puente de checkout y una identidad por intento (en producción desde el 29/9).
- **B04** cobro de resultado desconocido (incidencia que bloquea el saldo hasta resolverla). **B05** efectivo y pagos mixtos (`abc_estado_pago_mixto_cuenta`). Ambas **aplicadas en producción el 4/10**.
- **B06** propinas, anticipos y fianzas: 4 migraciones (recibos que no son venta, trazabilidad de anticipos, guarda de saldo, catálogo de políticas). **Solo en el repositorio**: nunca aplicadas en QA ni en producción.
- **B07** registro de proveedores de pago, adaptador de eventos simulado (HMAC), procesado idempotente, función de borde `abc-b07-webhook` (sin desplegar). 3 migraciones **sin aplicar**.
- **B08** devoluciones económicas: límite neto, reservas, outbox, simulador y pantalla; sus funciones de reembolso ya estaban en producción antes de la ventana (coincidían por huella en la foto del 3/10). Después se añadió **D13** (aprobación; ver §3.8).
- **B09** liquidaciones y disputas: 2 migraciones **sin aplicar**.
- **B10** frontera de datos de tarjeta (rechaza PAN), modos de captura PCI y puerta de revisión PCI: 3 migraciones **sin aplicar**; checklist de alta con el proveedor.
- **B11** contrato de pagos sin conexión (solo online + borradores) y contingencia de terminal sin activar (`F4_B11_*`).
- **B12** matriz de ensayo de pagos y simuladores (`F4_B12_*`): sin proveedor ni sandbox reales.
- `fix(f4): wire payment actions into TPV` (2/10): acciones de pago cableadas en el TPV.

### 3.7 F5 · Caja y documentos C03–C12, seguridad y siembra de QA

- **C03** arqueo calculado en servidor: **solo el contrato** (`F5_C03_CONTRATO_ARQUEO_SERVIDOR_2026-10-01.md`), sin migración. PR 117 `codex/f5-c03-cash-reconciliation` fusionado.
- **C04** cierre provisional/definitivo y reapertura; **C05** series y numeración; **C06** tipos documentales; **C07** puerta fiscal en modo simulación (rechaza sin asesoría, **cerrada a propósito**); **C08** conservación inmutable y corrección; **C09** imprimir sin duplicar la venta; **C10** entrega y copias; **C11** conciliación explicable; **C12** ensayo de cierre. Todas con contrato SQL en CI; aplicadas en QA el 2/10 y **en producción el 4/10**.
- **PM09 hardening** de seguridad de envoltorios `SECURITY DEFINER` (`abc_f5_pm09_security_hardening`): aplicado y validado en QA; **bloqueado en producción** por deriva de esquema (§7.B).
- **Advisors de Supabase**: revisión, inventario de funciones `SECURITY DEFINER` (QA: 136) y plan de remediación priorizado (`F5_ADVISORS_*`, `F5_INVENTARIO_SECURITY_DEFINER_QA_*`, `F5_REVISION_SEMANTICA_*`). **No aplicado** (§7.H).
- **Ensayo integral en QA** (2/10, transacciones con `ROLLBACK`): venta → cobro simulado → devolución → reversión → cierre. Alcance parcial; **el cierre no pudo explicar una diferencia de −11** (dos circuitos mezclados, C11) y el cierre aceptaba la diferencia sin tratamiento (arreglado después por la pieza 2).
- **Etapa 1 de siembra de QA** (D07): catálogo ficticio (15 artículos por local en A1 y A2, con variantes y stock), regla de día operativo de prueba (04:00), terminal, caja y vínculo fiscal en A1. La regla de producción es 00:00.
- **P1 (sincronización de claves, D30):** `index-storage-bootstrap.js` avisa de las colecciones que solo existen en el equipo (plazo de 6 h). **Validado por Pedro el 3/10.**
- **P3 (catálogo autoritativo, D31):** `abc_catalogo_guardar_productos` + puente de pantalla; **precio de carta con IVA incluido**. En QA; **no en producción** (§7.B). El puente **se desactiva en silencio** si la función no existe en el servidor (producción antes de promoverlo): **no hay riesgo hoy**.
- **Corrección del aviso de `locales`** en QA y lectura del cobro (`pago_intentos`) y del historial de descuentos (`abc_eventos`) por RPC (`F5_CORRECCION_AVISO_LOCALES_*`, `F6_COBRO_LECTURA_*`, `F6_A09_HISTORIAL_*`).

### 3.8 F6 · Capa de configuración por empresa y local (Claude, 2–3/10)

Decisiones de Pedro: configuración por el **propietario de cada empresa**; D02, D03, D04, D06, D12, D14, D15, D19. Inventario: `F6_INVENTARIO_CAPA_CONFIGURACION_2026-10-02.md`.

| Pieza | Qué hace | Verificación |
|---|---|---|
| **1** `abc_config_pieza1_dia_cajas` | Ajustes por local (máximo de cajas abiertas, 1–10, por defecto 10), regla del día operativo versionada (zona y corte 00:00–12:00), `abc_abrir_sesion_caja` rechaza `caja_limite_sesiones_alcanzado` | QA |
| **2** `abc_config_pieza2_diferencia_caja` | Segundo ajuste (umbral de diferencia, 0 € por defecto); registrar el motivo, aprobar/rechazar; guarda en `caja_sesiones` que impide finalizar con diferencia sin tratar | QA 201/201 |
| **3** `abc_config_pieza3_modalidades` | Modalidades habilitables por local (Barra, Mesa, Terraza, Para llevar, Otro); mínimo una; guarda en `cuentas_comerciales` | QA 79/79 |
| **4** `abc_config_pieza4_equipos` | **Registro** de equipos por local (solo registro; no integra nada) | QA 72/72 |
| **5** `abc_config_pieza5_permisos` | Catálogo único de capacidades, plantilla por rol, decisiones del propietario por empresa/local con **techo** en lo delicado, retirada de Churrero/a, Básico y Estándar (bloquea altas) y **solo el Propietario reabre cierres** (D14) | QA 154/154 |
| **6a–6c, 6f** pantalla «Configuración» (grupo Sistema, solo Propietario): Día y cajas, Modalidades, Equipos, Permisos; «Reabrir cierre» solo a quien puede; roles retirados fuera del alta | probada por Pedro en el preview 118 (pruebas 1–4) |
| **6d** `abc_config_pieza6d_dia_operativo` + pantalla de cierre con diferencia | el servidor calcula el día operativo; el Propietario aprueba en la misma pantalla; arregla dos fallos previos del cierre desde pantalla | probada por Pedro el 3/10; «Aprobar diferencia» probada con Cowork |
| **6e** modalidad al abrir cuenta (solo cliente) | el TPV abre en la modalidad elegida o en Barra/la primera habilitada; «Tipo de cuenta» en el carrito | probada por Pedro el 3/10 |
| **D13** `abc_config_d13_reembolsos_aprobacion` | **Nada sale sin aprobación**: solicitar no encola el envío al proveedor si quien pide no puede confirmar; `abc_aprobar_reembolso` (nadie aprueba lo que solicitó) | QA + pantalla con Cowork |
| **A09 eventos** `abc_a09_eventos_descuento_cuenta` | historial de descuentos por RPC | QA |
| **PM-08 «money»** | entrada/retirada manuales sin aviso falso (cambio de pantalla) | QA |
| **Texto del descuento por importe** | la pantalla dice «antes de IVA» (decisión 16, `f796cda`) | CI 22/22 |

### 3.9 F7 · Promoción a producción

1. **Foto de solo lectura** de producción (3/10) y repetición el 4/10 (`F7_PROMOCION_PRODUCCION_FOTO_RESULTADO_2026-10-03.md`, `…PREFLIGHT_SOLO_LECTURA….sql` con 14 averías provocadas detectadas por su contrato).
2. **Preparación** (`F7_PROMOCION_PRODUCCION_PREPARACION_2026-10-03.md`): 46 migraciones candidatas, paquetes A–E, qué se escribe, cambios de comportamiento, guion de la ventana, apéndice A (46 migraciones) y B (33 pruebas registradas).
3. **27 decisiones de Pedro** registradas (`F7_PROMOCION_PRODUCCION_DECISIONES_2026-10-03.md`) y la **hoja de autorización única** (`F7_HOJA_AUTORIZACION_UNICA_PRIMER_PAQUETE_2026-10-04.md`).
4. **CI** de la capa de configuración (flujo `abc-f6-config-contract.yml`).
5. **Ventana del 4/10** (§6): ejecutada. Decisión 28 registrada.

---

## 4. Estado de producción (verificado 4/10)

### 4.1 Base de datos

- **94 migraciones registradas.** Las **20 de hoy** (con marcas `20261004…`) están en `supabase_migrations.schema_migrations` (tabla del §6.2). Faltan **dos filas originales** (C04 y pieza 2, aplicadas a mano; sí están sus correctoras). Decisión de Pedro: **no insertar filas a mano**.
- **95 tablas** en `public`, **4** en `private`; **273 funciones `SECURITY DEFINER`** en `public`+`private`.
- **Datos** (recuentos): 3 empresas, **4 locales (1 activo)**, 3 membresías (las tres «Propietario», activas), **0 pagos**, **0 reembolsos**, **0 ventas fiscales**, 1 producto en el catálogo del TPV, 1 sesión de caja **cerrada** (28/9, sin movimientos), **31 eventos** de auditoría, 29 operaciones.
- **Restos conocidos de la prueba A10 (28/9):** **2 cuentas abiertas (BARRA)**, **2 pedidos enviados** y **1 comanda de cocina pendiente** en el local productivo. No existe operación del servidor para cerrar o cancelar una cuenta (solo la fusión cierra la de origen). Pedro decidió **dejarlos** y las comprobaciones P8b los aceptan por identificador. Si algún día se pone en marcha un proceso de cocina que recoja efectos, hay que descartar antes la comanda.
- **Política de descuentos del local productivo:** Propietario 100 % (aplica, autoriza y solicita); **Encargado 0 %** (solicita y escala al propietario; no aplica ni autoriza; sin cortesía; sin doble aprobación). No hay ningún Encargado.
- **Configuración de la capa nueva:** sin filas en `abc_config_ajustes` (valores por defecto: 10 cajas y umbral 0 €), `abc_local_modalidades` (todas habilitadas), `abc_local_equipos` ni `abc_capacidades_rol` (plantilla por defecto). Regla del día operativo: `Europe/Madrid`, corte 00:00, versión 1 (vigente desde el 27/9 a las 00:00, hora de Madrid).
- **Funciones:** las funciones de las 21 migraciones tienen la **huella md5 del archivo** (verificado migración a migración). Las funciones de la pieza 2 y la de C04 se re-escribieron con una **migración correctora** tras aplicarlas a mano (§6.3).

### 4.2 Aplicación

- `release` = `bad47053…`; despliegue **`6ac22344948ac900082766ab`** (actual). Anterior: `6abf43047ed8030008ffb5a9` (commit `01f47bf`, 2/10) — **es la marcha atrás autorizada**.
- Servido: `fuente.js` `sha256` = `88fcf88015b6c85eb75c98080480ffde3da9a80f67688ff1824c7f1dfc07fbe8` (igual al candidato), `index-storage-bootstrap.js` y `ui-context-bridge.js` iguales al repositorio; `index.html` solo difiere en un script `hud` que inyecta Netlify. El código solo menciona el proyecto de **producción** (12 veces) y ninguna el de QA.
- Observado con navegador (Cowork, 4/10): sin cartel de error, **225 peticiones a `flqercbgpgmmfaakrwkc.supabase.co` y 0 a QA**.

### 4.3 Seguridad (advisors, 4/10)

3 hallazgos, **los mismos tipos que en QA** (24 / 142 / 1 allí): 24 tablas con RLS activo y sin política (acceso solo por RPC, deliberado); **130 funciones `SECURITY DEFINER` ejecutables por `authenticated`** (el diseño de las RPC ABC); **protección contra contraseñas filtradas desactivada** (ajuste de Auth, no SQL).

### 4.4 Diferencias conocidas producción ↔ QA (anteriores y ajenas al primer paquete)

Comparadas 28 tablas (columnas, restricciones, índices, disparadores, seguridad por filas, permisos): **idénticas en 26**. Difieren `membresias_usuario` (producción tiene restricciones/índice `pm12_prod_*`; QA tiene el disparador `pm11_membresias_vinculo_guard` y permisos de `service_role` más amplios; **producción no tiene ninguna política** sobre ella, QA una) y los permisos de `service_role` de `caja_operaciones`. **Ninguna de las 21 migraciones contiene sentencias de política.** Funciones solo en QA: PM09 (`registrar_venta_stock_pm09`, `revertir_venta_stock_pm09`, `revertir_venta_stock`), PM11/PM13 (empleados, prefiltro, ausencias), `abc_catalogo_guardar_productos` (P3). Solo en producción: `bootstrap_owner_instalacion`.

### 4.5 Copias de seguridad

**Plan gratuito: sin copias automáticas ni recuperación a un instante** (confirmado en el panel el 4/10: «Free Plan does not include project backups»). Pedro hizo **copias manuales** con la CLI (§8.4): ensayo 10:13 y **ventana 10:34** (`roles.sql` 370 B, `schema.sql` 1.047.547 B, `data.sql` 278.836 B), guardadas en su PC y copiadas a un pendrive. **No se ha probado a restaurar** ninguna. Pasar a un plan de pago es una **decisión de gasto de Pedro** (D27).

### 4.6 Netlify

Proyecto `chic-entremet-9107cf`, plan de equipo `nf_team_dev`, rama de producción `release`. El **coste por despliegue** de producción no se comprobó (Pedro lo asume, decisión 23). Las vistas previas requieren login SSO de equipo salvo para producción.

### 4.7 Edge functions desplegadas

- **Producción (14):** `importar-albaran` (v16), `importar-nomina` (v11), `entrevista-personal`, `prefiltro-candidato`, `super-function`, `crear-cuenta-empleado`, `importar-albaran-prueba`, `importar-nomina-prueba`, `enviar-notificacion-prueba`, `enviar-notificacion-segura`, `enviar-notificacion`, `entrevista-personal-neutral`, `enviar-notificacion-dispositivo-prueba`, `push-prueba-un-dispositivo`. Varias con `verify_jwt: false` (`importar-albaran`, `importar-nomina`, `prefiltro-candidato`, `super-function`, `importar-albaran-prueba`, `importar-nomina-prueba`, `enviar-notificacion`). Hay varias de «prueba» y una (`super-function`) de **propósito no documentado**. **Pendiente de revisión** (§7.H).
- **QA (9):** `importar-albaran`, `importar-nomina`, `entrevista-personal`, `prefiltro-candidato`, `qa-crear-empleado`, `enviar-notificacion`, `qa-pm04-bootstrap`, `qa-pm05-validar-rls`, `crear-cuenta-empleado`.
- **`abc-b07-webhook` no está desplegada en ninguno** (coherente con B07 sin proveedor).

---

## 5. Estado de QA (verificado 4/10)

- **122 migraciones** registradas; última `20261003103727`. QA tiene **todo lo de producción más**: P3, P3b, PM09 hardening, PM11/PM13, etc. **No tiene B06, B07, B09 ni B10** (12 migraciones nunca aplicadas) y la **pieza 2** está aplicada a mano sin fila (la función `abc_registrar_diferencia_caja` solo difiere del archivo en **un comentario**).
- **Datos ficticios:** 2 empresas con locales A1 y A2 activos (B1 y B2 inactivos); 30 filas de catálogo TPV; regla de día operativo de prueba (04:00) en algún local.
- **Restos de pruebas en QA:** **2 sesiones de caja abiertas** y **7 cuentas abiertas** (incluida una de la prueba C bis del 3/10: Local A1, BARRA, pedido SERVIDO, 1,00 € de descuento, sin cobro). Los ajustes cambiados por las pruebas de pantalla se deshicieron desde la propia pantalla.
- **Cómo se prueba en pantalla:** abrir el preview del PR 118 (`deploy-preview-118--…`); usuario Propietario de QA; Cowork con prompt estricto. Las pruebas escritas están en `F6_PRUEBA_PREVIEW_*` y `F5_PRUEBA_PREVIEW_P1_P3_*`.
- **Edge functions de QA:** ver §4.7.

---

## 6. La ventana del 4/10/2026

### 6.1 Cronología (hora de Madrid)

| Hora | Hecho |
|---|---|
| 08:21–08:22 UTC | Lecturas previas de producción (solo `select`), idénticas a la foto del 3/10 |
| 10:13 / 10:34 | Ensayo y copia manual de la ventana (Pedro, CLI de Supabase, Windows) |
| 10:59 | Frase de autorización de Pedro (commit `ff5015c`, `fuente.js` `88fcf880…`) |
| 11:06–11:51 | Migraciones 1–21, una a una con verificación |
| 11:51–11:58 (aprox.) | D12 escrita y verificada; humo transaccional con `ROLLBACK` (64 comprobaciones) y huellas idénticas antes/después; comparación con QA y advertencias de seguridad |
| 11:58 | PR 119 marcado como listo y **fusionado** (merge); Netlify publicó `6ac22344…` en minutos |
| Después | Cowork miró pantallas (primer informe parcial por una caída temporal de su servicio; segundo, completo) |

### 6.2 Migraciones aplicadas hoy (registro de producción: nombre · versión)

`abc_f3_a08_2_payment_interlock` 20261004090608 · `abc_f4_b04_unknown_payment` 090725 · `abc_f4_b05_mixed_payments` 090754 · *(C04 sin fila; manual)* · `abc_f5_c04_close_reopen_formato` 093123 (correctora) · `abc_f5_c05_document_series` 093206 · `…c06_document_types` 093238 · `…c07_fiscal_gate` 093315 · `…c08_document_retention` 093358 · `…c09_document_printing` 093427 · `…c10_document_delivery` 093456 · `…c11_explainable_reconciliation` 093527 · `…c12_close_rehearsal` 093601 · `abc_config_pieza1_dia_cajas` 093834 · *(pieza 2 sin fila; manual)* + `abc_config_pieza2_correctora_formato` 094621 · `abc_config_pieza3_modalidades` 094706 · `abc_config_pieza4_equipos` 094750 · `abc_config_pieza5_permisos` 094916 · `abc_config_pieza6d_dia_operativo` 094940 · `abc_config_d13_reembolsos_aprobacion` 095102 · `abc_a09_eventos_descuento_cuenta` 095122 · `abc_pm07_correccion_numero_catalogo` 095140.

Aplicadas en producción **desde antes**: hasta B02–B03 (29/9), A08 (24/9), A09/A10/A10b, A11/A06 (27–28/9), PM07/PM10 (28/9; PM07 con un borrador anterior, corregido hoy), `abc_f4_b02_b03_checkout_bridge`.

### 6.3 Incidencias y cómo se resolvieron

1. **La herramienta de migraciones rechaza las que contienen `drop`** (C04 y pieza 2 las contienen: `drop constraint`, `drop trigger`). Síntoma: tiempo agotado y «cancelled», tres intentos sin efecto en producción. Solución: **Pedro las aplicó a mano** en el editor SQL. No se esquivó la protección.
2. **El editor SQL desde el móvil añadió espacios de sangría** al pegar y las funciones quedaron con texto distinto (una pasó de 3.912 a 124.413 caracteres). Mismas funciones tras quitar espacios (comprobado, comentarios incluidos). Solución: **migración correctora** (`create or replace` con el texto exacto del archivo) por cada una, aprobada por Pedro. **Consecuencia práctica: usar siempre el ordenador, nunca el móvil, para pegar SQL.**
3. **La hoja exigía «13 huellas COINCIDE» antes de empezar** (imposible). El estado conocido era 6 `COINCIDE`, 5 `NO EXISTE`, 2 `DISTINTA`; cada huella se comprobó **justo antes de la migración que la necesita**. Corregido en la hoja.
4. **La frase llegó con la hora sin rellenar**: se pidió confirmación y Pedro confirmó las 10:59.
5. **La copia cambió de tamaño** entre intentos (+202 B y −34 KB): solo filas de `auth.*` (sesiones y tokens de una pestaña de la app abierta). Confirmado con comparación por tabla: ningún cambio en `public`.
6. **Dos pruebas del humo** (confirmar reembolso y abrir sesión de caja con un terminal falso) fallaron por la clave `abc_operacion_terminal_fk`, no por el mensaje previsto: la capacidad y los parámetros pasaron, pero **no se ejercitó** el rechazo `caja_limite_sesiones_alcanzado` ni los caminos felices de cobros y devoluciones (producción no tiene cajas, terminales ni pagos).
7. **Los registros de Supabase** (`postgres_logs`) no se pudieron consultar (error del servicio): no se comprobaron errores de la API tras el despliegue.
8. **La pantalla «Empresas y locales»** se abrió por error durante una caída del servicio de Cowork; no se pulsó nada y la base no cambió (huellas de 15 tablas idénticas).

### 6.4 Cómo se verificó cada migración (reutilizable)

Con `supabase_migrations.schema_migrations`: (a) md5 del texto registrado (`array_to_string(statements, E'\n')` sin `chr(13)`) = md5 del archivo; (b) md5 normalizado (sin comentarios ni espacios) igual; (c) md5 de **cada función** (`md5(replace(prosrc, chr(13), ''))`) = md5 del cuerpo en el archivo; (d) tablas por `to_regclass`, disparadores por `pg_trigger`, permisos por `has_function_privilege`. **Las marcas de versión que pone la herramienta no coinciden con las del archivo**: comparar por **nombre**, no por marca.

---

## 7. Lo que falta (todo, por bloques)

Leyenda de estado: **H** hecho · **P** pendiente · **B** bloqueado por un tercero o una decisión · **N** no consta.

### 7.A Cabos sueltos de la ventana del 4/10

| # | Qué | Estado | Detalle |
|---|---|---|---|
| A1 | Ver en pantalla el **0 % del Encargado** | P | No hay sección de descuentos en Configuración (Cowork lo confirmó por búsqueda en el texto). Verificado en base, no en pantalla. Habría que localizarlo en el panel «Descuento / cortesía» del TPV. |
| A2 | Ver el **historial de descuentos con datos** en producción | P | El TPV de producción no mostró las 2 cuentas de restos (la base sí las tiene). Causa **no investigada**; hipótesis: el TPV recupera cuentas por estado local/dispositivo. |
| A3 | **Texto desactualizado** en la pestaña «Día y cajas» | P | Dice «la pantalla de cierre no pide aún el motivo ni la aprobación… un cierre con diferencia no se puede finalizar». Según el informe de la pieza 6d, el cierre con diferencia **sí** se implementó y Pedro lo probó en QA el 3/10, y el código servido llama a `abc_obtener/registrar/decidir_diferencia_caja`. Corregir el texto exige un despliegue; juntarlo con el siguiente paquete. |
| A4 | **Probar un cierre con diferencia en producción antes de usar caja real** | P | Producción nunca ha ejercitado C04/pieza 2 con una sesión viva. Con diferencia 0 no debería dar problema; con diferencia ≠ 0, comprobarlo. |
| A5 | Pantalla: «solicitar devolución» para el Cajero/a | P | El servidor permite dársela (techo `CAJERO`, D13); Cowork resumió «devoluciones» como bloqueadas. No se comprobó fila por fila. |
| A6 | **D12 en cada empresa/local nuevo** | P | No hay procedimiento de alta que escriba la política de 0 %; un local nuevo empezaría con el 20 % por defecto del código. Resolverlo de raíz = opción B de D12 (cambiar el valor por defecto en código y adaptar los contratos A09), o añadir la escritura al alta. |
| A7 | Copia de seguridad: **probar una restauración** | P | Nunca se ha probado. Producción sin copias automáticas (plan gratuito). Decisión de gasto de Pedro. |
| A8 | **Restos A10** (2 cuentas, 2 pedidos, 1 comanda) | P | Limpieza en un paquete aparte con autorización propia; hace falta antes una operación del servidor para cerrar/cancelar cuentas (no existe). |
| A9 | Filas de registro de C04 y pieza 2 | H (decisión) | Pedro: dejarlo anotado. |
| A10 | Aprobar diferencias de caja **desde otro dispositivo** | P (ampliación) | Hoy el Propietario aprueba en el terminal donde se cerró; una lista de «cierres pendientes» sería una ampliación. |
| A11 | Documentos de esta ventana **fuera de `release`** | P | Resultado de la ventana, decisión 28, hoja y este informe solo están en la rama de trabajo (§2.4). |

### 7.B Paquetes ya decididos (cada uno con su autorización)

**B-1 · Paquete P3/P3b — precio de carta con IVA incluido (D31)**
- Contenido: `20261002150000 abc_p3_catalogo_autoritativo` y `20261002170000 abc_p3b_espejo_lista_nube`. En QA desde el 2/10.
- **Cambia lo que se cobra**: el servidor partirá del precio con IVA incluido y obtendrá la base. Hasta hoy suma el impuesto sobre el precio del catálogo y la proyección copia el precio con IVA sin convertirlo (D31).
- Pedro asumió **por escrito** el riesgo de D31 **sin confirmar con asesoría** (decisión 2 del 3/10). Va **justo después** del primer paquete, con su **propia comprobación y su propia autorización**.
- En producción hay **1 producto** en el catálogo del TPV. El puente de pantalla ya está desplegado y se activará solo cuando exista la RPC.
- Comprobaciones previas: huellas, y repetir la foto. Cuidar el orden «servidor primero, aplicación después» (aquí la aplicación ya está).
- Aprovechar el despliegue para corregir el texto A3.

**B-2 · B06–B10 → primero a QA**
- 12 migraciones (`20260930100000` … `20261001110000`): B06 (4), B07 (3), B09 (2), B10 (3). **Nunca aplicadas en QA.** Solo probadas en una base desechable de CI (flujos `abc-f4-b04`, `b08`, `b09`, `b10-card-data`, `b11`, `b12`).
- Regla del plan: **no se promociona lo que QA no ha probado.** Hace falta que Pedro autorice aplicarlas en QA.
- **Bloqueo real:** B07, B09, B10 y B12 necesitan **proveedor de pagos, sandbox y documentación PCI** (D23: «elegirlo cuando haya presupuesto»). B06 (propinas, anticipos, fianzas) necesita la **política del negocio** y revisión con asesoría contable (D16).
- Pendiente antes de aplicarlas en QA: revisar que **ninguna `insert` de datos** (catálogo de políticas de B06) choque con los datos de QA.

**B-3 · PM09 — reconciliar la base de producción con QA**
- Estado: `BLOQUEADO_POR_DERIVA_DE_ESQUEMA` (`F5_PM09_PROD_PREFLIGHT_2026-10-02.md`): en producción faltan `registrar_venta_stock_pm09`, `revertir_venta_stock_pm09` y la RPC base `revertir_venta_stock`. El hardening de seguridad PM09 (`abc_f5_pm09_security_hardening`) está aplicado y validado en QA y **pendiente en producción**.
- Decisión de Pedro: **trabajo aparte, después del primer paquete**; primero preparar el plan de reconciliación (solo documento y pruebas locales).
- Ninguna migración posterior usa objetos de PM09, así que no bloquea B-1.

**B-4 · Limpieza de restos y deuda de registro** (A8, A9 de §7.A).

### 7.C Bloque A · TPV (A01–A12) — estado a 2/10 y qué falta

La mayoría está **verificada en el servidor, no en pantalla**. Lo que falta, por requisito:

- **A01 Recorrido real del servicio (P):** observar y medir un servicio real; ficha del piloto y mapa de recorridos sin ejecutar (rama F0). D01 dice «sin local piloto único»: **decidir con Pedro el local y el turno de la prueba real**.
- **A02 Pantalla de venta:** catálogo (en producción: 1 producto; P3 pendiente); recorrido por dispositivos; sin llamada a «actualizar línea».
- **A03 Cantidad y precio:** redondeo, fraccionables y repartos con los **12 vectores F1.5** (D17); la pantalla sin verificar.
- **A04 Variantes y suplementos:** la pantalla llama a las rutas `_configurada`; **no ejercitado**; catálogo con opciones.
- **A05 Estados del pedido:** pruebas negativas; sin llamada a cierre operativo.
- **A06 Cuentas abiertas y recuperación:** dos sesiones, reinicio y caducidad.
- **A07 Mesas y responsables:** **la pantalla no crea zonas ni mesas ni libera mesa.**
- **A08 Dividir y unir:** **la pantalla no une ni reparte por importe.**
- **A09 Descuentos y cortesías:** límites por rol (con D12 en 0 % y D19), efectos fiscales y aprobación en pantalla (aprobar/rechazar una autorización «solo se probó con pruebas de ejecución»).
- **A10 Notas y cambios (cocina):** sin ensayo; **sin enlace con stock ni impresión real**.
- **A11 Día operativo:** medianoche y cambio horario (octubre → marzo) sin probar.
- **A12 Pruebas funcionales del TPV:** recorridos completos por pantalla, dos sesiones, dispositivos.

### 7.D Bloque B · Cobros (B01–B12)

- **B01 Medios de pago y proveedores (P):** inventario real; por ahora **solo efectivo y tarjeta con datáfono independiente** (D20, D21); decidir banco/datáfono y si hacen falta transferencias u otros.
- **B02 Estados del pago:** notificación antigua, rechazo/cancelación, «declarado» frente a verificado.
- **B03 Una identidad por intento:** doble clic, recarga y **dos terminales reales**.
- **B04 Cobro de resultado desconocido:** consulta al proveedor, expiración, concurrencia.
- **B05 Efectivo y mixtos:** **dos cajas sobre el mismo saldo**; qué caja recibió cada importe.
- **B06 Propinas, anticipos y fianzas (P/B):** política (D16), pantalla, ensayo; 4 migraciones sin aplicar.
- **B07 Notificaciones del proveedor (B):** sin proveedor ni sandbox; 3 migraciones y función de borde sin aplicar/desplegar.
- **B08 Devoluciones económicas:** D13 hecho. Falta **eliminar o aislar la devolución heredada que repone stock** (D10) y probar el flujo con pagos reales. En producción: 0 reembolsos.
- **B09 Liquidaciones y disputas (B):** sin proveedor ni datos de liquidación; sin pantalla.
- **B10 Datos de tarjeta (B):** documentación y alcance **PCI del adquirente**.
- **B11 Pagos sin conexión:** decidido «solo online + borradores»; **corte de red real** y contingencia sin activar.
- **B12 Ensayo de pagos (B):** sin sandbox del proveedor.

### 7.E Bloque C · Caja y documentos (C01–C12)

- **C01 Cajas, terminales y sesiones:** relevo, vincular terminal y **apertura concurrente**. Producción: ninguna caja abierta, ninguna terminal de uso real documentada.
- **C02 Entradas y salidas trazables:** revisar que la pantalla use las funciones ABC y no las heredadas (PM-08 arregló los avisos falsos).
- **C03 Arqueo calculado en servidor (P):** **solo el contrato** (`F5_C03_CONTRATO_ARQUEO_SERVIDOR`); sin migración; la pantalla envía el efectivo base. **Siguiente pieza natural de caja.**
- **C04 Cierre provisional y definitivo:** en producción; falta probar con **caja real y con diferencia** (A4).
- **C05 Series y numeración, C06 Tipos de documento:** tablas y funciones en producción **sin emisor, sin pantalla y sin ensayo**; la clasificación necesita asesoría.
- **C07 SIF y modalidad fiscal (B):** **puerta fiscal cerrada a propósito** hasta asesoría, emisor y régimen.
- **C08 Conservar y corregir lo emitido, C09 Imprimir sin duplicar, C10 Entrega y copias:** sin ensayo ni pantalla; impresora real y descarga cruzada/caducidad/envío **no probados**.
- **C11 Conciliación explicable:** **dos circuitos mezclados** (el ensayo del 2/10 no pudo explicar −11); sin pantalla ni exportación.
- **C12 Ensayo del cierre:** noche, restauración y concurrencia; sin pantalla.

### 7.F Fiscal y asesoría (todo depende de que Pedro tenga asesoría)

- **D24 Asesoría fiscal:** Pedro **todavía no tiene**. Hay que enviarle F1.4 (territorio, régimen, tipo de documento, series, rectificación, conservación).
- **D25 Emisor fiscal:** aceptado «integrado y mantenido, no motor propio», pero no se puede elegir proveedor sin asesoría.
- **D26 Plazos fiscales:** la asesoría confirma el que aplica; el plan cita fechas de 2027 que hay que revalidar con fuente vigente.
- **D31:** confirmación del IVA incluido (hoy asumido por Pedro por escrito).
- **Hasta entonces:** no hay emisión fiscal posible; C07 sigue cerrada; el **contexto fiscal de producción es SIMULADO** (lo creó PM10).

### 7.G Stock, devoluciones y merma

- **D09** consumo de stock por flujo (barra: al confirmar la venta; sala: reservar al confirmar y consumir al preparar o servir; cobrar una cuenta ya consumida no vuelve a descontar), **D10** (un reembolso de dinero no repone stock; solo mercancía recuperable) y **D11** (cancelar una línea preparada registra merma): **recomendaciones sin confirmación registrada** en los documentos que leí. **«Hoy el circuito ABC no mueve stock.»** Es la regla que falta para conectarlo: A10, B08, I, T11.
- En producción conviven el stock autoritativo por ubicación (PM07) y el circuito ABC; conectarlos es una **fase propia** (F2 «dinero y stock» / etapa 3 en el plan), no iniciada según los documentos.

### 7.H Seguridad, plataforma y operaciones

1. **Protección contra contraseñas filtradas** (Auth): desactivada en QA y producción. Habilitar primero en QA, probar alta/cambio de contraseña, revisar el efecto sobre usuarios existentes y luego producción (`F5_ADVISORS_REMEDIACION_PRIORIZADA`, P0).
2. **Funciones `SECURITY DEFINER` públicas:** 130 ejecutables por `authenticated` en producción (136 funciones `SECURITY DEFINER` en QA, 24 sin `search_path` fijo). **No revocar en bloque**: hacer una lista blanca por función (`auth.uid()`, capacidad empresa/local, `search_path` fijo, sin acceso directo equivalente) y corregir solo las injustificadas con una migración compensatoria.
3. **24 tablas con RLS y sin política:** comprobar su ACL e intención; las internas se documentan, las expuestas necesitan política de mínimo privilegio. Además, **5 colecciones de la app** siguen sin política RLS (`F5_CORRECCION_AVISO_LOCALES_QA`).
4. **Edge functions de producción:** revisar las **14** (varias de prueba, varias con `verify_jwt: false`, `super-function` sin documentación); retirar las de prueba cuando proceda y documentar el resto. Es una decisión de **producción** → autorización de Pedro.
5. **Ruido en consola:** peticiones 404 y bloqueos de CSP de `auth-ux-patch.js` y `seleccion-neutral-patch.js` (no están en el repositorio ni los referencia `index.html`; `_headers` menciona el segundo; procedencia **no comprobada**, quizá inyectados por Netlify) y un aviso de React por claves repetidas en `Dashboard`.
6. **Copias de seguridad y recuperación** (§7.A, A7): plan de pago o procedimiento manual probado y programado (decisión de gasto).
7. **Coste de Netlify por despliegue:** sin comprobar.
8. **Registro de migraciones** con nombres/marcas inconsistentes entre QA y producción: documentado, no corregido.
9. **Alta de empresas y locales:** no hay procedimiento (política D12, modalidades, ajustes, permisos por defecto). Diseñarlo (producto multiempresa).
10. **«Propietario de la plataforma»** (Pedro configurando cualquier empresa): **no existe** el concepto; hoy configura el Propietario de cada empresa.
11. **Observabilidad:** los registros de `postgres_logs` fallaron hoy; revisar acceso y alertas.

### 7.I Capa de configuración (F6): lo que queda

- Pantalla: probar «aprobar/rechazar una autorización de descuento» en pantalla (solo cubierta con pruebas de ejecución).
- Roles nuevos con nombre propio: fuera de alcance por decisión (D03); retomar si Pedro lo pide.
- Defaults a nivel de empresa para modalidades (hoy solo por local).
- Equipos: hoy **solo registro**; ningún flujo (impresión, cobro, cajón) los lee.
- Alta de local/empresa que escriba D12 (§7.A, A6).
- Corregir el texto desactualizado (§7.A, A3).

### 7.J Decisiones abiertas de Pedro

| Decisión | Estado |
|---|---|
| Asesoría fiscal (D24/D25/D26/D31) | Pedro aún no la tiene |
| Proveedor de pagos y presupuesto (D23, D27) | «Elegirlo cuando haya presupuesto» |
| D09–D11 (stock/merma), D16 (propinas, anticipos, fianzas), D17 (redondeo con 12 vectores), D18 (reparto de céntimos) | Recomendaciones; **no consta confirmación escrita** |
| D19 (matriz de permisos con roles reales) | Cerrada como «plantilla por defecto ajustable»; faltan los `pendiente` de F1.3 (p. ej. si el cajero abre/cierra caja: la plantilla dice que sí) |
| Local y turno del primer recorrido real (A01) | Abierta |
| Plan de pago de Supabase / copias | Abierta (gasto) |
| Qué paquete sigue: P3/P3b, B06–B10 → QA, PM09 | Pedro decide el orden |
| «Propietario de la plataforma» (diseño aparte) | Abierta |
| Opción B de D12 (cambiar el valor por defecto en código) | «Queda para el momento de promocionar»; hoy opción A por datos |

### 7.K CI, calidad, documentación y deuda técnica

- **Actualizar F0** con el estado real (A01–A12 y B01–C12) y pasar cada fila a «verificado» **solo con aceptación de Pedro** (D05).
- **Documentación de trabajo dentro de `release`** (decisiones, hoja, resultado de la ventana, este informe): llevarla con `[skip netlify]`.
- **Contrato de A09 contra Postgres:** vigilar que no vuelva a fallar por carreras.
- **Fallo de infraestructura intermitente** `address already in use` (puerto 54322) en `pm33-p05-supabase-full`.
- **Manifiesto de CI:** mantenerlo al día (241 archivos / 224 activos).
- **Bundle `fuente.js`:** no hay código fuente por módulos; cada cambio es un parche sobre el recuperado. Evaluar si compensa reconstruir el origen.
- **Scripts de comprobación previa** (`F7_..._PREFLIGHT_SOLO_LECTURA…sql`, P0–P9 + P8b) y su contrato estático: **actualizar** a la nueva realidad de producción (los resultados esperados cambiaron) antes del siguiente paquete.
- **Lecciones de la ventana** a incorporar a los guiones (§6.3, §9).

### 7.L Aceptación, formación y puesta en marcha real

- **Plan de aceptación** por Pedro de A/B/C (matriz con recorrido real, entorno, SHA, usuario y quién acepta).
- **Formación/arranque del local productivo:** hoy el equipo no usa el circuito ABC en producción («producción no está en uso, solo he estado haciendo pruebas»). Definir el primer servicio real, quién abre/cierra caja (D19), y un plan de retirada si falla.
- **Datos reales de arranque:** catálogo real del local productivo (hoy 1 producto), equipos, terminales, cajas, usuarios y roles reales (hoy 3 Propietarios).

### 7.M Orden recomendado (propuesta, decide Pedro)

1. **Documentación y limpieza ligera** (§7.A, A11; §7.K) — sin tocar producción.
2. **P3/P3b** (con su comprobación y autorización) + corregir el texto A3 en el mismo despliegue.
3. **C03 arqueo en servidor** (contrato → migración → QA → producción) y **recorrido real de caja** con diferencia.
4. **Recorridos en pantalla de A y B con caja y cobro reales de bajo riesgo** (efectivo; sin tarjeta), aceptados por Pedro.
5. **PM09** (reconciliación de producción) y **hardening PM09**.
6. **Seguridad** (§7.H 1–4).
7. **Stock conectado** (D09–D11).
8. **B06–B10 → QA**, cuando Pedro tenga proveedor/presupuesto y asesoría.
9. **Fiscal** (C05–C08 con emisor integrado), cuando haya asesoría.

---

## 8. Procedimientos reutilizables

### 8.1 Foto de solo lectura de producción
`docs/plan-abc/F7_PROMOCION_PRODUCCION_PREFLIGHT_SOLO_LECTURA_2026-10-03.sql` (bloques P0–P9 y P8b). Solo `select`: recuentos, huellas md5, existencia de objetos, ACL. Su contrato `tests/cfg/f7-preflight-static-contract.mjs` comprueba que **no escribe** y que sus listas coinciden con las migraciones. **Actualizarlo** antes del siguiente paquete (§7.K).

### 8.2 Aplicar una migración a producción (con herramienta MCP de Supabase)
1. Leer el archivo **completo** (los de este plan no tienen `drop`, salvo C04 y pieza 2: esas, a mano).
2. Comprobar el estado previo exacto que exige su `do $$` de comprobación previa (huellas md5 de las funciones que reemplaza).
3. `apply_migration` con **el texto exacto** y un nombre en `snake_case`. La herramienta asigna **su propia marca** de versión.
4. Verificar (§6.4) y **parar a la primera diferencia**.
5. Si hay que aplicarla a mano (contiene `drop`): **desde el ordenador**, consulta nueva, pegar desde la URL cruda fijada al commit (`https://raw.githubusercontent.com/<repo>/<commit>/supabase/migrations/<archivo>`), comprobar primera/última línea y número de líneas; y después **verificar el texto** (el editor puede inflar espacios) y, si hace falta, **migración correctora**.

### 8.3 Humo transaccional con `ROLLBACK`
Un **único** bloque `do $$ … $$` que ejecuta una lista de pruebas con `execute` dentro de subtransacciones (`begin … exception when others then … end`), fija la identidad con `set_config('request.jwt.claims', '{"sub":"<uuid>","role":"authenticated"}', true)` (propietario, identidad ficticia y sin sesión), acumula los resultados en un `jsonb` y **termina siempre con `raise exception 'HUMO_RESULTADO:%', …`** para que **todo se anule**. Antes y después: **recuento + md5 de cada tabla afectada** (`md5(string_agg(x::text,'|' order by x::text))`); si cambian, **parar**. Quedan huecos en contadores internos (normal).

### 8.4 Copia manual de producción (Windows, Pedro)
- Requisitos: **CLI de Supabase** (probada la 2.113.0) y **Docker Desktop** en marcha. Conexión por el **Session pooler** (puerto **5432**, no 6543); la cadena de conexión se escribe con `Read-Host` en la propia consola de Pedro (**nunca** se comparte).
- Tres comandos: `supabase db dump --db-url $cadena -f roles.sql --role-only`, `… -f schema.sql` y `… -f data.sql --use-copy --data-only`.
- Guardar **fuera del repositorio** y en un segundo soporte. Comprobar tamaños (no 0 bytes). Es condición de entrada: **sin copia no se empieza**. Diferencias entre dos copias seguidas son normalmente filas de `auth.*`.
- No se ha probado restaurar.

### 8.5 Despliegue y marcha atrás
- Fusionar el PR de promoción en `release` (**método «merge»**, con la cabeza esperada) → un solo despliegue en Netlify. Comprobar `sha256` de `fuente.js` servido y que el árbol de `release` = árbol del candidato.
- Marcha atrás (**solo si la aplicación nueva falla**): en Netlify, «publicar de nuevo» el despliegue anterior. No toca la base de datos.
- Para commits que no cambian la aplicación: `[skip netlify]`.

### 8.6 Pantallas con Cowork (o equivalente de navegador)
Prompt **estricto**: URL; usar la sesión ya abierta (si pide credenciales, parar); lista de botones **prohibidos** (Guardar, Aplicar, Crear, Abrir caja/cuenta, Cobrar, Devolver, Aprobar, Rechazar, Enviar, Confirmar, Eliminar, Activar/Desactivar) y de lo **permitido** (menús, pestañas, leer); pasos numerados; qué entregar (texto exacto por pantalla, errores de consola, **lista de servidores de la pestaña Red**: solo producción). Si la herramienta falla, **parar** (no insistir más de dos veces). La aplicación puede guardar por sí sola su sincronización habitual (local activo, contexto, catálogo pendiente de ese equipo).

### 8.7 Identidad en SQL para pruebas
`select set_config('request.jwt.claims','{"sub":"<uuid del usuario>","role":"authenticated"}', true)` en la misma transacción que la llamada (`auth.uid()` lee `request.jwt.claims`). Útil para probar y para escribir con una **función oficial** (con auditoría) en vez de un `insert` directo.

### 8.8 Escribir un dato de configuración con la función oficial (ejemplo D12)
`public.abc_configurar_descuento_politica(operation_id, empresa, local, rol, user_id, max_percent, cortesía, solicitar, aplicar, autorizar, escalar, doble_aprobación, activa, motivo, día)` con la identidad del Propietario → deja evento `DESCUENTO_POLITICA_CONFIGURADA` con antes y después. Comprobar que no hay autorizaciones pendientes/aprobadas (el disparador `a09_lock_politica_config` las invalida).

---

## 9. Riesgos y trampas conocidas

1. **`drop` en una migración** → la herramienta MCP la cancela (tiempo agotado). Aplicarla a mano, desde el ordenador.
2. **Editor SQL del móvil** → espacios de sangría que rompen huellas exactas (`abc_reabrir_cierre_provisional`, `abc_tiene_capacidad`…). Siempre ordenador.
3. **Marcas de versión del registro ≠ archivo.** Comparar por nombre.
4. **Preflights con huella exacta** (piezas 2, 5, D13, PM07): si algo cambia una función (aunque sea un espacio), la migración **se niega** a aplicarse. Es intencionado.
5. **Producción sin copias automáticas.** Una migración atómica protege cada paso, pero un dato mal escrito no tiene vuelta atrás limpia salvo la copia manual.
6. **Repositorio público.** Nada de secretos ni datos. Los identificadores de proyectos Supabase y el nombre del local ya están en el repositorio.
7. **Detección de QA por dirección:** usar una URL que no sea `deploy-preview-N` en pruebas cae en **producción**.
8. **La aplicación depende del orden:** servidor antes que aplicación. Nunca desplegar la aplicación antes de las migraciones que usa (excepto puentes con degradación silenciosa como P3).
9. **El Encargado a 0 %** solo vale para los locales existentes; un local nuevo vuelve al 20 % del código (A6).
10. **Solo el Propietario reabre cierres** (D14) y el **Cajero/a no puede solicitar devoluciones por defecto** (D13): cambios de comportamiento que el equipo debe conocer antes de abrir.
11. **Finalizar un cierre con diferencia** exige tratar la diferencia (motivo y, sobre el umbral, aprobación del Propietario). Con umbral 0 € **cualquier** diferencia necesita aprobación.
12. **Fiscal:** el contexto fiscal de producción es **simulado**; la puerta C07 está cerrada. No emitir ni prometer documentos fiscales.
13. **La retirada de roles** (Churrero/a, Básico, Estándar) bloquea dar de alta o reactivar con esos roles (`rol_retirado:<rol>`); hoy nadie los tiene en producción.
14. **Cuentas y comanda de restos** (A10) siguen abiertas; no hay forma de cerrarlas desde el servidor.
15. **Datos de prueba de QA** (sesiones y cuentas abiertas) cuentan para los límites de caja en QA.
16. **Cowork puede fallar** por un servicio ajeno; las pulsaciones pueden registrarse a medias (se llegó por error a «Empresas y locales»): **siempre** comprobar la base después.

---

## 10. Registro de decisiones de Pedro (resumen)

**Hoja F1 (2–3/10):** D01 producto multiempresa sin local piloto · D02 modalidades configurables por empresa/local · D03 10 cajas simultáneas y permisos configurables (plantilla + ajustes) · D04 equipos configurables (ninguno hoy) · D05 acepta Pedro · D06 corte 00:00 `Europe/Madrid`, configurable por local · D07 catálogo de prueba en QA (hecho) · D08 datos ficticios · D12 el propietario configura el % del encargado, **valor inicial 0 %** (opción A por datos) · D13 devoluciones: propietario y encargado; el cajero solo con aprobación · D14 reabrir un cierre: solo el propietario · D15 toda diferencia se audita, exige motivo y requiere aprobación del propietario sobre un umbral (inicial 0 €, autoaprobación permitida) · D19 plantilla de permisos por rol, ajustable · D20 datáfono independiente con confirmación declarada · D21 solo efectivo y tarjeta · D22 solo con conexión · D23 proveedor configurable, elegido con presupuesto · D25 emisor integrado · D26 plazos con asesoría · D27 sin gasto nuevo · D28 0 despliegues en iteración y 1 productivo agrupado · D29 promoción con candidato exacto · D30 P1: 6 h y textos validados · D31 precio con IVA incluido (asumido por Pedro, sin asesoría).
**Sin confirmación escrita encontrada:** D09, D10, D11, D16, D17, D18.

**F7 (promoción, `F7_PROMOCION_PRODUCCION_DECISIONES_2026-10-03.md`, 28 decisiones):** alcance del primer paquete sin P3 ni B06–B10; P3/P3b aparte; B06–B10 primero a QA; D12 opción A en la ventana; PM09 aparte; un solo despliegue desde un PR nuevo; una sola autorización; ventana sin fecha fija (luego «hoy, ahora»); ejecuta Claude con Pedro presente; corrección de PM07 dentro del primer paquete; las 2 cuentas, 2 pedidos y la comanda **se dejan**; D30 cerrada; **descuento por importe: aclarar el texto** («antes de IVA»); D12 dentro de la autorización única; copia manual con la CLI; Netlify solo lectura; pantallas con Cowork «solo mirar»; marcha atrás de Netlify pre-autorizada solo si la aplicación falla; coste de Netlify asumido; hoja cerrada; lecturas previas con permiso aparte; ensayo de copia; **decisión 28: ventana ejecutada** (más: registro de C04 y pieza 2 sin filas a mano).

---

## 11. Índice de documentos y archivos clave

**Estado y resultado**
- `docs/plan-abc/F7_PROMOCION_PRODUCCION_VENTANA_RESULTADO_2026-10-04.md` — resultado de la ventana (cronología, tablas, incidencias, pantallas).
- `docs/plan-abc/F7_HOJA_AUTORIZACION_UNICA_PRIMER_PAQUETE_2026-10-04.md` — la hoja (las 21 migraciones, exclusiones, condiciones, frase, paradas).
- `docs/plan-abc/F7_PROMOCION_PRODUCCION_DECISIONES_2026-10-03.md`, `…_PREPARACION_…`, `…_FOTO_RESULTADO_…`, `…_PREFLIGHT_SOLO_LECTURA_….sql`.
- `docs/plan-abc/F7_CI_CAPA_CONFIGURACION_RESULTADO_2026-10-03.md` — CI y las carreras de A09.

**Decisiones y matrices**
- `F1_HOJA_DECISIONES_PEDRO_2026-10-02.md` (D01–D31 y respuestas), `F0_MATRIZ_A01_A12_…`, `F0_MATRIZ_B01_C12_…`.

**Capa de configuración (F6)**
- `F6_INVENTARIO_CAPA_CONFIGURACION_2026-10-02.md`, `F6_PIEZA1…`, `PIEZA2…`, `PIEZA3…`, `PIEZA4…`, `PIEZA5…`, `PIEZA6_PANTALLA_*`, `PIEZA6D_*`, `PIEZA6E_*`, `F6_D13_*`, `F6_PRUEBA_PREVIEW_*`, `F6_PM08_*`, `F6_COBRO_LECTURA_*`, `F6_A09_HISTORIAL_*`, `F6_PROMPT_COWORK_DEVOLUCIONES_2026-10-03.md` (modelo de prompt de Cowork).

**F3–F5**
- `A08_POSTFLIGHT_PROD_2026-09-24.md`, `A09_*`, `A11_CIERRE_*`, `A12_EVIDENCIA_QA_*`, `F3_A09_*`, `F4_B07…B12_*`, `F5_C03…C12_*`, `F5_PM09_*`, `F5_ADVISORS_*`, `F5_INVENTARIO_SECURITY_DEFINER_*`, `F5_ENSAYO_INTEGRAL_QA_*`, `F5_ETAPA1_SIEMBRA_QA_*`, `F5_P1_*`, `F5_P3_*`.

**Código y pruebas**
- `supabase/migrations/` (107 archivos; las 21 de hoy: `20260927203000` A08.2 … `20261003130000` PM07). `supabase/functions/`.
- `fuente.js`, `source-recovery/`, `index-storage-bootstrap.js`, `ui-context-bridge.js`.
- `tests/cfg/` (capa de configuración), `tests/f3`, `tests/f4`, `tests/f5/c03…c12`, `tests/ci/manifiesto_clasificacion.json`.
- `.github/workflows/` (238) y `.github/scripts/` (`build-netlify-publish.mjs`, `validar-manifiesto-ci.mjs`).

**Plan Maestro previo:** `docs/plan-maestro/` (PM01–PM33, Puntos 1–13, acta GO/NO-GO).

El **Plan ABC oficial** al que los documentos remiten (§2.5 taxonomía, §4.2, §23.2, §24) **no está en el repositorio**; Pedro lo tiene.

---

## 12. Glosario

- **ABC:** el plan de reconstrucción de TPV (A), cobros (B) y caja/documentos (C).
- **Capacidad:** permiso nombrado (`ABC_CAJA_OPERAR`, `ABC_CIERRE_REABRIR`…) resuelto por `private.abc_tiene_capacidad` (local → empresa → plantilla, con techo).
- **Día operativo:** día de negocio calculado por el servidor desde la hora de corte del local.
- **Huella:** md5 del cuerpo de una función (`prosrc` sin retornos de carro) o del texto de una migración.
- **Humo con `ROLLBACK`:** prueba que ejecuta de verdad y anula todo al final.
- **Foto:** conjunto de comprobaciones de solo lectura de producción (P0–P9).
- **Paquete:** conjunto de migraciones y aplicación que se promueven juntos con una autorización.
- **Preflight / comprobación previa:** `do $$` al inicio de una migración que se niega a aplicarse si el estado no es el esperado.
- **RPC:** función `public.*` invocable desde la aplicación por `/rest/v1/rpc/…`.
- **`SECURITY DEFINER`:** la función se ejecuta con los permisos de su dueño; por eso fija `search_path=''`.
- **Resto A10:** las 2 cuentas, 2 pedidos y la comanda de la prueba del 28/9 en producción.
- **QA / producción:** proyectos de Supabase distintos; QA solo datos ficticios.
- **Cowork:** agente de navegador de Claude para mirar pantallas.

---

## 13. Primeros pasos recomendados para Codex

1. **Leer** este informe, `F7_PROMOCION_PRODUCCION_VENTANA_RESULTADO_2026-10-04.md` y `F1_HOJA_DECISIONES_PEDRO_2026-10-02.md`.
2. **Preguntar a Pedro** qué acceso tiene Codex (Supabase de QA y producción, Netlify, GitHub) y qué paquete quiere atacar primero (§7.M). **No asumir** que se puede escribir en producción.
3. **Traer la documentación a `release`:** crear una rama nueva **desde `release`** (no desde `claude/vigilant-hawking-uji8l4`, que diverge), copiar los documentos de §7.A (A11) y abrir un PR **con `[skip netlify]`** en el mensaje del commit. No reutilizar el PR 119 (fusionado) ni fusionar el PR 118.
4. **Antes de cualquier paquete nuevo:** repetir la foto de solo lectura (con permiso), actualizar `…PREFLIGHT…sql` y su contrato, y redactar una hoja de autorización **nueva** con commit congelado.
5. **Si toca una migración con `drop`:** avisar desde el principio de que la herramienta MCP la rechaza y planificar la aplicación a mano **desde el ordenador**, más migración correctora si hace falta.
6. **No hacer sin autorización expresa y escrita de Pedro:** aplicar o desplegar nada en producción, tocar la copia de seguridad o el plan de Supabase/Netlify, contratar o ampliar servicios, insertar filas a mano en el registro de migraciones, limpiar los restos A10, desplegar o retirar edge functions, tocar P3/P3b, B06–B10 o PM09, ni abrir caja o hacer ventas/cobros reales en producción.
7. **Siempre:** responder a Pedro en español llano, en pasos cortos; dar los prompts de Cowork completos; verificar la base después de cualquier acción de navegador; y **parar a la primera diferencia**.
