# PM17 P02 — Lote 2: neutralización nativa de Prefiltros y Entrevistas

Segundo lote de PM17, según la matriz de `docs/plan-maestro/PM17_DIAGNOSTICO_PARCHES.md`
(punto 6). Relacionado con **LA-024** (PM-17, catálogo `tests/pm04/regression-catalog.json`)
y con la preocupación de sesgo en decisiones de personal (NR-04 del plan, mencionado en el
propio texto ya nativo del componente: "La evaluación nunca tiene en cuenta nacionalidad,
sexo, edad ni ninguna característica ajena al desempeño").

## Diagnóstico (confirmado en el turno anterior)

El componente nativo `SeleccionPersonal` renderizaba **incondicionalmente** puntuación
numérica por puesto, nivel de confianza, recomendación final con color semafórico,
"Puesto principal"/"Segunda opción" con sus razones, "Se recomienda prueba práctica
para...", fortalezas, aspectos a mejorar, señales de riesgo (resaltadas en rojo si las
hay), perfil profesional y competencias generales (`/100` por competencia) — para cada
entrevista. El modal de prefiltro mostraba de igual forma una "Puntuación orientativa",
avisos y una recomendación explícita. La única capa que evitaba mostrar todo esto era
`seleccion-neutral-patch.js`, un archivo externo cargado por red en runtime.

**LA-024 es explícito**: "Texto neutral integrado y revalidado en candidato; no
reimplementar si el cambio existente ya está presente." — el texto/estructura neutral ya
existían (en el parche); este lote no inventa contenido nuevo, **traslada la misma
lógica** de decisión (qué mostrar/ocultar y con qué texto) al propio componente React,
para que deje de depender de que un archivo externo termine de descargarse antes de que
el usuario abra un informe.

## Solución

- **`informeEntrevistaTieneCamposNeutralesPM17(inf)`** / **`prefiltroEsFormatoAntiguoPM17(resumen)`**
  (funciones puras nuevas): replican exactamente la misma clasificación que ya usaba el
  parche (`tieneNeutral`/`esFormatoAntiguo`) — hoy, con el formato que genera actualmente
  la Edge Function `entrevista-personal`, ambas evalúan siempre al caso "sin campos
  neutrales"/"formato antiguo": es el comportamiento real y ya vigente hoy con el parche
  activo (la propia Edge Function nunca ha llegado a generar los campos neutrales nuevos),
  no un cambio de comportamiento.
- **`InformeEntrevistaNeutralPM17({ inf })`**: sustituye, dentro de `SeleccionPersonal`, a
  todos los bloques puntuados del informe de entrevista. Si el informe algún día trae
  campos neutrales (`resumen`, `experiencia`, `disponibilidad`, `evidencias_aportadas`,
  `situaciones_tratadas`, `cuestiones_a_aclarar`), los muestra; si no, muestra una única
  tarjeta "Informe anterior" con el mismo aviso que ya usaba el parche. La transcripción
  completa de la entrevista **sigue disponible** para revisión humana — no se toca.
- **`ResumenPrefiltroNeutralPM17({ resumen })`**: mismo patrón para el modal de prefiltro
  — sustituye Puntuación orientativa/Avisos/Recomendación/Resumen/Experiencia/
  Disponibilidad/Motivación por la clasificación neutral. Las "Respuestas completas" del
  candidato (datos en bruto, no una valoración automática) siguen visibles sin cambios.
- **Listados**: la insignia "· NN/100" y "· con avisos" en la lista de prefiltros, y el
  texto "Recomendado: <puesto>" en la lista de entrevistas, se sustituyen por
  "Entrevista completada" — mismo criterio que ya aplicaba `parchearTextos` en el parche.
- **Dos textos introductorios** (tarjetas de Prefiltro y de Entrevista) se sustituyen por
  la redacción neutral que ya usaba el parche, que desmiente explícitamente que la IA
  puntúe, recomiende o decida una contratación.
- El parche externo (`seleccion-neutral-patch.js`) **sigue activo** y no se ha tocado en
  este lote — su parte de neutralización queda ahora redundante con la nativa (haría un
  segundo intento de ocultar por DOM algo que ya no existe en el HTML), sin conflicto; se
  revisará su retirada en el lote 4, junto con la parte de seguridad de suscripción push
  del mismo archivo.

## Archivos

- `fuente.js`: `informeEntrevistaTieneCamposNeutralesPM17`, `prefiltroEsFormatoAntiguoPM17`,
  `InformeEntrevistaNeutralPM17`, `ResumenPrefiltroNeutralPM17` (nuevas, antes de
  `SeleccionPersonal`); `SeleccionPersonal` reescrito para usarlas en el informe de
  entrevista, el modal de prefiltro, los dos listados y los dos textos introductorios.
- `tests/pm17/p02-neutralidad-informes-nativo-contract.mjs` (nuevo): las dos funciones de
  clasificación, positivo/negativo/replay.
- `tests/pm17/p02-wiring-seleccionpersonal-contract.mjs` (nuevo): por inspección estática,
  confirma que el JSX real usa los componentes neutrales y que no queda ningún texto
  puntuado/recomendado en el componente.

## Regresión

Suite completa: `tests/g1`, `pm04`, `pm05`, `pm07`, `pm08`, `pm09`, `pm10`,
`pm11-compra`, `pm12`, `pm13`, `pm14`, `pm15`, `pm16`, `pm17` — 88/88 sin regresiones
(incluye la suite de PM13 que ya cubría Personal/Entrevistas).

## Estado de main/producción

`main` = `5db0b9ed03c8f8ecd700ff339edce1dff14ffde4`, sin tocar directamente. Frontend
puro, sin migraciones Supabase. No se ha activado ningún envío real ni retirado ninguna
función productiva. `L&A Suite` (producción) y `TPV` no se han tocado.

## Pendiente

- Lote 3: portar auth UX (olvidar contraseña, logout Propietario) de forma nativa.
- Lote 4: retirar `seleccion-neutral-patch.js`/`auth-ux-patch.js`, solo cuando 1-3 estén
  cerrados y verdes en remoto.
