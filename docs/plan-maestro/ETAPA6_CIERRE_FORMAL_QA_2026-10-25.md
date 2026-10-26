# Plan Maestro L&A Suite — Etapa 6 / T8 — cierre formal QA

Fecha: 25/10/2026  
Entorno funcional: QA `qjqorixtkilwsndqayyx`  
Estado: `QA_VALIDADO; ETAPA_6_T8_CERRADA; SIN_PROMOCION_PROD`

## 1. Resultado ejecutivo

La auditoría de arranque de la Etapa 6 ha confirmado que el bloque T8 ya
estaba construido en el repositorio antes de esta revisión. No se han creado
migraciones duplicadas ni se ha reimplementado una funcionalidad que ya
existía.

Las cinco piezas del T8 quedan aceptadas en QA dentro del alcance que se
definió en cada acta:

1. biblioteca de opciones reutilizables;
2. opciones por producto;
3. tarifas por horario ("hora feliz");
4. tipo de negocio y biblioteca de ejemplos;
5. confirmación de contraseña propia para editar opciones.

La idea de "teclas por cargo" no se considera pendiente de esta entrega: no
existen todavía teclas de función reales en el TPV. Se aparca expresamente
hasta la Etapa 9, cuando exista el sistema visual y operativo que permita
asignarlas a cargos.

## 2. Piezas aceptadas

### T8.1 — Biblioteca de opciones reutilizables

Migración: `20261024180000_t8_biblioteca_opciones_reutilizables.sql`.

Se reutiliza el esquema T3-A04 y se incorporan las operaciones autoritativas:

- `abc_guardar_grupo_opciones`;
- `abc_guardar_opcion`;
- `abc_vincular_grupo_producto`.

La solución permite compartir un mismo grupo entre varios productos sin
duplicarlo, conserva la coherencia Variante/Modificador, aplica el permiso de
gestión de catálogo y mantiene la idempotencia y los índices de nombre único.
La pantalla permite administrar grupos, opciones y estado activo/inactivo.

### T8.2 — Opciones por producto

La pantalla muestra una ficha por producto activo del catálogo TPV, sus grupos
enlazados, mínimos/máximos y las acciones de enlazar o desenlazar. No se
construye un editor paralelo del catálogo: se conserva como autoridad el
catálogo existente y se reutiliza `abc_vincular_grupo_producto`.

Se corrigió además la carga de grupos y opciones desactivados: se cargan para
poder resolver nombres históricos y el filtro se aplica únicamente a la
visualización. Los formularios de alta solo ofrecen grupos activos.

### T8.3 — Tarifa por horario

Migración: `20261024190000_t8_tarifa_horario_hora_feliz.sql`.

Se añadieron tarifas por días y rango horario, precios especiales por producto,
detección de solapamientos y la resolución segura de la tarifa vigente por
huso horario local. `private.abc_tarifa_horario_vigente` devuelve nulo ante un
fallo de cálculo para no romper un cobro.

`private.abc_calcular_linea_tpv` conserva el cálculo anterior cuando no hay
tarifa vigente o no existe precio especial. El alcance aceptado es deliberado:
solo líneas simples, sin variantes/modificadores y sin zonas. El precio
especial se trata como base más el impuesto normal del producto.

### T8.4 — Tipo de negocio y biblioteca de ejemplo

Migraciones:

- `20261025100000_t8_tipo_negocio_plantillas.sql`;
- `20261025110000_t8_tipo_negocio_fix_omitidos.sql`.

Se añadió `empresas.tipo_negocio` como etiqueta informativa y las funciones:

- `abc_guardar_tipo_negocio`;
- `abc_obtener_tipo_negocio`.

Guardar el tipo exige ser Propietario de la empresa. La siembra opcional crea
grupos de ejemplo por local sin tocar productos ni enlaces y no duplica grupos
ya existentes. La interfaz informa expresamente de los grupos omitidos por
existir ya, y al elegir `Otro` desmarca realmente la siembra.

### T8.5 — Confirmación de contraseña propia

