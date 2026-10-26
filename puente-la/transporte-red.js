import net from "node:net";

// Envía los bytes a una impresora de red por un socket TCP en crudo (el
// puerto 9100 es el estándar "raw/JetDirect" que usan casi todas las
// impresoras térmicas con conexión de red o WiFi). No probado todavía contra
// una impresora real.
export function enviarPorRed({ ip, puerto, bytes, timeoutMs = 5000 }) {
  return new Promise((resolve, reject) => {
    if (!ip || !puerto) {
      reject(new Error("Faltan ip o puerto de la impresora de red"));
      return;
    }
    const socket = net.createConnection({ host: ip, port: puerto }, () => {
      socket.write(bytes, (error) => {
        if (error) {
          socket.destroy();
          reject(error);
          return;
        }
        socket.end();
      });
    });
    socket.setTimeout(timeoutMs, () => {
      socket.destroy();
      reject(new Error("Tiempo de espera agotado conectando con la impresora de red"));
    });
    socket.on("error", (error) => reject(error));
    socket.on("close", () => resolve());
  });
}
