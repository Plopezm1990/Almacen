import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const fuente = fs.readFileSync(path.join(root, "fuente.js"), "utf8");
const espejo = fs.readFileSync(path.join(root, "source-recovery", "fuente-recuperado.js"), "utf8");

// T7 (Etapa 5, continuación), pieza 2: conecta la pantalla del simulador de
// T7 (Hoja QA-9) con el Puente L&A (pieza 1, puente-la/) como una opción más,
// sin quitar el simulador. Pedro autorizó (25/10/2026, chat) construir y
// probar esto ahora. La configuración (habilitado/url/token) vive solo en
// localStorage de este navegador -- nunca es un ajuste de negocio.

for (const [nombre, contenido] of [["fuente", fuente], ["espejo de recuperación", espejo]]) {
  for (const funcion of ["leerConfigPuenteLA", "guardarConfigPuenteLA", "llamarPuenteLA", "comprobarConexionPuenteLA", "renderPuenteLAT7F4"]) {
    assert.ok(contenido.includes("function " + funcion), `${nombre}: falta ${funcion}`);
  }
  assert.match(
    contenido,
    /const \[puenteLAConfig, setPuenteLAConfig\] = \(0, import_react4\.useState\)\(\(\) => leerConfigPuenteLA\(\)\);/,
    `${nombre}: falta el estado de configuración del Puente L&A, inicializado desde localStorage`
  );

  // El registro en abc_eventos (RPC simulada) debe seguir pasando siempre;
  // el intento real al Puente L&A es un paso ADICIONAL, solo si está
  // habilitado, y solo tras confirmar que el registro ya se guardó.
  for (const [funcionUI, ruta] of [
    ["imprimirTicketSimuladoT7F4UI", "/imprimir"],
    ["abrirCajonSimuladoT7F4UI", "/abrir-cajon"],
  ]) {
    const inicio = contenido.indexOf("async function " + funcionUI);
    assert.ok(inicio > 0, `${nombre}: no se encontró ${funcionUI}`);
    const fin = contenido.indexOf("\n  async function", inicio + 10);
    const bloque = contenido.slice(inicio, fin > 0 ? fin : inicio + 1800);
    const posResultado = bloque.indexOf("if (!resultado?.ok)");
    const posHabilitado = bloque.indexOf("if (puenteLAConfig.habilitado)");
    const posLlamada = bloque.indexOf('llamarPuenteLA("' + ruta + '"');
    assert.ok(posResultado > 0 && posHabilitado > posResultado, `${nombre}: ${funcionUI} debe comprobar el resultado de la RPC antes de mirar si el puente está habilitado`);
    assert.ok(posLlamada > posHabilitado, `${nombre}: ${funcionUI} debe llamar a llamarPuenteLA("${ruta}", ...) solo dentro del bloque "habilitado"`);
  }

  // El panel del puente se registra en el render junto a los demás de T6/T7,
  // antes del cajón.
  const posPuente = contenido.indexOf("renderPuenteLAT7F4(),");
  const posCajon = contenido.indexOf("renderCajonT7F4(),");
  assert.ok(posPuente > 0 && posCajon > posPuente, `${nombre}: renderPuenteLAT7F4() debe registrarse antes de renderCajonT7F4()`);

  // Los textos y botones cambian según el modo (sin romper el simulador, que
  // sigue siendo la etiqueta por defecto cuando el puente no está activado).
  assert.match(contenido, /puenteLAConfig\.habilitado \? "Imprimir ticket" : "Imprimir ticket \(simulado\)"/, `${nombre}: el botón de imprimir debe reflejar el modo`);
  assert.match(contenido, /puenteLAConfig\.habilitado \? "Abrir cajón" : "Abrir cajón \(simulado\)"/, `${nombre}: el botón de abrir cajón debe reflejar el modo`);
}

// Paridad carácter a carácter de los bloques añadidos en esta pieza.
{
  const extraerBloque = (contenido, inicio, finPatron) => {
    const i = contenido.indexOf(inicio);
    assert.ok(i > 0, "ancla de inicio no encontrada: " + inicio);
    const f = contenido.indexOf(finPatron, i);
    assert.ok(f > i, "ancla de fin no encontrada tras: " + inicio);
    return contenido.slice(i, f);
  };
  const inicioFuncionesPuente = "// T7 (continuación, pieza 2): Puente L&A opcional";
  const finFunciones = "  // Modalidad de la cuenta al abrirla (pieza 6e):";
  assert.equal(
    extraerBloque(fuente, inicioFuncionesPuente, finFunciones),
    extraerBloque(espejo, inicioFuncionesPuente, finFunciones),
    "las funciones del Puente L&A deben ser idénticas entre fuente.js y el espejo"
  );

  const inicioRender = "function renderPuenteLAT7F4() {";
  const finRender = "function renderCajonT7F4() {";
  assert.equal(
    extraerBloque(fuente, inicioRender, finRender),
    extraerBloque(espejo, inicioRender, finRender),
    "renderPuenteLAT7F4 debe ser idéntico entre fuente.js y el espejo"
  );
}

console.log("PLAN_MAESTRO_ETAPA5_T7_PUENTE_LA_PIEZA2=PASS");
