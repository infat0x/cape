/**
 * Automate Payload Extractor - Backend Plugin
 * Handles GraphQL communication with Caido core and exposes RPC methods to the frontend.
 */

export function init(sdk) {
  console.log("[Automate Payload Extractor] Backend initialized.");

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
        const sessionName = session.name || ("Session #" + session.id);
        const entries = session.entries || [];
        entries.forEach((entry) => {
          runs.push({
            id: String(entry.id),
            name: entry.name || ("Run #" + entry.id),
            sessionName: sessionName,
            createdAt: entry.createdAt || 0
          });
        });
      });

      runs.sort((a, b) => Number(b.createdAt) - Number(a.createdAt));
      return runs;
    } catch (err) {
      console.error("[Automate Payload Extractor] getRuns error:", err);
      throw err;
    }
  });

  sdk.api.register("getRunPayloads", async (...args) => {
    const runId = extractTargetId(args);
    if (!runId) {
      console.warn("[Automate Payload Extractor] No runId provided to getRunPayloads");
      return [];
    }

    try {
      const query = `
        query GetAutomateEntryRequests($id: ID!, $limit: Int, $offset: Int) {
          automateEntry(id: $id) {
            id
            name
            requestsByOffset(limit: $limit, offset: $offset) {
              edges {
                node {
                  sequenceId
                  payloads {
                    position
                    raw
                  }
                  request {
                    id
                    response {
                      statusCode
                      length
                      roundtripTime
                    }
                  }
                }
              }
            }
          }
        }
      `;

      const pageSize = 5000;
      let offset = 0;
      let allEdges = [];

      while (true) {
        const response = await sdk.graphql.execute(query, {
          id: String(runId),
          limit: pageSize,
          offset: offset
        });

        const entry = response?.data?.automateEntry;
        const edges = entry?.requestsByOffset?.edges || [];
        if (edges.length === 0) break;

        allEdges = allEdges.concat(edges);
        if (edges.length < pageSize) break;
        offset += pageSize;
      }

      const results = [];
      for (let i = 0; i < allEdges.length; i++) {
        const node = allEdges[i].node;
        if (!node) continue;

        const rawList = node.payloads || [];
        const decodedList = [];
        for (let j = 0; j < rawList.length; j++) {
          const rawItem = rawList[j]?.raw;
          if (rawItem) {
            decodedList.push(decodeBase64(rawItem));
          }
        }

        const primaryPayload = decodedList.join("\t");
        const resp = node.request?.response;

        results.push({
          id: Number(node.sequenceId),
          payload: primaryPayload,
          payloads: decodedList,
          statusCode: resp?.statusCode ?? null,
          length: resp?.length ?? null,
          roundtripTime: resp?.roundtripTime ?? null
        });
      }

      results.sort((a, b) => a.id - b.id);
      return results;
    } catch (err) {
      console.error("[Automate Payload Extractor] getRunPayloads error:", err);
      throw err;
    }
  });
}

function extractTargetId(args) {
  for (let i = 0; i < args.length; i++) {
    const item = args[i];
    if (typeof item === "string" || typeof item === "number") {
      return String(item);
    }
    if (item && typeof item === "object") {
      if (item.id != null) return String(item.id);
      if (item.runId != null) return String(item.runId);
    }
  }
  return null;
}

function decodeBase64(raw) {
  if (!raw || typeof raw !== "string") return "";
  try {
    const bin = atob(raw);
    try {
      return decodeURIComponent(escape(bin));
    } catch (_) {
      return bin;
    }
  } catch (_) {
    return raw;
  }
}
