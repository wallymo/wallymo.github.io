(() => {
  "use strict";

  const preview = document.getElementById("portfolio-preview");
  // The homepage, resume, and all nine canonical case studies participate in
  // this concept. Source pages remain untouched; the wrapper injects the
  // appropriate reversible Proof Grid skin after each iframe navigation.
  const homepageSkin = {
    className: "proof-grid-homepage",
    file: "homepage.css?v=1",
    fallbackTitle: "Wally Mostafa portfolio — Proof Grid concept",
  };
  const projectSkin = {
    className: "proof-grid-case-study",
    file: "case-study.css?v=1",
    fallbackTitle: "Wally Mostafa case study — Proof Grid concept",
  };
  const resumeSkin = {
    className: "proof-grid-resume",
    file: "resume.css?v=1",
    fallbackTitle: "Wally Mostafa resume — Proof Grid concept",
  };
  const skins = new Map([
    [new URL("../../index.html", window.location.href).pathname, homepageSkin],
    [new URL("../../resume.html", window.location.href).pathname, resumeSkin],
    ...Array.from({ length: 9 }, (_, index) => {
      const projectNumber = String(index + 1).padStart(2, "0");
      return [
        new URL(`../../project-${projectNumber}.html`, window.location.href).pathname,
        projectSkin,
      ];
    }),
  ]);

  function settleLayout(previewDocument) {
    const previewWindow = previewDocument.defaultView;
    if (!preview || !previewWindow) return;

    previewWindow.dispatchEvent(new previewWindow.Event("resize"));
    previewWindow.requestAnimationFrame(() => {
      previewWindow.dispatchEvent(new previewWindow.Event("resize"));
      preview.dataset.skinReady = "true";
    });
  }

  function applySkin() {
    const previewDocument = preview?.contentDocument;
    if (!previewDocument) return;
    const selectedSkin = skins.get(new URL(previewDocument.URL).pathname);
    if (!selectedSkin) {
      preview.title = "Wally Mostafa portfolio";
      preview.dataset.skinReady = "unskinned";
      return;
    }

    const sourceTitle = previewDocument.title.trim();
    preview.title = sourceTitle
      ? `${sourceTitle} — Proof Grid concept`
      : selectedSkin.fallbackTitle;
    previewDocument.documentElement.classList.add(selectedSkin.className);

    if (previewDocument.getElementById("proof-grid-stylesheet")) {
      if (previewDocument.documentElement.dataset.proofGridSkin === "ready") {
        settleLayout(previewDocument);
      }
      return;
    }

    const skin = previewDocument.createElement("link");
    skin.id = "proof-grid-stylesheet";
    skin.rel = "stylesheet";
    skin.href = new URL(selectedSkin.file, window.location.href).href;
    skin.addEventListener("load", async () => {
      previewDocument.documentElement.dataset.proofGridSkin = "ready";
      await previewDocument.fonts?.ready;
      settleLayout(previewDocument);
    }, { once: true });
    skin.addEventListener("error", () => {
      preview.dataset.skinReady = "fallback";
    }, { once: true });
    previewDocument.head.appendChild(skin);
  }

  preview?.addEventListener("load", applySkin);
  if (preview?.contentDocument?.readyState === "complete") applySkin();
})();
