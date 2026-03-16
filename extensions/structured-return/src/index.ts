import { spawn } from "node:child_process";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { Type } from "@sinclair/typebox";
import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { Text } from "@mariozechner/pi-tui";
import type { ObservedRunArgs, ParsedResult, RunContext } from "./types";
import { ensureRunDir, writeRunArtifacts } from "./storage/log-store";
import { loadProjectConfig } from "./config/project-config";
import { resolveParser } from "./config/registry";

const BUILT_IN_PARSER_IDS = ["pytest-json-report", "ruff-json", "eslint-json", "vitest-json", "tail-fallback"];

export default function structuredReturn(pi: ExtensionAPI) {
  pi.registerCommand("sr-parsers", {
    description: "List all structured-return parsers: built-ins and project-local registrations",
    handler: async (_args, ctx) => {
      const lines: string[] = ["structured-return parsers", ""];

      lines.push("built-in:");
      for (const id of BUILT_IN_PARSER_IDS) {
        lines.push(`  ${id}`);
      }

      const projectRegistrations = loadProjectConfig(ctx.cwd);
      lines.push("");
      lines.push("project-local (.pi/structured-return.json):");
      if (projectRegistrations.length === 0) {
        lines.push("  (none)");
      } else {
        for (const reg of projectRegistrations) {
          const via = reg.parseAs ? `→ ${reg.parseAs}` : reg.module ? `→ module: ${reg.module}` : "";
          const match = reg.match?.argvIncludes
            ? `argv includes [${reg.match.argvIncludes.join(", ")}]`
            : reg.match?.regex
              ? `regex: ${reg.match.regex}`
              : "(no match rule)";
          lines.push(`  ${reg.id}  ${match}  ${via}`);
        }
      }

      ctx.ui.notify(lines.join("\n"), "info");
    },
  });

  pi.on("before_agent_start", async (event) => {
    return {
      systemPrompt:
        event.systemPrompt +
        "\n\nWhen running lint, test, build, or other shell commands, load and follow the `structured-return` skill before choosing how to invoke them.",
    };
  });

  pi.registerTool({
    name: "structured_return",
    label: "Structured Return",
    description:
      "Run a command, store full logs, apply an explicit or registered parser when available, and fall back to tail + log path.",
    parameters: Type.Object({
      command: Type.String(),
      cwd: Type.Optional(Type.String()),
      parseAs: Type.Optional(Type.String()),
      artifactPaths: Type.Optional(Type.Array(Type.String())),
    }),
    async execute(
      _toolCallId: string,
      args: ObservedRunArgs,
      _signal: AbortSignal | undefined,
      _onUpdate: unknown,
      ctx: ExtensionContext
    ) {
      const cwd = args.cwd ?? ctx.cwd ?? process.cwd();
      const runDir = ensureRunDir(cwd);
      const runId = randomUUID();
      const argv = shellSplit(args.command);
      const { stdout, stderr, exitCode } = await runCommand(args.command, cwd);
      const logs = writeRunArtifacts(runDir, runId, stdout, stderr);
      const artifactPaths = (args.artifactPaths ?? []).map((p) => (path.isAbsolute(p) ? p : path.join(cwd, p)));
      const runCtx: RunContext = {
        command: args.command,
        argv,
        cwd,
        artifactPaths,
        ...logs,
      };
      const registrations = loadProjectConfig(cwd);
      const parser = await resolveParser({ cwd, parseAs: args.parseAs, argv, registrations });
      const parsed = await parser.parse(runCtx);
      const result = finalizeResult(parsed, exitCode, logs.logPath, cwd);

      return {
        content: [{ type: "text" as const, text: `${stripCdPrefix(args.command)} → ${formatResult(result)}` }],
        details: { exitCode, logPath: logs.logPath, parser: parser.id },
      };
    },
    renderCall(args: ObservedRunArgs) {
      return new Text(`structured_return ${args.command}`, 0, 0);
    },
    renderResult(result: { content?: Array<{ type: string; text?: string }> }) {
      const text = result?.content?.[0]?.text ?? "structured_return complete";
      return new Text(text, 0, 0);
    },
  });
}

export function formatResult(result: ParsedResult): string {
  const lines: string[] = [];
  if (result.cwd) lines.push(`cwd: ${result.cwd}`);
  lines.push(result.summary);
  for (const f of result.failures ?? []) {
    const location = [f.file, f.line].filter(Boolean).join(":");
    const rule = f.rule ? `  [${f.rule}]` : "";
    lines.push(`  ${location}  ${f.message ?? ""}${rule}`);
  }
  return lines.join("\n");
}

export function stripCdPrefix(command: string): string {
  return command.replace(/^cd\s+\S+\s*&&\s*/, "");
}

function shellSplit(command: string): string[] {
  return command.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g)?.map((s) => s.replace(/^['"]|['"]$/g, "")) ?? [];
}

function runCommand(command: string, cwd: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    const proc = spawn(command, { cwd, shell: true, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d) => {
      stdout += d.toString();
    });
    proc.stderr.on("data", (d) => {
      stderr += d.toString();
    });
    proc.on("close", (code) => resolve({ stdout, stderr, exitCode: code ?? 1 }));
  });
}

export function finalizeResult(
  result: Omit<ParsedResult, "exitCode">,
  exitCode: number,
  logPath: string,
  cwd: string
): ParsedResult {
  if (result.status === "error" && exitCode === 0) {
    return {
      ...result,
      exitCode,
      cwd,
      status: "pass",
      summary:
        result.summary === "no parser matched; returning tail + log path"
          ? "command completed; no parser matched"
          : result.summary,
      logPath,
    };
  }
  return { ...result, exitCode, cwd, logPath };
}
