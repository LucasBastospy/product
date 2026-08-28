/* =========================================================
   ProductHub — Supabase Bridge
   Mapeia funcões do app.js para usar Supabase automaticamente
   Carregue ANTES de app.js para interceptar chamadas
   ========================================================= */

(function (global) {
  "use strict";

  // Aguardar Supabase estar pronto
  async function waitForSupabase() {
    var tries = 0;
    while (!global.PH_Supabase && tries < 50) {
      await new Promise(function (r) { setTimeout(r, 100); });
      tries++;
    }
    if (!global.PH_Supabase) {
      console.error("Supabase não carregou a tempo");
    }
  }

  // Iniciar sessão ao carregar
  waitForSupabase().then(async function () {
    if (global.PH_Supabase) {
      await global.PH_Supabase.initSession();
      console.log("ProductHub — Sessão Supabase inicializada");
      // O cabeçalho pode ter renderizado antes da sessão restaurar (cache
      // local desatualizado/vazio) — re-renderiza agora que o estado real
      // do Supabase está disponível.
      if (global.PHApp && global.PHApp.refreshHeader) {
        global.PHApp.refreshHeader();
      }
    }
  });

  // Fazer Supabase disponível como um localStorage mockado para app.js
  // app.js vai chamar readJSON/writeJSON, mas vamos interceptar
  global.__supabase_proxy = {
    // Cache local para evitar muitas requisições
    cache: {
      user: null,
      completed: null,
      frameworks: null,
      levelGoal: null
    },

    // Função para sincronizar cache com DB
    sync: async function () {
      if (global.PH_Supabase && global.PH_Supabase.isLoggedIn()) {
        this.cache.user = global.PH_Supabase.getUser();
        this.cache.completed = await global.PH_Supabase.getCompleted();
        this.cache.frameworks = await global.PH_Supabase.getStudiedFrameworks();
        this.cache.levelGoal = global.PH_Supabase.getLevelGoal();
      }
    },

    // Obter valor (compatível com localStorage)
    get: async function (key) {
      var LS = {
        USER: "ph_user",
        COMPLETED: "ph_completed_content",
        STUDIED_FW: "ph_studied_frameworks",
        LEVEL_GOAL: "ph_level_goal",
        SEEDED: "ph_seeded"
      };

      if (!global.PH_Supabase) return null;

      if (key === LS.USER) return this.cache.user;
      if (key === LS.COMPLETED) return this.cache.completed;
      if (key === LS.STUDIED_FW) return this.cache.frameworks;
      if (key === LS.LEVEL_GOAL) return this.cache.levelGoal;
      if (key === LS.SEEDED) return true; // Sempre true quando usando Supabase

      return null;
    },

    // Definir valor (compatível com localStorage)
    set: async function (key, value) {
      var LS = {
        USER: "ph_user",
        COMPLETED: "ph_completed_content",
        STUDIED_FW: "ph_studied_frameworks",
        LEVEL_GOAL: "ph_level_goal",
        SEEDED: "ph_seeded"
      };

      if (!global.PH_Supabase) return;

      if (key === LS.USER) {
        // Não fazer nada - user vem do auth
      } else if (key === LS.COMPLETED) {
        // Não fazer nada diretamente - toggleCompleted faz isso
      } else if (key === LS.STUDIED_FW) {
        // Não fazer nada diretamente - markFrameworkStudied faz isso
      } else if (key === LS.LEVEL_GOAL) {
        await global.PH_Supabase.setLevelGoal(value);
        this.cache.levelGoal = value;
      }
    }
  };

  console.log("✓ Supabase Bridge loaded");
})(window);
