import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

// C-01 — El cobro en efectivo fallaba porque el cliente validaba con una
// tolerancia de coma flotante (1e-6) y enviaba los importes sin redondear,
// mientras que el servidor exige igualdad exacta sobre numeric en dos capas:
// la RPC abc_iniciar_cobro y la restriccion CHECK de public.pagos.
//
// Con importes corrientes de un bar la resta en JavaScript deja un resto
// imperceptible —2 - 1.1 da 0.8999999999999999— que el cliente aceptaba y la
// base rechazaba con efectivo_recibido_cambio_inconsistente.

const ficheros = ["../../fuente.js", "../../source-recovery/fuente-recuperado.js"];

for (const rel of ficheros) {
  const src = fs.readFileSync(new URL(rel, import.meta.url), "utf8").replace(/\r\n/g, "\n");

  test(`${rel}: la tolerancia de coma flotante ya no decide el cobro`, () => {
    assert.ok(
      !src.includes("Math.abs((recibido - cambio) - importe) > 0.000001"),
      "la comparacion con tolerancia 1e-6 debe haber desaparecido",
    );
  });

  test(`${rel}: se compara en centimos enteros`, () => {
    assert.match(src, /const aCentimos = \(n\) => Math\.round\(Number\(n\) \* 100\);/);
    assert.match(src, /aCentimos\(recibido\) - cambioCentimos !== aCentimos\(importe\)/);
  });

  test(`${rel}: se envian los importes ya redondeados`, () => {
    assert.match(src, /pendiente\.importeRecibido = aCentimos\(recibido\) \/ 100;/);
    assert.match(src, /pendiente\.cambioEntregado = cambioRedondeado;/);
  });
}

// Replica exacta de la logica que quedo en el cliente.
const aCentimos = (n) => Math.round(Number(n) * 100);

function prepararCobroEfectivo(recibido, importe) {
  const cambio = Math.max(0, recibido - importe); // como lo calcula el TPV
  const cambioCentimos = aCentimos(cambio);
  const cambioRedondeado = cambioCentimos / 100;
  if (!Number.isFinite(recibido) || !Number.isFinite(cambioRedondeado) || recibido < importe || cambioRedondeado < 0
      || aCentimos(recibido) - cambioCentimos !== aCentimos(importe)) {
    throw new Error("efectivo_recibido_cambio_inconsistente");
  }
  return { importeRecibido: aCentimos(recibido) / 100, cambioEntregado: cambioRedondeado };
}

// Los siete casos probados contra la propia base de produccion durante la
// auditoria. Seis eran rechazados por la restriccion CHECK antes del arreglo.
const CASOS = [
  { recibido: 2, importe: 1.1 },
  { recibido: 5, importe: 4.3 },
  { recibido: 10, importe: 9.7 },
  { recibido: 20, importe: 19.9 },
  { recibido: 3, importe: 2.7 },
  { recibido: 100, importe: 99.1 },
  { recibido: 50, importe: 0.3 },
  { recibido: 1.1, importe: 1.1 }, // importe exacto, sin cambio
  { recibido: 0.05, importe: 0.01 }, // centimos sueltos
];

for (const { recibido, importe } of CASOS) {
  test(`cobro de ${importe} EUR pagando con ${recibido} EUR`, () => {
    const enviado = prepararCobroEfectivo(recibido, importe);

    // Lo que comprobara el servidor: recibido - cambio = objetivo, exacto.
    assert.equal(
      aCentimos(enviado.importeRecibido) - aCentimos(enviado.cambioEntregado),
      aCentimos(importe),
      "recibido menos cambio debe cuadrar al centimo con el importe",
    );

    // Y los valores enviados no deben arrastrar decimales por debajo del centimo.
    for (const [campo, valor] of Object.entries(enviado)) {
      assert.equal(valor, Math.round(valor * 100) / 100, `${campo} debe estar redondeado a centimos`);
      assert.ok(Number.isFinite(valor), `${campo} debe ser finito`);
    }

    assert.ok(enviado.cambioEntregado >= 0, "el cambio no puede ser negativo");
    assert.ok(enviado.importeRecibido >= importe - 1e-9, "lo recibido no puede ser menor que el importe");
  });
}

test("se sigue rechazando un cambio que de verdad no cuadra", () => {
  assert.throws(
    () => {
      const recibido = 2, importe = 1.1, cambio = 0.5; // cambio incorrecto a proposito
      const cambioCentimos = aCentimos(cambio);
      if (aCentimos(recibido) - cambioCentimos !== aCentimos(importe)) {
        throw new Error("efectivo_recibido_cambio_inconsistente");
      }
    },
    /efectivo_recibido_cambio_inconsistente/,
    "un descuadre real debe seguir bloqueando el cobro",
  );
});

test("se sigue rechazando pagar menos que el importe", () => {
  assert.throws(
    () => prepararCobroEfectivo(1, 1.1),
    /efectivo_recibido_cambio_inconsistente/,
  );
});
