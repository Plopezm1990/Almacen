# Corrección de la Ola 2 · seguridad · 27/11/2026

Estado: **H-04, H-18, H-17, H-36, H-45 y H-33 corregidas, con contrato propio; las migraciones están aplicadas en QA.**
Rama `correccion/ola0-tpv-2026-11-26`. Producción no se ha tocado. H-06 (funciones de QA versionadas) ya estaba hecha.
Batería sin base de datos 344/344, PGlite 13/13, manifiesto 408 entradas.

| Hallazgo | Cambio | Prueba |
|---|---|---|
| **H-04 / H-18** | Migración `20261128100000`: `encargos_empresa` y `pagos_encargo` quedan **solo lectura** para el cliente (se quitan INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER y las políticas `pm14_encargos_insert/update`). La interfaz solo usaba `registrar_encargo`, `registrar_pago_encargo` y `revertir_pago_encargo` (las únicas funciones que escriben esas tablas en QA, todas SECURITY DEFINER). | PGlite (21): antes un miembro del local inserta y cambia total/estado con la tabla; después no, y las funciones siguen escribiendo. Estático: ningún JS entregado escribe esas tablas. |
| **Ampliación de H-18** | Al medir en QA: `authenticated` tenía TRUNCATE/REFERENCES/TRIGGER en **13 tablas** de `public` (TRUNCATE no pasa por RLS; PostgREST no lo expone) y la vista `stock_estado` admitía escritura (deriva: la migración 20260915132000 ya exigía solo SELECT). La misma migración lo corrige; los INSERT/UPDATE/DELETE de las tablas con política propia no se tocan. | Mismo contrato. QA: 0 tablas con TRUNCATE, vista solo SELECT. |
| **H-36** | Migración `20261128110000`: `pm11_finalizar_creacion_cuenta_empleado` marca la cuenta nueva con la contraseña inicial pendiente (motivo `alta_empleado`), en la misma transacción que crea membresía y perfil. El resto del mecanismo ya existía (D01): bloqueo de capacidades en servidor y pantalla «Elige tu contraseña» para cualquier sesión marcada. Sirve a `crear-cuenta-empleado` y `qa-crear-empleado`. **No marca cuentas existentes** (obligar a cambiarla a empleados en activo es decisión de producto). | PGlite (18): marca al crear, no al repetir la llamada («ya creada»), se desmarca al cambiar el hash, un alta rechazada no deja marca. |
| **H-17** | Migración `20261128120000`: un disparador en `public.empresas` siembra `(empresa, 'Propietario', exigida = true)` en cada empresa nueva, sea cual sea el camino de alta; no pisa políticas existentes ni rellena empresas ya creadas. | PGlite (11), incluida la guarda real `mfa_exigida_para_uid`. |
| **H-33** | Las 11 llamadas a funciones Edge de `fuente.js` usan `urlFuncionNubeA(nombre)`, que lee `window.NUBE_URL` (producción por defecto, QA en una Deploy Preview, vacío en modo local → dirección `.invalid`). El adaptador de sesión `edge-auth-patch.js` (y su copia embebida) lee el mismo origen en cada llamada. Solo queda la dirección de `crear-cuenta-empleado` (rama de producción de un enrutado ya fijado por `p11-create-account-routing-contract`). `index-storage-bootstrap.js` (valor por defecto de producción), `reset-pruebas-preview.js` (barrera) y `restablecer-contrasena.js` **no se tocaron**. | Ejecución (21): producción→producción, QA→QA, sin nube→`.invalid`; el adaptador añade el token solo en el proyecto configurado; con el código anterior fallan 5. Se actualizó la aserción de `a03` (misma llamada y cuerpo). |
| **H-45** | «Guardar» en las políticas de descuento envía solo las políticas que cambian (comparadas con las del servidor; el porcentaje como número). El servidor ya guardaba `before`/`after` en el evento. | Ejecución (13); con el código anterior falla. |

## Qué NO está hecho ni verificado

- **H-33 se corrigió después (commit `ef662fdc`) y está en la tabla de abajo, pero hay un efecto que conviene conocer:** en una Deploy Preview las llamadas a `enviar-notificacion`, `importar-albaran`, `importar-nomina`, `entrevista-personal` y `prefiltro-candidato` **ya no se bloquean: van a las funciones Edge de QA** (que existen y están activas). No se ha probado ninguna en vivo.
- **Navegador:** H-45 y H-36 no se han probado en la pantalla real (H-36 exige crear una cuenta de empleado de prueba en QA y entrar con ella).
- **H-17 y H-36 en producción:** no se ha mirado; H-17 no corrige las empresas que ya existen sin política.
- Las migraciones se aplicaron en QA con `apply_migration` (sin la cabecera de comentarios del archivo; misma lógica).

## Verificación en QA (27/11/2026, vista previa de la PR #227, PM07 con su segundo factor)

| Hallazgo | Qué se hizo | Resultado |
|---|---|---|
| **H-04 / H-18** | Con la sesión real: insertar, modificar y borrar en `encargos_empresa` y `pagos_encargo`, e insertar en `stock_estado`. Leer ambas tablas. Llamar a `registrar_encargo` (el camino de la interfaz). | **Verificado.** Las escrituras directas dan `42501 permission denied`; las lecturas funcionan; `registrar_encargo` responde `ok`. El encargo de prueba se borró después por SQL. |
| **H-33** | Llamada a `importar-albaran` por la dirección configurada y búsqueda de peticiones a producción. | **Verificado.** `window.NUBE_URL` es QA, la función respondió desde QA con la sesión aceptada, y no hay ninguna petición a `flqercbgpgmmfaakrwkc`. No se probó cada una de las 11 llamadas de la aplicación. |
| **H-45** | Pantalla «Descuentos y cortesías»: «Guardar políticas» sin cambios; cambiar solo el máximo del Encargado (0 → 5) y devolverlo a 0. | **Verificado.** Sin cambios avisa «No hay cambios que guardar» y no escribe nada; con un cambio solo se actualiza la política del Encargado (la del Propietario conserva su fecha y no se crean filas de ceros para los demás cargos). La verificación detectó que la primera versión habría creado 4 filas de ceros: se corrigió (`ef4de1e4`, cargo sin fila y aún vacío no se envía). |
| **H-36** | Alta de una cuenta de empleado (Cajero/a) por la función Edge real `qa-crear-empleado`, entrada con ella. | **Verificado.** Queda con la marca `alta_empleado`; al entrar aparece «Elige tu contraseña» y `plataforma_mi_estado_password` devuelve `pendiente: true`. No se llegó a cambiar la contraseña desde esa pantalla. |
| **H-17** | En QA, en una transacción deshecha: insertar una empresa. | **Verificado.** Nace con `(Propietario, exigida = true)`. No quedó nada (empresa 0, política 0). |

Limpieza: cuenta de empleado de prueba (usuario, perfil, membresía, marca) eliminada; sesión cerrada; `QA-EMP-A`, `QA-A1` y la membresía de PM07 vuelven a `activo=false`. La política del Encargado vuelve a 0 % (su fecha de actualización cambió, y quedan dos eventos de configuración). No se guardó ninguna contraseña ni código.
