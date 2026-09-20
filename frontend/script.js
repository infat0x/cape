/**
 * Automate Payload Extractor - Frontend Plugin
 * High-density UI strictly replicating Caido's native Automate Master-Detail layout.
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
  let sortColumn = "id";
  let sortDirection = "desc";
  let reqMode = "pretty";
  let respMode = "pretty";

  root.innerHTML = `
    <!-- Top Bar (Single compact toolbar matching Caido style) -->
    <div class="ape-toolbar">
      <div class="ape-control-item">
        <label class="ape-label" for="ape-run-select">Run:</label>
        <select id="ape-run-select" class="ape-select" style="min-width: 190px;">
          <option value="">Loading attack runs...</option>
        </select>
      </div>

      <div class="ape-control-item">
        <label class="ape-label">Status:</label>
        <div class="ape-dropdown-wrapper" id="ape-status-dropdown-wrap">
          <button type="button" class="ape-dropdown-trigger status-val-200" id="ape-status-btn" title="Filter by HTTP Status">
            <span style="display: inline-flex; align-items: center; gap: 6px;">
              <span class="ape-status-dot status-dot-200" id="ape-status-btn-dot">●</span>
              <span class="ape-dropdown-text status-text-200" id="ape-status-btn-text">200 OK</span>
            </span>
            <i class="fas fa-chevron-down ape-dropdown-chevron"></i>
          </button>
          <div class="ape-dropdown-menu" id="ape-status-menu">
            <div class="ape-dropdown-item" data-value="all">
              <span class="ape-status-dot status-dot-all">○</span>
              <span class="ape-dropdown-item-text status-text-all">All</span>
            </div>
            <div class="ape-dropdown-item active" data-value="200">
              <span class="ape-status-dot status-dot-200">●</span>
              <span class="ape-dropdown-item-text status-text-200">200 OK</span>
            </div>
            <div class="ape-dropdown-item" data-value="2xx">
              <span class="ape-status-dot status-dot-2xx">●</span>
              <span class="ape-dropdown-item-text status-text-2xx">2XX</span>
            </div>
            <div class="ape-dropdown-item" data-value="3xx">
              <span class="ape-status-dot status-dot-3xx">●</span>
              <span class="ape-dropdown-item-text status-text-3xx">3XX</span>
            </div>
            <div class="ape-dropdown-item" data-value="4xx">
              <span class="ape-status-dot status-dot-4xx">●</span>
              <span class="ape-dropdown-item-text status-text-4xx">4XX</span>
            </div>
            <div class="ape-dropdown-item" data-value="5xx">
              <span class="ape-status-dot status-dot-5xx">●</span>
              <span class="ape-dropdown-item-text status-text-5xx">5XX</span>
            </div>
          </div>
        </div>
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

      <label class="ape-checkbox-chip" title="Remove duplicate payload values">
        <input type="checkbox" id="ape-dedupe-toggle" checked />
        <span>Deduplicate</span>
      </label>

      <button id="ape-refresh-btn" class="ape-btn ape-btn-secondary ape-btn-icon" title="Refresh attack runs">
        <i class="fas fa-sync-alt"></i>
      </button>
    </div>

    <!-- Workspace -->
    <div class="ape-workspace">
      <!-- Upper: Payloads Table (Exact 6 columns as Caido Automate) -->
      <div class="ape-table-pane" id="ape-table-pane" tabindex="0">
        <table class="ape-table">
          <thead>
            <tr>
              <th class="col-id" data-col="id">ID <span id="sort-arrow-id">▼</span><div class="ape-col-resizer" title="Drag to resize"></div></th>
              <th class="col-payload" data-col="payload">Payload 1 <span id="sort-arrow-payload"></span><div class="ape-col-resizer" title="Drag to resize"></div></th>
              <th class="col-status" data-col="status">Status <span id="sort-arrow-status"></span><div class="ape-col-resizer" title="Drag to resize"></div></th>
              <th class="col-length" data-col="length">Length <span id="sort-arrow-length"></span><div class="ape-col-resizer" title="Drag to resize"></div></th>
              <th class="col-time" data-col="time">Round-trip Time (ms) <span id="sort-arrow-time"></span><div class="ape-col-resizer" title="Drag to resize"></div></th>
              <th class="col-sent" data-col="sent">Request Sent At <span id="sort-arrow-sent"></span><div class="ape-col-resizer" title="Drag to resize"></div></th>
              <th class="col-filler"></th>
            </tr>
          </thead>
          <tbody id="ape-table-body">
            <tr>
              <td colspan="7" class="ape-empty-message">Loading attack runs...</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Sub-table Bar (Right above split pane, as in Caido) -->
      <div class="ape-subtable-bar">
        <div class="ape-subtable-left">
          <span id="ape-req-count">0 requests</span>
          <span style="opacity: 0.35;">|</span>
          <span id="ape-unique-count">0 unique payloads</span>
        </div>
        <div class="ape-subtable-right">
          <button id="ape-reset-btn" class="ape-btn-text" title="Reset filters to 200 OK">Reset preference</button>
        </div>
      </div>

      <!-- Resizable Splitter Divider -->
      <div class="ape-splitter" id="ape-splitter" title="Drag to resize detail pane"></div>

      <!-- Lower: Side-by-Side Request & Response Panels -->
      <div class="ape-detail-pane" id="ape-detail-pane">
        <!-- Left: Request Panel -->
        <div class="ape-pane-column" id="ape-req-column">
          <div class="ape-pane-header">
            <span class="ape-pane-title">Request</span>
            <div class="ape-toggle-group" id="ape-req-toggle-group">
              <button class="ape-toggle-btn active" data-mode="pretty">Pretty</button>
              <button class="ape-toggle-btn" data-mode="raw">Raw</button>
            </div>
          </div>
          <div class="ape-code-viewer" id="ape-req-viewer">
            <div class="ape-empty-detail">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2m-6 0h6"/>
              </svg>
              <span>Select a request to inspect</span>
            </div>
          </div>
        </div>

        <!-- Right: Response Panel -->
        <div class="ape-pane-column" id="ape-resp-column">
          <div class="ape-pane-header">
            <span class="ape-pane-title">Response</span>
            <div class="ape-toggle-group" id="ape-resp-toggle-group">
              <button class="ape-toggle-btn active" data-mode="pretty">Pretty</button>
              <button class="ape-toggle-btn" data-mode="raw">Raw</button>
              <button class="ape-toggle-btn" data-mode="preview">Preview</button>
            </div>
          </div>
          <div class="ape-code-viewer" id="ape-resp-viewer">
            <div class="ape-empty-detail">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2m-6 0h6"/>
              </svg>
              <span>No response selected</span>
            </div>
          </div>
          <div class="ape-pane-metric-bar" id="ape-resp-metric">
            0 bytes | 0ms
          </div>
        </div>
      </div>
    </div>
  `;

  let activeStatus = "200";

  const runSelect = root.querySelector("#ape-run-select");
  const statusDropdownWrap = root.querySelector("#ape-status-dropdown-wrap");
  const statusBtn = root.querySelector("#ape-status-btn");
  const statusBtnDot = root.querySelector("#ape-status-btn-dot");
  const statusBtnText = root.querySelector("#ape-status-btn-text");
  const statusMenuItems = root.querySelectorAll("#ape-status-menu .ape-dropdown-item");

  const statusConfigs = {
    "all": { label: "All", dotClass: "status-dot-all", textClass: "status-text-all", valClass: "status-val-all", dot: "○" },
    "200": { label: "200 OK", dotClass: "status-dot-200", textClass: "status-text-200", valClass: "status-val-200", dot: "●" },
    "2xx": { label: "2XX", dotClass: "status-dot-2xx", textClass: "status-text-2xx", valClass: "status-val-2xx", dot: "●" },
    "3xx": { label: "3XX", dotClass: "status-dot-3xx", textClass: "status-text-3xx", valClass: "status-val-3xx", dot: "●" },
    "4xx": { label: "4XX", dotClass: "status-dot-4xx", textClass: "status-text-4xx", valClass: "status-val-4xx", dot: "●" },
    "5xx": { label: "5XX", dotClass: "status-dot-5xx", textClass: "status-text-5xx", valClass: "status-val-5xx", dot: "●" }
  };

  const setStatus = (statusKey, triggerRender = true) => {
    activeStatus = statusKey;
    const cfg = statusConfigs[statusKey] || statusConfigs["all"];

    ["status-val-all", "status-val-200", "status-val-2xx", "status-val-3xx", "status-val-4xx", "status-val-5xx"].forEach((cls) => {
      statusBtn.classList.remove(cls);
    });
    statusBtn.classList.add(cfg.valClass);

    statusBtnDot.className = `ape-status-dot ${cfg.dotClass}`;
    statusBtnDot.textContent = cfg.dot;
    statusBtnText.className = `ape-dropdown-text ${cfg.textClass}`;
    statusBtnText.textContent = cfg.label;

    statusMenuItems.forEach((item) => {
      if (item.getAttribute("data-value") === statusKey) {
        item.classList.add("active");
      } else {
        item.classList.remove("active");
      }
    });

    if (triggerRender) {
      applyFiltersAndRender();
    }
  };

  const searchInput = root.querySelector("#ape-search-input");
  const dedupeToggle = root.querySelector("#ape-dedupe-toggle");
  const copyBtn = root.querySelector("#ape-copy-btn");
  const exportBtn = root.querySelector("#ape-export-btn");
  const refreshBtn = root.querySelector("#ape-refresh-btn");
  const resetBtn = root.querySelector("#ape-reset-btn");

  const tablePane = root.querySelector("#ape-table-pane");
  const tableBody = root.querySelector("#ape-table-body");
  const reqCountEl = root.querySelector("#ape-req-count");
  const uniqueCountEl = root.querySelector("#ape-unique-count");

  const splitter = root.querySelector("#ape-splitter");
  const detailPane = root.querySelector("#ape-detail-pane");

  const reqViewer = root.querySelector("#ape-req-viewer");
  const respViewer = root.querySelector("#ape-resp-viewer");
  const respMetric = root.querySelector("#ape-resp-metric");

  const reqToggleBtns = root.querySelectorAll("#ape-req-toggle-group .ape-toggle-btn");
  const respToggleBtns = root.querySelectorAll("#ape-resp-toggle-group .ape-toggle-btn");

  const sortHeaders = root.querySelectorAll(".ape-table th[data-col]");

  // Load available attack runs
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
        updateCounts(0, 0, 0);
        renderEmptyDetails();
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
    renderEmptyDetails();
    updateCounts(0, 0, 0);

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

      if (activeStatus === "200" && code !== 200) return false;
      if (activeStatus === "2xx" && (code < 200 || code >= 300)) return false;
      if (activeStatus === "3xx" && (code < 300 || code >= 400)) return false;
      if (activeStatus === "4xx" && (code < 400 || code >= 500)) return false;
      if (activeStatus === "5xx" && (code < 500 || code >= 600)) return false;

      if (filterQuery) {
        const matchPayload = item.payload && item.payload.toLowerCase().includes(filterQuery);
        const matchReq = item.rawRequest && item.rawRequest.toLowerCase().includes(filterQuery);
        const matchResp = item.rawResponse && item.rawResponse.toLowerCase().includes(filterQuery);
        const matchId = String(item.id).includes(filterQuery);
        const matchStatus = String(item.statusCode).includes(filterQuery);
        if (!matchPayload && !matchReq && !matchResp && !matchId && !matchStatus) {
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

    // Sort list
    list.sort((a, b) => {
      let valA = a[sortColumn];
      let valB = b[sortColumn];

      if (sortColumn === "sent") {
        valA = Number(a.createdAt || 0);
        valB = Number(b.createdAt || 0);
      } else if (sortColumn === "time") {
        valA = Number(a.roundtripTime || 0);
        valB = Number(b.roundtripTime || 0);
      } else if (sortColumn === "status") {
        valA = Number(a.statusCode || 0);
        valB = Number(b.statusCode || 0);
      } else if (sortColumn === "length") {
        valA = Number(a.length || 0);
        valB = Number(b.length || 0);
      } else if (sortColumn === "id") {
        valA = Number(a.id || 0);
        valB = Number(b.id || 0);
      } else if (typeof valA === "string") {
        return sortDirection === "asc"
          ? valA.localeCompare(valB)
          : valB.localeCompare(valA);
      }

      return sortDirection === "asc" ? valA - valB : valB - valA;
    });

    filteredRequests = list;
    const uniqueCount = new Set(filteredRequests.map((r) => r.payload)).size;
    updateCounts(rawRequests.length, filteredRequests.length, uniqueCount);
    renderTableRows(filteredRequests);

    if (selectedItem && !filteredRequests.some((r) => r.id === selectedItem.id)) {
      if (filteredRequests.length > 0) {
        selectItem(filteredRequests[0]);
      } else {
        selectedItem = null;
        renderEmptyDetails();
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
      tr.setAttribute("data-id", item.id);
      if (selectedItem && selectedItem.id === item.id) {
        tr.classList.add("ape-selected-row");
      }

      const statusClass = getStatusClass(item.statusCode);
      const statusLabel = item.statusCode != null ? item.statusCode : "-";
      const lengthLabel = item.length != null ? item.length : "-";
      const timeLabel = item.roundtripTime != null ? item.roundtripTime : "-";
      const sentLabel = formatTimestamp(item.createdAt);

      tr.innerHTML = `
        <td class="col-id">${item.id}</td>
        <td class="col-payload" title="${escapeHtml(item.payload)}">${escapeHtml(item.payload)}</td>
        <td class="col-status ${statusClass}">${statusLabel}</td>
        <td class="col-length">${lengthLabel}</td>
        <td class="col-time">${timeLabel}</td>
        <td class="col-sent">${sentLabel}</td>
        <td class="col-filler"></td>
      `;

      tr.addEventListener("click", () => {
        selectItem(item);
      });

      tr.addEventListener("dblclick", async () => {
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
    rows.forEach((r) => {
      const rowId = Number(r.getAttribute("data-id"));
      if (rowId === item.id) {
        r.classList.add("ape-selected-row");
      } else {
        r.classList.remove("ape-selected-row");
      }
    });

    renderPanels(item);
  };

  const renderPanels = (item) => {
    if (!item) {
      renderEmptyDetails();
      return;
    }

    // Render Request
    if (reqMode === "pretty") {
      reqViewer.innerHTML = formatHighlightedRequest(item.rawRequest, item.payload);
    } else {
      reqViewer.innerHTML = formatRawCode(item.rawRequest);
    }

    // Render Response
    if (respMode === "pretty") {
      respViewer.innerHTML = formatHighlightedResponse(item.rawResponse);
    } else if (respMode === "raw") {
      respViewer.innerHTML = formatRawCode(item.rawResponse);
    } else {
      // Preview mode (if HTML, show iframe or clean formatted view)
      respViewer.innerHTML = formatPreviewResponse(item.rawResponse);
    }

    // Metrics bar
    const len = item.length != null ? `${item.length} bytes` : "-";
    const rtt = item.roundtripTime != null ? `${item.roundtripTime}ms` : "-";
    respMetric.textContent = `${len} | ${rtt}`;
  };

  const renderEmptyDetails = () => {
    reqViewer.innerHTML = `
      <div class="ape-empty-detail">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2m-6 0h6"/>
        </svg>
        <span>No request selected</span>
      </div>
    `;
    respViewer.innerHTML = `
      <div class="ape-empty-detail">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2m-6 0h6"/>
        </svg>
        <span>No response selected</span>
      </div>
    `;
    respMetric.textContent = "0 bytes | 0ms";
  };

  const setTableMessage = (msg) => {
    tableBody.innerHTML = `
      <tr>
        <td colspan="7" class="ape-empty-message">${escapeHtml(msg)}</td>
      </tr>
    `;
  };

  const updateCounts = (total, filtered, unique) => {
    if (total === 0) {
      reqCountEl.textContent = "0 requests";
      uniqueCountEl.textContent = "0 unique payloads";
      return;
    }

    if (total === filtered) {
      reqCountEl.textContent = `${total} requests`;
    } else {
      reqCountEl.textContent = `${filtered} requests (filtered from ${total})`;
    }
    uniqueCountEl.textContent = `${unique} unique payloads`;
  };

  // Sort click handling
  sortHeaders.forEach((th) => {
    th.addEventListener("click", (e) => {
      if (e.target && e.target.classList.contains("ape-col-resizer")) return;

      const col = th.getAttribute("data-col");
      if (sortColumn === col) {
        sortDirection = sortDirection === "asc" ? "desc" : "asc";
      } else {
        sortColumn = col;
        sortDirection = col === "id" ? "desc" : "asc";
      }

      // Update arrows
      ["id", "payload", "status", "length", "time", "sent"].forEach((c) => {
        const arrowEl = root.querySelector(`#sort-arrow-${c}`);
        if (arrowEl) {
          if (c === sortColumn) {
            arrowEl.textContent = sortDirection === "asc" ? "▲" : "▼";
          } else {
            arrowEl.textContent = "";
          }
        }
      });

      applyFiltersAndRender();
    });
  });

  // Dynamic column width resizing
  const initColumnResizing = () => {
    const resizers = root.querySelectorAll(".ape-col-resizer");

    try {
      const saved = JSON.parse(localStorage.getItem("caido_ape_col_widths") || "{}");
      Object.keys(saved).forEach((colKey) => {
        const th = root.querySelector(`th[data-col="${colKey}"]`);
        if (th && saved[colKey]) {
          th.style.width = `${saved[colKey]}px`;
        }
      });
    } catch (e) {
      console.debug("Failed to load saved column widths", e);
    }

    resizers.forEach((resizer) => {
      resizer.addEventListener("click", (e) => {
        e.stopPropagation();
      });

      resizer.addEventListener("mousedown", (e) => {
        e.preventDefault();
        e.stopPropagation();

        const th = resizer.parentElement;
        const colKey = th.getAttribute("data-col");
        const startX = e.clientX;
        const startWidth = th.offsetWidth;

        resizer.classList.add("resizing");
        document.body.style.cursor = "col-resize";
        document.body.style.userSelect = "none";

        const onMouseMove = (moveEvent) => {
          const deltaX = moveEvent.clientX - startX;
          const newWidth = Math.max(45, startWidth + deltaX);
          th.style.width = `${newWidth}px`;
        };

        const onMouseUp = () => {
          resizer.classList.remove("resizing");
          document.body.style.cursor = "";
          document.body.style.userSelect = "";
          document.removeEventListener("mousemove", onMouseMove);
          document.removeEventListener("mouseup", onMouseUp);

          try {
            const saved = JSON.parse(localStorage.getItem("caido_ape_col_widths") || "{}");
            saved[colKey] = parseInt(th.style.width, 10);
            localStorage.setItem("caido_ape_col_widths", JSON.stringify(saved));
          } catch (e) {
            console.debug("Failed to save column width", e);
          }
        };

        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", onMouseUp);
      });
    });
  };

  initColumnResizing();

  // Mode toggles
  reqToggleBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      reqToggleBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      reqMode = btn.getAttribute("data-mode");
      if (selectedItem) renderPanels(selectedItem);
    });
  });

  respToggleBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      respToggleBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      respMode = btn.getAttribute("data-mode");
      if (selectedItem) renderPanels(selectedItem);
    });
  });

  // Keyboard navigation (ArrowUp / ArrowDown)
  tablePane.addEventListener("keydown", (e) => {
    if (!selectedItem || filteredRequests.length === 0) return;

    const currentIndex = filteredRequests.findIndex((r) => r.id === selectedItem.id);
    if (currentIndex === -1) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      const nextIndex = Math.min(filteredRequests.length - 1, currentIndex + 1);
      selectItem(filteredRequests[nextIndex]);
      scrollRowIntoView(filteredRequests[nextIndex].id);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const prevIndex = Math.max(0, currentIndex - 1);
      selectItem(filteredRequests[prevIndex]);
      scrollRowIntoView(filteredRequests[prevIndex].id);
    }
  });

  const scrollRowIntoView = (id) => {
    const row = tableBody.querySelector(`tr[data-id="${id}"]`);
    if (row) {
      row.scrollIntoView({ block: "nearest" });
    }
  };

  // Splitter drag
  let isDragging = false;
  let startY = 0;
  let startHeight = 340;

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
    const newHeight = Math.max(100, Math.min(750, startHeight + deltaY));
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

  statusBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    statusDropdownWrap.classList.toggle("open");
  });

  statusMenuItems.forEach((item) => {
    item.addEventListener("click", (e) => {
      e.stopPropagation();
      const val = item.getAttribute("data-value");
      setStatus(val);
      statusDropdownWrap.classList.remove("open");
    });
  });

  document.addEventListener("click", (e) => {
    if (statusDropdownWrap && !statusDropdownWrap.contains(e.target)) {
      statusDropdownWrap.classList.remove("open");
    }
  });

  searchInput.addEventListener("input", applyFiltersAndRender);
  dedupeToggle.addEventListener("change", applyFiltersAndRender);
  refreshBtn.addEventListener("click", loadRuns);

  resetBtn.addEventListener("click", () => {
    setStatus("200", false);
    searchInput.value = "";
    dedupeToggle.checked = true;
    applyFiltersAndRender();
  });

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
  if (code >= 200 && code < 300) return "status-200";
  if (code >= 300 && code < 400) return "status-300";
  if (code >= 400 && code < 600) return "status-400";
  return "status-none";
}

function formatTimestamp(ts) {
  if (!ts) return "-";
  const d = new Date(Number(ts));
  if (isNaN(d.getTime())) return String(ts);
  const pad = (n) => String(n).padStart(2, "0");
  const YYYY = d.getFullYear();
  const MM = pad(d.getMonth() + 1);
  const DD = pad(d.getDate());
  const hh = pad(d.getHours());
  const mm = pad(d.getMinutes());
  const ss = pad(d.getSeconds());
  return `${YYYY}-${MM}-${DD} ${hh}:${mm}:${ss}`;
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

function formatRawCode(text) {
  if (!text) {
    return `<div class="caido-line"><span class="caido-line-num">1</span><span class="caido-line-text" style="color: var(--caido-text-dim);">(Empty)</span></div>`;
  }

  const lines = String(text).split(/\r?\n/);
  return lines
    .map((line, idx) => {
      const lineNum = idx + 1;
      return `<div class="caido-line"><span class="caido-line-num">${lineNum}</span><span class="caido-line-text">${escapeHtml(line)}</span></div>`;
    })
    .join("");
}

function formatHighlightedRequest(rawRequest, payload) {
  if (!rawRequest) {
    return `<div class="caido-line"><span class="caido-line-num">1</span><span class="caido-line-text" style="color: var(--caido-text-dim);">(No raw request available)</span></div>`;
  }

  const lines = String(rawRequest).split(/\r?\n/);
  let isHeaders = true;
  const escapedPayload = payload ? escapeHtml(payload) : "";

  return lines
    .map((line, idx) => {
      const lineNum = idx + 1;

      if (line.trim() === "") {
        isHeaders = false;
        return `<div class="caido-line"><span class="caido-line-num">${lineNum}</span><span class="caido-line-text"></span></div>`;
      }

      // Line 1: Request line (e.g. GET /?search=<video> HTTP/1.1)
      if (idx === 0) {
        const parts = line.split(" ");
        const method = parts[0] || "GET";
        const proto = parts.length > 2 ? parts[parts.length - 1] : "HTTP/1.1";
        const pathAndQuery = parts.slice(1, parts.length > 2 ? -1 : undefined).join(" ");

        let highlightedPath = escapeHtml(pathAndQuery);
        if (escapedPayload && highlightedPath.includes(escapedPayload)) {
          highlightedPath = highlightedPath.split(escapedPayload).join(`<span class="hl-payload-match">${escapedPayload}</span>`);
        }

        return `
          <div class="caido-line">
            <span class="caido-line-num">${lineNum}</span>
            <span class="caido-line-text"><span class="hl-method">${escapeHtml(method)}</span> <span class="hl-path">${highlightedPath}</span> <span class="hl-proto">${escapeHtml(proto)}</span></span>
          </div>
        `;
      }

      // Headers (e.g. Host: example.com)
      if (isHeaders) {
        const colonIndex = line.indexOf(":");
        if (colonIndex !== -1) {
          const key = line.slice(0, colonIndex);
          const val = line.slice(colonIndex + 1);

          let highlightedVal = escapeHtml(val);
          if (escapedPayload && highlightedVal.includes(escapedPayload)) {
            highlightedVal = highlightedVal.split(escapedPayload).join(`<span class="hl-payload-match">${escapedPayload}</span>`);
          }

          return `
            <div class="caido-line">
              <span class="caido-line-num">${lineNum}</span>
              <span class="caido-line-text"><span class="hl-header-key">${escapeHtml(key)}:</span><span class="hl-header-val">${highlightedVal}</span></span>
            </div>
          `;
        }
      }

      // Body line
      let highlightedBody = escapeHtml(line);
      if (escapedPayload && highlightedBody.includes(escapedPayload)) {
        highlightedBody = highlightedBody.split(escapedPayload).join(`<span class="hl-payload-match">${escapedPayload}</span>`);
      }

      return `
        <div class="caido-line">
          <span class="caido-line-num">${lineNum}</span>
          <span class="caido-line-text">${highlightedBody}</span>
        </div>
      `;
    })
    .join("");
}

function formatHighlightedResponse(rawResponse) {
  if (!rawResponse) {
    return `<div class="caido-line"><span class="caido-line-num">1</span><span class="caido-line-text" style="color: var(--caido-text-dim);">(No raw response available)</span></div>`;
  }

  const lines = String(rawResponse).split(/\r?\n/);
  let isHeaders = true;

  return lines
    .map((line, idx) => {
      const lineNum = idx + 1;

      if (line.trim() === "") {
        isHeaders = false;
        return `<div class="caido-line"><span class="caido-line-num">${lineNum}</span><span class="caido-line-text"></span></div>`;
      }

      // Line 1: Status line (e.g. HTTP/1.1 200 OK or HTTP/1.1 400 Bad Request)
      if (idx === 0) {
        const parts = line.split(" ");
        const proto = parts[0] || "HTTP/1.1";
        const codeStr = parts[1] || "";
        const codeNum = parseInt(codeStr, 10);
        const reason = parts.slice(2).join(" ");

        const statusClass = (codeNum >= 200 && codeNum < 300) ? "hl-status-200" : "hl-status-err";

        return `
          <div class="caido-line">
            <span class="caido-line-num">${lineNum}</span>
            <span class="caido-line-text"><span class="hl-proto">${escapeHtml(proto)}</span> <span class="${statusClass}">${escapeHtml(codeStr)}</span> <span class="hl-reason">${escapeHtml(reason)}</span></span>
          </div>
        `;
      }

      // Headers (e.g. Content-Type: application/json)
      if (isHeaders) {
        const colonIndex = line.indexOf(":");
        if (colonIndex !== -1) {
          const key = line.slice(0, colonIndex);
          const val = line.slice(colonIndex + 1);

          return `
            <div class="caido-line">
              <span class="caido-line-num">${lineNum}</span>
              <span class="caido-line-text"><span class="hl-header-key">${escapeHtml(key)}:</span><span class="hl-header-val">${escapeHtml(val)}</span></span>
            </div>
          `;
        }
      }

      // Response Body line (strings / text)
      let bodyText = escapeHtml(line);
      return `
        <div class="caido-line">
          <span class="caido-line-num">${lineNum}</span>
          <span class="caido-line-text">${bodyText}</span>
        </div>
      `;
    })
    .join("");
}

function formatPreviewResponse(rawResponse) {
  if (!rawResponse) {
    return `<div class="caido-line"><span class="caido-line-num">1</span><span class="caido-line-text">(No response to preview)</span></div>`;
  }

  const doubleBreak = rawResponse.indexOf("\r\n\r\n");
  const singleBreak = rawResponse.indexOf("\n\n");
  let bodyStart = -1;

  if (doubleBreak !== -1) {
    bodyStart = doubleBreak + 4;
  } else if (singleBreak !== -1) {
    bodyStart = singleBreak + 2;
  }

  if (bodyStart === -1 || bodyStart >= rawResponse.length) {
    return formatRawCode(rawResponse);
  }

  const body = rawResponse.slice(bodyStart).trim();
  try {
    const parsed = JSON.parse(body);
    const prettyJson = JSON.stringify(parsed, null, 2);
    return formatRawCode(prettyJson);
  } catch (e) {
    return formatRawCode(body);
  }
}
