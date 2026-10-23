# Plan Maestro L&A Suite — Cierre de la Etapa 3

Fecha: 23/10/2026  
Ámbito: exclusivamente Plan Maestro L&A Suite  
Preview QA: `deploy-preview-172--chic-entremet-9107cf.netlify.app`  
Commit QA verificado: `f15cb1153bc2e435ada6fc176af4976b489d0357`  
Entorno: QA · `QA Empresa A, S.L.` · `Local A1`  
Producción: no tocada

## Estado

**ETAPA 3 CERRADA.**

La Etapa 3 contiene los cinco fallos medios AUD-005, AUD-002, AUD-008,
AUD-007 y AUD-001. Se verificaron en QA después de publicar la corrección de
AUD-005. El contrato automatizado también pasa: `F5 Etapa 3 UI: contrato OK`.

## Aceptación por auditoría

### AUD-005 — roles retirados: PASS

- Se reprodujo el defecto: el modal `Crear cuenta de acceso` ofrecía
  `Churrero/a` aunque era un rol retirado.
- Se corrigió el modal para construir el selector desde `NOMBRES_ROLES_ALTA`.
- En QA el selector visible quedó limitado a `Camarero/a`, `Cajero/a` y
  `Encargado`; `Churrero/a` ya no aparece.
- La corrección se aplicó a `fuente.js` y a
  `source-recovery/fuente-recuperado.js`.
- No se creó ninguna cuenta ni se guardó ningún empleado durante la prueba.

### AUD-002 — precisión de importes y sin stock: PASS

- `QA AUD002 3DEC 20261022` mostró PVP c/IVA `€ 2,345` y coste `€ 1,00`.
- El mismo producto mostró stock `0 unidad`; sus acciones de cantidad quedaron
  bloqueadas.
- El contrato verifica tres decimales en el formateador, coste, PVP y salidas
  unitarias.

### AUD-008 — navegación de Resultados: PASS

- `Mes anterior` cambió `2026-10-01..2026-10-31` a
  `2026-09-01..2026-09-30`.
- `Mes siguiente` devolvió el periodo a octubre de 2026.
- El contrato verifica que la navegación usa el periodo visible.

### AUD-007 — adaptación móvil: PASS

- `Pedidos > Nuevo pedido` se abrió con viewport QA de `390 × 844`.
- El formulario y la navegación inferior permanecieron dentro del ancho
  visible, sin desbordamiento horizontal.
- Se canceló el formulario sin crear ni guardar el pedido.
- El contrato verifica `min-w-0`, el overflow del contenido y el scroll
  localizado de tablas.

### AUD-001 — etiquetas y controles: PASS

- En `Pedidos > Nuevo pedido` se observaron las etiquetas accesibles
  `Proveedor` y `Fecha esperada de entrega` asociadas a sus controles.
- El contrato verifica que `Field` inyecta el `id` en el control y expone
  `htmlFor` en la etiqueta.

## Verificación técnica y límites

- `node tests/f5/f5-etapa3-ui-contract.mjs`: PASS.
- `git diff --check`: PASS.
- El commit `f15cb11` está publicado en la rama QA y Netlify informó
  `Deploy Preview ready!` para el preview 172.
- El aviso QA `Guardado solo en este equipo (historialRespaldos)` continúa
  visible; no autoriza tocar PROD ni cambia el resultado de esta etapa.
- No se hicieron escrituras SQL directas, migraciones, cobros ni cambios en
  producción.
- La evidencia T1–T4 del TPV se conserva separadamente como
  `ETAPA4_QA2_VERIFICACION_2026-10-23.md`.

## Lo siguiente

La siguiente etapa es la **Etapa 4 — TPV: la base / Hoja QA-2**. Sigue abierta
con T1–T4 verificados funcionalmente, pero con la aceptación QA-2 pendiente de
consolidación y de sus límites de persistencia/sincronización. No se debe
mezclar con el Plan ABC.
