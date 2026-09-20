import type { Caido } from "@caido/sdk-frontend";

/**
 * Automate Payload Extractor (TypeScript Entrypoint)
 *
 * @param sdk - Caido Frontend SDK instance
 */
export const init = (sdk: Caido) => {
  // Command registration
  sdk.commands.register("automate-payload-extractor.quick-copy", {
    name: "Automate: Quick Copy 200 OK Payloads",
    run: async () => {
      const sessions = await sdk.automate.getSessions();
      if (!sessions || sessions.length === 0) {
        sdk.window.showToast("No active Automate sessions found.", { variant: "warning" });
        return;
      }

      const latest = sessions[sessions.length - 1];
      const entries = await sdk.automate.getEntries(latest.id);

      const payloads = entries
        .filter((e: any) => e.response?.statusCode === 200)
        .map((e: any) => e.payloads?.[0]?.raw || e.raw)
        .filter(Boolean);

      const deduplicated = Array.from(new Set(payloads));
      await navigator.clipboard.writeText(deduplicated.join("\n"));
      sdk.window.showToast(`Copied ${deduplicated.length} payload(s) to clipboard!`, { variant: "success" });
    }
  });

  // Shortcut registration
  sdk.shortcuts.register("automate-payload-extractor.quick-copy", ["Control", "Shift", "C"]);

  // Sidebar navigation
  sdk.sidebar.registerItem("Payload Extractor", "/automate-payload-extractor", {
    icon: "fas fa-clone"
  });
};
