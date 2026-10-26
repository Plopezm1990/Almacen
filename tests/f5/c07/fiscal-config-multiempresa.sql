-- Contrato sobre la migración exacta; datos sintéticos, transacción revertida.
begin;
create temporary table fiscal_checks(label text primary key);
grant all on fiscal_checks to authenticated;
create function pg_temp.fiscal_assert(p_ok boolean, p_label text)
returns void language plpgsql as $$
begin
  if p_ok is distinct from true then raise exception 'FISCAL_ASSERT:%',p_label; end if;
  insert into fiscal_checks values(p_label);
end $$;
create function pg_temp.fiscal_reject(p_sql text, p_expected text, p_label text)
returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if position(p_expected in sqlerrm) = 0 then raise; end if;
    insert into fiscal_checks values(p_label);
    return;
  end;
  raise exception 'FISCAL_EXPECTED_REJECTION:%',p_label;
end $$;

grant execute on function pg_temp.fiscal_assert(boolean,text) to authenticated;
grant execute on function pg_temp.fiscal_reject(text,text,text) to authenticated;

insert into auth.users(id) values
 ('10000000-0000-0000-0000-000000000001'),
 ('10000000-0000-0000-0000-000000000002'),
 ('10000000-0000-0000-0000-000000000003'),
 ('10000000-0000-0000-0000-000000000004');
insert into public.empresas(id,nombre) values ('fiscal-a','Empresa A'),('fiscal-b','Empresa B');
insert into public.locales(id,empresa_id,nombre) values
 ('fiscal-a1','fiscal-a','Local A1'),('fiscal-a2','fiscal-a','Local A2'),('fiscal-b1','fiscal-b','Local B1');
insert into public.membresias_usuario(user_id,empresa_id,rol,todos_locales,local_id) values
 ('10000000-0000-0000-0000-000000000001','fiscal-a','Propietario',true,null),
 ('10000000-0000-0000-0000-000000000002','fiscal-b','Propietario',true,null),
 ('10000000-0000-0000-0000-000000000003','fiscal-a','Cajero/a',false,'fiscal-a1'),
 ('10000000-0000-0000-0000-000000000004','fiscal-a','Propietario',false,'fiscal-a1');
insert into public.entidades_fiscales(id,empresa_id,nombre_legal,identificador_fiscal,country_code) values
 ('20000000-0000-0000-0000-000000000001','fiscal-a','Emisor A','TEST-A','ES'),
 ('20000000-0000-0000-0000-000000000002','fiscal-b','Emisor B','TEST-B','ES');
insert into public.entidad_fiscal_locales(empresa_id,local_id,entidad_fiscal_id) values
 ('fiscal-a','fiscal-a1','20000000-0000-0000-0000-000000000001'),
 ('fiscal-a','fiscal-a2','20000000-0000-0000-0000-000000000001'),
 ('fiscal-b','fiscal-b1','20000000-0000-0000-0000-000000000002');

select pg_temp.fiscal_assert((select bool_and(relrowsecurity) from pg_class
  where oid in ('private.abc_fiscal_borradores'::regclass,'private.abc_fiscal_borrador_revisiones'::regclass)), 'RLS habilitado');
select pg_temp.fiscal_assert(not has_table_privilege('authenticated','private.abc_fiscal_borradores','SELECT'), 'Sin lectura directa');
select pg_temp.fiscal_assert(not has_table_privilege('service_role','private.abc_fiscal_borradores','UPDATE'), 'Sin escritura service_role');
select pg_temp.fiscal_assert(not has_function_privilege('anon','public.abc_fiscal_leer_borrador(text,text,uuid)','EXECUTE'), 'Anon sin RPC');
select pg_temp.fiscal_assert(not has_function_privilege('service_role','public.abc_fiscal_guardar_borrador(uuid,text,text,uuid,bigint,jsonb)','EXECUTE'), 'Service sin RPC');
select pg_temp.fiscal_assert(not has_function_privilege('authenticated','private.abc_fiscal_config_acceso(text,text,uuid)','EXECUTE'), 'Helper privado');

select set_config('app.test_empresa','fiscal-a',true),set_config('app.test_local','fiscal-a1',true),
  set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true);
set local role authenticated;
select pg_temp.fiscal_assert((public.abc_fiscal_leer_borrador('fiscal-a','fiscal-a1','20000000-0000-0000-0000-000000000001')->>'version')::int = 0, 'Emisor sin borrador');
create temporary table fiscal_results(id text, result jsonb);
insert into fiscal_results values ('a',public.abc_fiscal_guardar_borrador(
  '30000000-0000-0000-0000-000000000001','fiscal-a','fiscal-a1','20000000-0000-0000-0000-000000000001',0,
  '{"jurisdiccion":"ES_AEAT","sujecion":"SUJETO_RRSIF","modalidad":"VERIFACTU","canal":"ASESORIA","representacion":"COLABORACION_SOCIAL","asesoria_nombre":"Asesoría A","asesoria_email":"a@example.invalid"}'));
