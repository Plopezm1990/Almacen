from pathlib import Path

p = Path("source-recovery/fuente-recuperado.js")
s = p.read_text()

anchor = 'function SelectorLocalInformes({ locales = [], valor = "", onChange }) {'
helper = '''async function sincronizarContextoPm07({ setEmpresas, setLocales, setLocalActivoId, setProductos }) {
  if (typeof window === "undefined" || !window.__nubeActiva || typeof window.getSupabaseClient !== "function") return { ok: false, offline: true };
  const supabase = await window.getSupabaseClient();
  const r = await supabase.from("almacen_kv").select("key,value").in("key", ["empresas", "locales", "localActivoId", "productos"]);
  if (r.error) throw r.error;
  const porClave = new Map((r.data || []).map((fila) => [fila.key, fila.value]));
  const empresasNube = porClave.get("empresas");
  const localesNube = porClave.get("locales");
  const localActivoNube = porClave.get("localActivoId");
  const productosNube = porClave.get("productos");
  if (Array.isArray(empresasNube) && empresasNube.length && typeof setEmpresas === "function") setEmpresas(empresasNube.filter((e) => e && e.id));
  if (Array.isArray(localesNube) && localesNube.length && typeof setLocales === "function") setLocales(localesNube.filter((l) => l && l.id));
  if (typeof localActivoNube === "string" && localActivoNube && typeof setLocalActivoId === "function") setLocalActivoId(localActivoNube);
  if (Array.isArray(productosNube) && productosNube.length && typeof setProductos === "function") setProductos(productosNube.filter((p) => p && p.id));
  return { ok: true, empresas: Array.isArray(empresasNube) ? empresasNube.length : 0, locales: Array.isArray(localesNube) ? localesNube.length : 0, productos: Array.isArray(productosNube) ? productosNube.length : 0 };
}

'''

if "async function sincronizarContextoPm07" not in s:
    if anchor not in s:
        raise SystemExit("anchor helper no encontrado")
    s = s.replace(anchor, helper + anchor, 1)

old = '''      try {
        await sincronizarStockPm07({ setProductos, setMovimientos, localActivoId });
      } catch (e) {
        if (activo) console.error("PM-07: no se pudo sincronizar stock autoritativo", e);
      }'''
new = '''      try {
        await sincronizarContextoPm07({ setEmpresas, setLocales, setLocalActivoId, setProductos });
        await sincronizarStockPm07({ setProductos, setMovimientos, localActivoId });
      } catch (e) {
        if (activo) console.error("PM-07: no se pudo sincronizar contexto/stock autoritativo", e);
      }'''

if old in s:
    s = s.replace(old, new, 1)
elif "await sincronizarContextoPm07({ setEmpresas, setLocales" not in s:
    raise SystemExit("anchor efecto no encontrado")

p.write_text(s)
