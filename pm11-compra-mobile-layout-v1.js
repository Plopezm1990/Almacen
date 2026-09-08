(function () {
  "use strict";

  if (typeof window === "undefined" || window.__pm11CompraMobileLayoutV1) return;
  window.__pm11CompraMobileLayoutV1 = true;

  var MAX_MOBILE = 767;
  var STYLE_ID = "pm11-compra-mobile-layout-v1-style";

  function norm(value) {
    return String(value || "").trim().replace(/\s+/g, " ").toLowerCase();
  }

  function all(selector, scope) {
    return Array.prototype.slice.call((scope || document).querySelectorAll(selector));
  }

  function exactText(scope, text) {
    var target = norm(text);
    return all("h1,h2,h3,h4,div,span,p,label", scope || document).find(function (el) {
      return el.children.length === 0 && norm(el.textContent) === target;
    }) || null;
  }

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = [
      "@media (max-width: 767px) {",
      "  html, body, #root { width: 100%; max-width: 100%; overflow-x: hidden !important; }",
      "  #root { min-width: 0 !important; }",
      "  .pm11-compra-mobile-form, .pm11-compra-mobile-form * { box-sizing: border-box !important; min-width: 0 !important; }",
      "  .pm11-compra-mobile-form { width: 100% !important; max-width: 100% !important; overflow-x: hidden !important; }",
      "  .pm11-compra-mobile-form select, .pm11-compra-mobile-form input, .pm11-compra-mobile-form textarea, .pm11-compra-mobile-form button { max-width: 100% !important; }",
      "  .pm11-compra-product-row { display: grid !important; grid-template-columns: minmax(0, 1fr) !important; gap: 10px !important; width: 100% !important; max-width: 100% !important; min-width: 0 !important; align-items: stretch !important; overflow: visible !important; }",
      "  .pm11-compra-product-row > * { width: 100% !important; max-width: 100% !important; min-width: 0 !important; margin-left: 0 !important; margin-right: 0 !important; }",
      "  .pm11-compra-product-row select, .pm11-compra-product-row input { width: 100% !important; max-width: 100% !important; min-width: 0 !important; }",
      "  .pm11-compra-width-safe { width: 100% !important; max-width: 100% !important; min-width: 0 !important; }",
      "}",
    ].join("\n");
    document.head.appendChild(style);
  }

  function findPedidoForm() {
    var productsLabel = exactText(document, "Productos del pedido");
    if (!productsLabel) return null;

    var node = productsLabel;
    for (var i = 0; i < 9 && node; i += 1, node = node.parentElement) {
      var text = norm(node.textContent);
      if (text.indexOf("nuevo pedido") !== -1 && text.indexOf("crear pedido") !== -1 && text.indexOf("proveedor") !== -1) {
        return { root: node, productsLabel: productsLabel };
      }
    }
    return null;
  }

  function follows(anchor, candidate) {
    if (!anchor || !candidate || anchor === candidate) return false;
    return !!(anchor.compareDocumentPosition(candidate) & Node.DOCUMENT_POSITION_FOLLOWING);
  }

  function smallestProductRow(select, formRoot) {
    var node = select.parentElement;
    for (var i = 0; i < 7 && node && node !== formRoot; i += 1, node = node.parentElement) {
      if (node.querySelector && node.querySelector('input[type="number"]')) return node;
    }
    return null;
  }

  function apply() {
    ensureStyle();
    if (window.innerWidth > MAX_MOBILE) return;

    var found = findPedidoForm();
    if (!found) return;

    var formRoot = found.root;
    var productsLabel = found.productsLabel;
    formRoot.classList.add("pm11-compra-mobile-form");

    var safe = formRoot;
    for (var i = 0; i < 3 && safe; i += 1, safe = safe.parentElement) {
      safe.classList && safe.classList.add("pm11-compra-width-safe");
    }

    all("select", formRoot).filter(function (select) {
      return follows(productsLabel, select);
    }).forEach(function (select) {
      var row = smallestProductRow(select, formRoot);
      if (row) row.classList.add("pm11-compra-product-row");
    });

    var scrolling = document.scrollingElement || document.documentElement;
    if (scrolling && scrolling.scrollLeft !== 0) scrolling.scrollLeft = 0;
    if (document.body && document.body.scrollLeft !== 0) document.body.scrollLeft = 0;
  }

  var scheduled = false;
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(function () {
      scheduled = false;
      apply();
    });
  }

  var observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener("resize", schedule);
  window.addEventListener("orientationchange", schedule);
  window.addEventListener("pageshow", schedule);
  document.addEventListener("DOMContentLoaded", schedule);
  schedule();
})();
