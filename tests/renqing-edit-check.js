const assert = require("node:assert/strict");
const app = require("../web/js/app.js");
const s = app.state;
s.accounts = [
  { id: 1, balance: 900 },
  { id: 2, balance: 500 },
];
s.renqing = [
  {
    id: 10,
    ledgerId: 11,
    name: "原姓名",
    reason: "婚礼",
    side: "out",
    amount: 100,
    accountId: 1,
    occurredOn: "2026-09-29",
    day: "9月29日",
    member: "原成员",
  },
];
s.ledger = [
  {
    id: 11,
    renqingId: 10,
    kind: "expense",
    amount: 100,
    accountId: 1,
    category: "人情",
  },
];
const edit = {
  editId: 10,
  name: "新姓名",
  reason: "回礼",
  side: "in",
  amount: 50,
  accountId: 2,
  day: "2026-09-30",
  note: "已修改",
};
assert.equal(app.saveRenqing(edit), true);
assert.deepEqual(
  s.accounts.map((a) => a.balance),
  [1000, 550],
);
assert.equal(s.renqing.length, 1);
assert.equal(s.ledger.length, 1);
assert.equal(s.ledger[0].id, 11);
assert.equal(s.ledger[0].kind, "income");
assert.equal(s.ledger[0].note, "已修改");
assert.equal(s.renqing[0].occurredOn, "2026-09-30");
app.saveRenqing(edit);
assert.deepEqual(
  s.accounts.map((a) => a.balance),
  [1000, 550],
);
const before = JSON.stringify([s.accounts, s.ledger, s.renqing]);
assert.equal(app.saveRenqing({ ...edit, amount: -1 }), false);
assert.equal(JSON.stringify([s.accounts, s.ledger, s.renqing]), before);
assert.equal(app.saveRenqing({ ...edit, editId: 999 }), false);
assert.equal(JSON.stringify([s.accounts, s.ledger, s.renqing]), before);
// Older imported gifts had no materialized ledger row; editing must not double count them.
s.ledger = [];
delete s.renqing[0].ledgerId;
app.saveRenqing({ ...edit, side: "out", amount: 25 });
assert.deepEqual(
  s.accounts.map((a) => a.balance),
  [1000, 475],
);
assert.equal(app.allLedgerRows().length, 1);
app.saveRenqing({ ...edit, side: "out", amount: 25 });
assert.equal(s.ledger.length, 1);
assert.equal(s.accounts[1].balance, 475);
console.log(
  "Gift edits reverse prior balance, update linked ledger once, preserve IDs and support imported legacy records.",
);
