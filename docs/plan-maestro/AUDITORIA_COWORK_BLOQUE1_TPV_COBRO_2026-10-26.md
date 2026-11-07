# Guion para Cowork — Auditoría completa, Bloque 1 (TPV, Cobro, Caja)

Entorno: QA. URL: `https://deploy-preview-181--chic-entremet-9107cf.netlify.app`
**No toques producción. No cobres de verdad, no muevas caja real, no borres nada.**
Usa las cuentas QA ya existentes (Propietario de QA, y las tres sintéticas `QA Cajero`,
`QA Camarero`, `QA Encargado` si siguen disponibles). Empresa `QA Empresa A, S.L.`,
locales `Local A1` y `Local A2`.

Para cada paso, apunta exactamente lo que pide el formato de abajo — no "todo bien",
sino lo que viste literalmente en pantalla.

## Antes de empezar

1. Abre las herramientas de desarrollador del navegador (consola) ANTES de cargar la
   página, para capturar cualquier error desde el primer segundo.
2. Confirma en la cabecera qué empresa/local está activo antes de tocar nada.
3. Haz esto tres veces: con la ventana a 390px de ancho (móvil), 768px (tablet) y
   1440px (escritorio) — usa las herramientas de desarrollador para fijar el ancho.

## Paso 1 — TPV con catálogo real (resuelve el hallazgo H4 de la revisión previa)

1. Entra como Propietario QA. Ve a la pestaña TPV (`venta`) en `Local A1` o `Local A2`
   (el que tenga más productos).
2. Describe exactamente qué ves: ¿aparecen tarjetas de producto con imagen/nombre/
   precio? ¿Cuántas por fila, a cada uno de los 3 anchos? ¿Hay scroll, y es cómodo o
   se corta algo?
3. Añade 3 productos distintos al carrito (cantidades distintas, al menos uno con
   decimales si existe por peso). Comprueba: ¿el total se actualiza correctamente?
   ¿Los precios tienen el redondeo que esperarías (2 decimales, sin céntimos sueltos
   raros)?
4. Quita uno. ¿El total se recalcula bien?

## Paso 2 — Cobro con propina y vale regalo

1. Con ese carrito, pulsa "Guardar pedido" y entra a Cobro.
2. Cobra en efectivo con un importe que deje cambio. Marca la propina. Anota el
   mensaje exacto que aparece y si el importe de la propina coincide con el cambio.
3. Repite una venta nueva y paga con un vale regalo (si hay uno de prueba con saldo;
   si no, créalo primero vendiéndolo). Anota el saldo restante que muestra.
4. En cualquiera de las dos, comprueba el ticket en pantalla: ¿aparece el QR fiscal?
   ¿El texto deja claro que NO es una factura simplificada (debe decir "ticket/recibo
   interno", nunca "factura")?

## Paso 3 — Caja (Cajero/a y Encargado)

1. Sal del modo Propietario y entra como `QA Cajero` (si la cuenta sigue activa).
2. ¿Aparece la pestaña Caja? ¿Aparece el botón "Abrir caja"? Ábrela con un importe de
   prueba.
3. Registra una entrada y una salida de caja pequeñas (motivo de prueba, nunca datos
   reales). Anota si los importes y el saldo se actualizan bien.
4. Sal y entra como `QA Camarero`. Confirma que la pestaña Caja **no** aparece (así
   debería ser). Si aparece, es un fallo de permisos — repórtalo como crítico.
5. Entra como `QA Encargado`. Confirma que sí tiene acceso a Caja y qué opciones de
   "Más" ve, comparado con Cajero/a.

## Paso 4 — Accesibilidad básica, en escritorio (1440px)

1. Sin tocar el ratón, solo con Tab, intenta: abrir el TPV, añadir un producto al
   carrito, llegar al botón de cobrar. ¿Se puede hacer todo solo con teclado? ¿Se ve
   en todo momento qué elemento tiene el foco (un contorno visible)?
2. Reduce el zoom del navegador al 50% y luego sube al 200%. ¿Algún texto se corta,
   se superpone o se vuelve ilegible?

## Paso 5 — Traspaso Empresa B (investiga el hallazgo H7)

1. Si tienes acceso a `QA Empresa B`, intenta repetir exactamente el traspaso de
   almacén a piso de venta que quedó rechazado en la comparación A/B anterior.
2. Si el servidor lo rechaza otra vez, copia el mensaje de error EXACTO que muestra
   la pantalla (no lo resumas) y, si puedes, el error de la consola del navegador.

## Formato para cada paso

Para cada paso numerado arriba, responde:
- **Pantalla / ancho de ventana:**
- **Qué hiciste exactamente:**
- **Qué esperabas ver:**
- **Qué viste de verdad:** (si puedes, una captura)
- **Errores en consola durante este paso:** (pega el texto exacto, o "ninguno")

No resumas como "todo correcto" si no hiciste todos los pasos — di cuáles no pudiste
hacer y por qué.
