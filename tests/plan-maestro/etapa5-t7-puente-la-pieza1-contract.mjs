import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const puenteDir = path.join(root, "puente-la");

// T7 (Etapa 5), pieza 2: el "Puente L&A" que su propia Hoja QA-9 de cierre
// (ETAPA5_T7_IMPRESION_CAJON_SIMULADOR_2026-10-24.md) dejó anotado como
// pendiente de hardware. Pedro autorizó (25/10/2026, chat) construir ahora
// toda la parte que SÍ se puede probar sin la impresora real, dejando el
// envío final de bytes al aparato escrito pero sin verificar — exactamente
// como el resto de piezas "modo simulador" de esta sesión.

const { construirBytesTicket, construirBytesAbrirCajon } = await import(
  pathToFileURL(path.join(puenteDir, "formato-ticket.js")).href
);
const { crearServidor } = await import(pathToFileURL(path.join(puenteDir, "servidor.js")).href);
const { cargarConfig } = await import(pathToFileURL(path.join(puenteDir, "config.js")).href);

// --- formato-ticket.js: construcción de bytes ESC/POS (pura, determinista) ---
{
  const bytes = construirBytesTicket({ lineas: ["Café solo", "Total 1,10€"], cortar: true });
  assert.ok(bytes.slice(0, 2).equals(Buffer.from([0x1b, 0x40])), "debe empezar con ESC @ (inicializar)");
  assert.ok(bytes.includes(Buffer.from("Café solo", "latin1")), "debe incluir la primera línea en latin1");
  assert.ok(bytes.includes(Buffer.from("Total 1,10€", "latin1")), "debe incluir la segunda línea en latin1");
  assert.ok(bytes.slice(-3).equals(Buffer.from([0x1d, 0x56, 0x00])), "debe terminar en GS V 0 (corte) cuando cortar=true");

  const sinCorte = construirBytesTicket({ lineas: ["Línea"], cortar: false });
  assert.ok(!sinCorte.slice(-3).equals(Buffer.from([0x1d, 0x56, 0x00])), "no debe cortar cuando cortar=false");

  assert.throws(() => construirBytesTicket({ lineas: "no es un array" }), /lineas debe ser un array/);

  const cajon = construirBytesAbrirCajon();
  assert.ok(cajon.equals(Buffer.from([0x1b, 0x70, 0x00, 0x19, 0xfa])), "el pulso de apertura de cajón debe ser ESC p 0 25 250");
}

// --- config.js: validación de config.json ---
{
  const dirTemporal = fs.mkdtempSync(path.join(os.tmpdir(), "puente-la-config-"));
  const rutaConfig = path.join(dirTemporal, "config.json");

  assert.throws(() => cargarConfig(rutaConfig), /Falta/, "debe fallar con un mensaje claro si no existe config.json");

  fs.writeFileSync(rutaConfig, JSON.stringify({ puerto: 9123, token: "corto", modo: "red", red: { ip: "1.2.3.4", puerto: 9100 } }));
  assert.throws(() => cargarConfig(rutaConfig), /al menos 16 caracteres/, "debe rechazar un token demasiado corto");

  fs.writeFileSync(rutaConfig, JSON.stringify({ puerto: 9123, token: "token-de-prueba-bien-largo", modo: "otra-cosa" }));
  assert.throws(() => cargarConfig(rutaConfig), /modo debe ser/, "debe rechazar un modo desconocido");

  fs.writeFileSync(rutaConfig, JSON.stringify({ puerto: 9123, token: "token-de-prueba-bien-largo", modo: "red" }));
  assert.throws(() => cargarConfig(rutaConfig), /config\.red/, "debe exigir red.ip/red.puerto en modo red");

  fs.writeFileSync(rutaConfig, JSON.stringify({ puerto: 9123, token: "token-de-prueba-bien-largo", modo: "windows" }));
  assert.throws(() => cargarConfig(rutaConfig), /config\.windows/, "debe exigir windows.nombreImpresora en modo windows");

  fs.writeFileSync(
    rutaConfig,
    JSON.stringify({ puerto: 9123, token: "token-de-prueba-bien-largo", modo: "red", red: { ip: "1.2.3.4", puerto: 9100 } })
  );
  const configValida = cargarConfig(rutaConfig);
  assert.equal(configValida.modo, "red");

  fs.rmSync(dirTemporal, { recursive: true, force: true });
}

