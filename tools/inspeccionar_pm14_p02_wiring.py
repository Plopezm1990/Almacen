from pathlib import Path

s = Path('fuente.js').read_text(encoding='utf-8')

PATRONES = [
    'useStoredState("encargos"',
    "useStoredState('encargos'",
    'crearLogicaEncargos({ encargos',
    'function Encargos({',
    'sincronizarCajaPm08({',
]

for patron in PATRONES:
    pos = s.find(patron)
    print(f'PM14_P02_WIRING_{patron}={pos}')
    if pos >= 0:
        ini = max(0, pos - 900)
        fin = min(len(s), pos + 2600)
        print(f'===== BEGIN {patron} =====')
        print(s[ini:fin])
        print(f'===== END {patron} =====')
