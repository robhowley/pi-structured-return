import path from "node:path";
import type { ParserModule, ParserRegistration } from "../types";
import ruffJson from "../parsers/ruff-json";
import eslintJson from "../parsers/eslint-json";
import vitestJson from "../parsers/vitest-json";
import rspecJson from "../parsers/rspec-json";
import minitestText from "../parsers/minitest-text";
import junitXml from "../parsers/junit-xml";
import tailFallback from "../parsers/tail-fallback";

const builtIns: Record<string, ParserModule> = {
  "ruff-json": ruffJson,
  "eslint-json": eslintJson,
  "vitest-json": vitestJson,
  "rspec-json": rspecJson,
  "minitest-text": minitestText,
  "junit-xml": junitXml,
  "tail-fallback": tailFallback,
};

/** Built-in detection patterns — fire when no explicit parseAs or project registration matched. */
const AUTO_DETECT: Array<{ parserId: string; detect: (argv: string[]) => boolean }> = [
  {
    parserId: "eslint-json",
    detect: (argv) => argv.includes("eslint") && argv.includes("-f") && argv.includes("json"),
  },
  {
    parserId: "ruff-json",
    detect: (argv) =>
      argv.includes("ruff") &&
      argv.some((a) => a === "--output-format=json" || a === "json") &&
      (argv.includes("--output-format=json") || argv.includes("--output-format")),
  },
  {
    parserId: "vitest-json",
    detect: (argv) => argv.includes("vitest") && argv.includes("--reporter=json"),
  },
  {
    parserId: "rspec-json",
    detect: (argv) =>
      argv.includes("rspec") &&
      (argv.includes("--format=json") || (argv.includes("--format") && argv.includes("json"))),
  },
  {
    parserId: "junit-xml",
    detect: (argv) =>
      argv.some((a) => a.startsWith("--junitxml") || a.startsWith("--junit-xml") || a === "--format=junit"),
  },
];

export function listParsers(): { id: string; autoDetect: boolean }[] {
  const builtInIds = Object.keys(builtIns).filter((id) => id !== "tail-fallback");
  const autoDetectIds = new Set(AUTO_DETECT.map((d) => d.parserId));
  return builtInIds.map((id) => ({ id, autoDetect: autoDetectIds.has(id) }));
}

export async function resolveParser(opts: {
  cwd: string;
  parseAs?: string;
  argv: string[];
  registrations: ParserRegistration[];
}): Promise<ParserModule> {
  if (opts.parseAs && builtIns[opts.parseAs]) return builtIns[opts.parseAs];

  const matched = opts.registrations.find((reg) => matches(reg, opts.argv));
  if (matched?.parseAs && builtIns[matched.parseAs]) return builtIns[matched.parseAs];
  if (matched?.module) {
    const modulePath = path.resolve(opts.cwd, ".pi", matched.module);
    const loaded = await import(modulePath);
    return loaded.default ?? loaded;
  }

  const autoMatched = AUTO_DETECT.find((d) => d.detect(opts.argv));
  if (autoMatched) return builtIns[autoMatched.parserId];

  return builtIns["tail-fallback"];
}

function matches(reg: ParserRegistration, argv: string[]): boolean {
  if (reg.match?.argvIncludes?.length) {
    const ok = reg.match.argvIncludes.every((token) => argv.includes(token));
    if (!ok) return false;
  }
  if (reg.match?.regex) {
    const text = argv.join(" ");
    if (!new RegExp(reg.match.regex).test(text)) return false;
  }
  return Boolean(reg.match?.argvIncludes?.length || reg.match?.regex);
}
