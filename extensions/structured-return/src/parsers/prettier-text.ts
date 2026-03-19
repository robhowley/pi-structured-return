import path from "node:path";
import type { ParserModule, ParsedFailure } from "../types";
import { safeReadFile } from "./utils";

// [warn] file.ts
const WARN_FILE = /^\[warn\] (.+\.\w+)$/;

const parser: ParserModule = {
  id: "prettier-text",
  async parse(ctx) {
    const combined = (safeReadFile(ctx.stdoutPath) + "\n" + safeReadFile(ctx.stderrPath)).trim();
    if (!combined) {
      return {
        tool: "prettier",
        status: "pass",
        summary: "all files formatted",
        failures: [],
        logPath: ctx.logPath,
      };
    }

    const lines = combined.split("\n");
    const failures: ParsedFailure[] = [];

    for (const line of lines) {
      const warnMatch = line.match(WARN_FILE);
      if (warnMatch) {
        const relPath = path.relative(ctx.cwd, warnMatch[1]);
        failures.push({
          id: relPath,
          file: relPath,
          message: "needs formatting",
        });
      }
    }

    // All done, no warnings
    if (failures.length === 0 && combined.includes("All matched files use Prettier code style")) {
      return {
        tool: "prettier",
        status: "pass",
        summary: "all files formatted",
        failures: [],
        logPath: ctx.logPath,
      };
    }

    const summary =
      failures.length > 0
        ? `${failures.length} file${failures.length !== 1 ? "s" : ""} ha${failures.length !== 1 ? "ve" : "s"} formatting issues`
        : "all files formatted";

    return {
      tool: "prettier",
      status: failures.length > 0 ? "fail" : "pass",
      summary,
      failures,
      logPath: ctx.logPath,
    };
  },
};

export default parser;
