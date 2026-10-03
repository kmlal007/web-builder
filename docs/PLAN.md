# AI Website Builder — Brainstorm & Plan

Status: **Draft for review.** Several open decisions (section 3) block implementation.

---

## 1. Problem statement

Non-technical users (and possibly agencies) want a production-ready marketing/business
website from a short brief, with content they can keep editing afterwards, exportable
as static HTML/CSS/JS or a React app and deployable anywhere.

Requested capabilities:

1. Guided intake: business context, domain, optional theme / colors / fonts.
2. AI-generated copy and images (OpenAI / Claude / Gemini / others, depending on available keys).
3. Template gallery: in-house templates, plus "use this other site as a template".
4. Built-in content management for every generated site.
5. Export as pure HTML/CSS/JS **or** React; deploy anywhere.

---

## 2. Challenges to the requirements (read first)

### 2.1 "Copy the design of other sites" — legal and technical risk

Copying another site's markup, CSS, images or copy is copyright and trade-dress infringement
in most jurisdictions. Scraping can also breach the site's terms of service. A product built
around that is a liability for you and your users.

**Recommendation:** support *"inspired by a URL"*, not *"clone a URL"*:

- Take a screenshot and DOM of the reference page.
- Extract only **non-protectable abstractions**: color palette, type scale, spacing rhythm,
  section order (hero → features → testimonials → CTA), density, corner radius, image style.
- Map those onto **our own** component library and generate **new** copy and images.
- Never copy text, images, logos, or raw HTML/CSS.

Technically this is also the better approach. Cloned HTML is unmaintainable and can't be
driven by a CMS. Mapping the reference onto our own components keeps every site editable.

### 2.2 "Pure HTML/CSS/JS export" vs "CMS built in" — these conflict

A static site has no server, so editing content needs *something* running somewhere.
This is the most important architecture decision (see D1).

### 2.3 "Just like Lovable" — scope

Lovable generates arbitrary full-stack code. That is a very large problem: arbitrary code
is hard to validate, hard to attach a CMS to, and hard to export to two targets.
For a product that is **dedicated to websites**, a **schema-driven** approach is simpler and
more reliable (see section 4.1). We give up some freedom and gain correctness, a CMS that
comes for free, and both export targets.

### 2.4 Image generation is not uniform across providers

Claude does not generate images. OpenAI (gpt-image) and Google (Imagen/Gemini) do.
Image generation is the most expensive and slowest step, and quality varies.
**Recommendation:** start with stock images (Unsplash/Pexels APIs) selected by AI-written
search queries. Offer AI image generation as an optional upgrade.

### 2.5 "Use whichever model is available" — keep it thin

A provider abstraction is justified (BYOK, failover, cost routing), but don't build a
framework. Use an existing SDK (e.g. Vercel AI SDK or LiteLLM) with one `generateStructured()`
seam. Different models produce different quality, so a fixed eval set is needed to keep output
consistent when routing changes.

---

## 3. Open decisions (need your input)

| # | Question | Why it matters |
|---|----------|----------------|
| D1 | After export, where does the CMS live? | Defines the whole runtime architecture (options in 4.4) |
| D2 | Target users: SMB owners, freelancers/agencies, or developers? | Drives UX: wizard vs code access, white-labelling |
| D3 | Who pays for the AI calls: the platform (subscription) or the user (BYOK)? | Cost model, key storage, abuse risk |
| D4 | Site scope: marketing sites + blog only, or also forms, e-commerce, auth, booking? | Each one adds a backend dependency to "static" export |
| D5 | Do we host sites (like Lovable), or export-only? | Hosting = ops, SSL, domains, abuse handling; export-only = simpler |
| D6 | Team size, timeline, budget? | Decides how much of the roadmap is realistic |
| D7 | Multilingual sites? SEO requirements? Accessibility (WCAG AA)? | Changes the content model from day 1 |
| D8 | Expected scale (sites/month, concurrent generations)? | Queueing and rate-limit design |

