# Descripciones de los PR #225 y #226 · listas para pegar

Redactadas el 28/11/2026. El token de GitHub de la sesión no tiene permiso para editar PR ni comentar, así que se pegan a mano. Después de pegar, anota el resultado en
`REGISTRO_AVANCE_CIERRE_PR225_PR226.md`.

---

## PR #226 · `correccion/ola0-tpv-2026-11-26` → `rediseno/f0-base-qa`

### Qué es
Las **49 correcciones de la auditoría del TPV** (47 hallazgos + H-48 + H-49, auditoría cerrada el 26/11/2026) más H-50 (hallado al probar H-47). Solo QA: producción no se ha tocado.
Detalle por hallazgo: `docs/rediseno/auditoria-tpv/` (`ORDEN_DE_CORRECCIONES_Y_DECISIONES_2026-11-26.md`, `CIERRE_OLAS_0_1_2_2026-11-27.md`, una `CORRECCION_*.md` por lote y `VERIFICACION_QA_OLAS_3_4_5_2026-11-27.md`).

### Qué cambia
- **Cobro y venta (olas 0 y 1):** documento fiscal del cobro del Cajero/a y su detección en el cierre (H-38), copia local ligada a empresa y usuario (H-19, H-40, H-46, H-31), arqueo con el esperado del servidor (H-24), venta rápida completa (H-37), cuentas que se cierran (H-21, H-42, H-48, H-49), descuentos (H-39, H-43, H-44), tarjeta simulada (H-27, H-23, H-26).
- **Seguridad (ola 2):** encargos solo por funciones de servidor y privilegios sobrantes (H-04, H-18), funciones de QA versionadas (H-06), alta de empresa con política de segundo factor (H-17), contraseña inicial obligatoria (H-36), direcciones de producción fuera del código (H-33), guardar solo las políticas modificadas (H-45).
- **Modo caja (ola 3):** referencia «doble banda» (H-01, H-02, H-03, H-08, H-09, H-10, H-11, H-12, H-13).
- **Decisiones (ola 4):** venta con stock insuficiente y piso por reponer (H-15); devolución de anticipos de encargo (H-05).
- **Resto (ola 5) y cierre:** TPV, cierre de caja visible, recarga a mitad de guardar, mensajes sin red (H-16, H-25, H-30, H-32, H-34, H-41), cuentas abiertas sin actividad (H-28, H-29), «Deshacer reparto» (H-47), historial con reembolsos (H-35), repartos de líneas canceladas (H-50) y el aviso de la venta rápida con tarjeta pendiente (H-51, hallado en el humo del 28/11; el texto ya estaba en `release`).

### Migraciones (14 nuevas; ninguna aplicada en producción)
Clasificadas por riesgo en `docs/rediseno/lanzamiento-produccion/README.md` y `VUELTA_ATRAS_POR_MIGRACION.md`:
- **A · aditivas:** `20261126150000`, `20261127110000` (función nueva), `20261128140000`, `20261128160000`.
- **B · parchean la definición viva de funciones** (fallan en voz alta si la de producción difiere): `20261126120000`, `20261126130000`, `20261126140000`, `20261127100000`, `20261127120000`, `20261128110000`, `20261128130000`, `20261128150000`.
- **C · seguridad o datos:** `20261128100000` (retira privilegios de encargos y `TRUNCATE/REFERENCES/TRIGGER`), `20261128110000` (contraseña inicial), `20261128120000` (disparador de política de segundo factor en empresas nuevas).

### Riesgos conocidos
- **Segundo factor:** la migración `20261115120000` (de #225) deja la política vacía y `20261128120000` solo siembra empresas nuevas: en producción hay que dar de alta la política del Propietario por empresa (script `02b`, con autorización) o nadie quedaría obligado.
- **Acoplamiento de despliegue:** `20261128100000` quita privilegios que usaba el cliente antiguo; migrar y publicar el nuevo cliente en la misma ventana.
- **Cierre de caja:** el bloqueo `VENTAS_SIN_DOCUMENTO` solo rige donde la emisión fiscal del local está en `VALIDADA` o `ACTIVA`.
- **Historial de migraciones:** en QA tres migraciones de #225 existen como objeto pero no constan en el historial; reconciliar antes de `db push`.

### Cómo se probó
- Batería sin base de datos: **353/353**; PGlite: **17/17**; CI de la puerta en el último commit con código verificado: 40 comprobaciones correctas, 0 fallos.
- Cada corrección tiene contrato propio que **falla con el código anterior** y verificación en QA con sesión real (ver las actas `CORRECCION_*` y `VERIFICACION_QA_*`).
- Revisión de código independiente (nivel alto): 7 hallazgos; los 5 primeros corregidos con contrato nuevo, 2 menores anotados (permiso propio de «Deshacer reparto»; neto del historial con reembolso económico independiente).
- Higiene: `git diff --check` limpio, índice en LF, paridad `fuente.js` ↔ `source-recovery/fuente-recuperado.js`, sin secretos; CSP de producción solo con el host de producción.

### Lo que NO incluye
- El paquete de **cargos y permisos personalizados** (PR #228, otra sesión): queda fuera de este cierre y se integra aparte tras fusionar este PR.
- Verificación **en vivo** del camino negativo por cargo de H-34, H-41, H-32 y H-46 con sesiones de Cajero/a y Camarero/a: **riesgo aceptado** (28/11) por no restablecer sus contraseñas de QA; la barrera real está en el servidor y tiene contrato (PGlite y estáticos).
- Funciones que solo existen en QA (`supabase/qa-only`): vale regalo, ticket por correo, tipo de negocio, simuladores; no se llevan a producción.

### Coordinación
Registro de avance entre sesiones: `docs/rediseno/REGISTRO_AVANCE_CIERRE_PR225_PR226.md`. #228 está en borrador y no se fusiona en esta rama.

---

## PR #225 · `rediseno/f0-base-qa` → `release`

### Qué es
Rediseño visual **Órbita** de la suite (doce módulos), con las 6 migraciones del rediseño y, **cuando se fusione #226 en `rediseno/f0-base-qa`**, las 49 correcciones de la auditoría del TPV. Es un lanzamiento grande: 254 archivos y 704 commits sobre `release`, que no recibe nada desde el 11/11.

### Estado
Borrador. No se fusiona hasta cumplir `docs/rediseno/PLAN_CIERRE_PR225_PR226_2026-11-28.md` (criterios C1–C8): fusión de #226, CI completo en el SHA final, ensayo de las 20 migraciones en una copia con el esquema de producción, decisiones de producción escritas (segundo factor, contraseña inicial, QR fiscal), verificación con sesión en la vista previa, plan de lanzamiento y de vuelta atrás, y revisión humana.

### Migraciones (6 propias + 14 de #226 = 20)
`20261024070000` propina en efectivo · `20261113090000` y `20261113140000` apariencia · `20261115120000` segundo factor opcional · `20261116171854` salida de stock manual · `20261120120000` tarifas por horario, más las 14 de #226.
Guiones y vuelta atrás: `docs/rediseno/lanzamiento-produccion/`.

### Lo que hay que decidir antes de fusionar
Segundo factor por empresa (D3), contraseña inicial (D5), QR fiscal en producción (D6), ventana y bloqueo de la publicación de Netlify (D4), reconciliación del historial de migraciones, y quién revisa (D8).
