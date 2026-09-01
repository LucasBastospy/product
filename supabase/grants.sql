-- ============================================================
-- ProductHub — Grants para a API REST (PostgREST)
-- Necessário pois criar tabelas via SQL Editor não concede
-- automaticamente acesso às roles anon/authenticated.
-- A segurança de linha continua garantida pelas RLS policies.
-- ============================================================

grant usage on schema public to anon, authenticated;

grant select, insert, update, delete on public.users to anon, authenticated;
grant select, insert, update, delete on public.user_progress to anon, authenticated;
grant select, insert, update, delete on public.user_frameworks to anon, authenticated;

-- Forçar o PostgREST a recarregar o cache de schema
notify pgrst, 'reload schema';
