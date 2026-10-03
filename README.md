# site-kit

Reusable foundation for template-based company/customer websites. Each customer site is an
**isolated repo** that depends on a pinned version of `@kmlal007/site-kit`. Sites build to pure
static HTML/CSS with no client JavaScript.

Design docs: [docs/DECISIONS.md](docs/DECISIONS.md) (current), [TEMPLATE-ISOLATION](docs/TEMPLATE-ISOLATION.md),
[RECOMMENDED-APPROACH](docs/RECOMMENDED-APPROACH.md), [PLAN](docs/PLAN.md) (SaaS option, not pursued).

## Create a customer site

```bash
pnpm install && pnpm build
node packages/site-kit/dist/cli.js templates
node packages/site-kit/dist/cli.js create ../site-acme-dental \
  --template business-starter --customer "Acme Dental" \
  --primary "#0f766e" --heading-font serif
```

Until the kit is published to GitHub Packages (Phase 2), point the new site at a local build:
`pnpm --filter @kmlal007/site-kit pack` and pass `--kit-spec file:/abs/path/to/kmlal007-site-kit-0.1.0.tgz`.

## Repository layout

| Path | Contents |
|---|---|
| `packages/site-kit/src/schema` | Zod schemas: theme, sections, pages, site config, template manifest, lock file |
| `packages/site-kit/src/tokens` | Theme → CSS variables, WCAG contrast checks, font stacks |
| `packages/site-kit/src/sections` | React section components (rendered to static HTML) |
| `packages/site-kit/src/content` | Loads + validates a site's content; link and placeholder checks |
| `packages/site-kit/src/astro` | `SiteLayout.astro` used by every customer site |
| `packages/site-kit/src/cli` | `site-kit templates / create / check` |
| `packages/site-kit/templates` | Templates (data only: manifest, theme, content) |
| `packages/site-kit/scaffold` | Files copied into every new customer repo |
| `scripts/e2e.mjs` | Pack → create site per template → install → build → assert |

## Development

```bash
pnpm typecheck && pnpm test && pnpm build && pnpm e2e
```

### Adding a section type
1. Schema in `src/schema/index.ts` and add it to `sectionSchema`.
2. Component in `src/sections/index.tsx` and add it to `registry` (TypeScript enforces this).
3. Styles in `src/styles/base.css`; add a sample to the "every registered type" test.

### Adding a template
Create `packages/site-kit/templates/<id>/` with `template.json`, `theme.json`, `content/site.json`,
`content/pages/home.json` (+ more pages). Use `[[CONFIRM: ...]]` for any fact the customer must
supply. Tests and e2e pick it up automatically.
