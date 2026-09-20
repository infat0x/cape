/**
 * Automate Payload Extractor - Frontend Plugin
 * High-density split-pane interface styled strictly after Caido's native UI.
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
  let selectedItem = null;
  let activeStatusFilter = "200";

  root.innerHTML = `
    <!-- Top Bar -->
    <div class="ape-toolbar">
      <div class="ape-control-item">
        <label class="ape-label" for="ape-run-select">Run:</label>
        <select id="ape-run-select" class="ape-select">
          <option value="">Loading attack runs...</option>
        </select>
      </div>

      <div class="ape-search-wrapper">
        <i class="fas fa-search ape-search-icon"></i>
        <input type="text" id="ape-search-input" class="ape-search-input" placeholder="Filter payloads or queries..." />
      </div>

      <div class="ape-spacer"></div>

      <button id="ape-copy-btn" class="ape-btn ape-btn-primary" title="Copy filtered payloads to clipboard">
        <i class="fas fa-copy"></i>
        <span>Copy Payloads</span>
      </button>

      <button id="ape-export-btn" class="ape-btn ape-btn-secondary" title="Export filtered payloads as .txt wordlist">
        <i class="fas fa-download"></i>
        <span>Export .txt</span>
      </button>

      <button id="ape-refresh-btn" class="ape-btn ape-btn-secondary ape-btn-icon" title="Refresh runs">
        <i class="fas fa-sync-alt"></i>
      </button>
    </div>

    <!-- Applied Filters Bar -->
    <div class="ape-filters-bar">
      <span class="ape-filters-label">Status:</span>
      <button class="ape-filter-chip" data-status="all">All</button>
      <button class="ape-filter-chip chip-200 active" data-status="200">200 OK</button>
      <button class="ape-filter-chip chip-200" data-status="2xx">2XX</button>
      <button class="ape-filter-chip chip-3xx" data-status="3xx">3XX</button>
      <button class="ape-filter-chip chip-4xx" data-status="4xx">4XX</button>
      <button class="ape-filter-chip chip-4xx" data-status="5xx">5XX</button>

      <div class="ape-filter-sep"></div>

      <label class="ape-checkbox-chip">
        <input type="checkbox" id="ape-dedupe-toggle" checked />
        <span>Deduplicate</span>
      </label>
    </div>

    <!-- Master-Detail Workspace -->
    <div class="ape-workspace">
      <!-- Upper: Payloads Table -->
      <div class="ape-table-pane" id="ape-table-pane">
        <table class="ape-table">
          <thead>
            <tr>
              <th class="col-id">ID</th>
              <th class="col-method">Method</th>
              <th class="col-path">Path & Query</th>
              <th class="col-payload">Payload</th>
              <th class="col-status">Status</th>
              <th class="col-length">Length</th>
              <th class="col-time">Response Time (ms)</th>
              <th class="col-action">Copy</th>
            </tr>
          </thead>
          <tbody id="ape-table-body">
            <tr>
              <td colspan="8" class="ape-empty-message">Loading attack runs...</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Resizable Splitter Divider -->
      <div class="ape-splitter" id="ape-splitter" title="Drag to resize detail pane"></div>

      <!-- Lower: Master-Detail Inspector Pane -->
      <div class="ape-detail-pane" id="ape-detail-pane">
        <div id="ape-detail-inner" style="height: 100%; display: flex; flex-direction: column;">
          <div class="ape-empty-detail">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2m-6 0h6"/>
            </svg>
            <span style="font-size: 13px; font-weight: 500;">No payload selected</span>
            <span style="font-size: 11px; color: var(--caido-text-dim);">Select a request from the table above to inspect details.</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Bottom Status Bar -->
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
  const searchInput = root.querySelector("#ape-search-input");
  const dedupeToggle = root.querySelector("#ape-dedupe-toggle");
  const copyBtn = root.querySelector("#ape-copy-btn");
  const exportBtn = root.querySelector("#ape-export-btn");
  const refreshBtn = root.querySelector("#ape-refresh-btn");
  const tableBody = root.querySelector("#ape-table-body");
  const statusText = root.querySelector("#ape-status-text");
  const detailInner = root.querySelector("#ape-detail-inner");
  const splitter = root.querySelector("#ape-splitter");
  const detailPane = root.querySelector("#ape-detail-pane");
  const filterChips = root.querySelectorAll(".ape-filter-chip");

  // Load runs
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
        renderEmptyDetail();
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
    selectedItem = null;
    renderEmptyDetail();
    updateStatusBar(0, 0, 0);

    try {
      const items = await sdk.backend.getRunPayloads(runId);
      rawRequests = Array.isArray(items) ? items : [];
      applyFiltersAndRender();
      if (filteredRequests.length > 0) {
        selectItem(filteredRequests[0]);
      }
    } catch (err) {
      console.error("[Automate Payload Extractor] Failed to load payloads:", err);
      setTableMessage("Failed to load payloads: " + err.message);
    }
  };

  const applyFiltersAndRender = () => {
    const filterQuery = (searchInput.value || "").toLowerCase().trim();
    const shouldDedupe = dedupeToggle.checked;

    let list = rawRequests.filter((item) => {
      const code = item.statusCode;

      if (activeStatusFilter === "200" && code !== 200) return false;
      if (activeStatusFilter === "2xx" && (code < 200 || code >= 300)) return false;
      if (activeStatusFilter === "3xx" && (code < 300 || code >= 400)) return false;
      if (activeStatusFilter === "4xx" && (code < 400 || code >= 500)) return false;
      if (activeStatusFilter === "5xx" && (code < 500 || code >= 600)) return false;

      if (filterQuery) {
        const matchPayload = item.payload && item.payload.toLowerCase().includes(filterQuery);
        const matchPath = item.path && item.path.toLowerCase().includes(filterQuery);
        const matchQuery = item.query && item.query.toLowerCase().includes(filterQuery);
        if (!matchPayload && !matchPath && !matchQuery) {
          return false;
        }
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

    if (selectedItem && !filteredRequests.some((r) => r.id === selectedItem.id)) {
      if (filteredRequests.length > 0) {
        selectItem(filteredRequests[0]);
      } else {
        selectedItem = null;
        renderEmptyDetail();
      }
    }
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
      if (selectedItem && selectedItem.id === item.id) {
        tr.classList.add("ape-selected-row");
      }

      const methodClass = item.method === "POST" ? "method-post" : "method-get";
      const statusClass = getStatusClass(item.statusCode);
      const statusLabel = item.statusCode != null ? item.statusCode : "-";
      const lengthLabel = item.length != null ? item.length : "-";
      const timeLabel = item.roundtripTime != null ? item.roundtripTime : "-";
      const fullPath = item.path + (item.query ? `?${item.query}` : "");

      tr.innerHTML = `
        <td class="col-id">${item.id}</td>
        <td class="col-method ${methodClass}">${escapeHtml(item.method)}</td>
        <td class="col-path" title="${escapeHtml(fullPath)}">${escapeHtml(fullPath)}</td>
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
        selectItem(item);
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

  const selectItem = (item) => {
    selectedItem = item;

    const rows = tableBody.querySelectorAll("tr");
    rows.forEach((r, idx) => {
      if (filteredRequests[idx] && filteredRequests[idx].id === item.id) {
        r.classList.add("ape-selected-row");
      } else {
        r.classList.remove("ape-selected-row");
      }
    });

    renderDetailView(item);
  };

  const renderDetailView = (item) => {
    const isPost = item.method === "POST";
    const methodBadgeClass = isPost ? "badge-post" : "badge-get";
    const is200 = item.statusCode === 200;
    const isErr = item.statusCode >= 400;
    const statusBadgeClass = is200 ? "badge-status-200" : (isErr ? "badge-status-err" : "badge-status-other");
    const statusLabel = item.statusCode != null ? `${item.statusCode}` : "-";
    const fullPath = item.path + (item.query ? `?${item.query}` : "");
    const hostHeader = item.host || "target";

    const httpRequestRaw = `${item.method} ${fullPath} HTTP/1.1\nHost: ${hostHeader}\nUser-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64)\nAccept: */*\nConnection: close`;

    const payloadHtml = formatHighlightedPayload(item.payload);
    const requestHtml = formatHighlightedHttpRequest(
      item.method,
      item.path,
      item.query,
      hostHeader,
      item.statusCode,
      item.length,
      item.roundtripTime
    );

    detailInner.innerHTML = `
      <div class="ape-detail-header">
        <span class="ape-badge ${methodBadgeClass}">${escapeHtml(item.method)}</span>
        <span class="ape-badge ${statusBadgeClass}">${escapeHtml(statusLabel)}</span>
        <span class="ape-detail-title" title="ID: ${item.id} - ${escapeHtml(item.payload)}">
          ID: ${item.id} &bull; ${escapeHtml(item.payload)}
        </span>

        <span class="ape-detail-meta">
          ${item.length != null ? item.length + " bytes" : ""} ${item.roundtripTime != null ? " &bull; " + item.roundtripTime + "ms" : ""}
        </span>

        <button id="ape-copy-single-payload" class="ape-btn ape-btn-secondary" style="height: 22px; font-size: 11px; padding: 0 7px;" title="Copy payload value">
          <i class="fas fa-copy"></i>
          <span>Copy Payload</span>
        </button>

        <button id="ape-copy-single-request" class="ape-btn ape-btn-secondary" style="height: 22px; font-size: 11px; padding: 0 7px;" title="Copy reconstructed HTTP request">
          <i class="fas fa-file-code"></i>
          <span>Copy Request</span>
        </button>
      </div>

      <div class="ape-detail-content">
        <!-- Column 1: Payload Inspector -->
        <div class="ape-detail-column">
          <div class="ape-detail-column-header">
            <span>Extracted Payload (${item.payload.length} chars)</span>
            <span style="font-size: 10px; font-family: var(--caido-font-mono); opacity: 0.6;">UTF-8</span>
          </div>
          ${payloadHtml}
        </div>

        <!-- Column 2: Reconstructed HTTP Request Preview -->
        <div class="ape-detail-column">
          <div class="ape-detail-column-header">
            <span>HTTP Request Preview</span>
            <span style="font-size: 10px; font-family: var(--caido-font-mono); opacity: 0.6;">${escapeHtml(item.method)}</span>
          </div>
          ${requestHtml}
        </div>
      </div>
    `;

    detailInner.querySelector("#ape-copy-single-payload").addEventListener("click", async () => {
      await navigator.clipboard.writeText(item.payload);
      showToast(sdk, `Copied "${item.payload}" to clipboard.`, "success");
    });

    detailInner.querySelector("#ape-copy-single-request").addEventListener("click", async () => {
      await navigator.clipboard.writeText(httpRequestRaw);
      showToast(sdk, "Copied HTTP request to clipboard.", "success");
    });
  };

  const renderEmptyDetail = () => {
    detailInner.innerHTML = `
      <div class="ape-empty-detail">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2m-6 0h6"/>
        </svg>
        <span style="font-size: 13px; font-weight: 500;">No payload selected</span>
        <span style="font-size: 11px; color: var(--caido-text-dim);">Select a request from the table above to inspect details.</span>
      </div>
    `;
  };

  const setTableMessage = (msg) => {
    tableBody.innerHTML = `
      <tr>
        <td colspan="8" class="ape-empty-message">${escapeHtml(msg)}</td>
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
      <span style="opacity: 0.4;">|</span>
      <span>${unique} unique payloads</span>
    `;
  };

  // Filter chips click handling
  filterChips.forEach((chip) => {
    chip.addEventListener("click", () => {
      filterChips.forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      activeStatusFilter = chip.getAttribute("data-status");
      applyFiltersAndRender();
    });
  });

  // Splitter drag to resize
  let isDragging = false;
  let startY = 0;
  let startHeight = 220;

  splitter.addEventListener("mousedown", (e) => {
    isDragging = true;
    startY = e.clientY;
    startHeight = detailPane.offsetHeight;
    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";
  });

  document.addEventListener("mousemove", (e) => {
    if (!isDragging) return;
    const deltaY = startY - e.clientY;
    const newHeight = Math.max(80, Math.min(600, startHeight + deltaY));
    detailPane.style.height = `${newHeight}px`;
  });

  document.addEventListener("mouseup", () => {
    if (isDragging) {
      isDragging = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }
  });

  // Controls events
  runSelect.addEventListener("change", () => {
    if (runSelect.value) {
      loadRunRequests(runSelect.value);
    }
  });

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
  if (code >= 300 && code < 400) return "status-300";
  if (code >= 400 && code < 500) return "status-400";
  if (code >= 500) return "status-500";
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

function formatHighlightedPayload(payload) {
  const lines = String(payload).split("\n");
  let html = `<div class="caido-code-editor">`;
  lines.forEach((line, idx) => {
    const lineNum = idx + 1;
    html += `
      <div class="caido-editor-line">
        <span class="caido-line-num">${lineNum}</span>
        <span class="caido-line-content">
          <span class="hl-payload-badge">${escapeHtml(line)}</span>
        </span>
      </div>`;
  });
  html += `</div>`;
  return html;
}

function formatHighlightedHttpRequest(method, path, query, host, statusCode, length, time) {
  const fullPath = path + (query ? `?${query}` : "");
  const lines = [
    { type: "req", method: method || "GET", path: fullPath || "/", proto: "HTTP/1.1" },
    { type: "header", key: "Host", val: host || "target" },
    { type: "header", key: "User-Agent", val: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
    { type: "header", key: "Accept", val: "*/*" },
    { type: "header", key: "Connection", val: "close" }
  ];

  if (statusCode != null) {
    lines.push({ type: "separator" });
    lines.push({ type: "resp", proto: "HTTP/1.1", status: statusCode, phrase: statusCode === 200 ? "OK" : "" });
    if (length != null) {
      lines.push({ type: "header", key: "Content-Length", val: String(length) });
    }
    if (time != null) {
      lines.push({ type: "header", key: "Response-Time", val: `${time}ms` });
    }
  }

  let html = `<div class="caido-code-editor">`;
  let lineCounter = 1;

  lines.forEach((line) => {
    if (line.type === "req") {
      html += `
        <div class="caido-editor-line">
          <span class="caido-line-num">${lineCounter++}</span>
          <span class="caido-line-content">
            <span class="hl-method">${escapeHtml(line.method)}</span> <span class="hl-path">${escapeHtml(line.path)}</span> <span class="hl-proto">${escapeHtml(line.proto)}</span>
          </span>
        </div>`;
    } else if (line.type === "header") {
      html += `
        <div class="caido-editor-line">
          <span class="caido-line-num">${lineCounter++}</span>
          <span class="caido-line-content">
            <span class="hl-header-key">${escapeHtml(line.key)}:</span> <span class="hl-header-val">${escapeHtml(line.val)}</span>
          </span>
        </div>`;
    } else if (line.type === "separator") {
      html += `
        <div class="caido-editor-line">
          <span class="caido-line-num">${lineCounter++}</span>
          <span class="caido-line-content"></span>
        </div>`;
    } else if (line.type === "resp") {
      const statusColorClass = line.status === 200 ? "status-200" : (line.status >= 400 ? "status-400" : "status-300");
      html += `
        <div class="caido-editor-line">
          <span class="caido-line-num">${lineCounter++}</span>
          <span class="caido-line-content">
            <span class="hl-proto">${escapeHtml(line.proto)}</span> <span class="${statusColorClass}" style="font-weight: 600;">${escapeHtml(String(line.status))}</span> <span class="hl-method">${escapeHtml(line.phrase)}</span>
          </span>
        </div>`;
    }
  });

  html += `</div>`;
  return html;
}

