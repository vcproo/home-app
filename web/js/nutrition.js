/* Local nutrition calculations. No requests, credentials or private images. */
(function (root) {
  const activity = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    active: 1.725,
  };
  function target(person) {
    const age = Number(person.age),
      weight = Number(person.weight),
      height = Number(person.height);
    if (age < 18 || age > 100 || person.specialNutrition) return null;
    if (
      !Number.isFinite(age) ||
      !Number.isFinite(weight) ||
      !Number.isFinite(height) ||
      weight < 20 ||
      weight > 350 ||
      height < 80 ||
      height > 250 ||
      !["男", "女"].includes(person.sex) ||
      !activity[person.activity]
    )
      return null;
    const resting =
      10 * weight + 6.25 * height - 5 * age + (person.sex === "男" ? 5 : -161);
    const maintenance = resting * activity[person.activity];
    // A modest product default, not a medical prescription. User may override.
    const adjustment =
      person.goal === "lose" ? 0.9 : person.goal === "gain" ? 1.1 : 1;
    const suggested = Math.round(maintenance * adjustment);
    const override = Number(person.calorieTarget);
    return {
      resting: Math.round(resting),
      maintenance: Math.round(maintenance),
      suggested,
      calories:
        Number.isFinite(override) && override >= 1000 && override <= 6000
          ? Math.round(override)
          : suggested,
      manual: Number.isFinite(override) && override >= 1000 && override <= 6000,
    };
  }
  function total(meals, date) {
    return Math.round(
      meals
        .filter((m) => m.date === date)
        .reduce((n, m) => n + Number(m.calories || 0), 0),
    );
  }
  function validMeal(meal) {
    return (
      !!String(meal.name || "").trim() &&
      /^\d{4}-\d{2}-\d{2}$/.test(meal.date || "") &&
      Number.isFinite(Number(meal.calories)) &&
      Number(meal.calories) > 0 &&
      Number(meal.calories) <= 10000
    );
  }
  const api = { target, total, validMeal, activity };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Nutrition = api;
})(typeof window === "undefined" ? {} : window);
