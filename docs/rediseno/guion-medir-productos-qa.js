/**
 * Guion de medicion del componente Productos en el preview de QA.
 * ---------------------------------------------------------------------------
 * Solo abre, mide y cierra. NO pulsa «Guardar producto», «Guardar cambios»,
 * «Eliminar» ni «Registrar salida»: no escribe nada en QA.
 *
 * Esta pensado para gastar lo menos posible de la ventana de sesion, que son
 * quince minutos (A-05). Se pega entero en la consola del navegador con la
 * sesion ya iniciada y el ancho puesto a 390 px.
 *
 * Devuelve, por cada superficie: cuantos campos hay, cuantos quedan por debajo
 * de 44 px de alto, si hay desbordamiento horizontal, y cuantas columnas usa
 * la rejilla.
 */
(async function () {
  const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
  const principal = () => document.querySelector('#root main');
  const puente = () => window.__laPuenteRediseno;

  function medir(nombre, raiz) {
    const campos = [...raiz.querySelectorAll('input:not([type=checkbox]):not([type=radio]),select,textarea')];
    const botones = [...raiz.querySelectorAll('button')];
    const rejilla = raiz.querySelector('.grid, [class*="grid-cols"]');
    return {
      superficie: nombre,
      campos: campos.length,
      camposBajo44: campos
        .filter((e) => { const r = e.getBoundingClientRect(); return r.height > 0 && r.height < 44; })
        .map((e) => (e.name || e.type || e.tagName) + ' ' + Math.round(e.getBoundingClientRect().height)),
      botonesBajo44: botones
        .filter((b) => { const r = b.getBoundingClientRect(); return r.height > 0 && r.height < 44; })
        .map((b) => b.textContent.trim().slice(0, 18) + ' ' + Math.round(b.getBoundingClientRect().height)),
      columnas: rejilla ? getComputedStyle(rejilla).gridTemplateColumns : '(sin rejilla)',
      sinEtiqueta: campos.filter((e) => !e.labels || e.labels.length === 0).length,
      desbordaH: document.documentElement.scrollWidth > window.innerWidth + 1
    };
  }

  function modalAbierto() {
    const nodos = [...document.querySelectorAll('#root [role=dialog], #root .fixed')];
    return nodos.find((n) => n.offsetParent && n.querySelector('button')) || null;
  }

  async function cerrar() {
    const b = [...document.querySelectorAll('#root button')]
      .filter((x) => x.offsetParent)
      .find((x) => /^(Cancelar|Cerrar|Volver)$/i.test(x.textContent.trim()));
    if (b) { b.click(); await esperar(700); }
  }

  const salida = [];
  const p = puente();
  if (!p) return 'sin sesion: el puente no esta publicado';

  p.irA('productos');
  await esperar(3500);
  salida.push(medir('lista', principal()));

  /* Formulario de alta: se reconoce porque aparece «Guardar producto». */
  const candidatos = [...principal().querySelectorAll('button')]
    .filter((b) => /producto/i.test(b.textContent) && !/ajuste/i.test(b.textContent));
  for (const b of candidatos) {
    b.click();
    await esperar(1200);
    if ([...principal().querySelectorAll('button')].some((x) => /Guardar producto/i.test(x.textContent))) break;
    b.click();
    await esperar(400);
  }
  const hayAlta = [...principal().querySelectorAll('button')].some((x) => /Guardar producto/i.test(x.textContent));
  salida.push(hayAlta ? medir('alta de producto', principal()) : { superficie: 'alta de producto', error: 'no se pudo abrir' });

  /* Modales, uno a uno, por el texto de su disparador. */
  const disparadores = [
    ['Ajuste entre productos', /Ajuste entre productos/i],
    ['Registrar salida de almacen', /^Registrar salida$/i],
    ['Editar producto', /^Editar$/i]
  ];
  for (const [nombre, patron] of disparadores) {
    await cerrar();
    const b = [...principal().querySelectorAll('button')].filter((x) => x.offsetParent).find((x) => patron.test(x.textContent.trim()));
    if (!b) { salida.push({ superficie: nombre, error: 'disparador no encontrado' }); continue; }
    b.click();
    await esperar(1400);
    const m = modalAbierto();
    salida.push(m ? medir(nombre, m) : { superficie: nombre, error: 'no abrio modal' });
  }
  await cerrar();

  window.__medicionProductos = salida;
  return salida;
})();
