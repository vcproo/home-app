/* Presentation for 家庭生活. Money effects match domain/rules.py:
   expense and 人情随出 decrease balance and count as monthly expense;
   income and 人情收回 increase balance and count as monthly income;
   a manual balance edit changes the balance and adds no ledger row.
   Invite codes do not expire; refresh retires the previous code.
   Ledger rows are manual. Automatic source is reserved and unused. */
const SOURCE_MANUAL = "manual";
const PHONE_RE = /^\d{11}$/;
const PASSWORD_RE = /^[A-Za-z0-9!@#$%^&*()_+=.,?-]{6,16}$/;

const state = {
  route: "login",
  authMode: "login",
  tab: "home",
  statsTab: "month",
  statsKind: "expense",
  statsMonth: "2026-09",
  selectedCategories: [],
  navStack: [],
  modal: null,
  formValues: {},
  searchOpen: false,
  searchQuery: "",
  hideAmounts: false,
  formError: "",
  phone: "",
  password: "",
  confirm: "",
  showPassword: false,
  selectedDay: 24,
  invite: "F7K2M9",
  retiredInvites: [],
  ledger: [
    {
      id: 1,
      day: "9月24日 星期四",
      occurredOn: "2026-09-24",
      kind: "expense",
      category: "餐饮",
      title: "美食",
      member: "李明",
      time: "12:30",
      amount: 120,
      accountId: 1,
      source: SOURCE_MANUAL,
    },
    {
      id: 2,
      day: "9月24日 星期四",
      occurredOn: "2026-09-24",
      kind: "expense",
      category: "购物",
      title: "日用品",
      member: "王芳",
      time: "10:15",
      amount: 220,
      accountId: 2,
      source: SOURCE_MANUAL,
    },
    {
      id: 3,
      day: "9月23日 星期三",
      occurredOn: "2026-09-23",
      kind: "income",
      category: "工资",
      title: "9月工资",
      member: "李明",
      time: "09:00",
      amount: 28500,
      accountId: 1,
      source: SOURCE_MANUAL,
    },
  ],
  renqing: [
    {
      id: 1,
      day: "9月24日",
      occurredOn: "2026-09-24",
      name: "张伟",
      reason: "婚礼",
      side: "out",
      member: "李明",
      time: "18:30",
      note: "大学同学结婚",
      amount: 800,
      accountId: 1,
      source: SOURCE_MANUAL,
    },
    {
      id: 2,
      day: "9月24日",
      occurredOn: "2026-09-24",
      name: "王芳",
      reason: "满月酒",
      side: "in",
      member: "王芳",
      time: "12:20",
      note: "宝宝满月回礼",
      amount: 600,
      accountId: 1,
      source: SOURCE_MANUAL,
    },
  ],
  accounts: [
    {
      id: 1,
      name: "招商银行储蓄卡",
      type: "储蓄卡",
      bank: "招商银行",
      last4: "4532",
      balance: 45000,
      counted: true,
    },
    {
      id: 2,
      name: "支付宝",
      type: "支付宝",
      bank: "",
      last4: "",
      balance: 12340.5,
      counted: true,
      hint: "余额及余额宝",
    },
    {
      id: 3,
      name: "微信零钱",
      type: "微信",
      bank: "",
      last4: "",
      balance: 800,
      counted: true,
      hint: "零钱通",
    },
    {
      id: 4,
      name: "备用现金",
      type: "现金",
      bank: "",
      last4: "",
      balance: 2000,
      counted: false,
      hint: "不计入总额",
    },
  ],
  categories: {
    expense: ["餐饮", "购物", "交通", "住房", "娱乐", "其他支出"],
    income: ["工资", "奖金", "其他收入"],
  },
  houses: [
    {
      id: 1,
      name: "滨江花园",
      status: "当前居住",
      water: "3100 5678 9021",
      power: "3301 2088 7654",
      gas: "HZ 5908 1120",
    },
    {
      id: 2,
      name: "城西公寓",
      status: "出租中",
      water: "3100 4455 8102",
      power: "3301 1042 3348",
      gas: "HZ 4302 7751",
    },
  ],
  addresses: [
    {
      id: 1,
      name: "家",
      detail: "杭州市滨江区江南大道 888 号\n滨江花园 3 幢 1202 室",
      def: true,
    },
    {
      id: 2,
      name: "公司",
      detail: "杭州市西湖区文三路 478 号\n华星时代广场 A 座 16 层",
      def: false,
    },
  ],
  health: [
    {
      name: "李明",
      sex: "男",
      height: 178,
      weight: 72.6,
      delta: -0.8,
      records: [
        { w: 72.6, day: "2026年9月24日", d: -0.4 },
        { w: 73.0, day: "2026年9月12日", d: -0.2 },
      ],
    },
    {
      name: "王芳",
      sex: "女",
      height: 165,
      weight: 54.2,
      delta: -0.3,
      records: [{ w: 54.2, day: "2026年9月20日", d: -0.3 }],
    },
  ],
  members: [
    { name: "李明", role: "管理员", desc: "我，可管理家庭与成员" },
    { name: "王芳", role: "成员", desc: "可查看和记录账目" },
    { name: "乐乐", role: "成员", desc: "可查看和记录账目" },
    { name: "李欣", role: "成员", desc: "可查看和记录账目" },
  ],
  draft: {},
  categoryKind: "expense",
};

function money(n) {
  return Number(n).toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
function esc(s) {
  return String(s == null ? "" : s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
}
const PATHS = {
  plus: '<path d="M12 5v14M5 12h14"/>',
  back: '<path d="m14 6-6 6 6 6"/>',
  right: '<path d="m9 6 6 6-6 6"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  users:
    '<circle cx="9" cy="7" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M16 4a3 3 0 0 1 0 6M18 14a5 5 0 0 1 3 4v2"/>',
  phone:
    '<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 19h2"/>',
  eye: '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  "eye-off":
    '<path d="m3 3 18 18M10.6 5.1 12 5c7 0 10 7 10 7s-.9 2-2.7 3.8M6.2 6.2C3.3 8.3 2 12 2 12s3 7 10 7c1.7 0 3.2-.4 4.5-1"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',
  edit: '<path d="m15 4 5 5M4 20l5-1L21 7a2 2 0 0 0-4-4L5 15z"/>',
  delete: '<path d="M8 5h13v14H8L2 12zM11 9l6 6M17 9l-6 6"/>',
  copy: '<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V3H3v13h5"/>',
  share:
    '<circle cx="18" cy="5" r="3"/><circle cx="5" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8 11 7-4M8 13l7 4"/>',
  refresh: '<path d="M20 7a9 9 0 1 0 1 9M20 2v6h-6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
  ticket:
    '<path d="M3 5h18v5a2 2 0 0 0 0 4v5H3v-5a2 2 0 0 0 0-4zM9 8h6M9 12h3"/>',
  building:
    '<rect x="5" y="3" width="14" height="18" rx="1"/><path d="M9 7h1M14 7h1M9 11h1M14 11h1M9 15h1M14 15h1M10 21v-3h4v3"/>',
  category:
    '<rect x="9" y="2" width="6" height="6" rx="1"/><rect x="2" y="16" width="6" height="6" rx="1"/><rect x="16" y="16" width="6" height="6" rx="1"/><path d="M12 8v4H5v4M12 12h7v4"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  navigation: '<path d="m21 3-7 18-3-8-8-3z"/>',
  shield: '<path d="m12 2 8 4v6c0 5-8 10-8 10S4 17 4 12V6zM9 12l2 2 4-5"/>',
  settings:
    '<circle cx="12" cy="12" r="3"/><path d="m9 3 6 0 1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1z"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 1 1 5 2c-1 1-2 1-2 3M12 17h.01"/>',
  inbox: '<path d="m5 5-3 9v6h20v-6l-3-9zM2 14h6l2 3h4l2-3h6"/>',
  book: '<path d="M12 5c-3-2-6-2-10-1v16c4-1 7-1 10 1 3-2 6-2 10-1V4c-4-1-7-1-10 1v16"/>',
  grip: '<path d="M9 5h.01M15 5h.01M9 10h.01M15 10h.01M9 15h.01M15 15h.01M9 20h.01M15 20h.01"/>',
  home: '<path d="M3 10.5 12 3l9 7.5V20a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
  chart:
    '<path d="M11 3a9 9 0 1 0 10 10H11z"/><path d="M14 2v8h8a9 9 0 0 0-8-8z"/>',
  card: '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18"/>',
  user: '<circle cx="12" cy="8" r="3"/><path d="M5 19c1.4-3 4-4.5 7-4.5S17.6 16 19 19"/>',
  fork: '<path d="M3 2v7a2 2 0 0 0 4 0V2M5 2v20M14 2c-4 4-4 10 0 10h3M17 2v20"/>',
  bag: '<path d="M2 9h20M4 9l2 11h12l2-11M6 9l4-7M18 9l-4-7M9 12v5M15 12v5"/>',
  car: '<path d="M4 16h16v-4l-2-5H6L4 12z"/><circle cx="7.5" cy="16.5" r="1.4"/><circle cx="16.5" cy="16.5" r="1.4"/>',
  house: '<path d="M4 11 12 4l8 7v9H4z"/>',
  game: '<rect x="3" y="8" width="18" height="10" rx="4"/><path d="M8 13h3M9.5 11.5v3M16 12h.01M18 14h.01"/>',
  shirt:
    '<path d="M8 6 4 8l2 4 2-1v9h8v-9l2 1 2-4-4-2"/><path d="M9 6a3 3 0 0 0 6 0"/>',
  med: '<path d="M8 4v4M6 6h4M14 14a5 5 0 1 0 0-7 5 5 0 0 0 0 7zM12 20h6"/>',
  cap: '<path d="M3 10 12 6l9 4-9 4z"/><path d="M7 12v3c2 2 8 2 10 0v-3"/>',
  plane: '<path d="M3 13l18-6-6 14-3-6z"/>',
  more: '<circle cx="6" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="18" cy="12" r="1.2"/>',
  gift: '<rect x="4" y="10" width="16" height="10" rx="1"/><path d="M4 14h16M12 10v10M12 10c-2-3-6-2-5 0h5c2-3 6-2 5 0h-5"/>',
  pin: '<path d="M12 21s6-5.2 6-10a6 6 0 1 0-12 0c0 4.8 6 10 6 10z"/><circle cx="12" cy="11" r="2"/>',
  heart:
    '<path d="M12 19s-7-4.4-7-9a4 4 0 0 1 7-2 4 4 0 0 1 7 2c0 4.6-7 9-7 9z"/>',
  bell: '<path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15z"/><path d="M10 18a2 2 0 0 0 4 0"/>',
  search: '<circle cx="11" cy="11" r="6"/><path d="M20 20l-3.5-3.5"/>',
  leaf: '<path d="M5 19C8 8 16 5 20 4c-1 8-6 14-15 15 2-3 4-5 8-7"/>',
  chat: '<path d="M5 6h14v9H8l-3 3z"/>',
  wallet:
    '<path d="M20 8V4H5a2 2 0 0 0 0 4h16v13H5a2 2 0 0 1-2-2V6"/><path d="M21 12h-5v5h5M17 14.5h.01"/>',
  cash: '<rect x="3" y="7" width="18" height="11" rx="2"/><circle cx="12" cy="12.5" r="2"/>',
};
const CAT_LOOK = {
  餐饮: ["fork", "#FDECEA", "#D4534A"],
  购物: ["bag", "#F8E8D8", "#D9892F"],
  交通: ["car", "#E7F0FA", "#4E86E0"],
  住房: ["house", "#EEE8F8", "#7A64D6"],
  娱乐: ["game", "#E5F6EA", "#2E9A5B"],
  其他支出: ["more", "#F1F0EC", "#7E8681"],
  工资: ["card", "#E5F6EA", "#1F8A4C"],
  奖金: ["gift", "#F8E8D8", "#D9892F"],
  其他收入: ["more", "#F1F0EC", "#7E8681"],
  人情: ["gift", "#FDECEA", "#D4534A"],
  宠物: ["heart", "#FDECEA", "#D4534A"],
};
function svg(name, size, color) {
  return `<svg width="${size || 22}" height="${size || 22}" viewBox="0 0 24 24" fill="none" stroke="${color || "currentColor"}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${PATHS[name] || PATHS.more}</svg>`;
}
function chip(name, bg, color) {
  return `<span class="glyph" style="background:${bg || "#E7EFEA"};color:${color || "#1F4D3A"}">${svg(name, 23, color || "#1F4D3A")}</span>`;
}
function catChip(name) {
  const look = CAT_LOOK[name] || ["more", "#F1F0EC", "#5C6560"];
  if (look[3])
    return `<span class="glyph" style="background:${look[1]}"><img class="category-custom-image" data-address-photo="${look[3]}" alt="${esc(name)}图标"/></span>`;
  return chip(look[0], look[1], look[2]);
}

const CURRENT_MONTH =
  typeof CloudSync !== "undefined" ? healthToday().slice(0, 7) : "2026-09";

function inCurrentMonth(row) {
  return String(row.occurredOn || "").slice(0, 7) === CURRENT_MONTH;
}
function monthTotals() {
  let expense = 0;
  let income = 0;
  state.ledger.forEach((row) => {
    if (row.renqingId || !inCurrentMonth(row)) return;
    if (row.kind === "expense") expense += Number(row.amount);
    else income += Number(row.amount);
  });
  state.renqing.forEach((row) => {
    if (!inCurrentMonth(row)) return;
    if (row.side === "out") expense += Number(row.amount);
    else income += Number(row.amount);
  });
  return { expense, income, surplus: income - expense };
}
function occurredOn(value) {
  const text = String(value || "");
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : "";
}
function dayLabel(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
  if (!match) return value || "9月24日";
  return Number(match[2]) + "月" + Number(match[3]) + "日";
}
function accountOf(id) {
  return state.accounts.find((a) => a.id === id);
}
function personalTotal() {
  return state.accounts
    .filter((a) => a.counted)
    .reduce((s, a) => s + Number(a.balance), 0);
}

function go(route, draft) {
  if (
    typeof CloudSync !== "undefined" &&
    CloudSync.active &&
    !CloudSync.user.familyId &&
    route !== "cloud-settings"
  )
    route = "family-setup";
  if (
    typeof CloudSync !== "undefined" &&
    !CloudSync.active &&
    !["login", "cloud-settings"].includes(route)
  )
    route = "login";
  if (
    typeof foodPhoto !== "undefined" &&
    state.route === "food-photo" &&
    route !== "food-photo"
  ) {
    rememberFoodEdits();
    cancelFoodRequest();
  }
  if (
    typeof foodPhoto !== "undefined" &&
    route === "food-photo" &&
    state.route !== "model-settings"
  )
    foodPhoto = null;
  if (route === "meal-form" && !draft)
    draft = {
      healthIndex: 0,
    };
  const roots = ["home", "assets", "health", "mine"];
  const old = state.route;
  if (old !== route) {
    if (roots.includes(route)) {
      state.navStack = [];
      state.tab = route;
    } else {
      state.navStack ||= [];
      const ancestor = state.navStack.map((p) => p.route).lastIndexOf(route);
      if (ancestor >= 0) state.navStack = state.navStack.slice(0, ancestor);
      else
        state.navStack.push({
          route: old,
          draft: JSON.parse(JSON.stringify(state.draft)),
          scroll: typeof window !== "undefined" ? window.scrollY : 0,
        });
    }
    state.searchOpen = false;
    state.searchQuery = "";
    state.formValues = {};
    if (
      [
        "ledger",
        "renqing-add",
        "category-add",
        "account-form",
        "house-add",
        "address-add",
      ].includes(route)
    )
      state.draft = draft || {};
  }
  if (draft) state.draft = draft;
  state.route = route;
  state.formError = "";
  state.modal = null;
  persistState();
  render();
  if (typeof window !== "undefined") window.scrollTo(0, 0);
}

function toast(message) {
  if (typeof document === "undefined") return;
  if (
    typeof CloudSync !== "undefined" &&
    CloudSync.pending &&
    /已保存|保存成功/.test(message)
  )
    message = "修改已记录，数据库保存状态请查看页面提示";
  let el = document.getElementById("app-toast");
  if (el) el.remove();
  el = document.createElement("div");
  el.id = "app-toast";
  el.className = "toast";
  el.setAttribute("role", "status");
  el.textContent = message;
  document.body.appendChild(el);
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.remove(), 2200);
}

function tabs(active) {
  return `<nav class="tabs" aria-label="主导航">${[
    ["home", "home", "首页"],
    ["assets", "wallet", "资产"],
    ["health", "heart", "健康"],
    ["mine", "user", "我的"],
  ]
    .map(
      ([id, icon, label]) =>
        `<button data-go="${id}" class="${id === active ? "on" : ""}" aria-current="${id === active ? "page" : "false"}">${svg(icon, 22)}<span>${label}</span></button>`,
    )
    .join("")}</nav>`;
}

function page(inner, active, cls = "") {
  return `<main class="screen route-${state.route} ${active ? "" : "no-tabs"} ${cls}"><div class="scroll">${typeof CloudSync !== "undefined" ? '<button id="cloud-status" class="cloud-status" hidden aria-live="polite"></button>' : ""}${inner}</div>${active ? tabs(active) : ""}</main>`;
}

function back(title, extra = "", close = false) {
  return `<header class="top center"><button class="icon-btn" data-back aria-label="${close ? "关闭" : "返回"}">${svg(close ? "close" : "back", 20)}</button><h1>${esc(title)}</h1><div>${extra}</div></header>`;
}

function screenLogin() {
  const reg = state.authMode === "register";
  return `<main class="screen route-login ${reg ? "auth-register" : ""}"><div class="auth-scroll"><div class="brand"><div class="mark">${svg("home", reg ? 28 : 32)}</div><h1 class="word">家庭生活</h1><p class="slogan">认真生活，也认真记录每一份安心。</p></div>
  <form class="card auth-card" id="auth-form" novalidate><div class="seg" role="tablist" aria-label="登录或注册"><button type="button" data-auth="login" class="${reg ? "" : "on"}">登录</button><button type="button" data-auth="register" class="${reg ? "on" : ""}">注册</button></div>
  <label class="field" for="phone">手机号</label><input class="input" id="phone" inputmode="numeric" autocomplete="tel" maxlength="11" placeholder="请输入11位手机号" value="${esc(state.phone)}"/>
  <label class="field" for="password">密码</label><div class="password-wrap"><input class="input" id="password" type="${state.showPassword ? "text" : "password"}" autocomplete="${reg ? "new-password" : "current-password"}" maxlength="16" placeholder="${reg ? "请设置密码" : "请输入密码"}" value="${esc(state.password)}"/><button type="button" id="toggle-password" aria-label="${state.showPassword ? "隐藏密码" : "显示密码"}">${svg(state.showPassword ? "eye-off" : "eye", 20)}</button></div>
  ${reg ? `<label class="field" for="confirm">确认密码</label><input class="input" id="confirm" type="password" autocomplete="new-password" placeholder="请再次输入密码" value="${esc(state.confirm)}"/>` : ""}
  <p class="help">${reg ? "6" : "密码为 6"}–16 位，由数字和字母组成，也可以包含常见符号（如 ! @ # . _ -）。</p><div class="err" role="alert">${esc(state.formError)}</div><button class="btn" id="auth-submit" type="submit">${reg ? "注册" : "登录"}</button></form>
  <p class="foot">${reg ? "注册即表示同意《用户协议》和《隐私政策》" : '还没有账号？<button data-auth="register">去注册</button>'}</p>${typeof CloudSync !== "undefined" ? '<p class="foot"><button data-go="cloud-settings">设置数据库服务地址</button></p>' : ""}</div></main>`;
}

function screenHome() {
  const t = monthTotals();
  return page(
    `<header class="top"><h1>${CURRENT_MONTH.slice(0, 4)}年${Number(CURRENT_MONTH.slice(5))}月</h1><button class="icon-btn round" data-go="members" aria-label="家庭成员">${svg("users", 21)}</button></header>
  <div class="banner">${svg("leaf", 15)}认真生活，也认真记录每一份安心。</div>
  <div class="summary"><div class="k">本月结余</div><div class="hero">${money(t.surplus)}</div><div class="split"><div><div class="k"><i class="dot g"></i>本月收入</div><div class="amt">${money(t.income)}</div></div><div><div class="k"><i class="dot r"></i>本月支出</div><div class="amt">${money(t.expense)}</div></div></div></div>
  ${section("近一周流水", '<button data-go="ledger-all">查看全部</button>')}${transactionList(allLedgerRows().filter(inCurrentMonth).slice(0, 12))}${fab("ledger")}`,
    "home",
  );
}

function donut(slices, center = "年度支出", amount = "¥146,320", count = "") {
  let cursor = 0;
  const parts = slices
    .map((s) => {
      const start = cursor;
      cursor += s.pct;
      return `${s.color} ${start}% ${cursor}%`;
    })
    .join(",");
  return `<div class="donut" style="background:${slices.length ? `conic-gradient(${parts})` : "#eef1ec"}" role="img" aria-label="${esc(center + " " + amount)}"><i><span>${center}</span><b>${amount}</b><span>${count}</span></i></div>`;
}

function screenStats() {
  const tab = state.statsTab,
    rows = selectedPeriodRows(),
    t = statTotals(rows),
    kind = state.statsKind || "expense";
  const header = "";
  let body = "";
  if (tab === "category") {
    const slices = slicesFor(rows, kind);
    const total = t[kind];
    body = `${selectionTabs()}${statsMonthNav()}<div class="seg chart-seg" aria-label="收支类型"><button data-stat-kind="expense" class="${kind === "expense" ? "on" : ""}">支出统计</button><button data-stat-kind="income" class="${kind === "income" ? "on" : ""}">收入统计</button></div><div class="donut-card">${donut(slices, kind === "expense" ? "分类支出" : "分类收入", "¥" + money(total), slices.length + " 个分类")}</div>${section("分类排行", '<span class="sub">金额 · 占比 · 笔数</span>')}<div class="list-card">${slices.map((s) => `<button class="category-ranking" data-category-detail="${esc(s.name)}">${catChip(s.name)}<span class="grow"><b>${esc(s.name)}</b><span class="rank-track"><i style="width:${s.pct}%;background:${s.color}"></i></span><span class="sub">${rows.filter((r) => r.kind === kind && r.category === s.name).length} 笔 · ${s.pct.toFixed(1)}%</span></span><b>¥${money(s.value)}</b>${svg("right", 14)}</button>`).join("") || '<p class="sub empty-ranking">本月暂无分类记录</p>'}</div>`;
  } else if (tab === "year") {
    const year = (state.statsMonth || "2026-09").slice(0, 4),
      yr = allLedgerRows().filter((r) => r.occurredOn.startsWith(year)),
      yt = statTotals(yr),
      slices = slicesFor(yr, "expense");
    const months = [...new Set(yr.map((r) => r.occurredOn.slice(0, 7)))]
      .sort()
      .reverse();
    body = `<p class="sub" style="text-align:center;margin-top:-16px">${year}年 · 支出结构</p>${selectionTabs()}${section("年度支出分类", '<button data-go="category-flow">点击分类查看流水</button>')}<p class="sub" style="margin-top:-12px;margin-bottom:12px">共 ${yr.filter((r) => r.kind === "expense").length} 笔支出流水</p><div class="donut-card">${donut(slices, "年度支出", "¥" + money(yt.expense), slices.length + " 个分类")}<div class="legend">${slices.map((s) => `<span><i class="dot" style="background:${s.color}"></i>${s.name} ${Math.round(s.pct)}%</span>`).join("")}</div></div>${section("月度数据", '<span class="sub">收入 · 支出 · 结余</span>')}<div class="list-card">${
      months
        .map((m, i) => {
          const mr = yr.filter((r) => r.occurredOn.startsWith(m)),
            mt = statTotals(mr);
          return `<div class="month-row"><span class="month-avatar">${Number(m.slice(5))}月</span><span class="grow"><span class="title">收入 ¥${money(mt.income)}</span><span class="sub" style="display:block">支出 ¥${money(mt.expense)} · ${mr.length}笔</span></span><span class="pos">${mt.income >= mt.expense ? "+" : ""}${money(mt.income - mt.expense)}</span></div>`;
        })
        .join("") || '<p class="sub" style="padding:20px">本年暂无数据</p>'
    }</div>`;
  } else if (tab === "calendar") {
    const [y, m] = (state.statsMonth || "2026-09").split("-").map(Number),
      len = new Date(y, m, 0).getDate(),
      offset = (new Date(y, m - 1, 1).getDay() + 6) % 7;
    let cells =
      ["一", "二", "三", "四", "五", "六", "日"]
        .map((d) => `<span class="hd">${d}</span>`)
        .join("") + "<span></span>".repeat(offset);
    for (let n = 1; n <= len; n++) {
      const date = `${y}-${String(m).padStart(2, "0")}-${String(n).padStart(2, "0")}`,
        dt = statTotals(rows.filter((r) => r.occurredOn === date));
      cells += `<button class="cell ${n === state.selectedDay ? "on" : ""}" data-day="${n}" aria-label="${m}月${n}日" aria-pressed="${n === state.selectedDay}"><b>${n}</b>${dt.expense ? `<div class="e">-${dt.expense}</div>` : ""}${dt.income ? `<div class="i">+${dt.income}</div>` : ""}</button>`;
    }
    const dr = rows.filter(
        (r) => Number(r.occurredOn.slice(-2)) === state.selectedDay,
      ),
      dt = statTotals(dr);
    body = `${selectionTabs()}<div class="card calendar-card">${statsMonthNav()}<div class="cal">${cells}</div></div>${section(`${m}月${state.selectedDay}日`, `<span class="sub">支出 ${money(dt.expense)}<br/>收入 ${money(dt.income)}</span>`)}${transactionList(dr, false)}`;
  } else if (tab === "members") {
    const members = [...new Set(allLedgerRows().map((r) => r.member))];
    const group = (k) =>
      `<div class="list-card">${members
        .map((name, i) => {
          const mr = rows.filter((r) => r.member === name && r.kind === k),
            sum = mr.reduce((a, r) => a + r.amount, 0),
            max = Math.max(
              1,
              ...members.map((n) =>
                rows
                  .filter((r) => r.member === n && r.kind === k)
                  .reduce((a, r) => a + r.amount, 0),
              ),
            );
          return `<div class="row-card">${chip(k === "expense" ? "user" : "wallet", ["#eaf3ed", "#fdf0e4", "#eef1fb"][i % 3], ["#578e76", "#c98d54", "#7092c4"][i % 3])}<div class="grow"><div class="title">${esc(name)}</div><div class="bar"><i style="width:${(sum / max) * 100}%"></i></div><div class="sub">共 ${mr.length} 笔 · ${[...new Set(mr.map((r) => r.category))].join("、") || "暂无记录"}</div></div><span class="${k === "income" ? "pos" : "neg"}">¥${money(sum)}</span></div>`;
        })
        .join("")}</div>`;
    body = `${selectionTabs()}${statsMonthNav()}<div class="pair"><div class="summary"><div class="k">家庭支出</div><div class="amt">¥${money(t.expense)}</div></div><div class="summary"><div class="k">家庭收入</div><div class="amt">¥${money(t.income)}</div></div></div><div class="banner" style="margin-top:16px">成员统计用于了解家庭流水构成，金额按流水记录人汇总。</div>${section("成员支出")}${group("expense")}${section("成员收入")}${group("income")}`;
  } else if (tab === "surplus") {
    const year = (state.statsMonth || "2026-09").slice(0, 4),
      yr = allLedgerRows().filter((r) => r.occurredOn.startsWith(year)),
      yt = statTotals(yr);
    const vals = Array.from({ length: 12 }, (_, i) => {
        const mt = statTotals(
          yr.filter((r) => Number(r.occurredOn.slice(5, 7)) === i + 1),
        );
        return mt.income - mt.expense;
      }),
      max = Math.max(1, ...vals.map(Math.abs));
    body = `${selectionTabs()}${statsMonthNav(true)}<div class="summary" style="background:var(--forest);color:white"><div class="sub" style="color:#d5e3d9">年度累计结余</div><div class="hero" style="color:white">¥ ${money(yt.income - yt.expense)}</div></div><div class="card" style="margin-top:20px"><h3>月度结余</h3><svg class="chart" viewBox="0 0 320 170" role="img" aria-label="月度结余柱状图">${vals.map((v, i) => `<rect x="${i * 26 + 5}" y="${140 - (Math.abs(v) / max) * 110}" width="15" height="${Math.max(1, (Math.abs(v) / max) * 110)}" rx="3" fill="${v < 0 ? "#d45e5c" : "#288876"}"/><text x="${i * 26 + 12}" y="163" text-anchor="middle">${i + 1}月</text>`).join("")}</svg></div>${section("结余明细")}<div class="list-card">${vals.map((v, i) => `<div class="kv"><span>${i + 1}月结余</span><b class="${v >= 0 ? "pos" : "neg"}">${money(v)}</b></div>`).join("")}</div>`;
  } else {
    const slices = slicesFor(rows, kind),
      selected = state.selectedCategories || [],
      chosen = slices.filter((s) => selected.includes(s.name)),
      total = slices.reduce((n, s) => n + s.value, 0);
    body = `${selectionTabs()}${statsMonthNav()}<div class="pair"><div class="summary"><div class="k"><i class="dot r"></i>本月支出</div><div class="amt">¥ ${money(t.expense)}</div><div class="sub">共 ${rows.filter((r) => r.kind === "expense").length} 笔</div></div><div class="summary"><div class="k"><i class="dot g"></i>本月收入</div><div class="amt">¥ ${money(t.income)}</div><div class="sub">共 ${rows.filter((r) => r.kind === "income").length} 笔</div></div></div><div class="seg chart-seg"><button data-stat-kind="expense" class="${kind === "expense" ? "on" : ""}">支出统计</button><button data-stat-kind="income" class="${kind === "income" ? "on" : ""}">收入统计</button></div><div class="donut-card">${section(kind === "expense" ? "支出分类" : "收入分类", '<button id="select-all">清除选择</button>')}<div class="sub">可同时选择多个分类</div>${donut(slices, "已选择", chosen.length + " 类", Math.round((chosen.reduce((n, s) => n + s.value, 0) / (total || 1)) * 100) + "%")}<div class="checks">${slices.map((s) => `<button data-select-category="${esc(s.name)}" aria-pressed="${selected.includes(s.name)}"><span class="check ${selected.includes(s.name) ? "on" : ""}" style="--check:${s.color}">${selected.includes(s.name) ? "✓" : ""}</span>${esc(s.name)} ${Math.round(s.pct)}%</button>`).join("")}</div></div>${section("分类流水", '<button data-go="category-flow">全部流水 ' + svg("right", 12) + "</button>")}${transactionList(
      rows.filter(
        (r) =>
          r.kind === kind &&
          (!selected.length || selected.includes(r.category)),
      ),
      false,
    )}`;
  }
  return page(
    `<header class="top subpage-toolbar"><button class="icon-btn" data-back aria-label="返回">${svg("back", 20)}</button></header>` +
      header +
      body,
  );
}

function screenAssetHub() {
  const totals = monthTotals();
  const entries = [
    ["ledger-all", "book", "记账", "查看收支流水，记录每一笔生活开销"],
    ["stats", "chart", "统计分析", "月度、年度、分类及成员收支统计"],
    ["accounts", "wallet", "账户资产", "查看账户余额，管理家庭资产"],
  ];
  return page(
    `<div class="module-intro"><span class="module-symbol">${svg("wallet", 28)}</span><div><h2>家庭资产</h2><p class="sub">记账、统计与账户，一处管理</p></div></div><div class="summary"><div class="k">本月结余</div><div class="hero">${money(totals.surplus)}</div><div class="split"><div><div class="k">本月收入</div><div class="amt pos">${money(totals.income)}</div></div><div><div class="k">本月支出</div><div class="amt neg">${money(totals.expense)}</div></div></div></div><button class="btn module-record" data-go="ledger">${svg("plus", 18)}记一笔</button><div class="module-entries">${entries.map(([route, icon, title, desc]) => `<button class="module-entry" data-go="${route}">${chip(icon === "book" ? "inbox" : icon)}<span class="grow"><span class="title">${title}</span><span class="sub">${desc}</span></span>${svg("right", 16)}</button>`).join("")}</div>`,
    "assets",
  );
}

function screenAssets() {
  const personal = personalTotal(),
    family = personal;
  const m = (n) => (state.hideAmounts ? "••••••" : money(n));
  const rows = state.accounts.filter(
    (a) => !state.searchQuery || a.name.includes(state.searchQuery),
  );
  return page(
    `<header class="top subpage-toolbar"><button class="icon-btn" data-back aria-label="返回">${svg("back", 20)}</button><button class="icon-btn round" id="search" aria-label="搜索账户">${svg("search", 20)}</button></header>${searchField()}
  <div class="summary asset-summary"><button class="k" id="hide-amounts">家庭总资产 ${svg(state.hideAmounts ? "eye-off" : "info", 12)}</button><div class="hero">${m(family)}</div><div class="split"><div><div class="k">我的个人资产</div><div class="amt">${m(personal)}</div></div><span class="glyph" style="background:#f0f5f1;border-radius:50%">${svg("wallet", 20, "#507469")}</span></div></div>
  <button class="btn ghost asset-add" data-go="account-form">${svg("plus", 16)}添加新账户</button>${section("我的账户")}
  <div class="list-card">${rows.map((a) => `<button class="tx asset-row" data-account="${a.id}">${chip(a.type === "微信" ? "chat" : a.type === "支付宝" ? "phone" : a.type === "现金" ? "cash" : "card")}<div class="grow"><div class="title">${esc(a.name)}</div><div class="sub">${esc(a.hint || (a.last4 ? "尾号 " + a.last4 : a.type))}<span class="tag">${a.counted ? "计入总资产" : "未计入"}</span></div></div><span class="neg">${m(a.balance)}</span></button>`).join("") || '<p class="sub" style="padding:24px">未找到匹配账户</p>'}</div>`,
    null,
  );
}

function screenAccountForm() {
  const d = state.draft.account || {
    type: "储蓄卡",
    name: "",
    bank: "",
    last4: "",
    balance: "",
    counted: true,
  };
  return page(`${back(d.id ? "编辑账户" : "账户信息", "", !d.id)}<div class="form-card">
  <div class="form-field"><span>账户类型</span><button id="account-type" style="display:flex;width:100%;justify-content:space-between">${esc(d.type)}${svg("down", 16)}</button></div>
  ${inputField("账户名称", "acc-name", "如：招商银行工资卡", d.name)}
  ${inputField("开户银行（选填）", "acc-bank", "选填", d.bank)}
  ${inputField("卡号后四位", "acc-last4", "选填，用于区分", d.last4, 'maxlength="4" inputmode="numeric"')}
  ${inputField("当前余额", "acc-balance", "¥ 0.00", d.balance, 'inputmode="decimal"')}
  </div><div class="card toggle-card"><div><div class="title">计入总资产</div><div class="sub">开启后，该账户余额将计入家庭或个人总资产</div></div><button class="switch ${d.counted ? "on" : ""}" id="acc-count" role="switch" aria-label="计入总资产" aria-checked="${d.counted}"><i></i></button></div>${action("保存账户", "save-account")}`);
}

function screenAccountDetail() {
  const a = accountOf(state.draft.accountId) || state.accounts[0];
  if (!a) return emptyAccountPage();
  let rows = state.ledger.filter((r) => r.accountId === a.id);
  if (state.flowFilter && state.flowFilter !== "all")
    rows = rows.filter((r) => r.kind === state.flowFilter);
  return page(
    `${back("账户详情")}<div class="summary"><div class="detail-head">${chip("card")}<span class="sub">${esc(a.bank || a.type)} ${esc(a.type)}</span><button id="edit-account">${svg("edit", 12)} 编辑</button></div><h2>${esc(a.name)}</h2><div class="k" style="margin-top:22px">当前余额</div><div class="hero">${money(a.balance)}</div><div class="sub">尾号 **** ${esc(a.last4 || "—")} · ${a.counted ? "计入总资产" : "未计入总资产"}</div></div>${section("账户流水", '<button id="filter">筛选</button>')}${transactionList(rows)}`,
  );
}

function screenCategories() {
  const kind = state.categoryKind === "income" ? "income" : "expense";
  const list = state.categories[kind];
  const row = (name) =>
    `<button class="tx" data-cat="${esc(name)}">${catChip(name)}<span class="grow"><span class="title">${esc(name)}</span><span class="sub" style="display:block">本月 ${state.ledger.filter((r) => r.category === name).length} 笔</span></span><span style="color:#bdc4b9">${svg("grip", 16)}</span>${svg("right", 16)}</button>`;
  return page(
    `${back("分类管理", '<button class="linkish" id="sort">排序</button>')}<div class="seg"><button class="${kind === "expense" ? "on" : ""}" data-cat-kind="expense">支出分类</button><button class="${kind === "income" ? "on" : ""}" data-cat-kind="income">收入分类</button></div><div class="group">${kind === "income" ? "收入分类" : "常用分类"}</div><div class="list-card">${list
      .filter((n) => !n.startsWith("其他"))
      .map(row)
      .join("")}</div>${
      list.some((n) => n.startsWith("其他"))
        ? `<div class="group">其他</div><div class="list-card">${list
            .filter((n) => n.startsWith("其他"))
            .map(row)
            .join("")}</div>`
        : ""
    }${fab("category-add")}`,
    "mine",
  );
}

function screenCategoryEdit() {
  return categoryEditor(true);
}

function screenCategoryFlow() {
  const selected = state.selectedCategories || [],
    kind = state.statsKind || "expense",
    rows = selectedPeriodRows().filter(
      (r) =>
        r.kind === kind && (!selected.length || selected.includes(r.category)),
    ),
    sum = rows.reduce((n, r) => n + r.amount, 0);
  return page(
    `${back("分类流水")}<p class="sub" style="text-align:center;margin-top:-14px">本月 · ${kind === "expense" ? "支出" : "收入"}明细</p>${selectionTabs()}<div class="summary"><div class="k">已选分类${kind === "expense" ? "支出" : "收入"}</div><div class="hero">¥ ${money(sum)}</div><p class="sub">${selected.length ? selected.map(esc).join("、") : "全部分类"} 共 ${rows.length} 笔</p></div>${section("流水", '<button id="sort-flow">金额排序 ' + svg("down", 12) + "</button>")}${transactionList(state.amountSort ? rows.slice().sort((a, b) => b.amount - a.amount) : rows)}`,
    "stats",
  );
}

function screenCategoryAdd() {
  return categoryEditor(false);
}

function emptyAccountPage() {
  return page(
    `${back("先添加账户")}<p class="empty-ranking sub">记账需要一个收支账户。保存账户后，将自动返回继续填写。</p><button class="btn" data-go="account-form">添加账户并继续</button>`,
  );
}

function screenLedger() {
  if (!state.accounts.length) return emptyAccountPage();
  const d = state.draft,
    expense = d.kind !== "income",
    names = [
      ...new Set([
        ...state.categories[expense ? "expense" : "income"],
        ...(d.category ? [d.category] : []),
      ]),
    ];
  const cat = names.includes(d.category) ? d.category : names[0],
    aid = d.accountId || state.accounts[0].id;
  return page(
    `${back(d.editId != null ? "修改流水" : "添加流水", "", true)}<div class="seg"><button data-kind="expense" class="${expense ? "on" : ""}">支出</button><button data-kind="income" class="${expense ? "" : "on"}">收入</button></div>
  <div class="form-card"><label class="kv"><span>日期</span><input type="date" id="led-date" value="${esc(d.ledDate || (typeof CloudSync !== "undefined" ? healthToday() : "2026-09-24"))}" aria-label="日期"/>${svg("right", 14)}</label>
  <label class="kv"><span>分类</span>${catChip(cat)}<select id="led-category" aria-label="分类">${names.map((n) => `<option ${n === cat ? "selected" : ""}>${esc(n)}</option>`).join("")}</select>${svg("right", 14)}</label>
  ${entryAccount("led-account", aid)}<label class="kv"><span>名称</span><input id="led-title" placeholder="${expense ? "例如：家庭聚餐" : "例如：9月工资"}" value="${esc(d.ledTitle || "")}" maxlength="60"/></label>
  <label class="kv amount-row"><span>金额</span><span>¥</span><input id="led-amount" readonly inputmode="none" placeholder="0.00" value="${esc(d.ledAmount || "")}"/></label>
  <label class="kv"><span>备注</span><input id="led-note" placeholder="请输入备注" value="${esc(d.ledNote || "")}" maxlength="200"/></label></div>${keypad("save-ledger", "led-amount")}`,
    null,
    "entry",
  );
}

function screenMine() {
  const items = [
    ["accounts", "card", "账户管理", "#e9f1eb", "#557f6b"],
    ["categories", "category", "分类管理", "#fcf0e0", "#b9905d"],
    ["renqing", "gift", "记人情", "#fdebea", "#c46d68"],
    ["houses", "house", "房屋管理", "#e9f5ec", "#78a08a"],
    ["addresses", "pin", "地址管理", "#f0eaf8", "#9c83b3"],
    ["health", "heart", "健康管理", "#fdebea", "#c87c7a"],
    ["export", "download", "数据导出", "#edf0fb", "#879ac3"],
  ];
  return page(
    `<header class="top utility-top"><button class="icon-btn" id="bell" aria-label="通知">${svg("bell", 20)}</button></header>${familyCard()}<div class="group">资产与记账</div><div class="menu">${items.map(([r, i, t, b, c]) => `<button data-go="${r}">${chip(i, b, c)}<span class="grow title">${t}</span>${svg("right", 16, "#899b8b")}</button>`).join("")}</div><div class="group">设置</div><div class="menu">${typeof CloudSync !== "undefined" ? '<button data-go="cloud-settings"><span class="grow title">数据与同步</span></button>' : ""}<button data-go="model-settings">${chip("settings")}<span class="grow title">模型设置</span>${svg("right", 16)}</button>${[
      ["shield", "安全与隐私"],
      ["settings", "通用设置"],
      ["help", "帮助与反馈"],
    ]
      .map(
        ([i, t]) =>
          `<button data-info="${t}">${chip(i)}<span class="grow title">${t}</span>${svg("right", 16)}</button>`,
      )
      .join("")}</div>`,
    "mine",
  );
}

function screenMembers() {
  const colors = [
    ["#eaf3ed", "#6d9987"],
    ["#fdeeed", "#cc8584"],
    ["#fff4e9", "#c89b6b"],
    ["#eef1fb", "#7a95c0"],
  ];
  return page(`${back("成员管理", '<button class="linkish" data-go="invite">邀请</button>')}${familyCard(true)}${section("家庭成员", `<span class="sub">${state.members.length} / 8</span>`)}
  <div class="list-card">${state.members.map((m, i) => `<div class="row-card"><div class="avatar" style="background:${colors[i % 4][0]};color:${colors[i % 4][1]}">${esc(m.name[0])}</div><div class="grow"><div class="title">${esc(m.name)}${m.role === "管理员" ? '<span class="tag">管理员</span>' : ""}</div><div class="sub">${esc(m.desc)}</div></div>${svg("right", 14)}</div>`).join("")}</div><div class="group">邀请码</div><div class="list-card"><button class="tx" data-go="invite">${chip("ticket")}<span class="grow"><span class="title">邀请码 ${esc(state.invite)}</span><span class="sub" style="display:block">手动刷新前一直有效</span></span><span class="tag">查看</span></button></div><button class="btn" data-go="invite" style="margin-top:26px">${svg("users", 18)}邀请新成员</button><button class="btn ghost" data-go="family-setup" style="margin-top:12px">使用邀请码加入家庭</button>`);
}

function screenInvite() {
  return page(`${back("邀请成员")}<div class="invite-hero">${chip("users")}<h2>邀请加入“${esc(state.familyName || "李明的家")}”</h2><p class="sub">分享邀请码，对方输入后即可加入家庭账本</p></div>
  <div class="card invite-code"><div class="k">家庭邀请码</div><div class="code">${state.invite
    .split("")
    .map((c) => `<b>${esc(c)}</b>`)
    .join(
      "",
    )}</div><p class="sub">${svg("clock", 12)} 手动刷新前一直有效</p><button class="btn" id="copy-code">${svg("copy", 18)}复制邀请码</button></div>
  <div class="two-actions"><button class="btn ghost" id="share-code">${svg("share", 16)}分享邀请</button><button class="btn ghost" id="refresh-code">${svg("refresh", 16)}重新生成</button></div><div class="group">加入后可以</div><div class="menu">${[
    ["book", "查看家庭账户与收支记录"],
    ["plus", "添加支出、收入和账户"],
    ["chart", "共同查看家庭统计数据"],
  ]
    .map(
      ([i, t]) =>
        `<button data-info="${t}">${chip(i)}<span class="title">${t}</span></button>`,
    )
    .join("")}</div>`);
}

function screenRenqing() {
  const out = state.renqing
      .filter((r) => r.side === "out")
      .reduce((s, r) => s + r.amount, 0),
    inn = state.renqing
      .filter((r) => r.side === "in")
      .reduce((s, r) => s + r.amount, 0);
  const rows = state.renqing.filter(
    (r) =>
      (!state.searchQuery ||
        (r.name + r.reason + r.note).includes(state.searchQuery)) &&
      (!state.rqFilter ||
        state.rqFilter === "all" ||
        r.side === state.rqFilter),
  );
  const dates = [...new Set(rows.map((r) => r.day))];
  return page(
    `${back("记人情", '<button class="icon-btn" id="search" aria-label="搜索人情">' + svg("search", 20) + "</button>")}${searchField()}<div class="pair"><div class="summary"><div class="k"><i class="dot r"></i>累计随出</div><div class="amt">¥ ${money(out)}</div><div class="sub">共 ${state.renqing.filter((r) => r.side === "out").length} 笔</div></div><div class="summary"><div class="k"><i class="dot g"></i>累计收回</div><div class="amt">¥ ${money(inn)}</div><div class="sub">共 ${state.renqing.filter((r) => r.side === "in").length} 笔</div></div></div>${section("人情流水", '<button id="rq-filter">全部类型 ' + svg("down", 12) + "</button>")}<p class="sub">共 ${rows.length} 笔记录</p>
  ${dates
    .map(
      (day) =>
        `<div class="dayline">${esc(day)}</div><div class="list-card">${rows
          .filter((r) => r.day === day)
          .map(
            (r) =>
              `<button class="tx" data-renqing-edit="${r.id}" aria-label="修改${esc(r.name)}的人情记录"><span class="grow"><span class="title">${esc(r.name)} · ${esc(r.reason)} · ${r.side === "out" ? "随" : "收"}</span><span class="sub" style="display:block">${esc(r.member)} · ${esc(r.time)}<br/>备注：${esc(r.note || "无")}</span></span><span class="${r.side === "in" ? "pos" : "neg"}">${r.side === "in" ? "+" : "-"}${money(r.amount)}</span>${svg("right", 14)}</button>`,
          )
          .join("")}</div>`,
    )
    .join("")}${fab("renqing-add")}`,
    "mine",
  );
}

function screenRenqingAdd() {
  if (!state.accounts.length) return emptyAccountPage();
  const d = state.draft,
    out = d.side !== "in";
  return page(
    `${back(d.rqEditId != null ? "修改人情" : "添加人情", "", true)}<div class="seg"><button data-side="out" class="${out ? "on" : ""}">随出</button><button data-side="in" class="${out ? "" : "on"}">收回</button></div><div class="form-card">
  <label class="kv"><span>日期</span><input type="date" id="rq-date" value="${esc(d.ledDate || (typeof CloudSync !== "undefined" ? healthToday() : "2026-09-24"))}" aria-label="日期"/>${svg("right", 14)}</label>
  <label class="kv"><span>姓名</span><input id="rq-name" placeholder="请输入姓名" value="${esc(d.rqName || "")}"/></label>
  <label class="kv"><span>事由</span><input id="rq-reason" placeholder="婚礼、满月酒" value="${esc(d.rqReason || "")}"/></label>
  ${entryAccount("rq-account", d.accountId || state.accounts[0].id)}
  <label class="kv amount-row"><span>金额</span><span>¥</span><input id="rq-amount" readonly inputmode="none" placeholder="0.00" value="${esc(d.rqAmount || "")}"/></label>
  <label class="kv"><span>备注</span><input id="rq-note" placeholder="请输入备注" value="${esc(d.rqNote || "")}"/></label></div>${keypad("save-renqing", "rq-amount")}`,
    null,
    "entry",
  );
}

function screenHouses() {
  return page(
    `${back("房屋管理", '<button class="icon-btn" data-info="房屋管理" aria-label="更多">' + svg("more", 20) + "</button>")}<p class="sub">${state.houses.length} 套房屋</p>${state.houses
      .map(
        (h, i) =>
          `<div class="card house-card"><div class="house-head">${chip(i ? "building" : "house", i ? "#edf1fa" : "#eaf2ec", i ? "#7d98c3" : "#668c75")}<div class="grow"><div class="title">${esc(h.name)}</div><div class="sub">${esc(h.status)}</div></div>${svg("right", 14)}</div>${[
            ["水费户号", h.water],
            ["电费户号", h.power],
            ["燃气户号", h.gas],
          ]
            .map(
              ([t, v]) =>
                `<div class="utility"><span>${t}</span><b>${esc(v || "未填写")}</b></div>`,
            )
            .join("")}</div>`,
      )
      .join("")}${fab("house-add")}`,
    "mine",
  );
}

function screenHouseAdd() {
  return page(
    `${back("添加房屋", "", true)}<div class="form-card">${inputField("房屋名称", "h-name", "例如：滨江花园")}${inputField("水费户号", "h-water", "请输入水费账户号")}${inputField("电费户号", "h-power", "请输入电费账户号")}${inputField("燃气户号", "h-gas", "请输入燃气账户号")}</div><div class="banner" style="margin-top:20px">${svg("info", 18)}保存户号后，可快速查看房屋的水、电、燃气缴费信息。</div>${action("保存房屋", "save-house")}`,
  );
}

function screenAddresses() {
  const rows = state.addresses.filter(
    (a) =>
      !state.searchQuery || (a.name + a.detail).includes(state.searchQuery),
  );
  return page(
    `${back("地址管理", '<button class="icon-btn" id="search" aria-label="搜索地址">' + svg("search", 20) + "</button>")}${searchField()}<div class="group">常用地址</div><div class="list-card">${rows.map((a, i) => `<div class="tx address-row">${chip(i ? "building" : "house", i ? "#f3ecf8" : "#eaf2ec", i ? "#a389b7" : "#729780")}<div class="grow"><button class="address-edit" data-address-edit="${a.id}" aria-label="编辑${esc(a.name)}"><span class="title">${esc(a.name)}</span></button>${a.photos?.length ? `<span class="sub"> · ${a.photos.length} 张图片</span>` : ""}${a.def ? '<span class="tag">默认</span>' : ""}<div class="sub">${esc(a.detail).replace(/\n/g, "<br/>")}</div></div><button class="nav-btn" data-nav="${a.id}">${svg("navigation", 13)}导航</button></div>`).join("")}</div>${fab("address-add")}`,
    "mine",
  );
}

function screenAddressAdd() {
  const d = state.draft;
  d.photos ||= [];
  d.addressSession ||= crypto.randomUUID();
  return page(
    `${back(d.addressId ? "编辑地址" : "添加地址", "", true)}<div class="form-card">${inputField("地址名称", "ad-name", "例如：家、公司", d.adName || "", 'maxlength="80"')}<label class="form-field"><span>详细地址</span><textarea id="ad-detail" maxlength="1000" placeholder="请输入省市区、街道和门牌号">${esc(d.adDetail || "")}</textarea></label><div class="kv"><span class="sub">导航位置按详细地址查询</span><button class="nav-btn" id="pick-map">${svg("navigation", 14)}地图查询</button></div></div>${typeof AddressPhotos !== "undefined" ? AddressPhotos.form() : ""}${action("保存地址", "save-address")}`,
  );
}

function screenHealth() {
  return page(
    `<div class="banner family-health">${svg("heart", 22)}<div><b>个人健康</b><div class="sub">记录身体变化，管理每日饮食</div></div></div>${calorieCard(healthCurrent(), healthToday())}<button class="btn" data-go="nutrition">查看与记录每日饮食</button><div class="two-actions health-actions" style="margin-top:16px"><button class="btn ghost" data-go="health-profile">健康资料与目标</button><button class="btn ghost" data-go="health-person">体重记录与趋势</button></div>`,
    "health",
  );
}

function screenHealthPerson() {
  const p = healthCurrent();
  return page(
    `${back("体重记录", '<button class="icon-btn" data-info="个人健康" aria-label="更多">' + svg("more", 20) + "</button>")}<div class="two-actions health-actions"><button class="btn ghost" data-go="health-profile">资料与目标</button><button class="btn" data-go="nutrition">饮食与热量</button></div><div class="pair">${[
      ["身高", p.height, "cm"],
      ["最新体重", p.weight, "kg"],
      ["性别", p.sex, ""],
    ]
      .map(
        ([l, v, u]) =>
          `<div class="summary"><div class="k">${l}</div><div class="amt">${esc(v ?? "—")}<span class="sub"> ${u}</span></div></div>`,
      )
      .join(
        "",
      )}</div><div class="card" style="margin-top:20px;padding:16px"><div style="display:flex;justify-content:space-between"><div><h3>体重趋势</h3><div class="sub">近 6 次记录</div></div><span class="pos" style="font-size:11px">${p.delta} kg</span></div>${weightChart(p)}</div>${section("体重记录", `<span class="sub">共 ${p.records.length} 条</span>`)}<div class="list-card">${p.records.map((r) => `<div class="kv"><div><div class="title">${r.w} <span class="sub">kg</span></div><div class="sub">${esc(r.day)}</div></div><span class="pos" style="font-size:12px">${r.d > 0 ? "+" : ""}${r.d} kg</span></div>`).join("")}</div>${fab("weight")}`,
    null,
  );
}

function screenWeight() {
  const p = healthCurrent();
  return page(
    `${back("记录体重")}<div class="card weight-entry"><label for="w-value">本次体重</label><div class="weight-number"><input id="w-value" type="text" inputmode="decimal" enterkeyhint="done" autocomplete="off" maxlength="6" value="${p.weight ?? ""}" aria-label="体重"/><span>kg</span></div><p class="sub">轻点数字修改，支持一位小数</p></div><div class="form-card"><label class="form-field"><span>记录日期</span><input type="date" id="w-date" value="${healthToday()}" aria-label="日期"/></label></div>${action("保存体重", "save-weight")}`,
  );
}

function screenLedgerAll() {
  return page(
    `${back(state.ledger.length ? "全部流水" : "暂无数据")}${state.ledger.length ? transactionList(state.ledger) : emptyState()}`,
  );
}

function render() {
  if (typeof document === "undefined") return;
  const map = {
    login: screenLogin,
    "cloud-settings": () => CloudSync.screen(),
    "family-setup": () => CloudSync.familySetup(),
    home: screenHome,
    stats: screenStats,
    assets: screenAssetHub,
    accounts: screenAssets,
    "account-form": screenAccountForm,
    "account-detail": screenAccountDetail,
    categories: screenCategories,
    "category-add": screenCategoryAdd,
    "category-edit": screenCategoryEdit,
    mine: screenMine,
    members: screenMembers,
    invite: screenInvite,
    renqing: screenRenqing,
    "renqing-add": screenRenqingAdd,
    houses: screenHouses,
    "house-add": screenHouseAdd,
    addresses: screenAddresses,
    "address-add": screenAddressAdd,
    health: screenHealth,
    nutrition: screenNutrition,
    "health-profile": screenHealthProfile,
    "model-settings": screenModelSettings,
    "food-photo": screenFoodPhoto,
    "meal-form": screenMealForm,
    "health-person": screenHealthPerson,
    weight: screenWeight,
    "ledger-all": screenLedgerAll,
    "ledger-day": screenLedgerDay,
    "ledger-detail": screenLedgerDetail,
    "category-flow": screenCategoryFlow,
    ledger: screenLedger,
  };
  const y = window.scrollY;
  document.getElementById("app").innerHTML =
    (map[state.route] || screenHome)() + modalHtml();
  Object.entries(state.formValues || {}).forEach(([id, value]) => {
    const el = document.getElementById(id);
    if (el && el.type !== "password" && el.type !== "file") el.value = value;
  });
  bind();
  bindHealth();
  bindModelSettings();
  bindFoodPhoto();
  if (typeof CategoryIcons !== "undefined") CategoryIcons.bind();
  if (typeof AddressPhotos !== "undefined") AddressPhotos.bind();
  if (typeof CloudSync !== "undefined") CloudSync.bind();
  enhancePickers();
  const dialogs = [...document.querySelectorAll('[role="dialog"]')];
  const dialog = dialogs.at(-1);
  dialogs.forEach((el) => {
    el.inert = el !== dialog;
  });
  const background = document.querySelector("main.screen");
  document.body.style.overflow = dialog ? "hidden" : "";
  if (background) background.inert = !!dialog;
  if (dialog) {
    requestAnimationFrame(() => {
      dialog.focus({ preventScroll: true });
    });
  }
  window.scrollTo(0, y);
}

function field(id) {
  if (typeof document === "undefined") return "";
  const el = document.getElementById(id);
  return el ? el.value.trim() : "";
}

function screenLedgerDay() {
  const date = state.draft.ledgerDay;
  const rows = allLedgerRows().filter((r) => r.occurredOn === date);
  const totals = statTotals(rows);
  return page(
    `${back(dayLabel(date) + "流水")}<div class="pair"><div class="summary"><div class="k">当日支出</div><div class="amt neg">¥${money(totals.expense)}</div></div><div class="summary"><div class="k">当日收入</div><div class="amt pos">¥${money(totals.income)}</div></div></div>${section("流水明细", `<span class="sub">${rows.length} 笔</span>`)}${transactionList(rows, false)}`,
  );
}

function screenLedgerDetail() {
  const r = allLedgerRows().find(
    (r) => String(r.id) === String(state.draft.ledgerId),
  );
  if (!r) return page(`${back("流水详情")}<p class="sub">这笔流水已不存在</p>`);
  const fields = [
    ["名称", r.title],
    ["类型", r.kind === "income" ? "收入" : "支出"],
    ["分类", r.category],
    ["账户", accountOf(r.accountId)?.name || "账户不存在"],
    ["日期", r.occurredOn],
    ["记录人", r.member],
    ["备注", r.note || "无备注"],
  ];
  return page(
    `${back("流水详情")}<div class="summary detail-amount">${catChip(r.category)}<div class="hero ${r.kind === "income" ? "pos" : "neg"}">${r.kind === "income" ? "+" : "−"}${money(r.amount)}</div></div><div class="list-card detail-fields">${fields.map(([label, value]) => `<div class="kv"><span class="sub">${label}</span><span>${esc(value)}</span></div>`).join("")}</div>${action("修改流水", "edit-ledger")}`,
  );
}

let choiceAction = null;
function openChoices(title, options, apply) {
  captureModelDraft();
  rememberFoodEdits();
  captureDraft();
  if (state.route === "login") {
    state.phone = field("phone");
    state.password = field("password");
    state.confirm = field("confirm");
  }
  choiceAction = apply;
  state.modal = { type: "choice", title, options };
  render();
}

function datePickerHtml(modal) {
  const [year, month, day] = modal.value.split("-").map(Number);
  const today = new Date().getFullYear();
  const first = Math.min(1900, year),
    last = Math.max(today + 30, year);
  const column = (part, values, selected, unit) =>
    `<div class="date-column" role="group" aria-label="${unit}">${values.map((v) => `<button type="button" data-date-part="${part}" data-date-value="${v}" aria-pressed="${v === selected}" class="${v === selected ? "on" : ""}">${v}${unit}</button>`).join("")}</div>`;
  return `<p class="date-preview">${year}年${month}月${day}日</p><div class="date-wheels">${column(
    0,
    Array.from({ length: last - first + 1 }, (_, i) => first + i),
    year,
    "年",
  )}${column(
    1,
    Array.from({ length: 12 }, (_, i) => i + 1),
    month,
    "月",
  )}${column(
    2,
    Array.from({ length: new Date(year, month, 0).getDate() }, (_, i) => i + 1),
    day,
    "日",
  )}</div><button type="button" class="btn" id="confirm-date">确定日期</button>`;
}

function enhancePickers() {
  // Keep existing field IDs and change handlers as the single source of truth.
  // Native controls are hidden; every visible choice uses the same themed sheet.
  document.querySelectorAll("main .checks").forEach((group) => {
    group.classList.add("picker-source");
    const trigger = document.createElement("button");
    trigger.className = "choice-trigger";
    trigger.type = "button";
    trigger.id = "categories-picker";
    trigger.setAttribute("aria-haspopup", "dialog");
    trigger.textContent = state.selectedCategories.length
      ? `已选 ${state.selectedCategories.length} 个分类 · 点击调整`
      : "选择分类（可多选）";
    group.after(trigger);
    trigger.onclick = () => openModal("category-picker", "选择分类");
  });
  document.querySelectorAll("main .seg,main .stats-tabs").forEach((group) => {
    const options = [...group.querySelectorAll("button")];
    if (!options.length) return;
    group.hidden = true;
    group.classList.add("picker-source");
    const current =
      options.find((b) => b.classList.contains("on")) || options[0];
    const title = group.getAttribute("aria-label") || "选择类型";
    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "choice-trigger";
    trigger.setAttribute("aria-label", title);
    trigger.setAttribute("aria-haspopup", "dialog");
    trigger.innerHTML = `<span>${esc(current.textContent.trim())}</span>${svg("down", 16)}`;
    group.after(trigger);
    trigger.onclick = () =>
      openChoices(
        title,
        options.map((b) => ({
          label: b.textContent.trim(),
          selected: b === current,
        })),
        (index) => options[index].click(),
      );
  });
  document.querySelectorAll(".month-nav > div").forEach((label) => {
    const trigger = document.createElement("button");
    trigger.className = "period-picker";
    trigger.setAttribute("aria-label", "选择统计月份");
    trigger.setAttribute("aria-haspopup", "dialog");
    trigger.innerHTML = label.innerHTML + svg("down", 12);
    label.replaceWith(trigger);
    trigger.onclick = () => {
      const year = Number(state.statsMonth.slice(0, 4));
      const options = [];
      for (
        let y = Math.min(2000, year);
        y <= Math.max(new Date().getFullYear() + 5, year);
        y++
      ) {
        for (let m = 1; m <= 12; m++) {
          const value = y + "-" + String(m).padStart(2, "0");
          options.push({
            label: `${y}年${m}月`,
            value,
            selected: value === state.statsMonth,
          });
        }
      }
      openChoices("选择统计月份", options, (index) => {
        state.statsMonth = options[index].value;
        const [y, m] = state.statsMonth.split("-").map(Number);
        state.selectedDay = Math.min(
          state.selectedDay,
          new Date(y, m, 0).getDate(),
        );
        render();
      });
    };
  });
  document.querySelectorAll('select,input[type="date"]').forEach((source) => {
    source.classList.add("picker-source");
    source.tabIndex = -1;
    const title = source.getAttribute("aria-label") || "选择";
    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "field-picker";
    trigger.dataset.pickerFor = source.id;
    trigger.setAttribute("aria-label", "选择" + title);
    trigger.setAttribute("aria-haspopup", "dialog");
    trigger.textContent =
      source.tagName === "SELECT"
        ? source.selectedOptions[0]?.textContent || "请选择"
        : source.value;
    source.after(trigger);
    trigger.onclick = (e) => {
      e.preventDefault();
      const id = source.id;
      if (source.tagName === "SELECT") {
        const choices = [...source.options].map((o) => ({
          label: o.textContent,
          value: o.value,
          selected: o.selected,
        }));
        openChoices(title, choices, (index) => {
          const field = document.getElementById(id);
          field.value = choices[index].value;
          field.dispatchEvent(new Event("input", { bubbles: true }));
          field.dispatchEvent(new Event("change", { bubbles: true }));
          render();
        });
      } else {
        captureDraft();
        state.modal = {
          type: "date-picker",
          title: "选择日期",
          fieldId: id,
          value: source.value || new Date().toLocaleDateString("sv-SE"),
        };
        render();
      }
    };
  });
  document.querySelectorAll("[data-choice]").forEach((button) => {
    button.onclick = () => {
      const apply = choiceAction;
      state.modal = null;
      render();
      apply?.(Number(button.dataset.choice));
    };
  });
  document.querySelectorAll("[data-date-part]").forEach((button) => {
    button.onclick = () => {
      const values = state.modal.value.split("-").map(Number);
      values[Number(button.dataset.datePart)] = Number(
        button.dataset.dateValue,
      );
      values[2] = Math.min(
        values[2],
        new Date(values[0], values[1], 0).getDate(),
      );
      state.modal.value = values
        .map((v, i) => String(v).padStart(i === 0 ? 4 : 2, "0"))
        .join("-");
      render();
    };
  });
  document.getElementById("confirm-date")?.addEventListener("click", () => {
    const { fieldId, value } = state.modal;
    state.formValues[fieldId] = value;
    if (fieldId === "nutrition-date") state.nutritionDate = value;
    state.modal = null;
    render();
    captureDraft();
  });
  document
    .querySelectorAll(".date-column,.picker-options")
    .forEach((column) => {
      const current = column.querySelector(".on");
      if (current)
        column.scrollTop =
          current.offsetTop - (column.clientHeight - current.clientHeight) / 2;
    });
}
function given(input, key, domId) {
  if (input && input[key] != null && String(input[key]) !== "")
    return input[key];
  return field(domId);
}
function applyAmount(account, direction, amount) {
  const cents = Math.round(Number(account.balance) * 100);
  const change = Math.round(amount * 100);
  account.balance =
    (cents + (direction === "expense" ? -change : change)) / 100;
}

function bind() {
  const on = (selector, fn) =>
    document
      .querySelectorAll(selector)
      .forEach((el) => el.addEventListener("click", (e) => fn(el, e)));
  const save = (id, fn) =>
    on("#" + id, () => {
      captureDraft();
      fn();
      persistState();
    });
  on("[data-ledger-day]", (el) =>
    go("ledger-day", { ledgerDay: el.dataset.ledgerDay }),
  );
  on("[data-ledger-id]", (el) =>
    go("ledger-detail", { ledgerId: el.dataset.ledgerId }),
  );
  on("[data-category-detail]", (el) => {
    state.selectedCategories = [el.dataset.categoryDetail];
    go("category-flow");
  });
  on("#edit-ledger", () => {
    const r = allLedgerRows().find(
      (r) => String(r.id) === String(state.draft.ledgerId),
    );
    if (r)
      go("ledger", {
        editId: r.id,
        kind: r.kind,
        category: r.category,
        accountId: r.accountId,
        ledDate: r.occurredOn,
        ledTitle: r.title,
        ledAmount: String(r.amount),
        ledNote: r.note || "",
      });
  });
  document.querySelectorAll("input[id],textarea[id],select[id]").forEach((el) =>
    el.addEventListener("input", () => {
      state.formValues ||= {};
      if (el.type !== "password" && el.type !== "file")
        state.formValues[el.id] = el.value;
    }),
  );
  on("[data-go]", (el) => {
    const dest = el.dataset.go;
    if (dest === "export") {
      exportData();
      return;
    }
    go(dest);
  });
  on("[data-back]", () => appBack());
  on("[data-dismiss]", (el, e) => {
    if (e.target === el || el.tagName === "BUTTON") {
      state.modal = null;
      render();
    }
  });
  on("[data-auth]", (el) => {
    state.phone = field("phone");
    state.password = field("password");
    state.confirm = field("confirm");
    state.authMode = el.dataset.auth;
    state.formError = "";
    render();
  });
  const auth = document.getElementById("auth-form");
  if (auth)
    auth.addEventListener("submit", (e) => {
      e.preventDefault();
      submitAuth();
    });
  on("#toggle-password", (el) => {
    const input = document.getElementById("password");
    state.showPassword = !state.showPassword;
    input.type = state.showPassword ? "text" : "password";
    el.innerHTML = svg(state.showPassword ? "eye-off" : "eye", 20);
    el.setAttribute("aria-label", state.showPassword ? "隐藏密码" : "显示密码");
  });
  on("[data-stats]", (el) => {
    state.modal = null;
    state.statsTab = el.dataset.stats;
    go("stats");
  });
  on("[data-month]", (el) => {
    const d = new Date((state.statsMonth || "2026-09") + "-01T12:00:00");
    d.setMonth(
      d.getMonth() +
        Number(el.dataset.month) *
          (["year", "surplus"].includes(state.statsTab) ? 12 : 1),
    );
    state.statsMonth =
      d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
    state.selectedDay = Math.min(
      state.selectedDay,
      new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(),
    );
    render();
  });
  on("[data-stat-kind]", (el) => {
    state.statsKind = el.dataset.statKind;
    state.selectedCategories = [];
    render();
  });
  on("[data-select-category]", (el) => {
    state.selectedCategories ||= [];
    const name = el.dataset.selectCategory;
    state.selectedCategories = state.selectedCategories.includes(name)
      ? state.selectedCategories.filter((n) => n !== name)
      : [...state.selectedCategories, name];
    render();
  });
  on("#select-all", () => {
    state.selectedCategories = [];
    render();
  });
  on("#sort-flow", () => {
    state.amountSort = !state.amountSort;
    render();
  });
  on("[data-day]", (el) => {
    state.selectedDay = Number(el.dataset.day);
    render();
  });
  on("[data-account]", (el) =>
    go("account-detail", { accountId: Number(el.dataset.account) }),
  );

  on("[data-kind]", (el) => {
    captureDraft();
    state.draft.kind = el.dataset.kind;
    state.draft.category = "";
    delete state.formValues?.["led-category"];
    render();
  });
  on("[data-side]", (el) => {
    captureDraft();
    state.draft.side = el.dataset.side;
    render();
  });
  document
    .querySelectorAll("#led-account,#rq-account,#led-category")
    .forEach((el) =>
      el.addEventListener("change", () => {
        captureDraft();
        render();
      }),
    );
  on("[data-cat-kind]", (el) => setCategoryKind(el.dataset.catKind));
  on("[data-new-cat]", (el) => {
    captureDraft();
    state.draft.categoryKind = el.dataset.newCat;
    render();
  });
  on("[data-icon]", (el) => {
    captureDraft();
    state.draft.catIcon = el.dataset.icon;
    state.draft.customIcon = null;
    render();
  });
  on("[data-color]", (el) => {
    captureDraft();
    state.draft.catColor = el.dataset.color;
    render();
  });
  on("[data-cat]", (el) =>
    go("category-edit", { editingCategory: el.dataset.cat }),
  );
  on("#sort", () => {
    sortCategories();
    persistState();
  });
  on("[data-key]", (el) => {
    const input = document.getElementById(el.dataset.target),
      key = el.dataset.key;
    if (!input) return;
    let value = input.value;
    if (key === "del") value = value.slice(0, -1);
    else if (key === ".") {
      if (!value.includes(".")) value = (value || "0") + ".";
    } else {
      value = (value === "0" ? key : value + key).replace(/^0+(?=\d)/, "");
    }
    if (!/^\d{0,9}(\.\d{0,2})?$/.test(value)) return;
    input.value = value;
    state.formValues ||= {};
    state.formValues[input.id] = value;
    captureDraft();
  });
  save("save-ledger", saveLedgerRow);
  save("save-renqing", saveRenqing);
  on("[data-renqing-edit]", (el) => {
    const r = state.renqing.find(
      (r) => r.id === Number(el.dataset.renqingEdit),
    );
    if (r)
      go("renqing-add", {
        rqEditId: r.id,
        side: r.side,
        ledDate: r.occurredOn || occurredOn(r.day),
        rqName: r.name,
        rqReason: r.reason,
        rqAmount: String(r.amount),
        rqNote: r.note || "",
        accountId: r.accountId,
      });
  });
  save("save-account", saveAccount);
  save("save-house", saveHouseRow);
  save("save-address", saveAddressRow);
  on("[data-address-edit]", (el) => {
    const a = state.addresses.find(
      (a) => a.id === Number(el.dataset.addressEdit),
    );
    if (a)
      go("address-add", {
        addressId: a.id,
        adName: a.name,
        adDetail: a.detail,
        photos: [...(a.photos || [])],
      });
  });
  save("save-weight", saveWeightRow);
  document
    .getElementById("w-value")
    ?.addEventListener("focus", (event) => event.target.select());
  document.getElementById("w-value")?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      event.target.blur();
      saveWeightRow();
    }
  });
  save("save-category", () => saveCategory());
  save("save-category-edit", () => saveCategoryEdit());
  on("#delete-category", () => openModal("delete-category", "删除分类"));
  on("#confirm-delete-category", () => {
    const kind = state.categoryKind === "income" ? "income" : "expense";
    state.categories[kind] = state.categories[kind].filter(
      (n) => n !== state.draft.editingCategory,
    );
    go("categories");
    persistState();
  });
  on("#edit-account", () => {
    const a = accountOf(state.draft.accountId);
    go("account-form", { account: { ...a, balance: String(a.balance) } });
  });
  on("#account-type", () => openModal("account-type", "选择账户类型"));
  on("[data-account-type]", (el) => {
    state.draft.account ||= { counted: true };
    state.draft.account.type = el.dataset.accountType;
    state.modal = null;
    render();
  });
  on("#acc-count", () => {
    captureDraft();
    state.draft.account.counted = !state.draft.account.counted;
    render();
  });
  on("#copy-code", () => copyText(state.invite, "邀请码已复制"));
  on("#share-code", async () => {
    const text =
      "邀请加入" +
      (state.familyName || "李明的家") +
      "，家庭邀请码：" +
      state.invite;
    if (window.AndroidBridge) {
      AndroidBridge.share(text);
      return;
    }
    if (navigator.share) {
      try {
        await navigator.share({ title: "家庭邀请", text });
      } catch (e) {
        if (e.name !== "AbortError") toast("分享不可用，请复制邀请码");
      }
    } else copyText(text, "邀请信息已复制");
  });
  on("#refresh-code", () => {
    if (typeof CloudSync !== "undefined") return CloudSync.refresh();
    state.retiredInvites.push(state.invite);
    const bytes = new Uint32Array(1);
    crypto.getRandomValues(bytes);
    state.invite = bytes[0]
      .toString(36)
      .toUpperCase()
      .padStart(6, "0")
      .slice(-6);
    persistState();
    render();
    toast("已刷新，旧邀请码不可用");
  });
  on("#search", () => {
    state.searchOpen = !state.searchOpen;
    state.searchQuery = "";
    render();
    document.getElementById("search-query")?.focus();
  });
  on("#close-search", () => {
    state.searchOpen = false;
    state.searchQuery = "";
    delete state.formValues?.["search-query"];
    render();
  });
  const search = document.getElementById("search-query");
  if (search)
    search.addEventListener("input", () => {
      const pos = search.selectionStart;
      state.searchQuery = search.value;
      render();
      const next = document.getElementById("search-query");
      next.focus();
      next.setSelectionRange(pos, pos);
    });
  on("#hide-amounts", () => {
    state.hideAmounts = !state.hideAmounts;
    persistState();
    render();
  });
  on("#filter", () => openModal("filter", "筛选账户流水"));
  on("[data-flow-filter]", (el) => {
    state.flowFilter = el.dataset.flowFilter;
    state.modal = null;
    render();
  });
  on("#rq-filter", () => openModal("rq-filter", "人情类型"));
  on("[data-rq-filter]", (el) => {
    state.rqFilter = el.dataset.rqFilter;
    state.modal = null;
    render();
  });
  on("#more", () => openModal("more", "统计"));
  on("#bell", () => openModal("info", "通知", "暂无新的通知。"));
  on("[data-info]", (el) =>
    openModal("info", el.dataset.info, "此功能暂未开放。"),
  );
  on("[data-nav]", (el) => {
    const a = state.addresses.find((a) => a.id === Number(el.dataset.nav));
    if (a) navigateAddress(a.detail);
  });
  on("#pick-map", () => {
    const detail = field("ad-detail");
    if (!detail) {
      toast("请先填写详细地址");
      return;
    }
    navigateAddress(detail);
  });
}

