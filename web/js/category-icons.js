const CategoryIcons = (() => {
  let session = null,
    route = null,
    source = null,
    uploading = false;
  const active = () =>
    ["category-add", "category-edit"].includes(state.route) &&
    state.route === route;
  function close() {
    const dialog = document.getElementById("icon-crop-dialog");
    if (!dialog) return false;
    if (uploading) {
      toast("正在保存图标，请稍候");
      return true;
    }
    dialog.remove();
    source = null;
    const main = document.querySelector("main.screen");
    if (main) main.inert = false;
    document.body.style.overflow = "";
    document.getElementById("upload-category-icon")?.focus();
    return true;
  }
  function crop(image) {
    const picture = new Image();
    picture.onload = () => {
      if (!active()) return;
      source = picture;
      const el = document.createElement("section");
      el.id = "icon-crop-dialog";
      el.className = "icon-crop-dialog";
      el.setAttribute("role", "dialog");
      el.setAttribute("aria-modal", "true");
      el.setAttribute("aria-label", "裁切分类图标");
      el.innerHTML =
        '<h2>裁切图标</h2><p class="sub">拖动调整位置，滑动缩放，保留方框内的部分</p><canvas width="256" height="256" aria-label="图标裁切预览"></canvas><label for="icon-zoom">缩放</label><input id="icon-zoom" type="range" min="1" max="4" step="0.01" value="1"/><div class="two-actions"><button class="btn ghost" id="cancel-icon-crop">取消</button><button class="btn" id="confirm-icon-crop">使用此图标</button></div><p role="status" id="icon-crop-status"></p>';
      document.getElementById("app").append(el);
      document.querySelector("main.screen").inert = true;
      document.body.style.overflow = "hidden";
      const canvas = el.querySelector("canvas"),
        ctx = canvas.getContext("2d"),
        base = Math.max(256 / picture.width, 256 / picture.height);
      let scale = base,
        x = (256 - picture.width * scale) / 2,
        y = (256 - picture.height * scale) / 2,
        last = null;
      function draw() {
        x = Math.min(0, Math.max(256 - picture.width * scale, x));
        y = Math.min(0, Math.max(256 - picture.height * scale, y));
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, 256, 256);
        ctx.drawImage(
          picture,
          x,
          y,
          picture.width * scale,
          picture.height * scale,
        );
      }
      draw();
      el.querySelector("#icon-zoom").oninput = (e) => {
        if (uploading) return;
        const next = base * Number(e.target.value);
        x = 128 - ((128 - x) * next) / scale;
        y = 128 - ((128 - y) * next) / scale;
        scale = next;
        draw();
      };
      canvas.onpointerdown = (e) => {
        if (uploading) return;
        last = [e.clientX, e.clientY];
        canvas.setPointerCapture(e.pointerId);
      };
      canvas.onpointermove = (e) => {
        if (!last || uploading) return;
        const ratio = 256 / canvas.getBoundingClientRect().width;
        x += (e.clientX - last[0]) * ratio;
        y += (e.clientY - last[1]) * ratio;
        last = [e.clientX, e.clientY];
        draw();
      };
      canvas.onpointerup = canvas.onpointercancel = () => (last = null);
      el.querySelector("#cancel-icon-crop").onclick = close;
      el.querySelector("#cancel-icon-crop").focus();
      el.querySelector("#confirm-icon-crop").onclick = async () => {
        if (uploading) return;
        uploading = true;
        el.querySelector("#confirm-icon-crop").disabled = true;
        el.querySelector("#icon-crop-status").textContent = "正在保存图标…";
        const draft = state.draft;
        try {
          const result = await CloudSync.request(
            "/api/address-photos",
            "POST",
            { image: canvas.toDataURL("image/jpeg", 0.9) },
          );
          if (active() && state.draft === draft) {
            draft.customIcon = result.id;
            draft.catIcon = "custom";
            AddressPhotos.remember(result.id, result.image);
          }
          uploading = false;
          close();
          if (active()) render();
        } catch (e) {
          uploading = false;
          el.querySelector("#confirm-icon-crop").disabled = false;
          el.querySelector("#icon-crop-status").textContent = e.message;
        }
      };
    };
    picture.onerror = () => toast("图片无法读取，请重新选择");
    picture.src = image;
  }
  function receive(id, result) {
    if (id !== session) return;
    session = null;
    if (!active()) return;
    if (result.error) {
      toast(result.error);
      return;
    }
    if (result.images?.[0]) crop(result.images[0]);
  }
  function bind() {
    const button = document.getElementById("upload-category-icon");
    if (!button) return;
    button.onclick = () => {
      if (typeof CloudSync === "undefined" || !CloudSync.active) {
        toast("登录后可上传自定义图标");
        return;
      }
      captureDraft();
      route = state.route;
      session = "category-icon-" + crypto.randomUUID();
      if (window.AndroidBridge?.chooseAddressPhotos)
        AndroidBridge.chooseAddressPhotos(session, 1);
      else document.getElementById("category-icon-file").click();
    };
    document.getElementById("category-icon-file").onchange = async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      if (
        !["image/jpeg", "image/png", "image/webp"].includes(f.type) ||
        f.size > 20 * 1024 * 1024
      ) {
        toast("请选择20MB以内的 JPG、PNG 或 WebP 图片");
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        if (active()) crop(reader.result);
      };
      reader.onerror = () => toast("图片读取失败");
      reader.readAsDataURL(f);
    };
  }
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && close()) e.preventDefault();
  });
  return { bind, receive, close };
})();
