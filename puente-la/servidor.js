import { createServer } from "node:http";
import { construirBytesTicket, construirBytesAbrirCajon } from "./formato-ticket.js";
import { enviarPorRed as enviarPorRedReal } from "./transporte-red.js";
import { enviarPorImpresoraWindows as enviarPorImpresoraWindowsReal } from "./transporte-windows.js";

function leerCuerpoJson(req) {
  return new Promise((resolve, reject) => {
    let datos = "";
    req.on("data", (trozo) => {
      datos += trozo;
    });
    req.on("end", () => {
      if (!datos) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(datos));
      } catch {
        reject(new Error("JSON inválido"));
      }
    });
    req.on("error", reject);
  });
}

function responderJson(res, status, cuerpo) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(cuerpo));
}

function tokenValido(req, config) {
  const recibido = req.headers["x-puente-token"];
  return typeof recibido === "string" && recibido === config.token;
}

// crearServidor acepta transportes inyectados para poder probar toda la
// lógica de rutas y autenticación sin abrir ningún socket ni llamar a
// Windows de verdad.
export function crearServidor({ config, transportes } = {}) {
  const enviarRed = transportes?.red ?? enviarPorRedReal;
  const enviarWindows = transportes?.windows ?? enviarPorImpresoraWindowsReal;

  async function enviarBytes(bytes) {
    if (config.modo === "red") {
      await enviarRed({ ip: config.red.ip, puerto: config.red.puerto, bytes });
    } else {
      await enviarWindows({ nombreImpresora: config.windows.nombreImpresora, bytes });
    }
  }

  return createServer(async (req, res) => {
    if (req.method === "GET" && req.url === "/estado") {
      responderJson(res, 200, {
        ok: true,
        modo: config.modo,
        aviso: "Puente L&A: modo " + config.modo + ", sin probar todavía contra una impresora real",
      });
      return;
    }
    if (!tokenValido(req, config)) {
      responderJson(res, 401, { ok: false, error: "Token inválido o ausente" });
      return;
    }
    if (req.method === "POST" && req.url === "/imprimir") {
      try {
        const cuerpo = await leerCuerpoJson(req);
        const bytes = construirBytesTicket({ lineas: cuerpo.lineas ?? [], cortar: cuerpo.cortar });
        await enviarBytes(bytes);
        responderJson(res, 200, { ok: true });
      } catch (error) {
        responderJson(res, 500, { ok: false, error: String(error?.message ?? error) });
      }
      return;
    }
    if (req.method === "POST" && req.url === "/abrir-cajon") {
      try {
        const bytes = construirBytesAbrirCajon();
        await enviarBytes(bytes);
        responderJson(res, 200, { ok: true });
      } catch (error) {
        responderJson(res, 500, { ok: false, error: String(error?.message ?? error) });
      }
      return;
    }
    responderJson(res, 404, { ok: false, error: "Ruta no encontrada" });
  });
}
