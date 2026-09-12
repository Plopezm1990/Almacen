"""PM26 P03a — arnés de pruebas del detector experimental.

Positivo: el fuente.js real actual, y el fixture de control sintético,
deben detectar el límite correctamente. Negativo: cada fixture sintético
debe fallar EXACTAMENTE por el motivo que representa (cero coincidencias,
varias coincidencias, ancla ausente/desplazada, orden alterado) -- nunca
por otro motivo ni en silencio.
"""

from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
from p03a_deteccion_limite import detectar_limite, ErrorDeteccionLimite  # noqa: E402

RAIZ = Path(__file__).resolve().parent
FIXTURES = RAIZ / "p03a_fixtures"

fallos = []


def positivo(nombre, texto):
    try:
        r = detectar_limite(texto)
        print(f"POSITIVO {nombre}=PASS (línea límite {r.linea_limite + 1}, "
              f"{len(r.anclas_encontradas)} anclas encontradas)")
    except ErrorDeteccionLimite as e:
        fallos.append(nombre)
        print(f"POSITIVO {nombre}=FALLO (inesperado): {e}")


def negativo(nombre, texto, motivo_esperado_substr):
    try:
        detectar_limite(texto)
        fallos.append(nombre)
        print(f"NEGATIVO {nombre}=FALLO (el detector NO falló y debía hacerlo)")
    except ErrorDeteccionLimite as e:
        if motivo_esperado_substr in str(e):
            print(f"NEGATIVO {nombre}=PASS (falló como se esperaba: {e})")
        else:
            fallos.append(nombre)
            print(f"NEGATIVO {nombre}=FALLO (falló, pero por motivo distinto al esperado): {e}")


# --- Positivas ---
positivo("fuente_js_real", (RAIZ.parent / "fuente.js").read_text(encoding="utf-8"))
positivo("fixture_control", (FIXTURES / "positivo_control.js").read_text(encoding="utf-8"))

# --- Negativas: cada una debe fallar exactamente por su motivo ---
negativo(
    "ancla_ausente",
    (FIXTURES / "negativo_ancla_ausente.js").read_text(encoding="utf-8"),
    "cero coincidencias",
)
negativo(
    "ancla_duplicada",
    (FIXTURES / "negativo_ancla_duplicada.js").read_text(encoding="utf-8"),
    "coincidencias de la firma compuesta",
)
negativo(
    "ancla_desplazada",
    (FIXTURES / "negativo_ancla_desplazada.js").read_text(encoding="utf-8"),
    "ancla obligatoria ausente",
)
negativo(
    "orden_alterado",
    (FIXTURES / "negativo_orden_alterado.js").read_text(encoding="utf-8"),
    "ancla fuera de orden",
)

print()
if fallos:
    print(f"P03A_PRUEBAS=FALLO ({len(fallos)} casos: {', '.join(fallos)})")
    sys.exit(1)
print("P03A_PRUEBAS=PASS (2 positivas + 4 negativas, cada una por el motivo exacto esperado)")