No requiere migración ni tabla nueva. Antes de guardar grupos, opciones,
enlaces o cambios rápidos de activar/desactivar, la interfaz reautentica al
usuario actual con su propio correo y contraseña mediante Supabase Auth.

La contraseña se elimina del campo inmediatamente, tanto si la validación
acierta como si falla. El permiso de fondo continúa siendo el de gestión de
catálogo (Propietario o Encargado); no se solicita ni se almacena la
contraseña de otra persona.

## 3. Evidencia de validación

### Contratos T8

Todos los contratos específicos pasan:

- `etapa6-t8-biblioteca-opciones-contract.mjs`;
- `etapa6-t8-tarifa-horario-contract.mjs`;
- `etapa6-t8-tipo-negocio-contract.mjs`;
- `etapa6-t8-clave-propietario-contract.mjs`.

Se verificaron UI, migraciones, permisos, idempotencia, limpieza ante fallo,
solapamientos, paridad carácter a carácter entre `fuente.js` y
`source-recovery/fuente-recuperado.js`, y los dos hallazgos UX corregidos.

### Contratos de soporte de Etapa 6

También pasan:

- `etapa6-arqueo-server-contract.mjs`;
- `etapa6-enviar-preserva-cuenta-contract.mjs`;
- `etapa6-puente-scope-contract.mjs`.

### Batería plan-maestro

Ejecución completa local fuera del sandbox Windows:

- 28 contratos ejecutados;
- 28 PASS;
- 0 fallos.

La prueba del puente T7 que abre un servidor temporal en `127.0.0.1` necesitó
ejecutarse fuera del sandbox por la restricción local `EACCES`; el contrato
pasó correctamente.

### Integridad del repositorio

- `node --check fuente.js`: PASS;
- `node --check source-recovery/fuente-recuperado.js`: PASS;
- `node .github/scripts/validar-manifiesto-ci.mjs`: PASS;
- inventario CI: 331 entradas;
- contratos activos: 314;
- histórico esperado: 1;
- utilidades: 11;
- diagnósticos: 5;
- `git diff --check`: PASS.

Se corrigió la portabilidad del contrato T7 para convertir rutas de Windows a
URL `file:` mediante `pathToFileURL`, sin modificar el comportamiento de la
aplicación ni el contrato del puente.

## 4. Límites y pendientes reales

El cierre es de QA y no certifica producción. Permanecen fuera del alcance:

- zonas asociadas a tarifas;
- variantes/modificadores dentro de la tarifa horaria;
- teclas de función reales y su asignación por cargo;
- proveedores reales de pago o correo;
- hardware físico de impresora/cajón;
- fiscalidad y requisitos legales finales;
- matriz completa de permisos por rol y claves de propietario;
- ejecución del preflight F7 y autorización de promoción;
- merge a `release` y cualquier cambio en producción.

No se han tocado datos de producción ni se ha aplicado ninguna migración de
T8 en producción como consecuencia de esta auditoría.

## 5. Estado de cierre

**Etapa 6 / T8: TERMINADA en QA dentro del alcance aceptado.**

La documentación de las piezas anteriores permanece como evidencia detallada:

- `ETAPA6_T8_BIBLIOTECA_OPCIONES_2026-10-24.md`;
- `ETAPA6_T8_TARIFA_HORARIO_2026-10-25.md`;
- `ETAPA6_T8_TIPO_NEGOCIO_2026-10-25.md`;
- `ETAPA6_T8_CLAVE_PROPIETARIO_2026-10-25.md`.

## 6. Qué sigue

La siguiente acción segura es preparar el expediente de la Etapa 7 a partir
del Plan Maestro y confirmar su alcance antes de construir. No se debe abrir
una nueva migración o funcionalidad por inferencia: primero hay que identificar
qué entregable define el plan para esa etapa, qué ya existe en el repositorio y
qué necesita autorización independiente.

La promoción a `release` y producción continúa bloqueada hasta completar el
preflight correspondiente y recibir autorización expresa.
