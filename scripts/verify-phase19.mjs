import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const extension = process.platform === "win32" ? ".cmd" : "";
const tsc = path.join(root, "node_modules", ".bin", `tsc${extension}`);
const compile = spawnSync(tsc, ["--project", "tsconfig.phase19-tests.json"], { cwd: root, shell: process.platform === "win32", stdio: "inherit" });
if (compile.status !== 0) process.exit(compile.status ?? 1);
const result = spawnSync(process.execPath, ["--test", path.join(root, ".next", "phase19-tests", "performance", "phase19.test.js")], { cwd: root, stdio: "inherit" });
process.exit(result.status ?? 1);
