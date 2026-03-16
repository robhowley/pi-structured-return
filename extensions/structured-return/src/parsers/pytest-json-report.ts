import fs from "node:fs";
import type { ParserModule } from "../types";

interface PytestTest {
  nodeid: string;
  outcome: string;
  longrepr?: string;
}

interface PytestReport {
  tests?: PytestTest[];
  summary?: { passed?: number };
}

const parser: ParserModule = {
  id: "pytest-json-report",
  async parse(ctx) {
    const artifact = ctx.artifactPaths[0];
    const data = JSON.parse(fs.readFileSync(artifact, "utf8")) as PytestReport;
    const tests = Array.isArray(data.tests) ? data.tests : [];
    const failures = tests
      .filter((t) => t.outcome === "failed")
      .map((t) => ({
        id: t.nodeid,
        file: String(t.nodeid || "").split("::")[0] || undefined,
        message: typeof t.longrepr === "string" ? t.longrepr.split("\n")[0] : "test failed",
      }));
    const failed = failures.length;
    const passed = Number(data.summary?.passed ?? 0);
    return {
      tool: "pytest",
      status: failed > 0 ? "fail" : "pass",
      summary: failed > 0 ? `${failed} failed, ${passed} passed` : `${passed} passed`,
      failures,
      artifact,
      logPath: ctx.logPath,
    };
  },
};

export default parser;
