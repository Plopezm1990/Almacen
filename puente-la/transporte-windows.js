import { execFile } from "node:child_process";
import { writeFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import path from "node:path";

// Envía los bytes en crudo a una impresora ya instalada y compartida en
// Windows (Panel de impresoras > click derecho > Propiedades de impresora >
// Compartir), sin necesitar ningún driver propio en el puente: se escriben
// los bytes en un archivo temporal y se copian en modo binario a la ruta de
// red local de esa impresora compartida. Es el método documentado para
// imprimir ESC/POS en crudo desde Windows sin instalar nada adicional.
// No probado todavía contra una impresora real ni en un Windows real — este
// contenedor de desarrollo es Linux.
export async function enviarPorImpresoraWindows({ nombreImpresora, bytes }) {
  if (!nombreImpresora) throw new Error("Falta el nombre de la impresora compartida en Windows");
  const archivoTemporal = path.join(tmpdir(), "puente-la-" + randomUUID() + ".bin");
  await writeFile(archivoTemporal, bytes);
  try {
    await new Promise((resolve, reject) => {
      execFile(
        "cmd.exe",
        ["/c", "copy", "/b", archivoTemporal, "\\\\localhost\\" + nombreImpresora],
        (error) => {
          if (error) reject(error);
          else resolve();
        }
      );
    });
  } finally {
    await unlink(archivoTemporal).catch(() => {});
  }
}
