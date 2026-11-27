# Corrección de la Ola 2 · seguridad · 27/11/2026

Estado: **H-04, H-18, H-17, H-36 y H-45 corregidas, con contrato propio y migraciones aplicadas en QA; H-33 pendiente.**
Rama `correccion/ola0-tpv-2026-11-26`. Producción no se ha tocado. H-06 (funciones de QA versionadas) ya estaba hecha.
Batería sin base de datos 343/343, PGlite 13/13, manifiesto 407 entradas.

| Hallazgo | Cambio | Prueba |
|---|---|---|
| **H-04 / H-18** | Migración `20261128100000`: `encargos_empresa` y `pagos_encargo` quedan **solo lectura** para el cliente (se quitan INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER y las políticas `pm14_encargos_insert/update`). La interfaz solo usaba `registrar_encargo`, `registrar_pago_encargo` y `revertir_pago_encargo` (las únicas funciones que escriben esas tablas en QA, todas SECURITY DEFINER). | PGlite (21): antes un miembro del local inserta y cambia total/estado con la tabla; después no, y las funciones siguen escribiendo. Estático: ningún JS entregado escribe esas tablas. |
| **Ampliación de H-18** | Al medir en QA: `authenticated` tenía TRUNCATE/REFERENCES/TRIGGER en **13 tablas** de `public` (TRUNCATE no pasa por RLS; PostgREST no lo expone) y la vista `stock_estado` admitía escritura (deriva: la migración 20260915132000 ya exigía solo SELECT). La misma migración lo corrige; los INSERT/UPDATE/DELETE de las tablas con política propia no se tocan. | Mismo contrato. QA: 0 tablas con TRUNCATE, vista solo SELECT. |
| **H-36** | Migración `20261128110000`: `pm11_finalizar_creacion_cuenta_empleado` marca la cuenta nueva con la contraseña inicial pendiente (motivo `alta_empleado`), en la misma transacción que crea membresía y perfil. El resto del mecanismo ya existía (D01): bloqueo de capacidades en servidor y pantalla «Elige tu contraseña» para cualquier sesión marcada. Sirve a `crear-cuenta-empleado` y `qa-crear-empleado`. **No marca cuentas existentes** (obligar a cambiarla a empleados en activo es decisión de producto). | PGlite (18): marca al crear, no al repetir la llamada («ya creada»), se desmarca al cambiar el hash, un alta rechazada no deja marca. |
| **H-17** | Migración `20261128120000`: un disparador en `public.empresas` siembra `(empresa, 'Propietario', exigida = true)` en cada empresa nueva, sea cual sea el camino de alta; no pisa políticas existentes ni rellena empresas ya creadas. | PGlite (11), incluida la guarda real `mfa_exigida_para_uid`. |
| **H-45** | «Guardar» en las políticas de descuento envía solo las políticas que cambian (comparadas con las del servidor; el porcentaje como número). El servidor ya guardaba `before`/`after` en el evento. | Ejecución (13); con el código anterior falla. |

## Qué NO está hecho ni verificado

- **H-33** (direcciones de producción fijas en `fuente.js`): se diseñó (`urlFuncionNubeA` leyendo `window.NUBE_URL`, y el adaptador `edge-auth-patch.js` con el origen leído en cada llamada) pero **no se aplicó**. Toca 11 llamadas, la copia embebida del adaptador, el espejo y el test `tests/alb/a03…`. Efecto a tener en cuenta: en una Deploy Preview esas llamadas dejarían de bloquearse y irían a las funciones Edge **de QA**.
- **Navegador:** H-45 y H-36 no se han probado en la pantalla real (H-36 exige crear una cuenta de empleado de prueba en QA y entrar con ella).
- **H-17 y H-36 en producción:** no se ha mirado; H-17 no corrige las empresas que ya existen sin política.
- Las migraciones se aplicaron en QA con `apply_migration` (sin la cabecera de comentarios del archivo; misma lógica).
