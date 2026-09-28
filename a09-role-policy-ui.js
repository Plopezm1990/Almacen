(function () {
  "use strict";
  if (window.__laA09RolePolicyUiV1) return;
  window.__laA09RolePolicyUiV1 = true;

  var PANEL_ID = "a09-role-policy-extension-v1";
  var BASE_ROLES = ["Cajero/a", "Camarero/a", "Churrero/a", "Básico"];
  var renderEnCurso = false;

  function politicaCerrada(rol) {
    return {
      rol: rol,
      max_percent: "0",
      permite_cortesia: false,
      puede_solicitar: false,
      puede_aplicar: false,
      puede_autorizar: false,
      permite_escalado: false,
      requiere_doble_aprobacion: false,
      activa: true
    };
  }

  function parseValor(valor) {
    if (valor === null || valor === undefined || valor === "") return valor;
    if (typeof valor !== "string") return valor;
    try { return JSON.parse(valor); } catch (e) { return valor; }
  }

  async function leerStorage(clave) {
    if (window.storage && typeof window.storage.get === "function") {
      try {
        var respuesta = await window.storage.get(clave);
        return parseValor(respuesta && Object.prototype.hasOwnProperty.call(respuesta, "value")
          ? respuesta.value : respuesta);
      } catch (e) {}
    }
    try { return parseValor(localStorage.getItem("almacen:" + clave)); }
    catch (e) { return null; }
  }

  async function contextoActivo() {
    var valores = await Promise.all([
      leerStorage("localActivoId"),
      leerStorage("locales"),
      leerStorage("empresas")
    ]);
    var localActivo = valores[0];
    var locales = Array.isArray(valores[1]) ? valores[1] : [];
    var empresas = Array.isArray(valores[2]) ? valores[2] : [];
    var localId = typeof localActivo === "string"
      ? localActivo
      : localActivo && (localActivo.id || localActivo.local_id || localActivo.localId);
    var local = locales.find(function (item) { return item && item.id === localId; }) || null;
    var empresaId = local && (local.empresaId || local.empresa_id || local.idEmpresa);
    if (!empresaId && empresas.length === 1) empresaId = empresas[0] && empresas[0].id;
    return { empresaId: empresaId || "", localId: localId || "" };
  }

  function obtenerCliente() {
    if (typeof window.getSupabaseClient !== "function") {
      throw new Error("Cliente Supabase no disponible.");
    }
    return window.getSupabaseClient();
  }

  function encontrarRaizA09() {
    var nodos = document.querySelectorAll("h1,h2,h3,h4,div");
    for (var i = 0; i < nodos.length; i++) {
      var nodo = nodos[i];
      if ((nodo.textContent || "").trim() !== "Descuentos y cortesías") continue;
      var actual = nodo;
      for (var nivel = 0; nivel < 7 && actual; nivel++, actual = actual.parentElement) {
        var texto = actual.textContent || "";
        if (texto.indexOf("Guardar políticas") !== -1 && texto.indexOf("Motivo del cambio") !== -1) {
          return actual;
        }
      }
    }
    return null;
  }

  function crear(tag, attrs, texto) {
    var el = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === "className") el.className = attrs[k];
      else if (k === "type") el.type = attrs[k];
      else if (k === "checked") el.checked = !!attrs[k];
      else if (k === "value") el.value = attrs[k];
      else el.setAttribute(k, attrs[k]);
    });
    if (texto !== undefined) el.textContent = texto;
    return el;
  }

  function validarPolitica(rol, p) {
    var max = Number(p.max_percent);
    if (!Number.isFinite(max) || max < 0 || max > 100) {
      return rol + ": el descuento máximo debe estar entre 0 y 100%.";
    }
    if (p.permite_cortesia && max !== 100) return rol + ": las cortesías requieren 100%.";
    if (p.permite_escalado && !p.puede_solicitar) return rol + ": el escalado requiere permitir solicitudes.";
    if (p.puede_aplicar && max === 0) return rol + ": aplicar requiere un límite mayor que 0%.";
    if (p.puede_autorizar && max === 0) return rol + ": autorizar requiere un límite mayor que 0%.";
    if (p.requiere_doble_aprobacion && !p.puede_solicitar) {
      return rol + ": la doble aprobación requiere permitir solicitudes.";
    }
    return "";
  }

  function campoCheckbox(politica, clave, etiqueta) {
    var label = crear("label", { className: "flex items-center gap-2 text-[12px]" });
    var input = crear("input", { type: "checkbox", checked: !!politica[clave] });
    input.addEventListener("change", function () { politica[clave] = input.checked; });
    label.appendChild(input);
    label.appendChild(document.createTextNode(etiqueta));
    return label;
  }

  function tarjetaRol(rol, politica) {
    var card = crear("div", { className: "mb-3 rounded-xl border p-3" });
    var cab = crear("div", { className: "font-semibold mb-2" }, rol);
    card.appendChild(cab);

    var filaMax = crear("label", { className: "block text-[12px] mb-2" });
    filaMax.appendChild(document.createTextNode("Descuento máximo (%)"));
    var max = crear("input", {
      type: "number", min: "0", max: "100", step: "0.01",
      value: String(politica.max_percent == null ? "0" : politica.max_percent),
      className: "w-full mt-1 rounded-lg border px-3 py-2"
    });
    max.addEventListener("input", function () { politica.max_percent = max.value; });
    filaMax.appendChild(max);
    card.appendChild(filaMax);

    var grid = crear("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-2" });
    [
      ["permite_cortesia", "Permite cortesías"],
      ["puede_solicitar", "Puede solicitar"],
      ["puede_aplicar", "Puede aplicar"],
      ["puede_autorizar", "Puede autorizar"],
      ["permite_escalado", "Permite escalado"],
      ["requiere_doble_aprobacion", "Requiere doble aprobación"],
      ["activa", "Activa"]
    ].forEach(function (item) { grid.appendChild(campoCheckbox(politica, item[0], item[1])); });
    card.appendChild(grid);
    return card;
  }

  async function montar() {
    if (renderEnCurso) return;
    var raiz = encontrarRaizA09();
    if (!raiz || raiz.querySelector("#" + PANEL_ID)) return;
    renderEnCurso = true;
    try {
      var contexto = await contextoActivo();
      if (!contexto.empresaId || !contexto.localId) return;
      var supabase = await obtenerCliente();
      var respuesta = await supabase.rpc("abc_listar_descuento_politicas", {
        p_empresa_id: contexto.empresaId,
        p_local_id: contexto.localId
      });
      if (respuesta.error) return;

      var politicasServidor = Array.isArray(respuesta.data) ? respuesta.data : [];
      var estado = {};
      BASE_ROLES.forEach(function (rol) { estado[rol] = politicaCerrada(rol); });
      politicasServidor.forEach(function (p) {
        if (!p || !p.rol || p.rol === "Propietario" || p.rol === "Encargado") return;
        estado[p.rol] = Object.assign(politicaCerrada(p.rol), p, {
          max_percent: String(p.max_percent == null ? "0" : p.max_percent)
        });
      });

      var panel = crear("div", { id: PANEL_ID, className: "mb-4 rounded-2xl border p-4" });
      panel.appendChild(crear("div", { className: "font-semibold mb-1" }, "Otros perfiles"));
      panel.appendChild(crear(
        "div",
        { className: "text-[12px] mb-3" },
        "Cajero/a, Camarero/a, Churrero/a y Básico parten de 0 %. Puedes habilitarlos aquí. Los perfiles personalizados deben coincidir exactamente con el rol asignado al usuario."
      ));

      var lista = crear("div");
      function repintar() {
        lista.innerHTML = "";
        Object.keys(estado).forEach(function (rol) {
          lista.appendChild(tarjetaRol(rol, estado[rol]));
        });
      }
      repintar();
      panel.appendChild(lista);

      var custom = crear("div", { className: "mb-3 rounded-xl border p-3" });
      custom.appendChild(crear("div", { className: "font-semibold mb-2" }, "Añadir perfil personalizado"));
      var customInput = crear("input", {
        type: "text",
        maxlength: "100",
        placeholder: "Ej. Supervisor de sala",
        className: "w-full rounded-lg border px-3 py-2 mb-2"
      });
      var customBtn = crear("button", { type: "button", className: "rounded-lg border px-3 py-2 text-[12px]" }, "Añadir perfil");
      var customError = crear("div", { className: "text-[12px] mt-2" });
      customBtn.addEventListener("click", function () {
        var rol = customInput.value.trim();
        customError.textContent = "";
        if (!rol) { customError.textContent = "Escribe el nombre del perfil."; return; }
        if (estado[rol]) { customError.textContent = "Ese perfil ya está configurado."; return; }
        estado[rol] = politicaCerrada(rol);
        customInput.value = "";
        repintar();
      });
      custom.appendChild(customInput);
      custom.appendChild(customBtn);
      custom.appendChild(customError);
      panel.appendChild(custom);

      var motivoLabel = crear("label", { className: "block text-[12px] mb-3" });
      motivoLabel.appendChild(document.createTextNode("Motivo del cambio"));
      var motivo = crear("input", {
        type: "text",
        maxlength: "500",
        value: "Configuración de límites por perfil A09.1.2",
        className: "w-full mt-1 rounded-lg border px-3 py-2"
      });
      motivoLabel.appendChild(motivo);
      panel.appendChild(motivoLabel);

      var estadoMensaje = crear("div", { className: "text-[12px] mb-2" });
      panel.appendChild(estadoMensaje);
      var guardar = crear("button", { type: "button", className: "rounded-lg border px-3 py-2 text-[12px]" }, "Guardar otros perfiles");
      guardar.addEventListener("click", async function () {
        estadoMensaje.textContent = "";
        var razon = motivo.value.trim();
        if (!razon) { estadoMensaje.textContent = "Escribe un motivo para guardar."; return; }
        var roles = Object.keys(estado);
        for (var i = 0; i < roles.length; i++) {
          var error = validarPolitica(roles[i], estado[roles[i]]);
          if (error) { estadoMensaje.textContent = error; return; }
        }
        guardar.disabled = true;
        try {
          var ahora = Date.now();
          for (var j = 0; j < roles.length; j++) {
            var rol = roles[j];
            var p = estado[rol];
            var resultado = await supabase.rpc("abc_configurar_descuento_politica", {
              p_operation_id: "a09.configurar.politica." + contexto.empresaId + "." + contexto.localId + "." + encodeURIComponent(rol) + "." + (ahora + j),
              p_empresa_id: contexto.empresaId,
              p_local_id: contexto.localId,
              p_rol: rol,
              p_user_id: null,
              p_max_percent: Number(p.max_percent),
              p_permite_cortesia: !!p.permite_cortesia,
              p_puede_solicitar: !!p.puede_solicitar,
              p_puede_aplicar: !!p.puede_aplicar,
              p_puede_autorizar: !!p.puede_autorizar,
              p_permite_escalado: !!p.permite_escalado,
              p_requiere_doble_aprobacion: !!p.requiere_doble_aprobacion,
              p_activa: !!p.activa,
              p_motivo: razon,
              p_operating_day: new Date().toISOString().slice(0, 10)
            });
            if (resultado.error) throw resultado.error;
          }
          estadoMensaje.textContent = "Políticas de otros perfiles guardadas correctamente.";
        } catch (e) {
          estadoMensaje.textContent = (e && e.message) || "No se pudieron guardar las políticas.";
        } finally {
          guardar.disabled = false;
        }
      });
      panel.appendChild(guardar);

      var motivoNativo = Array.prototype.find.call(
        raiz.querySelectorAll("label"),
        function (el) { return (el.textContent || "").indexOf("Motivo del cambio") !== -1; }
      );
      if (motivoNativo && motivoNativo.parentElement) {
        motivoNativo.parentElement.insertBefore(panel, motivoNativo);
      } else {
        raiz.appendChild(panel);
      }
    } finally {
      renderEnCurso = false;
    }
  }

  var programar = function () {
    if (typeof window.requestAnimationFrame === "function") {
      window.requestAnimationFrame(function () { montar().catch(function () {}); });
    } else {
      setTimeout(function () { montar().catch(function () {}); }, 0);
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", programar);
  } else {
    programar();
  }
  if (typeof MutationObserver === "function" && document.documentElement) {
    new MutationObserver(programar).observe(document.documentElement, { childList: true, subtree: true });
  }
  window.addEventListener("contexto-ui-actualizado", programar);
  window.addEventListener("storage", programar);
})();
