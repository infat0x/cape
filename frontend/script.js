/**
 * Automate Payload Extractor - Frontend Plugin
 * High density table UI matching Caido native interface.
 */

export const init = (sdk) => {
  console.log("[Automate Payload Extractor] Frontend initialized.");

  if (sdk.commands && typeof sdk.commands.register === "function") {
    sdk.commands.register("automate-payload-extractor.quick-copy", {
      name: "Automate: Quick Copy 200 OK Payloads",
      run: async () => {
        await quickCopyLastSuccessful(sdk);
      }
    });
  }

  if (sdk.shortcuts && typeof sdk.shortcuts.register === "function") {
    try {
      sdk.shortcuts.register("automate-payload-extractor.quick-copy", ["Control", "Shift", "C"]);
    } catch (e) {
      console.debug("[Automate Payload Extractor] Shortcut registration error:", e);
    }
  }

  const pageContainer = buildExtractorUI(sdk);
  const PAGE_PATH = "/automate-payload-extractor";

  if (sdk.navigation && typeof sdk.navigation.addPage === "function") {
    sdk.navigation.addPage(PAGE_PATH, {
      body: pageContainer
    });
  }

  if (sdk.sidebar && typeof sdk.sidebar.registerItem === "function") {
    sdk.sidebar.registerItem("Payload Extractor", PAGE_PATH, {
      icon: "fas fa-table"
    });
  }
};

async function quickCopyLastSuccessful(sdk) {
  try {
    if (!sdk.backend || typeof sdk.backend.getRuns !== "function") {
      showToast(sdk, "Backend RPC is not available.", "error");
      return;
    }

    const runs = await sdk.backend.getRuns();
    if (!runs || runs.length === 0) {
      showToast(sdk, "No Automate attack runs found.", "warning");
      return;
    }

    const latestRun = runs[0];
    const items = await sdk.backend.getRunPayloads(latestRun.id);

    const successfulPayloads = items
      .filter((r) => r.statusCode === 200 && r.payload)
      .map((r) => r.payload);

    if (successfulPayloads.length === 0) {
      showToast(sdk, "No HTTP 200 payloads found in run: " + latestRun.name, "info");
      return;
    }

    const uniqueList = Array.from(new Set(successfulPayloads));
    await navigator.clipboard.writeText(uniqueList.join("\n"));
    showToast(sdk, "Copied " + uniqueList.length + " payload(s) from " + latestRun.name, "success");
  } catch (err) {
    console.error("[Automate Payload Extractor] Quick copy failed:", err);
    showToast(sdk, "Failed to copy payloads: " + err.message, "error");
  }
}

