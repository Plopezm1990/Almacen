# G1 · Núcleo seguro · Punto 4 — revalidación LA-023

Fecha: 2026-09-05  
Rama: `g1-nucleo-seguro`  
Base funcional heredada: PM10 final `94d37cc7a5176e3a44d00f8f8bfb79a630dae314`  
HEAD validado inicialmente: `f11902d4e23a4e0005e5ec57cbb34fb1881292b4`  
Workflow inicial: `G1 Punto 4 revalidar LA023` · run `33983029636`  

## 1. Objetivo

Revalidar LA-023 sobre el candidato actual, no solo sobre la evidencia histórica
de PM-02. El criterio es que L&A Suite no prometa guardado/sincronización remota
cuando trabaja en modo local y que, en modo nube, no afirme confirmación antes
de que exista confirmación real del backend.

Este punto aplica directamente DEC-03: el backend es autoridad en modo
sincronizado y la interfaz debe diferenciar estado local, pendiente y confirmado.

## 2. Evidencia histórica conservada

`docs/plan-maestro/PM02_LA023_EVIDENCIA.txt` continúa presente con:

- `PM02_LA023_OK=1`;
- `MODO_LOCAL_TEXTO_HONESTO=1`;
- `MODO_NUBE_SIN_PROMESA_DE_CONFIRMACION=1`.

La evidencia histórica se usa como antecedente, pero no sustituye la
revalidación G1.

## 3. Revalidación sobre el candidato actual

El contrato `tests/g1/p04-la023-contract.mjs` comprueba tanto `fuente.js` como
`source-recovery/fuente-recuperado.js`.

Se verificó:

1. El modo local contiene el texto `Estás trabajando solo en este equipo, sin sincronización`.
2. El modo nube usa una formulación no absoluta: `Los cambios se intentan sincronizar con tu cuenta`.
3. El texto de nube declara que una escritura no confirmada muestra error.
4. La rama de texto de nube está condicionada por `window.__nubeActiva === true`; si no está activa, el texto mostrado es el local.
5. Se eliminó del candidato la promesa antigua de que todo se guarda automáticamente en la cuenta.
6. Se eliminó la promesa antigua de que otro dispositivo verá automáticamente la misma información.
7. La misma semántica está presente en la fuente recuperada reproducible.
8. DEC-03 sigue congelando autoridad de backend y comunicación honesta de pendiente/no confirmado.

Resultado del contrato: **8/8 PASS**.

## 4. Reproducibilidad y regresión

Workflow `.github/workflows/g1-p04-la023.yml`:

- verificó que el candidato desciende de PM10 final;
- ejecutó `node --check fuente.js`;
- ejecutó `npm ci`, `npm run check` y `npm run build` dentro de `source-recovery`;
- validó sintaxis del build recuperado;
- ejecutó el contrato nuevo de LA-023;
- volvió a ejecutar los contratos G1 P02 y P03.

Run inicial `33983029636`: **SUCCESS**.

No se modificó backend, Supabase QA, `main` ni producción para completar este
punto. No se aplicaron migraciones ni se usaron datos reales.

## 5. Decisión

**LA-023 REVALIDADA EN G1.4.**

La aplicación conserva la separación semántica entre trabajo local y modo nube,
y no contiene la promesa histórica falsa de sincronización automática entre
dispositivos. El gate G1 todavía no está superado: quedan los criterios de
permisos/aislamiento, cifras/conciliaciones, concurrencia/replay y la regresión
de los CRÍTICOS/ALTOS, incluido el hueco específico de LA-004 identificado en
P02.

**G1_P04_LA023=PASS**  
**G1_ESTADO=PENDIENTE**  
**SIGUIENTE=G1.5_PERMISOS_AISLAMIENTO**