select pg_temp.fiscal_assert((select result->>'estado'='BORRADOR' and result->>'conexion'='NO_CONFIGURADA'
  and (result->>'emision_habilitada')::boolean = false and result->>'version'='1' from fiscal_results where id='a'), 'Guardar no activa ni conecta');
select pg_temp.fiscal_assert((select result = public.abc_fiscal_guardar_borrador(
  '30000000-0000-0000-0000-000000000001','fiscal-a','fiscal-a1','20000000-0000-0000-0000-000000000001',0,
  '{"jurisdiccion":"ES_AEAT","sujecion":"SUJETO_RRSIF","modalidad":"VERIFACTU","canal":"ASESORIA","representacion":"COLABORACION_SOCIAL","asesoria_nombre":"Asesoría A","asesoria_email":"a@example.invalid"}') from fiscal_results where id='a'), 'Reintento mismo resultado');
select pg_temp.fiscal_reject($q$select public.abc_fiscal_guardar_borrador('30000000-0000-0000-0000-000000000001','fiscal-a','fiscal-a1','20000000-0000-0000-0000-000000000001',0,'{}')$q$,'FISCAL_CONFIG_OPERATION_CONFLICT','Operación reutilizada con otro contenido');
select pg_temp.fiscal_reject($q$select public.abc_fiscal_guardar_borrador('30000000-0000-0000-0000-000000000003','fiscal-a','fiscal-a1','20000000-0000-0000-0000-000000000001',0,'{}')$q$,'FISCAL_CONFIG_VERSION_OBSOLETA','Actualización obsoleta rechazada');
select pg_temp.fiscal_reject($q$select public.abc_fiscal_guardar_borrador('30000000-0000-0000-0000-000000000003','fiscal-a','fiscal-a1','20000000-0000-0000-0000-000000000001',1,'{"certificado":"private-key"}')$q$,'FISCAL_CONFIG_CAMPO_NO_PERMITIDO','Certificado no guardable');
select pg_temp.fiscal_reject($q$select public.abc_fiscal_guardar_borrador('30000000-0000-0000-0000-000000000003','fiscal-a','fiscal-a1','20000000-0000-0000-0000-000000000001',1,'{"estado":"ACTIVO"}')$q$,'FISCAL_CONFIG_CAMPO_NO_PERMITIDO','Estado no configurable');
select pg_temp.fiscal_reject($q$select public.abc_fiscal_guardar_borrador('30000000-0000-0000-0000-000000000003','fiscal-a','fiscal-a1','20000000-0000-0000-0000-000000000001',1,'{"endpoint":"https://example.invalid"}')$q$,'FISCAL_CONFIG_CAMPO_NO_PERMITIDO','Destino no arbitrario');
select pg_temp.fiscal_reject($q$select public.abc_fiscal_guardar_borrador('30000000-0000-0000-0000-000000000003','fiscal-a','fiscal-a1','20000000-0000-0000-0000-000000000001',1,'{"asesoria_nombre":{"certificado":"oculto"}}')$q$,'FISCAL_CONFIG_TIPO_INVALIDO','Objeto anidado rechazado');
select pg_temp.fiscal_reject($q$select public.abc_fiscal_guardar_borrador('30000000-0000-0000-0000-000000000003','fiscal-a','fiscal-a1','20000000-0000-0000-0000-000000000001',1,'{"asesoria_email":"incorrecto"}')$q$,'FISCAL_CONFIG_EMAIL_INVALIDO','Email validado');
select pg_temp.fiscal_reject($q$select public.abc_fiscal_guardar_borrador('30000000-0000-0000-0000-000000000003','fiscal-a','fiscal-a1','20000000-0000-0000-0000-000000000001',1,'{"jurisdiccion":"ES_FORAL","sujecion":"SUJETO_RRSIF","modalidad":"VERIFACTU"}')$q$,'FISCAL_CONFIG_AMBITO_INCOMPATIBLE','Foral no activa AEAT');
select pg_temp.fiscal_reject($q$select public.abc_fiscal_guardar_borrador('30000000-0000-0000-0000-000000000003','fiscal-a','fiscal-a1','20000000-0000-0000-0000-000000000001',1,'{"jurisdiccion":"ES_AEAT","sujecion":"EXCLUIDO_SII","modalidad":"VERIFACTU"}')$q$,'FISCAL_CONFIG_AMBITO_INCOMPATIBLE','SII no activa RRSIF');
select pg_temp.fiscal_reject($q$select public.abc_fiscal_guardar_borrador('30000000-0000-0000-0000-000000000003','fiscal-a','fiscal-a1','20000000-0000-0000-0000-000000000001',1,'{"canal":"ASESORIA","representacion":"PROPIO"}')$q$,'FISCAL_CONFIG_REPRESENTACION_INCOMPATIBLE','Representación coherente');
select pg_temp.fiscal_reject($q$select public.abc_fiscal_leer_borrador('fiscal-a','fiscal-a1','20000000-0000-0000-0000-000000000002')$q$,'FISCAL_CONFIG_NO_AUTORIZADO','Emisor de otra empresa rechazado');
reset role;

