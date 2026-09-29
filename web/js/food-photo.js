let foodPhoto = null;
let visionPending = null;
let visionTimer = null;
function photoSession() {
  const personIndex = 0;
  if (!foodPhoto || foodPhoto.personIndex !== personIndex)
    foodPhoto = {
      personIndex,
      date: state.nutritionDate || healthToday(),
      image: "",
      foods: null,
      notes: "",
      error: "",
      busy: false,
    };
  return foodPhoto;
}
function screenFoodPhoto() {
  const p = photoSession(),
    config = modelConfig();
  let host = "尚未配置";
  try {
    host = new URL(config.endpoint).host;
  } catch {}
  return page(
    `${back("照片识别饮食")}<p class="sub">${esc(p.date)}</p><div class="card photo-card">${p.image ? `<img class="food-preview" src="${p.image}" alt="待识别的食物照片">` : '<div class="photo-empty">选择一张清晰的食物照片<br><span class="sub">尽量拍全餐盘，便于估算份量</span></div>'}<div class="two-actions"><button class="btn ghost" id="choose-food" ${p.busy ? "disabled" : ""}>从相册选择</button><button class="btn ghost" id="camera-food" ${p.busy ? "disabled" : ""}>拍照</button></div><input hidden type="file" id="food-file" accept="image/jpeg,image/png,image/webp"></div><p class="sub nutrition-help">仅在点击“开始识别”后上传照片至 ${esc(host)}。不会发送你的健康资料；照片不写入饮食备份。</p><button class="linkish" data-go="model-settings">设置识别模型 ${svg("right", 12)}</button><p class="err" role="alert">${esc(p.error)}</p>${p.busy ? '<div class="card" role="status">正在识别食物，请稍候…<button class="linkish" id="cancel-vision">取消识别</button></div>' : `<button class="btn" id="analyze-food" ${!p.image ? "disabled" : ""}>${p.foods ? "重新识别" : "开始识别"}</button>`}${
      p.foods
        ? `<div class="banner nutrition-help">${esc(p.notes)}<br>请逐项核对、修改后再确认。</div>${p.foods.map((f, i) => `<div class="form-card food-result">${inputField("食物名称", "food-name-" + i, "", f.name, 'maxlength="80"')}${inputField("份量", "food-portion-" + i, "", f.portion, 'maxlength="100"')}${inputField("热量（kcal）", "food-kcal-" + i, "", f.calories, 'type="number" inputmode="decimal"')}<button class="linkish" data-remove-food="${i}">移除此项</button></div>`).join("")}${
            p.foods.length
              ? `${healthSelect(
                  "photo-meal-type",
                  "餐次",
                  [
                    ["早餐", "早餐"],
                    ["午餐", "午餐"],
                    ["晚餐", "晚餐"],
                    ["加餐", "加餐"],
                  ],
                  p.mealType || "午餐",
                )}<button class="btn" id="confirm-food">确认并计入当天摄入</button>`
              : '<p class="sub">没有可计入的食物，请换一张照片或手动记录。</p>'
          }`
        : ""
    }<button class="btn ghost" data-go="meal-form" style="margin-top:16px">手动记录饮食</button>`,
  );
}
function rememberFoodEdits() {
  if (!foodPhoto?.foods) return;
  foodPhoto.foods.forEach((f, i) => {
    const el = document.getElementById("food-name-" + i);
    if (el) {
      f.name = el.value;
      f.portion = field("food-portion-" + i);
      f.calories = Number(field("food-kcal-" + i));
    }
  });
  if (document.getElementById("photo-meal-type"))
    foodPhoto.mealType = field("photo-meal-type");
}
function foodPhotoResult(result) {
  if (state.route !== "food-photo") return;
  const p = photoSession();
  if (result.cancelled) return;
  if (result.error) {
    p.error = result.error;
    render();
    return;
  }
  if (
    !/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(result.image || "") ||
    result.image.length > 5 * 1024 * 1024
  ) {
    p.error = "图片无效或过大";
    render();
    return;
  }
  p.image = result.image;
  p.foods = null;
  p.error = "";
  state.formValues = {};
  render();
}
async function browserPhoto(file) {
  if (!file) return;
  try {
    if (
      file.size > 20 * 1024 * 1024 ||
      !["image/jpeg", "image/png", "image/webp"].includes(file.type)
    )
      throw Error("请选择20MB以内的 JPG、PNG 或 WebP 图片");
    const bitmap = await createImageBitmap(file),
      scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas
      .getContext("2d")
      .drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    foodPhotoResult({ image: canvas.toDataURL("image/jpeg", 0.82) });
  } catch (e) {
    foodPhotoResult({ error: e.message || "无法读取图片" });
  }
}
function cancelFoodRequest() {
  if (visionPending) {
    window.AndroidBridge?.cancelFoodRequest?.();
    visionPending.controller?.abort();
  }
  visionPending = null;
  clearTimeout(visionTimer);
  if (foodPhoto) foodPhoto.busy = false;
}
function foodVisionResult(id, result) {
  if (!visionPending || visionPending.id !== id) return;
  const pending = visionPending;
  visionPending = null;
  clearTimeout(visionTimer);
  if (!foodPhoto || foodPhoto !== pending.session) return;
  foodPhoto.busy = false;
  try {
    if (result.error) throw Error(result.error);
    const parsed = FoodVision.parse(result.response);
    foodPhoto.foods = parsed.foods;
    foodPhoto.notes = parsed.notes;
    foodPhoto.error = "";
    state.formValues = {};
  } catch (e) {
    foodPhoto.error = e.message;
  }
  if (state.route === "food-photo") render();
}
function bindFoodPhoto() {
  const on = (id, fn) =>
    document.getElementById(id)?.addEventListener("click", fn);
  const pick = (camera) => {
    if (window.AndroidBridge?.chooseFoodPhoto) {
      AndroidBridge.chooseFoodPhoto(camera);
      return;
    }
    const input = document.getElementById("food-file");
    if (camera) input.setAttribute("capture", "environment");
    else input.removeAttribute("capture");
    input.click();
  };
  on("choose-food", () => pick(false));
  on("camera-food", () => pick(true));
  document
    .getElementById("food-file")
    ?.addEventListener("change", (e) => browserPhoto(e.target.files[0]));
  on("cancel-vision", () => {
    cancelFoodRequest();
    render();
  });
  on("analyze-food", async () => {
    const p = photoSession();
    if (p.busy) return;
    let requestId = null;
    try {
      const config = modelConfig();
      if (!config.endpoint || !config.model)
        throw Error("请先在“我的 → 模型设置”中配置视觉模型");
      if (config.auth !== "none" && !config.hasKey)
        throw Error("请先填写模型 API 密钥");
      const url = FoodVision.endpoint(config.endpoint),
        body = FoodVision.request(config.model, p.image);
      p.busy = true;
      p.error = "";
      p.foods = null;
      const id = Date.now() + "-" + Math.random().toString(16).slice(2);
      requestId = id;
      visionPending = { id, session: p };
      render();
      visionTimer = setTimeout(() => {
        if (visionPending?.id === id) {
          cancelFoodRequest();
          p.error = "识别超时，请重试";
          if (state.route === "food-photo") render();
        }
      }, 120000);
      if (window.AndroidBridge?.analyzeFood) {
        AndroidBridge.analyzeFood(id, JSON.stringify(body));
        return;
      }
      const controller = new AbortController();
      visionPending.controller = controller;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(config.apiKey
            ? { Authorization: "Bearer " + config.apiKey }
            : {}),
        },
        body: JSON.stringify(body),
        signal: controller.signal,
        redirect: "error",
      });
      if (!response.ok)
        throw Error(
          "识别服务返回 " + response.status + "，请检查配置或稍后重试",
        );
      const text = await response.text();
      foodVisionResult(id, { response: text });
    } catch (e) {
      if (requestId && visionPending?.id !== requestId) return;
      if (p.busy) {
        cancelFoodRequest();
      }
      p.error =
        e.name === "AbortError"
          ? "识别已取消"
          : e.message || "连接失败，请检查网络或接口配置";
      if (state.route === "food-photo") render();
    }
  });
  document.querySelectorAll("[data-remove-food]").forEach(
    (b) =>
      (b.onclick = () => {
        rememberFoodEdits();
        foodPhoto.foods.splice(Number(b.dataset.removeFood), 1);
        state.formValues = {};
        render();
      }),
  );
  on("confirm-food", () => {
    const p = photoSession();
    rememberFoodEdits();
    if (!p.foods?.length) return;
    if (!p.foods.every((f) => Nutrition.validMeal({ ...f, date: p.date }))) {
      p.error = "请填写每项食物名称及1–10000 kcal的有效热量";
      render();
      return;
    }
    const person = healthCurrent();
    person.meals ||= [];
    const batch = Date.now() + "-" + Math.random().toString(16).slice(2);
    p.foods.forEach((f, i) =>
      person.meals.push({
        id: batch + "-" + i,
        name: f.name,
        portion: f.portion,
        calories: Math.round(f.calories),
        date: p.date,
        mealType: p.mealType || "午餐",
        note: p.notes,
        source: "vision-confirmed",
      }),
    );
    state.nutritionDate = p.date;
    const index = p.personIndex;
    foodPhoto = null;
    persistState();
    go("nutrition", { healthIndex: index });
    toast("已确认并计入当天摄入");
  });
}
