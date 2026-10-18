/**
 * Re-adds the `"use client"` directive to the client-only bundles.
 *
 * esbuild drops module level directives while bundling ("Module level directives
 * cause errors when bundled"), so without this a Next 15 App Router consumer
 * cannot render <ApprovalDialog /> straight from a Server Component.
 *
 * Core and the root entry stay bare: they are plain hooks, usable anywhere.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const CLIENT_BUNDLES = [
  "dist/ui/index.js",
  "dist/ui/index.cjs",
  "dist/adapters/index.js",
  "dist/adapters/index.cjs",
  "dist/machines/index.js",
  "dist/machines/index.cjs",
];

const DIRECTIVE = '"use client";\n';

let patched = 0;

for (const file of CLIENT_BUNDLES) {
  if (!existsSync(file)) {
    console.warn(`postbuild: missing ${file}`);
    continue;
  }
  const source = readFileSync(file, "utf8");
  if (/^\s*["']use client["']/.test(source)) continue;
  writeFileSync(file, DIRECTIVE + source);
  patched += 1;
}

console.log(`postbuild: client directive applied to ${patched} bundle(s)`);
