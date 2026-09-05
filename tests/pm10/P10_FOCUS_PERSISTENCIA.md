
## async function saveKey(

### offset 3990120
```js
_ */ new Date(`${entrada.fecha}T${entrada.hora}:00`);
      const fin = /* @__PURE__ */ new Date(`${f22.fecha}T${f22.hora}:00`);
      const horas = (fin - ini) / 36e5;
      if (horas > 0 && horas < 24) total += horas;
      entrada = null;
    }
  });
  return total;
}
function costePorHoraEquipoEnMes(nominas, fichajes, mes) {
  const nominasDelMes = nominas.filter((n2) => n2.mes === mes);
  const costeTotalMes = nominasDelMes.reduce((a22, n2) => a22 + (Number(n2.costeTotalEmpresa) || 0), 0);
  const horasTotalesMes = nominasDelMes.reduce((a22, n2) => a22 + horasDeEmpleadoEnMes(fichajes, n2.empleadoId, mes), 0);
  return horasTotalesMes > 0 ? costeTotalMes / horasTotalesMes : null;
}
async function loadKey(key, fallback, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await window.storage.get(key, false);
      if (res && res.value) return JSON.parse(res.value);
      return fallback;
    } catch (e2) {
      if (attempt === retries) {
        console.error("No se pudo cargar", key, "tras varios intentos:", e2);
        return fallback;
      }
      await new Promise((r2) => setTimeout(r2, 350));
    }
  }
  return fallback;
}
async function saveKey(key, value) {
  try {
    await window.storage.set(key, JSON.stringify(value), false);
  } catch (e2) {
    console.error("Error guardando", key, e2);
    if (typeof window !== "undefined" && window.dispatchEvent) {
      window.dispatchEvent(new CustomEvent("fallo-guardado", { detail: { key, mensaje: e2 && e2.message } }));
    }
  }
}
async function sincronizarStockPm07({ setProductos, setMovimientos, localActivoId = null }) {
  if (typeof window === "undefined" || !window.__nubeActiva || typeof window.getSupabaseClient !== "function") return { ok: false, offline: true };
  const supabase = await window.getSupabaseClient();
  let qStock = supabase.from("stock_estado").select("empresa_id,local_id,producto_id,almacen,piso,total,minimo,bajo_minimo,fraccionable,precision_cantidad,local_operable");
  let qMov = supabase.from("movimientos_stock").select("id,operation_id,tipo,empresa_id,local_id,producto_id,delta_almacen,delta_piso,delta_total,cantidad,movimiento_original_id,datos,actor_user_id,created_at").order("created_at", { ascending: false }).limit(2e3);
  const [rStock, rMov] = await Promise.all([qStock, qMov]);
  if (rStock.error) throw rStock.error;
  if (rMov.error) throw rMov.error;
  const stocks = Array.isArray(rStock.data) ? rStock.data : [];
  const movs = Array.isArray(rMov.data) ? rMov.data : [];
  if (typeof setProductos === "function") {
    setProductos((prev) => (prev || []).map((prod) => {
      const exacto = stocks.find((x3) => x3.producto_id === prod.id && x3.local_id === prod.localId);
      const activo = !exacto && localActivoId ? stocks.find((x3) => x3.producto_id === prod.id && x3.local_id === localActivoId) : null;
      const st2 = exacto || activo;
      if (!st2) return prod;
      return { ...prod, stock: Number(st2.total) || 0, stockPisoVenta: Number(st2.piso) || 0, stockMinimo: Number(st2.minimo) || 0, _pm07BajoMinimo: !!st2.bajo_minimo, _pm07Servidor: true, _pm07LocalOperable: st2.local_operable !== false };
    }));
  }
  if (typeof setMovimientos === "function") {
    const server = movs.map((m4) => {
      const d2 = m4.datos && typeof m4.datos === "object" ? m4.datos : {};
      const delta = Number(m4.delta_total) || 0;
      const creado = String(m4.created_at || "");
      return {
        id: `pm07-${m4.id}`,
        operationId: m4.operation_id,
        ventaId: d2.ventaId || (m4.tipo === "VENTA" ? m4.operation_id : d2.anulaVentaId || null),
        anulaVentaId: d2.anulaVentaId || null,
        productoId: m4.producto_id,
        localId: m4.local_id,
        empresaId: m4.empresa_id,
        cantidad: delta,
        cantidadFisica: Number(m4.cantidad) || Math.abs(delta),
        tipo: m4.tipo,
        motivo: d2.motivo || m4.tipo,
        referencia: d2.referencia || "PM-07",
        costoUnitario: Number(d2.costoUnitario) || 0,
        ingresoUnitario: Number(d2.ingresoUnitario) || 0,
        ivaVentaAplicado: Number(d2.ivaVentaAplicado) || 0,
        medioPago: d2.medioPago || null,
        detallePago: d2.detallePago || null,
        reembolso: d2.reembolso !== void 0 && d2.reembolso !== null ? Number(d2.reembolso) || 0 : null,
        medioReembolso: d2.medioReembolso || null,
        fecha: d2.fechaOperacion || (creado ? creado.slice(0, 10) : todayISO()),
        hora: creado ? creado.slice(11, 16) : (/* @__PURE__ */ new Date()).toTimeString().slice(0, 5),
        afectaStockTotal: delta !== 0,
        afectaStockPisoVenta: Number(m4.delta_piso) !== 0,
        movimientoOriginalId: m4.movimiento_original_id || null,
        _pm07Servidor: true
      };
    });
    setMovimientos((prev) => [...server, ...(prev || []).filter((m4) => !m4._pm07Servidor)]);
  }
  return { ok: true, stocks: stocks.length, movimientos: movs.length };
}
function redondearDineroPM08(valor) {
  const n2 = Number(valor);
  return Number.isFinite(n2) ? Math.round((n2 + Number.EPSILON) * 100) / 100 : NaN;
}
function modoSincronizadoPM08() {
  return typeof window !== "undefined" && !!window.NUBE_URL && !window.__modoPruebasLocal;
}
function horaActualPM08() {
  return (/* @__PURE__ */ new Date()).toTimeString().slice(0, 5);
}
function clavePendientePM08(tipo, empresaId, localId, extra = "") {
  return `almacen:pm08:${tipo}:${empresaId || "sin-empresa"}:${localId || "todos"}${extra ? `:${extra}` : ""}`;
}
function leerPendientePM08(clave) {
  try {
    return JSON.parse(localStorage.getItem(clave) || "null");
  } catch {
    return null;
  }
}
function guardarPendientePM08(cla
```

## window.storage.set =

### offset 1884517
```js
ar contexto = null;
    try {
      contexto = await obtenerContexto(false);
    } catch (e2) {
    }
    var rol = contexto && contexto.rol;
    if (!rol) {
      if (modoLocalNoReclamado()) return getOriginal(key, shared);
      return respuestaVacia(key);
    }
    if (rol === "Propietario") return getOriginal(key, shared);
    if (key === "empleados") {
      return respuestaStorage(key, Array.isArray(contexto.empleadosFichaje) ? contexto.empleadosFichaje : []);
    }
    if (key === "proveedores" && (rol === "Cajero/a" || rol === "Churrero/a")) {
      return respuestaStorage(key, Array.isArray(contexto.proveedores) ? contexto.proveedores : []);
    }
    if (key === "fichasCosto" && rol === "Churrero/a") {
      return respuestaStorage(key, Array.isArray(contexto.fichasProduccion) ? contexto.fichasProduccion : []);
    }
    if (key === "encargos" && rol === "Cajero/a") {
      return respuestaStorage(key, encargosSoloCaja(contexto.cobrosEncargos));
    }
    if (key === "fichajes" && rol !== "Encargado") {
      return fichajesDelPropioEmpleado(key, contexto, shared);
    }
    if (!puedeLeer(rol, key)) return respuestaVacia(key);
    return getOriginal(key, shared);
  };
  window.storage.set = async function(key, value, shared) {
    if (!CLAVES_CONTROLADAS[key]) return setOriginal(key, value, shared);
    var contexto = null;
    try {
      contexto = await obtenerContexto(false);
    } catch (e2) {
    }
    var rol = contexto && contexto.rol;
    if (!rol) {
      if (modoLocalNoReclamado()) return setOriginal(key, value, shared);
      return { key, value, shared: false };
    }
    if (rol !== "Propietario") {
      var resumenSoloLectura = key === "empleados" || key === "proveedores" && (rol === "Cajero/a" || rol === "Churrero/a") || key === "fichasCosto" && rol === "Churrero/a" || key === "encargos" && rol === "Cajero/a";
      if (resumenSoloLectura || !puedeEscribir(rol, key)) {
        return { key, value, shared: false };
      }
    }
    return setOriginal(key, value, shared);
  };
  if (deleteOriginal) {
    window.storage.delete = async function(key, shared) {
      if (!CLAVES_CONTROLADAS[key]) return deleteOriginal(key, shared);
      var contexto = null;
      try {
        contexto = await obtenerContexto(false);
      } catch (e2) {
      }
      if (!contexto || contexto.rol !== "Propietario") {
        if (!contexto && modoLocalNoReclamado()) return deleteOriginal(key, shared);
        return { key, shared: false };
      }
      return deleteOriginal(key, shared);
    };
  }
  window.__recargarContextoOperativo = function() {
    contextoCache = null;
    contextoUsuarioId = null;
    contextoFecha = 0;
    return obtenerContexto(true);
  };
})();
(function() {
  "use strict";
  if (window.__guardPerfilActivoInstalado) return;
  window.__guardPerfilActivoInstalado = true;
  var bloqueando = false;
  async function comprobarPerfilActivo() {
    if (bloqueando || !window.__nubeActiva || typeof window.getSupabaseClient !== "function") return;
    try {
      var supabase = await window.getSupabaseClient();
      var sesion = await supabase.auth.getSession();
      var userId = sesion && sesion.data && sesion.data.session && sesion.data.session.user ? sesion.data.session.user.id : null;
      if (!userId) return;
      var perfil = await supabase.from("perfiles").select("activo").eq("user_id", userId).maybeSingle();
      if (perfil.error) return;
      if (!perfil.data || perfil.data.activo !== true) {
        bloqueando = true;
        try {
          await supabase.auth.signOut({ scope: "local" });
        } catch (e2) {
        }
        window.location.reload();
      }
    } catch (e2) {
    }
  }
  window.setInterval(comprobarPerfilActivo, 3e4);
  window.addEventListener("focus", comprobarPerfilActivo);
  document.addEventListener("visibilitychange", function() {
    if (document.visibilityState === "visible") comprobarPerfilActivo();
  });
  setTimeout(comprobarPerfilActivo, 1e3);
})();
(function() {
  "use strict";
  if (document.querySelector('script[data-seleccion-neutral="1"]')) return;
  var script = document.createElement("script");
  script.src = "./seleccion-neutral-patch.js?v=2";
  script.defer = true;
  script.setAttribute("data-seleccion-neutral", "1");
  (document.head || document.documentElement).appendChild(script);
})();
(function() {
  "use strict";
  if (document.querySelector('script[data-auth-ux="1"]')) return;
  var script = document.createElement("script");
  script.src = "./auth-ux-patch.js?v=1";
  script.defer = true;
  script.setAttribute("data-auth-ux", "1");
  (document.head || document.documentElement).appendChild(script);
})();

// fuente-recuperado.js
var ReactNS = __toESM(require_react(), 1);
var import_client = __toESM(require_client(), 1);

// node_modules/@supabase/supabase-js/dist/tracingRegistry.mjs
var EXTRACTOR_KEY = /* @__PURE__ */ Symbol.for("@supabase/supabase-js.traceContextExtractor");
function getTraceContextExtractor() {
  return globalThis[EXTRACTOR_KEY];
}

// node_modules/tslib/tslib.es6.mjs
function __rest(s3, e2) {
  var t3 = {};
  for (var p3 in s3) if (Object.prototype.hasOwnProperty.call(s3, p3) && e2.indexOf(p3) < 0)
    t3[p3] = s3[p3];
  if (s3 != null && typeof Object.getOwnPropertySymbols === "function")
    for (var i4 = 0, p3 = Object.getOwnPropertySymbols(s3); i4 < p3.length; i4++) {
      if (e2.indexOf(p3[i4]) < 0 && Object.prototype.propertyIsEnumerable.call(s3, p3[i4]))
        t3[p3[i4]] = s3[p3[i4]];
    }
  return t3;
}
function __awaiter(thisArg, _arguments, P2, generator) {
  function adopt(value) {
    return value instanceof P2 ? value : new P2(function(resolve) {
      resolve(value);
  
```

## setOriginal(

### offset 1884616
```js
 }
    var rol = contexto && contexto.rol;
    if (!rol) {
      if (modoLocalNoReclamado()) return getOriginal(key, shared);
      return respuestaVacia(key);
    }
    if (rol === "Propietario") return getOriginal(key, shared);
    if (key === "empleados") {
      return respuestaStorage(key, Array.isArray(contexto.empleadosFichaje) ? contexto.empleadosFichaje : []);
    }
    if (key === "proveedores" && (rol === "Cajero/a" || rol === "Churrero/a")) {
      return respuestaStorage(key, Array.isArray(contexto.proveedores) ? contexto.proveedores : []);
    }
    if (key === "fichasCosto" && rol === "Churrero/a") {
      return respuestaStorage(key, Array.isArray(contexto.fichasProduccion) ? contexto.fichasProduccion : []);
    }
    if (key === "encargos" && rol === "Cajero/a") {
      return respuestaStorage(key, encargosSoloCaja(contexto.cobrosEncargos));
    }
    if (key === "fichajes" && rol !== "Encargado") {
      return fichajesDelPropioEmpleado(key, contexto, shared);
    }
    if (!puedeLeer(rol, key)) return respuestaVacia(key);
    return getOriginal(key, shared);
  };
  window.storage.set = async function(key, value, shared) {
    if (!CLAVES_CONTROLADAS[key]) return setOriginal(key, value, shared);
    var contexto = null;
    try {
      contexto = await obtenerContexto(false);
    } catch (e2) {
    }
    var rol = contexto && contexto.rol;
    if (!rol) {
      if (modoLocalNoReclamado()) return setOriginal(key, value, shared);
      return { key, value, shared: false };
    }
    if (rol !== "Propietario") {
      var resumenSoloLectura = key === "empleados" || key === "proveedores" && (rol === "Cajero/a" || rol === "Churrero/a") || key === "fichasCosto" && rol === "Churrero/a" || key === "encargos" && rol === "Cajero/a";
      if (resumenSoloLectura || !puedeEscribir(rol, key)) {
        return { key, value, shared: false };
      }
    }
    return setOriginal(key, value, shared);
  };
  if (deleteOriginal) {
    window.storage.delete = async function(key, shared) {
      if (!CLAVES_CONTROLADAS[key]) return deleteOriginal(key, shared);
      var contexto = null;
      try {
        contexto = await obtenerContexto(false);
      } catch (e2) {
      }
      if (!contexto || contexto.rol !== "Propietario") {
        if (!contexto && modoLocalNoReclamado()) return deleteOriginal(key, shared);
        return { key, shared: false };
      }
      return deleteOriginal(key, shared);
    };
  }
  window.__recargarContextoOperativo = function() {
    contextoCache = null;
    contextoUsuarioId = null;
    contextoFecha = 0;
    return obtenerContexto(true);
  };
})();
(function() {
  "use strict";
  if (window.__guardPerfilActivoInstalado) return;
  window.__guardPerfilActivoInstalado = true;
  var bloqueando = false;
  async function comprobarPerfilActivo() {
    if (bloqueando || !window.__nubeActiva || typeof window.getSupabaseClient !== "function") return;
    try {
      var supabase = await window.getSupabaseClient();
      var sesion = await supabase.auth.getSession();
      var userId = sesion && sesion.data && sesion.data.session && sesion.data.session.user ? sesion.data.session.user.id : null;
      if (!userId) return;
      var perfil = await supabase.from("perfiles").select("activo").eq("user_id", userId).maybeSingle();
      if (perfil.error) return;
      if (!perfil.data || perfil.data.activo !== true) {
        bloqueando = true;
        try {
          await supabase.auth.signOut({ scope: "local" });
        } catch (e2) {
        }
        window.location.reload();
      }
    } catch (e2) {
    }
  }
  window.setInterval(comprobarPerfilActivo, 3e4);
  window.addEventListener("focus", comprobarPerfilActivo);
  document.addEventListener("visibilitychange", function() {
    if (document.visibilityState === "visible") comprobarPerfilActivo();
  });
  setTimeout(comprobarPerfilActivo, 1e3);
})();
(function() {
  "use strict";
  if (document.querySelector('script[data-seleccion-neutral="1"]')) return;
  var script = document.createElement("script");
  script.src = "./seleccion-neutral-patch.js?v=2";
  script.defer = true;
  script.setAttribute("data-seleccion-neutral", "1");
  (document.head || document.documentElement).appendChild(script);
})();
(function() {
  "use strict";
  if (document.querySelector('script[data-auth-ux="1"]')) return;
  var script = document.createElement("script");
  script.src = "./auth-ux-patch.js?v=1";
  script.defer = true;
  script.setAttribute("data-auth-ux", "1");
  (document.head || document.documentElement).appendChild(script);
})();

// fuente-recuperado.js
var ReactNS = __toESM(require_react(), 1);
var import_client = __toESM(require_client(), 1);

// node_modules/@supabase/supabase-js/dist/tracingRegistry.mjs
var EXTRACTOR_KEY = /* @__PURE__ */ Symbol.for("@supabase/supabase-js.traceContextExtractor");
function getTraceContextExtractor() {
  return globalThis[EXTRACTOR_KEY];
}

// node_modules/tslib/tslib.es6.mjs
function __rest(s3, e2) {
  var t3 = {};
  for (var p3 in s3) if (Object.prototype.hasOwnProperty.call(s3, p3) && e2.indexOf(p3) < 0)
    t3[p3] = s3[p3];
  if (s3 != null && typeof Object.getOwnPropertySymbols === "function")
    for (var i4 = 0, p3 = Object.getOwnPropertySymbols(s3); i4 < p3.length; i4++) {
      if (e2.indexOf(p3[i4]) < 0 && Object.prototype.propertyIsEnumerable.call(s3, p3[i4]))
        t3[p3[i4]] = s3[p3[i4]];
    }
  return t3;
}
function __awaiter(thisArg, _arguments, P2, generator) {
  function adopt(value) {
    return value instanceof P2 ? value : new P2(function(resolve) {
      resolve(value);
    });
  }
  return new (P2 || (P2 = Promise))(function(resolve, reject) {
    function fulfilled(va
```

### offset 1884853
```js
(key === "empleados") {
      return respuestaStorage(key, Array.isArray(contexto.empleadosFichaje) ? contexto.empleadosFichaje : []);
    }
    if (key === "proveedores" && (rol === "Cajero/a" || rol === "Churrero/a")) {
      return respuestaStorage(key, Array.isArray(contexto.proveedores) ? contexto.proveedores : []);
    }
    if (key === "fichasCosto" && rol === "Churrero/a") {
      return respuestaStorage(key, Array.isArray(contexto.fichasProduccion) ? contexto.fichasProduccion : []);
    }
    if (key === "encargos" && rol === "Cajero/a") {
      return respuestaStorage(key, encargosSoloCaja(contexto.cobrosEncargos));
    }
    if (key === "fichajes" && rol !== "Encargado") {
      return fichajesDelPropioEmpleado(key, contexto, shared);
    }
    if (!puedeLeer(rol, key)) return respuestaVacia(key);
    return getOriginal(key, shared);
  };
  window.storage.set = async function(key, value, shared) {
    if (!CLAVES_CONTROLADAS[key]) return setOriginal(key, value, shared);
    var contexto = null;
    try {
      contexto = await obtenerContexto(false);
    } catch (e2) {
    }
    var rol = contexto && contexto.rol;
    if (!rol) {
      if (modoLocalNoReclamado()) return setOriginal(key, value, shared);
      return { key, value, shared: false };
    }
    if (rol !== "Propietario") {
      var resumenSoloLectura = key === "empleados" || key === "proveedores" && (rol === "Cajero/a" || rol === "Churrero/a") || key === "fichasCosto" && rol === "Churrero/a" || key === "encargos" && rol === "Cajero/a";
      if (resumenSoloLectura || !puedeEscribir(rol, key)) {
        return { key, value, shared: false };
      }
    }
    return setOriginal(key, value, shared);
  };
  if (deleteOriginal) {
    window.storage.delete = async function(key, shared) {
      if (!CLAVES_CONTROLADAS[key]) return deleteOriginal(key, shared);
      var contexto = null;
      try {
        contexto = await obtenerContexto(false);
      } catch (e2) {
      }
      if (!contexto || contexto.rol !== "Propietario") {
        if (!contexto && modoLocalNoReclamado()) return deleteOriginal(key, shared);
        return { key, shared: false };
      }
      return deleteOriginal(key, shared);
    };
  }
  window.__recargarContextoOperativo = function() {
    contextoCache = null;
    contextoUsuarioId = null;
    contextoFecha = 0;
    return obtenerContexto(true);
  };
})();
(function() {
  "use strict";
  if (window.__guardPerfilActivoInstalado) return;
  window.__guardPerfilActivoInstalado = true;
  var bloqueando = false;
  async function comprobarPerfilActivo() {
    if (bloqueando || !window.__nubeActiva || typeof window.getSupabaseClient !== "function") return;
    try {
      var supabase = await window.getSupabaseClient();
      var sesion = await supabase.auth.getSession();
      var userId = sesion && sesion.data && sesion.data.session && sesion.data.session.user ? sesion.data.session.user.id : null;
      if (!userId) return;
      var perfil = await supabase.from("perfiles").select("activo").eq("user_id", userId).maybeSingle();
      if (perfil.error) return;
      if (!perfil.data || perfil.data.activo !== true) {
        bloqueando = true;
        try {
          await supabase.auth.signOut({ scope: "local" });
        } catch (e2) {
        }
        window.location.reload();
      }
    } catch (e2) {
    }
  }
  window.setInterval(comprobarPerfilActivo, 3e4);
  window.addEventListener("focus", comprobarPerfilActivo);
  document.addEventListener("visibilitychange", function() {
    if (document.visibilityState === "visible") comprobarPerfilActivo();
  });
  setTimeout(comprobarPerfilActivo, 1e3);
})();
(function() {
  "use strict";
  if (document.querySelector('script[data-seleccion-neutral="1"]')) return;
  var script = document.createElement("script");
  script.src = "./seleccion-neutral-patch.js?v=2";
  script.defer = true;
  script.setAttribute("data-seleccion-neutral", "1");
  (document.head || document.documentElement).appendChild(script);
})();
(function() {
  "use strict";
  if (document.querySelector('script[data-auth-ux="1"]')) return;
  var script = document.createElement("script");
  script.src = "./auth-ux-patch.js?v=1";
  script.defer = true;
  script.setAttribute("data-auth-ux", "1");
  (document.head || document.documentElement).appendChild(script);
})();

// fuente-recuperado.js
var ReactNS = __toESM(require_react(), 1);
var import_client = __toESM(require_client(), 1);

// node_modules/@supabase/supabase-js/dist/tracingRegistry.mjs
var EXTRACTOR_KEY = /* @__PURE__ */ Symbol.for("@supabase/supabase-js.traceContextExtractor");
function getTraceContextExtractor() {
  return globalThis[EXTRACTOR_KEY];
}

// node_modules/tslib/tslib.es6.mjs
function __rest(s3, e2) {
  var t3 = {};
  for (var p3 in s3) if (Object.prototype.hasOwnProperty.call(s3, p3) && e2.indexOf(p3) < 0)
    t3[p3] = s3[p3];
  if (s3 != null && typeof Object.getOwnPropertySymbols === "function")
    for (var i4 = 0, p3 = Object.getOwnPropertySymbols(s3); i4 < p3.length; i4++) {
      if (e2.indexOf(p3[i4]) < 0 && Object.prototype.propertyIsEnumerable.call(s3, p3[i4]))
        t3[p3[i4]] = s3[p3[i4]];
    }
  return t3;
}
function __awaiter(thisArg, _arguments, P2, generator) {
  function adopt(value) {
    return value instanceof P2 ? value : new P2(function(resolve) {
      resolve(value);
    });
  }
  return new (P2 || (P2 = Promise))(function(resolve, reject) {
    function fulfilled(value) {
      try {
        step(generator.next(value));
      } catch (e2) {
        reject(e2);
      }
    }
    function rejected(value) {
      try {
        step(generator["throw"](value));
      } catch (e2) {
        reject(e2);
 
```

### offset 1885318
```js
ontexto.fichasProduccion : []);
    }
    if (key === "encargos" && rol === "Cajero/a") {
      return respuestaStorage(key, encargosSoloCaja(contexto.cobrosEncargos));
    }
    if (key === "fichajes" && rol !== "Encargado") {
      return fichajesDelPropioEmpleado(key, contexto, shared);
    }
    if (!puedeLeer(rol, key)) return respuestaVacia(key);
    return getOriginal(key, shared);
  };
  window.storage.set = async function(key, value, shared) {
    if (!CLAVES_CONTROLADAS[key]) return setOriginal(key, value, shared);
    var contexto = null;
    try {
      contexto = await obtenerContexto(false);
    } catch (e2) {
    }
    var rol = contexto && contexto.rol;
    if (!rol) {
      if (modoLocalNoReclamado()) return setOriginal(key, value, shared);
      return { key, value, shared: false };
    }
    if (rol !== "Propietario") {
      var resumenSoloLectura = key === "empleados" || key === "proveedores" && (rol === "Cajero/a" || rol === "Churrero/a") || key === "fichasCosto" && rol === "Churrero/a" || key === "encargos" && rol === "Cajero/a";
      if (resumenSoloLectura || !puedeEscribir(rol, key)) {
        return { key, value, shared: false };
      }
    }
    return setOriginal(key, value, shared);
  };
  if (deleteOriginal) {
    window.storage.delete = async function(key, shared) {
      if (!CLAVES_CONTROLADAS[key]) return deleteOriginal(key, shared);
      var contexto = null;
      try {
        contexto = await obtenerContexto(false);
      } catch (e2) {
      }
      if (!contexto || contexto.rol !== "Propietario") {
        if (!contexto && modoLocalNoReclamado()) return deleteOriginal(key, shared);
        return { key, shared: false };
      }
      return deleteOriginal(key, shared);
    };
  }
  window.__recargarContextoOperativo = function() {
    contextoCache = null;
    contextoUsuarioId = null;
    contextoFecha = 0;
    return obtenerContexto(true);
  };
})();
(function() {
  "use strict";
  if (window.__guardPerfilActivoInstalado) return;
  window.__guardPerfilActivoInstalado = true;
  var bloqueando = false;
  async function comprobarPerfilActivo() {
    if (bloqueando || !window.__nubeActiva || typeof window.getSupabaseClient !== "function") return;
    try {
      var supabase = await window.getSupabaseClient();
      var sesion = await supabase.auth.getSession();
      var userId = sesion && sesion.data && sesion.data.session && sesion.data.session.user ? sesion.data.session.user.id : null;
      if (!userId) return;
      var perfil = await supabase.from("perfiles").select("activo").eq("user_id", userId).maybeSingle();
      if (perfil.error) return;
      if (!perfil.data || perfil.data.activo !== true) {
        bloqueando = true;
        try {
          await supabase.auth.signOut({ scope: "local" });
        } catch (e2) {
        }
        window.location.reload();
      }
    } catch (e2) {
    }
  }
  window.setInterval(comprobarPerfilActivo, 3e4);
  window.addEventListener("focus", comprobarPerfilActivo);
  document.addEventListener("visibilitychange", function() {
    if (document.visibilityState === "visible") comprobarPerfilActivo();
  });
  setTimeout(comprobarPerfilActivo, 1e3);
})();
(function() {
  "use strict";
  if (document.querySelector('script[data-seleccion-neutral="1"]')) return;
  var script = document.createElement("script");
  script.src = "./seleccion-neutral-patch.js?v=2";
  script.defer = true;
  script.setAttribute("data-seleccion-neutral", "1");
  (document.head || document.documentElement).appendChild(script);
})();
(function() {
  "use strict";
  if (document.querySelector('script[data-auth-ux="1"]')) return;
  var script = document.createElement("script");
  script.src = "./auth-ux-patch.js?v=1";
  script.defer = true;
  script.setAttribute("data-auth-ux", "1");
  (document.head || document.documentElement).appendChild(script);
})();

// fuente-recuperado.js
var ReactNS = __toESM(require_react(), 1);
var import_client = __toESM(require_client(), 1);

// node_modules/@supabase/supabase-js/dist/tracingRegistry.mjs
var EXTRACTOR_KEY = /* @__PURE__ */ Symbol.for("@supabase/supabase-js.traceContextExtractor");
function getTraceContextExtractor() {
  return globalThis[EXTRACTOR_KEY];
}

// node_modules/tslib/tslib.es6.mjs
function __rest(s3, e2) {
  var t3 = {};
  for (var p3 in s3) if (Object.prototype.hasOwnProperty.call(s3, p3) && e2.indexOf(p3) < 0)
    t3[p3] = s3[p3];
  if (s3 != null && typeof Object.getOwnPropertySymbols === "function")
    for (var i4 = 0, p3 = Object.getOwnPropertySymbols(s3); i4 < p3.length; i4++) {
      if (e2.indexOf(p3[i4]) < 0 && Object.prototype.propertyIsEnumerable.call(s3, p3[i4]))
        t3[p3[i4]] = s3[p3[i4]];
    }
  return t3;
}
function __awaiter(thisArg, _arguments, P2, generator) {
  function adopt(value) {
    return value instanceof P2 ? value : new P2(function(resolve) {
      resolve(value);
    });
  }
  return new (P2 || (P2 = Promise))(function(resolve, reject) {
    function fulfilled(value) {
      try {
        step(generator.next(value));
      } catch (e2) {
        reject(e2);
      }
    }
    function rejected(value) {
      try {
        step(generator["throw"](value));
      } catch (e2) {
        reject(e2);
      }
    }
    function step(result) {
      result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
    }
    step((generator = generator.apply(thisArg, _arguments || [])).next());
  });
}

// node_modules/@supabase/functions-js/dist/module/helper.js
var resolveFetch = (customFetch) => {
  if (customFetch) {
    return (...args) => customFetch(...args);
  }
  return (...args) => fetch(...args);
};

// node_modules/@supabase/funct
```

## saveKey(KEYS.

## saveKey(key

### offset 3990135
```js
${entrada.fecha}T${entrada.hora}:00`);
      const fin = /* @__PURE__ */ new Date(`${f22.fecha}T${f22.hora}:00`);
      const horas = (fin - ini) / 36e5;
      if (horas > 0 && horas < 24) total += horas;
      entrada = null;
    }
  });
  return total;
}
function costePorHoraEquipoEnMes(nominas, fichajes, mes) {
  const nominasDelMes = nominas.filter((n2) => n2.mes === mes);
  const costeTotalMes = nominasDelMes.reduce((a22, n2) => a22 + (Number(n2.costeTotalEmpresa) || 0), 0);
  const horasTotalesMes = nominasDelMes.reduce((a22, n2) => a22 + horasDeEmpleadoEnMes(fichajes, n2.empleadoId, mes), 0);
  return horasTotalesMes > 0 ? costeTotalMes / horasTotalesMes : null;
}
async function loadKey(key, fallback, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await window.storage.get(key, false);
      if (res && res.value) return JSON.parse(res.value);
      return fallback;
    } catch (e2) {
      if (attempt === retries) {
        console.error("No se pudo cargar", key, "tras varios intentos:", e2);
        return fallback;
      }
      await new Promise((r2) => setTimeout(r2, 350));
    }
  }
  return fallback;
}
async function saveKey(key, value) {
  try {
    await window.storage.set(key, JSON.stringify(value), false);
  } catch (e2) {
    console.error("Error guardando", key, e2);
    if (typeof window !== "undefined" && window.dispatchEvent) {
      window.dispatchEvent(new CustomEvent("fallo-guardado", { detail: { key, mensaje: e2 && e2.message } }));
    }
  }
}
async function sincronizarStockPm07({ setProductos, setMovimientos, localActivoId = null }) {
  if (typeof window === "undefined" || !window.__nubeActiva || typeof window.getSupabaseClient !== "function") return { ok: false, offline: true };
  const supabase = await window.getSupabaseClient();
  let qStock = supabase.from("stock_estado").select("empresa_id,local_id,producto_id,almacen,piso,total,minimo,bajo_minimo,fraccionable,precision_cantidad,local_operable");
  let qMov = supabase.from("movimientos_stock").select("id,operation_id,tipo,empresa_id,local_id,producto_id,delta_almacen,delta_piso,delta_total,cantidad,movimiento_original_id,datos,actor_user_id,created_at").order("created_at", { ascending: false }).limit(2e3);
  const [rStock, rMov] = await Promise.all([qStock, qMov]);
  if (rStock.error) throw rStock.error;
  if (rMov.error) throw rMov.error;
  const stocks = Array.isArray(rStock.data) ? rStock.data : [];
  const movs = Array.isArray(rMov.data) ? rMov.data : [];
  if (typeof setProductos === "function") {
    setProductos((prev) => (prev || []).map((prod) => {
      const exacto = stocks.find((x3) => x3.producto_id === prod.id && x3.local_id === prod.localId);
      const activo = !exacto && localActivoId ? stocks.find((x3) => x3.producto_id === prod.id && x3.local_id === localActivoId) : null;
      const st2 = exacto || activo;
      if (!st2) return prod;
      return { ...prod, stock: Number(st2.total) || 0, stockPisoVenta: Number(st2.piso) || 0, stockMinimo: Number(st2.minimo) || 0, _pm07BajoMinimo: !!st2.bajo_minimo, _pm07Servidor: true, _pm07LocalOperable: st2.local_operable !== false };
    }));
  }
  if (typeof setMovimientos === "function") {
    const server = movs.map((m4) => {
      const d2 = m4.datos && typeof m4.datos === "object" ? m4.datos : {};
      const delta = Number(m4.delta_total) || 0;
      const creado = String(m4.created_at || "");
      return {
        id: `pm07-${m4.id}`,
        operationId: m4.operation_id,
        ventaId: d2.ventaId || (m4.tipo === "VENTA" ? m4.operation_id : d2.anulaVentaId || null),
        anulaVentaId: d2.anulaVentaId || null,
        productoId: m4.producto_id,
        localId: m4.local_id,
        empresaId: m4.empresa_id,
        cantidad: delta,
        cantidadFisica: Number(m4.cantidad) || Math.abs(delta),
        tipo: m4.tipo,
        motivo: d2.motivo || m4.tipo,
        referencia: d2.referencia || "PM-07",
        costoUnitario: Number(d2.costoUnitario) || 0,
        ingresoUnitario: Number(d2.ingresoUnitario) || 0,
        ivaVentaAplicado: Number(d2.ivaVentaAplicado) || 0,
        medioPago: d2.medioPago || null,
        detallePago: d2.detallePago || null,
        reembolso: d2.reembolso !== void 0 && d2.reembolso !== null ? Number(d2.reembolso) || 0 : null,
        medioReembolso: d2.medioReembolso || null,
        fecha: d2.fechaOperacion || (creado ? creado.slice(0, 10) : todayISO()),
        hora: creado ? creado.slice(11, 16) : (/* @__PURE__ */ new Date()).toTimeString().slice(0, 5),
        afectaStockTotal: delta !== 0,
        afectaStockPisoVenta: Number(m4.delta_piso) !== 0,
        movimientoOriginalId: m4.movimiento_original_id || null,
        _pm07Servidor: true
      };
    });
    setMovimientos((prev) => [...server, ...(prev || []).filter((m4) => !m4._pm07Servidor)]);
  }
  return { ok: true, stocks: stocks.length, movimientos: movs.length };
}
function redondearDineroPM08(valor) {
  const n2 = Number(valor);
  return Number.isFinite(n2) ? Math.round((n2 + Number.EPSILON) * 100) / 100 : NaN;
}
function modoSincronizadoPM08() {
  return typeof window !== "undefined" && !!window.NUBE_URL && !window.__modoPruebasLocal;
}
function horaActualPM08() {
  return (/* @__PURE__ */ new Date()).toTimeString().slice(0, 5);
}
function clavePendientePM08(tipo, empresaId, localId, extra = "") {
  return `almacen:pm08:${tipo}:${empresaId || "sin-empresa"}:${localId || "todos"}${extra ? `:${extra}` : ""}`;
}
function leerPendientePM08(clave) {
  try {
    return JSON.parse(localStorage.getItem(clave) || "null");
  } catch {
    return null;
  }
}
function guardarPendientePM08(clave, valor) {
  
```

## productos:

### offset 4006913
```js
eClient();
  const r2 = await supabase.from("almacen_kv").select("key,value").in("key", ["empresas", "locales", "localActivoId", "productos"]);
  if (r2.error) throw r2.error;
  const porClave = new Map((r2.data || []).map((fila) => [fila.key, fila.value]));
  const empresasNube = porClave.get("empresas");
  const localesNube = porClave.get("locales");
  const localActivoNube = porClave.get("localActivoId");
  const productosNube = porClave.get("productos");
  if (Array.isArray(empresasNube) && empresasNube.length && typeof setEmpresas === "function") setEmpresas(empresasNube.filter((e2) => e2 && e2.id));
  if (Array.isArray(localesNube) && localesNube.length && typeof setLocales === "function") setLocales(localesNube.filter((l3) => l3 && l3.id));
  if (typeof localActivoNube === "string" && localActivoNube && typeof setLocalActivoId === "function") setLocalActivoId(localActivoNube);
  if (Array.isArray(productosNube) && productosNube.length && typeof setProductos === "function") setProductos(productosNube.filter((p3) => p3 && p3.id));
  return { ok: true, empresas: Array.isArray(empresasNube) ? empresasNube.length : 0, locales: Array.isArray(localesNube) ? localesNube.length : 0, productos: Array.isArray(productosNube) ? productosNube.length : 0 };
}
function SelectorLocalInformes({ locales = [], valor = "", onChange }) {
  const activos = locales.filter((l22) => l22 && l22.activo !== false && !l22.fusionadoEn);
  const seleccionado = activos.find((l22) => l22.id === valor);
  return /* @__PURE__ */ import_react4.default.createElement(Card, { className: "mb-4 no-imprimir" }, /* @__PURE__ */ import_react4.default.createElement("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-3 items-end" }, /* @__PURE__ */ import_react4.default.createElement(Field, { label: "Local" }, /* @__PURE__ */ import_react4.default.createElement("select", { value: valor, onChange: (e2) => onChange(e2.target.value), className: "w-full rounded-lg px-3 py-2 text-[13px]", style: { border: `1px solid ${C2.line}`, background: C2.surface } }, /* @__PURE__ */ import_react4.default.createElement("option", { value: "" }, "Todos los locales"), activos.map((l22) => /* @__PURE__ */ import_react4.default.createElement("option", { key: l22.id, value: l22.id }, l22.nombre)))), /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[11.5px] pb-2", style: { color: C2.inkSoft } }, seleccionado ? `Mostrando solo ${seleccionado.nombre}.` : "Mostrando datos consolidados de todos los locales.")));
}
function GestionAlmacen() {
  const [ready, setReady] = (0, import_react4.useState)(false);
  const [fallosGuardado, setFallosGuardado] = (0, import_react4.useState)([]);
  (0, import_react4.useEffect)(() => {
    function onFalloGuardado(e2) {
      setFallosGuardado((s22) => [
        { id: uid(), key: e2.detail.key, mensaje: e2.detail.mensaje || "", fecha: (/* @__PURE__ */ new Date()).toISOString() },
        ...s22
      ].slice(0, 20));
    }
    window.addEventListener("fallo-guardado", onFalloGuardado);
    return () => window.removeEventListener("fallo-guardado", onFalloGuardado);
  }, []);
  (0, import_react4.useEffect)(() => {
    function onConflictoFusion(e2) {
      const conflictos = e2.detail && e2.detail.conflictos || [];
      const key = e2.detail && e2.detail.key;
      conflictos.forEach((c22) => {
        registrarErrorSistema(
          `Edici\xF3n simult\xE1nea en "${c22.nombre}" (${key}): dos dispositivos lo cambiaron a la vez sin verse \u2014 se aplic\xF3 el cambio de este dispositivo, se perdi\xF3 el del otro.`,
          "sincronizaci\xF3n",
          JSON.stringify({ key, id: c22.id, mio: c22.mio, delOtro: c22.delOtro })
        );
      });
    }
    window.addEventListener("conflicto-fusion", onConflictoFusion);
    return () => window.removeEventListener("conflicto-fusion", onConflictoFusion);
  }, []);
  const [tab, setTab] = (0, import_react4.useState)("dashboard");
  const [disenoMenu, setDisenoMenu] = (0, import_react4.useState)("B");
  const [temaOscuro, setTemaOscuro] = (0, import_react4.useState)(false);
  const [modoEmpleado, setModoEmpleado] = (0, import_react4.useState)(false);
  const [miPerfil, setMiPerfil] = (0, import_react4.useState)(null);
  (0, import_react4.useEffect)(() => {
    if (!ready || typeof window === "undefined" || !window.__nubeActiva) return;
    let activo = true;
    (async () => {
      try {
        const supabase = await window.getSupabaseClient();
        const { data: sesion } = await supabase.auth.getSession();
        const userId = sesion?.session?.user?.id;
        if (!userId) return;
        const { data: perfil } = await supabase.from("perfiles").select("rol, nombre").eq("user_id", userId).maybeSingle();
        if (!activo || !perfil) return;
        setMiPerfil(perfil);
        if (perfil.rol !== "Propietario") setModoEmpleado(true);
      } catch (e2) {
      }
    })();
    return () => {
      activo = false;
    };
  }, [ready]);
  const [pinPropietario, setPinPropietario] = (0, import_react4.useState)("");
  const [auditoria, setAuditoria] = (0, import_react4.useState)([]);
  const [usuarioActivoId, setUsuarioActivoId] = (0, import_react4.useState)(null);
  const [ordenesProduccion, setOrdenesProduccion] = (0, import_react4.useState)([]);
  const [traspasos, setTraspasos] = (0, import_react4.useState)([]);
  const [facturasDirectas, setFacturasDirectas] = (0, import_react4.useState)([]);
  const [pagosFacturas, setPagosFacturas] = (0, import_react4.useState)([]);
  const [nominas, setNominas] = (0, import_react4.useState)([]);
  const [entrevistas, setEntrevistas] = (0, import_react4.useState)([]);
  const skipSaveRef = import_react4.d
```

### offset 4026017
```js
UnicaId ? { ...l22, empresaId: empresaLegacyUnicaId } : l22) : [];
      let localActivoFinal = lai || null;
      const productosBase = Array.isArray(pr) ? pr : [];
      const normalizarNombreLocal = (v22) => String(v22 || "").trim().toLowerCase();
      const idsProductoConLocal = [...new Set(productosBase.map((prod) => prod && prod.localId).filter(Boolean))];
      const idsLocalesIniciales = new Set(localesFinales.map((l22) => l22 && l22.id).filter(Boolean));
      const idsLocalesHuerfanos = idsProductoConLocal.filter((id) => !idsLocalesIniciales.has(id));
      if (idsLocalesHuerfanos.length === 1 && localesFinales.length > 0) {
        const nombresLocales = new Set(localesFinales.map((l22) => normalizarNombreLocal(l22 && l22.nombre)).filter(Boolean));
        if (nombresLocales.size === 1) {
          const idCanonico = idsLocalesHuerfanos[0];
          const baseLocal = localesFinales.find((l22) => l22 && l22.activo !== false) || localesFinales[0];
          const duplicadosAnteriores = localesFinales.map((l22) => ({ ...l22, activo: false, fusionadoEn: idCanonico }));
          localesFinales = [{ ...baseLocal, id: idCanonico, activo: true, fusionadoEn: null, recuperadoDeProductos: true }, ...duplicadosAnteriores];
          localActivoFinal = idCanonico;
        }
      }
      if (localesFinales.length === 0 && hayDatosOperativosLegacy) {
        const primerLocal = { id: uid(), nombre: "Local principal", direccion: "", empresaId: empresaLegacyUnicaId, activo: true, creadoEn: (/* @__PURE__ */ new Date()).toISOString(), migradoDesdeDatosLegacy: true };
        localesFinales = [primerLocal];
        localActivoFinal = primerLocal.id;
      }
      const idsLocalesTrasReparar = new Set(localesFinales.map((l22) => l22 && l22.id).filter(Boolean));
      idsProductoConLocal.forEach((id) => {
        if (!idsLocalesTrasReparar.has(id)) {
          localesFinales.push({ id, nombre: "Local recuperado", direccion: "", empresaId: empresaLegacyUnicaId, activo: true, creadoEn: (/* @__PURE__ */ new Date()).toISOString(), recuperadoDeProductos: true });
          idsLocalesTrasReparar.add(id);
        }
      });
      if (!localActivoFinal || !localesFinales.some((l22) => l22.id === localActivoFinal && l22.activo !== false && !l22.fusionadoEn)) {
        localActivoFinal = localesFinales.find((l22) => l22.activo !== false && !l22.fusionadoEn)?.id || localesFinales[0]?.id || null;
      }
      let productosFinales = productosBase;
      if (localActivoFinal && productosFinales.some((prod) => !prod.localId)) {
        productosFinales = productosFinales.map((prod) => prod.localId ? prod : { ...prod, localId: localActivoFinal });
      }
      const localPorProductoMigracion = new Map(productosFinales.map((prod) => [prod.id, prod.localId || localActivoFinal || null]));
      const inferirLocalLineasMigracion = (lineas) => {
        const ids = [...new Set((lineas || []).map((ln2) => localPorProductoMigracion.get(ln2 && ln2.productoId)).filter(Boolean))];
        return ids.length === 1 ? ids[0] : localActivoFinal || null;
      };
      const movimientosFinales = (mo || []).map((m22) => m22.localId ? m22 : { ...m22, localId: localPorProductoMigracion.get(m22.productoId) || localActivoFinal || null });
      const albaranesFinales = (alLimpios || []).map((a22) => a22.localId ? a22 : { ...a22, localId: inferirLocalLineasMigracion(a22.lineas) });
      const pedidosFinales = (pe2 || []).map((pedido) => pedido.localId ? pedido : { ...pedido, localId: inferirLocalLineasMigracion(pedido.items) });
      const encargosFinales = (en || []).map((encargo) => encargo.localId ? encargo : { ...encargo, localId: inferirLocalLineasMigracion(encargo.lineas) });
      const gastosFinales = (gg || []).map((g2) => g2.localId ? g2 : { ...g2, localId: localActivoFinal || null });
      const facturasDirectasFinales = (fd2 || []).map((f22) => f22.localId ? f22 : { ...f22, localId: localActivoFinal || null });
      const empleadosFinales = (em || []).map((e2) => e2.localId ? e2 : { ...e2, localId: localActivoFinal || null });
      const localPorEmpleadoMigracion = new Map(empleadosFinales.map((e2) => [e2.id, e2.localId || localActivoFinal || null]));
      const fichajesFinales = (fj || []).map((f22) => f22.localId ? f22 : { ...f22, localId: localPorEmpleadoMigracion.get(f22.empleadoId) || localActivoFinal || null });
      const turnosFinales = (tu || []).map((t22) => t22.localId ? t22 : { ...t22, localId: localPorEmpleadoMigracion.get(t22.empleadoId) || localActivoFinal || null });
      const nominasFinales = (nom || []).map((n2) => n2.localId ? n2 : { ...n2, localId: localPorEmpleadoMigracion.get(n2.empleadoId) || localActivoFinal || null });
      const arqueosFinales = (aq || []).map((a22) => a22.localId ? a22 : { ...a22, localId: localActivoFinal || null });
      const movimientosCajaFinales = (mc || []).map((m22) => m22.localId ? m22 : { ...m22, localId: localActivoFinal || null });
      const inferirLocalFichaMigracion = (ficha) => {
        const ids = [...new Set([
          localPorProductoMigracion.get(ficha && ficha.productoVinculadoId),
          ...(ficha && ficha.componentes || []).map((c22) => localPorProductoMigracion.get(c22 && c22.productoId))
        ].filter(Boolean))];
        return ids.length === 1 ? ids[0] : localActivoFinal || null;
      };
      const fichasCostoFinales = (fc || []).map((f22) => f22.localId ? f22 : { ...f22, localId: inferirLocalFichaMigracion(f22) });
      const ordenesProduccionFinales = (op || []).map((o22) => o22.localId ? o22 : { ...o22, localId: localPorProductoMigracion.get(o22.productoVinculadoId) || inferirLocalLineasMigracion(o22.ingredientes) });
      cons
```

### offset 4026885
```js
       const baseLocal = localesFinales.find((l22) => l22 && l22.activo !== false) || localesFinales[0];
          const duplicadosAnteriores = localesFinales.map((l22) => ({ ...l22, activo: false, fusionadoEn: idCanonico }));
          localesFinales = [{ ...baseLocal, id: idCanonico, activo: true, fusionadoEn: null, recuperadoDeProductos: true }, ...duplicadosAnteriores];
          localActivoFinal = idCanonico;
        }
      }
      if (localesFinales.length === 0 && hayDatosOperativosLegacy) {
        const primerLocal = { id: uid(), nombre: "Local principal", direccion: "", empresaId: empresaLegacyUnicaId, activo: true, creadoEn: (/* @__PURE__ */ new Date()).toISOString(), migradoDesdeDatosLegacy: true };
        localesFinales = [primerLocal];
        localActivoFinal = primerLocal.id;
      }
      const idsLocalesTrasReparar = new Set(localesFinales.map((l22) => l22 && l22.id).filter(Boolean));
      idsProductoConLocal.forEach((id) => {
        if (!idsLocalesTrasReparar.has(id)) {
          localesFinales.push({ id, nombre: "Local recuperado", direccion: "", empresaId: empresaLegacyUnicaId, activo: true, creadoEn: (/* @__PURE__ */ new Date()).toISOString(), recuperadoDeProductos: true });
          idsLocalesTrasReparar.add(id);
        }
      });
      if (!localActivoFinal || !localesFinales.some((l22) => l22.id === localActivoFinal && l22.activo !== false && !l22.fusionadoEn)) {
        localActivoFinal = localesFinales.find((l22) => l22.activo !== false && !l22.fusionadoEn)?.id || localesFinales[0]?.id || null;
      }
      let productosFinales = productosBase;
      if (localActivoFinal && productosFinales.some((prod) => !prod.localId)) {
        productosFinales = productosFinales.map((prod) => prod.localId ? prod : { ...prod, localId: localActivoFinal });
      }
      const localPorProductoMigracion = new Map(productosFinales.map((prod) => [prod.id, prod.localId || localActivoFinal || null]));
      const inferirLocalLineasMigracion = (lineas) => {
        const ids = [...new Set((lineas || []).map((ln2) => localPorProductoMigracion.get(ln2 && ln2.productoId)).filter(Boolean))];
        return ids.length === 1 ? ids[0] : localActivoFinal || null;
      };
      const movimientosFinales = (mo || []).map((m22) => m22.localId ? m22 : { ...m22, localId: localPorProductoMigracion.get(m22.productoId) || localActivoFinal || null });
      const albaranesFinales = (alLimpios || []).map((a22) => a22.localId ? a22 : { ...a22, localId: inferirLocalLineasMigracion(a22.lineas) });
      const pedidosFinales = (pe2 || []).map((pedido) => pedido.localId ? pedido : { ...pedido, localId: inferirLocalLineasMigracion(pedido.items) });
      const encargosFinales = (en || []).map((encargo) => encargo.localId ? encargo : { ...encargo, localId: inferirLocalLineasMigracion(encargo.lineas) });
      const gastosFinales = (gg || []).map((g2) => g2.localId ? g2 : { ...g2, localId: localActivoFinal || null });
      const facturasDirectasFinales = (fd2 || []).map((f22) => f22.localId ? f22 : { ...f22, localId: localActivoFinal || null });
      const empleadosFinales = (em || []).map((e2) => e2.localId ? e2 : { ...e2, localId: localActivoFinal || null });
      const localPorEmpleadoMigracion = new Map(empleadosFinales.map((e2) => [e2.id, e2.localId || localActivoFinal || null]));
      const fichajesFinales = (fj || []).map((f22) => f22.localId ? f22 : { ...f22, localId: localPorEmpleadoMigracion.get(f22.empleadoId) || localActivoFinal || null });
      const turnosFinales = (tu || []).map((t22) => t22.localId ? t22 : { ...t22, localId: localPorEmpleadoMigracion.get(t22.empleadoId) || localActivoFinal || null });
      const nominasFinales = (nom || []).map((n2) => n2.localId ? n2 : { ...n2, localId: localPorEmpleadoMigracion.get(n2.empleadoId) || localActivoFinal || null });
      const arqueosFinales = (aq || []).map((a22) => a22.localId ? a22 : { ...a22, localId: localActivoFinal || null });
      const movimientosCajaFinales = (mc || []).map((m22) => m22.localId ? m22 : { ...m22, localId: localActivoFinal || null });
      const inferirLocalFichaMigracion = (ficha) => {
        const ids = [...new Set([
          localPorProductoMigracion.get(ficha && ficha.productoVinculadoId),
          ...(ficha && ficha.componentes || []).map((c22) => localPorProductoMigracion.get(c22 && c22.productoId))
        ].filter(Boolean))];
        return ids.length === 1 ? ids[0] : localActivoFinal || null;
      };
      const fichasCostoFinales = (fc || []).map((f22) => f22.localId ? f22 : { ...f22, localId: inferirLocalFichaMigracion(f22) });
      const ordenesProduccionFinales = (op || []).map((o22) => o22.localId ? o22 : { ...o22, localId: localPorProductoMigracion.get(o22.productoVinculadoId) || inferirLocalLineasMigracion(o22.ingredientes) });
      const puntosControlFinales = (pc || []).map((p23) => p23.localId ? p23 : { ...p23, localId: localActivoFinal || null });
      const localPorPuntoMigracion = new Map(puntosControlFinales.map((p23) => [p23.id, p23.localId || localActivoFinal || null]));
      const registrosAppccFinales = (ra || []).map((r2) => r2.localId ? r2 : { ...r2, localId: localPorPuntoMigracion.get(r2.puntoId) || localActivoFinal || null });
      const freidorasFinales = (fre || []).map((f22) => f22.localId ? f22 : { ...f22, localId: localPorProductoMigracion.get(f22.productoAceiteId) || localActivoFinal || null });
      const localPorFreidoraMigracion = new Map(freidorasFinales.map((f22) => [f22.id, f22.localId || localActivoFinal || null]));
      const registrosAceiteFinales = (rac || []).map((r2) => r2.localId ? r2 : { ...r2, localId: localPorFreidoraMigracion.get(r2.freidoraId) |
```

### offset 4035776
```js
== JSON.stringify(ra || [])) await saveKey("registrosAppcc", registrosAppccFinales);
      if (JSON.stringify(freidorasFinales) !== JSON.stringify(fre || [])) await saveKey("freidoras", freidorasFinales);
      if (JSON.stringify(registrosAceiteFinales) !== JSON.stringify(rac || [])) await saveKey("registrosAceite", registrosAceiteFinales);
      setReady(true);
      if (habiaFotos) await saveKey("albaranes", albaranesFinales);
      setTimeout(() => {
        skipSaveRef.current = false;
      }, 400);
      if (!autoSnapshotRef.current) {
        autoSnapshotRef.current = true;
        const tieneDatos = p22.length || pr.length || pe2.length || mo.length || co.length || fc.length || al.length || em.length;
        const hoy = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
        const yaHayUnoDeHoy = hi.some((h22) => h22.automatica && (h22.fecha || "").slice(0, 10) === hoy);
        if (tieneDatos && !yaHayUnoDeHoy) {
          const snapshot = {
            id: uid(),
            fecha: (/* @__PURE__ */ new Date()).toISOString(),
            automatica: true,
            motivo: "automatico-diario",
            backupVersion: 3,
            data: { proveedores: p22, productos: pr, pedidos: pe2, movimientos: mo, conteos: co, fichasCosto: fc, albaranes: alLimpios, catalogoProv: cp, gastosGenerales: gg, empleados: em, fichajes: fj, registrosAppcc: ra, puntosControl: pc, clientes: cl, encargos: en, arqueos: aq, turnos: tu, nominas: nom, facturasDirectas: fd2, ordenesProduccion: op, traspasos: tr, auditoria: au, freidoras: fre, registrosAceite: rac }
          };
          const historialFinal = [snapshot, ...hi].slice(0, 30);
          setHistorial(historialFinal);
          await saveKey("historialRespaldos", historialFinal);
        }
      }
    })();
  }, []);
  (0, import_react4.useEffect)(() => {
    if (ready && !skipSaveRef.current) saveKey("proveedores", proveedores);
  }, [proveedores, ready]);
  (0, import_react4.useEffect)(() => {
    if (ready && !skipSaveRef.current) saveKey("productos", productos);
  }, [productos, ready]);
  (0, import_react4.useEffect)(() => {
    if (ready && !skipSaveRef.current) saveKey("pedidos", pedidos2);
  }, [pedidos2, ready]);
  (0, import_react4.useEffect)(() => {
    if (ready && !skipSaveRef.current) saveKey("movimientos", movimientos);
  }, [movimientos, ready]);
  (0, import_react4.useEffect)(() => {
    if (ready && !skipSaveRef.current) saveKey("conteos", conteos);
  }, [conteos, ready]);
  (0, import_react4.useEffect)(() => {
    if (ready && !skipSaveRef.current) saveKey("fichasCosto", fichasCosto);
  }, [fichasCosto, ready]);
  (0, import_react4.useEffect)(() => {
    if (ready && !skipSaveRef.current) saveKey("historialRespaldos", historial);
  }, [historial, ready]);
  (0, import_react4.useEffect)(() => {
    if (ready && !skipSaveRef.current) saveKey("albaranes", albaranes);
  }, [albaranes, ready]);
  (0, import_react4.useEffect)(() => {
    if (ready && !skipSaveRef.current) saveKey("catalogoProv", catalogoProv);
  }, [catalogoProv, ready]);
  (0, import_react4.useEffect)(() => {
    if (ready && !skipSaveRef.current) saveKey("gastosGenerales", gastosGenerales);
  }, [gastosGenerales, ready]);
  (0, import_react4.useEffect)(() => {
    if (ready && !skipSaveRef.current) saveKey("empleados", empleados);
  }, [empleados, ready]);
  (0, import_react4.useEffect)(() => {
    if (ready && !skipSaveRef.current) saveKey("fichajes", fichajes);
  }, [fichajes, ready]);
  (0, import_react4.useEffect)(() => {
    if (ready && !skipSaveRef.current) saveKey("disenoMenu", disenoMenu);
  }, [disenoMenu, ready]);
  (0, import_react4.useEffect)(() => {
    if (ready && !skipSaveRef.current) saveKey("registrosAppcc", registrosAppcc);
  }, [registrosAppcc, ready]);
  (0, import_react4.useEffect)(() => {
    if (ready && !skipSaveRef.current) saveKey("freidoras", freidoras);
  }, [freidoras, ready]);
  (0, import_react4.useEffect)(() => {
    if (ready && !skipSaveRef.current) saveKey("registrosAceite", registrosAceite);
  }, [registrosAceite, ready]);
  (0, import_react4.useEffect)(() => {
    if (ready && !skipSaveRef.current) saveKey("puntosControl", puntosControl);
  }, [puntosControl, ready]);
  (0, import_react4.useEffect)(() => {
    if (ready && !skipSaveRef.current) saveKey("clientes", clientes);
  }, [clientes, ready]);
  (0, import_react4.useEffect)(() => {
    if (ready && !skipSaveRef.current) saveKey("encargos", encargos);
  }, [encargos, ready]);
  (0, import_react4.useEffect)(() => {
    if (ready && !skipSaveRef.current) saveKey("arqueos", arqueos);
  }, [arqueos, ready]);
  (0, import_react4.useEffect)(() => {
    if (ready && !skipSaveRef.current) saveKey("movimientosCaja", movimientosCaja);
  }, [movimientosCaja, ready]);
  (0, import_react4.useEffect)(() => {
    if (ready && !skipSaveRef.current) saveKey("devoluciones", devoluciones);
  }, [devoluciones, ready]);
  (0, import_react4.useEffect)(() => {
    if (ready && !skipSaveRef.current) saveKey("locales", locales);
  }, [locales, ready]);
  (0, import_react4.useEffect)(() => {
    if (ready && !skipSaveRef.current) saveKey("empresas", empresas);
  }, [empresas, ready]);
  (0, import_react4.useEffect)(() => {
    if (ready && !skipSaveRef.current) saveKey("configEmpresa", configEmpresa);
  }, [configEmpresa, ready]);
  (0, import_react4.useEffect)(() => {
    if (ready && !skipSaveRef.current) saveKey("localActivoId", localActivoId);
  }, [localActivoId, ready]);
  (0, import_react4.useEffect)(() => {
    if (ready && !skipSaveRef.current) saveKey("turnos", turnos);
  }, [turnos, ready]);
  (0, import_react4.useEffect)(() => {
    if (ready && !skipSaveRef.current) saveKey
```

### offset 4095812
```js
tock.filter((d2) => localEsDeEmpresaInforme(localPorProductoInforme.get(d2.productoId)));
  const addGastoInforme = (data) => addGasto({ ...data, localId: localInformeId || localActivoId || null });
  const deleteGastoInforme = (id) => deleteGasto(id, localInformeId || localActivoId || null);
  const contenido = /* @__PURE__ */ import_react4.default.createElement(import_react4.default.Fragment, null, (tab === "dashboard" || tab === "resultados" || tab === "libroiva") && /* @__PURE__ */ import_react4.default.createElement(SelectorLocalInformes, { locales: localesEmpresaActiva, valor: localInformeId, onChange: seleccionarContextoLocal }), tab === "dashboard" && /* @__PURE__ */ import_react4.default.createElement(
    Dashboard,
    {
      itemsPermitidos: typeof window !== "undefined" && window.__nubeActiva ? miPerfil?.rol === "Propietario" ? null : itemsPermitidosEmpleado : modoEmpleado ? itemsPermitidosEmpleado : null,
      valorInventario: valorInventarioInforme,
      valorUtillaje: valorUtillajeInforme,
      stockBajo: stockBajoInforme,
      pedidosPendientes: pedidosPendientesInforme,
      margenPromedio: margenPromedioInforme,
      movimientos: movimientosInforme,
      productos: productosInforme,
      caducanPronto: caducanProntoInforme,
      proveedorPorId,
      vencenPronto: vencenProntoInforme,
      totalPendientePago: totalPendientePagoInforme,
      documentosPersonalPronto: documentosPersonalProntoInforme,
      fichajesAbiertos: fichajesAbiertosInforme,
      encargosUrgentes: encargosUrgentesInforme,
      pisoVentaBajo: pisoVentaBajoInforme,
      sugerenciasPedido: sugerenciasPedidoInforme,
      setTab,
      recordatorioConteo: recordatorioConteoInforme,
      alertasAppcc,
      fallosGuardado,
      diagnosticoStock: diagnosticoStockInforme,
      registrarSalida
    }
  ), tab === "direccion" && /* @__PURE__ */ import_react4.default.createElement(
    PanelDireccion,
    {
      movimientos,
      gastosGenerales,
      nominas,
      empleados,
      promedioDiarioVentas,
      proyeccionTesoreria,
      stockBajo,
      descuadresStock: diagnosticoStock.filter((d2) => !d2.coincide)
    }
  ), tab === "proveedores" && /* @__PURE__ */ import_react4.default.createElement(Proveedores, { proveedores, addProveedor, updateProveedor, deleteProveedor, pedidos: pedidos2 }), tab === "productos" && /* @__PURE__ */ import_react4.default.createElement(
    Productos,
    {
      productos: productosDelLocalActivo,
      proveedores,
      proveedorPorId,
      addProducto,
      updateProducto,
      deleteProducto,
      reactivarProducto,
      registrarSalida,
      clasificacionABC: clasificacionABCDelLocalActivo,
      almacenCongelado,
      movimientos: movimientosDelLocalActivo,
      fichasCosto: fichasCostoDelLocalActivo,
      updateFichaCosto,
      ajustarProductoPorOtro
    }
  ), tab === "historial_producto" && /* @__PURE__ */ import_react4.default.createElement(
    HistorialProducto,
    {
      productos: productosDelLocalActivo,
      movimientos: movimientosDelLocalActivo,
      pedidos: pedidosDelLocalActivo,
      albaranes: albaranesDelLocalActivo,
      traspasos: traspasosDelLocalActivo,
      proveedorPorId
    }
  ), tab === "aceite" && /* @__PURE__ */ import_react4.default.createElement(
    AceiteFreidoras,
    {
      freidoras: freidorasDelLocalActivo,
      registrosAceite: registrosAceiteDelLocalActivo,
      productos: productosDelLocalActivo,
      addFreidora,
      updateFreidora,
      deleteFreidora,
      registrarCambio,
      registrarRelleno,
      eliminarRegistroAceite,
      consumoPorCiclo
    }
  ), tab === "buscar" && /* @__PURE__ */ import_react4.default.createElement(BusquedaGlobal, { productos: productosDelLocalActivo, proveedores, clientes, fichasCosto: fichasCostoDelLocalActivo, empleados: empleadosDelLocalActivo, setTab }), tab === "pedidos" && /* @__PURE__ */ import_react4.default.createElement(
    Pedidos,
    {
      pedidos: pedidosDelLocalActivo,
      proveedores,
      productos: productosDelLocalActivo,
      crearPedido,
      actualizarPedido,
      eliminarPedido,
      proveedorPorId,
      productoPorId: (id) => productosDelLocalActivo.find((p22) => p22.id === id),
      sugerenciasPedido: sugerenciasPedidoDelLocalActivo,
      addProducto
    }
  ), tab === "recepcion" && /* @__PURE__ */ import_react4.default.createElement(Recepcion, { pedidos: pedidosDelLocalActivo, proveedorPorId, productoPorId: (id) => productosDelLocalActivo.find((p22) => p22.id === id), recibirPedido, almacenCongelado, recibirConAlbaran, recibirConFotoIA, cerrarPedido }), tab === "conteo" && /* @__PURE__ */ import_react4.default.createElement(
    InventarioCiego,
    {
      productos: productosDelLocalActivo,
      proveedores,
      conteos: conteosDelLocalActivo,
      iniciarConteo,
      actualizarConteoItem,
      actualizarResponsable,
      finalizarConteo,
      aplicarAjustes,
      eliminarConteo,
      revertirUltimaAplicacion,
      productoPorId: (id) => productosDelLocalActivo.find((p22) => p22.id === id),
      crearProductoEnConteo,
      clasificacionABC: clasificacionABCDelLocalActivo,
      almacenCongelado
    }
  ), tab === "reportes" && /* @__PURE__ */ import_react4.default.createElement(
    Reportes,
    {
      rotacionPorProducto: rotacionPorProductoDelLocalActivo,
      gastoPorProveedor: gastoPorProveedorDelLocalActivo,
      productosSinMovimiento: productosSinMovimientoDelLocalActivo,
      valorInventario: valorInventarioDelLocalActivo,
      margenPorProducto: margenPorProductoDelLocalActivo,
      patronesDesviacionConteo: patronesDesviacionConteoDelLocalActivo
    }
  ), tab === "resultados" && /* 
```

### offset 4097054
```js
Pronto: caducanProntoInforme,
      proveedorPorId,
      vencenPronto: vencenProntoInforme,
      totalPendientePago: totalPendientePagoInforme,
      documentosPersonalPronto: documentosPersonalProntoInforme,
      fichajesAbiertos: fichajesAbiertosInforme,
      encargosUrgentes: encargosUrgentesInforme,
      pisoVentaBajo: pisoVentaBajoInforme,
      sugerenciasPedido: sugerenciasPedidoInforme,
      setTab,
      recordatorioConteo: recordatorioConteoInforme,
      alertasAppcc,
      fallosGuardado,
      diagnosticoStock: diagnosticoStockInforme,
      registrarSalida
    }
  ), tab === "direccion" && /* @__PURE__ */ import_react4.default.createElement(
    PanelDireccion,
    {
      movimientos,
      gastosGenerales,
      nominas,
      empleados,
      promedioDiarioVentas,
      proyeccionTesoreria,
      stockBajo,
      descuadresStock: diagnosticoStock.filter((d2) => !d2.coincide)
    }
  ), tab === "proveedores" && /* @__PURE__ */ import_react4.default.createElement(Proveedores, { proveedores, addProveedor, updateProveedor, deleteProveedor, pedidos: pedidos2 }), tab === "productos" && /* @__PURE__ */ import_react4.default.createElement(
    Productos,
    {
      productos: productosDelLocalActivo,
      proveedores,
      proveedorPorId,
      addProducto,
      updateProducto,
      deleteProducto,
      reactivarProducto,
      registrarSalida,
      clasificacionABC: clasificacionABCDelLocalActivo,
      almacenCongelado,
      movimientos: movimientosDelLocalActivo,
      fichasCosto: fichasCostoDelLocalActivo,
      updateFichaCosto,
      ajustarProductoPorOtro
    }
  ), tab === "historial_producto" && /* @__PURE__ */ import_react4.default.createElement(
    HistorialProducto,
    {
      productos: productosDelLocalActivo,
      movimientos: movimientosDelLocalActivo,
      pedidos: pedidosDelLocalActivo,
      albaranes: albaranesDelLocalActivo,
      traspasos: traspasosDelLocalActivo,
      proveedorPorId
    }
  ), tab === "aceite" && /* @__PURE__ */ import_react4.default.createElement(
    AceiteFreidoras,
    {
      freidoras: freidorasDelLocalActivo,
      registrosAceite: registrosAceiteDelLocalActivo,
      productos: productosDelLocalActivo,
      addFreidora,
      updateFreidora,
      deleteFreidora,
      registrarCambio,
      registrarRelleno,
      eliminarRegistroAceite,
      consumoPorCiclo
    }
  ), tab === "buscar" && /* @__PURE__ */ import_react4.default.createElement(BusquedaGlobal, { productos: productosDelLocalActivo, proveedores, clientes, fichasCosto: fichasCostoDelLocalActivo, empleados: empleadosDelLocalActivo, setTab }), tab === "pedidos" && /* @__PURE__ */ import_react4.default.createElement(
    Pedidos,
    {
      pedidos: pedidosDelLocalActivo,
      proveedores,
      productos: productosDelLocalActivo,
      crearPedido,
      actualizarPedido,
      eliminarPedido,
      proveedorPorId,
      productoPorId: (id) => productosDelLocalActivo.find((p22) => p22.id === id),
      sugerenciasPedido: sugerenciasPedidoDelLocalActivo,
      addProducto
    }
  ), tab === "recepcion" && /* @__PURE__ */ import_react4.default.createElement(Recepcion, { pedidos: pedidosDelLocalActivo, proveedorPorId, productoPorId: (id) => productosDelLocalActivo.find((p22) => p22.id === id), recibirPedido, almacenCongelado, recibirConAlbaran, recibirConFotoIA, cerrarPedido }), tab === "conteo" && /* @__PURE__ */ import_react4.default.createElement(
    InventarioCiego,
    {
      productos: productosDelLocalActivo,
      proveedores,
      conteos: conteosDelLocalActivo,
      iniciarConteo,
      actualizarConteoItem,
      actualizarResponsable,
      finalizarConteo,
      aplicarAjustes,
      eliminarConteo,
      revertirUltimaAplicacion,
      productoPorId: (id) => productosDelLocalActivo.find((p22) => p22.id === id),
      crearProductoEnConteo,
      clasificacionABC: clasificacionABCDelLocalActivo,
      almacenCongelado
    }
  ), tab === "reportes" && /* @__PURE__ */ import_react4.default.createElement(
    Reportes,
    {
      rotacionPorProducto: rotacionPorProductoDelLocalActivo,
      gastoPorProveedor: gastoPorProveedorDelLocalActivo,
      productosSinMovimiento: productosSinMovimientoDelLocalActivo,
      valorInventario: valorInventarioDelLocalActivo,
      margenPorProducto: margenPorProductoDelLocalActivo,
      patronesDesviacionConteo: patronesDesviacionConteoDelLocalActivo
    }
  ), tab === "resultados" && /* @__PURE__ */ import_react4.default.createElement(
    Resultados,
    {
      movimientos: movimientosInforme,
      productos: productosInforme,
      productoPorId: (id) => productosInforme.find((p22) => p22.id === id),
      gastosGenerales: gastosGeneralesInforme,
      addGasto: addGastoInforme,
      deleteGasto: deleteGastoInforme,
      empleados: empleadosInforme
    }
  ), tab === "fichas" && /* @__PURE__ */ import_react4.default.createElement(
    FichasCosto,
    {
      fichasCosto: fichasCostoDelLocalActivo,
      productos: productosDelLocalActivo,
      addFichaCosto,
      updateFichaCosto,
      deleteFichaCosto,
      updateProducto,
      addProducto,
      ordenesProduccion: ordenesProduccionDelLocalActivo,
      nominas,
      fichajes
    }
  ), tab === "produccion" && /* @__PURE__ */ import_react4.default.createElement(Produccion, { fichasCosto: fichasCostoDelLocalActivo, productos: productosDelLocalActivo, ordenesProduccion: ordenesProduccionDelLocalActivo, producir, anularProduccion, traspasarStock }), tab === "mermas" && /* @__PURE__ */ import_react4.default.createElement(Mermas, { productos: productosDelLocalActivo, movimientos: movimientosDelLocalActivo, registrarSalida, almacenCongelado }), ta
```

### offset 4097598
```js
icoStockInforme,
      registrarSalida
    }
  ), tab === "direccion" && /* @__PURE__ */ import_react4.default.createElement(
    PanelDireccion,
    {
      movimientos,
      gastosGenerales,
      nominas,
      empleados,
      promedioDiarioVentas,
      proyeccionTesoreria,
      stockBajo,
      descuadresStock: diagnosticoStock.filter((d2) => !d2.coincide)
    }
  ), tab === "proveedores" && /* @__PURE__ */ import_react4.default.createElement(Proveedores, { proveedores, addProveedor, updateProveedor, deleteProveedor, pedidos: pedidos2 }), tab === "productos" && /* @__PURE__ */ import_react4.default.createElement(
    Productos,
    {
      productos: productosDelLocalActivo,
      proveedores,
      proveedorPorId,
      addProducto,
      updateProducto,
      deleteProducto,
      reactivarProducto,
      registrarSalida,
      clasificacionABC: clasificacionABCDelLocalActivo,
      almacenCongelado,
      movimientos: movimientosDelLocalActivo,
      fichasCosto: fichasCostoDelLocalActivo,
      updateFichaCosto,
      ajustarProductoPorOtro
    }
  ), tab === "historial_producto" && /* @__PURE__ */ import_react4.default.createElement(
    HistorialProducto,
    {
      productos: productosDelLocalActivo,
      movimientos: movimientosDelLocalActivo,
      pedidos: pedidosDelLocalActivo,
      albaranes: albaranesDelLocalActivo,
      traspasos: traspasosDelLocalActivo,
      proveedorPorId
    }
  ), tab === "aceite" && /* @__PURE__ */ import_react4.default.createElement(
    AceiteFreidoras,
    {
      freidoras: freidorasDelLocalActivo,
      registrosAceite: registrosAceiteDelLocalActivo,
      productos: productosDelLocalActivo,
      addFreidora,
      updateFreidora,
      deleteFreidora,
      registrarCambio,
      registrarRelleno,
      eliminarRegistroAceite,
      consumoPorCiclo
    }
  ), tab === "buscar" && /* @__PURE__ */ import_react4.default.createElement(BusquedaGlobal, { productos: productosDelLocalActivo, proveedores, clientes, fichasCosto: fichasCostoDelLocalActivo, empleados: empleadosDelLocalActivo, setTab }), tab === "pedidos" && /* @__PURE__ */ import_react4.default.createElement(
    Pedidos,
    {
      pedidos: pedidosDelLocalActivo,
      proveedores,
      productos: productosDelLocalActivo,
      crearPedido,
      actualizarPedido,
      eliminarPedido,
      proveedorPorId,
      productoPorId: (id) => productosDelLocalActivo.find((p22) => p22.id === id),
      sugerenciasPedido: sugerenciasPedidoDelLocalActivo,
      addProducto
    }
  ), tab === "recepcion" && /* @__PURE__ */ import_react4.default.createElement(Recepcion, { pedidos: pedidosDelLocalActivo, proveedorPorId, productoPorId: (id) => productosDelLocalActivo.find((p22) => p22.id === id), recibirPedido, almacenCongelado, recibirConAlbaran, recibirConFotoIA, cerrarPedido }), tab === "conteo" && /* @__PURE__ */ import_react4.default.createElement(
    InventarioCiego,
    {
      productos: productosDelLocalActivo,
      proveedores,
      conteos: conteosDelLocalActivo,
      iniciarConteo,
      actualizarConteoItem,
      actualizarResponsable,
      finalizarConteo,
      aplicarAjustes,
      eliminarConteo,
      revertirUltimaAplicacion,
      productoPorId: (id) => productosDelLocalActivo.find((p22) => p22.id === id),
      crearProductoEnConteo,
      clasificacionABC: clasificacionABCDelLocalActivo,
      almacenCongelado
    }
  ), tab === "reportes" && /* @__PURE__ */ import_react4.default.createElement(
    Reportes,
    {
      rotacionPorProducto: rotacionPorProductoDelLocalActivo,
      gastoPorProveedor: gastoPorProveedorDelLocalActivo,
      productosSinMovimiento: productosSinMovimientoDelLocalActivo,
      valorInventario: valorInventarioDelLocalActivo,
      margenPorProducto: margenPorProductoDelLocalActivo,
      patronesDesviacionConteo: patronesDesviacionConteoDelLocalActivo
    }
  ), tab === "resultados" && /* @__PURE__ */ import_react4.default.createElement(
    Resultados,
    {
      movimientos: movimientosInforme,
      productos: productosInforme,
      productoPorId: (id) => productosInforme.find((p22) => p22.id === id),
      gastosGenerales: gastosGeneralesInforme,
      addGasto: addGastoInforme,
      deleteGasto: deleteGastoInforme,
      empleados: empleadosInforme
    }
  ), tab === "fichas" && /* @__PURE__ */ import_react4.default.createElement(
    FichasCosto,
    {
      fichasCosto: fichasCostoDelLocalActivo,
      productos: productosDelLocalActivo,
      addFichaCosto,
      updateFichaCosto,
      deleteFichaCosto,
      updateProducto,
      addProducto,
      ordenesProduccion: ordenesProduccionDelLocalActivo,
      nominas,
      fichajes
    }
  ), tab === "produccion" && /* @__PURE__ */ import_react4.default.createElement(Produccion, { fichasCosto: fichasCostoDelLocalActivo, productos: productosDelLocalActivo, ordenesProduccion: ordenesProduccionDelLocalActivo, producir, anularProduccion, traspasarStock }), tab === "mermas" && /* @__PURE__ */ import_react4.default.createElement(Mermas, { productos: productosDelLocalActivo, movimientos: movimientosDelLocalActivo, registrarSalida, almacenCongelado }), tab === "etiquetas" && /* @__PURE__ */ import_react4.default.createElement(EtiquetasCatalogo, { productos: productosDelLocalActivo, fichasCosto: fichasCostoDelLocalActivo, alergenosDeFicha }), tab === "albaranes" && /* @__PURE__ */ import_react4.default.createElement(
    Albaranes,
    {
      albaranes: albaranesDelLocalActivo,
      proveedores,
      productos: productosDelLocalActivo,
      proveedorPorId,
      buscarEnCatalogo,
      guardarAlbaran,
      eliminarAlbaran,
      confirmarAlbaran,
      anularAlbaran,
      marcarPagad
```

### offset 4098036
```js
lt.createElement(Proveedores, { proveedores, addProveedor, updateProveedor, deleteProveedor, pedidos: pedidos2 }), tab === "productos" && /* @__PURE__ */ import_react4.default.createElement(
    Productos,
    {
      productos: productosDelLocalActivo,
      proveedores,
      proveedorPorId,
      addProducto,
      updateProducto,
      deleteProducto,
      reactivarProducto,
      registrarSalida,
      clasificacionABC: clasificacionABCDelLocalActivo,
      almacenCongelado,
      movimientos: movimientosDelLocalActivo,
      fichasCosto: fichasCostoDelLocalActivo,
      updateFichaCosto,
      ajustarProductoPorOtro
    }
  ), tab === "historial_producto" && /* @__PURE__ */ import_react4.default.createElement(
    HistorialProducto,
    {
      productos: productosDelLocalActivo,
      movimientos: movimientosDelLocalActivo,
      pedidos: pedidosDelLocalActivo,
      albaranes: albaranesDelLocalActivo,
      traspasos: traspasosDelLocalActivo,
      proveedorPorId
    }
  ), tab === "aceite" && /* @__PURE__ */ import_react4.default.createElement(
    AceiteFreidoras,
    {
      freidoras: freidorasDelLocalActivo,
      registrosAceite: registrosAceiteDelLocalActivo,
      productos: productosDelLocalActivo,
      addFreidora,
      updateFreidora,
      deleteFreidora,
      registrarCambio,
      registrarRelleno,
      eliminarRegistroAceite,
      consumoPorCiclo
    }
  ), tab === "buscar" && /* @__PURE__ */ import_react4.default.createElement(BusquedaGlobal, { productos: productosDelLocalActivo, proveedores, clientes, fichasCosto: fichasCostoDelLocalActivo, empleados: empleadosDelLocalActivo, setTab }), tab === "pedidos" && /* @__PURE__ */ import_react4.default.createElement(
    Pedidos,
    {
      pedidos: pedidosDelLocalActivo,
      proveedores,
      productos: productosDelLocalActivo,
      crearPedido,
      actualizarPedido,
      eliminarPedido,
      proveedorPorId,
      productoPorId: (id) => productosDelLocalActivo.find((p22) => p22.id === id),
      sugerenciasPedido: sugerenciasPedidoDelLocalActivo,
      addProducto
    }
  ), tab === "recepcion" && /* @__PURE__ */ import_react4.default.createElement(Recepcion, { pedidos: pedidosDelLocalActivo, proveedorPorId, productoPorId: (id) => productosDelLocalActivo.find((p22) => p22.id === id), recibirPedido, almacenCongelado, recibirConAlbaran, recibirConFotoIA, cerrarPedido }), tab === "conteo" && /* @__PURE__ */ import_react4.default.createElement(
    InventarioCiego,
    {
      productos: productosDelLocalActivo,
      proveedores,
      conteos: conteosDelLocalActivo,
      iniciarConteo,
      actualizarConteoItem,
      actualizarResponsable,
      finalizarConteo,
      aplicarAjustes,
      eliminarConteo,
      revertirUltimaAplicacion,
      productoPorId: (id) => productosDelLocalActivo.find((p22) => p22.id === id),
      crearProductoEnConteo,
      clasificacionABC: clasificacionABCDelLocalActivo,
      almacenCongelado
    }
  ), tab === "reportes" && /* @__PURE__ */ import_react4.default.createElement(
    Reportes,
    {
      rotacionPorProducto: rotacionPorProductoDelLocalActivo,
      gastoPorProveedor: gastoPorProveedorDelLocalActivo,
      productosSinMovimiento: productosSinMovimientoDelLocalActivo,
      valorInventario: valorInventarioDelLocalActivo,
      margenPorProducto: margenPorProductoDelLocalActivo,
      patronesDesviacionConteo: patronesDesviacionConteoDelLocalActivo
    }
  ), tab === "resultados" && /* @__PURE__ */ import_react4.default.createElement(
    Resultados,
    {
      movimientos: movimientosInforme,
      productos: productosInforme,
      productoPorId: (id) => productosInforme.find((p22) => p22.id === id),
      gastosGenerales: gastosGeneralesInforme,
      addGasto: addGastoInforme,
      deleteGasto: deleteGastoInforme,
      empleados: empleadosInforme
    }
  ), tab === "fichas" && /* @__PURE__ */ import_react4.default.createElement(
    FichasCosto,
    {
      fichasCosto: fichasCostoDelLocalActivo,
      productos: productosDelLocalActivo,
      addFichaCosto,
      updateFichaCosto,
      deleteFichaCosto,
      updateProducto,
      addProducto,
      ordenesProduccion: ordenesProduccionDelLocalActivo,
      nominas,
      fichajes
    }
  ), tab === "produccion" && /* @__PURE__ */ import_react4.default.createElement(Produccion, { fichasCosto: fichasCostoDelLocalActivo, productos: productosDelLocalActivo, ordenesProduccion: ordenesProduccionDelLocalActivo, producir, anularProduccion, traspasarStock }), tab === "mermas" && /* @__PURE__ */ import_react4.default.createElement(Mermas, { productos: productosDelLocalActivo, movimientos: movimientosDelLocalActivo, registrarSalida, almacenCongelado }), tab === "etiquetas" && /* @__PURE__ */ import_react4.default.createElement(EtiquetasCatalogo, { productos: productosDelLocalActivo, fichasCosto: fichasCostoDelLocalActivo, alergenosDeFicha }), tab === "albaranes" && /* @__PURE__ */ import_react4.default.createElement(
    Albaranes,
    {
      albaranes: albaranesDelLocalActivo,
      proveedores,
      productos: productosDelLocalActivo,
      proveedorPorId,
      buscarEnCatalogo,
      guardarAlbaran,
      eliminarAlbaran,
      confirmarAlbaran,
      anularAlbaran,
      marcarPagada,
      duplicadosDe,
      desviacionesDePrecio,
      prefill: prefillAlbaran,
      limpiarPrefill: () => setPrefillAlbaran(null),
      pedidoParaFotoIA,
      limpiarPedidoParaFotoIA: () => setPedidoParaFotoIA(null),
      pedidos: pedidosDelLocalActivo
    }
  ), tab === "pagos" && /* @__PURE__ */ import_react4.default.createElement(
    CuentasPorPagar,
    {
      facturasPorPagar: facturasPorPagarDelLocalActivo,
      totalP
```

### offset 4098335
```js
  addProducto,
      updateProducto,
      deleteProducto,
      reactivarProducto,
      registrarSalida,
      clasificacionABC: clasificacionABCDelLocalActivo,
      almacenCongelado,
      movimientos: movimientosDelLocalActivo,
      fichasCosto: fichasCostoDelLocalActivo,
      updateFichaCosto,
      ajustarProductoPorOtro
    }
  ), tab === "historial_producto" && /* @__PURE__ */ import_react4.default.createElement(
    HistorialProducto,
    {
      productos: productosDelLocalActivo,
      movimientos: movimientosDelLocalActivo,
      pedidos: pedidosDelLocalActivo,
      albaranes: albaranesDelLocalActivo,
      traspasos: traspasosDelLocalActivo,
      proveedorPorId
    }
  ), tab === "aceite" && /* @__PURE__ */ import_react4.default.createElement(
    AceiteFreidoras,
    {
      freidoras: freidorasDelLocalActivo,
      registrosAceite: registrosAceiteDelLocalActivo,
      productos: productosDelLocalActivo,
      addFreidora,
      updateFreidora,
      deleteFreidora,
      registrarCambio,
      registrarRelleno,
      eliminarRegistroAceite,
      consumoPorCiclo
    }
  ), tab === "buscar" && /* @__PURE__ */ import_react4.default.createElement(BusquedaGlobal, { productos: productosDelLocalActivo, proveedores, clientes, fichasCosto: fichasCostoDelLocalActivo, empleados: empleadosDelLocalActivo, setTab }), tab === "pedidos" && /* @__PURE__ */ import_react4.default.createElement(
    Pedidos,
    {
      pedidos: pedidosDelLocalActivo,
      proveedores,
      productos: productosDelLocalActivo,
      crearPedido,
      actualizarPedido,
      eliminarPedido,
      proveedorPorId,
      productoPorId: (id) => productosDelLocalActivo.find((p22) => p22.id === id),
      sugerenciasPedido: sugerenciasPedidoDelLocalActivo,
      addProducto
    }
  ), tab === "recepcion" && /* @__PURE__ */ import_react4.default.createElement(Recepcion, { pedidos: pedidosDelLocalActivo, proveedorPorId, productoPorId: (id) => productosDelLocalActivo.find((p22) => p22.id === id), recibirPedido, almacenCongelado, recibirConAlbaran, recibirConFotoIA, cerrarPedido }), tab === "conteo" && /* @__PURE__ */ import_react4.default.createElement(
    InventarioCiego,
    {
      productos: productosDelLocalActivo,
      proveedores,
      conteos: conteosDelLocalActivo,
      iniciarConteo,
      actualizarConteoItem,
      actualizarResponsable,
      finalizarConteo,
      aplicarAjustes,
      eliminarConteo,
      revertirUltimaAplicacion,
      productoPorId: (id) => productosDelLocalActivo.find((p22) => p22.id === id),
      crearProductoEnConteo,
      clasificacionABC: clasificacionABCDelLocalActivo,
      almacenCongelado
    }
  ), tab === "reportes" && /* @__PURE__ */ import_react4.default.createElement(
    Reportes,
    {
      rotacionPorProducto: rotacionPorProductoDelLocalActivo,
      gastoPorProveedor: gastoPorProveedorDelLocalActivo,
      productosSinMovimiento: productosSinMovimientoDelLocalActivo,
      valorInventario: valorInventarioDelLocalActivo,
      margenPorProducto: margenPorProductoDelLocalActivo,
      patronesDesviacionConteo: patronesDesviacionConteoDelLocalActivo
    }
  ), tab === "resultados" && /* @__PURE__ */ import_react4.default.createElement(
    Resultados,
    {
      movimientos: movimientosInforme,
      productos: productosInforme,
      productoPorId: (id) => productosInforme.find((p22) => p22.id === id),
      gastosGenerales: gastosGeneralesInforme,
      addGasto: addGastoInforme,
      deleteGasto: deleteGastoInforme,
      empleados: empleadosInforme
    }
  ), tab === "fichas" && /* @__PURE__ */ import_react4.default.createElement(
    FichasCosto,
    {
      fichasCosto: fichasCostoDelLocalActivo,
      productos: productosDelLocalActivo,
      addFichaCosto,
      updateFichaCosto,
      deleteFichaCosto,
      updateProducto,
      addProducto,
      ordenesProduccion: ordenesProduccionDelLocalActivo,
      nominas,
      fichajes
    }
  ), tab === "produccion" && /* @__PURE__ */ import_react4.default.createElement(Produccion, { fichasCosto: fichasCostoDelLocalActivo, productos: productosDelLocalActivo, ordenesProduccion: ordenesProduccionDelLocalActivo, producir, anularProduccion, traspasarStock }), tab === "mermas" && /* @__PURE__ */ import_react4.default.createElement(Mermas, { productos: productosDelLocalActivo, movimientos: movimientosDelLocalActivo, registrarSalida, almacenCongelado }), tab === "etiquetas" && /* @__PURE__ */ import_react4.default.createElement(EtiquetasCatalogo, { productos: productosDelLocalActivo, fichasCosto: fichasCostoDelLocalActivo, alergenosDeFicha }), tab === "albaranes" && /* @__PURE__ */ import_react4.default.createElement(
    Albaranes,
    {
      albaranes: albaranesDelLocalActivo,
      proveedores,
      productos: productosDelLocalActivo,
      proveedorPorId,
      buscarEnCatalogo,
      guardarAlbaran,
      eliminarAlbaran,
      confirmarAlbaran,
      anularAlbaran,
      marcarPagada,
      duplicadosDe,
      desviacionesDePrecio,
      prefill: prefillAlbaran,
      limpiarPrefill: () => setPrefillAlbaran(null),
      pedidoParaFotoIA,
      limpiarPedidoParaFotoIA: () => setPedidoParaFotoIA(null),
      pedidos: pedidosDelLocalActivo
    }
  ), tab === "pagos" && /* @__PURE__ */ import_react4.default.createElement(
    CuentasPorPagar,
    {
      facturasPorPagar: facturasPorPagarDelLocalActivo,
      totalPendientePago: totalPendientePagoDelLocalActivo,
      marcarPagada,
      marcarPagadaFacturaDirecta,
      addFacturaDirecta,
      deleteFacturaDirecta,
      proveedores,
      resaltadaId: facturaDirectaResaltada,
      limpiarResaltada: () => setFacturaDirectaResaltada(null)
    }
  ), tab ===
```

### offset 4098637
```js

      ajustarProductoPorOtro
    }
  ), tab === "historial_producto" && /* @__PURE__ */ import_react4.default.createElement(
    HistorialProducto,
    {
      productos: productosDelLocalActivo,
      movimientos: movimientosDelLocalActivo,
      pedidos: pedidosDelLocalActivo,
      albaranes: albaranesDelLocalActivo,
      traspasos: traspasosDelLocalActivo,
      proveedorPorId
    }
  ), tab === "aceite" && /* @__PURE__ */ import_react4.default.createElement(
    AceiteFreidoras,
    {
      freidoras: freidorasDelLocalActivo,
      registrosAceite: registrosAceiteDelLocalActivo,
      productos: productosDelLocalActivo,
      addFreidora,
      updateFreidora,
      deleteFreidora,
      registrarCambio,
      registrarRelleno,
      eliminarRegistroAceite,
      consumoPorCiclo
    }
  ), tab === "buscar" && /* @__PURE__ */ import_react4.default.createElement(BusquedaGlobal, { productos: productosDelLocalActivo, proveedores, clientes, fichasCosto: fichasCostoDelLocalActivo, empleados: empleadosDelLocalActivo, setTab }), tab === "pedidos" && /* @__PURE__ */ import_react4.default.createElement(
    Pedidos,
    {
      pedidos: pedidosDelLocalActivo,
      proveedores,
      productos: productosDelLocalActivo,
      crearPedido,
      actualizarPedido,
      eliminarPedido,
      proveedorPorId,
      productoPorId: (id) => productosDelLocalActivo.find((p22) => p22.id === id),
      sugerenciasPedido: sugerenciasPedidoDelLocalActivo,
      addProducto
    }
  ), tab === "recepcion" && /* @__PURE__ */ import_react4.default.createElement(Recepcion, { pedidos: pedidosDelLocalActivo, proveedorPorId, productoPorId: (id) => productosDelLocalActivo.find((p22) => p22.id === id), recibirPedido, almacenCongelado, recibirConAlbaran, recibirConFotoIA, cerrarPedido }), tab === "conteo" && /* @__PURE__ */ import_react4.default.createElement(
    InventarioCiego,
    {
      productos: productosDelLocalActivo,
      proveedores,
      conteos: conteosDelLocalActivo,
      iniciarConteo,
      actualizarConteoItem,
      actualizarResponsable,
      finalizarConteo,
      aplicarAjustes,
      eliminarConteo,
      revertirUltimaAplicacion,
      productoPorId: (id) => productosDelLocalActivo.find((p22) => p22.id === id),
      crearProductoEnConteo,
      clasificacionABC: clasificacionABCDelLocalActivo,
      almacenCongelado
    }
  ), tab === "reportes" && /* @__PURE__ */ import_react4.default.createElement(
    Reportes,
    {
      rotacionPorProducto: rotacionPorProductoDelLocalActivo,
      gastoPorProveedor: gastoPorProveedorDelLocalActivo,
      productosSinMovimiento: productosSinMovimientoDelLocalActivo,
      valorInventario: valorInventarioDelLocalActivo,
      margenPorProducto: margenPorProductoDelLocalActivo,
      patronesDesviacionConteo: patronesDesviacionConteoDelLocalActivo
    }
  ), tab === "resultados" && /* @__PURE__ */ import_react4.default.createElement(
    Resultados,
    {
      movimientos: movimientosInforme,
      productos: productosInforme,
      productoPorId: (id) => productosInforme.find((p22) => p22.id === id),
      gastosGenerales: gastosGeneralesInforme,
      addGasto: addGastoInforme,
      deleteGasto: deleteGastoInforme,
      empleados: empleadosInforme
    }
  ), tab === "fichas" && /* @__PURE__ */ import_react4.default.createElement(
    FichasCosto,
    {
      fichasCosto: fichasCostoDelLocalActivo,
      productos: productosDelLocalActivo,
      addFichaCosto,
      updateFichaCosto,
      deleteFichaCosto,
      updateProducto,
      addProducto,
      ordenesProduccion: ordenesProduccionDelLocalActivo,
      nominas,
      fichajes
    }
  ), tab === "produccion" && /* @__PURE__ */ import_react4.default.createElement(Produccion, { fichasCosto: fichasCostoDelLocalActivo, productos: productosDelLocalActivo, ordenesProduccion: ordenesProduccionDelLocalActivo, producir, anularProduccion, traspasarStock }), tab === "mermas" && /* @__PURE__ */ import_react4.default.createElement(Mermas, { productos: productosDelLocalActivo, movimientos: movimientosDelLocalActivo, registrarSalida, almacenCongelado }), tab === "etiquetas" && /* @__PURE__ */ import_react4.default.createElement(EtiquetasCatalogo, { productos: productosDelLocalActivo, fichasCosto: fichasCostoDelLocalActivo, alergenosDeFicha }), tab === "albaranes" && /* @__PURE__ */ import_react4.default.createElement(
    Albaranes,
    {
      albaranes: albaranesDelLocalActivo,
      proveedores,
      productos: productosDelLocalActivo,
      proveedorPorId,
      buscarEnCatalogo,
      guardarAlbaran,
      eliminarAlbaran,
      confirmarAlbaran,
      anularAlbaran,
      marcarPagada,
      duplicadosDe,
      desviacionesDePrecio,
      prefill: prefillAlbaran,
      limpiarPrefill: () => setPrefillAlbaran(null),
      pedidoParaFotoIA,
      limpiarPedidoParaFotoIA: () => setPedidoParaFotoIA(null),
      pedidos: pedidosDelLocalActivo
    }
  ), tab === "pagos" && /* @__PURE__ */ import_react4.default.createElement(
    CuentasPorPagar,
    {
      facturasPorPagar: facturasPorPagarDelLocalActivo,
      totalPendientePago: totalPendientePagoDelLocalActivo,
      marcarPagada,
      marcarPagadaFacturaDirecta,
      addFacturaDirecta,
      deleteFacturaDirecta,
      proveedores,
      resaltadaId: facturaDirectaResaltada,
      limpiarResaltada: () => setFacturaDirectaResaltada(null)
    }
  ), tab === "personal" && /* @__PURE__ */ import_react4.default.createElement(
    Personal,
    {
      empleados: empleadosDelLocalActivo,
      addEmpleado,
      updateEmpleado,
      deleteEmpleado,
      anonimizarEmpleado,
      registrarAusencia,
      eliminarAusencia,
      registrarEpi,
      eliminar
```

### offset 4099336
```js
     registrarCambio,
      registrarRelleno,
      eliminarRegistroAceite,
      consumoPorCiclo
    }
  ), tab === "buscar" && /* @__PURE__ */ import_react4.default.createElement(BusquedaGlobal, { productos: productosDelLocalActivo, proveedores, clientes, fichasCosto: fichasCostoDelLocalActivo, empleados: empleadosDelLocalActivo, setTab }), tab === "pedidos" && /* @__PURE__ */ import_react4.default.createElement(
    Pedidos,
    {
      pedidos: pedidosDelLocalActivo,
      proveedores,
      productos: productosDelLocalActivo,
      crearPedido,
      actualizarPedido,
      eliminarPedido,
      proveedorPorId,
      productoPorId: (id) => productosDelLocalActivo.find((p22) => p22.id === id),
      sugerenciasPedido: sugerenciasPedidoDelLocalActivo,
      addProducto
    }
  ), tab === "recepcion" && /* @__PURE__ */ import_react4.default.createElement(Recepcion, { pedidos: pedidosDelLocalActivo, proveedorPorId, productoPorId: (id) => productosDelLocalActivo.find((p22) => p22.id === id), recibirPedido, almacenCongelado, recibirConAlbaran, recibirConFotoIA, cerrarPedido }), tab === "conteo" && /* @__PURE__ */ import_react4.default.createElement(
    InventarioCiego,
    {
      productos: productosDelLocalActivo,
      proveedores,
      conteos: conteosDelLocalActivo,
      iniciarConteo,
      actualizarConteoItem,
      actualizarResponsable,
      finalizarConteo,
      aplicarAjustes,
      eliminarConteo,
      revertirUltimaAplicacion,
      productoPorId: (id) => productosDelLocalActivo.find((p22) => p22.id === id),
      crearProductoEnConteo,
      clasificacionABC: clasificacionABCDelLocalActivo,
      almacenCongelado
    }
  ), tab === "reportes" && /* @__PURE__ */ import_react4.default.createElement(
    Reportes,
    {
      rotacionPorProducto: rotacionPorProductoDelLocalActivo,
      gastoPorProveedor: gastoPorProveedorDelLocalActivo,
      productosSinMovimiento: productosSinMovimientoDelLocalActivo,
      valorInventario: valorInventarioDelLocalActivo,
      margenPorProducto: margenPorProductoDelLocalActivo,
      patronesDesviacionConteo: patronesDesviacionConteoDelLocalActivo
    }
  ), tab === "resultados" && /* @__PURE__ */ import_react4.default.createElement(
    Resultados,
    {
      movimientos: movimientosInforme,
      productos: productosInforme,
      productoPorId: (id) => productosInforme.find((p22) => p22.id === id),
      gastosGenerales: gastosGeneralesInforme,
      addGasto: addGastoInforme,
      deleteGasto: deleteGastoInforme,
      empleados: empleadosInforme
    }
  ), tab === "fichas" && /* @__PURE__ */ import_react4.default.createElement(
    FichasCosto,
    {
      fichasCosto: fichasCostoDelLocalActivo,
      productos: productosDelLocalActivo,
      addFichaCosto,
      updateFichaCosto,
      deleteFichaCosto,
      updateProducto,
      addProducto,
      ordenesProduccion: ordenesProduccionDelLocalActivo,
      nominas,
      fichajes
    }
  ), tab === "produccion" && /* @__PURE__ */ import_react4.default.createElement(Produccion, { fichasCosto: fichasCostoDelLocalActivo, productos: productosDelLocalActivo, ordenesProduccion: ordenesProduccionDelLocalActivo, producir, anularProduccion, traspasarStock }), tab === "mermas" && /* @__PURE__ */ import_react4.default.createElement(Mermas, { productos: productosDelLocalActivo, movimientos: movimientosDelLocalActivo, registrarSalida, almacenCongelado }), tab === "etiquetas" && /* @__PURE__ */ import_react4.default.createElement(EtiquetasCatalogo, { productos: productosDelLocalActivo, fichasCosto: fichasCostoDelLocalActivo, alergenosDeFicha }), tab === "albaranes" && /* @__PURE__ */ import_react4.default.createElement(
    Albaranes,
    {
      albaranes: albaranesDelLocalActivo,
      proveedores,
      productos: productosDelLocalActivo,
      proveedorPorId,
      buscarEnCatalogo,
      guardarAlbaran,
      eliminarAlbaran,
      confirmarAlbaran,
      anularAlbaran,
      marcarPagada,
      duplicadosDe,
      desviacionesDePrecio,
      prefill: prefillAlbaran,
      limpiarPrefill: () => setPrefillAlbaran(null),
      pedidoParaFotoIA,
      limpiarPedidoParaFotoIA: () => setPedidoParaFotoIA(null),
      pedidos: pedidosDelLocalActivo
    }
  ), tab === "pagos" && /* @__PURE__ */ import_react4.default.createElement(
    CuentasPorPagar,
    {
      facturasPorPagar: facturasPorPagarDelLocalActivo,
      totalPendientePago: totalPendientePagoDelLocalActivo,
      marcarPagada,
      marcarPagadaFacturaDirecta,
      addFacturaDirecta,
      deleteFacturaDirecta,
      proveedores,
      resaltadaId: facturaDirectaResaltada,
      limpiarResaltada: () => setFacturaDirectaResaltada(null)
    }
  ), tab === "personal" && /* @__PURE__ */ import_react4.default.createElement(
    Personal,
    {
      empleados: empleadosDelLocalActivo,
      addEmpleado,
      updateEmpleado,
      deleteEmpleado,
      anonimizarEmpleado,
      registrarAusencia,
      eliminarAusencia,
      registrarEpi,
      eliminarEpi,
      documentosPersonalCaducan,
      fichajes: fichajesDelLocalActivo,
      nominas: nominasDelLocalActivo,
      entrevistas,
      crearEntrevista,
      actualizarEntrevista,
      finalizarEntrevista,
      eliminarEntrevista,
      crearPrefiltro,
      listarPrefiltros,
      eliminarPrefiltro,
      crearCuentaEmpleado
    }
  ), tab === "fichaje" && /* @__PURE__ */ import_react4.default.createElement(
    RegistroHorario,
    {
      empleados: empleadosDelLocalActivo,
      fichajes: fichajesDelLocalActivo,
      fichar,
      addFichajeManual,
      updateFichaje,
      eliminarFichaje,
      fichajesAbiertos: fichajesAbiertosDelLocalActivo
    }
  ), tab === "nominas" && 
```

### offset 4100429
```js
 tab === "conteo" && /* @__PURE__ */ import_react4.default.createElement(
    InventarioCiego,
    {
      productos: productosDelLocalActivo,
      proveedores,
      conteos: conteosDelLocalActivo,
      iniciarConteo,
      actualizarConteoItem,
      actualizarResponsable,
      finalizarConteo,
      aplicarAjustes,
      eliminarConteo,
      revertirUltimaAplicacion,
      productoPorId: (id) => productosDelLocalActivo.find((p22) => p22.id === id),
      crearProductoEnConteo,
      clasificacionABC: clasificacionABCDelLocalActivo,
      almacenCongelado
    }
  ), tab === "reportes" && /* @__PURE__ */ import_react4.default.createElement(
    Reportes,
    {
      rotacionPorProducto: rotacionPorProductoDelLocalActivo,
      gastoPorProveedor: gastoPorProveedorDelLocalActivo,
      productosSinMovimiento: productosSinMovimientoDelLocalActivo,
      valorInventario: valorInventarioDelLocalActivo,
      margenPorProducto: margenPorProductoDelLocalActivo,
      patronesDesviacionConteo: patronesDesviacionConteoDelLocalActivo
    }
  ), tab === "resultados" && /* @__PURE__ */ import_react4.default.createElement(
    Resultados,
    {
      movimientos: movimientosInforme,
      productos: productosInforme,
      productoPorId: (id) => productosInforme.find((p22) => p22.id === id),
      gastosGenerales: gastosGeneralesInforme,
      addGasto: addGastoInforme,
      deleteGasto: deleteGastoInforme,
      empleados: empleadosInforme
    }
  ), tab === "fichas" && /* @__PURE__ */ import_react4.default.createElement(
    FichasCosto,
    {
      fichasCosto: fichasCostoDelLocalActivo,
      productos: productosDelLocalActivo,
      addFichaCosto,
      updateFichaCosto,
      deleteFichaCosto,
      updateProducto,
      addProducto,
      ordenesProduccion: ordenesProduccionDelLocalActivo,
      nominas,
      fichajes
    }
  ), tab === "produccion" && /* @__PURE__ */ import_react4.default.createElement(Produccion, { fichasCosto: fichasCostoDelLocalActivo, productos: productosDelLocalActivo, ordenesProduccion: ordenesProduccionDelLocalActivo, producir, anularProduccion, traspasarStock }), tab === "mermas" && /* @__PURE__ */ import_react4.default.createElement(Mermas, { productos: productosDelLocalActivo, movimientos: movimientosDelLocalActivo, registrarSalida, almacenCongelado }), tab === "etiquetas" && /* @__PURE__ */ import_react4.default.createElement(EtiquetasCatalogo, { productos: productosDelLocalActivo, fichasCosto: fichasCostoDelLocalActivo, alergenosDeFicha }), tab === "albaranes" && /* @__PURE__ */ import_react4.default.createElement(
    Albaranes,
    {
      albaranes: albaranesDelLocalActivo,
      proveedores,
      productos: productosDelLocalActivo,
      proveedorPorId,
      buscarEnCatalogo,
      guardarAlbaran,
      eliminarAlbaran,
      confirmarAlbaran,
      anularAlbaran,
      marcarPagada,
      duplicadosDe,
      desviacionesDePrecio,
      prefill: prefillAlbaran,
      limpiarPrefill: () => setPrefillAlbaran(null),
      pedidoParaFotoIA,
      limpiarPedidoParaFotoIA: () => setPedidoParaFotoIA(null),
      pedidos: pedidosDelLocalActivo
    }
  ), tab === "pagos" && /* @__PURE__ */ import_react4.default.createElement(
    CuentasPorPagar,
    {
      facturasPorPagar: facturasPorPagarDelLocalActivo,
      totalPendientePago: totalPendientePagoDelLocalActivo,
      marcarPagada,
      marcarPagadaFacturaDirecta,
      addFacturaDirecta,
      deleteFacturaDirecta,
      proveedores,
      resaltadaId: facturaDirectaResaltada,
      limpiarResaltada: () => setFacturaDirectaResaltada(null)
    }
  ), tab === "personal" && /* @__PURE__ */ import_react4.default.createElement(
    Personal,
    {
      empleados: empleadosDelLocalActivo,
      addEmpleado,
      updateEmpleado,
      deleteEmpleado,
      anonimizarEmpleado,
      registrarAusencia,
      eliminarAusencia,
      registrarEpi,
      eliminarEpi,
      documentosPersonalCaducan,
      fichajes: fichajesDelLocalActivo,
      nominas: nominasDelLocalActivo,
      entrevistas,
      crearEntrevista,
      actualizarEntrevista,
      finalizarEntrevista,
      eliminarEntrevista,
      crearPrefiltro,
      listarPrefiltros,
      eliminarPrefiltro,
      crearCuentaEmpleado
    }
  ), tab === "fichaje" && /* @__PURE__ */ import_react4.default.createElement(
    RegistroHorario,
    {
      empleados: empleadosDelLocalActivo,
      fichajes: fichajesDelLocalActivo,
      fichar,
      addFichajeManual,
      updateFichaje,
      eliminarFichaje,
      fichajesAbiertos: fichajesAbiertosDelLocalActivo
    }
  ), tab === "nominas" && /* @__PURE__ */ import_react4.default.createElement(
    CostePersonal,
    {
      empleados: empleadosDelLocalActivo,
      nominas: nominasDelLocalActivo,
      addNomina,
      updateNomina,
      deleteNomina,
      fichajes: fichajesDelLocalActivo,
      movimientos: movimientosDelLocalActivo
    }
  ), tab === "venta" && (localInformeId && localActivoId === localInformeId ? /* @__PURE__ */ import_react4.default.createElement(VentaRapida, { productos: productosDelLocalActivo, venderCarrito, anularVenta, movimientos: movimientosDelLocalActivo, registrarAuditoria, local: locales.find((l22) => l22.id === localActivoId) || null, configEmpresa: empresaDelLocalActivo }) : /* @__PURE__ */ import_react4.default.createElement("div", null, /* @__PURE__ */ import_react4.default.createElement(Card, { className: "p-5 mb-4" }, /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[16px] font-semibold mb-2" }, "TPV"), /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[12.5px]", style: { color: C2.inkSoft } }, "El TPV no puede abrirse 
```

### offset 4100846
```js
lLocalActivo.find((p22) => p22.id === id),
      crearProductoEnConteo,
      clasificacionABC: clasificacionABCDelLocalActivo,
      almacenCongelado
    }
  ), tab === "reportes" && /* @__PURE__ */ import_react4.default.createElement(
    Reportes,
    {
      rotacionPorProducto: rotacionPorProductoDelLocalActivo,
      gastoPorProveedor: gastoPorProveedorDelLocalActivo,
      productosSinMovimiento: productosSinMovimientoDelLocalActivo,
      valorInventario: valorInventarioDelLocalActivo,
      margenPorProducto: margenPorProductoDelLocalActivo,
      patronesDesviacionConteo: patronesDesviacionConteoDelLocalActivo
    }
  ), tab === "resultados" && /* @__PURE__ */ import_react4.default.createElement(
    Resultados,
    {
      movimientos: movimientosInforme,
      productos: productosInforme,
      productoPorId: (id) => productosInforme.find((p22) => p22.id === id),
      gastosGenerales: gastosGeneralesInforme,
      addGasto: addGastoInforme,
      deleteGasto: deleteGastoInforme,
      empleados: empleadosInforme
    }
  ), tab === "fichas" && /* @__PURE__ */ import_react4.default.createElement(
    FichasCosto,
    {
      fichasCosto: fichasCostoDelLocalActivo,
      productos: productosDelLocalActivo,
      addFichaCosto,
      updateFichaCosto,
      deleteFichaCosto,
      updateProducto,
      addProducto,
      ordenesProduccion: ordenesProduccionDelLocalActivo,
      nominas,
      fichajes
    }
  ), tab === "produccion" && /* @__PURE__ */ import_react4.default.createElement(Produccion, { fichasCosto: fichasCostoDelLocalActivo, productos: productosDelLocalActivo, ordenesProduccion: ordenesProduccionDelLocalActivo, producir, anularProduccion, traspasarStock }), tab === "mermas" && /* @__PURE__ */ import_react4.default.createElement(Mermas, { productos: productosDelLocalActivo, movimientos: movimientosDelLocalActivo, registrarSalida, almacenCongelado }), tab === "etiquetas" && /* @__PURE__ */ import_react4.default.createElement(EtiquetasCatalogo, { productos: productosDelLocalActivo, fichasCosto: fichasCostoDelLocalActivo, alergenosDeFicha }), tab === "albaranes" && /* @__PURE__ */ import_react4.default.createElement(
    Albaranes,
    {
      albaranes: albaranesDelLocalActivo,
      proveedores,
      productos: productosDelLocalActivo,
      proveedorPorId,
      buscarEnCatalogo,
      guardarAlbaran,
      eliminarAlbaran,
      confirmarAlbaran,
      anularAlbaran,
      marcarPagada,
      duplicadosDe,
      desviacionesDePrecio,
      prefill: prefillAlbaran,
      limpiarPrefill: () => setPrefillAlbaran(null),
      pedidoParaFotoIA,
      limpiarPedidoParaFotoIA: () => setPedidoParaFotoIA(null),
      pedidos: pedidosDelLocalActivo
    }
  ), tab === "pagos" && /* @__PURE__ */ import_react4.default.createElement(
    CuentasPorPagar,
    {
      facturasPorPagar: facturasPorPagarDelLocalActivo,
      totalPendientePago: totalPendientePagoDelLocalActivo,
      marcarPagada,
      marcarPagadaFacturaDirecta,
      addFacturaDirecta,
      deleteFacturaDirecta,
      proveedores,
      resaltadaId: facturaDirectaResaltada,
      limpiarResaltada: () => setFacturaDirectaResaltada(null)
    }
  ), tab === "personal" && /* @__PURE__ */ import_react4.default.createElement(
    Personal,
    {
      empleados: empleadosDelLocalActivo,
      addEmpleado,
      updateEmpleado,
      deleteEmpleado,
      anonimizarEmpleado,
      registrarAusencia,
      eliminarAusencia,
      registrarEpi,
      eliminarEpi,
      documentosPersonalCaducan,
      fichajes: fichajesDelLocalActivo,
      nominas: nominasDelLocalActivo,
      entrevistas,
      crearEntrevista,
      actualizarEntrevista,
      finalizarEntrevista,
      eliminarEntrevista,
      crearPrefiltro,
      listarPrefiltros,
      eliminarPrefiltro,
      crearCuentaEmpleado
    }
  ), tab === "fichaje" && /* @__PURE__ */ import_react4.default.createElement(
    RegistroHorario,
    {
      empleados: empleadosDelLocalActivo,
      fichajes: fichajesDelLocalActivo,
      fichar,
      addFichajeManual,
      updateFichaje,
      eliminarFichaje,
      fichajesAbiertos: fichajesAbiertosDelLocalActivo
    }
  ), tab === "nominas" && /* @__PURE__ */ import_react4.default.createElement(
    CostePersonal,
    {
      empleados: empleadosDelLocalActivo,
      nominas: nominasDelLocalActivo,
      addNomina,
      updateNomina,
      deleteNomina,
      fichajes: fichajesDelLocalActivo,
      movimientos: movimientosDelLocalActivo
    }
  ), tab === "venta" && (localInformeId && localActivoId === localInformeId ? /* @__PURE__ */ import_react4.default.createElement(VentaRapida, { productos: productosDelLocalActivo, venderCarrito, anularVenta, movimientos: movimientosDelLocalActivo, registrarAuditoria, local: locales.find((l22) => l22.id === localActivoId) || null, configEmpresa: empresaDelLocalActivo }) : /* @__PURE__ */ import_react4.default.createElement("div", null, /* @__PURE__ */ import_react4.default.createElement(Card, { className: "p-5 mb-4" }, /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[16px] font-semibold mb-2" }, "TPV"), /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[12.5px]", style: { color: C2.inkSoft } }, "El TPV no puede abrirse en Todos los locales. Selecciona un local concreto: cada venta, stock y caja pertenecen a un \xFAnico local.")), /* @__PURE__ */ import_react4.default.createElement(SelectorLocalInformes, { locales: localesEmpresaActiva, valor: localInformeId, onChange: seleccionarContextoLocal }))), tab === "encargos" && /* @__PURE__ */ import_react4.default.createElement(
    Encargos,
    {
      encargosPendientes: encargosPen
```

### offset 4101221
```js
,
      productosSinMovimiento: productosSinMovimientoDelLocalActivo,
      valorInventario: valorInventarioDelLocalActivo,
      margenPorProducto: margenPorProductoDelLocalActivo,
      patronesDesviacionConteo: patronesDesviacionConteoDelLocalActivo
    }
  ), tab === "resultados" && /* @__PURE__ */ import_react4.default.createElement(
    Resultados,
    {
      movimientos: movimientosInforme,
      productos: productosInforme,
      productoPorId: (id) => productosInforme.find((p22) => p22.id === id),
      gastosGenerales: gastosGeneralesInforme,
      addGasto: addGastoInforme,
      deleteGasto: deleteGastoInforme,
      empleados: empleadosInforme
    }
  ), tab === "fichas" && /* @__PURE__ */ import_react4.default.createElement(
    FichasCosto,
    {
      fichasCosto: fichasCostoDelLocalActivo,
      productos: productosDelLocalActivo,
      addFichaCosto,
      updateFichaCosto,
      deleteFichaCosto,
      updateProducto,
      addProducto,
      ordenesProduccion: ordenesProduccionDelLocalActivo,
      nominas,
      fichajes
    }
  ), tab === "produccion" && /* @__PURE__ */ import_react4.default.createElement(Produccion, { fichasCosto: fichasCostoDelLocalActivo, productos: productosDelLocalActivo, ordenesProduccion: ordenesProduccionDelLocalActivo, producir, anularProduccion, traspasarStock }), tab === "mermas" && /* @__PURE__ */ import_react4.default.createElement(Mermas, { productos: productosDelLocalActivo, movimientos: movimientosDelLocalActivo, registrarSalida, almacenCongelado }), tab === "etiquetas" && /* @__PURE__ */ import_react4.default.createElement(EtiquetasCatalogo, { productos: productosDelLocalActivo, fichasCosto: fichasCostoDelLocalActivo, alergenosDeFicha }), tab === "albaranes" && /* @__PURE__ */ import_react4.default.createElement(
    Albaranes,
    {
      albaranes: albaranesDelLocalActivo,
      proveedores,
      productos: productosDelLocalActivo,
      proveedorPorId,
      buscarEnCatalogo,
      guardarAlbaran,
      eliminarAlbaran,
      confirmarAlbaran,
      anularAlbaran,
      marcarPagada,
      duplicadosDe,
      desviacionesDePrecio,
      prefill: prefillAlbaran,
      limpiarPrefill: () => setPrefillAlbaran(null),
      pedidoParaFotoIA,
      limpiarPedidoParaFotoIA: () => setPedidoParaFotoIA(null),
      pedidos: pedidosDelLocalActivo
    }
  ), tab === "pagos" && /* @__PURE__ */ import_react4.default.createElement(
    CuentasPorPagar,
    {
      facturasPorPagar: facturasPorPagarDelLocalActivo,
      totalPendientePago: totalPendientePagoDelLocalActivo,
      marcarPagada,
      marcarPagadaFacturaDirecta,
      addFacturaDirecta,
      deleteFacturaDirecta,
      proveedores,
      resaltadaId: facturaDirectaResaltada,
      limpiarResaltada: () => setFacturaDirectaResaltada(null)
    }
  ), tab === "personal" && /* @__PURE__ */ import_react4.default.createElement(
    Personal,
    {
      empleados: empleadosDelLocalActivo,
      addEmpleado,
      updateEmpleado,
      deleteEmpleado,
      anonimizarEmpleado,
      registrarAusencia,
      eliminarAusencia,
      registrarEpi,
      eliminarEpi,
      documentosPersonalCaducan,
      fichajes: fichajesDelLocalActivo,
      nominas: nominasDelLocalActivo,
      entrevistas,
      crearEntrevista,
      actualizarEntrevista,
      finalizarEntrevista,
      eliminarEntrevista,
      crearPrefiltro,
      listarPrefiltros,
      eliminarPrefiltro,
      crearCuentaEmpleado
    }
  ), tab === "fichaje" && /* @__PURE__ */ import_react4.default.createElement(
    RegistroHorario,
    {
      empleados: empleadosDelLocalActivo,
      fichajes: fichajesDelLocalActivo,
      fichar,
      addFichajeManual,
      updateFichaje,
      eliminarFichaje,
      fichajesAbiertos: fichajesAbiertosDelLocalActivo
    }
  ), tab === "nominas" && /* @__PURE__ */ import_react4.default.createElement(
    CostePersonal,
    {
      empleados: empleadosDelLocalActivo,
      nominas: nominasDelLocalActivo,
      addNomina,
      updateNomina,
      deleteNomina,
      fichajes: fichajesDelLocalActivo,
      movimientos: movimientosDelLocalActivo
    }
  ), tab === "venta" && (localInformeId && localActivoId === localInformeId ? /* @__PURE__ */ import_react4.default.createElement(VentaRapida, { productos: productosDelLocalActivo, venderCarrito, anularVenta, movimientos: movimientosDelLocalActivo, registrarAuditoria, local: locales.find((l22) => l22.id === localActivoId) || null, configEmpresa: empresaDelLocalActivo }) : /* @__PURE__ */ import_react4.default.createElement("div", null, /* @__PURE__ */ import_react4.default.createElement(Card, { className: "p-5 mb-4" }, /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[16px] font-semibold mb-2" }, "TPV"), /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[12.5px]", style: { color: C2.inkSoft } }, "El TPV no puede abrirse en Todos los locales. Selecciona un local concreto: cada venta, stock y caja pertenecen a un \xFAnico local.")), /* @__PURE__ */ import_react4.default.createElement(SelectorLocalInformes, { locales: localesEmpresaActiva, valor: localInformeId, onChange: seleccionarContextoLocal }))), tab === "encargos" && /* @__PURE__ */ import_react4.default.createElement(
    Encargos,
    {
      encargosPendientes: encargosPendientesDelLocalActivo,
      encargos: encargosDelLocalActivo,
      clientes,
      productos: productosDelLocalActivo,
      addEncargo,
      updateEncargo,
      deleteEncargo,
      entregarEncargo,
      addCliente
    }
  ), tab === "clientes" && /* @__PURE__ */ import_react4.default.createElement(
    Clientes,
    {
      analisisClientes,
      clientesDormidos,

```

### offset 4101438
```js
ronesDesviacionConteoDelLocalActivo
    }
  ), tab === "resultados" && /* @__PURE__ */ import_react4.default.createElement(
    Resultados,
    {
      movimientos: movimientosInforme,
      productos: productosInforme,
      productoPorId: (id) => productosInforme.find((p22) => p22.id === id),
      gastosGenerales: gastosGeneralesInforme,
      addGasto: addGastoInforme,
      deleteGasto: deleteGastoInforme,
      empleados: empleadosInforme
    }
  ), tab === "fichas" && /* @__PURE__ */ import_react4.default.createElement(
    FichasCosto,
    {
      fichasCosto: fichasCostoDelLocalActivo,
      productos: productosDelLocalActivo,
      addFichaCosto,
      updateFichaCosto,
      deleteFichaCosto,
      updateProducto,
      addProducto,
      ordenesProduccion: ordenesProduccionDelLocalActivo,
      nominas,
      fichajes
    }
  ), tab === "produccion" && /* @__PURE__ */ import_react4.default.createElement(Produccion, { fichasCosto: fichasCostoDelLocalActivo, productos: productosDelLocalActivo, ordenesProduccion: ordenesProduccionDelLocalActivo, producir, anularProduccion, traspasarStock }), tab === "mermas" && /* @__PURE__ */ import_react4.default.createElement(Mermas, { productos: productosDelLocalActivo, movimientos: movimientosDelLocalActivo, registrarSalida, almacenCongelado }), tab === "etiquetas" && /* @__PURE__ */ import_react4.default.createElement(EtiquetasCatalogo, { productos: productosDelLocalActivo, fichasCosto: fichasCostoDelLocalActivo, alergenosDeFicha }), tab === "albaranes" && /* @__PURE__ */ import_react4.default.createElement(
    Albaranes,
    {
      albaranes: albaranesDelLocalActivo,
      proveedores,
      productos: productosDelLocalActivo,
      proveedorPorId,
      buscarEnCatalogo,
      guardarAlbaran,
      eliminarAlbaran,
      confirmarAlbaran,
      anularAlbaran,
      marcarPagada,
      duplicadosDe,
      desviacionesDePrecio,
      prefill: prefillAlbaran,
      limpiarPrefill: () => setPrefillAlbaran(null),
      pedidoParaFotoIA,
      limpiarPedidoParaFotoIA: () => setPedidoParaFotoIA(null),
      pedidos: pedidosDelLocalActivo
    }
  ), tab === "pagos" && /* @__PURE__ */ import_react4.default.createElement(
    CuentasPorPagar,
    {
      facturasPorPagar: facturasPorPagarDelLocalActivo,
      totalPendientePago: totalPendientePagoDelLocalActivo,
      marcarPagada,
      marcarPagadaFacturaDirecta,
      addFacturaDirecta,
      deleteFacturaDirecta,
      proveedores,
      resaltadaId: facturaDirectaResaltada,
      limpiarResaltada: () => setFacturaDirectaResaltada(null)
    }
  ), tab === "personal" && /* @__PURE__ */ import_react4.default.createElement(
    Personal,
    {
      empleados: empleadosDelLocalActivo,
      addEmpleado,
      updateEmpleado,
      deleteEmpleado,
      anonimizarEmpleado,
      registrarAusencia,
      eliminarAusencia,
      registrarEpi,
      eliminarEpi,
      documentosPersonalCaducan,
      fichajes: fichajesDelLocalActivo,
      nominas: nominasDelLocalActivo,
      entrevistas,
      crearEntrevista,
      actualizarEntrevista,
      finalizarEntrevista,
      eliminarEntrevista,
      crearPrefiltro,
      listarPrefiltros,
      eliminarPrefiltro,
      crearCuentaEmpleado
    }
  ), tab === "fichaje" && /* @__PURE__ */ import_react4.default.createElement(
    RegistroHorario,
    {
      empleados: empleadosDelLocalActivo,
      fichajes: fichajesDelLocalActivo,
      fichar,
      addFichajeManual,
      updateFichaje,
      eliminarFichaje,
      fichajesAbiertos: fichajesAbiertosDelLocalActivo
    }
  ), tab === "nominas" && /* @__PURE__ */ import_react4.default.createElement(
    CostePersonal,
    {
      empleados: empleadosDelLocalActivo,
      nominas: nominasDelLocalActivo,
      addNomina,
      updateNomina,
      deleteNomina,
      fichajes: fichajesDelLocalActivo,
      movimientos: movimientosDelLocalActivo
    }
  ), tab === "venta" && (localInformeId && localActivoId === localInformeId ? /* @__PURE__ */ import_react4.default.createElement(VentaRapida, { productos: productosDelLocalActivo, venderCarrito, anularVenta, movimientos: movimientosDelLocalActivo, registrarAuditoria, local: locales.find((l22) => l22.id === localActivoId) || null, configEmpresa: empresaDelLocalActivo }) : /* @__PURE__ */ import_react4.default.createElement("div", null, /* @__PURE__ */ import_react4.default.createElement(Card, { className: "p-5 mb-4" }, /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[16px] font-semibold mb-2" }, "TPV"), /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[12.5px]", style: { color: C2.inkSoft } }, "El TPV no puede abrirse en Todos los locales. Selecciona un local concreto: cada venta, stock y caja pertenecen a un \xFAnico local.")), /* @__PURE__ */ import_react4.default.createElement(SelectorLocalInformes, { locales: localesEmpresaActiva, valor: localInformeId, onChange: seleccionarContextoLocal }))), tab === "encargos" && /* @__PURE__ */ import_react4.default.createElement(
    Encargos,
    {
      encargosPendientes: encargosPendientesDelLocalActivo,
      encargos: encargosDelLocalActivo,
      clientes,
      productos: productosDelLocalActivo,
      addEncargo,
      updateEncargo,
      deleteEncargo,
      entregarEncargo,
      addCliente
    }
  ), tab === "clientes" && /* @__PURE__ */ import_react4.default.createElement(
    Clientes,
    {
      analisisClientes,
      clientesDormidos,
      ventaCruzada,
      addCliente,
      updateCliente,
      deleteCliente,
      anonimizarCliente
    }
  ), tab === "devoluciones" && /* @__PURE__ */ import_react4.default.createElement(
    Devoluciones,
    {
```

### offset 4101648
```js
sInforme,
      productoPorId: (id) => productosInforme.find((p22) => p22.id === id),
      gastosGenerales: gastosGeneralesInforme,
      addGasto: addGastoInforme,
      deleteGasto: deleteGastoInforme,
      empleados: empleadosInforme
    }
  ), tab === "fichas" && /* @__PURE__ */ import_react4.default.createElement(
    FichasCosto,
    {
      fichasCosto: fichasCostoDelLocalActivo,
      productos: productosDelLocalActivo,
      addFichaCosto,
      updateFichaCosto,
      deleteFichaCosto,
      updateProducto,
      addProducto,
      ordenesProduccion: ordenesProduccionDelLocalActivo,
      nominas,
      fichajes
    }
  ), tab === "produccion" && /* @__PURE__ */ import_react4.default.createElement(Produccion, { fichasCosto: fichasCostoDelLocalActivo, productos: productosDelLocalActivo, ordenesProduccion: ordenesProduccionDelLocalActivo, producir, anularProduccion, traspasarStock }), tab === "mermas" && /* @__PURE__ */ import_react4.default.createElement(Mermas, { productos: productosDelLocalActivo, movimientos: movimientosDelLocalActivo, registrarSalida, almacenCongelado }), tab === "etiquetas" && /* @__PURE__ */ import_react4.default.createElement(EtiquetasCatalogo, { productos: productosDelLocalActivo, fichasCosto: fichasCostoDelLocalActivo, alergenosDeFicha }), tab === "albaranes" && /* @__PURE__ */ import_react4.default.createElement(
    Albaranes,
    {
      albaranes: albaranesDelLocalActivo,
      proveedores,
      productos: productosDelLocalActivo,
      proveedorPorId,
      buscarEnCatalogo,
      guardarAlbaran,
      eliminarAlbaran,
      confirmarAlbaran,
      anularAlbaran,
      marcarPagada,
      duplicadosDe,
      desviacionesDePrecio,
      prefill: prefillAlbaran,
      limpiarPrefill: () => setPrefillAlbaran(null),
      pedidoParaFotoIA,
      limpiarPedidoParaFotoIA: () => setPedidoParaFotoIA(null),
      pedidos: pedidosDelLocalActivo
    }
  ), tab === "pagos" && /* @__PURE__ */ import_react4.default.createElement(
    CuentasPorPagar,
    {
      facturasPorPagar: facturasPorPagarDelLocalActivo,
      totalPendientePago: totalPendientePagoDelLocalActivo,
      marcarPagada,
      marcarPagadaFacturaDirecta,
      addFacturaDirecta,
      deleteFacturaDirecta,
      proveedores,
      resaltadaId: facturaDirectaResaltada,
      limpiarResaltada: () => setFacturaDirectaResaltada(null)
    }
  ), tab === "personal" && /* @__PURE__ */ import_react4.default.createElement(
    Personal,
    {
      empleados: empleadosDelLocalActivo,
      addEmpleado,
      updateEmpleado,
      deleteEmpleado,
      anonimizarEmpleado,
      registrarAusencia,
      eliminarAusencia,
      registrarEpi,
      eliminarEpi,
      documentosPersonalCaducan,
      fichajes: fichajesDelLocalActivo,
      nominas: nominasDelLocalActivo,
      entrevistas,
      crearEntrevista,
      actualizarEntrevista,
      finalizarEntrevista,
      eliminarEntrevista,
      crearPrefiltro,
      listarPrefiltros,
      eliminarPrefiltro,
      crearCuentaEmpleado
    }
  ), tab === "fichaje" && /* @__PURE__ */ import_react4.default.createElement(
    RegistroHorario,
    {
      empleados: empleadosDelLocalActivo,
      fichajes: fichajesDelLocalActivo,
      fichar,
      addFichajeManual,
      updateFichaje,
      eliminarFichaje,
      fichajesAbiertos: fichajesAbiertosDelLocalActivo
    }
  ), tab === "nominas" && /* @__PURE__ */ import_react4.default.createElement(
    CostePersonal,
    {
      empleados: empleadosDelLocalActivo,
      nominas: nominasDelLocalActivo,
      addNomina,
      updateNomina,
      deleteNomina,
      fichajes: fichajesDelLocalActivo,
      movimientos: movimientosDelLocalActivo
    }
  ), tab === "venta" && (localInformeId && localActivoId === localInformeId ? /* @__PURE__ */ import_react4.default.createElement(VentaRapida, { productos: productosDelLocalActivo, venderCarrito, anularVenta, movimientos: movimientosDelLocalActivo, registrarAuditoria, local: locales.find((l22) => l22.id === localActivoId) || null, configEmpresa: empresaDelLocalActivo }) : /* @__PURE__ */ import_react4.default.createElement("div", null, /* @__PURE__ */ import_react4.default.createElement(Card, { className: "p-5 mb-4" }, /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[16px] font-semibold mb-2" }, "TPV"), /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[12.5px]", style: { color: C2.inkSoft } }, "El TPV no puede abrirse en Todos los locales. Selecciona un local concreto: cada venta, stock y caja pertenecen a un \xFAnico local.")), /* @__PURE__ */ import_react4.default.createElement(SelectorLocalInformes, { locales: localesEmpresaActiva, valor: localInformeId, onChange: seleccionarContextoLocal }))), tab === "encargos" && /* @__PURE__ */ import_react4.default.createElement(
    Encargos,
    {
      encargosPendientes: encargosPendientesDelLocalActivo,
      encargos: encargosDelLocalActivo,
      clientes,
      productos: productosDelLocalActivo,
      addEncargo,
      updateEncargo,
      deleteEncargo,
      entregarEncargo,
      addCliente
    }
  ), tab === "clientes" && /* @__PURE__ */ import_react4.default.createElement(
    Clientes,
    {
      analisisClientes,
      clientesDormidos,
      ventaCruzada,
      addCliente,
      updateCliente,
      deleteCliente,
      anonimizarCliente
    }
  ), tab === "devoluciones" && /* @__PURE__ */ import_react4.default.createElement(
    Devoluciones,
    { key: localActivoId || "todos", productos: productosDelLocalActivo, proveedores, devoluciones: devolucionesDelLocalActivo, movimientos: movimientosDelLocalActivo, registrarDevolucionCliente, registrarDevolucion
```

### offset 4101909
```js
chas" && /* @__PURE__ */ import_react4.default.createElement(
    FichasCosto,
    {
      fichasCosto: fichasCostoDelLocalActivo,
      productos: productosDelLocalActivo,
      addFichaCosto,
      updateFichaCosto,
      deleteFichaCosto,
      updateProducto,
      addProducto,
      ordenesProduccion: ordenesProduccionDelLocalActivo,
      nominas,
      fichajes
    }
  ), tab === "produccion" && /* @__PURE__ */ import_react4.default.createElement(Produccion, { fichasCosto: fichasCostoDelLocalActivo, productos: productosDelLocalActivo, ordenesProduccion: ordenesProduccionDelLocalActivo, producir, anularProduccion, traspasarStock }), tab === "mermas" && /* @__PURE__ */ import_react4.default.createElement(Mermas, { productos: productosDelLocalActivo, movimientos: movimientosDelLocalActivo, registrarSalida, almacenCongelado }), tab === "etiquetas" && /* @__PURE__ */ import_react4.default.createElement(EtiquetasCatalogo, { productos: productosDelLocalActivo, fichasCosto: fichasCostoDelLocalActivo, alergenosDeFicha }), tab === "albaranes" && /* @__PURE__ */ import_react4.default.createElement(
    Albaranes,
    {
      albaranes: albaranesDelLocalActivo,
      proveedores,
      productos: productosDelLocalActivo,
      proveedorPorId,
      buscarEnCatalogo,
      guardarAlbaran,
      eliminarAlbaran,
      confirmarAlbaran,
      anularAlbaran,
      marcarPagada,
      duplicadosDe,
      desviacionesDePrecio,
      prefill: prefillAlbaran,
      limpiarPrefill: () => setPrefillAlbaran(null),
      pedidoParaFotoIA,
      limpiarPedidoParaFotoIA: () => setPedidoParaFotoIA(null),
      pedidos: pedidosDelLocalActivo
    }
  ), tab === "pagos" && /* @__PURE__ */ import_react4.default.createElement(
    CuentasPorPagar,
    {
      facturasPorPagar: facturasPorPagarDelLocalActivo,
      totalPendientePago: totalPendientePagoDelLocalActivo,
      marcarPagada,
      marcarPagadaFacturaDirecta,
      addFacturaDirecta,
      deleteFacturaDirecta,
      proveedores,
      resaltadaId: facturaDirectaResaltada,
      limpiarResaltada: () => setFacturaDirectaResaltada(null)
    }
  ), tab === "personal" && /* @__PURE__ */ import_react4.default.createElement(
    Personal,
    {
      empleados: empleadosDelLocalActivo,
      addEmpleado,
      updateEmpleado,
      deleteEmpleado,
      anonimizarEmpleado,
      registrarAusencia,
      eliminarAusencia,
      registrarEpi,
      eliminarEpi,
      documentosPersonalCaducan,
      fichajes: fichajesDelLocalActivo,
      nominas: nominasDelLocalActivo,
      entrevistas,
      crearEntrevista,
      actualizarEntrevista,
      finalizarEntrevista,
      eliminarEntrevista,
      crearPrefiltro,
      listarPrefiltros,
      eliminarPrefiltro,
      crearCuentaEmpleado
    }
  ), tab === "fichaje" && /* @__PURE__ */ import_react4.default.createElement(
    RegistroHorario,
    {
      empleados: empleadosDelLocalActivo,
      fichajes: fichajesDelLocalActivo,
      fichar,
      addFichajeManual,
      updateFichaje,
      eliminarFichaje,
      fichajesAbiertos: fichajesAbiertosDelLocalActivo
    }
  ), tab === "nominas" && /* @__PURE__ */ import_react4.default.createElement(
    CostePersonal,
    {
      empleados: empleadosDelLocalActivo,
      nominas: nominasDelLocalActivo,
      addNomina,
      updateNomina,
      deleteNomina,
      fichajes: fichajesDelLocalActivo,
      movimientos: movimientosDelLocalActivo
    }
  ), tab === "venta" && (localInformeId && localActivoId === localInformeId ? /* @__PURE__ */ import_react4.default.createElement(VentaRapida, { productos: productosDelLocalActivo, venderCarrito, anularVenta, movimientos: movimientosDelLocalActivo, registrarAuditoria, local: locales.find((l22) => l22.id === localActivoId) || null, configEmpresa: empresaDelLocalActivo }) : /* @__PURE__ */ import_react4.default.createElement("div", null, /* @__PURE__ */ import_react4.default.createElement(Card, { className: "p-5 mb-4" }, /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[16px] font-semibold mb-2" }, "TPV"), /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[12.5px]", style: { color: C2.inkSoft } }, "El TPV no puede abrirse en Todos los locales. Selecciona un local concreto: cada venta, stock y caja pertenecen a un \xFAnico local.")), /* @__PURE__ */ import_react4.default.createElement(SelectorLocalInformes, { locales: localesEmpresaActiva, valor: localInformeId, onChange: seleccionarContextoLocal }))), tab === "encargos" && /* @__PURE__ */ import_react4.default.createElement(
    Encargos,
    {
      encargosPendientes: encargosPendientesDelLocalActivo,
      encargos: encargosDelLocalActivo,
      clientes,
      productos: productosDelLocalActivo,
      addEncargo,
      updateEncargo,
      deleteEncargo,
      entregarEncargo,
      addCliente
    }
  ), tab === "clientes" && /* @__PURE__ */ import_react4.default.createElement(
    Clientes,
    {
      analisisClientes,
      clientesDormidos,
      ventaCruzada,
      addCliente,
      updateCliente,
      deleteCliente,
      anonimizarCliente
    }
  ), tab === "devoluciones" && /* @__PURE__ */ import_react4.default.createElement(
    Devoluciones,
    { key: localActivoId || "todos", productos: productosDelLocalActivo, proveedores, devoluciones: devolucionesDelLocalActivo, movimientos: movimientosDelLocalActivo, registrarDevolucionCliente, registrarDevolucionProveedor, leerBorradorDevolucion }
  ), tab === "facturas" && /* @__PURE__ */ import_react4.default.createElement(
    Facturas,
    {
      albaranes: albaranesDelLocalActivo,
      facturasDirectas: facturasDirectasDelLocalActivo,
      proveedorPorId,
     
```

### offset 4104287
```js
iminarAusencia,
      registrarEpi,
      eliminarEpi,
      documentosPersonalCaducan,
      fichajes: fichajesDelLocalActivo,
      nominas: nominasDelLocalActivo,
      entrevistas,
      crearEntrevista,
      actualizarEntrevista,
      finalizarEntrevista,
      eliminarEntrevista,
      crearPrefiltro,
      listarPrefiltros,
      eliminarPrefiltro,
      crearCuentaEmpleado
    }
  ), tab === "fichaje" && /* @__PURE__ */ import_react4.default.createElement(
    RegistroHorario,
    {
      empleados: empleadosDelLocalActivo,
      fichajes: fichajesDelLocalActivo,
      fichar,
      addFichajeManual,
      updateFichaje,
      eliminarFichaje,
      fichajesAbiertos: fichajesAbiertosDelLocalActivo
    }
  ), tab === "nominas" && /* @__PURE__ */ import_react4.default.createElement(
    CostePersonal,
    {
      empleados: empleadosDelLocalActivo,
      nominas: nominasDelLocalActivo,
      addNomina,
      updateNomina,
      deleteNomina,
      fichajes: fichajesDelLocalActivo,
      movimientos: movimientosDelLocalActivo
    }
  ), tab === "venta" && (localInformeId && localActivoId === localInformeId ? /* @__PURE__ */ import_react4.default.createElement(VentaRapida, { productos: productosDelLocalActivo, venderCarrito, anularVenta, movimientos: movimientosDelLocalActivo, registrarAuditoria, local: locales.find((l22) => l22.id === localActivoId) || null, configEmpresa: empresaDelLocalActivo }) : /* @__PURE__ */ import_react4.default.createElement("div", null, /* @__PURE__ */ import_react4.default.createElement(Card, { className: "p-5 mb-4" }, /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[16px] font-semibold mb-2" }, "TPV"), /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[12.5px]", style: { color: C2.inkSoft } }, "El TPV no puede abrirse en Todos los locales. Selecciona un local concreto: cada venta, stock y caja pertenecen a un \xFAnico local.")), /* @__PURE__ */ import_react4.default.createElement(SelectorLocalInformes, { locales: localesEmpresaActiva, valor: localInformeId, onChange: seleccionarContextoLocal }))), tab === "encargos" && /* @__PURE__ */ import_react4.default.createElement(
    Encargos,
    {
      encargosPendientes: encargosPendientesDelLocalActivo,
      encargos: encargosDelLocalActivo,
      clientes,
      productos: productosDelLocalActivo,
      addEncargo,
      updateEncargo,
      deleteEncargo,
      entregarEncargo,
      addCliente
    }
  ), tab === "clientes" && /* @__PURE__ */ import_react4.default.createElement(
    Clientes,
    {
      analisisClientes,
      clientesDormidos,
      ventaCruzada,
      addCliente,
      updateCliente,
      deleteCliente,
      anonimizarCliente
    }
  ), tab === "devoluciones" && /* @__PURE__ */ import_react4.default.createElement(
    Devoluciones,
    { key: localActivoId || "todos", productos: productosDelLocalActivo, proveedores, devoluciones: devolucionesDelLocalActivo, movimientos: movimientosDelLocalActivo, registrarDevolucionCliente, registrarDevolucionProveedor, leerBorradorDevolucion }
  ), tab === "facturas" && /* @__PURE__ */ import_react4.default.createElement(
    Facturas,
    {
      albaranes: albaranesDelLocalActivo,
      facturasDirectas: facturasDirectasDelLocalActivo,
      proveedorPorId,
      irAAlbaran: (albId) => {
        const a22 = albaranesDelLocalActivo.find((x3) => x3.id === albId);
        if (a22) {
          setPrefillAlbaran(a22);
          setTab("albaranes");
        }
      },
      irAFacturaDirecta: (fdId) => {
        if (!facturasDirectasDelLocalActivo.some((f22) => f22.id === fdId)) return;
        setFacturaDirectaResaltada(fdId);
        setTab("pagos");
      }
    }
  ), tab === "libroiva" && /* @__PURE__ */ import_react4.default.createElement(LibroIva, { movimientos: movimientosInforme, productos: productosInforme, albaranes: albaranesInforme, proveedorPorId, facturasDirectas: facturasDirectasInforme }), tab === "caja" && /* @__PURE__ */ import_react4.default.createElement(ArqueoCaja, { key: localActivoId || "todos", movimientos: movimientosDelLocalActivo, arqueos: arqueosDelLocalActivo, addArqueo, deleteArqueo, encargos: encargosDelLocalActivo, movimientosCaja: movimientosCajaDelLocalActivo, registrarMovimientoCaja, eliminarMovimientoCaja, leerBorradorArqueo, leerBorradorMovimientoCaja }), tab === "tesoreria" && /* @__PURE__ */ import_react4.default.createElement(Tesoreria, { proyeccionTesoreria, promedioDiarioVentas }), tab === "estacionalidad" && /* @__PURE__ */ import_react4.default.createElement(Estacionalidad, { ingresosPorMes }), tab === "turnos" && /* @__PURE__ */ import_react4.default.createElement(
    Turnos,
    {
      empleados: empleadosDelLocalActivo,
      turnos: turnosDelLocalActivo,
      addTurno,
      updateTurno,
      deleteTurno,
      copiarSemana
    }
  ), tab === "mapa" && /* @__PURE__ */ import_react4.default.createElement(MapaAlmacen, { productos: productosDelLocalActivo, proveedorPorId }), tab === "traspasos" && /* @__PURE__ */ import_react4.default.createElement(Traspasos, { productos: productosDelLocalActivo, productosEmpresa: productos.filter((p22) => localesEmpresaActiva.some((l22) => l22.id === p22.localId)), locales: localesEmpresaActiva, localActivoId, traspasos: traspasosDelLocalActivo, traspasarStock, traspasarEntreLocales, pisoVentaBajo: pisoVentaBajoDelLocalActivo, fichasCosto: fichasCostoDelLocalActivo }), tab === "appcc" && /* @__PURE__ */ import_react4.default.createElement(
    Appcc,
    {
      puntosControl: puntosControlDelLocalActivo,
      registrosAppcc: registrosAppccDelLocalActivo,
      addPuntoControl,
      updatePuntoControl,
      deleteP
```

### offset 4105431
```js
_ */ import_react4.default.createElement(VentaRapida, { productos: productosDelLocalActivo, venderCarrito, anularVenta, movimientos: movimientosDelLocalActivo, registrarAuditoria, local: locales.find((l22) => l22.id === localActivoId) || null, configEmpresa: empresaDelLocalActivo }) : /* @__PURE__ */ import_react4.default.createElement("div", null, /* @__PURE__ */ import_react4.default.createElement(Card, { className: "p-5 mb-4" }, /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[16px] font-semibold mb-2" }, "TPV"), /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[12.5px]", style: { color: C2.inkSoft } }, "El TPV no puede abrirse en Todos los locales. Selecciona un local concreto: cada venta, stock y caja pertenecen a un \xFAnico local.")), /* @__PURE__ */ import_react4.default.createElement(SelectorLocalInformes, { locales: localesEmpresaActiva, valor: localInformeId, onChange: seleccionarContextoLocal }))), tab === "encargos" && /* @__PURE__ */ import_react4.default.createElement(
    Encargos,
    {
      encargosPendientes: encargosPendientesDelLocalActivo,
      encargos: encargosDelLocalActivo,
      clientes,
      productos: productosDelLocalActivo,
      addEncargo,
      updateEncargo,
      deleteEncargo,
      entregarEncargo,
      addCliente
    }
  ), tab === "clientes" && /* @__PURE__ */ import_react4.default.createElement(
    Clientes,
    {
      analisisClientes,
      clientesDormidos,
      ventaCruzada,
      addCliente,
      updateCliente,
      deleteCliente,
      anonimizarCliente
    }
  ), tab === "devoluciones" && /* @__PURE__ */ import_react4.default.createElement(
    Devoluciones,
    { key: localActivoId || "todos", productos: productosDelLocalActivo, proveedores, devoluciones: devolucionesDelLocalActivo, movimientos: movimientosDelLocalActivo, registrarDevolucionCliente, registrarDevolucionProveedor, leerBorradorDevolucion }
  ), tab === "facturas" && /* @__PURE__ */ import_react4.default.createElement(
    Facturas,
    {
      albaranes: albaranesDelLocalActivo,
      facturasDirectas: facturasDirectasDelLocalActivo,
      proveedorPorId,
      irAAlbaran: (albId) => {
        const a22 = albaranesDelLocalActivo.find((x3) => x3.id === albId);
        if (a22) {
          setPrefillAlbaran(a22);
          setTab("albaranes");
        }
      },
      irAFacturaDirecta: (fdId) => {
        if (!facturasDirectasDelLocalActivo.some((f22) => f22.id === fdId)) return;
        setFacturaDirectaResaltada(fdId);
        setTab("pagos");
      }
    }
  ), tab === "libroiva" && /* @__PURE__ */ import_react4.default.createElement(LibroIva, { movimientos: movimientosInforme, productos: productosInforme, albaranes: albaranesInforme, proveedorPorId, facturasDirectas: facturasDirectasInforme }), tab === "caja" && /* @__PURE__ */ import_react4.default.createElement(ArqueoCaja, { key: localActivoId || "todos", movimientos: movimientosDelLocalActivo, arqueos: arqueosDelLocalActivo, addArqueo, deleteArqueo, encargos: encargosDelLocalActivo, movimientosCaja: movimientosCajaDelLocalActivo, registrarMovimientoCaja, eliminarMovimientoCaja, leerBorradorArqueo, leerBorradorMovimientoCaja }), tab === "tesoreria" && /* @__PURE__ */ import_react4.default.createElement(Tesoreria, { proyeccionTesoreria, promedioDiarioVentas }), tab === "estacionalidad" && /* @__PURE__ */ import_react4.default.createElement(Estacionalidad, { ingresosPorMes }), tab === "turnos" && /* @__PURE__ */ import_react4.default.createElement(
    Turnos,
    {
      empleados: empleadosDelLocalActivo,
      turnos: turnosDelLocalActivo,
      addTurno,
      updateTurno,
      deleteTurno,
      copiarSemana
    }
  ), tab === "mapa" && /* @__PURE__ */ import_react4.default.createElement(MapaAlmacen, { productos: productosDelLocalActivo, proveedorPorId }), tab === "traspasos" && /* @__PURE__ */ import_react4.default.createElement(Traspasos, { productos: productosDelLocalActivo, productosEmpresa: productos.filter((p22) => localesEmpresaActiva.some((l22) => l22.id === p22.localId)), locales: localesEmpresaActiva, localActivoId, traspasos: traspasosDelLocalActivo, traspasarStock, traspasarEntreLocales, pisoVentaBajo: pisoVentaBajoDelLocalActivo, fichasCosto: fichasCostoDelLocalActivo }), tab === "appcc" && /* @__PURE__ */ import_react4.default.createElement(
    Appcc,
    {
      puntosControl: puntosControlDelLocalActivo,
      registrosAppcc: registrosAppccDelLocalActivo,
      addPuntoControl,
      updatePuntoControl,
      deletePuntoControl,
      registrarAppcc,
      eliminarRegistroAppcc,
      appccPendientesHoy,
      productos: productosDelLocalActivo,
      fichasCosto: fichasCostoDelLocalActivo,
      alergenosDeFicha
    }
  ), tab === "saldo" && /* @__PURE__ */ import_react4.default.createElement(SaldoAlmacen, { productos: productosDelLocalActivo, proveedores, valorInventario: valorInventarioDelLocalActivo, valorUtillaje: valorUtillajeDelLocalActivo, proveedorPorId, clasificacionABC: clasificacionABCDelLocalActivo, analisisABC: analisisABCDelLocalActivo }), tab === "respaldos" && /* @__PURE__ */ import_react4.default.createElement(
    Respaldos,
    {
      historial,
      crearPuntoDeGuardado,
      restaurarDesdeHistorial,
      abrirRespaldo,
      abrirRestaurar,
      exportarExcelGeneral,
      pinPropietario,
      establecerPin,
      activarModoEmpleado
    }
  ), tab === "auditoria" && /* @__PURE__ */ import_react4.default.createElement(Auditoria, { auditoria }), tab === "diagnostico" && /* @__PURE__ */ import_react4.default.createElement(DiagnosticoStock, { diagnostico: diagnosticoStockDelLocalActivo, corregirProducto, movimient
```

### offset 4105970
```js
" }, "TPV"), /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[12.5px]", style: { color: C2.inkSoft } }, "El TPV no puede abrirse en Todos los locales. Selecciona un local concreto: cada venta, stock y caja pertenecen a un \xFAnico local.")), /* @__PURE__ */ import_react4.default.createElement(SelectorLocalInformes, { locales: localesEmpresaActiva, valor: localInformeId, onChange: seleccionarContextoLocal }))), tab === "encargos" && /* @__PURE__ */ import_react4.default.createElement(
    Encargos,
    {
      encargosPendientes: encargosPendientesDelLocalActivo,
      encargos: encargosDelLocalActivo,
      clientes,
      productos: productosDelLocalActivo,
      addEncargo,
      updateEncargo,
      deleteEncargo,
      entregarEncargo,
      addCliente
    }
  ), tab === "clientes" && /* @__PURE__ */ import_react4.default.createElement(
    Clientes,
    {
      analisisClientes,
      clientesDormidos,
      ventaCruzada,
      addCliente,
      updateCliente,
      deleteCliente,
      anonimizarCliente
    }
  ), tab === "devoluciones" && /* @__PURE__ */ import_react4.default.createElement(
    Devoluciones,
    { key: localActivoId || "todos", productos: productosDelLocalActivo, proveedores, devoluciones: devolucionesDelLocalActivo, movimientos: movimientosDelLocalActivo, registrarDevolucionCliente, registrarDevolucionProveedor, leerBorradorDevolucion }
  ), tab === "facturas" && /* @__PURE__ */ import_react4.default.createElement(
    Facturas,
    {
      albaranes: albaranesDelLocalActivo,
      facturasDirectas: facturasDirectasDelLocalActivo,
      proveedorPorId,
      irAAlbaran: (albId) => {
        const a22 = albaranesDelLocalActivo.find((x3) => x3.id === albId);
        if (a22) {
          setPrefillAlbaran(a22);
          setTab("albaranes");
        }
      },
      irAFacturaDirecta: (fdId) => {
        if (!facturasDirectasDelLocalActivo.some((f22) => f22.id === fdId)) return;
        setFacturaDirectaResaltada(fdId);
        setTab("pagos");
      }
    }
  ), tab === "libroiva" && /* @__PURE__ */ import_react4.default.createElement(LibroIva, { movimientos: movimientosInforme, productos: productosInforme, albaranes: albaranesInforme, proveedorPorId, facturasDirectas: facturasDirectasInforme }), tab === "caja" && /* @__PURE__ */ import_react4.default.createElement(ArqueoCaja, { key: localActivoId || "todos", movimientos: movimientosDelLocalActivo, arqueos: arqueosDelLocalActivo, addArqueo, deleteArqueo, encargos: encargosDelLocalActivo, movimientosCaja: movimientosCajaDelLocalActivo, registrarMovimientoCaja, eliminarMovimientoCaja, leerBorradorArqueo, leerBorradorMovimientoCaja }), tab === "tesoreria" && /* @__PURE__ */ import_react4.default.createElement(Tesoreria, { proyeccionTesoreria, promedioDiarioVentas }), tab === "estacionalidad" && /* @__PURE__ */ import_react4.default.createElement(Estacionalidad, { ingresosPorMes }), tab === "turnos" && /* @__PURE__ */ import_react4.default.createElement(
    Turnos,
    {
      empleados: empleadosDelLocalActivo,
      turnos: turnosDelLocalActivo,
      addTurno,
      updateTurno,
      deleteTurno,
      copiarSemana
    }
  ), tab === "mapa" && /* @__PURE__ */ import_react4.default.createElement(MapaAlmacen, { productos: productosDelLocalActivo, proveedorPorId }), tab === "traspasos" && /* @__PURE__ */ import_react4.default.createElement(Traspasos, { productos: productosDelLocalActivo, productosEmpresa: productos.filter((p22) => localesEmpresaActiva.some((l22) => l22.id === p22.localId)), locales: localesEmpresaActiva, localActivoId, traspasos: traspasosDelLocalActivo, traspasarStock, traspasarEntreLocales, pisoVentaBajo: pisoVentaBajoDelLocalActivo, fichasCosto: fichasCostoDelLocalActivo }), tab === "appcc" && /* @__PURE__ */ import_react4.default.createElement(
    Appcc,
    {
      puntosControl: puntosControlDelLocalActivo,
      registrosAppcc: registrosAppccDelLocalActivo,
      addPuntoControl,
      updatePuntoControl,
      deletePuntoControl,
      registrarAppcc,
      eliminarRegistroAppcc,
      appccPendientesHoy,
      productos: productosDelLocalActivo,
      fichasCosto: fichasCostoDelLocalActivo,
      alergenosDeFicha
    }
  ), tab === "saldo" && /* @__PURE__ */ import_react4.default.createElement(SaldoAlmacen, { productos: productosDelLocalActivo, proveedores, valorInventario: valorInventarioDelLocalActivo, valorUtillaje: valorUtillajeDelLocalActivo, proveedorPorId, clasificacionABC: clasificacionABCDelLocalActivo, analisisABC: analisisABCDelLocalActivo }), tab === "respaldos" && /* @__PURE__ */ import_react4.default.createElement(
    Respaldos,
    {
      historial,
      crearPuntoDeGuardado,
      restaurarDesdeHistorial,
      abrirRespaldo,
      abrirRestaurar,
      exportarExcelGeneral,
      pinPropietario,
      establecerPin,
      activarModoEmpleado
    }
  ), tab === "auditoria" && /* @__PURE__ */ import_react4.default.createElement(Auditoria, { auditoria }), tab === "diagnostico" && /* @__PURE__ */ import_react4.default.createElement(DiagnosticoStock, { diagnostico: diagnosticoStockDelLocalActivo, corregirProducto, movimientosParaReconciliar }), tab === "notificaciones" && /* @__PURE__ */ import_react4.default.createElement(Notificaciones, { localActivoId }), tab === "errores_sistema" && /* @__PURE__ */ import_react4.default.createElement(ErroresSistema, null), tab === "locales" && /* @__PURE__ */ import_react4.default.createElement(Locales, { locales, localActivoId, crearLocal, actualizarLocal, desactivarLocal, cambiarLocalActivo: cambiarLocalActivoConVista, configEmpresa, empresas, setEmpresas }));
  const itemsMeta = [
    { id: "dashboard", label: "
```

## pedidos:

### offset 4035791
```js
fy(ra || [])) await saveKey("registrosAppcc", registrosAppccFinales);
      if (JSON.stringify(freidorasFinales) !== JSON.stringify(fre || [])) await saveKey("freidoras", freidorasFinales);
      if (JSON.stringify(registrosAceiteFinales) !== JSON.stringify(rac || [])) await saveKey("registrosAceite", registrosAceiteFinales);
      setReady(true);
      if (habiaFotos) await saveKey("albaranes", albaranesFinales);
      setTimeout(() => {
        skipSaveRef.current = false;
      }, 400);
      if (!autoSnapshotRef.current) {
        autoSnapshotRef.current = true;
        const tieneDatos = p22.length || pr.length || pe2.length || mo.length || co.length || fc.length || al.length || em.length;
        const hoy = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
        const yaHayUnoDeHoy = hi.some((h22) => h22.automatica && (h22.fecha || "").slice(0, 10) === hoy);
        if (tieneDatos && !yaHayUnoDeHoy) {
          const snapshot = {
            id: uid(),
            fecha: (/* @__PURE__ */ new Date()).toISOString(),
            automatica: true,
            motivo: "automatico-diario",
            backupVersion: 3,
            data: { proveedores: p22, productos: pr, pedidos: pe2, movimientos: mo, conteos: co, fichasCosto: fc, albaranes: alLimpios, catalogoProv: cp, gastosGenerales: gg, empleados: em, fichajes: fj, registrosAppcc: ra, puntosControl: pc, clientes: cl, encargos: en, arqueos: aq, turnos: tu, nominas: nom, facturasDirectas: fd2, ordenesProduccion: op, traspasos: tr, auditoria: au, freidoras: fre, registrosAceite: rac }
          };
          const historialFinal = [snapshot, ...hi].slice(0, 30);
          setHistorial(historialFinal);
          await saveKey("historialRespaldos", historialFinal);
        }
      }
    })();
  }, []);
  (0, import_react4.useEffect)(() => {
    if (ready && !skipSaveRef.current) saveKey("proveedores", proveedores);
  }, [proveedores, ready]);
  (0, import_react4.useEffect)(() => {
    if (ready && !skipSaveRef.current) saveKey("productos", productos);
  }, [productos, ready]);
  (0, import_react4.useEffect)(() => {
    if (ready && !skipSaveRef.current) saveKey("pedidos", pedidos2);
  }, [pedidos2, ready]);
  (0, import_react4.useEffect)(() => {
    if (ready && !skipSaveRef.current) saveKey("movimientos", movimientos);
  }, [movimientos, ready]);
  (0, import_react4.useEffect)(() => {
    if (ready && !skipSaveRef.current) saveKey("conteos", conteos);
  }, [conteos, ready]);
  (0, import_react4.useEffect)(() => {
    if (ready && !skipSaveRef.current) saveKey("fichasCosto", fichasCosto);
  }, [fichasCosto, ready]);
  (0, import_react4.useEffect)(() => {
    if (ready && !skipSaveRef.current) saveKey("historialRespaldos", historial);
  }, [historial, ready]);
  (0, import_react4.useEffect)(() => {
    if (ready && !skipSaveRef.current) saveKey("albaranes", albaranes);
  }, [albaranes, ready]);
  (0, import_react4.useEffect)(() => {
    if (ready && !skipSaveRef.current) saveKey("catalogoProv", catalogoProv);
  }, [catalogoProv, ready]);
  (0, import_react4.useEffect)(() => {
    if (ready && !skipSaveRef.current) saveKey("gastosGenerales", gastosGenerales);
  }, [gastosGenerales, ready]);
  (0, import_react4.useEffect)(() => {
    if (ready && !skipSaveRef.current) saveKey("empleados", empleados);
  }, [empleados, ready]);
  (0, import_react4.useEffect)(() => {
    if (ready && !skipSaveRef.current) saveKey("fichajes", fichajes);
  }, [fichajes, ready]);
  (0, import_react4.useEffect)(() => {
    if (ready && !skipSaveRef.current) saveKey("disenoMenu", disenoMenu);
  }, [disenoMenu, ready]);
  (0, import_react4.useEffect)(() => {
    if (ready && !skipSaveRef.current) saveKey("registrosAppcc", registrosAppcc);
  }, [registrosAppcc, ready]);
  (0, import_react4.useEffect)(() => {
    if (ready && !skipSaveRef.current) saveKey("freidoras", freidoras);
  }, [freidoras, ready]);
  (0, import_react4.useEffect)(() => {
    if (ready && !skipSaveRef.current) saveKey("registrosAceite", registrosAceite);
  }, [registrosAceite, ready]);
  (0, import_react4.useEffect)(() => {
    if (ready && !skipSaveRef.current) saveKey("puntosControl", puntosControl);
  }, [puntosControl, ready]);
  (0, import_react4.useEffect)(() => {
    if (ready && !skipSaveRef.current) saveKey("clientes", clientes);
  }, [clientes, ready]);
  (0, import_react4.useEffect)(() => {
    if (ready && !skipSaveRef.current) saveKey("encargos", encargos);
  }, [encargos, ready]);
  (0, import_react4.useEffect)(() => {
    if (ready && !skipSaveRef.current) saveKey("arqueos", arqueos);
  }, [arqueos, ready]);
  (0, import_react4.useEffect)(() => {
    if (ready && !skipSaveRef.current) saveKey("movimientosCaja", movimientosCaja);
  }, [movimientosCaja, ready]);
  (0, import_react4.useEffect)(() => {
    if (ready && !skipSaveRef.current) saveKey("devoluciones", devoluciones);
  }, [devoluciones, ready]);
  (0, import_react4.useEffect)(() => {
    if (ready && !skipSaveRef.current) saveKey("locales", locales);
  }, [locales, ready]);
  (0, import_react4.useEffect)(() => {
    if (ready && !skipSaveRef.current) saveKey("empresas", empresas);
  }, [empresas, ready]);
  (0, import_react4.useEffect)(() => {
    if (ready && !skipSaveRef.current) saveKey("configEmpresa", configEmpresa);
  }, [configEmpresa, ready]);
  (0, import_react4.useEffect)(() => {
    if (ready && !skipSaveRef.current) saveKey("localActivoId", localActivoId);
  }, [localActivoId, ready]);
  (0, import_react4.useEffect)(() => {
    if (ready && !skipSaveRef.current) saveKey("turnos", turnos);
  }, [turnos, ready]);
  (0, import_react4.useEffect)(() => {
    if (ready && !skipSaveRef.current) saveKey("temaOscuro", 
```

### offset 4043674
```js
proveedorPorId = (id) => proveedores.find((p22) => p22.id === id);
  const [prefillAlbaran, setPrefillAlbaran] = (0, import_react4.useState)(null);
  const [facturaDirectaResaltada, setFacturaDirectaResaltada] = (0, import_react4.useState)(null);
  const [pedidoParaFotoIA, setPedidoParaFotoIA] = (0, import_react4.useState)(null);
  const [pendingRestore, setPendingRestore] = (0, import_react4.useState)(null);
  const [restoreError, setRestoreError] = (0, import_react4.useState)("");
  const [showBackupView, setShowBackupView] = (0, import_react4.useState)(false);
  const [backupText, setBackupText] = (0, import_react4.useState)("");
  const [showRestoreInput, setShowRestoreInput] = (0, import_react4.useState)(false);
  const [restoreText, setRestoreText] = (0, import_react4.useState)("");
  const [copiado, setCopiado] = (0, import_react4.useState)(false);
  const {
    crearPuntoDeGuardado,
    restaurarDesdeHistorial,
    abrirRespaldo,
    copiarRespaldo,
    abrirRestaurar,
    analizarTextoRestauracion,
    confirmarRestauracion,
    exportarExcelGeneral,
    compararConEstadoActual,
    coleccionesQueSeConservan
  } = crearLogicaRespaldos({
    proveedores,
    productos,
    pedidos: pedidos2,
    movimientos,
    conteos,
    fichasCosto,
    albaranes,
    catalogoProv,
    gastosGenerales,
    empleados,
    fichajes,
    registrosAppcc,
    puntosControl,
    clientes,
    encargos,
    arqueos,
    turnos,
    nominas,
    facturasDirectas,
    ordenesProduccion,
    traspasos,
    auditoria,
    freidoras,
    registrosAceite,
    setProveedores,
    setProductos,
    setPedidos,
    setMovimientos,
    setConteos,
    setFichasCosto,
    setAlbaranes,
    setCatalogoProv,
    setGastosGenerales,
    setEmpleados,
    setFichajes,
    setRegistrosAppcc,
    setPuntosControl,
    setClientes,
    setEncargos,
    setArqueos,
    setTurnos,
    setNominas,
    setFacturasDirectas,
    setOrdenesProduccion,
    setTraspasos,
    setAuditoria,
    setFreidoras,
    setRegistrosAceite,
    setHistorial,
    setPendingRestore,
    pendingRestore,
    setBackupText,
    backupText,
    setCopiado,
    setShowBackupView,
    setShowRestoreInput,
    setRestoreText,
    restoreText,
    setRestoreError,
    proveedorPorId,
    productoPorId,
    registrarAuditoria
  });
  const { addProveedor, updateProveedor, deleteProveedor } = crearLogicaProveedores({ proveedores, setProveedores, registrarAuditoria, empresaId: empresaDelLocalActivo?.id || null });
  const { addGasto, deleteGasto } = crearLogicaGastos({ setGastosGenerales, localActivoId, empresaId: empresaDelLocalActivo?.id || null });
  const { addEmpleado, updateEmpleado, deleteEmpleado, anonimizarEmpleado, registrarAusencia, eliminarAusencia, registrarEpi, eliminarEpi, crearCuentaEmpleado } = crearLogicaPersonal({ empleados, setEmpleados, registrarAuditoria, setNominas, localActivoId });
  const { addTurno, updateTurno, deleteTurno, copiarSemana } = crearLogicaTurnos({ turnos, setTurnos, empleados, localActivoId });
  const { producir, anularProduccion } = crearLogicaProduccion({ fichasCosto, productos, setProductos, movimientos, setMovimientos, setOrdenesProduccion, registrarAuditoria, localActivoId });
  const { venderCarrito, venderLocal, anularVenta, venderLineas } = crearLogicaVenta({ productos, setProductos, movimientos, setMovimientos, arqueos, localActivoId });
  const { addCliente, updateCliente, deleteCliente, anonimizarCliente } = crearLogicaClientes({ clientes, setClientes, registrarAuditoria, empresaId: empresaDelLocalActivo?.id || null });
  const { addEncargo, updateEncargo, deleteEncargo, entregarEncargo } = crearLogicaEncargos({ encargos, setEncargos, registrarAuditoria, productos, clientes, setProductos, setMovimientos, venderLineas, localActivoId, empresaId: empresaDelLocalActivo?.id || null });
  const { traspasarStock, traspasarEntreLocales } = crearLogicaTraspasos({ productos, setProductos, movimientos, setMovimientos, setTraspasos, registrarAuditoria, localActivoId, locales });
  const { addArqueo, deleteArqueo, leerBorradorArqueo } = crearLogicaCaja({ arqueos, setArqueos, movimientosCaja, setMovimientosCaja, localActivoId, empresaId: empresaDelLocalActivo?.id || null });
  const { registrarMovimientoCaja, eliminarMovimientoCaja, leerBorradorMovimientoCaja } = crearLogicaMovimientosCaja({ movimientosCaja, setMovimientosCaja, arqueos, setArqueos, registrarAuditoria, localActivoId, empresaId: empresaDelLocalActivo?.id || null });
  const { crearLocal, actualizarLocal, desactivarLocal, cambiarLocalActivo } = crearLogicaLocales({ locales, setLocales, localActivoId, setLocalActivoId, registrarAuditoria });
  function seleccionarContextoLocal(id) {
    const siguiente = id || "";
    setLocalInformeId(siguiente);
    if (siguiente && locales.some((l22) => l22.id === siguiente && l22.activo !== false && !l22.fusionadoEn)) {
      cambiarLocalActivo(siguiente);
    }
  }
  function cambiarLocalActivoConVista(id) {
    cambiarLocalActivo(id);
    if (locales.some((l22) => l22.id === id && l22.activo !== false && !l22.fusionadoEn)) setLocalInformeId(id);
  }
  const { registrarDevolucionCliente, registrarDevolucionProveedor, leerBorradorDevolucion } = crearLogicaDevoluciones({ productos, setProductos, movimientos, setMovimientos, devoluciones, setDevoluciones, setMovimientosCaja, setArqueos, registrarAuditoria, localActivoId, empresaId: empresaDelLocalActivo?.id || null });
  const { activarModoEmpleado, entrarComoEmpleado, salirModoEmpleado, establecerPin } = crearLogicaSeguridad({ pinPropietario, setPinPropietario, empleados, setModoEmpleado, setUsuarioActivoId });
  const { addPuntoControl, updatePuntoControl, deletePun
```

### offset 4050281
```js
ertirUltimaAplicacion } = crearLogicaConteos({ productos, setProductos, conteos, setConteos, movimientos, setMovimientos, registrarAuditoria, localActivoId });
  const conteoAbierto = (0, import_react4.useMemo)(() => conteosDelLocalActivo.find((c22) => !c22.completado) || null, [conteosDelLocalActivo]);
  const almacenCongelado = !!conteoAbierto;
  const { addProducto, updateProducto, deleteProducto, reactivarProducto, registrarSalida, ajustarProductoPorOtro } = crearLogicaProductos({ productos, setProductos, movimientos, setMovimientos, registrarAuditoria, almacenCongelado, addGasto, localActivoId });
  const { diagnosticarStock, corregirProducto, movimientosParaReconciliar } = crearLogicaReconciliacion({ productos, setProductos, movimientos, setMovimientos, registrarAuditoria, localActivoId });
  const { buscarEnCatalogo, aprenderReferencia, guardarAlbaran, eliminarAlbaran, marcarPagada, confirmarAlbaran, anularAlbaran, recibirConAlbaran, recibirConFotoIA, duplicadosDe, desviacionesDePrecio, procesarRecepcion } = crearLogicaAlbaranes({
    catalogoProv,
    setCatalogoProv,
    albaranes,
    setAlbaranes,
    productos,
    setProductos,
    movimientos,
    setMovimientos,
    pedidos: pedidos2,
    setPedidos,
    registrarAuditoria,
    proveedorPorId,
    setPrefillAlbaran,
    setPedidoParaFotoIA,
    setTab,
    localActivoId,
    empresaId: empresaDelLocalActivo?.id || null,
    pagosFacturas,
    setPagosFacturas
  });
  const { crearPedido, actualizarPedido, eliminarPedido, recibirPedido, cerrarPedido } = crearLogicaPedidos({ pedidos: pedidos2, setPedidos, productos, proveedores, setProductos, setMovimientos, almacenCongelado, procesarRecepcion, localActivoId });
  const { addFacturaDirecta, updateFacturaDirecta, deleteFacturaDirecta, marcarPagadaFacturaDirecta } = crearLogicaFacturasDirectas({ facturasDirectas, setFacturasDirectas, registrarAuditoria, proveedores, pagosFacturas, setPagosFacturas, localActivoId, empresaId: empresaDelLocalActivo?.id || null });
  const { addNomina, updateNomina, deleteNomina } = crearLogicaNominas({ nominas, setNominas, registrarAuditoria, empleados, localActivoId });
  const { crearEntrevista, actualizarEntrevista, finalizarEntrevista, eliminarEntrevista } = crearLogicaEntrevistas({ entrevistas, setEntrevistas, registrarAuditoria });
  const { crearPrefiltro, listarPrefiltros, eliminarPrefiltro } = crearLogicaPrefiltros({ registrarAuditoria });
  function registrarAuditoria(accion, detalle) {
    const empleadoActivo = usuarioActivoId ? empleados.find((e2) => e2.id === usuarioActivoId) : null;
    const usuario = modoEmpleado ? empleadoActivo ? empleadoActivo.nombre : "Empleado sin identificar" : "Propietario/a";
    const entrada = { id: uid(), fecha: todayISO(), hora: (/* @__PURE__ */ new Date()).toTimeString().slice(0, 5), usuario, accion, detalle, empresaId: empresaDelLocalActivo?.id || null, localId: localActivoId || null };
    const hayConexion = typeof window !== "undefined" && window.__nubeActiva && typeof window.getSupabaseClient === "function";
    if (!hayConexion) {
      setAuditoria((s22) => [entrada, ...s22].slice(0, 500));
      return;
    }
    (async () => {
      try {
        const supabase = await window.getSupabaseClient();
        const r2 = await Promise.race([
          supabase.rpc("registrar_auditoria", {
            p_id: entrada.id,
            p_usuario: usuario,
            p_accion: accion,
            p_detalle: detalle,
            p_fecha: entrada.fecha,
            p_hora: entrada.hora,
            p_empresa_id: entrada.empresaId,
            p_local_id: entrada.localId
          }),
          new Promise((_22, reject) => setTimeout(() => reject(new Error("La auditor\xEDa tard\xF3 demasiado en responder")), 6e3))
        ]);
        if (r2.error) throw r2.error;
        const rAud = await supabase.from("auditoria_registro").select("datos").order("creado_en", { ascending: false }).limit(500);
        if (!rAud.error && rAud.data) setAuditoria(rAud.data.map((fila) => fila.datos));
      } catch (e2) {
        setAuditoria((s22) => [entrada, ...s22].slice(0, 500));
      }
    })();
  }
  const esUtillaje = (p22) => esNoMercancia(p22);
  const valorInventario = (0, import_react4.useMemo)(
    () => productos.filter((p22) => !esUtillaje(p22)).reduce((acc, p22) => acc + (Number(p22.stock) || 0) * Number(p22.costo || 0), 0),
    [productos]
  );
  const valorUtillaje = (0, import_react4.useMemo)(
    () => productos.filter(esUtillaje).reduce((acc, p22) => acc + (Number(p22.stock) || 0) * Number(p22.costo || 0), 0),
    [productos]
  );
  const valorInventarioDelLocalActivo = (0, import_react4.useMemo)(
    () => productosDelLocalActivo.filter((p22) => !esUtillaje(p22)).reduce((acc, p22) => acc + (Number(p22.stock) || 0) * Number(p22.costo || 0), 0),
    [productosDelLocalActivo]
  );
  const valorUtillajeDelLocalActivo = (0, import_react4.useMemo)(
    () => productosDelLocalActivo.filter(esUtillaje).reduce((acc, p22) => acc + (Number(p22.stock) || 0) * Number(p22.costo || 0), 0),
    [productosDelLocalActivo]
  );
  const stockBajo = (0, import_react4.useMemo)(
    () => productos.filter((p22) => p22.tipo !== "elaborado" && (p22._pm07Servidor ? p22._pm07BajoMinimo === true : Number(p22.stock) < Number(p22.stockMinimo || 0))),
    [productos]
  );
  const stockBajoDelLocalActivo = (0, import_react4.useMemo)(
    () => productosDelLocalActivo.filter((p22) => p22.tipo !== "elaborado" && (p22._pm07Servidor ? p22._pm07BajoMinimo === true : Number(p22.stock) < Number(p22.stockMinimo || 0))),
    [productosDelLocalActivo]
  );
  const diagnosticoStock = (0, import_react4.useMemo)(() => diagnosticarStock(), [productos, movi
```

### offset 4050645
```js
oducto, updateProducto, deleteProducto, reactivarProducto, registrarSalida, ajustarProductoPorOtro } = crearLogicaProductos({ productos, setProductos, movimientos, setMovimientos, registrarAuditoria, almacenCongelado, addGasto, localActivoId });
  const { diagnosticarStock, corregirProducto, movimientosParaReconciliar } = crearLogicaReconciliacion({ productos, setProductos, movimientos, setMovimientos, registrarAuditoria, localActivoId });
  const { buscarEnCatalogo, aprenderReferencia, guardarAlbaran, eliminarAlbaran, marcarPagada, confirmarAlbaran, anularAlbaran, recibirConAlbaran, recibirConFotoIA, duplicadosDe, desviacionesDePrecio, procesarRecepcion } = crearLogicaAlbaranes({
    catalogoProv,
    setCatalogoProv,
    albaranes,
    setAlbaranes,
    productos,
    setProductos,
    movimientos,
    setMovimientos,
    pedidos: pedidos2,
    setPedidos,
    registrarAuditoria,
    proveedorPorId,
    setPrefillAlbaran,
    setPedidoParaFotoIA,
    setTab,
    localActivoId,
    empresaId: empresaDelLocalActivo?.id || null,
    pagosFacturas,
    setPagosFacturas
  });
  const { crearPedido, actualizarPedido, eliminarPedido, recibirPedido, cerrarPedido } = crearLogicaPedidos({ pedidos: pedidos2, setPedidos, productos, proveedores, setProductos, setMovimientos, almacenCongelado, procesarRecepcion, localActivoId });
  const { addFacturaDirecta, updateFacturaDirecta, deleteFacturaDirecta, marcarPagadaFacturaDirecta } = crearLogicaFacturasDirectas({ facturasDirectas, setFacturasDirectas, registrarAuditoria, proveedores, pagosFacturas, setPagosFacturas, localActivoId, empresaId: empresaDelLocalActivo?.id || null });
  const { addNomina, updateNomina, deleteNomina } = crearLogicaNominas({ nominas, setNominas, registrarAuditoria, empleados, localActivoId });
  const { crearEntrevista, actualizarEntrevista, finalizarEntrevista, eliminarEntrevista } = crearLogicaEntrevistas({ entrevistas, setEntrevistas, registrarAuditoria });
  const { crearPrefiltro, listarPrefiltros, eliminarPrefiltro } = crearLogicaPrefiltros({ registrarAuditoria });
  function registrarAuditoria(accion, detalle) {
    const empleadoActivo = usuarioActivoId ? empleados.find((e2) => e2.id === usuarioActivoId) : null;
    const usuario = modoEmpleado ? empleadoActivo ? empleadoActivo.nombre : "Empleado sin identificar" : "Propietario/a";
    const entrada = { id: uid(), fecha: todayISO(), hora: (/* @__PURE__ */ new Date()).toTimeString().slice(0, 5), usuario, accion, detalle, empresaId: empresaDelLocalActivo?.id || null, localId: localActivoId || null };
    const hayConexion = typeof window !== "undefined" && window.__nubeActiva && typeof window.getSupabaseClient === "function";
    if (!hayConexion) {
      setAuditoria((s22) => [entrada, ...s22].slice(0, 500));
      return;
    }
    (async () => {
      try {
        const supabase = await window.getSupabaseClient();
        const r2 = await Promise.race([
          supabase.rpc("registrar_auditoria", {
            p_id: entrada.id,
            p_usuario: usuario,
            p_accion: accion,
            p_detalle: detalle,
            p_fecha: entrada.fecha,
            p_hora: entrada.hora,
            p_empresa_id: entrada.empresaId,
            p_local_id: entrada.localId
          }),
          new Promise((_22, reject) => setTimeout(() => reject(new Error("La auditor\xEDa tard\xF3 demasiado en responder")), 6e3))
        ]);
        if (r2.error) throw r2.error;
        const rAud = await supabase.from("auditoria_registro").select("datos").order("creado_en", { ascending: false }).limit(500);
        if (!rAud.error && rAud.data) setAuditoria(rAud.data.map((fila) => fila.datos));
      } catch (e2) {
        setAuditoria((s22) => [entrada, ...s22].slice(0, 500));
      }
    })();
  }
  const esUtillaje = (p22) => esNoMercancia(p22);
  const valorInventario = (0, import_react4.useMemo)(
    () => productos.filter((p22) => !esUtillaje(p22)).reduce((acc, p22) => acc + (Number(p22.stock) || 0) * Number(p22.costo || 0), 0),
    [productos]
  );
  const valorUtillaje = (0, import_react4.useMemo)(
    () => productos.filter(esUtillaje).reduce((acc, p22) => acc + (Number(p22.stock) || 0) * Number(p22.costo || 0), 0),
    [productos]
  );
  const valorInventarioDelLocalActivo = (0, import_react4.useMemo)(
    () => productosDelLocalActivo.filter((p22) => !esUtillaje(p22)).reduce((acc, p22) => acc + (Number(p22.stock) || 0) * Number(p22.costo || 0), 0),
    [productosDelLocalActivo]
  );
  const valorUtillajeDelLocalActivo = (0, import_react4.useMemo)(
    () => productosDelLocalActivo.filter(esUtillaje).reduce((acc, p22) => acc + (Number(p22.stock) || 0) * Number(p22.costo || 0), 0),
    [productosDelLocalActivo]
  );
  const stockBajo = (0, import_react4.useMemo)(
    () => productos.filter((p22) => p22.tipo !== "elaborado" && (p22._pm07Servidor ? p22._pm07BajoMinimo === true : Number(p22.stock) < Number(p22.stockMinimo || 0))),
    [productos]
  );
  const stockBajoDelLocalActivo = (0, import_react4.useMemo)(
    () => productosDelLocalActivo.filter((p22) => p22.tipo !== "elaborado" && (p22._pm07Servidor ? p22._pm07BajoMinimo === true : Number(p22.stock) < Number(p22.stockMinimo || 0))),
    [productosDelLocalActivo]
  );
  const diagnosticoStock = (0, import_react4.useMemo)(() => diagnosticarStock(), [productos, movimientos]);
  const idsProductosDelLocalActivo = (0, import_react4.useMemo)(() => new Set(productosDelLocalActivo.map((p22) => p22.id)), [productosDelLocalActivo]);
  const diagnosticoStockDelLocalActivo = (0, import_react4.useMemo)(() => diagnosticoStock.filter((d2) => idsProductosDelLocalActivo.has(d2.productoId)), [diagnosticoStock, idsProductosDelLocalActivo]
```

### offset 4096929
```js
argenPromedio: margenPromedioInforme,
      movimientos: movimientosInforme,
      productos: productosInforme,
      caducanPronto: caducanProntoInforme,
      proveedorPorId,
      vencenPronto: vencenProntoInforme,
      totalPendientePago: totalPendientePagoInforme,
      documentosPersonalPronto: documentosPersonalProntoInforme,
      fichajesAbiertos: fichajesAbiertosInforme,
      encargosUrgentes: encargosUrgentesInforme,
      pisoVentaBajo: pisoVentaBajoInforme,
      sugerenciasPedido: sugerenciasPedidoInforme,
      setTab,
      recordatorioConteo: recordatorioConteoInforme,
      alertasAppcc,
      fallosGuardado,
      diagnosticoStock: diagnosticoStockInforme,
      registrarSalida
    }
  ), tab === "direccion" && /* @__PURE__ */ import_react4.default.createElement(
    PanelDireccion,
    {
      movimientos,
      gastosGenerales,
      nominas,
      empleados,
      promedioDiarioVentas,
      proyeccionTesoreria,
      stockBajo,
      descuadresStock: diagnosticoStock.filter((d2) => !d2.coincide)
    }
  ), tab === "proveedores" && /* @__PURE__ */ import_react4.default.createElement(Proveedores, { proveedores, addProveedor, updateProveedor, deleteProveedor, pedidos: pedidos2 }), tab === "productos" && /* @__PURE__ */ import_react4.default.createElement(
    Productos,
    {
      productos: productosDelLocalActivo,
      proveedores,
      proveedorPorId,
      addProducto,
      updateProducto,
      deleteProducto,
      reactivarProducto,
      registrarSalida,
      clasificacionABC: clasificacionABCDelLocalActivo,
      almacenCongelado,
      movimientos: movimientosDelLocalActivo,
      fichasCosto: fichasCostoDelLocalActivo,
      updateFichaCosto,
      ajustarProductoPorOtro
    }
  ), tab === "historial_producto" && /* @__PURE__ */ import_react4.default.createElement(
    HistorialProducto,
    {
      productos: productosDelLocalActivo,
      movimientos: movimientosDelLocalActivo,
      pedidos: pedidosDelLocalActivo,
      albaranes: albaranesDelLocalActivo,
      traspasos: traspasosDelLocalActivo,
      proveedorPorId
    }
  ), tab === "aceite" && /* @__PURE__ */ import_react4.default.createElement(
    AceiteFreidoras,
    {
      freidoras: freidorasDelLocalActivo,
      registrosAceite: registrosAceiteDelLocalActivo,
      productos: productosDelLocalActivo,
      addFreidora,
      updateFreidora,
      deleteFreidora,
      registrarCambio,
      registrarRelleno,
      eliminarRegistroAceite,
      consumoPorCiclo
    }
  ), tab === "buscar" && /* @__PURE__ */ import_react4.default.createElement(BusquedaGlobal, { productos: productosDelLocalActivo, proveedores, clientes, fichasCosto: fichasCostoDelLocalActivo, empleados: empleadosDelLocalActivo, setTab }), tab === "pedidos" && /* @__PURE__ */ import_react4.default.createElement(
    Pedidos,
    {
      pedidos: pedidosDelLocalActivo,
      proveedores,
      productos: productosDelLocalActivo,
      crearPedido,
      actualizarPedido,
      eliminarPedido,
      proveedorPorId,
      productoPorId: (id) => productosDelLocalActivo.find((p22) => p22.id === id),
      sugerenciasPedido: sugerenciasPedidoDelLocalActivo,
      addProducto
    }
  ), tab === "recepcion" && /* @__PURE__ */ import_react4.default.createElement(Recepcion, { pedidos: pedidosDelLocalActivo, proveedorPorId, productoPorId: (id) => productosDelLocalActivo.find((p22) => p22.id === id), recibirPedido, almacenCongelado, recibirConAlbaran, recibirConFotoIA, cerrarPedido }), tab === "conteo" && /* @__PURE__ */ import_react4.default.createElement(
    InventarioCiego,
    {
      productos: productosDelLocalActivo,
      proveedores,
      conteos: conteosDelLocalActivo,
      iniciarConteo,
      actualizarConteoItem,
      actualizarResponsable,
      finalizarConteo,
      aplicarAjustes,
      eliminarConteo,
      revertirUltimaAplicacion,
      productoPorId: (id) => productosDelLocalActivo.find((p22) => p22.id === id),
      crearProductoEnConteo,
      clasificacionABC: clasificacionABCDelLocalActivo,
      almacenCongelado
    }
  ), tab === "reportes" && /* @__PURE__ */ import_react4.default.createElement(
    Reportes,
    {
      rotacionPorProducto: rotacionPorProductoDelLocalActivo,
      gastoPorProveedor: gastoPorProveedorDelLocalActivo,
      productosSinMovimiento: productosSinMovimientoDelLocalActivo,
      valorInventario: valorInventarioDelLocalActivo,
      margenPorProducto: margenPorProductoDelLocalActivo,
      patronesDesviacionConteo: patronesDesviacionConteoDelLocalActivo
    }
  ), tab === "resultados" && /* @__PURE__ */ import_react4.default.createElement(
    Resultados,
    {
      movimientos: movimientosInforme,
      productos: productosInforme,
      productoPorId: (id) => productosInforme.find((p22) => p22.id === id),
      gastosGenerales: gastosGeneralesInforme,
      addGasto: addGastoInforme,
      deleteGasto: deleteGastoInforme,
      empleados: empleadosInforme
    }
  ), tab === "fichas" && /* @__PURE__ */ import_react4.default.createElement(
    FichasCosto,
    {
      fichasCosto: fichasCostoDelLocalActivo,
      productos: productosDelLocalActivo,
      addFichaCosto,
      updateFichaCosto,
      deleteFichaCosto,
      updateProducto,
      addProducto,
      ordenesProduccion: ordenesProduccionDelLocalActivo,
      nominas,
      fichajes
    }
  ), tab === "produccion" && /* @__PURE__ */ import_react4.default.createElement(Produccion, { fichasCosto: fichasCostoDelLocalActivo, productos: productosDelLocalActivo, ordenesProduccion: ordenesProduccionDelLocalActivo, producir, anularProduccion, traspasarStock }), tab === "mermas" && /* @__PURE__ */ import_react4.default.createElement(M
```

### offset 4097686
```js
 import_react4.default.createElement(
    PanelDireccion,
    {
      movimientos,
      gastosGenerales,
      nominas,
      empleados,
      promedioDiarioVentas,
      proyeccionTesoreria,
      stockBajo,
      descuadresStock: diagnosticoStock.filter((d2) => !d2.coincide)
    }
  ), tab === "proveedores" && /* @__PURE__ */ import_react4.default.createElement(Proveedores, { proveedores, addProveedor, updateProveedor, deleteProveedor, pedidos: pedidos2 }), tab === "productos" && /* @__PURE__ */ import_react4.default.createElement(
    Productos,
    {
      productos: productosDelLocalActivo,
      proveedores,
      proveedorPorId,
      addProducto,
      updateProducto,
      deleteProducto,
      reactivarProducto,
      registrarSalida,
      clasificacionABC: clasificacionABCDelLocalActivo,
      almacenCongelado,
      movimientos: movimientosDelLocalActivo,
      fichasCosto: fichasCostoDelLocalActivo,
      updateFichaCosto,
      ajustarProductoPorOtro
    }
  ), tab === "historial_producto" && /* @__PURE__ */ import_react4.default.createElement(
    HistorialProducto,
    {
      productos: productosDelLocalActivo,
      movimientos: movimientosDelLocalActivo,
      pedidos: pedidosDelLocalActivo,
      albaranes: albaranesDelLocalActivo,
      traspasos: traspasosDelLocalActivo,
      proveedorPorId
    }
  ), tab === "aceite" && /* @__PURE__ */ import_react4.default.createElement(
    AceiteFreidoras,
    {
      freidoras: freidorasDelLocalActivo,
      registrosAceite: registrosAceiteDelLocalActivo,
      productos: productosDelLocalActivo,
      addFreidora,
      updateFreidora,
      deleteFreidora,
      registrarCambio,
      registrarRelleno,
      eliminarRegistroAceite,
      consumoPorCiclo
    }
  ), tab === "buscar" && /* @__PURE__ */ import_react4.default.createElement(BusquedaGlobal, { productos: productosDelLocalActivo, proveedores, clientes, fichasCosto: fichasCostoDelLocalActivo, empleados: empleadosDelLocalActivo, setTab }), tab === "pedidos" && /* @__PURE__ */ import_react4.default.createElement(
    Pedidos,
    {
      pedidos: pedidosDelLocalActivo,
      proveedores,
      productos: productosDelLocalActivo,
      crearPedido,
      actualizarPedido,
      eliminarPedido,
      proveedorPorId,
      productoPorId: (id) => productosDelLocalActivo.find((p22) => p22.id === id),
      sugerenciasPedido: sugerenciasPedidoDelLocalActivo,
      addProducto
    }
  ), tab === "recepcion" && /* @__PURE__ */ import_react4.default.createElement(Recepcion, { pedidos: pedidosDelLocalActivo, proveedorPorId, productoPorId: (id) => productosDelLocalActivo.find((p22) => p22.id === id), recibirPedido, almacenCongelado, recibirConAlbaran, recibirConFotoIA, cerrarPedido }), tab === "conteo" && /* @__PURE__ */ import_react4.default.createElement(
    InventarioCiego,
    {
      productos: productosDelLocalActivo,
      proveedores,
      conteos: conteosDelLocalActivo,
      iniciarConteo,
      actualizarConteoItem,
      actualizarResponsable,
      finalizarConteo,
      aplicarAjustes,
      eliminarConteo,
      revertirUltimaAplicacion,
      productoPorId: (id) => productosDelLocalActivo.find((p22) => p22.id === id),
      crearProductoEnConteo,
      clasificacionABC: clasificacionABCDelLocalActivo,
      almacenCongelado
    }
  ), tab === "reportes" && /* @__PURE__ */ import_react4.default.createElement(
    Reportes,
    {
      rotacionPorProducto: rotacionPorProductoDelLocalActivo,
      gastoPorProveedor: gastoPorProveedorDelLocalActivo,
      productosSinMovimiento: productosSinMovimientoDelLocalActivo,
      valorInventario: valorInventarioDelLocalActivo,
      margenPorProducto: margenPorProductoDelLocalActivo,
      patronesDesviacionConteo: patronesDesviacionConteoDelLocalActivo
    }
  ), tab === "resultados" && /* @__PURE__ */ import_react4.default.createElement(
    Resultados,
    {
      movimientos: movimientosInforme,
      productos: productosInforme,
      productoPorId: (id) => productosInforme.find((p22) => p22.id === id),
      gastosGenerales: gastosGeneralesInforme,
      addGasto: addGastoInforme,
      deleteGasto: deleteGastoInforme,
      empleados: empleadosInforme
    }
  ), tab === "fichas" && /* @__PURE__ */ import_react4.default.createElement(
    FichasCosto,
    {
      fichasCosto: fichasCostoDelLocalActivo,
      productos: productosDelLocalActivo,
      addFichaCosto,
      updateFichaCosto,
      deleteFichaCosto,
      updateProducto,
      addProducto,
      ordenesProduccion: ordenesProduccionDelLocalActivo,
      nominas,
      fichajes
    }
  ), tab === "produccion" && /* @__PURE__ */ import_react4.default.createElement(Produccion, { fichasCosto: fichasCostoDelLocalActivo, productos: productosDelLocalActivo, ordenesProduccion: ordenesProduccionDelLocalActivo, producir, anularProduccion, traspasarStock }), tab === "mermas" && /* @__PURE__ */ import_react4.default.createElement(Mermas, { productos: productosDelLocalActivo, movimientos: movimientosDelLocalActivo, registrarSalida, almacenCongelado }), tab === "etiquetas" && /* @__PURE__ */ import_react4.default.createElement(EtiquetasCatalogo, { productos: productosDelLocalActivo, fichasCosto: fichasCostoDelLocalActivo, alergenosDeFicha }), tab === "albaranes" && /* @__PURE__ */ import_react4.default.createElement(
    Albaranes,
    {
      albaranes: albaranesDelLocalActivo,
      proveedores,
      productos: productosDelLocalActivo,
      proveedorPorId,
      buscarEnCatalogo,
      guardarAlbaran,
      eliminarAlbaran,
      confirmarAlbaran,
      anularAlbaran,
      marcarPagada,
      duplicadosDe,
      desviacionesDePrecio,
      prefill: prefillAlbaran,
      
```

### offset 4098580
```js
Costo: fichasCostoDelLocalActivo,
      updateFichaCosto,
      ajustarProductoPorOtro
    }
  ), tab === "historial_producto" && /* @__PURE__ */ import_react4.default.createElement(
    HistorialProducto,
    {
      productos: productosDelLocalActivo,
      movimientos: movimientosDelLocalActivo,
      pedidos: pedidosDelLocalActivo,
      albaranes: albaranesDelLocalActivo,
      traspasos: traspasosDelLocalActivo,
      proveedorPorId
    }
  ), tab === "aceite" && /* @__PURE__ */ import_react4.default.createElement(
    AceiteFreidoras,
    {
      freidoras: freidorasDelLocalActivo,
      registrosAceite: registrosAceiteDelLocalActivo,
      productos: productosDelLocalActivo,
      addFreidora,
      updateFreidora,
      deleteFreidora,
      registrarCambio,
      registrarRelleno,
      eliminarRegistroAceite,
      consumoPorCiclo
    }
  ), tab === "buscar" && /* @__PURE__ */ import_react4.default.createElement(BusquedaGlobal, { productos: productosDelLocalActivo, proveedores, clientes, fichasCosto: fichasCostoDelLocalActivo, empleados: empleadosDelLocalActivo, setTab }), tab === "pedidos" && /* @__PURE__ */ import_react4.default.createElement(
    Pedidos,
    {
      pedidos: pedidosDelLocalActivo,
      proveedores,
      productos: productosDelLocalActivo,
      crearPedido,
      actualizarPedido,
      eliminarPedido,
      proveedorPorId,
      productoPorId: (id) => productosDelLocalActivo.find((p22) => p22.id === id),
      sugerenciasPedido: sugerenciasPedidoDelLocalActivo,
      addProducto
    }
  ), tab === "recepcion" && /* @__PURE__ */ import_react4.default.createElement(Recepcion, { pedidos: pedidosDelLocalActivo, proveedorPorId, productoPorId: (id) => productosDelLocalActivo.find((p22) => p22.id === id), recibirPedido, almacenCongelado, recibirConAlbaran, recibirConFotoIA, cerrarPedido }), tab === "conteo" && /* @__PURE__ */ import_react4.default.createElement(
    InventarioCiego,
    {
      productos: productosDelLocalActivo,
      proveedores,
      conteos: conteosDelLocalActivo,
      iniciarConteo,
      actualizarConteoItem,
      actualizarResponsable,
      finalizarConteo,
      aplicarAjustes,
      eliminarConteo,
      revertirUltimaAplicacion,
      productoPorId: (id) => productosDelLocalActivo.find((p22) => p22.id === id),
      crearProductoEnConteo,
      clasificacionABC: clasificacionABCDelLocalActivo,
      almacenCongelado
    }
  ), tab === "reportes" && /* @__PURE__ */ import_react4.default.createElement(
    Reportes,
    {
      rotacionPorProducto: rotacionPorProductoDelLocalActivo,
      gastoPorProveedor: gastoPorProveedorDelLocalActivo,
      productosSinMovimiento: productosSinMovimientoDelLocalActivo,
      valorInventario: valorInventarioDelLocalActivo,
      margenPorProducto: margenPorProductoDelLocalActivo,
      patronesDesviacionConteo: patronesDesviacionConteoDelLocalActivo
    }
  ), tab === "resultados" && /* @__PURE__ */ import_react4.default.createElement(
    Resultados,
    {
      movimientos: movimientosInforme,
      productos: productosInforme,
      productoPorId: (id) => productosInforme.find((p22) => p22.id === id),
      gastosGenerales: gastosGeneralesInforme,
      addGasto: addGastoInforme,
      deleteGasto: deleteGastoInforme,
      empleados: empleadosInforme
    }
  ), tab === "fichas" && /* @__PURE__ */ import_react4.default.createElement(
    FichasCosto,
    {
      fichasCosto: fichasCostoDelLocalActivo,
      productos: productosDelLocalActivo,
      addFichaCosto,
      updateFichaCosto,
      deleteFichaCosto,
      updateProducto,
      addProducto,
      ordenesProduccion: ordenesProduccionDelLocalActivo,
      nominas,
      fichajes
    }
  ), tab === "produccion" && /* @__PURE__ */ import_react4.default.createElement(Produccion, { fichasCosto: fichasCostoDelLocalActivo, productos: productosDelLocalActivo, ordenesProduccion: ordenesProduccionDelLocalActivo, producir, anularProduccion, traspasarStock }), tab === "mermas" && /* @__PURE__ */ import_react4.default.createElement(Mermas, { productos: productosDelLocalActivo, movimientos: movimientosDelLocalActivo, registrarSalida, almacenCongelado }), tab === "etiquetas" && /* @__PURE__ */ import_react4.default.createElement(EtiquetasCatalogo, { productos: productosDelLocalActivo, fichasCosto: fichasCostoDelLocalActivo, alergenosDeFicha }), tab === "albaranes" && /* @__PURE__ */ import_react4.default.createElement(
    Albaranes,
    {
      albaranes: albaranesDelLocalActivo,
      proveedores,
      productos: productosDelLocalActivo,
      proveedorPorId,
      buscarEnCatalogo,
      guardarAlbaran,
      eliminarAlbaran,
      confirmarAlbaran,
      anularAlbaran,
      marcarPagada,
      duplicadosDe,
      desviacionesDePrecio,
      prefill: prefillAlbaran,
      limpiarPrefill: () => setPrefillAlbaran(null),
      pedidoParaFotoIA,
      limpiarPedidoParaFotoIA: () => setPedidoParaFotoIA(null),
      pedidos: pedidosDelLocalActivo
    }
  ), tab === "pagos" && /* @__PURE__ */ import_react4.default.createElement(
    CuentasPorPagar,
    {
      facturasPorPagar: facturasPorPagarDelLocalActivo,
      totalPendientePago: totalPendientePagoDelLocalActivo,
      marcarPagada,
      marcarPagadaFacturaDirecta,
      addFacturaDirecta,
      deleteFacturaDirecta,
      proveedores,
      resaltadaId: facturaDirectaResaltada,
      limpiarResaltada: () => setFacturaDirectaResaltada(null)
    }
  ), tab === "personal" && /* @__PURE__ */ import_react4.default.createElement(
    Personal,
    {
      empleados: empleadosDelLocalActivo,
      addEmpleado,
      updateEmpleado,
      deleteEmpleado,
      anonimizarEmpleado,
      registrarAusencia,
 
```

### offset 4099018
```js
orId
    }
  ), tab === "aceite" && /* @__PURE__ */ import_react4.default.createElement(
    AceiteFreidoras,
    {
      freidoras: freidorasDelLocalActivo,
      registrosAceite: registrosAceiteDelLocalActivo,
      productos: productosDelLocalActivo,
      addFreidora,
      updateFreidora,
      deleteFreidora,
      registrarCambio,
      registrarRelleno,
      eliminarRegistroAceite,
      consumoPorCiclo
    }
  ), tab === "buscar" && /* @__PURE__ */ import_react4.default.createElement(BusquedaGlobal, { productos: productosDelLocalActivo, proveedores, clientes, fichasCosto: fichasCostoDelLocalActivo, empleados: empleadosDelLocalActivo, setTab }), tab === "pedidos" && /* @__PURE__ */ import_react4.default.createElement(
    Pedidos,
    {
      pedidos: pedidosDelLocalActivo,
      proveedores,
      productos: productosDelLocalActivo,
      crearPedido,
      actualizarPedido,
      eliminarPedido,
      proveedorPorId,
      productoPorId: (id) => productosDelLocalActivo.find((p22) => p22.id === id),
      sugerenciasPedido: sugerenciasPedidoDelLocalActivo,
      addProducto
    }
  ), tab === "recepcion" && /* @__PURE__ */ import_react4.default.createElement(Recepcion, { pedidos: pedidosDelLocalActivo, proveedorPorId, productoPorId: (id) => productosDelLocalActivo.find((p22) => p22.id === id), recibirPedido, almacenCongelado, recibirConAlbaran, recibirConFotoIA, cerrarPedido }), tab === "conteo" && /* @__PURE__ */ import_react4.default.createElement(
    InventarioCiego,
    {
      productos: productosDelLocalActivo,
      proveedores,
      conteos: conteosDelLocalActivo,
      iniciarConteo,
      actualizarConteoItem,
      actualizarResponsable,
      finalizarConteo,
      aplicarAjustes,
      eliminarConteo,
      revertirUltimaAplicacion,
      productoPorId: (id) => productosDelLocalActivo.find((p22) => p22.id === id),
      crearProductoEnConteo,
      clasificacionABC: clasificacionABCDelLocalActivo,
      almacenCongelado
    }
  ), tab === "reportes" && /* @__PURE__ */ import_react4.default.createElement(
    Reportes,
    {
      rotacionPorProducto: rotacionPorProductoDelLocalActivo,
      gastoPorProveedor: gastoPorProveedorDelLocalActivo,
      productosSinMovimiento: productosSinMovimientoDelLocalActivo,
      valorInventario: valorInventarioDelLocalActivo,
      margenPorProducto: margenPorProductoDelLocalActivo,
      patronesDesviacionConteo: patronesDesviacionConteoDelLocalActivo
    }
  ), tab === "resultados" && /* @__PURE__ */ import_react4.default.createElement(
    Resultados,
    {
      movimientos: movimientosInforme,
      productos: productosInforme,
      productoPorId: (id) => productosInforme.find((p22) => p22.id === id),
      gastosGenerales: gastosGeneralesInforme,
      addGasto: addGastoInforme,
      deleteGasto: deleteGastoInforme,
      empleados: empleadosInforme
    }
  ), tab === "fichas" && /* @__PURE__ */ import_react4.default.createElement(
    FichasCosto,
    {
      fichasCosto: fichasCostoDelLocalActivo,
      productos: productosDelLocalActivo,
      addFichaCosto,
      updateFichaCosto,
      deleteFichaCosto,
      updateProducto,
      addProducto,
      ordenesProduccion: ordenesProduccionDelLocalActivo,
      nominas,
      fichajes
    }
  ), tab === "produccion" && /* @__PURE__ */ import_react4.default.createElement(Produccion, { fichasCosto: fichasCostoDelLocalActivo, productos: productosDelLocalActivo, ordenesProduccion: ordenesProduccionDelLocalActivo, producir, anularProduccion, traspasarStock }), tab === "mermas" && /* @__PURE__ */ import_react4.default.createElement(Mermas, { productos: productosDelLocalActivo, movimientos: movimientosDelLocalActivo, registrarSalida, almacenCongelado }), tab === "etiquetas" && /* @__PURE__ */ import_react4.default.createElement(EtiquetasCatalogo, { productos: productosDelLocalActivo, fichasCosto: fichasCostoDelLocalActivo, alergenosDeFicha }), tab === "albaranes" && /* @__PURE__ */ import_react4.default.createElement(
    Albaranes,
    {
      albaranes: albaranesDelLocalActivo,
      proveedores,
      productos: productosDelLocalActivo,
      proveedorPorId,
      buscarEnCatalogo,
      guardarAlbaran,
      eliminarAlbaran,
      confirmarAlbaran,
      anularAlbaran,
      marcarPagada,
      duplicadosDe,
      desviacionesDePrecio,
      prefill: prefillAlbaran,
      limpiarPrefill: () => setPrefillAlbaran(null),
      pedidoParaFotoIA,
      limpiarPedidoParaFotoIA: () => setPedidoParaFotoIA(null),
      pedidos: pedidosDelLocalActivo
    }
  ), tab === "pagos" && /* @__PURE__ */ import_react4.default.createElement(
    CuentasPorPagar,
    {
      facturasPorPagar: facturasPorPagarDelLocalActivo,
      totalPendientePago: totalPendientePagoDelLocalActivo,
      marcarPagada,
      marcarPagadaFacturaDirecta,
      addFacturaDirecta,
      deleteFacturaDirecta,
      proveedores,
      resaltadaId: facturaDirectaResaltada,
      limpiarResaltada: () => setFacturaDirectaResaltada(null)
    }
  ), tab === "personal" && /* @__PURE__ */ import_react4.default.createElement(
    Personal,
    {
      empleados: empleadosDelLocalActivo,
      addEmpleado,
      updateEmpleado,
      deleteEmpleado,
      anonimizarEmpleado,
      registrarAusencia,
      eliminarAusencia,
      registrarEpi,
      eliminarEpi,
      documentosPersonalCaducan,
      fichajes: fichajesDelLocalActivo,
      nominas: nominasDelLocalActivo,
      entrevistas,
      crearEntrevista,
      actualizarEntrevista,
      finalizarEntrevista,
      eliminarEntrevista,
      crearPrefiltro,
      listarPrefiltros,
      eliminarPrefiltro,
      crearCuentaEmpleado
    }
  ), tab === "fichaje" && /* @__PURE__ 
```

### offset 4102327
```js
 */ import_react4.default.createElement(Produccion, { fichasCosto: fichasCostoDelLocalActivo, productos: productosDelLocalActivo, ordenesProduccion: ordenesProduccionDelLocalActivo, producir, anularProduccion, traspasarStock }), tab === "mermas" && /* @__PURE__ */ import_react4.default.createElement(Mermas, { productos: productosDelLocalActivo, movimientos: movimientosDelLocalActivo, registrarSalida, almacenCongelado }), tab === "etiquetas" && /* @__PURE__ */ import_react4.default.createElement(EtiquetasCatalogo, { productos: productosDelLocalActivo, fichasCosto: fichasCostoDelLocalActivo, alergenosDeFicha }), tab === "albaranes" && /* @__PURE__ */ import_react4.default.createElement(
    Albaranes,
    {
      albaranes: albaranesDelLocalActivo,
      proveedores,
      productos: productosDelLocalActivo,
      proveedorPorId,
      buscarEnCatalogo,
      guardarAlbaran,
      eliminarAlbaran,
      confirmarAlbaran,
      anularAlbaran,
      marcarPagada,
      duplicadosDe,
      desviacionesDePrecio,
      prefill: prefillAlbaran,
      limpiarPrefill: () => setPrefillAlbaran(null),
      pedidoParaFotoIA,
      limpiarPedidoParaFotoIA: () => setPedidoParaFotoIA(null),
      pedidos: pedidosDelLocalActivo
    }
  ), tab === "pagos" && /* @__PURE__ */ import_react4.default.createElement(
    CuentasPorPagar,
    {
      facturasPorPagar: facturasPorPagarDelLocalActivo,
      totalPendientePago: totalPendientePagoDelLocalActivo,
      marcarPagada,
      marcarPagadaFacturaDirecta,
      addFacturaDirecta,
      deleteFacturaDirecta,
      proveedores,
      resaltadaId: facturaDirectaResaltada,
      limpiarResaltada: () => setFacturaDirectaResaltada(null)
    }
  ), tab === "personal" && /* @__PURE__ */ import_react4.default.createElement(
    Personal,
    {
      empleados: empleadosDelLocalActivo,
      addEmpleado,
      updateEmpleado,
      deleteEmpleado,
      anonimizarEmpleado,
      registrarAusencia,
      eliminarAusencia,
      registrarEpi,
      eliminarEpi,
      documentosPersonalCaducan,
      fichajes: fichajesDelLocalActivo,
      nominas: nominasDelLocalActivo,
      entrevistas,
      crearEntrevista,
      actualizarEntrevista,
      finalizarEntrevista,
      eliminarEntrevista,
      crearPrefiltro,
      listarPrefiltros,
      eliminarPrefiltro,
      crearCuentaEmpleado
    }
  ), tab === "fichaje" && /* @__PURE__ */ import_react4.default.createElement(
    RegistroHorario,
    {
      empleados: empleadosDelLocalActivo,
      fichajes: fichajesDelLocalActivo,
      fichar,
      addFichajeManual,
      updateFichaje,
      eliminarFichaje,
      fichajesAbiertos: fichajesAbiertosDelLocalActivo
    }
  ), tab === "nominas" && /* @__PURE__ */ import_react4.default.createElement(
    CostePersonal,
    {
      empleados: empleadosDelLocalActivo,
      nominas: nominasDelLocalActivo,
      addNomina,
      updateNomina,
      deleteNomina,
      fichajes: fichajesDelLocalActivo,
      movimientos: movimientosDelLocalActivo
    }
  ), tab === "venta" && (localInformeId && localActivoId === localInformeId ? /* @__PURE__ */ import_react4.default.createElement(VentaRapida, { productos: productosDelLocalActivo, venderCarrito, anularVenta, movimientos: movimientosDelLocalActivo, registrarAuditoria, local: locales.find((l22) => l22.id === localActivoId) || null, configEmpresa: empresaDelLocalActivo }) : /* @__PURE__ */ import_react4.default.createElement("div", null, /* @__PURE__ */ import_react4.default.createElement(Card, { className: "p-5 mb-4" }, /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[16px] font-semibold mb-2" }, "TPV"), /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[12.5px]", style: { color: C2.inkSoft } }, "El TPV no puede abrirse en Todos los locales. Selecciona un local concreto: cada venta, stock y caja pertenecen a un \xFAnico local.")), /* @__PURE__ */ import_react4.default.createElement(SelectorLocalInformes, { locales: localesEmpresaActiva, valor: localInformeId, onChange: seleccionarContextoLocal }))), tab === "encargos" && /* @__PURE__ */ import_react4.default.createElement(
    Encargos,
    {
      encargosPendientes: encargosPendientesDelLocalActivo,
      encargos: encargosDelLocalActivo,
      clientes,
      productos: productosDelLocalActivo,
      addEncargo,
      updateEncargo,
      deleteEncargo,
      entregarEncargo,
      addCliente
    }
  ), tab === "clientes" && /* @__PURE__ */ import_react4.default.createElement(
    Clientes,
    {
      analisisClientes,
      clientesDormidos,
      ventaCruzada,
      addCliente,
      updateCliente,
      deleteCliente,
      anonimizarCliente
    }
  ), tab === "devoluciones" && /* @__PURE__ */ import_react4.default.createElement(
    Devoluciones,
    { key: localActivoId || "todos", productos: productosDelLocalActivo, proveedores, devoluciones: devolucionesDelLocalActivo, movimientos: movimientosDelLocalActivo, registrarDevolucionCliente, registrarDevolucionProveedor, leerBorradorDevolucion }
  ), tab === "facturas" && /* @__PURE__ */ import_react4.default.createElement(
    Facturas,
    {
      albaranes: albaranesDelLocalActivo,
      facturasDirectas: facturasDirectasDelLocalActivo,
      proveedorPorId,
      irAAlbaran: (albId) => {
        const a22 = albaranesDelLocalActivo.find((x3) => x3.id === albId);
        if (a22) {
          setPrefillAlbaran(a22);
          setTab("albaranes");
        }
      },
      irAFacturaDirecta: (fdId) => {
        if (!facturasDirectasDelLocalActivo.some((f22) => f22.id === fdId)) return;
        setFacturaDirectaResaltada(fdId);
        setTab("pagos");
      }
    }
  ), tab ===
```

### offset 4217768
```js
ction aplicarRecepcionPedidoPM10(pedido, lineasResueltas) {
  const disponibles = new Map();
  for (const linea of lineasResueltas || []) {
    const unidades = Number(linea?.unidadesEntradas);
    if (!linea?.productoId || !Number.isFinite(unidades) || unidades <= 0) continue;
    disponibles.set(linea.productoId, (disponibles.get(linea.productoId) || 0) + unidades);
  }
  const items = (pedido.items || []).map((item) => {
    const pedida = Number(item.cantidad);
    const recibida = Number(item.cantidadRecibida ?? 0);
    const restante = Math.max(0, pedida - recibida);
    const disponible = disponibles.get(item.productoId) || 0;
    const aplicar = Math.min(restante, disponible);
    disponibles.set(item.productoId, Math.max(0, disponible - aplicar));
    return aplicar > 0 ? { ...item, cantidadRecibida: recibida + aplicar } : item;
  });
  const completo = items.length > 0 && items.every((item) => Math.abs(Number(item.cantidadRecibida ?? 0) - Number(item.cantidad)) <= 1e-9);
  const algo = items.some((item) => Number(item.cantidadRecibida ?? 0) > 0);
  return { ...pedido, items, estado: completo ? "Recibido" : algo ? "Parcial" : "Pendiente" };
}
function crearLogicaPedidos({ pedidos: pedidos2, setPedidos, productos, proveedores, setProductos, setMovimientos, almacenCongelado, procesarRecepcion, localActivoId }) {
  function pedidoEsDelLocalActivo(pedido) {
    if (!pedido) return false;
    if (!localActivoId) return false;
    return pedido.localId === localActivoId;
  }
  function crearPedido(data) {
    const validacion = validarPedidoPM10(data, { proveedores, productos, localActivoId });
    if (!validacion.ok) return validacion;
    const { proveedorId, fechaEsperada, items } = validacion.datos;
    const pedido = {
      id: uid(),
      localId: localActivoId,
      proveedorId,
      fecha: todayISO(),
      fechaEsperada,
      estado: "Pendiente",
      items
    };
    setPedidos((s22) => [pedido, ...s22]);
    return pedido;
  }
  function actualizarPedido(pedidoId, data) {
    const actual = pedidos2.find((pe2) => pe2.id === pedidoId);
    if (!pedidoEsDelLocalActivo(actual)) return errorValidacionPM10("contexto_no_autorizado", "localId", "Pedido fuera del local activo.");
    const validacion = validarPedidoPM10(data, { pedidoActual: actual, proveedores, productos, localActivoId });
    if (!validacion.ok) return validacion;
    const { proveedorId, fechaEsperada, items } = validacion.datos;
    setPedidos(
      (s22) => s22.map(
        (pe2) => pe2.id === pedidoId ? { ...pe2, proveedorId, fechaEsperada, items } : pe2
      )
    );
    return true;
  }
  function eliminarPedido(pedidoId) {
    const actual = pedidos2.find((pe2) => pe2.id === pedidoId);
    if (!pedidoEsDelLocalActivo(actual)) return false;
    setPedidos((s22) => s22.filter((pe2) => pe2.id !== pedidoId));
    return true;
  }
  function cerrarPedido(pedidoId) {
    const actual = pedidos2.find((pe2) => pe2.id === pedidoId);
    if (!pedidoEsDelLocalActivo(actual)) return false;
    setPedidos((s22) => s22.map((pe2) => pe2.id === pedidoId ? { ...pe2, estado: "Recibido", cerradoManualmente: true } : pe2));
    return true;
  }
  function recibirPedido(pedidoId, lineas) {
    if (almacenCongelado) return errorValidacionPM10("conflicto_estado_previo", "almacen", "El almacén está congelado por un conteo en curso.");
    const pedido = pedidos2.find((pe2) => pe2.id === pedidoId);
    if (!pedidoEsDelLocalActivo(pedido)) return errorValidacionPM10("contexto_no_autorizado", "pedidoId", "Pedido fuera del local activo.");
    const validacion = validarRecepcionPedidoPM10({ pedido, lineas, productos, localActivoId, modo: "directo" });
    if (!validacion.ok) return validacion;
    const resultado = procesarRecepcion({
      lineas: validacion.lineas,
      proveedorId: pedido.proveedorId,
      fecha: todayISO(),
      documentoTipo: "pedido",
      documentoId: pedido.id,
      documentoNumero: pedido.id.slice(-6)
    });
    if (!resultado || !Array.isArray(resultado.lineasResueltas)) return errorValidacionPM10("conflicto_estado_previo", "recepcion", "No se pudo completar la recepción.");
    setPedidos((s22) => s22.map((pe2) => pe2.id === pedidoId ? aplicarRecepcionPedidoPM10(pe2, resultado.lineasResueltas) : pe2));
    return { ok: true, avisos: resultado.avisos || [], lineasResueltas: resultado.lineasResueltas };
  }
  return { crearPedido, actualizarPedido, eliminarPedido, recibirPedido, cerrarPedido };
}
function crearLogicaFichasCosto({ productos, setFichasCosto, localActivoId }) {
  const fichaEsDelLocalActivo = (f22) => !!f22 && (!localActivoId || f22.localId === localActivoId);
  const productoEsDelLocalActivoFicha = (p22) => !!p22 && (!localActivoId || p22.localId === localActivoId);
  function addFichaCosto(data) {
    setFichasCosto((s22) => [...s22, { id: uid(), ...data, localId: localActivoId || data.localId || null }]);
  }
  function updateFichaCosto(id, data) {
    setFichasCosto((s22) => s22.map((f22) => f22.id === id && fichaEsDelLocalActivo(f22) ? { ...f22, ...data, localId: f22.localId || localActivoId || null } : f22));
  }
  function deleteFichaCosto(id) {
    setFichasCosto((s22) => s22.filter((f22) => f22.id !== id || !fichaEsDelLocalActivo(f22)));
  }
  function alergenosDeFicha(f22) {
    const set = new Set(f22.alergenosExtra || []);
    (f22.componentes || []).forEach((c22) => {
      if (!c22.productoId) return;
      const p22 = productos.find((x3) => x3.id === c22.productoId && productoEsDelLocalActivoFicha(x3));
      (p22?.alergenos || []).forEach((a22) => set.add(a22));
    });
    return [...set];
  }
  return { addFichaCosto, updateFichaCosto, deleteFichaCosto, alergenosDeFich
```

### offset 4299415
```js
lote: "",
        caducidad: "",
        contenido: "",
        unidadContenido: "",
        productoId: it2.productoId,
        cantidadPedida: pendiente
      };
    });
    setPrefillAlbaran({
      id: uid(),
      proveedorId: pedido.proveedorId,
      numero: "",
      fecha: todayISO(),
      totalPapel: "",
      cargos: "",
      cargosConcepto: "",
      cargosIva: 21,
      esFactura: true,
      numeroFactura: "",
      fechaFactura: todayISO(),
      pagada: false,
      fechaPago: "",
      pedidoId: pedido.id,
      localId: localActivoId || pedido.localId || null,
      lineas: lineas.length ? lineas : [],
      estado: "borrador"
    });
    setTab("albaranes");
  }
  function recibirConFotoIA(pedido) {
    if (!pedidoEsDelLocalActivoAlbaran(pedido)) return false;
    setPedidoParaFotoIA(pedido);
    setTab("albaranes");
  }
  return { buscarEnCatalogo, aprenderReferencia, guardarAlbaran, eliminarAlbaran, marcarPagada, confirmarAlbaran, anularAlbaran, recibirConAlbaran, recibirConFotoIA, duplicadosDe, desviacionesDePrecio, procesarRecepcion };
}
function crearLogicaRespaldos({
  // datos actuales, para leer y para meter en el respaldo
  proveedores,
  productos,
  pedidos: pedidos2,
  movimientos,
  conteos,
  fichasCosto,
  albaranes,
  catalogoProv,
  gastosGenerales,
  empleados,
  fichajes,
  registrosAppcc,
  puntosControl,
  clientes,
  encargos,
  arqueos,
  turnos,
  nominas,
  facturasDirectas,
  ordenesProduccion,
  traspasos,
  auditoria,
  freidoras,
  registrosAceite,
  // setters, para cuando se restaura un respaldo
  setProveedores,
  setProductos,
  setPedidos,
  setMovimientos,
  setConteos,
  setFichasCosto,
  setAlbaranes,
  setCatalogoProv,
  setGastosGenerales,
  setEmpleados,
  setFichajes,
  setRegistrosAppcc,
  setPuntosControl,
  setClientes,
  setEncargos,
  setArqueos,
  setTurnos,
  setNominas,
  setFacturasDirectas,
  setOrdenesProduccion,
  setTraspasos,
  setAuditoria,
  setFreidoras,
  setRegistrosAceite,
  // estado propio de la pantalla de respaldos
  setHistorial,
  setPendingRestore,
  pendingRestore,
  setBackupText,
  backupText,
  setCopiado,
  setShowBackupView,
  setShowRestoreInput,
  setRestoreText,
  restoreText,
  setRestoreError,
  // extras para el Excel y la auditoría
  proveedorPorId,
  productoPorId,
  registrarAuditoria
}) {
  function datosDelNegocio() {
    return {
      proveedores,
      productos,
      pedidos: pedidos2,
      movimientos,
      conteos,
      fichasCosto,
      albaranes,
      catalogoProv,
      gastosGenerales,
      empleados,
      fichajes,
      registrosAppcc,
      puntosControl,
      clientes,
      encargos,
      arqueos,
      turnos,
      nominas,
      facturasDirectas,
      ordenesProduccion,
      traspasos,
      auditoria,
      freidoras,
      registrosAceite
    };
  }
  const SETTERS = {
    proveedores: setProveedores,
    productos: setProductos,
    pedidos: setPedidos,
    movimientos: setMovimientos,
    conteos: setConteos,
    fichasCosto: setFichasCosto,
    albaranes: setAlbaranes,
    catalogoProv: setCatalogoProv,
    gastosGenerales: setGastosGenerales,
    empleados: setEmpleados,
    fichajes: setFichajes,
    registrosAppcc: setRegistrosAppcc,
    puntosControl: setPuntosControl,
    clientes: setClientes,
    encargos: setEncargos,
    arqueos: setArqueos,
    turnos: setTurnos,
    nominas: setNominas,
    freidoras: setFreidoras,
    registrosAceite: setRegistrosAceite,
    facturasDirectas: setFacturasDirectas,
    ordenesProduccion: setOrdenesProduccion,
    traspasos: setTraspasos,
    auditoria: setAuditoria
  };
  const NOMBRES = {
    proveedores: "Proveedores",
    productos: "Productos",
    pedidos: "Pedidos",
    movimientos: "Movimientos",
    conteos: "Conteos",
    fichasCosto: "Fichas de costo",
    albaranes: "Albaranes",
    catalogoProv: "C\xF3digos de proveedor",
    gastosGenerales: "Gastos generales",
    empleados: "Empleados",
    fichajes: "Fichajes",
    registrosAppcc: "Registros APPCC",
    puntosControl: "Puntos de control",
    clientes: "Clientes",
    encargos: "Encargos",
    arqueos: "Arqueos de caja",
    turnos: "Turnos",
    nominas: "N\xF3minas",
    freidoras: "Freidoras",
    registrosAceite: "Registros de aceite",
    facturasDirectas: "Facturas directas",
    ordenesProduccion: "\xD3rdenes de producci\xF3n",
    traspasos: "Traspasos",
    auditoria: "Auditor\xEDa"
  };
  function cuantos(valor) {
    if (Array.isArray(valor)) return valor.length;
    if (valor && typeof valor === "object") return Object.keys(valor).length;
    return 0;
  }
  function compararConEstadoActual(respaldo) {
    if (!respaldo) return [];
    const actual = datosDelNegocio();
    return Object.keys(NOMBRES).filter((clave) => respaldo[clave] !== void 0).map((clave) => {
      const nActual = cuantos(actual[clave]);
      const nRespaldo = cuantos(respaldo[clave]);
      return { clave, nombre: NOMBRES[clave], actual: nActual, respaldo: nRespaldo, diferencia: nRespaldo - nActual };
    });
  }
  function coleccionesQueSeConservan(respaldo) {
    if (!respaldo) return [];
    return Object.keys(NOMBRES).filter((clave) => respaldo[clave] === void 0).map((clave) => NOMBRES[clave]);
  }
  function crearPuntoDeGuardado(motivo = "manual") {
    const snapshot = {
      id: uid(),
      fecha: (/* @__PURE__ */ new Date()).toISOString(),
      automatica: motivo !== "manual",
      motivo,
      backupVersion: 3,
      data: datosDelNegocio()
    };
    setHistorial((s22) => [snapshot, ...s22].slice(0, 30));
    return snapshot;
  }
  function restaurarDesdeHistorial(snapshot) {
    setPendingRestore({ ...snapshot.data, exportadoEl: snapshot.fecha });
```

### offset 4300634
```js
  movimientos,
  conteos,
  fichasCosto,
  albaranes,
  catalogoProv,
  gastosGenerales,
  empleados,
  fichajes,
  registrosAppcc,
  puntosControl,
  clientes,
  encargos,
  arqueos,
  turnos,
  nominas,
  facturasDirectas,
  ordenesProduccion,
  traspasos,
  auditoria,
  freidoras,
  registrosAceite,
  // setters, para cuando se restaura un respaldo
  setProveedores,
  setProductos,
  setPedidos,
  setMovimientos,
  setConteos,
  setFichasCosto,
  setAlbaranes,
  setCatalogoProv,
  setGastosGenerales,
  setEmpleados,
  setFichajes,
  setRegistrosAppcc,
  setPuntosControl,
  setClientes,
  setEncargos,
  setArqueos,
  setTurnos,
  setNominas,
  setFacturasDirectas,
  setOrdenesProduccion,
  setTraspasos,
  setAuditoria,
  setFreidoras,
  setRegistrosAceite,
  // estado propio de la pantalla de respaldos
  setHistorial,
  setPendingRestore,
  pendingRestore,
  setBackupText,
  backupText,
  setCopiado,
  setShowBackupView,
  setShowRestoreInput,
  setRestoreText,
  restoreText,
  setRestoreError,
  // extras para el Excel y la auditoría
  proveedorPorId,
  productoPorId,
  registrarAuditoria
}) {
  function datosDelNegocio() {
    return {
      proveedores,
      productos,
      pedidos: pedidos2,
      movimientos,
      conteos,
      fichasCosto,
      albaranes,
      catalogoProv,
      gastosGenerales,
      empleados,
      fichajes,
      registrosAppcc,
      puntosControl,
      clientes,
      encargos,
      arqueos,
      turnos,
      nominas,
      facturasDirectas,
      ordenesProduccion,
      traspasos,
      auditoria,
      freidoras,
      registrosAceite
    };
  }
  const SETTERS = {
    proveedores: setProveedores,
    productos: setProductos,
    pedidos: setPedidos,
    movimientos: setMovimientos,
    conteos: setConteos,
    fichasCosto: setFichasCosto,
    albaranes: setAlbaranes,
    catalogoProv: setCatalogoProv,
    gastosGenerales: setGastosGenerales,
    empleados: setEmpleados,
    fichajes: setFichajes,
    registrosAppcc: setRegistrosAppcc,
    puntosControl: setPuntosControl,
    clientes: setClientes,
    encargos: setEncargos,
    arqueos: setArqueos,
    turnos: setTurnos,
    nominas: setNominas,
    freidoras: setFreidoras,
    registrosAceite: setRegistrosAceite,
    facturasDirectas: setFacturasDirectas,
    ordenesProduccion: setOrdenesProduccion,
    traspasos: setTraspasos,
    auditoria: setAuditoria
  };
  const NOMBRES = {
    proveedores: "Proveedores",
    productos: "Productos",
    pedidos: "Pedidos",
    movimientos: "Movimientos",
    conteos: "Conteos",
    fichasCosto: "Fichas de costo",
    albaranes: "Albaranes",
    catalogoProv: "C\xF3digos de proveedor",
    gastosGenerales: "Gastos generales",
    empleados: "Empleados",
    fichajes: "Fichajes",
    registrosAppcc: "Registros APPCC",
    puntosControl: "Puntos de control",
    clientes: "Clientes",
    encargos: "Encargos",
    arqueos: "Arqueos de caja",
    turnos: "Turnos",
    nominas: "N\xF3minas",
    freidoras: "Freidoras",
    registrosAceite: "Registros de aceite",
    facturasDirectas: "Facturas directas",
    ordenesProduccion: "\xD3rdenes de producci\xF3n",
    traspasos: "Traspasos",
    auditoria: "Auditor\xEDa"
  };
  function cuantos(valor) {
    if (Array.isArray(valor)) return valor.length;
    if (valor && typeof valor === "object") return Object.keys(valor).length;
    return 0;
  }
  function compararConEstadoActual(respaldo) {
    if (!respaldo) return [];
    const actual = datosDelNegocio();
    return Object.keys(NOMBRES).filter((clave) => respaldo[clave] !== void 0).map((clave) => {
      const nActual = cuantos(actual[clave]);
      const nRespaldo = cuantos(respaldo[clave]);
      return { clave, nombre: NOMBRES[clave], actual: nActual, respaldo: nRespaldo, diferencia: nRespaldo - nActual };
    });
  }
  function coleccionesQueSeConservan(respaldo) {
    if (!respaldo) return [];
    return Object.keys(NOMBRES).filter((clave) => respaldo[clave] === void 0).map((clave) => NOMBRES[clave]);
  }
  function crearPuntoDeGuardado(motivo = "manual") {
    const snapshot = {
      id: uid(),
      fecha: (/* @__PURE__ */ new Date()).toISOString(),
      automatica: motivo !== "manual",
      motivo,
      backupVersion: 3,
      data: datosDelNegocio()
    };
    setHistorial((s22) => [snapshot, ...s22].slice(0, 30));
    return snapshot;
  }
  function restaurarDesdeHistorial(snapshot) {
    setPendingRestore({ ...snapshot.data, exportadoEl: snapshot.fecha });
  }
  function abrirRespaldo() {
    const data = {
      version: 2,
      // se mantiene por compatibilidad con lectores antiguos
      backupVersion: 3,
      // 3 = incluye nóminas, facturas, producción, traspasos y auditoría
      exportadoEl: (/* @__PURE__ */ new Date()).toISOString(),
      ...datosDelNegocio()
    };
    setBackupText(JSON.stringify(data));
    setCopiado(false);
    setShowBackupView(true);
  }
  function copiarRespaldo() {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(backupText).then(() => setCopiado(true)).catch(() => setCopiado(false));
    }
  }
  function abrirRestaurar() {
    setRestoreText("");
    setRestoreError("");
    setShowRestoreInput(true);
  }
  function validarRespaldo(data) {
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return "El respaldo no es v\xE1lido: no tiene el formato esperado.";
    }
    const conocidas = Object.keys(NOMBRES).filter((clave) => data[clave] !== void 0);
    if (conocidas.length === 0) {
      return "El respaldo no es v\xE1lido o est\xE1 incompleto: no contiene ninguna colecci\xF3n reconocible.";
    }
    for (const clave of conocidas) {
      co
```

### offset 4301137
```js
ales,
  setEmpleados,
  setFichajes,
  setRegistrosAppcc,
  setPuntosControl,
  setClientes,
  setEncargos,
  setArqueos,
  setTurnos,
  setNominas,
  setFacturasDirectas,
  setOrdenesProduccion,
  setTraspasos,
  setAuditoria,
  setFreidoras,
  setRegistrosAceite,
  // estado propio de la pantalla de respaldos
  setHistorial,
  setPendingRestore,
  pendingRestore,
  setBackupText,
  backupText,
  setCopiado,
  setShowBackupView,
  setShowRestoreInput,
  setRestoreText,
  restoreText,
  setRestoreError,
  // extras para el Excel y la auditoría
  proveedorPorId,
  productoPorId,
  registrarAuditoria
}) {
  function datosDelNegocio() {
    return {
      proveedores,
      productos,
      pedidos: pedidos2,
      movimientos,
      conteos,
      fichasCosto,
      albaranes,
      catalogoProv,
      gastosGenerales,
      empleados,
      fichajes,
      registrosAppcc,
      puntosControl,
      clientes,
      encargos,
      arqueos,
      turnos,
      nominas,
      facturasDirectas,
      ordenesProduccion,
      traspasos,
      auditoria,
      freidoras,
      registrosAceite
    };
  }
  const SETTERS = {
    proveedores: setProveedores,
    productos: setProductos,
    pedidos: setPedidos,
    movimientos: setMovimientos,
    conteos: setConteos,
    fichasCosto: setFichasCosto,
    albaranes: setAlbaranes,
    catalogoProv: setCatalogoProv,
    gastosGenerales: setGastosGenerales,
    empleados: setEmpleados,
    fichajes: setFichajes,
    registrosAppcc: setRegistrosAppcc,
    puntosControl: setPuntosControl,
    clientes: setClientes,
    encargos: setEncargos,
    arqueos: setArqueos,
    turnos: setTurnos,
    nominas: setNominas,
    freidoras: setFreidoras,
    registrosAceite: setRegistrosAceite,
    facturasDirectas: setFacturasDirectas,
    ordenesProduccion: setOrdenesProduccion,
    traspasos: setTraspasos,
    auditoria: setAuditoria
  };
  const NOMBRES = {
    proveedores: "Proveedores",
    productos: "Productos",
    pedidos: "Pedidos",
    movimientos: "Movimientos",
    conteos: "Conteos",
    fichasCosto: "Fichas de costo",
    albaranes: "Albaranes",
    catalogoProv: "C\xF3digos de proveedor",
    gastosGenerales: "Gastos generales",
    empleados: "Empleados",
    fichajes: "Fichajes",
    registrosAppcc: "Registros APPCC",
    puntosControl: "Puntos de control",
    clientes: "Clientes",
    encargos: "Encargos",
    arqueos: "Arqueos de caja",
    turnos: "Turnos",
    nominas: "N\xF3minas",
    freidoras: "Freidoras",
    registrosAceite: "Registros de aceite",
    facturasDirectas: "Facturas directas",
    ordenesProduccion: "\xD3rdenes de producci\xF3n",
    traspasos: "Traspasos",
    auditoria: "Auditor\xEDa"
  };
  function cuantos(valor) {
    if (Array.isArray(valor)) return valor.length;
    if (valor && typeof valor === "object") return Object.keys(valor).length;
    return 0;
  }
  function compararConEstadoActual(respaldo) {
    if (!respaldo) return [];
    const actual = datosDelNegocio();
    return Object.keys(NOMBRES).filter((clave) => respaldo[clave] !== void 0).map((clave) => {
      const nActual = cuantos(actual[clave]);
      const nRespaldo = cuantos(respaldo[clave]);
      return { clave, nombre: NOMBRES[clave], actual: nActual, respaldo: nRespaldo, diferencia: nRespaldo - nActual };
    });
  }
  function coleccionesQueSeConservan(respaldo) {
    if (!respaldo) return [];
    return Object.keys(NOMBRES).filter((clave) => respaldo[clave] === void 0).map((clave) => NOMBRES[clave]);
  }
  function crearPuntoDeGuardado(motivo = "manual") {
    const snapshot = {
      id: uid(),
      fecha: (/* @__PURE__ */ new Date()).toISOString(),
      automatica: motivo !== "manual",
      motivo,
      backupVersion: 3,
      data: datosDelNegocio()
    };
    setHistorial((s22) => [snapshot, ...s22].slice(0, 30));
    return snapshot;
  }
  function restaurarDesdeHistorial(snapshot) {
    setPendingRestore({ ...snapshot.data, exportadoEl: snapshot.fecha });
  }
  function abrirRespaldo() {
    const data = {
      version: 2,
      // se mantiene por compatibilidad con lectores antiguos
      backupVersion: 3,
      // 3 = incluye nóminas, facturas, producción, traspasos y auditoría
      exportadoEl: (/* @__PURE__ */ new Date()).toISOString(),
      ...datosDelNegocio()
    };
    setBackupText(JSON.stringify(data));
    setCopiado(false);
    setShowBackupView(true);
  }
  function copiarRespaldo() {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(backupText).then(() => setCopiado(true)).catch(() => setCopiado(false));
    }
  }
  function abrirRestaurar() {
    setRestoreText("");
    setRestoreError("");
    setShowRestoreInput(true);
  }
  function validarRespaldo(data) {
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return "El respaldo no es v\xE1lido: no tiene el formato esperado.";
    }
    const conocidas = Object.keys(NOMBRES).filter((clave) => data[clave] !== void 0);
    if (conocidas.length === 0) {
      return "El respaldo no es v\xE1lido o est\xE1 incompleto: no contiene ninguna colecci\xF3n reconocible.";
    }
    for (const clave of conocidas) {
      const valor = data[clave];
      const esObjetoValido = clave === "catalogoProv" && valor && typeof valor === "object" && !Array.isArray(valor);
      if (!Array.isArray(valor) && !esObjetoValido) {
        return `El respaldo est\xE1 da\xF1ado: "${NOMBRES[clave]}" no tiene el formato correcto.`;
      }
    }
    return null;
  }
  function analizarTextoRestauracion() {
    let data;
    try {
      data = JSON.parse(restoreText.trim());
    } catch (err2) {
      setRestoreError("Ese texto no parec
```

### offset 4301917
```js
anes,
      catalogoProv,
      gastosGenerales,
      empleados,
      fichajes,
      registrosAppcc,
      puntosControl,
      clientes,
      encargos,
      arqueos,
      turnos,
      nominas,
      facturasDirectas,
      ordenesProduccion,
      traspasos,
      auditoria,
      freidoras,
      registrosAceite
    };
  }
  const SETTERS = {
    proveedores: setProveedores,
    productos: setProductos,
    pedidos: setPedidos,
    movimientos: setMovimientos,
    conteos: setConteos,
    fichasCosto: setFichasCosto,
    albaranes: setAlbaranes,
    catalogoProv: setCatalogoProv,
    gastosGenerales: setGastosGenerales,
    empleados: setEmpleados,
    fichajes: setFichajes,
    registrosAppcc: setRegistrosAppcc,
    puntosControl: setPuntosControl,
    clientes: setClientes,
    encargos: setEncargos,
    arqueos: setArqueos,
    turnos: setTurnos,
    nominas: setNominas,
    freidoras: setFreidoras,
    registrosAceite: setRegistrosAceite,
    facturasDirectas: setFacturasDirectas,
    ordenesProduccion: setOrdenesProduccion,
    traspasos: setTraspasos,
    auditoria: setAuditoria
  };
  const NOMBRES = {
    proveedores: "Proveedores",
    productos: "Productos",
    pedidos: "Pedidos",
    movimientos: "Movimientos",
    conteos: "Conteos",
    fichasCosto: "Fichas de costo",
    albaranes: "Albaranes",
    catalogoProv: "C\xF3digos de proveedor",
    gastosGenerales: "Gastos generales",
    empleados: "Empleados",
    fichajes: "Fichajes",
    registrosAppcc: "Registros APPCC",
    puntosControl: "Puntos de control",
    clientes: "Clientes",
    encargos: "Encargos",
    arqueos: "Arqueos de caja",
    turnos: "Turnos",
    nominas: "N\xF3minas",
    freidoras: "Freidoras",
    registrosAceite: "Registros de aceite",
    facturasDirectas: "Facturas directas",
    ordenesProduccion: "\xD3rdenes de producci\xF3n",
    traspasos: "Traspasos",
    auditoria: "Auditor\xEDa"
  };
  function cuantos(valor) {
    if (Array.isArray(valor)) return valor.length;
    if (valor && typeof valor === "object") return Object.keys(valor).length;
    return 0;
  }
  function compararConEstadoActual(respaldo) {
    if (!respaldo) return [];
    const actual = datosDelNegocio();
    return Object.keys(NOMBRES).filter((clave) => respaldo[clave] !== void 0).map((clave) => {
      const nActual = cuantos(actual[clave]);
      const nRespaldo = cuantos(respaldo[clave]);
      return { clave, nombre: NOMBRES[clave], actual: nActual, respaldo: nRespaldo, diferencia: nRespaldo - nActual };
    });
  }
  function coleccionesQueSeConservan(respaldo) {
    if (!respaldo) return [];
    return Object.keys(NOMBRES).filter((clave) => respaldo[clave] === void 0).map((clave) => NOMBRES[clave]);
  }
  function crearPuntoDeGuardado(motivo = "manual") {
    const snapshot = {
      id: uid(),
      fecha: (/* @__PURE__ */ new Date()).toISOString(),
      automatica: motivo !== "manual",
      motivo,
      backupVersion: 3,
      data: datosDelNegocio()
    };
    setHistorial((s22) => [snapshot, ...s22].slice(0, 30));
    return snapshot;
  }
  function restaurarDesdeHistorial(snapshot) {
    setPendingRestore({ ...snapshot.data, exportadoEl: snapshot.fecha });
  }
  function abrirRespaldo() {
    const data = {
      version: 2,
      // se mantiene por compatibilidad con lectores antiguos
      backupVersion: 3,
      // 3 = incluye nóminas, facturas, producción, traspasos y auditoría
      exportadoEl: (/* @__PURE__ */ new Date()).toISOString(),
      ...datosDelNegocio()
    };
    setBackupText(JSON.stringify(data));
    setCopiado(false);
    setShowBackupView(true);
  }
  function copiarRespaldo() {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(backupText).then(() => setCopiado(true)).catch(() => setCopiado(false));
    }
  }
  function abrirRestaurar() {
    setRestoreText("");
    setRestoreError("");
    setShowRestoreInput(true);
  }
  function validarRespaldo(data) {
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return "El respaldo no es v\xE1lido: no tiene el formato esperado.";
    }
    const conocidas = Object.keys(NOMBRES).filter((clave) => data[clave] !== void 0);
    if (conocidas.length === 0) {
      return "El respaldo no es v\xE1lido o est\xE1 incompleto: no contiene ninguna colecci\xF3n reconocible.";
    }
    for (const clave of conocidas) {
      const valor = data[clave];
      const esObjetoValido = clave === "catalogoProv" && valor && typeof valor === "object" && !Array.isArray(valor);
      if (!Array.isArray(valor) && !esObjetoValido) {
        return `El respaldo est\xE1 da\xF1ado: "${NOMBRES[clave]}" no tiene el formato correcto.`;
      }
    }
    return null;
  }
  function analizarTextoRestauracion() {
    let data;
    try {
      data = JSON.parse(restoreText.trim());
    } catch (err2) {
      setRestoreError("Ese texto no parece un respaldo v\xE1lido. Revisa que lo hayas copiado completo.");
      return;
    }
    const error = validarRespaldo(data);
    if (error) {
      setRestoreError(error);
      return;
    }
    setRestoreError("");
    setShowRestoreInput(false);
    setPendingRestore(data);
  }
  function confirmarRestauracion() {
    if (!pendingRestore) return;
    const puntoPrevio = crearPuntoDeGuardado("previo-a-restauracion");
    let restauradas = 0;
    Object.entries(SETTERS).forEach(([clave, setter]) => {
      if (pendingRestore[clave] !== void 0 && setter) {
        setter(pendingRestore[clave]);
        restauradas++;
      }
    });
    if (registrarAuditoria) {
      const version6 = pendingRestore.backupVersion || pendingRestore.version || "antigua";
      const fec
```

### offset 4371806
```js
dad."), /* @__PURE__ */ import_react4.default.createElement("div", { className: "flex gap-2" }, /* @__PURE__ */ import_react4.default.createElement(Btn, { variant: "ghost", onClick: () => setConfirmarMermaLote(null), disabled: procesandoMermaLote }, "Cancelar"), /* @__PURE__ */ import_react4.default.createElement(Btn, {
    onClick: () => {
      setProcesandoMermaLote(true);
      registrarSalida(confirmarMermaLote.productoId, confirmarMermaLote.unidades, { motivo: "Merma / caducidad", referencia: confirmarMermaLote.lote ? `lote ${confirmarMermaLote.lote}` : "" });
      setConfirmarMermaLote(null);
      setProcesandoMermaLote(false);
    },
    disabled: procesandoMermaLote
  }, procesandoMermaLote ? "Registrando\u2026" : "Confirmar merma")))));
}
var DIAS_REPARTO = [
  { valor: 1, corta: "L", nombre: "Lunes" },
  { valor: 2, corta: "M", nombre: "Martes" },
  { valor: 3, corta: "X", nombre: "Mi\xE9rcoles" },
  { valor: 4, corta: "J", nombre: "Jueves" },
  { valor: 5, corta: "V", nombre: "Viernes" },
  { valor: 6, corta: "S", nombre: "S\xE1bado" },
  { valor: 0, corta: "D", nombre: "Domingo" }
];
function Proveedores({ proveedores, addProveedor, updateProveedor, deleteProveedor, pedidos: pedidos2 }) {
  const blankProv = { nombre: "", contacto: "", telefono: "", email: "", condiciones: "", leadTime: "", diasPago: "", diasReparto: [] };
  const [showForm, setShowForm] = (0, import_react4.useState)(false);
  const [form, setForm] = (0, import_react4.useState)(blankProv);
  const [error, setError] = (0, import_react4.useState)("");
  const [editFor, setEditFor] = (0, import_react4.useState)(null);
  const [editForm, setEditForm] = (0, import_react4.useState)(blankProv);
  const [editError, setEditError] = (0, import_react4.useState)("");
  const [confirmDeleteId, setConfirmDeleteId] = (0, import_react4.useState)(null);
  function submit() {
    if (!form.nombre.trim()) {
      setError("Escribe el nombre del proveedor.");
      return;
    }
    setError("");
    addProveedor(form);
    setForm(blankProv);
    setShowForm(false);
  }
  function openEdit(pv) {
    setEditFor(pv.id);
    setEditForm({
      nombre: pv.nombre || "",
      contacto: pv.contacto || "",
      telefono: pv.telefono || "",
      email: pv.email || "",
      condiciones: pv.condiciones || "",
      leadTime: pv.leadTime || "",
      diasPago: pv.diasPago || "",
      diasReparto: pv.diasReparto || []
    });
    setEditError("");
  }
  function submitEdit() {
    if (!editForm.nombre.trim()) {
      setEditError("Escribe el nombre del proveedor.");
      return;
    }
    updateProveedor(editFor, editForm);
    setEditFor(null);
  }
  return /* @__PURE__ */ import_react4.default.createElement("div", null, /* @__PURE__ */ import_react4.default.createElement(SectionTitle, { action: /* @__PURE__ */ import_react4.default.createElement(Btn, { onClick: () => setShowForm((s22) => !s22) }, /* @__PURE__ */ import_react4.default.createElement(Plus, { size: 15 }), " Nuevo proveedor") }, "Proveedores"), showForm && /* @__PURE__ */ import_react4.default.createElement(Card, { className: "mb-4" }, /* @__PURE__ */ import_react4.default.createElement("div", { className: "grid md:grid-cols-3 gap-x-4" }, /* @__PURE__ */ import_react4.default.createElement(Field, { label: "Nombre del proveedor" }, /* @__PURE__ */ import_react4.default.createElement(Input, { value: form.nombre, onChange: (e2) => setForm({ ...form, nombre: e2.target.value }), placeholder: "Distribuidora del Norte" })), /* @__PURE__ */ import_react4.default.createElement(Field, { label: "Persona de contacto" }, /* @__PURE__ */ import_react4.default.createElement(Input, { value: form.contacto, onChange: (e2) => setForm({ ...form, contacto: e2.target.value }), placeholder: "Nombre" })), /* @__PURE__ */ import_react4.default.createElement(Field, { label: "Tel\xE9fono (WhatsApp)" }, /* @__PURE__ */ import_react4.default.createElement(Input, { value: form.telefono, onChange: (e2) => setForm({ ...form, telefono: e2.target.value }), placeholder: "+34 600 000 000" })), /* @__PURE__ */ import_react4.default.createElement(Field, { label: "Correo electr\xF3nico" }, /* @__PURE__ */ import_react4.default.createElement(Input, { type: "email", value: form.email, onChange: (e2) => setForm({ ...form, email: e2.target.value }), placeholder: "pedidos@proveedor.com" })), /* @__PURE__ */ import_react4.default.createElement(Field, { label: "Condiciones de pago (texto libre)" }, /* @__PURE__ */ import_react4.default.createElement(Input, { value: form.condiciones, onChange: (e2) => setForm({ ...form, condiciones: e2.target.value }), placeholder: "Transferencia 45 d\xEDas F/F" })), /* @__PURE__ */ import_react4.default.createElement(Field, { label: "D\xEDas de pago (para calcular vencimientos)" }, /* @__PURE__ */ import_react4.default.createElement(Input, { type: "number", value: form.diasPago, onChange: (e2) => setForm({ ...form, diasPago: e2.target.value }), placeholder: "45" })), /* @__PURE__ */ import_react4.default.createElement(Field, { label: "Tiempo de entrega (d\xEDas)" }, /* @__PURE__ */ import_react4.default.createElement(Input, { type: "number", value: form.leadTime, onChange: (e2) => setForm({ ...form, leadTime: e2.target.value }), placeholder: "5" }))), /* @__PURE__ */ import_react4.default.createElement("div", { className: "mb-2" }, /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[12px] font-medium mb-1", style: { color: C2.inkSoft } }, "\xBFQu\xE9 d\xEDas reparte? (opcional)"), /* @__PURE__ */ import_react4.default.createElement("div", { className: "flex gap-1.5" }, DIAS_REPARTO.map((d2) => {
    const activo = (form.diasReparto || []).includes(d2.valor);
```

### offset 4444414
```js
act4.useEffect)(() => {
    function alTecla(e2) {
      if (e2.key === "Escape") onCloseRef.current();
    }
    document.addEventListener("keydown", alTecla);
    return () => document.removeEventListener("keydown", alTecla);
  }, []);
  return /* @__PURE__ */ import_react4.default.createElement("div", { className: "fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto", style: { background: "rgba(20,32,28,0.45)" } }, /* @__PURE__ */ import_react4.default.createElement(
    "div",
    {
      ref: cajaRef,
      tabIndex: -1,
      role: "dialog",
      "aria-modal": "true",
      "aria-label": title,
      className: `rounded-xl p-5 w-full ${ancho} my-4`,
      style: { background: C2.surface, outline: "none" }
    },
    /* @__PURE__ */ import_react4.default.createElement("div", { className: "flex items-center justify-between mb-4" }, /* @__PURE__ */ import_react4.default.createElement("div", { className: "font-semibold text-[15px]" }, title), /* @__PURE__ */ import_react4.default.createElement("button", { onClick: onClose, "aria-label": "Cerrar" }, /* @__PURE__ */ import_react4.default.createElement(X2, { size: 17 }))),
    children
  ));
}
function Pedidos({ pedidos: pedidos2, proveedores, productos, crearPedido, actualizarPedido, eliminarPedido, proveedorPorId, productoPorId, sugerenciasPedido = [], addProducto }) {
  const [showForm, setShowForm] = (0, import_react4.useState)(false);
  const [proveedorId, setProveedorId] = (0, import_react4.useState)("");
  const [verTodosProductos, setVerTodosProductos] = (0, import_react4.useState)(false);
  const [fechaEsperada, setFechaEsperada] = (0, import_react4.useState)("");
  const [items, setItems] = (0, import_react4.useState)([]);
  const [enviarPedido, setEnviarPedido] = (0, import_react4.useState)(null);
  const [editingId, setEditingId] = (0, import_react4.useState)(null);
  const [confirmDeleteId, setConfirmDeleteId] = (0, import_react4.useState)(null);
  const [creandoNuevoIdx, setCreandoNuevoIdx] = (0, import_react4.useState)(null);
  const [nuevoProd, setNuevoProd] = (0, import_react4.useState)({ nombre: "", unidad: "unidad", costo: "" });
  function addItemRow() {
    if (!productos.length) return;
    setItems((s22) => [...s22, { productoId: productos[0].id, cantidad: 1, costoUnitario: productos[0].costo }]);
  }
  function updateItem(idx, field, value) {
    setItems(
      (s22) => s22.map((it2, i33) => {
        if (i33 !== idx) return it2;
        if (field === "productoId") {
          if (value === "__nuevo__") {
            setNuevoProd({ nombre: "", unidad: "unidad", costo: "" });
            setCreandoNuevoIdx(idx);
            return it2;
          }
          const p22 = productos.find((pr) => pr.id === value);
          return { ...it2, productoId: value, costoUnitario: p22 ? p22.costo : it2.costoUnitario };
        }
        return { ...it2, [field]: value };
      })
    );
  }
  function guardarProductoNuevo() {
    if (!nuevoProd.nombre.trim()) {
      setError("Escribe el nombre del producto.");
      return;
    }
    const creado = addProducto({
      nombre: nuevoProd.nombre.trim(),
      unidad: nuevoProd.unidad || "unidad",
      tipo: "materia_prima",
      costo: nuevoProd.costo,
      ivaCompra: 10,
      proveedorId: proveedorId || "",
      stock: 0,
      stockMinimo: 0
    });
    if (!creado || creado.ok === false) {
      setError(creado?.error || "No se pudo crear el producto.");
      return;
    }
    setError("");
    setItems((s22) => s22.map((it2, i33) => i33 === creandoNuevoIdx ? { ...it2, productoId: creado.id, costoUnitario: creado.costo } : it2));
    setCreandoNuevoIdx(null);
  }
  function removeItem(idx) {
    setItems((s22) => s22.filter((_22, i33) => i33 !== idx));
  }
  const [error, setError] = (0, import_react4.useState)("");
  function resetForm() {
    setItems([]);
    setProveedorId("");
    setFechaEsperada("");
    setEditingId(null);
    setError("");
    setVerTodosProductos(false);
  }
  function openEdit(pedido) {
    setEditingId(pedido.id);
    setProveedorId(pedido.proveedorId);
    setFechaEsperada(pedido.fechaEsperada || "");
    setItems(pedido.items.map((it2) => ({ productoId: it2.productoId, cantidad: it2.cantidad, costoUnitario: it2.costoUnitario, cantidadRecibida: it2.cantidadRecibida ?? 0 })));
    setError("");
    setVerTodosProductos(false);
    setShowForm(true);
  }
  function prepararPedidoDesdeSugerencias(proveedorId2, sugerenciasDelProveedor) {
    setEditingId(null);
    setProveedorId(proveedorId2);
    setFechaEsperada("");
    setItems(
      sugerenciasDelProveedor.map((p22) => ({
        productoId: p22.id,
        // Usa la cantidad ya calculada centralizadamente, que sí resta el
        // stock que todavía queda — pedir la cobertura completa sin restarlo
        // significaba pedir de más cada vez que quedaba algo en el almacén.
        cantidad: Math.max(1, p22.cantidadSugerida ?? Math.ceil((p22.consumoDiario || 0) * (p22.diasHastaEntrega + 7))),
        costoUnitario: p22.costo
      }))
    );
    setError("");
    setVerTodosProductos(false);
    setShowForm(true);
  }
  function submit() {
    if (!proveedorId) {
      setError("Selecciona un proveedor.");
      return;
    }
    if (items.length === 0) {
      setError("Añade al menos un producto al pedido.");
      return;
    }
    const payload = { proveedorId, fechaEsperada, items };
    if (editingId) {
      const resultado = actualizarPedido(editingId, payload);
      if (!resultado || resultado.ok === false) {
        setError(resultado?.error || "No se pudo actualizar el pedido.");
        return;
      }
      setError("");
      setShowForm(false);
      resetF
```

### offset 4450308
```js
 }
      setError("");
      setShowForm(false);
      resetForm();
      setEnviarPedido(pedido);
    }
  }
  function textoPedido(pedido) {
    const prov = proveedorPorId(pedido.proveedorId);
    const lineas = pedido.items.map((it2, i33) => {
      const p22 = productoPorId(it2.productoId);
      const unidad = p22 ? p22.unidad : "";
      return `${i33 + 1}. ${p22 ? p22.nombre : "Producto eliminado"} \u2014 ${fmt(it2.cantidad)} ${unidad} (a \u20AC${fmt(it2.costoUnitario)}/${unidad})`;
    });
    const total = pedido.items.reduce((a22, it2) => a22 + it2.cantidad * it2.costoUnitario, 0);
    const ivaTotal = pedido.items.reduce((a22, it2) => {
      const prod = productoPorId(it2.productoId);
      return a22 + it2.cantidad * it2.costoUnitario * (ivaCompraDe(prod) / 100);
    }, 0);
    const separador = "\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014";
    return [
      `PEDIDO \u2014 ${prov ? prov.nombre : "Proveedor"}`,
      `Fecha del pedido: ${new Date(pedido.fecha).toLocaleDateString("es-ES")}`,
      `Entrega esperada: ${pedido.fechaEsperada ? new Date(pedido.fechaEsperada).toLocaleDateString("es-ES") : "por confirmar"}`,
      "",
      "Productos pedidos:",
      lineas.join("\n"),
      "",
      separador,
      `Base imponible: \u20AC${fmt(total)}`,
      `IVA: \u20AC${fmt(ivaTotal)}`,
      `TOTAL: \u20AC${fmt(total + ivaTotal)}`,
      separador,
      "",
      "Gracias."
    ].join("\n");
  }
  function mailtoHref(pedido) {
    const prov = proveedorPorId(pedido.proveedorId);
    const texto = textoPedido(pedido);
    return `mailto:${prov?.email || ""}?subject=${encodeURIComponent("Pedido - " + (prov?.nombre || ""))}&body=${encodeURIComponent(texto)}`;
  }
  function gmailAppHref(pedido) {
    const prov = proveedorPorId(pedido.proveedorId);
    const texto = textoPedido(pedido);
    return `googlegmail:///co?to=${encodeURIComponent(prov?.email || "")}&subject=${encodeURIComponent("Pedido - " + (prov?.nombre || ""))}&body=${encodeURIComponent(texto)}`;
  }
  function gmailWebHref(pedido) {
    const prov = proveedorPorId(pedido.proveedorId);
    const texto = textoPedido(pedido);
    const params = new URLSearchParams({
      view: "cm",
      fs: "1",
      to: prov?.email || "",
      su: "Pedido - " + (prov?.nombre || ""),
      body: texto
    });
    return `https://mail.google.com/mail/?${params.toString()}`;
  }
  const [compartirError, setCompartirError] = (0, import_react4.useState)("");
  async function compartirPedido(pedido) {
    const prov = proveedorPorId(pedido.proveedorId);
    const texto = textoPedido(pedido);
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Pedido - ${prov?.nombre || ""}`,
          text: texto
        });
        setCompartirError("");
      } catch (e2) {
        if (e2 && e2.name !== "AbortError") setCompartirError("No se pudo abrir el men\xFA de compartir.");
      }
    } else {
      setCompartirError("Tu navegador no permite compartir. Usa las otras opciones o copia el texto.");
    }
  }
  function whatsappHref(pedido) {
    const prov = proveedorPorId(pedido.proveedorId);
    const texto = textoPedido(pedido);
    const numero = (prov?.telefono || "").replace(/[^0-9]/g, "");
    return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
  }
  function llamarHref(pedido) {
    const prov = proveedorPorId(pedido.proveedorId);
    const numero = (prov?.telefono || "").replace(/[^0-9+]/g, "");
    return `tel:${numero}`;
  }
  const [correoPedido, setCorreoPedido] = (0, import_react4.useState)(null);
  const estadoColor = { Pendiente: C2.amber, Parcial: C2.accent, Recibido: C2.inkSoft };
  const productosSeleccionables = !proveedorId || verTodosProductos ? productos : productos.filter((p22) => p22.proveedorId === proveedorId);
  return /* @__PURE__ */ import_react4.default.createElement("div", null, /* @__PURE__ */ import_react4.default.createElement(SectionTitle, { action: /* @__PURE__ */ import_react4.default.createElement(Btn, { onClick: () => {
    if (showForm) {
      resetForm();
    }
    setShowForm((s22) => !s22);
  } }, /* @__PURE__ */ import_react4.default.createElement(Plus, { size: 15 }), " Nuevo pedido") }, "Pedidos de compra"), sugerenciasPedido.length > 0 && (() => {
    const porProveedor = {};
    sugerenciasPedido.forEach((p22) => {
      if (!porProveedor[p22.proveedorId]) porProveedor[p22.proveedorId] = { nombre: p22.proveedorNombre, items: [] };
      porProveedor[p22.proveedorId].items.push(p22);
    });
    return /* @__PURE__ */ import_react4.default.createElement(Card, { className: "mb-4", style: { background: C2.amberSoft, border: "none" } }, /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[12.5px] font-semibold mb-2" }, "Punto de pedido: se te va a agotar antes de que llegue"), /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[11.5px] mb-3", style: { color: C2.inkSoft } }, "Al ritmo de venta real de los \xFAltimos d\xEDas, estos productos se agotar\xEDan antes de que llegara un pedido hecho hoy \u2014 seg\xFAn el plazo de entrega que tienes puesto en cada proveedor."), /* @__PURE__ */ import_react4.default.createElement("div", { className: "space-y-2" }, Object.entries(porProveedor).map(([provId, { nombre, items: items2 }]) => /* @__PURE__ */ import_react4.default.createElement("div", { key: provId, className: "rounded-lg p-2.5", style: { background: C2.surface } }, /* @__PURE__ */ import_react4.default.createElement("div", { className: "flex items-center justify-between mb-1.5" }, /* @__PURE__ */ import_react4.default.createElement("span", { className: "text-[12.5px] font-me
```

### offset 4471102
```js
do creado \u2014 \xBFc\xF3mo quieres enviarlo?" }, /* @__PURE__ */ import_react4.default.createElement("p", { className: "text-[12.5px] mb-4", style: { color: C2.inkSoft } }, "Puedes enviarlo ahora al proveedor o hacerlo m\xE1s tarde desde la lista de pedidos."), /* @__PURE__ */ import_react4.default.createElement("div", { className: "flex gap-2 flex-wrap" }, /* @__PURE__ */ import_react4.default.createElement(Btn, { onClick: () => {
    setCorreoPedido(enviarPedido);
    setEnviarPedido(null);
  } }, /* @__PURE__ */ import_react4.default.createElement(Mail, { size: 14 }), " Correo"), /* @__PURE__ */ import_react4.default.createElement(LinkBtn, { variant: "primary", href: whatsappHref(enviarPedido) }, /* @__PURE__ */ import_react4.default.createElement(MessageCircle, { size: 14 }), " WhatsApp"), proveedorPorId(enviarPedido.proveedorId)?.telefono && /* @__PURE__ */ import_react4.default.createElement(LinkBtn, { href: llamarHref(enviarPedido) }, /* @__PURE__ */ import_react4.default.createElement(Phone, { size: 14 }), " Llamar"), /* @__PURE__ */ import_react4.default.createElement(Btn, { variant: "ghost", onClick: () => setEnviarPedido(null) }, "Ahora no"))));
}
function Recepcion({ pedidos: pedidos2, proveedorPorId, productoPorId, recibirPedido, almacenCongelado, recibirConAlbaran, recibirConFotoIA, cerrarPedido }) {
  const [activos, setActivos] = (0, import_react4.useState)({});
  const [cerrando, setCerrando] = (0, import_react4.useState)(null);
  const [erroresRecepcion, setErroresRecepcion] = (0, import_react4.useState)({});
  const pendientes = pedidos2.filter((p22) => p22.estado !== "Recibido");
  function setCampo(pedidoId, productoId, campo, val) {
    setActivos((s22) => ({
      ...s22,
      [pedidoId]: { ...s22[pedidoId] || {}, [productoId]: { ...(s22[pedidoId] || {})[productoId] || {}, [campo]: val } }
    }));
  }
  return /* @__PURE__ */ import_react4.default.createElement("div", null, /* @__PURE__ */ import_react4.default.createElement(SectionTitle, null, "Recepci\xF3n de mercanc\xEDa"), almacenCongelado && /* @__PURE__ */ import_react4.default.createElement(Card, { className: "mb-4", style: { background: C2.amberSoft, border: "none" } }, /* @__PURE__ */ import_react4.default.createElement("div", { className: "flex items-start gap-2 text-[12.5px]" }, /* @__PURE__ */ import_react4.default.createElement(TriangleAlert, { size: 16, color: C2.amber, style: { marginTop: 2, flexShrink: 0 } }), /* @__PURE__ */ import_react4.default.createElement("span", null, /* @__PURE__ */ import_react4.default.createElement("b", null, "Almac\xE9n congelado por conteo en curso."), " Las entradas y salidas est\xE1n bloqueadas hasta que finalices el conteo en Inventario ciego."))), pendientes.length === 0 ? /* @__PURE__ */ import_react4.default.createElement(Empty, { text: "No hay pedidos pendientes de recibir." }) : /* @__PURE__ */ import_react4.default.createElement("div", { className: "space-y-3" }, pendientes.map((pe2) => {
    const prov = proveedorPorId(pe2.proveedorId);
    return /* @__PURE__ */ import_react4.default.createElement(Card, { key: pe2.id }, /* @__PURE__ */ import_react4.default.createElement("div", { className: "flex items-center justify-between mb-3" }, /* @__PURE__ */ import_react4.default.createElement("div", { className: "font-semibold" }, prov ? prov.nombre : "\u2014"), /* @__PURE__ */ import_react4.default.createElement(Pill2, { color: C2.amber }, pe2.estado)), pe2.items.map((it2) => {
      const p22 = productoPorId(it2.productoId);
      const pendiente = it2.cantidad - it2.cantidadRecibida;
      const campo = (activos[pe2.id] || {})[it2.productoId] || {};
      const precioPrecargado = campo.precio !== void 0 ? campo.precio : p22 ? p22.costo || "" : "";
      const ivaPrecargado = campo.iva !== void 0 ? campo.iva : p22 ? p22.ivaCompra || 10 : 10;
      return /* @__PURE__ */ import_react4.default.createElement("div", { key: it2.productoId, className: "py-1.5 border-b last:border-0", style: { borderColor: C2.line } }, /* @__PURE__ */ import_react4.default.createElement("div", { className: "flex items-center justify-between" }, /* @__PURE__ */ import_react4.default.createElement("div", null, /* @__PURE__ */ import_react4.default.createElement("div", null, p22 ? p22.nombre : "\u2014"), /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[11px] mono", style: { color: C2.inkSoft } }, "Pedido: ", it2.cantidad, " \xB7 Recibido: ", it2.cantidadRecibida, " \xB7 Pendiente: ", pendiente)), /* @__PURE__ */ import_react4.default.createElement(
        Input,
        {
          type: "number",
          style: { width: 90 },
          placeholder: "Cant. hoy",
          value: campo.cantidad || "",
          onChange: (e2) => setCampo(pe2.id, it2.productoId, "cantidad", e2.target.value),
          disabled: pendiente <= 0
        }
      )), Number(campo.cantidad) > 0 && /* @__PURE__ */ import_react4.default.createElement("div", { className: "flex items-center gap-2 mt-1.5" }, /* @__PURE__ */ import_react4.default.createElement("span", { className: "text-[11px]", style: { color: C2.inkSoft } }, "Precio/ud (\u20AC)"), /* @__PURE__ */ import_react4.default.createElement(
        Input,
        {
          type: "number",
          step: "0.01",
          style: { width: 80 },
          value: precioPrecargado,
          onChange: (e2) => setCampo(pe2.id, it2.productoId, "precio", e2.target.value)
        }
      ), /* @__PURE__ */ import_react4.default.createElement("span", { className: "text-[11px]", style: { color: C2.inkSoft } }, "IVA %"), /* @__PURE__ */ import_react4.default.createElement(
        Input,
        {
          type: "number",
          style:
```

### offset 4648499
```js
 && Math.abs(cantidad * precio - importe) / importe > 0.15) {
        resultado.avisos.push(`"${descripcion.slice(0, 30)}": los n\xFAmeros no cuadran, rev\xEDsala`);
      }
    } else {
      cantidad = vals[0];
      precio = vals[1];
    }
    resultado.lineas.push({ codigo, descripcion, cantidad, precio, importe });
  }
  return resultado;
}
function lineaVacia() {
  return {
    codigoProveedor: "",
    descripcion: "",
    unidad: "unidad",
    tipoUnidad: "unidad",
    // "unidad" | "peso"
    cantidad: "",
    udsPorCaja: 1,
    precioPor: "bulto",
    // "bulto" = precio de la caja | "unidad" = precio de cada pieza
    precioBruto: "",
    dtoPct: "",
    importe: "",
    canon: "",
    // Punto Verde, SIG, canon de envases: suma a la base de ESTA línea
    ivaPct: 10,
    lote: "",
    caducidad: "",
    contenido: "",
    unidadContenido: "",
    productoId: ""
  };
}
function Albaranes({
  albaranes,
  proveedores,
  productos,
  proveedorPorId,
  buscarEnCatalogo,
  guardarAlbaran,
  eliminarAlbaran,
  confirmarAlbaran,
  anularAlbaran,
  marcarPagada,
  duplicadosDe,
  desviacionesDePrecio,
  prefill,
  limpiarPrefill,
  pedidoParaFotoIA,
  limpiarPedidoParaFotoIA,
  pedidos: pedidos2 = []
}) {
  const [modo, setModo] = (0, import_react4.useState)("lista");
  const [alb, setAlb] = (0, import_react4.useState)(null);
  const [error, setError] = (0, import_react4.useState)("");
  const [avisos, setAvisos] = (0, import_react4.useState)(null);
  const [filtroMes, setFiltroMes] = (0, import_react4.useState)("");
  const [mostrarPegar, setMostrarPegar] = (0, import_react4.useState)(false);
  const [textoPegado, setTextoPegado] = (0, import_react4.useState)("");
  const [proveedorTexto, setProveedorTexto] = (0, import_react4.useState)("");
  const [errorPegado, setErrorPegado] = (0, import_react4.useState)("");
  const [avisosPegado, setAvisosPegado] = (0, import_react4.useState)([]);
  const [mostrarIA, setMostrarIA] = (0, import_react4.useState)(false);
  const [fotosIA, setFotosIA] = (0, import_react4.useState)([]);
  const [proveedorIA, setProveedorIA] = (0, import_react4.useState)("");
  const [cargandoIA, setCargandoIA] = (0, import_react4.useState)(false);
  const [errorIA, setErrorIA] = (0, import_react4.useState)("");
  const [pedidoIALigado, setPedidoIALigado] = (0, import_react4.useState)(null);
  const [confianzaIA, setConfianzaIA] = (0, import_react4.useState)(null);
  const [avisosIA, setAvisosIA] = (0, import_react4.useState)([]);
  const [fotoRevisionIA, setFotoRevisionIA] = (0, import_react4.useState)("");
  const duplicados = (0, import_react4.useMemo)(
    () => alb && duplicadosDe ? duplicadosDe(alb) : { albaran: null, factura: null },
    [alb, duplicadosDe]
  );
  const desviaciones = (0, import_react4.useMemo)(
    () => alb && desviacionesDePrecio ? desviacionesDePrecio(alb) : [],
    [alb, desviacionesDePrecio]
  );
  const [confirmarId, setConfirmarId] = (0, import_react4.useState)(null);
  const [anularId, setAnularId] = (0, import_react4.useState)(null);
  const [procesandoEntrada, setProcesandoEntrada] = (0, import_react4.useState)(false);
  (0, import_react4.useEffect)(() => {
    if (prefill) {
      setAlb(prefill);
      setModo("editor");
      setError("");
      limpiarPrefill();
    }
  }, [prefill]);
  (0, import_react4.useEffect)(() => {
    if (pedidoParaFotoIA) {
      setModo("lista");
      setPedidoIALigado(pedidoParaFotoIA);
      setProveedorIA(pedidoParaFotoIA.proveedorId);
      setFotosIA([]);
      setErrorIA("");
      setAvisosIA([]);
      setMostrarIA(true);
      limpiarPedidoParaFotoIA();
    }
  }, [pedidoParaFotoIA]);
  function crearDesdeTextoPegado() {
    const prov = proveedorTexto || (proveedores[0] ? proveedores[0].id : "");
    if (!prov) {
      setErrorPegado("Primero da de alta un proveedor.");
      return;
    }
    const r2 = analizarTextoAlbaran(textoPegado);
    if (r2.lineas.length === 0) {
      setErrorPegado("No he reconocido ninguna l\xEDnea de producto. Comprueba que has copiado la tabla del albar\xE1n, no solo la cabecera.");
      return;
    }
    const lineas = r2.lineas.map((l22) => {
      const base = lineaVacia();
      const aprendido = buscarEnCatalogo(prov, l22.codigo, l22.descripcion);
      return {
        ...base,
        codigoProveedor: l22.codigo || "",
        descripcion: l22.descripcion,
        cantidad: l22.cantidad != null ? l22.cantidad : "",
        precioBruto: l22.precio != null ? l22.precio : "",
        importe: l22.importe != null ? l22.importe : "",
        // Si ya se enlazó antes este código con un producto, se recupera todo
        // lo aprendido: producto, unidad, uds. por caja, IVA…
        ...aprendido || {},
        productoId: aprendido && aprendido.productoId ? aprendido.productoId : ""
      };
    });
    setAlb({
      id: uid(),
      proveedorId: prov,
      numero: r2.numero || "",
      fecha: r2.fecha || todayISO(),
      totalPapel: "",
      cargos: "",
      cargosConcepto: "",
      cargosIva: 21,
      esFactura: true,
      numeroFactura: "",
      fechaFactura: r2.fecha || todayISO(),
      pagada: false,
      fechaPago: "",
      lineas,
      estado: "borrador"
    });
    setAvisosPegado(r2.avisos);
    setMostrarPegar(false);
    setTextoPegado("");
    setErrorPegado("");
    setError("");
    setModo("editor");
  }
  async function agregarFotosIA(archivos) {
    setErrorIA("");
    const validos = Array.from(archivos).filter((f22) => f22.type.startsWith("image/"));
    if (validos.length === 0) {
      setErrorIA("Solo se admiten fotos (jpg, png). Los PDF, hazles una foto de pantalla o de la hoja impresa.");
      return;
    }
    try {
      con
```

### offset 5123730
```js
SocialEmpresa)), n2.notas && /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[11px] mt-0.5", style: { color: C2.inkSoft } }, n2.notas)), /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-right" }, /* @__PURE__ */ import_react4.default.createElement("div", { className: "mono font-semibold" }, "\u20AC", fmt(n2.costeTotalEmpresa)), n2.costePorHora !== null && /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[11px] mono", style: { color: C2.inkSoft } }, "\u20AC", fmt(n2.costePorHora), "/h \xB7 ", fmt(n2.horas), " h fichadas"))), /* @__PURE__ */ import_react4.default.createElement("div", { className: "mt-2 flex gap-2" }, /* @__PURE__ */ import_react4.default.createElement(Btn, { small: true, variant: "ghost", onClick: () => abrirEdicion(n2) }, /* @__PURE__ */ import_react4.default.createElement(Pencil, { size: 13 }), " Editar"), /* @__PURE__ */ import_react4.default.createElement(Btn, { small: true, variant: "ghost", onClick: () => deleteNomina(n2.id) }, /* @__PURE__ */ import_react4.default.createElement(Trash2, { size: 13 }), " Eliminar"))))));
}
function HistorialProducto({ productos, movimientos, pedidos: pedidos2, albaranes, traspasos, proveedorPorId }) {
  const [busqueda, setBusqueda] = (0, import_react4.useState)("");
  const [productoId, setProductoId] = (0, import_react4.useState)("");
  const [seccion, setSeccion] = (0, import_react4.useState)("movimientos");
  const coincidencias = (0, import_react4.useMemo)(() => {
    const q2 = busqueda.trim().toLowerCase();
    if (!q2) return [];
    return productos.filter((p22) => p22.nombre.toLowerCase().includes(q2) || (p22.codigoBarras || "").toLowerCase().includes(q2)).slice(0, 8);
  }, [productos, busqueda]);
  const producto = productos.find((p22) => p22.id === productoId);
  const movimientosDelProducto = (0, import_react4.useMemo)(() => {
    if (!producto) return [];
    return movimientos.filter((m22) => m22.productoId === producto.id).sort((a22, b2) => (b2.fecha || "").localeCompare(a22.fecha || ""));
  }, [movimientos, producto]);
  const pedidosDelProducto = (0, import_react4.useMemo)(() => {
    if (!producto) return [];
    return pedidos2.filter((pe2) => (pe2.items || []).some((it2) => it2.productoId === producto.id)).map((pe2) => ({ pedido: pe2, item: pe2.items.find((it2) => it2.productoId === producto.id) })).sort((a22, b2) => (b2.pedido.fecha || "").localeCompare(a22.pedido.fecha || ""));
  }, [pedidos2, producto]);
  const comprasDelProducto = (0, import_react4.useMemo)(() => {
    if (!producto) return [];
    return albaranes.filter((a22) => a22.estado === "confirmado" && (a22.lineas || []).some((ln2) => ln2.productoId === producto.id)).map((a22) => {
      const ln2 = a22.lineas.find((x3) => x3.productoId === producto.id);
      const unidades = Number(ln2.unidadesEntradas) || 0;
      const importe = Number(ln2.importe) || 0;
      return { albaran: a22, linea: ln2, unidades, precioUnitario: unidades > 0 ? importe / unidades : 0 };
    }).sort((a22, b2) => (b2.albaran.fecha || "").localeCompare(a22.albaran.fecha || ""));
  }, [albaranes, producto]);
  const traspasosDelProducto = (0, import_react4.useMemo)(() => {
    if (!producto) return [];
    return traspasos.filter((t22) => t22.tipo === "ENTRE_LOCALES" ? t22.productoOrigenId === producto.id || t22.productoDestinoId === producto.id : t22.productoId === producto.id).sort((a22, b2) => (b2.fecha || "").localeCompare(a22.fecha || ""));
  }, [traspasos, producto]);
  const SECCIONES = [
    { id: "movimientos", label: "Movimientos", n: movimientosDelProducto.length },
    { id: "pedidos", label: "Pedidos", n: pedidosDelProducto.length },
    { id: "compras", label: "Compras", n: comprasDelProducto.length },
    { id: "traspasos", label: "Traspasos", n: traspasosDelProducto.length }
  ];
  return /* @__PURE__ */ import_react4.default.createElement("div", null, /* @__PURE__ */ import_react4.default.createElement(SectionTitle, null, "Historial de producto"), /* @__PURE__ */ import_react4.default.createElement(Card, { className: "mb-4" }, /* @__PURE__ */ import_react4.default.createElement(Field, { label: "Busca un producto por nombre o c\xF3digo de barras" }, /* @__PURE__ */ import_react4.default.createElement(
    Input,
    {
      value: busqueda,
      onChange: (e2) => {
        setBusqueda(e2.target.value);
        setProductoId("");
      },
      placeholder: "Ej. Harina, Bomb\xF3n surtido\u2026",
      autoFocus: true
    }
  )), busqueda && !producto && /* @__PURE__ */ import_react4.default.createElement("div", { className: "space-y-1 mt-1" }, coincidencias.length === 0 ? /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[12.5px]", style: { color: C2.inkSoft } }, "Sin resultados.") : coincidencias.map((p22) => /* @__PURE__ */ import_react4.default.createElement(
    "button",
    {
      key: p22.id,
      onClick: () => {
        setProductoId(p22.id);
        setBusqueda(p22.nombre);
      },
      className: "w-full text-left px-3 py-2 rounded-lg text-[13px]",
      style: { border: `1px solid ${C2.line}`, background: C2.surface, color: C2.ink }
    },
    p22.nombre,
    " ",
    /* @__PURE__ */ import_react4.default.createElement("span", { style: { color: C2.inkSoft } }, "\xB7 ", p22.unidad)
  )))), !producto ? /* @__PURE__ */ import_react4.default.createElement(Empty, { text: "Busca y elige un producto para ver todo su historial." }) : /* @__PURE__ */ import_react4.default.createElement(import_react4.default.Fragment, null, /* @__PURE__ */ import_react4.default.createElement(Card, { className: "mb-4" }, /* @__PURE__ */ import_react4.default.create
```

## empleados:

### offset 4035913
```js
stringify(fre || [])) await saveKey("freidoras", freidorasFinales);
      if (JSON.stringify(registrosAceiteFinales) !== JSON.stringify(rac || [])) await saveKey("registrosAceite", registrosAceiteFinales);
      setReady(true);
      if (habiaFotos) await saveKey("albaranes", albaranesFinales);
      setTimeout(() => {
        skipSaveRef.current = false;
      }, 400);
      if (!autoSnapshotRef.current) {
        autoSnapshotRef.current = true;
        const tieneDatos = p22.length || pr.length || pe2.length || mo.length || co.length || fc.length || al.length || em.length;
        const hoy = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
        const yaHayUnoDeHoy = hi.some((h22) => h22.automatica && (h22.fecha || "").slice(0, 10) === hoy);
        if (tieneDatos && !yaHayUnoDeHoy) {
          const snapshot = {
            id: uid(),
            fecha: (/* @__PURE__ */ new Date()).toISOString(),
            automatica: true,
            motivo: "automatico-diario",
            backupVersion: 3,
            data: { proveedores: p22, productos: pr, pedidos: pe2, movimientos: mo, conteos: co, fichasCosto: fc, albaranes: alLimpios, catalogoProv: cp, gastosGenerales: gg, empleados: em, fichajes: fj, registrosAppcc: ra, puntosControl: pc, clientes: cl, encargos: en, arqueos: aq, turnos: tu, nominas: nom, facturasDirectas: fd2, ordenesProduccion: op, traspasos: tr, auditoria: au, freidoras: fre, registrosAceite: rac }
          };
          const historialFinal = [snapshot, ...hi].slice(0, 30);
          setHistorial(historialFinal);
          await saveKey("historialRespaldos", historialFinal);
        }
      }
    })();
  }, []);
  (0, import_react4.useEffect)(() => {
    if (ready && !skipSaveRef.current) saveKey("proveedores", proveedores);
  }, [proveedores, ready]);
  (0, import_react4.useEffect)(() => {
    if (ready && !skipSaveRef.current) saveKey("productos", productos);
  }, [productos, ready]);
  (0, import_react4.useEffect)(() => {
    if (ready && !skipSaveRef.current) saveKey("pedidos", pedidos2);
  }, [pedidos2, ready]);
  (0, import_react4.useEffect)(() => {
    if (ready && !skipSaveRef.current) saveKey("movimientos", movimientos);
  }, [movimientos, ready]);
  (0, import_react4.useEffect)(() => {
    if (ready && !skipSaveRef.current) saveKey("conteos", conteos);
  }, [conteos, ready]);
  (0, import_react4.useEffect)(() => {
    if (ready && !skipSaveRef.current) saveKey("fichasCosto", fichasCosto);
  }, [fichasCosto, ready]);
  (0, import_react4.useEffect)(() => {
    if (ready && !skipSaveRef.current) saveKey("historialRespaldos", historial);
  }, [historial, ready]);
  (0, import_react4.useEffect)(() => {
    if (ready && !skipSaveRef.current) saveKey("albaranes", albaranes);
  }, [albaranes, ready]);
  (0, import_react4.useEffect)(() => {
    if (ready && !skipSaveRef.current) saveKey("catalogoProv", catalogoProv);
  }, [catalogoProv, ready]);
  (0, import_react4.useEffect)(() => {
    if (ready && !skipSaveRef.current) saveKey("gastosGenerales", gastosGenerales);
  }, [gastosGenerales, ready]);
  (0, import_react4.useEffect)(() => {
    if (ready && !skipSaveRef.current) saveKey("empleados", empleados);
  }, [empleados, ready]);
  (0, import_react4.useEffect)(() => {
    if (ready && !skipSaveRef.current) saveKey("fichajes", fichajes);
  }, [fichajes, ready]);
  (0, import_react4.useEffect)(() => {
    if (ready && !skipSaveRef.current) saveKey("disenoMenu", disenoMenu);
  }, [disenoMenu, ready]);
  (0, import_react4.useEffect)(() => {
    if (ready && !skipSaveRef.current) saveKey("registrosAppcc", registrosAppcc);
  }, [registrosAppcc, ready]);
  (0, import_react4.useEffect)(() => {
    if (ready && !skipSaveRef.current) saveKey("freidoras", freidoras);
  }, [freidoras, ready]);
  (0, import_react4.useEffect)(() => {
    if (ready && !skipSaveRef.current) saveKey("registrosAceite", registrosAceite);
  }, [registrosAceite, ready]);
  (0, import_react4.useEffect)(() => {
    if (ready && !skipSaveRef.current) saveKey("puntosControl", puntosControl);
  }, [puntosControl, ready]);
  (0, import_react4.useEffect)(() => {
    if (ready && !skipSaveRef.current) saveKey("clientes", clientes);
  }, [clientes, ready]);
  (0, import_react4.useEffect)(() => {
    if (ready && !skipSaveRef.current) saveKey("encargos", encargos);
  }, [encargos, ready]);
  (0, import_react4.useEffect)(() => {
    if (ready && !skipSaveRef.current) saveKey("arqueos", arqueos);
  }, [arqueos, ready]);
  (0, import_react4.useEffect)(() => {
    if (ready && !skipSaveRef.current) saveKey("movimientosCaja", movimientosCaja);
  }, [movimientosCaja, ready]);
  (0, import_react4.useEffect)(() => {
    if (ready && !skipSaveRef.current) saveKey("devoluciones", devoluciones);
  }, [devoluciones, ready]);
  (0, import_react4.useEffect)(() => {
    if (ready && !skipSaveRef.current) saveKey("locales", locales);
  }, [locales, ready]);
  (0, import_react4.useEffect)(() => {
    if (ready && !skipSaveRef.current) saveKey("empresas", empresas);
  }, [empresas, ready]);
  (0, import_react4.useEffect)(() => {
    if (ready && !skipSaveRef.current) saveKey("configEmpresa", configEmpresa);
  }, [configEmpresa, ready]);
  (0, import_react4.useEffect)(() => {
    if (ready && !skipSaveRef.current) saveKey("localActivoId", localActivoId);
  }, [localActivoId, ready]);
  (0, import_react4.useEffect)(() => {
    if (ready && !skipSaveRef.current) saveKey("turnos", turnos);
  }, [turnos, ready]);
  (0, import_react4.useEffect)(() => {
    if (ready && !skipSaveRef.current) saveKey("temaOscuro", temaOscuro);
  }, [temaOscuro, ready]);
  (0, import_react4.useEffect)(() => {
    if (ready && !skipSaveRef.current) save
```

### offset 4098434
```js
Salida,
      clasificacionABC: clasificacionABCDelLocalActivo,
      almacenCongelado,
      movimientos: movimientosDelLocalActivo,
      fichasCosto: fichasCostoDelLocalActivo,
      updateFichaCosto,
      ajustarProductoPorOtro
    }
  ), tab === "historial_producto" && /* @__PURE__ */ import_react4.default.createElement(
    HistorialProducto,
    {
      productos: productosDelLocalActivo,
      movimientos: movimientosDelLocalActivo,
      pedidos: pedidosDelLocalActivo,
      albaranes: albaranesDelLocalActivo,
      traspasos: traspasosDelLocalActivo,
      proveedorPorId
    }
  ), tab === "aceite" && /* @__PURE__ */ import_react4.default.createElement(
    AceiteFreidoras,
    {
      freidoras: freidorasDelLocalActivo,
      registrosAceite: registrosAceiteDelLocalActivo,
      productos: productosDelLocalActivo,
      addFreidora,
      updateFreidora,
      deleteFreidora,
      registrarCambio,
      registrarRelleno,
      eliminarRegistroAceite,
      consumoPorCiclo
    }
  ), tab === "buscar" && /* @__PURE__ */ import_react4.default.createElement(BusquedaGlobal, { productos: productosDelLocalActivo, proveedores, clientes, fichasCosto: fichasCostoDelLocalActivo, empleados: empleadosDelLocalActivo, setTab }), tab === "pedidos" && /* @__PURE__ */ import_react4.default.createElement(
    Pedidos,
    {
      pedidos: pedidosDelLocalActivo,
      proveedores,
      productos: productosDelLocalActivo,
      crearPedido,
      actualizarPedido,
      eliminarPedido,
      proveedorPorId,
      productoPorId: (id) => productosDelLocalActivo.find((p22) => p22.id === id),
      sugerenciasPedido: sugerenciasPedidoDelLocalActivo,
      addProducto
    }
  ), tab === "recepcion" && /* @__PURE__ */ import_react4.default.createElement(Recepcion, { pedidos: pedidosDelLocalActivo, proveedorPorId, productoPorId: (id) => productosDelLocalActivo.find((p22) => p22.id === id), recibirPedido, almacenCongelado, recibirConAlbaran, recibirConFotoIA, cerrarPedido }), tab === "conteo" && /* @__PURE__ */ import_react4.default.createElement(
    InventarioCiego,
    {
      productos: productosDelLocalActivo,
      proveedores,
      conteos: conteosDelLocalActivo,
      iniciarConteo,
      actualizarConteoItem,
      actualizarResponsable,
      finalizarConteo,
      aplicarAjustes,
      eliminarConteo,
      revertirUltimaAplicacion,
      productoPorId: (id) => productosDelLocalActivo.find((p22) => p22.id === id),
      crearProductoEnConteo,
      clasificacionABC: clasificacionABCDelLocalActivo,
      almacenCongelado
    }
  ), tab === "reportes" && /* @__PURE__ */ import_react4.default.createElement(
    Reportes,
    {
      rotacionPorProducto: rotacionPorProductoDelLocalActivo,
      gastoPorProveedor: gastoPorProveedorDelLocalActivo,
      productosSinMovimiento: productosSinMovimientoDelLocalActivo,
      valorInventario: valorInventarioDelLocalActivo,
      margenPorProducto: margenPorProductoDelLocalActivo,
      patronesDesviacionConteo: patronesDesviacionConteoDelLocalActivo
    }
  ), tab === "resultados" && /* @__PURE__ */ import_react4.default.createElement(
    Resultados,
    {
      movimientos: movimientosInforme,
      productos: productosInforme,
      productoPorId: (id) => productosInforme.find((p22) => p22.id === id),
      gastosGenerales: gastosGeneralesInforme,
      addGasto: addGastoInforme,
      deleteGasto: deleteGastoInforme,
      empleados: empleadosInforme
    }
  ), tab === "fichas" && /* @__PURE__ */ import_react4.default.createElement(
    FichasCosto,
    {
      fichasCosto: fichasCostoDelLocalActivo,
      productos: productosDelLocalActivo,
      addFichaCosto,
      updateFichaCosto,
      deleteFichaCosto,
      updateProducto,
      addProducto,
      ordenesProduccion: ordenesProduccionDelLocalActivo,
      nominas,
      fichajes
    }
  ), tab === "produccion" && /* @__PURE__ */ import_react4.default.createElement(Produccion, { fichasCosto: fichasCostoDelLocalActivo, productos: productosDelLocalActivo, ordenesProduccion: ordenesProduccionDelLocalActivo, producir, anularProduccion, traspasarStock }), tab === "mermas" && /* @__PURE__ */ import_react4.default.createElement(Mermas, { productos: productosDelLocalActivo, movimientos: movimientosDelLocalActivo, registrarSalida, almacenCongelado }), tab === "etiquetas" && /* @__PURE__ */ import_react4.default.createElement(EtiquetasCatalogo, { productos: productosDelLocalActivo, fichasCosto: fichasCostoDelLocalActivo, alergenosDeFicha }), tab === "albaranes" && /* @__PURE__ */ import_react4.default.createElement(
    Albaranes,
    {
      albaranes: albaranesDelLocalActivo,
      proveedores,
      productos: productosDelLocalActivo,
      proveedorPorId,
      buscarEnCatalogo,
      guardarAlbaran,
      eliminarAlbaran,
      confirmarAlbaran,
      anularAlbaran,
      marcarPagada,
      duplicadosDe,
      desviacionesDePrecio,
      prefill: prefillAlbaran,
      limpiarPrefill: () => setPrefillAlbaran(null),
      pedidoParaFotoIA,
      limpiarPedidoParaFotoIA: () => setPedidoParaFotoIA(null),
      pedidos: pedidosDelLocalActivo
    }
  ), tab === "pagos" && /* @__PURE__ */ import_react4.default.createElement(
    CuentasPorPagar,
    {
      facturasPorPagar: facturasPorPagarDelLocalActivo,
      totalPendientePago: totalPendientePagoDelLocalActivo,
      marcarPagada,
      marcarPagadaFacturaDirecta,
      addFacturaDirecta,
      deleteFacturaDirecta,
      proveedores,
      resaltadaId: facturaDirectaResaltada,
      limpiarResaltada: () => setFacturaDirectaResaltada(null)
    }
  ), tab === "personal" && /* @__PURE__ */ import_react4.default.createElement(
    Personal,
    {
      emple
```

### offset 4100659
```js
ualizarConteoItem,
      actualizarResponsable,
      finalizarConteo,
      aplicarAjustes,
      eliminarConteo,
      revertirUltimaAplicacion,
      productoPorId: (id) => productosDelLocalActivo.find((p22) => p22.id === id),
      crearProductoEnConteo,
      clasificacionABC: clasificacionABCDelLocalActivo,
      almacenCongelado
    }
  ), tab === "reportes" && /* @__PURE__ */ import_react4.default.createElement(
    Reportes,
    {
      rotacionPorProducto: rotacionPorProductoDelLocalActivo,
      gastoPorProveedor: gastoPorProveedorDelLocalActivo,
      productosSinMovimiento: productosSinMovimientoDelLocalActivo,
      valorInventario: valorInventarioDelLocalActivo,
      margenPorProducto: margenPorProductoDelLocalActivo,
      patronesDesviacionConteo: patronesDesviacionConteoDelLocalActivo
    }
  ), tab === "resultados" && /* @__PURE__ */ import_react4.default.createElement(
    Resultados,
    {
      movimientos: movimientosInforme,
      productos: productosInforme,
      productoPorId: (id) => productosInforme.find((p22) => p22.id === id),
      gastosGenerales: gastosGeneralesInforme,
      addGasto: addGastoInforme,
      deleteGasto: deleteGastoInforme,
      empleados: empleadosInforme
    }
  ), tab === "fichas" && /* @__PURE__ */ import_react4.default.createElement(
    FichasCosto,
    {
      fichasCosto: fichasCostoDelLocalActivo,
      productos: productosDelLocalActivo,
      addFichaCosto,
      updateFichaCosto,
      deleteFichaCosto,
      updateProducto,
      addProducto,
      ordenesProduccion: ordenesProduccionDelLocalActivo,
      nominas,
      fichajes
    }
  ), tab === "produccion" && /* @__PURE__ */ import_react4.default.createElement(Produccion, { fichasCosto: fichasCostoDelLocalActivo, productos: productosDelLocalActivo, ordenesProduccion: ordenesProduccionDelLocalActivo, producir, anularProduccion, traspasarStock }), tab === "mermas" && /* @__PURE__ */ import_react4.default.createElement(Mermas, { productos: productosDelLocalActivo, movimientos: movimientosDelLocalActivo, registrarSalida, almacenCongelado }), tab === "etiquetas" && /* @__PURE__ */ import_react4.default.createElement(EtiquetasCatalogo, { productos: productosDelLocalActivo, fichasCosto: fichasCostoDelLocalActivo, alergenosDeFicha }), tab === "albaranes" && /* @__PURE__ */ import_react4.default.createElement(
    Albaranes,
    {
      albaranes: albaranesDelLocalActivo,
      proveedores,
      productos: productosDelLocalActivo,
      proveedorPorId,
      buscarEnCatalogo,
      guardarAlbaran,
      eliminarAlbaran,
      confirmarAlbaran,
      anularAlbaran,
      marcarPagada,
      duplicadosDe,
      desviacionesDePrecio,
      prefill: prefillAlbaran,
      limpiarPrefill: () => setPrefillAlbaran(null),
      pedidoParaFotoIA,
      limpiarPedidoParaFotoIA: () => setPedidoParaFotoIA(null),
      pedidos: pedidosDelLocalActivo
    }
  ), tab === "pagos" && /* @__PURE__ */ import_react4.default.createElement(
    CuentasPorPagar,
    {
      facturasPorPagar: facturasPorPagarDelLocalActivo,
      totalPendientePago: totalPendientePagoDelLocalActivo,
      marcarPagada,
      marcarPagadaFacturaDirecta,
      addFacturaDirecta,
      deleteFacturaDirecta,
      proveedores,
      resaltadaId: facturaDirectaResaltada,
      limpiarResaltada: () => setFacturaDirectaResaltada(null)
    }
  ), tab === "personal" && /* @__PURE__ */ import_react4.default.createElement(
    Personal,
    {
      empleados: empleadosDelLocalActivo,
      addEmpleado,
      updateEmpleado,
      deleteEmpleado,
      anonimizarEmpleado,
      registrarAusencia,
      eliminarAusencia,
      registrarEpi,
      eliminarEpi,
      documentosPersonalCaducan,
      fichajes: fichajesDelLocalActivo,
      nominas: nominasDelLocalActivo,
      entrevistas,
      crearEntrevista,
      actualizarEntrevista,
      finalizarEntrevista,
      eliminarEntrevista,
      crearPrefiltro,
      listarPrefiltros,
      eliminarPrefiltro,
      crearCuentaEmpleado
    }
  ), tab === "fichaje" && /* @__PURE__ */ import_react4.default.createElement(
    RegistroHorario,
    {
      empleados: empleadosDelLocalActivo,
      fichajes: fichajesDelLocalActivo,
      fichar,
      addFichajeManual,
      updateFichaje,
      eliminarFichaje,
      fichajesAbiertos: fichajesAbiertosDelLocalActivo
    }
  ), tab === "nominas" && /* @__PURE__ */ import_react4.default.createElement(
    CostePersonal,
    {
      empleados: empleadosDelLocalActivo,
      nominas: nominasDelLocalActivo,
      addNomina,
      updateNomina,
      deleteNomina,
      fichajes: fichajesDelLocalActivo,
      movimientos: movimientosDelLocalActivo
    }
  ), tab === "venta" && (localInformeId && localActivoId === localInformeId ? /* @__PURE__ */ import_react4.default.createElement(VentaRapida, { productos: productosDelLocalActivo, venderCarrito, anularVenta, movimientos: movimientosDelLocalActivo, registrarAuditoria, local: locales.find((l22) => l22.id === localActivoId) || null, configEmpresa: empresaDelLocalActivo }) : /* @__PURE__ */ import_react4.default.createElement("div", null, /* @__PURE__ */ import_react4.default.createElement(Card, { className: "p-5 mb-4" }, /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[16px] font-semibold mb-2" }, "TPV"), /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[12.5px]", style: { color: C2.inkSoft } }, "El TPV no puede abrirse en Todos los locales. Selecciona un local concreto: cada venta, stock y caja pertenecen a un \xFAnico local.")), /* @__PURE__ */ import_react4.default.createElement(SelectorLocalInformes, { locales: localesEmpresaActiva, valor: lo
```

### offset 4102929
```js
enosDeFicha }), tab === "albaranes" && /* @__PURE__ */ import_react4.default.createElement(
    Albaranes,
    {
      albaranes: albaranesDelLocalActivo,
      proveedores,
      productos: productosDelLocalActivo,
      proveedorPorId,
      buscarEnCatalogo,
      guardarAlbaran,
      eliminarAlbaran,
      confirmarAlbaran,
      anularAlbaran,
      marcarPagada,
      duplicadosDe,
      desviacionesDePrecio,
      prefill: prefillAlbaran,
      limpiarPrefill: () => setPrefillAlbaran(null),
      pedidoParaFotoIA,
      limpiarPedidoParaFotoIA: () => setPedidoParaFotoIA(null),
      pedidos: pedidosDelLocalActivo
    }
  ), tab === "pagos" && /* @__PURE__ */ import_react4.default.createElement(
    CuentasPorPagar,
    {
      facturasPorPagar: facturasPorPagarDelLocalActivo,
      totalPendientePago: totalPendientePagoDelLocalActivo,
      marcarPagada,
      marcarPagadaFacturaDirecta,
      addFacturaDirecta,
      deleteFacturaDirecta,
      proveedores,
      resaltadaId: facturaDirectaResaltada,
      limpiarResaltada: () => setFacturaDirectaResaltada(null)
    }
  ), tab === "personal" && /* @__PURE__ */ import_react4.default.createElement(
    Personal,
    {
      empleados: empleadosDelLocalActivo,
      addEmpleado,
      updateEmpleado,
      deleteEmpleado,
      anonimizarEmpleado,
      registrarAusencia,
      eliminarAusencia,
      registrarEpi,
      eliminarEpi,
      documentosPersonalCaducan,
      fichajes: fichajesDelLocalActivo,
      nominas: nominasDelLocalActivo,
      entrevistas,
      crearEntrevista,
      actualizarEntrevista,
      finalizarEntrevista,
      eliminarEntrevista,
      crearPrefiltro,
      listarPrefiltros,
      eliminarPrefiltro,
      crearCuentaEmpleado
    }
  ), tab === "fichaje" && /* @__PURE__ */ import_react4.default.createElement(
    RegistroHorario,
    {
      empleados: empleadosDelLocalActivo,
      fichajes: fichajesDelLocalActivo,
      fichar,
      addFichajeManual,
      updateFichaje,
      eliminarFichaje,
      fichajesAbiertos: fichajesAbiertosDelLocalActivo
    }
  ), tab === "nominas" && /* @__PURE__ */ import_react4.default.createElement(
    CostePersonal,
    {
      empleados: empleadosDelLocalActivo,
      nominas: nominasDelLocalActivo,
      addNomina,
      updateNomina,
      deleteNomina,
      fichajes: fichajesDelLocalActivo,
      movimientos: movimientosDelLocalActivo
    }
  ), tab === "venta" && (localInformeId && localActivoId === localInformeId ? /* @__PURE__ */ import_react4.default.createElement(VentaRapida, { productos: productosDelLocalActivo, venderCarrito, anularVenta, movimientos: movimientosDelLocalActivo, registrarAuditoria, local: locales.find((l22) => l22.id === localActivoId) || null, configEmpresa: empresaDelLocalActivo }) : /* @__PURE__ */ import_react4.default.createElement("div", null, /* @__PURE__ */ import_react4.default.createElement(Card, { className: "p-5 mb-4" }, /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[16px] font-semibold mb-2" }, "TPV"), /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[12.5px]", style: { color: C2.inkSoft } }, "El TPV no puede abrirse en Todos los locales. Selecciona un local concreto: cada venta, stock y caja pertenecen a un \xFAnico local.")), /* @__PURE__ */ import_react4.default.createElement(SelectorLocalInformes, { locales: localesEmpresaActiva, valor: localInformeId, onChange: seleccionarContextoLocal }))), tab === "encargos" && /* @__PURE__ */ import_react4.default.createElement(
    Encargos,
    {
      encargosPendientes: encargosPendientesDelLocalActivo,
      encargos: encargosDelLocalActivo,
      clientes,
      productos: productosDelLocalActivo,
      addEncargo,
      updateEncargo,
      deleteEncargo,
      entregarEncargo,
      addCliente
    }
  ), tab === "clientes" && /* @__PURE__ */ import_react4.default.createElement(
    Clientes,
    {
      analisisClientes,
      clientesDormidos,
      ventaCruzada,
      addCliente,
      updateCliente,
      deleteCliente,
      anonimizarCliente
    }
  ), tab === "devoluciones" && /* @__PURE__ */ import_react4.default.createElement(
    Devoluciones,
    { key: localActivoId || "todos", productos: productosDelLocalActivo, proveedores, devoluciones: devolucionesDelLocalActivo, movimientos: movimientosDelLocalActivo, registrarDevolucionCliente, registrarDevolucionProveedor, leerBorradorDevolucion }
  ), tab === "facturas" && /* @__PURE__ */ import_react4.default.createElement(
    Facturas,
    {
      albaranes: albaranesDelLocalActivo,
      facturasDirectas: facturasDirectasDelLocalActivo,
      proveedorPorId,
      irAAlbaran: (albId) => {
        const a22 = albaranesDelLocalActivo.find((x3) => x3.id === albId);
        if (a22) {
          setPrefillAlbaran(a22);
          setTab("albaranes");
        }
      },
      irAFacturaDirecta: (fdId) => {
        if (!facturasDirectasDelLocalActivo.some((f22) => f22.id === fdId)) return;
        setFacturaDirectaResaltada(fdId);
        setTab("pagos");
      }
    }
  ), tab === "libroiva" && /* @__PURE__ */ import_react4.default.createElement(LibroIva, { movimientos: movimientosInforme, productos: productosInforme, albaranes: albaranesInforme, proveedorPorId, facturasDirectas: facturasDirectasInforme }), tab === "caja" && /* @__PURE__ */ import_react4.default.createElement(ArqueoCaja, { key: localActivoId || "todos", movimientos: movimientosDelLocalActivo, arqueos: arqueosDelLocalActivo, addArqueo, deleteArqueo, encargos: encargosDelLocalActivo, movimientosCaja: movimientosCajaDelLocalActivo, registrarMovimientoCaja, eliminarMovimientoCaja, leerBorradorArqueo, leerBor
```

### offset 4103591
```js
@__PURE__ */ import_react4.default.createElement(
    CuentasPorPagar,
    {
      facturasPorPagar: facturasPorPagarDelLocalActivo,
      totalPendientePago: totalPendientePagoDelLocalActivo,
      marcarPagada,
      marcarPagadaFacturaDirecta,
      addFacturaDirecta,
      deleteFacturaDirecta,
      proveedores,
      resaltadaId: facturaDirectaResaltada,
      limpiarResaltada: () => setFacturaDirectaResaltada(null)
    }
  ), tab === "personal" && /* @__PURE__ */ import_react4.default.createElement(
    Personal,
    {
      empleados: empleadosDelLocalActivo,
      addEmpleado,
      updateEmpleado,
      deleteEmpleado,
      anonimizarEmpleado,
      registrarAusencia,
      eliminarAusencia,
      registrarEpi,
      eliminarEpi,
      documentosPersonalCaducan,
      fichajes: fichajesDelLocalActivo,
      nominas: nominasDelLocalActivo,
      entrevistas,
      crearEntrevista,
      actualizarEntrevista,
      finalizarEntrevista,
      eliminarEntrevista,
      crearPrefiltro,
      listarPrefiltros,
      eliminarPrefiltro,
      crearCuentaEmpleado
    }
  ), tab === "fichaje" && /* @__PURE__ */ import_react4.default.createElement(
    RegistroHorario,
    {
      empleados: empleadosDelLocalActivo,
      fichajes: fichajesDelLocalActivo,
      fichar,
      addFichajeManual,
      updateFichaje,
      eliminarFichaje,
      fichajesAbiertos: fichajesAbiertosDelLocalActivo
    }
  ), tab === "nominas" && /* @__PURE__ */ import_react4.default.createElement(
    CostePersonal,
    {
      empleados: empleadosDelLocalActivo,
      nominas: nominasDelLocalActivo,
      addNomina,
      updateNomina,
      deleteNomina,
      fichajes: fichajesDelLocalActivo,
      movimientos: movimientosDelLocalActivo
    }
  ), tab === "venta" && (localInformeId && localActivoId === localInformeId ? /* @__PURE__ */ import_react4.default.createElement(VentaRapida, { productos: productosDelLocalActivo, venderCarrito, anularVenta, movimientos: movimientosDelLocalActivo, registrarAuditoria, local: locales.find((l22) => l22.id === localActivoId) || null, configEmpresa: empresaDelLocalActivo }) : /* @__PURE__ */ import_react4.default.createElement("div", null, /* @__PURE__ */ import_react4.default.createElement(Card, { className: "p-5 mb-4" }, /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[16px] font-semibold mb-2" }, "TPV"), /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[12.5px]", style: { color: C2.inkSoft } }, "El TPV no puede abrirse en Todos los locales. Selecciona un local concreto: cada venta, stock y caja pertenecen a un \xFAnico local.")), /* @__PURE__ */ import_react4.default.createElement(SelectorLocalInformes, { locales: localesEmpresaActiva, valor: localInformeId, onChange: seleccionarContextoLocal }))), tab === "encargos" && /* @__PURE__ */ import_react4.default.createElement(
    Encargos,
    {
      encargosPendientes: encargosPendientesDelLocalActivo,
      encargos: encargosDelLocalActivo,
      clientes,
      productos: productosDelLocalActivo,
      addEncargo,
      updateEncargo,
      deleteEncargo,
      entregarEncargo,
      addCliente
    }
  ), tab === "clientes" && /* @__PURE__ */ import_react4.default.createElement(
    Clientes,
    {
      analisisClientes,
      clientesDormidos,
      ventaCruzada,
      addCliente,
      updateCliente,
      deleteCliente,
      anonimizarCliente
    }
  ), tab === "devoluciones" && /* @__PURE__ */ import_react4.default.createElement(
    Devoluciones,
    { key: localActivoId || "todos", productos: productosDelLocalActivo, proveedores, devoluciones: devolucionesDelLocalActivo, movimientos: movimientosDelLocalActivo, registrarDevolucionCliente, registrarDevolucionProveedor, leerBorradorDevolucion }
  ), tab === "facturas" && /* @__PURE__ */ import_react4.default.createElement(
    Facturas,
    {
      albaranes: albaranesDelLocalActivo,
      facturasDirectas: facturasDirectasDelLocalActivo,
      proveedorPorId,
      irAAlbaran: (albId) => {
        const a22 = albaranesDelLocalActivo.find((x3) => x3.id === albId);
        if (a22) {
          setPrefillAlbaran(a22);
          setTab("albaranes");
        }
      },
      irAFacturaDirecta: (fdId) => {
        if (!facturasDirectasDelLocalActivo.some((f22) => f22.id === fdId)) return;
        setFacturaDirectaResaltada(fdId);
        setTab("pagos");
      }
    }
  ), tab === "libroiva" && /* @__PURE__ */ import_react4.default.createElement(LibroIva, { movimientos: movimientosInforme, productos: productosInforme, albaranes: albaranesInforme, proveedorPorId, facturasDirectas: facturasDirectasInforme }), tab === "caja" && /* @__PURE__ */ import_react4.default.createElement(ArqueoCaja, { key: localActivoId || "todos", movimientos: movimientosDelLocalActivo, arqueos: arqueosDelLocalActivo, addArqueo, deleteArqueo, encargos: encargosDelLocalActivo, movimientosCaja: movimientosCajaDelLocalActivo, registrarMovimientoCaja, eliminarMovimientoCaja, leerBorradorArqueo, leerBorradorMovimientoCaja }), tab === "tesoreria" && /* @__PURE__ */ import_react4.default.createElement(Tesoreria, { proyeccionTesoreria, promedioDiarioVentas }), tab === "estacionalidad" && /* @__PURE__ */ import_react4.default.createElement(Estacionalidad, { ingresosPorMes }), tab === "turnos" && /* @__PURE__ */ import_react4.default.createElement(
    Turnos,
    {
      empleados: empleadosDelLocalActivo,
      turnos: turnosDelLocalActivo,
      addTurno,
      updateTurno,
      deleteTurno,
      copiarSemana
    }
  ), tab === "mapa" && /* @__PURE__ */ import_react4.default.createElement(MapaAlmacen, { productos: productosDelLocalActivo, proveedorPorI
```

### offset 4103920
```js
ltadaId: facturaDirectaResaltada,
      limpiarResaltada: () => setFacturaDirectaResaltada(null)
    }
  ), tab === "personal" && /* @__PURE__ */ import_react4.default.createElement(
    Personal,
    {
      empleados: empleadosDelLocalActivo,
      addEmpleado,
      updateEmpleado,
      deleteEmpleado,
      anonimizarEmpleado,
      registrarAusencia,
      eliminarAusencia,
      registrarEpi,
      eliminarEpi,
      documentosPersonalCaducan,
      fichajes: fichajesDelLocalActivo,
      nominas: nominasDelLocalActivo,
      entrevistas,
      crearEntrevista,
      actualizarEntrevista,
      finalizarEntrevista,
      eliminarEntrevista,
      crearPrefiltro,
      listarPrefiltros,
      eliminarPrefiltro,
      crearCuentaEmpleado
    }
  ), tab === "fichaje" && /* @__PURE__ */ import_react4.default.createElement(
    RegistroHorario,
    {
      empleados: empleadosDelLocalActivo,
      fichajes: fichajesDelLocalActivo,
      fichar,
      addFichajeManual,
      updateFichaje,
      eliminarFichaje,
      fichajesAbiertos: fichajesAbiertosDelLocalActivo
    }
  ), tab === "nominas" && /* @__PURE__ */ import_react4.default.createElement(
    CostePersonal,
    {
      empleados: empleadosDelLocalActivo,
      nominas: nominasDelLocalActivo,
      addNomina,
      updateNomina,
      deleteNomina,
      fichajes: fichajesDelLocalActivo,
      movimientos: movimientosDelLocalActivo
    }
  ), tab === "venta" && (localInformeId && localActivoId === localInformeId ? /* @__PURE__ */ import_react4.default.createElement(VentaRapida, { productos: productosDelLocalActivo, venderCarrito, anularVenta, movimientos: movimientosDelLocalActivo, registrarAuditoria, local: locales.find((l22) => l22.id === localActivoId) || null, configEmpresa: empresaDelLocalActivo }) : /* @__PURE__ */ import_react4.default.createElement("div", null, /* @__PURE__ */ import_react4.default.createElement(Card, { className: "p-5 mb-4" }, /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[16px] font-semibold mb-2" }, "TPV"), /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[12.5px]", style: { color: C2.inkSoft } }, "El TPV no puede abrirse en Todos los locales. Selecciona un local concreto: cada venta, stock y caja pertenecen a un \xFAnico local.")), /* @__PURE__ */ import_react4.default.createElement(SelectorLocalInformes, { locales: localesEmpresaActiva, valor: localInformeId, onChange: seleccionarContextoLocal }))), tab === "encargos" && /* @__PURE__ */ import_react4.default.createElement(
    Encargos,
    {
      encargosPendientes: encargosPendientesDelLocalActivo,
      encargos: encargosDelLocalActivo,
      clientes,
      productos: productosDelLocalActivo,
      addEncargo,
      updateEncargo,
      deleteEncargo,
      entregarEncargo,
      addCliente
    }
  ), tab === "clientes" && /* @__PURE__ */ import_react4.default.createElement(
    Clientes,
    {
      analisisClientes,
      clientesDormidos,
      ventaCruzada,
      addCliente,
      updateCliente,
      deleteCliente,
      anonimizarCliente
    }
  ), tab === "devoluciones" && /* @__PURE__ */ import_react4.default.createElement(
    Devoluciones,
    { key: localActivoId || "todos", productos: productosDelLocalActivo, proveedores, devoluciones: devolucionesDelLocalActivo, movimientos: movimientosDelLocalActivo, registrarDevolucionCliente, registrarDevolucionProveedor, leerBorradorDevolucion }
  ), tab === "facturas" && /* @__PURE__ */ import_react4.default.createElement(
    Facturas,
    {
      albaranes: albaranesDelLocalActivo,
      facturasDirectas: facturasDirectasDelLocalActivo,
      proveedorPorId,
      irAAlbaran: (albId) => {
        const a22 = albaranesDelLocalActivo.find((x3) => x3.id === albId);
        if (a22) {
          setPrefillAlbaran(a22);
          setTab("albaranes");
        }
      },
      irAFacturaDirecta: (fdId) => {
        if (!facturasDirectasDelLocalActivo.some((f22) => f22.id === fdId)) return;
        setFacturaDirectaResaltada(fdId);
        setTab("pagos");
      }
    }
  ), tab === "libroiva" && /* @__PURE__ */ import_react4.default.createElement(LibroIva, { movimientos: movimientosInforme, productos: productosInforme, albaranes: albaranesInforme, proveedorPorId, facturasDirectas: facturasDirectasInforme }), tab === "caja" && /* @__PURE__ */ import_react4.default.createElement(ArqueoCaja, { key: localActivoId || "todos", movimientos: movimientosDelLocalActivo, arqueos: arqueosDelLocalActivo, addArqueo, deleteArqueo, encargos: encargosDelLocalActivo, movimientosCaja: movimientosCajaDelLocalActivo, registrarMovimientoCaja, eliminarMovimientoCaja, leerBorradorArqueo, leerBorradorMovimientoCaja }), tab === "tesoreria" && /* @__PURE__ */ import_react4.default.createElement(Tesoreria, { proyeccionTesoreria, promedioDiarioVentas }), tab === "estacionalidad" && /* @__PURE__ */ import_react4.default.createElement(Estacionalidad, { ingresosPorMes }), tab === "turnos" && /* @__PURE__ */ import_react4.default.createElement(
    Turnos,
    {
      empleados: empleadosDelLocalActivo,
      turnos: turnosDelLocalActivo,
      addTurno,
      updateTurno,
      deleteTurno,
      copiarSemana
    }
  ), tab === "mapa" && /* @__PURE__ */ import_react4.default.createElement(MapaAlmacen, { productos: productosDelLocalActivo, proveedorPorId }), tab === "traspasos" && /* @__PURE__ */ import_react4.default.createElement(Traspasos, { productos: productosDelLocalActivo, productosEmpresa: productos.filter((p22) => localesEmpresaActiva.some((l22) => l22.id === p22.localId)), locales: localesEmpresaActiva, localActivoId, traspasos: traspasosDelLocalActivo, traspasarSto
```

### offset 4107801
```js
 }
      },
      irAFacturaDirecta: (fdId) => {
        if (!facturasDirectasDelLocalActivo.some((f22) => f22.id === fdId)) return;
        setFacturaDirectaResaltada(fdId);
        setTab("pagos");
      }
    }
  ), tab === "libroiva" && /* @__PURE__ */ import_react4.default.createElement(LibroIva, { movimientos: movimientosInforme, productos: productosInforme, albaranes: albaranesInforme, proveedorPorId, facturasDirectas: facturasDirectasInforme }), tab === "caja" && /* @__PURE__ */ import_react4.default.createElement(ArqueoCaja, { key: localActivoId || "todos", movimientos: movimientosDelLocalActivo, arqueos: arqueosDelLocalActivo, addArqueo, deleteArqueo, encargos: encargosDelLocalActivo, movimientosCaja: movimientosCajaDelLocalActivo, registrarMovimientoCaja, eliminarMovimientoCaja, leerBorradorArqueo, leerBorradorMovimientoCaja }), tab === "tesoreria" && /* @__PURE__ */ import_react4.default.createElement(Tesoreria, { proyeccionTesoreria, promedioDiarioVentas }), tab === "estacionalidad" && /* @__PURE__ */ import_react4.default.createElement(Estacionalidad, { ingresosPorMes }), tab === "turnos" && /* @__PURE__ */ import_react4.default.createElement(
    Turnos,
    {
      empleados: empleadosDelLocalActivo,
      turnos: turnosDelLocalActivo,
      addTurno,
      updateTurno,
      deleteTurno,
      copiarSemana
    }
  ), tab === "mapa" && /* @__PURE__ */ import_react4.default.createElement(MapaAlmacen, { productos: productosDelLocalActivo, proveedorPorId }), tab === "traspasos" && /* @__PURE__ */ import_react4.default.createElement(Traspasos, { productos: productosDelLocalActivo, productosEmpresa: productos.filter((p22) => localesEmpresaActiva.some((l22) => l22.id === p22.localId)), locales: localesEmpresaActiva, localActivoId, traspasos: traspasosDelLocalActivo, traspasarStock, traspasarEntreLocales, pisoVentaBajo: pisoVentaBajoDelLocalActivo, fichasCosto: fichasCostoDelLocalActivo }), tab === "appcc" && /* @__PURE__ */ import_react4.default.createElement(
    Appcc,
    {
      puntosControl: puntosControlDelLocalActivo,
      registrosAppcc: registrosAppccDelLocalActivo,
      addPuntoControl,
      updatePuntoControl,
      deletePuntoControl,
      registrarAppcc,
      eliminarRegistroAppcc,
      appccPendientesHoy,
      productos: productosDelLocalActivo,
      fichasCosto: fichasCostoDelLocalActivo,
      alergenosDeFicha
    }
  ), tab === "saldo" && /* @__PURE__ */ import_react4.default.createElement(SaldoAlmacen, { productos: productosDelLocalActivo, proveedores, valorInventario: valorInventarioDelLocalActivo, valorUtillaje: valorUtillajeDelLocalActivo, proveedorPorId, clasificacionABC: clasificacionABCDelLocalActivo, analisisABC: analisisABCDelLocalActivo }), tab === "respaldos" && /* @__PURE__ */ import_react4.default.createElement(
    Respaldos,
    {
      historial,
      crearPuntoDeGuardado,
      restaurarDesdeHistorial,
      abrirRespaldo,
      abrirRestaurar,
      exportarExcelGeneral,
      pinPropietario,
      establecerPin,
      activarModoEmpleado
    }
  ), tab === "auditoria" && /* @__PURE__ */ import_react4.default.createElement(Auditoria, { auditoria }), tab === "diagnostico" && /* @__PURE__ */ import_react4.default.createElement(DiagnosticoStock, { diagnostico: diagnosticoStockDelLocalActivo, corregirProducto, movimientosParaReconciliar }), tab === "notificaciones" && /* @__PURE__ */ import_react4.default.createElement(Notificaciones, { localActivoId }), tab === "errores_sistema" && /* @__PURE__ */ import_react4.default.createElement(ErroresSistema, null), tab === "locales" && /* @__PURE__ */ import_react4.default.createElement(Locales, { locales, localActivoId, crearLocal, actualizarLocal, desactivarLocal, cambiarLocalActivo: cambiarLocalActivoConVista, configEmpresa, empresas, setEmpresas }));
  const itemsMeta = [
    { id: "dashboard", label: "Panel general", icon: ChartColumn },
    { id: "direccion", label: "Panel de direcci\xF3n", icon: TrendingUp },
    { id: "proveedores", label: "Proveedores", icon: Truck },
    { id: "productos", label: "Productos", icon: Package },
    { id: "buscar", label: "Buscar", icon: Search },
    { id: "historial_producto", label: "Historial de producto", icon: RotateCcwClock },
    { id: "pedidos", label: "Pedidos", icon: ShoppingCart, badge: pedidosPendientesDelLocalActivo.length },
    { id: "recepcion", label: "Recepci\xF3n", icon: ClipboardList },
    { id: "albaranes", label: "Albaranes", icon: FileText },
    { id: "facturas", label: "Facturas", icon: Files },
    { id: "pagos", label: "Cuentas por pagar", icon: Coins, badge: vencenProntoDelLocalActivo.length, badgeColor: C2.red },
    { id: "conteo", label: "Inventario ciego", icon: Boxes, badge: stockBajoDelLocalActivo.length, badgeColor: C2.amber },
    { id: "saldo", label: "Saldo de almac\xE9n", icon: ClipboardList },
    { id: "mapa", label: "Mapa de almac\xE9n", icon: Map2 },
    { id: "traspasos", label: "Traspasos", icon: ArrowLeftRight, badge: pisoVentaBajoDelLocalActivo.length, badgeColor: C2.amber },
    { id: "fichas", label: "Fichas de costo", icon: Calculator },
    { id: "produccion", label: "Producci\xF3n", icon: Factory },
    { id: "mermas", label: "Mermas", icon: Trash2 },
    { id: "etiquetas", label: "Etiquetas y cat\xE1logo", icon: Tags },
    { id: "reportes", label: "Reportes y rotaci\xF3n", icon: ChartColumn },
    { id: "resultados", label: "Resultados", icon: TrendingUp },
    { id: "personal", label: "Personal", icon: Users, badge: documentosPersonalProntoDelLocalActivo.length, badgeColor: C2.amber },
    { id: "fichaje", label: "Registro horario", icon: Clock, badge: fichajesAbiertosDelLocalActivo.length, badgeColor: C2.
```

### offset 4301358
```js
toria,
  setFreidoras,
  setRegistrosAceite,
  // estado propio de la pantalla de respaldos
  setHistorial,
  setPendingRestore,
  pendingRestore,
  setBackupText,
  backupText,
  setCopiado,
  setShowBackupView,
  setShowRestoreInput,
  setRestoreText,
  restoreText,
  setRestoreError,
  // extras para el Excel y la auditoría
  proveedorPorId,
  productoPorId,
  registrarAuditoria
}) {
  function datosDelNegocio() {
    return {
      proveedores,
      productos,
      pedidos: pedidos2,
      movimientos,
      conteos,
      fichasCosto,
      albaranes,
      catalogoProv,
      gastosGenerales,
      empleados,
      fichajes,
      registrosAppcc,
      puntosControl,
      clientes,
      encargos,
      arqueos,
      turnos,
      nominas,
      facturasDirectas,
      ordenesProduccion,
      traspasos,
      auditoria,
      freidoras,
      registrosAceite
    };
  }
  const SETTERS = {
    proveedores: setProveedores,
    productos: setProductos,
    pedidos: setPedidos,
    movimientos: setMovimientos,
    conteos: setConteos,
    fichasCosto: setFichasCosto,
    albaranes: setAlbaranes,
    catalogoProv: setCatalogoProv,
    gastosGenerales: setGastosGenerales,
    empleados: setEmpleados,
    fichajes: setFichajes,
    registrosAppcc: setRegistrosAppcc,
    puntosControl: setPuntosControl,
    clientes: setClientes,
    encargos: setEncargos,
    arqueos: setArqueos,
    turnos: setTurnos,
    nominas: setNominas,
    freidoras: setFreidoras,
    registrosAceite: setRegistrosAceite,
    facturasDirectas: setFacturasDirectas,
    ordenesProduccion: setOrdenesProduccion,
    traspasos: setTraspasos,
    auditoria: setAuditoria
  };
  const NOMBRES = {
    proveedores: "Proveedores",
    productos: "Productos",
    pedidos: "Pedidos",
    movimientos: "Movimientos",
    conteos: "Conteos",
    fichasCosto: "Fichas de costo",
    albaranes: "Albaranes",
    catalogoProv: "C\xF3digos de proveedor",
    gastosGenerales: "Gastos generales",
    empleados: "Empleados",
    fichajes: "Fichajes",
    registrosAppcc: "Registros APPCC",
    puntosControl: "Puntos de control",
    clientes: "Clientes",
    encargos: "Encargos",
    arqueos: "Arqueos de caja",
    turnos: "Turnos",
    nominas: "N\xF3minas",
    freidoras: "Freidoras",
    registrosAceite: "Registros de aceite",
    facturasDirectas: "Facturas directas",
    ordenesProduccion: "\xD3rdenes de producci\xF3n",
    traspasos: "Traspasos",
    auditoria: "Auditor\xEDa"
  };
  function cuantos(valor) {
    if (Array.isArray(valor)) return valor.length;
    if (valor && typeof valor === "object") return Object.keys(valor).length;
    return 0;
  }
  function compararConEstadoActual(respaldo) {
    if (!respaldo) return [];
    const actual = datosDelNegocio();
    return Object.keys(NOMBRES).filter((clave) => respaldo[clave] !== void 0).map((clave) => {
      const nActual = cuantos(actual[clave]);
      const nRespaldo = cuantos(respaldo[clave]);
      return { clave, nombre: NOMBRES[clave], actual: nActual, respaldo: nRespaldo, diferencia: nRespaldo - nActual };
    });
  }
  function coleccionesQueSeConservan(respaldo) {
    if (!respaldo) return [];
    return Object.keys(NOMBRES).filter((clave) => respaldo[clave] === void 0).map((clave) => NOMBRES[clave]);
  }
  function crearPuntoDeGuardado(motivo = "manual") {
    const snapshot = {
      id: uid(),
      fecha: (/* @__PURE__ */ new Date()).toISOString(),
      automatica: motivo !== "manual",
      motivo,
      backupVersion: 3,
      data: datosDelNegocio()
    };
    setHistorial((s22) => [snapshot, ...s22].slice(0, 30));
    return snapshot;
  }
  function restaurarDesdeHistorial(snapshot) {
    setPendingRestore({ ...snapshot.data, exportadoEl: snapshot.fecha });
  }
  function abrirRespaldo() {
    const data = {
      version: 2,
      // se mantiene por compatibilidad con lectores antiguos
      backupVersion: 3,
      // 3 = incluye nóminas, facturas, producción, traspasos y auditoría
      exportadoEl: (/* @__PURE__ */ new Date()).toISOString(),
      ...datosDelNegocio()
    };
    setBackupText(JSON.stringify(data));
    setCopiado(false);
    setShowBackupView(true);
  }
  function copiarRespaldo() {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(backupText).then(() => setCopiado(true)).catch(() => setCopiado(false));
    }
  }
  function abrirRestaurar() {
    setRestoreText("");
    setRestoreError("");
    setShowRestoreInput(true);
  }
  function validarRespaldo(data) {
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return "El respaldo no es v\xE1lido: no tiene el formato esperado.";
    }
    const conocidas = Object.keys(NOMBRES).filter((clave) => data[clave] !== void 0);
    if (conocidas.length === 0) {
      return "El respaldo no es v\xE1lido o est\xE1 incompleto: no contiene ninguna colecci\xF3n reconocible.";
    }
    for (const clave of conocidas) {
      const valor = data[clave];
      const esObjetoValido = clave === "catalogoProv" && valor && typeof valor === "object" && !Array.isArray(valor);
      if (!Array.isArray(valor) && !esObjetoValido) {
        return `El respaldo est\xE1 da\xF1ado: "${NOMBRES[clave]}" no tiene el formato correcto.`;
      }
    }
    return null;
  }
  function analizarTextoRestauracion() {
    let data;
    try {
      data = JSON.parse(restoreText.trim());
    } catch (err2) {
      setRestoreError("Ese texto no parece un respaldo v\xE1lido. Revisa que lo hayas copiado completo.");
      return;
    }
    const error = validarRespaldo(data);
    if (error) {
      setRestoreError(error);
      return;
    }
    setRestoreError("");
  
```

### offset 4302147
```js
 ordenesProduccion,
      traspasos,
      auditoria,
      freidoras,
      registrosAceite
    };
  }
  const SETTERS = {
    proveedores: setProveedores,
    productos: setProductos,
    pedidos: setPedidos,
    movimientos: setMovimientos,
    conteos: setConteos,
    fichasCosto: setFichasCosto,
    albaranes: setAlbaranes,
    catalogoProv: setCatalogoProv,
    gastosGenerales: setGastosGenerales,
    empleados: setEmpleados,
    fichajes: setFichajes,
    registrosAppcc: setRegistrosAppcc,
    puntosControl: setPuntosControl,
    clientes: setClientes,
    encargos: setEncargos,
    arqueos: setArqueos,
    turnos: setTurnos,
    nominas: setNominas,
    freidoras: setFreidoras,
    registrosAceite: setRegistrosAceite,
    facturasDirectas: setFacturasDirectas,
    ordenesProduccion: setOrdenesProduccion,
    traspasos: setTraspasos,
    auditoria: setAuditoria
  };
  const NOMBRES = {
    proveedores: "Proveedores",
    productos: "Productos",
    pedidos: "Pedidos",
    movimientos: "Movimientos",
    conteos: "Conteos",
    fichasCosto: "Fichas de costo",
    albaranes: "Albaranes",
    catalogoProv: "C\xF3digos de proveedor",
    gastosGenerales: "Gastos generales",
    empleados: "Empleados",
    fichajes: "Fichajes",
    registrosAppcc: "Registros APPCC",
    puntosControl: "Puntos de control",
    clientes: "Clientes",
    encargos: "Encargos",
    arqueos: "Arqueos de caja",
    turnos: "Turnos",
    nominas: "N\xF3minas",
    freidoras: "Freidoras",
    registrosAceite: "Registros de aceite",
    facturasDirectas: "Facturas directas",
    ordenesProduccion: "\xD3rdenes de producci\xF3n",
    traspasos: "Traspasos",
    auditoria: "Auditor\xEDa"
  };
  function cuantos(valor) {
    if (Array.isArray(valor)) return valor.length;
    if (valor && typeof valor === "object") return Object.keys(valor).length;
    return 0;
  }
  function compararConEstadoActual(respaldo) {
    if (!respaldo) return [];
    const actual = datosDelNegocio();
    return Object.keys(NOMBRES).filter((clave) => respaldo[clave] !== void 0).map((clave) => {
      const nActual = cuantos(actual[clave]);
      const nRespaldo = cuantos(respaldo[clave]);
      return { clave, nombre: NOMBRES[clave], actual: nActual, respaldo: nRespaldo, diferencia: nRespaldo - nActual };
    });
  }
  function coleccionesQueSeConservan(respaldo) {
    if (!respaldo) return [];
    return Object.keys(NOMBRES).filter((clave) => respaldo[clave] === void 0).map((clave) => NOMBRES[clave]);
  }
  function crearPuntoDeGuardado(motivo = "manual") {
    const snapshot = {
      id: uid(),
      fecha: (/* @__PURE__ */ new Date()).toISOString(),
      automatica: motivo !== "manual",
      motivo,
      backupVersion: 3,
      data: datosDelNegocio()
    };
    setHistorial((s22) => [snapshot, ...s22].slice(0, 30));
    return snapshot;
  }
  function restaurarDesdeHistorial(snapshot) {
    setPendingRestore({ ...snapshot.data, exportadoEl: snapshot.fecha });
  }
  function abrirRespaldo() {
    const data = {
      version: 2,
      // se mantiene por compatibilidad con lectores antiguos
      backupVersion: 3,
      // 3 = incluye nóminas, facturas, producción, traspasos y auditoría
      exportadoEl: (/* @__PURE__ */ new Date()).toISOString(),
      ...datosDelNegocio()
    };
    setBackupText(JSON.stringify(data));
    setCopiado(false);
    setShowBackupView(true);
  }
  function copiarRespaldo() {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(backupText).then(() => setCopiado(true)).catch(() => setCopiado(false));
    }
  }
  function abrirRestaurar() {
    setRestoreText("");
    setRestoreError("");
    setShowRestoreInput(true);
  }
  function validarRespaldo(data) {
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return "El respaldo no es v\xE1lido: no tiene el formato esperado.";
    }
    const conocidas = Object.keys(NOMBRES).filter((clave) => data[clave] !== void 0);
    if (conocidas.length === 0) {
      return "El respaldo no es v\xE1lido o est\xE1 incompleto: no contiene ninguna colecci\xF3n reconocible.";
    }
    for (const clave of conocidas) {
      const valor = data[clave];
      const esObjetoValido = clave === "catalogoProv" && valor && typeof valor === "object" && !Array.isArray(valor);
      if (!Array.isArray(valor) && !esObjetoValido) {
        return `El respaldo est\xE1 da\xF1ado: "${NOMBRES[clave]}" no tiene el formato correcto.`;
      }
    }
    return null;
  }
  function analizarTextoRestauracion() {
    let data;
    try {
      data = JSON.parse(restoreText.trim());
    } catch (err2) {
      setRestoreError("Ese texto no parece un respaldo v\xE1lido. Revisa que lo hayas copiado completo.");
      return;
    }
    const error = validarRespaldo(data);
    if (error) {
      setRestoreError(error);
      return;
    }
    setRestoreError("");
    setShowRestoreInput(false);
    setPendingRestore(data);
  }
  function confirmarRestauracion() {
    if (!pendingRestore) return;
    const puntoPrevio = crearPuntoDeGuardado("previo-a-restauracion");
    let restauradas = 0;
    Object.entries(SETTERS).forEach(([clave, setter]) => {
      if (pendingRestore[clave] !== void 0 && setter) {
        setter(pendingRestore[clave]);
        restauradas++;
      }
    });
    if (registrarAuditoria) {
      const version6 = pendingRestore.backupVersion || pendingRestore.version || "antigua";
      const fechaResp = pendingRestore.exportadoEl ? new Date(pendingRestore.exportadoEl).toLocaleString("es-ES") : "sin fecha";
      registrarAuditoria(
        "Restaurar respaldo",
        `${restauradas} colecciones restauradas \xB7 respald
```

### offset 5137139
```js
alNombre || "Destino"}` : t22.direccion === "a_piso" ? "Almac\xE9n \u2192 Piso de venta" : "Piso de venta \u2192 Almac\xE9n"), /* @__PURE__ */ import_react4.default.createElement("span", { className: "mono text-[12.5px] font-semibold" }, fmt(t22.cantidad), " ", producto.unidad)), /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[10.5px]", style: { color: C2.inkSoft } }, t22.fecha, " ", t22.hora)))))));
}
function BusquedaGlobal({ productos, proveedores, clientes, fichasCosto, empleados, setTab }) {
  const [q2, setQ] = (0, import_react4.useState)("");
  const resultados = (0, import_react4.useMemo)(() => {
    const texto = q2.trim().toLowerCase();
    if (texto.length < 2) return null;
    return {
      productos: productos.filter((p22) => p22.nombre.toLowerCase().includes(texto) || (p22.codigoBarras || "").toLowerCase().includes(texto)).slice(0, 8),
      proveedores: proveedores.filter((p22) => p22.nombre.toLowerCase().includes(texto)).slice(0, 8),
      clientes: clientes.filter((c22) => c22.nombre.toLowerCase().includes(texto)).slice(0, 8),
      fichasCosto: fichasCosto.filter((f22) => f22.nombre.toLowerCase().includes(texto)).slice(0, 8),
      empleados: empleados.filter((e2) => e2.nombre.toLowerCase().includes(texto)).slice(0, 8)
    };
  }, [q2, productos, proveedores, clientes, fichasCosto, empleados]);
  const totalResultados = resultados ? Object.values(resultados).reduce((a22, lista) => a22 + lista.length, 0) : 0;
  const GRUPOS = [
    { clave: "productos", titulo: "Productos", tab: "productos", icon: Package },
    { clave: "proveedores", titulo: "Proveedores", tab: "proveedores", icon: Truck },
    { clave: "clientes", titulo: "Clientes", tab: "clientes", icon: Users },
    { clave: "fichasCosto", titulo: "Fichas de costo", tab: "fichas", icon: Calculator },
    { clave: "empleados", titulo: "Personal", tab: "personal", icon: UserRound }
  ];
  return /* @__PURE__ */ import_react4.default.createElement("div", null, /* @__PURE__ */ import_react4.default.createElement(SectionTitle, null, "Buscar en todo el programa"), /* @__PURE__ */ import_react4.default.createElement(Card, { className: "mb-4" }, /* @__PURE__ */ import_react4.default.createElement(
    Input,
    {
      value: q2,
      onChange: (e2) => setQ(e2.target.value),
      placeholder: "Escribe un nombre\u2026 (productos, proveedores, clientes, fichas, personal)",
      autoFocus: true
    }
  )), q2.trim().length > 0 && q2.trim().length < 2 ? /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[12.5px]", style: { color: C2.inkSoft } }, "Sigue escribiendo, al menos 2 letras.") : resultados === null ? /* @__PURE__ */ import_react4.default.createElement(Empty, { text: "Escribe algo para buscar en productos, proveedores, clientes, fichas de costo y personal." }) : totalResultados === 0 ? /* @__PURE__ */ import_react4.default.createElement(Empty, { text: `Sin resultados para "${q2}".` }) : /* @__PURE__ */ import_react4.default.createElement("div", { className: "space-y-4" }, GRUPOS.map((g2) => {
    const lista = resultados[g2.clave];
    if (!lista || lista.length === 0) return null;
    const Icono = g2.icon;
    return /* @__PURE__ */ import_react4.default.createElement("div", { key: g2.clave }, /* @__PURE__ */ import_react4.default.createElement("div", { className: "flex items-center gap-1.5 text-[12px] font-semibold mb-2", style: { color: C2.inkSoft } }, /* @__PURE__ */ import_react4.default.createElement(Icono, { size: 14 }), " ", g2.titulo, " (", lista.length, ")"), /* @__PURE__ */ import_react4.default.createElement("div", { className: "space-y-1.5" }, lista.map((item) => /* @__PURE__ */ import_react4.default.createElement(
      "button",
      {
        key: item.id,
        onClick: () => setTab(g2.tab),
        className: "w-full text-left flex items-center justify-between px-3 py-2.5 rounded-lg",
        style: { border: `1px solid ${C2.line}`, background: C2.surface }
      },
      /* @__PURE__ */ import_react4.default.createElement("span", { className: "text-[13px]", style: { color: C2.ink } }, item.nombre),
      /* @__PURE__ */ import_react4.default.createElement(ChevronRight, { size: 15, color: C2.inkSoft })
    ))));
  })));
}
function AceiteFreidoras({ freidoras = [], registrosAceite = [], productos, addFreidora, updateFreidora, deleteFreidora, registrarCambio, registrarRelleno, eliminarRegistroAceite, consumoPorCiclo }) {
  const [showForm, setShowForm] = (0, import_react4.useState)(false);
  const [editingId, setEditingId] = (0, import_react4.useState)(null);
  const [form, setForm] = (0, import_react4.useState)({ nombre: "", litrosCarga: "", rellenoHabitual: "5", productoAceiteId: "" });
  const [error, setError] = (0, import_react4.useState)("");
  const [accion, setAccion] = (0, import_react4.useState)(null);
  const [litros, setLitros] = (0, import_react4.useState)("");
  const [tipoCambio, setTipoCambio] = (0, import_react4.useState)("Voluntario");
  const [observaciones, setObservaciones] = (0, import_react4.useState)("");
  const [responsable, setResponsable] = (0, import_react4.useState)("");
  const [errorAccion, setErrorAccion] = (0, import_react4.useState)("");
  const [confirmacionFaltanteAceite, setConfirmacionFaltanteAceite] = (0, import_react4.useState)("");
  const [confirmDeleteId, setConfirmDeleteId] = (0, import_react4.useState)(null);
  const [confirmEliminarRegistro, setConfirmEliminarRegistro] = (0, import_react4.useState)(null);
  const [avisoStockNoDevuelto, setAvisoStockNoDevuelto] = (0, import_react4.useState)("");
  const aceitesPosibles = (0, import_react4.useMemo)(
    () => productos.filter((p22) => /aceite|oliva|
```

## encargos:

### offset 4035995
```js
.stringify(registrosAceiteFinales) !== JSON.stringify(rac || [])) await saveKey("registrosAceite", registrosAceiteFinales);
      setReady(true);
      if (habiaFotos) await saveKey("albaranes", albaranesFinales);
      setTimeout(() => {
        skipSaveRef.current = false;
      }, 400);
      if (!autoSnapshotRef.current) {
        autoSnapshotRef.current = true;
        const tieneDatos = p22.length || pr.length || pe2.length || mo.length || co.length || fc.length || al.length || em.length;
        const hoy = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
        const yaHayUnoDeHoy = hi.some((h22) => h22.automatica && (h22.fecha || "").slice(0, 10) === hoy);
        if (tieneDatos && !yaHayUnoDeHoy) {
          const snapshot = {
            id: uid(),
            fecha: (/* @__PURE__ */ new Date()).toISOString(),
            automatica: true,
            motivo: "automatico-diario",
            backupVersion: 3,
            data: { proveedores: p22, productos: pr, pedidos: pe2, movimientos: mo, conteos: co, fichasCosto: fc, albaranes: alLimpios, catalogoProv: cp, gastosGenerales: gg, empleados: em, fichajes: fj, registrosAppcc: ra, puntosControl: pc, clientes: cl, encargos: en, arqueos: aq, turnos: tu, nominas: nom, facturasDirectas: fd2, ordenesProduccion: op, traspasos: tr, auditoria: au, freidoras: fre, registrosAceite: rac }
          };
          const historialFinal = [snapshot, ...hi].slice(0, 30);
          setHistorial(historialFinal);
          await saveKey("historialRespaldos", historialFinal);
        }
      }
    })();
  }, []);
  (0, import_react4.useEffect)(() => {
    if (ready && !skipSaveRef.current) saveKey("proveedores", proveedores);
  }, [proveedores, ready]);
  (0, import_react4.useEffect)(() => {
    if (ready && !skipSaveRef.current) saveKey("productos", productos);
  }, [productos, ready]);
  (0, import_react4.useEffect)(() => {
    if (ready && !skipSaveRef.current) saveKey("pedidos", pedidos2);
  }, [pedidos2, ready]);
  (0, import_react4.useEffect)(() => {
    if (ready && !skipSaveRef.current) saveKey("movimientos", movimientos);
  }, [movimientos, ready]);
  (0, import_react4.useEffect)(() => {
    if (ready && !skipSaveRef.current) saveKey("conteos", conteos);
  }, [conteos, ready]);
  (0, import_react4.useEffect)(() => {
    if (ready && !skipSaveRef.current) saveKey("fichasCosto", fichasCosto);
  }, [fichasCosto, ready]);
  (0, import_react4.useEffect)(() => {
    if (ready && !skipSaveRef.current) saveKey("historialRespaldos", historial);
  }, [historial, ready]);
  (0, import_react4.useEffect)(() => {
    if (ready && !skipSaveRef.current) saveKey("albaranes", albaranes);
  }, [albaranes, ready]);
  (0, import_react4.useEffect)(() => {
    if (ready && !skipSaveRef.current) saveKey("catalogoProv", catalogoProv);
  }, [catalogoProv, ready]);
  (0, import_react4.useEffect)(() => {
    if (ready && !skipSaveRef.current) saveKey("gastosGenerales", gastosGenerales);
  }, [gastosGenerales, ready]);
  (0, import_react4.useEffect)(() => {
    if (ready && !skipSaveRef.current) saveKey("empleados", empleados);
  }, [empleados, ready]);
  (0, import_react4.useEffect)(() => {
    if (ready && !skipSaveRef.current) saveKey("fichajes", fichajes);
  }, [fichajes, ready]);
  (0, import_react4.useEffect)(() => {
    if (ready && !skipSaveRef.current) saveKey("disenoMenu", disenoMenu);
  }, [disenoMenu, ready]);
  (0, import_react4.useEffect)(() => {
    if (ready && !skipSaveRef.current) saveKey("registrosAppcc", registrosAppcc);
  }, [registrosAppcc, ready]);
  (0, import_react4.useEffect)(() => {
    if (ready && !skipSaveRef.current) saveKey("freidoras", freidoras);
  }, [freidoras, ready]);
  (0, import_react4.useEffect)(() => {
    if (ready && !skipSaveRef.current) saveKey("registrosAceite", registrosAceite);
  }, [registrosAceite, ready]);
  (0, import_react4.useEffect)(() => {
    if (ready && !skipSaveRef.current) saveKey("puntosControl", puntosControl);
  }, [puntosControl, ready]);
  (0, import_react4.useEffect)(() => {
    if (ready && !skipSaveRef.current) saveKey("clientes", clientes);
  }, [clientes, ready]);
  (0, import_react4.useEffect)(() => {
    if (ready && !skipSaveRef.current) saveKey("encargos", encargos);
  }, [encargos, ready]);
  (0, import_react4.useEffect)(() => {
    if (ready && !skipSaveRef.current) saveKey("arqueos", arqueos);
  }, [arqueos, ready]);
  (0, import_react4.useEffect)(() => {
    if (ready && !skipSaveRef.current) saveKey("movimientosCaja", movimientosCaja);
  }, [movimientosCaja, ready]);
  (0, import_react4.useEffect)(() => {
    if (ready && !skipSaveRef.current) saveKey("devoluciones", devoluciones);
  }, [devoluciones, ready]);
  (0, import_react4.useEffect)(() => {
    if (ready && !skipSaveRef.current) saveKey("locales", locales);
  }, [locales, ready]);
  (0, import_react4.useEffect)(() => {
    if (ready && !skipSaveRef.current) saveKey("empresas", empresas);
  }, [empresas, ready]);
  (0, import_react4.useEffect)(() => {
    if (ready && !skipSaveRef.current) saveKey("configEmpresa", configEmpresa);
  }, [configEmpresa, ready]);
  (0, import_react4.useEffect)(() => {
    if (ready && !skipSaveRef.current) saveKey("localActivoId", localActivoId);
  }, [localActivoId, ready]);
  (0, import_react4.useEffect)(() => {
    if (ready && !skipSaveRef.current) saveKey("turnos", turnos);
  }, [turnos, ready]);
  (0, import_react4.useEffect)(() => {
    if (ready && !skipSaveRef.current) saveKey("temaOscuro", temaOscuro);
  }, [temaOscuro, ready]);
  (0, import_react4.useEffect)(() => {
    if (ready && !skipSaveRef.current) saveKey("modoEmpleado", modoEmpleado);
  }, [modoEmpleado, ready]);
  (0, import_react
```

### offset 4105375
```js
ormeId && localActivoId === localInformeId ? /* @__PURE__ */ import_react4.default.createElement(VentaRapida, { productos: productosDelLocalActivo, venderCarrito, anularVenta, movimientos: movimientosDelLocalActivo, registrarAuditoria, local: locales.find((l22) => l22.id === localActivoId) || null, configEmpresa: empresaDelLocalActivo }) : /* @__PURE__ */ import_react4.default.createElement("div", null, /* @__PURE__ */ import_react4.default.createElement(Card, { className: "p-5 mb-4" }, /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[16px] font-semibold mb-2" }, "TPV"), /* @__PURE__ */ import_react4.default.createElement("div", { className: "text-[12.5px]", style: { color: C2.inkSoft } }, "El TPV no puede abrirse en Todos los locales. Selecciona un local concreto: cada venta, stock y caja pertenecen a un \xFAnico local.")), /* @__PURE__ */ import_react4.default.createElement(SelectorLocalInformes, { locales: localesEmpresaActiva, valor: localInformeId, onChange: seleccionarContextoLocal }))), tab === "encargos" && /* @__PURE__ */ import_react4.default.createElement(
    Encargos,
    {
      encargosPendientes: encargosPendientesDelLocalActivo,
      encargos: encargosDelLocalActivo,
      clientes,
      productos: productosDelLocalActivo,
      addEncargo,
      updateEncargo,
      deleteEncargo,
      entregarEncargo,
      addCliente
    }
  ), tab === "clientes" && /* @__PURE__ */ import_react4.default.createElement(
    Clientes,
    {
      analisisClientes,
      clientesDormidos,
      ventaCruzada,
      addCliente,
      updateCliente,
      deleteCliente,
      anonimizarCliente
    }
  ), tab === "devoluciones" && /* @__PURE__ */ import_react4.default.createElement(
    Devoluciones,
    { key: localActivoId || "todos", productos: productosDelLocalActivo, proveedores, devoluciones: devolucionesDelLocalActivo, movimientos: movimientosDelLocalActivo, registrarDevolucionCliente, registrarDevolucionProveedor, leerBorradorDevolucion }
  ), tab === "facturas" && /* @__PURE__ */ import_react4.default.createElement(
    Facturas,
    {
      albaranes: albaranesDelLocalActivo,
      facturasDirectas: facturasDirectasDelLocalActivo,
      proveedorPorId,
      irAAlbaran: (albId) => {
        const a22 = albaranesDelLocalActivo.find((x3) => x3.id === albId);
        if (a22) {
          setPrefillAlbaran(a22);
          setTab("albaranes");
        }
      },
      irAFacturaDirecta: (fdId) => {
        if (!facturasDirectasDelLocalActivo.some((f22) => f22.id === fdId)) return;
        setFacturaDirectaResaltada(fdId);
        setTab("pagos");
      }
    }
  ), tab === "libroiva" && /* @__PURE__ */ import_react4.default.createElement(LibroIva, { movimientos: movimientosInforme, productos: productosInforme, albaranes: albaranesInforme, proveedorPorId, facturasDirectas: facturasDirectasInforme }), tab === "caja" && /* @__PURE__ */ import_react4.default.createElement(ArqueoCaja, { key: localActivoId || "todos", movimientos: movimientosDelLocalActivo, arqueos: arqueosDelLocalActivo, addArqueo, deleteArqueo, encargos: encargosDelLocalActivo, movimientosCaja: movimientosCajaDelLocalActivo, registrarMovimientoCaja, eliminarMovimientoCaja, leerBorradorArqueo, leerBorradorMovimientoCaja }), tab === "tesoreria" && /* @__PURE__ */ import_react4.default.createElement(Tesoreria, { proyeccionTesoreria, promedioDiarioVentas }), tab === "estacionalidad" && /* @__PURE__ */ import_react4.default.createElement(Estacionalidad, { ingresosPorMes }), tab === "turnos" && /* @__PURE__ */ import_react4.default.createElement(
    Turnos,
    {
      empleados: empleadosDelLocalActivo,
      turnos: turnosDelLocalActivo,
      addTurno,
      updateTurno,
      deleteTurno,
      copiarSemana
    }
  ), tab === "mapa" && /* @__PURE__ */ import_react4.default.createElement(MapaAlmacen, { productos: productosDelLocalActivo, proveedorPorId }), tab === "traspasos" && /* @__PURE__ */ import_react4.default.createElement(Traspasos, { productos: productosDelLocalActivo, productosEmpresa: productos.filter((p22) => localesEmpresaActiva.some((l22) => l22.id === p22.localId)), locales: localesEmpresaActiva, localActivoId, traspasos: traspasosDelLocalActivo, traspasarStock, traspasarEntreLocales, pisoVentaBajo: pisoVentaBajoDelLocalActivo, fichasCosto: fichasCostoDelLocalActivo }), tab === "appcc" && /* @__PURE__ */ import_react4.default.createElement(
    Appcc,
    {
      puntosControl: puntosControlDelLocalActivo,
      registrosAppcc: registrosAppccDelLocalActivo,
      addPuntoControl,
      updatePuntoControl,
      deletePuntoControl,
      registrarAppcc,
      eliminarRegistroAppcc,
      appccPendientesHoy,
      productos: productosDelLocalActivo,
      fichasCosto: fichasCostoDelLocalActivo,
      alergenosDeFicha
    }
  ), tab === "saldo" && /* @__PURE__ */ import_react4.default.createElement(SaldoAlmacen, { productos: productosDelLocalActivo, proveedores, valorInventario: valorInventarioDelLocalActivo, valorUtillaje: valorUtillajeDelLocalActivo, proveedorPorId, clasificacionABC: clasificacionABCDelLocalActivo, analisisABC: analisisABCDelLocalActivo }), tab === "respaldos" && /* @__PURE__ */ import_react4.default.createElement(
    Respaldos,
    {
      historial,
      crearPuntoDeGuardado,
      restaurarDesdeHistorial,
      abrirRespaldo,
      abrirRestaurar,
      exportarExcelGeneral,
      pinPropietario,
      establecerPin,
      activarModoEmpleado
    }
  ), tab === "auditoria" && /* @__PURE__ */ import_react4.default.createElement(Auditoria, { auditoria }), tab === "diagnostico" && /* @__PURE__ */ import_react4.default.createElement(DiagnosticoStock, { diagnostico: dia
```

### offset 4107271
```js
s: movimientosDelLocalActivo, registrarDevolucionCliente, registrarDevolucionProveedor, leerBorradorDevolucion }
  ), tab === "facturas" && /* @__PURE__ */ import_react4.default.createElement(
    Facturas,
    {
      albaranes: albaranesDelLocalActivo,
      facturasDirectas: facturasDirectasDelLocalActivo,
      proveedorPorId,
      irAAlbaran: (albId) => {
        const a22 = albaranesDelLocalActivo.find((x3) => x3.id === albId);
        if (a22) {
          setPrefillAlbaran(a22);
          setTab("albaranes");
        }
      },
      irAFacturaDirecta: (fdId) => {
        if (!facturasDirectasDelLocalActivo.some((f22) => f22.id === fdId)) return;
        setFacturaDirectaResaltada(fdId);
        setTab("pagos");
      }
    }
  ), tab === "libroiva" && /* @__PURE__ */ import_react4.default.createElement(LibroIva, { movimientos: movimientosInforme, productos: productosInforme, albaranes: albaranesInforme, proveedorPorId, facturasDirectas: facturasDirectasInforme }), tab === "caja" && /* @__PURE__ */ import_react4.default.createElement(ArqueoCaja, { key: localActivoId || "todos", movimientos: movimientosDelLocalActivo, arqueos: arqueosDelLocalActivo, addArqueo, deleteArqueo, encargos: encargosDelLocalActivo, movimientosCaja: movimientosCajaDelLocalActivo, registrarMovimientoCaja, eliminarMovimientoCaja, leerBorradorArqueo, leerBorradorMovimientoCaja }), tab === "tesoreria" && /* @__PURE__ */ import_react4.default.createElement(Tesoreria, { proyeccionTesoreria, promedioDiarioVentas }), tab === "estacionalidad" && /* @__PURE__ */ import_react4.default.createElement(Estacionalidad, { ingresosPorMes }), tab === "turnos" && /* @__PURE__ */ import_react4.default.createElement(
    Turnos,
    {
      empleados: empleadosDelLocalActivo,
      turnos: turnosDelLocalActivo,
      addTurno,
      updateTurno,
      deleteTurno,
      copiarSemana
    }
  ), tab === "mapa" && /* @__PURE__ */ import_react4.default.createElement(MapaAlmacen, { productos: productosDelLocalActivo, proveedorPorId }), tab === "traspasos" && /* @__PURE__ */ import_react4.default.createElement(Traspasos, { productos: productosDelLocalActivo, productosEmpresa: productos.filter((p22) => localesEmpresaActiva.some((l22) => l22.id === p22.localId)), locales: localesEmpresaActiva, localActivoId, traspasos: traspasosDelLocalActivo, traspasarStock, traspasarEntreLocales, pisoVentaBajo: pisoVentaBajoDelLocalActivo, fichasCosto: fichasCostoDelLocalActivo }), tab === "appcc" && /* @__PURE__ */ import_react4.default.createElement(
    Appcc,
    {
      puntosControl: puntosControlDelLocalActivo,
      registrosAppcc: registrosAppccDelLocalActivo,
      addPuntoControl,
      updatePuntoControl,
      deletePuntoControl,
      registrarAppcc,
      eliminarRegistroAppcc,
      appccPendientesHoy,
      productos: productosDelLocalActivo,
      fichasCosto: fichasCostoDelLocalActivo,
      alergenosDeFicha
    }
  ), tab === "saldo" && /* @__PURE__ */ import_react4.default.createElement(SaldoAlmacen, { productos: productosDelLocalActivo, proveedores, valorInventario: valorInventarioDelLocalActivo, valorUtillaje: valorUtillajeDelLocalActivo, proveedorPorId, clasificacionABC: clasificacionABCDelLocalActivo, analisisABC: analisisABCDelLocalActivo }), tab === "respaldos" && /* @__PURE__ */ import_react4.default.createElement(
    Respaldos,
    {
      historial,
      crearPuntoDeGuardado,
      restaurarDesdeHistorial,
      abrirRespaldo,
      abrirRestaurar,
      exportarExcelGeneral,
      pinPropietario,
      establecerPin,
      activarModoEmpleado
    }
  ), tab === "auditoria" && /* @__PURE__ */ import_react4.default.createElement(Auditoria, { auditoria }), tab === "diagnostico" && /* @__PURE__ */ import_react4.default.createElement(DiagnosticoStock, { diagnostico: diagnosticoStockDelLocalActivo, corregirProducto, movimientosParaReconciliar }), tab === "notificaciones" && /* @__PURE__ */ import_react4.default.createElement(Notificaciones, { localActivoId }), tab === "errores_sistema" && /* @__PURE__ */ import_react4.default.createElement(ErroresSistema, null), tab === "locales" && /* @__PURE__ */ import_react4.default.createElement(Locales, { locales, localActivoId, crearLocal, actualizarLocal, desactivarLocal, cambiarLocalActivo: cambiarLocalActivoConVista, configEmpresa, empresas, setEmpresas }));
  const itemsMeta = [
    { id: "dashboard", label: "Panel general", icon: ChartColumn },
    { id: "direccion", label: "Panel de direcci\xF3n", icon: TrendingUp },
    { id: "proveedores", label: "Proveedores", icon: Truck },
    { id: "productos", label: "Productos", icon: Package },
    { id: "buscar", label: "Buscar", icon: Search },
    { id: "historial_producto", label: "Historial de producto", icon: RotateCcwClock },
    { id: "pedidos", label: "Pedidos", icon: ShoppingCart, badge: pedidosPendientesDelLocalActivo.length },
    { id: "recepcion", label: "Recepci\xF3n", icon: ClipboardList },
    { id: "albaranes", label: "Albaranes", icon: FileText },
    { id: "facturas", label: "Facturas", icon: Files },
    { id: "pagos", label: "Cuentas por pagar", icon: Coins, badge: vencenProntoDelLocalActivo.length, badgeColor: C2.red },
    { id: "conteo", label: "Inventario ciego", icon: Boxes, badge: stockBajoDelLocalActivo.length, badgeColor: C2.amber },
    { id: "saldo", label: "Saldo de almac\xE9n", icon: ClipboardList },
    { id: "mapa", label: "Mapa de almac\xE9n", icon: Map2 },
    { id: "traspasos", label: "Traspasos", icon: ArrowLeftRight, badge: pisoVentaBajoDelLocalActivo.length, badgeColor: C2.amber },
    { id: "fichas", label: "Fichas de costo", icon: Calculator },
    { id: "produccion", label: "Producci\xF3n", icon: 
```

### offset 4301517
```js
ext,
  backupText,
  setCopiado,
  setShowBackupView,
  setShowRestoreInput,
  setRestoreText,
  restoreText,
  setRestoreError,
  // extras para el Excel y la auditoría
  proveedorPorId,
  productoPorId,
  registrarAuditoria
}) {
  function datosDelNegocio() {
    return {
      proveedores,
      productos,
      pedidos: pedidos2,
      movimientos,
      conteos,
      fichasCosto,
      albaranes,
      catalogoProv,
      gastosGenerales,
      empleados,
      fichajes,
      registrosAppcc,
      puntosControl,
      clientes,
      encargos,
      arqueos,
      turnos,
      nominas,
      facturasDirectas,
      ordenesProduccion,
      traspasos,
      auditoria,
      freidoras,
      registrosAceite
    };
  }
  const SETTERS = {
    proveedores: setProveedores,
    productos: setProductos,
    pedidos: setPedidos,
    movimientos: setMovimientos,
    conteos: setConteos,
    fichasCosto: setFichasCosto,
    albaranes: setAlbaranes,
    catalogoProv: setCatalogoProv,
    gastosGenerales: setGastosGenerales,
    empleados: setEmpleados,
    fichajes: setFichajes,
    registrosAppcc: setRegistrosAppcc,
    puntosControl: setPuntosControl,
    clientes: setClientes,
    encargos: setEncargos,
    arqueos: setArqueos,
    turnos: setTurnos,
    nominas: setNominas,
    freidoras: setFreidoras,
    registrosAceite: setRegistrosAceite,
    facturasDirectas: setFacturasDirectas,
    ordenesProduccion: setOrdenesProduccion,
    traspasos: setTraspasos,
    auditoria: setAuditoria
  };
  const NOMBRES = {
    proveedores: "Proveedores",
    productos: "Productos",
    pedidos: "Pedidos",
    movimientos: "Movimientos",
    conteos: "Conteos",
    fichasCosto: "Fichas de costo",
    albaranes: "Albaranes",
    catalogoProv: "C\xF3digos de proveedor",
    gastosGenerales: "Gastos generales",
    empleados: "Empleados",
    fichajes: "Fichajes",
    registrosAppcc: "Registros APPCC",
    puntosControl: "Puntos de control",
    clientes: "Clientes",
    encargos: "Encargos",
    arqueos: "Arqueos de caja",
    turnos: "Turnos",
    nominas: "N\xF3minas",
    freidoras: "Freidoras",
    registrosAceite: "Registros de aceite",
    facturasDirectas: "Facturas directas",
    ordenesProduccion: "\xD3rdenes de producci\xF3n",
    traspasos: "Traspasos",
    auditoria: "Auditor\xEDa"
  };
  function cuantos(valor) {
    if (Array.isArray(valor)) return valor.length;
    if (valor && typeof valor === "object") return Object.keys(valor).length;
    return 0;
  }
  function compararConEstadoActual(respaldo) {
    if (!respaldo) return [];
    const actual = datosDelNegocio();
    return Object.keys(NOMBRES).filter((clave) => respaldo[clave] !== void 0).map((clave) => {
      const nActual = cuantos(actual[clave]);
      const nRespaldo = cuantos(respaldo[clave]);
      return { clave, nombre: NOMBRES[clave], actual: nActual, respaldo: nRespaldo, diferencia: nRespaldo - nActual };
    });
  }
  function coleccionesQueSeConservan(respaldo) {
    if (!respaldo) return [];
    return Object.keys(NOMBRES).filter((clave) => respaldo[clave] === void 0).map((clave) => NOMBRES[clave]);
  }
  function crearPuntoDeGuardado(motivo = "manual") {
    const snapshot = {
      id: uid(),
      fecha: (/* @__PURE__ */ new Date()).toISOString(),
      automatica: motivo !== "manual",
      motivo,
      backupVersion: 3,
      data: datosDelNegocio()
    };
    setHistorial((s22) => [snapshot, ...s22].slice(0, 30));
    return snapshot;
  }
  function restaurarDesdeHistorial(snapshot) {
    setPendingRestore({ ...snapshot.data, exportadoEl: snapshot.fecha });
  }
  function abrirRespaldo() {
    const data = {
      version: 2,
      // se mantiene por compatibilidad con lectores antiguos
      backupVersion: 3,
      // 3 = incluye nóminas, facturas, producción, traspasos y auditoría
      exportadoEl: (/* @__PURE__ */ new Date()).toISOString(),
      ...datosDelNegocio()
    };
    setBackupText(JSON.stringify(data));
    setCopiado(false);
    setShowBackupView(true);
  }
  function copiarRespaldo() {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(backupText).then(() => setCopiado(true)).catch(() => setCopiado(false));
    }
  }
  function abrirRestaurar() {
    setRestoreText("");
    setRestoreError("");
    setShowRestoreInput(true);
  }
  function validarRespaldo(data) {
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return "El respaldo no es v\xE1lido: no tiene el formato esperado.";
    }
    const conocidas = Object.keys(NOMBRES).filter((clave) => data[clave] !== void 0);
    if (conocidas.length === 0) {
      return "El respaldo no es v\xE1lido o est\xE1 incompleto: no contiene ninguna colecci\xF3n reconocible.";
    }
    for (const clave of conocidas) {
      const valor = data[clave];
      const esObjetoValido = clave === "catalogoProv" && valor && typeof valor === "object" && !Array.isArray(valor);
      if (!Array.isArray(valor) && !esObjetoValido) {
        return `El respaldo est\xE1 da\xF1ado: "${NOMBRES[clave]}" no tiene el formato correcto.`;
      }
    }
    return null;
  }
  function analizarTextoRestauracion() {
    let data;
    try {
      data = JSON.parse(restoreText.trim());
    } catch (err2) {
      setRestoreError("Ese texto no parece un respaldo v\xE1lido. Revisa que lo hayas copiado completo.");
      return;
    }
    const error = validarRespaldo(data);
    if (error) {
      setRestoreError(error);
      return;
    }
    setRestoreError("");
    setShowRestoreInput(false);
    setPendingRestore(data);
  }
  function confirmarRestauracion() {
    if (!pendingRestore) return;
    const puntoPrevio = cr
```

### offset 4302306
```js
  productos: setProductos,
    pedidos: setPedidos,
    movimientos: setMovimientos,
    conteos: setConteos,
    fichasCosto: setFichasCosto,
    albaranes: setAlbaranes,
    catalogoProv: setCatalogoProv,
    gastosGenerales: setGastosGenerales,
    empleados: setEmpleados,
    fichajes: setFichajes,
    registrosAppcc: setRegistrosAppcc,
    puntosControl: setPuntosControl,
    clientes: setClientes,
    encargos: setEncargos,
    arqueos: setArqueos,
    turnos: setTurnos,
    nominas: setNominas,
    freidoras: setFreidoras,
    registrosAceite: setRegistrosAceite,
    facturasDirectas: setFacturasDirectas,
    ordenesProduccion: setOrdenesProduccion,
    traspasos: setTraspasos,
    auditoria: setAuditoria
  };
  const NOMBRES = {
    proveedores: "Proveedores",
    productos: "Productos",
    pedidos: "Pedidos",
    movimientos: "Movimientos",
    conteos: "Conteos",
    fichasCosto: "Fichas de costo",
    albaranes: "Albaranes",
    catalogoProv: "C\xF3digos de proveedor",
    gastosGenerales: "Gastos generales",
    empleados: "Empleados",
    fichajes: "Fichajes",
    registrosAppcc: "Registros APPCC",
    puntosControl: "Puntos de control",
    clientes: "Clientes",
    encargos: "Encargos",
    arqueos: "Arqueos de caja",
    turnos: "Turnos",
    nominas: "N\xF3minas",
    freidoras: "Freidoras",
    registrosAceite: "Registros de aceite",
    facturasDirectas: "Facturas directas",
    ordenesProduccion: "\xD3rdenes de producci\xF3n",
    traspasos: "Traspasos",
    auditoria: "Auditor\xEDa"
  };
  function cuantos(valor) {
    if (Array.isArray(valor)) return valor.length;
    if (valor && typeof valor === "object") return Object.keys(valor).length;
    return 0;
  }
  function compararConEstadoActual(respaldo) {
    if (!respaldo) return [];
    const actual = datosDelNegocio();
    return Object.keys(NOMBRES).filter((clave) => respaldo[clave] !== void 0).map((clave) => {
      const nActual = cuantos(actual[clave]);
      const nRespaldo = cuantos(respaldo[clave]);
      return { clave, nombre: NOMBRES[clave], actual: nActual, respaldo: nRespaldo, diferencia: nRespaldo - nActual };
    });
  }
  function coleccionesQueSeConservan(respaldo) {
    if (!respaldo) return [];
    return Object.keys(NOMBRES).filter((clave) => respaldo[clave] === void 0).map((clave) => NOMBRES[clave]);
  }
  function crearPuntoDeGuardado(motivo = "manual") {
    const snapshot = {
      id: uid(),
      fecha: (/* @__PURE__ */ new Date()).toISOString(),
      automatica: motivo !== "manual",
      motivo,
      backupVersion: 3,
      data: datosDelNegocio()
    };
    setHistorial((s22) => [snapshot, ...s22].slice(0, 30));
    return snapshot;
  }
  function restaurarDesdeHistorial(snapshot) {
    setPendingRestore({ ...snapshot.data, exportadoEl: snapshot.fecha });
  }
  function abrirRespaldo() {
    const data = {
      version: 2,
      // se mantiene por compatibilidad con lectores antiguos
      backupVersion: 3,
      // 3 = incluye nóminas, facturas, producción, traspasos y auditoría
      exportadoEl: (/* @__PURE__ */ new Date()).toISOString(),
      ...datosDelNegocio()
    };
    setBackupText(JSON.stringify(data));
    setCopiado(false);
    setShowBackupView(true);
  }
  function copiarRespaldo() {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(backupText).then(() => setCopiado(true)).catch(() => setCopiado(false));
    }
  }
  function abrirRestaurar() {
    setRestoreText("");
    setRestoreError("");
    setShowRestoreInput(true);
  }
  function validarRespaldo(data) {
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return "El respaldo no es v\xE1lido: no tiene el formato esperado.";
    }
    const conocidas = Object.keys(NOMBRES).filter((clave) => data[clave] !== void 0);
    if (conocidas.length === 0) {
      return "El respaldo no es v\xE1lido o est\xE1 incompleto: no contiene ninguna colecci\xF3n reconocible.";
    }
    for (const clave of conocidas) {
      const valor = data[clave];
      const esObjetoValido = clave === "catalogoProv" && valor && typeof valor === "object" && !Array.isArray(valor);
      if (!Array.isArray(valor) && !esObjetoValido) {
        return `El respaldo est\xE1 da\xF1ado: "${NOMBRES[clave]}" no tiene el formato correcto.`;
      }
    }
    return null;
  }
  function analizarTextoRestauracion() {
    let data;
    try {
      data = JSON.parse(restoreText.trim());
    } catch (err2) {
      setRestoreError("Ese texto no parece un respaldo v\xE1lido. Revisa que lo hayas copiado completo.");
      return;
    }
    const error = validarRespaldo(data);
    if (error) {
      setRestoreError(error);
      return;
    }
    setRestoreError("");
    setShowRestoreInput(false);
    setPendingRestore(data);
  }
  function confirmarRestauracion() {
    if (!pendingRestore) return;
    const puntoPrevio = crearPuntoDeGuardado("previo-a-restauracion");
    let restauradas = 0;
    Object.entries(SETTERS).forEach(([clave, setter]) => {
      if (pendingRestore[clave] !== void 0 && setter) {
        setter(pendingRestore[clave]);
        restauradas++;
      }
    });
    if (registrarAuditoria) {
      const version6 = pendingRestore.backupVersion || pendingRestore.version || "antigua";
      const fechaResp = pendingRestore.exportadoEl ? new Date(pendingRestore.exportadoEl).toLocaleString("es-ES") : "sin fecha";
      registrarAuditoria(
        "Restaurar respaldo",
        `${restauradas} colecciones restauradas \xB7 respaldo del ${fechaResp} (formato ${version6}) \xB7 punto de recuperaci\xF3n creado: ${puntoPrevio.id}`
      );
    }
    setPendingRestore(null);
  }
  function ex
```

## Llamadas saveKey compactas
- 3990135: `saveKey(key, value) {`
- 4022478: `saveKey("conteos", coMigrado);`
- 4032427: `saveKey("locales", localesFinales);`
- 4032515: `saveKey("localActivoId", localActivoFinal);`
- 4032638: `saveKey("productos", productosFinales);`
- 4032759: `saveKey("movimientos", movimientosFinales);`
- 4032889: `saveKey("albaranes", albaranesFinales);`
- 4033007: `saveKey("pedidos", pedidosFinales);`
- 4033121: `saveKey("encargos", encargosFinales);`
- 4033235: `saveKey("gastosGenerales", gastosFinales);`
- 4033365: `saveKey("facturasDirectas", facturasDirectasFinales);`
- 4033498: `saveKey("empleados", empleadosFinales);`
- 4033616: `saveKey("fichajes", fichajesFinales);`
- 4033730: `saveKey("turnos", turnosFinales);`
- 4033842: `saveKey("nominas", nominasFinales);`
- 4033955: `saveKey("arqueos", arqueosFinales);`
- 4034076: `saveKey("movimientosCaja", movimientosCajaFinales);`
- 4034209: `saveKey("fichasCosto", fichasCostoFinales);`
- 4034340: `saveKey("ordenesProduccion", ordenesProduccionFinales);`
- 4034479: `saveKey("puntosControl", puntosControlFinales);`
- 4034611: `saveKey("registrosAppcc", registrosAppccFinales);`
- 4034741: `saveKey("freidoras", freidorasFinales);`
- 4034867: `saveKey("registrosAceite", registrosAceiteFinales);`
- 4034969: `saveKey("albaranes", albaranesFinales);`
- 4036297: `saveKey("historialRespaldos", historialFinal);`
- 4036460: `saveKey("proveedores", proveedores);`
- 4036603: `saveKey("productos", productos);`
- 4036740: `saveKey("pedidos", pedidos2);`
- 4036873: `saveKey("movimientos", movimientos);`
- 4037016: `saveKey("conteos", conteos);`
- 4037147: `saveKey("fichasCosto", fichasCosto);`
- 4037290: `saveKey("historialRespaldos", historial);`
- 4037436: `saveKey("albaranes", albaranes);`
- 4037573: `saveKey("catalogoProv", catalogoProv);`
- 4037719: `saveKey("gastosGenerales", gastosGenerales);`
- 4037874: `saveKey("empleados", empleados);`
- 4038011: `saveKey("fichajes", fichajes);`
- 4038145: `saveKey("disenoMenu", disenoMenu);`
- 4038285: `saveKey("registrosAppcc", registrosAppcc);`
- 4038437: `saveKey("freidoras", freidoras);`
- 4038574: `saveKey("registrosAceite", registrosAceite);`
- 4038729: `saveKey("puntosControl", puntosControl);`
- 4038878: `saveKey("clientes", clientes);`
- 4039012: `saveKey("encargos", encargos);`
- 4039146: `saveKey("arqueos", arqueos);`
- 4039277: `saveKey("movimientosCaja", movimientosCaja);`
- 4039432: `saveKey("devoluciones", devoluciones);`
- 4039578: `saveKey("locales", locales);`
- 4039709: `saveKey("empresas", empresas);`
- 4039843: `saveKey("configEmpresa", configEmpresa);`
- 4039992: `saveKey("localActivoId", localActivoId);`
- 4040141: `saveKey("turnos", turnos);`
- 4040269: `saveKey("temaOscuro", temaOscuro);`
- 4040409: `saveKey("modoEmpleado", modoEmpleado);`
- 4040555: `saveKey("pinPropietario", pinPropietario);`
- 4040707: `saveKey("auditoria", auditoria);`
- 4040844: `saveKey("ordenesProduccion", ordenesProduccion);`
- 4041005: `saveKey("traspasos", traspasos);`
- 4041142: `saveKey("usuarioActivoId", usuarioActivoId);`
- 4041297: `saveKey("facturasDirectas", facturasDirectas);`
- 4041431: `saveKey("pagosFacturas", pagosFacturas);`
- 4041580: `saveKey("entrevistas", entrevistas);`
- 4041723: `saveKey("nominas", nominas);`
