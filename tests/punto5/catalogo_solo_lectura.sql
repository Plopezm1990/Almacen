-- Punto 5 — catálogo de procedencia (SOLO LECTURA)
-- Ejecutar independientemente contra PROD y QA. No contiene DDL ni DML.

WITH funcs AS (
  SELECT jsonb_agg(jsonb_build_object(
    'schema', n.nspname, 'name', p.proname,
    'identity_args', pg_get_function_identity_arguments(p.oid),
    'definition_md5', md5(pg_get_functiondef(p.oid)),
    'security_definer', p.prosecdef, 'owner', r.rolname,
    'execute_anon', has_function_privilege('anon', p.oid, 'EXECUTE'),
    'execute_authenticated', has_function_privilege('authenticated', p.oid, 'EXECUTE'),
    'execute_public', has_function_privilege('public', p.oid, 'EXECUTE')
  ) ORDER BY n.nspname,p.proname,pg_get_function_identity_arguments(p.oid)) data
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_roles r ON r.oid=p.proowner
  WHERE n.nspname IN ('public','private') AND p.prokind='f'
),
tables AS (
  SELECT jsonb_agg(jsonb_build_object(
    'schema',n.nspname,'name',c.relname,
    'rls_enabled',c.relrowsecurity,'rls_forced',c.relforcerowsecurity,'owner',r.rolname,
    'anon',jsonb_build_object('select',has_table_privilege('anon',c.oid,'SELECT'),'insert',has_table_privilege('anon',c.oid,'INSERT'),'update',has_table_privilege('anon',c.oid,'UPDATE'),'delete',has_table_privilege('anon',c.oid,'DELETE')),
    'authenticated',jsonb_build_object('select',has_table_privilege('authenticated',c.oid,'SELECT'),'insert',has_table_privilege('authenticated',c.oid,'INSERT'),'update',has_table_privilege('authenticated',c.oid,'UPDATE'),'delete',has_table_privilege('authenticated',c.oid,'DELETE')),
    'public',jsonb_build_object('select',has_table_privilege('public',c.oid,'SELECT'),'insert',has_table_privilege('public',c.oid,'INSERT'),'update',has_table_privilege('public',c.oid,'UPDATE'),'delete',has_table_privilege('public',c.oid,'DELETE'))
  ) ORDER BY n.nspname,c.relname) data
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_roles r ON r.oid=c.relowner
  WHERE n.nspname IN ('public','private') AND c.relkind IN ('r','p')
),
policies AS (
  SELECT jsonb_agg(jsonb_build_object(
    'schema',n.nspname,'table',c.relname,'name',pol.polname,'command',pol.polcmd,
    'roles',ARRAY(SELECT rolname FROM pg_roles WHERE oid=ANY(pol.polroles) ORDER BY rolname),
    'using_md5',md5(COALESCE(pg_get_expr(pol.polqual,pol.polrelid),'')),
    'check_md5',md5(COALESCE(pg_get_expr(pol.polwithcheck,pol.polrelid),''))
  ) ORDER BY n.nspname,c.relname,pol.polname) data
  FROM pg_policy pol JOIN pg_class c ON c.oid=pol.polrelid JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname IN ('public','private')
),
views AS (
  SELECT jsonb_agg(jsonb_build_object(
    'schema',n.nspname,'name',c.relname,'definition_md5',md5(pg_get_viewdef(c.oid,true)),
    'security_invoker',COALESCE(c.reloptions::text LIKE '%security_invoker=true%',false),'owner',r.rolname
  ) ORDER BY n.nspname,c.relname) data
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_roles r ON r.oid=c.relowner
  WHERE n.nspname IN ('public','private') AND c.relkind='v'
),
triggers AS (
  SELECT jsonb_agg(jsonb_build_object(
    'schema',n.nspname,'table',c.relname,'name',t.tgname,'definition_md5',md5(pg_get_triggerdef(t.oid,true))
  ) ORDER BY n.nspname,c.relname,t.tgname) data
  FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE NOT t.tgisinternal AND n.nspname IN ('public','private')
)
SELECT jsonb_build_object(
  'functions',COALESCE((SELECT data FROM funcs),'[]'::jsonb),
  'tables',COALESCE((SELECT data FROM tables),'[]'::jsonb),
  'policies',COALESCE((SELECT data FROM policies),'[]'::jsonb),
  'views',COALESCE((SELECT data FROM views),'[]'::jsonb),
  'triggers',COALESCE((SELECT data FROM triggers),'[]'::jsonb)
) catalog;
