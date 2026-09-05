# G1 · Núcleo seguro · Punto 1 — checkpoint de inicio

Fecha: 2026-09-05

## Base autoritativa

- Paquete anterior: PM10 · Validaciones altas y datos legados.
- HEAD remoto final PM10 verificado antes de crear la rama: `94d37cc7a5176e3a44d00f8f8bfb79a630dae314`.
- PR PM10 #25: `closed`, `merged=false`, `merged_at=null`.
- `main` verificada intacta: `7f792925d6a3d27334ee0e7335ba635b4ed79b6b`.
- Rama G1 creada desde el HEAD remoto final de PM10, nunca desde `main`: `g1-nucleo-seguro`.

## Alcance del gate G1 según Plan Maestro

G1 es una puerta de calidad, no un paquete funcional ordinario. Debe demostrar, antes de habilitar PM11:

- cero hallazgos CRÍTICOS o ALTOS abiertos de Fase 1;
- revalidación específica de LA-019 y LA-023;
- permisos y aislamiento coherentes;
- cifras/conciliaciones coherentes;
- concurrencia/replay cuando aplique;
- evidencia identificada por build/commit.

No se reinterpretan ni reabren PM01-PM10 salvo regresión reproducible o dependencia demostrada.

## Estado de seguridad del inicio

- Sin merge a `main`.
- Sin publicación a producción.
- Sin migraciones de producción.
- Sin datos reales.
- Sin cambios de configuración productiva.
- No se ha iniciado todavía la ejecución de LA-019/LA-023 ni las pruebas del gate; este archivo solo congela el checkpoint de entrada.

## Siguiente punto

P02: inventario verificable de los criterios de salida de Fase 1 y mapa de evidencia existente (PM01-PM10), sin dar por superado G1 hasta comprobar cada criterio en el HEAD actual.
