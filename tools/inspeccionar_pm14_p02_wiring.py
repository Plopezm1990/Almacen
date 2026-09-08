from pathlib import Path

s = Path('fuente.js').read_text(encoding='utf-8')

PATRONES = [
    ('const [encargos', 5000),
    ('setEncargos] =', 5000),
    ('crearLogicaEncargos({ encargos', 5000),
    ('function Encargos({', 30000),
    ('sincronizarCajaPm08({', 5000),
]

for patron, radio in PATRONES:
    pos = s.find(patron)
    print(f'PM14_P02_WIRING_{patron}={pos}')
    if pos >= 0:
        ini = max(0, pos - 1200)
        fin = min(len(s), pos + radio)
        print(f'===== BEGIN {patron} =====')
        print(s[ini:fin])
        print(f'===== END {patron} =====')
