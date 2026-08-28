/* =========================================================
   ProductHub — Supabase Integration Layer
   Substitui localStorage pelas operações de banco real.
   Expose funções que app.js chama, mantendo interface compat.
   ========================================================= */

(function (global) {
  "use strict";

  // Inicializar Supabase client (carregado via CDN em HTML)
  var supabase = window.supabase;
  if (!supabase) {
    console.error("Supabase client não carregado. Verifique se CDN foi incluído no HTML antes de supabase.js");
    return;
  }

  // Criar cliente Supabase
  var supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  global.supabaseClient = supabaseClient;

  /* ======================== Local cache mirror ========================
     app.js (usado em quase todas as páginas) lê/escreve de forma síncrona
     nessas chaves do localStorage. Como as páginas nunca foram convertidas
     para chamar o Supabase diretamente, espelhamos aqui o estado vindo do
     banco para essas mesmas chaves, para que o resto do site continue
     funcionando sem reescrever cada página para async. */
  var LS = {
    USER: "ph_user",
    COMPLETED: "ph_completed_content",
    STUDIED_FW: "ph_studied_frameworks",
    LEVEL_GOAL: "ph_level_goal",
    SEEDED: "ph_seeded"
  };

  async function mirrorToLocalCache() {
    try {
      if (!currentUser) { localStorage.removeItem(LS.USER); return; }
      localStorage.setItem(LS.USER, JSON.stringify(currentUser));
      localStorage.setItem(LS.LEVEL_GOAL, JSON.stringify(currentUser.level_goal || "pleno"));
      localStorage.setItem(LS.SEEDED, JSON.stringify(true));
      var completed = await getCompleted();
      localStorage.setItem(LS.COMPLETED, JSON.stringify(completed));
      var fw = await getStudiedFrameworks();
      localStorage.setItem(LS.STUDIED_FW, JSON.stringify(fw));
    } catch (e) {
      console.error("Erro ao sincronizar cache local:", e.message);
    }
  }

  /* ======================== Session Management ======================== */

  var currentUser = null;
  var sessionInitialized = false;

  // Restaurar sessão ao carregar página
  async function initSession() {
    try {
      var { data: { session } } = await supabaseClient.auth.getSession();
      if (session && session.user) {
        var { data: userData } = await supabaseClient
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single();
        if (userData) {
          currentUser = userData;
        }
      }
      await mirrorToLocalCache();
      sessionInitialized = true;
      console.log("Sessão Supabase restaurada:", currentUser ? currentUser.email : "não autenticado");
    } catch (e) {
      console.error("Erro ao restaurar sessão:", e.message);
      sessionInitialized = true;
    }
  }

  /* ======================== Auth Functions (substitui login/signup do app.js) ======================== */

  async function signup(data) {
    try {
      // 1. Criar usuário via Auth
      var { data: authData, error: authError } = await supabaseClient.auth.signUp({
        email: data.email,
        password: data.password
      });

      if (authError) throw new Error(authError.message);

      // 2. Criar registro em public.users
      var user = {
        id: authData.user.id,
        name: data.name || "Usuário",
        email: data.email,
        cargo: data.cargo || "Product Owner",
        level: data.level || "junior",
        plan: "registered",
        level_goal: data.level || "pleno"
      };

      var { data: userRecord, error: dbError } = await supabaseClient
        .from('users')
        .insert([user])
        .select()
        .single();

      if (dbError) throw new Error(dbError.message);

      currentUser = userRecord;

      // 3. Seed progresso inicial
      await seedProgressIfNeeded();
      await mirrorToLocalCache();

      return userRecord;
    } catch (e) {
      console.error("Erro ao registrar:", e.message);
      throw e;
    }
  }

  async function login(email, password) {
    try {
      var { data, error } = await supabaseClient.auth.signInWithPassword({
        email: email,
        password: password
      });

      if (error) throw new Error(error.message);

      // Carregar dados do usuário
      var { data: userData } = await supabaseClient
        .from('users')
        .select('*')
        .eq('id', data.user.id)
        .single();

      currentUser = userData;
      await mirrorToLocalCache();
      return userData;
    } catch (e) {
      console.error("Erro ao fazer login:", e.message);
      throw e;
    }
  }

  async function logout() {
    try {
      await supabaseClient.auth.signOut();
      currentUser = null;
      localStorage.removeItem(LS.USER);
      localStorage.removeItem(LS.COMPLETED);
      localStorage.removeItem(LS.STUDIED_FW);
      localStorage.removeItem(LS.LEVEL_GOAL);
      localStorage.removeItem(LS.SEEDED);
      console.log("Logout realizado");
    } catch (e) {
      console.error("Erro ao fazer logout:", e.message);
      throw e;
    }
  }

  async function upgradeToPremium() {
    if (!currentUser) return null;
    try {
      var { data, error } = await supabaseClient
        .from('users')
        .update({ plan: 'premium' })
        .eq('id', currentUser.id)
        .select()
        .single();

      if (error) throw new Error(error.message);
      currentUser = data;
      await mirrorToLocalCache();
      return data;
    } catch (e) {
      console.error("Erro ao fazer upgrade:", e.message);
      throw e;
    }
  }

  /* ======================== User Profile Functions ======================== */

  function getUser() {
    return currentUser;
  }

  function isLoggedIn() {
    return !!currentUser;
  }

  function isPremium() {
    return currentUser && currentUser.plan === "premium";
  }

  function isRegistered() {
    return currentUser && (currentUser.plan === "registered" || currentUser.plan === "premium");
  }

  async function setLevelGoal(level) {
    if (!currentUser) return null;
    try {
      var { data, error } = await supabaseClient
        .from('users')
        .update({ level_goal: level })
        .eq('id', currentUser.id)
        .select()
        .single();

      if (error) throw new Error(error.message);
      currentUser = data;
      await mirrorToLocalCache();
      return data;
    } catch (e) {
      console.error("Erro ao atualizar nível goal:", e.message);
      throw e;
    }
  }

  function getLevelGoal() {
    return currentUser ? currentUser.level_goal : "junior";
  }

  /* ======================== Progress Tracking ======================== */

  async function getCompleted() {
    if (!currentUser) return [];
    try {
      var { data, error } = await supabaseClient
        .from('user_progress')
        .select('content_slug')
        .eq('user_id', currentUser.id);

      if (error) throw new Error(error.message);
      return data.map(function (r) { return r.content_slug; });
    } catch (e) {
      console.error("Erro ao carregar progresso:", e.message);
      return [];
    }
  }

  async function isCompleted(slug) {
    if (!currentUser) return false;
    try {
      var { data, error } = await supabaseClient
        .from('user_progress')
        .select('*')
        .eq('user_id', currentUser.id)
        .eq('content_slug', slug)
        .limit(1);

      if (error) throw new Error(error.message);
      return data && data.length > 0;
    } catch (e) {
      console.error("Erro ao verificar conclusão:", e.message);
      return false;
    }
  }

  async function toggleCompleted(slug) {
    if (!currentUser) return false;
    try {
      var completed = await isCompleted(slug);

      if (completed) {
        // Remover
        var { error } = await supabaseClient
          .from('user_progress')
          .delete()
          .eq('user_id', currentUser.id)
          .eq('content_slug', slug);

        if (error) throw new Error(error.message);
        var listAfterRemove = await getCompleted();
        localStorage.setItem(LS.COMPLETED, JSON.stringify(listAfterRemove));
        return false;
      } else {
        // Adicionar
        var { error: insertError } = await supabaseClient
          .from('user_progress')
          .insert([{
            user_id: currentUser.id,
            content_slug: slug
          }]);

        if (insertError) throw new Error(insertError.message);
        var listAfterAdd = await getCompleted();
        localStorage.setItem(LS.COMPLETED, JSON.stringify(listAfterAdd));
        return true;
      }
    } catch (e) {
      console.error("Erro ao atualizar progresso:", e.message);
      return false;
    }
  }

  async function trackProgress(track) {
    if (!track.modules || !track.modules.length) return 0;
    try {
      var completed = await getCompleted();
      var done = track.modules.filter(function (m) {
        return completed.indexOf(m.contentSlug) !== -1;
      }).length;
      return Math.round((done / track.modules.length) * 100);
    } catch (e) {
      console.error("Erro ao calcular progresso:", e.message);
      return 0;
    }
  }

  /* ======================== Frameworks Study ======================== */

  async function getStudiedFrameworks() {
    if (!currentUser) return [];
    try {
      var { data, error } = await supabaseClient
        .from('user_frameworks')
        .select('framework_slug')
        .eq('user_id', currentUser.id);

      if (error) throw new Error(error.message);
      return data.map(function (r) { return r.framework_slug; });
    } catch (e) {
      console.error("Erro ao carregar frameworks:", e.message);
      return [];
    }
  }

  async function markFrameworkStudied(slug) {
    if (!currentUser) return false;
    try {
      var { error } = await supabaseClient
        .from('user_frameworks')
        .upsert([{
          user_id: currentUser.id,
          framework_slug: slug
        }], { onConflict: 'user_id,framework_slug', ignoreDuplicates: true });

      if (error) throw new Error(error.message);
      var fwAfter = await getStudiedFrameworks();
      localStorage.setItem(LS.STUDIED_FW, JSON.stringify(fwAfter));
      return true;
    } catch (e) {
      console.error("Erro ao marcar framework:", e.message);
      return false;
    }
  }

  /* ======================== Stats Calculation ======================== */

  async function studyStats() {
    try {
      var D = global.PH; // data.js
      var completed = await getCompleted();
      var items = D.CONTENTS.filter(function (c) {
        return completed.indexOf(c.slug) !== -1;
      });

      var minutes = items.reduce(function (sum, c) {
        return sum + (c.readTime || 5);
      }, 0);

      var tracksCompleted = 0;
      for (var i = 0; i < D.TRACKS.length; i++) {
        var pct = await trackProgress(D.TRACKS[i]);
        if (pct === 100) tracksCompleted++;
      }

      var studiedFw = await getStudiedFrameworks();

      return {
        contentsCompleted: items.length,
        hoursStudied: Math.round((minutes / 60) * 10) / 10,
        frameworksStudied: studiedFw.length,
        tracksCompleted: tracksCompleted
      };
    } catch (e) {
      console.error("Erro ao calcular stats:", e.message);
      return {
        contentsCompleted: 0,
        hoursStudied: 0,
        frameworksStudied: 0,
        tracksCompleted: 0
      };
    }
  }

  /* ======================== Seed Initial Progress ======================== */

  async function seedProgressIfNeeded() {
    if (!currentUser) return;
    try {
      var { data: existing } = await supabaseClient
        .from('user_progress')
        .select('id')
        .eq('user_id', currentUser.id)
        .limit(1);

      if (existing && existing.length > 0) return; // Já foi seedado

      var D = global.PH;
      var jr = D.TRACKS.filter(function (t) {
        return t.slug === "po-junior";
      })[0];

      if (!jr) return;

      var toSeed = jr.modules.slice(0, 9).map(function (m) {
        return { user_id: currentUser.id, content_slug: m.contentSlug };
      });

      if (toSeed.length > 0) {
        var { error } = await supabaseClient
          .from('user_progress')
          .insert(toSeed);

        if (error) throw new Error(error.message);
      }

      // Marcar frameworks como estudados
      var fwSlugs = ["rice", "moscow", "okr"];
      var fwToSeed = fwSlugs.map(function (slug) {
        return { user_id: currentUser.id, framework_slug: slug };
      });

      if (fwToSeed.length > 0) {
        await supabaseClient
          .from('user_frameworks')
          .upsert(fwToSeed, { onConflict: 'user_id,framework_slug', ignoreDuplicates: true });
      }

      console.log("Progresso inicial criado para novo usuário");
    } catch (e) {
      console.error("Erro ao fazer seed:", e.message);
    }
  }

  /* ======================== Expose to Global ======================== */

  global.PH_Supabase = {
    initSession: initSession,
    signup: signup,
    login: login,
    logout: logout,
    upgradeToPremium: upgradeToPremium,
    getUser: getUser,
    isLoggedIn: isLoggedIn,
    isPremium: isPremium,
    isRegistered: isRegistered,
    setLevelGoal: setLevelGoal,
    getLevelGoal: getLevelGoal,
    getCompleted: getCompleted,
    isCompleted: isCompleted,
    toggleCompleted: toggleCompleted,
    trackProgress: trackProgress,
    getStudiedFrameworks: getStudiedFrameworks,
    markFrameworkStudied: markFrameworkStudied,
    studyStats: studyStats,
    seedProgressIfNeeded: seedProgressIfNeeded
  };

  console.log("✓ Supabase integration loaded");

  // Restaura a sessão automaticamente em toda página (sem isso, currentUser
  // fica null a cada navegação e as escritas no banco feitas pelo app.js
  // nunca disparam, mesmo com o usuário autenticado no Supabase Auth).
  global.PH_SupabaseReady = initSession().then(function () {
    if (global.PHApp && global.PHApp.refreshHeader) {
      global.PHApp.refreshHeader();
    }
  });
})(window);
