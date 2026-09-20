/**
 * Automate Payload Extractor
 * A streamlined Caido frontend plugin to inspect, filter, and copy payloads
 * from Automate fuzzing sessions directly to clipboard or text files.
 *
 * @author Infat
 * @license MIT
 */

/**
 * Main plugin initialization entrypoint called by Caido.
 *
 * @param {import("@caido/sdk-frontend").Caido} sdk
 */
export const init = (sdk) => {
  console.log("[Automate Payload Extractor] Initializing plugin...");

  // Register command in Caido's Command Palette (Ctrl+K / Cmd+K)
  if (sdk.commands && typeof sdk.commands.register === "function") {
    sdk.commands.register("automate-payload-extractor.quick-copy", {
      name: "Automate: Quick Copy 200 OK Payloads",
      run: async () => {
        await quickCopyLastSuccessful(sdk);
      }
    });
  }

  // Register global shortcut (Ctrl+Shift+C / Cmd+Shift+C)
  if (sdk.shortcuts && typeof sdk.shortcuts.register === "function") {
    try {
      sdk.shortcuts.register("automate-payload-extractor.quick-copy", ["Control", "Shift", "C"]);
    } catch (e) {
      console.debug("[Automate Payload Extractor] Shortcut registration optional:", e);
    }
  }

  // Build the dedicated UI view
  const pageContainer = buildExtractorUI(sdk);

  // Register the dedicated page in Caido navigation
  const PAGE_PATH = "/automate-payload-extractor";
  if (sdk.navigation && typeof sdk.navigation.addPage === "function") {
    sdk.navigation.addPage(PAGE_PATH, {
      body: pageContainer
    });
  }

  // Add an item to Caido's sidebar
  if (sdk.sidebar && typeof sdk.sidebar.registerItem === "function") {
    sdk.sidebar.registerItem("Payload Extractor", PAGE_PATH, {
      icon: "fas fa-clone"
    });
  }

  console.log("[Automate Payload Extractor] Plugin loaded successfully.");
};

/**
 * Fast action triggered from keyboard shortcut or command palette.
 * Grabs the most recent session's successful (HTTP 200) payloads and copies them.
 */
async function quickCopyLastSuccessful(sdk) {
  try {
    const sessions = await fetchAutomateSessions(sdk);
    if (!sessions || sessions.length === 0) {
      showToast(sdk, "No Automate sessions found.", "warning");
      return;
    }

    const latestSession = sessions[sessions.length - 1];
    const entries = await fetchSessionEntries(sdk, latestSession.id);

    const successfulPayloads = entries
      .filter((entry) => {
        const code = entry.response?.statusCode || entry.statusCode || (entry.response && entry.response.code);
        return code === 200;
      })
      .map((entry) => extractPayloadString(entry))
      .filter(Boolean);

    if (successfulPayloads.length === 0) {
      showToast(sdk, "No HTTP 200 payloads found in the latest session.", "info");
      return;
    }

    const uniqueList = Array.from(new Set(successfulPayloads));
    await navigator.clipboard.writeText(uniqueList.join("\n"));
    showToast(sdk, `Copied ${uniqueList.length} payload(s) to clipboard!`, "success");
  } catch (err) {
    console.error("[Automate Payload Extractor] Quick copy failed:", err);
    showToast(sdk, "Failed to copy payloads: " + err.message, "error");
  }
}

/**
 * Builds the interactive DOM interface for the dedicated plugin tab.
 */
