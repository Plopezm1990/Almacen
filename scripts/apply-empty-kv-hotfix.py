from pathlib import Path

p = Path("index.html")
text = p.read_text(encoding="utf-8")

helper_anchor = '''  };

  // --- Cola de lo que falta subir a la nube ---'''
helper_replacement = '''  };

  // Una clave que todavía no existe es un estado normal de primer arranque.
  // Solo se normaliza ese sentinel exacto; SecurityError/cuota/etc. se propagan.
  function leerLocalOpcional(key) {
    try { return LOCAL.get(key); }
    catch (e) {
      if (e && e.message === "no existe") return null;
      throw e;
    }
  }

  // --- Cola de lo que falta subir a la nube ---'''

if "function leerLocalOpcional(key)" not in text:
    if text.count(helper_anchor) != 1:
        raise SystemExit(f"helper anchor inesperado: {text.count(helper_anchor)}")
    text = text.replace(helper_anchor, helper_replacement, 1)

storage_root = text.index("  window.storage = {")
start = text.index("    async get(key) {", storage_root)
end = text.index("\n\n    // Guardar:", start)

new_get = '''    async get(key) {
      var tablaEmpresa = TABLAS_EMPRESA[key];
      var tablaEmpresaLocal = TABLAS_EMPRESA_LOCAL[key];
      var tablaEspecial = TABLAS_POR_FILA[key];
      var esPagosFactura = key === "pagosFacturas";
      var esLedgerRpc = !!LEDGERS_RPC[key];
      var cacheKey = await claveCacheLocal(key);
      var falloNube = null;
      // Los ledgers PM-08 se hidratan con consultas RLS desde fuente.js cuando
      // ya existe sesión. Aquí solo se devuelve la última copia segregada del
      // usuario para no leer el antiguo bloque global de almacen_kv.
      if (esLedgerRpc && !esPagosFactura) {
        return { key: key, value: leerLocalOpcional(cacheKey), shared: false };
      }
      if (window.__nubeActiva && window.__nubeCliente && pendientes().indexOf(key) === -1) {
        try {
          var lista;
          if (esPagosFactura) {
            lista = await conTiempoLimite(leerPagosFactura(), ESPERA_NUBE_MS);
          } else if (tablaEmpresa) {
            lista = await conTiempoLimite(leerColeccionEmpresa(tablaEmpresa), ESPERA_NUBE_MS);
          } else if (tablaEmpresaLocal) {
            lista = await conTiempoLimite(leerColeccionEmpresaLocal(tablaEmpresaLocal), ESPERA_NUBE_MS);
          } else if (tablaEspecial) {
            lista = await conTiempoLimite(leerColeccionPorFila(tablaEspecial, key), ESPERA_NUBE_MS);
          } else {
            var r = await conTiempoLimite(
              window.__nubeCliente.from("almacen_kv").select("value").eq("key", key).maybeSingle(),
              ESPERA_NUBE_MS
            );
            if (r.error) throw r.error;
            if (!r.data) {
              var sinDatos = new Error("sin datos en la nube para " + key);
              sinDatos.code = "NUBE_SIN_DATOS";
              throw sinDatos;
            }
            lista = r.data.value;
          }
          var texto = JSON.stringify(lista);
          LOCAL.set(cacheKey, texto);
          return { key: key, value: texto, shared: false };
        } catch (e) {
          // La ausencia remota es normal en un first-run. Cualquier otro error
          // se conserva: si tampoco existe caché local, loadKey debe avisarlo.
          if (!(e && e.code === "NUBE_SIN_DATOS")) falloNube = e;
        }
      }
      var valorLocal = leerLocalOpcional(cacheKey);
      if (valorLocal === null && falloNube) throw falloNube;
      return { key: key, value: valorLocal, shared: false };
    },'''

old_get = text[start:end]
if "value: LOCAL.get(cacheKey)" not in old_get and "value: leerLocalOpcional(cacheKey)" not in old_get:
    raise SystemExit("El contrato esperado de storage.get ya no coincide")

if old_get != new_get:
    text = text[:start] + new_get + text[end:]

p.write_text(text, encoding="utf-8")
