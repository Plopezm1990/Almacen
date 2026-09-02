from pathlib import Path
p=Path('.github/scripts/aplicar_bloque7b_rrhh.py')
s=p.read_text(encoding='utf-8')
ini=s.index('# Pantallas RRHH locales.')
fin=s.index('# Badges RRHH locales.', ini)
nuevo=r'''# Pantallas RRHH locales, acotadas por pestaña.
# Personal.
ini=s.index('tab === "personal"'); fin=s.index('tab === "fichaje"',ini); b=s[ini:fin]
b=uno(b,'      empleados,\n','      empleados: empleadosDelLocalActivo,\n','Personal empleados')
b=uno(b,'      fichajes,\n','      fichajes: fichajesDelLocalActivo,\n','Personal fichajes')
b=uno(b,'      nominas,\n','      nominas: nominasDelLocalActivo,\n','Personal nominas')
s=s[:ini]+b+s[fin:]

# Registro horario.
ini=s.index('tab === "fichaje"'); fin=s.index('tab === "nominas"',ini); b=s[ini:fin]
b=uno(b,'      empleados,\n','      empleados: empleadosDelLocalActivo,\n','Fichaje empleados')
b=uno(b,'      fichajes,\n','      fichajes: fichajesDelLocalActivo,\n','Fichaje colección')
b=uno(b,'      fichajesAbiertos\n','      fichajesAbiertos: fichajesAbiertosDelLocalActivo\n','Fichaje abiertos')
s=s[:ini]+b+s[fin:]

# Nóminas.
ini=s.index('tab === "nominas"'); fin=s.index('tab === "venta"',ini); b=s[ini:fin]
b=uno(b,'      empleados,\n','      empleados: empleadosDelLocalActivo,\n','Nominas empleados')
b=uno(b,'      nominas,\n','      nominas: nominasDelLocalActivo,\n','Nominas colección')
b=uno(b,'      fichajes,\n','      fichajes: fichajesDelLocalActivo,\n','Nominas fichajes')
b=uno(b,'      movimientos\n','      movimientos: movimientosDelLocalActivo\n','Nominas movimientos')
s=s[:ini]+b+s[fin:]

# Turnos.
ini=s.index('tab === "turnos"'); fin=s.index('tab === "mapa"',ini); b=s[ini:fin]
b=uno(b,'      empleados,\n','      empleados: empleadosDelLocalActivo,\n','Turnos empleados local')
b=uno(b,'      turnos,\n','      turnos: turnosDelLocalActivo,\n','Turnos colección local')
s=s[:ini]+b+s[fin:]

'''
s=s[:ini]+nuevo+s[fin:]
p.write_text(s,encoding='utf-8')
print('CORREGIR_RENDER_7B_OK')