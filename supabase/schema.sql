-- ============================================================
-- Punto 5 — POC schema
-- Run this in the Supabase SQL editor.
-- Object names and comments are in English.
-- Seed data (category/dish names, descriptions) is in Spanish
-- because that is the user-facing language of the app.
-- ============================================================

-- Categories (e.g. Hamburguesas, Salchipapas y Perros, Adicionales)
create table if not exists categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text not null default '',  -- short subtitle shown in POS (e.g. "Hamburguesas artesanales")
  sort_order  int  not null default 0
);

-- Dishes within a category
create table if not exists dishes (
  id           uuid primary key default gen_random_uuid(),
  category_id  uuid not null references categories(id) on delete cascade,
  name         text not null,
  description  text not null default '',
  price        int  not null default 0,   -- price in Colombian pesos
  sort_order   int  not null default 0
);

create index if not exists idx_dishes_category on dishes(category_id);

-- Orders placed by waiters from the POS
create table if not exists orders (
  id              uuid primary key default gen_random_uuid(),
  table_number    int  not null,              -- table number
  waiter_name     text not null,              -- waiter name (no auth in POC)
  status          text not null default 'nueva'
    check (status in ('nueva','en_cocina','lista','servida')),
  total           int  not null default 0,    -- total in pesos
  notes           text,
  created_at      timestamptz not null default now(),
  -- Audit tracking: who last touched this order
  updated_by      text,                        -- name of the last actor
  updated_at      timestamptz,                 -- when it was last updated
  updated_by_type text check (updated_by_type in ('waiter','admin','system'))
);

create index if not exists idx_orders_created on orders(created_at desc);
create index if not exists idx_orders_status  on orders(status);

-- Line items per order
create table if not exists order_items (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references orders(id) on delete cascade,
  dish_id    uuid references dishes(id),
  dish_name     text not null,               -- snapshot of dish name at order time
  price         int  not null,               -- snapshot of price at order time
  quantity      int  not null default 1,
  notes         text                          -- per-item instructions (e.g. "sin cebolla", "extra picante")
);

create index if not exists idx_order_items_order on order_items(order_id);

-- ============================================================
-- Audit trail — every action on an order is logged here.
-- This gives us full traceability: who did what, when, and
-- what changed (from/to for status transitions, metadata for
-- prints and other events).
-- ============================================================
create table if not exists order_events (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references orders(id) on delete cascade,
  event_type  text not null check (event_type in
    ('created','status_changed','printed','updated','cancelled')),
  actor_type  text not null check (actor_type in ('waiter','admin','system')),
  actor_name  text not null,               -- waiter name or 'admin'
  from_status text,                         -- previous status (for status_changed)
  to_status   text,                         -- new status (for status_changed)
  metadata    jsonb not null default '{}',  -- flexible: print count, changed fields, etc.
  created_at  timestamptz not null default now()
);

create index if not exists idx_order_events_order on order_events(order_id, created_at desc);

-- ============================================================
-- Push subscriptions — one waiter can have multiple devices
-- ============================================================
create table if not exists push_subscriptions (
  id            uuid primary key default gen_random_uuid(),
  waiter_name   text not null,                          -- waiter name (links to orders.waiter_name)
  endpoint      text not null,                          -- push service endpoint URL (unique per device/browser)
  p256dh        text not null,                          -- ECDH public key from browser
  auth          text not null,                          -- auth secret from browser
  created_at    timestamptz not null default now()
);

create index if not exists idx_push_subs_waiter on push_subscriptions(waiter_name);
create unique index if not exists idx_push_subs_endpoint on push_subscriptions(endpoint);

-- ============================================================
-- RLS — POC: allow all operations with the anon key.
-- Tighten before production.
--
-- Production RLS should enforce:
--   - Waiters can only UPDATE orders where waiter_name = auth.uid()
--     (i.e. they can only modify orders they created).
--   - Admins can UPDATE any order.
--   - Waiters can only INSERT order_events for their own orders.
-- The app-level check (isOrderOwner in lib/utils.ts) covers this
-- for the POC, but RLS is the real enforcement layer.
-- ============================================================
alter table categories    enable row level security;
alter table dishes        enable row level security;
alter table orders        enable row level security;
alter table order_items   enable row level security;
alter table order_events  enable row level security;
alter table push_subscriptions enable row level security;

