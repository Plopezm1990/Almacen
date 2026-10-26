# Plan Maestro L&A Suite — Etapa 7.1 — cierre de incidencia de cambio de local

Fecha: 26/10/2026  
Entorno: QA `qjqorixtkilwsndqayyx` y Deploy Preview del PR `#175`  
Rama de trabajo: `codex/etapa5-pr175-refresh`  
Commit corregido: `7de71dc32baa3ecf6096e742b614021f6adc664c`  
Estado: `INCIDENCIA_CERRADA_QA; REGRESION_VERIFICADA; ETAPA_7_GLOBAL_ABIERTA`

## 1. Objeto del acta

Esta acta formaliza la investigación y el cierre de la incidencia detectada
durante la comprobación viva de la Etapa 7.1: al cambiar el local activo entre
`A1` y `A2`, la interfaz podía intentar guardar de nuevo todo el catálogo de
productos aunque el usuario no hubiera editado ningún producto.

El cierre que se declara aquí es el de esta incidencia concreta. No equivale
al cierre de toda la Etapa 7 ni a la aceptación de T9: la campaña física con
impresora y cajón, la comparación de toques y otras validaciones operativas
continúan pendientes según el preflight de la etapa.

## 2. Síntoma observado

Durante la prueba de cambio de contexto en QA se observó una petición de
guardado del catálogo contra la RPC:

`abc_productos_guardar_lista`

Supabase QA respondió con:

`abc_productos_cambio_contexto_no_admitido:QA-AUD004-LEGACY-20261022`

La respuesta era una protección válida del servidor: el fixture legacy
`QA-AUD004-LEGACY-20261022` no debe ser reasignado a otro contexto. El efecto
visible en la interfaz era engañoso, porque una operación provocada solamente
por cambiar de local podía terminar representada como un cambio de productos
no confirmado.

## 3. Investigación y causa raíz

La hidratación inicial ya fijaba de forma explícita el contexto activo y
guardaba el catálogo normalizado una sola vez. Sin embargo, el efecto reactivo
posterior de `GestionAlmacen` incluía el local y la empresa activa en sus
dependencias:

```js
[productos, ready, localActivoId, empresaDelLocalActivo?.id]
```

Al cambiar de `A1` a `A2`, o al volver de `A2` a `A1`, React reevaluaba ese
efecto y llamaba al guardado completo de productos. El cambio de contexto no
era un cambio de catálogo, por lo que el guardado era espurio.

La causa raíz queda clasificada como:

`FRONTEND_REACTIVE_DEPENDENCY_CAUSES_CONTEXT_SWITCH_RESYNC`

No se encontró un defecto en la política de aislamiento ni en la validación
del backend. La respuesta de Supabase fue la barrera correcta y el fixture
legacy no se modificó, borró ni desactivó adicionalmente.

## 4. Corrección aplicada

Se retiraron `localActivoId` y `empresaDelLocalActivo?.id` de las
dependencias del guardado reactivo de productos en:

- `fuente.js`;
- `source-recovery/fuente-recuperado.js`.

El efecto queda limitado a:

```js
[productos, ready]
```

Con esta corrección:

1. cambiar de local solo cambia el contexto de lectura y operación;
2. el catálogo no se reenvía automáticamente por el mero cambio de local;
3. editar productos sigue activando el guardado normal;
4. la protección de Supabase frente a reasignaciones de contexto permanece
   activa;
5. el archivo principal y el espejo de recuperación conservan paridad.

También se actualizó el contrato frontend PM08 para verificar expresamente que
el guardado reactivo no vuelva a depender del cambio de contexto y que la
protección de catálogo siga presente.

## 5. Validación local

Las comprobaciones ejecutadas sobre el commit `7de71dc` fueron satisfactorias:

