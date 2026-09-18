alter table public.sl_orders
  add column if not exists subscription_id text,
  add column if not exists customer_id text,
  add column if not exists subscription_status text;

create unique index if not exists sl_orders_subscription_id_uidx
  on public.sl_orders(subscription_id)
  where subscription_id is not null;

create or replace function public.sl_fulfill_subscription(
  event_id text,
  order_id uuid,
  checkout_id text,
  subscription_id text,
  customer_id text,
  period_end timestamptz
) returns text
language plpgsql
set search_path = public
as $$
declare
  o public.sl_orders;
  entitlement_end timestamptz;
begin
  if exists(select 1 from public.sl_events where id = event_id) then return 'duplicate'; end if;
  select * into o from public.sl_orders where id = order_id for update;
  if o.id is null then raise exception 'Order missing'; end if;
  entitlement_end := coalesce(period_end, now() + interval '30 days');
  update public.sl_orders
     set paid_at = coalesce(paid_at, now()),
         session_id = checkout_id,
         subscription_id = coalesce(sl_fulfill_subscription.subscription_id, sl_orders.subscription_id),
         customer_id = coalesce(sl_fulfill_subscription.customer_id, sl_orders.customer_id),
         subscription_status = 'active'
   where id = o.id;
  update public.sl_workspaces
     set paid_until = greatest(coalesce(paid_until, now()), entitlement_end)
   where id = o.workspace_id;
  insert into public.sl_events(id) values(event_id);
  return 'fulfilled';
end;
$$;

create or replace function public.sl_renew_subscription(event_id text, subscription_id text, period_end timestamptz)
returns text language plpgsql set search_path=public as $$
declare o public.sl_orders; entitlement_end timestamptz;
begin
  if exists(select 1 from public.sl_events where id=event_id) then return 'duplicate'; end if;
  select * into o from public.sl_orders
   where sl_orders.subscription_id=sl_renew_subscription.subscription_id
   order by created_at desc limit 1 for update;
  if o.id is null then raise exception 'Subscription missing'; end if;
  entitlement_end:=coalesce(period_end,now()+interval '30 days');
  update public.sl_orders set subscription_status='active' where id=o.id;
  update public.sl_workspaces set paid_until=greatest(coalesce(paid_until,now()),entitlement_end) where id=o.workspace_id;
  insert into public.sl_events(id) values(event_id);
  return 'renewed';
end;
$$;

create or replace function public.sl_mark_subscription_cancelled(event_id text, subscription_id text)
returns text language plpgsql set search_path=public as $$
declare o public.sl_orders;
begin
  if exists(select 1 from public.sl_events where id=event_id) then return 'duplicate'; end if;
  select * into o from public.sl_orders
   where sl_orders.subscription_id=sl_mark_subscription_cancelled.subscription_id
   order by created_at desc limit 1 for update;
  if o.id is null then raise exception 'Subscription missing'; end if;
  update public.sl_orders set subscription_status='cancelled' where id=o.id;
  insert into public.sl_events(id) values(event_id);
  return 'cancelled';
end;
$$;

revoke all on function public.sl_fulfill_subscription(text,uuid,text,text,text,timestamptz) from public,anon,authenticated;
revoke all on function public.sl_renew_subscription(text,text,timestamptz) from public,anon,authenticated;
revoke all on function public.sl_mark_subscription_cancelled(text,text) from public,anon,authenticated;
grant execute on function public.sl_fulfill_subscription(text,uuid,text,text,text,timestamptz) to service_role;
grant execute on function public.sl_renew_subscription(text,text,timestamptz) to service_role;
grant execute on function public.sl_mark_subscription_cancelled(text,text) to service_role;
