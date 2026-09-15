import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync("ui-context-bridge.js", "utf8");

function crearEntorno({ movil = true, scrollX = 0, scrollY = 0 } = {}) {
  const llamadasFocus = [];
  const llamadasScroll = [];
  const listeners = {};
  let dialogoActual = null;

  class FakeHTMLElement {
    constructor(attrs = {}) {
      this.attrs = attrs;
    }
    getAttribute(nombre) {
      return Object.prototype.hasOwnProperty.call(this.attrs, nombre)
        ? this.attrs[nombre]
        : null;
    }
    focus(...args) {
      llamadasFocus.push({ elemento: this, args });
    }
  }

  class FakeMutationObserver {
    constructor(callback) {
      this.callback = callback;
    }
    observe() {}
    disconnect() {}
  }

  const documentElement = { style: { overflowX: "clip" } };
  const body = { style: { overflowX: "visible" } };
  const document = {
    documentElement,
    body,
    querySelector(selector) {
      assert.equal(selector, '[role="dialog"][aria-modal="true"]');
      return dialogoActual;
    }
  };

  const window = {
    storage: null,
    innerWidth: movil ? 390 : 1280,
    scrollX,
    pageXOffset: scrollX,
    scrollY,
    pageYOffset: scrollY,
    matchMedia() {
      return { matches: movil };
    },
    requestAnimationFrame(callback) {
      callback();
      return 1;
    },
    scrollTo(a, b) {
      let left;
      let top;
      if (a && typeof a === "object") {
        left = Number(a.left || 0);
        top = Number(a.top || 0);
      } else {
        left = Number(a || 0);
        top = Number(b || 0);
      }
      llamadasScroll.push({ left, top });
      this.scrollX = left;
      this.pageXOffset = left;
      this.scrollY = top;
      this.pageYOffset = top;
    },
    addEventListener(tipo, callback) {
      listeners[tipo] = callback;
    }
  };

  const context = vm.createContext({
    window,
    document,
    HTMLElement: FakeHTMLElement,
    MutationObserver: FakeMutationObserver,
    setTimeout(callback) {
      callback();
      return 1;
    },
    console
  });

  vm.runInContext(source, context, { filename: "ui-context-bridge.js" });

  return {
    window,
    document,
    FakeHTMLElement,
    llamadasFocus,
    llamadasScroll,
    listeners,
    setDialogo(dialogo) {
      dialogoActual = dialogo;
    }
  };
}

// 1) Caso que reprodujo el fallo: diálogo modal móvil abierto cuando la
// página ya quedó desplazada horizontalmente al llegar al botón de logout.
{
  const env = crearEntorno({ movil: true, scrollX: 143, scrollY: 287 });
  const modal = new env.FakeHTMLElement({ role: "dialog", "aria-modal": "true" });
  env.setDialogo(modal);

  modal.focus();

  assert.equal(env.llamadasFocus.length, 1, "debe delegar un único focus al navegador");
  assert.equal(env.llamadasFocus[0].args.length, 1);
  assert.equal(
    env.llamadasFocus[0].args[0].preventScroll,
    true,
    "el focus del modal móvil debe usar preventScroll"
  );
  assert.equal(env.llamadasScroll.at(-1).left, 0);
  assert.equal(
    env.llamadasScroll.at(-1).top,
    287,
    "si ya existe desplazamiento horizontal debe volver a x=0 sin cambiar y"
  );

  env.window.__laMobileDialogFocusFixApiV1.sync();
  assert.equal(env.document.documentElement.style.overflowX, "hidden");
  assert.equal(env.document.body.style.overflowX, "hidden");

  env.setDialogo(null);
  env.window.__laMobileDialogFocusFixApiV1.sync();
  assert.equal(env.document.documentElement.style.overflowX, "clip", "restaura el valor previo de html");
  assert.equal(env.document.body.style.overflowX, "visible", "restaura el valor previo de body");
}

// 2) En escritorio el parche no debe cambiar el comportamiento nativo.
{
  const env = crearEntorno({ movil: false, scrollX: 99, scrollY: 15 });
  const modal = new env.FakeHTMLElement({ role: "dialog", "aria-modal": "true" });
  modal.focus({ focusVisible: true });

  assert.equal(env.llamadasFocus.length, 1);
  assert.equal(env.llamadasFocus[0].args.length, 1);
  assert.equal(env.llamadasFocus[0].args[0].focusVisible, true);
  assert.equal(env.llamadasFocus[0].args[0].preventScroll, undefined);
  assert.equal(env.llamadasScroll.length, 0, "escritorio no debe forzar scroll");
}

// 3) En móvil, un input/botón normal no debe quedar afectado.
{
  const env = crearEntorno({ movil: true, scrollX: 51, scrollY: 22 });
  const normal = new env.FakeHTMLElement({ role: "button" });
  normal.focus();

  assert.equal(env.llamadasFocus.length, 1);
  assert.equal(env.llamadasFocus[0].args.length, 0);
  assert.equal(env.llamadasScroll.length, 0, "solo los diálogos modales reciben la corrección");
}

// 4) Contrato mínimo: la corrección debe quedar acotada a role=dialog + aria-modal.
assert.match(source, /getAttribute\("role"\) === "dialog"/);
assert.match(source, /getAttribute\("aria-modal"\) === "true"/);
assert.match(source, /preventScroll = true/);

console.log("PM27 mobile logout modal fix: PASS");
