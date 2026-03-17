import fs from "node:fs";
import type { ParserModule } from "../types";

const parser: ParserModule = {
  id: "tail-fallback",
  async parse(ctx) {
    const log = fs.readFileSync(ctx.logPath, "utf8");
    const lines = log.split(/\r?\n/);
    const tail = lines.slice(-200).join("\n");
    return {
      tool: "unknown",
      status: "error",
      summary: "no parser matched; returning tail + log path",
      logPath: ctx.logPath,
      rawTail: tail,
    };
  },
};

export default parser;
