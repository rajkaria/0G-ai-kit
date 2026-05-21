import { describe, expect, it } from "vitest";
import { mkdtempSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { run } from "../index.js";

const argv = (...rest: string[]) => ["node", "create-0gkit-app", ...rest];

describe("create-0gkit-app", () => {
  it("scaffolds a project through the published npm-create entry", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "c0ga-run-"));
    const code = await run(
      argv(
        "demo",
        "--template",
        "storage-app",
        "--network",
        "local",
        "--no-install",
        "--no-git"
      ),
      {
        cwd,
        log: () => {},
        err: () => {},
        fetchTemplate: async ({ dest }) => {
          writeFileSync(join(dest, "package.json"), '{"name":"demo"}');
        },
      }
    );

    expect(code).toBe(0);
    expect(existsSync(join(cwd, "demo", "package.json"))).toBe(true);
    expect(existsSync(join(cwd, "demo", ".env.example"))).toBe(true);
  });

  it("prints the create-0gkit-app command name in help output", async () => {
    const writes: string[] = [];
    const originalWrite = process.stdout.write;
    process.stdout.write = ((chunk: string | Uint8Array) => {
      writes.push(String(chunk));
      return true;
    }) as typeof process.stdout.write;

    try {
      const code = await run(argv("--help"), {
        cwd: mkdtempSync(join(tmpdir(), "c0ga-help-")),
        log: () => {},
        err: () => {},
      });

      expect(code).toBe(0);
      expect(writes.join("")).toContain("Usage: create-0gkit-app");
    } finally {
      process.stdout.write = originalWrite;
    }
  });

  it("prints the package version for --version", async () => {
    const writes: string[] = [];
    const originalWrite = process.stdout.write;
    process.stdout.write = ((chunk: string | Uint8Array) => {
      writes.push(String(chunk));
      return true;
    }) as typeof process.stdout.write;

    try {
      const code = await run(argv("--version"), {
        cwd: mkdtempSync(join(tmpdir(), "c0ga-version-")),
        log: () => {},
        err: () => {},
      });
      const pkg = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8"));

      expect(code).toBe(0);
      expect(writes.join("").trim()).toBe(pkg.version);
    } finally {
      process.stdout.write = originalWrite;
    }
  });
});
