# Alta automática del proveedor desde la foto del albarán (paquete ALB-PROV)

Fecha: 2026-10-08 · Estado: **construido y probado en automático; pendiente de QA en la vista previa y de la autorización de publicación de Pedro** · Paquete **propio** (no va con P3/P3b ni con B06–B10).

## 1. Qué pidió Pedro y qué hace ahora el programa

Pedro (8/10/2026): «que el programa registre el proveedor con foto IA cuando le doy entrada a un albarán, que registre ese proveedor por primera vez si nunca se ha registrado».

Antes: en «Foto con IA» había que elegir el proveedor a mano **antes** de leer la foto (por defecto salía el primero de la lista), y la IA ya devolvía el nombre y el NIF del proveedor pero la aplicación los tiraba.

Ahora, en «Foto con IA» el proveedor queda en **«Detectar por la foto (recomendado)»** (se puede seguir eligiendo a mano). Tras leer la foto el programa compara lo leído con los proveedores de la empresa y hace una de estas cosas:

| Lo que ve | Qué hace | Qué se ve en pantalla |
|---|---|---|
| El NIF/CIF (válido) o el nombre coinciden con un proveedor | Lo selecciona. Usa su catálogo aprendido (productos, unidades por caja, IVA). No crea nada | Tarjeta verde «✓ Proveedor reconocido: … (por su NIF/CIF / por el nombre)». Si la ficha no tenía NIF y se leyó uno válido libre, botón «Guardar su NIF/CIF en la ficha» |
| No existe | **No crea nada todavía.** Lo crea **al guardar el borrador o al dar entrada**, una sola vez, con la marca «Creado por IA · revisar», y deja una línea en la auditoría | Tarjeta ámbar «Proveedor nuevo detectado: …». Al crearse, tarjeta verde «dado de alta automáticamente». Tras dar entrada, aviso en la lista con «Entendido» |
| Se parece a uno que ya existe (errata de OCR, mismo nombre con otro NIF, dos fichas iguales…) | **Pregunta.** Nunca fusiona ni duplica en silencio. No deja dar entrada hasta decidir | Botones «Sí, es [proveedor]» (recupera su catálogo) y «No, es un proveedor nuevo» |
| La IA leyó a **tu propia empresa** (el cliente del albarán) como proveedor, o no leyó nada | No crea nada; pide elegir el proveedor a mano | Tarjeta ámbar |
| Hay un NIF leído pero no es válido (dígito de control mal) | No lo guarda ni lo usa para emparejar; avisa | Aviso dentro de la tarjeta |
| La persona eligió proveedor a mano y la foto dice otro **conocido** | Manda lo elegido; avisa | «⚠ La foto parece de X, pero has elegido Y» |
| El usuario no es Propietario ni Encargado | No crea proveedores (mismo permiso que ya tiene la función de IA); explica qué hacer | Tarjeta ámbar |

En **Proveedores**: campo nuevo «NIF / CIF (opcional)» (validado con el dígito de control, **único por empresa**: no deja repetirlo y dice de qué proveedor es; el campo antiguo `cif` se sigue leyendo), aviso con el número de proveedores «pendientes de revisar», marca «Creado por IA · revisar» y botón «Marcar como revisado» (guardar la ficha editada también la marca como revisada).

## 2. Decisiones por defecto que tomé (Pedro las puede cambiar)

1. **Se crea al guardar/dar entrada**, no al leer la foto. Así leer una foto y descartarla no deja proveedores basura. A cambio, durante la revisión el proveedor aún «no existe».
2. **Se marca «pendiente de revisar»** en vez de pedir confirmación antes de crear: la persona ya está en medio de dar entrada a mercancía y no se la frena; lo que sí se frena es lo **dudoso** (parecidos).
3. **Se propone, no se impone, guardar el NIF** en proveedores existentes que no lo tienen (un clic).
4. **El NIF manda sobre el nombre** cuando es válido.
5. «Pegar texto» **no** cambia (sigue pidiendo proveedor): fase siguiente.

