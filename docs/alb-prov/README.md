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
