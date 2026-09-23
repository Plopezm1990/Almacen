-- ABC F2 M01b — hardening ACL de la base transaccional y caja.
-- Compensatoria y no destructiva: corrige privilegios heredados por DEFAULT PRIVILEGES.
-- No modifica datos, RLS, RPC legacy, stock ni arqueos_caja.

revoke all privileges
on table
  public.terminales_tpv,
  public.abc_operaciones,
  public.abc_eventos,
  public.cajas_fisicas,
  public.caja_sesiones,
  public.caja_sesion_terminales,
  public.caja_cierres,
  public.caja_conteos,
  public.efectos_pendientes
from anon, authenticated;

grant select
on table
  public.terminales_tpv,
  public.cajas_fisicas,
  public.caja_sesiones,
  public.caja_sesion_terminales,
  public.caja_cierres,
  public.caja_conteos
to authenticated;

revoke all privileges
on sequence public.abc_eventos_id_seq
from anon, authenticated;
