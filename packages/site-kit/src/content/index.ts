import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import type { z } from "zod";
import {
  pageSchema,
  siteConfigSchema,
  siteLockSchema,
  themeSchema,
  type Page,
  type SiteConfig,
  type SiteLock,
  type Theme,
} from "../schema/index.ts";

/**
 * Customer site repo layout (relative to the site root):
 *   theme.json                design tokens
 *   site.lock.json            template + kit provenance
 *   content/site.json         name, nav, footer
 *   content/pages/<slug>.json one file per page
 */
export interface LoadedSite {
  root: string;
  theme: Theme;
  site: SiteConfig;
  pages: Page[];
  lock?: SiteLock;
}

export class ContentError extends Error {
  constructor(public readonly problems: string[]) {
    super(`Invalid site content:\n  - ${problems.join("\n  - ")}`);
    this.name = "ContentError";
  }
}

function readJson<S extends z.ZodType>(
  root: string,
  file: string,
  schema: S,
  problems: string[],
): z.infer<S> | undefined {
  const path = join(root, file);
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(path, "utf8"));
  } catch (err) {
    problems.push(`${file}: ${(err as Error).message}`);
    return undefined;
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    for (const issue of result.error.issues) {
      problems.push(`${file}: ${issue.path.join(".") || "(root)"}: ${issue.message}`);
    }
    return undefined;
  }
  return result.data;
}

/** Loads and validates all content. Throws ContentError listing every problem at once. */
export function loadSite(root: string): LoadedSite {
  const problems: string[] = [];
  const theme = readJson(root, "theme.json", themeSchema, problems);
  const site = readJson(root, "content/site.json", siteConfigSchema, problems);
  const lock = existsSync(join(root, "site.lock.json"))
    ? readJson(root, "site.lock.json", siteLockSchema, problems)
    : undefined;

  const pagesDir = join(root, "content/pages");
  const pageFiles = existsSync(pagesDir) ? readdirSync(pagesDir).filter((f) => f.endsWith(".json")).sort() : [];
  const pages: Page[] = [];
  for (const file of pageFiles) {
    const rel = relative(root, join(pagesDir, file));
    const page = readJson(root, rel, pageSchema, problems);
    if (!page) continue;
    if (`${page.slug}.json` !== file) problems.push(`${rel}: slug "${page.slug}" must match the file name`);
    pages.push(page);
  }
  if (!pages.some((p) => p.slug === "home")) problems.push("content/pages/home.json is required");

  if (site) problems.push(...checkInternalLinks(site, pages));
  if (problems.length > 0 || !theme || !site) throw new ContentError(problems);
  return { root, theme, site, pages, lock };
}

export function pagePath(slug: string): string {
  return slug === "home" ? "/" : `/${slug}`;
}

/** Internal links ("/about", "/about#team") must point at an existing page. */
export function checkInternalLinks(site: SiteConfig, pages: Page[]): string[] {
  const known = new Set(pages.map((p) => pagePath(p.slug)));
  const problems: string[] = [];
  const visit = (value: unknown, where: string) => {
    if (Array.isArray(value)) value.forEach((v, i) => visit(v, `${where}.${i}`));
    else if (value && typeof value === "object") {
      for (const [k, v] of Object.entries(value)) {
        if (k === "href" && typeof v === "string" && v.startsWith("/")) {
          const path = v.split(/[?#]/)[0]!.replace(/\/$/, "") || "/";
          if (!known.has(path)) problems.push(`${where}.href: "${v}" does not match any page`);
        } else visit(v, `${where}.${k}`);
      }
    }
  };
  visit(site, "content/site.json");
  for (const p of pages) visit(p.sections, `content/pages/${p.slug}.json:sections`);
  return problems;
}

/** Marker for facts that a human must confirm before launch, e.g. "[[CONFIRM: opening hours]]". */
export const PLACEHOLDER = /\[\[CONFIRM:?[^\]]*\]\]/g;

export function findPlaceholders(loaded: Pick<LoadedSite, "site" | "pages">): string[] {
  const found: string[] = [];
  const visit = (value: unknown, where: string) => {
    if (typeof value === "string") {
      for (const m of value.match(PLACEHOLDER) ?? []) found.push(`${where}: ${m}`);
    } else if (Array.isArray(value)) value.forEach((v, i) => visit(v, `${where}.${i}`));
    else if (value && typeof value === "object") {
      for (const [k, v] of Object.entries(value)) visit(v, `${where}.${k}`);
    }
  };
  visit(loaded.site, "content/site.json");
  for (const p of loaded.pages) visit(p, `content/pages/${p.slug}.json`);
  return found;
}
