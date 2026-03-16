import { describe, it, expect } from "vitest";
import { stripCdPrefix, formatResult, finalizeResult } from "./index";

describe("stripCdPrefix", () => {
  it("strips cd /path && prefix", () => {
    expect(stripCdPrefix("cd /some/path && npx eslint . -f json")).toBe("npx eslint . -f json");
  });

  it("leaves commands without cd unchanged", () => {
    expect(stripCdPrefix("npx eslint . -f json")).toBe("npx eslint . -f json");
  });

  it("handles paths with no trailing space variations", () => {
    expect(stripCdPrefix("cd /a/b/c &&npx eslint .")).toBe("npx eslint .");
  });
});

describe("formatResult", () => {
  it("includes cwd when set", () => {
    const result = formatResult({
      tool: "eslint",
      exitCode: 1,
      status: "fail",
      summary: "1 lint errors",
      cwd: "/project",
      failures: [],
    });
    expect(result).toContain("cwd: /project");
  });

  it("omits cwd line when not set", () => {
    const result = formatResult({
      tool: "eslint",
      exitCode: 0,
      status: "pass",
      summary: "no lint errors",
    });
    expect(result).not.toContain("cwd:");
  });

  it("renders relative paths in failure lines", () => {
    const result = formatResult({
      tool: "eslint",
      exitCode: 1,
      status: "fail",
      summary: "1 lint errors",
      cwd: "/project",
      failures: [
        { id: "src/foo.ts:10:rule", file: "src/foo.ts", line: 10, message: "Unexpected any.", rule: "no-explicit-any" },
      ],
    });
    expect(result).toContain("src/foo.ts:10");
    expect(result).not.toContain("/project/src/foo.ts");
  });
});

describe("finalizeResult", () => {
  it("status error with exit code 0 flips to pass", () => {
    const result = finalizeResult(
      {
        tool: "unknown",
        status: "error",
        summary: "no parser matched; returning tail + log path",
        logPath: "/log",
      },
      0,
      "/log",
      "/project"
    );
    expect(result.status).toBe("pass");
    expect(result.summary).toBe("command completed; no parser matched");
  });

  it("status error with non-zero exit code stays error", () => {
    const result = finalizeResult(
      {
        tool: "unknown",
        status: "error",
        summary: "no parser matched; returning tail + log path",
        logPath: "/log",
      },
      1,
      "/log",
      "/project"
    );
    expect(result.status).toBe("error");
  });

  it("attaches cwd to result", () => {
    const result = finalizeResult(
      { tool: "eslint", status: "pass", summary: "no lint errors", logPath: "/log" },
      0,
      "/log",
      "/project"
    );
    expect(result.cwd).toBe("/project");
  });
});