## 3. Qué cambia y qué no

- **Cambia:** solo la aplicación (`fuente.js` y su espejo `source-recovery/fuente-recuperado.js`, con la misma edición; paridad comprobada) y 4 archivos de CI/pruebas.
- **No cambia:** la base de datos (los proveedores se guardan en `proveedores_empresa.datos` jsonb: los campos nuevos viajan solos), **la función de IA de producción** (`importar-albaran` v16 sigue igual: se aprovechan campos que ya devuelve), ni permisos, ni migraciones. Cero escrituras en producción para publicarlo, salvo el despliegue de Netlify.
- **Límite conocido:** la función de IA no sabe quién es «el cliente» del albarán; si confunde cliente y proveedor con un nombre que **no** es el de tu empresa, la aplicación no puede notarlo (solo evita el caso de tu propia empresa). Mejora posible en fase 2: pasar a la función el nombre/NIF propios y pedirle distinguir emisor y cliente (cambio de la función de producción, con su propia autorización).

## 4. Pruebas (todas ya ejecutadas, verdes)

- `tests/alb/a01-proveedor-desde-albaran-motor-contract.mjs` — motor y lógica (nombres, NIF, existente/parecido/nuevo/sin datos/propia empresa, alta sin duplicar, asignar NIF, revisar).
- `tests/alb/a02-albaran-proveedor-ia-ui-runtime.mjs` — **pantalla real montada** (47 comprobaciones, 12 escenarios). Probada contra 8 variantes rotas a propósito (todas detectadas) y contra la versión anterior (falla entera).
- `tests/alb/a03-cableado-proveedor-desde-albaran-contract.mjs` — conexiones de la aplicación completa (que el arnés da por supuestas).
- Registradas en el manifiesto de CI: **244 archivos, 227 contratos activos (204 Node)**; contadores fijados actualizados en el validador y en la puerta `puerta-ci-release.yml`. `pm05/frontend-contract.mjs` admite ahora el parámetro opcional nuevo de la lógica de proveedores.
- Los 204 contratos Node activos pasan en local, y `source-recovery/recuperar_candidato.py --check` da `PARIDAD_CUERPO_EXACTA=1`.
- **No cubierto en automático:** la aplicación completa en un navegador con la nube real, y la lectura real por IA. Para eso está la QA (`GUIA_PRUEBAS_QA.md`).

## 5. Riesgos y marcha atrás

| Riesgo | Mitigación |
|---|---|
| Crear un proveedor duplicado | Nombre normalizado + NIF; lo parecido se pregunta; reintentos no duplican (probado); solapado de recién creados |
| Albarán perdido en silencio por no encontrar el proveedor recién creado | `proveedorPorId` consulta el solapado; contrato a03 lo fija; escenario S2/S3/S4 de a02 |
| Dato basura en proveedores (la IA lee mal el nombre) | Marca «Creado por IA · revisar» + aviso de pendientes + auditoría; se edita o borra desde Proveedores |
| Un rol sin permiso crea proveedores | Solo Propietario/Encargado; probado (S8) |
| Regresión en «Foto con IA» de siempre | Elegir proveedor a mano funciona igual (S9); el cuerpo y la dirección de la llamada no cambian (a03) |
| **Marcha atrás** | Volver a publicar el despliegue anterior de Netlify. No toca datos. Los proveedores ya creados se quedan (se pueden borrar a mano en Proveedores; están auditados) |

## 6. Fases siguientes (no incluidas)

1. Que la función de IA distinga emisor/cliente con la ayuda de los datos propios y valide el NIF en el servidor.
2. «Pegar texto» con la misma detección.
3. Herramienta de «fusionar proveedores duplicados».
4. Mover proveedores a una tabla con NIF único por empresa en el servidor.


---

