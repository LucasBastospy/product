/* =========================================================
   ProductHub — App shell (navegação, auth mockado, modais,
   busca global, helpers de renderização e progresso).
   Tudo client-side / mockado — pronto para futura integração
   com backend real (ver comentários "FUTURO:").
   ========================================================= */

(function (global) {
  "use strict";

  var D = global.PH; // data layer (data.js)
  var LS = {
    USER: "ph_user",
    COMPLETED: "ph_completed_content",
    STUDIED_FW: "ph_studied_frameworks",
    LEVEL_GOAL: "ph_level_goal",
    SEEDED: "ph_seeded"
  };

  /* ------------------------- helpers ------------------------- */
  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $all(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }
  function escapeHtml(str) {
    return String(str == null ? "" : str).replace(/[&<>"']/g, function (c) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c];
    });
  }
  function qs(name) {
    var params = new URLSearchParams(window.location.search);
    return params.get(name);
  }
  function readJSON(key, fallback) {
    try { var v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
    catch (e) { return fallback; }
  }
  function writeJSON(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {} }
  function initials(name) {
    if (!name) return "?";
    var parts = name.trim().split(/\s+/);
    return ((parts[0] || "")[0] || "").toUpperCase() + ((parts[1] || "")[0] || "").toUpperCase();
  }

  /* ------------------------- state (mock auth) ------------------------- */
  function getUser() { return readJSON(LS.USER, null); }
  function isLoggedIn() { return !!getUser(); }
  function isPremium() { var u = getUser(); return !!u && u.plan === "premium"; }
  function isRegistered() { var u = getUser(); return !!u && (u.plan === "registered" || u.plan === "premium"); }

  function seedProgressIfNeeded() {
    if (readJSON(LS.SEEDED, false)) return;
    var jr = D.TRACKS.filter(function (t) { return t.slug === "po-junior"; })[0];
    var completed = jr ? jr.modules.slice(0, 9).map(function (m) { return m.contentSlug; }) : [];
    writeJSON(LS.COMPLETED, completed);
    writeJSON(LS.STUDIED_FW, ["rice", "moscow", "okr"]);
    writeJSON(LS.SEEDED, true);
  }

  function login(email, name) {
    // FUTURO: substituir por chamada real de autenticação (JWT/OAuth).
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

  function logout() {
    localStorage.removeItem(LS.USER);
    if (global.PH_Supabase && global.PH_Supabase.isLoggedIn()) {
      global.PH_Supabase.logout().catch(function (e) { console.error(e); });
    }
  }

  function upgradeToPremium() {
    var u = getUser();
    if (!u) return null;
    u.plan = "premium";
    writeJSON(LS.USER, u);
    if (global.PH_Supabase && global.PH_Supabase.isLoggedIn()) {
      global.PH_Supabase.upgradeToPremium().catch(function (e) { console.error(e); });
    }
    return u;
  }

  function setLevelGoal(level) {
    writeJSON(LS.LEVEL_GOAL, level);
    if (global.PH_Supabase && global.PH_Supabase.isLoggedIn()) {
      global.PH_Supabase.setLevelGoal(level).catch(function (e) { console.error(e); });
    }
  }
  function getLevelGoal() { return readJSON(LS.LEVEL_GOAL, (getUser() || {}).level || "junior"); }

  function getCompleted() { return readJSON(LS.COMPLETED, []); }
  function isCompleted(slug) { return getCompleted().indexOf(slug) !== -1; }
  function toggleCompleted(slug) {
    var list = getCompleted();
    var i = list.indexOf(slug);
    if (i === -1) list.push(slug); else list.splice(i, 1);
    writeJSON(LS.COMPLETED, list);
    if (global.PH_Supabase && global.PH_Supabase.isLoggedIn()) {
      global.PH_Supabase.toggleCompleted(slug).catch(function (e) { console.error(e); });
    }
    return list.indexOf(slug) !== -1;
  }

  function trackProgress(track) {
    if (!track.modules || !track.modules.length) return 0;
    var completed = getCompleted();
    var done = track.modules.filter(function (m) { return completed.indexOf(m.contentSlug) !== -1; }).length;
    return Math.round((done / track.modules.length) * 100);
  }

  function studyStats() {
    var completed = getCompleted();
    var items = D.CONTENTS.filter(function (c) { return completed.indexOf(c.slug) !== -1; });
    var minutes = items.reduce(function (sum, c) { return sum + (c.readTime || 5); }, 0);
    var tracksCompleted = D.TRACKS.filter(function (t) { return trackProgress(t) === 100; }).length;
    var studiedFw = readJSON(LS.STUDIED_FW, []);
    return {
      contentsCompleted: items.length,
      hoursStudied: Math.round((minutes / 60) * 10) / 10,
      frameworksStudied: studiedFw.length,
      tracksCompleted: tracksCompleted
    };
  }

  function markFrameworkStudied(slug) {
    var list = readJSON(LS.STUDIED_FW, []);
    if (list.indexOf(slug) === -1) { list.push(slug); writeJSON(LS.STUDIED_FW, list); }
    if (global.PH_Supabase && global.PH_Supabase.isLoggedIn()) {
      global.PH_Supabase.markFrameworkStudied(slug).catch(function (e) { console.error(e); });
    }
  }

  /* ------------------------- access gating ------------------------- */
  // Retorna { allowed, reason } — reason: null | 'signup' | 'premium'
  function checkAccess(access) {
    if (access === D.ACCESS.FREE || !access) return { allowed: true, reason: null };
    if (access === D.ACCESS.SIGNUP) {
      return { allowed: isRegistered(), reason: isRegistered() ? null : "signup" };
    }
    if (access === D.ACCESS.PREMIUM) {
      return { allowed: isPremium(), reason: isPremium() ? null : "premium" };
    }
    return { allowed: true, reason: null };
  }

  /* ------------------------- badges / small renderers ------------------------- */
  function levelBadge(levelKey) {
    var lvl = D.LEVELS[levelKey];
    if (!lvl) return "";
    return '<span class="badge badge-lvl-' + levelKey + '">' + escapeHtml(lvl.label) + "</span>";
  }
  function accessBadge(access) {
    if (access === D.ACCESS.PREMIUM) return '<span class="badge badge-warning">🔒 Premium</span>';
    if (access === D.ACCESS.SIGNUP) return '<span class="badge badge-brand">🔑 Requer cadastro</span>';
    return '<span class="badge badge-success">Gratuito</span>';
  }
  function typeBadge(type) {
    var map = { artigo: "📄 Artigo", checklist: "✅ Checklist", template: "🧩 Template", video: "🎬 Vídeo" };
    return '<span class="badge badge-outline">' + (map[type] || "Conteúdo") + "</span>";
  }
  function statusBadge(slug) {
    if (isCompleted(slug)) return '<span class="badge badge-success">✓ Concluído</span>';
    return "";
  }

  /* ------------------------- toast ------------------------- */
  function ensureToastWrap() {
    var wrap = $("#toastWrap");
    if (!wrap) {
      wrap = document.createElement("div");
      wrap.id = "toastWrap";
      wrap.className = "toast-wrap";
      document.body.appendChild(wrap);
    }
    return wrap;
  }
  function toast(msg, icon) {
    var wrap = ensureToastWrap();
    var el = document.createElement("div");
    el.className = "toast";
    el.innerHTML = "<span>" + (icon || "✅") + "</span><span>" + escapeHtml(msg) + "</span>";
    wrap.appendChild(el);
    setTimeout(function () {
      el.style.transition = "opacity .25s ease";
      el.style.opacity = "0";
      setTimeout(function () { el.remove(); }, 250);
    }, 2800);
  }

  /* ------------------------- modal system ------------------------- */
  function ensureModalRoot() {
    var root = $("#modalRoot");
    if (!root) {
      root = document.createElement("div");
      root.id = "modalRoot";
      document.body.appendChild(root);
    }
    return root;
  }

  function closeModal(id) {
    var el = document.getElementById(id);
    if (el) el.classList.remove("open");
  }

  function openRawModal(id, wide) {
    var el = document.getElementById(id);
    if (el) el.classList.add("open");
  }

  function signupGateModal(message, redirectSlugInfo) {
    var root = ensureModalRoot();
    var id = "gateModal";
    var existing = document.getElementById(id);
    if (existing) existing.remove();
    var div = document.createElement("div");
    div.id = id;
    div.className = "modal-backdrop";
    div.innerHTML =
      '<div class="modal">' +
        '<div class="modal-head">' +
          '<div class="card-icon" style="margin-bottom:0;">🔑</div>' +
          '<button class="modal-close" data-close>&times;</button>' +
        "</div>" +
        '<div class="modal-body">' +
          "<h3>Crie sua conta gratuitamente</h3>" +
          '<p class="muted">' + escapeHtml(message || "Esse conteúdo é gratuito, mas você precisa criar sua conta para acessar.") + "</p>" +
          '<div class="flex-col gap-12 mt-16">' +
            '<a href="cadastro.html' + (redirectSlugInfo ? "?next=" + encodeURIComponent(redirectSlugInfo) : "") + '" class="btn btn-primary btn-block">Criar conta grátis</a>' +
            '<a href="login.html" class="btn btn-secondary btn-block">Já tenho conta — Entrar</a>' +
          "</div>" +
        "</div>" +
      "</div>";
    root.appendChild(div);
    div.addEventListener("click", function (e) { if (e.target === div || e.target.closest("[data-close]")) div.classList.remove("open"); });
    requestAnimationFrame(function () { div.classList.add("open"); });
  }

  function premiumGateModal(message) {
    var root = ensureModalRoot();
    var id = "premiumGateModal";
    var existing = document.getElementById(id);
    if (existing) existing.remove();
    var div = document.createElement("div");
    div.id = id;
    div.className = "modal-backdrop";
    div.innerHTML =
      '<div class="modal">' +
        '<div class="modal-head">' +
          '<div class="card-icon" style="margin-bottom:0;background:var(--warning-100);color:var(--warning-700);">🔒</div>' +
          '<button class="modal-close" data-close>&times;</button>' +
        "</div>" +
        '<div class="modal-body">' +
          "<h3>Conteúdo Premium</h3>" +
          '<p class="muted">' + escapeHtml(message || "Esse conteúdo faz parte da área Premium, para profissionais Sênior e Liderança.") + "</p>" +
          '<div class="flex-col gap-12 mt-16">' +
            '<a href="premium.html" class="btn btn-primary btn-block">Conhecer o Premium</a>' +
            '<button class="btn btn-secondary btn-block" data-close>Continuar navegando</button>' +
          "</div>" +
        "</div>" +
      "</div>";
    root.appendChild(div);
    div.addEventListener("click", function (e) { if (e.target === div || e.target.closest("[data-close]")) div.classList.remove("open"); });
    requestAnimationFrame(function () { div.classList.add("open"); });
  }

  /* ------------------------- navbar / footer ------------------------- */
  var NAV_ITEMS = [
    { key: "home", label: "Início", href: "index.html" },
    { key: "trilhas", label: "Trilhas", href: "trilhas.html" },
    { key: "conteudos", label: "Conteúdos", href: "conteudos.html" },
    { key: "frameworks", label: "Frameworks", href: "frameworks.html" },
    { key: "ferramentas", label: "Ferramentas", href: "ferramentas.html" },
    { key: "cases", label: "Cases", href: "cases.html" },
    { key: "carreira", label: "Carreira", href: "carreira.html" },
    { key: "premium", label: "Premium", href: "premium.html" }
  ];

  function renderNavbar(activeKey) {
    var user = getUser();
    var links = NAV_ITEMS.map(function (it) {
      return '<a href="' + it.href + '" class="' + (it.key === activeKey ? "active" : "") + '">' + it.label + "</a>";
    }).join("");

    var actions;
    if (user) {
      var planBadge = user.plan === "premium" ? '<span class="badge badge-warning" style="margin-left:6px;">Premium</span>' : "";
      actions =
        '<button class="icon-btn" id="navSearchIcon" title="Buscar" aria-label="Buscar">🔍</button>' +
        '<a href="dashboard.html" class="btn btn-ghost btn-sm">Dashboard</a>' +
        '<a href="perfil.html" class="user-chip">' +
          '<span class="avatar">' + initials(user.name) + "</span>" +
          '<span class="small" style="font-weight:700;">' + escapeHtml(user.name.split(" ")[0]) + "</span>" +
          planBadge +
        "</a>";
    } else {
      actions =
        '<button class="icon-btn" id="navSearchIcon" title="Buscar" aria-label="Buscar">🔍</button>' +
        '<a href="login.html" class="btn btn-ghost btn-sm">Entrar</a>' +
        '<a href="cadastro.html" class="btn btn-primary btn-sm">Criar conta</a>';
    }

    return (
      '<div class="navbar"><div class="container-wide navbar-inner">' +
        '<a href="index.html" class="brand"><span class="brand-mark">PH</span>ProductHub</a>' +
        '<nav class="nav-links">' + links + "</nav>" +
        '<button class="nav-search-btn" id="navSearchBtn"><span>🔍</span><span>Buscar conteúdo...</span><kbd>Ctrl K</kbd></button>' +
        '<div class="nav-actions">' + actions + "</div>" +
        '<button class="icon-btn mobile-toggle" id="mobileMenuBtn">☰</button>' +
      "</div></div>" +
      '<div id="mobileMenu" style="display:none;background:#fff;border-bottom:1px solid var(--ink-200);">' +
        '<div class="container flex-col gap-8" style="padding:16px 24px;">' + links + '<hr class="divider" style="margin:8px 0;">' + actions + "</div>" +
      "</div>"
    );
  }

  function renderFooter() {
    return (
      '<footer class="site-footer"><div class="container-wide">' +
        '<div class="grid grid-4">' +
          '<div>' +
            '<a href="index.html" class="brand" style="color:#fff;margin-bottom:14px;"><span class="brand-mark">PH</span>ProductHub</a>' +
            '<p style="color:var(--ink-400);font-size:13.5px;max-width:240px;">Aprenda. Pratique. Evolua.<br>Conteúdo prático para Product Owners e Product Managers.</p>' +
          "</div>" +
          '<div><h4>Plataforma</h4>' +
            '<a href="trilhas.html">Trilhas</a><a href="conteudos.html">Conteúdos</a><a href="frameworks.html">Frameworks</a><a href="ferramentas.html">Ferramentas</a>' +
          "</div>" +
          '<div><h4>Carreira</h4>' +
            '<a href="carreira.html">Trilha de carreira</a><a href="produto-real.html">Produto na vida real</a><a href="tecnologia.html">Tecnologia sem ser Dev</a><a href="cases.html">Cases</a>' +
          "</div>" +
          '<div><h4>Conta</h4>' +
            '<a href="login.html">Entrar</a><a href="cadastro.html">Criar conta</a><a href="premium.html">Premium</a><a href="perfil.html">Perfil</a>' +
          "</div>" +
        "</div>" +
        '<div class="footer-bottom"><span>© 2026 ProductHub. Protótipo de produto — dados mockados.</span><span>Feito para PO, PM e futuros líderes de Produto.</span></div>' +
      "</div></footer>"
    );
  }

  /* ------------------------- global search ------------------------- */
  function buildSearchIndex() {
    var idx = [];
    D.CONTENTS.forEach(function (c) {
      idx.push({ group: "Conteúdos", icon: "📄", title: c.title, sub: (D.LEVELS[c.level] || {}).label + " · " + c.category, href: "conteudo.html?slug=" + c.slug, text: (c.title + " " + c.summary + " " + c.category + " " + c.theme).toLowerCase() });
    });
    D.FRAMEWORKS.forEach(function (f) {
      idx.push({ group: "Frameworks", icon: "🧠", title: f.name, sub: f.category, href: "framework.html?slug=" + f.slug, text: (f.name + " " + f.shortDesc + " " + f.category).toLowerCase() });
    });
    D.TOOLS.forEach(function (t) {
      idx.push({ group: "Ferramentas", icon: "🛠️", title: t.name, sub: t.category, href: "ferramentas.html?tool=" + t.slug, text: (t.name + " " + t.whatIsIt + " " + t.category).toLowerCase() });
    });
    D.CASES.forEach(function (c) {
      idx.push({ group: "Cases", icon: "🏢", title: c.company + " — " + c.sector, sub: c.summary, href: "cases.html?case=" + c.slug, text: (c.company + " " + c.sector + " " + c.summary).toLowerCase() });
    });
    return idx;
  }

  function initSearch() {
    var root = ensureModalRoot();
    var id = "searchOverlay";
    var el = document.createElement("div");
    el.id = id;
    el.className = "search-backdrop";
    el.innerHTML =
      '<div class="search-panel">' +
        '<div class="search-input-row"><span>🔍</span><input type="text" id="searchInput" placeholder="Busque por conteúdo, framework, ferramenta ou assunto..." /><button class="modal-close" data-close>&times;</button></div>' +
        '<div class="search-results" id="searchResults"></div>' +
      "</div>";
    root.appendChild(el);
    var index = buildSearchIndex();
    var input = $("#searchInput", el);
    var results = $("#searchResults", el);

    function renderResults(q) {
      q = (q || "").trim().toLowerCase();
      if (!q) {
        results.innerHTML =
          '<div class="search-empty">Tente: <strong>“roadmap”</strong>, <strong>“RICE”</strong>, <strong>“API”</strong>, <strong>“discovery”</strong>, <strong>“Jira”</strong>, <strong>“stakeholders”</strong>…</div>';
        return;
      }
      var matches = index.filter(function (it) { return it.text.indexOf(q) !== -1; }).slice(0, 30);
      if (!matches.length) {
        results.innerHTML = '<div class="search-empty">Nenhum resultado para “' + escapeHtml(q) + '”.</div>';
        return;
      }
      var groups = {};
      matches.forEach(function (m) { (groups[m.group] = groups[m.group] || []).push(m); });
      var html = "";
      Object.keys(groups).forEach(function (g) {
        html += '<div class="search-group-title">' + g + "</div>";
        groups[g].forEach(function (m) {
          html +=
            '<a class="search-result-item" href="' + m.href + '">' +
              '<span class="sr-icon">' + m.icon + "</span>" +
              '<span><div style="font-weight:700;font-size:14px;color:var(--ink-900);">' + escapeHtml(m.title) + "</div>" +
              '<div class="small muted">' + escapeHtml(m.sub) + "</div></span>" +
            "</a>";
        });
      });
      results.innerHTML = html;
    }
    renderResults("");
    input.addEventListener("input", function () { renderResults(input.value); });
    el.addEventListener("click", function (e) { if (e.target === el || e.target.closest("[data-close]")) closeSearch(); });

    function openSearch() { el.classList.add("open"); setTimeout(function () { input.focus(); }, 30); }
    function closeSearch() { el.classList.remove("open"); }

    document.addEventListener("keydown", function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); openSearch(); }
      if (e.key === "Escape") closeSearch();
    });
    $all("#navSearchBtn, #navSearchIcon").forEach(function (btn) { btn.addEventListener("click", openSearch); });
  }

  /* ------------------------- layout bootstrap ------------------------- */
  var lastActiveKey = null;
  var searchInitialized = false;

  function mountLayout(activeKey) {
    lastActiveKey = activeKey;
    var header = $("#site-header");
    var footer = $("#site-footer");
    if (header) header.innerHTML = renderNavbar(activeKey);
    if (footer) footer.innerHTML = renderFooter();

    var mobileBtn = $("#mobileMenuBtn");
    var mobileMenu = $("#mobileMenu");
    if (mobileBtn && mobileMenu) {
      mobileBtn.addEventListener("click", function () {
        mobileMenu.style.display = mobileMenu.style.display === "none" ? "block" : "none";
      });
    }
    if (!searchInitialized) { initSearch(); searchInitialized = true; }
  }

  // Re-renderiza só o cabeçalho — usado depois que a sessão Supabase termina
  // de restaurar de forma assíncrona, caso o cache local estivesse desatualizado.
  function refreshHeader() {
    var header = $("#site-header");
    if (!header) return;
    header.innerHTML = renderNavbar(lastActiveKey);
    var mobileBtn = $("#mobileMenuBtn");
    var mobileMenu = $("#mobileMenu");
    if (mobileBtn && mobileMenu) {
      mobileBtn.addEventListener("click", function () {
        mobileMenu.style.display = mobileMenu.style.display === "none" ? "block" : "none";
      });
    }
  }

  /* ------------------------- card templates ------------------------- */
  function progressBarHtml(pct) {
    return '<div class="progress-bar"><span style="width:' + pct + '%;"></span></div>';
  }

  function contentCard(c, opts) {
    opts = opts || {};
    var access = checkAccess(c.access);
    var locked = !access.allowed;
    var done = isCompleted(c.slug);
    return (
      '<a href="conteudo.html?slug=' + c.slug + '" class="card hoverable ' + (locked ? "card-locked" : "") + '" data-access="' + c.access + '">' +
        (locked ? '<span class="lock-overlay-icon">🔒</span>' : "") +
        '<div class="flex gap-8 wrap mb-12">' + levelBadge(c.level) + typeBadge(c.type) + (done ? statusBadge(c.slug) : "") + "</div>" +
        "<h3 style=\"font-size:17px;margin-bottom:8px;\">" + escapeHtml(c.title) + "</h3>" +
        '<p class="small" style="margin-bottom:16px;">' + escapeHtml(c.summary) + "</p>" +
        '<div class="flex-between">' +
          '<span class="small muted">⏱ ' + c.readTime + " min · " + escapeHtml(c.category) + "</span>" +
          accessBadge(c.access) +
        "</div>" +
      "</a>"
    );
  }

  function frameworkCard(f) {
    return (
      '<a href="framework.html?slug=' + f.slug + '" class="card hoverable">' +
        '<div class="card-icon">' + f.icon + "</div>" +
        "<h3 style=\"font-size:17px;margin-bottom:6px;\">" + escapeHtml(f.name) + "</h3>" +
        '<p class="small" style="margin-bottom:14px;">' + escapeHtml(f.shortDesc) + "</p>" +
        '<span class="tag">' + escapeHtml(f.category) + "</span>" +
      "</a>"
    );
  }

  function toolCard(t) {
    return (
      '<div class="card hoverable" data-tool="' + t.slug + '" style="cursor:pointer;">' +
        '<div class="card-icon">' + t.icon + "</div>" +
        "<h3 style=\"font-size:16.5px;margin-bottom:6px;\">" + escapeHtml(t.name) + "</h3>" +
        '<p class="small" style="margin-bottom:14px;">' + escapeHtml(t.whatIsIt) + "</p>" +
        '<div class="flex-between"><span class="tag">' + escapeHtml(t.category) + "</span>" + levelBadge(t.level) + "</div>" +
      "</div>"
    );
  }

  function caseCard(c) {
    return (
      '<div class="card hoverable" data-case="' + c.slug + '" style="cursor:pointer;">' +
        '<div class="card-icon">' + c.icon + "</div>" +
        '<span class="tag mb-12" style="display:inline-block;">' + escapeHtml(c.sector) + "</span>" +
        "<h3 style=\"font-size:17px;margin-bottom:8px;\">" + escapeHtml(c.company) + "</h3>" +
        '<p class="small">' + escapeHtml(c.summary) + "</p>" +
      "</div>"
    );
  }

  function situationCard(s) {
    return (
      '<div class="card hoverable" data-situation="' + s.slug + '" style="cursor:pointer;">' +
        '<div class="flex gap-8 mb-12">' + levelBadge(s.level) + "</div>" +
        '<div style="font-size:28px;margin-bottom:10px;">' + s.icon + "</div>" +
        "<h3 style=\"font-size:16.5px;margin-bottom:8px;\">" + escapeHtml(s.title) + "</h3>" +
        '<p class="small">' + escapeHtml(s.scenario) + "</p>" +
      "</div>"
    );
  }

  function techCard(t) {
    return (
      '<div class="card hoverable" data-tech="' + t.slug + '" style="cursor:pointer;">' +
        "<h3 style=\"font-size:15.5px;margin-bottom:8px;\">" + escapeHtml(t.title) + "</h3>" +
        '<p class="small mb-0">' + escapeHtml(t.explanation) + "</p>" +
      "</div>"
    );
  }

  function trackCard(t) {
    var pct = trackProgress(t);
    var lockedBadge = t.access === D.ACCESS.PREMIUM ? '<span class="badge badge-warning">🔒 Premium</span>' :
      t.access === D.ACCESS.SIGNUP ? '<span class="badge badge-brand">🔑 Requer cadastro</span>' : '<span class="badge badge-success">Aberta</span>';
    return (
      '<a href="trilha.html?slug=' + t.slug + '" class="card hoverable">' +
        '<div class="flex-between mb-12"><div class="card-icon" style="margin-bottom:0;">' + t.icon + "</div>" + lockedBadge + "</div>" +
        "<h3 style=\"font-size:18px;margin-bottom:8px;\">" + escapeHtml(t.title) + "</h3>" +
        '<p class="small" style="margin-bottom:16px;">' + escapeHtml(t.description) + "</p>" +
        '<div class="flex gap-8 mb-16">' + levelBadge(t.level) + '<span class="badge">' + t.modules.length + " conteúdos</span></div>" +
        (checkAccess(t.access).allowed ?
          '<div class="progress-row"><span>Progresso</span><span>' + pct + "%</span></div>" + progressBarHtml(pct) :
          '<div class="small muted">Desbloqueie para acompanhar seu progresso</div>') +
      "</a>"
    );
  }

  function breadcrumbs(items) {
    var html = '<div class="breadcrumbs">';
    items.forEach(function (it, i) {
      if (i > 0) html += '<span class="sep">/</span>';
      if (it.href) html += '<a href="' + it.href + '">' + escapeHtml(it.label) + "</a>";
      else html += '<span class="current">' + escapeHtml(it.label) + "</span>";
    });
    return html + "</div>";
  }

  /* ------------------------- expose ------------------------- */
  global.PHApp = {
    $: $, $all: $all, escapeHtml: escapeHtml, qs: qs, initials: initials,
    getUser: getUser, isLoggedIn: isLoggedIn, isPremium: isPremium, isRegistered: isRegistered,
    login: login, signup: signup, logout: logout, upgradeToPremium: upgradeToPremium,
    setLevelGoal: setLevelGoal, getLevelGoal: getLevelGoal,
    getCompleted: getCompleted, isCompleted: isCompleted, toggleCompleted: toggleCompleted,
    trackProgress: trackProgress, studyStats: studyStats, markFrameworkStudied: markFrameworkStudied,
    checkAccess: checkAccess,
    levelBadge: levelBadge, accessBadge: accessBadge, typeBadge: typeBadge, statusBadge: statusBadge,
    toast: toast, signupGateModal: signupGateModal, premiumGateModal: premiumGateModal,
    mountLayout: mountLayout, refreshHeader: refreshHeader, progressBarHtml: progressBarHtml,
    contentCard: contentCard, frameworkCard: frameworkCard, toolCard: toolCard, caseCard: caseCard,
    situationCard: situationCard, techCard: techCard, trackCard: trackCard, breadcrumbs: breadcrumbs
  };

})(window);
