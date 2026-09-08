# PM19 P02 — Aceite: responsable obligatorio

Segundo punto de PM19. `crearLogicaAceite` era, en general, un módulo maduro (revierte
stock correctamente al eliminar un registro, con aviso explícito si no localiza el
movimiento original) — el único hueco real frente a "controles conservan
responsable/fecha... históricos completos" era que `registrarCambio`/`registrarRelleno`
aceptaban `responsable: responsable || ""`, es decir, se podía guardar un cambio o
relleno de aceite sin saber quién lo hizo.

## Solución

- **`validarResponsableRegistroAceitePM19(responsable)`** (función pura, misma forma que
  la usada en APPCC): exige un responsable no vacío, recorta espacios.
- `registrarCambio`/`registrarRelleno` validan antes de tocar stock (si falta el
  responsable, no se descuenta aceite ni se crea el registro) y guardan el valor ya
  validado, no el crudo.
- `registrarRelleno` **no llamaba a `registrarAuditoria` en absoluto** (a diferencia de
  `registrarCambio`, que sí) — se añade también, mismo criterio que el resto del proyecto.

## Archivos

- `fuente.js`: `validarResponsableRegistroAceitePM19` (nueva, antes de
  `crearLogicaAceite`); `registrarCambio`/`registrarRelleno` actualizadas.
- `tests/pm19/p02-aceite-responsable-contract.mjs`: función pura,
  positivo/negativo/replay.
- `tests/pm19/p02-wiring-aceite-contract.mjs`: por inspección estática, confirma que
  ambas funciones validan de verdad antes de descontar stock.

## Regresión

Suite completa del proyecto — 101/101 sin regresiones (ver detalle en el commit de PM19).

## Estado de main/producción

`main` = `cc7cab7cc3781012ab3e7729dfa2af7476e19eae`, sin tocar directamente. Frontend
puro, sin migraciones Supabase.
