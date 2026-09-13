import fs from 'node:fs';

const API = process.env.QA_API_URL;
const ANON = process.env.QA_ANON_KEY;
const PASSWORD = process.env.QA_P03_PASSWORD;
if (!API || !ANON || !PASSWORD) throw new Error('faltan variables de entorno');

const FACTURA_ID = 'QA-PM23-FACTURA-PAGOS';
const VENTA_PRODUCTO = 'QA-PM23-VENTA-PROD';
const AJUSTE_PRODUCTOS = Array.from({ length: 45 }, (_, i) => 'QA-PM23-AJUSTE-' + String(i + 1).padStart(2, '0'));
const EMPRESA = 'QA-EMP-A';
const LOCAL = 'QA-A1';
const NIVELES_CONCURRENCIA = [2, 5, 10, 20];
const N_SECUENCIAL = 200;

let seq = 0;
function opId(prefijo) { seq += 1; return `${prefijo}-${Date.now()}-${seq}-${Math.random().toString(36).slice(2, 8)}`; }

async function signIn(email) {
  const r = await fetch(`${API}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD })
  });
  const data = await r.json();
  if (r.status !== 200) throw new Error('login fallido: ' + JSON.stringify(data));
  return data.access_token;
}

async function timedRpc(name, token, body) {
  const t0 = performance.now();
  let status, ok, data;
  try {
    const r = await fetch(`${API}/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers: { apikey: ANON, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    status = r.status; ok = r.ok;
    const text = await r.text();
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  } catch (e) {
    status = 0; ok = false; data = { networkError: e.message };
  }
  const ms = performance.now() - t0;
  return { ms, status, ok, data };
}

async function rest(path, { token, method = 'GET', body } = {}) {
  const r = await fetch(`${API}/rest/v1/${path}`, {
    method,
    headers: { apikey: ANON, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: method === 'GET' ? undefined : 'return=representation' },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await r.text();
  let data; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: r.status, ok: r.ok, data };
}

function percentiles(msList) {
  const arr = [...msList].sort((a, b) => a - b);
  const p = (q) => {
    if (!arr.length) return null;
    const idx = Math.min(arr.length - 1, Math.max(0, Math.ceil((q / 100) * arr.length) - 1));
    return Math.round(arr[idx] * 100) / 100;
  };
  return { n: arr.length, p50: p(50), p95: p(95), p99: p(99), max: arr.length ? Math.round(arr[arr.length - 1] * 100) / 100 : null };
}

async function medirLote(nombre, fn, n, opts = {}) {
  const resultados = await Promise.all(Array.from({ length: n }, (_, i) => fn(i)));
  const tiempos = resultados.map(r => r.ms);
  const errores = resultados.filter(r => !(r.ok && r.data && r.data.ok === true));
  return { nombre, tamañoMuestra: n, ...percentiles(tiempos), errores: errores.length, detalleErrores: errores.slice(0, 5).map(e => ({ status: e.status, data: e.data })) };
}

async function medirSecuencial(nombre, fn, n) {
  const tiempos = [];
  let errores = 0;
  const detalleErrores = [];
  for (let i = 0; i < n; i++) {
    const r = await fn(i);
    tiempos.push(r.ms);
    if (!(r.ok && r.data && r.data.ok === true)) { errores += 1; if (detalleErrores.length < 5) detalleErrores.push({ status: r.status, data: r.data }); }
  }
  return { nombre, tamañoMuestra: n, ...percentiles(tiempos), errores, detalleErrores };
}

const token = await signIn('owner.a@qa.invalid');

const resultado = { metadatos: {}, pago: {}, ajuste: {}, devolucion: {}, timeoutRecuperacion: {}, integridad: {} };

resultado.metadatos = {
  fecha: new Date().toISOString(),
  entorno: 'QA (proyecto de pruebas, nunca producción)',
  cliente: 'Node.js fetch (undici) desde el sandbox de esta sesión de desarrollo -- NO representativo de un cliente móvil/navegador real en red de usuario final',
  autenticacion: 'anon key + sesión real (owner.a, Propietario QA-EMP-A) -- nunca service_role',
  nivelesConcurrencia: NIVELES_CONCURRENCIA,
  tamañoSecuencial: N_SECUENCIAL
};

// ===================== PAGO =====================
{
  const antesPagos = await rest(`pagos_factura?select=id&factura_id=eq.${FACTURA_ID}`, { token });
  const conteoAntes = antesPagos.data.length;

  const hacerPago = async () => {
    const id = opId('pm23-pago');
    return timedRpc('registrar_pago_factura', token, {
      p_id: id, p_operation_id: id, p_factura_id: FACTURA_ID, p_origen_factura: 'directa',
      p_empresa_id: EMPRESA, p_local_id: LOCAL, p_importe: 1, p_fecha: new Date().toISOString().slice(0, 10), p_medio_pago: 'EFECTIVO'
    });
  };

  const frio = await hacerPago();
  const niveles = [];
  for (const n of NIVELES_CONCURRENCIA) {
    niveles.push(await medirLote(`concurrente-${n}`, hacerPago, n));
  }
  const secuencial = await medirSecuencial('secuencial-200', hacerPago, N_SECUENCIAL);

  const despuesPagos = await rest(`pagos_factura?select=id,importe&factura_id=eq.${FACTURA_ID}`, { token });
  const conteoEsperado = conteoAntes + 1 + NIVELES_CONCURRENCIA.reduce((a, b) => a + b, 0) + N_SECUENCIAL;
  const idsUnicos = new Set(despuesPagos.data.map(p => p.id)).size === despuesPagos.data.length;

  resultado.pago = {
    operacion: 'registrar_pago_factura (importe fijo 1 EUR por pago, factura compartida QA-PM23-FACTURA-PAGOS)',
    frio: { ms: Math.round(frio.ms * 100) / 100, ok: frio.ok && frio.data?.ok === true },
    niveles, secuencial,
    integridad: {
      filasAntes: conteoAntes, filasDespues: despuesPagos.data.length, filasEsperadas: conteoEsperado,
      sinDuplicados: idsUnicos, coincide: despuesPagos.data.length === conteoEsperado
    }
  };
}

// ===================== AJUSTE DE STOCK (sustituto de "recepción" -- ver hallazgo) =====================
{
  async function estadoProducto(pid) {
    const r = await rest(`stock_ubicacion?select=almacen,piso&empresa_id=eq.${EMPRESA}&local_id=eq.${LOCAL}&producto_id=eq.${pid}`, { token });
    return r.data[0];
  }
  async function hacerAjuste(pid, delta) {
    const s = await estadoProducto(pid);
    const total = Number(s.almacen) + Number(s.piso);
    const target = total + delta;
    const conteoId = opId('pm23-conteo');
    const fecha = new Date().toISOString().slice(0, 10);
    const operationId = `pm12-ajuste-conteo:${conteoId}:${fecha}`;
    const plan = [{
      productoId: pid, movimientoId: `${operationId}:producto:${pid}:inventario-total`, operationId,
      cantidad: delta, tipo: 'INVENTARIO', origen: 'aplicarAjustes', documentoOrigenId: conteoId,
      afectaStockTotal: true, afectaStockPisoVenta: false, camposExtra: { pm12PlanLeg: 'inventario-total' }
    }];
    const bases = [{ productoId: pid, conteo: target, stock: total, stockPisoVenta: Number(s.piso), deficitPendiente: 0 }];
    const intencion = { id: conteoId, empresaId: EMPRESA, localId: LOCAL, estado: 'COMPLETADO', cerradoEn: fecha, ambito: 'total', items: [{ productoId: pid, conteo: target }] };
    return timedRpc('pm12_confirmar_ajuste_stock', token, { p_operation_id: operationId, p_empresa_id: EMPRESA, p_local_id: LOCAL, p_intencion: intencion, p_plan: plan, p_bases: bases });
  }

  const frio = await hacerAjuste(AJUSTE_PRODUCTOS[0], -1);
  const niveles = [];
  let idx = 1;
  for (const n of NIVELES_CONCURRENCIA) {
    const productos = AJUSTE_PRODUCTOS.slice(idx, idx + n);
    idx += n;
    if (productos.length !== n) throw new Error(`pool de productos AJUSTE agotado: pedidos ${n}, disponibles ${productos.length}`);
    const resultados = await Promise.all(productos.map(pid => hacerAjuste(pid, -1)));
    const tiempos = resultados.map(r => r.ms);
    const errores = resultados.filter(r => !(r.ok && r.data && r.data.ok === true));
    niveles.push({ nombre: `concurrente-${n}`, tamañoMuestra: n, ...percentiles(tiempos), errores: errores.length, detalleErrores: errores.slice(0, 5).map(e => ({ status: e.status, data: e.data })) });
  }
  // Secuencial: reutiliza un único producto, refrescando el estado real antes de cada llamada.
  const prodSecuencial = AJUSTE_PRODUCTOS[0];
  const tiemposSec = [];
  let erroresSec = 0;
  const detalleErroresSec = [];
  for (let i = 0; i < N_SECUENCIAL; i++) {
    const delta = i % 2 === 0 ? -1 : 1; // alterna para no drenar el stock del fixture
    const r = await hacerAjuste(prodSecuencial, delta);
    tiemposSec.push(r.ms);
    if (!(r.ok && r.data && r.data.ok === true)) { erroresSec += 1; if (detalleErroresSec.length < 5) detalleErroresSec.push({ status: r.status, data: r.data }); }
  }
  const secuencial = { nombre: 'secuencial-200', tamañoMuestra: N_SECUENCIAL, ...percentiles(tiemposSec), errores: erroresSec, detalleErrores: detalleErroresSec };

  resultado.ajuste = {
    operacion: 'pm12_confirmar_ajuste_stock -- SUSTITUTO de "recepción": no existe una RPC dedicada a recepción de compra en el backend (ver hallazgo en el documento de cierre)',
    frio: { ms: Math.round(frio.ms * 100) / 100, ok: frio.ok && frio.data?.ok === true },
    niveles, secuencial
  };
}

// ===================== DEVOLUCIÓN =====================
{
  async function crearVenta() {
    const id = opId('pm23-venta');
    return timedRpc('registrar_venta_stock_pm09', token, { p_operation_id: id, p_empresa_id: EMPRESA, p_local_id: LOCAL, p_producto_id: VENTA_PRODUCTO, p_cantidad: 1, p_fecha: new Date().toISOString().slice(0, 10) });
  }
  async function devolver(ventaOperationId) {
    const id = opId('pm23-devol');
    return timedRpc('registrar_devolucion_venta_pm09', token, {
      p_operation_id: id, p_venta_operation_id: ventaOperationId, p_empresa_id: EMPRESA, p_local_id: LOCAL,
      p_producto_id: VENTA_PRODUCTO, p_cantidad: 1, p_reembolso: 0, p_medio_reembolso: 'SIN_REEMBOLSO', p_motivo: 'PM23 medicion base', p_fecha: new Date().toISOString().slice(0, 10)
    });
  }

  const ventaFria = await crearVenta();
  const frio = await devolver(ventaFria.data.movimiento.operation_id);

  const niveles = [];
  for (const n of NIVELES_CONCURRENCIA) {
    const ventas = [];
    for (let i = 0; i < n; i++) { const v = await crearVenta(); ventas.push(v.data.movimiento.operation_id); }
    niveles.push(await medirLote(`concurrente-${n}`, (i) => devolver(ventas[i]), n));
  }

  const tiemposSec = [];
  let erroresSec = 0;
  const detalleErroresSec = [];
  for (let i = 0; i < N_SECUENCIAL; i++) {
    const v = await crearVenta();
    const r = await devolver(v.data.movimiento.operation_id);
    tiemposSec.push(r.ms);
    if (!(r.ok && r.data && r.data.ok === true)) { erroresSec += 1; if (detalleErroresSec.length < 5) detalleErroresSec.push({ status: r.status, data: r.data }); }
  }
  const secuencial = { nombre: 'secuencial-200', tamañoMuestra: N_SECUENCIAL, ...percentiles(tiemposSec), errores: erroresSec, detalleErrores: detalleErroresSec };

  resultado.devolucion = {
    operacion: 'registrar_devolucion_venta_pm09 (venta previa de 1 unidad creada en el setup, sin reembolso monetario para no depender de arqueo de caja)',
    frio: { ms: Math.round(frio.ms * 100) / 100, ok: frio.ok && frio.data?.ok === true },
    niveles, secuencial
  };
}

// ===================== RECUPERACIÓN TRAS TIMEOUT =====================
{
  const p50Pago = resultado.pago.secuencial.p50 || 200;
  const timeoutMs = Math.max(10, Math.round(p50Pago / 2));
  const intentos = 5;
  const detalle = [];
  for (let i = 0; i < intentos; i++) {
    const id = opId('pm23-timeout-pago');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let abortado = false;
    const t0 = performance.now();
    try {
      await fetch(`${API}/rest/v1/rpc/registrar_pago_factura`, {
        method: 'POST', headers: { apikey: ANON, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_id: id, p_operation_id: id, p_factura_id: FACTURA_ID, p_origen_factura: 'directa', p_empresa_id: EMPRESA, p_local_id: LOCAL, p_importe: 1, p_fecha: new Date().toISOString().slice(0, 10), p_medio_pago: 'EFECTIVO' }),
        signal: controller.signal
      });
    } catch (e) {
      abortado = e.name === 'AbortError';
    } finally { clearTimeout(timer); }
    const msAbort = performance.now() - t0;
    // Espera breve a que el servidor termine si seguía en vuelo, luego reintenta con el MISMO id (replay real).
    await new Promise(r => setTimeout(r, 1500));
    const reintento = await timedRpc('registrar_pago_factura', token, { p_id: id, p_operation_id: id, p_factura_id: FACTURA_ID, p_origen_factura: 'directa', p_empresa_id: EMPRESA, p_local_id: LOCAL, p_importe: 1, p_fecha: new Date().toISOString().slice(0, 10), p_medio_pago: 'EFECTIVO' });
    const filas = await rest(`pagos_factura?select=id&operation_id=eq.${id}`, { token });
    detalle.push({ id, abortadoPorCliente: abortado, msHastaAborto: Math.round(msAbort * 100) / 100, reintento: { ok: reintento.ok && reintento.data?.ok === true, replayed: reintento.data?.replayed, status: reintento.status }, filasFinalesConEsteId: filas.data.length });
  }
  resultado.timeoutRecuperacion = { timeoutMsUsado: timeoutMs, basadoEn: 'p50 secuencial de pago / 2', intentos: detalle, efectoUnicoEnTodos: detalle.every(d => d.filasFinalesConEsteId === 1) };
}

// ===================== INTEGRIDAD FINAL =====================
{
  const pagos = await rest(`pagos_factura?select=id&factura_id=eq.${FACTURA_ID}`, { token });
  const idsPagos = new Set(pagos.data.map(p => p.id));
  resultado.integridad.pagos = { filas: pagos.data.length, idsUnicos: idsPagos.size === pagos.data.length };

  const stockFinal = {};
  for (const pid of AJUSTE_PRODUCTOS) {
    const s = await rest(`stock_ubicacion?select=almacen,piso&empresa_id=eq.${EMPRESA}&local_id=eq.${LOCAL}&producto_id=eq.${pid}`, { token });
    stockFinal[pid] = s.data[0];
  }
  resultado.integridad.stockAjuste = stockFinal;

  const ventaStock = await rest(`stock_ubicacion?select=almacen,piso&empresa_id=eq.${EMPRESA}&local_id=eq.${LOCAL}&producto_id=eq.${VENTA_PRODUCTO}`, { token });
  resultado.integridad.stockVentaProducto = ventaStock.data[0];
}

fs.writeFileSync('/tmp/claude-0/-home-user-Almacen/7604df6c-009f-590a-93e7-8c1d36a38529/scratchpad/pm23-baseline-resultado.json', JSON.stringify(resultado, null, 2));
console.log(JSON.stringify(resultado, null, 2));
console.log('PM23_BASELINE_EJECUTADO=OK');