# Ampliación ALB-PROV-2 — la IA lee también los datos de contacto del proveedor

Fecha: 2026-10-09 · Origen: la primera foto real de Pedro (albarán de Arboliva SA). La IA solo leyó el nombre; el albarán trae más: **CIF del proveedor en el pie legal** («CIF A-78540960», distinto del CIF del cliente que aparece junto a la caja de destino, `B87342077`), **dirección, teléfono, correo, web y condiciones de pago («60 DIAS»)**.

## Por qué solo leía el nombre
La función de IA de producción (v16) pedía solo `proveedorNombre` y `proveedorCif`, **sin explicar qué es cada uno**: con el único «CIF» bien visible (el del cliente) y el del proveedor escondido en el pie, devolvió el nombre y dejó el CIF vacío (acertó al no usar el del cliente).

## Qué cambia
1. **Función de IA `importar-albaran` v17** (`docs/alb-prov/edge/importar-albaran_v17.ts`; la v16 queda guardada como `…_v16_respaldo.ts` para la marcha atrás). Cambio **solo en la instrucción** (aditivo; el resto del código es idéntico, comprobado con `diff`): explica quién es el emisor y quién el cliente, dónde buscar el CIF (cabecera **y pie legal**), y pide además `proveedorDireccion`, `proveedorTelefono`, `proveedorEmail`, `proveedorWeb`, `condicionesPago`, `diasPago`, `clienteNombre`, `clienteCif`. La función ya devuelve todo lo que el modelo produce, así que no hace falta más código.
2. **Aplicación** (`fuente.js` y espejo):
   - Proveedor **nuevo**: nace con toda su ficha (NIF, dirección, teléfono, correo, web, condiciones y días de pago) y la tarjeta enseña «Se guardará también: …» antes de crearlo.
   - Proveedor **que ya existe con la ficha incompleta** (como Arboliva, dado de alta solo con el nombre): botón **«Completar su ficha con los datos de la foto»**; solo rellena lo **vacío**, nunca pisa lo escrito, no deja repetir un NIF de otro proveedor, y queda en la auditoría.
   - Si la IA devuelve como NIF del proveedor el del **cliente** (el destinatario), no se guarda y se avisa.
   - Todo lo leído se limpia antes de guardarlo (correo con formato válido, teléfono con ≥ 9 cifras, web con dominio, «60 DIAS» → «60 días» y 60 días de pago); lo dudoso se descarta en vez de guardarlo mal.
   - **Proveedores**: campos nuevos «Dirección (opcional)» y «Web (opcional)» (alta, edición y tarjeta). Sustituye al botón «Guardar su NIF/CIF» de la primera versión (ahora es parte de «Completar su ficha»).
3. **Pruebas**: `a01` (limpieza, qué falta en la ficha, alta con datos, completar, NIF del cliente), `a02` (pantalla montada: ficha completa, no pisar, alta con todos los datos, NIF del cliente; 61 comprobaciones), `a03` (cableado).

## Riesgo y marcha atrás
- La función v17 **no se puede probar con la IA real fuera de producción** (en QA no hay IA). El cambio es solo de texto y aditivo, pero el efecto en la lectura de **líneas** solo se comprueba con fotos reales: tras desplegarla, Pedro vuelve a leer la misma foto y compara líneas y total.
- Marcha atrás de la función: volver a desplegar `importar-albaran_v16_respaldo.ts` (idéntico a la v16 de producción, `sha256` del texto `b649d2686596b12efa2be792672537552321d6abe3bbc070f5553941e23371f9`). La aplicación nueva sigue funcionando con la v16 (esos campos simplemente no llegan): marcha atrás de la aplicación = volver al despliegue anterior de Netlify.
- Orden recomendado: (1) QA de la aplicación con el simulador v3, (2) publicar la aplicación, (3) desplegar la función v17, (4) Pedro lee otra vez la foto de Arboliva y pulsa «Completar su ficha».
