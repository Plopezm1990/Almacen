# PM26 P07c — Aviso F aplicado en QA y Deploy Preview validado

## Estado

**Cerrado con limitación de observación visual.** El usuario autorizó aplicar
el aviso F exclusivamente en **L&A Suite QA** y publicar el commit necesario en
la rama técnica. La migración se aplicó una sola vez, el backend se verificó
con catálogo y pruebas funcionales reales, y Netlify generó un Deploy Preview
`ready` cuyo `commit_ref` coincide con el SHA publicado.

La página del preview está protegida por SSO de equipo. El intento de acceso
interactivo mediante Google OAuth devolvió `502 Bad Gateway` y una pestaña
nueva confirmó que no se había creado sesión. No se rebajó la protección, no
se intentó eludirla y este error de autenticación no se presenta como un fallo
del deploy. La integración se cubrió mediante el contrato del cliente sobre
los tres artefactos JavaScript, el esquema/RPC real de QA y la identidad exacta
del artefacto desplegado.

## 1. Versión publicada antes de escribir en QA

El primer preflight vivo descubrió que los privilegios por defecto de
funciones en QA concedían `EXECUTE` directamente a `anon`, `authenticated` y
`service_role`. Revocar solo `PUBLIC` habría dejado expuestas las dos RPC
`SECURITY DEFINER`. Se detuvo el proceso antes de escribir y se endureció el
SQL para revocar los cuatro ámbitos y volver a conceder únicamente
`authenticated`.

Versión endurecida publicada y validada antes de aplicar:

- commit: `a20e37d8ac74e49a31c5a9243d1256e88428366e`;
- árbol Git: `4c12baa76fdaf6d1572848e98bf62f5aeb322d5e`;
- padre P07b: `1ee5b10cc9b129f3c5ef33f28db39dea9899f969`;
- SQL F QA-only SHA-256:
  `7edbeefd92e82bb806265d29ccf3a2c30e411b4c4f5ec654f05e969ec19d5b1a`;
- preflight independiente SHA-256:
  `a224fc1dd0501f5336ff86acf8f81c0d6f329676a8913b5713ef5ebd540325d9`.

Los tres workflows activados por el commit terminaron en `success` antes de
la aplicación: P01, P06h y P07b. Los dos últimos ejecutaron su arnés PostgreSQL
aislado con los grants por defecto observados en QA.

## 2. Preflight y aplicación única

La identidad del destino se redescubrió por nombre y estado inmediatamente
antes de actuar: **L&A Suite QA**, `ACTIVE_HEALTHY`. Producción y TPV aparecían
como proyectos distintos y nunca se seleccionaron.

El preflight independiente de solo lectura terminó sin excepción y confirmó:

- ausencia de las tres políticas propias de producción;
- ausencia de `empresa_id`, `local_id`, la política nueva y las dos RPC;
- tabla `prefiltros_candidatos` vacía;
- migración P07c ausente del historial.

Se realizó una única llamada a `apply_migration` con el contenido íntegro del
SQL publicado. Resultado: `success: true`. Supabase registró una sola entrada:

- versión: `20260910175504`;
- nombre: `pm26_p07c_aislamiento_prefiltros_candidatos_qa`.

Tras aplicar, el mismo preflight fue rechazado como estaba diseñado con
`PREFLIGHT_FALLO`, al detectar `empresa_id`/`local_id`. No hubo una segunda
aplicación.

## 3. Verificación posterior de catálogo y privilegios

El estado real de QA quedó así:

| Garantía | Resultado |
|---|---|
| `empresa_id` y `local_id` | `text NOT NULL`, sin default |
| RLS | activado |
| Política | `prefiltros_candidatos_select_gestion`, `SELECT`, solo `authenticated` |
| Condición RLS | `private.pm11_puede_ver_personal(empresa_id, local_id)` |
| RPC crear/eliminar | `SECURITY DEFINER`, propietario `postgres`, `search_path` vacío |
| `EXECUTE` RPC | `authenticated=true`; `PUBLIC=false`; `anon=false`; `service_role=false` |
| Tabla para `authenticated` | `SELECT=true`; `INSERT/UPDATE/DELETE=false` |
| Tabla para `anon` | las cuatro operaciones `false` |
| Filas al finalizar | `0` |

Las huellas de todos los objetos no objetivo fueron idénticas antes y después:

| Catálogo no objetivo | MD5 antes = después |
|---|---|
| Columnas | `813dc4d06569f7430f41eb05f79d6f0f` |
| Índices | `9d05da57749a5029a0de7ef8a76f5f59` |
| Políticas | `f2ab89a581cd141c90feaa265ff520ea` |
| Triggers | `a8d3db545254d7886cccb762defc8c9e` |
| Funciones | `4e13253006cf43c01e1ced2f7d7e3a4d` |
| Constraints | `c7d70a8874394003a0e1f3bf2c724345` |
| ACL de relaciones | `1bbedbd3578d133371c1578f48f0ed15` |

## 4. Pruebas funcionales reales en QA

Se usaron identidades QA ya existentes y claims transaccionales; no se creó ni
se modificó ninguna cuenta o contraseña. Resultado: **14/14 PASS**.

