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
  let rowSel = null, itemSel = null, pagSel = null, pagMode = "fetchPages";

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

    const prev = el.style.outline;
    el.style.outline = "3px solid #22c55e";
    setTimeout(() => { el.style.outline = prev; }, 600);

    if (step === 1) {
      // Prefer known container if present
      const li = el.closest("li.block-list__item");
      rowSel = li ? "li.block-list__item" : findRepeatingRow(el);

      // Prefer title link if present (RDMobile style)
      const rowEl = rowSel ? el.closest(rowSel) : null;
      if (rowEl?.querySelector("strong.block-list__title a[href]")) {
        itemSel = "strong.block-list__title a";
      } else {
        const bestLink =
          rowEl?.querySelector("h1 a[href], h2 a[href], h3 a[href], h4 a[href]") ||
          rowEl?.querySelector("[class*='title'] a[href]") ||
          el.closest("a[href]");
        if (bestLink) {
          const cls = stableClasses(bestLink);
          itemSel = cls.length ? ("a." + cls.map(cssEscape).join(".")) : "a[href]";
        } else {
          itemSel = "a[href]";
        }
      }

      step = 2;
      alert("✅ Item selected.\nNow click a pagination link/segment.\n(Esc if none)");
      return;
    }

    // Pagination: default to fetchPages mode.
    // Try to pick a selector that finds ALL page links.
    // If the site has /Exhibitors/Index/, this is the best pattern.
    const anyIndex = document.querySelector('a[href*="/Exhibitors/Index/"],a[href*="/Speakers/Index/"],a[href*="/Sponsors/Index/"]');
    if (anyIndex) {
      const href = anyIndex.getAttribute("href") || "";
      if (href.includes("/Exhibitors/Index/")) pagSel = 'a[href*="/Exhibitors/Index/"]';
      else if (href.includes("/Speakers/Index/")) pagSel = 'a[href*="/Speakers/Index/"]';
      else if (href.includes("/Sponsors/Index/")) pagSel = 'a[href*="/Sponsors/Index/"]';
      else pagSel = 'nav.pagination a.pagination__item[href]';
    } else {
      // fallback: nav pagination links
      pagSel = 'nav.pagination a.pagination__item[href]';
    }

    const cfg = {
      rowSelector: rowSel,
      itemSelector: itemSel,
      pagination: { mode: "fetchPages", selector: pagSel }
    };

    const json = JSON.stringify(cfg, null, 2);
    cleanup();

    const ok = await copyToClipboard(json);
    if (ok) alert("✅ Config copied to clipboard!\n\nPaste into your Scraper Builder:\n\n" + json);
    else prompt("Copy this JSON config:", json);
  };

  ["pointerdown","mousedown","click","auxclick","touchstart"].forEach(t =>
    document.addEventListener(t, blocker, { capture: true, passive: false })
  );
  document.addEventListener("pointerup", onPick, { capture: true, passive: false });
  document.addEventListener("keydown", onKey, true);

  alert("🟢 Picker ON.\nClicks will NOT navigate.\nClick an item name/link first.\n(Esc cancels)");
})();
