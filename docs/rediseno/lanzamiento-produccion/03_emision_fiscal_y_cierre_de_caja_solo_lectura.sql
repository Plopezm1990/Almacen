-- 03 · EMISIÓN FISCAL y CIERRE DE CAJA · SOLO LECTURA
--
-- Por qué existe: la migración 20261126140000 añade el bloqueo VENTAS_SIN_DOCUMENTO al cierre de caja (H-38). Tras la revisión de código de #226, solo rige donde la emisión
-- fiscal del local está configurada y usable (`private.abc_c07d_emision_config` en VALIDADA o ACTIVA). Este informe dice, por local, si hay emisión configurada y cuántas ventas
-- cobradas de los últimos 30 días no tienen documento EMITIDO: son las que bloquearían el cierre DEFINITIVO de una sesión de caja (decisión D6 del plan).
--
-- No modifica nada. Ejecútalo con un rol de solo lectura. Las consultas son independientes.

begin read only;

-- A. Configuración de emisión por local. Si en producción no sale ninguna fila usable, el bloqueo NO rige (y tampoco se prepara el QR fiscal: ver C).
select c.empresa_id, c.local_id, c.tipo_documento, c.estado, c.adapter_code, c.environment
  from private.abc_c07d_emision_config c
 order by 1, 2, 3;

-- B. Ventas cobradas (últimos 30 días) sin documento EMITIDO, por local, y si ese local tiene emisión usable.
select k.empresa_id, k.local_id,
       count(*) as ventas_cobradas_30d,
       count(*) filter (where not exists (
              select 1 from public.abc_c05_documentos_emitidos d
               where d.empresa_id = k.empresa_id and d.local_id = k.local_id
                 and d.documento_origen_id = cv.venta_fiscal_id::text and d.estado = 'EMITIDO')) as sin_documento_emitido,
       exists (select 1 from private.abc_c07d_emision_config c
                where c.empresa_id = k.empresa_id and c.local_id = k.local_id
                  and c.estado in ('VALIDADA', 'ACTIVA')) as emision_usable
  from public.checkouts k
  join public.checkout_ventas cv on cv.checkout_id = k.id
 where k.estado = 'COMPLETADO' and cv.importe_objetivo > 0 and k.completed_at >= now() - interval '30 days'
 group by k.empresa_id, k.local_id
 order by 1, 2;

-- C. ¿Existe en este entorno la preparación del QR fiscal? La pantalla solo la usa en QA («El QR fiscal solo se prepara en QA»): si en producción se espera QR en el ticket,
--    hay que decidir cómo se resuelve (D6). `existe_en_este_entorno = true` solo debería verse en QA.
select exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                where n.nspname = 'public' and p.proname = 'abc_preparar_ticket_fiscal_qa') as existe_en_este_entorno;

-- D. Sesiones de caja recientes por estado (para saber cuántas podrían verse afectadas el día del lanzamiento).
select s.empresa_id, s.local_id, s.estado, count(*) as sesiones, max(s.abierta_at) as ultima_apertura
  from public.caja_sesiones s
 where s.abierta_at >= now() - interval '30 days'
 group by 1, 2, 3
 order by 1, 2, 3;

rollback;
