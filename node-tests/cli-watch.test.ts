import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const cli = fileURLToPath(new URL("../packages/rpc4next-cli/dist/index.js", import.meta.url));

void test("built CLI watches route changes under Node", { timeout: 40000 }, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rpc4next-node-watch-"));
  const routeDir = path.join(dir, "app", "api", "users", "[id]");
  const routePath = path.join(routeDir, "route.ts");
  const contractPath = path.join(routeDir, "route-contract.ts");
  const outputPath = path.join(dir, "generated", "rpc.ts");
  fs.mkdirSync(routeDir, { recursive: true });
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(routePath, "export function GET() {}\n");

  const child = spawn(
    process.execPath,
    [cli, "app", "generated/rpc.ts", "--params-file", "route-contract.ts", "--watch"],
    { cwd: dir, stdio: ["ignore", "pipe", "pipe"] },
  );
  let output = "";
  child.stdout.on("data", (chunk) => {
    output += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    output += chunk.toString();
  });
  let exitError: Error | undefined;
  child.on("error", (error) => {
    exitError = error;
  });
  const closed = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve) =>
    child.on("close", (code, signal) => resolve({ code, signal })),
  );
  const waitFor = async (description: string, condition: () => boolean) => {
    const deadline = Date.now() + 10000;
    while (Date.now() < deadline) {
      if (exitError || child.exitCode !== null || child.signalCode !== null) {
        throw new Error(`CLI exited while waiting for ${description}: ${exitError ?? output}`);
      }
      if (condition()) return;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error(`Timed out waiting for ${description}:\n${output}`);
  };
  const contains = (file: string, value: string) =>
    fs.existsSync(file) && fs.readFileSync(file, "utf8").includes(value);

  try {
    await waitFor(
      "initial generation",
      () => contains(outputPath, '"$get"') && contains(contractPath, '"/api/users/[id]"'),
    );
    fs.appendFileSync(routePath, "export function POST() {}\n");
    await waitFor("changed route generation", () => contains(outputPath, '"$post"'));
    const usersDir = path.dirname(routeDir);
    const privateUsersDir = path.join(path.dirname(usersDir), "_users");
    const movedContractPath = path.join(privateUsersDir, "[id]", "route-contract.ts");
    fs.renameSync(usersDir, privateUsersDir);
    await waitFor(
      "moved private route cleanup",
      () => !fs.existsSync(movedContractPath) && !contains(outputPath, '"$post"'),
    );
    const check = spawnSync(
      process.execPath,
      [cli, "app", "generated/rpc.ts", "--params-file", "route-contract.ts", "--check"],
      { cwd: dir, encoding: "utf8", timeout: 10000 },
    );
    assert.ifError(check.error);
    assert.equal(check.status, 0, `${check.stdout}\n${check.stderr}`);

    fs.renameSync(privateUsersDir, usersDir);
    await waitFor(
      "restored public route generation",
      () => contains(outputPath, '"$post"') && fs.existsSync(contractPath),
    );
    fs.rmSync(routePath);
    await waitFor(
      "deleted route cleanup",
      () => !fs.existsSync(contractPath) && !contains(outputPath, '"$post"'),
    );
  } finally {
    child.kill("SIGTERM");
    const timer = setTimeout(() => child.kill("SIGKILL"), 5000);
    const result = await closed;
    clearTimeout(timer);
    fs.rmSync(dir, { recursive: true, force: true });
    if (process.platform !== "win32") {
      assert.equal(result.code, 0);
      assert.match(output, /Watcher closed\./);
    }
  }
});
