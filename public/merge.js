const STORAGE_KEY = "dozuki-viewer-settings";

const $ = (id) => document.getElementById(id);

const els = {
  form: $("settings-form"),
  apiKey: $("api-key"),
  appId: $("app-id"),
  baseUrl: $("base-url"),
  guideIds: $("guide-ids"),
  pivotIndex: $("pivot-index"),
  toggleSettings: $("toggle-settings"),
  settingsPanel: $("settings-panel"),
  status: $("status"),
  main: $("compare-main"),
  guideHeaders: $("guide-headers"),
  matrix: $("matrix"),
  variantOnly: $("variant-only"),
  variantOnlyList: $("variant-only-list"),
};

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const s = JSON.parse(raw);
    if (s.apiKey) els.apiKey.value = s.apiKey;
    if (s.appId) els.appId.value = s.appId;
    if (s.baseUrl) els.baseUrl.value = s.baseUrl;
    if (s.mergeGuideIds) els.guideIds.value = s.mergeGuideIds;
    if (s.mergePivot != null) els.pivotIndex.value = String(s.mergePivot);
  } catch {
    /* ignore */
  }
  if (!els.baseUrl.value) {
    els.baseUrl.value = "https://gp-sandbox.dozuki.com";
  }
}

function saveSettings() {
  const prev = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      ...prev,
      apiKey: els.apiKey.value.trim(),
      appId: els.appId.value.trim(),
      baseUrl: els.baseUrl.value.trim(),
      mergeGuideIds: els.guideIds.value.trim(),
      mergePivot: Number(els.pivotIndex.value),
    }),
  );
}

function authHeaders() {
  const h = { Accept: "application/json" };
  const key = els.apiKey.value.trim();
  const appId = els.appId.value.trim();
  const base = els.baseUrl.value.trim();
  if (key) h["X-Dozuki-Api-Key"] = key;
  if (appId) h["X-Dozuki-App-Id"] = appId;
  if (base) h["X-Dozuki-Base-Url"] = base;
  return h;
}

function parseGuideIds() {
  return els.guideIds.value
    .split(/[,\s]+/)
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
}

function syncPivotOptions(count) {
  const current = Number(els.pivotIndex.value) || 0;
  els.pivotIndex.replaceChildren();
  const ids = parseGuideIds();
  for (let i = 0; i < count; i++) {
    const opt = document.createElement("option");
    opt.value = String(i);
    opt.textContent =
      ids[i] != null ? `Guide ${ids[i]} (position ${i + 1})` : `Guide index ${i}`;
    els.pivotIndex.appendChild(opt);
  }
  if (current < count) els.pivotIndex.value = String(current);
}

function setStatus(msg, isError = false) {
  els.status.textContent = msg;
  els.status.classList.toggle("error", isError);
}

function escapeHtml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function stepCardHtml(step, classNames, attrs = "") {
  if (!step) {
    return `<div class="step-card empty" ${attrs}>—</div>`;
  }
  const title = step.title?.trim() ? escapeHtml(step.title) : `Step ${step.stepid ?? "?"}`;
  const img = step.hasImage ? " · photo" : "";
  return `<div class="step-card ${classNames}" ${attrs}>
    <div class="meta">#${step.orderby ?? "?"}${img}</div>
    <div class="title">${title}</div>
    <div class="preview">${escapeHtml(step.linePreview || "(no text)")}</div>
  </div>`;
}

function cellClasses(row, gi, master) {
  const step = row.steps[gi];
  if (!step) return "empty";
  const out = [];
  if (gi === master) out.push("master");
  if (row.kind === "aligned" && row.similarity != null && row.similarity >= 0.5) {
    out.push("match");
  } else if (row.steps[master] && step.guideid !== row.steps[master].guideid) {
    out.push("diff");
  }
  return out.join(" ");
}

function renderCompare(data) {
  const { guides, rows, variantOnly, pivotGuideIndex: master } = data;

  els.guideHeaders.innerHTML = guides
    .map(
      (g) =>
        `<div class="guide-header"><strong>Guide ${g.guideid}</strong> — ${escapeHtml(g.title || "Untitled")} · ${g.stepCount} steps${g.guideIndex === master ? " · <em>master</em>" : ""}</div>`,
    )
    .join("");

  els.matrix.style.setProperty("--cols", String(guides.length));
  els.matrix.innerHTML = rows
    .map((row) => {
      const label =
        row.kind === "aligned" ?
          `Row ${row.rowIndex + 1} · aligned (${Math.round((row.similarity ?? 0) * 100)}% similar)`
        : `Row ${row.rowIndex + 1} · ${row.kind.replaceAll("_", " ")}`;
      const cells = guides
        .map((g, gi) => {
          const step = row.steps[gi];
          const drop = row.dropActions?.[gi];
          const hint =
            step && gi !== master && drop ? `title="Drop on master → ${drop}"` : "";
          return stepCardHtml(step, cellClasses(row, gi, master), hint);
        })
        .join("");
      return `<div class="matrix-row"><div class="row-label">${label}</div>${cells}</div>`;
    })
    .join("");

  if (variantOnly?.length) {
    els.variantOnly.classList.remove("hidden");
    els.variantOnlyList.innerHTML = variantOnly
      .map((group) => {
        const g = guides.find((x) => x.guideIndex === group.guideIndex);
        const title = g ? `Guide ${g.guideid}` : `Guide ${group.guideid}`;
        const cards = group.steps
          .map((s) => stepCardHtml(s, "unique", 'title="Drop → insert"'))
          .join("");
        return `<div class="variant-group"><h3>${escapeHtml(title)} — unique steps</h3><div class="variant-steps">${cards}</div></div>`;
      })
      .join("");
  } else {
    els.variantOnly.classList.add("hidden");
    els.variantOnlyList.innerHTML = "";
  }

  els.main.classList.remove("hidden");
  const uniqueCount = variantOnly?.reduce((n, g) => n + g.steps.length, 0) ?? 0;
  setStatus(
    `Compared ${guides.length} guides · ${rows.length} rows · ${uniqueCount} unique variant steps. Hover cells for replace vs insert.`,
  );
}

els.guideIds.addEventListener("input", () => {
  syncPivotOptions(Math.max(parseGuideIds().length, 2));
});

els.toggleSettings?.addEventListener("click", () => {
  const open = els.settingsPanel.classList.toggle("open");
  els.toggleSettings.setAttribute("aria-expanded", String(open));
});

els.form.addEventListener("submit", async (e) => {
  e.preventDefault();
  saveSettings();
  const ids = parseGuideIds();
  if (ids.length < 2) {
    setStatus("Enter at least two guide IDs.", true);
    return;
  }
  const pivot = Number(els.pivotIndex.value) || 0;
  setStatus("Loading guides…");
  const q = new URLSearchParams({
    guides: ids.join(","),
    pivot: String(pivot),
  });
  try {
    const res = await fetch(`/dozuki/compare?${q}`, { headers: authHeaders() });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(err || res.statusText);
    }
    renderCompare(await res.json());
  } catch (err) {
    setStatus(err instanceof Error ? err.message : String(err), true);
  }
});

loadSettings();
syncPivotOptions(Math.max(parseGuideIds().length, 2));
