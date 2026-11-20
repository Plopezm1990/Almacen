# L&A Suite · Acta final de cierre del rediseño

**Fecha:** 18/11/2026  
**Rama:** `rediseno/f0-base-qa`  
**PR:** #225 contra `release`, mantenido en borrador  
**Entorno:** Deploy Preview #225 y Supabase QA `qjqorixtkilwsndqayyx`  
**Producción:** fuera de alcance; no se publicó ni modificó producción.

## 1. Decisión de cierre

El rediseño queda **cerrado en QA** dentro del alcance aprobado. La capa visual,
las nueve propuestas, las seis paletas, la navegación Órbita y sus superficies
de TPV, Pase, Cocina y Caja tienen evidencia live y contratos locales en verde.
Las filas funcionales cerradas se encuentran en
`docs/rediseno/MATRIZ-IMPLANTACION-QA.csv` y las notas históricas han sido
supersedidas por sus addenda de estado vigente.

Este cierre no significa que todas las funcionalidades futuras del producto
estén construidas. Los elementos opcionales o fuera de alcance se enumeran en
la sección 5 y no bloquean el cierre del rediseño.

## 2. Alcance cerrado y evidencia

| Área | Estado | Evidencia principal |
| --- | --- | --- |
| Nueve propuestas visuales y seis paletas | `Pasa` | `qa-20261117-punto2-apariencia` y `qa-20261118-punto2-live`; escritorio, tablet y móvil |
| TPV y sala, caja y fiscalidad | `Pasa` | `tpv-31` con factura completa `TPV-40`; `caj-16` con rectificativa `TPV-41` |
| Revisión móvil de `org-33` | `Pasa` | 390×844 sin overflow, controles táctiles ≥44×44, conflictos de versión verificados |
| Punto 1 operativo | `Pasa` | TPV, Pase, Cocina, Caja, permisos de Camarero/a, albarán y anticipos documentados en las actas QA |
| Paridad de fuente | `Pasa` | `SOURCE_RECOVERY_CHECK=PASS`, cuerpo de `fuente.js` y `source-recovery` idéntico |

Las operaciones económicas de esta tanda se limitaron a los fixtures QA ya
autorizados. No se generaron cobros, reembolsos ni documentos adicionales al
ejecutar esta batería.

## 3. Batería ejecutada

### 3.1 Contratos específicos del rediseño

Resultado: **8/8 archivos pasan, 0 fallos**.

Incluye:

- `org33-sala-contract.mjs`.
- `p01-capas-y-migraciones-contract.mjs`.
- `p02-apariencia-empresa-pglite-contract.mjs`.
- `p03-botones-de-solo-icono-contract.mjs`.
- `p04-mfa-politica-pglite-contract.mjs`.
- `p05-propuestas-contract.mjs`.
- `p06-propina-cambio-contract.mjs`.
- `p1-fiscal-tpv-contract.mjs`.

Resultados destacados: 49/49 comprobaciones locales de Apariencia, 26/26 de
MFA opcional, nueve diseños y seis paletas, y contratos fiscales P1 en verde.

### 3.2 Batería PGlite local

Resultado: **4/4 contratos activos pasan, 0 fallos de infraestructura**.

También se verificaron las migraciones efímeras de Apariencia, las reglas RLS,
la concurrencia y la recuperación de revisión. La batería no conecta con
producción.

### 3.3 Batería Node compartida de la puerta CI

Se corrigió primero el inventario de CI para incluir los dos contratos del
rediseño que ya existían en el árbol:

- `tests/rediseno/org33-sala-contract.mjs`.
- `tests/rediseno/p1-fiscal-tpv-contract.mjs`.

Inventario resultante: **374 entradas**, de las que hay **357 contratos
activos**, 1 histórico esperado, 11 utilidades y 5 diagnósticos. La ejecución
local oficial, con las dependencias externas aisladas en una carpeta temporal,
dio:

| Métrica | Resultado |
| --- | ---: |
| Contratos Node activos | 319 |
| Node activos en verde | 305 |
| Node activos en rojo | 14 |
| Utilidades ejecutadas | 8 |
| Diagnósticos ejecutados | 5 |
| Fallos de infraestructura | 0 |
| Límite de publicación Netlify | `PASS` |

Los 14 rojos pertenecen a contratos heredados de otras áreas del repositorio y
no son contratos del rediseño:

```text
tests/alb/a03-cableado-proveedor-desde-albaran-contract.mjs
tests/cfg/a09-panel-ui-runtime.mjs
tests/cfg/cfg6-ui-contract.mjs
tests/cfg/cfg6-ui-runtime.mjs
tests/cfg/cfg6d-ui-runtime.mjs
tests/cfg/f7-preflight-static-contract.mjs
tests/f3/a08/a08-3-unir-cuentas-contract.mjs
tests/f4/b04/b04-ui-contract.mjs
tests/f4/b05/b05-phase1-regression.mjs
tests/f4/b05/b05-ui-contract.mjs
tests/pm05/frontend-contract.mjs
tests/pm15/p03-mej02-confirmacion-pago-destino-contract.mjs
tests/pm33/p1-dashboard-movimientos-key-contract.mjs
tests/ui-context-bridge.mjs
```