function submitAuth() {
  state.phone = field("phone");
  state.password = field("password");
  state.confirm = field("confirm");
  if (!PHONE_RE.test(state.phone)) {
    state.formError = "手机号需为11位数字";
    render();
    return;
  }
  if (!PASSWORD_RE.test(state.password)) {
    state.formError = "密码需为6-16位，由数字、字母和常见符号组成";
    render();
    return;
  }
  if (state.authMode === "register" && state.password !== state.confirm) {
    state.formError = "两次密码不一致";
    render();
    return;
  }
  state.formError = "";
  if (typeof CloudSync !== "undefined") return CloudSync.authenticate();
  go("home");
}

function saveLedgerRow(input) {
  const amount = Number(given(input, "amount", "led-amount"));
  const kind = (input && input.kind) || state.draft.kind || "expense";
  const title =
    given(input, "title", "led-title") || (kind === "income" ? "收入" : "支出");
  const category = given(input, "category", "led-category");
  const account = accountOf(Number(given(input, "accountId", "led-account")));
  const rawDay = given(input, "day", "led-date") || "2026-09-24";
  const bookedOn = occurredOn(rawDay) || "2026-09-24";
  const day = dayLabel(bookedOn);
  if (
    !Number.isFinite(amount) ||
    !(amount > 0) ||
    amount > 999999999.99 ||
    Math.abs(amount * 100 - Math.round(amount * 100)) > 0.00001
  ) {
    state.formError = "请输入大于 0、最多两位小数的金额";
    render();
    return false;
  }
  if (!category) {
    state.formError = "请选择分类";
    render();
    return false;
  }
  if (!account) {
    state.formError = "请选择账户";
    render();
    return false;
  }
  const editId = input?.editId ?? state.draft.editId;
  if (editId != null) {
    const previous = allLedgerRows().find(
      (r) => String(r.id) === String(editId),
    );
    const oldAccount = previous && accountOf(previous.accountId);
    if (!previous || !oldAccount) {
      state.formError = "原流水或账户不存在，无法修改";
      render();
      return false;
    }
    const updated = {
      ...previous,
      title,
      category,
      amount,
      accountId: account.id,
      kind: kind === "income" ? "income" : "expense",
      day,
      occurredOn: bookedOn,
      note: given(input, "note", "led-note"),
    };
    applyAmount(
      oldAccount,
      previous.kind === "expense" ? "income" : "expense",
      previous.amount,
    );
    applyAmount(account, updated.kind, amount);
    const existing = state.ledger.find((r) => String(r.id) === String(editId));
    if (existing) Object.assign(existing, updated);
    else state.ledger.unshift(updated);
    if (previous.renqingId != null) {
      const gift = state.renqing.find((r) => r.id === previous.renqingId);
      if (gift)
        Object.assign(gift, {
          ledgerId: updated.id,
          name: title,
          amount,
          accountId: account.id,
          side: updated.kind === "income" ? "in" : "out",
          day,
          occurredOn: bookedOn,
          note: updated.note,
        });
    }
    go("ledger-detail", { ledgerId: updated.id });
    persistState();
    toast("流水已修改，余额与统计已更新");
    return true;
  }
  applyAmount(account, kind === "income" ? "income" : "expense", amount);
  state.ledger.unshift({
    id: Date.now(),
    day,
    occurredOn: bookedOn,
    kind: kind === "income" ? "income" : "expense",
    category,
    title,
    member: typeof CloudSync !== "undefined" ? CloudSync.user.name : "李明",
    time: "刚刚",
    amount,
    accountId: account.id,
    source: SOURCE_MANUAL,
    note: given(input, "note", "led-note"),
  });
  go("home");
  toast(kind === "expense" ? "已记支出" : "已记收入");
  return true;
}

