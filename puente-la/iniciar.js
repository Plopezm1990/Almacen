import path from "node:path";
import { fileURLToPath } from "node:url";
import { cargarConfig } from "./config.js";
import { crearServidor } from "./servidor.js";

const aquiMismo = path.dirname(fileURLToPath(import.meta.url));
const config = cargarConfig(path.join(aquiMismo, "config.json"));
const servidor = crearServidor({ config });

servidor.listen(config.puerto, "127.0.0.1", () => {
  console.log("Puente L&A escuchando en http://127.0.0.1:" + config.puerto + " (modo: " + config.modo + ")");
  console.log("AVISO: todavía sin probar contra una impresora real.");
});
