# PM26 P07b — Defecto K corregido y Fase B de F preparada

## Estado

Implementación terminada y validada sin desplegar. El paquete parte del
cierre exacto P07a
`d62162fb6c512ea9fd237de1f2e2bb0ea5debeec`, corrige el destino público
hardcodeado del Defecto K y prepara en el cliente las dos mutaciones RPC del
aviso F. No aplica el SQL F en QA, no despliega ninguna Edge Function y no
invoca backends reales.

El gate aislado de reconstrucción del punto 1 quedó cerrado previamente en
`77a3b0581ee95f9cc7124d52c2581518022a9011`. Este cierre conserva ese gate y
lo incluye expresamente en el alcance acumulado de P07b.

**Actualización (PM26 P08b):** `crearLogicaPrefiltros` se extendió
después con una rama de producción (`esQA=false`) junto a la rama RPC
de QA preparada aquí, que permanece intacta y sin cambios de
comportamiento. El hash vigente de la fuente canónica y del bundle
servido está en `P08B_DEFECTO_L_CLIENTE_COORDINADO.md`. Esta sección y
el resto del documento se dejan intactos como registro histórico de lo
implementado en aquel momento.

## 1. Corrección del Defecto K

`PrefiltroPublico` ya no contiene una URL literal de un proyecto Supabase.
Las acciones `comprobar` y `enviar` pasan por un único adaptador que:

1. admite exclusivamente el slug `prefiltro-candidato` y esas dos acciones;
2. deriva el origen solo de la `window.NUBE_URL` que `index.html` publica
   antes de cargar el módulo;
3. exige una URL absoluta HTTP(S), sin credenciales, query, hash ni path;
4. rechaza el modo local sin backend;
5. en modo QA exige que el origen activo coincida con
   `window.__qaNubeUrl`;
6. construye `/functions/v1/prefiltro-candidato` mediante `URL`;
7. valida todo antes de obtener o ejecutar `fetch`.

Se conserva la semántica pública existente: `POST` JSON sin clave ni sesión.
No se crea un cliente Supabase en la ruta pública. La Edge Function de QA
continúa siendo el simulador deliberado `503`; P07b no la cambia ni la
despliega.

## 2. Fase B del aviso F

`crearLogicaPrefiltros` recibe la empresa y el local activos. Si falta el
nombre, la empresa o un local concreto, devuelve fallo antes de obtener el
cliente.

| Operación | Implementación preparada | Condición de éxito |
|---|---|---|
| Crear | `pm11_crear_prefiltro_candidato` | token hexadecimal minúsculo de 64 caracteres |
| Listar | `SELECT` directo de `prefiltros_candidatos` | lectura filtrada posteriormente por RLS |
| Eliminar | `pm11_eliminar_prefiltro_candidato` con empresa/local de la fila | `data === true` |

La auditoría solo se registra después de éxito inequívoco. El borrado no usa
el local seleccionado en ese instante: envía el contexto de la fila y deja
que la RPC vuelva a comprobar autorización y pertenencia. Ante error o
respuesta ambigua, la interfaz conserva el elemento y muestra el fallo.

## 3. SQL F endurecido, todavía sin aplicar

El archivo QA-only de F mantiene `BEGIN`/`COMMIT`, las RPC
`SECURITY DEFINER` con `search_path` vacío, `EXECUTE` retirado de `PUBLIC` y
concedido solo a `authenticated`, mutaciones directas revocadas y lectura
mediante RLS. El preflight vivo de P07c detectó después que QA también asigna
grants directos por defecto a `anon`, `authenticated` y `service_role`; antes
de cualquier aplicación se endureció el mismo artefacto para revocarlos todos
y volver a conceder exclusivamente `authenticated`.

P07b añade los ajustes pendientes:

- `SET LOCAL lock_timeout = '5s'` y
  `SET LOCAL statement_timeout = '30s'` inmediatamente después de `BEGIN`,
  antes del preflight;
- preflight independiente de solo lectura, terminado en `ROLLBACK`, cuyo
  bloque crítico coincide byte a byte con el embebido;
- comprobación de ambas columnas y ambas RPC para rechazar una aplicación
  previa parcial.

El SQL sigue fuera de `supabase/migrations` y no se ha enviado a
`apply_migration`. Su aplicación en QA pertenece a P07c y exige autorización
separada.

## 4. Pruebas

El contrato P07b valida por separado la fuente canónica, el build canónico y
el bundle servido. Para cada artefacto ejecuta en una VM:

- resolución de destino de producción simulado y QA simulado;
- configuración ausente, URL inválida, credenciales, query, hash, path,
  modo local, incoherencia QA, slug y acción no admitidos;
- precedencia de la acción autorizada sobre el payload;
- alta RPC con contexto exacto y auditoría posterior;
- rechazo de nombre/contexto/token inválidos y errores RPC;
- listado directo por `SELECT`;
- borrado RPC con contexto de la fila, éxito booleano estricto y rechazo de
  respuestas ambiguas.

