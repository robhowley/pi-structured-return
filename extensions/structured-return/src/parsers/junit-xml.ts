import fs from "node:fs";
import path from "node:path";
import { XMLParser } from "fast-xml-parser";
import type { ParserModule, ParsedFailure } from "../types";

interface JUnitFailureOrError {
  message?: string;
  type?: string;
  "#text"?: string;
}

interface JUnitTestCase {
  name?: string;
  classname?: string;
  file?: string;
  line?: string | number;
  failure?: JUnitFailureOrError;
  error?: JUnitFailureOrError;
}

interface JUnitTestSuite {
  name?: string;
  file?: string;
  tests?: string | number;
  failures?: string | number;
  errors?: string | number;
  testcase?: JUnitTestCase[];
  "system-out"?: string;
}

interface JUnitDocument {
  testsuites?: { testsuite?: JUnitTestSuite[] };
  testsuite?: JUnitTestSuite[];
}

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  isArray: (name) => ["testsuite", "testcase"].includes(name),
});

/** Extract file, line, and message from failure body text.
 *  Handles pytest-style (last line: "file.py:line: ExceptionType")
 *  and Go-style (any line: "    file.go:line: message"). */
function parseBodyLocation(text: string): { file: string; line: number; message?: string } | undefined {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  for (const line of lines) {
    const m = line.match(/^([^:\s]+\.\w+):(\d+):\s*(.*)/);
    if (m) return { file: m[1], line: Number(m[2]), message: m[3] || undefined };
  }
  return undefined;
}

/** Extract panic message and file:line for a specific test from Go's system-out. */
function parsePanicInfo(
  systemOut: string,
  testName: string
): { message?: string; file?: string; line?: number } | undefined {
  const lines = systemOut.split("\n");
  const panicLine = lines.find((l) => l.trim().startsWith("panic:"));
  if (!panicLine) return undefined;
  const message = panicLine
    .trim()
    .replace(/^panic:\s*/, "")
    .replace(/\s*\[.*\]$/, "")
    .trim();

  // Find the stack frame for this test function, then grab the file:line on the next line
  for (let i = 0; i < lines.length - 1; i++) {
    if (lines[i].includes(`.${testName}(`)) {
      const m = lines[i + 1].trim().match(/^([^:]+\.go):(\d+)/);
      if (m) return { message, file: m[1].split("/").pop(), line: Number(m[2]) };
    }
  }
  return { message };
}

function resolveFile(tc: JUnitTestCase, suite: JUnitTestSuite, cwd: string): string | undefined {
  const raw = tc.file ?? suite.file;
  if (raw) return path.relative(cwd, path.resolve(cwd, raw));
  // Java/JVM: classname like "com.example.MyTest" → "com/example/MyTest.java"
  if (tc.classname) return tc.classname.replace(/\./g, "/") + ".java";
  return undefined;
}

const parser: ParserModule = {
  id: "junit-xml",
  async parse(ctx) {
    const artifactPath = ctx.artifactPaths[0] ?? ctx.stdoutPath;
    const xml = fs.readFileSync(artifactPath, "utf8");
    const doc = xmlParser.parse(xml) as JUnitDocument;

    const suites: JUnitTestSuite[] = doc.testsuites?.testsuite ?? doc.testsuite ?? [];

    let totalTests = 0;
    let totalFailed = 0;
    const failures: ParsedFailure[] = [];

    for (const suite of suites) {
      totalTests += Number(suite.tests ?? 0);
      totalFailed += Number(suite.failures ?? 0) + Number(suite.errors ?? 0);

      for (const tc of suite.testcase ?? []) {
        const problem = tc.failure ?? tc.error;
        if (!problem) continue;

        const bodyLocation = problem["#text"] ? parseBodyLocation(problem["#text"]) : undefined;
        const panicInfo =
          !bodyLocation && suite["system-out"] && tc.name ? parsePanicInfo(suite["system-out"], tc.name) : undefined;
        const file =
          (tc.file ?? suite.file)
            ? resolveFile(tc, suite, ctx.cwd)
            : (bodyLocation?.file ?? panicInfo?.file ?? resolveFile(tc, suite, ctx.cwd));
        const line = tc.line !== undefined ? Number(tc.line) : (bodyLocation?.line ?? panicInfo?.line);
        const id = [file, line, tc.name].filter(Boolean).join(":");

        failures.push({
          id: id || String(failures.length),
          file,
          line: Number.isNaN(line) ? undefined : line,
          message:
            problem.message && problem.message.toLowerCase() !== "failed"
              ? problem.message
              : (bodyLocation?.message ??
                panicInfo?.message ??
                problem.message ??
                problem["#text"]?.trim().split("\n")[0]),
          rule: problem.type,
        });
      }
    }

    const passed = totalTests - totalFailed;

    return {
      tool: "junit",
      status: totalFailed > 0 ? "fail" : "pass",
      summary: totalFailed > 0 ? `${totalFailed} failed, ${passed} passed` : `${passed} passed`,
      failures,
      artifact: ctx.artifactPaths[0],
      logPath: ctx.logPath,
    };
  },
};

export default parser;
