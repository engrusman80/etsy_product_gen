// On Windows, Vite gives @lovable.dev/mcp-js the project root as "F:/..." while path.resolve()
// returns "F:\...", so its "must resolve under" check fails and the dev server crashes.
// Resolving both paths first makes them comparable. Runs after every npm install and is
// safe to run again; it does nothing once the files are patched or if the package changes.
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const MARK = "/* etsyforge: windows path fix */";
const dir = "node_modules/@lovable.dev/mcp-js/dist/stacks/tanstack";
const files = [
  [`${dir}/vite.js`, "resolve"],
  [`${dir}/vite.cjs`, "(0, node_path.resolve)"],
];
const head = "function assertContains(parent, child, label) {\n";

for (const [file, resolveFn] of files) {
  if (!existsSync(file)) continue;
  const src = readFileSync(file, "utf8");
  if (src.includes(MARK) || !src.includes(head)) continue;
  const fix = `\t${MARK} parent = ${resolveFn}(parent); child = ${resolveFn}(child);\n`;
  writeFileSync(file, src.replace(head, head + fix));
  console.log(`patched ${file}`);
}