Su salida se conserva como diagnóstico honesto: no se han marcado como verdes
ni se han silenciado. Varios son contratos previos que detectan divergencias de
la aplicación general, del bundle heredado o de paridad de fuente; requieren
una tanda propia y no deben mezclarse con el cierre del rediseño.

## 4. Integridad del árbol y publicación

- `git diff --check`: `PASS`.
- `node --check fuente.js`: `PASS`.
- `node --check source-recovery/fuente-recuperado.js`: `PASS`.
- Paridad de `source-recovery`: `PASS`.
- El manifiesto CI y su validador negativo pasan con 374 entradas.
- Los artefactos temporales de la batería se limpian al terminar; el árbol se
  deja limpio antes de publicar.
- El PR #225 permanece en borrador.
- No se ejecutó ninguna operación contra producción.

## 5. Elementos que siguen separados del cierre

Estos trabajos no se consideran defectos del rediseño cerrado:

- Paginación o búsqueda ampliada de la cola de Pase.
- Prueba positiva de Cajero/a con MFA.
- Registro contable pendiente de las migraciones de Apariencia en
  `schema_migrations`.
- Vale regalo y conciliación contable/fiscal.
- Nuevas operaciones económicas móviles que no forman parte de la evidencia
  fiscal ya cerrada.
- Los 14 contratos heredados indicados en la sección 3.3.

## 6. Reproducción

Desde la raíz del repositorio, con las dependencias de prueba fuera del árbol:

```text
node .github/scripts/validar-manifiesto-ci.mjs --self-test
bash tests/ci/ejecutar_bateria_no_db.sh
bash tests/ci/ejecutar_pglite_local.sh
node tests/rediseno/p1-fiscal-tpv-contract.mjs
git diff --check
```

La referencia documental complementaria está en:

- `PLAN_P1_FISCAL_TPV_2026-11-18.md`.
- `QA_PUNTO2_PROPUESTAS_2026-11-17.md`.
- `CIERRE-ALCANCE-PENDIENTES-2026-11-18.md`.
- `TRASPASO_QA_CLAUDE_2026-11-17.md`.

**Conclusión:** el rediseño aprobado queda cerrado y trazable en QA; los rojos
restantes están identificados como trabajo heredado fuera de este alcance y no
se han ocultado ni atribuido falsamente al rediseño.

---

## Addendum del 20/11/2026 · revisión de los 14 rojos

La sección 3.3 dice que los catorce contratos en rojo «pertenecen a contratos
heredados de otras áreas del repositorio», que «no son contratos del rediseño»
y que «requieren una tanda propia». **De los catorce, eso solo es cierto de
uno.** Lo comprobé ejecutándolos contra la base de la rama, `ba471956`.

### Seis eran finales de línea

El commit `02435009`, que es de documentación, reescribió
`source-recovery/fuente-recuperado.js` entero con CRLF: 33.226 finales de línea
cambiados, cero palabras de código. Los contratos que recortan ese fichero por
anclas del tipo `"\n  }\n"` dejaron de encontrar su ancla y fallaron con «no
encuentro el final», que parece un problema de contenido y no lo era.

La comprobación de paridad pasaba todo el tiempo, porque normaliza los finales
de línea. Por eso no se vio por ahí.

Devuelto el fichero a LF, volvieron a verde sin tocar una línea de código:
`tests/alb/a03-cableado-proveedor-desde-albaran`,
`tests/f3/a08/a08-3-unir-cuentas`, `tests/f4/b04/b04-ui`,
`tests/f4/b05/b05-phase1-regression`, `tests/f4/b05/b05-ui` y
`tests/pm33/p1-dashboard-movimientos-key`. Commit `26d7f97d`, con un
`.gitattributes` para que no se repita.

Conviene notar que `tests/f3/a08/a08-3-unir-cuentas` se escribió el 16/11 **en
esta misma rama**, para `tpv-26`. No podía ser deuda heredada de otra área.

### Siete eran regresiones de esta rama, no deuda heredada

Siete de los ocho restantes **estaban en verde en `ba471956`** y se pusieron
rojos dentro de la rama:

`tests/cfg/cfg6-ui-contract`, `tests/cfg/cfg6-ui-runtime`,
`tests/cfg/cfg6d-ui-runtime`, `tests/cfg/f7-preflight-static-contract`,
`tests/pm05/frontend-contract`,
`tests/pm15/p03-mej02-confirmacion-pago-destino` y `tests/ui-context-bridge`.

De estos ya está resuelto uno, y era el más serio.

**`tests/ui-context-bridge`.** Defiende que una cuenta de empleado no pueda
seleccionar un local fuera de su membresía. `a97841eb` arreglaba un problema
real —una copia vieja arrastra un «Local principal» inventado por el cliente y
la pantalla se queda mostrando una instalación fantasma— pero lo arreglaba de
más: **cualquier** local no autorizado se cambiaba en silencio por el canónico y
la llamada respondía como si hubiera ido bien. Una cuenta de empleado que pide
un local ajeno recibe otro sin que nada se lo diga.

