import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import { checkSite, formatReport } from "../src/cli/check.ts";
import { createSite, kitPackage, kitRoot, listTemplates, toPackageName } from "../src/cli/create.ts";
import { ContentError, findPlaceholders, loadSite } from "../src/content/index.ts";
import { pageSchema, sectionSchema, themeSchema, type Section } from "../src/schema/index.ts";
import { PageView, SectionView, sectionTypes } from "../src/sections/index.tsx";
import { checkThemeContrast, contrastRatio, readableOn, themeToCss } from "../src/tokens/index.ts";

const tmpDirs: string[] = [];
function tmp(): string {
  const dir = mkdtempSync(join(tmpdir(), "site-kit-"));
  tmpDirs.push(dir);
  return dir;
}
afterEach(() => {
  for (const d of tmpDirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

const readJson = (path: string) => JSON.parse(readFileSync(path, "utf8"));
const writeJson = (path: string, data: unknown) => writeFileSync(path, JSON.stringify(data, null, 2));

function newSite(overrides: Partial<Parameters<typeof createSite>[0]> = {}) {
  const dir = join(tmp(), "site");
  const result = createSite({ dir, template: "business-starter", customer: "Acme Dental", ...overrides });
  return { dir, result };
}

describe("templates", () => {
  it.each(listTemplates().map((t) => t.id))("%s loads and validates", (id) => {
    const loaded = loadSite(join(kitRoot(), "templates", id));
    expect(loaded.pages.some((p) => p.slug === "home")).toBe(true);
    expect(checkThemeContrast(loaded.theme)).toEqual([]);
  });
});

describe("schema", () => {
  it("rejects unknown section types and bad colors", () => {
    expect(sectionSchema.safeParse({ type: "carousel" }).success).toBe(false);
    const theme = readJson(join(kitRoot(), "templates/business-starter/theme.json"));
    theme.colors.primary = "blue";
    expect(themeSchema.safeParse(theme).success).toBe(false);
  });

  it("rejects javascript: links", () => {
    const res = sectionSchema.safeParse({
      type: "cta",
      heading: "Hi",
      action: { label: "x", href: "javascript:alert(1)" },
    });
    expect(res.success).toBe(false);
  });

  it("rejects slugs that are not URL-safe", () => {
    const page = { slug: "About Us", title: "About", sections: [{ type: "text", paragraphs: ["x"] }] };
    expect(pageSchema.safeParse(page).success).toBe(false);
  });
});

describe("tokens", () => {
  it("computes WCAG contrast", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(readableOn("#ffffff")).toBe("#000000");
    expect(readableOn("#1f5fbf")).toBe("#ffffff");
  });

  it("flags low-contrast themes", () => {
    const theme = themeSchema.parse(readJson(join(kitRoot(), "templates/business-starter/theme.json")));
    theme.colors.muted = "#dddddd";
    expect(checkThemeContrast(theme).map((i) => i.pair)).toContain("muted on background");
  });

  it("cannot break out of the style element via font names", () => {
    const theme = themeSchema.parse(readJson(join(kitRoot(), "templates/business-starter/theme.json")));
    theme.fonts.body = "x}</style><script>alert(1)</script>";
    const css = themeToCss(theme);
    expect(css).not.toMatch(/<|>/);
    expect(css.match(/\}/g)).toHaveLength(1);
  });
});

describe("sections", () => {
  it("every registered type has a schema variant and renders", () => {
    const samples: Section[] = [
      { type: "hero", variant: "split", heading: "H", image: { src: "/a.jpg", alt: "a" } },
      { type: "features", variant: "grid", heading: "F", items: [{ title: "t", body: "b" }] },
      { type: "text", paragraphs: ["p"] },
      { type: "testimonials", heading: "T", items: [{ quote: "q", author: "a" }] },
      { type: "cta", heading: "C", action: { label: "Go", href: "/contact" } },
      { type: "contact", heading: "Contact", email: "a@b.co", hours: [{ days: "Mon", time: "9-5" }] },
    ];
    expect(samples.map((s) => s.type).sort()).toEqual([...sectionTypes].sort());
    for (const s of samples) {
      expect(renderToStaticMarkup(<SectionView section={sectionSchema.parse(s)} />)).toContain("sk-section");
    }
  });

  it("escapes content instead of rendering HTML", () => {
    const html = renderToStaticMarkup(
      <SectionView section={{ type: "text", paragraphs: ['<script>alert("x")</script>'] }} />,
    );
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("marks the current page in navigation", () => {
    const loaded = loadSite(join(kitRoot(), "templates/business-starter"));
    const about = loaded.pages.find((p) => p.slug === "about")!;
    const html = renderToStaticMarkup(<PageView site={loaded.site} page={about} />);
    expect(html).toContain('<a href="/about" aria-current="page">About</a>');
  });
});

describe("content loading", () => {
  it("reports broken internal links and slug/file mismatches together", () => {
    const { dir } = newSite();
    const site = readJson(join(dir, "content/site.json"));
    site.nav.push({ label: "Missing", href: "/pricing" });
    writeJson(join(dir, "content/site.json"), site);
    const about = readJson(join(dir, "content/pages/about.json"));
    about.slug = "team";
    writeJson(join(dir, "content/pages/about.json"), about);

    try {
      loadSite(dir);
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(ContentError);
      const problems = (err as ContentError).problems.join("\n");
      expect(problems).toMatch(/"\/pricing" does not match any page/);
      expect(problems).toMatch(/slug "team" must match the file name/);
    }
  });

  it("finds [[CONFIRM]] placeholders with their location", () => {
    const loaded = loadSite(join(kitRoot(), "templates/business-starter"));
    const found = findPlaceholders(loaded);
    expect(found.length).toBeGreaterThan(0);
    expect(found.some((f) => f.startsWith("content/pages/contact.json") && f.includes("phone number"))).toBe(true);
  });
});

describe("create-site", () => {
  it("creates an isolated customer repo with brand overrides and a lock file", () => {
    const { dir, result } = newSite({ primary: "#0f766e", headingFont: "serif", now: new Date("2026-01-02T00:00:00Z") });

    const pkg = readJson(join(dir, "package.json"));
    expect(pkg.name).toBe("site-acme-dental");
    expect(pkg.dependencies[kitPackage().name]).toBe(`^${kitPackage().version}`);

    const theme = readJson(join(dir, "theme.json"));
    expect(theme.colors.primary).toBe("#0f766e");
    expect(theme.fonts.heading).toContain("Georgia");
    expect(readJson(join(dir, "content/site.json")).name).toBe("Acme Dental");

    expect(readJson(join(dir, "site.lock.json"))).toEqual({
      customer: "Acme Dental",
      template: { id: "business-starter", version: "1.0.0" },
      kit: kitPackage(),
      createdAt: "2026-01-02T00:00:00.000Z",
      status: "managed",
    });
    expect(result.contrastIssues).toEqual([]);

    // Publish-safe names are restored and placeholders filled.
    expect(existsSync(join(dir, ".gitignore"))).toBe(true);
    expect(existsSync(join(dir, ".github/workflows/ci.yml"))).toBe(true);
    expect(readFileSync(join(dir, "src/pages/[...slug].astro"), "utf8")).toContain(`${kitPackage().name}/content`);
    expect(readFileSync(join(dir, ".github/workflows/ci.yml"), "utf8")).toContain("${{ github.ref");
  });

  it("refuses to overwrite a non-empty directory", () => {
    const { dir } = newSite();
    expect(() => createSite({ dir, template: "business-starter", customer: "Other" })).toThrow(/not empty/);
  });

  it("rejects unknown templates and invalid colors", () => {
    expect(() => newSite({ template: "nope" })).toThrow(/Unknown template "nope"/);
    expect(() => newSite({ primary: "red" })).toThrow();
  });

  it("derives safe package names", () => {
    expect(toPackageName("Café & Bar #1")).toBe("site-cafe-bar-1");
    expect(() => toPackageName("!!!")).toThrow();
  });
});

describe("check", () => {
  it("passes in dev mode but blocks launch while placeholders remain", () => {
    const { dir } = newSite();
    const report = checkSite(dir);
    expect(report.errors).toEqual([]);
    expect(formatReport(report, false).ok).toBe(true);
    expect(formatReport(report, true).ok).toBe(false);
  });

  it("fails on low contrast", () => {
    const { dir } = newSite();
    const theme = readJson(join(dir, "theme.json"));
    theme.colors.text = "#eeeeee";
    writeJson(join(dir, "theme.json"), theme);
    expect(checkSite(dir).errors.some((e) => e.includes("text on background"))).toBe(true);
  });
});
