const STORAGE_KEY = "dozuki-viewer-settings";

const $ = (id) => document.getElementById(id);

const els = {
  form: $("settings-form"),
  apiKey: $("api-key"),
  appId: $("app-id"),
  baseUrl: $("base-url"),
  guideId: $("guide-id"),
  hydrate: $("hydrate"),
  excludePrereq: $("exclude-prereq"),
  swpDocumentName: $("swp-document-name"),
  swpDocumentNumber: $("swp-document-number"),
  swpDepartment: $("swp-department"),
  swpAuthor: $("swp-author"),
  downloadPdf: $("download-pdf"),
  openHtml: $("open-html"),
  downloadHtml: $("download-html"),
  clearKey: $("clear-key"),
  toggleSettings: $("toggle-settings"),
  settingsPanel: $("settings-panel"),
  status: $("status"),
  preview: $("preview"),
  markdown: $("markdown"),
  json: $("json"),
  tabs: document.querySelectorAll(".tab"),
};

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const s = JSON.parse(raw);
    if (s.apiKey) els.apiKey.value = s.apiKey;
    if (s.appId) els.appId.value = s.appId;
    if (s.baseUrl) els.baseUrl.value = s.baseUrl;
    if (s.guideId) els.guideId.value = String(s.guideId);
    if (s.hydrate) els.hydrate.checked = true;
    if (s.excludePrereq) els.excludePrereq.checked = true;
    if (s.swpDocumentName) els.swpDocumentName.value = s.swpDocumentName;
    if (s.swpDocumentNumber) els.swpDocumentNumber.value = s.swpDocumentNumber;
    if (s.swpDepartment) els.swpDepartment.value = s.swpDepartment;
    if (s.swpAuthor) els.swpAuthor.value = s.swpAuthor;
  } catch {
    /* ignore corrupt storage */
  }
}

function saveSettings() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      apiKey: els.apiKey.value.trim(),
      appId: els.appId.value.trim(),
      baseUrl: els.baseUrl.value.trim(),
      guideId: Number(els.guideId.value),
      hydrate: els.hydrate.checked,
      excludePrereq: els.excludePrereq.checked,
      swpDocumentName: els.swpDocumentName.value.trim(),
      swpDocumentNumber: els.swpDocumentNumber.value.trim(),
      swpDepartment: els.swpDepartment.value.trim(),
      swpAuthor: els.swpAuthor.value.trim(),
    }),
  );
}

function swpQueryParams() {
  const q = new URLSearchParams();
  const pairs = [
    ["documentName", els.swpDocumentName.value.trim()],
    ["documentNumber", els.swpDocumentNumber.value.trim()],
    ["department", els.swpDepartment.value.trim()],
    ["author", els.swpAuthor.value.trim()],
  ];
  for (const [k, v] of pairs) if (v) q.set(k, v);
  return q;
}

function authHeaders() {
  const h = {};
  const key = els.apiKey.value.trim();
  const appId = els.appId.value.trim();
  const base = els.baseUrl.value.trim();
  if (key) h["X-Dozuki-Api-Key"] = key;
  if (appId) h["X-Dozuki-App-Id"] = appId;
  if (base) h["X-Dozuki-Base-Url"] = base;
  return h;
}

function queryString(opts = {}) {
  const q = new URLSearchParams();
  if (opts.hydrate && els.hydrate.checked) q.set("hydrate", "1");
  if (els.excludePrereq.checked) q.set("excludePrerequisiteSteps", "1");
  const s = q.toString();
  return s ? `?${s}` : "";
}

function setStatus(msg, kind = "loading") {
  els.status.hidden = false;
  els.status.textContent = msg;
  els.status.className = `status ${kind}`;
}

function clearStatus() {
  els.status.hidden = true;
  els.status.textContent = "";
}

function showView(name) {
  for (const tab of els.tabs) {
    tab.classList.toggle("active", tab.dataset.view === name);
  }
  els.preview.hidden = name !== "preview";
  els.markdown.hidden = name !== "markdown";
  els.json.hidden = name !== "json";
  els.preview.classList.toggle("active", name === "preview");
}

