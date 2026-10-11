# F6 — guía para probar la pantalla «Configuración» en el preview privado de QA

Fecha: 2026-10-02
Autorización: «Pantalla completa y retoques: 6a + 6b + 6c + 6f» (Pedro, 2/10/2026). **Solo QA.**
Informe: `F6_PIEZA6_PANTALLA_RESULTADO_2026-10-02.md`.

## Antes de empezar

- Entra por la dirección del **PR 118** (`deploy-preview-118--…`), en una **ventana privada** nueva (así no queda caché de versiones
  anteriores). Si la dirección no empieza por `deploy-preview-`, **no sigas**: no es el preview de QA.
- Entra con tu usuario de **QA** (Propietario) y elige **Local A1**.
- La pestaña **«Configuración»** está en el menú, en el grupo **Sistema** (junto a Auditoría, Respaldos, Locales…). Si no la ves,
  recarga sin caché o abre otra ventana privada: es la versión antigua.
- Todo lo que cambies aquí **se guarda de verdad en QA** (con auditoría). Cada prueba indica cómo dejarlo como estaba.
- Cada cambio **pide un motivo**: escribe uno cualquiera («prueba de pantalla»).

## Prueba 1 — Día y cajas

1. Entra en **Configuración → Día y cajas**. Debe mostrar la hora de corte actual (en QA, 04:00), la zona (Europe/Madrid), las cajas
   abiertas a la vez y el umbral de diferencia (0 €, «valor por defecto»).
2. **Sin escribir motivo**, pulsa «Guardar número de cajas»: debe salir un aviso rojo «Escribe el motivo del cambio.».
3. Escribe el motivo, pon **4** cajas y guarda: aviso «Guardado en el servidor.» y debajo debe poner «Ahora: 4 (fijado en este local…)».
4. Vuelve a poner **10** y guarda (queda como estaba).
5. Prueba un valor malo (por ejemplo 11 cajas): debe avisar que tiene que estar entre 1 y 10, sin llamar al servidor.
6. **No cambies el corte del día** salvo que quieras: un cambio se aplica desde mañana.

## Prueba 2 — Modalidades

1. **Configuración → Modalidades**: cinco casillas (Barra, Mesa, Terraza, Para llevar, Otro), todas marcadas (por defecto).
2. **Barra** debe aparecer bloqueada con la explicación «De momento el TPV abre las cuentas siempre en Barra…». Es lo esperado.
3. Desmarca **Terraza**, escribe motivo y guarda: «Modalidades guardadas…». Recarga la página: Terraza sigue desmarcada y pone
   «(decidido en este local)».
4. Vuelve a marcarla y guarda (queda como estaba).

## Prueba 3 — Equipos

1. **Configuración → Equipos**: al principio dirá «Todavía no hay ningún equipo registrado en este local».
2. «Añadir un equipo»: tipo **Datáfono**, nombre «Datáfono de prueba», una referencia cualquiera (**sin contraseñas ni claves**),
   y, si quieres, un terminal. Con motivo, «Guardar equipo»: debe aparecer en la lista.
3. «Editar»: cambia el nombre y guarda. El **tipo** no se puede cambiar (el desplegable está bloqueado: para otro tipo, desactiva el equipo y crea uno nuevo).
4. «Desactivar»: desaparece de la lista; marca «Ver también los desactivados» y sale tachado/atenuado con «Activar».
5. Para dejarlo como estaba: los equipos **no se borran**; déjalo desactivado.

## Prueba 4 — Permisos

1. **Configuración → Permisos**: tabla con todos los permisos agrupados (Cuentas y pedidos, Cobros y devoluciones, Caja y documentos,
   Preparación y cocina, Sala) y columnas Propietario (siempre ✓), Encargado, Cajero/a y Camarero/a.
2. Los permisos delicados (devoluciones, cobros inciertos, documentos del emisor, cancelaciones sensibles, **reabrir un cierre**) tienen
   🔒 para Cajero/a y Camarero/a: no se pueden marcar.
3. Con «Solo este local» elegido, marca por ejemplo **«Cancelar un pedido» para Cajero/a**. La casilla se tiñe de ámbar y el botón
   pasa a «Guardar 1 cambio». Escribe el motivo y guarda: «1 cambio guardado en el servidor.» y la celda pone «decidido aquí».
4. Pulsa **«volver a lo normal»** en esa celda, guarda y debe volver a lo de siempre (sin la etiqueta «decidido aquí»).
5. «Toda la empresa» solo se puede elegir si eres Propietario de todos los locales; si no, sale deshabilitado con la explicación.
6. **«Ver quién tiene un rol retirado en este local»**: lista a las personas con Churrero/a, Básico o Estándar (en QA lo normal es
   «Nadie…»).

## Prueba 5 — Los retoques (6f)

> Aviso: para llegar a «Reabrir» hay que poder cerrar la caja, y el cierre de Cocina A10 exige antes haber abierto una cuenta en el TPV *en ese mismo navegador*; en una ventana privada nueva sale «Abre o recupera primero un pedido real…». Es un comportamiento previo, no un fallo de esta pantalla.

1. **Alta de empleados** (pestaña **Personal** → «Nuevo empleado»): el desplegable «Nivel de acceso en modo empleado» debe tener solo
   **Encargado, Cajero/a y Camarero/a** (ya no Básico, Estándar ni Churrero/a). Al editar a alguien que ya tuviera uno de los tres
   retirados, ese rol aparece solo para esa persona, para que no se pierda sin querer.
2. **Cierre de caja** (pestaña **Cocina A10**, sección de cierre de caja): con el cierre provisional hecho, el Propietario ve el motivo y el botón
   «Reabrir cierre provisional». Si entras como Cajero/a o Camarero/a, no ven el botón y dice: «Solo el Propietario (o quien él
   autorice en Configuración) puede reabrir un cierre provisional.».

## Resultado (Pedro, 2/10/2026)

**Pruebas 1 a 4 superadas, con la vuelta a como estaba hecha desde la propia pantalla.** En QA: ocho eventos de auditoría (cinco guardados y tres
vueltas), las cuatro secciones leyeron de QA y ninguna petición falló (detalle en `F6_PIEZA6_PANTALLA_RESULTADO_2026-10-02.md`). **Prueba 5
pendiente**: el aviso «Abre o recupera primero un pedido real…» al pulsar «Iniciar cierre» es del cierre de caja previo (necesita una cuenta abierta
en el mismo navegador), no de la pantalla nueva; la sesión de caja de A1 queda abierta en QA y Reabrir queda sin ver en pantalla.

## Qué debes avisarme

Dime «hecho» (y cualquier cosa rara: un cartel rojo que no entiendas, una sección vacía, una celda que no responde, algo que se
desborde en el móvil). Yo compruebo en QA, **solo lectura**, que lo guardado coincide: ajustes, modalidades, equipos, permisos
(y la auditoría con tu motivo).

## Qué no cubre esta prueba

- **Cierre de caja con diferencia** (sigue sin poder finalizarse; sub-pieza 6d) y **elegir modalidad al abrir cuenta** (6e).
- **Devoluciones del cajero** (D13): no tiene permiso y no se puede dar.
- Dos dispositivos a la vez, cobros reales y producción.
