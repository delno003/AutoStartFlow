const $ = (q, root = document) => root.querySelector(q);
const $$ = (q, root = document) => [...root.querySelectorAll(q)];
let settings = { edition: "MSFS 2024 - Microsoft Store", sim_exe: "", xml_path: "", apps: [], addons_enabled: true, launch_with_msfs: true };
let presets = [];
let builtInPresets = [];
let availableMonitors = [];
let monitorState = {};
let xmlRestoreAvailable = false;
let simExeExists = false;
let simExeAutodetected = false;
let xmlPathExists = false;
let toastTimer;
let saveTimer;
let settingsSavePending = false;
let tooltipTimer;
let tooltipTarget = null;
let dismissedTooltipTarget = null;
let lastXmlSyncError = "";
let lastStartupSyncError = "";
let lastSettingsSaveError = "";
let importConfiguration = null;
let importExeXmlText = "";
let settingsRevision = null;
let installation = {};
let setupActive = false;
let setupInitialized = false;
let setupStage = "menu";
let runtimeElevated = null;
let setupDraft = false;
let cleanReplaceConfirmed = false;
let updatePath = '';
let updateCheckTimer;
let updateRequest = 0;
let updateBusy = false;
let installDestination = "";
let preferenceDefaults = {};
let startupProfileAction = 'create';
let startupProfileId = '';
function installationFolder(path) {
  const clean = String(path || "").trim().replace(/[\\/]+$/, "");
  return clean && basename(clean).toLowerCase() !== "autostartflow" ? clean + "\\AutoStartFlow" : clean;
}

function applyTheme(theme) {
  const resolved = theme === "auto"
    ? (window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark")
    : theme;
  document.body.classList.toggle("light-theme", resolved === "light");
  document.documentElement.style.colorScheme = resolved;
}

const systemAppearance = window.matchMedia?.("(prefers-color-scheme: light)");
systemAppearance?.addEventListener?.("change", () => {
  if (settings.theme === "auto") applyTheme("auto");
});

const icons = {
  edit: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m14 5 5 5M4 20l4-.8L19 8a2.1 2.1 0 0 0-3-3L5 16l-1 4Z"/></svg>',
  remove: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6m4-6v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
  maximize: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="5" y="5" width="14" height="14" rx="1.5"/></svg>',
  restore: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M8 8V5h11v11h-3M5 8h11v11H5z"/></svg>'
};

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function basename(path) { return String(path || "").split(/[\\/]/).filter(Boolean).pop() || "Path not set"; }
function suggestAppName(path) {
  if (/^https?:\/\//i.test(path)) { try { return new URL(path).hostname; } catch (_) {} }
  const file = basename(path);
  const extension = file.lastIndexOf(".");
  return extension > 0 ? file.slice(0, extension) : file;
}
function updateSuggestedAppName(path) {
  const name = $("#profile-name");
  if (name.dataset.manuallyEdited !== "true" && path) name.value = suggestAppName(path);
}
function normalizeAppPath(path) {
  if (/^https?:\/\//i.test(path)) { try { return new URL(path).href; } catch (_) {} }
  return String(path || "").trim().replaceAll("/", "\\").replace(/\\+$/, "").toLocaleLowerCase();
}
function updateCloseOption(path, checked, closeUnmanaged) {
  updateWindowsTimingOption(path);
  const input = $("#profile-close");
  const label = $("#profile-close-option");
  const unmanaged = $("#profile-unmanaged");
  const unmanagedLabel = $("#unmanaged-wrap");
  const closeSupported = !!String(path || '').trim();
  const previouslySupported = input.dataset.closeSupported !== "false";
  input.disabled = !closeSupported;
  unmanaged.disabled = !closeSupported;
  label.classList.toggle("unsupported-close", !closeSupported);
  unmanagedLabel.classList.toggle("unsupported-close", !closeSupported);
  if (!closeSupported) { input.checked = false; unmanaged.checked = false; }
  else {
    if (checked !== undefined) input.checked = checked;
    else if (!previouslySupported) input.checked = true;
    if (closeUnmanaged !== undefined) unmanaged.checked = closeUnmanaged;
  }
  label.dataset.closeSupported = String(closeSupported);
  unmanagedLabel.dataset.closeSupported = String(closeSupported);
  if (closeSupported) { delete label.dataset.tooltip; delete unmanagedLabel.dataset.tooltip; }
  else {
    label.dataset.tooltip = "Choose an executable (.exe) or application shortcut (.lnk) to enable process controls.";
    unmanagedLabel.dataset.tooltip = label.dataset.tooltip;
  }
  input.dataset.closeSupported = String(closeSupported);
}
function updateWindowsTimingOption(path) {
  const select = $("#profile-timing");
  const value = String(path || '').trim().replace(/^"|"$/g, '');
  const supported = !/^https?:\/\//i.test(value) && /\.(exe|lnk)$/i.test(value);
  const option = [...select.options].find(item => item.value === 'Windows starts');
  if (!supported && option) {
    if (select.value === 'Windows starts') select.value = 'Sim starts (exe.xml)';
    option.remove();
  } else if (supported && !option) {
    const added = document.createElement('option');
    added.value = 'Windows starts';
    added.textContent = 'When Windows starts';
    select.insertBefore(added, [...select.options].find(item => item.value === 'Close only (do not launch)') || null);
  }
  if (!select.value) select.value = 'Sim starts (exe.xml)';
}
function initials(name) {
  const words = String(name || "?").trim().split(/\s+/);
  return (words.length > 1 ? words[0][0] + words[1][0] : words[0].slice(0, 2)).toUpperCase();
}
function timingInfo(mode) {
  if (mode === "Aircraft loaded (SimConnect)") return { cls: "airborne", label: "After aircraft loads" };
  if (mode === "Windows starts") return { cls: "windows-start", label: "Windows sign-in" };
  if (mode === "Close only (do not launch)") return { cls: "close-only", label: "Close only" };
  return { cls: "", label: "When MSFS starts" };
}
function toast(message, status = "success") {
  const el = $("#toast");
  if (typeof status === "boolean") status = status ? "error" : "success";
  if (!["success", "warning", "error"].includes(status)) status = "success";
  el.dataset.status = status;
  $(".toast-message", el).textContent = message;
  el.classList.toggle("error", status === "error");
  el.classList.toggle("warning", status === "warning");
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 3100);
}
function askConfirm(title, message, actionLabel = "Continue", danger = false) {
  const dialog = $("#confirm-dialog");
  const accept = $("#confirm-accept");
  $("#confirm-title").textContent = title;
  $("#confirm-message").textContent = message;
  accept.textContent = actionLabel;
  accept.classList.toggle("danger-action", danger);
  return new Promise(resolve => {
    dialog.addEventListener("close", () => resolve(dialog.returnValue === "confirm"), { once: true });
    accept.onclick = () => dialog.close("confirm");
    $("#confirm-cancel").onclick = () => dialog.close("cancel");
    $("#confirm-close").onclick = () => dialog.close("cancel");
    dialog.showModal();
  });
}
function showTooltip(target) {
  if (target === dismissedTooltipTarget || document.querySelector("dialog[open]")) return;
  const tooltip = $("#app-tooltip");
  const message = target?.dataset.tooltip;
  if (!message) return;
  tooltip.textContent = message;
  tooltip.style.left = "-10000px";
  tooltip.style.top = "-10000px";
  tooltip.classList.add("visible");
  const anchor = target.id === "edition-field"
    ? target.querySelector("select").getBoundingClientRect()
    : target.getBoundingClientRect();
  const bounds = tooltip.getBoundingClientRect();
  const left = Math.max(8, Math.min(innerWidth - bounds.width - 8,
    target.id === "edition-field" ? anchor.left : anchor.left + (anchor.width - bounds.width) / 2));
  const below = anchor.bottom + 8;
  const top = below + bounds.height <= innerHeight - 8
    ? below
    : Math.max(8, anchor.top - bounds.height - 8);
  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
}
function setSaveState(text, busy = false) {
  $("#save-state").innerHTML = `<span class="check-mark">${busy ? "◌" : "✓"}</span> ${esc(text)}`;
}
async function api(url, payload) {
  const response = await fetch(url, payload ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) } : {});
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}
async function loadState() {
  try {
    const data = await api("/api/state");
    settingsRevision = data.settings_revision ?? settingsRevision;
    settings = data.settings;
    runtimeElevated = typeof data.is_elevated === 'boolean' ? data.is_elevated : null;
    $("#open-settings").disabled = false;
    preferenceDefaults = data.preference_defaults || {};
    installation = data.installation || {};
    if (!installDestination) installDestination = installation.install_path || "";
    if (!setupInitialized) {
      setupInitialized = true;
      setupActive = !settings.setup_completed || installation.setup_mode;
    }
    renderSetup();
    settings.custom_presets = Array.isArray(settings.custom_presets) ? settings.custom_presets : [];
    availableMonitors = Array.isArray(data.monitors) ? data.monitors : [];
    applyTheme(settings.theme || "dark");
    builtInPresets = data.presets || [];
    refreshPresets();
    monitorState = data.state;
    xmlRestoreAvailable = !!data.xml_restore_available;
    simExeExists = !!data.sim_exe_exists;
    simExeAutodetected = !!data.sim_exe_autodetected;
    xmlPathExists = !!data.xml_path_exists;
    fillSettings();
    renderApps();
    renderStartupProfiles();
    renderStatus();
  } catch (e) {
    toast("Can't reach AutoStartFlow's local service. Restart AutoStartFlow to reconnect.", true);
  }
}
function fillSettings() {
  if (document.activeElement !== $("#edition")) $("#edition").value = settings.edition || "MSFS 2024 - Microsoft Store";
  if (document.activeElement !== $("#xml-path")) $("#xml-path").value = settings.xml_path || "";
  if (document.activeElement !== $("#sim-exe")) $("#sim-exe").value = settings.sim_exe || "";
  renderPathStatuses();
  const restore = $("#restore-xml");
  restore.disabled = !xmlRestoreAvailable;
  restore.dataset.tooltip = xmlRestoreAvailable ? "Restore the XML captured before AutoStartFlow's first sync" : "Sync exe.xml once to create an original snapshot";
}
function renderPathStatuses() {
  const simExe = $("#sim-exe").value.trim();
  const simStatus = $("#sim-exe-status");
  simStatus.textContent = simExeExists ? "" : simExe
    ? "This is not a valid simulator executable for the selected profile."
    : "";
  simStatus.dataset.state = simExe ? (simExeExists ? "found" : "missing") : "optional";
  const simValidity = $("#sim-exe-validity");
  simValidity.dataset.state = simExeExists ? "found" : "missing";
  simValidity.textContent = simExeExists ? "✓" : "×";
  simValidity.setAttribute("aria-label", simExeExists ? "Simulator executable found" : "Simulator executable not found");
  simValidity.dataset.tooltip = simExeExists
    ? "Simulator executable found"
    : simExe
      ? "This path must point to the selected MSFS version's executable."
      : "No simulator executable detected";
  const xmlStatus = $("#xml-path-status");
  const xmlPath = $("#xml-path").value.trim();
  xmlStatus.textContent = "";
  xmlStatus.dataset.state = !xmlPath ? "missing" : (xmlPathExists ? "found" : "missing");
  const xmlValidity = $("#xml-path-validity");
  xmlValidity.dataset.state = xmlPathExists ? "found" : "missing";
  xmlValidity.textContent = xmlPathExists ? "✓" : "×";
  xmlValidity.setAttribute("aria-label", xmlPathExists ? "EXE.xml found" : "EXE.xml not found");
  xmlValidity.dataset.tooltip = xmlPathExists
    ? "EXE.xml found"
    : xmlPath
      ? "This path must point to a valid MSFS EXE.xml. AutoStartFlow can create it when you sync."
      : "No EXE.xml location is set for this profile.";
}
function refreshPresets() {
  const custom = Array.isArray(settings.custom_presets) ? settings.custom_presets : [];
  presets = [...builtInPresets, ...custom.map((preset, index) => ({ ...preset, custom: true, customIndex: index }))];
}
function renderStatus() {
  const running = !!monitorState.sim_running;
  const simName = String(settings.edition || "MSFS 2024").includes("2020") ? "MSFS 2020" : "MSFS 2024";
  const holding = !simExeExists || !xmlPathExists;
  const title = settings.addons_enabled === false ? "Add-ons <em>disabled</em>"
    : holding ? "Holding <em>short</em>"
    : running ? (monitorState.sim_ready ? "V1, <em>Started up</em>" : "MSFS <em>running</em>")
      : "Cleared for <em>startup</em>";
  $("#welcome-title").innerHTML = title;
  const sim = $("#sim-status-card");
  sim.classList.toggle("online", running);
  $("#sim-status").textContent = running ? `${simName} is running` : "Not detected";
  $("#sim-status-symbol").innerHTML = running
    ? '<path d="m5 12.5 4.3 4.3L19 7.2"/>'
    : '<path d="M12 3 3.5 20h17L12 3Z"/><path d="M12 9v5m0 3h.01"/>';
  $("#sim-lock-note").textContent = "MSFS is running. Close the sim before making edits.";
  $("#sim-lock-note").classList.toggle("hidden", !running);
  sim.setAttribute("aria-label", running ? `${simName} running` : "Simulator not detected");
  $("#monitor-status").textContent = monitorState.monitoring ? "Flight watch is on" : "Flight watch is off";
  $("#monitor-toggle").classList.toggle("on", !!monitorState.monitoring);
  updateSimulatorLocks(running);
}
function updateSimulatorLocks(running) {
  ["#edition", "#sim-exe", "#xml-path", "#detect-paths", "#sync-xml", "#import-xml", "#restore-xml", "#open-export",
   "#add-app", "#empty-add", "#addons-toggle"].forEach(selector => { const element = $(selector); if (element) element.disabled = running || settingsSavePending; });
  const exportDialog = $("#export-dialog");
  if (running && exportDialog.open) exportDialog.close();
  exportDialog.querySelectorAll("button, input, select").forEach(element => {
    element.disabled = running || (element.id === "import-config-submit" && !importConfiguration) ||
      (element.id === "import-exe-xml-submit" && !importExeXmlText);
  });
  $$('[data-browse="xml"], [data-browse="sim"], [data-browse="app"]').forEach(button => { button.disabled = running; });
  $("#sim-settings").classList.toggle("sim-locked", running);
  $("#app-list").classList.toggle("sim-locked", running);
  $$(".app-row").forEach(row => {
    row.draggable = !running;
    row.querySelector('[data-action="edit"]').disabled = running;
    row.querySelector('[data-action="remove"]').disabled = running;
    row.querySelector('[data-action="toggle-enabled"]').disabled = running || settingsSavePending;
  });
  ["#profile-name", "#profile-path", "#profile-args", "#profile-timing", "#profile-monitor",
   "#profile-close", "#profile-unmanaged", "#profile-minimize", "#save-profile"].forEach(selector => {
    const element = $(selector); if (element) element.disabled = running;
  });
  $$('.startup-profile-controls button, #startup-profile-select').forEach(element => {
    element.disabled = running || settingsSavePending || (element.id === 'startup-profile-delete' && (settings.startup_profiles || []).length <= 1);
  });
}
function retryAppIcon(image) {
  const attempts = Number(image.dataset.retryCount || 0);
  if (attempts >= 3) {
    image.remove();
    return;
  }
  image.dataset.retryCount = String(attempts + 1);
  const url = new URL(image.src, window.location.href);
  url.searchParams.set("v", `${Date.now()}-${attempts + 1}`);
  image.src = url.toString();
}

