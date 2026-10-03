# Custom code (customer-specific)

Put customer-specific components and pages here. Everything outside this folder
(`theme.json`, `content/`) is data, and kit upgrades never conflict with it.

Rules that keep kit upgrades safe:

- Do not copy or patch files from `node_modules/{{kitName}}`. If a section needs a change that
  other customers would also benefit from, change it in site-kit instead.
- Custom Astro pages go in `src/pages/` with an explicit file name (for example `src/pages/careers.astro`).
  They take precedence over the generated `[...slug].astro` route.
