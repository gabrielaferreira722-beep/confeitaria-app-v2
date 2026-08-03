-- Schema do MVP de precificação da confeitaria
-- Rode este arquivo no SQL Editor do seu projeto Supabase

create extension if not exists "uuid-ossp";

-- ========== INGREDIENTES ==========
create table if not exists ingredients (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  unit text not null check (unit in ('kg', 'g', 'litro', 'ml', 'unidade')),
  qty_bought numeric not null check (qty_bought > 0),
  value_paid numeric not null check (value_paid >= 0),
  supplier text,
  purchase_date date not null default current_date,
  -- custo por unidade base (g, ml ou unidade), calculado no momento do salvamento
  cost_per_base numeric generated always as (
    value_paid / case
      when unit in ('kg', 'litro') then qty_bought * 1000
      else qty_bought
    end
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Histórico de alteração de preço por ingrediente
create table if not exists price_history (
  id uuid primary key default uuid_generate_v4(),
  ingredient_id uuid not null references ingredients(id) on delete cascade,
  price_per_base numeric not null,
  recorded_at timestamptz not null default now()
);

-- ========== RECEITAS / PRODUTOS ==========
create table if not exists recipes (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  yield_qty numeric not null check (yield_qty > 0), -- rendimento em unidades
  packaging_cost numeric not null default 0, -- custo de embalagem por unidade
  gas_cost numeric not null default 0,       -- custo de gás por unidade
  energy_cost numeric not null default 0,    -- custo de energia por unidade
  labor_cost numeric not null default 0,     -- custo de mão de obra por unidade
  target_margin_pct numeric not null default 50, -- margem desejada sobre o custo
  promotion_type text not null default 'none' check (promotion_type in ('none', 'percent', 'value')),
  promotion_value numeric not null default 0, -- desconto em % ou em R$, conforme promotion_type
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists recipe_ingredients (
  id uuid primary key default uuid_generate_v4(),
  recipe_id uuid not null references recipes(id) on delete cascade,
  ingredient_id uuid not null references ingredients(id) on delete restrict,
  qty_used numeric not null check (qty_used > 0) -- na unidade base do ingrediente (g/ml/un)
);

-- ========== CANAIS DE VENDA ==========
create table if not exists channels (
  id uuid primary key default uuid_generate_v4(),
  key text not null unique, -- 'presencial' | 'ifood' | '99food' | 'keeta'
  name text not null,
  commission_pct numeric not null default 0,
  extra_fee numeric not null default 0,
  created_at timestamptz not null default now()
);

insert into channels (key, name, commission_pct, extra_fee) values
  ('presencial', 'Presencial', 0, 0),
  ('ifood', 'iFood', 0, 0),
  ('99food', '99Food', 0, 0),
  ('keeta', 'Keeta', 0, 0)
on conflict (key) do nothing;

-- ========== TRIGGERS ==========
-- Atualiza updated_at antes de salvar
create or replace function fn_touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_ingredient_touch_updated_at on ingredients;
create trigger trg_ingredient_touch_updated_at
  before update on ingredients
  for each row execute function fn_touch_updated_at();

-- Registra no histórico de preço DEPOIS que o ingrediente já existe (evita violar a chave estrangeira)
create or replace function fn_ingredient_price_history_after()
returns trigger as $$
begin
  if (tg_op = 'INSERT') or (new.value_paid <> old.value_paid or new.qty_bought <> old.qty_bought or new.unit <> old.unit) then
    insert into price_history (ingredient_id, price_per_base)
    values (
      new.id,
      new.value_paid / case when new.unit in ('kg', 'litro') then new.qty_bought * 1000 else new.qty_bought end
    );
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_ingredient_price_history_after on ingredients;
create trigger trg_ingredient_price_history_after
  after insert or update on ingredients
  for each row execute function fn_ingredient_price_history_after();

-- ========== RLS (uso interno — ajuste conforme sua necessidade de autenticação) ==========
alter table ingredients enable row level security;
alter table price_history enable row level security;
alter table recipes enable row level security;
alter table recipe_ingredients enable row level security;
alter table channels enable row level security;

-- Política aberta para uso interno com a chave anon (MVP de uso interno na loja).
-- Se for expor publicamente no futuro, troque por políticas com auth.uid().
create policy "internal access ingredients" on ingredients for all using (true) with check (true);
create policy "internal access price_history" on price_history for all using (true) with check (true);
create policy "internal access recipes" on recipes for all using (true) with check (true);
create policy "internal access recipe_ingredients" on recipe_ingredients for all using (true) with check (true);
create policy "internal access channels" on channels for all using (true) with check (true);
