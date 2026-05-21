import { describe, it, expect } from "vitest";
import { execSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync, readdirSync, statSync } from "node:fs";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../../../..");
const pkgSrc = resolve(here, "..");

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = resolve(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (full.endsWith(".ts")) out.push(full);
  }
  return out;
}

describe("0gkit-indexer neutrality boundary", () => {
  it("pnpm boundary:check passes", () => {
    let ok = true;
    let out = "";
    try {
      out = execSync("pnpm boundary:check", {
        cwd: repoRoot,
        stdio: "pipe",
      }).toString();
    } catch (e: any) {
      ok = false;
      out = (e.stdout?.toString() ?? "") + (e.stderr?.toString() ?? "");
    }
    expect(ok, `boundary:check failed:\n${out}`).toBe(true);
  });

  it("no source file imports a non-0gkit @foundryprotocol package", () => {
    const files = walk(pkgSrc).filter((f) => !f.includes("__tests__"));
    const offenders: string[] = [];
    const staticRe = /from\s+["']@foundryprotocol\/(?!0gkit-)/;
    const dynRe = /import\(\s*["']@foundryprotocol\/(?!0gkit-)/;
    for (const f of files) {
      const src = readFileSync(f, "utf8");
      if (staticRe.test(src) || dynRe.test(src)) offenders.push(f);
    }
    expect(offenders, `offending files:\n${offenders.join("\n")}`).toEqual([]);
  });
});
