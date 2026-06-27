create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  waiter_name text not null,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_push_subs_waiter on push_subscriptions(waiter_name);
create unique index if not exists idx_push_subs_endpoint on push_subscriptions(endpoint);
alter table push_subscriptions enable row level security;
create policy "poc_insert_push_subs" on push_subscriptions for insert with check (true);
create policy "poc_delete_push_subs" on push_subscriptions for delete using (true);
create policy "poc_read_push_subs" on push_subscriptions for select using (true);