Todos los destinos de red son dominios reservados `.invalid` y todas las
peticiones se interceptan con dobles en memoria. Se ejecutan mutaciones
negativas deliberadas que eliminan, una por una, la selección QA, la
derivación desde `NUBE_URL`, la RPC de alta, el booleano estricto de borrado
y el contexto de la fila.

El contrato P06h reproduce además el ciclo SQL en PostgreSQL efímero: los 15
casos de permisos/aislamiento, los grants directos por defecto observados en
Supabase, preflight positivo y negativos, rechazo de reaplicación, reversión y
reaplicación limpia.

## 5. Revisión de compatibilidad

Se revisó el changelog vigente de Supabase y su documentación actual de
Edge Functions y RPC. No aparece un cambio incompatible con este uso de
`fetch`, `supabase.rpc(nombre, argumentos)`, RLS o funciones
`SECURITY DEFINER`. La revisión también confirma que una tabla expuesta
necesita tanto grants como RLS, garantías ya expresadas en el SQL preparado.

Referencias:

- https://supabase.com/changelog
- https://supabase.com/docs/guides/functions
- https://supabase.com/docs/reference/javascript/rpc

## 6. Artefactos y SHA-256

| Artefacto | SHA-256 |
|---|---|
| Fuente canónica | `0ce793aa99215927d610a0058264eacba71e358d5d9a22aaa37705873c5fb258` |
| Bundle servido | `c2ac93d52526de2c9d1f445d415fec2a3b3e5796625bd05e04b8e5a77c265513` |
| Build canónico determinista | `ffeb46280a17d64620993bcbc2ed37c549fe8e04c08757bcee5218d45e886bd0` |
| SQL F QA-only | `7edbeefd92e82bb806265d29ccf3a2c30e411b4c4f5ec654f05e969ec19d5b1a` |
| Preflight independiente | `a224fc1dd0501f5336ff86acf8f81c0d6f329676a8913b5713ef5ebd540325d9` |

Dos builds canónicos consecutivos produjeron el mismo hash. Estos hashes
demuestran identidad del contenido comprobado; las garantías funcionales se
sustentan en los contratos positivos y negativos descritos arriba.

## 7. Riesgos y reversión

- Antes de aplicar F, el cliente preparado no puede completar las nuevas
  RPC en un entorno cuyo esquema aún no las tenga; por eso esta rama no se
  promueve y P07c debe coordinar esquema y Deploy Preview.
- La ruta pública QA seguirá mostrando error mientras su función sea el stub
  `503`; usar producción para suplir esa prueba queda prohibido.
- Reversión de P07b: revertir este paquete y regenerar/verificar el build.
- Reversión del SQL F: no procede porque no se aplicó. En P07c nunca será
  automática y dependerá de comprobar primero el estado de los datos.

## Alcance preservado

- Cero peticiones reales a QA o producción.
- Cero escrituras o migraciones Supabase.
- Cero despliegues Edge Functions.
- El gate aislado `pm26-p07b-source-recovery-check.yml` del punto 1 se
  conserva y forma parte de la lista cerrada de archivos acumulados.
- Los gates históricos P06e/P06f quedan acotados a su SQL de H y a sus SHA
  de cierre; un artefacto QA-only posterior ya no falsea su alcance.
- El ledger de configuración pública se regeneró con la herramienta oficial:
  las dos copias de la URL eliminada reducen los conteos esperados, sin añadir
  huellas ni alterar la deuda histórica.
- `index.html`, `reset-pruebas-preview.js` y `_headers` permanecen byte a
  byte iguales al baseline P07a; no se creó `netlify.toml`.
- No se tocó `main`, `release`, Netlify, producción ni TPV.
- Defecto E y Defecto L siguen pendientes.
- PM25 P02 continúa `PARCIAL/BLOQUEADO`.

```text
PM26_P07B_ESTADO=IMPLEMENTADO_VALIDADO_SIN_DESPLEGAR
PM26_P07B_DEFECTO_K_CORREGIDO=SI
PM26_P07B_URL_DERIVADA_NUBE_ACTIVA=SI
PM26_P07B_QA_FAIL_CLOSED=SI
PM26_P07B_PETICIONES_REALES=0
PM26_P07B_FASE_B_RPC_PREPARADA=SI
PM26_P07B_LISTADO_RLS_DIRECTO=SI
PM26_P07B_F_SQL_ENDURECIDO=SI
PM26_P07B_F_APLICADO_QA=NO
PM26_P07B_EDGE_QA_DESPLEGADA=NO
PM26_P07B_PRODUCCION_TPV_MAIN_RELEASE_NETLIFY_TOCADOS=NO
PM26_P07B_PM25_P02=PARCIAL_BLOQUEADO
```
