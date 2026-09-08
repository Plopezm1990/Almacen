import fs from 'node:fs';
import assert from 'node:assert/strict';

// PM15 P01 (NR-08, alcance F1): "Borradores y respuestas pendientes no saltan de
// empresa/local; cancelar, conservar y guardar según contrato explícito."
//
// El escenario literal que describe el plan es una carrera: un formulario (p.ej. "Nuevo
// encargo") queda abierto, el usuario cambia el local/empresa activo en segundo plano SIN
// cerrar el formulario, y al guardar los datos se guardan contra el contexto nuevo (o se
// pierden silenciosamente) en vez de contra el contexto con el que el usuario empezó a
// rellenar el formulario.
//
// Este test demuestra, por inspección estática del código real (no simulación), que ese
// escenario concreto NO es alcanzable con la arquitectura actual de navegación:
//
// 1) Los componentes con formularios de alta (Encargos, Clientes) se renderizan con el
//    idioma estándar de React `tab === "X" && <Componente .../>`. Cuando `tab` cambia a
//    otro valor, la expresión pasa a `false` y React desmonta el componente completo en
//    esa posición del árbol -- su estado local (`useState` del formulario) se destruye.
//    Esto es semántica de reconciliación de React, no una suposición: un elemento ausente
//    en la posición donde antes había uno provoca su desmontaje.
// 2) El único control que cambia `localActivoId` (el selector de local, que dispara
//    `cambiarLocalActivo`/`cambiarLocalActivoConVista`) NO se renderiza dentro de las ramas
//    `tab === "encargos"` ni `tab === "clientes"` -- solo aparece en
//    dashboard/resultados/libroiva/venta y en la propia pestaña "locales".
//
// Consecuencia: para cambiar de local mientras se está en Encargos o Clientes, el usuario
// tiene que salir de esa pestaña primero -- lo que ya desmonta cualquier formulario abierto
// (y por tanto, ese formulario nunca puede llegar a "guardar contra el contexto nuevo",
// porque ya no existe cuando el contexto cambia).
//
// Esto NO cierra NR-08 de forma global. Registra explícitamente, sin ocultarlo, un problema
// real y más amplio que queda pendiente: cualquier formulario a medio rellenar SÍ se pierde
// sin aviso al cambiar de pestaña (no solo al cambiar de empresa/local) -- ver
// tests/pm15/P01_CIERRE_LA022_NR08.md, sección "Pendiente explícito para PM15".

const src = fs.readFileSync('fuente.js', 'utf8');

function bloque(desdeMarcador, hastaMarcador, aPartirDe = 0) {
  const a = src.indexOf(desdeMarcador, aPartirDe);
  assert.ok(a >= 0, `marcador no encontrado: ${desdeMarcador}`);
  const b = src.indexOf(hastaMarcador, a + desdeMarcador.length);
  assert.ok(b > a, `marcador de fin no encontrado tras ${desdeMarcador}: ${hastaMarcador}`);
  return src.slice(a, b);
}

// ---- 1) Encargos y Clientes se renderizan con el idioma de desmontaje estándar `&&`. ----
{
  assert.match(src, /tab === "encargos" && \/\* @__PURE__ \*\/ import_react4\.default\.createElement\(\s*Encargos/);
  assert.match(src, /tab === "clientes" && \/\* @__PURE__ \*\/ import_react4\.default\.createElement\(/);
  console.log('P01_NR08_ENCARGOS_CLIENTES_DESMONTAN_AL_CAMBIAR_DE_TAB=PASS');
}

// ---- 2) Ningún control que cambie el local activo vive dentro de las ramas de Encargos o
// Clientes: extraemos cada rama (hasta el siguiente `tab === "..."` hermano) y confirmamos
// que no contienen ninguna llamada a los disparadores reales de cambio de contexto. ----
{
  const iniEncargos = src.indexOf('tab === "encargos" &&');
  const finEncargos = src.indexOf('tab === "clientes" &&', iniEncargos);
  const ramaEncargos = src.slice(iniEncargos, finEncargos);
  for (const disparador of ['cambiarLocalActivo(', 'cambiarLocalActivoConVista(', 'seleccionarContextoLocal(', 'SelectorLocalInformes']) {
    assert.doesNotMatch(ramaEncargos, new RegExp(disparador.replace(/[()]/g, '\\$&')), `no debe existir ${disparador} dentro de la rama de Encargos`);
  }

  const iniClientes = finEncargos;
  const finClientes = src.indexOf('tab ===', iniClientes + 'tab === "clientes" &&'.length);
  const ramaClientes = src.slice(iniClientes, finClientes);
  for (const disparador of ['cambiarLocalActivo(', 'cambiarLocalActivoConVista(', 'seleccionarContextoLocal(', 'SelectorLocalInformes']) {
    assert.doesNotMatch(ramaClientes, new RegExp(disparador.replace(/[()]/g, '\\$&')), `no debe existir ${disparador} dentro de la rama de Clientes`);
  }
  console.log('P01_NR08_SIN_SELECTOR_DE_CONTEXTO_DENTRO_DE_ENCARGOS_NI_CLIENTES=PASS');
}

// ---- 3) El único disparador real de cambio de local sí existe, y solo en las pestañas
// que lo exponen (para no dar por hecho que "no aparece" porque no existe en ningún sitio). ----
{
  assert.match(src, /tab === "dashboard".*SelectorLocalInformes/);
  assert.match(src, /onClick: \(\) => cambiarLocalActivo\(l22\.id\)/, 'Locales sí expone el cambio real de contexto');
  console.log('P01_NR08_SELECTOR_DE_CONTEXTO_EXISTE_FUERA_DE_ENCARGOS_CLIENTES=PASS');
}

console.log('PM15 P01 (NR-08, alcance literal) — cambiar contexto mientras un formulario de Encargos/Clientes sigue abierto no es alcanzable en la UI actual: contrato OK (pérdida general de borrador al cambiar de pestaña queda documentada como pendiente, no resuelta aquí)');
