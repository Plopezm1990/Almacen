// Contrato: las tarjetas "Mesas ocupadas" y "Comandas activas" del Inicio de
// Órbita leen datos REALES del servidor, nunca un número inventado.
//
// Contexto
// --------
// 23/11/2026: al comparar ini-01 con la maqueta nueva de Codex, la maqueta
// muestra tres indicadores primarios (Ventas de hoy, Mesas ocupadas, Comandas
// activas); el programa solo mostraba dos (Ventas, Margen) porque
// `PANELES_REDISENO.orbita.indicadores` nunca pedía esos datos. El panel de
// servicio retirado esa misma mañana (la-pase-panel.js, ver
// CORRECCION_CIERRE_FINAL_ORBITA_2026-11-23.md) SÍ los calculaba, con las
// mismas funciones reales que ya expone `window.__laPuenteRediseno`:
// `cargarMapaSalaA07({ paraPanel: true })` (RPC `abc_listar_mapa_sala`, misma
// RLS) y `listarEstacionesA10.listarPedidosTurno` (RPC
// `abc_listar_comandas_estacion` + lectura de `pedidos_tpv`). El usuario
// autorizó reutilizar esas mismas funciones para Inicio, con una condición
// explícita: "no se inventan datos" (regla 3 del plan pantalla a pantalla).
//
// Qué fija este contrato
// -----------------------
// Que las dos tarjetas nuevas existen, que piden los datos con las MISMAS
// funciones que ya pasaban por el servidor (no una copia nueva ni una
// simulación), que mientras no hay respuesta no se enseña un cero fabricado
// (se enseña "…"), y que un fallo del servidor se dice como fallo, no como
// "0". Se comprueba en las dos fuentes con paridad: fuente.js y
// source-recovery/fuente-recuperado.js.

import fs from 'node:fs';
import assert from 'node:assert/strict';

for (const [nombre, ruta] of [
  ['fuente.js', 'fuente.js'],
  ['source-recovery/fuente-recuperado.js', 'source-recovery/fuente-recuperado.js'],
]) {
  const texto = fs.readFileSync(ruta, 'utf8');

  // 1. Los dos indicadores primarios de Órbita, en el orden de la maqueta:
  //    Ventas de hoy, Mesas ocupadas, Comandas activas. Ya no se piden
  //    "margen" ni "pedidos", que no están en la maqueta de Inicio.
  assert.match(
    texto,
    /orbita: \{ titulo: "El turno,", destacado: "en movimiento\.", indicadores: \["ventas", "mesasocupadas", "comandasactivas"\]/,
    `${nombre}: el Inicio de Órbita debe pedir exactamente ventas, mesasocupadas y comandasactivas, en ese orden`,
  );

  // 2. Dashboard recibe las funciones REALES por prop, con los mismos nombres
  //    que ya usaba el puente de la aplicación (window.__laPuenteRediseno),
  //    no una función nueva que reimplemente la lógica.
  assert.match(
    texto,
    /function Dashboard\(\{[^)]*cargarMapaSala, listarPedidosTurno \}\) \{/,
    `${nombre}: Dashboard debe aceptar cargarMapaSala y listarPedidosTurno como props`,
  );
  assert.match(
    texto,
    /cargarMapaSala: \(\) => cargarMapaSalaA07\(\{ paraPanel: true \}\),\s*\n\s*listarPedidosTurno: listarEstacionesA10\.listarPedidosTurno,/,
    `${nombre}: Inicio debe invocar la MISMA función de mapa de sala que el resto de la aplicación (paraPanel: true), no una propia`,
  );

  // 3. Mientras no hay respuesta del servidor, "…" — nunca un cero que
  //    parezca un dato confirmado. Y si el servidor falla, se dice el motivo,
  //    no se enseña "0 / 0".
  assert.match(
    texto,
    /valor: estadoSalaOrbita\.cargando \? "…" : estadoSalaOrbita\.error \? "—" : `\$\{estadoSalaOrbita\.ocupadas\} \/ \$\{estadoSalaOrbita\.total\}`/,
    `${nombre}: Mesas ocupadas no debe mostrar un número mientras no hay respuesta confirmada del servidor`,
  );
  assert.match(
    texto,
    /valor: estadoComandasOrbita\.cargando \? "…" : estadoComandasOrbita\.error \? "—" : estadoComandasOrbita\.total/,
    `${nombre}: Comandas activas no debe mostrar un número mientras no hay respuesta confirmada del servidor`,
  );

  // 4. El conteo de ocupación viene de datos reales devueltos por el RPC
  //    (zonas -> mesas -> estado_efectivo), no de una constante.
  assert.match(
    texto,
    /mesas\.filter\(\(m22\) => m22\.estado_efectivo === "OCUPADA"\)\.length/,
    `${nombre}: la ocupación debe contarse sobre las mesas que devuelve el servidor, con su estado real`,
  );

  // 5. El efecto que pide los datos solo se dispara para Órbita, y no lleva
  //    temporizador propio (ni setInterval ni polling): una petición por
  //    cambio de diseño, igual que cualquier otra carga de Inicio. Esto es lo
  //    que evita repetir el patrón de sobrecarga que causó el aviso de
  //    Firefox "esta página está ralentizando" el mismo 23/11/2026 (ver
  //    CORRECCION_CIERRE_FINAL_ORBITA_2026-11-23.md).
  const inicioEfecto = texto.indexOf('estadoSalaOrbita, setEstadoSalaOrbita');
  const finEfecto = texto.indexOf('}, [diseno]);', inicioEfecto);
  assert.ok(inicioEfecto > 0 && finEfecto > inicioEfecto, `${nombre}: no se encuentra el efecto que carga sala y comandas de Inicio`);
  const cuerpoEfecto = texto.slice(inicioEfecto, finEfecto);
  assert.doesNotMatch(cuerpoEfecto, /setInterval/, `${nombre}: el efecto de Inicio no debe instalar un temporizador propio`);
  assert.match(cuerpoEfecto, /if \(diseno !== "orbita"\) return;/, `${nombre}: el efecto no debe pedir sala ni comandas fuera de Órbita`);
}

console.log('REDISENO_INI01_KPI_SALA_COMANDAS=OK');
