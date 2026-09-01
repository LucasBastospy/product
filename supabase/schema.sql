-- ============================================================
-- ProductHub — Schema Supabase
-- Cole este script inteiro no SQL Editor do Supabase e execute.
-- ============================================================

-- Remover policies antigas (seguro rodar mesmo na primeira vez)
drop policy if exists "Users can insert their own data" on public.users;
drop policy if exists "Users can read own data" on public.users;
drop policy if exists "Users can update own data" on public.users;
drop policy if exists "Users can insert own progress" on public.user_progress;
drop policy if exists "Users can read own progress" on public.user_progress;
drop policy if exists "Users can delete own progress" on public.user_progress;
drop policy if exists "Users can insert own frameworks" on public.user_frameworks;
drop policy if exists "Users can read own frameworks" on public.user_frameworks;
drop policy if exists "Users can delete own frameworks" on public.user_frameworks;

-- Tabela de usuários (estende auth.users)
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text unique not null,
  cargo text default 'Product Owner',
  level text default 'junior' check (level in ('junior', 'pleno', 'senior', 'lideranca')),
  plan text default 'registered' check (plan in ('registered', 'premium')),
  level_goal text default 'pleno',
  created_at timestamp default now(),
  updated_at timestamp default now()
);

-- Tabela de progresso (conteúdos completados)
create table if not exists public.user_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  content_slug text not null,
  completed_at timestamp default now(),
  unique(user_id, content_slug)
);

-- Tabela de frameworks estudados
create table if not exists public.user_frameworks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  framework_slug text not null,
  studied_at timestamp default now(),
  unique(user_id, framework_slug)
);

-- RLS (Row Level Security) - garantir que cada usuário só vê seus dados
alter table public.users enable row level security;
alter table public.user_progress enable row level security;
alter table public.user_frameworks enable row level security;

-- Policies para tabela users
create policy "Users can insert their own data" on public.users
  for insert with check (auth.uid() = id);

create policy "Users can read own data" on public.users
  for select using (auth.uid() = id);

create policy "Users can update own data" on public.users
  for update using (auth.uid() = id);

-- Policies para tabela user_progress
create policy "Users can insert own progress" on public.user_progress
  for insert with check (auth.uid() = user_id);

create policy "Users can read own progress" on public.user_progress
  for select using (auth.uid() = user_id);

create policy "Users can delete own progress" on public.user_progress
  for delete using (auth.uid() = user_id);

-- Policies para tabela user_frameworks
create policy "Users can insert own frameworks" on public.user_frameworks
  for insert with check (auth.uid() = user_id);

create policy "Users can read own frameworks" on public.user_frameworks
  for select using (auth.uid() = user_id);

create policy "Users can delete own frameworks" on public.user_frameworks
  for delete using (auth.uid() = user_id);
