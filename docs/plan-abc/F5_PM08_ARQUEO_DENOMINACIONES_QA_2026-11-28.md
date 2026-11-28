# F5 / PM08 — Arqueo por denominaciones en QA

**Fecha:** 2026-11-28  
**Ámbito:** QA únicamente  
**Worktree:** `Almacen-qa-cargos-permisos`  
**Estado:** fase 1 implementada y verificada en código; pendiente la prueba funcional en el navegador de QA y la integración completa del cierre

## Objetivo de esta fase

Hacer fiable el conteo de efectivo por billetes y monedas antes de continuar con la integración completa del cierre de caja. El formulario debe distinguir un importe introducido manualmente de un importe calculado por denominaciones, permitir un cero explícito y enviar al registro el importe que corresponde al modo activo.

## Problema encontrado

La interfaz calculaba correctamente el total de las denominaciones, pero el guardado seguía exigiendo que el campo de importe manual tuviera contenido. Como ese campo se deshabilita al contar por denominaciones, un usuario podía ver, por ejemplo, `60,00 €` y recibir aun así el error de que debía escribir un efectivo contado.

También se identificaron estos casos relacionados:

- Al retirar la última unidad podía recuperarse un importe manual anterior en lugar de guardar `0,00 €`.
- El modo visual de mostrar u ocultar el panel no era un estado de conteo explícito.
- El formulario podía conservar datos de otra fecha cuando no existía un borrador para la fecha seleccionada.
- Las cantidades no estaban limitadas en la interfaz al máximo admitido por la RPC.
- El cálculo con decimales dependía de operaciones de coma flotante.

## Corrección aplicada en `fuente.js`

El commit `57b10b74` (`fix(qa): make denomination cash counts explicit`) aplica la corrección en la rama de QA:

- Añade el estado explícito `modoConteo`, con los valores `manual` y `denominaciones`.
- Calcula `contadoNumero` exclusivamente desde el modo activo.
- Permite guardar un conteo por denominaciones vacío como `0,00 €`, sin reutilizar el importe manual.
- Envía las denominaciones únicamente cuando el modo activo es `denominaciones`.
- Conserva `modoConteo` dentro del borrador/payload local para recuperar correctamente el modo al reabrirlo. Ese dato es metadato local: no se envía como argumento a la RPC ni se incorpora al snapshot económico que se compara para reintentos.
- Limpia importe, denominaciones, modo y notas cuando no existe borrador para la fecha seleccionada.
- Restablece el formulario al modo manual después de un guardado correcto.
- Calcula el total de denominaciones en céntimos antes de convertirlo a euros.
- Limita cada denominación a `100000` unidades y deshabilita `+` al alcanzar ese límite.
- Valida las claves de denominación admitidas y las cantidades enteras no negativas.
- Amplía a `44 × 44` píxeles mínimos los controles `+` y `−` del conteo.
- Mantiene el identificador y el payload económico de la operación sin añadir el modo de conteo al payload pendiente que se compara para reintentos; el modo solo acompaña al borrador local.

La corrección no cambia la firma de la RPC ni requiere una migración de base de datos.

## Canon y límites de denominaciones

Se mantienen las quince denominaciones existentes:

- Billetes: `500`, `200`, `100`, `50`, `20`, `10`, `5`.
- Monedas: `2`, `1`, `0.5`, `0.2`, `0.1`, `0.05`, `0.02`, `0.01`.

Las claves del objeto enviado al servidor deben ser canónicas. En particular, se conservan `"0.5"`, `"0.2"` y `"0.1"`; no deben sustituirse por `"0.50"`, `"0,50"` ni etiquetas con el símbolo `€`.

El contrato actual exige:

- Cantidades enteras.
- Cantidades entre `0` y `100000`, inclusive.
- Solo las quince claves reconocidas.
- Importe total finito, no negativo y con dos decimales.

La interfaz debe seguir reflejando estos límites, pero la validación del servidor continúa siendo la autoridad.

## Comportamiento de los modos

### Modo manual

El usuario introduce directamente el efectivo contado. Las denominaciones conservadas en memoria no participan en el cálculo ni se envían como desglose económico.

### Modo por denominaciones

El usuario activa «Contar por denominaciones». El campo total pasa a ser de solo lectura y se calcula a partir de las cantidades de billetes y monedas. Tocar `+` añade una unidad; `−` la retira sin permitir valores negativos. Si todas las cantidades están a cero, el valor válido es `0,00 €`.

