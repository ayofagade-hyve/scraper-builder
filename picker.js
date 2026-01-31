(() => {
  if (window.__SCRAPER_PICKER_ACTIVE__) {
    alert("Picker already running. Press Esc to cancel.");
    return;
  }
  window.__SCRAPER_PICKER_ACTIVE__ = true;

  const cssEscape = (s) => (window.CSS && CSS.escape) ? CSS.escape(s) : String(s).replace(/[^a-zA-Z0-9_-]/g, "\\$&");

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
      // avoid choosing tiny inline nodes as "rows"
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
  let rowSel = null, itemSel = null, pagSel = null, pagMode = "none";

  const onKey = (e) => {
    if (e.key === "Escape") {
      cleanup();
      alert("Picker cancelled.");
    }
  };

  async function copyToClipboard(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
  }

  const onPick = async (e) => {
    blocker(e);

    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el) return;

    // highlight click
    const prev = el.style.outline;
    el.style.outline = "3px solid #22c55e";
    setTimeout(() => { el.style.outline = prev; }, 600);

    if (step === 1) {
      // Prefer known repeating container if present
      const li = el.closest("li.block-list__item");
      rowSel = li ? "li.block-list__item" : findRepeatingRow(el);

      // Prefer a title link pattern inside the row when present
      const rowEl = rowSel ? el.closest(rowSel) : null;
      const bestLink =
        rowEl?.querySelector("strong.block-list__title a[href]") ||
        rowEl?.querySelector("h1 a[href], h2 a[href], h3 a[href], h4 a[href]") ||
        rowEl?.querySelector("[class*='title'] a[href]") ||
        el.closest("a[href]");

      // If we detected the RDMobile-like title, set it explicitly
      if (rowEl?.querySelector("strong.block-list__title a[href]")) {
        itemSel = "strong.block-list__title a";
      } else if (bestLink) {
        const cls = stableClasses(bestLink);
        itemSel = cls.length ? ("a." + cls.map(cssEscape).join(".")) : "a[href]";
      } else {
        itemSel = "a[href]";
      }

      step = 2;
      alert("✅ Item selected.\nNow click pagination (Next / Load more / page segment).\n(Esc if none)");
      return;
    }

    // step 2 pagination
    const pagEl = el.closest("a[href], button, [role='button']") || el;
    const text = (pagEl.textContent || "").trim().toLowerCase();
    pagMode = (text.includes("load") || text.includes("more")) ? "loadMore" : "nextButton";

    // segmented pagination (best selector)
    if (document.querySelector('nav.pagination a.pagination__item[aria-current="true"] + a.pagination__item')) {
      pagSel = 'nav.pagination a.pagination__item[aria-current="true"] + a.pagination__item';
      pagMode = "nextButton";
    } else {
      pagSel = selectorFor(pagEl);
    }

    const cfg = {
      rowSelector: rowSel,
      itemSelector: itemSel,
      pagination: { mode: pagMode, selector: pagSel }
    };

    const json = JSON.stringify(cfg, null, 2);
    cleanup();

    const ok = await copyToClipboard(json);
    if (ok) alert("✅ Config copied to clipboard!\n\nPaste into your Scraper Builder:\n\n" + json);
    else prompt("Copy this JSON config:", json);
  };

  // Install hard blockers so clicks never navigate while picking
  ["pointerdown","mousedown","click","auxclick","touchstart"].forEach(t =>
    document.addEventListener(t, blocker, { capture: true, passive: false })
  );
  document.addEventListener("pointerup", onPick, { capture: true, passive: false });
  document.addEventListener("keydown", onKey, true);

  alert("🟢 Picker ON.\nClicks will NOT navigate.\nClick an item name/link first.\n(Esc cancels)");
})();
