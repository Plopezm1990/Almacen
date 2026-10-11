from pathlib import Path
import argparse
import hashlib
import json
import re
import subprocess

ROOT = Path(__file__).resolve().parent.parent
BUNDLE = ROOT / "fuente.js"
OUT = ROOT / "source-recovery" / "fuente-recuperado.js"
EVIDENCIA = ROOT / "source-recovery" / "PM01_EVIDENCIA.json"
CURRENT_SYNC_BASELINE = "bd0dc4a85609e2b9581713cd3dc6973ffd57e893"

parser = argparse.ArgumentParser(description="Recupera, sincroniza o verifica el cuerpo de aplicación de fuente.js")
group = parser.add_mutually_exclusive_group()
group.add_argument(
    "--check",
    action="store_true",
    help="No escribe archivos: exige que fuente-recuperado.js ya coincida exactamente con el cuerpo de aplicación del bundle actual.",
)
group.add_argument(
    "--sync-current",
    action="store_true",
    help="Regenera fuente-recuperado.js desde el runtime actual usando como ancla un baseline histórico con paridad exacta demostrada.",
)
args = parser.parse_args()

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


def git_text(*args):
    return subprocess.check_output(["git", *args], cwd=ROOT).decode("utf-8")


def recovered_body(text):
    lines = text.splitlines()
    if lines[:len(cabecera)] != cabecera:
        raise SystemExit("SOURCE_RECOVERY_BASELINE_INVALID: cabecera recuperada inesperada")
    body = "\n".join(lines[len(cabecera):]) + "\n"
    if not body.strip():
        raise SystemExit("SOURCE_RECOVERY_BASELINE_INVALID: cuerpo recuperado vacío")
    return body


def require_markers(body):
    markers = [
        "function GestionAlmacen",
        "function crearLogicaCaja",
        "SelectorLocalInformes",
        "ErroresSistema",
    ]
    missing = [marker for marker in markers if marker not in body]
    if missing:
        raise SystemExit("SOURCE_RECOVERY_INVALID: faltan marcadores esenciales: " + ", ".join(missing))


bundle_text = BUNDLE.read_text(encoding="utf-8")

