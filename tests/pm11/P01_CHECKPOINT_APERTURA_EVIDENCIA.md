# PM11 · Personal / Empleados · P01 — Checkpoint y apertura segura

Fecha: 2026-09-05  
Rama de trabajo: `pm11-personal-empleados`  
Entorno QA: Supabase `qjqorixtkilwsndqayyx`  
Producción/main: no tocar

## 1. Punto de partida

PM11 parte exclusivamente del cierre probado de Puerta G1:

- SHA base G1: `1e21458b48a11302c59911ef966ded0aca3eb639`;
- artefacto de cierre: `tests/g1/P08_CIERRE_PUERTA_G1.md`;
- G1: `G1_GATE_SUPERADO=SI`;
- siguiente paquete declarado por el cierre oficial: `PM11_PERSONAL_EMPLEADOS`.

No se parte de `main` ni se reconstruye desde una rama histórica de Personal.

## 2. Estado de main

Al abrir PM11 se verificó:

- `main = 7f792925d6a3d27334ee0e7335ba635b4ed79b6b`;
- no se ha fusionado PM11 a `main`;
- no se ha publicado PM11 en producción;
- no se ha modificado Netlify de producción.

## 3. QA sintética verificada

Se verificó directamente en Supabase QA:

- 5 usuarios sintéticos del fixture presentes;
- memberships coherentes:
  - Owner A → `QA-EMP-A`, `todos_locales=true`, activo;
  - Operator A1 → `QA-EMP-A / QA-A1`, Cajero/a, activo;
  - Operator A2 → `QA-EMP-A / QA-A2`, Encargado, activo;
  - Owner B → `QA-EMP-B`, `todos_locales=true`, activo;
  - usuario inactivo → `QA-EMP-A`, Básico, inactivo;
- stock de control sin deriva:
  - A1 Agua = 23 (18 almacén + 5 piso);
  - A2 Agua = 10 (8 + 2);
  - A-CERRADO Agua = 4 y `local_operable=false`;
  - B1 Café = 7 (5 + 2);
- residuos `G1-P08-*`:
  - pagos = 0;
  - caja = 0;
  - stock_operaciones = 0.

Última migración QA observada al abrir PM11:

`20260905185935 · g1_p08_operation_id_finanzas_global`

No se realizó ninguna mutación de datos para este checkpoint.

## 4. Contrato heredado de Personal

PM10 dejó cerrado LA-017 mediante `tests/pm10/p07-personal-contract.mjs`.

Ese contrato ya cubre, entre otras cosas:

- horas semanales no negativas y finitas;
- pagas válidas;
- salarios/coste empresa no negativos y finitos;
- vacaciones anuales no negativas;
- contexto local obligatorio;
- rechazo de edición cruzada de local;
- alta/edición todo-o-nada ante validación inválida;
- datos legados inválidos no normalizados silenciosamente;
- UI que conserva el formulario cuando falla la validación.

PM11 debe construir encima de este comportamiento; no reabrirlo ni degradarlo.

## 5. Límite de alcance

PM11 = **Personal / Empleados**.

No se mezclarán en este paquete:

- PM12: fichajes / control horario;
- PM13: turnos y horarios;
- PM14: nóminas.

Las integraciones futuras pueden dejar referencias preparadas, pero su lógica funcional no se implementa dentro de PM11.

## 6. Criterio de cierre de P01

P01 queda cerrado únicamente cuando un workflow sobre el HEAD exacto de la rama demuestra:

1. descendencia del SHA final de G1;
2. sintaxis válida de `fuente.js`;
3. contrato G1 final en PASS;
4. contrato heredado PM10 Personal/LA-017 en PASS;
5. contrato de este checkpoint en PASS;
6. build actual reproducible y `fuente.js` idéntico byte a byte;
7. `main` permanece en el SHA registrado al abrir PM11.

**PM11_P01_CHECKPOINT=PREPARADO**  
**PM11_ESTADO=ABIERTO**  
**SIGUIENTE=PM11_P02_MAPA_PERSONAL_ACTUAL**
