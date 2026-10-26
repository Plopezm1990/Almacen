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

function origenPermitido(req, config) {
  const origen = req.headers.origin;
  if (typeof origen !== "string" || !origen) return true;
  const permitidos = Array.isArray(config.origenesPermitidos) ? config.origenesPermitidos : [];
  return permitidos.includes(origen);
}

function aplicarCors(req, res, config) {
  const origen = req.headers.origin;
  if (typeof origen !== "string" || !origen) return true;
  if (!origenPermitido(req, config)) return false;
  res.setHeader("Access-Control-Allow-Origin", origen);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Puente-Token");
  res.setHeader("Access-Control-Max-Age", "600");
  return true;
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
  const impresionesPorOperacion = new Map();

  async function enviarBytes(bytes) {
    if (config.modo === "red") {
      await enviarRed({ ip: config.red.ip, puerto: config.red.puerto, bytes });
    } else {
      await enviarWindows({ nombreImpresora: config.windows.nombreImpresora, bytes });
    }
  }

  return createServer(async (req, res) => {
    if (!aplicarCors(req, res, config)) {
      responderJson(res, 403, { ok: false, error: "Origen no permitido por la configuración del Puente L&A" });
      return;
    }
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }
    if (req.method === "GET" && req.url === "/estado") {
      responderJson(res, 200, {
        ok: true,
        modo: config.modo,
        capacidades: { qrFiscalEscPos: true, idempotenciaImpresion: true },
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
        const operationId = cuerpo.operationId == null ? "" : String(cuerpo.operationId).trim();
        if (operationId.length > 200) {
          responderJson(res, 400, { ok: false, error: "operationId demasiado largo" });
          return;
        }
        const imprimir = async () => {
          const bytes = construirBytesTicket({ lineas: cuerpo.lineas ?? [], cortar: cuerpo.cortar, qrFiscal: cuerpo.qrFiscal });
          await enviarBytes(bytes);
          return { ok: true, operationId: operationId || null };
        };
        if (!operationId) {
          responderJson(res, 200, await imprimir());
          return;
        }
        const anterior = impresionesPorOperacion.get(operationId);
        if (anterior) {
          const resultadoAnterior = await anterior;
          responderJson(res, 200, { ...resultadoAnterior, duplicate: true });
          return;
        }
        const pendiente = imprimir();
        impresionesPorOperacion.set(operationId, pendiente);
        try {
          responderJson(res, 200, { ...(await pendiente), duplicate: false });
        } catch (error) {
          impresionesPorOperacion.delete(operationId);
          throw error;
        }
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
