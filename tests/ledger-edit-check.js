const assert = require("node:assert/strict");
const app = require("../web/js/app.js");
const { state } = app;
const original = structuredClone(state.ledger[0]);
const a = state.accounts.find((a) => a.id === original.accountId);
const b = state.accounts.find((b) => b.id !== a.id);
const beforeA = a.balance,
  beforeB = b.balance,
  count = state.ledger.length;
const edit = {
  editId: original.id,
  kind: "income",
  category: "工资",
  title: "已修改",
  amount: 20.15,
  accountId: b.id,
  day: "2026-08-31",
  note: "编辑备注",
};
assert.equal(app.saveLedgerRow({ ...edit, amount: -1 }), false);
assert.equal(a.balance, beforeA);
assert.equal(b.balance, beforeB);
assert.equal(app.saveLedgerRow(edit), true);
assert.equal(a.balance, beforeA + original.amount);
assert.equal(b.balance, Math.round((beforeB + 20.15) * 100) / 100);
assert.equal(state.ledger.length, count);
assert.equal(state.ledger[0].id, original.id);
assert.equal(state.ledger[0].member, original.member);
assert.equal(state.ledger[0].occurredOn, "2026-08-31");
assert.equal(state.ledger[0].note, "编辑备注");
assert.equal(app.saveLedgerRow(edit), true);
assert.equal(
  b.balance,
  Math.round((beforeB + 20.15) * 100) / 100,
  "repeated edit must not apply twice",
);
const gift = state.renqing[0],
  giftAccount = state.accounts.find((a) => a.id === gift.accountId),
  balance = giftAccount.balance;
const projected = app.allLedgerRows().find((r) => r.renqingId === gift.id);
const originalGiftAmount = gift.amount;
assert.equal(
  app.saveLedgerRow({
    editId: projected.id,
    kind: "expense",
    category: "人情",
    title: "修改人情",
    amount: 99.99,
    accountId: gift.accountId,
    day: "2026-09-20",
  }),
  true,
);
assert.equal(gift.amount, 99.99);
assert.equal(
  giftAccount.balance,
  Math.round((balance + originalGiftAmount - 99.99) * 100) / 100,
);
assert.equal(
  app.allLedgerRows().filter((r) => r.renqingId === gift.id).length,
  1,
  "gift counted once after edit",
);
assert.equal(gift.name, "修改人情");
console.log(
  "ledger edits: reversal, account/type/date changes, idempotence and linked gifts ok",
);
