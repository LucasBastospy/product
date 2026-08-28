# App.js — Guia de Integração Supabase

## 📌 Visão Geral

O `app.js` precisa ser atualizado para usar Supabase ao invés de localStorage. As mudanças afetam:

1. **Funções de autenticação** (`login`, `signup`, `logout`)
2. **Estado do usuário** (getUser, isLoggedIn, isPremium, etc)
3. **Progresso** (getCompleted, toggleCompleted, etc)
4. **Frameworks** (markFrameworkStudied, getStudiedFrameworks)

---

## 🔄 Estratégia de Integração

Vamos fazer **DOIS passes**:

### Pass 1: Autenticação (Páginas: login.html, cadastro.html)
- Remover localStorage.setItem/getItem de auth
- Chamar `PH_Supabase.signup()` e `PH_Supabase.login()`
- Guardar token JWT localmente para próximas sessões

### Pass 2: Dados do Usuário (Todas as páginas)
- Substituir `readJSON()` → `await PH_Supabase.getCompleted()`
- Substituir `writeJSON()` → `await PH_Supabase.toggleCompleted()`
- Manter cache local para performance

---

## 📝 Mudanças Específicas

### 1. Remover localStorage puro

**ANTES:**
```javascript
var LS = {
  USER: "ph_user",
  COMPLETED: "ph_completed_content",
  STUDIED_FW: "ph_studied_frameworks",
  LEVEL_GOAL: "ph_level_goal",
  SEEDED: "ph_seeded"
};

function readJSON(key, fallback) {
  try { var v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
  catch (e) { return fallback; }
}
```

**DEPOIS:**
```javascript
// Remover essas funções — usar PH_Supabase diretamente
```

---

### 2. Função getUser()

**ANTES:**
```javascript
function getUser() { 
  return readJSON(LS.USER, null); 
}
```

**DEPOIS:**
```javascript
function getUser() { 
  return PH_Supabase.getUser(); 
}
```

---

### 3. Função login()

**ANTES:**
```javascript
function login(email, name) {
  var existing = getUser();
  var user = {
    name: name || (existing && existing.name) || (email ? email.split("@")[0] : "Usuário"),
    email: email || (existing && existing.email) || "usuario@exemplo.com",
    cargo: (existing && existing.cargo) || "Product Owner",
    level: (existing && existing.level) || "pleno",
    plan: (existing && existing.plan) || "registered"
  };
  writeJSON(LS.USER, user);
  seedProgressIfNeeded();
  return user;
}
```

**DEPOIS:**
```javascript
async function login(email, password) {
  try {
    var user = await PH_Supabase.login(email, password);
    seedProgressIfNeeded();
    return user;
  } catch (e) {
    toast("Erro ao fazer login: " + e.message, "❌");
    throw e;
  }
}

// Chamar em login.html
document.getElementById('loginForm').addEventListener('submit', async function (e) {
  e.preventDefault();
  var email = $('#emailInput').value;
  var password = $('#passwordInput').value;
  try {
    var user = await login(email, password);
    window.location.href = 'dashboard.html';
  } catch (e) {
    console.error(e);
  }
});
```

---

### 4. Função signup()

**ANTES:**
```javascript
function signup(data) {
  var user = {
    name: data.name || "Usuário",
    email: data.email || "usuario@exemplo.com",
    cargo: data.cargo || "Product Owner",
    level: data.level || "junior",
    plan: "registered"
  };
  writeJSON(LS.USER, user);
  writeJSON(LS.LEVEL_GOAL, data.level || "pleno");
  seedProgressIfNeeded();
  return user;
}
```

