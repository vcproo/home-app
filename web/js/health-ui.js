function healthToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function healthCurrent() {
  return state.health[0];
}
function healthSelect(id, label, options, value) {
  return `<label class="form-field"><span>${label}</span><select id="${id}" aria-label="${label}">${options.map(([v, t]) => `<option value="${v}" ${String(value) === String(v) ? "selected" : ""}>${t}</option>`).join("")}</select></label>`;
}
function calorieCard(person, date) {
  const plan = Nutrition.target(person),
    total = Nutrition.total(person.meals || [], date);
  const percent = plan ? Math.min(100, (total / plan.calories) * 100) : 0;
  const remainder = plan ? plan.calories - total : 0;
  return `<div class="card calorie-card"><div class="section-h"><h2>${date === healthToday() ? "今日" : "当日"}摄入</h2><button data-go="health-profile">调整目标 ${svg("right", 12)}</button></div><div class="calorie-ring" style="--progress:${percent}%;--ring-color:${remainder < 0 ? "#bd8451" : "#245c4f"}" role="img" aria-label="已摄入 ${total} 千卡${plan ? "，目标 " + plan.calories + " 千卡" : "，请完善资料设置目标"}"><div><span class="sub">已摄入 · kcal</span><strong>${total}</strong><span class="sub">${plan ? "目标 " + plan.calories : "待设置目标"}</span></div></div><p class="calorie-remaining">${plan ? (remainder >= 0 ? "距离目标还差 " + remainder : "已超过目标 " + Math.abs(remainder)) + " kcal" : "完善年龄、活动量和目标后查看建议"}</p><p class="sub">${plan ? `${plan.manual ? "自定义" : "估算"}目标 ${plan.calories} kcal / 天 · ${person.goal === "lose" ? "减重" : person.goal === "gain" ? "增重" : "维持现状"}` : "年龄不足18岁或有特殊营养需求时不自动计算。"}</p></div>`;
}
function screenNutrition() {
  const p = healthCurrent(),
    date = state.nutritionDate || healthToday();
  const meals = (p.meals || []).filter((m) => m.date === date);
  return page(
    `${back("每日饮食")}<label class="nutrition-date"><span>记录日期</span><input id="nutrition-date" type="date" aria-label="饮食日期" value="${date}"></label>${calorieCard(p, date)}<button class="btn photo-entry" data-go="food-photo">${svg("plus", 18)}拍照识别饮食</button><button class="btn" data-go="meal-form">${svg("plus", 18)}手动记录饮食</button>${p.deletedMeals?.length ? '<button class="btn ghost" id="undo-meal" style="margin-top:12px">恢复最近删除的记录</button>' : ""}${section("饮食记录", `<span class="sub">${meals.length} 笔</span>`)}<div class="list-card">${meals.map((m) => `<button class="tx" data-meal-id="${m.id}">${chip("fork")}<span class="grow"><span class="title">${esc(m.name)}</span><span class="sub" style="display:block">${esc(m.mealType)} · ${esc(m.portion || "未填写份量")}</span></span><b>${m.calories} <span class="sub">kcal</span></b></button>`).join("") || '<p class="empty-ranking sub">这一天还没有饮食记录</p>'}</div>`,
  );
}
function screenHealthProfile() {
  const p = healthCurrent();
  return page(
    `${back("健康资料与目标")}<div class="form-card">${healthSelect(
      "hp-sex",
      "计算用性别",
      [
        ["男", "男"],
        ["女", "女"],
      ],
      p.sex,
    )}${inputField("年龄（周岁）", "hp-age", "请输入年龄", p.age || "", 'type="number" inputmode="numeric"')}${inputField("身高（cm）", "hp-height", "", p.height, 'type="number" inputmode="decimal"')}${inputField("体重（kg）", "hp-weight", "", p.weight, 'type="number" inputmode="decimal"')}${healthSelect(
      "hp-activity",
      "活动量",
      [
        ["", "请选择"],
        ["sedentary", "久坐，几乎不运动"],
        ["light", "轻度，每周运动1–3天"],
        ["moderate", "中度，每周运动3–5天"],
        ["active", "较高，每周运动6–7天"],
      ],
      p.activity || "",
    )}${healthSelect(
      "hp-goal",
      "体重目标",
      [
        ["lose", "减重"],
        ["maintain", "维持现状"],
        ["gain", "增重"],
      ],
      p.goal || "maintain",
    )}${healthSelect(
      "hp-special",
      "特殊营养需求",
      [
        ["no", "无"],
        ["yes", "孕期、哺乳期或需专业营养方案"],
      ],
      p.specialNutrition ? "yes" : "no",
    )}${inputField("自定义每日目标（选填，kcal）", "hp-target", "留空则随资料自动计算", p.calorieTarget || "", 'type="number" inputmode="numeric"')}</div><div class="banner nutrition-help">按 Mifflin–St Jeor 公式估算静息代谢，再结合活动量。维持采用估算消耗；减重、增重默认分别调整 −10%、+10%，属于可调整的应用参考值。更新体重后自动目标随之变化，自定义目标保持不变。</div>${action("保存资料与目标", "save-health-profile")}`,
  );
}
function screenMealForm() {
  const p = healthCurrent(),
    meal = (p.meals || []).find((m) => m.id === state.draft.mealId) || {};
  return page(
    `${back(meal.id ? "修改饮食记录" : "记录饮食")}<div class="form-card">${inputField("食物名称", "meal-name", "例如：米饭和炒青菜", meal.name || "", 'maxlength="80"')}${healthSelect(
      "meal-type",
      "餐次",
      [
        ["早餐", "早餐"],
        ["午餐", "午餐"],
        ["晚餐", "晚餐"],
        ["加餐", "加餐"],
      ],
      meal.mealType || "午餐",
    )}${inputField("份量", "meal-portion", "例如：一碗，约150克", meal.portion || "", 'maxlength="80"')}${inputField("热量（kcal）", "meal-calories", "请输入热量", meal.calories || "", 'type="number" inputmode="decimal"')}<label class="form-field"><span>日期</span><input id="meal-date" type="date" aria-label="饮食日期" value="${meal.date || state.nutritionDate || healthToday()}"></label>${inputField("备注", "meal-note", "选填", meal.note || "", 'maxlength="200"')}</div>${meal.id ? '<button class="btn ghost" id="delete-meal" style="margin-top:20px">删除这条记录</button>' : ""}${action("保存饮食记录", "save-meal")}`,
  );
}
function bindHealth() {
  const on = (id, fn) =>
    document.getElementById(id)?.addEventListener("click", fn);
  document.querySelectorAll("[data-meal-id]").forEach(
    (button) =>
      (button.onclick = () =>
        go("meal-form", {
          healthIndex: 0,
          mealId: button.dataset.mealId,
        })),
  );
  on("save-health-profile", () => {
    const p = healthCurrent(),
      age = Number(field("hp-age")),
      height = Number(field("hp-height")),
      weight = Number(field("hp-weight")),
      custom = field("hp-target");
    if (
      !Number.isInteger(age) ||
      age < 1 ||
      age > 120 ||
      !Number.isFinite(height) ||
      height < 80 ||
      height > 250 ||
      !Number.isFinite(weight) ||
      weight < 20 ||
      weight > 350 ||
      !field("hp-activity") ||
      (custom &&
        (!Number.isFinite(Number(custom)) ||
          Number(custom) < 1000 ||
          Number(custom) > 6000))
    ) {
      state.formError =
        "请检查年龄（1–120）、身高（80–250）、体重（20–350）、活动量及自定义目标（1000–6000）。";
      render();
      return;
    }
    if (p.weight !== weight) {
      p.records ||= [];
      p.records.unshift({
        w: weight,
        day: healthToday().replace(/(\d+)-(\d+)-(\d+)/, "$1年$2月$3日"),
        d: p.weight == null ? 0 : Math.round((weight - p.weight) * 10) / 10,
      });
      p.delta =
        p.weight == null
          ? 0
          : Math.round(((p.delta || 0) + weight - p.weight) * 10) / 10;
    }
    Object.assign(p, {
      age,
      height,
      weight,
      sex: field("hp-sex"),
      activity: field("hp-activity"),
      goal: field("hp-goal"),
      specialNutrition: field("hp-special") === "yes",
      calorieTarget: custom ? Number(custom) : null,
    });
    persistState();
    appBack();
    toast("健康资料与每日目标已更新");
  });
  on("save-meal", () => {
    const meal = {
      id:
        state.draft.mealId ||
        Date.now() + "-" + Math.random().toString(16).slice(2, 8),
      name: field("meal-name"),
      mealType: field("meal-type"),
      portion: field("meal-portion"),
      calories: Math.round(Number(field("meal-calories"))),
      date: field("meal-date"),
      note: field("meal-note"),
      source: "manual",
    };
    if (!Nutrition.validMeal(meal)) {
      state.formError = "请填写食物名称、日期和有效热量（1–10000 kcal）。";
      render();
      return;
    }
    const p = healthCurrent();
    p.meals ||= [];
    const index = p.meals.findIndex((m) => m.id === meal.id);
    if (index >= 0) p.meals[index] = meal;
    else p.meals.push(meal);
    state.nutritionDate = meal.date;
    persistState();
    go("nutrition");
    toast("饮食记录已保存");
  });
  on("undo-meal", () => {
    const p = healthCurrent();
    const restored = p.deletedMeals?.pop();
    if (restored) {
      p.meals ||= [];
      p.meals.push(restored);
      state.nutritionDate = restored.date;
      persistState();
      render();
      toast("饮食记录已恢复");
    }
  });
  on("delete-meal", () => {
    const p = healthCurrent(),
      removed = (p.meals || []).find((m) => m.id === state.draft.mealId);
    p.meals = (p.meals || []).filter((m) => m.id !== state.draft.mealId);
    p.deletedMeals ||= [];
    if (removed) p.deletedMeals.push(removed);
    persistState();
    go("nutrition");
    toast("记录已移入本机备份的已删除记录");
  });
}
