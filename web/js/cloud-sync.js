/* The database is authoritative; account-scoped local cache is only an outbox. */
const CloudSync = (() => {
  const keys = [
    "ledger",
    "renqing",
    "accounts",
    "categories",
    "houses",
    "addresses",
    "health",
    "preferences",
  ];
  let user = null,
    revisions = {},
    acknowledged = "",
    dirty = false,
    saving = false,
    failure = "",
    busy = false;
  let inFlight = null,
    archive = null,
    epoch = 0,
    token = "",
    counter = 0;
  let defaultLooks = null;
  let refreshing = false,
    lastRefresh = 0;
  const sharedPages = new Set([
    "home",
    "assets",
    "accounts",
    "categories",
    "renqing",
    "houses",
    "addresses",
    "members",
    "invite",
    "stats",
    "ledger-all",
    "ledger-day",
    "category-flow",
  ]);
  function canRefresh() {
    return (
      user &&
      !dirty &&
      !saving &&
      !busy &&
      !failure &&
      !state.modal &&
      sharedPages.has(state.route) &&
      !document.hidden &&
      !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName)
    );
  }
  async function syncShared() {
    if (refreshing || !canRefresh() || Date.now() - lastRefresh < 2000) return;
    refreshing = true;
    lastRefresh = Date.now();
    const generation = epoch,
      owner = user.id,
      family = user.familyId,
      baseline = JSON.stringify(snapshot());
    try {
      const response = await request("/api/data");
      if (
        generation !== epoch ||
        !canRefresh() ||
        user.id !== owner ||
        user.familyId !== family ||
        response.user.familyId !== family ||
        JSON.stringify(snapshot()) !== baseline
      )
        return;
      const changed =
        response.familyRevision !== revisions.familyRevision ||
        response.personalRevision !== revisions.personalRevision ||
        JSON.stringify(response.data.members) !==
          JSON.stringify(state.members) ||
        response.data.invite !== state.invite;
      if (!changed) return;
      apply(response.data);
      user = response.user;
      revisions = {
        familyRevision: response.familyRevision,
        personalRevision: response.personalRevision,
      };
      acknowledged = JSON.stringify(snapshot());
      storeCache();
      render();
    } catch (_) {
      /* A read failure must not discard or block local edits. Retry on next foreground tick. */
    } finally {
      refreshing = false;
    }
  }
  const pending = new Map();
  const native = () => window.AndroidBridge?.backendRequest;
  function endpoint() {
    return native()
      ? JSON.parse(AndroidBridge.getBackendConfig()).endpoint ||
          "https://localhost:8787"
      : localStorage.getItem("home-api-endpoint") ||
          (location.protocol === "https:"
            ? location.origin
            : "https://localhost:8787");
  }
  function request(path, method = "GET", data) {
    if (native())
      return new Promise((resolve, reject) => {
        const id = "api-" + Date.now() + "-" + ++counter;
        const timer = setTimeout(() => {
          pending.delete(id);
          reject(new Error("连接超时，修改仍保留在本机待同步"));
        }, 35000);
        pending.set(id, { resolve, reject, timer });
        AndroidBridge.backendRequest(
          id,
          path,
          method,
          JSON.stringify(data || {}),
        );
      });
    return fetch(endpoint() + path, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: "Bearer " + token } : {}),
      },
      ...(method === "GET" ? {} : { body: JSON.stringify(data || {}) }),
      signal: AbortSignal.timeout(30000),
      redirect: "error",
    }).then(async (r) => {
      const value = await r.json();
      if (!r.ok)
        throw Object.assign(new Error(value.error || "服务异常"), {
          status: r.status,
        });
      return value;
    });
  }
  window.backendResult = (id, result) => {
    const p = pending.get(id);
    if (!p) return;
    pending.delete(id);
    clearTimeout(p.timer);
    if (result.status >= 200 && result.status < 300) p.resolve(result.data);
    else
      p.reject(
        Object.assign(new Error(result.data?.error || "服务连接失败"), {
          status: result.status,
        }),
      );
  };
  function empty() {
    for (const k of [
      "ledger",
      "renqing",
      "accounts",
      "houses",
      "addresses",
      "members",
    ])
      state[k] = [];
    state.categories = {
      expense: ["餐饮", "交通", "购物", "住房", "其他"],
      income: ["工资", "奖金", "其他"],
    };
    state.health = [
      {
        sex: "",
        age: null,
        height: null,
        weight: null,
        delta: 0,
        records: [],
        meals: [],
        deletedMeals: [],
      },
    ];
    state.preferences = {};
    state.familyName = "我的家庭";
    state.invite = "";
    state.retiredInvites = [];
    state.draft = {};
    state.navStack = [];
    state.formValues = {};
    state.modal = null;
    state.hideAmounts = false;
    state.statsMonth = healthToday().slice(0, 7);
    state.selectedDay = new Date().getDate();
    state.nutritionDate = healthToday();
    state.searchQuery = "";
    state.searchOpen = false;
    state.formError = "";
  }
  function snapshot() {
    const data = {};
    for (const k of keys) data[k] = state[k] ?? (k === "preferences" ? {} : []);
    data.preferences = { ...data.preferences, hideAmounts: state.hideAmounts };
    data.categoryLooks = CAT_LOOK;
    return JSON.parse(JSON.stringify(data));
  }
  function apply(value) {
    for (const k of keys) if (value[k] !== undefined) state[k] = value[k];
    if (value.categoryLooks) {
      for (const k of Object.keys(CAT_LOOK)) delete CAT_LOOK[k];
      Object.assign(CAT_LOOK, defaultLooks || {});
      Object.assign(CAT_LOOK, value.categoryLooks);
    }
    for (const k of ["members", "invite", "familyName"])
      if (value[k] !== undefined) state[k] = value[k];
    state.hideAmounts = !!state.preferences?.hideAmounts;
  }
  function cacheKey() {
    return "home-cloud-outbox:" + endpoint() + ":" + user.id;
  }
  function readCache() {
    try {
      return native()
        ? JSON.parse(AndroidBridge.getCloudCache())
        : JSON.parse(localStorage.getItem(cacheKey()) || "{}");
    } catch {
      return {};
    }
  }
  function storeCache() {
    if (!user) return;
    const cache = {
      userId: user.id,
      familyId: user.familyId,
      data: snapshot(),
      revisions,
      acknowledged,
      dirty,
      inFlight,
      archive,
    };
    try {
      if (native()) {
        const r = JSON.parse(
          AndroidBridge.saveCloudCache(JSON.stringify(cache)),
        );
        if (r.error) throw Error(r.error);
      } else localStorage.setItem(cacheKey(), JSON.stringify(cache));
    } catch (e) {
      failure = "本机草稿保存失败，请保持页面打开并导出备份";
      status();
    }
  }
  function status() {
    const el = document.getElementById("cloud-status");
    if (!el) return;
    el.hidden = !user;
    el.textContent =
      failure ||
      (saving
        ? "正在保存到数据库…"
        : dirty
          ? "有修改等待保存"
          : "已保存到数据库");
    el.className = "cloud-status " + (failure ? "failed" : "");
    el.onclick = () => go("cloud-settings");
  }
  function persist() {
    if (!user || state.preview) return;
    dirty = JSON.stringify(snapshot()) !== acknowledged;
    storeCache();
    status();
    if (dirty && !saving && !failure) pump();
  }
  async function pump() {
    if (!user || saving || !dirty) return;
    const generation = epoch;
    saving = true;
    failure = "";
    status();
    if (!inFlight)
      inFlight = {
        requestId: crypto.randomUUID(),
        familyId: user.familyId,
        ...revisions,
        data: snapshot(),
      };
    storeCache();
    try {
      const response = await request("/api/data", "PUT", inFlight);
      if (generation !== epoch) return;
      revisions = response;
      acknowledged = JSON.stringify(inFlight.data);
      inFlight = null;
      dirty = JSON.stringify(snapshot()) !== acknowledged;
    } catch (e) {
      if (generation !== epoch) return;
      failure = e.message;
      if (e.status === 409)
        failure = "存在其他设备更新。请在数据与同步中保留草稿，再加载数据库。";
    } finally {
      if (generation === epoch) {
        saving = false;
        storeCache();
        status();
        if (dirty && !failure) setTimeout(pump, 0);
      }
    }
  }
  function accept(response, restore = true) {
    user = response.user;
    revisions = {
      familyRevision: response.familyRevision,
      personalRevision: response.personalRevision,
    };
    empty();
    apply(response.data);
    acknowledged = JSON.stringify(snapshot());
    dirty = false;
    failure = "";
    inFlight = null;
    if (restore) {
      const saved = readCache();
      archive = saved.archive || null;
      if (
        saved.userId === user.id &&
        saved.dirty &&
        saved.familyId === user.familyId
      ) {
        apply(saved.data);
        revisions = saved.revisions;
        acknowledged = saved.acknowledged;
        inFlight = saved.inFlight;
        dirty = true;
        failure = "发现本机未保存修改，请在数据与同步中重试保存";
      }
    }
    storeCache();
  }
  async function authenticate() {
    if (busy) return;
    busy = true;
    const generation = ++epoch;
    const button = document.getElementById("auth-submit");
    if (button) {
      button.disabled = true;
      button.textContent = "正在连接…";
    }
    try {
      const result = await request(
        "/api/auth/" + (state.authMode === "register" ? "register" : "login"),
        "POST",
        { phone: state.phone, password: state.password },
      );
      if (generation !== epoch) return;
      token = result.token || "";
      state.password = "";
      state.confirm = "";
      accept(result);
      go("home");
    } catch (e) {
      state.formError = e.message;
      render();
    } finally {
      busy = false;
      if (state.route === "login") render();
    }
  }
  async function boot() {
    defaultLooks = JSON.parse(JSON.stringify(CAT_LOOK));
    empty();
    state.route = "login";
    render();
    if (native() && JSON.parse(AndroidBridge.getBackendConfig()).hasSession) {
      busy = true;
      try {
        accept(await request("/api/data"));
        go("home");
      } catch (e) {
        state.formError = "无法恢复登录：" + e.message;
        render();
      } finally {
        busy = false;
      }
    }
  }
  async function refresh() {
    if (!user) return;
    if (dirty || saving) {
      toast("请先完成数据保存");
      return;
    }
    try {
      const result = await request("/api/family/invite", "POST");
      state.invite = result.invite;
      render();
      toast("邀请码已在数据库更新");
    } catch (e) {
      toast(e.message);
    }
  }
  function screen() {
    return page(
      `${back("数据与同步")}<p class="sub">记录保存在电脑上的数据库中，请保持电脑服务运行。模型密钥仅保留本机。</p><div class="form-card">${inputField("服务地址", "backend-endpoint", "https://localhost:8787", endpoint(), 'type="url" autocomplete="url"')}</div><button class="btn ghost" id="save-backend" style="margin-top:16px" ${user || busy ? "disabled" : ""}>保存服务地址</button><p class="sub">${user ? "更换服务地址前请先退出账号。" : "本机联调使用 https://localhost:8787；手机不能直接连接 MySQL。"}</p>${user ? `<div class="card sync-panel"><p>${esc(failure || (dirty ? "有本机修改待保存" : "已保存到数据库"))}</p><div class="two-actions"><button class="btn" id="retry-cloud">重试保存</button><button class="btn ghost" id="reload-cloud">保留草稿并加载数据库</button></div><button class="linkish" id="export-cloud-draft">导出当前记录备份</button>${archive ? '<button class="linkish" id="export-cloud-archive">导出保留的草稿</button>' : ""}</div><div class="card sync-panel"><h3>旧版本本机记录</h3><p class="sub">导入会先将完整旧记录备份到当前账号，再把原主档案作为个人健康资料。仅允许导入到尚无修改的新家庭与个人档案。</p><button class="btn ghost" id="import-legacy">备份并导入旧本机记录</button><button class="linkish" id="export-legacy-cloud">下载数据库中的旧记录备份</button></div><div class="form-card">${inputField("家庭邀请码", "join-code", "输入6位邀请码", "", 'maxlength="6"')}</div><button class="btn ghost" id="join-family" style="margin-top:16px">加入家庭账本</button><p class="sub">只能从尚无数据、没有其他成员的新家庭加入。个人健康资料始终独立保存。</p><button class="btn ghost" id="cloud-logout" style="margin-top:24px">退出登录</button><button class="linkish" id="cloud-relogin" style="margin-top:18px">重新登录（保留待同步草稿）</button>` : ""}`,
    );
  }
  function download(value, name) {
    const text = JSON.stringify(value, null, 2);
    if (window.AndroidBridge?.exportData) {
      AndroidBridge.exportData(text);
      return;
    }
    const a = document.createElement("a");
    const url = URL.createObjectURL(
      new Blob([text], { type: "application/json" }),
    );
    a.href = url;
    a.download = name + ".json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function bind() {
    status();
    syncShared();
    const on = (id, fn) =>
      document.getElementById(id)?.addEventListener("click", async () => {
        if (busy) return;
        busy = true;
        try {
          await fn();
        } catch (e) {
          toast(e.message);
        } finally {
          busy = false;
        }
      });
    on("save-backend", () => {
      if (user) throw Error("请先退出登录");
      const value = field("backend-endpoint").replace(/\/+$/, "");
      const url = new URL(value);
      if (
        url.protocol !== "https:" ||
        url.username ||
        url.password ||
        url.search ||
        url.hash
      )
        throw Error("请填写有效HTTPS服务地址");
      if (native()) {
        const r = JSON.parse(AndroidBridge.setBackendEndpoint(value));
        if (r.error) throw Error(r.error);
      } else {
        localStorage.setItem("home-api-endpoint", value);
        token = "";
      }
      toast("服务地址已保存");
    });
    on("retry-cloud", async () => {
      failure = "";
      await pump();
      render();
    });
    on("reload-cloud", async () => {
      if (saving) throw Error("正在保存，请稍候");
      if (dirty)
        archive = { data: snapshot(), savedAt: new Date().toISOString() };
      storeCache();
      const result = await request("/api/data");
      accept(result, false);
      render();
      toast("已加载数据库记录，原草稿已保留");
    });
    on("export-cloud-draft", () => download(snapshot(), "家庭生活-当前记录"));
    on("export-cloud-archive", () => download(archive, "家庭生活-保留草稿"));
    on("export-legacy-cloud", async () =>
      download(await request("/api/legacy-backup"), "家庭生活-旧记录备份"),
    );
    on("import-legacy", async () => {
      if (dirty || saving) throw Error("请先完成当前数据保存");
      if (revisions.familyRevision !== 0 || revisions.personalRevision !== 0)
        throw Error("当前账号已有修改，不可覆盖导入");
      const legacy = JSON.parse(
        localStorage.getItem("family-life-data-v1") || "null",
      );
      if (!legacy) throw Error("没有找到旧版本本机记录");
      await request("/api/legacy-backup", "POST", legacy);
      const value = snapshot();
      for (const k of keys) if (legacy[k] !== undefined) value[k] = legacy[k];
      value.health = [legacy.health?.[0] || value.health[0]];
      value.health[0].records ||= [];
      value.health[0].meals ||= [];
      value.health[0].deletedMeals ||= [];
      if (legacy.categoryLooks) value.categoryLooks = legacy.categoryLooks;
      apply(value);
      persist();
      await pump();
      render();
      toast("旧记录已备份，导入状态请查看上方提示");
    });
    on("join-family", async () => {
      if (dirty || saving) throw Error("请先完成数据保存");
      accept(
        await request("/api/family/join", "POST", { code: field("join-code") }),
        false,
      );
      go("members");
    });
    on("cloud-logout", async () => {
      if (dirty || saving)
        throw Error("请先保存修改，或保留草稿并加载数据库后再退出");
      await request("/api/logout", "POST");
      epoch++;
      user = null;
      token = "";
      native() && AndroidBridge.clearBackendSession();
      empty();
      state.phone = "";
      state.password = "";
      state.confirm = "";
      go("login");
    });
    on("cloud-relogin", () => {
      if (saving) throw Error("正在保存，请稍候");
      storeCache();
      epoch++;
      user = null;
      token = "";
      if (native()) AndroidBridge.clearBackendSession();
      empty();
      state.password = "";
      state.confirm = "";
      state.authMode = "login";
      go("login");
    });
  }
  window.addEventListener("online", () => {
    if (dirty && !failure) pump();
    syncShared();
  });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      lastRefresh = 0;
      syncShared();
    }
  });
  setInterval(syncShared, 10000);
  return {
    syncShared,
    boot,
    empty,
    authenticate,
    persist,
    bind,
    screen,
    refresh,
    request,
    status,
    get user() {
      return user;
    },
    get active() {
      return !!user;
    },
    get pending() {
      return dirty || saving;
    },
  };
})();
