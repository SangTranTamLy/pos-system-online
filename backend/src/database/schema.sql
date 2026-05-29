create extension if not exists "pgcrypto";

create table if not exists roles (
  id uuid primary key default gen_random_uuid(),
  name varchar(50) not null unique,
  description text,
  created_at timestamp with time zone not null default now()
);

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  full_name varchar(120) not null,
  email varchar(255) not null unique,
  password_hash varchar(255) not null,
  role_id uuid not null references roles(id),
  is_active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  name varchar(120) not null unique,
  description text,
  is_active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references categories(id),
  name varchar(160) not null,
  sku varchar(80) not null unique,
  price numeric(12, 2) not null check (price >= 0),
  description text,
  image_url text,
  is_active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  full_name varchar(120) not null,
  phone varchar(30) not null,
  email varchar(255),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id),
  created_by uuid references users(id),
  order_type varchar(30) not null check (order_type in ('pos', 'online')),
  status varchar(30) not null,
  total_amount numeric(12, 2) not null default 0 check (total_amount >= 0),
  note text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  product_id uuid not null references products(id),
  quantity integer not null check (quantity > 0),
  unit_price numeric(12, 2) not null check (unit_price >= 0),
  line_total numeric(12, 2) not null check (line_total >= 0)
);

create table if not exists inventory (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null unique references products(id) on delete cascade,
  quantity_on_hand integer not null default 0 check (quantity_on_hand >= 0),
  low_stock_threshold integer not null default 5 check (low_stock_threshold >= 0),
  updated_at timestamp with time zone not null default now()
);

create table if not exists pickup_orders (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references orders(id) on delete cascade,
  pickup_time timestamp with time zone,
  pickup_status varchar(30) not null,
  customer_note text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  payment_method varchar(30) not null,
  amount numeric(12, 2) not null check (amount >= 0),
  payment_status varchar(30) not null,
  paid_at timestamp with time zone
);

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id),
  action varchar(120) not null,
  entity_name varchar(120),
  entity_id uuid,
  created_at timestamp with time zone not null default now()
);

create index if not exists idx_products_category_id on products(category_id);
create index if not exists idx_orders_customer_id on orders(customer_id);
create index if not exists idx_orders_status on orders(status);
create index if not exists idx_order_items_order_id on order_items(order_id);
create index if not exists idx_pickup_orders_order_id on pickup_orders(order_id);
create index if not exists idx_audit_logs_user_id on audit_logs(user_id);
