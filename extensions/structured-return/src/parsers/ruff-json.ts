import fs from "node:fs";
import type { ParserModule } from "../types";

interface RuffItem {
  filename: string;
  code: string;
  message: string;
  location?: { row: number };
}

const parser: ParserModule = {
  id: "ruff-json",
  async parse(ctx) {
    const stdout = fs.readFileSync(ctx.stdoutPath, "utf8").trim();
    const items = stdout ? (JSON.parse(stdout) as RuffItem[]) : [];
    const failures = (Array.isArray(items) ? items : []).map((item) => ({
      id: `${item.filename}:${item.location?.row}:${item.code}`,
      file: item.filename,
      line: item.location?.row,
      message: item.message,
      rule: item.code,
    }));
    return {
      tool: "ruff",
      status: failures.length > 0 ? "fail" : "pass",
      summary: failures.length > 0 ? `${failures.length} lint errors` : "no lint errors",
      failures,
      logPath: ctx.logPath,
    };
  },
};

export default parser;
