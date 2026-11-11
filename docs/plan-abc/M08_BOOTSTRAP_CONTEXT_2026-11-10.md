# M-08 — Bootstrap y contexto operativo

Fecha de revalidación: 2026-11-10  
QA: `qjqorixtkilwsndqayyx`  
Producción: `flqercbgpgmmfaakrwkc`

## Estado

M-08 sigue abierto, pero la causa queda acotada. La función
`public.bootstrap_owner_instalacion(text,text)` y la tabla privada de estado
existen en ambos entornos. La representación textual desplegada difiere, pero
la comparación semántica que elimina comentarios de línea y espacios coincide
en QA y producción. No se ha reproducido una instalación completa desde el
navegador en esta revisión.

## Evidencia medida

La consulta de solo lectura confirmó en QA y producción:

- existe `private.la_instalacion_estado`;
- contiene una fila con generación no nula;
- existe `public.bootstrap_owner_instalacion(text,text)`;
- la ejecución está concedida a `authenticated` y no a `anon` ni a `service_role`.

La comparación actual de `pg_proc.prosrc` devuelve:

| Entorno | MD5 del cuerpo | MD5 normalizada del cuerpo | Longitud |
|---|---|---|---:|
| QA | `77104240e60fa4f5b38a2583e58808d6` | `977eb2748752ba4d101bfa278ee509db` | 3.997 |
| Producción | `2ac268ea336339890f9541df88aa2325` | `bc6019e27e50cf1597d8e8e75deb804e` | 3.356 |

La afirmación anterior de que la huella normalizada de ambos cuerpos era igual queda corregida por esta medición actual. No se presenta la divergencia como un fallo funcional concreto sin comparar y ejecutar los caminos afectados, pero sí como una diferencia de procedencia y definición que impide certificar equivalencia.

### Corrección posterior de la normalización

La tabla anterior normalizaba espacios, pero conservaba los comentarios de línea
que solo están presentes en la copia canónica de QA. La comparación posterior,
que elimina comentarios de línea y espacios antes de calcular la huella,
devuelve:

| Entorno | MD5 bruto de `pg_get_functiondef` | MD5 semántica sin comentarios/espacios |
|---|---|---|
| QA | `029b4839e9ae2260b4e2cfed3aeb995b` | `88dde7f01bb445f2608f7e991838e1fa` |
| Producción | `208f62fdfc336e2c109e0997ae9d05aa` | `88dde7f01bb445f2608f7e991838e1fa` |

La conclusión correcta es, por tanto, **equivalencia semántica de esta función
concreta, pero no identidad textual ni de procedencia**. Esto corrige la
afirmación anterior de que la huella normalizada seguía siendo distinta.

## Límites y no acciones

No se invocó el bootstrap en producción. Tampoco se invocó en QA durante esta revalidación: la función puede crear empresa, local y membresía cuando se cumplen sus precondiciones, y no se necesitaba crear más datos sintéticos para medir la divergencia. No se modificaron usuarios, empresas, locales ni membresías.

La migración versionada de N-02 contiene una definición canónica y el contrato local la protege, pero eso es **probado por código**; no acredita que producción la tenga aplicada desde esa migración. Cerrar M-08 requiere una reproducción controlada del flujo de instalación en QA y decidir si la identidad textual/procedencia debe reconciliarse en una ventana autorizada.

## Comprobación de precondiciones QA — 2026-11-10

Antes de intentar una reproducción adicional se midió, sin invocar el
bootstrap, si QA conservaba alguna instalación determinista completa que
permitiera probar el camino idempotente sin escribir:

| Medición | Resultado |
|---|---:|
| Propietarios activos considerados | 14 |
| Instalaciones deterministas completas para esos propietarios | 0 |
| Estados no idempotentes o parciales | 14 |

