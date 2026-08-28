# ProductHub + Supabase Migration Guide

## 📋 Resumo da Migração

Este guia descreve como migrar o ProductHub do localStorage para Supabase, removendo a dependência de dados mockados e habilitando persistência real de dados.

---

## 🎯 O que muda?

### Antes (localStorage)
```
- Dados do usuário → localStorage (ph_user)
- Progresso → localStorage (ph_completed_content)
- Frameworks estudados → localStorage (ph_studied_frameworks)
- Tudo perdido ao limpar cache/trocar device
```

### Depois (Supabase)
```
- Autenticação real com JWT
- Banco de dados persistente (todos os dados sincronizados)
- Funciona em múltiplos devices
- Pronto para escala
```

---

## 📦 Pré-requisitos

- Conta no Supabase (https://supabase.com) — GRATUITO
- Editor de código (VS Code)
- Terminal/PowerShell

---

## 🚀 Passo 1: Criar Projeto Supabase

1. Acesse https://supabase.com e crie uma conta
2. Clique em "New Project"
3. Preencha:
   - **Project Name**: `producthub`
   - **Database Password**: Crie uma senha forte (salve!)
   - **Region**: Escolha mais perto de seus usuários (ex: South America)
4. Aguarde a criação (2-3 minutos)
5. Copie as credenciais em **Settings > API**:
   - `SUPABASE_URL` (Project URL)
   - `SUPABASE_ANON_KEY` (anon public key)

---

## 🗂️ Passo 2: Criar Tabelas no Banco

No Supabase Dashboard, abra **SQL Editor** e execute este script:

⚠️ **Se você já executou o script anterior**, primeiro **remova as policies antigas**:

```sql
-- Remover policies antigas (execute isso primeiro se já tinha criado)
drop policy if exists "Users can read own data" on public.users;
drop policy if exists "Users can update own data" on public.users;
drop policy if exists "Users can read own progress" on public.user_progress;
drop policy if exists "Users can read own frameworks" on public.user_frameworks;
```

Agora execute o script completo com as **policies corrigidas**:

```sql
-- Tabela de usuários (estende auth.users)
create table public.users (
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
create table public.user_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  content_slug text not null,
  completed_at timestamp default now(),
  unique(user_id, content_slug)
);

-- Tabela de frameworks estudados
create table public.user_frameworks (
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
```

---

## 🔐 Passo 3: Configurar Autenticação

1. Em **Authentication > Providers**, ative:
   - ✅ Email (padrão)
   
2. Em **Email Templates**, customize se necessário

3. Em **Settings > General**, copie:
   - Site URL: `http://localhost:8000` (dev) ou seu domínio (prod)

---

## 📝 Passo 4: Adicionar Credenciais ao Projeto

Crie arquivo `assets/js/supabase-config.js`:

```javascript
// Copie suas credenciais do Supabase Dashboard (Settings > API)
const SUPABASE_URL = 'https://seu-projeto.supabase.co';
const SUPABASE_ANON_KEY = 'sua-chave-anonima-aqui';
```

---

## 🔌 Passo 5: Carregar Supabase SDK

No `index.html` (e todas as páginas que usam app.js), adicione ANTES de app.js:

```html
<!-- Supabase Client -->
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="assets/js/supabase-config.js"></script>
<script src="assets/js/supabase.js"></script>

<!-- Data Layer -->
<script src="assets/js/data.js"></script>

<!-- App Shell -->
<script src="assets/js/app.js"></script>
```

---

## ✅ Checklist Final

- [ ] Projeto Supabase criado
- [ ] Tabelas SQL executadas
- [ ] Credenciais copiadas
- [ ] supabase-config.js criado
- [ ] supabase.js adicionado ao projeto
- [ ] Scripts carregados em HTML
- [ ] Teste: Criar conta e verificar se dados salvam em `Table Editor > users`

---

## 🆘 Troubleshooting

**"Conta criada com sucesso" mas dados não aparecem no banco**
- Isso significa que as RLS policies estão bloqueando a inserção
- **Solução**: Execute o script de drop policies e recrie com as policies atualizadas
- Após fazer isso, tente criar conta novamente
- Verifique em Supabase > **Database > Policies** e confirme que existem policies de INSERT

**Erro: "Cannot read property 'auth' of undefined"**
- Verificar se supabase.js está carregado DEPOIS de supabase-config.js
- Abrir DevTools > Console e procurar por erros

**Dados não salvam em user_progress ou user_frameworks**
- Verificar RLS policies em Database > Policies
- Abrir DevTools > Console para ver erros específicos
- Confirmar que existem policies de INSERT para essas tabelas

**Login não funciona**
- Verificar se Email Auth está ativado em **Authentication > Providers**
- Confirmar credenciais em supabase-config.js
- Verificar se o email foi confirmado (Supabase envia email de confirmation)

**Como verificar se as policies estão corretas:**
1. Abra Supabase Dashboard
2. Vá em **Database > Policies**
3. Selecione tabela **users**
4. Confirme que existem 3 policies: INSERT, SELECT, UPDATE
5. Repita para tabelas **user_progress** e **user_frameworks**

---

## 📚 Próximos Passos

1. Testar fluxo completo: Signup → Login → Completar conteúdo → Verificar em DB
2. Implementar sistema de certificação
3. Adicionar gamificação (badges)
4. Configurar pagamento para Premium

