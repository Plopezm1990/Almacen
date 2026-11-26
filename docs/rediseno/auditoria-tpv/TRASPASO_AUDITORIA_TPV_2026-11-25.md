# Traspaso · Auditoría del TPV · 25/11/2026

## Dónde está

- **Rama:** `rediseno/f0-base-qa`.
- **SHA auditada:** `aa809c3a` (local = remoto = PR #225 = Deploy Preview).
- **PR #225:** borrador, sin fusionar.
- **Documentos:** `docs/rediseno/auditoria-tpv/`, que incluye el informe, los hallazgos, la
  matriz de casos, el plan de corrección, este traspaso y la carpeta `evidencias/`.
- **Datos de QA modificados:** los del lote L1 (ventas sintéticas, reembolsos, caja abierta y
  cerrada; ver `evidencias/lote-L1-ejecucion-2026-11-25.md`) y el cambio de configuración de
  seguridad autorizado: política de segundo factor (ver «Decisiones ya tomadas»).
- **Elementos creados en el proyecto QA (autorizados):** dos notebooks de solo lectura,
  `d74a43f4-c389-45c1-b365-e6a0620d107e` y `932cd704-cf01-4ee8-9230-20dab2162975`. Se pueden
  borrar cuando ya no hagan falta.
- **Código, permisos o migraciones cambiados por la auditoría:** ninguno.

## Estado tras el lote L1 (25/11)

- **Ejecutado:** ventas en efectivo y mixta, doble clic en Guardar y en Cobrar, reembolsos,
  cierre de caja (CERRADA_FINAL). Hallazgos nuevos: H-19 a H-28.
- **Lote L2 (recarga y desconexión, C-05): hecho y PASS.** Hallazgos H-29 a H-32. QA queda con
  la sesión `c6e09980…` CERRADA_FINAL, stock del agua en 70 y sin cuentas abiertas nuevas.
- **Sin ejecutar por la auditoría:** corte de red real y recarga con tarjeta o pago mixto.
  Dos terminales (C-04): el
  usuario la hizo y dice que está bien; no hay captura ni registro, y el servidor no muestra
  escrituras posteriores a las 21:11 UTC del 25/11.
- **QA queda:** sin sesiones de caja abiertas; cuenta `d9e28655…` abierta sin líneas; stock
  del agua 71.
- **Antes de repetir pruebas en este navegador:** vaciar el modo local y no iniciar sesión
  con pendientes locales (H-19).
- **Si hace falta una tarjeta simulada:** hoy solo se resuelve llamando a la función de
  QA desde la consola (H-27). Los reembolsos de tarjeta quedan pendientes y bloquean el
  cierre: se cancelan desde la pantalla.

## Para retomar

1. **Lo primero, desbloquear la verificación** (plan, paso 0):
   - **Lectura del servidor: hecha el 25/11** (`evidencias/servidor-qa-2026-11-25.md`).
     Para repetirla, ejecutar los dos notebooks de QA.
   - **Sesión de QA en el panel del navegador: hecha.** El usuario inició sesión como
     Propietario (la auditoría no lee contraseñas ni códigos).
2. **Después, corregir H-19 y H-24 (P1)**, y H-01, H-02 y H-03, que son baratos y afectan
   al cobro diario. Plan, apartado f).
3. **Con sesión y el lote L1 autorizado,** convertir los BLOQUEADO y NO PROBADO de la
   matriz en PASS o FAIL con evidencia en vivo y de servidor.

## Cuidados al medir en el navegador

- **Con el panel del navegador oculto,** el marco Órbita no se aplica y las filas de
  productos no se recalculan, porque `requestAnimationFrame` y `ResizeObserver` quedan en
  pausa. No es un defecto del producto. Lo más fiable es medir con el panel visible. Si no
  hay más remedio, se puede:
  1. sustituir `requestAnimationFrame` por `setTimeout`;
  2. poner `window.__laOrbitaShell = false`;
  3. volver a insertar el mismo `la-orbita-shell.js` con un parámetro de caché.

  Hay que recordar que la CSP bloquea `eval`.
- **El medidor** está en `evidencias/mediciones-visuales-aa809c3a.json` (descripción) y en
  el historial de la sesión. Mide controles de menos de 44 px, nombre accesible,
  elementos fuera de la pantalla, recortes y contraste.
- **Medir el estilo calculado, no el texto del CSS.** H-01 pasó una verificación anterior
  justo porque se miraron medidas y desplazamiento y no el estilo calculado del botón.

## Pendiente de decisión del usuario

- **H-07:** referencia del modo caja (propuesta 1 aprobada en sesión frente a la maqueta
  Órbita).
- **H-15:** qué hacer con el stock insuficiente.
- **H-05:** flujo de devolución de anticipos.
- **H-12:** acción principal con el ticket vacío.
- **H-09:** categorías paginadas o con desplazamiento.
## Decisiones ya tomadas

- **E6 · Segundo factor (25/11):** obligatorio solo para Propietario. **Aplicado en QA el
  25/11**: migración `20261125201328 mfa_politica_opcional` y 12 filas de política;
  comprobado con simulación por cargo. Falta la prueba con inicio de sesión real y que el
  alta de empresa cree su fila.
- **Notebook sin uso borrado:** «MFA solo Propietario · aplicar en QA» (`c3e86777-…`), que
  quedó sin ejecutar, lo borró el usuario desde el panel el 25/11 (comprobado). En QA quedan
  solo los tres notebooks de solo lectura de la auditoría.
