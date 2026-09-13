# PM26 P08c — Endurecimiento final previo a producción

## Estado

**ENDURECIDO. NO APLICADO Y NO DESPLEGADO.** El usuario autorizó
exactamente esto: endurecer `revertir.sql`, crear una prueba real de
concurrencia con dos sesiones PostgreSQL, endurecer la documentación de
`revertir-conservador.sql`, corregir las frases que afirmaban que
restaurar las políticas antiguas «cierra» el aislamiento, y actualizar
contratos, documentación y workflow — subiendo el commit únicamente a
`claude/pm26-preparacion-tecnica`.

No se aplicó ninguna migración. No se escribió en Supabase QA,
producción ni TPV. No se desplegó en Netlify. No se tocó `main` ni
`release`. No se cerró ni fusionó la PR. El Defecto L **sigue sin
aplicarse en producción** y no debe darse por corregido allí.

Este paquete continúa `P08B_DEFECTO_L_CLIENTE_COORDINADO.md`, que
permanece cerrado como preparación técnica. P08c no rehace su trabajo:
corrige dos defectos concretos que quedaron dentro de él.

---

## 1. `revertir.sql` endurecido contra una carrera real

### 1.1 El defecto

La versión anterior contaba las filas así:

```sql
begin;
do $$ ... select count(*) into v_total ... if v_total <> 0 then raise ... $$;
drop policy ...;   -- primera sentencia que toma ACCESS EXCLUSIVE
alter table ... drop column ...;
commit;
```

El `SELECT` del conteo solo adquiere `ACCESS SHARE`, que es
**compatible** con el `ROW EXCLUSIVE` de un `INSERT`. La primera
sentencia que adquiere `ACCESS EXCLUSIVE` era el primer `DROP POLICY`,
ya después del conteo. Entre ambos quedaba una ventana en la que un
`INSERT` concurrente podía confirmarse; las columnas se retiraban
después con esa fila ya dentro, y sus `empresa_id`/`local_id` se
destruían sin que nada avisara — precisamente el dato que el guard
existía para proteger.

La ventana es estrecha con la base en reposo, pero **se ensancha sola
bajo carga**: ese `DROP POLICY` puede quedarse esperando en la cola de
bloqueos mientras otras transacciones terminan, y todo lo que se
confirme en ese intervalo entra en la tabla después de haber sido
contado.

### 1.2 La corrección

```sql
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';
-- PM26_P08C_GUARD_INICIO
  lock table public.prefiltros_candidatos in access exclusive mode;  -- ANTES de contar
  select count(*) into v_total from public.prefiltros_candidatos;    -- bajo ese bloqueo
-- PM26_P08C_GUARD_FIN
```

- **Transacción explícita** (`begin`/`commit`) y **timeouts acotados**,
  iguales a los de `migracion-propuesta.sql`.
- El bloqueo `ACCESS EXCLUSIVE` se adquiere **antes** del conteo y, por
  las reglas de PostgreSQL, se mantiene **hasta el `COMMIT`** — es el
  mismo nivel que exige el `ALTER TABLE` final, así que entre contar y
  retirar columnas ya no puede ocurrir nada.
- Si el bloqueo **no puede obtenerse** en 5 s (hay sesiones usando la
  tabla, p. ej. un `INSERT` en vuelo), `lock_timeout` dispara
  `lock_not_available` (SQLSTATE 55P03), que se captura y se convierte
  en un `ROLLBACK_FALLO` que dice exactamente qué pasó y que **no se ha
  revertido nada**.
- Si hay **alguna fila**, aborta igualmente con `ROLLBACK_FALLO`,
  indicando que la vía segura no es revertir sino mantener el
  aislamiento y avanzar el cliente.

## 2. Prueba real de concurrencia (dos sesiones simultáneas)

`tests/pm26/p08-defecto-l-produccion/concurrencia-revertir.sh`, que se
ejecuta **exclusivamente contra un PostgreSQL local aislado** sobre una
base temporal creada y destruida por el propio script, con una barrera
que rechaza cualquier `PGHOST` no local.

Las dos sesiones se sincronizan **observando el estado real del motor**
(`pg_locks`, `pg_stat_activity`) en lugar de con esperas a ciegas, así
que el resultado es determinista y no depende de la suerte de
temporización.

