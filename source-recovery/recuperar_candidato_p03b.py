"""PM26 P03b — recuperación real de la fuente canónica (PM14-PM25 incluidos).

Usa la firma compuesta validada experimentalmente en P03a
(p03a_deteccion_limite.py) para localizar el límite del cuerpo de
aplicación en el fuente.js ACTUAL -- ya no el marcador histórico
"// fuente.jsx", retirado en la consolidación PM14 -- y una lista de
anclas de negocio AMPLIADA (PM15-PM25, no solo las 3 mínimas de P03a)
para confirmar que el cuerpo recuperado está completo y en el orden
esperado. No modifica p03a_deteccion_limite.py (ya cerrado y gateado):
reutiliza su lógica de detección de la firma compuesta por import.
"""
from __future__ import annotations
import hashlib
import json
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from p03a_deteccion_limite import _candidatos_firma_compuesta, ErrorDeteccionLimite  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
BUNDLE = ROOT / "fuente.js"
OUT = ROOT / "source-recovery" / "fuente-recuperado.js"
EVIDENCIA = ROOT / "source-recovery" / "PM26_P03B_EVIDENCIA.json"

# Anclas de negocio obligatorias AMPLIADAS respecto a P03a (que usaba solo
# 3), cubriendo PM15-PM25 en el orden exacto en que aparecen después del
# límite en el fuente.js actual. Localizadas y verificadas manualmente
# (ver PM26_P03B_CIERRE.md, sección "Anclas ampliadas").
ANCLAS_OBLIGATORIAS_AMPLIADAS = [
    "motivoFalloCargaPM16",
    "function GestionAlmacen(",
    "cambiarTabPM15",
    "__contextoErroresPM20",
    "bloqueadoPorNubeActivaPM25",
    "validarRegistroAppccPM19",
    "function crearLogicaCaja(",
    "activarSuscripcionPushPM17",
    "function ErroresSistema(",
    "estadoIdentidadFiscalPM18",
    "bloqueadoPorEnvioDuplicadoPM24",
]

ESPERADO_BOOTSTRAP_1 = "var import_react4 = Object.assign({ default: ReactNS.default }, ReactNS);"
ESPERADO_BOOTSTRAP_2 = "var import_client2 = { createRoot: import_client.createRoot };"


def detectar_limite_ampliado(texto: str):
    lineas = texto.split("\n")
    candidatos = _candidatos_firma_compuesta(lineas)
    if len(candidatos) == 0:
        raise ErrorDeteccionLimite("cero coincidencias de la firma compuesta (comentario + bootstrap x2)")
    if len(candidatos) > 1:
        raise ErrorDeteccionLimite(f"{len(candidatos)} coincidencias de la firma compuesta -- ambiguo, no se elige ninguna")
    limite = candidatos[0]

    anclas_encontradas: dict[str, int] = {}
    ultima_posicion = limite
    for nombre in ANCLAS_OBLIGATORIAS_AMPLIADAS:
        posicion = None
        for j in range(limite, len(lineas)):
            if nombre in lineas[j]:
                posicion = j
                break
        if posicion is None:
            raise ErrorDeteccionLimite(f"ancla obligatoria ausente después del límite (línea {limite + 1}): {nombre!r}")
        if posicion < ultima_posicion:
            raise ErrorDeteccionLimite(f"ancla fuera de orden: {nombre!r} en línea {posicion + 1}")
        anclas_encontradas[nombre] = posicion
        ultima_posicion = posicion
    return limite, anclas_encontradas


texto_bundle = BUNDLE.read_text(encoding="utf-8")
lineas = texto_bundle.split("\n")
limite, anclas = detectar_limite_ampliado(texto_bundle)

app = lineas[limite:]
if app[1].strip() != ESPERADO_BOOTSTRAP_1:
    raise SystemExit("Bootstrap 1 inesperado en el bundle actual")
if app[2].strip() != ESPERADO_BOOTSTRAP_2:
    raise SystemExit("Bootstrap 2 inesperado en el bundle actual")

# A diferencia de PM01 (recuperar_candidato.py), aquí las DOS líneas de
# bootstrap SÍ se conservan como parte del cuerpo: ya no son shims
# internos de esbuild (__toESM/require_react) sino asignaciones locales
# que solo dependen de nombres que la cabecera ya provee (ReactNS,
# import_client). Ver PM26_P03B_CIERRE.md.
cuerpo = app[1:]
texto_cuerpo = "\n".join(cuerpo) + "\n"

