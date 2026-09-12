# PM26 P09e — Diseño seguro de compatibilidad con producción

**Estado: DISEÑO PREVIO, SIN MIGRACIÓN NI DESPLIEGUE.**

P09e transforma el inventario de P09d en un procedimiento seguro. No contiene
SQL ejecutable, no autoriza escrituras y no sustituye la revisión previa en el
catálogo real antes de cada fase.

## Regla de arquitectura

No se promociona QA como bloque. Producción conserva sus helpers de identidad
y autorización como autoridad hasta que una comparación semántica y pruebas
por rol demuestren equivalencia. Cada objeto nuevo se diseña con nombre,
preflight, política, permiso, prueba y rollback explícitos.

Los trece RPC candidatos requieren autenticación, comprobación de identidad,
empresa/local y rol. El diseño mantiene esa defensa: no añade ejecución para
anónimos ni confía en datos del navegador para autorizar operaciones.

## Paquetes obligatorios y orden

1. **Catálogos y finanzas.** Clientes, proveedores, albaranes, facturas,
   gastos y pagos. Debe confirmar empresa/local antes de cada lectura o
   mutación y validar que los datos serializados pertenecen a la empresa.
2. **Caja y arqueos.** Operaciones de caja, arqueos y anulaciones. Debe
   conservar operación única, reversos trazables y la separación entre quien
   opera y quien puede corregir.
3. **Stock y devoluciones.** Venta, devolución a proveedor, devolución de
   venta y traslados. Debe comprobar cantidad, local operable y que toda
   compensación conserva el vínculo con la operación de origen.
4. **Auditoría y contrato del cliente.** Firma compatible de auditoría,
   vista de estado de stock con seguridad por invocador y validación de que el
   cliente llama únicamente contratos ya disponibles.

Un paquete no pasa al siguiente si su preflight, sus pruebas de aislamiento o
su rollback no pasan. La ejecución final no será una migración monolítica.

## Preflight obligatorio antes de aplicar

El preflight de cada paquete debe abortar sin cambios si ocurre cualquiera de
estas condiciones:

- Las ramas de referencia no son las aprobadas o el catálogo ha cambiado
  desde la inspección.
- Existe ya una tabla, vista, función, tipo, política o permiso con nombre o
  firma inesperados.
- Las tablas soporte no tienen las columnas, claves únicas o restricciones que
  el paquete requiere.
- Los helpers de identidad/empresa/local no superan la comparación semántica y
  las pruebas por rol previstas.
- Una vista no puede configurarse para respetar RLS del invocador.
- Una función privilegiada quedaría ejecutable por anónimo o sin verificar
  identidad, empresa, local y rol.
- Hay tráfico o filas que hacen inseguro un rollback destructivo.

Antes de cualquier escritura en producción, el preflight debe registrar solo
huellas y recuentos saneados, nunca usuarios, claves o datos de negocio.

## RLS, permisos y funciones

- Toda relación nueva expuesta debe tener RLS habilitado y políticas para el
  rol autenticado con predicados de empresa/local; no basta conceder el rol.
- Las funciones que necesitan privilegios deben fijar el search_path,
  comprobar el usuario autenticado y el contexto de empresa/local, y recibir
  EXECUTE únicamente por el rol necesario. Se revoca ejecución a anónimo y
  pública salvo justificación auditada.
- Las tablas de libro mayor se escriben desde la RPC validada; sus políticas
  directas se limitan al acceso que el caso de uso requiera.
- Los UPDATE requieren a la vez condición sobre la fila existente y sobre la
  fila resultante; los DELETE se verifican con lectura posterior.

## Pruebas requeridas

1. PostgreSQL local aislado: creación, reejecución rechazada, fallo de
   preflight y rollback tanto sin datos como con datos.
2. Identidades separadas: propietario autorizado, mismo empresa/local,
   empresa ajena, local ajeno y usuario sin membresía.
3. Doble clic, reintento y dos sesiones: una misma operation_id no puede
   duplicar caja, stock, pago, devolución ni reverso.
4. Contabilidad operativa: una anulación o devolución no puede dejar saldo,
   caja o stock parcialmente compensados.
5. Cliente: las 13 llamadas RPC y las relaciones utilizadas deben coincidir
   con firmas ya presentes; nunca se despliega un cliente antes de su backend.

El ensayo real en QA requerirá autorización separada y usará identidades
aisladas. La escritura en producción, el despliegue de cliente en release y
la promoción de cualquier rama también requieren autorizaciones independientes.

## Rollback

Antes de tráfico real, cada paquete puede retirarse en orden inverso solo si
el preflight confirma que no existen filas ni operaciones creadas. Con tráfico
real, el rollback es conservador: conserva datos, revoca la ruta defectuosa y
se corrige mediante avance controlado; no borra tablas, columnas ni
operaciones para aparentar una reversión limpia.

## Límites respetados

- Sin SQL aplicado en QA, producción o TPV.
- Sin Edge Functions, Netlify, main, release ni PR #38 modificados.
- Sin facturación fiscal real, numeración productiva ni documentos reales.

PM26_P09E_ESTADO=DISENO_PREVIO_SIN_MIGRACION

PM26_P09E_AUTORIZACION_PRODUCCION=NO
