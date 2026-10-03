import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { loadSite } from "../content/index.ts";
import {
  siteConfigSchema,
  templateManifestSchema,
  themeSchema,
  type SiteLock,
  type TemplateManifest,
  type Theme,
} from "../schema/index.ts";
import { checkThemeContrast, fontStacks, type ContrastIssue } from "../tokens/index.ts";

/** Kit package root: works from src/cli/*.ts (tests) and from the bundled dist/cli.js. */
export function kitRoot(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  while (dir !== dirname(dir)) {
    const pkg = join(dir, "package.json");
    if (existsSync(pkg) && JSON.parse(readFileSync(pkg, "utf8")).name?.endsWith("/site-kit")) return dir;
    dir = dirname(dir);
  }
  throw new Error("Could not locate the site-kit package root");
}

export function kitPackage(): { name: string; version: string } {
  const { name, version } = JSON.parse(readFileSync(join(kitRoot(), "package.json"), "utf8"));
  return { name, version };
}

export function listTemplates(): TemplateManifest[] {
  const dir = join(kitRoot(), "templates");
  return readdirSync(dir)
    .filter((d) => existsSync(join(dir, d, "template.json")))
    .map((d) => templateManifestSchema.parse(JSON.parse(readFileSync(join(dir, d, "template.json"), "utf8"))));
}

export interface CreateOptions {
  /** Target directory for the new customer repo. Must not exist or be empty. */
  dir: string;
  template: string;
  customer: string;
  primary?: string;
  accent?: string;
  headingFont?: keyof typeof fontStacks;
  bodyFont?: keyof typeof fontStacks;
  /** npm dependency spec for the kit. Defaults to "^<current version>"; use file:/path.tgz for local testing. */
  kitSpec?: string;
  now?: Date;
}

export interface CreateResult {
  dir: string;
  lock: SiteLock;
  contrastIssues: ContrastIssue[];
}

const readJson = (path: string) => JSON.parse(readFileSync(path, "utf8"));
const writeJson = (path: string, data: unknown) => writeFileSync(path, JSON.stringify(data, null, 2) + "\n");

export function toPackageName(customer: string): string {
  const slug = customer
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!slug) throw new Error(`Cannot derive a package name from customer "${customer}"`);
  return `site-${slug}`;
}

/** Copies the scaffold, renaming publish-safe names (_github, gitignore, *.tmpl) and filling {{vars}}. */
function copyScaffold(from: string, to: string, vars: Record<string, string>) {
  for (const entry of readdirSync(from)) {
    const src = join(from, entry);
    let name = entry.replace(/^_/, ".").replace(/\.tmpl$/, "");
    if (name === "gitignore") name = ".gitignore";
    const dest = join(to, name);
    if (statSync(src).isDirectory()) {
      mkdirSync(dest, { recursive: true });
      copyScaffold(src, dest, vars);
    } else {
      const text = readFileSync(src, "utf8");
      writeFileSync(dest, text.replace(/\{\{(\w+)\}\}/g, (m, key: string) => vars[key] ?? m));
    }
  }
}

export function createSite(opts: CreateOptions): CreateResult {
  const root = kitRoot();
  const kit = kitPackage();
  const templateDir = join(root, "templates", opts.template);
  if (!existsSync(join(templateDir, "template.json"))) {
    const known = listTemplates().map((t) => t.id).join(", ");
    throw new Error(`Unknown template "${opts.template}". Available: ${known}`);
  }
  const manifest = templateManifestSchema.parse(readJson(join(templateDir, "template.json")));
  // Fail fast on a broken template rather than producing a broken customer repo.
  loadSite(templateDir);

  if (existsSync(opts.dir) && readdirSync(opts.dir).length > 0) {
    throw new Error(`Target directory ${opts.dir} is not empty`);
  }
  mkdirSync(opts.dir, { recursive: true });

  const vars = {
    packageName: toPackageName(opts.customer),
    customerName: opts.customer,
    kitName: kit.name,
    kitVersion: kit.version,
    kitSpec: opts.kitSpec ?? `^${kit.version}`,
    templateId: manifest.id,
    templateVersion: manifest.version,
  };
  copyScaffold(join(root, "scaffold"), opts.dir, vars);
  cpSync(join(templateDir, "content"), join(opts.dir, "content"), { recursive: true });
  if (existsSync(join(templateDir, "public"))) {
    cpSync(join(templateDir, "public"), join(opts.dir, "public"), { recursive: true });
  }

  // Brand customization (level 1). Validated by the theme schema before writing.
  const theme: Theme = themeSchema.parse(readJson(join(templateDir, "theme.json")));
  if (opts.primary) theme.colors.primary = opts.primary;
  if (opts.accent) theme.colors.accent = opts.accent;
  if (opts.headingFont) theme.fonts.heading = fontStacks[opts.headingFont];
  if (opts.bodyFont) theme.fonts.body = fontStacks[opts.bodyFont];
  // onPrimary was tuned for the template's primary color; re-derive it for the new one.
  if (opts.primary) delete theme.colors.onPrimary;
  writeJson(join(opts.dir, "theme.json"), themeSchema.parse(theme));

  const sitePath = join(opts.dir, "content/site.json");
  const site = siteConfigSchema.parse(readJson(sitePath));
  site.name = opts.customer;
  writeJson(sitePath, site);

  const lock: SiteLock = {
    customer: opts.customer,
    template: { id: manifest.id, version: manifest.version },
    kit,
    createdAt: (opts.now ?? new Date()).toISOString(),
    status: "managed",
  };
  writeJson(join(opts.dir, "site.lock.json"), lock);

  // Final gate: the generated repo must load cleanly.
  const loaded = loadSite(opts.dir);
  return { dir: opts.dir, lock, contrastIssues: checkThemeContrast(loaded.theme) };
}

export function describeCreate(result: CreateResult, cwd = process.cwd()): string {
  const fromCwd = relative(cwd, result.dir) || ".";
  const rel = fromCwd.startsWith("..") ? result.dir : fromCwd;
  const lines = [
    `Created ${result.lock.customer} from ${result.lock.template.id}@${result.lock.template.version} in ${rel}`,
  ];
  for (const i of result.contrastIssues) {
    lines.push(`  warning: low contrast: ${i.pair} is ${i.ratio}:1 (needs ${i.required}:1)`);
  }
  lines.push("", "Next steps:", `  cd ${rel}`, "  git init && npm install", "  npm run dev");
  return lines.join("\n");
}