Es, además, exactamente el síntoma que quedó anotado el 17/11 con la cuenta
restringida `qa.permisos.20261116`: entraba y aparecía en un local que no había
elegido.

Arreglado en `bb20bcc2` distinguiendo un arrastre de una elección: si lo pedido
coincide con lo ya guardado, es el arranque reafirmando su copia vieja y se
sana; si es distinto, se rechaza. El contrato pasa a cubrir las dos caras.

### Uno sí era anterior

`tests/cfg/a09-panel-ui-runtime` ya estaba rojo en `ba471956`. Ese sí es
trabajo heredado.

### Dónde queda la batería

De 14 rojos a **7**: `NODE_ACTIVE_TOTAL=320`, `NODE_ACTIVE_PASS=313`,
`NODE_ACTIVE_FAIL=7`, `INFRA_FAIL=0`.

Los seis que siguen rojos y son de esta rama están sin tocar, con sus mensajes:

| Contrato | Lo que dice |
| --- | --- |
| `tests/cfg/cfg6-ui-contract` | montaje de la pestaña, con el perfil Propietario y el worker QA |
| `tests/cfg/cfg6-ui-runtime` | (mismo bloque, en ejecución) |
| `tests/cfg/cfg6d-ui-runtime` | (mismo bloque, en ejecución) |
| `tests/cfg/f7-preflight-static-contract` | las funciones reemplazadas no coinciden con las de las migraciones |
| `tests/pm05/frontend-contract` | lógica de clientes sin empresa |
| `tests/pm15/p03-mej02-confirmacion-pago-destino` | la confirmación de pago no puede volver a ser un prompt del navegador |

Este último merece atención: dice que se ha reintroducido un `prompt` del
navegador para confirmar un pago, que es justo lo que ese contrato se escribió
para impedir.

### Lo que esto significa para el cierre

El rediseño puede seguir cerrado en su alcance visual y funcional; lo que no se
sostiene es la frase de que los rojos son ajenos. Siete no lo eran, y uno de
ellos tocaba quién puede ver qué local. Un cierre que archiva regresiones
propias como deuda de otros las entierra, porque nadie vuelve a mirarlas.

### Segunda tanda del 20/11 · de 7 rojos a 4

Cuatro más resueltos, todos regresiones de esta rama y ninguno silenciado.

- **`tests/ui-context-bridge`** · ver arriba. Una cuenta de empleado volvía a
  recibir en silencio un local distinto del que pedía. `bb20bcc2`.
- **`tests/pm15/p03-mej02`** · «Guardar vista» de clientes había vuelto a usar
  un `window.prompt`, que es exactamente lo que ese contrato prohíbe y por el
  motivo que lleva escrito: con un prompt el aviso de error sale después de
  cerrarse el diálogo, y donde el navegador no lo permite la acción no ocurre
  sin decir por qué. Ahora es una pantalla del programa, con el error dentro y
  un aviso nuevo: si el nombre ya existe, la vista anterior se reemplaza —cosa
  que antes pasaba igual, en silencio—. Se quitó también el prompt gemelo del
  componente `Clientes`, que ya no se monta pero sigue en el paquete. `b1253a76`.
- **`tests/pm05/frontend-contract`** · fijaba dos textos literales que cambiaron
  sin que la garantía cambiara: `empresaId` pasó de atajo a expresión y `...data`
  a `...normalizado`. Las dos comprobaciones pasan a exigir lo que defienden.
- **`tests/cfg/f7-preflight-static`** · la migración de propina en efectivo es
  del 24/10 y la foto F7 es del 3/10: no es de esa ventana de promoción. Queda
  excluida como las demás posteriores, con el motivo escrito.

**Batería: `NODE_ACTIVE_PASS=316`, `NODE_ACTIVE_FAIL=4`.**

Quedan cuatro, y se sabe qué es cada uno:

| Contrato | Qué pasa |
| --- | --- |
| `tests/cfg/a09-panel-ui-runtime` | ya estaba rojo en la base de la rama; es el único heredado de verdad |
| `tests/cfg/cfg6-ui-contract` | exige que la pantalla de configuración lea directamente `terminales_tpv` y hoy no lee ninguna tabla. Parece una mejora —todo pasa por `configRpc`— pero hay que confirmar de dónde salen ahora los terminales antes de relajar la regla, porque la regla existe para que ese componente no lea tablas por su cuenta |
| `tests/cfg/cfg6-ui-runtime` | en Cocina pulsa un botón que ya no está a la vista: la gestión avanzada se plegó tras «Mostrar gestión avanzada». El test necesita abrir ese desplegable; conviene decidir primero si plegarlo fue lo correcto |
| `tests/cfg/cfg6d-ui-runtime` | lo mismo |

Los tres de `cfg6` son de esta rama, no deuda heredada.