| Escenario | Qué monta | Qué exige |
|---|---|---|
| 1 | Sesión B abre transacción, hace `INSERT` y **no confirma** | `revertir.sql` aborta por `ROLLBACK_FALLO` nombrando el bloqueo no adquirido; después, columnas, fila y las 3 políticas con aislamiento siguen **intactas** |
| 2 | Sesión B mantiene `ACCESS EXCLUSIVE` (la ventana exacta del guard) | Un `INSERT` concurrente **falla** por lock timeout y **no se cuela ninguna fila** |
| 3 | Control negativo: reproduce el **orden antiguo** completo | Ese orden **sí** pierde datos: la fila se cuela y sus columnas se retiran |

El escenario 3 es lo que impide que los otros dos pasen de forma vacía:
demuestra que la carrera existía de verdad y que la prueba sabe
detectarla. Reproduce el cuerpo antiguo íntegro (conteo sin bloqueo,
sustitución de las 3 políticas y retirada de columnas) en SQL
desechable sobre la base aislada — nunca ejecuta el archivo
committeado. El `pg_sleep` no inventa una ventana inexistente:
ensancha de forma determinista la ventana real descrita en 1.1.

## 3. `revertir-conservador.sql`: excepcional, manual y con autorización

Endurecido para que deje de leerse como «el rollback cuando hay
tráfico»:

- **Procedimiento excepcional y exclusivamente manual.** No es el
  rollback recomendado y no forma parte de ningún procedimiento
  automático, pipeline ni gate.
- **Conserva los datos, pero no el aislamiento.** No elimina ninguna
  fila ni retira las columnas, así que los valores ya escritos siguen
  intactos. Pero restaura las 3 políticas originales (solo por rol) y
  por tanto **reabre el Defecto L**: vuelve el riesgo de acceso entre
  empresas y locales, también sobre las filas ya existentes.
- **Exige autorización explícita y separada**, que nombre expresamente
  que se acepta reabrir el Defecto L y durante cuánto tiempo.
- **Vía segura preferente: avance controlado.** Mantener las columnas y
  las políticas con aislamiento y corregir o desplegar el cliente hacia
  delante. Revertir la protección para arreglar un fallo del cliente
  cambia un problema de disponibilidad por uno de exposición de datos
  entre empresas, que es peor y además silencioso.

Para que «manual» y «autorización explícita» no sean solo texto, el
script **se niega a ejecutarse** salvo que la sesión lo declare a mano:

```bash
psql -v ON_ERROR_STOP=1 \
  -c "set pm26.autorizacion_reapertura_defecto_l = 'CONFIRMADA';" \
  -f revertir-conservador.sql
```

Sin esa declaración aborta con `ROLLBACK_CONSERVADOR_BLOQUEADO` y no
toca nada — comprobado en `validar.sh`
(`PM26_P08_ROLLBACK_CONSERVADOR_EXIGE_AUTORIZACION`), que verifica
además que tras el rechazo las 3 políticas con aislamiento y los dos
`NOT NULL` siguen en su sitio. La declaración **no** está dentro del
archivo a propósito: quien la escribe está afirmando que cuenta con la
autorización correspondiente.

## 4. Frases engañosas corregidas

La sección 4 de `P08B_DEFECTO_L_CLIENTE_COORDINADO.md` decía que
revertir primero las políticas «cierra inmediatamente el aislamiento
revertido». Es falso y peligroso: restaurar las 3 políticas originales
**elimina** la protección añadida contra el Defecto L, no la cierra ni
la conserva.

- Corregida esa frase en su sitio, señalada como corrección de P08c y
  sin reescribir el resto del informe histórico.
- Añadida la sección **4.0 Vía segura preferente: avance controlado**,
  antes de los dos escenarios de reversión, para que no se lean como
  alternativas equivalentes.
- `revertir.sql` documenta ahora en su propia cabecera que restaurar
  las políticas originales **no** conserva el aislamiento, y que es una
  reversión legítima solo porque exige 0 filas: si no hay datos, no hay
  nada expuesto en ese instante.
- Un contrato comprueba de forma estructural que no reaparece ninguna
  afirmación de ese tipo en los informes de esta cadena.

## 5. Artefactos y SHA-256