| Comprobación | Resultado |
|---|---:|
| `git diff --check` | PASS |
| Sintaxis de `fuente.js` | PASS |
| Sintaxis de `source-recovery/fuente-recuperado.js` | PASS |
| Contrato frontend PM08 | `51/51 PASS` |
| Paridad de fuente recuperada | PASS |
| Contrato cliente P3c | PASS |
| Contrato de migración PM08 | PASS |
| Contrato de alcance de replay | PASS |
| Contrato de claves locales | PASS |
| Contratos PM16 de carga y errores de UI | PASS |
| Construcción del paquete Netlify | PASS |

## 6. Validación viva en QA

El preview actualizado sirvió el commit corregido y se probó el ciclo:

`A2 → A1 → A2`

Resultado observado:

- ambos cambios de local terminaron correctamente;
- el contexto visible correspondió al local seleccionado;
- el contador `Guardado: cambios sin confirmar` terminó en `0`;
- no aparecieron errores de `abc_productos` en el navegador;
- no apareció un nuevo `abc_productos_cambio_contexto_no_admitido`;
- no se creó, cobró ni modificó ninguna operación de negocio;
- los datos de QA permanecieron sin alteraciones indebidas.

Los únicos avisos visibles fueron advertencias conocidas de cuota de caché
local y de la copia automática de QA. No bloquean datos operativos y no son
fallos de la incidencia cerrada.

## 7. Validación en Supabase QA

Se revisó exclusivamente el proyecto QA `qjqorixtkilwsndqayyx`.

Antes de la corrección se habían observado dos errores reales asociados a la
incidencia, ambos sobre el fixture protegido:

- `2026-10-26T04:36:31.991Z`;
- `2026-10-26T04:57:34.690Z`.

Después del despliegue y de la prueba viva, la consulta de logs de QA en la
ventana `2026-10-26T05:10:00Z`–`2026-10-26T05:20:00Z` no devolvió nuevos
registros relacionados con `abc_productos`.

La comprobación de datos confirmó además:

- `QA-EMP-A`: 34 productos, incluido un único fixture legacy protegido;
- `QA-EMP-B`: 0 productos del catálogo de esta prueba;
- el fixture `QA-AUD004-LEGACY-20261022` sigue presente y sin reasignación.

## 8. CI y Deploy Preview

El commit se publicó en la rama del PR `#175` y el Deploy Preview quedó
preparado:

<https://deploy-preview-175--chic-entremet-9107cf.netlify.app>

La revisión final de CI registró:

- 34 comprobaciones completadas;
- 0 comprobaciones fallidas;
- Netlify `deploy-preview`: `success`;
- cabeceras procesadas correctamente;
- contratos frontend, PostgreSQL, Supabase y seguridad Edge en verde.

Las comprobaciones neutrales de reglas de redirección y páginas cambiadas son
informativas del contenido del deploy y no representan un fallo.

## 9. Límites y no regresión

Esta corrección no autoriza por sí sola el cierre de la Etapa 7 completa. Se
mantienen abiertos, entre otros, los elementos ya declarados en el preflight:

- cuentas QA dedicadas para la matriz completa de roles;
- mediciones repetibles de arranque, cambio de local y carga del TPV;
- comparación del mismo pedido en TPV antiguo y nuevo;
- impresora y cajón físicos para T9;
- decisión documentada sobre AUD-010;
- autorización independiente para fusionar o promocionar a producción.

No se tocaron el sitio Netlify de producción, el proyecto Supabase de
producción `flqercbgpgmmfaakrwkc`, sus datos, sus migraciones ni su deploy.

## 10. Decisión

**Incidencia de re-sincronización espuria del catálogo al cambiar de local:
CERRADA EN QA.**

La corrección queda aceptada para continuar la regresión de la Etapa 7.1. La
Etapa 7 global permanece abierta hasta completar los elementos físicos y
operativos que no pueden certificarse con contratos o simuladores.

## 11. Qué sigue

El siguiente paso es incorporar esta acta al expediente de la Etapa 7.1 y
continuar con la matriz viva restante en QA. La promoción a producción debe
esperar a que se cierre el preflight completo, se resuelvan los bloqueos
operativos de T9 y exista autorización expresa.
