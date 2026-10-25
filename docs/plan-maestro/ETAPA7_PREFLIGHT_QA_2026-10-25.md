# Plan Maestro L&A Suite — Etapa 7 — preflight QA

Fecha: 25/10/2026  
Entorno de software: QA `qjqorixtkilwsndqayyx` y preview del PR #175  
Estado: `ETAPA_7_INICIADA; PREFLIGHT_COMPLETADO; T9_BLOQUEADA_POR_HARDWARE`

## 1. Fuente y alcance oficial

El alcance de esta etapa procede de la hoja de ruta del Plan Maestro, no del
documento posterior de rediseño visual. El Plan Maestro define la Etapa 7 como
**Pruebas completas en QA (T9 + auditoría pendiente)**.

El alcance oficial tiene cuatro bloques:

1. probar el TPV nuevo en tablet horizontal, ordenador táctil y móvil;
2. comparar el mismo pedido en TPV viejo y nuevo, con objetivo de reducir los
   toques aproximadamente a la mitad;
3. probar con impresora y cajón reales;
4. auditar roles, Plataforma, aislamiento entre empresas, rendimiento,
   instalación offline y los diez hallazgos AUD-001 a AUD-010.

El propio Plan Maestro advierte que T9 necesita una impresora y un cajón reales.
Ese bloqueo se mantiene y no se puede convertir en PASS mediante simuladores.

El documento `LA-Suite-TPV-puesto-unico-documento-2.pdf` es una propuesta de
UX/UI superpuesta. Su propio texto la define como especificación futura y dice
que no sustituye la aceptación de T8 o T9. Por eso no se usa para declarar
cerrada esta etapa.

## 2. Resultado del preflight

La Etapa 7 queda **iniciada**, pero no cerrada. La separación correcta es:

| Bloque | Estado | Evidencia o bloqueo |
|---|---|---|
| T9 en tablet horizontal | Pendiente | No hay campaña de dispositivo real documentada |
| T9 en ordenador táctil | Pendiente | No hay puesto táctil real documentado |
| T9 en móvil | Parcial | Existen contratos y runtimes responsive; falta campaña T9 con pedido comparable |
| TPV antiguo vs nuevo | Pendiente | Falta protocolo con el mismo pedido y conteo de toques |
| Impresora real | BLOQUEADO | No disponible en el entorno indicado por el Plan Maestro |
| Cajón real | BLOQUEADO | No disponible; el simulador no certifica hardware |
| Roles y cargos | Parcial | Contratos amplios en verde; falta matriz viva con cuentas QA por rol |
| Plataforma | Parcial | Runtimes y contratos en verde; falta auditoría viva consolidada |
| Aislamiento empresa/local | Parcial | Contratos y evidencias existentes; falta acta T9 consolidada |
| Rendimiento | Parcial | Índices PUNTO9 cerrados por preexistencia; falta medición T9 de tiempos y carga |
| Instalación offline | Diseño validado | Contingencia documentada y contrato en verde; no se activa cobro offline |
| AUD-001 a AUD-009 | Cerrados en sus actas | Revisión de trazabilidad pendiente dentro del acta T9 única |
| AUD-010 | Parcial | Seguridad, suscripción y timeout corregidos; entrega push real sigue sin certificarse |

## 3. Verificación ejecutable realizada

### Contratos seleccionados de la auditoría transversal

Se ejecutaron 53 pruebas seleccionadas de los bloques de permisos, Plataforma,
aislamiento, contexto y offline. Resultado consolidado tras completar la
dependencia de UI y corregir el acotado portable de PM20:

- `53/53 PASS`;
- `0 FAIL`.

Resultados destacados:

- Plataforma P05: `95/95`;
- arranque Plataforma P06: `44/44`;
- empresas sin alta P07: `8/8`;
- copias locales por cuenta P08: `28/28`;
- historial de cuota P08c: `PASS`;
- permisos y aislamiento G1: `PASS` en contratos;
- contexto multiempresa PM10: `PASS`;
- aislamiento de compra PM11: `PASS`;
- permisos de ajustes PM12: `PASS`;
- cargos, fichajes, ausencias y permisos PM13: `PASS`;
- frontera offline B11: `PASS`;
- errores del sistema PM20: `PASS`.