| Artefacto | SHA-256 |
|---|---|
| `tests/pm26/p08-defecto-l-produccion/revertir.sql` | `a776139f64a10a63bad4b9220c4999ec3ac55897c44d74ebfc830890cabe2be3` |
| `tests/pm26/p08-defecto-l-produccion/revertir-conservador.sql` | `112bb262624a9b9b5c15eedafb1e3492811a5f446552a7abe47fe14728bbc90e` |
| `tests/pm26/p08-defecto-l-produccion/concurrencia-revertir.sh` | `64c9c814887d568f2c4e84195f1b57038b1c72bc65675f908407713ace044a41` |

## 6. Verificación ejecutada

- `concurrencia-revertir.sh`: **dos reproducciones independientes**,
  mismos 8 marcadores en verde las dos veces.
- `validar.sh`: batería completa, incluidos los marcadores nuevos
  `PM26_P08_ROLLBACK_CONSERVADOR_EXIGE_AUTORIZACION` y
  `PM26_P08_ROLLBACK_EXACTO_RECHAZA_CON_TRAFICO`, reproducida dos veces.
- Contratos PM26 afectados: P03b, P06h, P07b, P07c, P08a, P08b y P08c.
- Regresión acumulada completa (`tests/g1` … `tests/pm25`, más de 100
  contratos).
- Escáner completo de secretos e identificadores.

## Qué NO se hizo

- No se aplicó ninguna migración, en ningún entorno.
- No se escribió en Supabase QA, producción ni TPV.
- No se desplegó en Netlify ni se tocó `main` o `release`.
- No se cerró ni fusionó la PR.
- No se cambió SSO, dominios, variables de entorno, contraseñas ni
  configuración remota.
- No se debilitó ningún gate histórico: los contratos anteriores se
  mantienen y P08c solo añade comprobaciones.
- No se tocó `fuente.js` ni `source-recovery/**`: P08c no cambia el
  cliente.

```
PM26_P08C_ESTADO=ENDURECIDO_NO_APLICADO_NO_DESPLEGADO
PM26_P08C_REVERTIR_TRANSACCION_EXPLICITA=SI
PM26_P08C_REVERTIR_TIMEOUTS=SI
PM26_P08C_REVERTIR_ACCESS_EXCLUSIVE_ANTES_DEL_CONTEO=SI
PM26_P08C_REVERTIR_BLOQUEO_HASTA_COMMIT=SI
PM26_P08C_REVERTIR_ABORTA_SIN_BLOQUEO=SI
PM26_P08C_REVERTIR_ABORTA_CON_FILAS=SI
PM26_P08C_CARRERA_CONTEO_DROP_ELIMINADA=SI
PM26_P08C_PRUEBA_CONCURRENTE_DOS_SESIONES=PASS
PM26_P08C_CONTROL_NEGATIVO_ORDEN_ANTIGUO=PASS
PM26_P08C_DOS_REPRODUCCIONES_INDEPENDIENTES=PASS
PM26_P08C_CONSERVADOR_EXCEPCIONAL_Y_MANUAL=SI
PM26_P08C_CONSERVADOR_EXIGE_AUTORIZACION_EXPLICITA=SI
PM26_P08C_CONSERVADOR_REABRE_DEFECTO_L_DOCUMENTADO=SI
PM26_P08C_CONSERVADOR_NO_ES_ROLLBACK_AUTOMATICO=SI
PM26_P08C_AVANCE_CONTROLADO_PRIORIZADO=SI
PM26_P08C_FRASES_ENGANOSAS_CORREGIDAS=SI
PM26_P08C_SOLO_POSTGRES_LOCAL_AISLADO=SI
PM26_P08C_GATES_HISTORICOS_NO_DEBILITADOS=SI
PM26_P08C_APLICADO_EN_PRODUCCION=NO
PM26_P08C_APLICADO_EN_QA=NO
PM26_P08C_DESPLEGADO_EN_NETLIFY=NO
PM26_P08C_MAIN_RELEASE_TOCADOS=NO
PM26_P08C_PR_CERRADA_O_FUSIONADA=NO
PM26_P08C_DEFECTO_L_CORREGIDO_EN_PRODUCCION=NO
```

El Defecto L sigue pendiente de aplicación en producción. Aplicar la
migración y desplegar el cliente coordinado requieren, cada uno, su
propia autorización explícita y separada, que esta preparación no
incluye. Quedan Aviso G y PM25–P02 sin tocar.
