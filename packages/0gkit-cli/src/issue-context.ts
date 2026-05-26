export interface IssueContextError {
  code: string;
  message: string;
  hint: string;
  helpUrl: string;
  /** `err.stack` from the original throw. Optional — some errors lack stacks. */
  stack?: string;
}

export interface IssueContextInput {
  error: IssueContextError;
  /** argv passed to `0g` (without the bin name). Will be redacted before render. */
  argv: readonly string[];
  /** e.g. `process.version` — `v22.11.0`. */
  node: string;
  /** e.g. `darwin 25.5.0`. */
  os: string;
  /** `@foundryprotocol/0gkit-*` packages installed in the user's project. */
  packages: ReadonlyArray<{ name: string; version: string }>;
  /** Injected for deterministic snapshots in tests. */
  now: Date;
}

const SECRET_FLAGS = new Set(["--private-key", "-k"]);
const URL_FLAGS = new Set(["--rpc"]);
const MAX_STACK_FRAMES = 10;

function redactUrl(value: string): string {
  // Parse with URL just to confirm shape, but rewrite via regex so we don't
  // percent-encode the literal placeholder text.
  try {
    new URL(value);
  } catch {
    return value;
  }
  return value.replace(/^([a-z][a-z0-9+.-]*:\/\/)([^@/?#]+)@/i, "$1<redacted>@");
}

/** Strip private-key values + URL userinfo from argv. Idempotent + side-effect-free. */
export function redactArgv(argv: readonly string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const eq = a.indexOf("=");
    if (a.startsWith("--") && eq > 0) {
      const flag = a.slice(0, eq);
      const value = a.slice(eq + 1);
      if (SECRET_FLAGS.has(flag)) {
        out.push(`${flag}=<redacted>`);
        continue;
      }
      if (URL_FLAGS.has(flag)) {
        out.push(`${flag}=${redactUrl(value)}`);
        continue;
      }
      out.push(a);
      continue;
    }
    if (SECRET_FLAGS.has(a) && i + 1 < argv.length) {
      out.push(a, "<redacted>");
      i++;
      continue;
    }
    if (URL_FLAGS.has(a) && i + 1 < argv.length) {
      out.push(a, redactUrl(argv[i + 1]));
      i++;
      continue;
    }
    out.push(a);
  }
  return out;
}

function clipStack(stack: string): { lines: string[]; omitted: number } {
  const all = stack.split("\n");
  const frameLines = all.filter((l) => l.trim().startsWith("at "));
  const header = all.filter((l) => !l.trim().startsWith("at "));
  const kept = frameLines.slice(0, MAX_STACK_FRAMES);
  const omitted = Math.max(0, frameLines.length - kept.length);
  return { lines: [...header, ...kept], omitted };
}

export function buildIssueContext(input: IssueContextInput): string {
  const cli = ["0g", ...redactArgv(input.argv)].join(" ");
  const lines: string[] = [];
  lines.push("### 0gkit error report");
  lines.push("");
  lines.push(`- **Code:** \`${input.error.code}\``);
  lines.push(`- **Message:** ${input.error.message}`);
  lines.push(`- **Hint:** ${input.error.hint}`);
  lines.push(`- **Help:** ${input.error.helpUrl}`);
  lines.push(`- **CLI:** \`${cli}\``);
  lines.push(`- **Node:** ${input.node}`);
  lines.push(`- **OS:** ${input.os}`);
  lines.push(`- **When:** ${input.now.toISOString()}`);
  lines.push("- **Packages:**");
  for (const p of input.packages) {
    lines.push(`  - ${p.name}@${p.version}`);
  }
  if (input.error.stack) {
    const { lines: stackLines, omitted } = clipStack(input.error.stack);
    lines.push("");
    lines.push("#### Stack");
    lines.push("```");
    for (const l of stackLines) lines.push(l);
    if (omitted > 0) lines.push(`… ${omitted} more frames omitted`);
    lines.push("```");
  }
  return lines.join("\n");
}
