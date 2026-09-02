from pathlib import Path
p=Path('.github/scripts/aplicar_bloque6_multilocal.py')
s=p.read_text(encoding='utf-8')
viejo="b=uno(b,'], [puntosControl, registrosAppcc]);','], [puntosControlDelLocalActivo, registrosAppccDelLocalActivo]);','APPCC dependencias alertas local')"
nuevo="b=uno(b,'}, [puntosControl, registrosAppcc]);','}, [puntosControlDelLocalActivo, registrosAppccDelLocalActivo]);','APPCC dependencias alertas local')"
assert s.count(viejo)==1, f'Ancla temporal APPCC esperada 1, encontrada {s.count(viejo)}'
p.write_text(s.replace(viejo,nuevo,1),encoding='utf-8')
print('CORRECCION_ANCLA_APPCC_BLOQUE6_OK')