# PM26 P08d — Candidato exacto de despliegue del Defecto L

## Estado

**CANDIDATO PREPARADO. NO APLICADO Y NO DESPLEGADO.** El usuario
autorizó exactamente esto: comparar `release` con el cliente preparado
en P08b/P08c, crear un parche mínimo y reproducible basado directamente
en `release`, probarlo sobre un worktree temporal y documentarlo —
subiendo el commit únicamente a `claude/pm26-preparacion-tecnica`.

No se aplicó `migracion-propuesta.sql`. No se escribió en Supabase QA,
producción ni TPV. No se modificó ni se subió nada a `release` ni a
`main`. No se desplegó en Netlify. No se fusionó ni cerró la PR #38. El
Defecto L **sigue sin aplicarse en producción**.

P08c permanece cerrado. P08d solo prepara el artefacto exacto que
posteriormente podrá autorizarse para `release`.

---

## 1. Comparación completa: `release` frente a la rama técnica

Base: `release` = `93a570badba1c5375febfbddc1dffdbcef003dcd`
Rama técnica: `5fe9c63da20f740b76e47d8dfef15ebe529e6ed3` (cierre de P08c)

La fuente canónica difiere entre ambos en **390 hunks / ~16.000 líneas
de diff**. Publicar la rama técnica sobre `release` arrastraría todo
eso. Inventario de lo ajeno al Defecto L, verificado por presencia de
sus marcadores:

| Paquete | Marcador | En `release` | En rama técnica |
|---|---|---|---|
| Defecto K (destino público derivado) | `origenSupabasePublicoPM26` | 0 | 3 |
| Defecto K (adaptador público) | `invocarFuncionPublicaPM26` | 0 | 3 |
| Aviso F (RPC de QA) | `pm11_crear_prefiltro_candidato` | 0 | 2 |
| Señal QA (usada por K y por el cliente dual) | `__modoPruebasQA` | 0 | 3 |
| Señal QA (origen QA esperado) | `__qaNubeUrl` | 0 | 1 |

Más el resto de paquetes acumulados (PM21–PM26) que `release` no tiene.

### 1.1 Consecuencia de diseño, explícita

El cliente de P08b/P08c es **dual**: `crearLogicaPrefiltros({...,
esQA })` elige entre la ruta QA por RPC (aviso F) y la ruta de
producción por RLS directo. Esa dualidad **solo tiene sentido en la
rama técnica**, porque:

- `release` no tiene las RPC `pm11_*` (aviso F nunca se aplicó allí), y
- `release` no tiene `window.__modoPruebasQA` (señal introducida por el
  Defecto K).

Portar el cliente dual a `release` obligaría a arrastrar K y F. Por eso
el candidato de P08d **no incluye la rama `esQA`**: aplica únicamente la
ruta de producción. El requisito «la ruta QA conserva íntegramente sus
RPC y no realiza mutaciones directas» se cumple porque en `release` no
existe ninguna ruta QA que tocar — y el contrato lo comprueba de forma
activa: si alguien introdujera una mutación directa dentro de un bloque
`if (esQA)`, la comprobación falla (demostrado con una mutación
negativa, sección 4).

### 1.2 ¿Hubo alguna dependencia imprescindible?

**No.** El cambio del Defecto L necesita exactamente dos cosas del
contexto, y ambas **ya existen en `release`**:

| Necesita | Presencia en `release` |
|---|---|
| `empresaDelLocalActivo` (con `.id`) | 22 ocurrencias, ya usado por otros módulos |
| `localActivoId` | 384 ocurrencias |

Ambas están disponibles en `GestionAlmacen`, en el mismo ámbito y
justo encima de la llamada a `crearLogicaPrefiltros`. No se necesita
nada de K, F ni H.

## 2. El parche

`tests/pm26/p08d-candidato-release/defecto-l-cliente.patch` — 110
líneas, 8 hunks, **2 archivos**:

- `fuente.js`
- `source-recovery/fuente-recuperado.js`

No crea, borra ni renombra ningún archivo. Se aplica con `-p1`.

### 2.1 Líneas semánticas modificadas (4 por archivo)