**DEPOIS:**
```javascript
async function signup(data) {
  try {
    var user = await PH_Supabase.signup({
      name: data.name || "Usuário",
      email: data.email || "usuario@exemplo.com",
      cargo: data.cargo || "Product Owner",
      level: data.level || "junior",
      password: data.password // NECESSÁRIO para Supabase Auth
    });
    return user;
  } catch (e) {
    toast("Erro ao registrar: " + e.message, "❌");
    throw e;
  }
}

// Chamar em cadastro.html
document.getElementById('signupForm').addEventListener('submit', async function (e) {
  e.preventDefault();
  var data = {
    name: $('#nameInput').value,
    email: $('#emailInput').value,
    password: $('#passwordInput').value,
    cargo: $('#cargoInput').value,
    level: $('#levelInput').value
  };
  try {
    await signup(data);
    window.location.href = 'escolha-nivel.html';
  } catch (e) {
    console.error(e);
  }
});
```

---

### 5. Função getCompleted()

**ANTES:**
```javascript
function getCompleted() { 
  return readJSON(LS.COMPLETED, []); 
}
```

**DEPOIS:**
```javascript
var __completedCache = [];
var __cachedAt = 0;

async function getCompleted() { 
  // Retornar cache se < 1min old
  if (Date.now() - __cachedAt < 60000) {
    return __completedCache;
  }
  
  __completedCache = await PH_Supabase.getCompleted();
  __cachedAt = Date.now();
  return __completedCache;
}
```

---

### 6. Função toggleCompleted()

**ANTES:**
```javascript
function toggleCompleted(slug) {
  var list = getCompleted();
  var i = list.indexOf(slug);
  if (i === -1) list.push(slug); else list.splice(i, 1);
  writeJSON(LS.COMPLETED, list);
  return list.indexOf(slug) !== -1;
}
```

**DEPOIS:**
```javascript
async function toggleCompleted(slug) {
  var result = await PH_Supabase.toggleCompleted(slug);
  
  // Atualizar cache
  if (result) {
    __completedCache.push(slug);
  } else {
    var i = __completedCache.indexOf(slug);
    if (i !== -1) __completedCache.splice(i, 1);
  }
  
  return result;
}

// Chamar com evento em click de "Marcar como concluído"
document.getElementById('markCompleteBtn').addEventListener('click', async function () {
  var contentSlug = qs('slug');
  var newState = await toggleCompleted(contentSlug);
  toast(newState ? "✓ Conteúdo marcado como concluído!" : "Conteúdo desmarcado");
  location.reload(); // ou atualizar UI
});
```

---

### 7. Função markFrameworkStudied()

**ANTES:**
```javascript
function markFrameworkStudied(slug) {
  var list = readJSON(LS.STUDIED_FW, []);
  if (list.indexOf(slug) === -1) { 
    list.push(slug); 
    writeJSON(LS.STUDIED_FW, list); 
  }
}
```

**DEPOIS:**
```javascript
async function markFrameworkStudied(slug) {
  await PH_Supabase.markFrameworkStudied(slug);
  // Cache será atualizado na próxima chamada
}

// Chamar ao visualizar um framework
document.addEventListener('DOMContentLoaded', async function () {
  var frameworkSlug = qs('slug');
  if (frameworkSlug) {
    await markFrameworkStudied(frameworkSlug);
  }
});
```

---

## ⚙️ Inicialização Global

No topo do `mountLayout()`, adicione:

```javascript
function mountLayout(activeKey) {
  // Garantir que Supabase está pronto
  if (!window.PH_Supabase) {
    console.error("Supabase não carregado");
    return;
  }
  
  // Restaurar sessão se necessário
  if (!getUser() && localStorage.getItem('supabase_session')) {
    // TODO: restaurar do JWT
  }
  
  // ... resto do código
}
```

---

## 🧪 Testing Checklist

- [ ] Criar conta funciona (verifica em Supabase > users table)
- [ ] Login funciona
- [ ] Logout funciona
- [ ] Completar conteúdo persiste (refresh page)
- [ ] Múltiplos devices sincronizam (log com mesmo email)
- [ ] Upgrade para Premium funciona

---

## 💡 Próxima Fase

1. Implementar forgot password via Supabase Auth
2. Adicionar certificação (nova tabela: user_certificates)
3. Implementar gamificação (badges, pontos)