function buildExtractorUI(sdk) {
  const root = document.createElement("div");
  root.className = "ape-app";

  let rawRequests = [];
  let filteredRequests = [];

  root.innerHTML = `
    <div class="ape-toolbar">
      <div class="ape-control-item">
        <label class="ape-label" for="ape-run-select">Run:</label>
        <select id="ape-run-select" class="ape-select" style="min-width: 220px;">
          <option value="">Loading attack runs...</option>
        </select>
      </div>

      <div class="ape-control-item">
        <label class="ape-label" for="ape-status-select">Status:</label>
        <select id="ape-status-select" class="ape-select">
          <option value="all">All Responses</option>
          <option value="200" selected>200 OK Only</option>
          <option value="2xx">2xx Success</option>
          <option value="3xx">3xx Redirects</option>
          <option value="4xx">4xx Client Errors</option>
          <option value="5xx">5xx Server Errors</option>
        </select>
      </div>

      <div class="ape-control-item">
        <input type="text" id="ape-search-input" class="ape-input" placeholder="Search payloads..." />
      </div>

      <div class="ape-control-item">
        <label class="ape-checkbox-label">
          <input type="checkbox" id="ape-dedupe-toggle" checked />
          <span>Deduplicate</span>
        </label>
      </div>

      <div class="ape-spacer"></div>

      <button id="ape-copy-btn" class="ape-btn ape-btn-primary" title="Copy visible payloads to clipboard">
        <i class="fas fa-copy"></i>
        <span>Copy Payloads</span>
      </button>

      <button id="ape-export-btn" class="ape-btn ape-btn-secondary" title="Export visible payloads as .txt wordlist">
        <i class="fas fa-download"></i>
        <span>Export .txt</span>
      </button>

      <button id="ape-refresh-btn" class="ape-btn ape-btn-secondary ape-btn-icon" title="Refresh runs">
        <i class="fas fa-sync-alt"></i>
      </button>
    </div>

    <div class="ape-table-wrapper">
      <table class="ape-table">
        <thead>
          <tr>
            <th class="col-id">ID</th>
            <th class="col-payload">Payload</th>
            <th class="col-status">Status</th>
            <th class="col-length">Length</th>
            <th class="col-time">Time (ms)</th>
            <th class="col-action">Copy</th>
          </tr>
        </thead>
        <tbody id="ape-table-body">
          <tr class="ape-empty-row">
            <td colspan="6">Loading attack runs...</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="ape-statusbar">
      <div class="ape-statusbar-left" id="ape-status-text">
        <span>0 requests</span>
      </div>
      <div class="ape-statusbar-right">
        <span><kbd class="ape-kbd">Ctrl</kbd> + <kbd class="ape-kbd">Shift</kbd> + <kbd class="ape-kbd">C</kbd> quick copy 200 OK</span>
      </div>
    </div>
  `;

  const runSelect = root.querySelector("#ape-run-select");
  const statusSelect = root.querySelector("#ape-status-select");
  const searchInput = root.querySelector("#ape-search-input");
  const dedupeToggle = root.querySelector("#ape-dedupe-toggle");
  const copyBtn = root.querySelector("#ape-copy-btn");
  const exportBtn = root.querySelector("#ape-export-btn");
  const refreshBtn = root.querySelector("#ape-refresh-btn");
  const tableBody = root.querySelector("#ape-table-body");
  const statusText = root.querySelector("#ape-status-text");

  const loadRuns = async () => {
    runSelect.innerHTML = `<option value="">Loading attack runs...</option>`;
    setTableMessage("Loading attack runs...");

    try {
      if (!sdk.backend || typeof sdk.backend.getRuns !== "function") {
        setTableMessage("Backend RPC connection unavailable. Please ensure plugin is enabled.");
        runSelect.innerHTML = `<option value="">(RPC unavailable)</option>`;
        return;
      }

      const runs = await sdk.backend.getRuns();
      runSelect.innerHTML = "";

      if (!runs || runs.length === 0) {
        runSelect.innerHTML = `<option value="">(No Automate runs found)</option>`;
        setTableMessage("No Automate attack runs found in this project.");
        updateStatusBar(0, 0, 0);
        return;
      }

      runs.forEach((run, idx) => {
        const option = document.createElement("option");
        option.value = run.id;
        option.textContent = `${run.name} (${run.sessionName})`;
        if (idx === 0) option.selected = true;
        runSelect.appendChild(option);
      });

      if (runSelect.value) {
        await loadRunRequests(runSelect.value);
      }
    } catch (err) {
      console.error("[Automate Payload Extractor] Failed to load runs:", err);
      setTableMessage("Failed to load runs: " + err.message);
    }
  };

  const loadRunRequests = async (runId) => {
    setTableMessage("Loading payloads for selected run...");
    rawRequests = [];
    filteredRequests = [];
    updateStatusBar(0, 0, 0);

    try {
      const items = await sdk.backend.getRunPayloads(runId);
      rawRequests = Array.isArray(items) ? items : [];
      applyFiltersAndRender();
    } catch (err) {
      console.error("[Automate Payload Extractor] Failed to load payloads:", err);
      setTableMessage("Failed to load payloads: " + err.message);
    }
  };

  const applyFiltersAndRender = () => {
    const selectedStatus = statusSelect.value;
    const filterQuery = (searchInput.value || "").toLowerCase().trim();
    const shouldDedupe = dedupeToggle.checked;

    let list = rawRequests.filter((item) => {
      const code = item.statusCode;

      if (selectedStatus === "200" && code !== 200) return false;
      if (selectedStatus === "2xx" && (code < 200 || code >= 300)) return false;
      if (selectedStatus === "3xx" && (code < 300 || code >= 400)) return false;
      if (selectedStatus === "4xx" && (code < 400 || code >= 500)) return false;
      if (selectedStatus === "5xx" && (code < 500 || code >= 600)) return false;

      if (filterQuery && !item.payload.toLowerCase().includes(filterQuery)) {
        return false;
      }

      return true;
    });

    if (shouldDedupe) {
      const seen = new Set();
      list = list.filter((item) => {
        if (seen.has(item.payload)) return false;
        seen.add(item.payload);
        return true;
      });
    }

    filteredRequests = list;
    const uniqueCount = new Set(filteredRequests.map((r) => r.payload)).size;
    updateStatusBar(rawRequests.length, filteredRequests.length, uniqueCount);
    renderTableRows(filteredRequests);
  };

  const renderTableRows = (items) => {
    tableBody.innerHTML = "";

    if (items.length === 0) {
      setTableMessage("No payloads matched your filter criteria.");
      return;
    }

    const fragment = document.createDocumentFragment();

    items.forEach((item) => {
      const tr = document.createElement("tr");

      const statusClass = getStatusClass(item.statusCode);
      const statusLabel = item.statusCode != null ? item.statusCode : "-";
      const lengthLabel = item.length != null ? item.length : "-";
      const timeLabel = item.roundtripTime != null ? item.roundtripTime : "-";

      tr.innerHTML = `
        <td class="col-id">${item.id}</td>
        <td class="col-payload" title="${escapeHtml(item.payload)}">${escapeHtml(item.payload)}</td>
        <td class="col-status ${statusClass}">${statusLabel}</td>
        <td class="col-length">${lengthLabel}</td>
        <td class="col-time">${timeLabel}</td>
        <td class="col-action">
          <button class="ape-row-copy-btn" title="Copy payload">
            <i class="fas fa-copy"></i>
          </button>
        </td>
      `;

      tr.addEventListener("click", () => {
        const selected = root.querySelectorAll(".ape-row-selected");
        selected.forEach((el) => el.classList.remove("ape-row-selected"));
        tr.classList.add("ape-row-selected");
      });

      tr.addEventListener("dblclick", async () => {
        await navigator.clipboard.writeText(item.payload);
        showToast(sdk, `Copied "${item.payload}" to clipboard.`, "success");
      });

      const copyIconBtn = tr.querySelector(".ape-row-copy-btn");
      copyIconBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        await navigator.clipboard.writeText(item.payload);
        showToast(sdk, `Copied "${item.payload}" to clipboard.`, "success");
      });

      fragment.appendChild(tr);
    });

    tableBody.appendChild(fragment);
  };

  const setTableMessage = (msg) => {
    tableBody.innerHTML = `
      <tr class="ape-empty-row">
        <td colspan="6">${escapeHtml(msg)}</td>
      </tr>
    `;
  };

  const updateStatusBar = (total, filtered, unique) => {
    if (total === 0) {
      statusText.innerHTML = `<span>0 requests</span>`;
      return;
    }

    statusText.innerHTML = `
      <span>${filtered} requests (filtered from ${total})</span>
      <span style="opacity: 0.5;">|</span>
      <span>${unique} unique payloads</span>
    `;
  };

  // Event handlers
  runSelect.addEventListener("change", () => {
    if (runSelect.value) {
      loadRunRequests(runSelect.value);
    }
  });

  statusSelect.addEventListener("change", applyFiltersAndRender);
  searchInput.addEventListener("input", applyFiltersAndRender);
  dedupeToggle.addEventListener("change", applyFiltersAndRender);
  refreshBtn.addEventListener("click", loadRuns);

  copyBtn.addEventListener("click", async () => {
    if (filteredRequests.length === 0) {
      showToast(sdk, "No payloads to copy.", "warning");
      return;
    }

    const payloadText = filteredRequests.map((r) => r.payload).join("\n");
    await navigator.clipboard.writeText(payloadText);
    showToast(sdk, `Copied ${filteredRequests.length} payload(s) to clipboard.`, "success");
  });

  exportBtn.addEventListener("click", () => {
    if (filteredRequests.length === 0) {
      showToast(sdk, "No payloads to export.", "warning");
      return;
    }

    const payloadText = filteredRequests.map((r) => r.payload).join("\n");
    const blob = new Blob([payloadText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `caido-payloads-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(sdk, "Saved wordlist to file.", "success");
  });

  loadRuns();
  return root;
}

function getStatusClass(code) {
  if (code == null) return "status-none";
  if (code === 200) return "status-200";
  if (code >= 200 && code < 300) return "status-2xx";
  if (code >= 300 && code < 400) return "status-3xx";
  if (code >= 400 && code < 500) return "status-4xx";
  if (code >= 500) return "status-5xx";
  return "status-none";
}

function showToast(sdk, message, variant = "info") {
  if (sdk.window && typeof sdk.window.showToast === "function") {
    sdk.window.showToast(message, { variant });
  } else {
    console.log(`[Toast ${variant}] ${message}`);
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
