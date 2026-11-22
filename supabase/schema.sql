-- Receitas que usam outras receitas (rode UMA vez no SQL Editor do Supabase)

-- 1) Unidade do rendimento: un (unidades), g ou ml
alter table recipes
  add column if not exists yield_unit text not null default 'un';

alter table recipes drop constraint if exists recipes_yield_unit_check;
alter table recipes
  add constraint recipes_yield_unit_check check (yield_unit in ('un', 'g', 'ml'));

-- 2) Tabela que liga uma receita às receitas usadas dentro dela
create table if not exists recipe_components (
  id uuid primary key default uuid_generate_v4(),
  recipe_id uuid not null references recipes(id) on delete cascade,
  component_recipe_id uuid not null references recipes(id) on delete restrict,
  qty_used numeric not null check (qty_used > 0), -- na unidade de rendimento da receita usada (g, ml ou un)
  check (recipe_id <> component_recipe_id)
);

alter table recipe_components enable row level security;

drop policy if exists "internal access recipe_components" on recipe_components;
create policy "internal access recipe_components"
  on recipe_components for all using (true) with check (true);
