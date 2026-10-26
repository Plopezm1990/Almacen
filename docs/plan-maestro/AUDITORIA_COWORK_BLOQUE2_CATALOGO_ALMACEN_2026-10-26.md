# Guion para Cowork — Auditoría completa, Bloque 2 (Catálogo, Almacén, Traspasos)

Entorno: QA. URL: `https://deploy-preview-181--chic-entremet-9107cf.netlify.app`
**No toques producción. Usa solo datos de prueba.**
Usa Propietario de QA. Empresa `QA Empresa A, S.L.`, locales `Local A1`/`Local A2`.

Para cada paso, apunta exactamente lo que pide el formato de abajo.

## Antes de empezar

1. Abre la consola del navegador ANTES de cargar la página.
2. Haz esto tres veces: 390px, 768px y 1440px de ancho.
3. **Importante para este bloque:** la primera carga de cada página (justo al
   entrar o recargar) es el momento más probable de ver en consola el error
   `PGRST116` para `traspasos`, `productos`, `conteos` o `historialRespaldos`, y el
   banner rojo/ámbar que puede tapar la pantalla a partir de 768px. Si lo ves,
   **no lo ignores ni lo resumas como "error conocido"**: copia el texto exacto de
   consola, haz una captura del banner, y anota a qué ancho ocurrió. Es
   intencionado que lo busques en los 3 anchos, varias veces cada uno (recarga 3-4
   veces por ancho), porque es una condición de carrera que no sale siempre.

## Paso 1 — Catálogo (Productos)

1. Ve a "Productos". Da de alta un producto de prueba nuevo con stock inicial.
2. Edítalo (cambia precio o stock mínimo). Confirma que se guarda.
3. Dalo de baja (si existe esa opción) y confirma que deja de aparecer en el TPV
   pero sigue localizable en el historial.

## Paso 2 — Traspasos dentro del mismo local

1. Ve a "Traspasos". Elige un producto con stock en almacén.
2. Traspasa una cantidad válida de almacén a piso de venta. Confirma que ambos
   stocks (almacén/piso) se actualizan bien.
3. Intenta traspasar MÁS cantidad de la que hay disponible en el origen. Anota el
   mensaje de error EXACTO (debe impedirlo).

## Paso 3 — Traspasos entre locales (Local A1 ↔ Local A2)

1. Elige un producto equivalente en ambos locales (misma unidad de medida).
2. Traspasa una cantidad desde Local A1 a Local A2. Confirma que el stock baja en
   A1 y sube en A2.
3. Intenta traspasar a un local distinto de empresa (si tienes acceso a QA Empresa
   B) o con unidades distintas — anota el mensaje de error exacto.

## Paso 4 — Mermas

1. Ve a "Mermas" (o el flujo de salida de producto con motivo de merma, dentro de
   Productos). Registra una merma de cantidad pequeña con motivo de prueba.
2. Confirma que el stock baja en consola/pantalla.
3. **Prueba de doble pestaña (importante para este bloque):** abre la app en dos
   pestañas con la misma sesión. Registra una merma distinta en cada pestaña casi
   a la vez (sin recargar entre una y otra) para el MISMO producto. Recarga ambas
   pestañas después. Anota si las dos mermas quedan reflejadas o si una se pierde.

## Paso 5 — Conteo (inventario ciego) y ajuste de stock

1. Ve a "Conteo". Inicia un conteo nuevo (ámbito: almacén, piso de venta, o total,
   el que tengas disponible).
2. Cuenta 2-3 productos con una cantidad distinta a la que muestra el sistema.
3. Finaliza el conteo y aplica los ajustes. Confirma que el stock de esos productos
   cambia a la cantidad contada.
4. Repite la aplicación de ajustes del MISMO conteo una segunda vez (si el botón
   lo permite) y confirma que NO duplica el ajuste (debe decir algo como "ya
   aplicado" o similar, no restar/sumar otra vez).

## Formato para cada paso

Para cada paso numerado arriba, responde:
- **Pantalla / ancho de ventana:**
- **Qué hiciste exactamente:**
- **Qué esperabas ver:**
- **Qué viste de verdad:** (si puedes, una captura)
- **Errores en consola durante este paso:** (pega el texto exacto, o "ninguno")

No resumas como "todo correcto" si no hiciste todos los pasos — di cuáles no
pudiste hacer y por qué.
