# Guía de pruebas en QA — alta automática del proveedor desde la foto del albarán

Fecha: 2026-10-08 · Solo QA (vista previa de Netlify del PR 118: `deploy-preview-118--chic-entremet-9107cf.netlify.app`). **Nada de esta guía toca producción.**

## 0. Qué hace falta antes (una sola autorización de Pedro)

En QA la función de IA está neutralizada (responde 503). Para poder probar hay que sustituirla **en el proyecto de QA** (`qjqorixtkilwsndqayyx`) por un simulador que no llama a ninguna IA ni gasta nada y devuelve albaranes de ejemplo según cuántas fotos se suban. Código: `docs/alb-prov/simulador_importar_albaran_qa.ts` (≈70 líneas, sin claves, sin base de datos).

Es una escritura en QA (desplegar una función), por eso necesita el «sí» de Pedro. **Producción no se toca.** Se puede volver al estado actual en cualquier momento (§6).

**Estado:** Pedro lo autorizó el 8/10/2026 (respuesta «Probar primero en QA») y el simulador quedó desplegado en QA como **versión 2** de `importar-albaran` (la 1 era el corta-fuegos 503). Comprobado con llamadas de 1, 2 y 3 fotos (200 y datos esperados). Producción: sin ningún cambio.

## 1. Cómo se elige el escenario

La imagen da igual (vale cualquier foto o captura). Lo que cuenta es **cuántas fotos se suben a la vez** en «Foto con IA»:

| Fotos | El simulador devuelve | Debe pasar |
|---|---|---|
| 1 | «QUESERIA PRUEBA ALB S.L.», NIF `B12345617` | La **1.ª vez**: «Proveedor nuevo detectado». La **2.ª vez**: «Proveedor reconocido … (por su NIF/CIF)» |
| 2 | «QUESERIA PRUEBA ALVA S.L.», sin NIF | Pregunta «Se parece a un proveedor que ya tienes» (hace falta haber hecho antes el escenario 1) |
| 3 | sin proveedor ni NIF | «No he podido identificar al proveedor»; hay que elegirlo a mano |
| 4 | «DISTRIBUCIONES PRUEBA DOS S.L.», NIF `B12345618` (mal) | Proveedor nuevo y aviso de que el NIF no es válido y no se guardará |
| 5 | «QUESERIA PRUEBA ALB S.L.», NIF `A58818501` | Pregunta «Tiene el mismo nombre pero otro NIF/CIF» |

## 2. Pasos (los puede hacer Pedro en 10 minutos, o Cowork con el prompt de §5)

Entrar en la vista previa con el usuario Propietario de QA. Ir a **Albaranes**.

**A. Proveedor nuevo, al dar entrada**
1. Pulsar «Foto con IA». Comprobar que el proveedor dice **«Detectar por la foto (recomendado)»** y debajo un texto explicativo.
2. Subir **1 foto** → «Leer con IA».
3. Debe salir el editor con una tarjeta ámbar **«Proveedor nuevo detectado: Queseria Prueba Alb S.L. · B12345617»** y el selector de proveedor con la opción «Proveedor nuevo: … (se dará de alta al guardar)». **Todavía no debe existir** en la pantalla Proveedores (comprobarlo en otra pestaña si se quiere).
4. Pulsar «Dar entrada al almacén». Debe volver a la lista con un aviso verde «Se ha dado de alta el proveedor «Queseria Prueba Alb S.L.»…». Pulsar «Entendido».
5. Ir a **Proveedores**: debe haber un aviso «1 proveedor(es) se dieron de alta automáticamente…», el proveedor con la marca **«Creado por IA · revisar»** y su NIF/CIF `B12345617`. Pulsar «Marcar como revisado»: desaparecen marca y aviso.
6. En **Albaranes**: el albarán aparece como «Dado de entrada» con ese proveedor (no «Sin proveedor»).

