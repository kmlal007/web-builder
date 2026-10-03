# Template-Based, Isolated Customer Sites

Builds on [RECOMMENDED-APPROACH.md](RECOMMENDED-APPROACH.md). Requirements:

1. A customer selects a template.
2. The template can be customized.
3. Each customer website is maintained **in isolation**.

---

## 1. The core tension: isolation vs reuse

Full isolation (each site is a copy) and full reuse (one shared codebase) pull in opposite directions.

| Option | How | Pros | Cons | When |
|---|---|---|---|---|
| **A. Copy-on-create ("eject")** | Template files are copied into the customer repo; no shared dependency | Total isolation; simplest; customer owns everything | Bug/security fixes must be hand-applied to every site; designs drift; by ~10 sites maintenance hurts | Few customers, one-off projects, sites handed over and never touched again |
| **B. Per-customer repo + pinned shared kit** (recommended) | Customer repo holds theme, content, config and custom code; sections come from `@company/site-kit@x.y` | Isolated code, content, hosting and release cadence; fixes reach every site as opt-in upgrade PRs | Needs kit versioning discipline and per-repo CI | Ongoing maintenance of many customer sites |
| **C. Multi-tenant platform** | One app, customers are rows in a DB | Cheapest to operate | **Not isolated.** One bug, outage or breach hits every customer | Self-serve SaaS at scale. This contradicts the requirement |

**Recommendation: B.** Support A as an explicit "eject" for customers who take full ownership at handover.

---

## 2. What a template is

A template is **data plus a kit version**. It contains no forked code:

```
templates/restaurant-classic/
├─ template.json      # manifest
├─ theme.json         # default tokens
├─ pages/*.json       # page → sections[] (type, variant, props)
├─ collections/       # seed content: menu items, testimonials, posts
├─ assets/            # licensed demo images (replaced per customer)
└─ preview.png
```

```jsonc
// template.json
{
  "id": "restaurant-classic",
  "version": "1.2.0",
  "kit": "^2.0.0",                       // compatible site-kit range
  "verticals": ["restaurant", "cafe"],
  "pages": ["home", "menu", "about", "contact", "blog"],
  "collections": ["menuItems", "testimonials", "posts"],
  "customizable": {                     // what the configurator exposes
    "theme": ["colors.primary", "colors.accent", "fonts.heading", "fonts.body", "radius", "logo"],
    "sections": { "allowAdd": true, "allowReorder": true, "allowVariantSwap": true }
  }
}
```

Templates live in the kit monorepo and are versioned with it. A demo site per template is built
automatically for the gallery.

---

## 3. Customization levels

| Level | What changes | Who | Where it is stored |
|---|---|---|---|
| L1 Brand | Colors, fonts, logo, radius, spacing | Customer (configurator) or team | `theme.json` |
| L2 Content | Text, images, menu items, posts, SEO | Customer editors | `content/` via CMS |
| L3 Structure | Add/remove/reorder pages and sections, swap variants | Team (customer optionally, via configurator) | `pages/*.json` |
| L4 Custom code | Bespoke section, integration, override | Team developers | `src/custom/` (customer repo only) |

Rule: **L1–L3 are data and never break kit upgrades.** L4 is the only place upgrades can
conflict. Custom code uses documented slots only, never patches of kit internals.

---

## 4. Isolation model, per customer

| Dimension | Isolation mechanism |
|---|---|
| Code | One Git repo per customer (`site-<customer>`), created from the template by `create-site` |
| Content | Git-based CMS (Keystatic) inside that repo. Content never leaves the customer's repo |
| Access | Per-repo permissions; customer editors only get access to their own repo/CMS |
| Hosting | One hosting project per customer (Netlify/Vercel/Cloudflare Pages site), own domain + SSL |
| Secrets | Per-project env vars (form endpoint, analytics, AI key if any). No shared tokens |
| Releases | Each site pins its kit version and deploys on its own schedule |
| Failure blast radius | A bad kit release only affects sites that merge the upgrade, after their own CI passes |
| Ownership/handover | Repo can be transferred to the customer's GitHub org, or ejected (Option A) |

A shared multi-tenant CMS (Payload/Strapi) would break content isolation. If a customer needs
a server CMS, give them **their own instance** and accept the extra hosting cost for that customer.

---

## 5. Lifecycle

```
Gallery ──► Select template ──► Configure (L1 + pages) ──► create-site
                                                              │
     ┌────────────────────────────────────────────────────────┘
     ▼
site-<customer> repo  ──► CI (schema, [[CONFIRM]] check, Lighthouse, axe, visual diff)
     │                         │
     │                         ▼
     │                 own hosting project ──► customer domain
     ▼
Customer edits content via /keystatic ──► commit ──► rebuild ──► deploy
     ▲
Renovate bot: "Bump site-kit 2.3 → 2.4" PR ──► CI + visual diff ──► team merges
```

- **Gallery:** a static site built from `templates/`, with live demos plus filters by vertical.
- **Configurator** (optional, phase 3): a small web form that picks the template, colors, fonts,
  logo and pages, with live preview. It **only writes `brief.yaml` + `theme.json`**. It is not
  a page builder, so it stays cheap. Until then, your team runs the configuration with the customer.
- **Upgrades across many repos:** Renovate (or Dependabot) opens a version-bump PR in every
  customer repo. Visual regression screenshots show exactly what changed for that customer.
  Security fixes are back-ported to the previous kit major version.

---

## 6. Repositories

```
company/site-kit                 # monorepo (private)
├─ packages/tokens, sections, schema, cms, create-site
├─ templates/<id>/
├─ apps/gallery                  # template showcase
└─ apps/configurator             # later

company/site-acme-dental         # one per customer (private)
├─ theme.json, content/, pages/
├─ src/custom/                   # L4 only
├─ keystatic.config.ts           # generated from kit schema
├─ site.lock.json                # template id+version, kit version, generation metadata
└─ .github/workflows/ci.yml      # reusable workflow from site-kit
```

`site.lock.json` records which template version the site started from. This lets you answer
"which customers use template X v1.1?" and target fixes.

---

## 7. Risks

| Risk | Mitigation |
|---|---|
| Customers lag many versions behind | Support policy: current + previous major; dashboard listing each site's kit version |
| L4 custom code blocks upgrades | Slots-only rule; code review; visual diff on upgrade PRs |
| Template changes after customers adopted it | Templates only seed new sites; existing sites own their data copy. Template fixes ship as kit section fixes |
| Per-customer ops overhead (N repos, N deploys) | Reusable CI workflow, Renovate, scripted repo/hosting creation |
| Customer self-customization produces poor designs | Configurator limits options to the template's `customizable` list; contrast check |
| Demo images licensing | Only licensed/CC0 assets in templates; replaced at site creation |

---

## 8. Updated roadmap

| Phase | Scope |
|---|---|
| 0 | Kit monorepo, tokens, schema, template manifest format, reusable CI workflow |
| 1 | 12–15 sections, 2–3 templates, `create-site` (template → isolated repo), Keystatic; first real customer |
| 2 | Gallery site, Renovate upgrade flow, visual regression, `site.lock.json` inventory |
| 3 | AI content fill in `create-site`; `--inspired-by` |
| 4 | Self-service configurator with live preview; optional per-customer server CMS |

---

## 9. Questions that change the design

1. Does the **customer** pick and customize the template self-service, or does your team do it with them?
   Self-service moves the configurator from phase 4 to phase 1.
2. Whose GitHub org and hosting account owns each site: yours or the customer's?
3. Should customer sites receive kit fixes over time (Option B), or be frozen at handover (Option A)?
4. Expected number of customer sites in the first year?
