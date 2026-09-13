# PM26 P09b — Compatibilidad entre `release` y producción

**Estado: DIAGNOSTICO VERIFICADO, SIN CORRECCION.**

Este paquete convierte en un contrato reproducible la inspección de solo
lectura realizada el 12 de septiembre de 2026. No autoriza ni aplica
migraciones, no cambia el cliente, no escribe en Supabase y no despliega en
Netlify. Su gate verde certifica únicamente que el inventario coincide con el
commit de `release` inspeccionado; **no certifica que producción sea compatible**.

## 1. Fuente primaria utilizada

- Cliente publicado: commit exacto de `release` registrado en el snapshot.
- Backend: catálogo PostgreSQL y Edge Functions consultados en solo lectura.
- QA: catálogo consultado en solo lectura para comprobar si ya existen
  candidatos técnicamente relacionados.
- Snapshot: saneado; no contiene project refs, URLs internas, claves ni datos
  de usuarios.

El contrato obtiene `index.html`, la fuente canónica y el `fuente.js` publicado
mediante `git show` sobre el SHA exacto. No confía en listas copiadas del
documento para descubrir las dependencias del cliente.

## 2. Resultado de relaciones

El cliente requiere **21 relaciones** entre tablas y vistas. Producción carece
de **11 ausentes**:

1. `albaranes_empresa`
2. `arqueos_caja`
3. `caja_operaciones`
4. `clientes_empresa`
5. `devoluciones_proveedor`
6. `devoluciones_venta`
7. `facturas_directas_empresa`
8. `gastos_empresa`
9. `pagos_factura`
10. `proveedores_empresa`
11. `stock_estado`

QA contiene las once. La vista `stock_estado` está configurada allí como
`security_invoker=true`; las otras diez relaciones tienen RLS activada. Esto
las convierte en material de referencia, no en autorización para copiarlas o
promoverlas sin preflight específico de producción.

## 3. Resultado de RPC

El cliente invoca 13 RPC y las **13 RPC son incompatibles** con producción.
Doce nombres no existen. `registrar_auditoria` existe, pero ninguno de sus dos
overloads acepta los ocho parámetros que envía el cliente.

QA contiene los trece nombres con parámetros compatibles con `release`. No se
pueden promover en bloque: QA acumula una cadena de migraciones y dependencias
distinta de la línea base productiva. El siguiente paquete deberá calcular el
cierre transitivo de tablas, tipos, helpers, índices, triggers, grants y
políticas de cada RPC antes de proponer SQL para producción.

## 4. Resultado de Edge Functions — rectificado por P09c

Las seis funciones llamadas por el cliente existen. Dos tienen contrato de
autenticación compatible:

- `crear-cuenta-empleado`: el cliente envía el JWT del usuario.
- `prefiltro-candidato`: ruta pública limitada por token, según su diseño.

**Rectificación P09c:** las llamadas directas no muestran la cabecera, pero el
`fuente.js` publicado instala antes un adaptador global de `fetch` para las
cuatro rutas protegidas. Obtiene la sesión desde Supabase y añade
`Authorization: Bearer <JWT>` sin sobrescribir una cabecera ya presente.

Por tanto hay **0 de 6 integraciones Edge** incompatibles por ausencia de JWT.
El adaptador devuelve un 401 local sin enviar la petición si no hay sesión. La
prueba comportamental de P09c ejecuta las rutas protegida, pública, con JWT,
sin JWT y con cabecera preexistente contra un entorno simulado; no llama a QA ni
a producción.

## 5. Impacto operativo

La aplicación conserva una ruta local y por eso no debe describirse como
completamente caída. Lo que no es fiable es su capa sincronizada para stock,
TPV, caja, devoluciones, pagos, documentos financieros, clientes, proveedores,
auditoría y cuatro integraciones Edge. El modo local tampoco equivale a
sincronización multiusuario ni a copia de seguridad externa.

## 6. Orden de corrección propuesto (no ejecutado)

1. P09c: rectificación del diagnóstico Edge mediante contrato comportamental
   del adaptador JWT ya publicado.
2. P09d: cierre transitivo de las once relaciones y trece RPC candidatas de QA,
   comparado contra la línea base real de producción.
3. P09e: migración productiva propuesta con preflight, rollback, concurrencia,
   RLS, grants y pruebas PostgreSQL locales; fuera de la carpeta automática de
   migraciones hasta recibir autorización.
4. P09f: ensayo E2E exclusivamente en QA, con identidades aisladas y sin usar
   `service_role` para simular usuarios.
5. Solo después: autorizaciones independientes para escribir en producción y
   para desplegar el cliente en `release`.

No se debe copiar la base QA completa, publicar la rama técnica ni fusionar la
PR #38 para resolver esta incompatibilidad.

## 7. Límites respetados

- Supabase producción, QA y TPV en escritura: **NO TOCADOS**.
- Migraciones y Edge Functions: **NO APLICADAS NI DESPLEGADAS**.
- `main` y `release`: **NO MODIFICADOS**.
- Netlify: **NO MODIFICADO NI DESPLEGADO**.
- PR #38: **NO FUSIONADA NI CERRADA**.
- Facturación y plan de Supabase: **NO MODIFICADOS**.

Marcadores de estado:

`PM26_P09B_ESTADO=DIAGNOSTICO_VERIFICADO_SIN_CORRECCION`

`PM26_P09B_PRODUCCION_COMPATIBLE=NO`
