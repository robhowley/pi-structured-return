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

        const file = resolveFile(tc, suite, ctx.cwd);
        const line = tc.line !== undefined ? Number(tc.line) : undefined;
        const id = [file, line, tc.name].filter(Boolean).join(":");

        failures.push({
          id: id || String(failures.length),
          file,
          line: Number.isNaN(line) ? undefined : line,
          message: problem.message ?? problem["#text"]?.trim().split("\n")[0],
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
