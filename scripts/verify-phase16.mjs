import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const extension = process.platform === "win32" ? ".cmd" : "";
const tsc = path.join(root, "node_modules", ".bin", `tsc${extension}`);
const compile = spawnSync(tsc, ["--project", "tsconfig.phase16-tests.json"], {
  cwd: root,
  shell: process.platform === "win32",
  stdio: "inherit",
});
if (compile.status !== 0) process.exit(compile.status ?? 1);
const testFile = path.join(root, ".next", "phase16-tests", "cinematic", "phase16.test.js");
const result = spawnSync(process.execPath, ["--test", testFile], { cwd: root, stdio: "inherit" });
process.exit(result.status ?? 1);
