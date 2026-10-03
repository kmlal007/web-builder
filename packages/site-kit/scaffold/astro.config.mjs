import { defineConfig } from "astro/config";
import react from "@astrojs/react";

export default defineConfig({
  // Pure static output: every page is pre-rendered to HTML at build time.
  output: "static",
  integrations: [react()],
  vite: {
    // site-kit ships TypeScript source; let Vite compile it.
    ssr: { noExternal: ["{{kitName}}"] },
  },
});