La función aborta cuando encuentra cualquier empresa, local o membresía en un
estado que no sea exactamente el núcleo determinista del propietario. Como QA
ya tiene estado empresarial y ninguno de los 14 propietarios satisface la
ruta idempotente, no se invocó la función: hacerlo no sería una reproducción
limpia y podría crear o alterar una empresa, un local y una membresía de
prueba. Esta medición es **medida** en QA y explica por qué la reproducción
E2E del bootstrap requiere una base QA vacía o una rama Supabase aislada, no
los datos sintéticos vivos del proyecto compartido.

El límite permanece: no hay una reproducción completa del bootstrap en esta
base QA compartida y no se creó una rama nueva ni se generaron datos para
fabricarla. Producción siguió en solo lectura.

## Reproducción local aislada — 2026-11-10

Se añadió el contrato `tests/m08/m08-bootstrap-functional-contract.mjs`, que
ejecuta en PGlite una copia aislada del fixture
`tests/bootstrap-owner-post-reset.sql` y de la migración versionada del
bootstrap. El script comprueba el primer arranque, el reintento idempotente y
la atomicidad ante un fallo de la tercera escritura; termina verificando que
el rollback no deja empresa, local ni membresía y devuelve el estado
`needs_setup`.

Resultado reproducido localmente:

```text
M08_BOOTSTRAP_LOCAL_FUNCTIONAL=PASS
```

Esta prueba es **reproducida localmente**, no una acreditación de QA ni de
producción. PGlite es PostgreSQL 18 WASM y no sustituye el contrato de
PostgreSQL 16 ni una ejecución autenticada en un entorno desplegado. M-08
permanece abierto hasta disponer de esa reproducción de entorno y de una
decisión explícita sobre reconciliar la procedencia textual desplegada.

## Reproducción QA del guardado de preflight — 2026-11-11

La definición desplegada en QA se volvió a leer antes de ejecutar nada. El
proyecto compartido ya contenía `12` empresas, `14` locales, `27` membresías y
`25` perfiles, por lo que no cumplía las precondiciones de primer arranque.

Con un propietario QA activo y nombres sintéticos que no se conservarían, se
invocó el bootstrap dentro de una transacción controlada. La función devolvió
el error esperado:

```text
PREFLIGHT_FALLO: estado empresarial no vacío o inconsistente
```

La lectura posterior confirmó `0` empresas y `0` locales con esos nombres, y
los totales permanecieron en `12` empresas, `14` locales y `27` membresías.
Por tanto, no se creó ningún dato sintético ni se modificó la instalación QA.

Esta evidencia es **medida y reproducida en QA** para la barrera de preflight y
su no-mutación en un estado compartido no vacío. No demuestra el primer
arranque, la ruta idempotente ni el flujo autenticado del navegador. M-08
continúa abierto hasta reproducir una instalación limpia en una base QA vacía o
en una rama aislada.

## Infraestructura aislada no disponible por el plan — 2026-11-11

Tras la confirmación del coste de una rama aislada, se intentó crear
`la-suite-audit-m08-20261111` sobre el proyecto QA. Supabase rechazó la
operación porque el proyecto no está en Pro o superior. No se creó la rama,
no se generó ningún coste y no cambió el proyecto QA compartido.

Se consultó como alternativa un proyecto temporal independiente en la misma
organización; la cotización devuelta es `0 USD/mes`. Ese proyecto no se crea
automáticamente: requiere una autorización separada por tratarse de un
recurso externo distinto de la rama inicialmente solicitada.

Hasta disponer de esa autorización o de PostgreSQL 16 local operativo, M-08
conserva la reproducción local PGlite y la barrera QA compartida, pero no una
reproducción limpia desplegada.

La autorización para crear el proyecto temporal se intentó ejecutar el
2026-11-11. Supabase la rechazó porque el propietario ya alcanzó el límite de
`2` proyectos gratuitos activos. No se creó ningún proyecto, no se pausó ni
eliminó ninguno existente y no se generó coste. Superar este límite exigiría
pausar/eliminar un entorno existente o actualizar el plan, decisiones que quedan
fuera de esta auditoría sin autorización específica.