// --- servidor.js: rutas, autenticación por token y elección del transporte ---
// Los transportes van inyectados: ningún socket ni llamada a Windows real.
async function conServidorDePrueba(config, fn) {
  const llamadasRed = [];
  const llamadasWindows = [];
  const servidor = crearServidor({
    config,
    transportes: {
      red: async (args) => { llamadasRed.push(args); },
      windows: async (args) => { llamadasWindows.push(args); },
    },
  });
  await new Promise((resolve) => servidor.listen(0, "127.0.0.1", resolve));
  const { port } = servidor.address();
  try {
    await fn({ base: `http://127.0.0.1:${port}`, llamadasRed, llamadasWindows });
  } finally {
    await new Promise((resolve) => servidor.close(resolve));
  }
}

const configRed = { puerto: 0, token: "token-de-prueba-bien-largo", modo: "red", red: { ip: "10.0.0.5", puerto: 9100 } };
const configWindows = { puerto: 0, token: "token-de-prueba-bien-largo", modo: "windows", windows: { nombreImpresora: "ImpresoraBarra" } };

await conServidorDePrueba(configRed, async ({ base, llamadasRed }) => {
  const estado = await fetch(base + "/estado");
  assert.equal(estado.status, 200);
  const cuerpoEstado = await estado.json();
  assert.equal(cuerpoEstado.modo, "red");
  assert.ok(!("token" in cuerpoEstado), "/estado no debe filtrar el token");

  const sinToken = await fetch(base + "/imprimir", { method: "POST", body: JSON.stringify({ lineas: ["x"] }) });
  assert.equal(sinToken.status, 401, "sin token debe rechazar con 401");

  const tokenMalo = await fetch(base + "/imprimir", {
    method: "POST",
    headers: { "X-Puente-Token": "otro-token-equivocado" },
    body: JSON.stringify({ lineas: ["x"] }),
  });
  assert.equal(tokenMalo.status, 401, "token equivocado debe rechazar con 401");

  const impresion = await fetch(base + "/imprimir", {
    method: "POST",
    headers: { "X-Puente-Token": configRed.token },
    body: JSON.stringify({ lineas: ["Café solo"], cortar: true }),
  });
  assert.equal(impresion.status, 200);
  assert.equal(llamadasRed.length, 1, "en modo red debe llamar al transporte de red");
  assert.equal(llamadasRed[0].ip, "10.0.0.5");
  assert.equal(llamadasRed[0].puerto, 9100);
  assert.ok(Buffer.isBuffer(llamadasRed[0].bytes) && llamadasRed[0].bytes.includes(Buffer.from("Café solo", "latin1")));

  const cajon = await fetch(base + "/abrir-cajon", {
    method: "POST",
    headers: { "X-Puente-Token": configRed.token },
  });
  assert.equal(cajon.status, 200);
  assert.equal(llamadasRed.length, 2, "abrir-cajon también debe usar el transporte configurado");
  assert.ok(llamadasRed[1].bytes.equals(Buffer.from([0x1b, 0x70, 0x00, 0x19, 0xfa])));

  const rutaDesconocida = await fetch(base + "/no-existe", {
    method: "POST",
    headers: { "X-Puente-Token": configRed.token },
  });
  assert.equal(rutaDesconocida.status, 404);
});

await conServidorDePrueba(configWindows, async ({ base, llamadasRed, llamadasWindows }) => {
  const impresion = await fetch(base + "/imprimir", {
    method: "POST",
    headers: { "X-Puente-Token": configWindows.token },
    body: JSON.stringify({ lineas: ["Agua"] }),
  });
  assert.equal(impresion.status, 200);
  assert.equal(llamadasRed.length, 0, "en modo windows no debe llamar al transporte de red");
  assert.equal(llamadasWindows.length, 1, "en modo windows debe llamar al transporte de windows");
  assert.equal(llamadasWindows[0].nombreImpresora, "ImpresoraBarra");
});

console.log("PLAN_MAESTRO_ETAPA5_T7_PUENTE_LA_PIEZA1=PASS");