function renderApps() {
  const apps = settings.apps || [];
  const list = $("#app-list");
  const allEnabled = settings.addons_enabled !== false;
  const bulkEnabled = settings.addons_bulk_enabled ?? allEnabled;
  const masterToggle = $("#addons-toggle");
  masterToggle.classList.toggle("on", bulkEnabled);
  masterToggle.setAttribute("aria-pressed", String(bulkEnabled));
  masterToggle.setAttribute("aria-label", bulkEnabled ? "Disable all add-ons" : "Enable all add-ons");
  $("#empty-state").classList.toggle("hidden", apps.length > 0);
  list.classList.toggle("hidden", apps.length === 0);
  list.innerHTML = apps.map((app, i) => {
    const mode = timingInfo(app.timing);
    const action = app.timing === "Close only (do not launch)" ? "Close-only" : mode.label;
    const enabled = app.enabled !== false;
    return `<article class="app-row${enabled && allEnabled ? "" : " app-disabled"}" draggable="true" data-id="${esc(app.id)}" data-index="${i}">
      <span class="drag-handle" data-tooltip="Drag to reorder" aria-label="Drag to reorder">⠿</span>
      <span class="app-monogram"><img src="/api/icon?id=${encodeURIComponent(app.id)}&path=${encodeURIComponent(app.path)}&v=${Date.now()}" alt="" onload="this.parentElement.classList.add('has-app-icon')" onerror="retryAppIcon(this)"><span>${esc(initials(app.name))}</span></span>
      <div class="app-info"><div class="app-heading"><div class="app-name" data-tooltip="${esc(app.name)}">${esc(app.name)}</div></div><div class="app-path" data-tooltip="${esc(app.path)}">${esc(basename(app.path))}</div></div>
      <div class="app-launch-details"><div class="launch-state hidden" role="status"><span class="launch-state-label"></span><button type="button" class="retry-app icon-btn hidden" data-action="retry" data-id="${esc(app.id)}" aria-label="Retry launch" data-tooltip="Retry launch"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M20 7v5h-5M19 12a7 7 0 1 0-2 5"/></svg></button></div><span class="timing-chip ${mode.cls}">${esc(action)}</span></div>
      <button type="button" class="app-enabled-toggle app-row-enabled${enabled && allEnabled ? " on" : ""}" data-action="toggle-enabled" data-id="${esc(app.id)}" aria-label="${enabled && allEnabled ? `Disable ${esc(app.name)}` : `Enable ${esc(app.name)}`}" aria-pressed="${enabled && allEnabled}"><i></i></button>
      <div class="row-actions"><button class="icon-btn" data-action="edit" data-id="${esc(app.id)}" aria-label="Edit ${esc(app.name)}">${icons.edit}</button><button class="icon-btn" data-action="remove" data-id="${esc(app.id)}" aria-label="Remove ${esc(app.name)}">${icons.remove}</button></div>
    </article>`;
  }).join("");
  bindRowEvents();
  renderLaunchStatuses();
}
function renderLaunchStatuses() {
  $$('.app-row').forEach(row => {
    const state = monitorState.launch_states?.[row.dataset.id];
    const wrap = row.querySelector('.launch-state');
    wrap.classList.toggle('hidden', !monitorState.sim_running);
    const app = settings.apps.find(item => item.id === row.dataset.id);
    const disabled = settings.addons_enabled === false || app?.enabled === false;
    const label = disabled ? 'Disabled' : state?.label || (app?.timing === 'Aircraft loaded (SimConnect)' ? 'Waiting for aircraft' : 'Launching…');
    wrap.querySelector('.launch-state-label').textContent = label;
    wrap.dataset.code = disabled ? 'disabled' : state?.code || '';
    wrap.title = state?.detail || '';
    wrap.querySelector('.retry-app').classList.toggle('hidden', !state?.retry || disabled);
  });
}
function reorderAppRows() {
  const list = $("#app-list");
  const rows = new Map($$(".app-row", list).map(row => [row.dataset.id, row]));
  const previousPositions = new Map([...rows].map(([id, row]) => [id, row.getBoundingClientRect().top]));
  settings.apps.forEach(app => {
    const row = rows.get(app.id);
    if (row) list.appendChild(row);
  });
  list.classList.add("is-reordering");
  $$(".app-row", list).forEach(row => {
    const previousTop = previousPositions.get(row.dataset.id);
    if (previousTop === undefined) return;
    const offset = previousTop - row.getBoundingClientRect().top;
    if (offset) row.animate(
      [{ transform: `translateY(${offset}px)` }, { transform: "translateY(0)" }],
      { duration: 220, easing: "cubic-bezier(.2,.75,.25,1)" }
    );
  });
  requestAnimationFrame(() => list.classList.remove("is-reordering"));
}
function bindRowEvents() {
  $$(".app-row").forEach(row => {
    row.addEventListener("dragstart", e => { row.classList.add("dragging"); e.dataTransfer.setData("text/plain", row.dataset.id); e.dataTransfer.effectAllowed = "move"; });
    row.addEventListener("dragend", () => { row.classList.remove("dragging"); $$(".drop-target").forEach(el => el.classList.remove("drop-target", "drop-before", "drop-after")); });
    row.addEventListener("dragover", e => {
      e.preventDefault();
      const after = e.clientY >= row.getBoundingClientRect().top + row.offsetHeight / 2;
      row.classList.add("drop-target");
      row.classList.toggle("drop-before", !after);
      row.classList.toggle("drop-after", after);
    });
    row.addEventListener("dragleave", e => {
      if (e.relatedTarget && row.contains(e.relatedTarget)) return;
      row.classList.remove("drop-target", "drop-before", "drop-after");
    });
    row.addEventListener("drop", async e => {
      e.preventDefault();
      const after = row.classList.contains("drop-after");
      row.classList.remove("drop-target", "drop-before", "drop-after");
      const from = settings.apps.findIndex(a => a.id === e.dataTransfer.getData("text/plain"));
      const to = settings.apps.findIndex(a => a.id === row.dataset.id);
      if (from >= 0 && to >= 0 && from !== to) {
        const [item] = settings.apps.splice(from, 1);
        let insertAt = to + (after ? 1 : 0);
        if (from < insertAt) insertAt--;
        settings.apps.splice(insertAt, 0, item);
        reorderAppRows();
        await syncAppChanges("App order updated. exe.xml is synchronized.");
      }
    });
  });
  listActionDelegation();
}
function listActionDelegation() {
  $("#app-list").onclick = async e => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;
    const { action, id } = btn.dataset;
    const index = settings.apps.findIndex(a => a.id === id);
    if (index < 0) return;
    if (action === 'retry') {
      btn.disabled = true;
      try { const result = await api('/api/retry-app', {id}); toast(result.message, !result.ok); await poll(); }
      catch(error) { toast(error.message, true); }
      finally { btn.disabled = false; }
      return;
    }
    if (action === "toggle-enabled") {
      if (settings.addons_enabled === false) {
        settings.apps.forEach(app => { app.enabled = false; });
        settings.addons_enabled = true;
        settings.addons_bulk_enabled = false;
      }
      settings.apps[index].enabled = settings.apps[index].enabled === false;
      renderApps();
      await syncAppChanges(`${settings.apps[index].name} ${settings.apps[index].enabled ? "enabled" : "disabled"}.`);
      return;
    }
    if (action === "edit") return openDialog(settings.apps[index]);
    if (action === "close") { settings.apps[index].close = !settings.apps[index].close; renderApps(); return saveSettings(); }
    if (action === "remove") {
      if (!await askConfirm("Remove startup app?", `Remove ${settings.apps[index].name} from AutoStartFlow? Its startup entry will be reconciled in exe.xml.`, "Remove app", true)) return;
      settings.apps.splice(index, 1); renderApps(); await syncAppChanges("App removed. exe.xml is synchronized.");
    }
  };
}
async function saveSettings(windowsStartupRequestedIds = []) {
  lastSettingsSaveError = "";
  lastStartupSyncError = "";
  settings.xml_path = $("#xml-path").value.trim();
  settings.sim_exe = $("#sim-exe").value.trim();
  setSaveState("Saving…", true);
  settingsSavePending = true;
  updateSimulatorLocks(!!monitorState.sim_running);
  try {
    if (setupDraft) {
      const draft = await api('/api/setup/draft', {settings});
      simExeExists = !!draft.sim_exe_exists;
      simExeAutodetected = !!draft.sim_exe_autodetected;
      xmlPathExists = !!draft.xml_path_exists;
      lastXmlSyncError = '';
      fillSettings();
      setSaveState('Not saved yet');
      return true;
    }
    const response = await api("/api/settings", { settings, windows_startup_requested_ids:windowsStartupRequestedIds });
    lastXmlSyncError = response.xml_error || "";
    lastStartupSyncError = response.startup_error || "";
    const state = await api("/api/state");
    settings = state.settings;
    settingsRevision = state.settings_revision ?? settingsRevision;
    xmlRestoreAvailable = !!state.xml_restore_available;
    simExeExists = !!state.sim_exe_exists;
    simExeAutodetected = !!state.sim_exe_autodetected;
    xmlPathExists = !!state.xml_path_exists;
    monitorState = state.state;
    presets = state.presets || presets;
    fillSettings();
    renderStatus();
    setSaveState("Saved locally");
    if (response.startup_error) toast(`Settings saved, but Windows startup could not be updated: ${response.startup_error}`, true);
    if (response.xml_error) toast(`Saved locally, but exe.xml could not be updated: ${response.xml_error}`, true);
    return true;
  } catch (e) { lastSettingsSaveError = e.message; setSaveState("Save failed"); toast(e.message, true); return false; }
  finally {
    settingsSavePending = false;
    updateSimulatorLocks(!!monitorState.sim_running);
  }
}
function scheduleSave() { clearTimeout(saveTimer); setSaveState("Unsaved changes", true); saveTimer = setTimeout(saveSettings, 450); }
async function syncAppChanges(successMessage, windowsStartupRequestedIds = []) {
  if (!await saveSettings(windowsStartupRequestedIds)) return false;
  if (lastXmlSyncError || lastStartupSyncError) return false;
  toast(successMessage);
  return true;
}
function renderPresetButtons() {
  $("#preset-buttons").innerHTML = presets.map((p, i) => p.custom
    ? `<span class="custom-preset"><button class="preset-button" type="button" data-preset="${i}">${esc(p.name)}</button><button class="preset-remove" type="button" data-remove-preset="${p.customIndex}" aria-label="Remove ${esc(p.name)} quick configuration">×</button></span>`
    : `<button class="preset-button" type="button" data-preset="${i}">${esc(p.name)}</button>`).join("");
  $$(".preset-button", $("#preset-buttons")).forEach(btn => btn.onclick = () => {
    const preset = presets[Number(btn.dataset.preset)];
    $("#profile-name").value = preset.name;
    $("#profile-path").value = preset.path || "";
    $("#profile-args").value = preset.args || "";
    updateWindowsTimingOption(preset.path || "");
    $("#profile-timing").value = preset.timing || "Sim starts (exe.xml)";
    updateCloseOption(preset.path || "", true, !!preset.close_unmanaged);
    $$(".preset-button", $("#preset-buttons")).forEach(b => b.classList.toggle("selected", b === btn));
  });
  $$(".preset-remove", $("#preset-buttons")).forEach(btn => btn.onclick = async () => {
    const index = Number(btn.dataset.removePreset);
    const [removed] = settings.custom_presets.splice(index, 1);
    refreshPresets();
    if (!await saveSettings()) settings.custom_presets.splice(index, 0, removed);
    refreshPresets();
    renderPresetButtons();
  });
}
function openDialog(app = null) {
  const dialog = $("#app-dialog");
  const error = $("#profile-error");
  error.textContent = "";
  error.classList.add("hidden");
  const nameError = $("#profile-name-error");
  nameError.textContent = "";
  nameError.classList.add("hidden");
  const isEdit = !!app;
  $("#dialog-title").textContent = isEdit ? "Edit flight app" : "Add a flight app";
  $("#profile-id").value = app?.id || "";
  $("#profile-name").value = app?.name || "";
  $("#profile-name").dataset.manuallyEdited = String(isEdit);
  $("#profile-path").value = app?.path || "";
  const monitorSelect = $("#profile-monitor");
  monitorSelect.innerHTML = (availableMonitors.length ? availableMonitors : [{ id: "", name: "System default" }])
    .map(monitor => `<option value="${esc(monitor.id)}">${esc(monitor.name)}</option>`).join("");
  monitorSelect.value = app?.monitor || "";
  $("#profile-args").value = app?.args || "";
  updateWindowsTimingOption(app?.path || "");
  $("#profile-timing").value = app?.timing || "Sim starts (exe.xml)";
  $("#profile-close").checked = app?.close ?? true;
  $("#profile-unmanaged").checked = app?.close_unmanaged ?? false;
  $('#profile-minimize').checked = app?.minimize_to_tray ?? false;
  updateCloseOption(app?.path || "", app?.close ?? true, app?.close_unmanaged ?? false);
  $("#delete-profile").classList.toggle("hidden", !isEdit);
  $("#preset-picks").classList.toggle("hidden", isEdit);
  renderPresetButtons();
  dialog.showModal();
}
async function openPreferences() {
  $("#pref-theme").value = settings.theme || "dark";
  $("#pref-elevated").checked = settings.run_elevated !== false;
  $('#pref-elevated-status').textContent = setupActive || runtimeElevated === null
    ? 'Windows asks once when AutoStartFlow opens. Allows control of elevated companions. Changes apply next launch.'
    : runtimeElevated
      ? 'Currently running as administrator. Changes apply next launch.'
      : 'Currently running without administrator privileges. Changes apply next launch.';
  $("#pref-watch").checked = settings.flight_watch_enabled !== false;
  $("#pref-close-on-sim-exit").checked = !!settings.close_autostartflow_on_sim_close;
  $("#pref-sim").checked = settings.launch_with_msfs !== false;
  $("#pref-windows").checked = !!settings.launch_on_pc_start && !settings.launch_with_msfs;
  $("#pref-tray").value = typeof settings.minimize_to_tray === 'string' ? settings.minimize_to_tray : settings.minimize_to_tray ? 'application_open' : 'off';
  if (setupActive) {
    $(".main-content").append($("#preferences-dialog"));
    $("#preferences-dialog").show();
  } else {
    const dialog = $("#preferences-dialog");
    dialog.showModal();
    await new Promise(resolve => requestAnimationFrame(resolve));
    const fields = dialog.querySelector('.preference-fields');
    if (fields.scrollHeight > fields.clientHeight) {
      const height = Math.ceil(dialog.getBoundingClientRect().height + fields.scrollHeight - fields.clientHeight + 32);
      try { await api('/api/setup/window', {stage:'app', height:Math.max(innerHeight, height)}); }
      catch(error) { toast(error.message, true); }
    }
  }
}
function renderStartupProfiles() {
  const select = $('#startup-profile-select');
  const profiles = settings.startup_profiles || [];
  select.innerHTML = profiles.map(profile => `<option value="${esc(profile.id)}">${esc(profile.name)}</option>`).join('');
  select.value = settings.active_startup_profile || '';
  updateSimulatorLocks(!!monitorState.sim_running);
}
function openStartupProfile(action) {
  startupProfileAction = action;
  startupProfileId = settings.active_startup_profile || '';
  const selected = (settings.startup_profiles || []).find(item => item.id === startupProfileId);
  $('#startup-profile-title').textContent = action === 'create' ? 'New startup profile' : action === 'duplicate' ? 'Duplicate startup profile' : 'Edit startup profile';
  $('#startup-profile-name').value = action === 'create' ? '' : action === 'duplicate' ? `${selected?.name || 'Profile'} copy` : selected?.name || '';
  $('#startup-profile-error').classList.add('hidden');
  $('#startup-profile-dialog').showModal();
}
$('#startup-profile-new').addEventListener('click', () => openStartupProfile('create'));
$('#startup-profile-edit').addEventListener('click', () => openStartupProfile('rename'));
$('#startup-profile-duplicate').addEventListener('click', () => openStartupProfile('duplicate'));
$('#startup-profile-form').addEventListener('submit', async event => {
  event.preventDefault();
  const button = event.submitter;
  button.disabled = true;
  try {
    await api('/api/startup-profile', {action:startupProfileAction, id:startupProfileId, name:$('#startup-profile-name').value});
    $('#startup-profile-dialog').close();
    await loadState();
    toast('Startup profile saved.');
  } catch(error) { $('#startup-profile-error').textContent = error.message; $('#startup-profile-error').classList.remove('hidden'); }
  finally { button.disabled = false; }
});
$('#startup-profile-select').addEventListener('change', async event => {
  const id = event.target.value;
  event.target.disabled = true;
  try { await api('/api/startup-profile', {action:'load', id}); await loadState(); toast('Startup profile loaded and exe.xml synchronized.'); }
  catch(error) { toast(error.message, true); renderStartupProfiles(); }
});
$('#startup-profile-delete').addEventListener('click', async () => {
  const id = settings.active_startup_profile;
  if (!await askConfirm('Delete startup profile?', 'Delete this profile and load another saved configuration?', 'Delete profile', true)) return;
  try { await api('/api/startup-profile', {action:'delete', id}); await loadState(); toast('Startup profile deleted.'); }
  catch(error) { toast(error.message, true); }
});
$('#reset-preferences').addEventListener('click', async () => {
  if (!await askConfirm('Restore default settings?', 'Restore the default app preferences? Your startup apps, profiles and simulator paths will be kept.', 'Restore defaults')) return;
  $('#pref-theme').value = preferenceDefaults.theme || 'dark';
  $('#pref-watch').checked = preferenceDefaults.flight_watch_enabled !== false;
  $('#pref-sim').checked = preferenceDefaults.launch_with_msfs !== false;
  $('#pref-windows').checked = false;
  $('#pref-close-on-sim-exit').checked = false;
  $('#pref-tray').value = 'off';
  $('#pref-elevated').checked = preferenceDefaults.run_elevated !== false;
  if (setupActive) { toast('Default preferences restored. Save to finish setup.'); await fitSetupWindow(); }
  else await savePreferences({preventDefault(){}}, {keepOpen:true});
});
async function savePreferences(e, {keepOpen=false} = {}) {
  e.preventDefault();
  const oldWatch = settings.flight_watch_enabled !== false;
  const oldCloseOnSimExit = !!settings.close_autostartflow_on_sim_close;
  const oldSim = !!settings.launch_with_msfs;
  const oldWindows = !!settings.launch_on_pc_start;
  const oldTray = settings.minimize_to_tray;
  const oldElevation = settings.run_elevated;
  const oldTheme = settings.theme || "dark";
  settings.theme = $("#pref-theme").value;
  settings.flight_watch_enabled = $("#pref-watch").checked;
  settings.close_autostartflow_on_sim_close = $("#pref-close-on-sim-exit").checked;
  settings.launch_with_msfs = $("#pref-sim").checked;
  settings.launch_on_pc_start = $("#pref-windows").checked;
  settings.minimize_to_tray = $("#pref-tray").value;
  settings.run_elevated = $("#pref-elevated").checked;
  if (setupActive) {
    const button = $("#save-preferences");
    button.disabled = true;
    button.textContent = "Finishing setup…";
    try {
      await api("/api/setup/complete", { settings, install_path: installDestination, replace_confirmed:cleanReplaceConfirmed });
      setupDraft = false;
      if (installation.packaged) {
        button.textContent = "Opening AutoStartFlow…";
        return;
      }
      setupActive = false;
      $("#preferences-dialog").close();
      document.body.append($("#preferences-dialog"));
      await api("/api/setup/window", { stage: "app" });
      await loadState();
      renderSetup();
      toast("Setup complete. Add your first flight app to get started.");
    } catch (error) { toast(error.message, true); }
    finally { button.disabled = false; button.textContent = setupActive ? "Save and open AutoStartFlow" : "Save preferences"; }
    return;
  }
  const saved = await saveSettings();
  if (!saved) {
    settings.flight_watch_enabled = oldWatch;
    settings.close_autostartflow_on_sim_close = oldCloseOnSimExit;
    settings.launch_with_msfs = oldSim;
    settings.launch_on_pc_start = oldWindows;
    settings.minimize_to_tray = oldTray;
    settings.run_elevated = oldElevation;
    settings.theme = oldTheme;
    applyTheme(oldTheme);
    return;
  }
  applyTheme(settings.theme);
  if (!keepOpen) $("#preferences-dialog").close();
  if (oldWatch !== settings.flight_watch_enabled)
    toast(settings.flight_watch_enabled ? "Flight watch is on." : "Flight watch is off.");
  else if (oldCloseOnSimExit !== settings.close_autostartflow_on_sim_close)
    toast(settings.close_autostartflow_on_sim_close ? "AutoStartFlow will close when MSFS closes." : "AutoStartFlow will stay open when MSFS closes.");
  else if (oldSim !== settings.launch_with_msfs && settings.launch_with_msfs)
    toast("AutoStartFlow will be added to exe.xml the next time you sync it.");
  else if (oldWindows !== settings.launch_on_pc_start)
    toast(settings.launch_on_pc_start ? "AutoStartFlow will start when you sign in to Windows." : "AutoStartFlow was removed from Windows startup.");
  else if (oldTray !== settings.minimize_to_tray)
    toast(settings.minimize_to_tray === 'off' ? 'AutoStartFlow tray minimization is off.' : settings.minimize_to_tray === 'msfs_launch' ? 'AutoStartFlow will minimize when MSFS launches.' : 'AutoStartFlow will start in the tray next time.');
  else if (oldElevation !== settings.run_elevated)
    toast("Administrator preference saved. Restart AutoStartFlow to apply it.");
  else if (oldTheme !== settings.theme)
    toast("Appearance updated.");
  else toast("Preferences saved.");
}
async function saveProfile(e) {
  e.preventDefault();
  if (!$("#profile-name").value.trim()) {
    const error = $("#profile-name-error");
    error.textContent = "Enter a display name.";
    error.classList.remove("hidden");
    $("#profile-name").focus();
    return;
  }
  const id = $("#profile-id").value || crypto.randomUUID();
  const previous = settings.apps.find(a => a.id === id);
  const app = { ...(previous || {}), id, name: $("#profile-name").value.trim(), path: $("#profile-path").value.trim(),
    args: $("#profile-args").value.trim(), timing: $("#profile-timing").value,
    monitor: $("#profile-monitor").value,
    close: $("#profile-close").checked, close_unmanaged: $("#profile-unmanaged").checked,
    minimize_to_tray: $('#profile-minimize').checked,
    enabled: previous?.enabled !== false,
    ...(previous?.xml_original_entry ? { xml_original_entry: previous.xml_original_entry } : {}),
    ...(previous?.window_bounds ? { window_bounds: previous.window_bounds } : {}) };
  if (!app.path) {
    const error = $("#profile-error");
    error.textContent = "Choose the application executable path.";
    error.classList.remove("hidden");
    $("#profile-path").focus();
    return;
  }
  try {
    const validation = await api("/api/validate-app-target", { path: app.path, timing: app.timing });
    app.path = validation.path;
    app.close = validation.close_supported && app.close;
  } catch (e) {
    const error = $("#profile-error");
    error.textContent = e.message;
    error.classList.remove("hidden");
    $("#profile-path").focus();
    return;
  }
  const duplicate = settings.apps.some(existing => existing.id !== id
    && normalizeAppPath(existing.path) === normalizeAppPath(app.path));
  if (duplicate) {
    const error = $("#profile-error");
    error.textContent = "This application is already in your startup list.";
    error.classList.remove("hidden");
    $("#profile-path").focus();
    return;
  }
  const index = settings.apps.findIndex(a => a.id === id);
  const previousApps = settings.apps.slice();
  if (index >= 0) settings.apps[index] = app; else settings.apps.push(app);
  const successMessage = app.timing === 'Windows starts'
    ? `Flight app saved. Windows startup registered${app.enabled && settings.addons_enabled !== false ? '' : ' (disabled)'}.`
    : previous ? "Flight app updated. exe.xml is synchronized." : "Flight app added. exe.xml is synchronized.";
  if (!await syncAppChanges(successMessage, [app.id])) {
    if (lastSettingsSaveError) settings.apps = previousApps;
    const error = $("#profile-error");
    error.textContent = lastSettingsSaveError || lastStartupSyncError || lastXmlSyncError || 'Could not save this flight app.';
    error.classList.remove("hidden");
    renderApps();
    return;
  }
  $("#app-dialog").close();
  // Render after persistence so the icon endpoint can resolve the new app id.
  renderApps();
}
function openQuickConfigDialog() {
  $("#quick-config-name").value = "";
  $("#quick-config-path").value = "";
  $("#quick-config-args").value = "";
  $("#quick-config-timing").value = "Sim starts (exe.xml)";
  $("#quick-config-error").textContent = "";
  $("#quick-config-error").classList.add("hidden");
  $("#quick-config-dialog").showModal();
}
async function saveQuickConfig(e) {
  e.preventDefault();
  const name = $("#quick-config-name").value.trim();
  const error = $("#quick-config-error");
  const showError = message => { error.textContent = message; error.classList.remove("hidden"); };
  if (!name) return showError("Enter a configuration name.");
  const applicationPath = $("#quick-config-path").value.trim();
  if (!applicationPath) return showError("Select an application path.");
  if (presets.some(preset => preset.name.toLocaleLowerCase() === name.toLocaleLowerCase()))
    return showError("A quick configuration with this name already exists.");
  const preset = {
    name,
    path: applicationPath,
    args: $("#quick-config-args").value.trim(),
    timing: $("#quick-config-timing").value,
  };
  if (preset.path) {
    try {
      const validation = await api("/api/validate-app-target", { path: preset.path });
      preset.path = validation.path;
    } catch (e) {
      return showError(e.message);
    }
  }
  settings.custom_presets.push(preset);
  if (!await saveSettings()) {
    settings.custom_presets.pop();
    return;
  }
  refreshPresets();
  $("#quick-config-dialog").close();
  renderPresetButtons();
  toast("Quick configuration saved. It hasn’t been added to Startup Apps.");
}
async function browse(kind) {
  try {
    const initial = kind === "xml" ? $("#xml-path").value : kind === "sim" ? $("#sim-exe").value : kind === "quick-config" ? $("#quick-config-path").value : $("#profile-path").value;
    const result = await api("/api/browse", { kind: kind === "quick-config" ? "app" : kind, initial });
    if (!result.path) return;
    if (kind === "xml") $("#xml-path").value = result.path;
    else if (kind === "sim") $("#sim-exe").value = result.path;
    else if (kind === "quick-config") $("#quick-config-path").value = result.path;
    else {
      $("#profile-path").value = result.path;
      updateSuggestedAppName(result.path);
      updateCloseOption(result.path);
    }
    if (kind !== "app" && kind !== "quick-config") scheduleSave();
  } catch (e) { toast(e.message, true); }
}
async function syncXml() {
  if (!await saveSettings()) return;
  if (!await askConfirm("Sync startup apps?", "AutoStartFlow will update its own entries and replace matching app entries in exe.xml. Other entries will be preserved, and a backup will be created.", "Sync XML")) return;
  const button = $("#sync-xml"); button.disabled = true; button.textContent = "Syncing…";
  try {
    const result = await api("/api/sync-xml", {});
    await loadState();
    toast(`Startup apps synchronized. ${result.backup}`);
  } catch (e) { toast(e.message, true); }
  finally { button.disabled = !!monitorState.sim_running; button.textContent = "Sync"; }
}
async function importXml() {
  if (!await saveSettings()) return;
  const button = $("#import-xml");
  button.disabled = true;
  button.textContent = "Scanning exe.xml…";
  try {
    const result = await api("/api/import-xml", {});
    await loadState();
    const count = result.imported.length;
    toast(count ? `Imported ${count} app${count === 1 ? "" : "s"} from exe.xml.` : "No new apps found in exe.xml.");
  } catch (e) { toast(e.message, true); }
  finally { button.disabled = false; button.textContent = "Import from exe.xml"; }
}
async function restoreXml() {
  if (!xmlRestoreAvailable) return;
  if (!await askConfirm("Restore original XML?", "This restores exe.xml to its original snapshot and discards later changes made by AutoStartFlow or other tools.", "Restore XML", true)) return;
  const button = $("#restore-xml");
  button.disabled = true;
  try {
    const result = await api("/api/restore-xml", {});
    await loadState();
    const savedCopy = result.pre_restore_backup
      ? ` Current EXE.xml copy saved to ${result.pre_restore_backup}.`
      : "";
    toast(`${result.message}${savedCopy} ${result.imported ? `${result.imported} apps loaded into Startup Apps.` : "Startup Apps are up to date."}`);
  } catch (e) { toast(e.message, true); }
  finally { button.disabled = false; }
}
async function toggleMonitor() {
  const enabled = !monitorState.monitoring;
  try { await api("/api/monitor", { enabled }); await loadState(); toast(enabled ? "Flight watch is on." : "Flight watch is off."); }
  catch (e) { toast(e.message, true); }
}
async function poll() {
  try {
    const data = await api("/api/state");
    if (settingsSavePending) return;
    if (!setupDraft && settingsRevision !== null && data.settings_revision !== settingsRevision) {
      const xmlWasSynced = data.state.status === "EXE.xml changes synchronized with AutoStartFlow.";
      await loadState();
      if (xmlWasSynced) toast("Manual EXE.xml changes were synced automatically.");
      return;
    }
    monitorState = data.state;
    renderStatus();
    renderLaunchStatuses();
  } catch (_) { /* The local server may be closing. */ }
}