function saveRenqing(input) {
  const amount = Number(given(input, "amount", "rq-amount"));
  const name = given(input, "name", "rq-name");
  const side =
    (input && input.side) || (state.draft.side === "in" ? "in" : "out");
  const account = accountOf(Number(given(input, "accountId", "rq-account")));
  const rawDay = given(input, "day", "rq-date") || "2026-09-24";
  const bookedOn = occurredOn(rawDay) || "2026-09-24";
  const day = dayLabel(bookedOn);
  const reason = given(input, "reason", "rq-reason") || "事由";
  if (!name) {
    state.formError = "请填写姓名";
    render();
    return false;
  }
  if (
    !Number.isFinite(amount) ||
    !(amount > 0) ||
    amount > 999999999.99 ||
    Math.abs(amount * 100 - Math.round(amount * 100)) > 0.00001
  ) {
    state.formError = "请输入大于 0、最多两位小数的金额";
    render();
    return false;
  }
  if (!account) {
    state.formError = "请选择账户";
    render();
    return false;
  }
  const editId = input?.editId ?? state.draft.rqEditId;
  if (editId != null) {
    const previous = state.renqing.find((r) => r.id === editId);
    const oldAccount = previous && accountOf(previous.accountId);
    if (!previous || !oldAccount) {
      state.formError = "原记录或账户已不存在，请返回重新加载";
      render();
      return false;
    }
    let linked = state.ledger.find(
      (r) =>
        r.renqingId === previous.id ||
        (previous.ledgerId != null && r.id === previous.ledgerId),
    );
    applyAmount(
      oldAccount,
      previous.side === "out" ? "income" : "expense",
      previous.amount,
    );
    applyAmount(account, side === "out" ? "expense" : "income", amount);
    Object.assign(previous, {
      name,
      reason,
      side,
      day,
      occurredOn: bookedOn,
      note: given(input, "note", "rq-note"),
      amount,
      accountId: account.id,
    });
    if (!linked) {
      let id = Date.now();
      while (state.ledger.some((r) => r.id === id)) id++;
      linked = { id, source: SOURCE_MANUAL };
      state.ledger.unshift(linked);
    }
    Object.assign(linked, {
      renqingId: previous.id,
      day,
      occurredOn: bookedOn,
      kind: side === "out" ? "expense" : "income",
      category: "人情",
      title: name,
      member: previous.member,
      time: previous.time,
      amount,
      accountId: account.id,
      note: previous.note,
    });
    previous.ledgerId = linked.id;
    go("renqing");
    toast("人情记录已修改，余额与统计已更新");
    return true;
  }
  applyAmount(account, side === "out" ? "expense" : "income", amount);
  const renqingId = Date.now();
  const ledgerId = renqingId + 1;
  state.renqing.unshift({
    id: renqingId,
    ledgerId,
    day,
    occurredOn: bookedOn,
    name,
    reason,
    side,
    member: typeof CloudSync !== "undefined" ? CloudSync.user.name : "李明",
    time: "刚刚",
    note: given(input, "note", "rq-note"),
    amount,
    accountId: account.id,
    source: SOURCE_MANUAL,
  });
  state.ledger.unshift({
    id: ledgerId,
    renqingId,
    day,
    occurredOn: bookedOn,
    kind: side === "out" ? "expense" : "income",
    category: "人情",
    title: name,
    member: typeof CloudSync !== "undefined" ? CloudSync.user.name : "李明",
    time: "刚刚",
    amount,
    accountId: account.id,
    source: SOURCE_MANUAL,
  });
  go("renqing");
  toast(side === "out" ? "已记随出" : "已记收回");
  return true;
}

