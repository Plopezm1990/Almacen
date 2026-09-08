# PM12 · P04 — Integración UX de cierre honesto

Fecha: 2026-09-07  
Rama: `pm12-conteo-estados-honestos`

## Resultado

Se sustituyó el cierre directo de inventario por un flujo validado y visible:

- Un conteo sin productos o sin ninguna captura no puede finalizar.
- `0` es una cantidad contada válida; vacío significa pendiente.
- Las cantidades negativas o no numéricas bloquean el cierre.
- “Contado por” es obligatorio.
- La pantalla muestra productos contados, total, pendientes y porcentaje.
- Un conteo completo finaliza como `COMPLETADO`.
- Un conteo incompleto abre confirmación específica, exige motivo y finaliza como `PARCIAL`.
- Los productos pendientes permanecen pendientes y no se convierten silenciosamente en cero.
- El cierre conserva estado, fecha, responsable, motivo parcial y cobertura.
- Se registra auditoría funcional del cierre.

## Compatibilidad

Los conteos antiguos con `completado: true` siguen siendo legibles. La fuente recuperada y el bundle servido contienen la misma corrección. El motor PM12 se carga antes de la aplicación.

## Seguridad y alcance

- No se modificó `main`.
- No se desplegó a producción.
- No se realizaron escrituras en Supabase QA.
- Se conserva el filtro por local activo existente.
