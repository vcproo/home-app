const assert = require("node:assert/strict");
const app = require("../web/js/app.js");
// Assert the displayed family total, not only the underlying sum.
const originalAccounts = app.state.accounts;
app.state.accounts = [];
assert.match(app.screenAssets(), /class="hero">0\.00<\/div>/);
app.state.accounts = [
  { id: 1, name: "计入", balance: 100, counted: true },
  { id: 2, name: "不计入", balance: 500, counted: false },
  { id: 3, name: "负余额", balance: -20, counted: true },
];
assert.match(app.screenAssets(), /class="hero">80\.00<\/div>/);
app.state.accounts = originalAccounts;
const account = app.state.accounts[0];
const initial = account.balance;
const count = app.state.ledger.length;
for (const amount of [Infinity, NaN, -1, 0, 0.001, 1000000000]) {
  assert.equal(
    app.saveLedgerRow({
      amount,
      kind: "expense",
      accountId: account.id,
      category: "餐饮",
      title: "invalid",
    }),
    false,
  );
  assert.equal(account.balance, initial);
  assert.equal(app.state.ledger.length, count);
}
assert.equal(
  app.saveLedgerRow({
    amount: 0.1,
    kind: "expense",
    accountId: account.id,
    category: "餐饮",
    title: "精度检查",
  }),
  true,
);
assert.equal(
  app.saveLedgerRow({
    amount: 0.2,
    kind: "expense",
    accountId: account.id,
    category: "餐饮",
    title: "精度检查",
  }),
  true,
);
assert.equal(account.balance, (Math.round(initial * 100) - 30) / 100);
console.log("money validation and cent precision ok");
const displayTotals = app.statTotals(app.selectedPeriodRows());
assert.equal(displayTotals.income, app.monthTotals().income);
assert.equal(displayTotals.expense, app.monthTotals().expense);
const prior = app.allLedgerRows().length;
app.saveRenqing({
  name: "汇总测试",
  amount: 1.25,
  side: "out",
  accountId: 1,
  day: "2026-09-24",
});
assert.equal(
  app.allLedgerRows().length,
  prior + 1,
  "gift mirror counted twice",
);
assert.equal(
  app.statTotals(app.selectedPeriodRows()).expense,
  app.monthTotals().expense,
);
const cache = new Map();
global.localStorage = {
  setItem: (k, v) => cache.set(k, v),
  getItem: (k) => cache.get(k) || null,
};
app.persistState();
const expected = app.state.accounts[0].balance;
app.state.accounts[0].balance = -999;
app.loadSavedState();
assert.equal(
  app.state.accounts[0].balance,
  expected,
  "saved data did not survive reload",
);
assert.ok(
  !cache.get("family-life-data-v1").includes('"password"'),
  "password must never be persisted",
);
console.log("consistent summaries and storage restore ok");
