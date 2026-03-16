import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, expect } from "vitest";
import parser from "./pytest-json-report";
import type { RunContext } from "../types";

function makeCtx(report: object | null): RunContext {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pytest-test-"));
  const artifactPath = path.join(dir, "report.json");
  if (report !== null) {
    fs.writeFileSync(artifactPath, JSON.stringify(report));
  }
  return {
    command: "pytest --json-report",
    argv: ["pytest", "--json-report"],
    cwd: "/project",
    artifactPaths: [artifactPath],
    stdoutPath: path.join(dir, "stdout"),
    stderrPath: path.join(dir, "stderr"),
    logPath: path.join(dir, "log"),
  };
}

describe("pytest-json-report parser", () => {
  it("mix of passed and failed tests → correct counts, status fail", async () => {
    const report = {
      summary: { passed: 3 },
      tests: [
        { nodeid: "test_foo.py::test_a", outcome: "passed" },
        { nodeid: "test_foo.py::test_b", outcome: "failed", longrepr: "AssertionError: assert False" },
        { nodeid: "test_foo.py::test_c", outcome: "failed", longrepr: "AssertionError: assert 1 == 2" },
      ],
    };
    const result = await parser.parse(makeCtx(report));
    expect(result.status).toBe("fail");
    expect(result.failures).toHaveLength(2);
    expect(result.summary).toBe("2 failed, 3 passed");
  });

  it("all passing → status pass, summary reflects passed count", async () => {
    const report = {
      summary: { passed: 5 },
      tests: [
        { nodeid: "test_foo.py::test_a", outcome: "passed" },
        { nodeid: "test_foo.py::test_b", outcome: "passed" },
      ],
    };
    const result = await parser.parse(makeCtx(report));
    expect(result.status).toBe("pass");
    expect(result.failures).toHaveLength(0);
    expect(result.summary).toBe("5 passed");
  });

  it("failed test with longrepr → first line surfaced as message", async () => {
    const report = {
      summary: { passed: 0 },
      tests: [
        {
          nodeid: "test_foo.py::test_a",
          outcome: "failed",
          longrepr: "AssertionError: assert False\nfull traceback line 2\nfull traceback line 3",
        },
      ],
    };
    const result = await parser.parse(makeCtx(report));
    expect(result.failures![0].message).toBe("AssertionError: assert False");
  });

  it("missing artifact file → throws", async () => {
    const ctx = makeCtx(null);
    // point artifact at a file that doesn't exist
    ctx.artifactPaths = ["/nonexistent/path/report.json"];
    await expect(parser.parse(ctx)).rejects.toThrow();
  });
});