| # | Ubicación | Antes | Después |
|---|---|---|---|
| 1 | Call site en `GestionAlmacen` | `crearLogicaPrefiltros({ registrarAuditoria })` | añade `empresaId: empresaDelLocalActivo?.id \|\| null` y `localId: localActivoId \|\| null` |
| 2 | Firma de `crearLogicaPrefiltros` | `{ registrarAuditoria }` | `{ registrarAuditoria, empresaId, localId }` + 3 líneas de comentario sobre el despliegue coordinado |
| 3 | `crearPrefiltro` → `INSERT` | `{ token, candidato_nombre, estado }` | añade `empresa_id: empresaId, local_id: localId` |
| 4 | `eliminarPrefiltro` → `DELETE` | `.delete().eq("token", token)`, devuelve `!error` | `.delete().eq("token", token).select()`, exige `data.length === 1`, devuelve `true`/`false` |

Nada más. `listarPrefiltros` y `generarToken` quedan intactos, y la
firma pública `eliminarPrefiltro(token, candidatoNombre)` **no cambia**,
así que ningún llamador de `release` se ve afectado.

### 2.2 Por qué el borrado necesita `.select()`

Un `DELETE` bloqueado por una política `USING` no devuelve error en
PostgREST/Postgres: simplemente no afecta ninguna fila. Sin pedir las
filas devueltas, el cliente trataría un borrado bloqueado como un éxito.
Exigir exactamente una fila es lo que distingue ambos casos.

## 3. Huellas y base exacta

| Artefacto | SHA-256 |
|---|---|
| Commit base de `release` | `93a570badba1c5375febfbddc1dffdbcef003dcd` |
| Parche | `ea03e3e72fe778db50e930c6a0d2793529627ae8f545f64f5f8ed550149b222b` |
| `fuente.js` en `release` (antes) | `9e175b89fb36abeac4e94c56a5ba35f65adb2ef6589c600f723821da1db1e216` |
| `fuente.js` parcheado (después) | `0e45bc8d4175771b8bfd1e74ad0aa12fd39853a1431dc6ca702470882ae6c4c2` |
| Fuente canónica en `release` (antes) | `ae27f0b0d06fe52ae8cdd5bfbb8a89ece1a1f9874a68a87b1d55af9403885ea3` |
| Fuente canónica parcheada (después) | `5c67bd9deea407f9c9b4a347ec64b6f11259fbec6821ef5e645f8f468807750a` |
| Build determinista de la canónica parcheada | `22bc3d112d6d9604e9fccd3ec5f9ebc640a69ae4229328ad914256056873cc32` |

## 4. Pruebas ejecutadas sobre un worktree temporal desde `release`

`tests/pm26/p08d-candidato-release/validar-candidato.sh` crea un
worktree en `HEAD` separado desde el SHA exacto de `release`, lo usa y
lo destruye. Nunca modifica `release` ni `main`.

| Prueba | Resultado |
|---|---|
| `git apply --check` | PASS |
| Aplicación limpia (solo los 2 archivos, ambos JS válido) | PASS |
| Comportamiento del Defecto L presente en ambos artefactos | PASS |
| Reversión limpia — árbol **idéntico** a `release` | PASS |
| Reaplicación tras revertir (idempotencia) | PASS |
| Build reproducible (dos builds, mismo hash) | PASS |
| Regresión: **113 contratos** de `release`, 0 fallos | PASS |

La reversión se comprueba **antes** de construir y de ejecutar la
regresión, con el árbol todavía intacto: varios contratos de
`tests/pm13` regeneran como efecto colateral sus propios JSON de
evidencia, y así ese ruido ajeno no se confunde con un residuo del
parche.

### 4.1 Mutaciones negativas

`tests/pm26/p08d-contract.mjs` comprueba que las verificaciones no son
vacías: el `release` sin parchear **falla** las comprobaciones, y cada
una de estas 6 mutaciones se detecta con su motivo exacto:

1. `INSERT` sin `empresa_id`/`local_id`.
2. Borrado sin `.select()`.
3. Borrado sin exigir exactamente una fila.
4. Firma sin `empresaId`/`localId`.
5. Call site que no pasa la empresa activa.
6. Mutación directa (`insert`) introducida dentro de un bloque
   `if (esQA) { ... }`.

### 4.2 Escáner de secretos

