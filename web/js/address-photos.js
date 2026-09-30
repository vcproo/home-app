const AddressPhotos = (() => {
  const cache = new Map();
  let busy = false,
    picker = null;
  const key = (id) =>
    `${typeof CloudSync !== "undefined" ? CloudSync.user?.familyId : "preview"}:${id}`;
  function remember(id, image) {
    cache.set(key(id), image);
    while (cache.size > 50) cache.delete(cache.keys().next().value);
  }
  function preserve() {
    state.draft.adName = field("ad-name");
    state.draft.adDetail = field("ad-detail");
  }
  function form() {
    return `<section class="address-images"><div class="section-h"><h3>地址图片</h3><span class="sub">${state.draft.photos.length}/9</span></div><p class="sub">可添加门牌、楼栋或路线图片，点击图片可放大查看。</p><div class="address-photo-grid">${state.draft.photos.map((id, i) => `<div class="address-photo-item"><button type="button" data-photo-open="${id}" aria-label="查看第${i + 1}张图片"><img data-address-photo="${id}" alt="地址图片${i + 1}"/></button><button type="button" class="photo-remove" data-photo-remove="${id}" aria-label="删除第${i + 1}张图片">×</button></div>`).join("")}</div><button type="button" class="btn ghost" id="add-address-photos" ${busy || state.draft.photos.length >= 9 ? "disabled" : ""}>${busy ? "正在处理图片…" : "选择图片（可多选）"}</button><input type="file" id="address-photo-files" accept="image/jpeg,image/png,image/webp" multiple hidden/><p class="sub" role="status" id="address-upload-status"></p></section>`;
  }
  function current(session) {
    return (
      state.route === "address-add" && state.draft.addressSession === session
    );
  }
  function finish() {
    busy = false;
    if (state.route === "address-add") {
      preserve();
      render();
    }
  }
  async function add(images, session) {
    try {
      for (const image of images) {
        if (!current(session) || state.draft.photos.length >= 9) break;
        const result = await CloudSync.request("/api/address-photos", "POST", {
          image,
        });
        if (!current(session)) break;
        state.draft.photos.push(result.id);
        remember(result.id, result.image);
        preserve();
        render();
      }
    } catch (e) {
      toast("图片未全部上传：" + e.message);
    } finally {
      finish();
    }
  }
  window.addressPhotosResult = (session, result) => {
    if (
      session.startsWith("category-icon-") &&
      typeof CategoryIcons !== "undefined"
    ) {
      CategoryIcons.receive(session, result);
      return;
    }
    if (picker !== session) return;
    picker = null;
    if (!current(session)) {
      finish();
      return;
    }
    if (result.error) {
      finish();
      toast(result.error);
      return;
    }
    add(result.images || [], session);
  };
  async function compress(file) {
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > 20 * 1024 * 1024
    )
      throw Error("请选择20MB以内的 JPG、PNG 或 WebP 图片");
    const bitmap = await createImageBitmap(file);
    try {
      const ratio = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * ratio));
      canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL("image/jpeg", 0.82);
    } finally {
      bitmap.close();
    }
  }
  async function imageFor(id) {
    if (cache.has(key(id))) return cache.get(key(id));
    const value = await CloudSync.request("/api/address-photos/" + id);
    remember(id, value.image);
    return value.image;
  }
  function closeViewer() {
    const el = document.getElementById("address-photo-viewer");
    if (!el) return false;
    el.remove();
    const main = document.querySelector("main.screen");
    if (main) main.inert = false;
    document.body.style.overflow = "";
    document.querySelector("[data-photo-open]")?.focus();
    return true;
  }
  async function view(id) {
    const ids = state.draft.photos.slice();
    let index = ids.indexOf(id);
    closeViewer();
    const viewer = document.createElement("div");
    viewer.id = "address-photo-viewer";
    viewer.className = "address-photo-viewer";
    viewer.setAttribute("role", "dialog");
    viewer.setAttribute("aria-modal", "true");
    viewer.setAttribute("aria-label", "地址图片预览");
    viewer.innerHTML =
      '<button class="viewer-close" aria-label="关闭图片">×</button><img alt="地址大图"/><div><button class="viewer-prev" aria-label="上一张">‹</button><span role="status"></span><button class="viewer-next" aria-label="下一张">›</button></div>';
    document.getElementById("app").append(viewer);
    document.querySelector("main.screen").inert = true;
    document.body.style.overflow = "hidden";
    viewer.querySelector(".viewer-close").onclick = closeViewer;
    viewer.querySelector(".viewer-close").focus();
    const update = async () => {
      const selected = ids[index];
      viewer.querySelector("span").textContent = `${index + 1} / ${ids.length}`;
      viewer.querySelector(".viewer-prev").disabled = index === 0;
      viewer.querySelector(".viewer-next").disabled = index === ids.length - 1;
      viewer.querySelector("img").removeAttribute("src");
      try {
        const image = await imageFor(selected);
        if (viewer.isConnected && ids[index] === selected)
          viewer.querySelector("img").src = image;
      } catch (e) {
        if (viewer.isConnected)
          viewer.querySelector("span").textContent =
            "图片加载失败，请关闭后重试";
      }
    };
    viewer.querySelector(".viewer-prev").onclick = () => {
      index--;
      update();
    };
    viewer.querySelector(".viewer-next").onclick = () => {
      index++;
      update();
    };
    await update();
  }
  function bind() {
    document
      .querySelectorAll(".category-custom-image[data-address-photo]")
      .forEach(async (el) => {
        try {
          const image = await imageFor(el.dataset.addressPhoto);
          if (el.isConnected) el.src = image;
        } catch {
          if (el.isConnected) el.alt = "图标加载失败";
        }
      });
    if (state.route !== "address-add") return;
    const button = document.getElementById("add-address-photos");
    if (!button) return;
    document.getElementById("save-address").disabled = busy;
    button.onclick = () => {
      if (busy) return;
      if (typeof CloudSync === "undefined" || !CloudSync.active) {
        toast("登录后可上传图片");
        return;
      }
      preserve();
      const session = state.draft.addressSession;
      if (window.AndroidBridge?.chooseAddressPhotos) {
        busy = true;
        picker = session;
        render();
        AndroidBridge.chooseAddressPhotos(
          session,
          9 - state.draft.photos.length,
        );
      } else document.getElementById("address-photo-files").click();
    };
    document.getElementById("address-photo-files").onchange = async (event) => {
      const files = [...event.target.files],
        session = state.draft.addressSession;
      if (!files.length) return;
      const remaining = 9 - state.draft.photos.length;
      if (files.length > remaining) toast(`本次最多添加${remaining}张`);
      preserve();
      busy = true;
      render();
      try {
        for (const file of files.slice(0, remaining)) {
          if (!current(session)) break;
          const image = await compress(file);
          const result = await CloudSync.request(
            "/api/address-photos",
            "POST",
            { image },
          );
          if (!current(session)) break;
          state.draft.photos.push(result.id);
          remember(result.id, result.image);
        }
      } catch (e) {
        toast(e.message);
      } finally {
        finish();
      }
    };
    document.querySelectorAll("[data-photo-remove]").forEach((el) => {
      el.disabled = busy;
      el.onclick = () => {
        preserve();
        state.draft.photos = state.draft.photos.filter(
          (id) => id !== el.dataset.photoRemove,
        );
        render();
      };
    });
    document
      .querySelectorAll("[data-photo-open]")
      .forEach((el) => (el.onclick = () => view(el.dataset.photoOpen)));
    document.querySelectorAll("[data-address-photo]").forEach(async (el) => {
      try {
        const image = await imageFor(el.dataset.addressPhoto);
        if (el.isConnected) el.src = image;
      } catch {
        if (el.isConnected) el.alt = "加载失败，点击重试";
      }
    });
  }
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && closeViewer()) e.preventDefault();
  });
  return {
    remember,
    form,
    bind,
    closeViewer,
    get busy() {
      return busy;
    },
  };
})();
