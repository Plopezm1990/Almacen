"""PM26 P03a — Detector experimental del límite del cuerpo de aplicación.

Este módulo NO sustituye a recuperar_candidato.py (condición 6 de P03a:
no se sobrescribe todavía). Es una herramienta experimental, aislada, para
validar un ancla nueva antes de integrarla en ningún pipeline permanente.

Contexto (evidencia real, ver P03A_DETECCION_LIMITE.md para el detalle):
el marcador histórico "// fuente.jsx" que recuperar_candidato.py usaba
para localizar el cuerpo de aplicación desapareció del bundle en el
commit 767a2c3 ("consolidación acumulada hasta PM14", 2026-09-08) y no ha
vuelto a aparecer desde entonces. En su lugar, todo bundle posterior a
PM14 contiene el comentario "// fuente-recuperado.js" DOS veces: una
aparición espuria (dentro del bloque de imports elevados por esbuild,
seguida de código vendorizado ajeno) y una aparición real (seguida
exactamente de las dos líneas de bootstrap que source-recovery genera:
la reasignación de import_react4 y de import_client2). Solo la aparición
seguida de AMBAS líneas de bootstrap, en ese orden exacto, es el límite
real -- por eso el detector exige la firma compuesta de tres líneas, no
el comentario suelto.
"""

from __future__ import annotations
import re
from dataclasses import dataclass, field


class ErrorDeteccionLimite(Exception):
    """Cualquier fallo del detector es explícito -- nunca elige en silencio."""


ANCLA_COMENTARIO = "// fuente-recuperado.js"
ANCLA_BOOTSTRAP_1 = re.compile(r"^var import_react4 = Object\.assign\(\{ default: \w+\.default \}, \w+\);$")
ANCLA_BOOTSTRAP_2 = re.compile(r"^var import_client2 = \{ createRoot: import_client\.createRoot \};$")

# Anclas de negocio obligatorias, en el orden en que deben aparecer DESPUÉS
# del límite. Lista mínima para esta validación experimental (P03a); P03b
# deberá ampliarla con más funcionalidad de PM15-PM25 antes de integrar
# nada en el pipeline permanente.
ANCLAS_OBLIGATORIAS_CUERPO = [
    "function GestionAlmacen(",
    "function crearLogicaCaja(",
    "function ErroresSistema(",
]


@dataclass
class ResultadoDeteccion:
    linea_limite: int  # índice 0-based de la línea del comentario ancla
    anclas_encontradas: dict = field(default_factory=dict)  # nombre -> línea


def _candidatos_firma_compuesta(lineas: list[str]) -> list[int]:
    """Devuelve los índices de línea donde aparece la firma compuesta
    completa (comentario + las dos líneas de bootstrap inmediatamente
    después, en ese orden). No decide todavía si hay 0, 1 o varias."""
    candidatos = []
    for i, linea in enumerate(lineas):
        if linea.strip() != ANCLA_COMENTARIO:
            continue
        if i + 2 >= len(lineas):
            continue
        if ANCLA_BOOTSTRAP_1.match(lineas[i + 1].strip()) and ANCLA_BOOTSTRAP_2.match(lineas[i + 2].strip()):
            candidatos.append(i)
    return candidatos


def detectar_limite(texto: str) -> ResultadoDeteccion:
    """Localiza el límite del cuerpo de aplicación. Lanza
    ErrorDeteccionLimite ante cualquier ambigüedad -- nunca adivina."""
    lineas = texto.split("\n")

    candidatos = _candidatos_firma_compuesta(lineas)
    if len(candidatos) == 0:
        raise ErrorDeteccionLimite(
            "cero coincidencias de la firma compuesta (comentario + bootstrap x2)"
        )
    if len(candidatos) > 1:
        raise ErrorDeteccionLimite(
            f"{len(candidatos)} coincidencias de la firma compuesta en las líneas "
            f"{[c + 1 for c in candidatos]} -- ambiguo, no se elige ninguna"
        )
    limite = candidatos[0]

    anclas_encontradas: dict[str, int] = {}
    ultima_posicion = limite
    for nombre in ANCLAS_OBLIGATORIAS_CUERPO:
        posicion = None
        for j in range(limite, len(lineas)):
            if nombre in lineas[j]:
                posicion = j
                break
        if posicion is None:
            raise ErrorDeteccionLimite(
                f"ancla obligatoria ausente después del límite (línea {limite + 1}): {nombre!r}"
            )
        if posicion < ultima_posicion:
            raise ErrorDeteccionLimite(
                f"ancla fuera de orden: {nombre!r} en línea {posicion + 1} "
                f"antes que la ancla previa en línea {ultima_posicion + 1}"
            )
        anclas_encontradas[nombre] = posicion
        ultima_posicion = posicion

    return ResultadoDeteccion(linea_limite=limite, anclas_encontradas=anclas_encontradas)


if __name__ == "__main__":
    import sys
    from pathlib import Path

    ruta = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parent.parent / "fuente.js"
    texto = ruta.read_text(encoding="utf-8")
    try:
        resultado = detectar_limite(texto)
    except ErrorDeteccionLimite as e:
        print(f"DETECCION_LIMITE=FALLO: {e}", file=sys.stderr)
        sys.exit(1)
    print(f"DETECCION_LIMITE=OK archivo={ruta} linea_limite={resultado.linea_limite + 1}")
    for nombre, linea in resultado.anclas_encontradas.items():
        print(f"  ancla {nombre!r} -> línea {linea + 1}")