---

## 4. Architecture proposal

### 4.1 Core idea: the site is data, not code

```
Site
 ├─ theme: design tokens (colors, fonts, radius, spacing, shadows)
 ├─ pages[]: { slug, seo, sections[] }
 │    └─ section: { type: "hero", variant: "split-image", props: {...}, contentRef? }
 ├─ collections[]: blog posts, team, testimonials, FAQs, services, products
 └─ assets[]: images, logos, files
```

- The AI fills in a **typed JSON document** that is validated with a schema (zod / JSON Schema).
  It never writes free-form code.
- A **component library** of about 30–40 section types × 2–4 variants renders it.
- **CMS**: content already lives apart from layout, so content editing is a form generated from
  the section schema, plus collection CRUD.
- **Exports**: the same document goes through two renderers, static HTML and a React project.
- **Templates** are documents too: preset tokens + section composition + sample content.

#### Option A — Schema-driven (recommended)
- Pros: deterministic, validated output; CMS falls out naturally; two exports from one source;
  cheaper prompts; easy regeneration of one section; testable.
- Cons: users can only build what the component library covers; less "wow" freedom; library is ongoing work.
- When: a product dedicated to websites, for non-technical users.

#### Option B — Free-form code generation (Lovable-style)
- Pros: unlimited layouts; fast demo value.
- Cons: CMS must be retrofitted onto arbitrary code; output breaks often; two export targets are
  hard to maintain; security review of generated JS; costly iterations.
- When: developer audience that wants to own and edit code.

#### Option C — Hybrid (later)
Schema-driven by default, with an escape-hatch "custom section" that holds AI-generated
HTML/CSS. It is sandboxed, has no JS by default, and its content fields are marked for the CMS.
Add this only after A is stable.

### 4.2 System components (modular monolith, no microservices)

```
┌─────────────────────────── Builder App (Next.js) ───────────────────────────┐
│ Intake wizard │ Template gallery │ Visual editor/preview │ CMS │ Export/Deploy │
└──────────────┬───────────────────────────────────────────────────────────────┘
               │ API routes / server actions
┌──────────────▼───────────────────────────────────────────────────────────────┐
│ Domain modules: projects · sites(versioned JSON) · content · assets · templates│
│ AI module: provider adapter · prompt pipeline · schema validation · cost meter │
│ Render module: html-renderer · react-exporter (shared section components)      │
│ Jobs: Postgres-backed queue (pg-boss / Graphile Worker) — no Kafka/Rabbit       │
└──────────────┬───────────────────────────────────────────────────────────────┘
        Postgres (JSONB for site docs) · S3-compatible storage (assets, exports)
        Optional: Playwright worker for "inspired-by URL" screenshots
```

No separate queue infrastructure is needed at first. A Postgres-backed job table covers
generation, image fetch and export jobs until volume proves otherwise.

### 4.3 Generation pipeline

1. **Intake**: business name, domain/industry, audience, goals, tone, pages wanted, optional
   colors/fonts/logo, optional reference URL or template. Missing fields → AI asks follow-ups.
2. **Brief**: the LLM normalises the intake into a structured brief (validated).
3. **Information architecture**: sitemap and section list per page, picked from the component catalog.
4. **Theme**: user choices, or template tokens, or reference-URL tokens, or AI-generated tokens.
   Contrast is checked (WCAG AA) and auto-fixed.
5. **Content**: copy per section (streamed). Collections are seeded (3 blog posts, FAQs, etc.).
6. **Media**: stock search queries, optional AI image generation, alt text.
7. **Validate and repair**: schema validation; one repair retry for invalid output, then a fallback to
   template defaults.
8. **Preview**: render live. Users can regenerate any section or field on its own
   ("make this more formal").

Every step is idempotent and stored, so a failed step resumes without re-running (and re-paying for) the whole pipeline.

