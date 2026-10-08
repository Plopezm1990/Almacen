// SIMULADOR DE LA FUNCIÓN DE IA «importar-albaran» — SOLO PARA EL PROYECTO DE QA (qjqorixtkilwsndqayyx).
//
// Qué es: sustituye al «corta-fuegos» actual de QA (que responde 503 «Función de IA neutralizada») por una función que NO llama a ninguna IA,
// no gasta nada y devuelve siempre un albarán de ejemplo, para poder probar en la vista previa el alta automática del proveedor.
// Qué NO hace: no lee la foto (el contenido de la imagen da igual), no usa claves, no toca la base de datos, no guarda nada.
// Dónde NO debe ir nunca: producción (flqercbgpgmmfaakrwkc). Allí está la función real (versión 16, Claude Haiku 4.5).
//
// Cómo se elige el escenario: por el NÚMERO DE FOTOS que se suben en una misma lectura.
//   1 foto  → proveedor «QUESERIA PRUEBA ALB S.L.» con NIF válido        (1.ª vez: nuevo; 2.ª vez: reconocido por NIF)
//   2 fotos → «QUESERIA PRUEBA ALVA S.L.» sin NIF                         (parecido al anterior: pregunta)
//   3 fotos → sin proveedor ni NIF                                        (hay que elegirlo a mano)
//   4 fotos → «DISTRIBUCIONES PRUEBA DOS S.L.» con NIF mal escrito        (nuevo, y avisa de que el NIF no se guardará)
//   5 fotos → «QUESERIA PRUEBA ALB S.L.» con OTRO NIF válido              (mismo nombre, otro NIF: pregunta)
//   6 o más → igual que 1
// Restablecer la neutralización: volver a desplegar el contenido anterior (503) — está en docs/alb-prov/GUIA_PRUEBAS_QA.md §6.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

const LINEAS = [
  { codigo: "QP-001", descripcion: "QUESO CURADO PRUEBA 1KG", cantidad: 3, unidad: "ud", udsPorCaja: null, precioUnitario: 10, descuentoPct: 0, iva: 10, canon: 0, lote: null, caducidadTexto: null, caducidad: null, importeLinea: 30 },
  { codigo: "QP-002", descripcion: "QUESO TIERNO PRUEBA 500G", cantidad: 2, unidad: "ud", udsPorCaja: null, precioUnitario: 5, descuentoPct: 0, iva: 10, canon: 0, lote: null, caducidadTexto: null, caducidad: null, importeLinea: 10 },
];

function albaran(proveedorNombre: string | null, proveedorCif: string | null, numeroAlbaran: string) {
  return {
    proveedorNombre,
    proveedorCif,
    numeroAlbaran,
    numeroFactura: null,
    fecha: new Date().toISOString().slice(0, 10),
    numeroPedido: null,
    lineas: LINEAS,
    cargos: 0,
    cargosConcepto: null,
    sumaImportes: 40,
    ivaTotal: 4,
    totalAlbaran: 44,
    confianza: "alta",
    avisos: [],
    simulado: true,
  };
}

function escenario(fotos: number) {
  switch (fotos) {
    case 2: return albaran("QUESERIA PRUEBA ALVA S.L.", null, "SIM-0002");
    case 3: return albaran(null, null, "SIM-0003");
    case 4: return albaran("DISTRIBUCIONES PRUEBA DOS S.L.", "B12345618", "SIM-0004");
    case 5: return albaran("QUESERIA PRUEBA ALB S.L.", "A58818501", "SIM-0005");
    default: return albaran("QUESERIA PRUEBA ALB S.L.", "B12345617", "SIM-0001");
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json(405, { ok: false, error: "Método no permitido." });
  let fotos = 1;
  try {
    const { imagenes } = await req.json();
    if (!Array.isArray(imagenes) || imagenes.length === 0) return json(400, { ok: false, error: "No se ha recibido ninguna imagen." });
    fotos = imagenes.length;
  } catch {
    return json(400, { ok: false, error: "Petición no válida." });
  }
  return json(200, { ok: true, qa: true, simulated: true, datos: escenario(fotos) });
});