$(".top-actions").addEventListener("mousedown", event => event.stopPropagation());
$(".topbar").addEventListener("mousedown", event => {
  if (event.button !== 0 || event.target.closest("button, a, input, select")) return;
  api("/api/window-drag", {}).catch(() => {});
});
document.querySelectorAll("dialog").forEach(dialog => dialog.addEventListener("close", () => {
  requestAnimationFrame(() => {
    document.querySelectorAll("button:hover, a:hover, [role='button']:hover").forEach(element => element.classList.add("hover-suppressed"));
  });
}));
document.addEventListener("pointermove", () => {
  document.querySelectorAll(".hover-suppressed").forEach(element => element.classList.remove("hover-suppressed"));
});
$("#add-app").addEventListener("click", () => openDialog());
$("#empty-add").addEventListener("click", () => openDialog());
function showConfigurationSection(name) {
  const importing = name === "import";
  if (importing) showImportType("settings");
  $("#export-section").classList.toggle("hidden", importing);
  $("#import-section").classList.toggle("hidden", !importing);
  $("#show-export-section").classList.toggle("selected", !importing);
  $("#show-import-section").classList.toggle("selected", importing);
  $("#show-export-section").setAttribute("aria-selected", String(!importing));
  $("#show-import-section").setAttribute("aria-selected", String(importing));
}
$("#open-export").addEventListener("click", () => {
  if (monitorState.sim_running) return;
  $("#export-error").classList.add("hidden");
  $("#import-config-error").classList.add("hidden");
  showConfigurationSection("export");
  $("#export-dialog").showModal();
});
$("#show-export-section").addEventListener("click", () => showConfigurationSection("export"));
$("#show-import-section").addEventListener("click", () => showConfigurationSection("import"));
function showImportType(name) {
  const isXml = name === "xml";
  $("#import-settings-panel").classList.toggle("hidden", isXml);
  $("#import-xml-panel").classList.toggle("hidden", !isXml);
  $("#show-import-settings").classList.toggle("selected", !isXml);
  $("#show-import-xml").classList.toggle("selected", isXml);
  $("#show-import-settings").setAttribute("aria-selected", String(!isXml));
  $("#show-import-xml").setAttribute("aria-selected", String(isXml));
}
$("#show-import-settings").addEventListener("click", () => showImportType("settings"));
$("#show-import-xml").addEventListener("click", () => showImportType("xml"));
$("#select-import-config").addEventListener("click", () => $("#import-config-file").click());
$("#import-config-file").addEventListener("change", async event => {
  const file = event.target.files?.[0];
  const error = $("#import-config-error");
  error.classList.add("hidden");
  importConfiguration = null;
  $("#import-source-wrap").classList.add("hidden");
  $("#import-config-submit").disabled = true;
  $("#import-config-filename").textContent = file ? file.name : "No file selected";
  if (!file) return;
  try {
    if (file.size > 900_000) throw new Error("This settings.json file is too large to import.");
    const parsed = JSON.parse(await file.text());
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("This file is not a valid AutoStartFlow settings.json.");
    let profiles = parsed.simulators && typeof parsed.simulators === "object" ? Object.keys(parsed.simulators) : [];
    if (!profiles.length && Array.isArray(parsed.apps)) profiles = [parsed.edition || "MSFS 2024 - Microsoft Store"];
    if (!profiles.length) throw new Error("No simulator configurations were found in this settings file.");
    importConfiguration = parsed;
    $("#import-source-profile").innerHTML = profiles.map(profile => `<option value="${esc(profile)}">${esc(profile)}</option>`).join("");
    $("#import-source-profile").value = profiles.includes(settings.edition) ? settings.edition : profiles[0];
    $("#import-source-wrap").classList.remove("hidden");
    $("#import-config-submit").disabled = false;
  } catch (e) {
    error.textContent = e.message || "Could not read this settings.json file.";
    error.classList.remove("hidden");
  }
});
$("#select-import-exe-xml").addEventListener("click", () => $("#import-exe-xml-file").click());
$("#import-exe-xml-file").addEventListener("change", async event => {
  const file = event.target.files?.[0];
  const error = $("#import-exe-xml-error");
  error.classList.add("hidden");
  importExeXmlText = "";
  $("#import-exe-xml-submit").disabled = true;
  $("#import-exe-xml-filename").textContent = file ? file.name : "No file selected";
  if (!file) return;
  try {
    if (file.size > 300_000) throw new Error("This EXE.xml file is too large to import.");
    importExeXmlText = await file.text();
    if (!importExeXmlText.trim()) throw new Error("The selected EXE.xml file is empty.");
    $("#import-exe-xml-submit").disabled = false;
  } catch (e) {
    error.textContent = e.message || "Could not read this EXE.xml file.";
    error.classList.remove("hidden");
  }
});
$("#import-exe-xml-submit").addEventListener("click", async () => {
  const error = $("#import-exe-xml-error");
  error.classList.add("hidden");
  if (!importExeXmlText) return;
  const accepted = await askConfirm("Import EXE.xml?",
    `Enabled startup apps from ${$("#import-exe-xml-filename").textContent} will be added to ${settings.edition || "the current simulator profile"}. Existing apps will stay, and duplicates will be skipped.`,
    "Import", true);
  if (!accepted) return;
  const button = $("#import-exe-xml-submit");
  button.disabled = true;
  try {
    const result = await api("/api/import-exe-xml", { xml_text: importExeXmlText });
    await loadState();
    $("#export-dialog").close();
    const message = `Imported ${result.imported} startup app${result.imported === 1 ? "" : "s"}.`;
    toast(result.xml_error ? `${message} EXE.xml was not updated: ${result.xml_error}` : message,
      result.xml_error ? "warning" : "success");
  } catch (e) {
    error.textContent = e.message || "EXE.xml could not be imported.";
    error.classList.remove("hidden");
  } finally { button.disabled = !importExeXmlText; }
});
$("#import-config-submit").addEventListener("click", async () => {
  const error = $("#import-config-error");
  error.classList.add("hidden");
  if (!importConfiguration) return;
  const sourceEdition = $("#import-source-profile").value;
  const targetEdition = settings.edition || "MSFS 2024 - Microsoft Store";
  const accepted = await askConfirm("Import configuration?",
    `This will replace the startup apps and quick configurations in ${targetEdition} with the ones from ${sourceEdition}. Your simulator paths, other profiles, and app preferences will stay unchanged. Imported app paths may need updating on this PC.`,
    "Import", true);
  if (!accepted) return;
  const button = $("#import-config-submit");
  button.disabled = true;
  try {
    const result = await api("/api/import-config", { configuration: importConfiguration, source_edition: sourceEdition });
    await loadState();
    $("#export-dialog").close();
    const message = `Imported ${result.apps} app${result.apps === 1 ? "" : "s"} and ${result.quick_configs} quick configuration${result.quick_configs === 1 ? "" : "s"}.`;
    const warning = result.xml_error || result.startup_error;
    toast(warning ? `${message} ${result.xml_error ? `EXE.xml was not updated: ${result.xml_error}` : `Windows startup could not be updated: ${result.startup_error}`}` : message, warning ? "warning" : "success");
  } catch (e) {
    error.textContent = e.message || "Configuration could not be imported.";
    error.classList.remove("hidden");
  } finally { button.disabled = !importConfiguration; }
});
$("#export-files").addEventListener("click", async () => {
  const error = $("#export-error");
  error.classList.add("hidden");
  const items = [];
  if ($("#export-exe-xml").checked) items.push("exe_xml");
  if ($("#export-settings-json").checked) items.push("settings_json");
  if (!items.length) {
    error.textContent = "Select at least one file to export.";
    error.classList.remove("hidden");
    return;
  }
  const button = $("#export-files");
  button.disabled = true;
  try {
    const result = await api("/api/export", { items });
    if (!result.cancelled) {
      $("#export-dialog").close();
      toast(`Exported ${result.files.join(" and ")} to ${result.folder}.`);
    }
  } catch (e) {
    error.textContent = e.message;
    error.classList.remove("hidden");
  } finally { button.disabled = false; }
});
$("#app-form").addEventListener("submit", saveProfile);
$("#profile-name").addEventListener("input", e => {
  e.target.dataset.manuallyEdited = "true";
  $("#profile-name-error").classList.add("hidden");
});
$("#profile-path").addEventListener("input", e => {
  $("#profile-error").classList.add("hidden");
  updateSuggestedAppName(e.target.value);
  updateCloseOption(e.target.value);
});
$("#profile-timing").addEventListener("change", e => {
  if (e.target.value === "Windows starts") {
    updateCloseOption($("#profile-path").value, $("#profile-close").checked, $("#profile-unmanaged").checked);
  }
});
$("#add-quick-config").addEventListener("click", openQuickConfigDialog);
$("#quick-config-form").addEventListener("submit", saveQuickConfig);
$("#open-settings").addEventListener("click", openPreferences);
$("#pref-sim").addEventListener("change", e => { if (e.target.checked) $("#pref-windows").checked = false; });
$("#pref-windows").addEventListener("change", e => { if (e.target.checked) $("#pref-sim").checked = false; });
$("#preferences-form").addEventListener("submit", savePreferences);
$("#restore-xml").addEventListener("click", restoreXml);
$$('[data-close-dialog]').forEach(button => button.addEventListener("click", () => $("#" + button.dataset.closeDialog).close()));
$("#delete-profile").addEventListener("click", async () => {
  const id = $("#profile-id").value;
  const app = settings.apps.find(a => a.id === id);
  if (!app || !await askConfirm("Remove startup app?", `Remove ${app.name} from AutoStartFlow?`, "Remove app", true)) return;
  settings.apps = settings.apps.filter(a => a.id !== id);
  $("#app-dialog").close(); renderApps(); await syncAppChanges("App removed. exe.xml is synchronized.");
});
$("#sync-xml").addEventListener("click", syncXml);
$("#detect-paths").addEventListener("click", async () => {
  const button = $("#detect-paths");
  const label = button.querySelector("span");
  button.disabled = true;
  label.textContent = "Detecting…";
  try {
    const result = setupDraft ? await api('/api/setup/draft', {settings, detect:true}) : await api("/api/detect-simulator-locations", {});
    settings = result.settings;
    simExeExists = !!result.sim_exe_exists;
    simExeAutodetected = !!result.sim_exe_autodetected;
    xmlPathExists = !!result.xml_path_exists;
    xmlRestoreAvailable = !!result.xml_restore_available;
    fillSettings();
    const detected = [];
    if (result.sim_exe_detected) detected.push("simulator executable");
    if (result.xml_path_detected) detected.push("EXE.xml");
    if (result.xml_error) toast(`Paths detected, but EXE.xml could not be updated: ${result.xml_error}`, true);
    else toast(detected.length ? `Detected ${detected.join(" and ")}.` : "No simulator executable or EXE.xml was detected.", detected.length ? "success" : "warning");
  } catch (e) {
    toast(e.message, true);
  } finally {
    button.disabled = !!monitorState.sim_running;
    label.textContent = "Detect paths";
  }
});
$("#import-xml").addEventListener("click", importXml);
$("#monitor-toggle").addEventListener("click", toggleMonitor);
$("#addons-toggle").addEventListener("click", async () => {
  const enabled = !(settings.addons_bulk_enabled ?? settings.addons_enabled !== false);
  settings.addons_enabled = true;
  settings.addons_bulk_enabled = enabled;
  settings.apps.forEach(app => { app.enabled = enabled; });
  renderApps();
  await syncAppChanges(enabled ? "All add-ons enabled." : "All add-ons disabled.");
});
$("#window-minimize").addEventListener("click", () => api("/api/window-control", { action: "minimize" }));
$("#window-maximize").addEventListener("click", async () => {
  const currentlyMaximized = $("#window-maximize").getAttribute("aria-label") === "Restore window";
  const result = await api("/api/window-control", { action: currentlyMaximized ? "restore" : "maximize" });
  const maximized = result.maximized;
  $("#window-maximize").setAttribute("aria-label", maximized ? "Restore window" : "Maximize window");
  $("#window-maximize").dataset.tooltip = maximized ? "Restore" : "Maximize";
  $("#window-maximize").innerHTML = maximized ? icons.restore : icons.maximize;
});
$("#window-close").addEventListener("click", () => api("/api/window-control", { action: "close" }));
$("#edition").addEventListener("change", async () => {
  const edition = $("#edition").value;
  if (!await saveSettings()) {
    $("#edition").value = settings.edition;
      return;
  }
  try {
    const result = setupDraft ? await api('/api/setup/draft', {settings, edition}) : await api("/api/select-simulator", { edition });
    settings = result.settings;
    builtInPresets = result.presets || builtInPresets;
    refreshPresets();
    xmlRestoreAvailable = !!result.xml_restore_available;
    simExeExists = !!result.sim_exe_exists;
    simExeAutodetected = !!result.sim_exe_autodetected;
    xmlPathExists = !!result.xml_path_exists;
    fillSettings();
    renderApps();
    $("#edition").blur();
    toast(`${edition} profile loaded.`);
  } catch (e) {
    $("#edition").value = settings.edition;
    $("#edition").blur();
      toast(e.message, true);
  }
});
document.addEventListener("pointerdown", event => {
  const active = document.activeElement;
  if (!(active instanceof HTMLInputElement || active instanceof HTMLSelectElement)) return;
  if (!(event.target instanceof Element) || !active.contains(event.target)) active.blur();
});
document.addEventListener("change", event => {
  if (event.target instanceof HTMLSelectElement && event.target.id !== "edition") event.target.blur();
});
$("#xml-path").addEventListener("input", scheduleSave);
$("#sim-exe").addEventListener("input", scheduleSave);
$$("[data-browse]").forEach(button => button.addEventListener("click", () => browse(button.dataset.browse)));
$$('[title]').forEach(element => {
  element.dataset.tooltip = element.title;
  element.removeAttribute("title");
});
function dismissTooltip() {
  clearTimeout(tooltipTimer);
  tooltipTarget = null;
  $('#app-tooltip').classList.remove('visible');
}
document.addEventListener('click', event => {
  const target = event.target.closest('[data-tooltip]');
  if (target) dismissedTooltipTarget = target;
  dismissTooltip();
}, true);
document.addEventListener('keydown', event => {
  if (event.key === 'Tab') dismissedTooltipTarget = null;
});
$$('dialog').forEach(dialog => dialog.addEventListener('close', dismissTooltip));
document.addEventListener("pointerover", event => {
  const target = event.target.closest("[data-tooltip]");
  if (!target || target.contains(event.relatedTarget) || target === tooltipTarget) return;
  clearTimeout(tooltipTimer);
  tooltipTarget = target;
  tooltipTimer = setTimeout(() => {
    if (tooltipTarget === target && target.matches(":hover")) showTooltip(target);
  }, 450);
});
document.addEventListener("pointerout", event => {
  const target = event.target.closest("[data-tooltip]");
  if (target && !target.contains(event.relatedTarget)) {
    if (!document.querySelector("dialog[open]") && dismissedTooltipTarget === target) dismissedTooltipTarget = null;
    clearTimeout(tooltipTimer);
    if (tooltipTarget === target) tooltipTarget = null;
    $("#app-tooltip").classList.remove("visible");
  }
});
document.addEventListener("focusout", event => {
  if (event.target.closest("[data-tooltip]")) {
    clearTimeout(tooltipTimer);
    tooltipTarget = null;
    $("#app-tooltip").classList.remove("visible");
  }
});
[$("#sync-xml"), $("#xml-path-field .required-label")].forEach(target => {
  target.addEventListener("mouseenter", () => {
    clearTimeout(tooltipTimer);
    tooltipTarget = target;
    tooltipTimer = setTimeout(() => {
      if (tooltipTarget === target && target.matches(":hover")) showTooltip(target);
    }, 450);
  });
  target.addEventListener("mouseleave", () => {
    clearTimeout(tooltipTimer);
    if (tooltipTarget === target) tooltipTarget = null;
    $("#app-tooltip").classList.remove("visible");
  });
});
window.addEventListener("resize", () => {
  clearTimeout(tooltipTimer);
  tooltipTarget = null;
  $("#app-tooltip").classList.remove("visible");
});
function renderSetup() {
  document.body.classList.toggle("setup-mode", setupActive);
  $(".brand-mark img").src = setupActive ? "/assets/autostartflow-setup.svg" : "/assets/autostartflow-mark.svg";
  $(".brand-inline strong").innerHTML = setupActive ? 'AutoStart<span class="brand-flow">Flow</span> Setup' : 'AutoStart<span class="brand-flow">Flow</span>';
  document.body.dataset.setupStage = setupActive ? setupStage : "app";
  $('#update-panel').classList.toggle('hidden', !setupActive || setupStage !== 'update');
  $('#sim-settings').classList.toggle('hidden', setupActive && setupStage !== 'simulator');
  $("#installation-panel").classList.toggle("hidden", !setupActive || setupStage !== "menu");
  $("#setup-actions").classList.toggle("hidden", !setupActive || setupStage !== "simulator");
  $("#install-location-panel").classList.toggle("hidden", !setupActive || setupStage !== "simulator" || installation.msi_managed);
  if (document.activeElement !== $("#install-location")) $("#install-location").value = installDestination;
  $("#install-app").textContent = "Install";
  $("#install-app").disabled = false;
  $("#uninstall-app").disabled = !installation.installed;
  $("#preferences-dialog h2").textContent = setupActive ? "Preferences" : "AutoStartFlow settings";
  $("#save-preferences").textContent = setupActive ? "Save and open AutoStartFlow" : "Save preferences";
  $("#preferences-back").textContent = setupActive ? "Back" : "Cancel";
  
  $("#preferences-dialog .dialog-close").classList.toggle("hidden", setupActive);
  $("#preferences-dialog .xml-sync-row").classList.toggle("hidden", setupActive);
  $("#preferences-dialog .xml-restore-row").classList.toggle("hidden", setupActive);
}
async function fitSetupWindow() {
  if (!setupActive) return;
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const height = Math.ceil($(".main-content").getBoundingClientRect().height);
  await api("/api/setup/window", { stage: setupStage, height });
}
async function setSetupStage(stage) {
  setupStage = stage;
  renderSetup();
  await api("/api/setup/window", { stage });
  if (stage === "preferences") openPreferences();
  await fitSetupWindow();
}
$("#setup-next").addEventListener("click", async () => {
  const button = $("#setup-next");
  button.disabled = true;
  clearTimeout(saveTimer);
  try {
    if (!await saveSettings()) return;
    const detected = await api("/api/setup/validate", { settings, install_path: installDestination });
    if (detected.clean_warning && !cleanReplaceConfirmed) {
      if (!await askConfirm('Clean install resets your configuration', 'This replaces AutoStartFlow settings, startup profiles and custom quick configurations with a fresh setup. Existing simulator startup entries will be imported again. Choose Update instead to keep your configuration.', 'Clean install', true)) return;
      cleanReplaceConfirmed = true;
    }
    settings = detected.settings;
    await setSetupStage("preferences");
  } catch (error) { toast(error.message, true); }
  finally { button.disabled = false; }
});
$("#install-app").addEventListener("click", async () => {
  const button = $("#install-app");
  button.disabled = true;
  try {
    const draft = await api('/api/setup/draft', {settings, fresh:true});
    settings = draft.settings;
    setupDraft = true;
    cleanReplaceConfirmed = false;
    fillSettings();
    await setSetupStage("simulator");
  }
  catch (error) { toast(error.message, true); }
  finally { renderSetup(); }
});
$("#uninstall-app").addEventListener("click", async () => {
  if (!await askConfirm("Uninstall AutoStartFlow?", "Remove AutoStartFlow and its managed startup entries? Your flight apps stay installed. Your settings and backups are kept for reinstall.", "Uninstall", true)) return;
  try { await api("/api/uninstall", {}); toast("AutoStartFlow uninstalled. Closing…"); }
  catch (error) { toast(error.message, true); }
});
$("#setup-menu-back").addEventListener("click", async () => {
  setupDraft = false;
  clearTimeout(saveTimer);
  await loadState();
  await setSetupStage('menu');
});
$("#install-location").addEventListener("input", event => { installDestination = event.target.value.trim(); cleanReplaceConfirmed = false; });
$("#install-location").addEventListener("blur", event => {
  installDestination = installationFolder(event.target.value);
  event.target.value = installDestination;
});
$("#browse-install-location").addEventListener("click", async () => {
  try {
    const result = await api("/api/browse", { kind: "install", initial: installDestination });
    if (result.path) { cleanReplaceConfirmed = false; installDestination = installationFolder(result.path); $("#install-location").value = installDestination; }
  } catch (error) { toast(error.message, true); }
});
$("#preferences-back").addEventListener("click", () => {
  if (setupActive) setSetupStage("simulator").catch(error => toast(error.message, true));
});
$("#preferences-dialog").addEventListener("cancel", event => { if (setupActive) event.preventDefault(); });
loadState().then(() => { if (setupActive) fitSetupWindow().catch(() => {}); });
setInterval(poll, 2200);