function setCategoryKind(kind) {
  state.categoryKind = kind === "income" ? "income" : "expense";
  render();
}
function sortCategories() {
  const kind = state.categoryKind === "income" ? "income" : "expense";
  state.categories[kind] = state.categories[kind]
    .slice()
    .sort((a, b) => a.localeCompare(b, "zh"));
  render();
}
function saveCategory(input) {
  const kind =
    (input && input.kind) ||
    state.draft.categoryKind ||
    state.categoryKind ||
    "expense";
  const name = (input && input.name) || field("cat-name");
  if (!name) {
    state.formError = "请填写分类名称";
    render();
    return false;
  }
  if (state.categories[kind].indexOf(name) < 0)
    state.categories[kind].push(name);
  const color = state.draft.catColor || "#d45e5c";
  CAT_LOOK[name] = [state.draft.catIcon || "fork", color + "18", color];
  if (state.draft.customIcon) CAT_LOOK[name].push(state.draft.customIcon);
  state.categoryKind = kind;
  go("categories");
  return true;
}

function readAccountDraft() {
  const prev = state.draft.account || {
    counted: true,
    id: null,
    type: "储蓄卡",
  };
  return {
    id: prev.id,
    type: prev.type || "储蓄卡",
    counted: prev.counted !== false,
    name: field("acc-name"),
    bank: field("acc-bank"),
    last4: field("acc-last4"),
    balance: field("acc-balance"),
  };
}
function saveAccount() {
  const d = readAccountDraft();
  const balance = Number(d.balance);
  if (!d.name) {
    state.formError = "请填写账户名称";
    render();
    return;
  }
  if (!Number.isFinite(balance) || Math.abs(balance) > 999999999.99) {
    state.formError = "金额无效";
    render();
    return;
  }
  if (d.last4 && !/^\d{4}$/.test(d.last4)) {
    state.formError = "卡号后四位须为4位数字";
    render();
    return;
  }
  if (d.id) {
    const found = accountOf(d.id);
    found.name = d.name;
    found.type = d.type;
    found.bank = d.bank;
    found.last4 = d.last4;
    found.balance = balance;
    found.counted = d.counted;
  } else {
    d.id = Date.now();
    state.accounts.push({
      id: d.id,
      name: d.name,
      type: d.type,
      bank: d.bank,
      last4: d.last4,
      balance,
      counted: d.counted,
    });
  }
  finishAccountSave(d.id);
}
function finishAccountSave(accountId) {
  const parent = state.navStack?.at(-1);
  persistState();
  if (
    parent &&
    ["ledger", "renqing-add", "account-detail", "accounts"].includes(
      parent.route,
    )
  ) {
    if (["ledger", "renqing-add"].includes(parent.route))
      parent.draft.accountId = accountId;
    appBack();
    toast(
      ["ledger", "renqing-add"].includes(state.route)
        ? "账户已添加，请继续填写记录"
        : "已保存账户",
    );
  } else {
    // Replace the completed form instead of pushing it into the back stack.
    state.route = "accounts";
    state.draft = {};
    state.formValues = {};
    state.formError = "";
    render();
    toast("已保存账户");
  }
}
function saveHouseRow() {
  const name = field("h-name");
  if (!name) {
    state.formError = "请填写房屋名称";
    render();
    return;
  }
  state.houses.push({
    id: Date.now(),
    name,
    status: "当前居住",
    water: field("h-water"),
    power: field("h-power"),
    gas: field("h-gas"),
  });
  go("houses");
}
function saveAddressRow() {
  const name = field("ad-name");
  if (!name) {
    state.formError = "请填写地址名称";
    render();
    return;
  }
  if (!field("ad-detail")) {
    state.formError = "请填写详细地址";
    render();
    return;
  }
  if (typeof AddressPhotos !== "undefined" && AddressPhotos.busy) {
    toast("请等待图片上传完成");
    return;
  }
  const existing = state.addresses.find((a) => a.id === state.draft.addressId);
  if (state.draft.addressId && !existing) {
    toast("地址已不存在，请返回重新加载");
    return;
  }
  const value = {
    ...(existing || {}),
    id: existing?.id || Date.now(),
    name,
    detail: field("ad-detail"),
    def: existing?.def || false,
    photos: [...(state.draft.photos || [])],
  };
  if (existing) Object.assign(existing, value);
  else state.addresses.push(value);
  go("addresses");
}
function saveWeightRow() {
  const rawWeight = field("w-value");
  const value = Number(rawWeight);
  if (
    !/^\d{1,3}(\.\d)?$/.test(rawWeight) ||
    !Number.isFinite(value) ||
    value < 1 ||
    value > 500
  ) {
    state.formError = "请输入1至500 kg的体重，最多一位小数";
    render();
    return;
  }
  const person = healthCurrent();
  const delta =
    person.weight == null ? 0 : Math.round((value - person.weight) * 10) / 10;
  const recordDate = field("w-date") || healthToday();
  const dateLabel = recordDate.replace(
    /(\d{4})-(\d{2})-(\d{2})/,
    "$1年$2月$3日",
  );
  person.records.unshift({ w: value, day: dateLabel, d: delta });
  person.weight = value;
  person.delta = Math.round((person.delta + delta) * 10) / 10;
  go("health-person");
}

