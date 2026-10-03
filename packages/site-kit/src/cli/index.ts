#!/usr/bin/env node
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { fontStacks } from "../tokens/index.ts";
import { checkSite, formatReport } from "./check.ts";
import { createSite, describeCreate, listTemplates } from "./create.ts";

const USAGE = `Usage:
  site-kit templates
  site-kit create <dir> --template <id> --customer "<name>"
                  [--primary #rrggbb] [--accent #rrggbb]
                  [--heading-font ${Object.keys(fontStacks).join("|")}] [--body-font ...]
                  [--kit-spec <npm spec>]
  site-kit check [--root <dir>] [--launch]`;

function fail(message: string): never {
  console.error(`site-kit: ${message}`);
  process.exit(1);
}

function fontOption(value: string | undefined, flag: string) {
  if (value === undefined) return undefined;
  if (!(value in fontStacks)) fail(`${flag} must be one of ${Object.keys(fontStacks).join(", ")}`);
  return value as keyof typeof fontStacks;
}

function main(argv: string[]) {
  const [command, ...rest] = argv;
  switch (command) {
    case "templates": {
      for (const t of listTemplates()) console.log(`${t.id}@${t.version}  ${t.name}: ${t.description}`);
      return;
    }
    case "create": {
      const { values, positionals } = parseArgs({
        args: rest,
        allowPositionals: true,
        options: {
          template: { type: "string" },
          customer: { type: "string" },
          primary: { type: "string" },
          accent: { type: "string" },
          "heading-font": { type: "string" },
          "body-font": { type: "string" },
          "kit-spec": { type: "string" },
        },
      });
      const dir = positionals[0];
      if (!dir || !values.template || !values.customer) fail(`missing arguments\n\n${USAGE}`);
      const result = createSite({
        dir: resolve(dir),
        template: values.template,
        customer: values.customer,
        primary: values.primary,
        accent: values.accent,
        headingFont: fontOption(values["heading-font"], "--heading-font"),
        bodyFont: fontOption(values["body-font"], "--body-font"),
        kitSpec: values["kit-spec"],
      });
      console.log(describeCreate(result));
      return;
    }
    case "check": {
      const { values } = parseArgs({
        args: rest,
        options: { root: { type: "string" }, launch: { type: "boolean", default: false } },
      });
      const { text, ok } = formatReport(checkSite(resolve(values.root ?? ".")), values.launch);
      console.log(text);
      if (!ok) process.exit(1);
      return;
    }
    default:
      console.log(USAGE);
      if (command && command !== "help" && command !== "--help") process.exit(1);
  }
}

try {
  main(process.argv.slice(2));
} catch (err) {
  fail((err as Error).message);
}