select set_config('app.test_empresa','fiscal-a',true),set_config('app.test_local','fiscal-a2',true);
set local role authenticated;
select pg_temp.fiscal_assert(public.abc_fiscal_leer_borrador('fiscal-a','fiscal-a2','20000000-0000-0000-0000-000000000001')->'configuracion'->>'asesoria_nombre'='Asesoría A','Mismo emisor compartido entre locales');
reset role;

select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000002',true),
  set_config('app.test_empresa','fiscal-b',true),set_config('app.test_local','fiscal-b1',true);
set local role authenticated;
select pg_temp.fiscal_assert(public.abc_fiscal_leer_borrador('fiscal-b','fiscal-b1','20000000-0000-0000-0000-000000000002')->>'version'='0','Empresa B empieza sin heredar A');
select pg_temp.fiscal_assert(public.abc_fiscal_guardar_borrador('30000000-0000-0000-0000-000000000001',
 'fiscal-b','fiscal-b1','20000000-0000-0000-0000-000000000002',0,'{"canal":"DIRECTO","representacion":"PROPIO"}')->'configuracion'->>'canal'='DIRECTO','Canal y operación independientes para B');
select pg_temp.fiscal_reject($q$select public.abc_fiscal_leer_borrador('fiscal-a','fiscal-a1','20000000-0000-0000-0000-000000000001')$q$,'FISCAL_CONFIG_NO_AUTORIZADO','B no lee A');
select pg_temp.fiscal_reject($q$select public.abc_fiscal_guardar_borrador('30000000-0000-0000-0000-000000000001','fiscal-a','fiscal-a1','20000000-0000-0000-0000-000000000001',0,'{}')$q$,'FISCAL_CONFIG_NO_AUTORIZADO','B no recupera replay de A');
reset role;

select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000003',true),
  set_config('app.test_empresa','fiscal-a',true),set_config('app.test_local','fiscal-a1',true);
set local role authenticated;
select pg_temp.fiscal_reject($q$select public.abc_fiscal_leer_borrador('fiscal-a','fiscal-a1','20000000-0000-0000-0000-000000000001')$q$,'FISCAL_CONFIG_NO_AUTORIZADO','Cajero no lee datos de configuración');
reset role;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000004',true);
set local role authenticated;
select pg_temp.fiscal_reject($q$select public.abc_fiscal_guardar_borrador('30000000-0000-0000-0000-000000000004','fiscal-a','fiscal-a1','20000000-0000-0000-0000-000000000001',1,'{}')$q$,'FISCAL_CONFIG_NO_AUTORIZADO','Propietario de local no cambia emisor global');
reset role;

select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true);
set local role authenticated;
select pg_temp.fiscal_assert(public.abc_fiscal_guardar_borrador('30000000-0000-0000-0000-000000000004',
 'fiscal-a','fiscal-a1','20000000-0000-0000-0000-000000000001',1,'{"canal":"PROVEEDOR","representacion":"APODERAMIENTO"}')->>'version'='2','Nueva revisión auditada');
select pg_temp.fiscal_reject($q$select * from private.abc_fiscal_borradores$q$,'permission denied','Acceso directo real denegado');
reset role;
select pg_temp.fiscal_assert((select count(*) = 3 from private.abc_fiscal_borrador_revisiones),'Un registro por operación y emisor');
select pg_temp.fiscal_reject($q$update private.abc_fiscal_borrador_revisiones set resultado='{}'$q$,'FISCAL_CONFIG_HISTORIAL_INMUTABLE','Auditoría inmutable');
select pg_temp.fiscal_reject($q$update private.abc_fiscal_borradores set empresa_id='fiscal-b' where empresa_id='fiscal-a'$q$,'FISCAL_CONFIG_ALCANCE_INMUTABLE','Alcance inmutable');
update public.membresias_usuario set activo=false where user_id='10000000-0000-0000-0000-000000000001';
set local role authenticated;
select pg_temp.fiscal_reject($q$select public.abc_fiscal_guardar_borrador('30000000-0000-0000-0000-000000000004','fiscal-a','fiscal-a1','20000000-0000-0000-0000-000000000001',1,'{"canal":"PROVEEDOR","representacion":"APODERAMIENTO"}')$q$,'FISCAL_CONFIG_NO_AUTORIZADO','Revocación también bloquea replay');
reset role;
select set_config('request.jwt.claim.sub','',true);
set local role authenticated;
select pg_temp.fiscal_reject($q$select public.abc_fiscal_leer_borrador('fiscal-a','fiscal-a1','20000000-0000-0000-0000-000000000001')$q$,'FISCAL_CONFIG_NO_AUTORIZADO','Sin identidad no accede');
reset role;
select count(*)::int as fiscal_config_checks from fiscal_checks;
rollback;
