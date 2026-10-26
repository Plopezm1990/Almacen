# Plan Maestro L&A Suite — Etapa 7.1 — matriz TPV responsive y frontera offline

Fecha: 26/10/2026  
Entorno: QA `qjqorixtkilwsndqayyx` y Deploy Preview del PR `#175`  
Estado: `SUBMATRIZ_TPV_VERIFICADA; OFFLINE_GUARD_VERIFICADO; T9_FISICA_PENDIENTE`

## 1. Alcance

Se continuó la campaña no física de la Etapa 7.1 sobre el preview actualizado.
La comprobación cubrió:

- carga de la aplicación después de recargar el preview;
- apertura del TPV en `Local A2`;
- ausencia de desbordamiento horizontal y vertical en la vista disponible;
- ticket vacío y guardado deshabilitado al iniciar;
- creación y eliminación controlada de un borrador local de prueba;
- frontera de seguridad del TPV durante una pérdida temporal de red emulada;
- restauración de la conectividad;
- ausencia de errores JavaScript nuevos durante la tanda.

La prueba no guardó pedidos, no ejecutó cobros, no creó ventas, no abrió el
cajón y no modificó datos de Supabase.

## 2. Arranque observado

La recarga del preview alcanzó el evento de carga en aproximadamente `2,3 s`.
Tras dejar que terminara la hidratación de la aplicación, la vista quedó
operativa en aproximadamente `5,8 s` desde el inicio de la recarga. Esta cifra
es una observación de navegador en el entorno QA, no un SLA aprobado.

Resultado estable:

- empresa: `QA Empresa A, S.L.`;
- local: `Local A2`;
- TPV accesible;
- `Arranque: datos que no se pudieron cargar`: `0`;
- `Guardado: cambios sin confirmar`: `0`;
- ventas registradas en el local: `0`.

## 3. Responsive del TPV

La ventana disponible durante la comprobación tenía `690 × 668` píxeles
lógicos.

| Indicador | Resultado |
|---|---:|
| TPV visible | PASS |
| Ancho del documento | `690 px` |
| Ancho de viewport | `690 px` |
| Desbordamiento horizontal | No |
| Alto del documento en la vista capturada | `668 px` |
| Alto de viewport | `668 px` |
| Desbordamiento vertical en la vista capturada | No |
| Ticket inicial | `0 líneas · €0,00` |
| Botón `F9 Guardar` al iniciar | Deshabilitado |

La comprobación certifica la vista responsive disponible en esta sesión. No
sustituye la campaña T9 en tablet horizontal, ordenador táctil y móvil real.

## 4. Borrador local controlado

Se seleccionó el artículo QA `Agua 50 cl (QA)` sin pulsar guardar. La aplicación
creó un borrador local de una línea por `€0,99` y mostró que el ticket seguía
pendiente de confirmación server-side.

Se verificó que:

- no apareció una venta en el historial;
- no se ejecutó ningún cobro;
- no se llamó a una operación de negocio de servidor;
- el botón de guardar quedó separado del simple borrador local.

Con autorización expresa para limpiar el artefacto de prueba, se pulsó
`Vaciar carrito`. Resultado final:

- ticket: `0 líneas · €0,00`;
- borrador local activo: ausente;
- ventas: `0 registrada(s)`;
- `F9 Guardar`: deshabilitado;
- errores nuevos: `0`.

El entorno quedó limpio al finalizar la prueba.

## 5. Frontera offline

Sobre la vista TPV ya cargada se emuló temporalmente la pérdida de red del
navegador mediante el control de red de desarrollo. No se recargó la página en
offline ni se intentó guardar: el objetivo de esta tanda era verificar la
barrera de seguridad visible sin provocar una operación incierta.

Durante la emulación offline se observó:

- TPV visible y estable;
- ticket `0 líneas · €0,00`;
- `F9 Guardar` deshabilitado;
- ventas `0 registrada(s)`;
- sin texto de error offline añadido por la aplicación;
- sin errores ni advertencias nuevas en la consola durante la prueba.

La red se restauró inmediatamente después y el TPV continuó visible con el
ticket vacío. Esta evidencia valida la frontera de no cobrar/no guardar en la
vista ya hidratada; queda pendiente, para la campaña offline completa, repetir
el arranque en frío sin red, la recarga y la recuperación después de recuperar
conectividad.

## 6. Avisos no bloqueantes

La consola conserva los avisos ya conocidos de cuota de caché local para
`pagosFacturas`, `auditoria` y `movimientos`, además del aviso de la copia
automática de QA. La aplicación conserva la lectura remota y no bloquea los
datos operativos. No apareció ningún error de TPV, cobro, productos o
sincronización durante esta tanda.

## 7. Decisión

**Submatriz TPV responsive y guard offline: VERIFICADA EN QA.**

El resultado permite continuar la Etapa 7.1 sin abrir una nueva incidencia.
No convierte esta prueba en aceptación T9 ni certifica hardware físico.

## 8. Qué sigue

La siguiente comprobación segura es completar la matriz viva que aún depende de
cuentas QA dedicadas y métricas comparables de TPV antiguo frente a TPV nuevo.
La campaña T9 de impresora y cajón se mantiene bloqueada hasta disponer de los
periféricos reales. El arranque offline en frío y la recuperación tras recarga
quedan como una prueba específica posterior.