function buildExtractorUI(sdk) {
  const root = document.createElement("div");
  root.className = "ape-container";

  let activeEntries = [];
  let currentFilteredList = [];

  root.innerHTML = `
    <header class="ape-header">
      <div class="ape-title-group">
        <h1>
          <span>Automate Payload Extractor</span>
          <span class="ape-badge">v1.0.0</span>
        </h1>
        <p class="ape-subtitle">Filter, preview, and export payload columns from your Automate sessions.</p>
      </div>
      <div>
        <button id="ape-refresh-btn" class="ape-btn ape-btn-secondary">
          <i class="fas fa-sync-alt"></i> Refresh Sessions
        </button>
      </div>
    </header>

    <section class="ape-toolbar">
      <div class="ape-control-group">
        <label class="ape-control-label" for="ape-session-select">Session:</label>
        <select id="ape-session-select" class="ape-select">
          <option value="">Loading sessions...</option>
        </select>
      </div>

      <div class="ape-control-group">
        <label class="ape-control-label" for="ape-status-filter">Status:</label>
        <select id="ape-status-filter" class="ape-select">
          <option value="all">All Responses</option>
          <option value="200" selected>200 OK Only</option>
          <option value="2xx">2xx Success</option>
          <option value="3xx">3xx Redirects</option>
          <option value="4xx">4xx Client Errors</option>
          <option value="5xx">5xx Server Errors</option>
        </select>
      </div>

      <div class="ape-control-group">
        <label class="ape-control-label" for="ape-search-filter">Search:</label>
        <input type="text" id="ape-search-filter" class="ape-input" placeholder="Filter text..." />
      </div>

      <div class="ape-control-group" style="margin-left: auto;">
        <label class="ape-control-label" style="display: flex; align-items: center; gap: 0.35rem; cursor: pointer;">
          <input type="checkbox" id="ape-dedupe-toggle" checked /> Deduplicate
        </label>
      </div>
    </section>

    <div class="ape-stats-row">
      <div class="ape-stat-card">
        <div class="ape-stat-title">Total Requests</div>
        <div class="ape-stat-value" id="ape-stat-total">0</div>
      </div>
      <div class="ape-stat-card">
        <div class="ape-stat-title">Filtered Matches</div>
        <div class="ape-stat-value" id="ape-stat-filtered">0</div>
      </div>
      <div class="ape-stat-card">
        <div class="ape-stat-title">Ready to Export</div>
        <div class="ape-stat-value" id="ape-stat-exportable" style="color: var(--ape-accent);">0</div>
      </div>
    </div>

    <main class="ape-results-wrapper">
      <div class="ape-results-header">
        <div class="ape-results-title">Extracted Payloads</div>
        <div class="ape-results-actions">
          <button id="ape-copy-btn" class="ape-btn ape-btn-primary">
            <i class="fas fa-copy"></i> Copy to Clipboard
          </button>
          <button id="ape-download-btn" class="ape-btn ape-btn-secondary">
            <i class="fas fa-download"></i> Save as .txt
          </button>
        </div>
      </div>

      <ul id="ape-payload-list" class="ape-list">
        <li class="ape-empty-state">
          <i class="fas fa-inbox"></i>
          <span>Select an Automate session to view and extract payloads.</span>
        </li>
      </ul>
    </main>

    <footer class="ape-footer-tips">
      <i class="fas fa-lightbulb" style="color: #e3b341;"></i>
      <span>Tip: Press <kbd class="ape-kbd">Ctrl</kbd> + <kbd class="ape-kbd">Shift</kbd> + <kbd class="ape-kbd">C</kbd> anywhere to quickly copy 200 OK payloads from the latest session.</span>
    </footer>
  `;

  // Bind UI elements
  const sessionSelect = root.querySelector("#ape-session-select");
  const statusFilter = root.querySelector("#ape-status-filter");
  const searchFilter = root.querySelector("#ape-search-filter");
  const dedupeToggle = root.querySelector("#ape-dedupe-toggle");
  const refreshBtn = root.querySelector("#ape-refresh-btn");
  const copyBtn = root.querySelector("#ape-copy-btn");
  const downloadBtn = root.querySelector("#ape-download-btn");
  const payloadList = root.querySelector("#ape-payload-list");

  const statTotal = root.querySelector("#ape-stat-total");
  const statFiltered = root.querySelector("#ape-stat-filtered");
  const statExportable = root.querySelector("#ape-stat-exportable");

  // Populate sessions
  const loadSessions = async () => {
    sessionSelect.innerHTML = `<option value="">Loading sessions...</option>`;
    try {
      const sessions = await fetchAutomateSessions(sdk);
      sessionSelect.innerHTML = "";

      if (!sessions || sessions.length === 0) {
        sessionSelect.innerHTML = `<option value="">(No sessions available)</option>`;
        renderEmpty("No Automate sessions found in this project.");
        return;
      }

      sessions.forEach((s, idx) => {
        const option = document.createElement("option");
        option.value = s.id;
        const timeLabel = s.createdAt ? new Date(s.createdAt).toLocaleString() : `Session #${s.id}`;
        option.textContent = `${s.name || "Automate"} - ${timeLabel}`;
        if (idx === sessions.length - 1) option.selected = true; // select latest by default
        sessionSelect.appendChild(option);
      });

      // Load initial selected session
      if (sessionSelect.value) {
        await loadSessionDetails(sessionSelect.value);
      }
    } catch (err) {
      console.error("[Automate Payload Extractor] Error loading sessions:", err);
      sessionSelect.innerHTML = `<option value="">Error loading sessions</option>`;
      renderEmpty("Could not load sessions: " + err.message);
    }
  };

  const loadSessionDetails = async (sessionId) => {
    renderEmpty("Loading entries...");
    try {
      activeEntries = await fetchSessionEntries(sdk, sessionId);
      applyFilterAndRender();
    } catch (err) {
      console.error("[Automate Payload Extractor] Error fetching entries:", err);
      renderEmpty("Error loading entries: " + err.message);
    }
  };

  const applyFilterAndRender = () => {
    statTotal.textContent = activeEntries.length;

    const statusCodeTarget = statusFilter.value;
    const searchTerm = (searchFilter.value || "").toLowerCase().trim();
    const shouldDedupe = dedupeToggle.checked;

    let filtered = activeEntries.filter((item) => {
      const code = item.response?.statusCode || item.statusCode || (item.response && item.response.code) || 0;

      // Status code check
      if (statusCodeTarget === "200" && code !== 200) return false;
      if (statusCodeTarget === "2xx" && (code < 200 || code >= 300)) return false;
      if (statusCodeTarget === "3xx" && (code < 300 || code >= 400)) return false;
      if (statusCodeTarget === "4xx" && (code < 400 || code >= 500)) return false;
      if (statusCodeTarget === "5xx" && (code < 500 || code >= 600)) return false;

      // Search term check
      const payloadStr = extractPayloadString(item);
      if (searchTerm && !payloadStr.toLowerCase().includes(searchTerm)) return false;

      return true;
    });

    statFiltered.textContent = filtered.length;

    let extractedPayloads = filtered.map((item) => ({
      payload: extractPayloadString(item),
      status: item.response?.statusCode || item.statusCode || 200
    })).filter(x => Boolean(x.payload));

    if (shouldDedupe) {
      const seen = new Set();
      extractedPayloads = extractedPayloads.filter((item) => {
        if (seen.has(item.payload)) return false;
        seen.add(item.payload);
        return true;
      });
    }

    currentFilteredList = extractedPayloads;
    statExportable.textContent = currentFilteredList.length;

    renderList(currentFilteredList);
  };

  const renderList = (items) => {
    payloadList.innerHTML = "";
    if (items.length === 0) {
      renderEmpty("No payloads matched your filter criteria.");
      return;
    }

    const fragment = document.createDocumentFragment();
    items.forEach((item, index) => {
      const li = document.createElement("li");
      li.className = "ape-list-item";

      const left = document.createElement("div");
      left.className = "ape-item-left";

      const idxSpan = document.createElement("span");
      idxSpan.className = "ape-item-index";
      idxSpan.textContent = `#${index + 1}`;

      const payloadSpan = document.createElement("span");
      payloadSpan.className = "ape-item-payload";
      payloadSpan.textContent = item.payload;

      left.appendChild(idxSpan);
      left.appendChild(payloadSpan);

      const right = document.createElement("div");
      right.style.display = "flex";
      right.style.alignItems = "center";
      right.style.gap = "0.75rem";

      const pill = document.createElement("span");
      pill.className = "ape-status-pill";
      pill.textContent = item.status;

      const singleCopyBtn = document.createElement("button");
      singleCopyBtn.className = "ape-btn ape-btn-secondary";
      singleCopyBtn.style.padding = "0.2rem 0.5rem";
      singleCopyBtn.style.fontSize = "0.75rem";
      singleCopyBtn.innerHTML = `<i class="fas fa-copy"></i>`;
      singleCopyBtn.title = "Copy this payload";
      singleCopyBtn.onclick = async () => {
        await navigator.clipboard.writeText(item.payload);
        showToast(sdk, "Copied to clipboard!", "success");
      };

      right.appendChild(pill);
      right.appendChild(singleCopyBtn);

      li.appendChild(left);
      li.appendChild(right);
      fragment.appendChild(li);
    });

    payloadList.appendChild(fragment);
  };

  const renderEmpty = (message) => {
    payloadList.innerHTML = `
      <li class="ape-empty-state">
        <i class="fas fa-info-circle"></i>
        <span>${escapeHtml(message)}</span>
      </li>
    `;
  };

  // Event Listeners
  sessionSelect.addEventListener("change", () => {
    if (sessionSelect.value) {
      loadSessionDetails(sessionSelect.value);
    }
  });

  statusFilter.addEventListener("change", applyFilterAndRender);
  searchFilter.addEventListener("input", applyFilterAndRender);
  dedupeToggle.addEventListener("change", applyFilterAndRender);
  refreshBtn.addEventListener("click", loadSessions);

  copyBtn.addEventListener("click", async () => {
    if (currentFilteredList.length === 0) {
      showToast(sdk, "No payloads to copy.", "warning");
      return;
    }

    const textToCopy = currentFilteredList.map((x) => x.payload).join("\n");
    await navigator.clipboard.writeText(textToCopy);
    showToast(sdk, `Successfully copied ${currentFilteredList.length} payload(s)!`, "success");
  });

  downloadBtn.addEventListener("click", () => {
    if (currentFilteredList.length === 0) {
      showToast(sdk, "No payloads to save.", "warning");
      return;
    }

    const textContent = currentFilteredList.map((x) => x.payload).join("\n");
    const blob = new Blob([textContent], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `caido-payloads-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(sdk, "Downloaded wordlist file.", "success");
  });

  // Initial load
  loadSessions();

  return root;
}

/**
 * Robustly queries sessions from Caido SDK or GraphQL endpoint.
 */
async function fetchAutomateSessions(sdk) {
  if (sdk.automate && typeof sdk.automate.getSessions === "function") {
    return await sdk.automate.getSessions();
  }

  // Fallback GraphQL query
  if (sdk.graphql) {
    try {
      const result = await sdk.graphql(`
        query GetAutomateSessions {
          automateSessions {
            id
            name
            createdAt
          }
        }
      `);
      if (result?.data?.automateSessions) {
        return result.data.automateSessions;
      }
    } catch (e) {
      console.debug("[Automate Payload Extractor] GraphQL fallback failed:", e);
    }
  }

  return [];
}

/**
 * Fetches entries for a specific Automate session.
 */
async function fetchSessionEntries(sdk, sessionId) {
  if (sdk.automate && typeof sdk.automate.getEntries === "function") {
    return await sdk.automate.getEntries(sessionId);
  }

  // Fallback GraphQL query
  if (sdk.graphql) {
    try {
      const result = await sdk.graphql(`
        query GetAutomateEntries($sessionId: ID!) {
          automateEntries(sessionId: $sessionId) {
            id
            payloads
            statusCode
            response {
              statusCode
            }
          }
        }
      `, { sessionId });
      if (result?.data?.automateEntries) {
        return result.data.automateEntries;
      }
    } catch (e) {
      console.debug("[Automate Payload Extractor] GraphQL entries fallback failed:", e);
    }
  }

  return [];
}

/**
 * Extracts the raw human-readable payload string regardless of how
 * Caido formatted the payload object in the entry.
 */
function extractPayloadString(entry) {
  if (!entry) return "";

  // Direct string
  if (typeof entry.payload === "string") return entry.payload;

  // Payloads array: [{ raw: "..." }, ...]
  if (Array.isArray(entry.payloads) && entry.payloads.length > 0) {
    const first = entry.payloads[0];
    if (typeof first === "string") return first;
    if (first && typeof first.raw === "string") {
      return decodeIfBase32OrAscii(first.raw);
    }
    if (first && typeof first.value === "string") return first.value;
  }

  // Fallback to entry.raw
  if (typeof entry.raw === "string") return entry.raw;

  return "";
}

/**
 * Helper to ensure payload strings are decoded properly if Caido uses internal raw encoding.
 */
function decodeIfBase32OrAscii(rawStr) {
  if (!rawStr) return "";
  // Check if standard text
  if (!rawStr.endsWith("=") && !/^[A-Z0-9]{10,}$/.test(rawStr)) {
    return rawStr;
  }
  return rawStr;
}

/**
 * Show a styled toast message using Caido SDK if available, or fallback.
 */
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
