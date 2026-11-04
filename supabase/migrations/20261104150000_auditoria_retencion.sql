-- Retención automática de audit_logs (pedido del dueño, 2026-11-04): la tabla crece sin límite
-- (cada alta/edición/borrado de catálogo, pago o venta escribe ahí) y no tiene por qué guardarse
-- para siempre. pg_cron la limpia una vez al mes; audit_logs_stats() deja medir el efecto (total,
-- fecha más vieja, cuántas filas se borrarían en la próxima corrida) antes de que exista la
-- pantalla de Auditoría (E2.8), que podrá mostrar esos mismos números.

create extension if not exists pg_cron;

create or replace function public.audit_logs_stats()
returns table (total bigint, oldest timestamptz, pending_cleanup bigint)
language sql
security definer
set search_path = public
as $$
  select
    count(*)::bigint as total,
    min(created_at) as oldest,
    count(*) filter (where created_at < now() - interval '3 months')::bigint as pending_cleanup
  from public.audit_logs;
$$;

comment on function public.audit_logs_stats() is
  'Conteo y antigüedad de audit_logs para la pantalla de Auditoría (E2.8) y para vigilar la retención.';

grant execute on function public.audit_logs_stats() to authenticated;

create or replace function public.cleanup_audit_logs()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.audit_logs where created_at < now() - interval '3 months';
$$;

comment on function public.cleanup_audit_logs() is
  'Borra audit_logs de más de 3 meses. La llama el job de cron "cleanup_audit_logs", no el navegador.';

-- Solo el scheduler (ejecuta como el rol que corrió la migración) necesita llamarla.
revoke all on function public.cleanup_audit_logs() from public, anon, authenticated;

select cron.schedule('cleanup_audit_logs', '0 3 1 * *', 'select public.cleanup_audit_logs();');
