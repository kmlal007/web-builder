# Decisions (current)

Supersedes the open questions in the earlier docs.

## Inputs (from stakeholder)

| Question | Answer |
|---|---|
| Who customizes? | Our team by default; may be shared with the customer |
| Who owns repos/hosting? | We do by default; ownership can be transferred to the customer |
| Kit updates? | Yes, while we are the owner |
| Volume | Max ~10 sites per year |

## Decisions

| # | Decision | Rationale | Revisit when |
|---|---|---|---|
| 1 | One repo per customer + pinned `site-kit` dependency (Option B) | Isolation of code, content, hosting, releases; fixes still reusable | — |
| 2 | **Eject on transfer**: copy the pinned kit into the customer repo, set `site.lock.json` status to `ejected` | A transferred repo cannot install our private package; matches "updates only while we own it" | — |
| 3 | **One** package (`@kmlal007/site-kit`) with subpath exports, not 5 packages | ~10 sites/year does not justify multi-package versioning | Kit grows a second consumer type |
| 4 | No configurator UI, no gallery app, no Renovate yet | Team does customization; 10 sites can be upgraded by a script | >25 managed sites, or customers self-serve |
| 5 | Astro, static output, React section components, **zero client JS** | Pure HTML/CSS export; same components reusable in a React app | A customer needs app-like interactivity |
| 6 | Content = JSON files in the site repo, section shape `{ "type": ..., ...props }` | CMS-neutral; readable by Decap/Sveltia natively, mappable to Keystatic | Phase 1 CMS choice |
| 7 | System font stacks only | No third-party font requests (performance, GDPR); self-hosted fonts later | Brand requires a specific typeface |
| 8 | Plain-text content fields only (no HTML/Markdown yet) | XSS-safe by construction | Blog/rich text needed → add sanitized Markdown |
| 9 | `[[CONFIRM: ...]]` placeholders block `check:launch`, not `build` | Team can develop with template copy; nothing unconfirmed goes live | — |
| 10 | Package scope `@kmlal007` | Required by GitHub Packages (scope = repo owner) | Move to a company GitHub org → rename scope |

## Phase 1 decision still open: which CMS

Clients "may" edit content. The candidates differ in hosting impact:

| Option | Hosting impact | Editor login | Fit |
|---|---|---|---|
| **Sveltia CMS** (Decap-compatible) | Pure static `/admin` page; needs a tiny GitHub OAuth worker (Cloudflare, free) unless on Netlify | GitHub account | Best fit for "pure static" + eject; reads our JSON shape as-is |
| **Keystatic** | Admin routes need a server adapter in production (pages stay static) | GitHub, or Keystatic Cloud | Nicer UX; ties hosting to an adapter-capable platform |
| No CMS (team edits JSON via PRs) | None | — | Acceptable if customers rarely edit |

Recommendation: Sveltia for sites where the customer edits; none where we do all edits.
**Needs confirmation:** do your customers have (or accept) GitHub accounts for editing?

## Status

Phase 0 is done (this commit):
- Kit with 6 section types: hero (2 variants), features (2 variants), text, testimonials, cta, contact.
- Theme tokens with WCAG AA checks.
- Content validation, plus checks for internal links and placeholders.
- Template `business-starter`.
- `site-kit create` and `site-kit check`.
- CI for the kit and for generated sites.
- End-to-end test: pack the kit, generate a site, install it and build it.

Next, Phase 1:
- CMS integration (after the decision above).
- A second and third template.
- Image support in templates.
- `site-kit eject`.
- Publishing to GitHub Packages.
