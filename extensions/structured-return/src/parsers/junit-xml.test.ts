import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, expect } from "vitest";
import parser from "./junit-xml";
import type { RunContext } from "../types";

function makeCtx(xml: string, cwd = "/project"): RunContext {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "junit-test-"));
  const artifactPath = path.join(dir, "report.xml");
  fs.writeFileSync(artifactPath, xml);
  return {
    command: "gradle test",
    argv: ["gradle", "test"],
    cwd,
    artifactPaths: [artifactPath],
    stdoutPath: path.join(dir, "stdout"),
    stderrPath: path.join(dir, "stderr"),
    logPath: path.join(dir, "log"),
  };
}

const PASSING = (name: string, classname = "com.example.MyTest") =>
  `<testcase name="${name}" classname="${classname}" time="0.001"/>`;

const FAILING = (
  name: string,
  classname: string,
  message: string,
  type = "AssertionError",
  file?: string,
  line?: number
) => {
  const fileAttr = file ? ` file="${file}"` : "";
  const lineAttr = line !== undefined ? ` line="${line}"` : "";
  return `<testcase name="${name}" classname="${classname}"${fileAttr}${lineAttr} time="0.001">
    <failure message="${message}" type="${type}">full details here</failure>
  </testcase>`;
};

const ERROR = (name: string, classname: string, message: string, type = "RuntimeError") =>
  `<testcase name="${name}" classname="${classname}" time="0.001">
    <error message="${message}" type="${type}">stack trace</error>
  </testcase>`;

describe("junit-xml parser", () => {
  describe("testsuites wrapper (multi-suite)", () => {
    it("mix of passed and failed → status fail, correct counts", async () => {
      const xml = `<?xml version="1.0"?>
        <testsuites>
          <testsuite name="suite1" tests="2" failures="1" errors="0">
            ${PASSING("test_a")}
            ${FAILING("test_b", "com.example.MyTest", "expected 2 but was 1")}
          </testsuite>
          <testsuite name="suite2" tests="2" failures="0" errors="0">
            ${PASSING("test_c")}
            ${PASSING("test_d")}
          </testsuite>
        </testsuites>`;
      const result = await parser.parse(makeCtx(xml));
      expect(result.status).toBe("fail");
      expect(result.summary).toBe("1 failed, 3 passed");
      expect(result.failures).toHaveLength(1);
    });

    it("all passing → status pass", async () => {
      const xml = `<testsuites>
        <testsuite name="suite" tests="2" failures="0" errors="0">
          ${PASSING("test_a")}
          ${PASSING("test_b")}
        </testsuite>
      </testsuites>`;
      const result = await parser.parse(makeCtx(xml));
      expect(result.status).toBe("pass");
      expect(result.summary).toBe("2 passed");
      expect(result.failures).toHaveLength(0);
    });
  });

  describe("bare testsuite (no wrapper)", () => {
    it("single testsuite at root → parsed correctly", async () => {
      const xml = `<testsuite name="suite" tests="2" failures="1" errors="0">
        ${PASSING("test_a")}
        ${FAILING("test_b", "com.example.MyTest", "assert failed")}
      </testsuite>`;
      const result = await parser.parse(makeCtx(xml));
      expect(result.status).toBe("fail");
      expect(result.summary).toBe("1 failed, 1 passed");
    });
  });

  describe("error elements", () => {
    it("error counts as failure, message surfaced", async () => {
      const xml = `<testsuite name="suite" tests="2" failures="0" errors="1">
        ${PASSING("test_a")}
        ${ERROR("test_b", "com.example.MyTest", "NullPointerException", "java.lang.NullPointerException")}
      </testsuite>`;
      const result = await parser.parse(makeCtx(xml));
      expect(result.status).toBe("fail");
      expect(result.summary).toBe("1 failed, 1 passed");
      expect(result.failures![0].message).toBe("NullPointerException");
      expect(result.failures![0].rule).toBe("java.lang.NullPointerException");
    });
  });

  describe("file and line resolution", () => {
    it("file on testcase → relativized to cwd", async () => {
      const xml = `<testsuite name="suite" tests="1" failures="1" errors="0">
        ${FAILING("test_b", "MyTest", "oops", "AssertionError", "/project/src/test/MyTest.java", 42)}
      </testsuite>`;
      const result = await parser.parse(makeCtx(xml, "/project"));
      expect(result.failures![0].file).toBe("src/test/MyTest.java");
      expect(result.failures![0].line).toBe(42);
    });

    it("file on testsuite (not testcase) → used as fallback", async () => {
      const xml = `<testsuite name="suite" tests="1" failures="1" errors="0" file="src/spec/foo_spec.rb">
        ${FAILING("test_b", "MyTest", "oops")}
      </testsuite>`;
      const result = await parser.parse(makeCtx(xml, "/project"));
      expect(result.failures![0].file).toBe("src/spec/foo_spec.rb");
    });

    it("no file attr → classname converted to java path", async () => {
      const xml = `<testsuite name="suite" tests="1" failures="1" errors="0">
        ${FAILING("test_b", "com.example.service.MyTest", "oops")}
      </testsuite>`;
      const result = await parser.parse(makeCtx(xml));
      expect(result.failures![0].file).toBe("com/example/service/MyTest.java");
    });
  });

  describe("failure message", () => {
    it("message attr surfaced directly", async () => {
      const xml = `<testsuite name="suite" tests="1" failures="1" errors="0">
        ${FAILING("test_b", "MyTest", "expected: 99 but was: 12")}
      </testsuite>`;
      const result = await parser.parse(makeCtx(xml));
      expect(result.failures![0].message).toBe("expected: 99 but was: 12");
    });

    it("failure type surfaced as rule", async () => {
      const xml = `<testsuite name="suite" tests="1" failures="1" errors="0">
        ${FAILING("test_b", "MyTest", "oops", "org.junit.ComparisonFailure")}
      </testsuite>`;
      const result = await parser.parse(makeCtx(xml));
      expect(result.failures![0].rule).toBe("org.junit.ComparisonFailure");
    });
  });

  describe("pytest --junitxml output", () => {
    it("extracts file and line from failure body when no file attr present", async () => {
      const xml = `<?xml version="1.0" encoding="utf-8"?>
        <testsuites name="pytest tests">
          <testsuite name="pytest" errors="0" failures="1" skipped="0" tests="2">
            <testcase classname="tests.test_math" name="test_adds" time="0.000"/>
            <testcase classname="tests.test_math" name="test_multiplies" time="0.000">
              <failure message="assert (3 * 4) == 99">def test_multiplies():
&gt;       assert 3 * 4 == 99
E       assert (3 * 4) == 99

tests/test_math.py:5: AssertionError</failure>
            </testcase>
          </testsuite>
        </testsuites>`;
      const result = await parser.parse(makeCtx(xml, "/project"));
      expect(result.failures![0].file).toBe("tests/test_math.py");
      expect(result.failures![0].line).toBe(5);
    });
  });

  describe("multi-suite totals", () => {
    it("failures and errors summed across suites", async () => {
      const xml = `<testsuites>
        <testsuite name="s1" tests="2" failures="1" errors="0">
          ${PASSING("a")}
          ${FAILING("b", "Foo", "oops")}
        </testsuite>
        <testsuite name="s2" tests="2" failures="0" errors="1">
          ${PASSING("c")}
          ${ERROR("d", "Bar", "boom")}
        </testsuite>
      </testsuites>`;
      const result = await parser.parse(makeCtx(xml));
      expect(result.status).toBe("fail");
      expect(result.summary).toBe("2 failed, 2 passed");
      expect(result.failures).toHaveLength(2);
    });
  });
});
