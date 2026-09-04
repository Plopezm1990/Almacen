from pathlib import Path
import hashlib
import json
import subprocess

ROOT = Path(__file__).resolve().parent.parent
BUNDLE = ROOT / "fuente.js"
OUT = ROOT / "source-recovery" / "fuente-recuperado.js"
EVIDENCIA = ROOT / "source-recovery" / "PM01_EVIDENCIA.json"

lines = BUNDLE.read_text(encoding="utf-8").splitlines()
marcas = [i for i, line in enumerate(lines) if line.strip() == "// fuente.jsx"]
if len(marcas) != 1:
    raise SystemExit(f"Se esperaba una sola marca // fuente.jsx y hay {len(marcas)}")
marca = marcas[0]
app = lines[marca:]

esperado_react = "var import_react4 = __toESM(require_react());"
esperado_dom = "var import_client = __toESM(require_client());"
if len(app) < 4 or app[1].strip() != esperado_react:
    raise SystemExit("Bootstrap React inesperado en el bundle candidato")
if app[2].strip() != esperado_dom:
    raise SystemExit("Bootstrap ReactDOM inesperado en el bundle candidato")

iconos = """ArrowLeftRight Bell Boxes Calculator CalendarClock CalendarDays CalendarRange Camera ChartColumn ChartLine ChevronRight CircleArrowDown CircleArrowUp CircleCheck ClipboardList Clock Cog Coins Download Droplet Ellipsis Eye EyeOff Factory FileText Files LoaderCircle LogIn LogOut Mail MessageCircle Minus Package Pencil Phone Plus Receipt RotateCcwClock ScanBarcode Search ShieldCheck ShoppingBag ShoppingCart Stethoscope Tags Trash2 TrendingUp TriangleAlert Truck Upload UserRound Users Wallet X""".split()

cabecera = [
    "// FUENTE RECUPERADO DESDE EL BUNDLE CANDIDATO DE L&A SUITE.",
    "// No es el JSX original: es la sección de aplicación conservada por esbuild,",
    "// con JSX ya transformado a React.createElement y dependencias restauradas.",
    'import React, * as ReactNS from "react";',
    'import { createRoot } from "react-dom/client";',
    'import { createClient } from "@supabase/supabase-js";',
    'import { jsPDF as E } from "jspdf";',
    'import autoTable from "jspdf-autotable";',
    'import * as XLSX from "xlsx";',
    'import { ' + ", ".join(iconos) + ', Map as Map2 } from "lucide-react";',
    'const import_react4 = Object.assign({ default: React }, ReactNS);',
    'const import_client = { createRoot };',
    'const utils = XLSX.utils;',
    'const writeFileSync = XLSX.writeFile || XLSX.writeFileSync;',
]

cuerpo = app[3:]
texto_cuerpo = "\n".join(cuerpo) + "\n"
texto_recuperado = "\n".join(cabecera + cuerpo) + "\n"
OUT.write_text(texto_recuperado, encoding="utf-8")

# Paridad exacta del cuerpo de aplicación: la única sustitución es el bootstrap
# de dependencias del bundle por imports normales y explícitos.
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
    "pm": "PM-01",
    "commit_rama_validada": commit,
    "bundle": "fuente.js",
    "bundle_bytes": BUNDLE.stat().st_size,
    "marca_fuente_linea": marca + 1,
    "lineas_cuerpo_aplicacion": len(cuerpo),
    "bytes_cuerpo_aplicacion": len(texto_cuerpo.encode("utf-8")),
    "sha256_cuerpo_bundle": sha_cuerpo,
    "sha256_cuerpo_recuperado": sha_recuperado,
    "paridad_cuerpo_exacta": True,
    "fuente_recuperada_bytes": OUT.stat().st_size,
    "nota": "Se sustituyen únicamente los dos bootstrap de React/ReactDOM por imports normales; la lógica de aplicación se conserva byte a byte por líneas UTF-8 normalizadas con LF."
}
EVIDENCIA.write_text(json.dumps(info, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

print(f"MARCA_ORIGEN={marca + 1}")
print(f"LINEAS_CUERPO={len(cuerpo)}")
print(f"BYTES_CUERPO={info['bytes_cuerpo_aplicacion']}")
print(f"SHA256_CUERPO={sha_cuerpo}")
print(f"FUENTE_RECUPERADA_BYTES={OUT.stat().st_size}")
print("PARIDAD_CUERPO_EXACTA=1")
