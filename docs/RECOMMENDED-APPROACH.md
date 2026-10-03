# Recommended Approach: Internal "Site Factory" (not a Lovable clone)

Context change: the goal is to deliver **multiple client/company website projects** with a
reusable foundation. It is not to sell a website builder to the public. That changes the
right answer. This replaces the SaaS-builder plan in `PLAN.md` as the starting point.

---

## 1. Why not build a Lovable-style SaaS?

| | SaaS builder (PLAN.md) | Site Factory (this doc) |
|---|---|---|
| Users | Anonymous non-technical public | Your own team (devs/designers) + client editors |
| What you build | Editor UI, auth, billing, multi-tenancy, AI pipeline, two exporters, CMS, hosting | Component kit, theme system, CMS config, generator CLI |
| Time to first client site | ~4–6 months | ~3–5 weeks |
| Maintenance | A product with its own roadmap and support load | A library that improves with every project |
| Flexibility per client | Limited to what the editor supports | Full code access when a client needs something custom |

A visual builder UI is the most expensive part of Lovable. Your team doesn't need it,
because they can edit code. Clients only need a **CMS** to edit content, not a builder.
Building the builder UI first is over-engineering for this use case.

Revisit the SaaS path only if (a) you do 30+ sites a year and non-developers must produce them,
or (b) you want to sell the builder itself.

---

## 2. The approach in one picture

```
            brief.yaml  (business, domain, pages, colors, fonts, template)
                │
                ▼
   ┌─────────────────────────┐      AI (Claude / OpenAI / Gemini via one adapter)
   │ create-site CLI         │◄──── generates site.json + copy + image queries
   └──────────┬──────────────┘      validated against shared zod schemas
              ▼
   new client repo (from template)
   ├─ theme.json          ← design tokens (colors, fonts, radius, spacing)
   ├─ content/            ← pages, sections, collections (JSON/MD) — edited via CMS
   ├─ keystatic/decap cfg ← generated from the same schemas
   └─ depends on @company/site-kit@x.y  (sections, layouts, utilities)
              │
              ▼
   astro build ─► dist/ = pure HTML/CSS (+ tiny JS islands) ─► any static host
```

---

## 3. Building blocks

### 3.1 `@company/site-kit` — the reusable core (monorepo, versioned)

| Package | Contents |
|---|---|
| `tokens` | Theme schema + presets. Tokens compile to CSS variables. Contrast check (WCAG AA). |
| `sections` | ~25–40 section components (hero, features, pricing, testimonials, FAQ, team, gallery, contact, blog list/detail, CTA, footer…) with 2–4 variants each. **Written in React (TSX)** so the same source works for static output and React apps. |
| `schema` | Zod schemas for every section's props and every collection. **Single source of truth** for the renderer, the CMS config and the AI generator. |
| `cms` | Generates CMS config (fields, collections) from `schema`. |
| `create-site` | CLI: brief → new repo from template + AI-generated content. |
| `templates` | 8–12 starter sites per vertical (restaurant, clinic, SaaS, agency, real estate, law, portfolio…). Each is just `theme.json` + `content/`. |

Versioning: Changesets + a private npm registry (GitHub Packages). Client sites pin a version
and upgrade deliberately. Without pinning, a kit change can break a live client site.

### 3.2 Framework: Astro + React components

- **Astro** renders React components to **static HTML with zero JS by default**. Interactive
  parts (menu, carousel, form) hydrate as small islands. That gives you the "pure HTML/CSS/JS" output.
- The same React section components drop into **Next.js or Vite** when a client needs a real
  React app. One component source covers both export targets, and no custom exporter is needed.
- Astro Content Collections validate content with zod, so they reuse the shared schemas.

Alternative: Next.js with `output: 'export'`. Pros: one framework for all projects.
Cons: ships React runtime JS on every page and needs more care for pure-static output.
Use it if most of your projects are app-like rather than brochure/marketing sites.

### 3.3 CMS: pick per client tier (same schemas drive all of them)

| Option | How editors work | Pros | Cons | Use when |
|---|---|---|---|---|
| **Keystatic** (git-based) | `/keystatic` admin UI; commits to repo; host rebuilds | Free, no server, great Astro support, typed | Editors need GitHub (or Keystatic Cloud) access | Default for brochure sites |
| **Sveltia/Decap CMS** (git-based) | `/admin` UI; commits to repo | Free, no server, portable, mature | Older UX (Decap); auth setup per host | Alternative to Keystatic |
| **Payload CMS** (self-hosted, multi-tenant) | One login portal for all your clients | Normal email/password logins, roles, media library, forms, drafts | You run a server + DB; backups and uptime are yours | Many clients, non-technical editors, frequent edits |
| **Sanity / Storyblok** (SaaS) | Hosted editor | Polished UX, no ops | Per-seat/per-project cost; vendor lock-in | Client pays and wants premium editing |