if args.sync_current:
    # Baseline elegido porque contiene evidencia histórica de paridad exacta
    # entre fuente-recuperado.js y el cuerpo de fuente.js.
    baseline_bundle = git_text("show", f"{CURRENT_SYNC_BASELINE}:fuente.js")
    baseline_recovered = git_text("show", f"{CURRENT_SYNC_BASELINE}:source-recovery/fuente-recuperado.js")
    baseline_evidence = json.loads(
        git_text("show", f"{CURRENT_SYNC_BASELINE}:source-recovery/PM01_EVIDENCIA.json")
    )

    if baseline_evidence.get("paridad_cuerpo_exacta") is not True:
        raise SystemExit("SOURCE_RECOVERY_BASELINE_INVALID: la evidencia histórica no certifica paridad exacta")

    baseline_body = recovered_body(baseline_recovered)
    if not baseline_bundle.endswith(baseline_body):
        raise SystemExit("SOURCE_RECOVERY_BASELINE_INVALID: el baseline ya no reproduce su cuerpo recuperado")

    baseline_body_sha = hashlib.sha256(baseline_body.encode("utf-8")).hexdigest()
    if baseline_evidence.get("sha256_cuerpo_bundle") != baseline_body_sha:
        raise SystemExit("SOURCE_RECOVERY_BASELINE_INVALID: SHA del cuerpo del bundle no coincide con la evidencia")
    if baseline_evidence.get("sha256_cuerpo_recuperado") != baseline_body_sha:
        raise SystemExit("SOURCE_RECOVERY_BASELINE_INVALID: SHA del cuerpo recuperado no coincide con la evidencia")
    if int(baseline_evidence.get("bundle_bytes", -1)) != len(baseline_bundle.encode("utf-8")):
        raise SystemExit("SOURCE_RECOVERY_BASELINE_INVALID: tamaño del bundle histórico no coincide con la evidencia")
    if int(baseline_evidence.get("fuente_recuperada_bytes", -1)) != len(baseline_recovered.encode("utf-8")):
        raise SystemExit("SOURCE_RECOVERY_BASELINE_INVALID: tamaño de la fuente recuperada histórica no coincide con la evidencia")
    if int(baseline_evidence.get("bytes_cuerpo_aplicacion", -1)) != len(baseline_body.encode("utf-8")):
        raise SystemExit("SOURCE_RECOVERY_BASELINE_INVALID: tamaño del cuerpo histórico no coincide con la evidencia")

    marker_line = int(baseline_evidence["marca_fuente_linea"])
    # En el recuperador histórico: app[0] era // fuente.jsx, app[1]/app[2]
    # eran bootstrap React/ReactDOM y cuerpo=app[3:]. Por tanto, el cuerpo
    # certificado comienza tres líneas después de la marca.
    baseline_body_start = marker_line + 3
    baseline_lines = baseline_bundle.splitlines()
    baseline_body_by_line = "\n".join(baseline_lines[baseline_body_start - 1:]) + "\n"
    if baseline_body_by_line != baseline_body:
        raise SystemExit("SOURCE_RECOVERY_BASELINE_INVALID: la línea de inicio histórica no coincide con el cuerpo certificado")

    target_fuente_commit = git_text("log", "-1", "--format=%H", "--", "fuente.js").strip()
    target_bundle = git_text("show", f"{target_fuente_commit}:fuente.js")
    if target_bundle != bundle_text:
        raise SystemExit("SOURCE_RECOVERY_TARGET_INVALID: HEAD contiene un fuente.js distinto del último commit que lo modificó")

    diff = git_text(
        "diff",
        "--unified=0",
        CURRENT_SYNC_BASELINE,
        target_fuente_commit,
        "--",
        "fuente.js",
    )

    shift = 0
    hunk_re = re.compile(r"^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@", re.MULTILINE)
    hunks = list(hunk_re.finditer(diff))
    if not hunks:
        raise SystemExit("SOURCE_RECOVERY_SYNC_INVALID: no hay hunks entre baseline y target")

    for match in hunks:
        old_start = int(match.group(1))
        old_count = int(match.group(2) or "1")
        new_count = int(match.group(4) or "1")

        if old_count == 0:
            # Una inserción con old_start=N ocurre después de la línea N.
            if old_start < baseline_body_start:
                shift += new_count
            continue

        old_end_exclusive = old_start + old_count
        if old_end_exclusive <= baseline_body_start:
            shift += new_count - old_count
            continue

        if old_start < baseline_body_start < old_end_exclusive:
            raise SystemExit(
                "SOURCE_RECOVERY_BOUNDARY_AMBIGUOUS: un hunk cruza la frontera histórica del cuerpo "
                f"(old={old_start},{old_count}; body_start={baseline_body_start})"
            )

        # Si el hunk empieza exactamente en body_start o después, ya pertenece
        # al cuerpo de aplicación y no desplaza su frontera lógica.

    current_body_start = baseline_body_start + shift
    current_lines = bundle_text.splitlines()
    if current_body_start < 1 or current_body_start > len(current_lines):
        raise SystemExit(
            f"SOURCE_RECOVERY_SYNC_INVALID: frontera mapeada fuera de rango ({current_body_start}/{len(current_lines)})"
        )

    current_body = "\n".join(current_lines[current_body_start - 1:]) + "\n"
    require_markers(current_body)

    recovered_text = "\n".join(cabecera) + "\n" + current_body
    OUT.write_text(recovered_text, encoding="utf-8")

    # Comprobación inmediata: el cuerpo recién escrito debe ser exactamente el
    # sufijo del bundle actual y conservar el mismo SHA.
    written_body = recovered_body(OUT.read_text(encoding="utf-8"))
    if written_body != current_body or not bundle_text.endswith(written_body):
        raise SystemExit("SOURCE_RECOVERY_SYNC_INVALID: la fuente sincronizada no conserva paridad exacta")

    sha_body = hashlib.sha256(written_body.encode("utf-8")).hexdigest()
    print(f"SOURCE_RECOVERY_SYNC_BASELINE={CURRENT_SYNC_BASELINE}")
    print(f"SOURCE_RECOVERY_BASE_EVIDENCE_COMMIT={baseline_evidence.get('commit_rama_validada')}")
    print(f"SOURCE_RECOVERY_TARGET_FUENTE_COMMIT={target_fuente_commit}")
    print(f"SOURCE_RECOVERY_BASE_BODY_START_LINE={baseline_body_start}")
    print(f"SOURCE_RECOVERY_CURRENT_BODY_START_LINE={current_body_start}")
    print(f"SOURCE_RECOVERY_BODY_LINE_SHIFT={shift}")
    print(f"LINEAS_CUERPO={len(current_lines) - current_body_start + 1}")
    print(f"BYTES_CUERPO={len(written_body.encode('utf-8'))}")
    print(f"SHA256_CUERPO={sha_body}")
    print("PARIDAD_CUERPO_EXACTA=1")
    print("SOURCE_RECOVERY_SYNC_CURRENT=PASS")
    raise SystemExit(0)

# El bundle actual ya no conserva necesariamente el comentario histórico
# "// fuente.jsx". En modo check no dependemos de metadatos del compilador:
# la fuente recuperada contiene una cabecera explícita de imports seguida por
# el cuerpo de aplicación, y ese cuerpo debe ser exactamente el sufijo del
# bundle servido. Esto detecta drift sin aceptar aproximaciones.
if args.check:
    if not OUT.exists():
        raise SystemExit("Falta source-recovery/fuente-recuperado.js")

    actual = OUT.read_text(encoding="utf-8")
    cuerpo_recuperado = recovered_body(actual)
    if not bundle_text.endswith(cuerpo_recuperado):
        raise SystemExit("SOURCE_RECOVERY_DRIFT: el cuerpo recuperado no coincide exactamente con el sufijo de fuente.js")

    require_markers(cuerpo_recuperado)
    sha_recuperado = hashlib.sha256(cuerpo_recuperado.encode("utf-8")).hexdigest()
    offset = len(bundle_text.encode("utf-8")) - len(cuerpo_recuperado.encode("utf-8"))

    print(f"ORIGEN_SUFFIX_OFFSET_BYTES={offset}")
    print(f"LINEAS_CUERPO={len(cuerpo_recuperado.splitlines())}")
    print(f"BYTES_CUERPO={len(cuerpo_recuperado.encode('utf-8'))}")
    print(f"SHA256_CUERPO={sha_recuperado}")
    print("PARIDAD_CUERPO_EXACTA=1")
    print("SOURCE_RECOVERY_CHECK=PASS")
    raise SystemExit(0)

# Modo histórico de escritura: solo se usa cuando se recupera explícitamente
# un candidato que todavía conserva la marca de esbuild esperada.
lines = bundle_text.splitlines()
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

cuerpo = app[3:]
texto_cuerpo = "\n".join(cuerpo) + "\n"
texto_recuperado = "\n".join(cabecera + cuerpo) + "\n"
OUT.write_text(texto_recuperado, encoding="utf-8")

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