iconos = (
    "ArrowLeftRight Bell Boxes Calculator CalendarClock CalendarDays CalendarRange "
    "Camera ChartColumn ChartLine ChevronRight CircleArrowDown CircleArrowUp "
    "CircleCheck ClipboardList Clock Cog Coins Download Droplet Ellipsis Eye EyeOff "
    "Factory FileText Files LoaderCircle LogIn LogOut Mail MessageCircle Minus "
    "Package Pencil Phone Plus Receipt RotateCcwClock ScanBarcode Search ShieldCheck "
    "ShoppingBag ShoppingCart Stethoscope Tags Trash2 TrendingUp TriangleAlert Truck "
    "Upload UserRound Users Wallet"
).split()
# "X" se importa como "X2" -- igual que "Map" ya se importaba como "Map2"
# en la cabecera original de PM01 -- porque el bundle actual usa el
# nombre desambiguado "X2" para el icono X en todo el cuerpo recuperado
# (comprobado: "X2" no tiene declaración local en el cuerpo, a diferencia
# de otros nombres con sufijo "2" como Icon2/Pill2/Bloque2, que sí la
# tienen).

cabecera = [
    "// FUENTE RECUPERADO DESDE EL BUNDLE ACTUAL DE L&A SUITE (PM26 P03b).",
    "// No es el JSX original: es la sección de aplicación conservada por esbuild,",
    "// con JSX ya transformado a React.createElement y dependencias restauradas.",
    "// Incluye PM14-PM25 (recuperado con la firma compuesta validada en PM26 P03a,",
    "// no con el marcador histórico // fuente.jsx, retirado en la consolidación PM14).",
    'import React, * as ReactNS from "react";',
    'import { createRoot } from "react-dom/client";',
    'import { createClient } from "@supabase/supabase-js";',
    'import { jsPDF as E } from "jspdf";',
    'import autoTable from "jspdf-autotable";',
    'import * as XLSX from "xlsx";',
    'import { ' + ", ".join(iconos) + ', X as X2, Map as Map2 } from "lucide-react";',
    "const import_client = { createRoot };",
    "const utils = XLSX.utils;",
    "const writeFileSync = XLSX.writeFile || XLSX.writeFileSync;",
]

texto_recuperado = "\n".join(cabecera + cuerpo) + "\n"
OUT.write_text(texto_recuperado, encoding="utf-8")

# Paridad exacta del cuerpo de aplicación: la única sustitución respecto
# al bundle es el bootstrap de dependencias externas (imports normales en
# vez del bootstrap interno de esbuild para React/ReactDOM/iconos/etc.);
# el cuerpo de aplicación en sí (a partir del primer bootstrap local) se
# conserva byte a byte.
recuperado = OUT.read_text(encoding="utf-8").splitlines()
cuerpo_recuperado = "\n".join(recuperado[len(cabecera):]) + "\n"
if cuerpo_recuperado != texto_cuerpo:
    raise SystemExit("La fuente recuperada no conserva exactamente el cuerpo candidato")

sha_cuerpo = hashlib.sha256(texto_cuerpo.encode("utf-8")).hexdigest()
sha_recuperado = hashlib.sha256(cuerpo_recuperado.encode("utf-8")).hexdigest()
if sha_cuerpo != sha_recuperado:
    raise SystemExit("SHA de cuerpo candidato y recuperado no coincide")

commit = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip()
info = {
    "pm": "PM26-P03b",
    "commit_rama_validada": commit,
    "bundle": "fuente.js",
    "bundle_bytes": BUNDLE.stat().st_size,
    "metodo_deteccion_limite": "firma_compuesta_p03a (comentario // fuente-recuperado.js + 2 bootstrap locales)",
    "limite_linea": limite + 1,
    "anclas_obligatorias_verificadas": {k: v + 1 for k, v in anclas.items()},
    "lineas_cuerpo_aplicacion": len(cuerpo),
    "bytes_cuerpo_aplicacion": len(texto_cuerpo.encode("utf-8")),
    "sha256_cuerpo_bundle": sha_cuerpo,
    "sha256_cuerpo_recuperado": sha_recuperado,
    "paridad_cuerpo_exacta": True,
    "fuente_recuperada_bytes": OUT.stat().st_size,
    "nota": (
        "Recuperación PM26 P03b: sustituye el bootstrap de dependencias externas "
        "(React/ReactDOM/iconos lucide-react/jsPDF/XLSX/Supabase) por imports "
        "normales; conserva byte a byte, a partir del primer bootstrap LOCAL "
        "(import_react4/import_client2, que sí forman parte del cuerpo en el "
        "formato post-PM14), toda la lógica de aplicación incluyendo PM14-PM25."
    ),
}
EVIDENCIA.write_text(json.dumps(info, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

print(f"LIMITE_LINEA={limite + 1}")
print(f"ANCLAS_VERIFICADAS={len(anclas)}")
print(f"LINEAS_CUERPO={len(cuerpo)}")
print(f"BYTES_CUERPO={info['bytes_cuerpo_aplicacion']}")
print(f"SHA256_CUERPO={sha_cuerpo}")
print(f"FUENTE_RECUPERADA_BYTES={OUT.stat().st_size}")
print("PARIDAD_CUERPO_EXACTA=1")