**Recommendation:** use Keystatic for v1. Add a shared multi-tenant Payload instance only when
client volume or editor UX demands it. Because the CMS config is generated from `schema`,
switching CMS later changes one adapter, not every site.

### 3.4 AI layer — small and offline, not a product

- `create-site` calls one adapter (Vercel AI SDK or LiteLLM) and supports Claude, OpenAI and
  Gemini. It uses whichever key is in `.env`.
- Calls are structured-output only: the model returns JSON that must pass the zod schemas.
  On failure: one repair retry, then fall back to the template defaults.
- Generates: sitemap, section choice/order, theme suggestion, copy, SEO meta, alt text and
  stock-image search queries (Unsplash/Pexels). AI image generation is optional (OpenAI/Gemini).
- Every AI-invented fact (prices, addresses, certifications, stats) is written as
  `"[[CONFIRM: …]]"`. A CI check fails the build while any placeholder remains.
- Your developers can also use an AI coding assistant such as Claude Code inside the repo for
  per-client customisation. Ship a `CLAUDE.md` in the template that explains the kit's conventions.

### 3.5 "Use another site as a template"

`create-site --inspired-by https://example.com` takes a screenshot (Playwright). A vision model
extracts **tokens** (palette, fonts, radius, spacing) and a **section outline** mapped to the
kit's sections. It copies no text, images or code, which avoids copyright and trade-dress problems.

---

## 4. Workflow per new client project

1. Fill `brief.yaml`, or answer the CLI prompts (business, audience, pages, tone, colors, fonts, template).
2. Run `npx @company/create-site brief.yaml`. This creates a repo, a theme, and AI content with `[[CONFIRM]]` markers.
3. A designer/developer reviews the site and customises it. Anything that is truly custom lives in the client repo's `src/custom/`.
4. The client fills in confirmations through the CMS.
5. CI runs schema validation, placeholder check, Lighthouse, axe accessibility check and a link check.
6. Deploy to Netlify / Vercel / Cloudflare Pages / the client's own host (it's just `dist/`).
7. **Harvest**: any custom section reused in 2+ projects is promoted into `site-kit`. This step
   is what makes the solution more reusable over time.

---

## 5. Risks

| Risk | Mitigation |
|---|---|
| Kit becomes a bottleneck / breaking changes hit live sites | Semver + pinned versions + visual regression tests (Playwright screenshots of every section variant) |
| Client sites look the same | Variants + tokens + custom slot; designers own the template library |
| Clients diverge so much they can't upgrade | Customisation only via documented slots; review "fork pressure" quarterly |
| Rich-text XSS from CMS | Render Markdown/portable text through sanitising renderer; CSP header in host config |
| Hallucinated business facts | `[[CONFIRM]]` markers + failing CI check |
| AI keys in repos | Keys only in local `.env` / CI secrets; generator never writes keys into output |
| Git-based CMS too hard for some clients | Payload tier (3.3) as escape hatch |

---

## 6. Roadmap

| Phase | Scope | Est. (2 devs) |
|---|---|---|
| 0 | Monorepo, tokens, schema package, Astro template, CI checks | 1 wk |
| 1 | 12–15 sections × 2 variants, Keystatic integration, 3 templates; **build first real client site with it** | 2–3 wks |
| 2 | `create-site` CLI + AI content generation (one provider), `[[CONFIRM]]` check | 1–2 wks |
| 3 | Multi-provider adapter, stock images, `--inspired-by`, more templates | 2 wks |
| 4 | Optional: multi-tenant Payload, React/Next app template, internal web UI for briefs | as needed |

Build the kit **alongside a real client project**, not in isolation. If the kit is designed in a
vacuum, it will be abstracted around the wrong things.

---

## 7. Open questions

1. How many sites per year, and how similar are they (brochure vs app-like)?
2. Who builds them: developers, designers, or non-technical staff? (Only the last group needs a builder UI.)
3. Who edits content after launch, and how often? (This decides Keystatic vs Payload.)
4. Who hosts: your company, or each client? Do clients get the code at handover?
5. Is a React app output actually required by any client, or is static HTML enough for most?
6. Common features needed: contact forms, bookings, multilingual, blog, e-commerce?
7. Which AI provider keys does the company already have and allow (data policy)?

Confidence: **high** that a kit + CLI beats a SaaS builder for in-house project delivery;
**medium** on the CMS choice until Q3/Q4 are answered.
