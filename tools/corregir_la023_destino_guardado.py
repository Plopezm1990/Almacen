from pathlib import Path

RUTA = Path("fuente.js")

OLD = r'''"Todo lo que capturas en este programa ya se guarda autom\xE1ticamente en tu cuenta, no solo en este tel\xE9fono \u2014 si abres esta misma conversaci\xF3n desde otro dispositivo, ver\xE1s la misma informaci\xF3n. Aqu\xED adem\xE1s puedes crear copias de seguridad puntuales, para poder volver atr\xE1s si algo se borra o se modifica por error."'''

NEW = r'''(typeof window !== "undefined" && window.__nubeActiva === true ? "La nube est\xE1 activa para esta sesi\xF3n. Los cambios se intentan sincronizar con tu cuenta y, si alguna escritura no se confirma, el programa mostrar\xE1 el error. Las copias de este historial son puntos de restauraci\xF3n adicionales." : "Est\xE1s trabajando solo en este equipo, sin sincronizaci\xF3n. Los cambios y las copias del historial se guardan en este dispositivo. Si quieres una copia fuera del programa, usa la copia port\xE1til y gu\xE1rdala t\xFA mismo en un lugar seguro.")'''

texto = RUTA.read_text(encoding="utf-8")
conteo = texto.count(OLD)
if conteo != 1:
    raise SystemExit(f"LA-023: se esperaba exactamente 1 texto antiguo y hay {conteo}")

texto = texto.replace(OLD, NEW)
RUTA.write_text(texto, encoding="utf-8")

if OLD in texto:
    raise SystemExit("LA-023: el texto antiguo sigue presente")
if "Est\\xE1s trabajando solo en este equipo, sin sincronizaci\\xF3n" not in texto:
    raise SystemExit("LA-023: falta el texto de modo local")
if "Los cambios se intentan sincronizar con tu cuenta" not in texto:
    raise SystemExit("LA-023: falta el texto de modo nube")

print("LA023_TEXTO_ANTIGUO_ELIMINADO=1")
print("LA023_TEXTO_LOCAL_HONESTO=1")
print("LA023_TEXTO_NUBE_NO_PROMETE_CONFIRMACION=1")
