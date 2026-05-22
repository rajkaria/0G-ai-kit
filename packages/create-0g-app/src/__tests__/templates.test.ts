import { describe, it, expect } from "vitest";
import { mkdtempSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TEMPLATES, fetchTemplate, isValidTemplateName } from "../templates.js";

describe("templates catalogue", () => {
  it("includes all 9 archetype templates", () => {
    const names = TEMPLATES.map((t) => t.name);
    expect(names).toEqual([
      "storage-app",
      "inference-app",
      "attestation-verify",
      "mcp-agent",
      "react-app",
      "chat",
      "ai-agent",
      "tee-attested-api",
      "nft-with-storage",
    ]);
  });

  it.each([
    "chat",
    "ai-agent",
    "tee-attested-api",
    "nft-with-storage",
  ])("validates SP8 template name: %s", (name) => {
    expect(isValidTemplateName(name)).toBe(true);
  });

  it("attaches a non-empty description to every template", () => {
    for (const t of TEMPLATES) {
      expect(t.description.length).toBeGreaterThan(0);
    }
  });

  it("rejects unknown templates", () => {
    expect(isValidTemplateName("totally-fake")).toBe(false);
    expect(isValidTemplateName("")).toBe(false);
    expect(isValidTemplateName("storage-app")).toBe(true);
  });

  it.skipIf(!process.env.CI_HAS_NET)(
    "fetches storage-app into a tmpdir",
    async () => {
      const dir = mkdtempSync(join(tmpdir(), "cga-"));
      await fetchTemplate({ name: "storage-app", dest: dir });
      expect(existsSync(join(dir, "package.json"))).toBe(true);
      const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
      expect(pkg.name).toBe("storage-app");
    },
    30_000
  );
});
