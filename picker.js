(() => {
  if (window.__SCRAPER_PICKER_ACTIVE__) {
    alert("Picker already running. Press Esc to cancel.");
    return;
  }
  window.__SCRAPER_PICKER_ACTIVE__ = true;

  const cssEscape = (s) =>
    (window.CSS && CSS.escape) ? CSS.escape(s) : String(s).replace(/[^a-zA-Z0-9_-]/g, "\\$&");

  const stableClasses = (el) => [...(el?.classList || [])]
    .filter(c => c && c.length < 40 && !/[0-9]{4,}/.test(c))
    .slice(0, 2);

  function selectorFor(el) {
    if (!el || el.nodeType !== 1) return null;
    if (el.id) return "#" + cssEscape(el.id);

    const parts = [];
    let cur = el;
    while (cur && cur.nodeType === 1 && cur !== document.body) {
      let part = cur.tagName.toLowerCase();
      const cls = stableClasses(cur);
      if (cls.length) part += "." + cls.map(cssEscape).join(".");
      parts.unshift(part);

      const candidate = parts.join(" > ");
      if (document.querySelectorAll(candidate).length === 1) return candidate;

      cur = cur.parentElement;
    }
    return parts.join(" > ");
  }

  function findRepeatingRow(el) {
    let cur = el;
    for (let i = 0; i < 16 && cur; i++) {
      const tag = cur.tagName?.toLowerCase?.() || "";
      if (!["a","strong","span","em","b","i"].includes(tag)) {
        const sel = selectorFor(cur);
        if (sel) {
          const n = document.querySelectorAll(sel).length;
          if (n >= 2 && n <= 5000) return sel;
        }
      }
      cur = cur.parentElement;
    }
    return null;
  }

  function cleanup() {
    ["pointerdown","mousedown","click","auxclick","touchstart"].forEach(t =>
      document.removeEventListener(t, blocker, true)
    );
    document.removeEventListener("keydown", onKey, true);
    document.removeEventListener("pointerup", onPick, true);
    overlay.remove();
    window.__SCRAPER_PICKER_ACTIVE__ = false;
  }

  const blocker = (e) => {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    return false;
  };

  const overlay = document.createElement("div");
  overlay.style.cssText = [
    "position:fixed","inset:0","z-index:2147483647",
    "background:rgba(0,0,0,.08)","cursor:crosshair",
    "pointer-events:none"
  ].join(";");
  document.body.appendChild(overlay);

  let step = 1;
  let rowSelector = null;
  let itemSelector = null;
  let sectionName = null;

  async function copyToClipboard(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
  }

  function detectSection() {
    const path = location.pathname;
    const m = path.match(/\/(Exhibitors|Speakers|Sponsors|Sessions)\b/i);
    if (m && m[1]) return m[1][0].toUpperCase() + m[1].slice(1);

    const a = document.querySelector('a[href*="/Exhibitors/Index/"],a[href*="/Speakers/Index/"],a[href*="/Sponsors/Index/"],a[href*="/Sessions/Index/"]');
    if (a) {
      const href = a.getAttribute("href") || "";
      const mm = href.match(/\/(Exhibitors|Speakers|Sponsors|Sessions)\/Index\//i);
      if (mm && mm[1]) return mm[1][0].toUpperCase() + mm[1].slice(1);
    }
    return "Exhibitors";
  }

  async function outputConfig(paginationMode, paginationSelector) {
    const cfg = {
      sectionName,
      rowSelector,
      itemSelector,
      pagination: {
        mode: paginationMode,
        selector: paginationSelector || ""
      }
    };

    const json = JSON.stringify(cfg, null, 2);
    cleanup();

    const ok = await copyToClipboard(json);
    if (ok) alert("✅ Config copied to clipboard!\n\nPaste into your Scraper Builder:\n\n" + json);
    else prompt("Copy this JSON config:", json);
  }

  const onKey = async (e) => {
    if (e.key !== "Escape") return;

    if (step === 1) {
      cleanup();
      alert("Picker cancelled.");
      return;
    }

    // ✅ Step 2: Esc means “no pagination”
    await outputConfig("none", "");
  };

  const onPick = async (e) => {
    blocker(e);

    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el) return;

    const prev = el.style.outline;
    el.style.outline = "3px solid #22c55e";
    setTimeout(() => { el.style.outline = prev; }, 600);

    if (step === 1) {
      sectionName = detectSection();

      if (document.querySelector("li.block-list__item")) rowSelector = "li.block-list__item";
      else rowSelector = findRepeatingRow(el) || selectorFor(el.parentElement) || "body";

      if (document.querySelector("strong.block-list__title a")) itemSelector = "strong.block-list__title a";
      else {
        const a = el.closest("a[href]") || el;
        const cls = stableClasses(a);
        itemSelector = cls.length ? ("a." + cls.map(cssEscape).join(".")) : "a[href]";
      }

      step = 2;
      alert("✅ Item selected.\nNow click ANY pagination segment/link.\nIf there is NO pagination, press Esc.");
      return;
    }

    // Step 2: we don’t actually need the clicked element —
    // we want the robust index selector for this section.
    await outputConfig("indexPages", `a[href*="/${sectionName}/Index/"]`);
  };

  // Block navigation while picking
  ["pointerdown","mousedown","click","auxclick","touchstart"].forEach(t =>
    document.addEventListener(t, blocker, { capture: true, passive: false })
  );
  document.addEventListener("pointerup", onPick, { capture: true, passive: false });
  document.addEventListener("keydown", onKey, true);

  alert("🟢 Picker ON.\nClicks will NOT navigate.\nClick an item name/link first.\n(Esc cancels / or skips pagination at step 2)");
})();
