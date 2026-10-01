# F0.2 — ficha de decisión del piloto

Fecha: 2026-10-01  
Estado: `PENDIENTE_DECISION_USUARIO`  
Base: F0.1 sobre `origin/release` `7859508`

Esta ficha permite avanzar con el diseño sin contratar proveedor, comprar
hardware ni publicar el sistema. Los valores `PENDIENTE` no son una elección
implícita y deben resolverse antes de preparar una aceptación operativa.

## Decisiones necesarias

| Campo | Valor actual | Regla para completarlo |
|---|---|---|
| Empresa y local piloto | `PENDIENTE` | identificar empresa/local sin pegar datos sensibles |
| Modalidades incluidas | `PENDIENTE` | marcar barra, mesa, terraza y/o para llevar |
| Número de cajas simultáneas | `PENDIENTE` | cifra máxima durante la prueba |
| Roles participantes | `PENDIENTE` | propietario, encargado, cajero, camarero u otros existentes |
| Usuarios de prueba | `PENDIENTE` | usar cuentas de QA, nunca credenciales en el repositorio |
| Productos y variantes | `PENDIENTE` | indicar un conjunto ficticio representativo |
| Moneda y zona horaria | `PENDIENTE` | confirmar configuración del local |
| Equipo de caja | `PENDIENTE` | navegador, sistema operativo y tamaño de pantalla |
| Impresora y cajón | `PENDIENTE` | indicar modelo o `NO APLICA` con justificación |
| Conectividad | `PENDIENTE` | red principal y comportamiento esperado ante corte |
| Duración del piloto | `PENDIENTE` | fecha o ventana, sin dinero real por defecto |
| Responsable de aceptación | `PENDIENTE` | persona que revisa evidencias y firma el resultado |

## Alcance por defecto mientras no haya decisión

- El piloto se mantiene en datos ficticios y entorno aislado.
- Se puede probar la interfaz y los contratos locales sin proveedor de pagos.
- No se activa offline real, fiscalidad real, dinero real ni impresión real sin
  una decisión específica y una prueba autorizada.
- B12, B07 y B08 permanecen pendientes de proveedor; esta ficha no los cierra.
- La primera validación de equipos puede hacerse con navegador y simuladores,
  sin consumir créditos de Netlify.

## Respuesta mínima para completar la ficha

El usuario puede responder con esta estructura, sin incluir contraseñas ni
secretos:

```text
Local piloto: pendiente / [nombre interno]
Modalidades: barra / mesa / terraza / para llevar
Cajas simultáneas: [número]
Roles: [roles]
Moneda y zona horaria: [valor]
Equipo: [navegador, sistema, pantalla]
Impresora/cajón: [modelo o NO APLICA]
Conectividad: [descripción]
Responsable: [rol o nombre interno]
```

## Resultado de F0.2

La decisión queda preparada pero no tomada. El siguiente trabajo técnico
independiente puede continuar sobre contratos y pruebas locales; la aceptación
del piloto queda bloqueada hasta completar esta ficha. No requiere migración
remota, secretos, merge ni deploy de Netlify.
