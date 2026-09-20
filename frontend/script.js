/**
 * Automate Payload Extractor
 * A high-performance Caido frontend plugin to inspect, filter, and copy
 * payloads from Automate fuzzing runs directly to clipboard or text files.
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
  console.log("[Automate Payload Extractor] Initializing plugin v1.0.2...");

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
 * Executes a GraphQL query against Caido's backend SDK.
 */
async function executeGraphQL(sdk, query, variables = {}) {
  let response;
  if (sdk.graphql && typeof sdk.graphql.execute === "function") {
    response = await sdk.graphql.execute(query, variables);
  } else if (typeof sdk.graphql === "function") {
    response = await sdk.graphql(query, variables);
  } else if (sdk.api && typeof sdk.api.graphql === "function") {
    response = await sdk.api.graphql(query, variables);
  } else {
    throw new Error("GraphQL execution method not found on Caido SDK.");
  }

  if (response && response.data !== undefined) {
    if (response.errors && response.errors.length > 0) {
      console.warn("[Automate Payload Extractor] GraphQL returned errors:", response.errors);
    }
    return response.data;
  }
  return response;
}

/**
 * RFC 4648 Base32hex decoder used by Caido's internal storage.
 * e.g., 'DTN64PB6DTP6AQBEE1QN8===' -> 'onbeforeinput'
 */
function decodeBase32Hex(input) {
  if (!input || typeof input !== "string") return "";
  const clean = input.replace(/=+$/, "").toUpperCase();
  const alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUV";

  // Validate characters against base32hex alphabet
  for (let i = 0; i < clean.length; i++) {
    if (alphabet.indexOf(clean[i]) === -1) {
      return input; // Not base32hex, return as-is
    }
  }

  let bitString = "";
  for (let i = 0; i < clean.length; i++) {
    const val = alphabet.indexOf(clean[i]);
    bitString += val.toString(2).padStart(5, "0");
  }

  const bytes = [];
  for (let i = 0; i + 8 <= bitString.length; i += 8) {
    bytes.push(parseInt(bitString.substr(i, 8), 2));
  }

  try {
    const decoded = new TextDecoder("utf-8").decode(new Uint8Array(bytes));
    return decoded || input;
  } catch (e) {
    return input;
  }
}

/**
 * Fast action triggered from keyboard shortcut or command palette.
 */
