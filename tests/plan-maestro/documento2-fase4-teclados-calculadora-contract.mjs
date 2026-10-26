import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const fuentes = ["fuente.js", "source-recovery/fuente-recuperado.js"].map((archivo) => ({ archivo, texto: fs.readFileSync(path.join(root, archivo), "utf8") }));

for (const { archivo, texto } of fuentes) {
  assert.match(texto, /data-tpv-fase4-keypad/, `${archivo}: falta el editor numérico contextual`);
  assert.match(texto, /Aceptar cantidad/, `${archivo}: falta aceptar la edición de cantidad`);
  assert.match(texto, /Cancelar/, `${archivo}: falta cancelar la edición de cantidad`);
  assert.match(texto, /BACKSPACE/, `${archivo}: falta borrar un carácter sin vaciar el carrito`);
  assert.match(texto, /reemplazarSiguiente/, `${archivo}: el primer dígito no tiene semántica de sustitución explícita`);
  assert.match(texto, /onPointerDown: \(e2\) => \{ e2\.preventDefault\(\); abrirEditorCantidadA04\(l22\); \}/, `${archivo}: la cantidad no abre el teclado contextual sin duplicar teclado`);
  assert.match(texto, /inputMode: "decimal"/, `${archivo}: la cantidad no conserva la indicación de teclado decimal`);
  assert.match(texto, /data-tpv-fase4-calculator/, `${archivo}: falta la calculadora de apoyo`);
  assert.match(texto, /Borrar cálculo/, `${archivo}: la tecla C no tiene nombre accesible`);
  assert.match(texto, /evaluarCalculadoraTpvFase4/, `${archivo}: falta el evaluador controlado de la calculadora`);
  assert.match(texto, /No se puede dividir entre cero/, `${archivo}: falta el bloqueo de división por cero`);
  assert.match(texto, /no cambia cantidades, precios, descuentos ni pagos del ticket/, `${archivo}: la calculadora no declara su aislamiento del ticket`);
  assert.doesNotMatch(texto, /eval\s*\(/, `${archivo}: la calculadora no puede usar eval`);
  assert.match(texto, /F2 Buscar/, `${archivo}: se perdió el atajo documentado de búsqueda`);
  assert.match(texto, /F9 Guardar/, `${archivo}: se perdió el atajo documentado de guardado`);
}

console.log("DOCUMENTO2_FASE4_TECLADOS_CALCULADORA=PASS");
