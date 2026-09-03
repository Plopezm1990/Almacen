from pathlib import Path

p = Path('fuente.js')
s = p.read_text(encoding='utf-8')

old = 'function anularVenta(ventaId, movimientosActuales, motivo = "") {'
assert s.count(old) == 1, s.count(old)
s = s.replace(old, 'function anularVentaLocal(ventaId, movimientosActuales, motivo = "") {', 1)

marker = '  return { venderCarrito, venderLocal, anularVenta, venderLineas };'
assert s.count(marker) == 1, s.count(marker)
wrapper = '''  async function anularVenta(ventaId, movimientosActuales, motivo = "") {
    if (!ventaId) return { ok: false, error: "Esa venta no tiene identificador y no se puede anular." };
    const hayConexion = typeof window !== "undefined" && window.__nubeActiva && typeof window.getSupabaseClient === "function";
    if (!hayConexion) return anularVentaLocal(ventaId, movimientosActuales, motivo);
    const lineasOriginales = (movimientosActuales || []).filter((m2) => m2.ventaId === ventaId || m2.operationId === ventaId).filter((m2) => esVenta(m2) || esSalida(m2)).filter((m2) => movimientoEsDelLocalActivoVenta(m2));
    if (lineasOriginales.length === 0) return { ok: false, error: "No se han encontrado las líneas de esa venta." };
    try {
      const supabase = await window.getSupabaseClient();
      const r = await supabase.rpc("anular_venta_tpv", { p_venta_id: ventaId, p_motivo: motivo || "" });
      if (r.error) throw r.error;
      if (!r.data || r.data.ok === false) return { ok: false, error: r.data?.error || "No se ha podido anular la venta.", yaExistia: !!r.data?.yaExistia };
      let sincronizada = false;
      try {
        const [rProd, movLeidos] = await Promise.all([
          supabase.from("almacen_kv").select("value").eq("key", "productos").maybeSingle(),
          window.storage.get("movimientos")
        ]);
        if (!rProd.error && rProd.data && Array.isArray(rProd.data.value)) setProductos(rProd.data.value);
        if (movLeidos && movLeidos.value) {
          setMovimientos(JSON.parse(movLeidos.value));
          sincronizada = true;
        }
      } catch {
      }
      const fechaVenta = lineasOriginales[0]?.fecha;
      const arqueoDelDia = fechaVenta && (arqueos || []).find((a2) => a2.fecha === fechaVenta && (!localActivoId || a2.localId === localActivoId));
      if (arqueoDelDia) {
        fetch("https://flqercbgpgmmfaakrwkc.supabase.co/functions/v1/enviar-notificacion", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            titulo: "Caja cerrada, ahora desactualizada",
            cuerpo: `Se anuló una venta del ${fechaVenta}, día que ya tenía la caja cerrada — revisa ese arqueo, puede que ya no cuadre.`,
            localId: r.data.localId || lineasOriginales[0]?.localId || null,
            url: "/"
          })
        }).catch(() => {});
      }
      return { ok: true, lineasAnuladas: Number(r.data.lineasAnuladas) || 0, arqueoAfectado: !!arqueoDelDia, modo: "atomico", sincronizada };
    } catch (error) {
      return { ok: false, error: "No se pudo confirmar la anulación con el servidor. Recarga antes de volver a intentarlo para evitar duplicados." };
    }
  }
'''
s = s.replace(marker, wrapper + marker, 1)

assert s.count('function confirmarAnulacion() {') == 1
s = s.replace('function confirmarAnulacion() {', 'async function confirmarAnulacion() {', 1)
call = 'const r = anularVenta(confirmAnular.ventaId, movimientos, motivoAnular.trim());'
assert s.count(call) == 1, s.count(call)
s = s.replace(call, 'const r = await anularVenta(confirmAnular.ventaId, movimientos, motivoAnular.trim());', 1)

p.write_text(s, encoding='utf-8')