### 4.4 CMS after export (decision D1)

| Option | How | Pros | Cons | When |
|---|---|---|---|---|
| **1. Hosted headless CMS (ours)** | Exported site reads content at build time; editing in our dashboard triggers rebuild/redeploy (webhook) | Best UX; one CMS for all sites | Users depend on our service; we run infra | You host or run a SaaS |
| **2. Git-based CMS** | Export includes `content/*.json|md` + Decap/Tina/Sveltia admin at `/admin`; edits commit to the user's GitHub repo → host rebuilds | No backend from us; truly portable; free | Needs GitHub + Netlify/Vercel; more setup for non-tech users | Export-first, developer-adjacent users |
| **3. Builder-only editing** | Content edited only inside our app; re-export/redeploy | Simplest | "CMS" stops at export | MVP only |
| **4. Runtime fetch from our API** | Static JS fetches content at runtime | Instant edits | Worse SEO/perf, our uptime = their uptime | Rarely; avoid |

**Recommendation:** Option 3 for MVP (the builder *is* the CMS). Then Option 2 for exports,
because it keeps the "pure HTML/JS, deploy anywhere" promise. Add Option 1 if/when you host sites.

### 4.5 Export targets

- **Static HTML/CSS/JS**: prerender each page with React `renderToStaticMarkup` using the same
  components. Generate a CSS file from tokens (CSS variables + minimal utility CSS, purged).
  Add small vanilla JS only for interactive sections (menu, carousel, accordion). Include
  sitemap.xml, robots.txt, meta/OG tags, and optimised images.
- **React**: Vite + React project with the section components copied in, plus `content/*.json` and
  `theme.json`. Clean, readable, runs with `npm install && npm run build`.
  (Consider Astro as a third target later. It is the natural fit for content sites.)
- **Deploy**: ZIP download first. Then one-click Netlify / Vercel / Cloudflare Pages / GitHub Pages
  through their APIs and OAuth.

### 4.6 Templates

- **In-house**: about 10–15 curated templates per vertical (restaurant, clinic, SaaS, agency,
  portfolio, real estate, law firm…). Each one is a site document plus a preview screenshot.
- **Inspired-by URL**: a Playwright screenshot plus computed styles feed a vision model, which
  returns tokens and a section outline mapped to our catalog. A text-similarity check against the
  source blocks copied copy.
- **Third-party**: only templates with explicit licences (MIT/CC0) are converted into our schema
  and given attribution.

### 4.7 AI provider layer

- Interface: `generateObject(schema, prompt, opts)`, `streamText(...)`, `generateImage(...)`.
- Provider registry ordered by configured keys + capability (text/vision/image) + cost tier.
- Failover on 429/5xx/timeouts. Retry with backoff. Per-user and per-site token budgets.
- Track model, tokens, cost, latency and validation failures for every call.
- Prompt and response logs are redacted and kept for a fixed retention period.
- Eval suite: about 20 fixed briefs → snapshot outputs → schema pass rate + rubric (LLM-as-judge
  + human spot check). Run it whenever prompts or models change.

---

## 5. Risk assessment

| Risk | Impact | Mitigation |
|---|---|---|
| Copyright/trade dress from copying sites | Legal | "Inspired-by" token extraction only; no asset/text copy; ToS + DMCA process |
| Prompt injection via reference URL content | Hijacked generation, junk content | Treat scraped content as data; extract via vision on screenshot; strict output schema |
| XSS via CMS rich text / custom sections | Compromised exported sites | Sanitize (DOMPurify) at save and at render; no user JS by default; CSP in exports |
| API key leakage (BYOK) | Financial abuse | Encrypt at rest (KMS/envelope); never send to client; scoped usage |
| AI cost blow-up / abuse | Margin loss | Quotas, rate limits, caching, cheap model for drafts, expensive for final |
| Inconsistent output across models | Bad UX | Schema validation, repair step, eval suite, model pinning |
| Hallucinated business facts (prices, certifications, addresses) | Legal/trust | Mark AI-invented facts as placeholders that need user confirmation before publish |
| Component library too limited | Users churn | Prioritize by template demand; hybrid custom section later |
| Two export targets diverging | Bugs | Single component source; visual regression tests (Playwright screenshots) on both exports |
| Accessibility/SEO regressions | Poor sites | Automated axe + Lighthouse checks in export pipeline |

