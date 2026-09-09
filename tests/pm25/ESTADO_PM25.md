# Estado de PM25 — Ensayar recuperación y migración

| Punto | Estado |
|---|---|
| P01 — Respaldo local con nube activa | **Cerrado.** Evidencia real (verificada en vivo contra QA), commit/push y gate remoto `SUCCESS` en el HEAD exacto. Ver `P01_RESPALDO_NUBE_ACTIVA.md`. |
| P02 — Recuperación real de base de datos + ensayo de migración | **Bloqueado por falta de entorno aislado.** No probado, no aprobado, no descartado, no cerrado. Ver `P02_BLOQUEADO_ENTORNO_AISLADO.md`. |

**PM25 global: PARCIAL / BLOQUEADO. No completamente cerrado.**

Un gate remoto en verde sobre la documentación de P02 certifica que el
estado de bloqueo está registrado con precisión — **no** certifica que P02
se haya ejecutado, aprobado ni cerrado. Ese distingo se mantiene explícito
en todos los documentos, contratos y workflows de este paquete.

P02 queda con su diseño completo conservado (migración candidata,
fixtures con identificadores duplicados entre libros, pasos de reversión
sin `DROP` manual, controles de cero pérdida, presupuesto de duración) para
ejecutarse en cuanto exista alguna de las tres condiciones de desbloqueo
documentadas en `P02_BLOQUEADO_ENTORNO_AISLADO.md`.
