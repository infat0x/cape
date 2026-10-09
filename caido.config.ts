import { defineConfig } from "@caido-community/dev";

export default defineConfig({
  id: "automate-payload-extractor",
  name: "Automate Payload Extractor",
  description: "Extract and export Automate payloads directly to clipboard and custom wordlists in Caido.",
  version: "1.0.4",
  author: {
    name: "Infat",
    url: "https://github.com/infat0x"
  },
  plugins: [
    {
      kind: "frontend",
      id: "automate-payload-extractor-frontend",
      root: "frontend"
    },
    {
      kind: "backend",
      id: "automate-payload-extractor-backend",
      root: "backend"
    }
  ]
});
