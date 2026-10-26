# Plan Maestro L&A Suite — Etapa 7.2 / T9 — bloqueo de hardware

Fecha: 26/10/2026  
Entorno: QA `qjqorixtkilwsndqayyx`  
Estado: **PENDIENTE POR HARDWARE FÍSICO**

## 1. Decisión

La campaña física T9 queda **dejada pendiente por ahora**. No se declara T9
como PASS porque todavía no hay una impresora de tickets ni un cajón
monedero reales conectados al puesto de prueba.

Esta decisión es intencionada: el simulador no certifica que un navegador,
una impresora concreta y un cajón conectado funcionen correctamente en el
puesto físico del negocio.

## 2. Lo que sí está terminado

La parte de software que no necesita el aparato físico está implementada y
verificada:

- impresión de ticket en modo simulador;
- apertura de cajón en modo simulador;
- exigencia de cuenta completamente pagada para imprimir;
- exigencia de permiso de Caja y sesión abierta para abrir el cajón;
- exigencia de motivo cuando la apertura no está asociada a una venta;
- registro trazable de los eventos simulados;
- rechazo seguro cuando faltan permisos, equipo activo o condiciones de Caja;
- contrato de paridad entre `fuente.js` y su espejo recuperado;
- no se crea ninguna tabla nueva para el simulador.

Contratos ejecutados en esta comprobación:

- `etapa5-t7-impresion-cajon-simulador-contract.mjs`: **PASS**;
- `etapa7-role-matrix-caja-contract.mjs`: **PASS**;
- `etapa7-movimientos-sync-read-scope-contract.mjs`: **PASS**;
- `git diff --check`: **PASS**.

## 3. Qué falta para abrir la campaña física

La T9 podrá comenzar cuando estén disponibles y conectados:

1. una impresora de tickets física compatible, por ejemplo Epson o Star;
2. un cajón monedero conectado a la impresora;
3. el puesto Windows o dispositivo real donde se utilizará el TPV;
4. el puente local de impresión, si el modelo no permite comunicación directa
   desde el navegador;
5. una cuenta QA autorizada para ejecutar la prueba sin usar producción.

La comprobación del sistema realizada el 26/10/2026 no pudo enumerar una
impresora porque Windows no expuso el recurso CIM disponible para la consulta.
No se interpreta esa limitación del entorno como prueba de que el dispositivo
no exista en otro puesto; simplemente no hay evidencia de un periférico
físico conectado y utilizable en esta estación.

## 4. Secuencia que queda preparada

Cuando se conecte el hardware, la campaña deberá comprobar en QA:

1. impresión de un ticket después de un cobro QA autorizado;
2. apertura del cajón asociada a una venta;
3. apertura manual con motivo y sin venta;
4. rechazo cuando el equipo está inactivo o no pertenece al local;
5. fallo o desconexión de la impresora;
6. recuperación después de reconectar el equipo;
7. ausencia de duplicación al reintentar una impresión;
8. trazabilidad del resultado y ausencia de mutaciones en producción;
9. resultado en el dispositivo real previsto para el puesto único.

No se debe reutilizar una venta real de producción para esta campaña.

## 5. Estado de etapas

| Elemento | Estado |
|---|---|
| Software de impresión/cajón simulado | PASS |
| Contratos de permisos y Caja | PASS |
| Arranque offline seguro del shell | PASS |
| Impresora física conectada | PENDIENTE |
| Cajón físico conectado | PENDIENTE |
| Prueba T9 en puesto real | PENDIENTE |
| Cierre formal de Etapa 7.2/T9 | NO CERRADO |

## 6. Próximo paso

La Etapa 7.2/T9 queda aparcada hasta disponer del hardware. Mientras tanto,
no se cambia código ni se toca producción por este motivo. Al conectar los
periféricos, se reabre esta acta y se ejecuta la secuencia física completa
sobre QA.