La prueba de Plataforma se ejecutó con la carpeta de dependencias UI
`react@18.3.1`, `react-dom@18.3.1` y `jsdom`. No se consideró un fallo de
producto la ausencia inicial de esa carpeta en el entorno local.

### Corrección de portabilidad incluida en el preflight

El contrato `tests/pm20/p06-errores-sistema-aislamiento-contract.mjs` no podía
acotar el bloque de `registrarErrorSistema` cuando el archivo fuente se leía
con saltos de línea CRLF de Windows. Se normalizó el texto antes de aplicar las
aserciones. La corrección afecta al test, no cambia el aislamiento ni el código
de registro de errores.

## 4. Estado de los diez AUD

| Hallazgo | Estado para Etapa 7 | Nota |
|---|---|---|
| AUD-001 | Cerrado en Etapa 3 | Evidencia de campos y accesibilidad conservada |
| AUD-002 | Cerrado en Etapa 3 | Redondeo y presentación corregidos |
| AUD-003 | Cerrado en QA | Libro de IVA y exclusión de albaranes documentados |
| AUD-004 | Cerrado en QA | Fixture legacy, aislamiento, idempotencia y baja lógica PASS |
| AUD-005 | Cerrado en Etapa 3 | Rol retirado no ofrecido |
| AUD-006 | Cerrado en QA | Encargos pendientes, cliente, fechas y estados corregidos |
| AUD-007 | Cerrado en Etapa 3 | Pantallas revisadas para ancho móvil |
| AUD-008 | Cerrado en Etapa 3 | Periodo de Resultados corregido |
| AUD-009 | Cerrado en QA | Merma y traspaso reales sincronizados en servidor QA |
| AUD-010 | Parcial | El ciclo de push real sigue pendiente de una entrega observable |

La auditoría de Etapa 7 debe revalidar la evidencia, no reabrir un hallazgo ya
cerrado sin una regresión demostrable. AUD-010 sí debe permanecer visible como
pendiente parcial hasta certificar entrega o declarar formalmente el límite del
proveedor.

## 5. Lo que no se puede cerrar todavía

No se debe declarar T9 PASS mientras falte cualquiera de estos elementos:

1. impresora de tickets real y cajón real conectados;
2. prueba del mismo pedido en TPV antiguo y nuevo;
3. conteo repetible de toques en cada dispositivo;
4. resultado de lectura, escritura, cobro y recuperación en tablet horizontal,
   táctil y móvil;
5. cuentas QA reales por Propietario, Encargado, Cajero/a y Camarero/a;
6. acta de aislamiento empresa A/B y local A1/A2 con consultas/mutaciones
   controladas;
7. mediciones de rendimiento con una carga representativa;
8. instalación, recarga y contingencia offline sin presentar un pago no
   confirmado como cobrado;
9. decisión documentada sobre AUD-010.

## 6. Primer entregable seguro de la Etapa 7

El preflight permite avanzar sin hardware con una campaña **Etapa 7.1 —
auditoría transversal no física**:

- cerrar la matriz viva de roles y capacidades;
- repetir en QA la prueba de aislamiento con cuentas preparadas;
- consolidar Plataforma y sus copias locales por cuenta;
- medir tiempos de arranque, cambio de local, carga de TPV y recuperación;
- verificar instalación, recarga y límites offline;
- revisar AUD-001 a AUD-010 contra las actas actuales.

La campaña física **Etapa 7.2 — T9 de dispositivos y hardware** queda
preparada, pero no se puede ejecutar hasta disponer de impresora y cajón.

## 7. Seguridad y límites

- No se ha tocado producción.
- No se han aplicado migraciones nuevas.
- No se han creado ventas, cobros ni fixtures nuevos para este preflight.
- Los contratos que requieren PostgreSQL completo deben ejecutarse en el CI
  Linux o en una réplica QA desechable; no se sustituyen con una prueba estática.
- El modo offline no se activa como método de cobro confirmado.
- Ningún simulador de impresión o cajón sustituye la prueba física.

## 8. Siguiente paso

El siguiente paso es ejecutar la campaña QA 7.1 con una matriz de cuentas por
rol y métricas repetibles, empezando por permisos y aislamiento. En paralelo,
queda pendiente conseguir o conectar la impresora y el cajón reales para poder
abrir la campaña 7.2/T9.

La Etapa 7 no se fusiona ni se promociona a producción desde este preflight.
