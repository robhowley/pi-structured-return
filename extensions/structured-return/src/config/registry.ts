import path from "node:path";
import type { ParserModule, ParserRegistration } from "../types";
import pytestJsonReport from "../parsers/pytest-json-report";
import ruffJson from "../parsers/ruff-json";
import eslintJson from "../parsers/eslint-json";
import vitestJson from "../parsers/vitest-json";
import tailFallback from "../parsers/tail-fallback";

const builtIns: Record<string, ParserModule> = {
  "pytest-json-report": pytestJsonReport,
  "ruff-json": ruffJson,
  "eslint-json": eslintJson,
  "vitest-json": vitestJson,
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
    parserId: "pytest-json-report",
    detect: (argv) => argv.includes("pytest") && argv.includes("--json-report"),
  },
  {
    parserId: "vitest-json",
    detect: (argv) => argv.includes("vitest") && argv.includes("--reporter=json"),
  },
];

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
