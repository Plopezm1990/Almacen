# F2.6 — manifiesto y recuperación del candidato

Fecha: 2026-10-01  
Estado: `PLANTILLA_PENDIENTE_CANDIDATO`  
Base: F2.1–F2.5 y `origin/release` `7859508`

Este manifiesto acompaña a cualquier candidato de F2. Permite comparar el
artefacto exacto, sus migraciones y la recuperación sin depender de memoria o
del último commit de una rama.

## Identidad del candidato

| Campo | Valor |
|---|---|
| SHA de base | `7859508` |
| SHA del candidato | `PENDIENTE` |
| Rama/PR | `PENDIENTE` |
| Nombre de migración CLI | `PENDIENTE` |
| Hash de migración SQL | `PENDIENTE` |
| Versión PostgreSQL | `PENDIENTE` |
| Resultado advisors | `PENDIENTE` |
| Resultado PG01–PG12 | `PENDIENTE` |
| Responsable técnico | `PENDIENTE` |
| Entorno autorizado | `NINGUNO` por defecto |

## Contenido que se debe adjuntar

- diff revisado desde `origin/release`;
- lista ordenada de migraciones y dependencias;
- tablas, RPC, políticas, grants, índices y funciones afectados;
- logs sanitizados de reconstrucción y pruebas;
- manifest de archivos publicables;
- impacto en clientes antiguos y datos existentes;
- coste previsto y ventana de ejecución;
- procedimiento de parada y recuperación.

## Recuperación segura

1. Detener la promoción si falla una comprobación previa.
2. Conservar logs, SHA, error y estado de la migración.
3. Si no hubo escritura, corregir el candidato y repetir en local.
4. Si hubo escritura interna, usar la compensación revisada; no borrar hechos.
5. Conciliar cualquier efecto externo antes de reintentar cobros o documentos.
6. Verificar permisos, sesiones, outbox, pagos, caja y stock después de
   recuperar.
7. Registrar quién decide continuar, pausar o revertir.

Restaurar una base de datos no anula por sí solo un cargo bancario ni un
documento fiscal. Los efectos externos requieren conciliación separada.

## Puerta de autorización

El candidato no puede entrar en QA mientras falten SHA, hash SQL, resultado de
pruebas, revisión de seguridad, recuperación y responsable. La autorización de
QA no implica autorización de PROD. Un cambio posterior en SQL, frontend,
configuración o dependencias exige un nuevo manifiesto.

## Resultado de F2.6

La plantilla de identidad y recuperación queda preparada. No hay candidato SQL
ni entorno autorizado todavía; no se ejecuta migración, no se toca QA/PROD y no
se hace deploy de Netlify.
