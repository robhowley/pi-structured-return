import fs from "node:fs";
import type { ParserModule } from "../types";

const parser: ParserModule = {
  id: "eslint-json",
  async parse(ctx) {
    const stdout = fs.readFileSync(ctx.stdoutPath, "utf8").trim();
    const files = stdout ? JSON.parse(stdout) : [];
    const failures = [] as Array<{ id: string; file?: string; line?: number; message?: string; rule?: string }>;
    for (const file of Array.isArray(files) ? files : []) {
      for (const msg of file.messages ?? []) {
        failures.push({
          id: `${file.filePath}:${msg.line}:${msg.ruleId ?? "unknown"}`,
          file: file.filePath,
          line: msg.line,
          message: msg.message,
          rule: msg.ruleId ?? undefined,
        });
      }
    }
    return {
      tool: "eslint",
      status: failures.length > 0 ? "fail" : "pass",
      summary: failures.length > 0 ? `${failures.length} lint errors` : "no lint errors",
      failures,
      logPath: ctx.logPath,
    };
  },
};

export default parser;