function section(title, extra = "") {
  return `<div class="section-h"><h2>${title}</h2>${extra}</div>`;
}
function fab(route) {
  return `<button class="fab" data-go="${route}" aria-label="添加">${svg("plus", 26)}</button>`;
}
function action(label, id) {
  return `<footer class="bottom-action"><div class="err" role="alert">${esc(state.formError)}</div><button class="btn" id="${id}">${label}</button></footer>`;
}
function inputField(label, id, placeholder = "", value = "", attrs = "") {
  return `<label class="form-field" for="${id}"><span>${label}</span><input id="${id}" placeholder="${placeholder}" value="${esc(value)}" ${attrs}/></label>`;
}
function selectionTabs() {
  const selected = state.statsTab;
  return `<div class="stats-tabs" role="tablist" aria-label="统计范围">${[
    ["month", "本月"],
    ["year", "本年"],
    ["calendar", "日历"],
    ["members", "成员"],
    ["category", "分类统计"],
    ["surplus", "收支结余"],
  ]
    .map(
      ([id, l]) =>
        `<button role="tab" aria-selected="${selected === id}" data-stats="${id}" class="${selected === id ? "on" : ""}">${l}</button>`,
    )
    .join("")}</div>`;
}
function familyCard(member = false) {
  return `<button class="family" data-go="members"><span class="avatar">${member ? svg("home", 24) : esc((state.familyName || "李")[0])}</span><span class="grow"><b>${esc(state.familyName || "李明的家")}</b><span class="sub" style="display:block">${state.members.length} 位成员${member ? " · 最多可加入 8 人" : ""}</span></span>${member ? "" : svg("right", 18)}</button>`;
}
function emptyState(route = "ledger") {
  return `<div class="empty"><div class="bubble">${svg("inbox", 44)}</div><h2>这里还没有内容</h2><p class="sub">新增第一条数据后，相关内容会在这里展示</p><button class="btn" data-go="${route}">${svg("plus", 16)}去添加</button></div>`;
}
function transactionList(rows, grouped = true) {
  if (!rows.length)
    return `<p class="sub" style="padding:24px 0;text-align:center">暂无流水记录</p>`;
  const groups = new Map();
  rows.forEach((r) => {
    const date = r.occurredOn || r.day;
    if (!groups.has(date)) groups.set(date, []);
    groups.get(date).push(r);
  });
  const rowHtml = (r) =>
    `<button class="tx" data-ledger-id="${esc(r.id)}" aria-label="查看${esc(r.title)}详情">${catChip(r.category)}<div class="grow"><div class="title">${esc(r.category === "工资" ? "收入" : r.category)} - ${esc(r.title)}</div><div class="sub">${esc(r.member)} · ${esc(r.time)}</div></div><span class="${r.kind === "income" ? "pos" : "neg"}">${r.kind === "income" ? "+" : "-"}${money(r.amount)}</span></button>`;
  if (!grouped)
    return `<div class="list-card">${rows.map(rowHtml).join("")}</div>`;
  return [...groups.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, rs]) => {
      const out = rs
        .filter((r) => r.kind === "expense")
        .reduce((n, r) => n + r.amount, 0);
      const inn = rs
        .filter((r) => r.kind === "income")
        .reduce((n, r) => n + r.amount, 0);
      return `<button class="dayline" data-ledger-day="${esc(date)}" aria-label="查看${esc(rs[0].day)}流水"><span>${esc(rs[0].day)} ${svg("right", 12)}</span><span>${out ? `支出 ${money(out)}` : `收入 +${money(inn)}`}</span></button><div class="list-card">${rs.map(rowHtml).join("")}</div>`;
    })
    .join("");
}
function categoryEditor(edit = false) {
  const kind = state.draft.categoryKind || state.categoryKind || "expense";
  const name =
    state.draft.categoryName ?? (edit ? state.draft.editingCategory : "");
  const original = CAT_LOOK[state.draft.editingCategory] || [
    "fork",
    "#fdebea",
    "#d45e5c",
  ];
  const chosen = state.draft.catIcon || (edit ? original[0] : "fork"),
    color = state.draft.catColor || (edit ? original[2] : "#d45e5c");
  const custom =
    state.draft.customIcon !== undefined
      ? state.draft.customIcon
      : edit
        ? original[3]
        : null;
  const icons = [
    "fork",
    "bag",
    "car",
    "house",
    "game",
    "shirt",
    "med",
    "cap",
    "plane",
    "more",
  ];
  const colors = [
    "#d45e5c",
    "#cf8c3c",
    "#d5b342",
    "#278777",
    "#4d7bb1",
    "#9064ae",
  ];
  return page(`${back(edit ? "编辑分类" : "添加分类")}<div class="preview" style="background:${color}15;color:${color}">${custom ? `<img class="category-custom-image" data-address-photo="${custom}" alt="自定义图标"/>` : svg(chosen, 34)}</div><div class="form-card"><div class="kv category-type-row"><span>类型</span><div class="seg"><button data-new-cat="expense" class="${kind === "expense" ? "on" : ""}">支出</button><button data-new-cat="income" class="${kind === "income" ? "on" : ""}">收入</button></div></div><label class="kv"><span>分类名称</span><input id="cat-name" value="${esc(name)}" maxlength="20" placeholder="例如：餐饮"/></label></div>
  <div class="group">选择图标</div><button class="btn ghost" id="upload-category-icon">${custom ? "更换自定义图标" : "上传自定义图标"}</button><input type="file" id="category-icon-file" accept="image/jpeg,image/png,image/webp" hidden/><p class="sub">上传后裁切为方形；也可选择下方内置图标。</p><div class="card icon-grid" style="--chosen:${color}">${icons.map((n) => `<button data-icon="${n}" aria-label="图标 ${n}" aria-pressed="${n === chosen}" class="${n === chosen ? "on" : ""}">${svg(n, 23)}</button>`).join("")}</div>
  <div class="group">选择颜色</div><div class="card colors">${colors.map((c) => `<button data-color="${c}" aria-label="颜色 ${c}" aria-pressed="${c === color}" class="${c === color ? "on" : ""}" style="background:${c}"></button>`).join("")}</div>
  ${edit ? '<button class="btn danger" style="margin-top:24px" id="delete-category">删除此分类</button>' : ""}${action(edit ? "保存修改" : "保存分类", edit ? "save-category-edit" : "save-category")}`);
}
function keypad(id, amountId) {
  return `<div class="keypad"><div class="err" role="alert">${esc(state.formError)}</div><div class="keys">${["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "00"].map((k, i) => `<button data-key="${k}" data-target="${amountId}" style="grid-row:${Math.floor(i / 3) + 1};grid-column:${(i % 3) + 1}">${k}</button>`).join("")}<button class="del" data-key="del" data-target="${amountId}" aria-label="删除数字">${svg("delete", 20)}删除</button><button class="ok" id="${id}">确定</button></div></div>`;
}
function entryAccount(id, selected) {
  return `<label class="kv"><span>账户</span>${chip("card")}<span class="grow"><select id="${id}" aria-label="账户">${state.accounts.map((a) => `<option value="${a.id}" ${a.id === Number(selected) ? "selected" : ""}>${esc(a.name)}</option>`).join("")}</select><span class="sub" style="display:block;text-align:right">余额 ${money((accountOf(Number(selected)) || state.accounts[0]).balance)}</span></span>${svg("right", 14)}</label>`;
}
function weightChart(person) {
  const records = person.records.slice(0, 6).reverse(),
    values = records.map((r) => r.w);
  if (values.length < 2)
    return '<p class="sub" style="padding:50px 0;text-align:center">记录两次体重后展示趋势</p>';
  const min = Math.min(...values) - 0.3,
    max = Math.max(...values) + 0.3;
  const pts = values.map((v, i) => [
    20 + (i * 280) / (values.length - 1),
    125 - ((v - min) / (max - min)) * 90,
  ]);
  return `<svg class="chart" viewBox="0 0 320 170" role="img" aria-label="体重变化趋势">${[30, 75, 120].map((y) => `<path d="M12 ${y}H310" stroke="#f0f2ec"/>`).join("")}<path d="M${pts.map((p) => p.join(",")).join(" L")}L300,135H20Z" fill="#f0f5ef"/><path d="M${pts.map((p) => p.join(",")).join(" L")}" fill="none" stroke="#477a66" stroke-width="2"/>${pts.map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${i === pts.length - 1 ? 4 : 2}" fill="white" stroke="#477a66" stroke-width="2"/><text x="${x}" y="160" text-anchor="middle">${records[i].day.replace("2026年", "").replace("月", "/").replace("日", "")}</text>`).join("")}</svg>`;
}
function searchField() {
  return state.searchOpen
    ? `<label class="search-box">${svg("search", 18)}<input id="search-query" placeholder="输入关键词搜索" aria-label="搜索关键词" value="${esc(state.searchQuery || "")}"/><button id="close-search" aria-label="关闭搜索">${svg("close", 16)}</button></label>`
    : "";
}

function selectedPeriodRows() {
  const month = state.statsMonth || "2026-09";
  return allLedgerRows().filter((r) => String(r.occurredOn).startsWith(month));
}
function allLedgerRows() {
  // Older fixtures have gift entries without mirrored ledger rows. Project them
  // for summaries without mutating records or counting new mirrored rows twice.
  const missing = state.renqing.filter(
    (r) => !state.ledger.some((l) => l.renqingId === r.id),
  );
  return [
    ...state.ledger,
    ...missing.map((r) => ({
      id: "gift-" + r.id,
      renqingId: r.id,
      occurredOn: r.occurredOn,
      day: r.day,
      category: "人情",
      title: r.name,
      note: r.note || "",
      member: r.member,
      time: r.time,
      amount: r.amount,
      kind: r.side === "in" ? "income" : "expense",
      accountId: r.accountId,
      source: SOURCE_MANUAL,
    })),
  ];
}
function statTotals(rows) {
  return rows.reduce(
    (a, r) => {
      a[r.kind === "income" ? "income" : "expense"] += Number(r.amount);
      return a;
    },
    { income: 0, expense: 0 },
  );
}
function statsMonthNav(year = false) {
  const [y, m] = (state.statsMonth || "2026-09").split("-");
  return `<div class="month-nav"><button data-month="-1" aria-label="上一${year ? "年" : "月"}">${svg("back", 14)}</button><div><b>${y}年${year ? "" : Number(m) + "月"}</b>${year ? "" : `<div class="sub">${Number(m)}月1日 - ${Number(m)}月${new Date(Number(y), Number(m), 0).getDate()}日</div>`}</div><button data-month="1" aria-label="下一${year ? "年" : "月"}">${svg("right", 14)}</button></div>`;
}
function slicesFor(rows, kind) {
  const groups = Object.create(null);
  rows
    .filter((r) => r.kind === kind)
    .forEach(
      (r) => (groups[r.category] = (groups[r.category] || 0) + r.amount),
    );
  const total = Object.values(groups).reduce((s, v) => s + v, 0);
  return Object.entries(groups)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({
      name,
      value,
      pct: total ? (value / total) * 100 : 0,
      color: (CAT_LOOK[name] || ["", "", "#9ba79b"])[2],
    }));
}
function captureDraft() {
  if (typeof document === "undefined") return;
  const fields = {
    "led-title": "ledTitle",
    "led-amount": "ledAmount",
    "led-date": "ledDate",
    "led-note": "ledNote",
    "led-category": "category",
    "rq-name": "rqName",
    "rq-reason": "rqReason",
    "rq-amount": "rqAmount",
    "rq-date": "ledDate",
    "rq-note": "rqNote",
    "cat-name": "categoryName",
  };
  Object.entries(fields).forEach(([id, key]) => {
    const el = document.getElementById(id);
    if (el) state.draft[key] = el.value;
  });
  const account =
    document.getElementById("led-account") ||
    document.getElementById("rq-account");
  if (account) state.draft.accountId = Number(account.value);
  if (state.route === "account-form" && document.getElementById("acc-name"))
    state.draft.account = readAccountDraft();
}
function appBack() {
  if (
    typeof CloudSync !== "undefined" &&
    CloudSync.active &&
    !CloudSync.user.familyId
  ) {
    if (state.route === "family-setup") return false;
    go("family-setup");
    return true;
  }
  if (typeof CategoryIcons !== "undefined" && CategoryIcons.close()) return;
  if (typeof AddressPhotos !== "undefined" && AddressPhotos.closeViewer())
    return;
  if (!state.modal && state.route === "food-photo") {
    rememberFoodEdits();
    cancelFoodRequest();
  }
  if (state.modal) {
    state.modal = null;
    render();
    return true;
  }
  if (state.route === "login") return false;
  const prev = (state.navStack || []).pop();
  if (prev) {
    state.route = prev.route;
    state.draft = prev.draft;
    state.formError = "";
    state.formValues = {};
    render();
    if (typeof window !== "undefined") window.scrollTo(0, prev.scroll || 0);
    return true;
  }
  if (state.route !== "home") {
    go("home");
    return true;
  }
  return false;
}
function persistState() {
  if (typeof CloudSync !== "undefined") return CloudSync.persist();
  if (typeof localStorage === "undefined" || state.preview) return;
  try {
    const data = { version: 1 };
    [
      "ledger",
      "renqing",
      "accounts",
      "categories",
      "houses",
      "addresses",
      "health",
      "members",
      "invite",
      "retiredInvites",
    ].forEach((k) => (data[k] = state[k]));
    data.categoryLooks = CAT_LOOK;
    localStorage.setItem("family-life-data-v1", JSON.stringify(data));
  } catch (e) {
    toast("本机存储空间不足，请先导出备份");
  }
}
function loadSavedState() {
  if (typeof CloudSync !== "undefined") return;
  if (typeof localStorage === "undefined") return;
  try {
    const saved = JSON.parse(
      localStorage.getItem("family-life-data-v1") || "null",
    );
    if (!saved || saved.version !== 1) return;
    [
      "ledger",
      "renqing",
      "accounts",
      "houses",
      "addresses",
      "health",
      "members",
      "retiredInvites",
    ].forEach((k) => {
      if (Array.isArray(saved[k])) state[k] = saved[k];
    });
    if (saved.categories?.expense && saved.categories?.income)
      state.categories = saved.categories;
    if (saved.invite) state.invite = saved.invite;
    if (saved.categoryLooks) Object.assign(CAT_LOOK, saved.categoryLooks);
  } catch (e) {
    toast("无法读取本机记录，原始备份未被覆盖");
    state.preview = true;
  }
}
function modalHtml() {
  if (!state.modal) return "";
  const modal = state.modal;
  let body = "";
  if (modal.type === "category-picker") {
    const selected = state.selectedCategories || [];
    body = `<div class="options">${
      slicesFor(selectedPeriodRows(), state.statsKind)
        .map(
          (s) =>
            `<button data-select-category="${esc(s.name)}" aria-pressed="${selected.includes(s.name)}" class="${selected.includes(s.name) ? "on" : ""}">${esc(s.name)} · ${s.pct.toFixed(1)}% ${selected.includes(s.name) ? "✓" : ""}</button>`,
        )
        .join("") || '<p class="sub">本月暂无分类</p>'
    }</div><button class="btn" data-dismiss style="margin-top:20px">完成选择</button>`;
  } else if (modal.type === "choice")
    body = `<div class="options picker-options">${modal.options.map((o, i) => `<button data-choice="${i}" aria-pressed="${!!o.selected}" class="${o.selected ? "on" : ""}">${esc(o.label)}${o.selected ? " ✓" : ""}</button>`).join("")}</div>`;
  else if (modal.type === "date-picker") body = datePickerHtml(modal);
  else if (modal.type === "account-type")
    body = `<div class="options">${["储蓄卡", "微信", "支付宝", "现金", "其他"].map((t) => `<button data-account-type="${t}" class="${state.draft.account?.type === t ? "on" : ""}">${t}${state.draft.account?.type === t ? "✓" : ""}</button>`).join("")}</div>`;
  else if (modal.type === "filter")
    body = `<div class="options">${[
      ["all", "全部流水"],
      ["expense", "支出"],
      ["income", "收入"],
    ]
      .map(([v, l]) => `<button data-flow-filter="${v}">${l}</button>`)
      .join("")}</div>`;
  else if (modal.type === "rq-filter")
    body = `<div class="options">${[
      ["all", "全部类型"],
      ["out", "随出"],
      ["in", "收回"],
    ]
      .map(([v, l]) => `<button data-rq-filter="${v}">${l}</button>`)
      .join("")}</div>`;
  else if (modal.type === "more")
    body =
      '<div class="options"><button data-stats="year">年度走势</button><button data-stats="surplus">收支结余</button><button data-stats="members">成员统计</button></div>';
  else if (modal.type === "delete-category")
    body = `<p class="info-copy">删除“${esc(state.draft.editingCategory)}”后，已有流水仍保留原分类名称。</p><button class="btn danger" id="confirm-delete-category" style="margin-top:20px">确认删除分类</button>`;
  else body = `<p class="info-copy">${esc(modal.text || "")}</p>`;
  return `<div class="sheet-mask" data-dismiss><section class="sheet" role="dialog" tabindex="-1" aria-modal="true" aria-label="${esc(modal.title)}"><div class="handle"></div><div class="sheet-head"><span>${esc(modal.title)}</span><button data-dismiss aria-label="关闭弹窗">${svg("close", 18)}</button></div>${body}</section></div>`;
}
function openModal(type, title, text = "") {
  captureDraft();
  state.modal = { type, title, text };
  render();
}
function copyText(text, message) {
  if (window.AndroidBridge) {
    AndroidBridge.copy(text);
    toast(message);
    return;
  }
  if (navigator.clipboard) {
    navigator.clipboard
      .writeText(text)
      .then(() => toast(message))
      .catch(() => toast("复制失败，请手动复制：" + text));
  } else toast("请手动复制：" + text);
}
function navigateAddress(detail) {
  if (window.AndroidBridge) {
    AndroidBridge.navigate(detail);
    return;
  }
  window.open(
    "https://www.google.com/maps/search/?api=1&query=" +
      encodeURIComponent(detail),
    "_blank",
    "noopener,noreferrer",
  );
}
function exportData() {
  const data = { version: 1, exportedAt: new Date().toISOString() };
  [
    "ledger",
    "renqing",
    "accounts",
    "categories",
    "houses",
    "addresses",
    "health",
    "members",
    "invite",
  ].forEach((k) => (data[k] = state[k]));
  const content = JSON.stringify(data, null, 2);
  if (window.AndroidBridge) {
    AndroidBridge.exportData(content);
    return;
  }
  const url = URL.createObjectURL(
    new Blob([content], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = "家庭生活-" + new Date().toISOString().slice(0, 10) + ".json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast("备份已导出");
}
function saveCategoryEdit() {
  const old = state.draft.editingCategory,
    oldKind = state.categoryKind,
    kind = state.draft.categoryKind || oldKind,
    name = field("cat-name");
  if (!name) {
    state.formError = "请填写分类名称";
    render();
    return;
  }
  if (name !== old && state.categories[kind].includes(name)) {
    state.formError = "分类名称已存在";
    render();
    return;
  }
  state.categories[oldKind] = state.categories[oldKind].filter(
    (n) => n !== old,
  );
  state.categories[kind].push(name);
  const look = CAT_LOOK[old] || ["fork", "#fdebea", "#d45e5c"];
  const color = state.draft.catColor || look[2];
  CAT_LOOK[name] = [state.draft.catIcon || look[0], color + "18", color];
  const custom =
    state.draft.customIcon !== undefined ? state.draft.customIcon : look[3];
  if (custom) CAT_LOOK[name].push(custom);
  state.ledger.forEach((r) => {
    if (r.category === old) r.category = name;
  });
  state.categoryKind = kind;
  go("categories");
  persistState();
}

if (typeof document !== "undefined") {
  loadSavedState();
  if (typeof CloudSync !== "undefined") CloudSync.boot();
  else render();
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && (state.modal || state.route === "weight")) {
      event.preventDefault();
      appBack();
    }
    const dialog = [...document.querySelectorAll('[role="dialog"]')].at(-1);
    if (event.key !== "Tab" || !dialog) return;
    const items = [
      ...dialog.querySelectorAll(
        "button:not([disabled]),input,select,textarea",
      ),
    ].filter(
      (el) =>
        !el.disabled && el.getClientRects().length && !el.closest("[inert]"),
    );
    const first = items[0],
      last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  });
}
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    state,
    monthTotals,
    saveRenqing,
    saveLedgerRow,
    go,
    setCategoryKind,
    sortCategories,
    saveCategory,
    screenCategories,
    screenAssets,
    finishAccountSave,
    appBack,
    screenCategoryAdd,
    allLedgerRows,
    selectedPeriodRows,
    statTotals,
    persistState,
    loadSavedState,
  };
}
