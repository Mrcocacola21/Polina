import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "..");
const executableExtension = process.platform === "win32" ? ".cmd" : "";
const tsc = path.join(repositoryRoot, "node_modules", ".bin", `tsc${executableExtension}`);
const compile = spawnSync(tsc, ["--project", "tsconfig.phase12-tests.json"], {
  cwd: repositoryRoot,
  encoding: "utf8",
  shell: process.platform === "win32",
  stdio: "inherit",
});
if (compile.status !== 0) process.exit(compile.status ?? 1);
const testFile = path.join(repositoryRoot, ".next", "phase12-tests", "cinematic", "phase12.test.js");
const result = spawnSync(process.execPath, ["--test", testFile], { cwd: repositoryRoot, stdio: "inherit" });
process.exit(result.status ?? 1);
