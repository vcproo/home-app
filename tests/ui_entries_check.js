const app = require("../web/js/app.js");

function assert(cond, msg) {
  if (!cond) {
    console.error(msg);
    process.exit(1);
  }
}

const before = app.monthTotals();
const target = app.state.accounts.find((row) => row.id === 2);
const untouched = app.state.accounts.find((row) => row.id === 1);
const targetStart = target.balance;
const untouchedStart = untouched.balance;
assert(
  app.saveRenqing({
    name: "张三",
    amount: 50,
    side: "out",
    accountId: 2,
    day: "2026-09-25",
    reason: "婚礼",
    note: "测试",
  }),
  "renqing save",
);
const after = app.monthTotals();
assert(
  after.expense === before.expense + 50,
  "expense " + before.expense + " -> " + after.expense,
);
assert(after.income === before.income, "income changed on 随出");
assert(target.balance === targetStart - 50, "chosen account balance");
assert(untouched.balance === untouchedStart, "other account changed");

const third = app.state.accounts.find((row) => row.id === 3);
const thirdStart = third.balance;
assert(
  app.saveLedgerRow({
    kind: "income",
    amount: 80,
    accountId: 3,
    category: "奖金",
    title: "项目奖",
    day: "2026-09-26",
  }),
  "ledger save",
);
const later = app.monthTotals();
assert(later.income === after.income + 80, "income counted once");
assert(later.expense === after.expense, "expense changed on income");
assert(third.balance === thirdStart + 80, "income account");
assert(app.state.ledger[0].category === "奖金", "saved category");
assert(app.state.ledger[0].accountId === 3, "saved account");
assert(
  app.state.ledger[0].day === "9月26日",
  "saved day " + app.state.ledger[0].day,
);
assert(app.state.ledger[0].occurredOn === "2026-09-26", "saved iso");
assert(before.expense > 0 && before.income > 0, "seed september missing");
const september = app.monthTotals();
assert(
  app.saveLedgerRow({
    kind: "expense",
    amount: 40,
    accountId: 4,
    category: "交通",
    title: "八月",
    day: "2026-08-01",
  }),
  "august save",
);
assert(
  app.saveRenqing({
    name: "去年",
    amount: 70,
    side: "out",
    accountId: 4,
    day: "2025-09-15",
    reason: "探望",
  }),
  "prior september save",
);
const still = app.monthTotals();
assert(
  still.expense === september.expense,
  "other month expense " + september.expense + " -> " + still.expense,
);
assert(
  still.income === september.income,
  "other month income " + september.income + " -> " + still.income,
);

app.go("category-add");
assert(app.state.route === "category-add", "route " + app.state.route);
const addHtml = app.screenCategoryAdd();
assert(addHtml.indexOf("添加分类") >= 0, "add screen");
assert(
  addHtml.indexOf("支出") >= 0 && addHtml.indexOf("收入") >= 0,
  "type switch",
);
app.setCategoryKind("income");
const listHtml = app.screenCategories();
assert(listHtml.indexOf("工资") >= 0, "income categories");
assert(listHtml.indexOf("收入分类") >= 0, "income segment");
assert(listHtml.indexOf("餐饮") < 0, "expense names leaked");
app.sortCategories();
const sorted = app.state.categories.income
  .slice()
  .sort((a, b) => a.localeCompare(b, "zh"));
assert(app.state.categories.income.join("|") === sorted.join("|"), "sort");
assert(app.saveCategory({ kind: "expense", name: "宠物" }), "save category");
assert(app.state.categories.expense.indexOf("宠物") >= 0, "category stored");
assert(app.state.route === "categories", "returned to list");
console.log("ui entries ok");
