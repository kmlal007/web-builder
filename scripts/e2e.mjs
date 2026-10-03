#!/usr/bin/env node
// End-to-end check of the real customer workflow, using the packed kit exactly as it would be published:
//   pack kit -> create a customer site per template -> npm install -> npm run build -> inspect dist/
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repo = join(dirname(fileURLToPath(import.meta.url)), "..");
const kitDir = join(repo, "packages/site-kit");
const work = join(repo, ".e2e");
rmSync(work, { recursive: true, force: true });
mkdirSync(work, { recursive: true });

const run = (cmd, args, cwd) => execFileSync(cmd, args, { cwd, stdio: ["ignore", "pipe", "inherit"], encoding: "utf8" });

run("pnpm", ["pack", "--pack-destination", work], kitDir);
const tarball = join(work, readdirSync(work).find((f) => f.endsWith(".tgz")));
const cli = join(kitDir, "dist/cli.js");

const templates = readdirSync(join(kitDir, "templates"));
for (const template of templates) {
  const site = join(work, `site-${template}`);
  console.log(`\n== ${template}`);
  run("node", [cli, "create", site, "--template", template, "--customer", `E2E ${template}`, "--kit-spec", `file:${tarball}`], repo);
  run("npm", ["install", "--no-audit", "--no-fund", "--loglevel=error"], site);
  console.log(run("npm", ["run", "build", "--silent"], site).split("\n").filter((l) => /check|error|pages? built|Complete/i.test(l)).join("\n"));

  const pages = readdirSync(join(site, "content/pages")).map((f) => f.replace(/\.json$/, ""));
  for (const slug of pages) {
    const file = join(site, "dist", slug === "home" ? "index.html" : `${slug}/index.html`);
    if (!existsSync(file)) throw new Error(`${template}: missing ${file}`);
    const html = readFileSync(file, "utf8");
    if (!html.includes("--color-primary")) throw new Error(`${template}/${slug}: theme CSS not inlined`);
    if (/<script/i.test(html)) throw new Error(`${template}/${slug}: unexpected <script> in static output`);
  }
  console.log(`ok: ${pages.length} pages, static HTML, no client JS`);

  // Launch gate must fail while template placeholders remain.
  let launchFailed = false;
  try {
    run("npm", ["run", "check:launch", "--silent"], site);
  } catch {
    launchFailed = true;
  }
  if (!launchFailed) throw new Error(`${template}: check:launch passed despite [[CONFIRM]] placeholders`);
  console.log("ok: launch gate blocks unconfirmed placeholders");
}
console.log("\nE2E passed");