1. Las cuatro identidades y membresías esperadas existían.
2. Propietario A podía ver su empresa/local.
3. Propietario A podía mutar su empresa/local.
4. Propietario A no podía ver la empresa B.
5. Propietario A no podía mutar la empresa B.
6. Cajero/a A1 no podía usar las operaciones de gestión de personal.
7. La identidad inactiva no podía ver ni mutar.
8. La RPC de alta devolvió un token hexadecimal de 64 caracteres y la RPC de
   baja lo eliminó con `true`; no quedó residuo.
9. Con RLS real, Propietario A vio su fixture A y no vio la fixture B; toda la
   transacción se revirtió y dejó 0 filas.
10. El alta cruzada A→B fue rechazada con
    `personal_contexto_no_autorizado`.
11. El nombre vacío fue rechazado con
    `prefiltro_candidato_nombre_requerido`.
12. El borrado de un token B declarando contexto A fue rechazado con
    `prefiltro_candidato_contexto_no_coincide` y quedó sin residuo.
13. Un `INSERT` directo como `authenticated` fue rechazado por permisos.
14. `anon` no pudo ejecutar la RPC de alta.

## 5. Asesores posteriores

El asesor de rendimiento no emitió ningún hallazgo sobre el objeto P07c. Los
12 índices sin uso son avisos `INFO` ya existentes y no se eliminaron.

El asesor de seguridad marcó las dos RPC nuevas dentro del aviso genérico
“signed-in users can execute SECURITY DEFINER function”. Es intencional: son la
API autenticada del módulo, no aceptan una identidad nula y delegan la
autorización de empresa/local/rol en `private.pm11_puede_mutar_personal` antes
de mutar. Se verificaron además el `search_path` vacío y la matriz exacta de
grants. Referencia del asesor:
[funciones SECURITY DEFINER ejecutables por usuarios autenticados](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).

Los dos avisos `RLS enabled no policy` restantes pertenecen a
`operaciones_procesadas` y `prefiltro_limites`, no a
`prefiltros_candidatos`. La protección de contraseñas filtradas sigue siendo
el aviso G previamente inventariado, fuera de P07c.

## 6. Deploy Preview

Se abrió el PR en borrador `#38`, rotulado **NO MERGE**, únicamente para que
Netlify creara un preview no productivo. No cambió `main`.

Netlify informó:

- contexto `deploy-preview`;
- estado `ready` y sin mensaje de error;
- `commit_ref` exactamente
  `a20e37d8ac74e49a31c5a9243d1256e88428366e`;
- deploy `6aa2f10c4ec4c000082af834`;
- 112 archivos nuevos, 6 reglas de cabecera procesadas;
- despliegue automático, sin Netlify Functions ni Edge Functions.

Como el deploy apunta al árbol Git verificado, los artefactos servidos se
corresponden con estos hashes:

| Artefacto | SHA-256 |
|---|---|
| Fuente canónica | `0ce793aa99215927d610a0058264eacba71e358d5d9a22aaa37705873c5fb258` |
| `fuente.js` servido | `c2ac93d52526de2c9d1f445d415fec2a3b3e5796625bd05e04b8e5a77c265513` |
| Build canónico | `ffeb46280a17d64620993bcbc2ed37c549fe8e04c08757bcee5218d45e886bd0` |
| `index.html` | `fc81d9e1aae06559f587c91d0fa454899152adc52982c77dc79858b1cce6b251` |
| Barrera del preview | `91e9859577921aa0e35fd0fbdd575c32e9194aba7224a5d76296e6e87b838b22` |
| Cabeceras | `1d605f37f65ed1584cd310dcf25db4d83bb0078e815b272fc918766963b9f848` |

El contrato P07b ejecuta la lógica de K y F sobre fuente canónica, build y
bundle servido, con todas las peticiones interceptadas. La barrera de preview
se carga antes de configurar la nube, activa QA solo en hosts de preview y
bloquea cualquier petición al host productivo que no pertenezca a la allowlist
de Edge Functions conocidas.

## 7. Alcance preservado

- `main` y `release` siguen congeladas en su SHA previo.
- No hubo escritura en Supabase producción ni TPV.
- No se desplegó ni modificó ninguna Edge Function.
- No se desplegó producción en Netlify.
- El PR permanece en borrador y no debe fusionarse como parte de P07c.
- El aviso G, el Defecto E, el Defecto L y PM25 P02 conservan su estado previo.

```text
PM26_P07C_ESTADO=CERRADO_CON_LIMITACION_VISUAL_SSO
PM26_P07C_PROYECTO=L&A_SUITE_QA
PM26_P07C_PREFLIGHT_ANTES=PASS
PM26_P07C_APPLY_MIGRATION=SUCCESS
PM26_P07C_MIGRACION_REGISTRADA_UNA_VEZ=SI
PM26_P07C_PREFLIGHT_DESPUES=RECHAZADO_COMO_ESPERADO
PM26_P07C_CATALOGO_Y_GRANTS=PASS
PM26_P07C_PRUEBAS_FUNCIONALES_QA=14_DE_14_PASS
PM26_P07C_FILAS_RESIDUALES=0
PM26_P07C_OBJETOS_NO_OBJETIVO_SIN_CAMBIOS=SI
PM26_P07C_PREVIEW=READY_SHA_EXACTO
PM26_P07C_PREVIEW_UI=NO_VERIFICABLE_POR_SSO_GOOGLE_502
PM26_P07C_EDGE_FUNCTIONS_DESPLEGADAS=NO
PM26_P07C_PRODUCCION_TPV_MAIN_RELEASE_TOCADOS=NO
```
