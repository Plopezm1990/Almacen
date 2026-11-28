-- Definición LEÍDA del servidor de QA el 27/11/2026 (hallazgo H-06). NO es una migración.
-- La tabla existe en QA y NO tiene ninguna migración en supabase/migrations: producción no la tiene.
-- Se guarda aquí para que el vale regalo (abc_emitir_vale_regalo, abc_consultar_vale_regalo y
-- abc_confirmar_pago_vale_regalo) se pueda reproducir y revisar. Para llevarlo a producción hace falta una
-- migración propia con esta definición y su contrato.
--
-- Estado en QA: RLS activada (sin forzar) y SIN políticas; `authenticated` y `anon` sin privilegios sobre la
-- tabla. El acceso es solo a través de las funciones SECURITY DEFINER. 2 filas el 27/11/2026.

create table public.abc_vales_regalo (
  id uuid not null default gen_random_uuid(),
  empresa_id text not null,
  local_id text not null,
  codigo text not null,
  importe_inicial numeric not null,
  saldo_actual numeric not null,
  estado text not null default 'ACTIVO'::text,
  currency_code text not null default 'EUR'::text,
  emitido_por uuid not null,
  emitido_operation_id text not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint abc_vales_regalo_pkey primary key (id),
  constraint abc_vale_regalo_codigo_uq unique (empresa_id, codigo),
  constraint abc_vale_regalo_estado check ((estado = any (array['ACTIVO'::text, 'AGOTADO'::text, 'ANULADO'::text]))),
  constraint abc_vale_regalo_importe check ((importe_inicial > (0)::numeric)),
  constraint abc_vale_regalo_moneda check ((currency_code ~ '^[A-Z]{3}$'::text)),
  constraint abc_vale_regalo_saldo check (((saldo_actual >= (0)::numeric) and (saldo_actual <= importe_inicial)))
);

alter table public.abc_vales_regalo enable row level security;