`release` no incluye `tools/seguridad/` (es posterior, de PM26 P02), así
que el escáner se ejecuta desde la rama técnica **sobre el parche**, que
es donde vive todo el contenido nuevo: 0 secretos reales, 0
identificadores internos.

## 5. Procedimiento exacto de aplicación y reversión

Aplicar (sobre un checkout en el SHA de `release`):

```bash
git apply --check tests/pm26/p08d-candidato-release/defecto-l-cliente.patch
git apply         tests/pm26/p08d-candidato-release/defecto-l-cliente.patch
node --check fuente.js
node --check source-recovery/fuente-recuperado.js
```

Revertir:

```bash
git apply -R tests/pm26/p08d-candidato-release/defecto-l-cliente.patch
git status --porcelain   # debe quedar vacio
```

### 5.1 Orden obligatorio respecto a la migración

**Este parche no puede desplegarse solo.** Añade `empresa_id`/`local_id`
al `INSERT`; si se publica antes de aplicar la migración del Defecto L,
esas columnas no existen todavía y **toda alta de prefiltro falla**. El
orden es el documentado en P08b §3: aplicar la migración primero y
publicar el cliente inmediatamente después, en la misma ventana. Ambos
pasos requieren autorización explícita y separada, que P08d no incluye.

## 6. Confirmación de aislamiento

Aplicar este parche **no arrastra el resto de la rama técnica**:

- El parche toca 2 archivos y ningún otro (verificado en el contrato).
- Ninguna línea añadida contiene marcadores de K, F, H ni señales QA
  (verificado línea a línea sobre las líneas `+` del parche).
- El árbol parcheado sigue sin contener `__modoPruebasQA`,
  `pm11_crear_prefiltro_candidato` ni `origenSupabasePublicoPM26`.
- Tras revertir, el árbol es **byte a byte idéntico** a `release`.

## Qué NO se hizo

- No se aplicó `migracion-propuesta.sql` en ningún entorno.
- No se escribió en Supabase QA, producción ni TPV.
- No se modificó ni se subió nada a `release` ni a `main`.
- No se desplegó en Netlify, ni siquiera producción.
- No se fusionó ni cerró la PR #38.
- No se crearon datos de prueba en producción.
- No se tocó SSO, dominios, variables de entorno ni configuración remota.
- No se sustituyó el aislamiento por una copia completa de `fuente.js`:
  el artefacto es un parche de 110 líneas, no un volcado.

```
PM26_P08D_ESTADO=CANDIDATO_PREPARADO_NO_APLICADO_NO_DESPLEGADO
PM26_P08D_BASE=RELEASE_93a570b
PM26_P08D_PARCHE_SOLO_DOS_ARCHIVOS=SI
PM26_P08D_SIN_ARRASTRE_RAMA_TECNICA=SI
PM26_P08D_DEPENDENCIA_IMPRESCINDIBLE_ENCONTRADA=NO
PM26_P08D_CLIENTE_DUAL_ESQA_EXCLUIDO_POR_ARRASTRE=SI
PM26_P08D_APPLY_CHECK=PASS
PM26_P08D_APLICACION_LIMPIA=PASS
PM26_P08D_REVERSION_LIMPIA=PASS
PM26_P08D_REAPLICACION_TRAS_REVERTIR=PASS
PM26_P08D_BUILD_REPRODUCIBLE=PASS
PM26_P08D_REGRESION_RELEASE_COMPLETA=PASS
PM26_P08D_MUTACIONES_NEGATIVAS=PASS
PM26_P08D_ESCANER_SECRETOS=PASS
PM26_P08D_REQUIERE_MIGRACION_PREVIA=SI
PM26_P08D_MIGRACION_APLICADA=NO
PM26_P08D_DESPLEGADO_EN_NETLIFY=NO
PM26_P08D_RELEASE_MAIN_MODIFICADOS=NO
PM26_P08D_PR_38_CERRADA_O_FUSIONADA=NO
PM26_P08D_DEFECTO_L_CORREGIDO_EN_PRODUCCION=NO
```

Pendiente de autorización explícita y separada: (1) aplicar la migración
en producción y (2) publicar este candidato en `release`. Ninguna de las
dos se ejecuta con esta preparación. Quedan Aviso G y PM25–P02 sin tocar.