Cambiar de modo no convierte silenciosamente el total de un modo en el otro. Ocultar o mostrar controles es una decisión de interfaz y no debe alterar el modo activo.

## Imágenes reales de euros

La investigación de Astra 6.0 se ha aplicado mediante recursos locales, sin depender de URLs externas ni generar imágenes artificiales.

- Se incorporaron **15 recursos oficiales locales** en `assets/euro`: 7 JPG de billetes y 8 PNG de monedas.
- Los billetes proceden de recursos digitales oficiales del Banco Central Europeo y conservan la marca `SPECIMEN`.
- Las monedas utilizan las caras comunes oficiales publicadas por la Comisión Europea.
- `assets/euro/README.md` documenta la atribución, las fuentes y las condiciones de reproducción.
- La interfaz mantiene el valor textual y un fallback textual si una imagen no carga; el conteo no depende de la disponibilidad de la imagen.
- Los recursos se sirven desde el propio proyecto para mantener un comportamiento estable y evitar dependencia de terceros en tiempo de ejecución.

## Verificación realizada

La corrección y los recursos ya cuentan con estas comprobaciones:

- Runtime de interacción añadido al test existente `tests/cfg/c03-arqueo-ui-runtime.mjs`: **12/12 comprobaciones superadas**.
- Contrato frontend PM08: **64 checks superados**.
- Comprobación de sintaxis JavaScript superada.
- `python -I source-recovery/recuperar_candidato.py --check`: paridad exacta del cuerpo de aplicación superada.
- `git diff --check`: sin errores de espacios o formato.

El runtime cubre, entre otros casos, guardar desde denominaciones sin introducir importe manual, cero explícito, cambio de modo, cálculo de céntimos, límites y recuperación del formulario. Estas comprobaciones son de contrato/runtime; no sustituyen todavía la prueba manual de la aplicación desplegada en el navegador de QA.

## Pendiente real

La fase de fiabilidad del conteo y la incorporación local de imágenes están realizadas. Solo queda pendiente en esta fase:

- Probar el flujo completo en el navegador desplegado de QA, incluyendo carga visual de las 15 imágenes y guardado contra el entorno compartido.
- Confirmar en QA el comportamiento ante timeout, reintento y doble pulsación con datos controlados.
- Revisar la conciliación completa por la misma sesión/caja para efectivo, tarjetas, transferencias, pagos mixtos, devoluciones y propinas.
- Completar las fases posteriores del objetivo: contexto local/caja/terminal/sesión, separación de arqueo y cierre, diferencias y permisos de servidor, bloqueo tras cierre, resguardo y persistencia del desglose cuando corresponda.

No se marca como pendiente ningún test ya ejecutado ni la incorporación de imágenes, porque ambos trabajos están verificados en el estado actual.

## Restricciones y seguridad de despliegue

- El trabajo se limita a QA.
- Producción no se consulta ni se modifica para esta fase.
- No se aplican migraciones nuevas en Supabase QA sin coordinación expresa.
- Las migraciones compartidas de la otra sesión no se modifican.
- El PR #228 no se fusiona ni cambia de base mientras dure el cierre coordinado de #226 y #225.
- El servidor mantiene la autoridad sobre permisos, sesión abierta, terminal vinculado, día operativo y cálculo del esperado.
- Esta fase no resuelve todavía la restricción de un arqueo activo por día/local frente al cálculo esperado por sesión.
- La validación de motivo de descuadre en pantalla no equivale todavía a una garantía completa en servidor.

## Siguientes fases

1. Probar en el navegador de QA las imágenes locales, el conteo táctil, el guardado, el cero explícito y los reintentos.
2. Aclarar local, caja, terminal, sesión y día operativo, diferenciando guardar arqueo, cierre provisional y cierre definitivo.
3. Revisar la conciliación por el mismo ámbito de sesión/caja: efectivo esperado, entradas, retiradas, devoluciones, tarjetas, transferencias, otros medios, pagos mixtos y propinas.
4. Completar diferencias, permisos, auditoría, reapertura controlada y bloqueo después del cierre definitivo.
5. Completar el resguardo del arqueo/cierre y decidir cómo persistir el desglose en el cierre sin romper históricos.
6. Ejecutar la validación completa en QA, documentar resultados y preparar el PR para revisión sin tocar producción.

