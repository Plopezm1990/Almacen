import { readFileSync, existsSync } from "node:fs";

export function cargarConfig(rutaConfig) {
  if (!existsSync(rutaConfig)) {
    throw new Error(
      "Falta " + rutaConfig + ". Copia config.ejemplo.json a config.json y rellena tu propio token y los datos de tu impresora."
    );
  }
  const config = JSON.parse(readFileSync(rutaConfig, "utf8"));
  if (!config.puerto || typeof config.puerto !== "number") {
    throw new Error("config.puerto debe ser un número (el puerto local donde escucha el puente)");
  }
  if (!config.token || typeof config.token !== "string" || config.token.length < 16) {
    throw new Error("El token de config.json debe ser un texto de al menos 16 caracteres. Genera uno propio, no uses el de ejemplo.");
  }
  if (config.modo !== "red" && config.modo !== "windows") {
    throw new Error('config.modo debe ser "red" o "windows"');
  }
  if (config.modo === "red" && (!config.red?.ip || !config.red?.puerto)) {
    throw new Error("Falta config.red.ip o config.red.puerto");
  }
  if (config.modo === "windows" && !config.windows?.nombreImpresora) {
    throw new Error("Falta config.windows.nombreImpresora");
  }
  if (config.origenesPermitidos != null && (!Array.isArray(config.origenesPermitidos)
      || config.origenesPermitidos.some((origen) => typeof origen !== "string" || !/^https?:\/\//i.test(origen)))) {
    throw new Error("config.origenesPermitidos debe ser una lista de orígenes http(s)");
  }
  return config;
}
