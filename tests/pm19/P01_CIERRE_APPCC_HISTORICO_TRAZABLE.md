# PM19 P01 — APPCC: histórico completo y trazable

Primer punto de PM19 (Completar módulos operativos restantes). Cubre la parte de "APPCC y
aceite de freidoras · PM19: Control, responsables, fechas e históricos completos" y
NR-11 ("controles completos con efecto y trazabilidad") que corresponde a APPCC.

## Diagnóstico (inspección de código real)

`crearLogicaAppcc` era el módulo más débil de los cinco inspeccionados en PM19:

- `eliminarRegistroAppcc(id)` **borraba el registro físicamente**
  (`setRegistrosAppcc(s => s.filter(r => r.id !== id))`) — sin cancelación ni motivo, sin
  dejar ningún rastro. Viola directamente la regla ya establecida en el proyecto de nunca
  hacer borrado silencioso de correcciones operativas, y contradice el propio texto de
  PM19 ("históricos completos"). La función estaba, además, **sin usar desde ninguna
  pantalla** — dead code que hacía lo incorrecto.
- `registrarAppcc(data)` no exigía responsable: se podía guardar un control con ese campo
  vacío, pese a que "controles conservan responsable/fecha" es literal en PM19.
- El módulo entero **no llamaba a `registrarAuditoria` ni una sola vez** — a diferencia de
  prácticamente todos los demás módulos del proyecto.

## Solución

- **`validarRegistroAppccPM19(data)`** (función pura): exige `responsable` no vacío antes
  de aceptar un registro.
- **`prepararCancelacionAppccPM19(registro, {motivo, actorNombre})`** (función pura):
  exige motivo y actor; si el registro ya está cancelado, devuelve `replayed: true` en vez
  de tratarlo como error o repetir la cancelación.
- **`crearLogicaAppcc`** ahora recibe `registrarAuditoria`; `registrarAppcc` valida antes
  de guardar y deja auditoría; `eliminarRegistroAppcc` se sustituye por
  **`cancelarRegistroAppcc(id, opciones)`**, que marca el registro
  (`cancelado, motivoCancelacion, canceladoPor, canceladoEn`) sin eliminarlo nunca, y
  también deja auditoría.
- **Componente `Appcc`**: el formulario de registro muestra el error real si falta
  responsable; se añade una lista (fuera de la zona imprimible) para cancelar un registro
  con motivo y responsable de la cancelación; el histórico impreso sigue mostrando
  **todos** los registros, incluidos los cancelados (marcados como tales), y un registro
  cancelado deja de contar como desviación activa en el resumen de no conformidades.

## Archivos

- `fuente.js`: `validarRegistroAppccPM19`, `prepararCancelacionAppccPM19` (nuevas, antes
  de `crearLogicaAppcc`); `crearLogicaAppcc` y el componente `Appcc` actualizados.
- `tests/pm19/p01-appcc-historico-trazable-contract.mjs`: funciones puras,
  positivo/negativo/replay.
- `tests/pm19/p01-wiring-appcc-contract.mjs`: por inspección estática, confirma que la
  lógica, la composición y el componente real están conectados de punta a punta.

## Regresión

Suite completa del proyecto — 101/101 sin regresiones (ver detalle en el commit de PM19).

## Estado de main/producción

`main` = `cc7cab7cc3781012ab3e7729dfa2af7476e19eae` (release consolidado hasta PM18 P01),
sin tocar directamente. Frontend puro, sin migraciones Supabase.
