# PM26 P08h — Defecto L corregido en producción (cierre operativo)

## Estado

**CERRADO. Aplicado en producción real y verificado por lectura directa.**

Este documento no es un contrato probado en PostgreSQL local como los
anteriores de la serie P08 — no puede serlo. Certifica un hecho operativo
real ocurrido en el proyecto de producción (`L&A Suite`), ejecutado por el
propio usuario con su acceso administrativo, más el parche de cliente
desplegado por esta sesión con autorización explícita paso a paso. La
verificación de este documento es la lectura de solo consulta hecha
directamente contra producción inmediatamente después, registrada aquí.

## 1. Qué estaba bloqueado (P08e) y cómo se resolvió (P08g)

P08e documentó que la Alternativa A (bootstrap administrativo de
`membresias_usuario`) estaba bloqueada por falta de un catálogo backend
con autoridad real para `empresa_id`/`local_id`. P08g preparó ese
catálogo (`public.empresas`, `public.locales`, RLS activada, cero
políticas, `revoke all` de `authenticated`/`anon`/`public`) y una
plantilla de bootstrap, probados en PostgreSQL local aislado, sin tocar
ningún entorno real.

## 2. Lo ejecutado en producción (por el usuario, guiado paso a paso)

1. Aplicado `catalogo-empresas-locales-propuesta.sql` en el proyecto
   `L&A Suite` (producción real).
2. Aplicada la plantilla de bootstrap con valores reales del propio
   usuario: empresa `ADMIN` ("Cuenta de administración"), local `ADMIN`
   ("Local de administración"), membresía del usuario real con
   `todos_locales=true`, rol `Propietario`, activa.
3. Confirmado antes de aplicar: `public.prefiltros_candidatos` tenía 0
   filas reales — ningún dato en juego.
4. Aplicada `migracion-propuesta.sql` (el candidato ya cerrado en
   P08a–P08c) en el proyecto de producción, con su preflight embebido
   pasando (`PREFLIGHT_CATALOGO=PASS`, sin abortos).
5. Aplicado el parche de cliente ya cerrado en P08d
   (`tests/pm26/p08d-candidato-release/defecto-l-cliente.patch`) sobre
   la rama `release`, commit `9d54fc7ba76bd1285625f37b2940f99d26777ab8`,
   subido por esta sesión con autorización explícita para tocar
   `release` (la primera vez en todo PM26 que se autoriza).

## 3. Verificación por lectura directa en producción (esta sesión, justo después)

Contra el proyecto `L&A Suite` (id `flqercbgpgmmfaakrwkc`):

- `information_schema.columns` confirma `empresa_id` y `local_id`
  presentes en `public.prefiltros_candidatos`.
- `pg_policy` confirma que las 3 políticas reales
  (`prefiltros - propietario lee/crea/borra`) ya incluyen
  `private.la_tiene_local(empresa_id, local_id)` en su condición.
- `public.membresias_usuario` contiene exactamente 1 fila:
  `empresa_id='ADMIN'`, `local_id=null`, `todos_locales=true`,
  `rol='Propietario'`, `activo=true`.

Contra Netlify (proyecto `chic-entremet-9107cf`):

- El deploy del commit `9d54fc7` está en `state: ready`,
  `branch: release`, `context: production`, publicado sin errores (7
  reglas de cabecera procesadas, sin fallos).

Confirmado además por el propio usuario dentro de la aplicación real:
la función de prefiltro de candidatos carga correctamente tras el
despliegue; el aviso preexistente de "datos guardados de encargos" es
anterior y no está relacionado.

## 4. Qué NO cambió

- No se tocó `main`.
- No se cerró ni fusionó la PR #38.
- No se escribió nada en QA ni en TPV.
- El catálogo de empresas/locales sigue con una única fila técnica
  (`ADMIN`); no representa todavía ningún cliente real. Ampliarlo según
  lleguen clientes reales queda como trabajo futuro, no incluido aquí.

## 5. Marcadores de cierre

```
PM26_P08H_ESTADO=CERRADO_EN_PRODUCCION
PM26_P08H_MIGRACION_APLICADA_EN_PRODUCCION=SI
PM26_P08H_MEMBRESIA_REAL_CREADA=SI
PM26_P08H_PARCHE_CLIENTE_DESPLEGADO=SI
PM26_P08H_RELEASE_COMMIT=9d54fc7ba76bd1285625f37b2940f99d26777ab8
PM26_P08H_NETLIFY_DEPLOY_CONTEXT=production
PM26_P08H_NETLIFY_DEPLOY_STATE=ready
PM26_P08H_VERIFICADO_POR_LECTURA_DIRECTA_PRODUCCION=SI
PM26_P08H_REGRESION_VISIBLE_EN_APP=NO
PM26_P08H_MAIN_TOCADO=NO
PM26_P08H_PR_38_CERRADA_O_FUSIONADA=NO
PM26_P08H_CATALOGO_EMPRESAS_CON_CLIENTES_REALES=NO
```

## 6. Siguiente trabajo (fuera de este cierre, requiere autorización propia)

Si en el futuro se quiere dar de alta empresas/locales reales de
clientes (más allá de la fila técnica `ADMIN`), el mecanismo ya existe
y es el mismo: aplicar `bootstrap-membresia-plantilla.sql` con los
valores reales de cada cliente, ejecutado por el propio usuario. No
queda autorizado por este documento ningún cambio de la interfaz ni
ninguna automatización de ese alta.