async function checkUpdateLocation() {
  const revision = ++updateRequest;
  const path = $('#update-location').value.trim();
  updatePath = '';
  $('#perform-update').disabled = true;
  $('#open-updated-app').classList.add('hidden');
  $('#perform-update').classList.remove('hidden');
  $('#update-validation').textContent = path ? 'Checking installation…' : 'Select an existing installation to update.';
  if (!path) return;
  try {
    const result = await api('/api/update/check', {path});
    if (revision !== updateRequest) return;
    updatePath = result.install_path;
    $('#perform-update').disabled = !!monitorState.sim_running;
    $('#update-validation').textContent = '';
  } catch(error) {
    if (revision === updateRequest) $('#update-validation').textContent = error.message;
  }
  if (revision === updateRequest) await fitSetupWindow();
}
$('#update-app').addEventListener('click', async () => {
  setupDraft = false;
  $('#update-location').value = installation.installed ? installation.install_path : '';
  await setSetupStage('update');
  await checkUpdateLocation();
});
$('#update-location').addEventListener('input', () => {
  ++updateRequest;
  updatePath = '';
  $('#perform-update').disabled = true;
  clearTimeout(updateCheckTimer);
  updateCheckTimer = setTimeout(checkUpdateLocation, 250);
});
$('#browse-update-location').addEventListener('click', async () => {
  try {
    const result = await api('/api/browse', {kind:'update', initial:$('#update-location').value});
    if (result.path) { $('#update-location').value = result.path; await checkUpdateLocation(); }
  } catch(error) { toast(error.message, true); }
});
$('#perform-update').addEventListener('click', async () => {
  if (!updatePath || updateBusy) return;
  updateBusy = true;
  $('#perform-update').disabled = true;
  $('#browse-update-location').disabled = true;
  $('#update-location').disabled = true;
  $('#update-back').disabled = true;
  $('#update-validation').textContent = 'Updating program files…';
  try {
    await api('/api/update', {path:updatePath});
    $('#update-validation').textContent = 'AutoStartFlow updated. Your settings and exe.xml were kept.';
    $('#perform-update').classList.add('hidden');
    $('#open-updated-app').classList.remove('hidden');
  } catch(error) {
    $('#update-validation').textContent = error.message;
    $('#perform-update').disabled = false;
  } finally {
    updateBusy = false;
    $('#browse-update-location').disabled = false;
    $('#update-location').disabled = false;
    $('#update-back').disabled = false;
    await fitSetupWindow();
  }
});
$('#open-updated-app').addEventListener('click', async () => {
  try { await api('/api/update/open', {path:updatePath}); } catch(error) { toast(error.message, true); }
});
$('#update-back').addEventListener('click', async () => { await loadState(); await setSetupStage('menu'); });
