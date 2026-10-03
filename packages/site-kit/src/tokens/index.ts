import type { Theme } from "../schema/index.ts";

/** WCAG 2.x relative luminance of a #rrggbb color. */
export function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)) as [
    number,
    number,
    number,
  ];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** Black or white, whichever reads better on the given background. */
export function readableOn(background: string): string {
  return contrastRatio(background, "#000000") >= contrastRatio(background, "#ffffff") ? "#000000" : "#ffffff";
}

export interface ContrastIssue {
  pair: string;
  ratio: number;
  required: number;
}

/** Checks the color pairs the sections actually render against WCAG AA. */
export function checkThemeContrast(theme: Theme): ContrastIssue[] {
  const c = theme.colors;
  const onPrimary = c.onPrimary ?? readableOn(c.primary);
  const pairs: Array<[string, string, string, number]> = [
    ["text on background", c.text, c.background, 4.5],
    ["text on surface", c.text, c.surface, 4.5],
    ["muted on background", c.muted, c.background, 4.5],
    ["onPrimary on primary", onPrimary, c.primary, 4.5],
    ["primary on background (links)", c.primary, c.background, 3],
  ];
  return pairs
    .map(([pair, fg, bg, required]) => ({ pair, ratio: Math.round(contrastRatio(fg, bg) * 100) / 100, required }))
    .filter((r) => r.ratio < r.required);
}

const RADIUS = { none: "0", sm: "4px", md: "10px", lg: "18px", full: "999px" } as const;
const SPACE = { compact: "3.5rem", comfortable: "5rem", spacious: "7rem" } as const;

/** Compiles theme tokens into CSS custom properties consumed by base.css. */
export function themeToCss(theme: Theme): string {
  const c = theme.colors;
  const vars: Record<string, string> = {
    "--color-primary": c.primary,
    "--color-on-primary": c.onPrimary ?? readableOn(c.primary),
    "--color-accent": c.accent,
    "--color-bg": c.background,
    "--color-surface": c.surface,
    "--color-text": c.text,
    "--color-muted": c.muted,
    "--font-heading": theme.fonts.heading,
    "--font-body": theme.fonts.body,
    "--radius": RADIUS[theme.radius],
    "--section-space": SPACE[theme.density],
  };
  // Values come from a validated schema (hex colors, enums); font stacks are the only free text,
  // so strip characters that could close the declaration block or the <style> element.
  const safe = (v: string) => v.replace(/[{}<>;]/g, "");
  return `:root{${Object.entries(vars)
    .map(([k, v]) => `${k}:${safe(v)}`)
    .join(";")}}`;
}

/** System font stacks: no external requests, good performance, no consent needed. */
export const fontStacks = {
  sans: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  serif: 'Georgia, Cambria, "Times New Roman", Times, serif',
  rounded: 'ui-rounded, "SF Pro Rounded", "Nunito", system-ui, sans-serif',
  mono: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
} as const;
