import { ContentError, findPlaceholders, loadSite } from "../content/index.ts";
import { checkThemeContrast } from "../tokens/index.ts";
import { kitPackage } from "./create.ts";

export interface CheckReport {
  errors: string[];
  warnings: string[];
  placeholders: string[];
}

/**
 * Pre-build gate for a customer site.
 * Errors: invalid content, broken internal links, theme contrast below WCAG AA.
 * Placeholders ([[CONFIRM: ...]]) are errors only in launch mode.
 */
export function checkSite(root: string): CheckReport {
  const report: CheckReport = { errors: [], warnings: [], placeholders: [] };
  let loaded;
  try {
    loaded = loadSite(root);
  } catch (err) {
    if (err instanceof ContentError) {
      report.errors.push(...err.problems);
      return report;
    }
    throw err;
  }
  for (const i of checkThemeContrast(loaded.theme)) {
    report.errors.push(`theme.json: low contrast: ${i.pair} is ${i.ratio}:1 (needs ${i.required}:1)`);
  }
  report.placeholders = findPlaceholders(loaded);

  const installed = kitPackage();
  if (loaded.lock && loaded.lock.kit.version !== installed.version) {
    report.warnings.push(
      `site.lock.json records ${loaded.lock.kit.name}@${loaded.lock.kit.version} but ${installed.version} is installed; ` +
        `review the kit changelog and update the lock file`,
    );
  }
  return report;
}

export function formatReport(report: CheckReport, launch: boolean): { text: string; ok: boolean } {
  const lines: string[] = [];
  for (const e of report.errors) lines.push(`error: ${e}`);
  for (const w of report.warnings) lines.push(`warning: ${w}`);
  const level = launch ? "error" : "todo";
  for (const p of report.placeholders) lines.push(`${level}: unconfirmed ${p}`);
  const ok = report.errors.length === 0 && (!launch || report.placeholders.length === 0);
  lines.push(
    ok
      ? `site-kit check passed${report.placeholders.length ? ` (${report.placeholders.length} placeholders to confirm before launch)` : ""}`
      : "site-kit check failed",
  );
  return { text: lines.join("\n"), ok };
}
