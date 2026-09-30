const assert = require("node:assert/strict");
const app = require("../web/js/app.js");
const { state, go, finishAccountSave, appBack } = app;
for (const route of ["ledger", "renqing-add"]) {
  state.route = "home";
  state.navStack = [];
  state.draft = {};
  go(route, { kind: "income", ledTitle: "保留名称", ledAmount: "12.50" });
  go("account-form");
  finishAccountSave(987);
  assert.equal(state.route, route);
  assert.equal(state.draft.accountId, 987);
  assert.equal(state.draft.ledTitle, "保留名称");
  assert.equal(state.draft.ledAmount, "12.50");
  assert.deepEqual(
    state.navStack.map((p) => p.route),
    ["home"],
  );
  appBack();
  assert.equal(state.route, "home");
}
state.route = "accounts";
state.navStack = [];
go("account-detail", { accountId: 3 });
go("account-form", { account: { id: 3 } });
finishAccountSave(3);
assert.equal(state.route, "account-detail");
assert.equal(state.draft.accountId, 3);
appBack();
assert.equal(state.route, "accounts");
go("account-form");
appBack();
assert.equal(state.route, "accounts");
console.log(
  "Account creation resumes ledger/gift drafts; account edits return to detail; no completed form in back stack.",
);