---

## 6. Non-functional requirements

- **Observability**: structured logs, a trace ID for every generation run, and per-step timings.
  Per-site metrics: AI cost, error rates by provider, and export success rate.
- **Versioning / rollback**: every save writes a new immutable site version. Users can restore any
  version. Deploys record the version they shipped.
- **Testing**: schema unit tests, renderer snapshot tests, Playwright visual tests for every section
  variant, export build tests (static + React builds compile), and the AI eval suite.
- **Security**: auth (e.g. Auth.js/Clerk), tenant isolation on every query, signed asset URLs,
  rate limiting.
- **Performance targets** (proposed): first preview in under 30 s and full site in under 90 s.
  Exported pages should score Lighthouse ≥ 90 for performance and accessibility.

---

## 7. Phased roadmap

**Phase 0 — Foundations (1–2 wks)**
Repo, Next.js + TypeScript, Postgres (Prisma/Drizzle), auth, site document schema v1, CI.

**Phase 1 — MVP (4–6 wks)**
- Intake wizard → single-provider AI (one model) → schema-validated site doc.
- ~15 section types × 2 variants, theme tokens, 5 in-house templates.
- Live preview + section-level regenerate.
- Builder-as-CMS: edit text/images/collections (blog, testimonials, FAQ).
- Stock images (Unsplash/Pexels).
- Export: static HTML ZIP.
- Exit criteria: 20 eval briefs produce valid, good-looking sites; export passes Lighthouse ≥ 90.

**Phase 2 — Multi-provider + React export (3–4 wks)**
Provider registry (OpenAI, Anthropic, Gemini), failover, cost metering, BYOK. React (Vite) export.
AI image generation (optional). Version history.

**Phase 3 — Portable CMS + deploy (3–4 wks)**
Git-based CMS in exports (Decap/Tina/Sveltia) with GitHub integration; one-click deploy to
Netlify/Vercel/Cloudflare Pages.

**Phase 4 — Inspired-by URL + template marketplace (3–4 wks)**
Playwright + vision token extraction, section mapping, copy-similarity guard; licensed template imports.

**Phase 5 — Optional**
Hosted sites + custom domains, forms backend, multilingual, hybrid custom sections, Astro export,
team collaboration.

---

## 8. Suggested stack (tradeoffs, not mandates)

| Concern | Choice | Alternative | Why |
|---|---|---|---|
| App | Next.js (App Router) + TS | Remix, SvelteKit | Same React components power editor, preview, and both exports |
| DB | Postgres (JSONB site docs) | MongoDB | Relational for users/billing + JSONB for docs; one DB |
| Jobs | pg-boss / Graphile Worker | BullMQ+Redis | No extra infra until scale demands |
| Storage | S3 / R2 | Local FS | Assets and export ZIPs |
| AI | Vercel AI SDK | LiteLLM, raw SDKs | Structured output + streaming across providers |
| Styling of generated sites | CSS variables + small utility layer | Tailwind in output | Exports stay framework-free and small |
| Editor | Form-based props + inline text edit | Full drag-and-drop canvas (GrapesJS/Puck) | Puck is worth evaluating in Phase 2+ |

---

## 9. Confidence

- Architecture (schema-driven, modular monolith): **high**.
- CMS-after-export recommendation: **medium**, depends on D1/D5.
- Timeline: **low**, depends on D6 (team size) — estimates assume 2–3 engineers.
