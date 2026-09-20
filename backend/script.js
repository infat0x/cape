/**
 * Automate Payload Extractor - Backend RPC Handler
 * Runs inside Caido's QuickJS runtime with full backend SDK access.
 */

export function init(sdk) {
  console.log("[Automate Payload Extractor] Backend initialized.");

  // Expose getRuns to the frontend via RPC
  sdk.api.register("getRuns", async () => {
    try {
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

      const response = await sdk.graphql.execute(query);
      const edges = response?.data?.automateSessions?.edges || [];
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

      // Sort newest first
      runs.sort((a, b) => Number(b.createdAt) - Number(a.createdAt));
      return runs;
    } catch (err) {
      console.error("[Automate Payload Extractor Backend] getRuns error:", err);
      throw err;
    }
  });

  // Expose getRunPayloads to the frontend via RPC
  sdk.api.register("getRunPayloads", async (runId) => {
    try {
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

      const response = await sdk.graphql.execute(query, { id: runId });
      const edges = response?.data?.automateEntry?.requests?.edges || [];
      const parsed = [];

      edges.forEach((edge) => {
        const node = edge.node;
        if (!node) return;
        const rawPayload = node.payloads?.[0]?.raw || "";
        const decoded = decodeBase32Hex(rawPayload);
        const statusCode = node.request?.response?.statusCode || 0;

        if (decoded) {
          parsed.push({
            sequenceId: node.sequenceId,
            payload: decoded,
            statusCode: statusCode
          });
        }
      });

      return parsed;
    } catch (err) {
      console.error("[Automate Payload Extractor Backend] getRunPayloads error:", err);
      throw err;
    }
  });
}

/**
 * Universal RFC 4648 Base32hex decoder without external dependencies.
 */
function decodeBase32Hex(input) {
  if (!input || typeof input !== "string") return "";
  const clean = input.replace(/=+$/, "").toUpperCase();
  const alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUV";

  for (let i = 0; i < clean.length; i++) {
    if (alphabet.indexOf(clean[i]) === -1) {
      return input;
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

  return utf8BytesToString(bytes) || input;
}

/**
 * Pure JavaScript UTF-8 byte array to string converter (compatible with QuickJS).
 */
function utf8BytesToString(bytes) {
  let out = "";
  let i = 0;
  while (i < bytes.length) {
    const c = bytes[i++];
    if (c < 128) {
      out += String.fromCharCode(c);
    } else if (c > 191 && c < 224) {
      const c2 = bytes[i++];
      out += String.fromCharCode(((c & 31) << 6) | (c2 & 63));
    } else if (c > 223 && c < 240) {
      const c2 = bytes[i++];
      const c3 = bytes[i++];
      out += String.fromCharCode(((c & 15) << 12) | ((c2 & 63) << 6) | (c3 & 63));
    } else {
      out += String.fromCharCode(c);
    }
  }
  return out;
}
