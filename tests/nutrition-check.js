const assert = require("node:assert/strict");
const { target, total, validMeal } = require("../web/js/nutrition.js");
const person = {
  age: 30,
  weight: 70,
  height: 175,
  sex: "男",
  activity: "sedentary",
  goal: "maintain",
};
assert.equal(target(person).resting, 1649);
assert.equal(target(person).calories, 1979);
assert(target({ ...person, goal: "lose" }).calories < target(person).calories);
assert(target({ ...person, goal: "gain" }).calories > target(person).calories);
assert(target({ ...person, weight: 75 }).calories > target(person).calories);
assert.equal(target({ ...person, calorieTarget: 2200 }).calories, 2200);
assert.equal(target({ ...person, age: undefined }), null);
assert.equal(target({ ...person, age: 15 }), null);
assert.equal(target({ ...person, specialNutrition: true }), null);
assert.equal(target({ ...person, weight: Infinity }), null);
assert.equal(
  total(
    [
      { date: "2026-09-26", calories: 300 },
      { date: "2026-09-26", calories: 200 },
      { date: "2026-09-25", calories: 500 },
    ],
    "2026-09-26",
  ),
  500,
);
assert.equal(
  validMeal({ name: "米饭", date: "2026-09-26", calories: 230 }),
  true,
);
for (const calories of [NaN, Infinity, 0, -1, 10001])
  assert.equal(
    validMeal({ name: "米饭", date: "2026-09-26", calories }),
    false,
  );
console.log("nutrition targets, profile constraints and daily meal totals ok");