async function quickCopyLastSuccessful(sdk) {
  try {
    const runs = await fetchAllAutomateRuns(sdk);
    if (!runs || runs.length === 0) {
      showToast(sdk, "No Automate attack runs found.", "warning");
      return;
    }

    const latestRun = runs[0];
    const requests = await fetchRunRequests(sdk, latestRun.id);

    const successfulPayloads = requests
      .filter((r) => r.statusCode === 200)
      .map((r) => r.payload)
      .filter(Boolean);

    if (successfulPayloads.length === 0) {
      showToast(sdk, `No HTTP 200 payloads in run: ${latestRun.name}`, "info");
      return;
    }

    const uniqueList = Array.from(new Set(successfulPayloads));
    await navigator.clipboard.writeText(uniqueList.join("\n"));
    showToast(sdk, `Copied ${uniqueList.length} payload(s) from "${latestRun.name}"!`, "success");
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

  let activeRequests = [];
  let currentFilteredList = [];

  root.innerHTML = `
    <header class="ape-header">
      <div class="ape-title-group">
        <h1>
          <span>Automate Payload Extractor</span>
          <span class="ape-badge">v1.0.2</span>
        </h1>
        <p class="ape-subtitle">Extract, filter, and export payload columns from any Automate run.</p>
      </div>
      <div>
        <button id="ape-refresh-btn" class="ape-btn ape-btn-secondary">
          <i class="fas fa-sync-alt"></i> Refresh Runs
        </button>
      </div>
    </header>

    <section class="ape-toolbar">
      <div class="ape-control-group">
        <label class="ape-control-label" for="ape-run-select">Attack Run:</label>
        <select id="ape-run-select" class="ape-select" style="min-width: 250px;">
          <option value="">Loading attack runs...</option>
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
        <input type="text" id="ape-search-filter" class="ape-input" placeholder="Search payloads..." />
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
        <div class="ape-stat-title">Status Filter Matches</div>
        <div class="ape-stat-value" id="ape-stat-filtered">0</div>
      </div>
      <div class="ape-stat-card">
        <div class="ape-stat-title">Ready to Copy / Export</div>
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
            <i class="fas fa-download"></i> Save as Wordlist (.txt)
          </button>
        </div>
      </div>

      <ul id="ape-payload-list" class="ape-list">
        <li class="ape-empty-state">
          <i class="fas fa-inbox"></i>
          <span>Select an Automate attack run above to view payloads.</span>
        </li>
      </ul>
    </main>

    <footer class="ape-footer-tips">
      <i class="fas fa-lightbulb" style="color: #e3b341;"></i>
      <span>Tip: Press <kbd class="ape-kbd">Ctrl</kbd> + <kbd class="ape-kbd">Shift</kbd> + <kbd class="ape-kbd">C</kbd> anywhere to quickly copy 200 OK payloads from the latest attack.</span>
    </footer>
  `;

  // Bind UI elements
  const runSelect = root.querySelector("#ape-run-select");
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

  // Load all runs into dropdown
  const loadRuns = async () => {
    runSelect.innerHTML = `<option value="">Loading attack runs...</option>`;
    try {
      const runs = await fetchAllAutomateRuns(sdk);
      runSelect.innerHTML = "";

      if (!runs || runs.length === 0) {
        runSelect.innerHTML = `<option value="">(No Automate runs available)</option>`;
        renderEmpty("No Automate attack runs found in this project.");
        return;
      }

      runs.forEach((run, idx) => {
        const option = document.createElement("option");
        option.value = run.id;
        option.textContent = `${run.name} (${run.sessionName})`;
        if (idx === 0) option.selected = true; // Most recent selected by default
        runSelect.appendChild(option);
      });

      if (runSelect.value) {
        await loadRunDetails(runSelect.value);
      }
    } catch (err) {
      console.error("[Automate Payload Extractor] Error loading runs:", err);
      runSelect.innerHTML = `<option value="">Error loading runs</option>`;
      renderEmpty("Error loading runs: " + err.message);
    }
  };

  const loadRunDetails = async (runId) => {
    renderEmpty("Loading payloads for selected run...");
    try {
      activeRequests = await fetchRunRequests(sdk, runId);
      applyFilterAndRender();
    } catch (err) {
      console.error("[Automate Payload Extractor] Error fetching requests:", err);
      renderEmpty("Error loading requests: " + err.message);
    }
  };

  const applyFilterAndRender = () => {
    statTotal.textContent = activeRequests.length;

    const statusCodeTarget = statusFilter.value;
    const searchTerm = (searchFilter.value || "").toLowerCase().trim();
    const shouldDedupe = dedupeToggle.checked;

    let filtered = activeRequests.filter((item) => {
      const code = item.statusCode || 0;

      // Status code checks
      if (statusCodeTarget === "200" && code !== 200) return false;
      if (statusCodeTarget === "2xx" && (code < 200 || code >= 300)) return false;
      if (statusCodeTarget === "3xx" && (code < 300 || code >= 400)) return false;
      if (statusCodeTarget === "4xx" && (code < 400 || code >= 500)) return false;
      if (statusCodeTarget === "5xx" && (code < 500 || code >= 600)) return false;

      // Substring search
      if (searchTerm && !item.payload.toLowerCase().includes(searchTerm)) return false;

      return true;
    });

    statFiltered.textContent = filtered.length;

    let extracted = filtered.map((item) => ({
      payload: item.payload,
      statusCode: item.statusCode
    }));

    if (shouldDedupe) {
      const seen = new Set();
      extracted = extracted.filter((item) => {
        if (seen.has(item.payload)) return false;
        seen.add(item.payload);
        return true;
      });
    }

    currentFilteredList = extracted;
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
      pill.textContent = item.statusCode;

      const singleCopyBtn = document.createElement("button");
      singleCopyBtn.className = "ape-btn ape-btn-secondary";
      singleCopyBtn.style.padding = "0.2rem 0.5rem";
      singleCopyBtn.style.fontSize = "0.75rem";
      singleCopyBtn.innerHTML = `<i class="fas fa-copy"></i>`;
      singleCopyBtn.title = "Copy this payload";
      singleCopyBtn.onclick = async () => {
        await navigator.clipboard.writeText(item.payload);
        showToast(sdk, "Copied payload to clipboard!", "success");
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
  runSelect.addEventListener("change", () => {
    if (runSelect.value) {
      loadRunDetails(runSelect.value);
    }
  });

  statusFilter.addEventListener("change", applyFilterAndRender);
  searchFilter.addEventListener("input", applyFilterAndRender);
  dedupeToggle.addEventListener("change", applyFilterAndRender);
  refreshBtn.addEventListener("click", loadRuns);

  copyBtn.addEventListener("click", async () => {
    if (currentFilteredList.length === 0) {
      showToast(sdk, "No payloads to copy.", "warning");
      return;
    }

    const textToCopy = currentFilteredList.map((x) => x.payload).join("\n");
    await navigator.clipboard.writeText(textToCopy);
    showToast(sdk, `Copied ${currentFilteredList.length} payload(s) to clipboard!`, "success");
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
  loadRuns();

  return root;
}

/**
 * Retrieves all individual attack runs across all Automate sessions via GraphQL.
 */
async function fetchAllAutomateRuns(sdk) {
  const query = `
    query GetAllAutomateSessions {
      automateSessions {
        edges {
          node {
            id
            name
            createdAt
            entries {
              id
              name
              createdAt
            }
          }
        }
      }
    }
  `;

  const data = await executeGraphQL(sdk, query);
  const edges = data?.automateSessions?.edges || [];
  const runs = [];

  edges.forEach((edge) => {
    const session = edge.node;
    if (!session) return;
    const sessionName = session.name || `Session #${session.id}`;
    const entries = session.entries || [];
    entries.forEach((entry) => {
      runs.push({
        id: entry.id,
        name: entry.name || `Run #${entry.id}`,
        sessionName: sessionName,
        createdAt: entry.createdAt || 0
      });
    });
  });

  // Sort by newest first
  runs.sort((a, b) => Number(b.createdAt) - Number(a.createdAt));
  return runs;
}

/**
 * Retrieves and decodes all requests & payloads for a specific attack run.
 */
async function fetchRunRequests(sdk, runId) {
  const query = `
    query GetAutomateEntryRequests($id: ID!) {
      automateEntry(id: $id) {
        id
        name
        requests(first: 5000) {
          edges {
            node {
              sequenceId
              payloads {
                raw
              }
              request {
                id
                response {
                  statusCode
                }
              }
            }
          }
        }
      }
    }
  `;

  const data = await executeGraphQL(sdk, query, { id: runId });
  const edges = data?.automateEntry?.requests?.edges || [];
  const parsed = [];

  edges.forEach((edge) => {
    const node = edge.node;
    if (!node) return;
    const rawPayload = node.payloads?.[0]?.raw || "";
    const decodedPayload = decodeBase32Hex(rawPayload);
    const statusCode = node.request?.response?.statusCode || 0;

    if (decodedPayload) {
      parsed.push({
        sequenceId: node.sequenceId,
        payload: decodedPayload,
        statusCode: statusCode
      });
    }
  });

  return parsed;
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
