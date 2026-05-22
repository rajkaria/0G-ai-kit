#!/usr/bin/env node
// docs-check — verifies every ErrorCode referenced by a throw site in the
// 0gkit-* packages has a matching docs page under apps/docs/app/errors/<CODE>/,
// and vice versa.
//
// Pure Node ESM — no tsx, no TypeScript runtime. Imports the built
// `ERROR_CODES` enum from `packages/0gkit-core/dist/index.js` so we never
// have a separate source of truth.

import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, "..");
const PACKAGES_DIR = join(ROOT, "packages");
const DOCS_ERRORS_DIR = join(ROOT, "apps/docs/app/errors");

// Match `new ZeroGError(...)`, `new ConfigError(...)`, etc., capturing the
// first SCREAMING_SNAKE string literal that appears within the first 200
// characters of the arg list. Permissive enough to handle multi-line calls,
// strict enough to avoid matching unrelated strings.
const CODE_RE =
  /new\s+(?:ZeroGError|ConfigError|NetworkError|ChainError|AttestationError)\s*\(\s*[\s\S]{0,200}?"([A-Z][A-Z0-9_]+)"/g;

function* walk(dir) {
  if (!existsSync(dir)) return;
  for (const ent of readdirSync(dir)) {
    if (ent === "node_modules" || ent === "dist" || ent === "__tests__") continue;
    const p = join(dir, ent);
    const s = statSync(p);
    if (s.isDirectory()) yield* walk(p);
    else if (p.endsWith(".ts") || p.endsWith(".tsx")) yield p;
  }
}

export function findReferencedCodes(roots) {
  const out = new Set();
  for (const root of roots) {
    for (const file of walk(root)) {
      const src = readFileSync(file, "utf8");
      let m;
      CODE_RE.lastIndex = 0;
      while ((m = CODE_RE.exec(src)) !== null) {
        out.add(m[1]);
      }
    }
  }
  return out;
}

export function findDocumentedCodes(errorsDir) {
  if (!existsSync(errorsDir)) return new Set();
  const out = new Set();
  for (const ent of readdirSync(errorsDir)) {
    if (ent.startsWith("[") || ent === "page.mdx" || ent === "layout.tsx") continue;
    const p = join(errorsDir, ent);
    if (statSync(p).isDirectory() && existsSync(join(p, "page.mdx"))) {
      out.add(ent);
    }
  }
  return out;
}

export function diffCodes({ referenced, documented, enumDefined }) {
  const missingPages = [...referenced].filter((c) => !documented.has(c)).sort();
  const orphanPages = [...documented].filter((c) => !enumDefined.has(c)).sort();
  const unusedInCode = [...enumDefined].filter((c) => !referenced.has(c)).sort();
  return {
    missingPages,
    orphanPages,
    unusedInCode,
    ok: missingPages.length === 0 && orphanPages.length === 0,
  };
}

async function main() {
  const { ERROR_CODES } = await import(
    join(ROOT, "packages/0gkit-core/dist/index.js")
  );
  const referenced = findReferencedCodes([PACKAGES_DIR]);
  const documented = findDocumentedCodes(DOCS_ERRORS_DIR);
  const enumDefined = new Set(ERROR_CODES);
  const result = diffCodes({ referenced, documented, enumDefined });

  if (result.missingPages.length > 0) {
    console.error(
      `✗ Missing docs page for thrown codes:\n  ${result.missingPages.join("\n  ")}`
    );
  }
  if (result.orphanPages.length > 0) {
    console.error(
      `✗ Orphan docs pages (no code in enum):\n  ${result.orphanPages.join("\n  ")}`
    );
  }
  if (result.unusedInCode.length > 0) {
    console.warn(
      `⚠ Codes defined in enum but never thrown:\n  ${result.unusedInCode.join("\n  ")}`
    );
  }
  if (!result.ok) {
    process.exit(1);
  }
  console.log(
    `✓ docs:check passed — ${referenced.size} codes thrown, all documented`
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
