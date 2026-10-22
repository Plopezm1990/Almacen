# F6 · 6d — guía para probar el cierre de caja con diferencia en el preview privado de QA

Fecha: 2026-10-02
Autorización: «6d: cierre de caja con diferencia» y decisiones A (día operativo del servidor) y B (el Propietario aprueba en la misma pantalla), Pedro, 2/10/2026. **Solo QA.**
Informe: `F6_PIEZA6D_CIERRE_DIFERENCIA_RESULTADO_2026-10-02.md`.

## Antes de empezar

- Entra por la dirección del **PR 118** (`deploy-preview-118--…`) en una **ventana privada nueva** (la caché del navegador puede servir la versión anterior) y con tu usuario de
  **QA** (Propietario), **Local A1**. Si la dirección no empieza por `deploy-preview-`, **no sigas**.
- La pantalla está en **Cocina A10**. La caja de A1 está **ABIERTA** desde las 19:47 UTC (fondo 0 €, sin ventas), así que el efectivo esperado es **0,00 €**. Si ves otra cifra,
  avísame sin seguir.
- Ya **no hace falta abrir una cuenta en el TPV** antes de cerrar: el día lo calcula el servidor. Si sigue saliendo «Abre o recupera primero un pedido real…», es la
  versión antigua: abre otra ventana privada.
- Todo lo que hagas **se guarda de verdad en QA** (con auditoría). Escribe como motivo «prueba de cierre».

## Prueba 1 — Cierre sin diferencia

1. **Iniciar cierre** → debe pasar a «EN_CIERRE» y pedir el efectivo contado.
2. Escribe **0** y pulsa «Confirmar cierre provisional» → «CIERRE_PROVISIONAL», con «diferencia €0.00» y **sin** recuadro rojo de diferencia.
3. **Finalizar cierre** → «Sesión cerrada definitivamente por el servidor» y aparece «Abrir sesión de caja».
4. **Recarga la página a mitad de cualquiera de estos pasos** (por ejemplo, justo después de «Iniciar cierre»): la pantalla debe seguir en el mismo paso, no volver a «ABIERTA».

## Prueba 2 — Diferencia rechazada y recuento

1. «Abrir sesión de caja» con fondo **0** y pulsa «Abrir sesión».
2. **Iniciar cierre** → contado **5** → «Confirmar cierre provisional».
3. Debe salir un **recuadro rojo**: «Diferencia de caja: €5.00 (contado €5.00, esperado €0.00)», con el aviso de que supera el umbral de 0 € y la tiene que aprobar el Propietario.
   «Finalizar cierre» debe estar **desactivado**.
4. Escribe el motivo («prueba de cierre») → «Registrar motivo» → «Motivo registrado: «prueba de cierre»».
5. Como Propietario ves «Motivo de tu decisión», «Aprobar diferencia» y «Rechazar diferencia» (desactivados hasta escribir). Escribe un motivo y pulsa **Rechazar diferencia**.
6. Debe decir «Rechazada por el Propietario…» y «Finalizar cierre» seguir desactivado.
7. **Reabrir cierre provisional** (motivo «recontar») → vuelve a «ABIERTA» y desaparece el recuadro rojo.
8. **Iniciar cierre** → contado **0** → provisional sin diferencia → **Finalizar cierre**.

## Prueba 3 — Diferencia aprobada

1. «Abrir sesión de caja» (fondo 0) → **Iniciar cierre** → contado **3** → provisional.
2. Registra el motivo y, con tu motivo de decisión, pulsa **Aprobar diferencia**: «Aprobada por el Propietario…» y **Finalizar cierre** se activa.
3. **Finalizar cierre** → cerrada. Para dejar QA con una caja abierta (por si luego pruebas el TPV), abre una sesión nueva con fondo 0 al terminar.

## Qué debes avisarme

Dime «hecho» (y cualquier cosa rara: un cartel rojo que no entiendas, un botón que no responde, una cifra distinta de la esperada). Yo compruebo en QA, **solo lectura**:
los eventos del cierre y de la diferencia (registrada, rechazada, aprobada), la reapertura, que **todos los eventos llevan el día operativo que da el servidor** y el estado final
de las sesiones de caja de A1.

## Qué no cubre esta prueba

- Un **Cajero/a** no puede probarse sin otro usuario de QA: está cubierto por las pruebas automáticas (ve «Pendiente de aprobación del Propietario» y no los botones de decidir).
- Aprobar desde **otro dispositivo** (decisión B: hoy el Propietario aprueba en la misma pantalla del cierre).
- Cobros reales, devoluciones y producción.
