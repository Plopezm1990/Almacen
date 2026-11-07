# Guion para Cowork — Auditoría completa, Bloque 3 (Facturas, Pagos, Libro IVA, Descuentos, Devoluciones)

Entorno: QA. URL: `https://deploy-preview-181--chic-entremet-9107cf.netlify.app`
**No toques producción. No registres facturas/devoluciones/descuentos con datos
reales, solo datos de prueba claramente marcados como tales.**
Usa Propietario de QA. Empresa `QA Empresa A, S.L.`, locales `Local A1`/`Local A2`.

Para cada paso, apunta exactamente lo que pide el formato de abajo — no "todo bien",
sino lo que viste literalmente en pantalla.

## Antes de empezar

1. Abre la consola del navegador ANTES de cargar la página.
2. Haz esto tres veces: 390px, 768px y 1440px de ancho.

## Paso 1 — Devoluciones de cliente

1. Ve a la pestaña "Devoluciones" → "De cliente". Elige una venta con cantidad
   pendiente (si no hay ninguna, haz primero una venta de prueba en el TPV).
2. Devuelve una cantidad PARCIAL (no toda la cantidad de la línea). Pon un importe
   de reembolso en efectivo menor al permitido. Anota: ¿se confirma? ¿el historial
   muestra la línea nueva con el reembolso correcto?
3. Intenta devolver MÁS cantidad de la que queda pendiente para ese mismo producto/
   venta (ej. si quedan 2, intenta devolver 5). Anota el mensaje de error EXACTO.
4. Intenta poner un reembolso superior al importe que correspondería a la cantidad
   devuelta (ej. devuelve 1 unidad de 2€ pero pide reembolsar 50€). Anota el
   mensaje de error EXACTO.
5. Repite el paso 2 pero corta la conexión a mitad (modo avión unos segundos) justo
   al confirmar, y vuelve a activarla. ¿Aparece el aviso de "borrador recuperado"?
   ¿Al reintentar se duplica la devolución o se confirma una sola vez?

## Paso 2 — Devoluciones a proveedor

1. Ve a "Devoluciones" → "A proveedor". Elige un producto con stock > 0.
2. Devuelve una cantidad menor al stock disponible. Anota si el stock se actualiza
   bien tras confirmar.
3. Intenta devolver MÁS cantidad que el stock total disponible. Anota el mensaje de
   error EXACTO (debe impedirlo, nunca dejar stock negativo).

## Paso 3 — Libro de IVA

1. Ve a "Libro de IVA". Anota qué trimestre/año aparece seleccionado por defecto.
2. Compara el IVA repercutido mostrado aquí contra el total de ventas del mismo
   periodo en "Resultados" o "Reportes" (si están disponibles) — ¿son coherentes en
   orden de magnitud, o hay una diferencia que llame la atención?
3. Si hay alguna factura directa vinculada a un albarán confirmado, comprueba que su
   IVA NO aparece contado dos veces (una vez como albarán y otra como factura
   directa) en el desglose "IVA soportado (compras)".
4. Pulsa "Exportar a Excel" y confirma que descarga un archivo con hojas "IVA
   Repercutido", "IVA Soportado" y "Resumen".

## Paso 4 — Descuentos y cortesías (A09)

1. Ve a "Descuentos". Confirma que las políticas de Propietario/Encargado/Cajero/a/
   Camarero/a aparecen con los valores que esperarías (Propietario 100% + cortesías,
   Encargado 20% sin cortesías, el resto en 0%).
2. Intenta marcar "Permite cortesías" en un rol SIN poner su máximo a 100%. Anota el
   aviso exacto que aparece (debe avisar antes de guardar).
3. Intenta guardar sin escribir un motivo de cambio. Anota el mensaje de error.
4. Guarda un cambio válido (ej. sube el máximo de Camarero/a a 10%) y confirma el
   mensaje de éxito. Vuelve a entrar a la pantalla y confirma que el cambio persiste.
5. Desde otro rol (si tienes una cuenta sin permiso de Propietario), intenta acceder
   a esta pantalla o guardar un cambio. Anota si el acceso está bien bloqueado.

## Paso 5 — Facturas y Cuentas por pagar

1. Ve a "Facturas". Da de alta una factura directa manual (sin usar la lectura IA):
   proveedor opcional, concepto, importe base, IVA. Guarda como borrador primero,
   luego confírmala. Anota si el total con IVA calculado coincide con lo esperado.
2. Ve a "Pagos" (Cuentas por pagar). Busca esa factura en pendientes. Pulsa "Marcar
   como pagada". **Anota explícitamente si aparece un cuadro de diálogo nativo del
   navegador** (uno gris, sin el estilo del resto de la app) pidiendo el importe, en
   vez de un formulario propio — esto es un hallazgo ya anotado en el código
   (H3-02), confírmalo o desmiéntelo en pantalla.
3. Introduce un importe MAYOR que el pendiente. Anota el mensaje de error.
4. Introduce un importe válido menor al pendiente (pago parcial). Confirma qué
   queda reflejado como pendiente después.
5. Si tienes acceso a la lectura por IA de facturas (botón "Leer todo con IA"),
   prueba subir una imagen o PDF de una factura de prueba. Anota si requiere marcar
   la casilla de "he revisado" antes de poder confirmar (no debería poder guardarse
   como activa sin esa confirmación si vino de IA).

## Formato para cada paso

Para cada paso numerado arriba, responde:
- **Pantalla / ancho de ventana:**
- **Qué hiciste exactamente:**
- **Qué esperabas ver:**
- **Qué viste de verdad:** (si puedes, una captura)
- **Errores en consola durante este paso:** (pega el texto exacto, o "ninguno")

No resumas como "todo correcto" si no hiciste todos los pasos — di cuáles no
pudiste hacer y por qué.
