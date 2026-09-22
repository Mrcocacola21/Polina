import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "..");
const executableExtension = process.platform === "win32" ? ".cmd" : "";
const typeScriptExecutable = path.join(
  repositoryRoot,
  "node_modules",
  ".bin",
  `tsc${executableExtension}`,
);

const compileResult = spawnSync(
  typeScriptExecutable,
  ["--project", "tsconfig.cinematic-tests.json"],
  {
    cwd: repositoryRoot,
    encoding: "utf8",
    shell: process.platform === "win32",
    stdio: "inherit",
  },
);

if (compileResult.status !== 0) {
  process.exit(compileResult.status ?? 1);
}

const testFile = path.join(
  repositoryRoot,
  ".next",
  "cinematic-tests",
  "scene-machine.test.js",
);
const testResult = spawnSync(process.execPath, ["--test", testFile], {
  cwd: repositoryRoot,
  stdio: "inherit",
});

process.exit(testResult.status ?? 1);
