(function () {
  'use strict';
  if (window.__pm11CompraMobileP10V1) return;
  window.__pm11CompraMobileP10V1 = true;

  var css = `
@media (max-width: 767px) {
  html, body, #root {
    width: 100% !important;
    max-width: 100vw !important;
    overflow-x: hidden !important;
  }

  .pm11-compra-mobile-form {
    width: calc(100vw - 32px) !important;
    max-width: calc(100vw - 32px) !important;
    margin-left: auto !important;
    margin-right: auto !important;
    box-sizing: border-box !important;
    overflow: hidden !important;
  }

  .pm11-compra-mobile-form,
  .pm11-compra-mobile-form * {
    box-sizing: border-box !important;
    min-width: 0 !important;
  }

  .pm11-compra-mobile-form select,
  .pm11-compra-mobile-form input,
  .pm11-compra-mobile-form textarea,
  .pm11-compra-mobile-form button {
    max-width: 100% !important;
  }

  .pm11-compra-mobile-line {
    display: grid !important;
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
    gap: 8px !important;
    width: 100% !important;
    max-width: 100% !important;
    align-items: center !important;
  }

  .pm11-compra-mobile-line > select,
  .pm11-compra-mobile-line > [data-pm11-product-control='1'] {
    grid-column: 1 / -1 !important;
    width: 100% !important;
  }

  .pm11-compra-mobile-line input[type='number'],
  .pm11-compra-mobile-line input[inputmode='decimal'],
  .pm11-compra-mobile-line input[inputmode='numeric'] {
    width: 100% !important;
    max-width: 100% !important;
  }

  .pm11-compra-mobile-line > button {
    width: 100% !important;
  }
}
`;

  var style = document.createElement('style');
  style.id = 'pm11-compra-mobile-p10-v1-style';
  style.textContent = css;
  document.head.appendChild(style);

  function norm(v) {
    return String(v || '').trim().replace(/\s+/g, ' ').toLowerCase();
  }

  function exactText(el, text) {
    return !!el && norm(el.textContent) === norm(text);
  }

  function findForm() {
    var nodes = Array.from(document.querySelectorAll('h1,h2,h3,h4,strong,b,div'));
    var heading = nodes.find(function (el) {
      return el.children.length === 0 && exactText(el, 'Nuevo pedido');
    });
    if (!heading) return null;

    var p = heading;
    for (var i = 0; i < 8 && p; i += 1, p = p.parentElement) {
      var text = norm(p.innerText || p.textContent);
      if (text.indexOf('productos del pedido') !== -1 && text.indexOf('crear pedido') !== -1) return p;
    }
    return null;
  }

  function markProductLines(form) {
    var selects = Array.from(form.querySelectorAll('select'));
    selects.forEach(function (select) {
      var row = select.parentElement;
      for (var i = 0; i < 5 && row && row !== form; i += 1, row = row.parentElement) {
        var numeric = row.querySelectorAll("input[type='number'],input[inputmode='decimal'],input[inputmode='numeric']");
        var rowSelects = row.querySelectorAll('select');
        if (numeric.length >= 1 && rowSelects.length === 1) {
          row.classList.add('pm11-compra-mobile-line');
          select.setAttribute('data-pm11-product-control', '1');
          break;
        }
      }
    });
  }

  function apply() {
    if (window.innerWidth > 767) return;
    var form = findForm();
    if (!form) return;
    form.classList.add('pm11-compra-mobile-form');
    markProductLines(form);
    if (window.scrollX !== 0) window.scrollTo(0, window.scrollY);
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

  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('resize', schedule, { passive: true });
  window.addEventListener('pageshow', schedule);
  schedule();
})();
