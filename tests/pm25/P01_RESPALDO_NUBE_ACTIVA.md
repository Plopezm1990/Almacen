# PM25 P01 — Respaldo local mientras hay sesión de nube activa

## Alcance

PM-25 ("Ensayar recuperación y migración") se dividió en dos sub-puntos:
este (P01) cubre el mecanismo de "Respaldos" ya existente en la app, en un
perfil y fixture QA aislados; P02 (recuperación real de base de datos y
ensayo de migración) queda pendiente, con su propio plan por presentar
antes de ejecutar nada, según lo acordado.

## Hallazgo (por lectura directa de código, confirmado después en vivo)

El guardado sincronizado de varias colecciones (`sincronizarColeccionEmpresa`
para proveedores/clientes, `sincronizarColeccionEmpresaLocal` para
albaranes/facturas directas/gastos generales, en `index.html`) hace, en
cada guardado con nube activa: sube (`upsert`) cada fila de la colección
local, y **borra físicamente en el servidor** cualquier fila cuyo `id` no
esté en esa colección local.

`confirmarRestauracion()` (el botón "Restaurar respaldo") aplicaba el
contenido de un backup directamente al estado local **sin comprobar si
había sesión de nube activa**. Como cualquier cambio de estado local
dispara ese mismo guardado sincronizado, restaurar un backup antiguo
mientras se está conectado a la nube disparaba ese ciclo upsert+delete con
los datos del backup — es decir, podía **borrar en el servidor** cualquier
proveedor/cliente/albarán/gasto creado después de la fecha del backup, y
sobrescribir con valores antiguos lo editado después. Esto viola la regla
del proyecto de "nunca borrado físico silencioso".

## Corrección aplicada

En `confirmarRestauracion()` y en el modal "Restaurar respaldo": si
`window.__nubeActiva === true`, el restore ya no se aplica. En su lugar se
muestra un modal de diagnóstico explícito ("Restaurar respaldo —
bloqueado") explicando qué colecciones estarían en riesgo y sugiriendo
restaurar desde "Trabajar solo en este equipo, sin sincronizar". El botón
"Restaurar respaldo" deja de ofrecerse en ese caso. Se añadió además una
comprobación defensiva equivalente dentro de la propia
`confirmarRestauracion()`, por si el modal se saltara por algún otro
camino.

## Metodología de verificación en vivo

Autorizado explícitamente: una prueba puntual contra el proyecto QA real
con datos sintéticos, para confirmar la corrección de forma efectiva (no
solo por lectura de código).

- El navegador de este entorno no tiene salida de red fiable hacia QA
  (confirmado con una sonda directa: 3/3 intentos fallidos). Por eso toda
  petición al host de QA se reenvía tal cual desde este proceso Node (que sí
  tiene red fiable) mediante un proxy "tonto": no interpreta ni reescribe la
  petición, solo hace de puente. La app se conecta a QA usando el propio
  mecanismo de Deploy Preview ya existente en `index.html`
  (`window.__modoPruebasQA` / `__qaNubeUrl` / `__qaNubeClave`), con sesión
  real de `owner.a@qa.invalid` — nunca `service_role`.
- Se creó, ya con nube activa de verdad, un proveedor sintético
  ("QA PM25 Proveedor Fuera Del Backup") y se confirmó por consulta directa
  a QA que existía.
- Se construyó un respaldo sintético "antiguo" que contiene solo OTRO
  proveedor inventado, simulando un backup anterior a la creación del
  proveedor de arriba.
- Se intentó restaurar ese respaldo desde la UI real ("Restaurar desde
  texto") con la sesión de nube activa.
- Se verificó: el modal se bloquea con el diagnóstico; no se ofrece el
  botón de restaurar; y, por consulta directa a QA después del intento, que
  ni el proveedor preexistente de fixture (`QA-PROV-A`, de un punto
  anterior) ni el creado en esta prueba fueron borrados, y que el proveedor
  inventado del backup antiguo nunca se insertó (prueba de que el restore
  no llegó a aplicarse en absoluto).
- Limpieza: el proveedor sintético creado para la prueba se elimina al
  finalizar (por API directa, con la misma sesión autenticada). El fixture
  preexistente `QA-PROV-A` no se toca en ningún momento.

## Resultado

9/9 casos, incluida la confirmación en vivo contra QA real. Ningún dato
real, ninguna identidad real. No se usó `service_role`. No se creó ningún
Netlify Deploy Preview real — se reutilizó el mecanismo de
`__modoPruebasQA` ya existente en el propio código, reenviando las
peticiones por Node ante la falta de red fiable del navegador en este
entorno.

```
PM25_P01_RESPALDO_NUBE_ACTIVA_EJECUTADO=PASS
```
