let modelKeyDraft = "";
let browserModelConfig = {};
function modelConfig() {
  try {
    return window.AndroidBridge?.getModelConfig
      ? JSON.parse(AndroidBridge.getModelConfig())
      : browserModelConfig;
  } catch {
    return { error: "无法读取模型配置" };
  }
}
function captureModelDraft() {
  const input = document.getElementById("model-key");
  if (input) modelKeyDraft = input.value;
}
function screenModelSettings() {
  const config = modelConfig();
  return page(
    `${back("模型设置")}<div class="banner nutrition-help">支持兼容 OpenAI Chat Completions 的视觉模型。食物照片仅在你点击“开始识别”后发送给这里配置的服务。识别结果经你核对确认后才计入饮食记录。</div><div class="form-card" style="margin-top:20px">${inputField("配置名称", "model-label", "例如：我的视觉模型", config.label || "", 'maxlength="50"')}${inputField("接口地址", "model-endpoint", "HTTPS 服务地址或 /chat/completions 地址", config.endpoint || "", 'type="url" autocomplete="off" spellcheck="false"')}${inputField("模型名称", "model-name", "服务商提供的模型名称", config.model || "", 'autocomplete="off" spellcheck="false"')}<label class="form-field"><span>API 密钥${config.hasKey ? "（已保存，留空保留）" : ""}</span><input id="model-key" type="password" autocomplete="off" placeholder="服务无需密钥时留空" value="${esc(modelKeyDraft)}"></label>${healthSelect(
      "model-no-key",
      "鉴权方式",
      [
        ["key", "使用 API 密钥"],
        ["none", "服务无需密钥"],
      ],
      config.auth === "none" ? "none" : "key",
    )}</div><p class="sub nutrition-help">${window.AndroidBridge?.saveModelConfig ? "配置和密钥只在本机加密保存，不包含在账本导出中。" : "浏览器预览只在当前页面会话中保留配置，关闭后不保存。"}</p><div class="err">${esc(config.error || "")}</div><button class="btn ghost" id="clear-model" style="margin-top:18px">清除本机模型配置</button>${action("保存模型配置", "save-model")}`,
  );
}
function bindModelSettings() {
  document.getElementById("save-model")?.addEventListener("click", () => {
    const config = {
      label: field("model-label"),
      endpoint: field("model-endpoint"),
      model: field("model-name"),
      apiKey: field("model-key"),
      clearKey: field("model-no-key") === "none",
    };
    try {
      config.endpoint = FoodVision.endpoint(config.endpoint);
      const uri = new URL(config.endpoint);
      if (
        uri.protocol !== "https:" ||
        uri.username ||
        uri.password ||
        uri.hash ||
        !config.model
      )
        throw Error("请填写完整的 HTTPS 接口地址和模型名称");
      const previous = modelConfig();
      if (
        previous.endpoint &&
        previous.endpoint !== config.endpoint &&
        previous.hasKey &&
        !config.apiKey &&
        !config.clearKey
      )
        throw Error("更换接口地址时请重新填写密钥，或选择无需密钥");
      config.auth = config.clearKey ? "none" : "key";
      if (config.clearKey) config.apiKey = "";
      const result = window.AndroidBridge?.saveModelConfig
        ? JSON.parse(AndroidBridge.saveModelConfig(JSON.stringify(config)))
        : {};
      if (result.error) throw Error(result.error);
      if (!window.AndroidBridge?.saveModelConfig)
        browserModelConfig = {
          ...config,
          apiKey: config.clearKey
            ? ""
            : config.apiKey || browserModelConfig.apiKey,
          hasKey:
            !config.clearKey && !!(config.apiKey || browserModelConfig.apiKey),
        };
      modelKeyDraft = "";
      state.formValues = {};
      state.formError = "";
      render();
      toast("模型配置已保存");
    } catch (error) {
      captureModelDraft();
      state.formError = error.message;
      render();
    }
  });
  document.getElementById("clear-model")?.addEventListener("click", () => {
    window.AndroidBridge?.clearModelConfig?.();
    browserModelConfig = {};
    modelKeyDraft = "";
    state.formValues = {};
    state.formError = "";
    render();
    toast("模型配置已清除");
  });
}