create policy "poc_read_categories"  on categories  for select using (true);
create policy "poc_read_dishes"      on dishes      for select using (true);
create policy "poc_read_orders"      on orders      for select using (true);
create policy "poc_insert_orders"    on orders      for insert with check (true);
create policy "poc_update_orders"    on orders      for update using (true);
create policy "poc_read_order_items"   on order_items  for select using (true);
create policy "poc_insert_order_items" on order_items  for insert with check (true);
create policy "poc_update_order_items" on order_items  for update using (true);
create policy "poc_delete_order_items" on order_items  for delete using (true);
create policy "poc_read_order_events"  on order_events for select using (true);
create policy "poc_insert_order_events" on order_events for insert with check (true);
create policy "poc_insert_push_subs" on push_subscriptions for insert with check (true);
create policy "poc_delete_push_subs" on push_subscriptions for delete using (true);
create policy "poc_read_push_subs"   on push_subscriptions for select using (true);

-- ============================================================
-- Realtime — enable publication for the tables we subscribe to
-- ============================================================
alter publication supabase_realtime add table orders;
alter publication supabase_realtime add table order_items;
alter publication supabase_realtime add table order_events;

-- ============================================================
-- Seed data — real menu
-- ============================================================
insert into categories (name, description, sort_order) values
  ('Hamburguesas', 'Todas las hamburguesas incluyen una variedad de ingredientes y salsas específicas', 1),
  ('Salchipapas', 'Papas, salchicha y salsas de la casa', 2),
  ('Perros', 'Long, ripio, queso y salsas de la casa', 3),
  ('Toppings', 'Adiciones para tu pedido', 4)
on conflict do nothing;

-- Hamburguesas
insert into dishes (category_id, name, description, price, sort_order)
select c.id, d.name, d.description, d.price, d.sort_order
from (values
  ('Sencilla',      'Carne de res, lechuga, ripio, queso mozzarella, salsas (tomate, mostaza, tártara) y papas a la francesa', 5000, 1),
  ('Mexicana',      'Carne de res, jalapeño ají vasco, lechuga, ripio, queso mozzarella y salsas (tártara, tomate, mostaza)', 6000, 2),
  ('Pollo',         'Carne de pollo, lechuga, ripio, queso mozzarella y salsas (tártara, tomate, mostaza)', 6000, 3),
  ('Doble Carne',   'Doble carne de res, jamón, tocineta, ripio, lechuga, queso mozzarella, salsas (tártara, tomate, mostaza) y papas a la francesa', 12000, 4),
  ('Salchiburguer', 'Carne de res, lechuga, ripio, queso mozzarella, papa a la francesa, queso costeño y salsas (tártara, tomate, mostaza, piña)', 10000, 5)
) as d(name, description, price, sort_order)
cross join categories c
where c.name = 'Hamburguesas'
on conflict do nothing;

-- Salchipapas
insert into dishes (category_id, name, description, price, sort_order)
select c.id, d.name, d.description, d.price, d.sort_order
from (values
  ('Salchipapa', 'Papa a la francesa, salchicha, queso costeño, lechuga, papa ripio y salsas (tomate, tártara, piña)', 5000, 1)
) as d(name, description, price, sort_order)
cross join categories c
where c.name = 'Salchipapas'
on conflict do nothing;

-- Perros
insert into dishes (category_id, name, description, price, sort_order)
select c.id, d.name, d.description, d.price, d.sort_order
from (values
  ('Sencillo',     'Long (salchicha), ripio, queso mozzarella y salsas (tártara, tomate, mostaza)', 5000, 1),
  ('Planchiperro', 'Long (salchicha), carne de res, lechuga, ripio, queso costeño, queso mozzarella y salsas (tártara, piña, tomate)', 10000, 2),
  ('Salchidog',    'Long (salchicha), ripio, lechuga, papas a la francesa, salchicha, queso costeño, queso mozzarella y salsas (tártara, piña, mostaza, tomate)', 10000, 3)
) as d(name, description, price, sort_order)
cross join categories c
where c.name = 'Perros'
on conflict do nothing;

-- Toppings (Adiciones)
insert into dishes (category_id, name, description, price, sort_order)
select c.id, d.name, d.description, d.price, d.sort_order
from (values
  ('Huevo Frito',           'Huevo frito adicional', 1000, 1),
  ('Jamón',                 'Jamón adicional', 1500, 2),
  ('Queso Mozzarella',      'Queso mozzarella adicional', 1500, 3),
  ('Tocineta',              'Tocineta adicional', 1500, 4),
  ('Cebolla Caramelizada',  'Cebolla caramelizada adicional', 1500, 5),
  ('Carne',                 'Carne adicional', 3000, 6),
  ('Pollo',                 'Pollo adicional', 3000, 7),
  ('Mexicana',              'Mexicana adicional', 3000, 8),
  ('Porción de Papas',      'Porción de papas a la francesa', 3000, 9)
) as d(name, description, price, sort_order)
cross join categories c
where c.name = 'Toppings'
on conflict do nothing;