**B. Reconocerlo la segunda vez (sin duplicar)**
1. Otra vez «Foto con IA» → **1 foto** → «Leer con IA».
2. Tarjeta verde **«✓ Proveedor reconocido: Queseria Prueba Alb S.L. (por su NIF/CIF)»**, selector ya puesto en él. Pulsar «Guardar como borrador».
3. En Proveedores sigue habiendo **un solo** «Queseria Prueba Alb». (Borrar después este borrador desde Albaranes si se quiere.)

**C. Parecido → pregunta**
1. «Foto con IA» → **2 fotos** → Leer. Debe salir **«El proveedor de la foto es Queseria Prueba Alva S.L.… Se parece a un proveedor que ya tienes»** con los botones **«Sí, es Queseria Prueba Alb S.L. (B12345617)»** y **«No, es un proveedor nuevo»**.
2. Pulsar «Dar entrada al almacén» **sin decidir**: debe negarse con «Confirma si el proveedor de la foto es uno de los que ya tienes o es nuevo».
3. Pulsar «Sí, es …»: la tarjeta desaparece y el selector queda en «Queseria Prueba Alb S.L.». Guardar como borrador. En Proveedores sigue habiendo uno solo.
4. (Opcional) Repetir y pulsar «No, es un proveedor nuevo» → «Proveedor nuevo detectado» → al guardar se crea el segundo.

**D. Sin datos**
1. **3 fotos** → Leer. Tarjeta «⚠ No he podido identificar al proveedor en la foto. Elígelo en la lista de abajo.»
2. «Dar entrada» sin elegir → «Selecciona el proveedor.». Elegir uno en el selector y repetir → entra.

**E. NIF mal escrito**
1. **4 fotos** → Leer. «Proveedor nuevo detectado: Distribuciones Prueba Dos S.L.» y, dentro, «El NIF/CIF leído (B12345618) no tiene un dígito de control válido: no se guardará».
2. Guardar como borrador → el proveedor se crea **sin NIF**.

**F. Mismo nombre, otro NIF**
1. **5 fotos** → Leer. «Tiene el mismo nombre pero otro NIF/CIF.» con «Sí, es Queseria Prueba Alb S.L. (B12345617)» / «No, es un proveedor nuevo». No dar entrada; cancelar.

**G. Elegido a mano manda**
1. «Foto con IA», elegir **a mano** otro proveedor distinto en el desplegable, **1 foto** → Leer. Debe salir «⚠ La foto parece de Queseria Prueba Alb…, pero has elegido …». Guardar como borrador: queda con el elegido a mano.

**H. Pantalla Proveedores**
1. «Nuevo proveedor»: aparece el campo «NIF / CIF (opcional)». Escribir un NIF con la letra mal (`B12345618`) → al guardar dice «El NIF/CIF no es válido. Revisa la letra o el dígito de control.». Escribir `B12345617` (que ya tiene «Queseria Prueba Alb») → dice «Ya tienes un proveedor con ese NIF/CIF: Queseria Prueba Alb S.L.». Escribir un NIF válido libre (por ejemplo `B12345625`) → se guarda.

**I. Que lo de siempre sigue igual**
1. «Nuevo albarán» manual y «Pegar texto» funcionan como antes (proveedor por defecto el primero; no hay tarjeta de detección).

## 3. Qué anotar si algo no sale

Captura de la pantalla, el escenario (nº de fotos) y el texto exacto. **No** seguir si algo crea datos raros: parar y avisar.

## 4. Datos que deja la prueba en QA

Proveedores «Queseria Prueba Alb S.L.» y «Distribuciones Prueba Dos S.L.» (y quizá un tercero si se hizo C.4), y 2–3 albaranes de prueba con movimientos de stock de productos «QP-001/QP-002». Es QA: se pueden borrar desde Proveedores/Albaranes o dejarlos.

## 5. Prompt para Cowork (solo QA; si Cowork no puede subir archivos, que lo diga y pare)

