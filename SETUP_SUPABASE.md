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

create policy "Users can read own data" on public.users
  for select using (auth.uid() = id);

create policy "Users can update own data" on public.users
  for update using (auth.uid() = id);

create policy "Users can read own progress" on public.user_progress
  for all using (auth.uid() = user_id);

create policy "Users can read own frameworks" on public.user_frameworks
  for all using (auth.uid() = user_id);
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

**Erro: "Cannot read property 'auth' of undefined"**
- Verificar se supabase.js está carregado DEPOIS de supabase-config.js

**Dados não salvam**
- Verificar RLS policies em Database > Policies
- Abrir DevTools > Console para ver erros

**Login não funciona**
- Verificar se Email Auth está ativado
- Confirmar credenciais em supabase-config.js

---

## 📚 Próximos Passos

1. Testar fluxo completo: Signup → Login → Completar conteúdo → Verificar em DB
2. Implementar sistema de certificação
3. Adicionar gamificação (badges)
4. Configurar pagamento para Premium

