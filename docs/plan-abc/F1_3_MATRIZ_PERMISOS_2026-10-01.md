# F1.3 — matriz de permisos por operación y contexto

Fecha: 2026-10-01  
Estado: `PENDIENTE_VALIDACION_DE_ROLES`  
Base: F1.1–F1.2 y `origin/release` `7859508`

Esta matriz describe qué debe probarse. No concede permisos ni sustituye la
configuración existente de membresías; las decisiones finales deben validarse
con el negocio y en servidor.

## Operaciones protegidas

| Operación | Propietario | Encargado | Cajero | Camarero | Contexto mínimo |
|---|---|---|---|---|---|
| consultar catálogo | sí | sí | sí | sí | empresa/local activo |
| abrir pedido | sí | sí | sí | sí | local activo |
| editar pedido propio | sí | sí | sí | sí | versión esperada |
| cancelar pedido servido | pendiente | pendiente | no por defecto | no por defecto | motivo y autorización |
| abrir caja | sí | sí | pendiente | no | sesión y local |
| registrar cobro efectivo | sí | sí | sí | no por defecto | caja abierta |
| resolver cobro desconocido | sí | sí | pendiente | no | referencia e incidencia |
| solicitar devolución | sí | sí | pendiente | no | pago original y saldo |
| aprobar descuento | sí | pendiente | no por defecto | no | límite y motivo |
| configurar política | sí | no por defecto | no | no | propietario del local |
| cerrar caja | sí | sí | pendiente | no | arqueo preparado |
| reabrir sesión | sí | pendiente | no | no | permiso excepcional y auditoría |
| emitir documento | sí | sí | pendiente | no | serie y régimen válidos |
| rectificar documento | sí | pendiente | no | no | vínculo al original |
| resolver incidencia | sí | sí | pendiente | no | operación y contexto |

`pendiente` significa que la capacidad debe confirmarse; no significa permiso
concedido. La política real debe usar las membresías y roles existentes, con
empresa y local comprobados en cada RPC o endpoint.

## Denegaciones obligatorias

Cada operación debe fallar sin efectos parciales cuando:

- la sesión está revocada, el rol no tiene capacidad o el local no coincide;
- se cambia `empresa_id`, `local_id`, `pedido_id`, `pago_id` u otro identificador
  para intentar acceder a otra entidad;
- el estado previo no permite la transición, la versión está desactualizada o
  falta el motivo exigido;
- el cliente intenta escribir directamente en tablas protegidas;
- el reintento usa el mismo `operation_id` con un cuerpo diferente.

El resultado de una denegación no debe revelar datos de otra empresa o local.

## Evidencia por rol

| Rol | Caso positivo | Caso negativo |
|---|---|---|
| Propietario | configura política y revisa auditoría de su local | accede a otro local sin membresía |
| Encargado | opera caja y resuelve incidencia autorizada | rectifica fuera de su alcance |
| Cajero | cobra y arquea su caja | aprueba descuentos fuera de límite |
| Camarero | crea y edita pedido permitido | cierra caja o resuelve reembolso |
| Sesión revocada | ninguna mutación | toda escritura falla |
| `anon`/contexto ajeno | ninguna operación protegida | denegación sin fuga de datos |

## Criterios de aceptación F1.3

1. La autorización se decide en servidor, no en la visibilidad de un botón.
2. Empresa, local, rol, actor y estado se comprueban juntos.
3. Permisos de cobro, devolución, descuento, cierre y reapertura son
   distinguibles y auditables.
4. Las pruebas positivas y negativas dejan evidencia reproducible.
5. No se amplían permisos reales hasta que el negocio apruebe esta matriz.

## Resultado de F1.3

La matriz queda lista para revisión de roles. No modifica ACL/RLS, no escribe
en Supabase, no requiere secretos, merge ni deploy de Netlify.
