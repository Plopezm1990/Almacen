-- ABC F3 A10 — la asignación de ruta no reencola comandas históricas.
--
-- QA contiene una migración posterior que añadió un trigger para reencolar
-- automáticamente comandas BLOQUEADA/SIN_RUTA al asignar una estación. Esa
-- política puede imprimir una comanda histórica sin confirmación del usuario
-- y además usa min(uuid), que falla en PostgreSQL.
--
-- Esta reparación es idempotente y solo elimina el mecanismo automático. La
-- asignación de ruta sigue afectando a nuevas comandas; cualquier recuperación
-- histórica deberá implementarse como una acción explícita y auditada.

drop trigger if exists a10_requeue_blocked_routes
  on public.tpv_producto_estaciones;

drop function if exists private.abc_a10_reencolar_bloqueadas_route();

drop function if exists private.abc_a10_reencolar_bloqueadas_por_producto(
  text,text,text
);
