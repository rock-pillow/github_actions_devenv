revoke all on table
  public.sl_workspaces,
  public.sl_projects,
  public.sl_changes,
  public.sl_history,
  public.sl_orders,
  public.sl_events,
  public.sl_limits,
  public.sl_config
from anon, authenticated;

grant all on table
  public.sl_workspaces,
  public.sl_projects,
  public.sl_changes,
  public.sl_history,
  public.sl_orders,
  public.sl_events,
  public.sl_limits,
  public.sl_config
to service_role;

revoke all on function public.sl_api(text, jsonb, text) from public, anon, authenticated;
grant execute on function public.sl_api(text, jsonb, text) to service_role;

revoke all on function public.sl_fulfill(text, uuid, text) from public, anon, authenticated;
grant execute on function public.sl_fulfill(text, uuid, text) to service_role;

grant usage, select on all sequences in schema public to service_role;