async function loadGuide() {
  saveSettings();
  const guideId = Number(els.guideId.value);
  if (!Number.isFinite(guideId) || guideId < 1) {
    setStatus("Enter a valid guide ID.", "error");
    return;
  }

  setStatus(`Loading guide ${guideId}…`);
  const headers = authHeaders();
  const mdUrl = `/dozuki/${guideId}/markdown${queryString({ hydrate: true })}`;
  const jsonUrl = `/dozuki/${guideId}/json${queryString()}`;

  try {
    const [mdRes, jsonRes] = await Promise.all([
      fetch(mdUrl, { headers }),
      fetch(jsonUrl, { headers }),
    ]);

    const mdText = await mdRes.text();
    const jsonText = await jsonRes.text();

    if (!mdRes.ok) throw new Error(mdText || `Markdown request failed (${mdRes.status})`);

    els.markdown.textContent = mdText;
    els.preview.innerHTML =
      typeof marked !== "undefined" ? marked.parse(mdText) : escapeHtml(mdText);

    if (jsonRes.ok) {
      try {
        const obj = JSON.parse(jsonText);
        els.json.textContent = JSON.stringify(obj, null, 2);
      } catch {
        els.json.textContent = jsonText;
      }
    } else {
      els.json.textContent = jsonText;
    }

    clearStatus();
    showView("preview");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    setStatus(msg, "error");
    els.preview.innerHTML = "";
    els.markdown.textContent = "";
    els.json.textContent = "";
  }
}

function escapeHtml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function exportQuery() {
  const q = swpQueryParams();
  if (els.excludePrereq.checked) q.set("excludePrerequisiteSteps", "1");
  const s = q.toString();
  return s ? `?${s}` : "";
}

async function downloadPdf() {
  saveSettings();
  const guideId = Number(els.guideId.value);
  if (!Number.isFinite(guideId) || guideId < 1) {
    setStatus("Enter a valid guide ID.", "error");
    return;
  }
  setStatus(`Building read-only PDF for guide ${guideId}…`);
  try {
    const res = await fetch(`/dozuki/${guideId}/pdf${exportQuery()}`, { headers: authHeaders() });
    if (!res.ok) throw new Error(await res.text());
    const blob = await res.blob();
    const disp = res.headers.get("Content-Disposition");
    const match = disp?.match(/filename="([^"]+)"/);
    const filename = match?.[1] || `guide-${guideId}.pdf`;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
    clearStatus();
  } catch (err) {
    setStatus(err instanceof Error ? err.message : String(err), "error");
  }
}

function openHtmlExport() {
  saveSettings();
  const guideId = Number(els.guideId.value);
  if (!Number.isFinite(guideId) || guideId < 1) {
    setStatus("Enter a valid guide ID.", "error");
    return;
  }
  const q = new URLSearchParams(exportQuery().replace(/^\?/, ""));
  q.set("guideId", String(guideId));
  window.open(`/export-viewer.html?${q.toString()}`, "_blank", "noopener");
  clearStatus();
}

async function downloadHtml() {
  saveSettings();
  const guideId = Number(els.guideId.value);
  if (!Number.isFinite(guideId) || guideId < 1) {
    setStatus("Enter a valid guide ID.", "error");
    return;
  }
  setStatus(`Building HTML export for guide ${guideId}…`);
  try {
    const q = new URLSearchParams(exportQuery().replace(/^\?/, ""));
    q.set("inline", "1");
    const res = await fetch(`/dozuki/${guideId}/html?${q.toString()}`, { headers: authHeaders() });
    if (!res.ok) throw new Error(await res.text());
    const html = await res.text();
    const disp = res.headers.get("Content-Disposition");
    const match = disp?.match(/filename="([^"]+)"/);
    const filename = match?.[1] || `guide-${guideId}.html`;
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
    clearStatus();
  } catch (err) {
    setStatus(err instanceof Error ? err.message : String(err), "error");
  }
}

els.form.addEventListener("submit", (e) => {
  e.preventDefault();
  loadGuide();
});

els.downloadPdf.addEventListener("click", () => downloadPdf());
els.openHtml.addEventListener("click", () => openHtmlExport());
els.downloadHtml.addEventListener("click", () => downloadHtml());

els.clearKey.addEventListener("click", () => {
  els.apiKey.value = "";
  saveSettings();
});

els.toggleSettings.addEventListener("click", () => {
  const open = els.settingsPanel.classList.toggle("open");
  els.toggleSettings.setAttribute("aria-expanded", String(open));
});

for (const tab of els.tabs) {
  tab.addEventListener("click", () => showView(tab.dataset.view));
}

loadSettings();
if (!els.baseUrl.value) {
  els.baseUrl.value = "https://gp-sandbox.dozuki.com";
}
showView("preview");
