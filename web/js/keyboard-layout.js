// Share one visible viewport between native IME insets and browser keyboards.
(function () {
  let nativeHeight = Infinity,
    nativeKeyboard = false;
  let baseline = window.innerHeight,
    frame = 0;
  function revealInput() {
    const input = document.activeElement;
    if (!input?.matches("input:not([readonly]),textarea")) return;
    const viewport = window.visualViewport;
    const top = viewport?.offsetTop || 0;
    const height = Math.min(
      viewport?.height || window.innerHeight,
      nativeHeight,
    );
    const footer = document.querySelector(".bottom-action");
    const bottom =
      Math.min(top + height, footer?.getBoundingClientRect().top ?? Infinity) -
      20;
    const rect = input.getBoundingClientRect();
    if (rect.bottom > bottom || rect.top < top + 16) {
      input.scrollIntoView({ block: "center", behavior: "instant" });
      const shifted = input.getBoundingClientRect();
      if (!input.closest(".sheet") && shifted.bottom > bottom)
        window.scrollBy(0, shifted.bottom - bottom);
    }
  }
  function update() {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      const viewport = window.visualViewport;
      if (viewport && Math.abs(viewport.scale - 1) > 0.05) return;
      const height = Math.min(
        viewport?.height || window.innerHeight,
        nativeHeight,
      );
      const top = viewport?.offsetTop || 0;
      const editing = !!document.activeElement?.matches(
        "input:not([readonly]),textarea",
      );
      if (!editing && !nativeKeyboard) baseline = window.innerHeight;
      const open = nativeKeyboard || (editing && height < baseline - 100);
      document.body.classList.toggle("keyboard-open", open);
      document.documentElement.style.setProperty(
        "--keyboard-bottom",
        Math.max(0, window.innerHeight - height - top) + "px",
      );
      document.documentElement.style.setProperty(
        "--visible-height",
        height + "px",
      );
      if (open) revealInput();
    });
  }
  window.setNativeKeyboardViewport = (height, open) => {
    nativeHeight = height > 0 ? height : Infinity;
    nativeKeyboard = !!open;
    update();
  };
  window.addEventListener("resize", update);
  window.visualViewport?.addEventListener("resize", update);
  window.visualViewport?.addEventListener("scroll", update);
  document.addEventListener("focusin", () => {
    update();
    setTimeout(revealInput, 180);
  });
  document.addEventListener("focusout", () => setTimeout(update, 0));
  update();
})();