```
Eres Cowork. Vas a probar SOLO la vista previa de QA https://deploy-preview-118--chic-entremet-9107cf.netlify.app (nunca producción). Entra con el usuario Propietario de QA. Si en algún momento ves la dirección de producción o un aviso rojo de "PRODUCCIÓN", PARA y avísame.

Objetivo: comprobar el alta automática de proveedores desde "Foto con IA" en Albaranes. La función de IA de QA es un simulador: la imagen da igual (usa cualquier imagen pequeña); lo que cambia el resultado es CUÁNTAS fotos subes a la vez. Si no puedes subir imágenes desde el navegador, dímelo y no sigas.

Haz EXACTAMENTE esto, en orden, y para en la primera diferencia:
A) Albaranes > "Foto con IA". Comprueba que el proveedor dice "Detectar por la foto (recomendado)". Sube 1 foto > "Leer con IA". Debe salir una tarjeta "Proveedor nuevo detectado: Queseria Prueba Alb S.L. · B12345617". Pulsa "Dar entrada al almacén". Debe salir en la lista un aviso verde "Se ha dado de alta el proveedor «Queseria Prueba Alb S.L.»". Pulsa "Entendido".
B) Proveedores: debe haber un aviso de proveedores pendientes de revisar y una tarjeta "Queseria Prueba Alb S.L." con la marca "Creado por IA · revisar" y "NIF/CIF: B12345617". Pulsa "Marcar como revisado" y comprueba que desaparecen la marca y el aviso.
C) Albaranes > "Foto con IA" > 1 foto > Leer. Debe salir "✓ Proveedor reconocido: Queseria Prueba Alb S.L. (por su NIF/CIF)". Pulsa "Guardar como borrador". Comprueba en Proveedores que sigue habiendo UN solo "Queseria Prueba Alb".
D) Albaranes > "Foto con IA" > 2 fotos > Leer. Debe preguntar con botones "Sí, es Queseria Prueba Alb S.L. (B12345617)" y "No, es un proveedor nuevo". Pulsa "Dar entrada al almacén" SIN decidir: debe negarse ("Confirma si el proveedor…"). Luego pulsa "Sí, es …" y "Guardar como borrador". Comprueba que no se creó ningún proveedor nuevo.
E) "Foto con IA" > 3 fotos > Leer: debe decir "No he podido identificar al proveedor". "Dar entrada" debe negarse con "Selecciona el proveedor.".
F) "Foto con IA" > 4 fotos > Leer: "Proveedor nuevo detectado: Distribuciones Prueba Dos S.L." con aviso de que el NIF B12345618 no es válido. "Guardar como borrador" y comprueba en Proveedores que se creó SIN NIF.
G) "Foto con IA" > 5 fotos > Leer: debe decir "Tiene el mismo nombre pero otro NIF/CIF". Cancela sin dar entrada.
H) Proveedores > "Nuevo proveedor": comprueba el campo "NIF / CIF (opcional)"; escribe B12345618 y comprueba que NO deja guardar ("El NIF/CIF no es válido…"); escribe B12345617 y comprueba que NO deja guardar ("Ya tienes un proveedor con ese NIF/CIF: Queseria Prueba Alb S.L."). Cancela.

No borres, no edites nada fuera de lo indicado, no pulses nada de Caja, Cobros ni Configuración. Al terminar devuélveme: para cada letra A–H, "OK" o "DIFERENCIA" con una captura y el texto exacto que viste.
```

## 6. Volver a dejar QA como estaba (si se quiere)

Desplegar en `importar-albaran` de QA este contenido (el corta-fuegos actual, versión 1):

```ts
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' } });
  return new Response(JSON.stringify({ ok: false, qa: true, simulated: true, function: 'importar-albaran', error: 'Función de IA neutralizada en L&A Suite QA' }), { status: 503, headers: { 'content-type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
});
```
